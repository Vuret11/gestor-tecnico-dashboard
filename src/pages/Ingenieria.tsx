import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ingenieria as api, users as usersApi } from '../api/endpoints';
import type { ProyectoIngenieria, TipoProyecto, EstadoProyecto } from '../types';
import { Plus, Search, X, Pencil, Zap, Wrench, CalendarDays, Euro, Cpu } from 'lucide-react';

// ── Constantes ────────────────────────────────────────────────────────────────
const TIPO_LABELS: Record<TipoProyecto, string> = {
  fv: 'Fotovoltaica', rite: 'RITE', aerotermia: 'Aerotermia', hibrido: 'Híbrido', otro: 'Otro',
};
const TIPO_COLORS: Record<TipoProyecto, string> = {
  fv: 'bg-amber-100 text-amber-700 border-amber-200',
  rite: 'bg-blue-100 text-blue-700 border-blue-200',
  aerotermia: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  hibrido: 'bg-violet-100 text-violet-700 border-violet-200',
  otro: 'bg-slate-100 text-slate-600 border-slate-200',
};
const ESTADO_LABELS: Record<EstadoProyecto, string> = {
  diseño: 'Diseño',
  pendiente_aprobacion: 'Pend. aprobación',
  aprobado: 'Aprobado',
  en_ejecucion: 'En ejecución',
  completado: 'Completado',
  cancelado: 'Cancelado',
};
const ESTADO_COLORS: Record<EstadoProyecto, string> = {
  diseño: 'bg-slate-100 text-slate-600',
  pendiente_aprobacion: 'bg-amber-100 text-amber-700',
  aprobado: 'bg-blue-100 text-blue-700',
  en_ejecucion: 'bg-violet-100 text-violet-700',
  completado: 'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-600',
};
const ESTADO_ORDER: EstadoProyecto[] = ['diseño', 'pendiente_aprobacion', 'aprobado', 'en_ejecucion', 'completado', 'cancelado'];

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ onClose, editing }: { onClose: () => void; editing?: ProyectoIngenieria }) {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ['usuarios'], queryFn: usersApi.list });
  const tecnicos = users.filter(u => u.activo);

  const [form, setForm] = useState({
    nombre: editing?.nombre ?? '',
    cliente: editing?.cliente ?? '',
    tipo: editing?.tipo ?? 'fv' as TipoProyecto,
    estado: editing?.estado ?? 'diseño' as EstadoProyecto,
    descripcion: editing?.descripcion ?? '',
    potencia_kwp: editing?.potencia_kwp != null ? String(editing.potencia_kwp) : '',
    presupuesto: editing?.presupuesto != null ? String(editing.presupuesto) : '',
    fechaEntregaEstimada: editing?.fechaEntregaEstimada ? editing.fechaEntregaEstimada.slice(0, 10) : '',
    direccion: editing?.direccion ?? '',
    provincia: editing?.provincia ?? '',
    notas: editing?.notas ?? '',
    tecnico_id: editing?.tecnico_id ?? '',
  });
  const [err, setErr] = useState('');

  const save = useMutation({
    mutationFn: () => {
      const d: any = { ...form };
      if (d.potencia_kwp) d.potencia_kwp = Number(d.potencia_kwp); else delete d.potencia_kwp;
      if (d.presupuesto) d.presupuesto = Number(d.presupuesto); else delete d.presupuesto;
      if (!d.fechaEntregaEstimada) delete d.fechaEntregaEstimada;
      if (!d.tecnico_id) delete d.tecnico_id;
      if (!d.descripcion) delete d.descripcion;
      if (!d.notas) delete d.notas;
      if (!d.direccion) delete d.direccion;
      if (!d.provincia) delete d.provincia;
      return editing ? api.update(editing.id, d) : api.create(d);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ingenieria'] }); onClose(); },
    onError: (e: any) => setErr(e?.response?.data?.message ?? 'Error al guardar'),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
          <h2 className="font-semibold text-slate-900">{editing ? 'Editar proyecto' : 'Nuevo proyecto de ingeniería'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del proyecto *</label>
              <input value={form.nombre} onChange={set('nombre')} placeholder="Ej: Instalación FV 15kWp"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cliente *</label>
              <input value={form.cliente} onChange={set('cliente')} placeholder="Nombre del cliente"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de instalación</label>
              <select value={form.tipo} onChange={set('tipo')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white">
                {(Object.keys(TIPO_LABELS) as TipoProyecto[]).map(t => (
                  <option key={t} value={t}>{TIPO_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
              <select value={form.estado} onChange={set('estado')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white">
                {ESTADO_ORDER.map(e => (
                  <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Potencia (kWp)</label>
              <input type="number" min="0" step="0.001" value={form.potencia_kwp} onChange={set('potencia_kwp')} placeholder="—"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Presupuesto (€)</label>
              <input type="number" min="0" step="0.01" value={form.presupuesto} onChange={set('presupuesto')} placeholder="—"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Entrega estimada</label>
              <input type="date" value={form.fechaEntregaEstimada} onChange={set('fechaEntregaEstimada')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Dirección</label>
              <input value={form.direccion} onChange={set('direccion')} placeholder="Calle, número..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Provincia</label>
              <input value={form.provincia} onChange={set('provincia')} placeholder="—"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Técnico / Ingeniero asignado</label>
            <select value={form.tecnico_id} onChange={set('tecnico_id')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white">
              <option value="">— Sin asignar —</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.rol})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
            <textarea value={form.descripcion} onChange={set('descripcion')} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas internas</label>
            <textarea value={form.notas} onChange={set('notas')} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
        </div>

        {err && <div className="mx-6 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{err}</div>}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.nombre || !form.cliente}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50"
          >
            {save.isPending ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear proyecto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de proyecto ───────────────────────────────────────────────────────
function ProyectoCard({ p, onEdit }: { p: ProyectoIngenieria; onEdit: (p: ProyectoIngenieria) => void }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{p.nombre}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{p.cliente}</p>
        </div>
        <button onClick={() => onEdit(p)} className="text-slate-300 hover:text-brand p-1 flex-shrink-0">
          <Pencil size={14} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${TIPO_COLORS[p.tipo]}`}>
          <Zap size={10} />{TIPO_LABELS[p.tipo]}
        </span>
        <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${ESTADO_COLORS[p.estado]}`}>
          {ESTADO_LABELS[p.estado]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
        {p.potencia_kwp != null && (
          <div className="flex items-center gap-1">
            <Cpu size={11} className="flex-shrink-0" />
            <span>{Number(p.potencia_kwp)} kWp</span>
          </div>
        )}
        {p.presupuesto != null && (
          <div className="flex items-center gap-1">
            <Euro size={11} className="flex-shrink-0" />
            <span>{Number(p.presupuesto).toLocaleString('es-ES')} €</span>
          </div>
        )}
        {p.fechaEntregaEstimada && (
          <div className="flex items-center gap-1">
            <CalendarDays size={11} className="flex-shrink-0" />
            <span>{new Date(p.fechaEntregaEstimada).toLocaleDateString('es-ES')}</span>
          </div>
        )}
        {p.tecnico && (
          <div className="flex items-center gap-1">
            <Wrench size={11} className="flex-shrink-0" />
            <span className="truncate">{p.tecnico.nombre}</span>
          </div>
        )}
      </div>

      {p.descripcion && (
        <p className="mt-2 text-xs text-slate-400 line-clamp-2">{p.descripcion}</p>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Ingenieria() {
  const { data = [], isLoading } = useQuery({ queryKey: ['ingenieria'], queryFn: () => api.list() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProyectoIngenieria | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoProyecto | ''>('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoProyecto | ''>('');
  const [vista, setVista] = useState<'kanban' | 'lista'>('kanban');

  const proyectos = data as ProyectoIngenieria[];

  const filtrados = useMemo(() => {
    let res = proyectos;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      res = res.filter(p => p.nombre.toLowerCase().includes(q) || p.cliente.toLowerCase().includes(q) || p.provincia?.toLowerCase().includes(q));
    }
    if (filtroTipo) res = res.filter(p => p.tipo === filtroTipo);
    if (filtroEstado) res = res.filter(p => p.estado === filtroEstado);
    return res;
  }, [proyectos, busqueda, filtroTipo, filtroEstado]);

  // KPIs
  const activos = proyectos.filter(p => p.estado !== 'cancelado' && p.estado !== 'completado');
  const enEjecucion = proyectos.filter(p => p.estado === 'en_ejecucion');
  const completados = proyectos.filter(p => p.estado === 'completado');
  const potenciaTotal = proyectos.filter(p => p.estado !== 'cancelado').reduce((s, p) => s + (Number(p.potencia_kwp) || 0), 0);

  return (
    <div className="p-6 space-y-5">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Ingeniería</h1>
          <p className="text-sm text-slate-500">{proyectos.length} proyectos · {activos.length} activos</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Toggle vista */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            <button onClick={() => setVista('kanban')}
              className={`px-3 py-2 ${vista === 'kanban' ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              Kanban
            </button>
            <button onClick={() => setVista('lista')}
              className={`px-3 py-2 ${vista === 'lista' ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              Lista
            </button>
          </div>
          <button onClick={() => setOpen(true)}
            className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-dark">
            <Plus size={16} /> Nuevo proyecto
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Proyectos activos', value: activos.length, color: 'text-brand', bg: 'bg-brand/10' },
          { label: 'En ejecución', value: enEjecucion.length, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Completados', value: completados.length, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Potencia total', value: `${Math.round(potenciaTotal * 10) / 10} kWp`, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, cliente, provincia..."
            className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-slate-50" />
        </div>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Todos los tipos</option>
          {(Object.keys(TIPO_LABELS) as TipoProyecto[]).map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as any)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Todos los estados</option>
          {ESTADO_ORDER.map(e => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
        </select>
        {(busqueda || filtroTipo || filtroEstado) && (
          <button onClick={() => { setBusqueda(''); setFiltroTipo(''); setFiltroEstado(''); }}
            className="flex items-center gap-1 px-3 py-2 border border-red-200 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100">
            <X size={13} /> Limpiar
          </button>
        )}
      </div>

      {isLoading && <p className="text-sm text-slate-400 text-center py-8">Cargando proyectos...</p>}

      {/* Vista Kanban */}
      {!isLoading && vista === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ESTADO_ORDER.filter(e => e !== 'cancelado').map(estado => {
            const cols = filtrados.filter(p => p.estado === estado);
            return (
              <div key={estado} className="flex-shrink-0 w-72">
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${ESTADO_COLORS[estado]}`}>
                    {ESTADO_LABELS[estado]}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{cols.length}</span>
                </div>
                <div className="space-y-3">
                  {cols.map(p => (
                    <ProyectoCard key={p.id} p={p} onEdit={setEditing} />
                  ))}
                  {cols.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                      <p className="text-xs text-slate-300">Sin proyectos</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {/* Cancelados al final */}
          {filtrados.some(p => p.estado === 'cancelado') && (
            <div className="flex-shrink-0 w-72">
              <div className="flex items-center justify-between mb-3">
                <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${ESTADO_COLORS['cancelado']}`}>
                  {ESTADO_LABELS['cancelado']}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {filtrados.filter(p => p.estado === 'cancelado').length}
                </span>
              </div>
              <div className="space-y-3">
                {filtrados.filter(p => p.estado === 'cancelado').map(p => (
                  <ProyectoCard key={p.id} p={p} onEdit={setEditing} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vista Lista */}
      {!isLoading && vista === 'lista' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Proyecto', 'Cliente', 'Tipo', 'Estado', 'Potencia', 'Presupuesto', 'Técnico', 'Entrega', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-400">Sin proyectos</td></tr>
              )}
              {filtrados.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{p.cliente}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${TIPO_COLORS[p.tipo]}`}>
                      {TIPO_LABELS[p.tipo]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${ESTADO_COLORS[p.estado]}`}>
                      {ESTADO_LABELS[p.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.potencia_kwp ? `${Number(p.potencia_kwp)} kWp` : '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.presupuesto ? `${Number(p.presupuesto).toLocaleString('es-ES')} €` : '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.tecnico?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {p.fechaEntregaEstimada ? new Date(p.fechaEntregaEstimada).toLocaleDateString('es-ES') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditing(p)} className="text-slate-300 hover:text-brand">
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <Modal onClose={() => setOpen(false)} />}
      {editing && <Modal editing={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
