import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientes as api } from '../api/endpoints';
import type { Cliente } from '../types';
import { Plus, Pencil, Building2, ChevronRight } from 'lucide-react';

/* ── Modal crear/editar partner ── */
function PartnerModal({ item, onClose }: { item?: Cliente; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nombre: item?.nombre ?? '',
    email: item?.email ?? '',
    notas: item?.notas ?? '',
  });

  const save = useMutation({
    mutationFn: () => {
      const data = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== ''),
      ) as Partial<Cliente>;
      return item ? api.update(item.id, data) : api.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      onClose();
    },
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900">{item ? 'Editar partner' : 'Nuevo partner'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre / Razón social</label>
            <input type="text" value={form.nombre} onChange={set('nombre')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input type="email" value={form.email} onChange={set('email')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea value={form.notas} onChange={set('notas')} rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
          </div>
        </div>
        {save.isError && (
          <div className="mx-6 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {(save.error as any)?.response?.data?.message ?? (save.error as any)?.message ?? 'Error al guardar'}
          </div>
        )}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={save.isPending || !form.nombre.trim()}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50">
            {save.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Página principal ── */
export default function Clientes() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: ['clientes'], queryFn: api.list });
  const [modal, setModal] = useState<{ open: boolean; item?: Cliente }>({ open: false });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Partners</h1>
          <p className="text-sm text-slate-500">{data.length} partners registrados</p>
        </div>
        <button
          onClick={() => setModal({ open: true })}
          className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-dark"
        >
          <Plus size={16} /> Nuevo partner
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Building2 size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">Sin partners aún</p>
          <button onClick={() => setModal({ open: true })} className="mt-3 text-sm text-brand hover:underline">
            Crear primer partner
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Partner', 'Email', 'Notas', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((c: Cliente) => (
                <tr
                  key={c.id}
                  className="hover:bg-slate-50 cursor-pointer group"
                  onClick={() => navigate(`/clientes/${c.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-brand font-semibold text-xs">{c.nombre[0].toUpperCase()}</span>
                      </div>
                      <span className="font-medium text-slate-900 group-hover:text-brand transition-colors">
                        {c.nombre}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">{c.notas || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); setModal({ open: true, item: c }); }}
                        className="text-slate-400 hover:text-brand p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Pencil size={14} />
                      </button>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && (
        <PartnerModal item={modal.item} onClose={() => setModal({ open: false })} />
      )}
    </div>
  );
}
