import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instalaciones as api } from '../api/endpoints';
import type { Instalacion } from '../types';
import { Plus, Pencil, MapPin } from 'lucide-react';

function Modal({ item, onClose }: { item?: Instalacion; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nombre: item?.nombre ?? '',
    cliente: item?.cliente ?? '',
    direccion: item?.direccion ?? '',
    ciudad: item?.ciudad ?? '',
    provincia: item?.provincia ?? '',
    telefono: item?.telefono ?? '',
    notas: item?.notas ?? '',
  });

  const save = useMutation({
    mutationFn: () => item ? api.update(item.id, form) : api.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['instalaciones'] }); onClose(); },
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900">{item ? 'Editar instalación' : 'Nueva instalación'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {[
            ['nombre', 'Nombre', 'col-span-2'],
            ['cliente', 'Cliente', 'col-span-2'],
            ['direccion', 'Dirección', 'col-span-2'],
            ['ciudad', 'Ciudad', ''],
            ['provincia', 'Provincia', ''],
            ['telefono', 'Teléfono', ''],
          ].map(([k, label, cls]) => (
            <div key={k} className={cls || 'col-span-1'}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <input value={(form as any)[k]} onChange={set(k)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea value={form.notas} onChange={set('notas')} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50">
            {save.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Instalaciones() {
  const { data = [], isLoading } = useQuery({ queryKey: ['instalaciones'], queryFn: api.list });
  const [modal, setModal] = useState<{ open: boolean; item?: Instalacion }>({ open: false });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Instalaciones</h1>
          <p className="text-sm text-slate-500">{data.length} instalaciones activas</p>
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
                  {['Nombre', 'Cliente', 'Ciudad', 'Teléfono', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map(inst => (
                  <tr key={inst.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{inst.nombre}</td>
                    <td className="px-4 py-3 text-slate-600">{inst.cliente}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="flex items-center gap-1"><MapPin size={12} />{inst.ciudad}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{inst.telefono || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setModal({ open: true, item: inst })}
                        className="text-slate-400 hover:text-brand p-1">
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {modal.open && <Modal item={modal.item} onClose={() => setModal({ open: false })} />}
    </div>
  );
}
