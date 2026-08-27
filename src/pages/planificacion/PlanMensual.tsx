import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { planificacion as api } from '../../api/endpoints';
import type { PlanAsignacion, EstadoEspecial } from '../../types';
import { ChevronLeft, ChevronRight, Plane } from 'lucide-react';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_CORTO = ['L','M','X','J','V','S','D'];

const ESTADO_COLOR: Record<EstadoEspecial, string> = {
  vacaciones: 'bg-blue-100 text-blue-700',
  baja: 'bg-red-100 text-red-700',
  comp_horas: 'bg-orange-100 text-orange-700',
  libre: 'bg-slate-100 text-slate-500',
  fiesta_nacional: 'bg-purple-100 text-purple-700',
  medico: 'bg-pink-100 text-pink-700',
  sancion: 'bg-red-200 text-red-800',
  reconocimiento: 'bg-yellow-100 text-yellow-700',
  otros: 'bg-slate-100 text-slate-500',
};

const ESTADO_LABEL: Record<EstadoEspecial, string> = {
  vacaciones: 'VAC', baja: 'BAJA', comp_horas: 'CH',
  libre: 'LIB', fiesta_nacional: 'FN', medico: 'MED',
  sancion: 'SAN', reconocimiento: 'REC', otros: '—',
};

function getWeekday(date: Date) { // 0=Mon...6=Sun
  return (date.getDay() + 6) % 7;
}

export default function PlanMensual() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-based
  const [provinciaId, setProvinciaId] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');

  function navPrev() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function navNext() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const { data: provincias = [] } = useQuery({ queryKey: ['plan-provincias'], queryFn: api.provincias.list });
  const { data: tecnicos = [] } = useQuery({
    queryKey: ['plan-tecnicos', provinciaId],
    queryFn: () => api.tecnicos.list(provinciaId || undefined),
  });
  const { data: asignaciones = [], isLoading } = useQuery({
    queryKey: ['plan-mes', year, month, provinciaId],
    queryFn: () => api.asignaciones.mes(year, month, provinciaId || undefined),
  });

  // Días del mes
  const diasMes = useMemo(() => {
    const days: Date[] = [];
    const total = new Date(year, month, 0).getDate();
    for (let d = 1; d <= total; d++) days.push(new Date(year, month - 1, d));
    return days;
  }, [year, month]);

  // Mapa tecnico → fecha → asig[]
  const mapa = useMemo(() => {
    const m = new Map<string, Map<string, PlanAsignacion[]>>();
    asignaciones.forEach(a => {
      if (!m.has(a.tecnico_id)) m.set(a.tecnico_id, new Map());
      const fm = m.get(a.tecnico_id)!;
      if (!fm.has(a.fecha)) fm.set(a.fecha, []);
      fm.get(a.fecha)!.push(a);
    });
    return m;
  }, [asignaciones]);

  const tecnicosFiltrados = tecnicoId ? tecnicos.filter(t => t.id === tecnicoId) : tecnicos;

  const fechaStr = (d: Date) => d.toISOString().split('T')[0];
  const hoy = fechaStr(new Date());

  return (
    <div className="p-6 space-y-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Planificación mensual</h2>
          <p className="text-sm text-slate-500">{MESES[month - 1]} {year} · {diasMes.length} días</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={provinciaId} onChange={e => { setProvinciaId(e.target.value); setTecnicoId(''); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">Todas las provincias</option>
            {provincias.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <select value={tecnicoId} onChange={e => setTecnicoId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">Todos los técnicos</option>
            {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={navPrev} className="p-2 hover:bg-slate-100 text-slate-600"><ChevronLeft size={16} /></button>
            <span className="px-3 text-sm font-semibold text-slate-700">{MESES[month - 1]} {year}</span>
            <button onClick={navNext} className="p-2 hover:bg-slate-100 text-slate-600"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {isLoading
        ? <p className="text-sm text-slate-400 py-8 text-center">Cargando...</p>
        : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="text-xs border-collapse" style={{ minWidth: `${180 + diasMes.length * 38}px` }}>
              <thead>
                {/* Fila días del mes */}
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 sticky left-0 bg-slate-50 z-10 w-44 border-r border-slate-200">
                    Técnico
                  </th>
                  {diasMes.map(d => {
                    const wd = getWeekday(d);
                    const esFinde = wd >= 5;
                    const esHoy = fechaStr(d) === hoy;
                    return (
                      <th key={d.getDate()} className={`w-9 px-0 py-1.5 text-center border-r border-slate-100 ${esFinde ? 'bg-slate-100' : ''} ${esHoy ? 'bg-brand/10' : ''}`}>
                        <div className={`text-[9px] font-medium ${esFinde ? 'text-slate-400' : 'text-slate-500'}`}>{DIAS_CORTO[wd]}</div>
                        <div className={`text-sm font-bold ${esHoy ? 'text-brand' : esFinde ? 'text-slate-400' : 'text-slate-700'}`}>{d.getDate()}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tecnicosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={diasMes.length + 1} className="px-4 py-10 text-center text-slate-400">
                      No hay técnicos
                    </td>
                  </tr>
                )}
                {tecnicosFiltrados.map((t, ti) => (
                  <tr key={t.id} className={ti % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                    {/* Nombre técnico */}
                    <td className={`px-3 py-1.5 sticky left-0 z-10 border-r border-slate-200 ${ti % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-brand text-[9px] font-bold">{t.nombre[0]}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate text-xs">{t.nombre.split(',')[0] || t.nombre}</p>
                          <p className="text-[9px] text-slate-400">{t.provincia?.nombre ?? ''}</p>
                        </div>
                      </div>
                    </td>
                    {/* Celdas por día */}
                    {diasMes.map(d => {
                      const fecha = fechaStr(d);
                      const wd = getWeekday(d);
                      const esFinde = wd >= 5;
                      const asigs = mapa.get(t.id)?.get(fecha) ?? [];
                      const asig = asigs[0];
                      return (
                        <td key={fecha} className={`px-0.5 py-0.5 align-middle text-center border-r border-slate-100 ${esFinde ? 'bg-slate-100/60' : ''}`}>
                          {asig ? (
                            asig.estadoEspecial ? (
                              <span className={`inline-block rounded px-1 py-0.5 text-[9px] font-bold leading-tight ${ESTADO_COLOR[asig.estadoEspecial]}`}>
                                {ESTADO_LABEL[asig.estadoEspecial]}
                              </span>
                            ) : (
                              <div className={`rounded px-1 py-0.5 leading-tight ${asig.viaja ? 'bg-red-50 border border-red-200' : 'bg-brand/5 border border-brand/20'}`}>
                                <div className="flex items-center justify-center gap-0.5">
                                  {asig.viaja && <Plane size={7} className="text-red-400 flex-shrink-0" />}
                                  <span className="text-[9px] font-bold text-slate-800 truncate max-w-[28px]" title={asig.obra?.numeroObra}>
                                    {asig.obra?.numeroObra?.slice(-6) ?? '?'}
                                  </span>
                                </div>
                                <p className="text-[8px] text-slate-500 truncate max-w-[32px]" title={asig.obra?.nombre}>
                                  {asig.obra?.nombre?.slice(0, 8)}
                                </p>
                              </div>
                            )
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-brand/10 border border-brand/20 inline-block" /> Obra asignada</span>
        <span className="flex items-center gap-1"><Plane size={10} className="text-red-400" /> Viaje</span>
        {(['vacaciones','baja','medico','comp_horas'] as EstadoEspecial[]).map(e => (
          <span key={e} className={`px-1.5 py-0.5 rounded font-bold ${ESTADO_COLOR[e]}`}>{ESTADO_LABEL[e]}</span>
        ))}
      </div>
    </div>
  );
}
