import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { informes as api, fotos as fotosApi, checklists as checklistsApi } from '../api/endpoints';
import type { Informe, TipoVisita, Foto, VisitaChecklist } from '../types';
import {
  FileText, X, Printer, MapPin, User, Calendar,
  Clock, Wrench, Package, CheckCircle2, Zap, Camera, ClipboardList,
} from 'lucide-react';
import { InformePDFButton } from '../components/InformePDF';

const TIPO_LABELS: Record<TipoVisita, string> = {
  visita_tecnica_fv: 'Visita Técnica Fotovoltaica',
  visita_tecnica_aerotermia: 'Visita Técnica Aerotermia',
  instalacion_nueva_fv: 'Instalación Nueva Fotovoltaica',
  instalacion_nueva_aerotermia: 'Instalación Nueva Aerotermia',
};

// ─── Vista de documento ───────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3000';

function fotoSrc(url: string) {
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `${API_BASE}${url}`;
}

function InformeDocumento({ inf, onClose }: { inf: Informe; onClose: () => void }) {
  const visita = inf.visita;
  const tipo = visita?.tipo as TipoVisita | undefined;
  const esInstalacion = tipo?.startsWith('instalacion_nueva');

  const { data: fotos = [] } = useQuery<Foto[]>({
    queryKey: ['fotos-visita', inf.visita_id],
    queryFn: () => fotosApi.porVisita(inf.visita_id),
    enabled: !!inf.visita_id,
  });

  const { data: checklist } = useQuery<VisitaChecklist>({
    queryKey: ['checklist-visita', inf.visita_id],
    queryFn: () => checklistsApi.porVisita(inf.visita_id),
    enabled: !!inf.visita_id,
    retry: false,
  });

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
        {/* Barra de herramientas */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-slate-500" />
            <span className="font-medium text-slate-900">Informe de visita</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
            >
              <Printer size={14} /> Imprimir
            </button>
            <InformePDFButton inf={inf} />
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Documento */}
        <div className="overflow-y-auto flex-1 p-8 informe-print">
          {/* Cabecera del documento */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-slate-900">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wide">Informe de Visita</h1>
              <p className="text-sm text-slate-500 mt-1">
                Ref: INF-{inf.id.substring(0, 8).toUpperCase()}
              </p>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${
                esInstalacion ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-brand'
              }`}>
                {esInstalacion ? <Zap size={14} /> : <Wrench size={14} />}
                {tipo ? TIPO_LABELS[tipo] : 'Visita técnica'}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {new Date(inf.createdAt).toLocaleDateString('es-ES', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Datos de la instalación y visita */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <MapPin size={11} /> Instalación
              </p>
              <p className="font-semibold text-slate-900">{visita?.instalacion?.nombre ?? '—'}</p>
              <p className="text-sm text-slate-600 mt-0.5">{visita?.instalacion?.cliente}</p>
              <p className="text-sm text-slate-500 mt-2">
                {visita?.instalacion?.direccion}<br />
                {visita?.instalacion?.ciudad}
              </p>
              {visita?.instalacion?.telefono && (
                <p className="text-sm text-slate-500 mt-1">{visita.instalacion.telefono}</p>
              )}
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <User size={11} /> Técnico responsable
                </p>
                <p className="font-semibold text-slate-900">{visita?.tecnico?.nombre ?? '—'}</p>
                <p className="text-sm text-slate-500">{visita?.tecnico?.email}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar size={11} /> Fecha de visita
                </p>
                <p className="font-semibold text-slate-900">
                  {visita?.fechaProgramada
                    ? new Date(visita.fechaProgramada).toLocaleString('es-ES', {
                        weekday: 'long', year: 'numeric', month: 'long',
                        day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })
                    : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Descripción */}
          <Section icon={<FileText size={14} />} title="Descripción del trabajo">
            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{inf.descripcion}</p>
          </Section>

          {/* Trabajos realizados */}
          {inf.trabajosRealizados && (
            <Section icon={<Wrench size={14} />} title="Trabajos realizados">
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{inf.trabajosRealizados}</p>
            </Section>
          )}

          {/* Materiales */}
          {inf.materialesUsados && (
            <Section icon={<Package size={14} />} title="Materiales utilizados">
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{inf.materialesUsados}</p>
            </Section>
          )}

          {/* Tiempo empleado */}
          {inf.tiempoEmpleado && (
            <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4 mb-6">
              <Clock size={16} className="text-slate-400" />
              <div>
                <p className="text-xs text-slate-400 font-medium">Tiempo empleado</p>
                <p className="font-semibold text-slate-900">
                  {inf.tiempoEmpleado >= 60
                    ? `${Math.floor(inf.tiempoEmpleado / 60)}h ${inf.tiempoEmpleado % 60}min`
                    : `${inf.tiempoEmpleado} minutos`}
                </p>
              </div>
            </div>
          )}

          {/* Notas de la visita */}
          {visita?.notas && (
            <Section icon={<FileText size={14} />} title="Notas adicionales">
              <p className="text-slate-600 leading-relaxed italic">{visita.notas}</p>
            </Section>
          )}

          {/* Fechas reales */}
          {(visita?.fechaInicio || visita?.fechaFin) && (
            <div className="flex gap-4 mb-6">
              {visita.fechaInicio && (
                <div className="flex-1 bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Clock size={11} /> Inicio real
                  </p>
                  <p className="font-semibold text-slate-900 text-sm">
                    {new Date(visita.fechaInicio).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}
              {visita.fechaFin && (
                <div className="flex-1 bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Clock size={11} /> Fin real
                  </p>
                  <p className="font-semibold text-slate-900 text-sm">
                    {new Date(visita.fechaFin).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}
              {visita.fechaInicio && visita.fechaFin && (
                <div className="flex-1 bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Clock size={11} /> Duración
                  </p>
                  <p className="font-semibold text-slate-900 text-sm">
                    {(() => {
                      const mins = Math.round((new Date(visita.fechaFin).getTime() - new Date(visita.fechaInicio).getTime()) / 60000);
                      return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}min` : `${mins} min`;
                    })()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Checklist */}
          {checklist?.id && checklist.plantilla && (
            <Section icon={<ClipboardList size={14} />} title={`Checklist: ${checklist.plantilla.nombre}`}>
              <div className="space-y-4">
                {[...checklist.plantilla.secciones]
                  .sort((a, b) => a.orden - b.orden)
                  .map(sec => (
                    <div key={sec.id}>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">
                        {sec.titulo}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {[...sec.items].sort((a, b) => a.orden - b.orden).map(item => {
                          const resp = checklist.respuestas?.find(r => r.itemId === item.id);
                          const valor = resp?.valor ?? '—';
                          return (
                            <div key={item.id} className="flex flex-col gap-0.5">
                              <span className="text-xs text-slate-400">{item.etiqueta}</span>
                              <span className="text-sm font-medium text-slate-800">
                                {item.tipo === 'boolean'
                                  ? (valor === 'true' ? '✓ Sí' : '✗ No')
                                  : `${valor}${item.unidad ? ` ${item.unidad}` : ''}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                {checklist.completadoEn && (
                  <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
                    Completado el {new Date(checklist.completadoEn).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {checklist.firmante ? ` · Firmado por ${checklist.firmante}` : ''}
                  </p>
                )}
              </div>
            </Section>
          )}

          {/* Fotografías */}
          {fotos.length > 0 && (
            <Section icon={<Camera size={14} />} title={`Fotografías (${fotos.length})`}>
              <div className="grid grid-cols-3 gap-2">
                {fotos.map(foto => (
                  <div key={foto.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                    <img
                      src={fotoSrc(foto.url)}
                      alt="Foto visita"
                      className="w-full h-full object-cover"
                    />
                    {(foto.latitud || foto.descripcion) && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1.5 py-0.5 truncate">
                        {foto.descripcion || (foto.latitud ? `${foto.latitud?.toFixed(4)}, ${foto.longitud?.toFixed(4)}` : '')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Firma */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Firma del técnico</p>
                <div className="h-16 border-b border-slate-300" />
                <p className="text-sm text-slate-700 mt-2 font-medium">{visita?.tecnico?.nombre ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  {inf.nombreFirmante && <CheckCircle2 size={12} className="text-green-500" />}
                  Firma del cliente
                </p>
                {inf.firmaClienteUrl
                  ? <img src={inf.firmaClienteUrl} alt="Firma cliente" className="h-16 object-contain" />
                  : <div className="h-16 border-b border-slate-300" />}
                <p className="text-sm text-slate-700 mt-2 font-medium">{inf.nombreFirmante || '—'}</p>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-slate-300 mt-8">
            Documento generado el {new Date().toLocaleDateString('es-ES')} · Gestor Técnico
          </p>
        </div>
      </div>

      {/* Estilos para impresión */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .informe-print, .informe-print * { visibility: visible !important; }
          .informe-print { position: fixed; left: 0; top: 0; width: 100%; padding: 24px; }
        }
      `}</style>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        {icon}{title}
      </h3>
      <div className="border border-slate-100 rounded-xl p-4 bg-white">
        {children}
      </div>
    </div>
  );
}

// ─── Página listado ───────────────────────────────────────────────────────────
export default function Informes() {
  const { data = [], isLoading } = useQuery({ queryKey: ['informes'], queryFn: api.list });
  const [selected, setSelected] = useState<Informe | null>(null);

  if (isLoading) return <div className="p-6"><p className="text-sm text-slate-400">Cargando...</p></div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Informes</h1>
        <p className="text-sm text-slate-500">{data.length} informes generados</p>
      </div>

      {data.length === 0
        ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <FileText size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-400">No hay informes todavía</p>
            <p className="text-xs text-slate-400 mt-1">Los informes se generan desde la app móvil al completar una visita</p>
          </div>
        )
        : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Instalación', 'Tipo', 'Técnico', 'Fecha', 'Firmante', 'Tiempo', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map(inf => {
                  const tipo = inf.visita?.tipo as TipoVisita | undefined;
                  const esNueva = tipo?.startsWith('instalacion_nueva');
                  return (
                    <tr
                      key={inf.id}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => setSelected(inf)}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">{inf.visita?.instalacion?.nombre ?? '—'}</td>
                      <td className="px-4 py-3">
                        {tipo && (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            esNueva ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {esNueva ? <Zap size={9} /> : <Wrench size={9} />}
                            {TIPO_LABELS[tipo]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{inf.visita?.tecnico?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(inf.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        {inf.nombreFirmante
                          ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                              <CheckCircle2 size={10} /> {inf.nombreFirmante}
                            </span>
                          )
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {inf.tiempoEmpleado
                          ? inf.tiempoEmpleado >= 60
                            ? `${Math.floor(inf.tiempoEmpleado / 60)}h ${inf.tiempoEmpleado % 60}m`
                            : `${inf.tiempoEmpleado} min`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setSelected(inf)}
                            className="text-xs text-brand hover:text-brand-dark font-medium"
                          >
                            Ver →
                          </button>
                          <InformePDFButton inf={inf} compact />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      {selected && <InformeDocumento inf={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
