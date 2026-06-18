import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { visitas as visitasApi, users as usersApi, instalaciones as instApi } from '../api/endpoints';
import type { Visita, TipoVisita, User } from '../types';
import { ChevronLeft, ChevronRight, Plus, X, AlertTriangle } from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

const DIAS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const TIPO_COLORS: Record<TipoVisita, string> = {
  visita_tecnica_fv: 'bg-blue-50 border-blue-200 text-blue-800',
  visita_tecnica_aerotermia: 'bg-cyan-50 border-cyan-200 text-cyan-800',
  instalacion_nueva_fv: 'bg-amber-50 border-amber-200 text-amber-800',
  instalacion_nueva_aerotermia: 'bg-orange-50 border-orange-200 text-orange-800',
};

const TIPO_LABELS: Record<TipoVisita, string> = {
  visita_tecnica_fv: 'Visita Técnica FV',
  visita_tecnica_aerotermia: 'Visita Técnica Aerotermia',
  instalacion_nueva_fv: 'Instalación Nueva FV',
  instalacion_nueva_aerotermia: 'Instalación Nueva Aerotermia',
};

const ESTADO_DOT: Record<string, string> = {
  programada: 'bg-slate-400',
  en_curso: 'bg-yellow-400',
  completada: 'bg-green-500',
  cancelada: 'bg-red-400',
};

// ── Create modal ──────────────────────────────────────────────────────────────

function NuevaVisitaModal({
  onClose,
  prefill,
  todasVisitas,
}: {
  onClose: () => void;
  prefill?: { tecnico_id?: string; fecha?: Date };
  todasVisitas: Visita[];
}) {
  const qc = useQueryClient();
  const { data: tecnicos = [] } = useQuery({ queryKey: ['usuarios'], queryFn: usersApi.list });
  const { data: insts = [] } = useQuery({ queryKey: ['instalaciones'], queryFn: instApi.list });

  const tecnicosList = tecnicos.filter(u => u.rol === 'tecnico' && u.activo);

  const toDatetimeLocal = (d?: Date) =>
    d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

  const [form, setForm] = useState({
    tecnico_id: prefill?.tecnico_id ?? '',
    instalacion_id: '',
    fechaProgramada: toDatetimeLocal(prefill?.fecha),
    tipo: 'visita_tecnica_fv' as TipoVisita,
    notas: '',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const conflicto = useMemo(() => {
    if (!form.tecnico_id || !form.fechaProgramada) return null;
    const nueva = new Date(form.fechaProgramada);
    return todasVisitas.find(v => {
      if (v.tecnico_id !== form.tecnico_id) return false;
      if (v.estado === 'cancelada') return false;
      const diff = Math.abs(new Date(v.fechaProgramada).getTime() - nueva.getTime());
      return diff < 2 * 60 * 60 * 1000;
    }) ?? null;
  }, [form.tecnico_id, form.fechaProgramada, todasVisitas]);

  const save = useMutation({
    mutationFn: () => visitasApi.create(form as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitas'] });
      qc.invalidateQueries({ queryKey: ['visitas-semana'] });
      onClose();
    },
  });

  const canSubmit = !save.isPending && form.tecnico_id && form.instalacion_id && form.fechaProgramada && !conflicto;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900">Programar visita</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {conflicto && (
            <div className="flex gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                <strong>Conflicto de agenda:</strong> este técnico ya tiene asignada una visita el{' '}
                {new Date(conflicto.fechaProgramada).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}.
                No se puede asignar en la misma franja horaria (±2 horas).
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Técnico</label>
            <select value={form.tecnico_id} onChange={set('tecnico_id')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Seleccionar técnico...</option>
              {tecnicosList.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Instalación</label>
            <select value={form.instalacion_id} onChange={set('instalacion_id')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Seleccionar instalación...</option>
              {insts.map(i => <option key={i.id} value={i.id}>{i.nombre} — {(i as any).ciudad ?? ''}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha y hora</label>
            <input type="datetime-local" value={form.fechaProgramada} onChange={set('fechaProgramada')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
            <select value={form.tipo} onChange={set('tipo')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="visita_tecnica_fv">Visita Técnica FV</option>
              <option value="visita_tecnica_aerotermia">Visita Técnica Aerotermia</option>
              <option value="instalacion_nueva_fv">Instalación Nueva FV</option>
              <option value="instalacion_nueva_aerotermia">Instalación Nueva Aerotermia</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea value={form.notas} onChange={set('notas')} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
          <button
            onClick={() => save.mutate()}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors"
          >
            {save.isPending ? 'Guardando...' : 'Programar visita'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Visit detail tooltip ──────────────────────────────────────────────────────

function VisitaDetalle({ visita, onClose }: { visita: Visita; onClose: () => void }) {
  const tipo = (visita.tipo as TipoVisita) || 'visita_tecnica_fv';
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="font-semibold text-slate-900">{visita.instalacion?.nombre}</p>
            <p className="text-sm text-slate-500">{visita.instalacion?.cliente}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="space-y-1.5 text-sm">
          <p><span className="text-slate-400">Técnico:</span> <span className="text-slate-700">{visita.tecnico?.nombre}</span></p>
          <p><span className="text-slate-400">Fecha:</span> <span className="text-slate-700">
            {new Date(visita.fechaProgramada).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
          </span></p>
          <p><span className="text-slate-400">Tipo:</span> <span className="text-slate-700 capitalize">{tipo.replace(/_/g, ' ')}</span></p>
          <p><span className="text-slate-400">Estado:</span>{' '}
            <span className="capitalize">{visita.estado.replace(/_/g, ' ')}</span>
          </p>
          {visita.notas && <p className="text-slate-500 italic mt-1">{visita.notas}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Visit block ───────────────────────────────────────────────────────────────

function VisitaBlock({ visita, onClick }: { visita: Visita; onClick: () => void }) {
  const tipo = (visita.tipo as TipoVisita) || 'visita_tecnica_fv';
  const colorClass = TIPO_COLORS[tipo];
  const dot = ESTADO_DOT[visita.estado] || 'bg-slate-400';
  const hora = new Date(visita.fechaProgramada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (visita.estado === 'cancelada') return null;
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      className={`w-full text-left text-xs px-2 py-1.5 rounded border ${colorClass} mb-1 hover:opacity-80 transition-opacity`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
        <span className="font-semibold">{hora}</span>
      </div>
      <span className="block truncate leading-tight">{visita.instalacion?.nombre}</span>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Calendario() {
  const [semanaInicio, setSemanaInicio] = useState(() => getMonday(new Date()));
  const [modal, setModal] = useState<{ tecnico_id?: string; fecha?: Date } | null>(null);
  const [detalle, setDetalle] = useState<Visita | null>(null);

  const semanaFin = addDays(semanaInicio, 7);

  const { data: todasVisitas = [] } = useQuery({
    queryKey: ['visitas-semana', semanaInicio.toISOString()],
    queryFn: () => visitasApi.semana(semanaInicio.toISOString(), semanaFin.toISOString()),
  });

  // Also fetch full list for conflict checking (includes visits outside this week)
  const { data: allVisitas = [] } = useQuery({ queryKey: ['visitas'], queryFn: visitasApi.list });

  const { data: tecnicos = [] } = useQuery({ queryKey: ['usuarios'], queryFn: usersApi.list });
  const tecnicosList: User[] = tecnicos.filter(u => u.rol === 'tecnico');

  const dias = Array.from({ length: 7 }, (_, i) => addDays(semanaInicio, i));

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const formatSemana = () => {
    const fin = addDays(semanaInicio, 6);
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${semanaInicio.toLocaleDateString('es-ES', opts)} — ${fin.toLocaleDateString('es-ES', { ...opts, year: 'numeric' })}`;
  };

  const visitasDelDia = (tecnicoId: string, dia: Date) =>
    todasVisitas.filter(v =>
      v.tecnico_id === tecnicoId &&
      v.estado !== 'cancelada' &&
      sameDay(new Date(v.fechaProgramada), dia),
    ).sort((a, b) => new Date(a.fechaProgramada).getTime() - new Date(b.fechaProgramada).getTime());

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Calendario</h1>
          <p className="text-sm text-slate-500">Disponibilidad de técnicos por semana</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg">
            <button
              onClick={() => setSemanaInicio(d => addDays(d, -7))}
              className="p-2 hover:bg-slate-50 rounded-l-lg transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 text-sm font-medium text-slate-700 min-w-[180px] text-center">
              {formatSemana()}
            </span>
            <button
              onClick={() => setSemanaInicio(d => addDays(d, 7))}
              className="p-2 hover:bg-slate-50 rounded-r-lg transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            onClick={() => setSemanaInicio(getMonday(new Date()))}
            className="px-3 py-2 text-sm border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={() => setModal({})}
            className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-dark transition-colors"
          >
            <Plus size={16} /> Nueva visita
          </button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 text-xs text-slate-500">
        {(Object.keys(TIPO_COLORS) as TipoVisita[]).map(tipo => (
          <span key={tipo} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${TIPO_COLORS[tipo]}`}>
            {TIPO_LABELS[tipo]}
          </span>
        ))}
        <span className="ml-2 flex items-center gap-3">
          {Object.entries(ESTADO_DOT).map(([estado, dot]) => (
            <span key={estado} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              <span className="capitalize">{estado.replace('_', ' ')}</span>
            </span>
          ))}
        </span>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full border-collapse min-w-[900px]">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase border-b border-r border-slate-200 w-36">
                Técnico
              </th>
              {dias.map((dia, i) => {
                const esHoy = sameDay(dia, hoy);
                return (
                  <th
                    key={i}
                    className={`px-3 py-3 text-xs font-medium border-b border-slate-200 ${i < 6 ? 'border-r' : ''} ${esHoy ? 'bg-brand-light text-brand' : 'text-slate-500'}`}
                  >
                    <span className="block">{DIAS_ES[i]}</span>
                    <span className={`text-base font-bold ${esHoy ? 'text-brand' : 'text-slate-800'}`}>
                      {dia.getDate()}
                    </span>
                    <span className="block text-[10px] uppercase">
                      {dia.toLocaleDateString('es-ES', { month: 'short' })}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {tecnicosList.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-sm text-slate-400 text-center">
                  No hay técnicos activos
                </td>
              </tr>
            )}
            {tecnicosList.map((tecnico, ti) => (
              <tr key={tecnico.id} className={ti < tecnicosList.length - 1 ? 'border-b border-slate-100' : ''}>
                {/* Técnico */}
                <td className="px-4 py-3 border-r border-slate-200 align-top">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">{tecnico.nombre?.[0]?.toUpperCase()}</span>
                    </div>
                    <span className="text-sm font-medium text-slate-800 truncate">{tecnico.nombre}</span>
                  </div>
                </td>

                {/* Día a día */}
                {dias.map((dia, di) => {
                  const visits = visitasDelDia(tecnico.id, dia);
                  const esHoy = sameDay(dia, hoy);
                  return (
                    <td
                      key={di}
                      onClick={() => setModal({ tecnico_id: tecnico.id, fecha: new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 9, 0) })}
                      className={`px-2 py-2 align-top cursor-pointer transition-colors ${di < 6 ? 'border-r border-slate-100' : ''} ${esHoy ? 'bg-brand-light/30' : 'hover:bg-slate-50'} min-h-[80px]`}
                    >
                      {visits.map(v => (
                        <VisitaBlock
                          key={v.id}
                          visita={v}
                          onClick={() => setDetalle(v)}
                        />
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <NuevaVisitaModal
          onClose={() => setModal(null)}
          prefill={modal}
          todasVisitas={allVisitas}
        />
      )}
      {detalle && <VisitaDetalle visita={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}
