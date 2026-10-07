/**
 * Seguimiento de obras por cliente — la pantalla principal del apartado de Obras de Ingeniería.
 *
 * Cómo está montada (y por qué):
 *  - Cabecera con buscador y «+ Nueva obra».
 *  - Tres indicadores del departamento. Lo que no existe se pinta «—» (nunca un cero falso).
 *  - Selector En curso / Finalizadas (con el número de obras de cada uno). Una obra está FINALIZADA
 *    cuando la fase «Finalización obra» tiene fecha real; hasta entonces, en curso.
 *  - Tabla agrupada por cliente, con las píldoras de cliente para filtrar.
 *  - Ficha de la obra a pantalla completa, por bloques (para poder añadir más): diagrama de Gantt de
 *    las 7 fases (con los hitos y el marcar «Empieza hoy» / «Termina hoy»), documentación, tareas
 *    del personal de esa obra y notas.
 *
 * Las fechas de las fases y de las tareas no se teclean: se ponen solas el día que se marcan.
 * Los cálculos salen de los datos reales de la obra. Lo que no hay, no se inventa: se pinta «—».
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle, Calendar, Check, ChevronLeft, Clock, Download, FileSpreadsheet, FileText, Layers,
  Paperclip, Pencil, Plus, Search, StickyNote, Trash2, Upload, UserPlus, Users, X,
} from 'lucide-react';
import { ingenieria as obrasApi, seguimiento, tareas as tareasApi, users as usersApi } from '../api/endpoints';
import { FASES_OBRA } from '../types';
import type {
  DocumentoObra, EstadoFasesObra, FaseObra, FichaObra, HitoObra, NotaObra,
  ProyectoIngenieria, ResumenObras, Tarea, User,
} from '../types';

// Paleta «papel crema» (elegida por Salva, octubre de 2026). El blanco puro cansa la vista y no deja
// separar la superficie del fondo; el azul de acento se fue: lo que avanza va en verde, «en curso»
// tiene su propio verde medio, y el rojo HomeServe queda para lo urgente.
const T = {
  texto: '#1B2420',
  secundario: '#46514A',
  borde: '#DDD5C0',
  lineaFuerte: '#CDC2A8',
  cabeceraCliente: '#E2DBC7',
  cabeceraColumna: '#E7E0CE',
  superficie: '#FFFDF8',
  zebra: '#FCFAF4',
  barraPrevista: '#DED8C8',
  pendiente: '#C9C2AF',
  acento: '#0B4D3B',
  enCurso: '#2F6B4F',
  negativo: '#B4541A',
  positivo: '#0B4D3B',
};

/** Las cinco instalaciones con las que trabaja el departamento, y las disciplinas que caen en cada una. */
const INSTALACIONES: { nombre: string; disciplinas: string[] }[] = [
  { nombre: 'Clima', disciplinas: ['climatizacion', 'ventilacion', 'aerotermia', 'rite'] },
  { nombre: 'Fontanería', disciplinas: ['fontaneria', 'saneamiento'] },
  { nombre: 'PCI', disciplinas: ['pci'] },
  { nombre: 'Teleco', disciplinas: ['telecom', 'teleco'] },
  { nombre: 'Electricidad', disciplinas: ['electricidad', 'solar', 'fv'] },
];

// ── Formateo: todo lo que no existe sale «—» ──────────────────────────────────────────────────────

const GUION = '—';

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const euros = (v: unknown): string => {
  const n = num(v);
  return n === null ? GUION : `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
};

const dia = (v?: string | null): string => {
  if (!v) return GUION;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? GUION : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Fecha y hora (para el bloc de notas: interesa cuándo se apuntó). */
const diaHora = (v?: string | null): string => {
  if (!v) return GUION;
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? GUION
    : d.toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const fechaCorta = (v?: string | null): string => {
  if (!v) return GUION;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? GUION : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

const soloFecha = (v?: string | null): string => (v ? String(v).slice(0, 10) : '');

const instalacionesDe = (p: ProyectoIngenieria): string[] => {
  const disc = p.disciplinas ?? [];
  return INSTALACIONES.filter(i => i.disciplinas.some(d => disc.includes(d))).map(i => i.nombre);
};

/** La banda de color de la izquierda de cada fila: de un vistazo, cómo va la obra. */
const BANDA_ESTADO: Record<string, string> = {
  parado: '#E30613',
  en_ejecucion: '#2F6B4F',
  pendiente_legalizacion: '#2F6B4F',
  terminado: '#0B4D3B',
  cobrado: '#0B4D3B',
};

const bandaDe = (estado?: string | null): string =>
  BANDA_ESTADO[(estado ?? '').toLowerCase()] ?? '#D8D2C0';

const nombreFase = (slug: string | null): string =>
  FASES_OBRA.find(f => f.slug === slug)?.nombre ?? (slug ? slug : GUION);

// ── Gantt ─────────────────────────────────────────────────────────────────────────────────────────

/** Los días que abarca el eje: desde la primera fecha hasta la última, con un margen para respirar.
 *  Cuenta también los hitos: si un hito cae más allá, el eje se estira para que se vea. */
function ejeDe(fases: FaseObra[], hitos: HitoObra[] = []): { inicio: number; fin: number; dias: number } | null {
  const fechas: number[] = [];
  fases.forEach(f => {
    [f.fecha_inicio_prevista, f.fecha_fin_prevista, f.fecha_inicio_real, f.fecha_fin_real].forEach(v => {
      if (v) {
        const t = new Date(v).getTime();
        if (Number.isFinite(t)) fechas.push(t);
      }
    });
  });
  hitos.forEach(h => {
    if (h.fecha) {
      const t = new Date(h.fecha).getTime();
      if (Number.isFinite(t)) fechas.push(t);
    }
  });
  if (fechas.length === 0) return null;
  const DIA = 86400000;
  const inicio = Math.min(...fechas) - 7 * DIA;
  const fin = Math.max(...fechas, Date.now()) + 14 * DIA;
  return { inicio, fin, dias: Math.max(1, Math.round((fin - inicio) / DIA)) };
}

/** Posición y ancho (en % del eje) de una barra que va de `a` a `b`. */
function tramo(a: string, b: string, eje: { inicio: number; dias: number }) {
  const DIA = 86400000;
  const t0 = new Date(a).getTime();
  const t1 = new Date(b).getTime();
  const left = ((t0 - eje.inicio) / DIA / eje.dias) * 100;
  const ancho = Math.max(0.7, ((t1 - t0) / DIA / eje.dias) * 100);
  return { left: `${Math.max(0, left)}%`, width: `${ancho}%` };
}

/** Los meses que caen dentro del eje, para la regla de arriba del Gantt. */
function mesesDe(eje: { inicio: number; dias: number }) {
  const etiquetas: { txt: string; left: number; dias: number }[] = [];
  const d = new Date(eje.inicio);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  const DIA = 86400000;
  for (let i = 0; i < 60; i++) {
    const mes = new Date(d.getFullYear(), d.getMonth() + i, 1);
    const siguiente = new Date(d.getFullYear(), d.getMonth() + i + 1, 1);
    const desde = Math.max(mes.getTime(), eje.inicio);
    const hasta = Math.min(siguiente.getTime(), eje.inicio + eje.dias * DIA);
    if (hasta > desde) {
      etiquetas.push({
        txt: mes.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
        left: ((desde - eje.inicio) / DIA / eje.dias) * 100,
        dias: Math.round((hasta - desde) / DIA),
      });
    }
  }
  return etiquetas;
}

/** Una fase se pinta en naranja cuando se pasó de la fecha prevista de fin. */
const conRetraso = (f: FaseObra): boolean => {
  if (!f.fecha_fin_prevista) return false;
  const tope = new Date(f.fecha_fin_prevista).getTime();
  const real = f.fecha_fin_real ? new Date(f.fecha_fin_real).getTime() : Date.now();
  return Number.isFinite(tope) && real > tope;
};

// ── Piezas pequeñas ──────────────────────────────────────────────────────────────────────────────

/** Los tonos de las etiquetas. Los cinco últimos dan color a las instalaciones de la obra. */
const TONOS: Record<string, string> = {
  gris: 'bg-[#F2EDE0] text-[#46514A] border-[#DDD5C0]',
  azul: 'bg-[#2F6B4F]/10 text-[#2F6B4F] border-[#2F6B4F]/25',
  verde: 'bg-[#0B4D3B]/10 text-[#0B4D3B] border-[#0B4D3B]/25',
  naranja: 'bg-[#B4541A]/10 text-[#B4541A] border-[#B4541A]/25',
  clima: 'bg-[#2C5C86]/10 text-[#2C5C86] border-[#2C5C86]/25',
  fontaneria: 'bg-[#17696B]/10 text-[#17696B] border-[#17696B]/25',
  pci: 'bg-[#8E3B4E]/10 text-[#8E3B4E] border-[#8E3B4E]/25',
  teleco: 'bg-[#5B4B8A]/10 text-[#5B4B8A] border-[#5B4B8A]/25',
  electricidad: 'bg-[#8A5A1E]/10 text-[#8A5A1E] border-[#8A5A1E]/25',
};

/** El tono que le toca a cada instalación, para ver de un golpe qué lleva la obra. */
const TONO_INSTALACION: Record<string, string> = {
  Clima: 'clima', Fontanería: 'fontaneria', PCI: 'pci', Teleco: 'teleco', Electricidad: 'electricidad',
};

function Etiqueta({ children, tono = 'gris' }: { children: ReactNode; tono?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONOS[tono] ?? TONOS.gris}`}>
      {children}
    </span>
  );
}


/** Quién lleva la obra (departamento de ingeniería): va en la misma línea que el nombre. */
function Responsables({ responsables }: { responsables?: string[] | null }) {
  const gente = responsables ?? [];
  return (
    <span className="inline-flex items-center gap-1 text-[11px]"
      style={{ color: gente.length ? T.secundario : '#8C8574' }}>
      <Users size={11} />
      {/* En negrita: es el nombre de quien lleva la obra (lo pidió Salva el 7-oct-2026). */}
      <strong className="font-bold">
        {gente.length ? gente.join(' · ') : 'Sin responsable asignado'}
      </strong>
    </span>
  );
}


/** Lo mínimo de una fase para poder marcarla: sirve tanto la de la lista como la de la ficha. */
type FaseMarcable = {
  id: string;
  fase: string;
  orden: number;
  fecha_inicio_real?: string | null;
  fecha_fin_real?: string | null;
};

/** El día de hoy como 'aaaa-mm-dd' (lo que esperan las columnas de fecha). */
const hoyISO = (): string => new Date().toISOString().slice(0, 10);

// Las fechas de las fases se ponen solas: al marcar se queda el día de hoy, sin teclear nada.

/** Empieza la fase hoy. */
async function empezarFaseHoy(f: { id: string }) {
  await seguimiento.actualizarFase(f.id, { fecha_inicio_real: hoyISO() });
}

/** Termina la fase hoy (y arranca la siguiente el mismo día, si no había empezado). */
async function terminarFaseHoy(f: FaseMarcable, todas: FaseMarcable[]) {
  await seguimiento.actualizarFase(f.id, {
    ...(f.fecha_inicio_real ? {} : { fecha_inicio_real: hoyISO() }),
    fecha_fin_real: hoyISO(),
  });
  const siguiente = [...todas].filter(x => x.orden > f.orden).sort((a, b) => a.orden - b.orden)[0];
  if (siguiente && !siguiente.fecha_inicio_real) {
    await seguimiento.actualizarFase(siguiente.id, { fecha_inicio_real: hoyISO() });
  }
}

/** Vuelve a abrir la fase: le quita la fecha de fin. */
async function reabrirFaseMarcada(f: { id: string }) {
  await seguimiento.actualizarFase(f.id, { fecha_fin_real: null });
}

/**
 * Los 7 puntos de progreso de una obra: hechos en negro, el actual con anillo, pendientes en gris.
 * Un punto relleno significa que ESA fase tiene fecha de fin real. NO se pulsan (orden del usuario:
 * «que se cumplimenten cuando se finalizan las tareas, no a mano»): las fases se marcan en la ficha
 * de la obra («Empieza hoy» / «Termina hoy») y aquí solo se refleja lo que hay.
 */
function Progreso({ fases, hechas, actual }: {
  fases?: FaseMarcable[];
  hechas: number;
  actual: string | null;
}) {
  const iActual = actual ? FASES_OBRA.findIndex(f => f.slug === actual) : -1;
  return (
    <div className="flex items-center gap-1">
      {FASES_OBRA.map((f, i) => {
        const fase = fases?.[i];
        const hecha = fase ? !!fase.fecha_fin_real : i < hechas;
        const esActual = fase ? fase.fase === actual : i === iActual;
        const pista = `${i + 1}. ${f.nombre} · ${hecha ? `hecha${fase?.fecha_fin_real ? ` el ${dia(fase.fecha_fin_real)}` : ''}` : esActual ? 'en curso' : 'pendiente'}`;
        return (
          <span key={f.slug} title={pista} className="inline-flex h-4 w-4 items-center justify-center">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{
              background: hecha ? T.texto : T.superficie,
              border: `1.5px solid ${hecha ? T.texto : esActual ? T.enCurso : T.pendiente}`,
              boxShadow: esActual ? `0 0 0 2px ${T.enCurso}33` : undefined,
            }} />
          </span>
        );
      })}
    </div>
  );
}

// ── Gantt de la ficha ────────────────────────────────────────────────────────────────────────────

function Gantt({ fases, hitos, onEmpezar, onTerminar, onReabrir }: {
  fases: FaseObra[];
  hitos: HitoObra[];
  /** Marcar la fase: la fecha se pone sola con el día de hoy. */
  onEmpezar?: (f: FaseObra) => void;
  onTerminar?: (f: FaseObra) => void;
  onReabrir?: (f: FaseObra) => void;
}) {
  const eje = useMemo(() => ejeDe(fases, hitos), [fases, hitos]);
  if (!eje) {
    return (
      <p className="text-sm" style={{ color: T.secundario }}>
        Todavía no hay fechas de fases. Baja a «Fechas de las fases» y pulsa <strong>Empieza hoy</strong> en
        la primera: el diagrama se dibuja solo.
      </p>
    );
  }
  const meses = mesesDe(eje);
  const hoy = tramo(new Date().toISOString(), new Date().toISOString(), eje);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[850px]">
        {/* Regla de meses */}
        <div className="flex items-end" style={{ borderBottom: `1px solid ${T.borde}` }}>
          <div className="w-[200px] shrink-0 pb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.secundario }}>
            Fase
          </div>
          <div className="relative h-6 flex-1">
            {meses.map(m => (
              <span
                key={m.txt + m.left}
                className="absolute top-0 h-full font-mono text-[10px]"
                style={{ left: `${m.left}%`, width: `${(m.dias / eje.dias) * 100}%`, color: T.secundario, borderLeft: `1px solid ${T.borde}` }}
              >
                <span className="pl-1.5">{m.txt}</span>
              </span>
            ))}
          </div>
          <div className="w-[200px] shrink-0 pb-1 pl-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.secundario }}>
            Fechas
          </div>
          <div className="w-[112px] shrink-0 pb-1 pl-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.secundario }}>
            Marcar
          </div>
        </div>

        {/* Fases */}
        <div className="relative">
          {fases.map(f => {
            const retraso = conRetraso(f);
            const enCurso = !!f.fecha_inicio_real && !f.fecha_fin_real;
            const finReal = f.fecha_fin_real ?? (enCurso ? new Date().toISOString() : null);
            const color = retraso ? T.negativo : enCurso ? T.enCurso : T.texto;
            return (
              <div key={f.id} className="flex items-center" style={{ borderBottom: `1px solid ${T.borde}`, minHeight: 44 }}>
                <div className="w-[200px] shrink-0 pr-2 text-[13px]" style={{ color: T.texto }}>
                  <span className="font-mono text-[11px]" style={{ color: T.secundario }}>{f.orden}.</span> {nombreFase(f.fase)}
                </div>
                <div className="relative h-[26px] flex-1">
                  {meses.map(m => (
                    <span key={m.txt + m.left} className="absolute top-0 h-full" style={{ left: `${m.left}%`, borderLeft: `1px solid #E7E1D2` }} />
                  ))}
                  {/* barra prevista */}
                  {f.fecha_inicio_prevista && f.fecha_fin_prevista && (
                    <span
                      className="absolute bottom-[2px] h-[10px] rounded"
                      style={{ ...tramo(f.fecha_inicio_prevista, f.fecha_fin_prevista, eje), background: T.barraPrevista }}
                    />
                  )}
                  {/* barra real */}
                  {f.fecha_inicio_real && finReal && (
                    <span
                      className="absolute top-[2px] h-[12px] rounded"
                      style={{ ...tramo(f.fecha_inicio_real, finReal, eje), background: color }}
                    />
                  )}
                </div>
                <div className="w-[200px] shrink-0 pl-2 font-mono text-[11px]" style={{ color: retraso ? T.negativo : T.secundario }}>
                  {f.fecha_inicio_real
                    ? `${fechaCorta(f.fecha_inicio_real)} → ${f.fecha_fin_real ? fechaCorta(f.fecha_fin_real) : 'en curso'}`
                    : f.fecha_inicio_prevista
                      ? `prev. ${fechaCorta(f.fecha_inicio_prevista)} → ${fechaCorta(f.fecha_fin_prevista)}`
                      : GUION}
                  {retraso && <span className="ml-1 text-[10px]">· retraso</span>}
                </div>
                {/* Marcar la fase: el día se pone solo, no hay que teclear fechas */}
                <div className="w-[112px] shrink-0 pl-2">
                  {onEmpezar && onTerminar && (f.fecha_fin_real ? (
                    <button onClick={() => onReabrir?.(f)} title="Volver a abrir la fase"
                      className="rounded-lg border px-2 py-1.5 text-[10px] font-medium"
                      style={{ borderColor: T.borde, color: T.secundario, minHeight: 30 }}>
                      Reabrir
                    </button>
                  ) : f.fecha_inicio_real ? (
                    <button onClick={() => onTerminar(f)} title="Marcar el fin con la fecha de hoy"
                      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium text-white"
                      style={{ background: T.positivo, minHeight: 30 }}>
                      <Check size={11} /> Termina hoy
                    </button>
                  ) : (
                    <button onClick={() => onEmpezar(f)} title="Marcar el inicio con la fecha de hoy"
                      className="flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-medium"
                      style={{ borderColor: T.acento, color: T.acento, minHeight: 30 }}>
                      <Clock size={11} /> Empieza hoy
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Hitos: los rombos sobre la misma pista (rellenos = conseguidos). La fila sale SIEMPRE,
              aunque la obra todavía no tenga ninguno: el diagrama lleva su fila de hitos por defecto
              (lo pidió Salva el 7-oct-2026). */}
          <div className="flex items-center" style={{ background: T.zebra, borderBottom: `1px solid ${T.borde}`, minHeight: 32 }}>
            <div className="w-[200px] shrink-0 pl-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: T.secundario }}>
              Hitos
            </div>
            {hitos.length === 0 && (
              <div className="pl-2 text-[11px]" style={{ color: T.secundario }}>
                todavía sin hitos · se añaden abajo, en «Hitos de la obra»
              </div>
            )}
            <div className="flex-1" />
            <div className="w-[200px] shrink-0" />
            <div className="w-[112px] shrink-0" />
          </div>
          {hitos.map(h => {
            const conFecha = !!h.fecha;
            const pos = conFecha ? tramo(h.fecha as string, h.fecha as string, eje).left : null;
            return (
              <div key={h.id} className="flex items-center" style={{ borderBottom: `1px solid ${T.borde}`, minHeight: 40 }}>
                <div className="flex w-[200px] shrink-0 items-center gap-1.5 pr-2 pl-3 text-[12px]" style={{ color: h.hecho ? T.texto : T.secundario }}>
                  <span className="inline-block h-2 w-2 shrink-0 rotate-45"
                    style={{ background: h.hecho ? T.texto : T.superficie, border: `1.5px solid ${h.hecho ? T.texto : T.enCurso}` }} />
                  <span className="truncate" title={h.nombre}>{h.nombre}</span>
                </div>
                <div className="relative h-[26px] flex-1">
                  {pos && (
                    <span
                      className="absolute top-1/2 h-[11px] w-[11px] rotate-45"
                      title={`${h.nombre} · ${dia(h.fecha)}`}
                      style={{
                        left: pos, transform: 'translate(-50%,-50%) rotate(45deg)',
                        background: h.hecho ? T.texto : T.superficie,
                        border: `1.5px solid ${h.hecho ? T.texto : T.acento}`,
                      }}
                    />
                  )}
                </div>
                <div className="w-[200px] shrink-0 pl-2 font-mono text-[11px]" style={{ color: T.secundario }}>
                  {conFecha ? dia(h.fecha) : 'sin fecha'}
                </div>
                <div className="w-[112px] shrink-0" />
              </div>
            );
          })}

          {/* Línea de hoy sobre la pista (no tapa la columna de fechas) */}
          <div className="pointer-events-none absolute inset-0 flex">
            <div className="w-[200px] shrink-0" />
            <div className="relative flex-1">
              <span
                className="absolute top-0 h-full"
                style={{ left: hoy.left, borderLeft: `1px dashed ${T.negativo}` }}
              />
              <span
                className="absolute -top-[13px] font-mono text-[10px]"
                style={{ left: hoy.left, color: T.negativo, transform: 'translateX(-100%)', background: T.superficie, paddingRight: 4, whiteSpace: 'nowrap' }}
              >
                hoy · {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            <div className="w-[200px] shrink-0" />
          </div>
        </div>

        {/* Leyenda */}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]" style={{ color: T.secundario }}>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded" style={{ background: T.barraPrevista }} /> Previsto</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded" style={{ background: T.texto }} /> Real</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded" style={{ background: T.enCurso }} /> En curso</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded" style={{ background: T.negativo }} /> Con retraso</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3" style={{ borderLeft: `1px dashed ${T.negativo}` }} /> Hoy</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rotate-45" style={{ background: T.texto }} /> Hito conseguido
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rotate-45" style={{ border: `1.5px solid ${T.enCurso}`, background: T.superficie }} /> Hito pendiente
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Ficha de obra ────────────────────────────────────────────────────────────────────────────────

/**
 * Quién lleva la obra, en la cabecera de la ficha: el nombre en NEGRITA y se cambia ahí mismo, sin
 * salir de la ficha (lo pidió Salva el 7-oct-2026). Antes era un texto gris pequeño y había que irse
 * al apartado de personal para cambiarlo.
 *
 * La lista de candidatos sale de las personas del sistema (usuarios), no de una copia escrita a mano
 * que se queda vieja; y si alguien no está dado de alta, se escribe a mano y se guarda igual.
 */
function ResponsablesFicha({ obra, onCambio }: { obra: ProyectoIngenieria; onCambio: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [elegidos, setElegidos] = useState<string[]>(obra.responsables ?? []);
  const [gente, setGente] = useState<string[]>([]);
  const [aMano, setAMano] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si la obra cambia por detrás (o se guarda), el borrador se pone al día con lo que hay guardado.
  useEffect(() => { setElegidos(obra.responsables ?? []); }, [obra.responsables]);

  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    usersApi.list()
      .then((us: User[]) => { if (vivo) setGente(us.map(u => u.nombre).filter(Boolean)); })
      .catch(() => { if (vivo) setGente([]); });
    return () => { vivo = false; };
  }, [abierto]);

  const candidatos = useMemo(() => {
    const s = new Set<string>([...gente, ...(obra.responsables ?? []), ...elegidos]);
    return [...s].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
  }, [gente, obra.responsables, elegidos]);

  const alternar = (n: string) =>
    setElegidos(e => (e.includes(n) ? e.filter(x => x !== n) : [...e, n]));

  const anadirAMano = () => {
    const n = aMano.trim();
    if (!n) return;
    setElegidos(e => (e.includes(n) ? e : [...e, n]));
    setAMano('');
  };

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await obrasApi.update(obra.id, { responsables: elegidos });
      setAbierto(false);
      onCambio();
    } catch {
      setError('No se ha podido guardar. Prueba otra vez.');
    } finally {
      setGuardando(false);
    }
  };

  const nombres = obra.responsables ?? [];
  return (
    <span className="relative inline-flex items-center gap-1.5 text-[12px]">
      <Users size={12} style={{ color: T.acento }} />
      <strong className="font-bold" style={{ color: nombres.length ? T.texto : '#8C8574' }}>
        {nombres.length ? nombres.join(' · ') : 'Sin responsable asignado'}
      </strong>
      <button
        onClick={() => setAbierto(a => !a)}
        title="Cambiar el ingeniero responsable"
        className="rounded-lg border p-1"
        style={{ borderColor: T.borde, color: T.acento }}
      >
        <Pencil size={12} />
      </button>

      {abierto && (
        <div className="absolute left-0 top-6 z-20 w-[300px] rounded-xl border p-3 text-left shadow-lg"
          style={{ borderColor: T.borde, background: T.superficie }}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.secundario }}>
            Ingeniero responsable
          </p>
          <div className="flex flex-wrap gap-1.5">
            {candidatos.length === 0 && (
              <span className="text-[11px]" style={{ color: T.secundario }}>Escribe el nombre abajo.</span>
            )}
            {candidatos.map(n => {
              const dentro = elegidos.includes(n);
              return (
                <button key={n} onClick={() => alternar(n)}
                  className="rounded-full border px-2 py-1 text-[11px]"
                  style={{
                    borderColor: dentro ? T.acento : T.borde,
                    background: dentro ? T.acento : 'transparent',
                    color: dentro ? '#FFFFFF' : T.texto,
                  }}>
                  {dentro ? '✓ ' : ''}{n}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1.5">
            <input value={aMano} onChange={e => setAMano(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') anadirAMano(); }}
              placeholder="Otro nombre…"
              className="min-w-0 flex-1 rounded-lg border px-2 py-1 text-[11px]"
              style={{ borderColor: T.borde, color: T.texto }} />
            <button onClick={anadirAMano} className="rounded-lg border px-2 py-1 text-[11px]"
              style={{ borderColor: T.borde, color: T.acento }}>Añadir</button>
          </div>
          {error && <p className="mt-2 text-[11px]" style={{ color: T.negativo }}>{error}</p>}
          <div className="mt-2 flex justify-end gap-1.5">
            <button onClick={() => { setElegidos(obra.responsables ?? []); setAbierto(false); }}
              className="rounded-lg border px-3 py-1.5 text-[11px] font-medium"
              style={{ borderColor: T.borde, color: T.secundario }}>
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando}
              className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50"
              style={{ background: T.acento }}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

function Ficha({ ficha, onCambio, onCerrar }: { ficha: FichaObra; onCambio: () => void; onCerrar: () => void }) {
  const obra = ficha.obra;
  const [aviso, setAviso] = useState<string | null>(null);
  const [borradorFases, setBorradorFases] = useState<Record<string, Partial<FaseObra>>>({});
  const [nuevoHito, setNuevoHito] = useState({ nombre: '', fecha: '' });

  // La ficha se abre a pantalla completa: mientras esté abierta no se mueve la tabla de detrás.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, []);

  const empezarHoy = async (f: FaseObra) => {
    try {
      await empezarFaseHoy(f);
      setAviso(null);
      onCambio();
    } catch {
      setAviso('No se ha podido marcar el inicio de la fase.');
    }
  };

  /** Terminar una fase: se fecha hoy y la siguiente arranca hoy mismo. */
  const terminarHoy = async (f: FaseObra) => {
    try {
      await terminarFaseHoy(f, ficha.fases);
      setAviso(null);
      onCambio();
    } catch {
      setAviso('No se ha podido marcar el fin de la fase.');
    }
  };

  const reabrirFase = async (f: FaseObra) => {
    try {
      await reabrirFaseMarcada(f);
      setAviso(null);
      onCambio();
    } catch {
      setAviso('No se ha podido reabrir la fase.');
    }
  };
  const [subiendo, setSubiendo] = useState(false);
  const entradaArchivo = useRef<HTMLInputElement | null>(null);

  const guardarFase = async (f: FaseObra) => {
    const cambios = borradorFases[f.id];
    if (!cambios) return;
    try {
      await seguimiento.actualizarFase(f.id, cambios);
      setBorradorFases(b => { const c = { ...b }; delete c[f.id]; return c; });
      setAviso(null);
      onCambio();
    } catch {
      setAviso('No se han podido guardar las fechas de esa fase.');
    }
  };

  // ── Hitos: añadir, cambiar la fecha o marcarlos como conseguidos ──
  const crearHito = async () => {
    if (!nuevoHito.nombre.trim()) {
      setAviso('El hito necesita un nombre.');
      return;
    }
    try {
      await seguimiento.crearHito(obra.id, { nombre: nuevoHito.nombre.trim(), fecha: nuevoHito.fecha || null });
      setNuevoHito({ nombre: '', fecha: '' });
      setAviso(null);
      onCambio();
    } catch {
      setAviso('No se ha podido añadir el hito.');
    }
  };

  const cambiarHito = async (id: string, datos: Partial<HitoObra>) => {
    try {
      await seguimiento.actualizarHito(id, datos);
      onCambio();
    } catch {
      setAviso('No se ha podido guardar el hito.');
    }
  };

  const borrarHito = async (id: string) => {
    try {
      await seguimiento.borrarHito(id);
      onCambio();
    } catch {
      setAviso('No se ha podido borrar el hito.');
    }
  };

  const subir = async (archivos: FileList | null) => {
    if (!archivos || archivos.length === 0) return;
    setSubiendo(true);
    try {
      for (const a of Array.from(archivos)) await seguimiento.subirDocumento(obra.id, a);
      setAviso(null);
      onCambio();
    } catch {
      setAviso('No se ha podido subir algún archivo (máximo 80 MB por archivo).');
    } finally {
      setSubiendo(false);
      if (entradaArchivo.current) entradaArchivo.current.value = '';
    }
  };

  const borrarDocumento = async (d: DocumentoObra) => {
    if (!window.confirm(`¿Quitar «${d.nombre}» de la documentación de la obra?`)) return;
    try {
      await seguimiento.borrarDocumento(obra.id, d.id);
      onCambio();
    } catch {
      setAviso('No se ha podido borrar el documento.');
    }
  };

  const campoFecha = (f: FaseObra, clave: keyof FaseObra, etiqueta: string) => {
    const valor = borradorFases[f.id]?.[clave] ?? soloFecha(f[clave] as string | null);
    return (
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wide" style={{ color: T.secundario }}>{etiqueta}</span>
        <input
          type="date"
          value={valor as string}
          onChange={e => setBorradorFases(b => ({ ...b, [f.id]: { ...b[f.id], [clave]: e.target.value || null } }))}
          className="rounded-lg border px-2 py-1.5 font-mono text-[11px]"
          style={{ borderColor: T.borde, color: T.texto }}
        />
      </label>
    );
  };

  return (
    // Pantalla completa: la ficha tapa la tabla y se recorre entera con la rueda.
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: T.superficie }}>
    <div id="ficha-obra" className="min-h-full" style={{ background: T.superficie }}>
      {/* Cabecera de la ficha (pegada arriba al bajar) */}
      <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 p-4" style={{ background: T.cabeceraCliente, borderBottom: `1px solid ${T.borde}` }}>
        <div>
          <button onClick={onCerrar} className="mb-1 flex items-center gap-1 text-[12px] font-medium" style={{ color: T.acento }}>
            <ChevronLeft size={13} /> Volver a la tabla
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px]" style={{ color: T.secundario }}>{obra.num_obra || GUION}</span>
            <h3 className="text-[17px] font-semibold" style={{ color: T.texto }}>{obra.nombre}</h3>
            {ficha.finalizada
              ? <Etiqueta tono="verde">Finalizada</Etiqueta>
              : <Etiqueta tono="azul">{ficha.fase_actual ? `En curso · ${nombreFase(ficha.fase_actual)}` : 'En curso'}</Etiqueta>}
            <ResponsablesFicha obra={obra} onCambio={onCambio} />
          </div>
          <p className="mt-1 text-[12px]" style={{ color: T.secundario }}>
            {obra.cliente || GUION}
            {obra.provincia ? ` · ${obra.provincia}` : ''}
            {obra.direccion ? ` · ${obra.direccion}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {instalacionesDe(obra).length > 0
              ? instalacionesDe(obra).map(i => <Etiqueta key={i} tono={TONO_INSTALACION[i]}>{i}</Etiqueta>)
              : <span className="text-[11px]" style={{ color: T.secundario }}>Sin instalaciones apuntadas</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-right">
          <div>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: T.secundario }}>Presupuesto</p>
            <p className="font-mono text-[15px] font-semibold" style={{ color: T.texto }}>{euros(obra.presupuesto)}</p>
          </div>
          <button onClick={onCerrar} title="Cerrar la ficha"
            className="flex items-center gap-1 self-start rounded-lg border px-3 py-2 text-[12px] font-medium"
            style={{ borderColor: T.borde, color: T.secundario, minHeight: 44 }}>
            <X size={14} /> Cerrar
          </button>
        </div>
      </div>

      {aviso && (
        <p className="flex items-center gap-2 px-4 py-2 text-[12px]" style={{ background: '#FBF1E7', color: T.negativo }}>
          <AlertTriangle size={13} /> {aviso}
        </p>
      )}

      {/* Bloque 1: Gantt de fases */}
      <div className="p-4" style={{ borderBottom: `1px solid ${T.borde}` }}>
        <div className="mb-3 flex items-center gap-2">
          <Calendar size={15} style={{ color: T.acento }} />
          <h4 className="text-[14px] font-semibold" style={{ color: T.texto }}>Fases de la obra</h4>
          <span className="text-[12px]" style={{ color: T.secundario }}>
            {ficha.fases_hechas} de {FASES_OBRA.length} fases terminadas
          </span>
        </div>
        <Gantt fases={ficha.fases} hitos={ficha.hitos}
          onEmpezar={empezarHoy} onTerminar={terminarHoy} onReabrir={reabrirFase} />

        <details className="mt-3">
          <summary className="cursor-pointer text-[12px] font-medium" style={{ color: T.acento }}>
            Fechas de las fases (se ponen solas al marcar)
          </summary>
          <div className="mt-3 space-y-3">
            {ficha.fases.map(f => (
              <div key={f.id} className="rounded-lg border p-3" style={{ borderColor: T.borde }}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-medium" style={{ color: T.texto }}>
                    {f.orden}. {nombreFase(f.fase)}
                    {f.fecha_fin_real && <span className="ml-2 text-[11px]" style={{ color: T.positivo }}>terminada el {fechaCorta(f.fecha_fin_real)}</span>}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {f.fecha_fin_real ? (
                      <button onClick={() => reabrirFase(f)} title="Volver a abrir la fase"
                        className="rounded-lg border px-3 py-2 text-[12px] font-medium"
                        style={{ borderColor: T.borde, color: T.secundario, minHeight: 44 }}>
                        Reabrir
                      </button>
                    ) : f.fecha_inicio_real ? (
                      <button onClick={() => terminarHoy(f)} title="Se fecha hoy y la siguiente arranca hoy"
                        className="flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] font-medium text-white"
                        style={{ background: T.positivo, minHeight: 44 }}>
                        <Check size={13} /> Termina hoy
                      </button>
                    ) : (
                      <button onClick={() => empezarHoy(f)} title="Se fecha hoy el inicio de la fase"
                        className="flex items-center gap-1 rounded-lg border px-3 py-2 text-[12px] font-medium"
                        style={{ borderColor: T.acento, color: T.acento, minHeight: 44 }}>
                        <Clock size={13} /> Empieza hoy
                      </button>
                    )}
                    {borradorFases[f.id] && (
                      <button onClick={() => guardarFase(f)} className="flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] font-medium text-white" style={{ background: T.acento, minHeight: 44 }}>
                        <Check size={13} /> Guardar esta fase
                      </button>
                    )}
                  </div>
                </div>
                <details>
                  <summary className="cursor-pointer text-[11px]" style={{ color: T.secundario }}>
                    Poner las fechas a mano (para corregir o planificar)
                  </summary>
                  <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {campoFecha(f, 'fecha_inicio_prevista', 'Inicio previsto')}
                    {campoFecha(f, 'fecha_fin_prevista', 'Fin previsto')}
                    {campoFecha(f, 'fecha_inicio_real', 'Inicio real')}
                    {campoFecha(f, 'fecha_fin_real', 'Fin real')}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* Bloque 1b: hitos de la obra (los rombos del Gantt) */}
      <div className="p-4" style={{ borderBottom: `1px solid ${T.borde}` }}>
        <div className="mb-3 flex items-center gap-2">
          <Clock size={15} style={{ color: T.acento }} />
          <h4 className="text-[14px] font-semibold" style={{ color: T.texto }}>Hitos de la obra</h4>
          <span className="text-[12px]" style={{ color: T.secundario }}>
            Los 4 hitos de siempre vienen puestos, sin fecha: ponle el día al que ya sepas
          </span>
        </div>

        <div className="space-y-2">
          {ficha.hitos.length === 0 && (
            <p className="text-[12px]" style={{ color: T.secundario }}>
              Esta obra se creó antes de que los hitos vinieran puestos. Añade los que quieras seguir:
              entrega de planos, visita de OCA, inspección, puesta en marcha…
            </p>
          )}
          {ficha.hitos.map(h => (
            <div key={h.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: T.borde }}>
              <button onClick={() => cambiarHito(h.id, { hecho: !h.hecho })}
                title={h.hecho ? 'Marcar como pendiente' : 'Marcar como conseguido'}
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2"
                style={h.hecho ? { background: T.texto, borderColor: T.texto, color: '#fff' } : { borderColor: T.pendiente }}>
                {h.hecho && <Check size={12} />}
              </button>
              <input value={h.nombre}
                onChange={e => cambiarHito(h.id, { nombre: e.target.value })}
                className="min-w-[150px] flex-1 rounded-lg border px-2 py-1.5 text-[12px]"
                style={{ borderColor: T.borde, color: h.hecho ? T.secundario : T.texto }} />
              <input type="date" value={soloFecha(h.fecha)}
                onChange={e => cambiarHito(h.id, { fecha: e.target.value || null })}
                className="rounded-lg border px-2 py-1.5 font-mono text-[12px]" style={{ borderColor: T.borde }} />
              <button onClick={() => borrarHito(h.id)} title="Quitar el hito" className="p-2" style={{ color: '#8C8574' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <input placeholder="Nombre del hito" value={nuevoHito.nombre}
            onChange={e => setNuevoHito(h => ({ ...h, nombre: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') crearHito(); }}
            className="min-w-[170px] flex-1 rounded-lg border px-3 py-2 text-[12px]" style={{ borderColor: T.borde }} />
          <input type="date" value={nuevoHito.fecha}
            onChange={e => setNuevoHito(h => ({ ...h, fecha: e.target.value }))}
            className="rounded-lg border px-3 py-2 font-mono text-[12px]" style={{ borderColor: T.borde }} />
          <button onClick={crearHito}
            className="flex items-center gap-1 rounded-lg px-4 py-2 text-[12px] font-medium text-white"
            style={{ background: T.acento, minHeight: 44 }}>
            <Plus size={13} /> Añadir hito
          </button>
        </div>
      </div>

      {/* Bloque 2: documentación */}
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Paperclip size={15} style={{ color: T.acento }} />
          <h4 className="text-[14px] font-semibold" style={{ color: T.texto }}>Documentación de la obra</h4>
          <span className="text-[12px]" style={{ color: T.secundario }}>Excel, PDF y DWG/DXF</span>
        </div>

        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); subir(e.dataTransfer.files); }}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center"
          style={{ borderColor: T.borde }}
        >
          <Upload size={18} style={{ color: T.secundario }} />
          <p className="mt-2 text-[12px]" style={{ color: T.secundario }}>
            {subiendo ? 'Subiendo…' : 'Arrastra aquí los archivos de la obra, o'}
          </p>
          <input ref={entradaArchivo} type="file" multiple className="hidden"
            onChange={e => subir(e.target.files)} />
          <button onClick={() => entradaArchivo.current?.click()}
            className="mt-2 rounded-lg border px-4 py-2 text-[12px] font-medium" style={{ borderColor: T.acento, color: T.acento, minHeight: 44 }}>
            Elegir archivos
          </button>
        </div>

        <ul className="mt-3 space-y-2">
          {ficha.documentos.length === 0 && (
            <li className="text-[12px]" style={{ color: T.secundario }}>Todavía no hay documentación subida.</li>
          )}
          {ficha.documentos.map(d => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2" style={{ borderColor: T.borde }}>
              <div className="flex items-center gap-2">
                {d.tipo === 'XLSX' ? <FileSpreadsheet size={14} style={{ color: T.positivo }} />
                  : d.tipo === 'PDF' ? <FileText size={14} style={{ color: T.negativo }} />
                    : <Layers size={14} style={{ color: T.acento }} />}
                <span className="text-[12px]" style={{ color: T.texto }}>{d.nombre}</span>
                <Etiqueta>{d.tipo}</Etiqueta>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px]" style={{ color: T.secundario }}>{dia(d.fecha_subida)}</span>
                {d.ruta && (
                  <a href={d.ruta} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 rounded-lg border px-3 py-2 text-[11px] font-medium"
                    style={{ borderColor: T.borde, color: T.acento, minHeight: 44 }}>
                    <Download size={12} /> Descargar
                  </a>
                )}
                <button onClick={() => borrarDocumento(d)} className="p-2" style={{ color: '#8C8574' }} title="Quitar de la obra">
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Bloque 3: tareas de esta obra */}
      <TareasDeObra obra={obra} onCambio={onCambio} />

      {/* Bloque 4: notas de la obra */}
      <NotasDeObra obraId={obra.id} notas={ficha.notas} onCambio={onCambio} />
    </div>
    </div>
  );
}

// ── Tareas de una obra (se crean desde dentro de la ficha) ───────────────────────────────────────

function TareasDeObra({ obra, onCambio }: { obra: ProyectoIngenieria; onCambio: () => void }) {
  const [lista, setLista] = useState<Tarea[]>([]);
  const [personas, setPersonas] = useState<User[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  // «inicio» = el día en que hay que empezarla; «limite» = el día tope. Los dos se eligen aquí:
  // la fecha sola no decía cuál de las dos era (lo pidió Salva el 7-oct-2026).
  const [nueva, setNueva] = useState({ titulo: '', personaId: '', inicio: '', limite: '' });

  const cargar = useCallback(async () => {
    try {
      const [t, u] = await Promise.all([
        tareasApi.list({ proyecto_id: obra.id }),
        usersApi.list().catch(() => [] as User[]),
      ]);
      setLista(t);
      setPersonas(u);
      setAviso(null);
    } catch {
      setAviso('No se han podido cargar las tareas de esta obra.');
    } finally {
      setCargando(false);
    }
  }, [obra.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const asignar = async () => {
    if (!nueva.titulo.trim()) {
      setAviso('Escribe qué hay que hacer.');
      return;
    }
    try {
      await tareasApi.create({
        titulo: nueva.titulo.trim(),
        proyecto_id: obra.id,
        ...(nueva.personaId ? { operario_id: nueva.personaId } : {}),
        ...(nueva.inicio ? { fecha_inicio: nueva.inicio } : {}),
        ...(nueva.limite ? { fecha_limite: nueva.limite } : {}),
      });
      setNueva({ titulo: '', personaId: nueva.personaId, inicio: '', limite: '' });
      setAviso(null);
      cargar();
      onCambio();
    } catch {
      setAviso('No se ha podido asignar la tarea.');
    }
  };

  const cambiarEstado = async (t: Tarea, estado: string) => {
    try { await tareasApi.update(t.id, { estado: estado as never }); cargar(); onCambio(); }
    catch { setAviso('No se ha podido cambiar el estado.'); }
  };

  const borrar = async (t: Tarea) => {
    try { await tareasApi.remove(t.id); cargar(); onCambio(); }
    catch { setAviso('No se ha podido borrar la tarea.'); }
  };

  const abiertas = lista.filter(t => t.estado !== 'hecha').length;

  return (
    <div className="p-4" style={{ borderTop: `1px solid ${T.borde}` }}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <UserPlus size={15} style={{ color: T.acento }} />
        <h4 className="text-[14px] font-semibold" style={{ color: T.texto }}>Tareas del personal en esta obra</h4>
        <span className="text-[12px]" style={{ color: T.secundario }}>
          {abiertas} {abiertas === 1 ? 'abierta' : 'abiertas'} de {lista.length}
        </span>
      </div>

      {aviso && (
        <p className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px]" style={{ background: '#FBF1E7', color: T.negativo }}>
          <AlertTriangle size={13} /> {aviso}
        </p>
      )}

      {cargando ? (
        <p className="py-3 text-[12px]" style={{ color: T.secundario }}>Cargando tareas…</p>
      ) : (
        <div className="space-y-1.5">
          {lista.length === 0 && (
            <p className="text-[12px]" style={{ color: T.secundario }}>
              Nadie tiene tareas de esta obra. Asigna la primera aquí abajo.
            </p>
          )}
          {lista.map(t => {
            const estado = ESTADOS_TAREA.find(e => e.valor === t.estado) ?? ESTADOS_TAREA[0];
            const tarde = t.estado !== 'hecha' && t.fecha_limite && new Date(t.fecha_limite) < new Date();
            return (
              <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
                style={{ borderColor: T.borde, background: t.estado === 'hecha' ? T.zebra : T.superficie }}>
                <select value={t.estado} onChange={e => cambiarEstado(t, e.target.value)}
                  className="rounded-lg border px-2 py-1.5 text-[11px]"
                  style={{ borderColor: t.estado === 'hecha' ? T.positivo : T.borde, color: t.estado === 'hecha' ? T.positivo : t.estado === 'en_curso' ? T.acento : T.secundario }}>
                  {ESTADOS_TAREA.map(e => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
                </select>
                <span className="min-w-[160px] flex-1 text-[12px]"
                  style={{ color: t.estado === 'hecha' ? T.secundario : T.texto, textDecoration: t.estado === 'hecha' ? 'line-through' : undefined }}>
                  {t.titulo}
                </span>
                <span className="text-[11px]" style={{ color: T.texto }}>
                  {t.operario?.nombre ?? (t.responsables?.length ? t.responsables.join(', ') : 'Sin asignar')}
                </span>
                <span className="font-mono text-[11px]" style={{ color: T.secundario }}>
                  inicio {t.fecha_inicio ? dia(t.fecha_inicio) : '—'}
                </span>
                <span className="font-mono text-[11px]" style={{ color: tarde ? T.negativo : T.secundario }}>
                  límite {t.fecha_limite ? dia(t.fecha_limite) : '—'}{tarde && ' · pasada'}
                </span>
                {t.iniciada_en && (
                  <span className="font-mono text-[10px]" style={{ color: T.secundario }}>
                    empezada {fechaCorta(t.iniciada_en)}{t.completada_en ? ` · hecha ${fechaCorta(t.completada_en)}` : ''}
                  </span>
                )}
                {t.estado !== 'hecha' && <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>}
                <button onClick={() => borrar(t)} title="Quitar la tarea" className="p-2" style={{ color: '#8C8574' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-5">
        <input placeholder="Qué hay que hacer" value={nueva.titulo}
          onChange={e => setNueva(n => ({ ...n, titulo: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter') asignar(); }}
          className="rounded-lg border px-3 py-2 text-[12px] lg:col-span-2" style={{ borderColor: T.borde }} />
        <select value={nueva.personaId} onChange={e => setNueva(n => ({ ...n, personaId: e.target.value }))}
          className="rounded-lg border px-2 py-2 text-[12px]" style={{ borderColor: T.borde, color: T.texto }}>
          <option value="">Sin asignar</option>
          {[...personas].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(u => (
            <option key={u.id} value={u.id}>{u.nombre}</option>
          ))}
        </select>
        {/* Las dos fechas, cada una con su nombre: «Inicio» (cuándo hay que empezarla) y «Límite»
            (el día tope). Antes había una sola fecha sin rótulo y no se sabía cuál era. */}
        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide" style={{ color: T.secundario }}>Inicio</span>
            <input type="date" value={nueva.inicio} onChange={e => setNueva(n => ({ ...n, inicio: e.target.value }))}
              title="Día en que hay que empezar la tarea"
              className="w-full rounded-lg border px-2 py-2 font-mono text-[12px]" style={{ borderColor: T.borde }} />
          </label>
          <label className="flex flex-1 flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide" style={{ color: T.secundario }}>Límite</span>
            <input type="date" value={nueva.limite} onChange={e => setNueva(n => ({ ...n, limite: e.target.value }))}
              title="Último día para tenerla hecha"
              className="w-full rounded-lg border px-2 py-2 font-mono text-[12px]" style={{ borderColor: T.borde }} />
          </label>
          <button onClick={asignar}
            className="flex items-center gap-1 rounded-lg px-4 py-2 text-[12px] font-medium text-white"
            style={{ background: T.acento, minHeight: 44 }}>
            <Plus size={13} /> Asignar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Notas de la obra (el bloc de la ficha) ────────────────────────────────────────────────────────

function NotasDeObra({ obraId, notas, onCambio }: { obraId: string; notas: NotaObra[]; onCambio: () => void }) {
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Quién escribe: sale de la sesión del panel, no se teclea.
  const quien = useMemo<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') as User | null; } catch { return null; }
  }, []);

  const anadir = async () => {
    if (!texto.trim()) {
      setAviso('La nota está vacía.');
      return;
    }
    setGuardando(true);
    try {
      await seguimiento.crearNota(obraId, {
        texto: texto.trim(),
        ...(quien?.nombre ? { autor: quien.nombre } : {}),
        ...(quien?.id ? { autor_id: quien.id } : {}),
      });
      setTexto('');
      setAviso(null);
      onCambio();
    } catch {
      setAviso('No se ha podido guardar la nota.');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (n: NotaObra) => {
    try { await seguimiento.borrarNota(n.id); onCambio(); }
    catch { setAviso('No se ha podido borrar la nota.'); }
  };

  return (
    <div className="p-4" style={{ borderTop: `1px solid ${T.borde}` }}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StickyNote size={15} style={{ color: T.acento }} />
        <h4 className="text-[14px] font-semibold" style={{ color: T.texto }}>Notas de la obra</h4>
        <span className="text-[12px]" style={{ color: T.secundario }}>
          {notas.length === 0 ? 'Sin notas' : `${notas.length} ${notas.length === 1 ? 'nota' : 'notas'}`}
        </span>
      </div>

      {aviso && (
        <p className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px]" style={{ background: '#FBF1E7', color: T.negativo }}>
          <AlertTriangle size={13} /> {aviso}
        </p>
      )}

      <div className="space-y-2">
        {notas.length === 0 && (
          <p className="text-[12px]" style={{ color: T.secundario }}>
            Aquí se apunta lo del día a día de la obra: llamadas, acuerdos con dirección facultativa,
            lo que pide la visita de OCA, recados del cliente…
          </p>
        )}
        {notas.map(n => (
          <div key={n.id} className="rounded-lg border px-3 py-2" style={{ borderColor: T.borde }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-medium" style={{ color: T.secundario }}>
                {n.autor || 'Sin autor'}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px]" style={{ color: T.secundario }}>{diaHora(n.createdAt)}</span>
                <button onClick={() => borrar(n)} title="Borrar la nota" className="p-2" style={{ color: '#8C8574' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[12px]" style={{ color: T.texto }}>{n.texto}</p>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <textarea rows={3} value={texto} onChange={e => setTexto(e.target.value)}
          placeholder="Escribe una nota de esta obra…"
          className="w-full rounded-lg border px-3 py-2 text-[12px]" style={{ borderColor: T.borde, color: T.texto }} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px]" style={{ color: T.secundario }}>
            Se guarda con tu nombre y la fecha.
          </span>
          <button onClick={anadir} disabled={guardando}
            className="flex items-center gap-1 rounded-lg px-4 py-2 text-[12px] font-medium text-white"
            style={{ background: T.acento, minHeight: 44, opacity: guardando ? 0.6 : 1 }}>
            <Plus size={13} /> {guardando ? 'Guardando…' : 'Añadir nota'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tareas del personal (asignar trabajo a cada persona) ─────────────────────────────────────────

const ESTADOS_TAREA: { valor: string; texto: string; tono: 'gris' | 'azul' | 'verde' }[] = [
  { valor: 'pendiente', texto: 'Pendiente', tono: 'gris' },
  { valor: 'en_curso', texto: 'En curso', tono: 'azul' },
  { valor: 'hecha', texto: 'Hecha', tono: 'verde' },
];

function TareasPersonal({ obras }: { obras: ProyectoIngenieria[] }) {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [personas, setPersonas] = useState<User[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    try {
      // La lista de personal puede fallar para un perfil no administrador: las tareas se cargan igual.
      const [t, u] = await Promise.all([
        tareasApi.list(),
        usersApi.list().catch(() => [] as User[]),
      ]);
      setTareas(t);
      setPersonas(u);
      setAviso(null);
    } catch {
      setAviso('No se han podido cargar las tareas.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarEstado = async (t: Tarea, estado: string) => {
    try {
      await tareasApi.update(t.id, { estado: estado as never });
      cargar();
    } catch {
      setAviso('No se ha podido cambiar el estado de la tarea.');
    }
  };

  const borrar = async (t: Tarea) => {
    try {
      await tareasApi.remove(t.id);
      cargar();
    } catch {
      setAviso('No se ha podido borrar la tarea.');
    }
  };

  const nombreObra = (id?: string) => {
    const o = obras.find(x => x.id === id);
    if (!o) return null;
    return `${o.num_obra ? o.num_obra + ' · ' : ''}${o.nombre}`;
  };

  /** Cada persona con sus tareas, las abiertas primero. */
  const porPersona = useMemo(() => {
    const mapa = new Map<string, Tarea[]>();
    [...tareas]
      .sort((a, b) => (a.estado === 'hecha' ? 1 : 0) - (b.estado === 'hecha' ? 1 : 0))
      .forEach(t => {
        const persona = t.operario?.nombre
          ?? (t.responsables && t.responsables.length ? t.responsables.join(', ') : 'Sin asignar');
        mapa.set(persona, [...(mapa.get(persona) ?? []), t]);
      });
    return Array.from(mapa.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tareas]);

  const abiertas = tareas.filter(t => t.estado !== 'hecha').length;

  return (
    <div id="tareas-personal" className="rounded-xl border" style={{ borderColor: T.borde, background: T.superficie }}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3" style={{ background: T.cabeceraCliente, borderBottom: `1px solid ${T.borde}` }}>
        <div className="flex items-center gap-2">
          <UserPlus size={15} style={{ color: T.acento }} />
          <h4 className="text-[14px] font-semibold" style={{ color: T.texto }}>Tareas del personal</h4>
        </div>
        <span className="font-mono text-[11px]" style={{ color: T.secundario }}>
          {abiertas} abiertas · {tareas.length} en total · {personas.length} personas
        </span>
      </div>

      {aviso && (
        <p className="flex items-center gap-2 px-4 py-2 text-[12px]" style={{ background: '#FBF1E7', color: T.negativo }}>
          <AlertTriangle size={13} /> {aviso}
        </p>
      )}

      <div className="p-4">
        {cargando ? (
          <p className="py-4 text-center text-[13px]" style={{ color: T.secundario }}>Cargando tareas…</p>
        ) : (
          <div className="space-y-4">
            {porPersona.length === 0 && (
              <p className="text-[12px]" style={{ color: T.secundario }}>
                No hay tareas asignadas todavía. Se crean dentro de la ficha de cada obra.
              </p>
            )}
            {porPersona.map(([persona, lista]) => (
              <div key={persona}>
                <p className="mb-1.5 text-[12px] font-semibold" style={{ color: T.texto }}>
                  {persona}
                  <span className="ml-2 font-normal" style={{ color: T.secundario }}>
                    {lista.filter(t => t.estado !== 'hecha').length} abiertas · {lista.filter(t => t.estado === 'hecha').length} hechas
                  </span>
                </p>
                <div className="space-y-1.5">
                  {lista.map(t => {
                    const estado = ESTADOS_TAREA.find(e => e.valor === t.estado) ?? ESTADOS_TAREA[0];
                    const tarde = t.estado !== 'hecha' && t.fecha_limite && new Date(t.fecha_limite) < new Date();
                    return (
                      <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: T.borde, background: t.estado === 'hecha' ? T.zebra : T.superficie }}>
                        <select value={t.estado} onChange={e => cambiarEstado(t, e.target.value)}
                          className="rounded-lg border px-2 py-1.5 text-[11px]"
                          style={{ borderColor: t.estado === 'hecha' ? T.positivo : T.borde, color: t.estado === 'hecha' ? T.positivo : t.estado === 'en_curso' ? T.acento : T.secundario }}>
                          {ESTADOS_TAREA.map(e => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
                        </select>
                        <span className="min-w-[160px] flex-1 text-[12px]"
                          style={{ color: t.estado === 'hecha' ? T.secundario : T.texto, textDecoration: t.estado === 'hecha' ? 'line-through' : undefined }}>
                          {t.titulo}
                        </span>
                        {nombreObra(t.proyecto_id) && (
                          <span className="text-[11px]" style={{ color: T.secundario }}>{nombreObra(t.proyecto_id)}</span>
                        )}
                        {/* Las dos fechas con su nombre: «inicio» (cuándo hay que empezarla) y
                            «límite» (el día tope). Antes salía una fecha sin rótulo. */}
                        {t.fecha_inicio && (
                          <span className="font-mono text-[11px]" style={{ color: T.secundario }}>
                            inicio {dia(t.fecha_inicio)}
                          </span>
                        )}
                        <span className="font-mono text-[11px]" style={{ color: tarde ? T.negativo : T.secundario }}>
                          límite {t.fecha_limite ? dia(t.fecha_limite) : '—'}
                          {tarde && ' · pasada'}
                        </span>
                        {t.iniciada_en && (
                          <span className="font-mono text-[10px]" style={{ color: T.secundario }}>
                            empezada {fechaCorta(t.iniciada_en)}{t.completada_en ? ` · hecha ${fechaCorta(t.completada_en)}` : ''}
                          </span>
                        )}
                        {t.estado !== 'hecha' && <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>}
                        <button onClick={() => borrar(t)} title="Quitar la tarea" className="p-2" style={{ color: '#8C8574' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Las tareas se crean dentro de la ficha de cada obra */}
        <p className="mt-4 text-[12px]" style={{ color: T.secundario }}>
          Las tareas se asignan dentro de la ficha de cada obra, en el bloque «Tareas del personal en
          esta obra». Aquí ves de un vistazo lo que lleva cada persona.
        </p>
      </div>
    </div>
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────────────────────────────────

// ── Panel visual de situación de las obras ───────────────────────────────────────────────────────
// Lo pidió Salva el 7-oct-2026: en el primer panel de obra nueva, de un vistazo, cómo está el
// departamento. Un donut con la situación de las obras y barras por instalación, como el cuadro del
// informe, pero vivo (sale de las obras que hay cargadas, no de una copia).

/** La situación de una obra, con su nombre y su color. Los estados salen de `estado_obra`. */
const SITUACION_OBRA: Record<string, { etiqueta: string; color: string }> = {
  en_ejecucion: { etiqueta: 'En ejecución', color: '#2F6B4F' },
  terminado: { etiqueta: 'Terminada', color: '#0B4D3B' },
  cobrado: { etiqueta: 'Cobrada', color: '#09402F' },
  por_empezar: { etiqueta: 'Por empezar', color: '#C9A227' },
  pendiente_legalizacion: { etiqueta: 'Pdte. legalizar', color: '#7A6A9B' },
  por_confirmar: { etiqueta: 'Por confirmar', color: '#C2B79B' },
  parado: { etiqueta: 'Parada', color: '#E30613' },
};

/** Las instalaciones se cuentan por disciplina (las de verdad, las de la obra). */
const DISCIPLINA_ETIQUETA: Record<string, string> = {
  climatizacion: 'Clima',
  fontaneria: 'Fontanería',
  electricidad: 'Electricidad',
  saneamiento: 'Saneamiento',
  ventilacion: 'Ventilación',
  telecom: 'Telecom',
  teleco: 'Telecom',
  pci: 'PCI',
  solar: 'Solar',
  fv: 'Solar',
  aerotermia: 'Aerotermia',
  rite: 'RITE',
};

function PanelSituacion({ obras }: { obras: ProyectoIngenieria[] }) {
  const total = obras.length;

  // Solo lo que existe: ningún estado ni ninguna instalación se pinta con un cero inventado.
  const situaciones = useMemo(() => {
    const cuenta = new Map<string, number>();
    obras.forEach(o => {
      const clave = (o.estado_obra ?? '').toLowerCase();
      if (!clave) return;
      cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
    });
    return [...cuenta.entries()]
      .map(([clave, n]) => ({
        clave,
        n,
        etiqueta: SITUACION_OBRA[clave]?.etiqueta ?? clave,
        color: SITUACION_OBRA[clave]?.color ?? '#C2B79B',
      }))
      .sort((a, b) => b.n - a.n);
  }, [obras]);

  const instalaciones = useMemo(() => {
    const cuenta = new Map<string, number>();
    obras.forEach(o => {
      // `disciplinas` llega como lista («climatizacion,fontaneria» en la base): se acepta lista o texto.
      const crudas = Array.isArray(o.disciplinas) ? o.disciplinas : String(o.disciplinas ?? '').split(',');
      const disciplinas = new Set(crudas.map(d => String(d).trim().toLowerCase()).filter(Boolean));
      disciplinas.forEach(d => cuenta.set(d, (cuenta.get(d) ?? 0) + 1));
    });
    return [...cuenta.entries()]
      .map(([clave, n]) => ({ clave, n, etiqueta: DISCIPLINA_ETIQUETA[clave] ?? clave }))
      .sort((a, b) => b.n - a.n);
  }, [obras]);

  if (total === 0 || (situaciones.length === 0 && instalaciones.length === 0)) return null;

  const sumaSit = situaciones.reduce((s, x) => s + x.n, 0);
  const maxInst = Math.max(...instalaciones.map(i => i.n), 1);
  // Donut: se reparte la circunferencia con `stroke-dasharray` (una vuelta por porción).
  const RADIO = 54;
  const VUELTA = 2 * Math.PI * RADIO;
  let recorrido = 0;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {/* Situación de las obras */}
      <div className="rounded-xl border p-4" style={{ borderColor: T.borde, background: T.superficie }}>
        <div className="mb-3 flex items-baseline justify-between">
          <h4 className="text-[14px] font-semibold" style={{ color: T.texto }}>Situación de las obras</h4>
          <span className="text-[11px]" style={{ color: T.secundario }}>
            {sumaSit} de {total} obras
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <svg width={140} height={140} viewBox="0 0 140 140" role="img"
            aria-label="Reparto de las obras por situación">
            <circle cx={70} cy={70} r={RADIO} fill="none" stroke="#EDE8D9" strokeWidth={26} />
            {situaciones.map(s => {
              const porcion = s.n / sumaSit;
              const trazo = (
                <circle
                  key={s.clave}
                  cx={70}
                  cy={70}
                  r={RADIO}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={26}
                  strokeDasharray={`${porcion * VUELTA} ${VUELTA}`}
                  strokeDashoffset={-recorrido * VUELTA}
                  transform="rotate(-90 70 70)"
                />
              );
              recorrido += porcion;
              return trazo;
            })}
            <text x={70} y={66} textAnchor="middle" fontSize={26} fontWeight={700} fill={T.texto}>
              {total}
            </text>
            <text x={70} y={84} textAnchor="middle" fontSize={11} fill={T.secundario}>
              obras
            </text>
          </svg>
          <ul className="min-w-[170px] flex-1 space-y-2">
            {situaciones.map(s => (
              <li key={s.clave} className="flex items-center gap-2 text-[12px]">
                <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} />
                <span style={{ color: T.texto }}>{s.etiqueta}</span>
                <span className="ml-auto font-mono font-semibold" style={{ color: T.texto }}>{s.n}</span>
                <span className="w-11 text-right text-[11px]" style={{ color: T.secundario }}>
                  {Math.round((s.n / sumaSit) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Obras por instalación */}
      <div className="rounded-xl border p-4" style={{ borderColor: T.borde, background: T.superficie }}>
        <div className="mb-3 flex items-baseline justify-between">
          <h4 className="text-[14px] font-semibold" style={{ color: T.texto }}>Obras por instalación</h4>
          <span className="text-[11px]" style={{ color: T.secundario }}>una obra cuenta en cada una de sus disciplinas</span>
        </div>
        <ul className="space-y-2">
          {instalaciones.map(i => (
            <li key={i.clave} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[12px]" style={{ color: T.texto }}>{i.etiqueta}</span>
              <span className="h-4 flex-1 overflow-hidden rounded-sm" style={{ background: '#EDE8D9' }}>
                <span className="block h-full rounded-sm" style={{ width: `${(i.n / maxInst) * 100}%`, background: T.acento }} />
              </span>
              <span className="w-6 text-right font-mono text-[12px] font-semibold" style={{ color: T.texto }}>{i.n}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function SeguimientoObras({ onNuevaObra }: { onNuevaObra?: () => void }) {
  const [obras, setObras] = useState<ProyectoIngenieria[]>([]);
  const [estados, setEstados] = useState<Record<string, EstadoFasesObra>>({});
  const [resumen, setResumen] = useState<ResumenObras | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState<'curso' | 'finalizadas'>('curso');
  const [clienteFiltro, setClienteFiltro] = useState<string | null>(null);
  const [ficha, setFicha] = useState<FichaObra | null>(null);
  const [cargandoFicha, setCargandoFicha] = useState(false);

  const cargarTodo = useCallback(async () => {
    try {
      const [lista, est, res] = await Promise.all([obrasApi.list(), seguimiento.estados(), seguimiento.resumen()]);
      setObras(lista);
      setEstados(est);
      setResumen(res);
      setError(null);
    } catch {
      setError('No se han podido cargar las obras. Revisa la conexión con el gestor.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarTodo(); }, [cargarTodo]);

  const estadoDe = useCallback((o: ProyectoIngenieria): EstadoFasesObra =>
    estados[o.id] ?? { finalizada: false, fase_actual: null, fases_hechas: 0 }, [estados]);

  const abrirFicha = useCallback(async (obraId: string) => {
    setCargandoFicha(true);
    try {
      setFicha(await seguimiento.ficha(obraId));
    } catch {
      setError('No se ha podido abrir la ficha de esa obra.');
    } finally {
      setCargandoFicha(false);
    }
  }, []);

  const refrescar = useCallback(async () => {
    await cargarTodo();
    if (ficha) await abrirFicha(ficha.obra.id);
  }, [cargarTodo, ficha, abrirFicha]);

  /** Lo que se ve con los filtros puestos: búsqueda + cliente + en curso/finalizadas. */
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return obras.filter(o => {
      const finalizada = estadoDe(o).finalizada;
      if (vista === 'curso' && finalizada) return false;
      if (vista === 'finalizadas' && !finalizada) return false;
      if (clienteFiltro && (o.cliente || 'Sin cliente') !== clienteFiltro) return false;
      if (!q) return true;
      return [o.nombre, o.cliente, o.num_obra, o.provincia, o.direccion]
        .some(v => (v ?? '').toString().toLowerCase().includes(q));
    });
  }, [obras, busqueda, clienteFiltro, vista, estadoDe]);

  /** Agrupado por cliente, con su cabecera (nº de obras, margen medio, importe). */
  const grupos = useMemo(() => {
    const mapa = new Map<string, ProyectoIngenieria[]>();
    filtradas.forEach(o => {
      const c = o.cliente || 'Sin cliente';
      mapa.set(c, [...(mapa.get(c) ?? []), o]);
    });
    return Array.from(mapa.entries())
      .map(([nombre, lista]) => {
        const dinero = lista.reduce((s, o) => s + (num(o.presupuesto) ?? 0), 0);
        const tieneDinero = lista.some(o => num(o.presupuesto) != null);
        return {
          nombre,
          obras: lista.sort((a, b) => (a.num_obra ?? '').localeCompare(b.num_obra ?? '') || a.nombre.localeCompare(b.nombre)),
          dinero: tieneDinero ? dinero : null,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [filtradas, vista]);

  /** Píldoras de cliente: todos los que tienen obras, con cuántas. */
  const porCliente = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const cuenta = new Map<string, number>();
    obras
      .filter(o => (vista === 'curso' ? !estadoDe(o).finalizada : estadoDe(o).finalizada))
      .filter(o => !q || [o.nombre, o.cliente, o.num_obra].some(v => (v ?? '').toString().toLowerCase().includes(q)))
      .forEach(o => {
        const c = o.cliente || 'Sin cliente';
        cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
      });
    return Array.from(cuenta.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [obras, vista, busqueda, estadoDe]);

  const totalEnCurso = obras.filter(o => !estadoDe(o).finalizada).length;
  const totalFinalizadas = obras.length - totalEnCurso;

  /**
   * Cambiar de pestaña (En curso / Finalizadas) NO abre nada: solo cambia la lista.
   *
   * Antes abría la ficha de la primera obra de la pestaña, y al darle a «Finalizadas 11» se comía la
   * pantalla con una obra que él no había pedido (avisado por Salva el 7-oct-2026). La ficha se abre
   * solo con su botón «Ver ficha»; si había una abierta, se cierra al cambiar de pestaña.
   */
  const cambiarVista = (nueva: 'curso' | 'finalizadas') => {
    setVista(nueva);
    setFicha(null);
  };

  return (
    <div className="space-y-4" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", color: T.texto }}>
      {error && (
        <p className="flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px]"
          style={{ borderColor: '#E9C6A6', background: '#FBF1E7', color: T.negativo }}>
          <AlertTriangle size={14} /> {error}
        </p>
      )}

      {/* 1 · Cabecera: buscador y «+ Nueva obra» */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.secundario }} />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por obra, cliente, número, provincia…"
            className="w-full rounded-lg border py-3 pl-9 pr-4 text-[13px] outline-none"
            style={{ borderColor: T.borde, background: T.superficie }} />
        </div>
        {busqueda && (
          <button onClick={() => setBusqueda('')} className="flex items-center gap-1 rounded-lg border px-3 py-3 text-[12px]"
            style={{ borderColor: T.borde, color: T.secundario, minHeight: 44 }}>
            <X size={13} /> Limpiar
          </button>
        )}
        {onNuevaObra && (
          <button onClick={onNuevaObra}
            className="flex items-center gap-2 rounded-lg px-4 py-3 text-[13px] font-medium text-white"
            style={{ background: T.acento, minHeight: 44 }}>
            <Plus size={15} /> Nueva obra
          </button>
        )}
      </div>

      {/* 2 · Situación de las obras: el cuadro visual, lo primero que se ve del departamento */}
      {!cargando && <PanelSituacion obras={obras} />}

      {/* 3 · Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[
          { label: 'Clientes con obras activas', valor: cargando ? GUION : String(resumen?.clientes_activos ?? GUION), color: T.texto },
          { label: 'Obras activas', valor: cargando ? GUION : String(resumen?.obras_activas ?? GUION), color: T.texto },
          { label: 'Obras finalizadas', valor: cargando ? GUION : String(resumen?.obras_finalizadas ?? GUION), color: T.positivo },
        ].map(t => (
          <div key={t.label} className="rounded-xl border p-4" style={{ borderColor: T.borde, background: T.superficie }}>
            <p className="font-mono text-[27px] font-semibold" style={{ color: t.color }}>{t.valor}</p>
            <p className="mt-0.5 text-[11px]" style={{ color: T.secundario }}>{t.label}</p>
          </div>
        ))}
      </div>

      {/* 3 · Selector En curso / Finalizadas + píldoras por cliente */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border" style={{ borderColor: T.borde }}>
          {([
            ['curso', `En curso ${totalEnCurso}`],
            ['finalizadas', `Finalizadas ${totalFinalizadas}`],
          ] as const).map(([valor, texto]) => (
            <button key={valor} onClick={() => cambiarVista(valor)}
              className="px-4 py-3 text-[13px] font-medium"
              style={{
                background: vista === valor ? T.acento : T.superficie,
                color: vista === valor ? '#fff' : T.secundario,
                minHeight: 44,
              }}>
              {texto}
            </button>
          ))}
        </div>
        <span className="mx-1 hidden h-6 w-px lg:block" style={{ background: T.borde }} />
        <button onClick={() => setClienteFiltro(null)}
          className="rounded-full border px-3 py-2 text-[12px]"
          style={{ borderColor: clienteFiltro === null ? T.acento : T.borde, color: clienteFiltro === null ? T.acento : T.secundario, minHeight: 44 }}>
          Todos
        </button>
        {porCliente.map(([nombre, n]) => (
          <button key={nombre} onClick={() => setClienteFiltro(clienteFiltro === nombre ? null : nombre)}
            className="rounded-full border px-3 py-2 text-[12px]"
            style={{ borderColor: clienteFiltro === nombre ? T.acento : T.borde, background: clienteFiltro === nombre ? `${T.acento}12` : T.superficie, color: clienteFiltro === nombre ? T.acento : T.secundario, minHeight: 44 }}>
            {nombre} · {n}
          </button>
        ))}
      </div>

      {/* 4 · Tablas agrupadas por cliente */}
      {vista === 'curso' && !cargando && (
        <p className="text-[11px]" style={{ color: T.secundario }}>
          Los puntos de <strong>Fases</strong> se rellenan solos: cada punto es una fase de la obra y
          queda relleno cuando esa fase tiene fecha de fin. Las fases se marcan en la ficha de la obra
          («Termina hoy»).
        </p>
      )}
      {cargando ? (
        <p className="py-8 text-center text-[13px]" style={{ color: T.secundario }}>Cargando obras…</p>
      ) : grupos.length === 0 ? (
        <p className="rounded-xl border border-dashed py-10 text-center text-[13px]" style={{ borderColor: T.borde, color: T.secundario }}>
          No hay obras en «{vista === 'curso' ? 'En curso' : 'Finalizadas'}» con los filtros puestos.
        </p>
      ) : (
        <div className="space-y-4">
          {grupos.map(g => (
            <div key={g.nombre} className="overflow-hidden rounded-xl border" style={{ borderColor: T.borde, background: T.superficie }}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3" style={{ background: T.cabeceraCliente, borderBottom: `1px solid ${T.borde}` }}>
                <span className="text-[14px] font-semibold" style={{ color: T.texto }}>{g.nombre}</span>
                <span className="text-[12px]" style={{ color: T.secundario }}>
                  {g.obras.length} {g.obras.length === 1 ? 'obra' : 'obras'}
                  {vista === 'curso' ? ` · presupuestado ${g.dinero === null ? GUION : euros(g.dinero)}` : ''}
                </span>
              </div>
              <div className="overflow-x-auto">
                {/* Anchos FIJOS (table-fixed + colgroup): cada cliente monta su propia tabla, y sin
                    esto el ancho de las columnas se calcula por contenido y la columna FASES sale
                    desplazada de un grupo de cliente a otro. */}
                <table className="w-full min-w-[860px] table-fixed text-[12px]">
                  <colgroup>
                    <col style={{ width: '26%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '23%' }} />
                    <col style={{ width: '13%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${T.lineaFuerte}` }}>
                      {(vista === 'curso'
                        ? ['Obra', 'Responsable', 'Instalación', 'Fases', '']
                        : ['Obra', 'Responsable', 'Instalación', 'Fecha finalización', '']
                      ).map(h => (
                        <th key={h} className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-wider ${h === 'Responsable' || h === 'Fases' || h === 'Fecha finalización' ? 'text-center' : 'text-left'}`} style={{ color: T.secundario, background: T.cabeceraColumna }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {g.obras.map((o, i) => {
                      const est = estadoDe(o);
                      const esFinalizada = vista === 'finalizadas';
                      return (
                        <tr key={o.id} style={{ borderBottom: `1px solid ${T.borde}`, background: i % 2 ? T.zebra : T.superficie }}>
                          <td className="px-4 py-3" style={{ boxShadow: `inset 3px 0 0 ${bandaDe(o.estado_obra)}` }}>
                            <span className="font-mono text-[11px]" style={{ color: T.secundario }}>{o.num_obra || GUION}</span>
                            <p className="font-medium" style={{ color: T.texto, fontSize: 14, fontWeight: 700 }}>{o.nombre}</p>
                            {!esFinalizada && (
                              <p className="mt-0.5 text-[11px]" style={{ color: T.secundario }}>
                                {est.fase_actual ? `Ahora: ${nombreFase(est.fase_actual)}` : 'Las 7 fases terminadas'}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Responsables responsables={o.responsables} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {instalacionesDe(o).length ? instalacionesDe(o).map(i => <Etiqueta key={i} tono={TONO_INSTALACION[i]}>{i}</Etiqueta>)
                                : <span style={{ color: T.secundario }}>{GUION}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {esFinalizada ? (
                              <span className="font-mono" style={{ color: T.texto }}>{dia(est.fecha_finalizacion)}</span>
                            ) : (
                              <div className="flex justify-center">
                                <Progreso fases={est.fases} hechas={est.fases_hechas} actual={est.fase_actual} />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => abrirFicha(o.id)}
                              className="rounded-lg border px-3 py-2 text-[11px] font-medium"
                              style={{ borderColor: T.borde, color: T.acento, minHeight: 44 }}>
                              Ver ficha
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5 · Tareas del personal */}
      <TareasPersonal obras={obras} />

      {/* 6 · Ficha de la obra */}
      {cargandoFicha && <p className="py-6 text-center text-[13px]" style={{ color: T.secundario }}>Abriendo la ficha…</p>}
      {ficha && !cargandoFicha && <Ficha ficha={ficha} onCambio={refrescar} onCerrar={() => setFicha(null)} />}
    </div>
  );
}
