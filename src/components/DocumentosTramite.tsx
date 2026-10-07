import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, FileText, RefreshCw, X } from 'lucide-react';
import { documentosLegalizacion as docsApi } from '../api/endpoints';
import type { Legalizacion } from '../types';

/**
 * Ficha de documentos de un trámite de legalización.
 *
 * Los documentos oficiales se generan en la Pi; esta ficha enseña cuáles le corresponden al trámite
 * (no siempre son los mismos: la declaración responsable solo va en reformas y el Certificado RSIF y
 * el IF-190 solo si la instalación necesita RSIF), deja descargarlos y permite regenerarlos. Si al
 * trámite le faltan datos, lo dice arriba en amarillo (esos datos se rellenan en el trámite, no aquí).
 */
export default function DocumentosTramite({ tramite, onClose }: { tramite: Legalizacion; onClose: () => void }) {
  const qc = useQueryClient();
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['documentos-tramite', tramite.id],
    queryFn: () => docsApi.estado(tramite.id),
  });

  const generar = useMutation({
    mutationFn: () => docsApi.generarTodos(tramite.id),
    onSuccess: (r) => {
      const hechos = Object.keys(r.generados ?? {}).length;
      const fallos = Object.entries(r.fallos ?? {});
      qc.invalidateQueries({ queryKey: ['documentos-tramite', tramite.id] });
      qc.invalidateQueries({ queryKey: ['legalizaciones'] });
      setAviso(
        fallos.length
          ? { tipo: 'error', texto: `Generados ${hechos}. No se han podido generar: ${fallos.map(([t, m]) => `${t} (${m})`).join(' · ')}` }
          : { tipo: 'ok', texto: `Los ${hechos} documentos generados y guardados en el servidor.` },
      );
    },
    onError: (e: any) =>
      setAviso({ tipo: 'error', texto: e?.response?.data?.message ?? 'No se han podido generar los documentos.' }),
  });

  const descargar = async (tipo: string, nombre: string) => {
    setDescargando(tipo);
    try {
      const blob = await docsApi.descargar(tramite.id, tipo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${nombre} - ${tramite.cliente ?? tramite.num_obra ?? 'tramite'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setAviso({ tipo: 'error', texto: e?.response?.data?.message ?? `No se ha podido descargar ${nombre}.` });
    } finally {
      setDescargando(null);
    }
  };

  const faltan = data?.faltan_datos ?? [];
  const documentos = data?.documentos ?? [];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-start">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900 truncate">Documentos de legalización</h2>
            <p className="text-xs text-slate-500 truncate">
              {tramite.cliente || 'Sin cliente'}
              {tramite.num_obra ? ` · obra ${tramite.num_obra}` : ''}
              {tramite.oca ? ` · ${tramite.oca}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-3">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {faltan.length > 0 && (
            <div className="flex gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <p>
                Faltan datos en el trámite para poder rellenar los documentos:{' '}
                <strong>{faltan.join(', ')}</strong>. Complétalos en el trámite y se generarán solos.
              </p>
            </div>
          )}

          {aviso && (
            <div
              className={`text-xs rounded-lg p-3 border ${
                aviso.tipo === 'ok'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
              {aviso.texto}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {isLoading
                ? 'Comprobando…'
                : `${documentos.filter((d) => d.generado).length} de ${documentos.length || 6} documentos generados`}
            </p>
            <button
              onClick={() => {
                setAviso(null);
                generar.mutate();
              }}
              disabled={generar.isPending}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs rounded-lg bg-brand text-white hover:opacity-90 disabled:opacity-50">
              <RefreshCw size={14} className={generar.isPending ? 'animate-spin' : ''} />
              {generar.isPending ? 'Generando…' : 'Generar los documentos'}
            </button>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {documentos.map((d) => (
              <div key={d.tipo} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-white">
                <div className="flex items-center gap-2 min-w-0">
                  {d.generado ? (
                    <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                  ) : (
                    <FileText size={16} className="text-slate-300 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 truncate">{d.nombre}</p>
                    <p className="text-[11px] text-slate-400">
                      {d.generado
                        ? `Generado el ${new Date(d.generado).toLocaleString('es-ES')}`
                        : 'Todavía sin generar'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => descargar(d.tipo, d.nombre)}
                  disabled={!d.generado || descargando === d.tipo}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap">
                  <Download size={13} />
                  {descargando === d.tipo ? 'Descargando…' : 'Descargar'}
                </button>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400">
            Los documentos se generan en el servidor con los formularios oficiales (MOD-315, MOD-318,
            certificado RSIF, IF-190) más la autorización y la declaración responsable. Los datos
            medidos en obra (pruebas, presiones, COP) y los cálculos del CTE se rellenan en el trámite.
          </p>
        </div>
      </div>
    </div>
  );
}
