import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { homologaciones as api } from '../api/endpoints';
import type { BloqueHomologacion, Homologacion } from '../types';
import { AlertTriangle, Check, ChevronDown, FileText, Loader2, Play, Ruler, ShieldCheck, X } from 'lucide-react';

/**
 * Resultado del análisis de la documentación del trámite, **una respuesta por tipo de instalación**
 * (clima, fontanería, PCI, teleco y electricidad), como se acordó. Dentro de cada una:
 *  · Mediciones vs planos: las partidas del presupuesto, en qué hoja del plano se citan y cuáles
 *    quedan por verificar (con su importe), que es lo que caza el dinero.
 *  · Cumplimiento normativo: su base normativa y lo que se localiza y no se localiza en los planos.
 *
 * Nada de esto es un informe firmado: es un BORRADOR. Lo que no se puede comprobar se dice.
 */

const INSTALACIONES: Record<string, { nombre: string; normativa: string; color: string; borde: string }> = {
  clima: { nombre: 'Clima', normativa: 'RITE · CTE DB-HE', color: 'bg-sky-50 text-sky-800', borde: 'border-sky-200' },
  fontaneria: { nombre: 'Fontanería', normativa: 'CTE DB-HS4/HS5', color: 'bg-teal-50 text-teal-800', borde: 'border-teal-200' },
  pci: { nombre: 'PCI', normativa: 'RIPCI · CTE DB-SI', color: 'bg-rose-50 text-rose-800', borde: 'border-rose-200' },
  teleco: { nombre: 'Teleco', normativa: 'ICT', color: 'bg-violet-50 text-violet-800', borde: 'border-violet-200' },
  electricidad: { nombre: 'Electricidad', normativa: 'REBT', color: 'bg-amber-50 text-amber-800', borde: 'border-amber-200' },
};

const euros = (n: number) => `${Number(n ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function Bloque({ b }: { b: BloqueHomologacion }) {
  const [abierto, setAbierto] = useState(false);
  const info = INSTALACIONES[b.tipo] ?? { nombre: b.tipo, normativa: '', color: 'bg-slate-50 text-slate-700', borde: 'border-slate-200' };
  const t = b.mediciones.totales;
  const dudas = b.cumplimiento.dudas ?? [];
  const verificaciones = b.cumplimiento.verificaciones ?? [];
  const resumen = b.cumplimiento.resumen;
  const incumple = verificaciones.filter((v) => v.estado === 'no_cumple');
  // Lo que hay que mirar, arriba: primero lo que no cumple, luego lo que no se puede comprobar y,
  // al final, lo que ya está comprobado y cumple.
  const resto = verificaciones
    .filter((v) => v.estado !== 'no_cumple')
    .sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'sin_datos' ? -1 : 1));

  return (
    <section className={`border rounded-xl overflow-hidden ${info.borde}`}>
      <header className="flex flex-wrap items-center gap-2 px-4 py-3 bg-white">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${info.color}`}>{info.nombre}</span>
        <span className="text-[11px] text-slate-500">{b.normativa.map((n) => n.norma).join(' · ')}</span>
        <span className="flex-1" />
        <span className="text-[11px] text-slate-600">
          <Ruler size={12} className="inline -mt-0.5 mr-1" />
          {t.partidas} partidas · {euros(t.importe)}
        </span>
        <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
          {t.localizadas} citadas en plano
        </span>
        <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
          {t.a_verificar} a verificar · {euros(t.importe_a_verificar)}
        </span>
        {resumen && resumen.no_cumple > 0 && (
          <span className="text-[11px] font-bold text-white bg-red-600 rounded px-2 py-0.5">
            {resumen.no_cumple} NO CUMPLE
          </span>
        )}
      </header>

      <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
            Cumplimiento normativo · comprobado punto por punto
          </p>
          <span className="flex-1" />
          {resumen && (
            <>
              <span className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded px-2 py-0.5">
                {resumen.verificadas} puntos
              </span>
              {resumen.no_cumple > 0
                ? <span className="text-[11px] font-bold text-white bg-red-600 rounded px-2 py-0.5">
                    {resumen.no_cumple} NO CUMPLE
                  </span>
                : <span className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                    nada en contra
                  </span>}
              <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                {resumen.cumple} cumple
              </span>
              {resumen.sin_datos > 0 && (
                <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                  {resumen.sin_datos} sin datos
                </span>
              )}
            </>
          )}
        </div>

        {/* LO QUE NO CUMPLE, LO PRIMERO Y EN ROJO: es lo que no puede escaparse del informe. */}
        {incumple.length > 0 && (
          <ul className="mb-3 space-y-2">
            {incumple.map((v) => (
              <li key={v.id} className="border-l-4 border-red-600 bg-red-50 rounded-r-lg px-3 py-2">
                <p className="text-xs font-bold text-red-800 uppercase tracking-wide">
                  <X size={13} className="inline -mt-0.5 mr-1" />No cumple · {v.que}
                </p>
                <p className="text-xs text-red-900 mt-1">{v.detalle}</p>
                <p className="text-[11px] text-red-800 mt-1">
                  Lo dice <strong>{v.articulo}</strong> — <span className="italic">{v.fuente}</span>
                </p>
                <p className="text-[11px] text-red-700/90 mt-0.5">Tal como está en la documentación: {v.evidencia}</p>
              </li>
            ))}
          </ul>
        )}

        {/* El resto: en verde lo que cumple, en ámbar lo que no se puede comprobar con lo entregado. */}
        {resto.length > 0 && (
          <ul className="space-y-1.5 mb-2">
            {resto.map((v) => (
              <li key={v.id} className="text-xs">
                <span className="flex items-start gap-1.5">
                  {v.estado === 'cumple'
                    ? <Check size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                    : <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />}
                  <span className={v.estado === 'cumple' ? 'text-slate-700' : 'text-amber-900 font-medium'}>
                    {v.que}
                    <span className="text-slate-400 font-normal"> · {v.articulo}</span>
                  </span>
                </span>
                <p className="pl-5 text-[11px] leading-snug text-slate-500">{v.detalle}</p>
                <p className="pl-5 text-[11px] leading-snug text-slate-400">{v.evidencia}</p>
              </li>
            ))}
          </ul>
        )}

        {(b.cumplimiento.comprobaciones ?? []).length > 0 && (
          <div className="mt-3 pt-2 border-t border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Búsqueda por marca y modelo en los planos
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {b.cumplimiento.comprobaciones.map((c) => (
                <li key={c.clave} className="flex items-start gap-1.5 text-xs">
                  {c.localizada
                    ? <Check size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                    : <X size={13} className="text-amber-600 shrink-0 mt-0.5" />}
                  <span className={c.localizada ? 'text-slate-700' : 'text-slate-600'}>
                    {c.que}
                    {c.norma && <span className="text-slate-400"> · {c.norma}</span>}
                    {c.localizada && c.paginas.length > 0 && (
                      <span className="text-slate-400"> · hoja{c.paginas.length > 1 ? 's' : ''} {c.paginas.slice(0, 6).join(', ')}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-400">{b.cumplimiento.aviso}</p>
        {dudas.length > 0 && (
          <ul className="mt-2 space-y-1">
            {dudas.map((d) => (
              <li key={d} className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" /> <span>{d}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-4 py-2 bg-white border-t border-slate-100">
        <button onClick={() => setAbierto((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-brand">
          <ChevronDown size={14} className={`transition-transform ${abierto ? 'rotate-180' : ''}`} />
          {abierto ? 'Ocultar' : 'Ver'} las {t.partidas} partidas
        </button>
        {abierto && (
          <div className="mt-2 overflow-x-auto">
            {t.a_verificar > 0 && (
              <p className="mb-2 text-[11px] text-amber-700">
                Las {t.a_verificar} partidas marcadas <strong>a verificar</strong> ({euros(t.importe_a_verificar)})
                llevan debajo <strong>qué hay que comprobar y con qué punto de la normativa</strong>: son las que el
                buscador no ha encontrado en los planos por su marca o modelo.
              </p>
            )}
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="py-1 pr-2">Código</th>
                  <th className="py-1 pr-2">Ud</th>
                  <th className="py-1 pr-2 text-right">Cant.</th>
                  <th className="py-1 pr-2">Partida</th>
                  <th className="py-1 pr-2 text-right">Importe</th>
                  <th className="py-1 pr-2">En el plano</th>
                </tr>
              </thead>
              <tbody>
                {b.mediciones.partidas.map((p) => (
                  <tr key={`${p.codigo}-${p.resumen.slice(0, 12)}`} className="border-b border-slate-100 last:border-0">
                    <td className="py-1 pr-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">{p.codigo}</td>
                    <td className="py-1 pr-2 text-slate-500">{p.unidad}</td>
                    <td className="py-1 pr-2 text-right text-slate-600 whitespace-nowrap">
                      {Number(p.cantidad ?? 0).toLocaleString('es-ES', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-1 pr-2 text-slate-700">{p.resumen}</td>
                    <td className="py-1 pr-2 text-right text-slate-700 whitespace-nowrap">{euros(p.importe)}</td>
                    <td className="py-1 pr-2 whitespace-nowrap align-top">
                      {p.estado === 'localizada'
                        ? <span className="text-emerald-700">✔ hoja{p.hojas.length > 1 ? 's' : ''} {p.hojas.slice(0, 5).join(', ')}</span>
                        : <span className="font-medium text-amber-800">a verificar</span>}
                      {p.verificacion && (p.estado !== 'localizada' || p.verificacion.alcance) && (
                        <div className={`whitespace-normal max-w-[430px] text-[10px] leading-snug mt-0.5 ${p.verificacion.alcance ? 'text-rose-700' : 'text-amber-700'}`}>
                          {p.verificacion.alcance && <span className="font-semibold">Del presupuesto: </span>}
                          Qué mirar: {p.verificacion.requisito}
                          <span className={`block ${p.verificacion.alcance ? 'text-rose-600' : 'text-amber-600'}`}>
                            Punto de normativa: {p.verificacion.norma} · está en {p.verificacion.donde}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {b.mediciones.partidas.length === 0 && (
                  <tr><td colSpan={6} className="py-2 text-slate-400">No hay partidas de esta instalación en el presupuesto subido.</td></tr>
                )}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-slate-400">{b.mediciones.aviso}</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function ResultadoHomologacion({ tramite }: { tramite: Homologacion }) {
  const qc = useQueryClient();
  const analizar = useMutation({
    mutationFn: () => api.analizar(tramite.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homologaciones'] });
      qc.invalidateQueries({ queryKey: ['homologaciones-resumen'] });
    },
  });

  const r = tramite.resultados ?? null;
  const sinDocumentacion = (tramite.archivos ?? []).length === 0;
  const [pdf, setPdf] = useState<string | null>(null);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);

  /**
   * Descarga el informe en PDF. La API lo genera al vuelo a partir del análisis guardado: si no
   * hay análisis, devuelve un error legible en vez de un PDF vacío.
   */
  const descargarPdf = async (tipo: 'mediciones' | 'cumplimiento' | 'completo') => {
    setPdf(tipo);
    setErrorPdf(null);
    try {
      const datos = await api.informePdf(tramite.id, tipo);
      const blob = datos instanceof Blob ? datos : new Blob([datos as any], { type: 'application/pdf' });
      if (blob.type.includes('json')) {
        const texto = await blob.text();
        let mensaje = 'No se ha podido generar el informe';
        try {
          const j = JSON.parse(texto);
          mensaje = Array.isArray(j.message) ? j.message.join(' · ') : (j.message ?? mensaje);
        } catch { /* el cuerpo no era JSON: se queda el mensaje genérico */ }
        throw new Error(mensaje);
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Informe_${tipo}_${(tramite.proyecto_nombre ?? 'obra').replace(/[^\w]+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErrorPdf((e as Error)?.message ?? 'No se ha podido generar el informe');
    } finally {
      setPdf(null);
    }
  };

  const botonesPdf: { tipo: 'mediciones' | 'cumplimiento' | 'completo'; texto: string; icono: any }[] = [
    { tipo: 'mediciones', texto: 'Mediciones vs planos', icono: Ruler },
    { tipo: 'cumplimiento', texto: 'Cumplimiento normativo', icono: ShieldCheck },
    { tipo: 'completo', texto: 'Los dos en un PDF', icono: FileText },
  ];

  return (
    <section className="border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
          Análisis de la documentación · una respuesta por instalación
        </h3>
        <span className="flex-1" />
        <button onClick={() => analizar.mutate()} disabled={analizar.isPending || sinDocumentacion}
          title={sinDocumentacion ? 'Sube primero la documentación de la obra' : 'Leer el Excel y los planos y repartir las partidas por instalación'}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-brand text-white disabled:opacity-50">
          {analizar.isPending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          {analizar.isPending ? 'Analizando…' : r ? 'Volver a analizar' : 'Analizar documentación'}
        </button>
      </div>

      {r && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-[11px] text-slate-500">Informes en PDF:</span>
          {botonesPdf.map(({ tipo, texto, icono: Icono }) => (
            <button key={tipo} onClick={() => descargarPdf(tipo)} disabled={pdf !== null}
              title="Se genera al momento con el análisis guardado"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 hover:border-brand hover:text-brand disabled:opacity-50">
              {pdf === tipo ? <Loader2 size={12} className="animate-spin" /> : <Icono size={12} />}
              {texto}
            </button>
          ))}
        </div>
      )}

      {errorPdf && (
        <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
          {errorPdf}
        </p>
      )}

      {analizar.isError && (
        <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
          No se ha podido analizar: {(analizar.error as Error)?.message ?? 'error desconocido'}
        </p>
      )}

      {!r && (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          {sinDocumentacion
            ? 'Este trámite todavía no tiene documentación: sin el Excel del presupuesto (y los planos) no hay nada que comparar.'
            : 'Todavía no se ha analizado la documentación. Pulsa «Analizar documentación»: se leen el Excel y los planos y se reparten las partidas por instalación.'}
        </p>
      )}

      {r && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              <ShieldCheck size={12} /> {r.sello}
            </span>
            <span>{r.totales.partidas} partidas · {euros(r.totales.importe)}</span>
            <span>· {r.totales.localizadas} citadas en plano · {r.totales.a_verificar} a verificar</span>
            <span>· {r.hojas_de_plano} hojas de plano leídas</span>
            {tramite.analizado_en && <span>· analizado el {new Date(tramite.analizado_en).toLocaleString('es-ES')}</span>}
          </div>

          {r.avisos.length > 0 && (
            <ul className="mb-3 space-y-1">
              {r.avisos.map((a) => (
                <li key={a} className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" /> <span>{a}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-3">
            {r.instalaciones.map((b) => <Bloque key={b.tipo} b={b} />)}
          </div>
        </>
      )}
    </section>
  );
}
