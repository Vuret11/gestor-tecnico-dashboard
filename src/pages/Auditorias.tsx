import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { visitas as visitasApi, incidencias as incidenciasApi, users as usersApi, inventario as inventarioApi, stats as statsApi } from '../api/endpoints';
import type { Visita, Incidencia, VisitaArticulo } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Download, ChevronLeft, ChevronRight, CalendarCheck, AlertTriangle, Zap, Wrench, Users, Package, Clock, BarChart2, TrendingUp, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { AuditoriaPDFButton } from '../components/AuditoriaPDF';

// ── Constantes ────────────────────────────────────────────────────────────────
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const TIPOS = [
  { key: 'todos', label: 'Todos los tipos' },
  { key: 'visita_tecnica_fv', label: 'V.T. Fotovoltaica' },
  { key: 'visita_tecnica_aerotermia', label: 'V.T. Rite' },
  { key: 'instalacion_nueva_fv', label: 'Inst. FV' },
  { key: 'instalacion_nueva_aerotermia', label: 'Inst. Rite' },
];

type Periodo = 'semana' | 'mes' | 'año';
type Vista = 'actividad' | 'kpis' | 'inventario' | 'crm';

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
    'V.T. Rite': v.filter(x => x.tipo === 'visita_tecnica_aerotermia').length,
    'Inst. FV': v.filter(x => x.tipo === 'instalacion_nueva_fv').length,
    'Inst. Rite': v.filter(x => x.tipo === 'instalacion_nueva_aerotermia').length,
    Incidencias: inc.length,
    'Inc. críticas': inc.filter(x => x.prioridad === 'critica' || x.prioridad === 'alta').length,
  };
}

function exportActividad(filas: object[], filasTecnicos: object[], titulo: string) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Desglose por período');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasTecnicos), 'Técnicos');
  XLSX.writeFile(wb, `auditoria_${titulo.replace(/[\s/]/g, '_')}.xlsx`);
}

function exportKpis(kpis: any[], titulo: string) {
  const filas = kpis.map(k => ({
    Técnico: k.tecnico.nombre,
    Email: k.tecnico.email,
    'Visitas totales': k.visitas.total,
    Completadas: k.visitas.completadas,
    'Horas trabajadas': k.horas,
    'Instalaciones únicas': k.instalaciones,
    Incidencias: k.incidencias,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'KPIs Técnicos');
  XLSX.writeFile(wb, `kpis_tecnicos_${titulo.replace(/[\s/]/g, '_')}.xlsx`);
}

function exportHistorial(historial: VisitaArticulo[], titulo: string) {
  const filas = historial.map((h: any) => ({
    Fecha: h.createdAt ? new Date(h.createdAt).toLocaleDateString('es-ES') : '—',
    Instalación: h.visita?.instalacion?.nombre ?? '—',
    Técnico: h.visita?.tecnico?.nombre ?? '—',
    Artículo: h.articulo?.nombre ?? '—',
    Referencia: h.articulo?.referencia ?? '—',
    Unidad: h.articulo?.unidad ?? '—',
    Cantidad: Number(h.cantidad),
    'Precio unitario': h.precioUnitario ? Number(h.precioUnitario) : '—',
    Total: h.precioUnitario ? Math.round(Number(h.precioUnitario) * Number(h.cantidad) * 100) / 100 : '—',
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Historial Inventario');
  XLSX.writeFile(wb, `inventario_historial_${titulo.replace(/[\s/]/g, '_')}.xlsx`);
}

function exportCRM(porModelo: any[], porPeriodo: any[], porTecnico: any[], titulo: string) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porModelo.map(r => ({
    Categoría: r.categoria,
    Modelo: r.nombre,
    Referencia: r.referencia || '—',
    'Unidades instaladas': Math.round(r.cantidad * 1000) / 1000,
    'Nº instalaciones': r.instalaciones,
    'Coste total (€)': r.coste.toFixed(2),
  }))), 'Por modelo');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porPeriodo.map(r => ({
    Período: r.label,
    'Paneles (ud)': r.paneles,
    'Inversores (ud)': r.inversores,
    'Otros (ud)': r.otros,
    'Coste total (€)': r.coste.toFixed(2),
  }))), 'Evolución temporal');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porTecnico.map(r => ({
    Técnico: r.nombre,
    'Paneles (ud)': r.paneles,
    'Inversores (ud)': r.inversores,
    'Otros (ud)': r.otros,
    'Coste total (€)': r.coste.toFixed(2),
  }))), 'Por técnico');
  XLSX.writeFile(wb, `crm_materiales_${titulo.replace(/[\s/]/g, '_')}.xlsx`);
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
  const [vista, setVista] = useState<Vista>('actividad');
  const [crmCategoria, setCrmCategoria] = useState('');
  const [crmTecnico, setCrmTecnico] = useState('');

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

  // Queries que dependen del rango de fechas
  const { data: kpisTecnicos = [], isFetching: kpisLoading } = useQuery({
    queryKey: ['kpis-tecnicos', desde.toISOString(), hasta.toISOString()],
    queryFn: () => statsApi.kpisTecnicos(desde.toISOString(), hasta.toISOString()),
    enabled: vista === 'kpis',
  });

  const { data: historial = [], isFetching: historialLoading } = useQuery({
    queryKey: ['inventario-historial', desde.toISOString(), hasta.toISOString()],
    queryFn: () => inventarioApi.historial(desde.toISOString(), hasta.toISOString()),
    enabled: vista === 'inventario' || vista === 'crm',
  });

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

  // Datos filtrados (actividad)
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

  // Datos gráfico
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
          'V.T. Rite': v.filter(x => x.tipo === 'visita_tecnica_aerotermia').length,
          'Inst. FV': v.filter(x => x.tipo === 'instalacion_nueva_fv').length,
          'Inst. Rite': v.filter(x => x.tipo === 'instalacion_nueva_aerotermia').length,
          '% completado': v.length ? `${Math.round(v.filter(x => x.estado === 'completada').length / v.length * 100)}%` : '—',
        };
      })
      .filter(r => r.Total > 0)
      .sort((a, b) => b.Total - a.Total);
  }, [usuarios, visitasFiltradas]);

  // ── Agregaciones CRM ──────────────────────────────────────────────────────
  const histRaw = historial as any[];
  const hist = histRaw.filter(h => {
    if (crmCategoria && h.articulo?.categoria !== crmCategoria) return false;
    if (crmTecnico && h.visita?.tecnico?.id !== crmTecnico) return false;
    return true;
  });
  const crmCategorias = [...new Set(histRaw.map((h: any) => h.articulo?.categoria).filter(Boolean))].sort() as string[];
  const crmTecnicos = [...new Map(histRaw.map((h: any): [string, string] => [h.visita?.tecnico?.id, h.visita?.tecnico?.nombre]).filter(([id]) => id)).entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? ''));

  const crmPorModelo = useMemo(() => {
    const map = new Map<string, { categoria: string; nombre: string; referencia: string; cantidad: number; instalaciones: number; coste: number; _instSet: Set<string> }>();
    for (const h of hist) {
      const key = h.articulo?.id ?? '?';
      if (!map.has(key)) {
        map.set(key, { categoria: h.articulo?.categoria ?? '—', nombre: h.articulo?.nombre ?? '—', referencia: h.articulo?.referencia ?? '', cantidad: 0, instalaciones: 0, coste: 0, _instSet: new Set() });
      }
      const row = map.get(key)!;
      row.cantidad += Number(h.cantidad);
      const instId = h.visita?.instalacion?.id ?? h.visita_id ?? '';
      if (instId) row._instSet.add(instId);
      if (h.precioUnitario) row.coste += Number(h.precioUnitario) * Number(h.cantidad);
    }
    return Array.from(map.values())
      .map(r => ({ ...r, instalaciones: r._instSet.size }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [hist]);

  const crmPorPeriodo = useMemo(() => {
    const getLabel = (dateStr: string) => {
      const d = new Date(dateStr);
      if (periodo === 'semana') { const day = d.getDay(); const lbl = DIAS_SEMANA[day === 0 ? 6 : day - 1]; return `${lbl} ${d.getDate()}`; }
      if (periodo === 'mes') return `${d.getDate()} ${d.toLocaleDateString('es-ES', { month: 'short' })}`;
      return MESES[d.getMonth()];
    };
    const ordered: string[] = periodo === 'semana'
      ? DIAS_SEMANA.map((dia, i) => { const f = new Date(desde); f.setDate(f.getDate() + i); return `${dia} ${f.getDate()}`; })
      : periodo === 'mes'
        ? Array.from({ length: new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate() }, (_, i) => { const f = new Date(cursor.getFullYear(), cursor.getMonth(), i + 1); return `${i + 1} ${f.toLocaleDateString('es-ES', { month: 'short' })}`; })
        : [...MESES];
    const map = new Map<string, { label: string; paneles: number; inversores: number; otros: number; coste: number }>(
      ordered.map(l => [l, { label: l, paneles: 0, inversores: 0, otros: 0, coste: 0 }])
    );
    for (const h of hist) {
      const label = getLabel(h.createdAt);
      if (!map.has(label)) continue;
      const row = map.get(label)!;
      const cat = h.articulo?.categoria ?? '';
      const qty = Number(h.cantidad);
      if (cat === 'Panel Solar') row.paneles += qty;
      else if (cat === 'Inversor') row.inversores += qty;
      else row.otros += qty;
      if (h.precioUnitario) row.coste += Number(h.precioUnitario) * qty;
    }
    return Array.from(map.values());
  }, [hist, periodo, desde, cursor]);

  const crmPorTecnico = useMemo(() => {
    const map = new Map<string, { nombre: string; paneles: number; inversores: number; otros: number; coste: number }>();
    for (const h of hist) {
      const id = h.visita?.tecnico?.id ?? '?';
      const nombre = h.visita?.tecnico?.nombre ?? 'Desconocido';
      if (!map.has(id)) map.set(id, { nombre, paneles: 0, inversores: 0, otros: 0, coste: 0 });
      const row = map.get(id)!;
      const cat = h.articulo?.categoria ?? '';
      const qty = Number(h.cantidad);
      if (cat === 'Panel Solar') row.paneles += qty;
      else if (cat === 'Inversor') row.inversores += qty;
      else row.otros += qty;
      if (h.precioUnitario) row.coste += Number(h.precioUnitario) * qty;
    }
    return Array.from(map.values()).sort((a, b) => (b.paneles + b.inversores) - (a.paneles + a.inversores));
  }, [hist]);

  const crmPorInstalacion = useMemo(() => {
    const map = new Map<string, { nombre: string; cliente: string; paneles: number; inversores: number; otros: number; coste: number }>();
    for (const h of hist) {
      const id = h.visita?.instalacion?.id ?? '?';
      const nombre = h.visita?.instalacion?.nombre ?? 'Desconocida';
      const cliente = h.visita?.instalacion?.cliente ?? '—';
      if (!map.has(id)) map.set(id, { nombre, cliente, paneles: 0, inversores: 0, otros: 0, coste: 0 });
      const row = map.get(id)!;
      const cat = h.articulo?.categoria ?? '';
      const qty = Number(h.cantidad);
      if (cat === 'Panel Solar') row.paneles += qty;
      else if (cat === 'Inversor') row.inversores += qty;
      else row.otros += qty;
      if (h.precioUnitario) row.coste += Number(h.precioUnitario) * qty;
    }
    return Array.from(map.values()).sort((a, b) => b.coste - a.coste).slice(0, 15);
  }, [hist]);

  const totalPaneles = crmPorModelo.filter(r => r.categoria === 'Panel Solar').reduce((s, r) => s + r.cantidad, 0);
  const totalInversores = crmPorModelo.filter(r => r.categoria === 'Inversor').reduce((s, r) => s + r.cantidad, 0);
  const totalCosteMat = crmPorModelo.reduce((s, r) => s + r.coste, 0);
  const totalInstMat = new Set(hist.map((h: any) => h.visita?.instalacion?.id).filter(Boolean)).size;

  const crmChartData = crmPorPeriodo
    .filter(r => r.paneles > 0 || r.inversores > 0 || r.otros > 0)
    .map(r => ({ name: r.label.slice(0, periodo === 'semana' ? 3 : periodo === 'mes' ? 2 : 4), Paneles: Math.round(r.paneles), Inversores: Math.round(r.inversores), Otros: Math.round(r.otros) }));

  const CATEGORIA_COLORS: Record<string, string> = {
    'Panel Solar': 'bg-amber-100 text-amber-700',
    'Inversor': 'bg-blue-100 text-blue-700',
    'Batería': 'bg-green-100 text-green-700',
    'Cable': 'bg-slate-100 text-slate-600',
    'Estructura': 'bg-orange-100 text-orange-700',
  };

  const kpisForPDF = [
    { label: 'Total visitas', value: totalVisitas, sub: `${completadas} completadas` },
    { label: 'Instalaciones nuevas', value: instNuevas },
    { label: 'Incidencias', value: totalInc, sub: `${incResueltas} resueltas` },
    { label: '% completado', value: totalVisitas ? `${Math.round(completadas / totalVisitas * 100)}%` : '—' },
  ];

  const VISTAS = [
    { id: 'actividad' as Vista, label: 'Actividad', icon: CalendarCheck },
    { id: 'kpis' as Vista, label: 'KPIs Técnicos', icon: Clock },
    { id: 'inventario' as Vista, label: 'Historial Inventario', icon: Package },
    { id: 'crm' as Vista, label: 'Análisis Materiales', icon: BarChart2 },
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

          {/* Filtro tipo — solo en actividad */}
          {vista === 'actividad' && (
            <select
              value={tipoFiltro}
              onChange={e => setTipoFiltro(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          )}

          {/* Exportar */}
          {vista === 'actividad' && (
            <>
              <button
                onClick={() => exportActividad(filas, tecnicoRows, titulo)}
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
            </>
          )}
          {vista === 'kpis' && (
            <button
              onClick={() => exportKpis(kpisTecnicos, titulo)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
            >
              <Download size={15} /> Excel
            </button>
          )}
          {vista === 'inventario' && (
            <button
              onClick={() => exportHistorial(historial as any, titulo)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
            >
              <Download size={15} /> Excel
            </button>
          )}
          {vista === 'crm' && (
            <button
              onClick={() => exportCRM(crmPorModelo, crmPorPeriodo, crmPorTecnico, titulo)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
            >
              <Download size={15} /> Excel
            </button>
          )}
        </div>
      </div>

      {/* Tabs de vista */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl overflow-hidden">
        {VISTAS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setVista(id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
              vista === id
                ? 'border-brand text-brand bg-brand/5'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Vista: Actividad ─────────────────────────────────────────────── */}
      {vista === 'actividad' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard label="Visitas totales" value={totalVisitas}
              sub={`${completadas} completadas (${totalVisitas ? Math.round(completadas / totalVisitas * 100) : 0}%)`}
              icon={CalendarCheck} color="bg-blue-500" />
            <KpiCard label="Instalaciones nuevas" value={instNuevas}
              sub="FV + Rite"
              icon={Zap} color="bg-amber-500" />
            <KpiCard label="Visitas técnicas" value={totalVisitas - instNuevas}
              sub="FV + Rite"
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
                          <td className="px-3 py-3 text-cyan-600">{t['V.T. Rite'] || '—'}</td>
                          <td className="px-3 py-3 text-amber-600">{t['Inst. FV'] || '—'}</td>
                          <td className="px-3 py-3 text-orange-600">{t['Inst. Rite'] || '—'}</td>
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
                      <td className="px-3 py-2.5 text-cyan-600">{tecnicoRows.reduce((s, t) => s + t['V.T. Rite'], 0) || '—'}</td>
                      <td className="px-3 py-2.5 text-amber-600">{tecnicoRows.reduce((s, t) => s + t['Inst. FV'], 0) || '—'}</td>
                      <td className="px-3 py-2.5 text-orange-600">{tecnicoRows.reduce((s, t) => s + t['Inst. Rite'], 0) || '—'}</td>
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
                      <td className="px-3 py-2.5 text-cyan-600">{f['V.T. Rite'] || '—'}</td>
                      <td className="px-3 py-2.5 text-amber-600">{f['Inst. FV'] || '—'}</td>
                      <td className="px-3 py-2.5 text-orange-600">{f['Inst. Rite'] || '—'}</td>
                      <td className="px-3 py-2.5 text-red-500">{f['Incidencias'] || '—'}</td>
                      <td className="px-3 py-2.5 text-red-700 font-medium">{f['Inc. críticas'] || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <tr>
                  <td className="px-3 py-2.5 text-slate-700">TOTAL</td>
                  {(['Total visitas', 'Completadas', 'Canceladas', 'V.T. FV', 'V.T. Rite', 'Inst. FV', 'Inst. Rite', 'Incidencias', 'Inc. críticas'] as const).map(k => (
                    <td key={k} className="px-3 py-2.5 text-slate-900">
                      {filas.reduce((s, f) => s + (Number(f[k]) || 0), 0) || '—'}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* ── Vista: KPIs Técnicos ─────────────────────────────────────────── */}
      {vista === 'kpis' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Clock size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-900">KPIs por técnico — {titulo}</h2>
            <span className="ml-auto text-xs text-slate-400">{kpisTecnicos.length} técnicos</span>
          </div>
          {kpisLoading
            ? <p className="px-5 py-8 text-sm text-slate-400 text-center">Cargando...</p>
            : kpisTecnicos.length === 0
              ? <p className="px-5 py-8 text-sm text-slate-400 text-center">Sin datos en este período</p>
              : (
                <table className="w-full text-xs min-w-[700px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Técnico', 'Visitas totales', 'Completadas', 'Horas trabajadas', 'Instalaciones únicas', 'Incidencias'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {kpisTecnicos.map((k: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-3 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-brand text-[10px] font-bold">{k.tecnico.nombre[0]}</span>
                            </div>
                            {k.tecnico.nombre}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-900">{k.visitas.total}</td>
                        <td className="px-3 py-3 text-green-600">{k.visitas.completadas || '—'}</td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                            <Clock size={11} />
                            {k.horas > 0 ? `${k.horas}h` : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{k.instalaciones || '—'}</td>
                        <td className="px-3 py-3 text-red-500">{k.incidencias || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                    <tr>
                      <td className="px-3 py-2.5 text-slate-700">TOTAL</td>
                      <td className="px-3 py-2.5">{kpisTecnicos.reduce((s: number, k: any) => s + k.visitas.total, 0)}</td>
                      <td className="px-3 py-2.5 text-green-600">{kpisTecnicos.reduce((s: number, k: any) => s + k.visitas.completadas, 0)}</td>
                      <td className="px-3 py-2.5 text-blue-700">{kpisTecnicos.reduce((s: number, k: any) => s + k.horas, 0).toFixed(1)}h</td>
                      <td className="px-3 py-2.5">—</td>
                      <td className="px-3 py-2.5 text-red-500">{kpisTecnicos.reduce((s: number, k: any) => s + k.incidencias, 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
        </div>
      )}

      {/* ── Vista: Historial Inventario ──────────────────────────────────── */}
      {vista === 'inventario' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Package size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-900">Historial de materiales — {titulo}</h2>
            <span className="ml-auto text-xs text-slate-400">{(historial as any[]).length} registros</span>
          </div>
          {historialLoading
            ? <p className="px-5 py-8 text-sm text-slate-400 text-center">Cargando...</p>
            : (historial as any[]).length === 0
              ? <p className="px-5 py-8 text-sm text-slate-400 text-center">Sin materiales registrados en este período</p>
              : (
                <table className="w-full text-xs min-w-[900px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Fecha', 'Instalación', 'Técnico', 'Artículo', 'Ref.', 'Ud.', 'Cantidad', 'P. Unit.', 'Total'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(historial as any[]).map((h, i) => {
                      const total = h.precioUnitario ? Number(h.precioUnitario) * Number(h.cantidad) : null;
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                            {h.createdAt ? new Date(h.createdAt).toLocaleDateString('es-ES') : '—'}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[150px] truncate">
                            {h.visita?.instalacion?.nombre ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{h.visita?.tecnico?.nombre ?? '—'}</td>
                          <td className="px-3 py-2.5 font-medium text-slate-900">{h.articulo?.nombre ?? '—'}</td>
                          <td className="px-3 py-2.5 text-slate-400">{h.articulo?.referencia ?? '—'}</td>
                          <td className="px-3 py-2.5 text-slate-400">{h.articulo?.unidad ?? '—'}</td>
                          <td className="px-3 py-2.5 font-semibold text-slate-900">{Number(h.cantidad)}</td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {h.precioUnitario ? `${Number(h.precioUnitario).toFixed(2)} €` : '—'}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-900">
                            {total !== null ? `${total.toFixed(2)} €` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                    <tr>
                      <td colSpan={6} className="px-3 py-2.5 text-slate-700">TOTAL</td>
                      <td className="px-3 py-2.5">{(historial as any[]).reduce((s, h) => s + Number(h.cantidad), 0)}</td>
                      <td className="px-3 py-2.5">—</td>
                      <td className="px-3 py-2.5 text-slate-900">
                        {(historial as any[]).reduce((s, h) => s + (h.precioUnitario ? Number(h.precioUnitario) * Number(h.cantidad) : 0), 0).toFixed(2)} €
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
        </div>
      )}

      {/* ── Vista: Análisis Materiales CRM ──────────────────────────────── */}
      {vista === 'crm' && (
        <>
          {historialLoading && <p className="text-sm text-slate-400 text-center py-8">Cargando datos...</p>}

          {/* Filtros CRM */}
          {!historialLoading && histRaw.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap gap-3 items-center">
              <span className="text-xs font-medium text-slate-500">Filtrar por:</span>
              <select value={crmCategoria} onChange={e => setCrmCategoria(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="">Todas las categorías</option>
                {crmCategorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={crmTecnico} onChange={e => setCrmTecnico(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="">Todos los técnicos</option>
                {crmTecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              {(crmCategoria || crmTecnico) && (
                <button onClick={() => { setCrmCategoria(''); setCrmTecnico(''); }}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1 border border-red-200 rounded-lg bg-red-50">
                  <X size={11} /> Limpiar filtros
                </button>
              )}
              {(crmCategoria || crmTecnico) && (
                <span className="text-xs text-slate-400 ml-auto">{hist.length} registros filtrados de {histRaw.length}</span>
              )}
            </div>
          )}

          {!historialLoading && hist.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 px-5 py-12 text-center">
              <BarChart2 size={32} className="mx-auto text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">{histRaw.length === 0 ? 'Sin materiales registrados en este período' : 'Sin resultados para los filtros aplicados'}</p>
              <p className="text-xs text-slate-300 mt-1">{histRaw.length === 0 ? 'Añade artículos a las visitas para ver estadísticas' : 'Prueba a cambiar los filtros'}</p>
            </div>
          )}

          {!historialLoading && hist.length > 0 && (
            <>
              {/* KPIs resumen */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard label="Paneles instalados" value={Math.round(totalPaneles * 10) / 10}
                  sub="unidades totales" icon={Zap} color="bg-amber-500" />
                <KpiCard label="Inversores instalados" value={Math.round(totalInversores * 10) / 10}
                  sub="unidades totales" icon={TrendingUp} color="bg-blue-500" />
                <KpiCard label="Coste total materiales" value={`${totalCosteMat.toFixed(0)} €`}
                  sub="todos los artículos" icon={Package} color="bg-green-500" />
                <KpiCard label="Instalaciones atendidas" value={totalInstMat}
                  sub="con material registrado" icon={Wrench} color="bg-violet-500" />
              </div>

              {/* Gráfico evolución temporal */}
              {crmChartData.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <h2 className="font-medium text-slate-900">Evolución de instalaciones — {titulo}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Unidades de paneles e inversores registradas por período</p>
                  </div>
                  <div className="p-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={crmChartData} barSize={12}>
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Paneles" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Inversores" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                        {crmChartData.some(d => d.Otros > 0) && (
                          <Bar dataKey="Otros" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Tabla: ranking por modelo/artículo */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <BarChart2 size={16} className="text-slate-400" />
                  <h2 className="font-medium text-slate-900">Ranking por modelo / artículo</h2>
                  <span className="ml-auto text-xs text-slate-400">{crmPorModelo.length} modelos distintos</span>
                </div>
                <table className="w-full text-xs min-w-[700px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Categoría', 'Modelo', 'Referencia', 'Uds. instaladas', 'Instalaciones', 'Coste total'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {crmPorModelo.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${CATEGORIA_COLORS[r.categoria] ?? 'bg-slate-100 text-slate-600'}`}>
                            {r.categoria}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-900">{r.nombre}</td>
                        <td className="px-3 py-2.5 text-slate-400 font-mono text-[11px]">{r.referencia || '—'}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-900">
                          {Math.round(r.cantidad * 1000) / 1000}
                          <div className="mt-0.5 h-1 bg-slate-100 rounded-full overflow-hidden w-24">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, (r.cantidad / (crmPorModelo[0]?.cantidad || 1)) * 100)}%` }} />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{r.instalaciones || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-700 font-medium">{r.coste > 0 ? `${r.coste.toFixed(2)} €` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                    <tr>
                      <td colSpan={3} className="px-3 py-2.5 text-slate-700">TOTAL</td>
                      <td className="px-3 py-2.5">{Math.round(crmPorModelo.reduce((s, r) => s + r.cantidad, 0) * 100) / 100}</td>
                      <td className="px-3 py-2.5">—</td>
                      <td className="px-3 py-2.5">{totalCosteMat.toFixed(2)} €</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Dos columnas: Por técnico | Por instalación */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {/* Por técnico */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Users size={16} className="text-slate-400" />
                    <h2 className="font-medium text-slate-900">Materiales por técnico</h2>
                  </div>
                  {crmPorTecnico.length === 0
                    ? <p className="px-5 py-6 text-xs text-slate-400 text-center">Sin datos</p>
                    : (
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            {['Técnico', 'Paneles', 'Inversores', 'Otros', 'Coste'].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {crmPorTecnico.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-2.5 font-medium text-slate-900">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                                    <span className="text-brand text-[9px] font-bold">{r.nombre[0]}</span>
                                  </div>
                                  {r.nombre}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-amber-600 font-medium">{Math.round(r.paneles * 10) / 10 || '—'}</td>
                              <td className="px-3 py-2.5 text-blue-600 font-medium">{Math.round(r.inversores * 10) / 10 || '—'}</td>
                              <td className="px-3 py-2.5 text-slate-500">{Math.round(r.otros * 10) / 10 || '—'}</td>
                              <td className="px-3 py-2.5 text-slate-700">{r.coste > 0 ? `${r.coste.toFixed(0)} €` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                </div>

                {/* Por instalación (top) */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Wrench size={16} className="text-slate-400" />
                    <h2 className="font-medium text-slate-900">Top instalaciones por coste material</h2>
                    <span className="ml-auto text-xs text-slate-400">máx. 15</span>
                  </div>
                  {crmPorInstalacion.length === 0
                    ? <p className="px-5 py-6 text-xs text-slate-400 text-center">Sin datos</p>
                    : (
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            {['Instalación', 'Paneles', 'Inversores', 'Coste'].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {crmPorInstalacion.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-2.5">
                                <p className="font-medium text-slate-900 truncate max-w-[140px]">{r.nombre}</p>
                                <p className="text-slate-400 truncate max-w-[140px]">{r.cliente}</p>
                              </td>
                              <td className="px-3 py-2.5 text-amber-600 font-medium">{Math.round(r.paneles * 10) / 10 || '—'}</td>
                              <td className="px-3 py-2.5 text-blue-600 font-medium">{Math.round(r.inversores * 10) / 10 || '—'}</td>
                              <td className="px-3 py-2.5 font-semibold text-slate-900">{r.coste > 0 ? `${r.coste.toFixed(2)} €` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

