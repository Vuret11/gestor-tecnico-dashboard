import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { users as api, planificacion as planApi } from '../api/endpoints';
import type { User, PlanTecnico, PlanProvincia } from '../types';
import { Plus, Pencil, Trash2, UserPlus, Copy, Check } from 'lucide-react';
import Badge from '../components/ui/Badge';
import { TecnicoModal } from './planificacion/PlanTecnicos';

function CredencialesModal({ usuarios, onClose }: {
  usuarios: { nombre: string; email: string; password: string }[];
  onClose: () => void;
}) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = (texto: string, key: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(key);
    setTimeout(() => setCopiado(null), 1500);
  };
  const copiarTodo = () => {
    const texto = usuarios.map(u => `${u.nombre}\nEmail: ${u.email}\nClave: ${u.password}`).join('\n\n');
    copiar(texto, 'all');
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-slate-900">Usuarios creados</h2>
            <p className="text-xs text-slate-500">{usuarios.length} cuentas nuevas — guarda estas credenciales</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
          {usuarios.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Todos los técnicos ya tienen cuenta asignada.</p>
          ) : usuarios.map((u, i) => (
            <div key={i} className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
              <p className="font-medium text-slate-900 text-sm mb-1">{u.nombre}</p>
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                <span className="text-slate-400">Email</span>
                <span className="font-mono">{u.email}</span>
                <button onClick={() => copiar(u.email, `email-${i}`)} className="text-slate-300 hover:text-brand">
                  {copiado === `email-${i}` ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                </button>
                <span className="text-slate-400">Clave</span>
                <span className="font-mono">{u.password}</span>
                <button onClick={() => copiar(u.password, `pw-${i}`)} className="text-slate-300 hover:text-brand">
                  {copiado === `pw-${i}` ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center">
          {usuarios.length > 0 && (
            <button onClick={copiarTodo}
              className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">
              {copiado === 'all' ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
              Copiar todo
            </button>
          )}
          <button onClick={onClose} className="ml-auto px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const { data: provincias = [] } = useQuery<PlanProvincia[]>({ queryKey: ['plan-provincias'], queryFn: planApi.provincias.list });
  const qc = useQueryClient();

  const [modal, setModal] = useState<{ open: boolean; item?: User }>({ open: false });
  const [tecnicoModal, setTecnicoModal] = useState<{ open: boolean; item?: PlanTecnico }>({ open: false });
  const [credenciales, setCredenciales] = useState<{ nombre: string; email: string; password: string }[] | null>(null);

  const eliminar = useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });

  const crearUsuarios = useMutation({
    mutationFn: () => planApi.tecnicos.crearUsuarios(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      qc.invalidateQueries({ queryKey: ['plan-tecnicos'] });
      setCredenciales(data.usuarios);
    },
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Personal Oficina</h1>
          <p className="text-sm text-slate-500">{data.length} usuarios</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => crearUsuarios.mutate()}
            disabled={crearUsuarios.isPending}
            title="Crear cuentas para técnicos de planificación sin usuario"
            className="flex items-center gap-2 border border-brand/40 text-brand px-4 py-2 rounded-lg text-sm hover:bg-brand/5 disabled:opacity-50"
          >
            <UserPlus size={16} className={crearUsuarios.isPending ? 'animate-pulse' : ''} />
            Crear usuarios técnicos
          </button>
          <button onClick={() => setTecnicoModal({ open: true })}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50">
            <Plus size={16} /> Nuevo técnico
          </button>
          <button onClick={() => setModal({ open: true })}
            className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-dark">
            <Plus size={16} /> Nuevo usuario
          </button>
        </div>
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
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setModal({ open: true, item: u })}
                          className="text-slate-400 hover:text-brand p-1">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => eliminar.mutate(u.id)}
                          className="text-slate-400 hover:text-red-500 p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {modal.open && <Modal item={modal.item} onClose={() => setModal({ open: false })} />}
      {tecnicoModal.open && (
        <TecnicoModal item={tecnicoModal.item} provincias={provincias} onClose={() => setTecnicoModal({ open: false })} />
      )}
      {credenciales !== null && (
        <CredencialesModal usuarios={credenciales} onClose={() => setCredenciales(null)} />
      )}
    </div>
  );
}
