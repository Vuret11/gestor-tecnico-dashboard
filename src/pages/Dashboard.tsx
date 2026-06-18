import { useQuery } from '@tanstack/react-query';
import {
  visitas as visitasApi, incidencias as incidenciasApi,
  users as usersApi, informes as informesApi,
} from '../api/endpoints';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import Badge from '../components/ui/Badge';
import {
  CalendarCheck, AlertTriangle, Users, FileText,
  TrendingUp, CheckCircle2, Clock, Zap, Wrench,
} from 'lucide-react';
import type { TipoVisita } from '../types';

const TIPO_LABELS: Record<TipoVisita, string> = {
  visita_tecnica_fv: 'V.T. FV',
  visita_tecnica_aerotermia: 'V.T. Aerotermia',
  instalacion_nueva_fv: 'Inst. FV',
  instalacion_nueva_aerotermia: 'Inst. Aerotermia',
};
const TIPO_COLORS = ['#3b82f6', '#06b6d4', '#f59e0b', '#f97316'];

function KpiCard({
  label, value, sub, icon: Icon, color, textColor,
}: {
  label: string; value: number | string; sub?: string;
  icon: any; color: string; textColor: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon size={18} className={textColor} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { data: visitasHoy = [] } = useQuery({ queryKey: ['visitas-hoy'], queryFn: visitasApi.hoy });
  const { data: todasVisitas = [] } = useQuery({ queryKey: ['visitas'], queryFn: visitasApi.list });
  const { data: incAbiertas = [] } = useQuery({ queryKey: ['incidencias-abiertas'], queryFn: incidenciasApi.abiertas });
  const { data: tecnicos = [] } = useQuery({ queryKey: ['usuarios'], queryFn: usersApi.list });
  const { data: informes = [] } = useQuery({ queryKey: ['informes'], queryFn: informesApi.list });

  const tecnicosActivos = tecnicos.filter(u => u.rol === 'tecnico' && u.activo);
  const enCurso = todasVisitas.filter(v => v.estado === 'en_curso');

  // Mes actual
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const visitasMes = todasVisitas.filter(v => new Date(v.createdAt) >= inicioMes);
  const completadasMes = visitasMes.filter(v => v.estado === 'completada');
  const tasaCompletado = visitasMes.length
    ? Math.round((completadasMes.length / visitasMes.length) * 100)
    : 0;

  // Carga por técnico
  const cargaTecnicos = tecnicosActivos.map(t => ({
    nombre: t.nombre.split(' ')[0],
    pendientes: todasVisitas.filter(v => v.tecnico_id === t.id && (v.estado === 'programada' || v.estado === 'en_curso')).length,
    completadas: todasVisitas.filter(v => v.tecnico_id === t.id && v.estado === 'completada').length,
  }));

  // Distribución por tipo
  const tipoData = (Object.keys(TIPO_LABELS) as TipoVisita[]).map((t, i) => ({
    name: TIPO_LABELS[t],
    value: todasVisitas.filter(v => v.tipo === t).length,
    color: TIPO_COLORS[i],
  })).filter(d => d.value > 0);

  // Visitas de la semana (últimos 7 días)
  const semana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      dia: d.toLocaleDateString('es-ES', { weekday: 'short' }),
      fecha: d.toDateString(),
    };
  });
  const visitasSemana = semana.map(({ dia, fecha }) => ({
    dia,
    total: todasVisitas.filter(v => new Date(v.fechaProgramada).toDateString() === fecha).length,
    completadas: todasVisitas.filter(v => new Date(v.fechaProgramada).toDateString() === fecha && v.estado === 'completada').length,
  }));

  const incCriticas = incAbiertas.filter(i => i.prioridad === 'critica' || i.prioridad === 'alta').length;

  return (
    <div className="p-6 space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Panel de control</h1>
          <p className="text-sm text-slate-500">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {enCurso.length > 0 && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-sm font-medium text-yellow-800">{enCurso.length} visita{enCurso.length > 1 ? 's' : ''} en curso</span>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <KpiCard label="Visitas hoy" value={visitasHoy.length}
          sub={`${visitasHoy.filter(v => v.estado === 'completada').length} completadas`}
          icon={CalendarCheck} color="bg-blue-50" textColor="text-brand" />
        <KpiCard label="En curso ahora" value={enCurso.length}
          icon={Clock} color="bg-yellow-50" textColor="text-yellow-600" />
        <KpiCard label="Tasa este mes" value={`${tasaCompletado}%`}
          sub={`${completadasMes.length} de ${visitasMes.length}`}
          icon={TrendingUp} color="bg-green-50" textColor="text-green-600" />
        <KpiCard label="Incidencias abiertas" value={incAbiertas.length}
          sub={incCriticas > 0 ? `${incCriticas} críticas/altas` : 'sin urgentes'}
          icon={AlertTriangle} color={incCriticas > 0 ? 'bg-red-50' : 'bg-slate-50'} textColor={incCriticas > 0 ? 'text-red-600' : 'text-slate-500'} />
        <KpiCard label="Técnicos activos" value={tecnicosActivos.length}
          icon={Users} color="bg-purple-50" textColor="text-purple-600" />
      </div>

      {/* Fila central */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Visitas del día */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-medium text-slate-900">Visitas del día</h2>
            <span className="text-xs text-slate-400">{visitasHoy.length} programadas</span>
          </div>
          <div className="divide-y divide-slate-100">
            {visitasHoy.length === 0 && (
              <p className="px-5 py-8 text-sm text-slate-400 text-center">No hay visitas programadas para hoy</p>
            )}
            {visitasHoy.map(v => {
              const esNueva = v.tipo?.startsWith('instalacion_nueva');
              return (
                <div key={v.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-md ${esNueva ? 'bg-amber-50' : 'bg-blue-50'} flex-shrink-0`}>
                      {esNueva ? <Zap size={13} className="text-amber-500" /> : <Wrench size={13} className="text-blue-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{v.instalacion?.nombre}</p>
                      <p className="text-xs text-slate-500">
                        {v.tecnico?.nombre} · {new Date(v.fechaProgramada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <Badge value={v.estado} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Distribución por tipo */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-medium text-slate-900">Tipos de trabajo</h2>
          </div>
          <div className="p-4">
            {tipoData.length === 0
              ? <p className="text-sm text-slate-400 text-center py-8">Sin datos</p>
              : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={tipoData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {tipoData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v} visitas`]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
          </div>
        </div>
      </div>

      {/* Fila inferior */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Visitas 7 días */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-medium text-slate-900">Actividad — últimos 7 días</h2>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={visitasSemana} barSize={18}>
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="total" name="Total" fill="#dbeafe" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completadas" name="Completadas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Derecha: carga técnicos + incidencias críticas */}
        <div className="space-y-4">
          {/* Carga técnicos */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-medium text-slate-900">Carga por técnico</h2>
            </div>
            <div className="px-5 py-3 space-y-3">
              {cargaTecnicos.length === 0
                ? <p className="text-sm text-slate-400 text-center py-2">Sin técnicos</p>
                : cargaTecnicos.map(t => (
                  <div key={t.nombre}>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span className="font-medium">{t.nombre}</span>
                      <span>{t.pendientes} pend. · {t.completadas} hechas</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand rounded-full transition-all"
                        style={{ width: `${Math.min(100, (t.completadas / (t.completadas + t.pendientes || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Incidencias urgentes */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-medium text-slate-900">Incidencias abiertas</h2>
            </div>
            <div className="divide-y divide-slate-100 max-h-44 overflow-y-auto">
              {incAbiertas.length === 0 && (
                <p className="px-5 py-5 text-sm text-slate-400 text-center">Sin incidencias</p>
              )}
              {incAbiertas.slice(0, 6).map(inc => (
                <div key={inc.id} className="px-5 py-2.5 flex items-start gap-2">
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    { critica: 'bg-red-500', alta: 'bg-orange-400', media: 'bg-yellow-400', baja: 'bg-slate-300' }[inc.prioridad]
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 truncate">{inc.titulo}</p>
                    <p className="text-xs text-slate-400 truncate">{inc.instalacion?.nombre}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Últimos informes */}
      {informes.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-medium text-slate-900">Últimos informes</h2>
            <a href="/informes" className="text-xs text-brand hover:text-brand-dark">Ver todos →</a>
          </div>
          <div className="divide-y divide-slate-100">
            {informes.slice(0, 4).map(inf => (
              <div key={inf.id} className="px-5 py-3 flex items-center gap-4">
                <div className="p-2 bg-slate-50 rounded-lg flex-shrink-0">
                  <FileText size={14} className="text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{inf.visita?.instalacion?.nombre ?? '—'}</p>
                  <p className="text-xs text-slate-500">{inf.visita?.tecnico?.nombre} · {new Date(inf.createdAt).toLocaleDateString('es-ES')}</p>
                </div>
                {inf.nombreFirmante && (
                  <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full flex-shrink-0">
                    <CheckCircle2 size={11} />
                    <span>Firmado</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
