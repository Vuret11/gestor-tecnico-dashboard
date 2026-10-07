import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Clock, Check, AlertTriangle } from 'lucide-react';
import { legalizaciones as legApi } from '../api/endpoints';
import type { EtapaTramiteNombre, Legalizacion } from '../types';

/**
 * TABLERO DE ETAPAS de legalizaciones. Lo pidió Salva el 7-oct-2026: «también quiero que hayan tres
 * etapas. Deben estar arriba. Iniciadas, Subidas portal y finalizadas. Deben estar por columnas. Y se
 * pueden arrastrar entre ellas».
 *
 * Tres columnas (una por etapa); la tarjeta de cada instalación se arrastra de una a otra. Al soltarla
 * se marcan las etapas que falten hasta esa columna y se desmarcan las posteriores, SIEMPRE en orden
 * (el servidor no deja marcar «Subida Portal» sin «Inicio», ni desmarcar una etapa con otra posterior
 * ya marcada; aquí se hace en el mismo orden para que no haya que reintentar).
 */

const COLUMNAS: { etapa: EtapaTramiteNombre; titulo: string; ayuda: string }[] = [
  { etapa: 'inicio', titulo: 'Iniciadas', ayuda: 'se ha empezado a preparar el trámite' },
  { etapa: 'subida_portal', titulo: 'Subidas portal', ayuda: 'los documentos están en el portal' },
  { etapa: 'finalizado', titulo: 'Finalizadas', ayuda: 'el trámite está terminado' },
];

/** Devuelve true si esa etapa concreta está hecha en el trámite. */
const hecha = (t: Legalizacion, etapa: EtapaTramiteNombre) => (t.etapas_hechas ?? []).includes(etapa);

/** Columna en la que cae un trámite: la última etapa que tenga hecha (sin ninguna → la primera). */
function columnaDe(t: Legalizacion): number {
  let col = 0;
  COLUMNAS.forEach((c, i) => {
    if (hecha(t, c.etapa)) col = i;
  });
  return col;
}

export function TableroEtapas({ tramites }: { tramites: Legalizacion[] }) {
  const qc = useQueryClient();
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [moviendo, setMoviendo] = useState<string | null>(null);

  const marcar = useMutation({
    mutationFn: ({ id, etapa, valor }: { id: string; etapa: EtapaTramiteNombre; valor: boolean }) =>
      legApi.marcarEtapa(id, etapa, valor),
  });

  /**
   * Lleva un trámite a la columna `destino`: marca en orden todo lo que falte hasta ella y desmarca,
   * de la última a la primera, lo que sobre. Desmarcar va al revés porque el servidor no deja quitar
   * una etapa con otra posterior marcada.
   */
  const mover = async (id: string, destino: number) => {
    const t = tramites.find((x) => x.id === id);
    if (!t) return;
    if (columnaDe(t) === destino) return;
    setError('');
    setMoviendo(id);
    try {
      for (let i = 0; i <= destino; i++) {
        if (!hecha(t, COLUMNAS[i].etapa)) {
          await marcar.mutateAsync({ id, etapa: COLUMNAS[i].etapa, valor: true });
        }
      }
      for (let i = COLUMNAS.length - 1; i > destino; i--) {
        if (hecha(t, COLUMNAS[i].etapa)) {
          await marcar.mutateAsync({ id, etapa: COLUMNAS[i].etapa, valor: false });
        }
      }
      await qc.invalidateQueries({ queryKey: ['legalizaciones'] });
    } catch (e: any) {
      setError(
        e?.response?.data?.message
          ? String(e.response.data.message)
          : `No se ha podido mover «${t.cliente ?? 'la instalación'}» de etapa.`,
      );
    } finally {
      setMoviendo(null);
    }
  };

  const total = tramites.length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Etapas de las instalaciones</h3>
          <p className="text-[11px] text-slate-500">
            {total} {total === 1 ? 'instalación activa' : 'instalaciones activas'} · arrastra una tarjeta a otra
            columna para cambiar de etapa (o usa las flechas)
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 flex gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {COLUMNAS.map((col, i) => {
          const tarjetas = tramites.filter((t) => columnaDe(t) === i);
          return (
            <div
              key={col.etapa}
              onDragOver={(e) => {
                e.preventDefault();
                setSobre(i);
              }}
              onDragLeave={() => setSobre((s) => (s === i ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                setSobre(null);
                setArrastrando(null);
                if (id) void mover(id, i);
              }}
              className={`rounded-lg border p-1.5 min-h-[120px] transition-colors ${
                sobre === i ? 'border-red-300 bg-red-50/40' : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[12px] font-semibold text-slate-700">
                  {i === 0 ? <Clock size={12} className="inline -mt-0.5" /> : <Check size={12} className="inline -mt-0.5" />}{' '}
                  {col.titulo}
                </span>
                <span className="text-[11px] text-slate-500">{tarjetas.length}</span>
              </div>

              <div className="space-y-1.5">
                {tarjetas.map((t) => (
                  <div
                    key={t.id}
                    draggable={moviendo !== t.id}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', t.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setArrastrando(t.id);
                    }}
                    onDragEnd={() => setArrastrando(null)}
                    title={`${t.cliente ?? ''}${t.municipio ? ` · ${t.municipio}` : ''}`}
                    className={`bg-white rounded-lg border px-2 py-1.5 cursor-grab active:cursor-grabbing ${
                      arrastrando === t.id ? 'opacity-50 border-red-300' : 'border-slate-200'
                    } ${moviendo === t.id ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-slate-800 truncate">
                          {t.cliente ?? 'Sin titular'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {[t.municipio, t.responsable].filter(Boolean).join(' · ')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {t.tipo_uso === 'SOLO_CLIMATIZACION'
                            ? 'Aire acondicionado'
                            : t.tipo_uso === 'SOLO_ACS'
                              ? 'Solo ACS'
                              : t.tipo_uso === 'HIBRIDA_CALDERA'
                                ? 'Híbrida con caldera'
                                : 'Climatización + ACS'}
                          {t.fecha_inicio ? ` · inicio ${t.fecha_inicio}` : ''}
                        </div>
                        {(t.n_bloqueado ?? 0) > 0 && (
                          <div className="mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                              Bloqueado
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Flechas: en una tablet no hay arrastre, así que también se puede mover con esto */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          disabled={i === 0 || moviendo === t.id}
                          onClick={() => void mover(t.id, i - 1)}
                          title="Pasar a la etapa anterior"
                          className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-20"
                        >
                          <ChevronLeft size={13} className="text-slate-500" />
                        </button>
                        <button
                          type="button"
                          disabled={i === COLUMNAS.length - 1 || moviendo === t.id}
                          onClick={() => void mover(t.id, i + 1)}
                          title="Pasar a la etapa siguiente"
                          className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-20"
                        >
                          <ChevronRight size={13} className="text-slate-500" />
                        </button>
                      </div>
                    </div>
                    {/* En la primera columna se ve si está SIN INICIAR (línea de puntos), que no es lo mismo */}
                    {i === 0 && !hecha(t, 'inicio') && (
                      <div className="text-[10px] text-slate-400 border-t border-dashed border-slate-200 mt-1 pt-0.5">
                        Sin iniciar
                      </div>
                    )}
                  </div>
                ))}
                {tarjetas.length === 0 && (
                  <div className="text-[11px] text-slate-400 px-1 py-3 text-center border border-dashed border-slate-200 rounded-lg">
                    {sobre === i ? 'Suelta aquí' : 'Ninguna'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TableroEtapas;
