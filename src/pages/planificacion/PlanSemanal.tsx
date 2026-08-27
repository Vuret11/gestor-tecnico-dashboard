import { useState, useMemo, useRef, Fragment, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { planificacion as api } from '../../api/endpoints';
import type { PlanAsignacion, PlanTecnico, EstadoEspecial } from '../../types';
import { ChevronLeft, ChevronRight, Plus, X, AlertTriangle, Plane } from 'lucide-react';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const ESTADO_ESPECIAL_LABELS: Record<EstadoEspecial, string> = {
  vacaciones: 'Vacaciones', baja: 'Baja', comp_horas: 'Comp. Horas',
  libre: 'Libre', fiesta_nacional: 'Fiesta Nacional', medico: 'Médico',
  sancion: 'Sanción', reconocimiento: 'Reconocimiento', otros: 'Otros',
};

const ESTADO_ESPECIAL_COLOR: Record<EstadoEspecial, string> = {
  vacaciones: 'bg-blue-100 text-blue-700',
  baja: 'bg-red-100 text-red-700',
  comp_horas: 'bg-orange-100 text-orange-700',
  libre: 'bg-slate-100 text-slate-600',
  fiesta_nacional: 'bg-purple-100 text-purple-700',
  medico: 'bg-pink-100 text-pink-700',
  sancion: 'bg-red-200 text-red-800',
  reconocimiento: 'bg-yellow-100 text-yellow-700',
  otros: 'bg-slate-100 text-slate-500',
};

function getWeekStart(d: Date) {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  r.setHours(0, 0, 0, 0);
  return r;
}

function dateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

function AsignacionCell({
  asig, onClick, onDelete, onDragStart,
}: {
  asig: PlanAsignacion;
  onClick: () => void;
  onDelete: () => void;
  onDragStart: () => void;
}) {
  if (asig.estadoEspecial) {
    return (
      <div
        draggable
        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
        className={`rounded-md px-2 py-1.5 text-xs font-medium ${ESTADO_ESPECIAL_COLOR[asig.estadoEspecial]} flex items-center justify-between gap-1 cursor-grab active:cursor-grabbing`}
      >
        <span className="truncate">{ESTADO_ESPECIAL_LABELS[asig.estadoEspecial]}</span>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="flex-shrink-0 opacity-60 hover:opacity-100">
          <X size={10} />
        </button>
      </div>
    );
  }
  const instalacion = asig.obra?.instalacion;
  const lineaPrincipal = instalacion?.nombre ?? asig.obra?.numeroObra ?? '—';
  const lineaSecundaria = instalacion
    ? instalacion.ciudad ?? asig.obra?.nombre
    : asig.obra?.nombre;

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onClick={onClick}
      className={`rounded-md px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing border transition-all group
        ${asig.viaja ? 'bg-red-50 border-red-200 hover:border-red-400' : 'bg-brand/5 border-brand/20 hover:border-brand/50'}`}
    >
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="font-bold text-slate-900 truncate">{lineaPrincipal}</span>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {asig.viaja && <Plane size={9} className="text-red-500" />}
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="opacity-0 group-hover:opacity-60 hover:!opacity-100">
            <X size={10} />
          </button>
        </div>
      </div>
      {lineaSecundaria && <p className="text-slate-600 truncate leading-tight">{lineaSecundaria}</p>}
      {asig.obra?.cliente && (
        <p className="text-slate-400 truncate leading-tight text-[10px]">{asig.obra.cliente.nombre}</p>
      )}
    </div>
  );
}

function AsignacionModal({
  tecnico, fecha, asignacion, onClose,
}: {
  tecnico: PlanTecnico;
  fecha: string;
  asignacion?: PlanAsignacion;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  // obras se usa solo para el reverse-lookup obra_id → instalacion_id al editar
  const { data: obras = [] } = useQuery({ queryKey: ['plan-obras'], queryFn: () => api.obras.list() });
  const { data: instalaciones = [] } = useQuery({ queryKey: ['plan-instalaciones-sistema'], queryFn: () => api.instalacionesSistema.list() });

  const esEdicion = !!asignacion;
  const modoInicial = asignacion?.estadoEspecial ? 'estado' : 'obra';

  const [modo, setModo] = useState<'obra' | 'estado'>(modoInicial);
  // Trackea instalacion_id directamente; el PlanObra se crea automáticamente si no existe
  const [instId, setInstId] = useState(asignacion?.obra?.instalacion_id ?? '');
  const [estadoEspecial, setEstadoEspecial] = useState<EstadoEspecial | ''>(asignacion?.estadoEspecial ?? '');
  const [viaja, setViaja] = useState(asignacion?.viaja ?? false);
  const [observaciones, setObs] = useState(asignacion?.observaciones ?? '');

  // Al editar, si la obra no tiene instalacion_id en el objeto (carga tardía), buscarlo en obras
  useEffect(() => {
    if (esEdicion && !instId && asignacion?.obra_id && obras.length > 0) {
      const obra = obras.find(o => o.id === asignacion.obra_id);
      if (obra?.instalacion_id) setInstId(obra.instalacion_id);
    }
  }, [obras]);

  // Mapa instalacion_id → obra_id ya existente
  const obraByInst = useMemo(() => {
    const m = new Map<string, string>();
    obras.forEach(o => { if (o.instalacion_id) m.set(o.instalacion_id, o.id); });
    return m;
  }, [obras]);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['plan-semana'] });
    qc.invalidateQueries({ queryKey: ['plan-conflictos'] });
    qc.invalidateQueries({ queryKey: ['plan-obras'] });
  };

  // Devuelve el obra_id; si no existe PlanObra para esta instalación, lo crea
  const resolverObraId = async (): Promise<string | undefined> => {
    if (modo !== 'obra' || !instId) return undefined;
    const existing = obraByInst.get(instId);
    if (existing) return existing;
    const inst = instalaciones.find(i => i.id === instId);
    const nueva = await api.obras.create({
      instalacion_id: instId,
      nombre: inst?.nombre ?? '',
      numeroObra: instId.slice(0, 8).toUpperCase(),
      tipoTrabajo: 'otro',
      estado: 'pendiente',
    });
    return nueva.id;
  };

  const crear = useMutation({
    mutationFn: async () => {
      const obraId = await resolverObraId();
      return api.asignaciones.create({
        tecnico_id: tecnico.id,
        fecha,
        obra_id: obraId,
        estadoEspecial: modo === 'estado' ? (estadoEspecial as EstadoEspecial) : null,
        viaja,
        observaciones,
      });
    },
    onSuccess: () => { invalidar(); onClose(); },
  });

  const editar = useMutation({
    mutationFn: async () => {
      const obraId = await resolverObraId();
      return api.asignaciones.update(asignacion!.id, {
        obra_id: obraId,
        estadoEspecial: modo === 'estado' ? (estadoEspecial as EstadoEspecial) : null,
        viaja,
        observaciones,
      });
    },
    onSuccess: () => { invalidar(); onClose(); },
  });

  const mutation = esEdicion ? editar : crear;
  const disabled = mutation.isPending || (modo === 'obra' ? !instId : !estadoEspecial);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-slate-900">{esEdicion ? 'Editar asignación' : 'Nueva asignación'}</h2>
            <p className="text-xs text-slate-500">{tecnico.nombre} · {new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            {(['obra', 'estado'] as const).map(m => (
              <button key={m} onClick={() => setModo(m)}
                className={`flex-1 py-2 capitalize ${modo === m ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {m === 'obra' ? 'Instalación' : 'Estado especial'}
              </button>
            ))}
          </div>

          {modo === 'obra' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Instalación *</label>
                <select value={instId} onChange={e => setInstId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                  <option value="">— Seleccionar instalación —</option>
                  {instalaciones.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.nombre}{i.ciudad ? ` · ${i.ciudad}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Estado *</label>
              <select value={estadoEspecial} onChange={e => setEstadoEspecial(e.target.value as EstadoEspecial)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="">— Seleccionar estado —</option>
                {Object.entries(ESTADO_ESPECIAL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          )}

          {modo === 'obra' && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={viaja} onChange={e => setViaja(e.target.checked)}
                className="rounded border-slate-300 text-red-500" />
              <Plane size={13} className="text-red-500" />
              <span className="text-slate-700">Técnico viaja (desplazamiento)</span>
            </label>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
            <textarea value={observaciones} onChange={e => setObs(e.target.value)} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
          </div>

          {mutation.isError && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {(mutation.error as any)?.response?.data?.message ?? 'Error al guardar'}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={disabled}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50"
          >
            {mutation.isPending ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Asignar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlanSemanal() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(new Date());
  const [provinciaId, setProvinciaId] = useState('');
  const [modal, setModal] = useState<{ tecnico: PlanTecnico; fecha: string; asignacion?: PlanAsignacion } | null>(null);

  // Drag & drop state
  const draggedId = useRef<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null); // `${tecnicoId}_${fecha}`

  const weekStart = useMemo(() => getWeekStart(cursor), [cursor]);
  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }), [weekStart]);

  const desde = dateStr(weekDays[0]);
  const hasta = dateStr(weekDays[6]);

  const { data: provincias = [] } = useQuery({ queryKey: ['plan-provincias'], queryFn: api.provincias.list });
  const { data: tecnicos = [] } = useQuery({
    queryKey: ['plan-tecnicos', provinciaId],
    queryFn: () => api.tecnicos.list(provinciaId || undefined),
  });
  const { data: asignaciones = [], isLoading } = useQuery({
    queryKey: ['plan-semana', desde, hasta, provinciaId],
    queryFn: () => api.asignaciones.semana(desde, hasta, provinciaId || undefined),
  });
  const { data: conflictos = [] } = useQuery({
    queryKey: ['plan-conflictos', desde, hasta],
    queryFn: () => api.asignaciones.conflictos(desde, hasta),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => api.asignaciones.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plan-semana'] });
      qc.invalidateQueries({ queryKey: ['plan-conflictos'] });
    },
  });

  const mover = useMutation({
    mutationFn: ({ id, tecnico_id, fecha }: { id: string; tecnico_id: string; fecha: string }) =>
      api.asignaciones.update(id, { tecnico_id, fecha }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plan-semana'] });
      qc.invalidateQueries({ queryKey: ['plan-conflictos'] });
    },
  });

  // Técnicos agrupados por provincia (orden alfabético, sin-provincia al final)
  const gruposProvincia = useMemo(() => {
    const m = new Map<string, { provincia: typeof tecnicos[0]['provincia']; tecnicos: typeof tecnicos }>();
    tecnicos.forEach(t => {
      const key = t.provincia_id ?? '__sin__';
      if (!m.has(key)) m.set(key, { provincia: t.provincia, tecnicos: [] });
      m.get(key)!.tecnicos.push(t);
    });
    return [...m.values()].sort((a, b) => {
      if (!a.provincia) return 1;
      if (!b.provincia) return -1;
      return a.provincia.nombre.localeCompare(b.provincia.nombre, 'es');
    });
  }, [tecnicos]);

  // Mapa: tecnicoId → fecha → asignaciones
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

  const semanaLabel = `${weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} — ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div className="p-6 space-y-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Planificación semanal</h1>
          <p className="text-sm text-slate-500">{semanaLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={provinciaId} onChange={e => setProvinciaId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">Todas las provincias</option>
            {provincias.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => { const d = new Date(cursor); d.setDate(d.getDate() - 7); setCursor(d); }}
              className="p-2 hover:bg-slate-100 text-slate-600"><ChevronLeft size={16} /></button>
            <button onClick={() => setCursor(new Date())}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">Hoy</button>
            <button onClick={() => { const d = new Date(cursor); d.setDate(d.getDate() + 7); setCursor(d); }}
              className="p-2 hover:bg-slate-100 text-slate-600"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {/* Conflictos */}
      {(conflictos as any[]).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">{(conflictos as any[]).length} conflicto{(conflictos as any[]).length > 1 ? 's' : ''} detectado{(conflictos as any[]).length > 1 ? 's' : ''}</p>
            {(conflictos as any[]).slice(0, 3).map((c: any, i: number) => (
              <p key={i} className="text-xs text-red-600">{c.mensaje}</p>
            ))}
          </div>
        </div>
      )}

      {/* Tabla semanal */}
      {isLoading
        ? <p className="text-sm text-slate-400 py-8 text-center">Cargando...</p>
        : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase w-44 sticky left-0 bg-slate-50 z-10">Técnico</th>
                  {weekDays.map((d, i) => {
                    const esHoy = d.toDateString() === new Date().toDateString();
                    const esFinde = i >= 5;
                    return (
                      <th key={i} className={`px-3 py-3 text-center min-w-[130px] ${esFinde ? 'bg-slate-100/80' : ''}`}>
                        <p className={`text-xs font-semibold uppercase ${esHoy ? 'text-brand' : 'text-slate-500'}`}>{DIAS[i].slice(0, 3)}</p>
                        <p className={`text-sm font-bold mt-0.5 ${esHoy ? 'text-brand' : 'text-slate-700'}`}>{d.getDate()}</p>
                        <p className="text-[10px] text-slate-400">{d.toLocaleDateString('es-ES', { month: 'short' })}</p>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tecnicos.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                      No hay técnicos. Añade técnicos en la sección de Técnicos.
                    </td>
                  </tr>
                )}
                {gruposProvincia.map(({ provincia, tecnicos: ts }) => (
                  <Fragment key={provincia?.id ?? '__sin__'}>
                    {/* Cabecera de provincia */}
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-1.5 sticky left-0"
                        style={{ backgroundColor: provincia?.color ? `${provincia.color}18` : '#f1f5f9' }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: provincia?.color ?? '#94a3b8' }}
                          />
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            {provincia?.nombre ?? 'Sin provincia'}
                          </span>
                          <span className="text-xs text-slate-400 font-normal">({ts.length} técnicos)</span>
                        </div>
                      </td>
                    </tr>
                    {/* Filas de técnicos */}
                    {ts.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/50 group border-t border-slate-100">
                        {/* Técnico */}
                        <td className="px-4 py-2 sticky left-0 bg-white border-r border-slate-100 z-10 group-hover:bg-slate-50/50">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold"
                              style={{ backgroundColor: provincia?.color ?? '#94a3b8' }}
                            >
                              {t.nombre[0]}
                            </div>
                            <p className="text-xs font-semibold text-slate-900 truncate">{t.nombre}</p>
                          </div>
                        </td>
                        {/* Días */}
                        {weekDays.map((d, i) => {
                          const fecha = dateStr(d);
                          const cellKey = `${t.id}_${fecha}`;
                          const celdaAsigs = mapa.get(t.id)?.get(fecha) ?? [];
                          const esFinde = i >= 5;
                          const isDragOver = dragOverKey === cellKey;
                          return (
                            <td
                              key={i}
                              className={`px-2 py-2 align-top transition-colors
                                ${esFinde ? 'bg-slate-50/60' : ''}
                                ${isDragOver ? 'bg-brand/10 outline outline-2 outline-dashed outline-brand/40' : ''}`}
                              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverKey(cellKey); }}
                              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverKey(null); }}
                              onDrop={e => {
                                e.preventDefault();
                                setDragOverKey(null);
                                if (draggedId.current) {
                                  mover.mutate({ id: draggedId.current, tecnico_id: t.id, fecha });
                                  draggedId.current = null;
                                }
                              }}
                            >
                              <div className="space-y-1 min-h-[48px]">
                                {celdaAsigs.map(a => (
                                  <AsignacionCell
                                    key={a.id}
                                    asig={a}
                                    onClick={() => setModal({ tecnico: t, fecha, asignacion: a })}
                                    onDelete={() => eliminar.mutate(a.id)}
                                    onDragStart={() => { draggedId.current = a.id; }}
                                  />
                                ))}
                                <button
                                  onClick={() => setModal({ tecnico: t, fecha })}
                                  className="w-full text-center text-slate-300 hover:text-brand hover:bg-brand/5 rounded-md py-1 text-xs transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <Plus size={12} className="mx-auto" />
                                </button>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <p className="text-xs text-slate-400 text-center">
        Pasa el ratón y pulsa + para añadir · Arrastra una tarjeta para moverla a otro técnico/día
      </p>

      {modal && (
        <AsignacionModal
          tecnico={modal.tecnico}
          fecha={modal.fecha}
          asignacion={modal.asignacion}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
