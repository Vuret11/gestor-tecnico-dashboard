import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instalaciones as api, clientes as clientesApi } from '../api/endpoints';
import type { Instalacion, Cliente } from '../types';
import { Plus, Pencil, MapPin, Trash2 } from 'lucide-react';

function Modal({ item, onClose }: { item?: Instalacion; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: partners = [] } = useQuery({ queryKey: ['clientes'], queryFn: clientesApi.list });

  const [form, setForm] = useState({
    nombre: item?.nombre ?? '',
    clienteId: item?.clienteId ?? '',
    cliente: item?.cliente ?? '',
    direccion: item?.direccion ?? '',
    ciudad: item?.ciudad ?? '',
    provincia: item?.provincia ?? '',
    telefono: item?.telefono ?? '',
    notas: item?.notas ?? '',
    tipoInstalacion: item?.tipoInstalacion ?? '' as string,
  });

  const save = useMutation({
    mutationFn: () => {
      const data = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== ''),
      ) as Partial<Instalacion>;
      return item ? api.update(item.id, data) : api.create(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['instalaciones'] }); onClose(); },
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  function handlePartnerChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = partners.find((p: Cliente) => p.id === e.target.value);
    setForm(f => ({
      ...f,
      clienteId: selected?.id ?? '',
      cliente: selected?.nombre ?? '',
    }));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900">{item ? 'Editar instalación' : 'Nueva instalación'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
            <input value={form.nombre} onChange={set('nombre')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Partner vinculado</label>
            <select
              value={form.clienteId}
              onChange={handlePartnerChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
            >
              <option value="">— Sin partner —</option>
              {partners.map((p: Cliente) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Dirección {!item && <span className="text-red-500">*</span>}</label>
            <input value={form.direccion} onChange={set('direccion')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ciudad {!item && <span className="text-red-500">*</span>}</label>
            <input value={form.ciudad} onChange={set('ciudad')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Provincia</label>
            <input value={form.provincia} onChange={set('provincia')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono</label>
            <input type="tel" value={form.telefono} onChange={set('telefono')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de instalación</label>
            <select
              value={form.tipoInstalacion}
              onChange={e => setForm(f => ({ ...f, tipoInstalacion: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
            >
              <option value="">— Sin especificar —</option>
              <option value="fv">Fotovoltaica (FV)</option>
              <option value="rite">RITE / Aerotermia</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea value={form.notas} onChange={set('notas')} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
          </div>
        </div>
        {save.isError && (
          <div className="mx-6 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
            Error: {(save.error as any)?.response?.data?.message ?? (save.error as any)?.message ?? 'No se pudo guardar. Revisa los campos.'}
          </div>
        )}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.nombre.trim() || (!item && (!form.direccion.trim() || !form.ciudad.trim()))}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50"
          >
            {save.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Instalaciones() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['instalaciones'], queryFn: api.list });
  const [modal, setModal] = useState<{ open: boolean; item?: Instalacion }>({ open: false });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const eliminar = useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: () => {
      setConfirmDelete(null);
      setDeleteError(null);
      qc.invalidateQueries({ queryKey: ['instalaciones'] });
    },
    onError: (err: any) => {
      setConfirmDelete(null);
      setDeleteError(err?.response?.data?.message ?? err?.message ?? 'Error al eliminar');
    },
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Instalaciones</h1>
          <p className="text-sm text-slate-500">{data.length} instalaciones</p>
        </div>
        <button onClick={() => setModal({ open: true })}
          className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-dark">
          <Plus size={16} /> Nueva
        </button>
      </div>

      {isLoading
        ? <p className="text-sm text-slate-400">Cargando...</p>
        : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Partner', 'Nombre', 'Ciudad', 'Teléfono', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">
                      Sin instalaciones registradas
                    </td>
                  </tr>
                )}
                {data.map(inst => (
                  <tr key={inst.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">
                      {inst.clienteData?.nombre ?? inst.cliente
                        ? <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{inst.clienteData?.nombre ?? inst.cliente}</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <span>{inst.nombre}</span>
                      {inst.tipoInstalacion && (
                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${
                          inst.tipoInstalacion === 'fv' ? 'bg-yellow-100 text-yellow-700' :
                          inst.tipoInstalacion === 'rite' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {inst.tipoInstalacion === 'fv' ? 'FV' : inst.tipoInstalacion === 'rite' ? 'RITE' : 'Otro'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="flex items-center gap-1"><MapPin size={12} />{inst.ciudad}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{inst.telefono || '—'}</td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                      <button onClick={() => setModal({ open: true, item: inst })}
                        className="text-slate-400 hover:text-brand p-1">
                        <Pencil size={14} />
                      </button>
                      {confirmDelete === inst.id ? (
                        <>
                          <span className="text-xs text-red-600 mr-1">¿Eliminar?</span>
                          <button
                            onClick={() => eliminar.mutate(inst.id)}
                            disabled={eliminar.isPending}
                            className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 disabled:opacity-50"
                          >Sí</button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs border border-slate-200 px-2 py-1 rounded hover:bg-slate-50"
                          >No</button>
                        </>
                      ) : (
                        <button
                          onClick={() => { setDeleteError(null); setConfirmDelete(inst.id); }}
                          className="text-slate-400 hover:text-red-500 p-1"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {deleteError && (
        <div className="mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {modal.open && <Modal item={modal.item} onClose={() => setModal({ open: false })} />}
    </div>
  );
}
