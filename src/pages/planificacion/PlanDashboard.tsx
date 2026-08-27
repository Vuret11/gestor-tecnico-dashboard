import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { planificacion as api } from '../../api/endpoints';
import type { EstadoEspecial, EstadoObra } from '../../types';
import { Users, Building2, CalendarCheck, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';

const DIAS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

const ESTADO_OBRA_COLOR: Record<EstadoObra, string> = {
  pendiente: 'bg-slate-100 text-slate-600',
  planificada: 'bg-blue-50 text-blue-700',
  confirmada: 'bg-cyan-50 text-cyan-700',
  en_curso: 'bg-yellow-50 text-yellow-700',
  realizada: 'bg-green-50 text-green-700',
  cancelada: 'bg-red-50 text-red-600',
  reprogramada: 'bg-orange-50 text-orange-700',
};

const ESTADO_ESPECIAL_LABEL: Record<EstadoEspecial, string> = {
  vacaciones: 'Vacaciones', baja: 'Baja', comp_horas: 'Comp. Horas',
  libre: 'Libre', fiesta_nacional: 'Fiesta Nacional', medico: 'Médico',
  sancion: 'Sanción', reconocimiento: 'Reconocimiento', otros: 'Otros',
};

function getWeekStart(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  r.setHours(0, 0, 0, 0);
  return r;
}
function dateStr(d: Date) { return d.toISOString().split('T')[0]; }

function KpiCard({ label, value, icon: Icon, color, sub }: any) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className={`inline-flex p-2 rounded-lg ${color} mb-2`}>
        <Icon size={16} className="text-white" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function PlanDashboard() {
  const [provinciaId, setProvinciaId] = useState('');

  const weekStart = getWeekStart(new Date());
  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }), [weekStart]);

  const { data: provincias = [] } = useQuery({ queryKey: ['plan-provincias'], queryFn: api.provincias.list });
  const { data: tecnicos = [] } = useQuery({
    queryKey: ['plan-tecnicos', provinciaId],
    queryFn: () => api.tecnicos.list(provinciaId || undefined),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['plan-obras', provinciaId],
    queryFn: () => api.obras.list(provinciaId || undefined),
  });
  const { data: asigSemana = [] } = useQuery({
    queryKey: ['plan-semana-dash', dateStr(weekDays[0]), dateStr(weekDays[6]), provinciaId],
    queryFn: () => api.asignaciones.semana(dateStr(weekDays[0]), dateStr(weekDays[6]), provinciaId || undefined),
  });
  const { data: conflictos = [] } = useQuery({
    queryKey: ['plan-conflictos-dash', dateStr(weekDays[0]), dateStr(weekDays[6])],
    queryFn: () => api.asignaciones.conflictos(dateStr(weekDays[0]), dateStr(weekDays[6])),
  });

  const tecnicosActivos = tecnicos.length;
  const asigConObra = asigSemana.filter(a => a.obra_id);
  const tecnicosConAsig = new Set(asigConObra.map(a => a.tecnico_id)).size;
  const tecnicosLibres = tecnicosActivos - tecnicosConAsig;
  const obrasRealizadas = obras.filter(o => o.estado === 'realizada').length;
  const obrasPendientes = obras.filter(o => o.estado === 'pendiente' || o.estado === 'planificada').length;

  const provinciaActual = provincias.find(p => p.id === provinciaId);

  // Mapa: fecha → [{ tecnico, asig }]
  const porDia = useMemo(() => {
    const m = new Map<string, typeof asigSemana>();
    asigSemana.forEach(a => {
      if (!m.has(a.fecha)) m.set(a.fecha, []);
      m.get(a.fecha)!.push(a);
    });
    return m;
  }, [asigSemana]);

  return (
    <div className="p-6 space-y-5">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Dashboard {provinciaActual ? `— ${provinciaActual.nombre}` : 'general'}
          </h2>
          <p className="text-sm text-slate-500">
            Semana del {weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} al {weekDays[4].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <select value={provinciaId} onChange={e => setProvinciaId(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Todas las provincias</option>
          {provincias.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Técnicos activos" value={tecnicosActivos} icon={Users} color="bg-blue-500" />
        <KpiCard label="Ocupados esta semana" value={tecnicosConAsig} sub={`${tecnicosLibres} libres`} icon={CalendarCheck} color="bg-green-500" />
        <KpiCard label="Obras pendientes" value={obrasPendientes} icon={Clock} color="bg-amber-500" />
        <KpiCard label={`Conflictos semana`} value={(conflictos as any[]).length} icon={AlertTriangle}
          color={(conflictos as any[]).length > 0 ? 'bg-red-500' : 'bg-slate-400'} />
      </div>

      {/* Conflictos */}
      {(conflictos as any[]).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
            <AlertTriangle size={14} /> Conflictos detectados
          </p>
          {(conflictos as any[]).map((c: any, i: number) => (
            <p key={i} className="text-xs text-red-600 pl-5">· {c.mensaje}</p>
          ))}
        </div>
      )}

      {/* Resumen semanal por día */}
      <div className="grid gap-4 xl:grid-cols-5">
        {weekDays.slice(0, 5).map((d, i) => {
          const fecha = dateStr(d);
          const asigsDia = porDia.get(fecha) ?? [];
          const conObra = asigsDia.filter(a => a.obra_id);
          const estados = asigsDia.filter(a => a.estadoEspecial);
          const esHoy = fecha === dateStr(new Date());
          return (
            <div key={fecha} className={`bg-white rounded-xl border ${esHoy ? 'border-brand shadow-sm' : 'border-slate-200'}`}>
              <div className={`px-4 py-3 border-b ${esHoy ? 'border-brand/20 bg-brand/5' : 'border-slate-100'}`}>
                <p className={`text-xs font-semibold uppercase ${esHoy ? 'text-brand' : 'text-slate-500'}`}>{DIAS[i].slice(0, 3)}</p>
                <p className={`text-lg font-bold ${esHoy ? 'text-brand' : 'text-slate-800'}`}>{d.getDate()}</p>
              </div>
              <div className="p-3 space-y-1.5 min-h-[100px]">
                {conObra.length === 0 && estados.length === 0 && (
                  <p className="text-xs text-slate-300 text-center pt-3">Sin actividad</p>
                )}
                {conObra.map(a => (
                  <div key={a.id} className="text-xs">
                    <p className="font-bold text-slate-900 truncate">{a.tecnico.nombre.split(',')[0] || a.tecnico.nombre}</p>
                    <p className="text-brand font-semibold truncate">{a.obra?.numeroObra}</p>
                    <p className="text-slate-400 truncate text-[10px]">{a.obra?.nombre}</p>
                  </div>
                ))}
                {estados.map(a => (
                  <div key={a.id} className="text-xs text-slate-400">
                    <span className="truncate">{a.tecnico.nombre.split(',')[0]}</span>
                    <span className="ml-1 text-slate-300">· {ESTADO_ESPECIAL_LABEL[a.estadoEspecial!]}</span>
                  </div>
                ))}
              </div>
              <div className="px-3 pb-3">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1"><CheckCircle2 size={9} className="text-green-500" />{conObra.length} asign.</span>
                  <span className="flex items-center gap-1"><XCircle size={9} className="text-slate-300" />{tecnicosActivos - asigsDia.length} libres</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Obras por estado */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-medium text-slate-900">Obras por estado</h3>
        </div>
        <div className="p-4 flex flex-wrap gap-3">
          {(['pendiente','planificada','confirmada','en_curso','realizada','cancelada','reprogramada'] as EstadoObra[]).map(estado => {
            const n = obras.filter(o => o.estado === estado).length;
            if (!n) return null;
            return (
              <div key={estado} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${ESTADO_OBRA_COLOR[estado]}`}>
                <span>{estado.replace('_', ' ')}</span>
                <span className="font-bold">{n}</span>
              </div>
            );
          })}
          {obras.length === 0 && <p className="text-sm text-slate-400">Sin obras registradas</p>}
        </div>
      </div>

      {/* Técnicos por provincia */}
      {!provinciaId && provincias.length > 0 && (
        <div className="grid xl:grid-cols-3 gap-4">
          {provincias.map(p => {
            const ts = tecnicos.filter(t => t.provincia_id === p.id);
            const asigProv = asigSemana.filter(a => a.tecnico?.provincia_id === p.id && a.obra_id);
            return (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color ?? '#3b82f6' }} />
                  <h3 className="font-semibold text-slate-800">{p.nombre}</h3>
                  <span className="ml-auto text-xs text-slate-400">{ts.length} técnicos</span>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-slate-500">Asignados esta semana</span>
                    <span className="font-bold text-slate-900">{new Set(asigProv.map(a => a.tecnico_id)).size} / {ts.length}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full"
                      style={{ width: ts.length ? `${Math.round(new Set(asigProv.map(a => a.tecnico_id)).size / ts.length * 100)}%` : '0%' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
