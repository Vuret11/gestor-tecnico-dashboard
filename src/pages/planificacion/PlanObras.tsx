import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { planificacion as api } from '../../api/endpoints';
import type { PlanObra, PlanProvincia, PlanCliente, EstadoObra, TipoTrabajo } from '../../types';
import { Plus, Pencil, Search } from 'lucide-react';

const ESTADO_COLOR: Record<EstadoObra, string> = {
  pendiente: 'bg-slate-100 text-slate-600',
  planificada: 'bg-blue-50 text-blue-700',
  confirmada: 'bg-cyan-50 text-cyan-700',
  en_curso: 'bg-yellow-50 text-yellow-700',
  realizada: 'bg-green-50 text-green-700',
  cancelada: 'bg-red-50 text-red-600',
  reprogramada: 'bg-orange-50 text-orange-700',
};

const TIPO_LABELS: Record<TipoTrabajo, string> = {
  instalacion_fv: 'Inst. FV', instalacion_aerotermia: 'Inst. Aerotermia',
  mantenimiento: 'Mantenimiento', incidencia: 'Incidencia',
  visita_tecnica: 'Visita técnica', otro: 'Otro',
};

function ObraModal({ item, provincias, clientes, onClose }: {
  item?: PlanObra; provincias: PlanProvincia[]; clientes: PlanCliente[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    numeroObra: item?.numeroObra ?? '',
    nombre: item?.nombre ?? '',
    cliente_id: item?.cliente_id ?? '',
    provincia_id: item?.provincia_id ?? '',
    direccion: item?.direccion ?? '',
    ciudad: item?.ciudad ?? '',
    tipoTrabajo: item?.tipoTrabajo ?? 'otro' as TipoTrabajo,
    estado: item?.estado ?? 'pendiente' as EstadoObra,
    fechaPrevista: item?.fechaPrevista ?? '',
    observaciones: item?.observaciones ?? '',
  });

  const save = useMutation({
    mutationFn: () => {
      const data = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      return item ? api.obras.update(item.id, data) : api.obras.create(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plan-obras'] }); onClose(); },
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900">{item ? 'Editar obra' : 'Nueva obra'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nº Obra *</label>
            <input value={form.numeroObra} onChange={set('numeroObra')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
            <select value={form.estado} onChange={set('estado')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              {Object.keys(ESTADO_COLOR).map(k => (
                <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1).replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre / Referencia *</label>
            <input value={form.nombre} onChange={set('nombre')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cliente</label>
            <select value={form.cliente_id} onChange={set('cliente_id')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">— Sin cliente —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Provincia</label>
            <select value={form.provincia_id} onChange={set('provincia_id')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">— Sin provincia —</option>
              {provincias.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de trabajo</label>
            <select value={form.tipoTrabajo} onChange={set('tipoTrabajo')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha prevista</label>
            <input type="date" value={form.fechaPrevista} onChange={set('fechaPrevista')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Dirección</label>
            <input value={form.direccion} onChange={set('direccion')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ciudad</label>
            <input value={form.ciudad} onChange={set('ciudad')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
            <textarea value={form.observaciones} onChange={set('observaciones')} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
          </div>
        </div>
        {save.isError && (
          <div className="mx-5 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {(save.error as any)?.response?.data?.message ?? 'Error al guardar'}
          </div>
        )}
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={save.isPending || !form.numeroObra.trim() || !form.nombre.trim()}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50">
            {save.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlanObras() {
  const [modal, setModal] = useState<{ open: boolean; item?: PlanObra }>({ open: false });
  const [busqueda, setBusqueda] = useState('');
  const [filtroProv, setFiltroProv] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const { data: provincias = [] } = useQuery({ queryKey: ['plan-provincias'], queryFn: api.provincias.list });
  const { data: clientes = [] } = useQuery({ queryKey: ['plan-clientes'], queryFn: api.clientes.list });
  const { data: obras = [], isLoading } = useQuery({
    queryKey: ['plan-obras', filtroProv],
    queryFn: () => api.obras.list(filtroProv || undefined),
  });

  const obrasFiltradas = obras.filter(o => {
    const q = busqueda.toLowerCase();
    const matchQ = !q || o.numeroObra.toLowerCase().includes(q) || o.nombre.toLowerCase().includes(q) || o.cliente?.nombre.toLowerCase().includes(q) || false;
    const matchE = !filtroEstado || o.estado === filtroEstado;
    return matchQ && matchE;
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Obras</h1>
          <p className="text-sm text-slate-500">{obrasFiltradas.length} obras</p>
        </div>
        <button onClick={() => setModal({ open: true })}
          className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-dark">
          <Plus size={16} /> Nueva obra
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nº obra, nombre, cliente..."
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <select value={filtroProv} onChange={e => setFiltroProv(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Todas las provincias</option>
          {provincias.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Todos los estados</option>
          {Object.keys(ESTADO_COLOR).map(k => (
            <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1).replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {isLoading
        ? <p className="text-sm text-slate-400">Cargando...</p>
        : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Nº Obra', 'Nombre', 'Cliente', 'Provincia', 'Tipo', 'Estado', 'Fecha prevista', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {obrasFiltradas.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">Sin obras</td></tr>
                )}
                {obrasFiltradas.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 text-xs">{o.numeroObra}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate">{o.nombre}</td>
                    <td className="px-4 py-3 text-slate-600">{o.cliente?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{o.provincia?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{TIPO_LABELS[o.tipoTrabajo]}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[o.estado]}`}>
                        {o.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {o.fechaPrevista ? new Date(o.fechaPrevista + 'T12:00:00').toLocaleDateString('es-ES') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setModal({ open: true, item: o })}
                        className="text-slate-400 hover:text-brand p-1"><Pencil size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {modal.open && (
        <ObraModal item={modal.item} provincias={provincias} clientes={clientes} onClose={() => setModal({ open: false })} />
      )}
    </div>
  );
}
