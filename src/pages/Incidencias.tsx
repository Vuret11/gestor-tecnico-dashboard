import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { incidencias as api, instalaciones as instApi } from '../api/endpoints';
import { Plus } from 'lucide-react';
import Badge from '../components/ui/Badge';

function Modal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: insts = [] } = useQuery({ queryKey: ['instalaciones'], queryFn: instApi.list });
  const [form, setForm] = useState({ titulo: '', descripcion: '', instalacion_id: '', prioridad: 'media' });

  const save = useMutation({
    mutationFn: () => api.create(form as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['incidencias'] }); onClose(); },
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900">Nueva incidencia</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Título</label>
            <input value={form.titulo} onChange={set('titulo')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Instalación</label>
            <select value={form.instalacion_id} onChange={set('instalacion_id')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Seleccionar...</option>
              {insts.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Prioridad</label>
            <select value={form.prioridad} onChange={set('prioridad')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              {['baja', 'media', 'alta', 'critica'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
            <textarea value={form.descripcion} onChange={set('descripcion')} rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={save.isPending || !form.titulo || !form.instalacion_id}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50">
            {save.isPending ? 'Guardando...' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Incidencias() {
  const { data = [], isLoading } = useQuery({ queryKey: ['incidencias'], queryFn: api.list });
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const cerrar = useMutation({
    mutationFn: ({ id, res }: { id: string; res: string }) => api.cerrar(id, res),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidencias'] }),
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Incidencias</h1>
          <p className="text-sm text-slate-500">{data.length} incidencias</p>
        </div>
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-dark">
          <Plus size={16} /> Nueva incidencia
        </button>
      </div>

      {isLoading
        ? <p className="text-sm text-slate-400">Cargando...</p>
        : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Título', 'Instalación', 'Prioridad', 'Estado', 'Fecha', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map(inc => (
                  <tr key={inc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900 max-w-xs truncate">{inc.titulo}</td>
                    <td className="px-4 py-3 text-slate-600">{inc.instalacion?.nombre ?? '—'}</td>
                    <td className="px-4 py-3"><Badge value={inc.prioridad} /></td>
                    <td className="px-4 py-3"><Badge value={inc.estado} /></td>
                    <td className="px-4 py-3 text-slate-500">{new Date(inc.createdAt).toLocaleDateString('es-ES')}</td>
                    <td className="px-4 py-3 text-right">
                      {(inc.estado === 'abierta' || inc.estado === 'en_progreso') && (
                        <button
                          onClick={() => cerrar.mutate({ id: inc.id, res: 'Cerrado desde dashboard' })}
                          className="text-xs text-slate-500 hover:text-green-600 border border-slate-300 hover:border-green-400 px-2 py-1 rounded transition-colors">
                          Cerrar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {open && <Modal onClose={() => setOpen(false)} />}
    </div>
  );
}
