import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { users as api } from '../api/endpoints';
import type { User } from '../types';
import { Plus, Pencil } from 'lucide-react';
import Badge from '../components/ui/Badge';

function Modal({ item, onClose }: { item?: User; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nombre: item?.nombre ?? '',
    email: item?.email ?? '',
    password: '',
    rol: item?.rol ?? 'tecnico',
    telefono: item?.telefono ?? '',
  });

  const save = useMutation({
    mutationFn: () => item
      ? api.update(item.id, { nombre: form.nombre, telefono: form.telefono, rol: form.rol as any })
      : api.create(form as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); onClose(); },
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900">{item ? 'Editar usuario' : 'Nuevo usuario'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          {[['nombre', 'Nombre', 'text'], ['email', 'Email', 'email'], ...(!item ? [['password', 'Contraseña', 'password']] : []), ['telefono', 'Teléfono', 'text']].map(([k, label, type]) => (
            <div key={k}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <input type={type} value={(form as any)[k]} onChange={set(k)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Rol</label>
            <select value={form.rol} onChange={set('rol')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="tecnico">Técnico</option>
              <option value="oficina">Oficina</option>
              <option value="admin">Admin</option>
            </select>
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

export default function Tecnicos() {
  const { data = [], isLoading } = useQuery({ queryKey: ['usuarios'], queryFn: api.list });
  const [modal, setModal] = useState<{ open: boolean; item?: User }>({ open: false });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Técnicos y usuarios</h1>
          <p className="text-sm text-slate-500">{data.length} usuarios</p>
        </div>
        <button onClick={() => setModal({ open: true })}
          className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-dark">
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      {isLoading
        ? <p className="text-sm text-slate-400">Cargando...</p>
        : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Nombre', 'Email', 'Rol', 'Teléfono', 'Estado', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{u.nombre}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3"><Badge value={u.rol} /></td>
                    <td className="px-4 py-3 text-slate-500">{u.telefono || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${u.activo ? 'text-green-600' : 'text-slate-400'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setModal({ open: true, item: u })}
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
