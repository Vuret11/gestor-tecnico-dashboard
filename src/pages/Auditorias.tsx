import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { visitas as visitasApi, incidencias as incidenciasApi, users as usersApi } from '../api/endpoints';
import type { Visita, Incidencia } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Download, ChevronLeft, ChevronRight, CalendarCheck, AlertTriangle, Zap, Wrench, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { AuditoriaPDFButton } from '../components/AuditoriaPDF';

// ── Constantes ────────────────────────────────────────────────────────────────
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const TIPOS = [
  { key: 'todos', label: 'Todos los tipos' },
  { key: 'visita_tecnica_fv', label: 'V.T. Fotovoltaica' },
  { key: 'visita_tecnica_aerotermia', label: 'V.T. Aerotermia' },
  { key: 'instalacion_nueva_fv', label: 'Inst. FV' },
  { key: 'instalacion_nueva_aerotermia', label: 'Inst. Aerotermia' },
];

type Periodo = 'semana' | 'mes' | 'año';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getWeekStart(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  r.setHours(0, 0, 0, 0);
  return r;
}

function buildFila(label: string, v: Visita[], inc: Incidencia[]) {
  return {
    Período: label,
    'Total visitas': v.length,
    Completadas: v.filter(x => x.estado === 'completada').length,
    Canceladas: v.filter(x => x.estado === 'cancelada').length,
    'V.T. FV': v.filter(x => x.tipo === 'visita_tecnica_fv').length,
    'V.T. Aerotermia': v.filter(x => x.tipo === 'visita_tecnica_aerotermia').length,
    'Inst. FV': v.filter(x => x.tipo === 'instalacion_nueva_fv').length,
    'Inst. Aerotermia': v.filter(x => x.tipo === 'instalacion_nueva_aerotermia').length,
    Incidencias: inc.length,
    'Inc. críticas': inc.filter(x => x.prioridad === 'critica' || x.prioridad === 'alta').length,
  };
}

function exportExcel(filas: object[], filasTecnicos: object[], titulo: string) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Desglose por período');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasTecnicos), 'Técnicos');
  XLSX.writeFile(wb, `auditoria_${titulo.replace(/[\s/]/g, '_')}.xlsx`);
}

// ── Componente KPI ────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: number | string; sub?: string; icon: any; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className={`inline-flex p-2.5 rounded-lg ${color} mb-3`}>
        <Icon size={18} className="text-white" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Auditorias() {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [cursor, setCursor] = useState(new Date());
  const [tipoFiltro, setTipoFiltro] = useState('todos');

  const { data: visitas = [] } = useQuery({ queryKey: ['visitas'], queryFn: visitasApi.list });
  const { data: incidencias = [] } = useQuery({ queryKey: ['incidencias'], queryFn: incidenciasApi.list });
  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios'], queryFn: usersApi.list });

  // Rango de fechas según período
  const { desde, hasta, titulo, subtitulo } = useMemo(() => {
    if (periodo === 'semana') {
      const start = getWeekStart(cursor);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      return {
        desde: start, hasta: end,
        titulo: `Semana ${fmt(start)}–${fmt(end)} ${end.getFullYear()}`,
        subtitulo: `Del ${start.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} al ${end.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
      };
    }
    if (periodo === 'mes') {
      const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        desde: start, hasta: end,
        titulo: `${MESES[cursor.getMonth()]} ${cursor.getFullYear()}`,
        subtitulo: `Mes completo · ${end.getDate()} días`,
      };
    }
    const start = new Date(cursor.getFullYear(), 0, 1);
    const end = new Date(cursor.getFullYear(), 11, 31, 23, 59, 59, 999);
    return {
      desde: start, hasta: end,
      titulo: `${cursor.getFullYear()}`,
      subtitulo: 'Año completo',
    };
  }, [periodo, cursor]);

  // Navegación
  function navPrev() {
    const d = new Date(cursor);
    if (periodo === 'semana') d.setDate(d.getDate() - 7);
    else if (periodo === 'mes') d.setMonth(d.getMonth() - 1);
    else d.setFullYear(d.getFullYear() - 1);
    setCursor(d);
  }
  function navNext() {
    const d = new Date(cursor);
    if (periodo === 'semana') d.setDate(d.getDate() + 7);
    else if (periodo === 'mes') d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    setCursor(d);
  }

  // Datos filtrados
  const visitasFiltradas = useMemo(() => {
    let v = visitas.filter(x => {
      const d = new Date(x.fechaProgramada);
      return d >= desde && d <= hasta;
    });
    if (tipoFiltro !== 'todos') v = v.filter(x => x.tipo === tipoFiltro);
    return v;
  }, [visitas, desde, hasta, tipoFiltro]);

  const incidenciasFiltradas = useMemo(() =>
    incidencias.filter(x => {
      const d = new Date(x.createdAt);
      return d >= desde && d <= hasta;
    }), [incidencias, desde, hasta]);

  // Filas de tabla según período
  const filas = useMemo(() => {
    if (periodo === 'semana') {
      return DIAS_SEMANA.map((dia, i) => {
        const fecha = new Date(desde);
        fecha.setDate(fecha.getDate() + i);
        const dStr = fecha.toDateString();
        return buildFila(
          `${dia} ${fecha.getDate()}`,
          visitasFiltradas.filter(v => new Date(v.fechaProgramada).toDateString() === dStr),
          incidenciasFiltradas.filter(inc => new Date(inc.createdAt).toDateString() === dStr),
        );
      });
    }
    if (periodo === 'mes') {
      const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      return Array.from({ length: days }, (_, i) => {
        const fecha = new Date(cursor.getFullYear(), cursor.getMonth(), i + 1);
        const dStr = fecha.toDateString();
        return buildFila(
          `${i + 1} ${fecha.toLocaleDateString('es-ES', { weekday: 'short' })}`,
          visitasFiltradas.filter(v => new Date(v.fechaProgramada).toDateString() === dStr),
          incidenciasFiltradas.filter(inc => new Date(inc.createdAt).toDateString() === dStr),
        );
      });
    }
    // año
    return MESES.map((mes, idx) =>
      buildFila(
        mes,
        visitasFiltradas.filter(v => new Date(v.fechaProgramada).getMonth() === idx),
        incidenciasFiltradas.filter(inc => new Date(inc.createdAt).getMonth() === idx),
      )
    );
  }, [periodo, visitasFiltradas, incidenciasFiltradas, cursor, desde]);

  // Totales para KPIs
  const totalVisitas = visitasFiltradas.length;
  const completadas = visitasFiltradas.filter(v => v.estado === 'completada').length;
  const instNuevas = visitasFiltradas.filter(v => v.tipo?.startsWith('instalacion_nueva')).length;
  const totalInc = incidenciasFiltradas.length;
  const incResueltas = incidenciasFiltradas.filter(i => i.estado === 'cerrada' || i.estado === 'resuelta').length;

  // Datos gráfico (solo filas con actividad o todas si son pocas)
  const chartData = (periodo === 'mes'
    ? filas.filter(f => f['Total visitas'] > 0 || f['Incidencias'] > 0)
    : filas
  ).map(f => ({
    name: String(f.Período).slice(0, periodo === 'semana' ? 3 : periodo === 'mes' ? 2 : 4),
    Visitas: f['Total visitas'],
    Completadas: f['Completadas'],
    Incidencias: f['Incidencias'],
  }));

  const tipoLabel = TIPOS.find(t => t.key === tipoFiltro)?.label ?? 'Todos';

  // Técnicos activos con visitas en el período
  const tecnicoRows = useMemo(() => {
    const tecnicos = usuarios.filter(u => u.rol === 'tecnico' && u.activo);
    return tecnicos
      .map(t => {
        const v = visitasFiltradas.filter(x => x.tecnico_id === t.id);
        return {
          Técnico: t.nombre,
          Total: v.length,
          Completadas: v.filter(x => x.estado === 'completada').length,
          Canceladas: v.filter(x => x.estado === 'cancelada').length,
          'V.T. FV': v.filter(x => x.tipo === 'visita_tecnica_fv').length,
          'V.T. Aerotermia': v.filter(x => x.tipo === 'visita_tecnica_aerotermia').length,
          'Inst. FV': v.filter(x => x.tipo === 'instalacion_nueva_fv').length,
          'Inst. Aerotermia': v.filter(x => x.tipo === 'instalacion_nueva_aerotermia').length,
          '% completado': v.length ? `${Math.round(v.filter(x => x.estado === 'completada').length / v.length * 100)}%` : '—',
        };
      })
      .filter(r => r.Total > 0)
      .sort((a, b) => b.Total - a.Total);
  }, [usuarios, visitasFiltradas]);

  const kpisForPDF = [
    { label: 'Total visitas', value: totalVisitas, sub: `${completadas} completadas` },
    { label: 'Instalaciones nuevas', value: instNuevas },
    { label: 'Incidencias', value: totalInc, sub: `${incResueltas} resueltas` },
    { label: '% completado', value: totalVisitas ? `${Math.round(completadas / totalVisitas * 100)}%` : '—' },
  ];

  return (
    <div className="p-6 space-y-5">

      {/* Cabecera y controles */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Auditorías</h1>
          <p className="text-sm text-slate-500">{subtitulo}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Tabs período */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            {(['semana', 'mes', 'año'] as Periodo[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-4 py-2 capitalize transition-colors ${periodo === p ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {/* Navegación */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={navPrev} className="p-2 hover:bg-slate-100 text-slate-600">
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 text-sm font-medium text-slate-700 whitespace-nowrap">{titulo}</span>
            <button onClick={navNext} className="p-2 hover:bg-slate-100 text-slate-600">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Filtro tipo */}
          <select
            value={tipoFiltro}
            onChange={e => setTipoFiltro(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>

          {/* Exportar */}
          <button
            onClick={() => exportExcel(filas, tecnicoRows, titulo)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
          >
            <Download size={15} /> Excel
          </button>
          <AuditoriaPDFButton
            titulo={titulo}
            subtitulo={subtitulo}
            tipoLabel={tipoLabel}
            filas={filas}
            kpis={kpisForPDF}
            tecnicoFilas={tecnicoRows}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Visitas totales" value={totalVisitas}
          sub={`${completadas} completadas (${totalVisitas ? Math.round(completadas / totalVisitas * 100) : 0}%)`}
          icon={CalendarCheck} color="bg-blue-500" />
        <KpiCard label="Instalaciones nuevas" value={instNuevas}
          sub="FV + Aerotermia"
          icon={Zap} color="bg-amber-500" />
        <KpiCard label="Visitas técnicas" value={totalVisitas - instNuevas}
          sub="FV + Aerotermia"
          icon={Wrench} color="bg-cyan-500" />
        <KpiCard label="Incidencias" value={totalInc}
          sub={`${incResueltas} resueltas`}
          icon={AlertTriangle} color="bg-red-500" />
      </div>

      {/* Gráfico */}
      {chartData.some(d => d.Visitas > 0 || d.Incidencias > 0) && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-medium text-slate-900">Actividad — {titulo}</h2>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={14}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Visitas" fill="#dbeafe" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Completadas" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Incidencias" fill="#f87171" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabla técnicos */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Users size={16} className="text-slate-400" />
          <h2 className="font-medium text-slate-900">Rendimiento por técnico</h2>
          <span className="ml-auto text-xs text-slate-400">{tecnicoRows.length} técnicos con actividad</span>
        </div>
        {tecnicoRows.length === 0
          ? <p className="px-5 py-8 text-sm text-slate-400 text-center">Sin visitas en este período</p>
          : (
            <table className="w-full text-xs min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Técnico', 'Total', 'Complet.', 'Cancel.', 'V.T. FV', 'V.T. Aero', 'Inst. FV', 'Inst. Aero', '% Completado'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tecnicoRows.map((t, i) => {
                  const pct = t.Total ? Math.round(t['Completadas'] / t.Total * 100) : 0;
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-3 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-brand text-[10px] font-bold">{t.Técnico[0]}</span>
                          </div>
                          {t.Técnico}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{t.Total}</td>
                      <td className="px-3 py-3 text-green-600">{t['Completadas'] || '—'}</td>
                      <td className="px-3 py-3 text-slate-400">{t['Canceladas'] || '—'}</td>
                      <td className="px-3 py-3 text-blue-600">{t['V.T. FV'] || '—'}</td>
                      <td className="px-3 py-3 text-cyan-600">{t['V.T. Aerotermia'] || '—'}</td>
                      <td className="px-3 py-3 text-amber-600">{t['Inst. FV'] || '—'}</td>
                      <td className="px-3 py-3 text-orange-600">{t['Inst. Aerotermia'] || '—'}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
                            <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-slate-700 font-medium w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <tr>
                  <td className="px-3 py-2.5 text-slate-700">TOTAL</td>
                  <td className="px-3 py-2.5">{tecnicoRows.reduce((s, t) => s + t.Total, 0)}</td>
                  <td className="px-3 py-2.5 text-green-600">{tecnicoRows.reduce((s, t) => s + t['Completadas'], 0)}</td>
                  <td className="px-3 py-2.5 text-slate-400">{tecnicoRows.reduce((s, t) => s + t['Canceladas'], 0) || '—'}</td>
                  <td className="px-3 py-2.5 text-blue-600">{tecnicoRows.reduce((s, t) => s + t['V.T. FV'], 0) || '—'}</td>
                  <td className="px-3 py-2.5 text-cyan-600">{tecnicoRows.reduce((s, t) => s + t['V.T. Aerotermia'], 0) || '—'}</td>
                  <td className="px-3 py-2.5 text-amber-600">{tecnicoRows.reduce((s, t) => s + t['Inst. FV'], 0) || '—'}</td>
                  <td className="px-3 py-2.5 text-orange-600">{tecnicoRows.reduce((s, t) => s + t['Inst. Aerotermia'], 0) || '—'}</td>
                  <td className="px-3 py-2.5" />
                </tr>
              </tfoot>
            </table>
          )}
      </div>

      {/* Tabla desglose */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-medium text-slate-900">Desglose — {tipoLabel}</h2>
          <span className="text-xs text-slate-400">{filas.filter(f => f['Total visitas'] > 0).length} períodos con actividad</span>
        </div>
        <table className="w-full text-xs min-w-[700px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Período', 'Visitas', 'Complet.', 'Cancel.', 'V.T. FV', 'V.T. Aero', 'Inst. FV', 'Inst. Aero', 'Incid.', 'Críticas'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map((f, i) => {
              const sinActividad = f['Total visitas'] === 0 && f['Incidencias'] === 0;
              return (
                <tr key={i} className={sinActividad ? 'opacity-40' : 'hover:bg-slate-50'}>
                  <td className="px-3 py-2.5 font-medium text-slate-700 whitespace-nowrap">{f.Período}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-900">{f['Total visitas'] || '—'}</td>
                  <td className="px-3 py-2.5 text-green-600">{f['Completadas'] || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-400">{f['Canceladas'] || '—'}</td>
                  <td className="px-3 py-2.5 text-blue-600">{f['V.T. FV'] || '—'}</td>
                  <td className="px-3 py-2.5 text-cyan-600">{f['V.T. Aerotermia'] || '—'}</td>
                  <td className="px-3 py-2.5 text-amber-600">{f['Inst. FV'] || '—'}</td>
                  <td className="px-3 py-2.5 text-orange-600">{f['Inst. Aerotermia'] || '—'}</td>
                  <td className="px-3 py-2.5 text-red-500">{f['Incidencias'] || '—'}</td>
                  <td className="px-3 py-2.5 text-red-700 font-medium">{f['Inc. críticas'] || '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
            <tr>
              <td className="px-3 py-2.5 text-slate-700">TOTAL</td>
              {(['Total visitas', 'Completadas', 'Canceladas', 'V.T. FV', 'V.T. Aerotermia', 'Inst. FV', 'Inst. Aerotermia', 'Incidencias', 'Inc. críticas'] as const).map(k => (
                <td key={k} className="px-3 py-2.5 text-slate-900">
                  {filas.reduce((s, f) => s + (Number(f[k]) || 0), 0) || '—'}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
