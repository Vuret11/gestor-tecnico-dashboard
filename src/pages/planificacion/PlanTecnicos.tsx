import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { planificacion as api } from '../../api/endpoints';
import type { PlanTecnico, PlanProvincia, TipoTecnico } from '../../types';
import { Plus, Pencil, Trash2, Plane } from 'lucide-react';

const TIPO_LABELS: Record<TipoTecnico, string> = {
  propio: 'Propio', externo: 'Externo', subcontrata: 'Subcontrata',
};
const TIPO_COLOR: Record<TipoTecnico, string> = {
  propio: 'bg-green-50 text-green-700', externo: 'bg-blue-50 text-blue-700', subcontrata: 'bg-orange-50 text-orange-700',
};

function TecnicoModal({ item, provincias, onClose }: { item?: PlanTecnico; provincias: PlanProvincia[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nombre: item?.nombre ?? '',
    matricula: item?.matricula ?? '',
    tipo: item?.tipo ?? 'propio' as TipoTecnico,
    provincia_id: item?.provincia_id ?? '',
    telefono: item?.telefono ?? '',
    email: item?.email ?? '',
    observaciones: item?.observaciones ?? '',
    viaja: item?.viaja ?? false,
  });

  const save = useMutation({
    mutationFn: () => item ? api.tecnicos.update(item.id, form) : api.tecnicos.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plan-tecnicos'] }); onClose(); },
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900">{item ? 'Editar técnico' : 'Nuevo técnico'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre completo *</label>
            <input value={form.nombre} onChange={set('nombre')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Matrícula vehículo</label>
            <input value={form.matricula} onChange={set('matricula')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
            <select value={form.tipo} onChange={set('tipo')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Provincia</label>
            <select value={form.provincia_id} onChange={set('provincia_id')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">— Sin provincia —</option>
              {provincias.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono</label>
            <input type="tel" value={form.telefono} onChange={set('telefono')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input type="email" value={form.email} onChange={set('email')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
            <textarea value={form.observaciones} onChange={set('observaciones')} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
          </div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.viaja}
                onChange={e => setForm(f => ({ ...f, viaja: e.target.checked }))}
                className="rounded border-slate-300 text-red-500" />
              <Plane size={13} className="text-red-500" />
              <span className="text-slate-700">Disponible para desplazamientos</span>
            </label>
          </div>
        </div>
        {save.isError && (
          <div className="mx-5 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {(save.error as any)?.response?.data?.message ?? 'Error al guardar'}
          </div>
        )}
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-3">
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

export default function PlanTecnicos() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; item?: PlanTecnico }>({ open: false });
  const [filtroProv, setFiltroProv] = useState('');

  const { data: provincias = [] } = useQuery({ queryKey: ['plan-provincias'], queryFn: api.provincias.list });
  const { data: tecnicos = [], isLoading } = useQuery({
    queryKey: ['plan-tecnicos', filtroProv],
    queryFn: () => api.tecnicos.list(filtroProv || undefined),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => api.tecnicos.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-tecnicos'] }),
  });

  // Agrupar por provincia
  const grupos = provincias.map(p => ({
    provincia: p,
    tecnicos: tecnicos.filter(t => t.provincia_id === p.id),
  })).filter(g => !filtroProv || g.provincia.id === filtroProv);
  const sinProv = tecnicos.filter(t => !t.provincia_id);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Técnicos</h1>
          <p className="text-sm text-slate-500">{tecnicos.length} técnicos activos</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filtroProv} onChange={e => setFiltroProv(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">Todas las provincias</option>
            {provincias.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <button onClick={() => setModal({ open: true })}
            className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-dark">
            <Plus size={16} /> Nuevo técnico
          </button>
        </div>
      </div>

      {isLoading
        ? <p className="text-sm text-slate-400">Cargando...</p>
        : (
          <div className="space-y-6">
            {grupos.map(({ provincia, tecnicos: ts }) => ts.length > 0 && (
              <div key={provincia.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: provincia.color ?? '#3b82f6' }} />
                  <h2 className="font-semibold text-slate-800">{provincia.nombre}</h2>
                  <span className="text-xs text-slate-400 ml-1">{ts.length} técnicos</span>
                </div>
                <TecnicoTable tecnicos={ts} onEdit={t => setModal({ open: true, item: t })} onDelete={id => eliminar.mutate(id)} />
              </div>
            ))}
            {sinProv.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                  <h2 className="font-semibold text-slate-500 text-sm">Sin provincia asignada</h2>
                </div>
                <TecnicoTable tecnicos={sinProv} onEdit={t => setModal({ open: true, item: t })} onDelete={id => eliminar.mutate(id)} />
              </div>
            )}
          </div>
        )}

      {modal.open && (
        <TecnicoModal item={modal.item} provincias={provincias} onClose={() => setModal({ open: false })} />
      )}
    </div>
  );
}

function TecnicoTable({ tecnicos, onEdit, onDelete }: { tecnicos: PlanTecnico[]; onEdit: (t: PlanTecnico) => void; onDelete: (id: string) => void }) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-slate-100">
        <tr>
          {['Nombre', 'Matrícula', 'Tipo', 'Teléfono', 'Viaja', ''].map(h => (
            <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {tecnicos.map(t => (
          <tr key={t.id} className="hover:bg-slate-50">
            <td className="px-4 py-2.5 font-medium text-slate-900">{t.nombre}</td>
            <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{t.matricula || '—'}</td>
            <td className="px-4 py-2.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLOR[t.tipo]}`}>{TIPO_LABELS[t.tipo]}</span>
            </td>
            <td className="px-4 py-2.5 text-slate-500">{t.telefono || '—'}</td>
            <td className="px-4 py-2.5">{t.viaja && <Plane size={14} className="text-red-400" />}</td>
            <td className="px-4 py-2.5 text-right">
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => onEdit(t)} className="text-slate-400 hover:text-brand p-1"><Pencil size={13} /></button>
                <button onClick={() => onDelete(t.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={13} /></button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
