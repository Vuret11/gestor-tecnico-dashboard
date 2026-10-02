import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ingenieria as api, tareas as tareasApi, legalizaciones as legApi, maquinasApi } from '../api/endpoints';
import type { ProyectoIngenieria, TipoProyecto, EstadoProyecto, Tarea, Legalizacion } from '../types';
import { Plus, Search, X, Pencil, Zap, Wrench, CalendarDays, Euro, Cpu, Check, Trash2 } from 'lucide-react';

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

// ── Apartados de Ingeniería: POR DISCIPLINA (como el informe de obras) ────────
// El vocabulario es el del registro de obras: climatizacion, fontaneria, ventilacion,
// saneamiento, electricidad, telecom, pci, solar, aerotermia, legalizacion.
type Categoria =
  | 'todas' | 'climatizacion' | 'fontaneria' | 'ventilacion' | 'saneamiento'
  | 'electricidad' | 'telecom' | 'pci' | 'solar' | 'legalizacion';
const CATEGORIA_LABELS: Record<Categoria, string> = {
  todas: 'Todas',
  climatizacion: 'Clima',
  fontaneria: 'Fontanería',
  ventilacion: 'Ventilación',
  saneamiento: 'Saneamiento',
  electricidad: 'Eléctrica',
  telecom: 'Teleco',
  pci: 'PCI',
  solar: 'Solar',
  legalizacion: 'Legalizaciones',
};
const ORDEN_CATEGORIAS: Categoria[] = [
  'todas', 'climatizacion', 'fontaneria', 'ventilacion', 'saneamiento',
  'electricidad', 'telecom', 'pci', 'solar', 'legalizacion',
];
const DISCIPLINA_BARRAS: Record<string, string> = {
  climatizacion: 'bg-blue-500', fontaneria: 'bg-cyan-500', ventilacion: 'bg-teal-500',
  saneamiento: 'bg-emerald-500', electricidad: 'bg-amber-400', telecom: 'bg-orange-400',
  pci: 'bg-red-400', solar: 'bg-yellow-400', aerotermia: 'bg-violet-500',
  legalizacion: 'bg-slate-400',
};

// Personal de Ingeniería: solo estos seis se pueden asignar (dicho por Salva).
const PERSONAL_INGENIERIA = ['Alejandro', 'Lorena', 'Miguel', 'Sergio', 'Ariel', 'Gonzalo', 'Salva'];
// Valores EXACTOS del CRM (normativa/demanda.constants + dbhe4.types)
const PROVINCIAS: [string, string][] = [['A Coruña', 'A Coruna'], ['Albacete', 'Albacete'], ['Alicante/Alacant', 'Alicante'], ['Almería', 'Almeria'], ['Ávila', 'Avila'], ['Badajoz', 'Badajoz'], ['Barcelona', 'Barcelona'], ['Bilbao/Bilbo', 'Bilbao'], ['Burgos', 'Burgos'], ['Cáceres', 'Caceres'], ['Cádiz', 'Cadiz'], ['Castellón/Castelló', 'Castellon'], ['Ceuta', 'Ceuta'], ['Ciudad Real', 'Ciudad Real'], ['Córdoba', 'Cordoba'], ['Cuenca', 'Cuenca'], ['Girona', 'Girona'], ['Granada', 'Granada'], ['Guadalajara', 'Guadalajara'], ['Huelva', 'Huelva'], ['Huesca', 'Huesca'], ['Jaén', 'Jaen'], ['Las Palmas de Gran Canaria', 'Las Palmas'], ['León', 'Leon'], ['Lleida', 'Lleida'], ['Logroño', 'Logrono'], ['Lugo', 'Lugo'], ['Madrid', 'Madrid'], ['Málaga', 'Malaga'], ['Melilla', 'Melilla'], ['Murcia', 'Murcia'], ['Ourense', 'Ourense'], ['Oviedo', 'Oviedo'], ['Palencia', 'Palencia'], ['Palma de Mallorca', 'Palma de Mallorca'], ['Pamplona/Iruña', 'Pamplona'], ['Pontevedra', 'Pontevedra'], ['Salamanca', 'Salamanca'], ['San Sebastián', 'San Sebastian'], ['Santa Cruz de Tenerife', 'Santa Cruz de Tenerife'], ['Santander', 'Santander'], ['Segovia', 'Segovia'], ['Sevilla', 'Sevilla'], ['Soria', 'Soria'], ['Tarragona', 'Tarragona'], ['Teruel', 'Teruel'], ['Toledo', 'Toledo'], ['Valencia', 'Valencia'], ['Valladolid', 'Valladolid'], ['Vitoria-Gasteiz', 'Vitoria Gasteiz'], ['Zamora', 'Zamora'], ['Zaragoza', 'Zaragoza']];
// tipo de emisor (TipoEmisor)
const EMISORES: [string, string][] = [['SUELO_RADIANTE', 'Suelo radiante'], ['RADIADORES', 'Radiadores'],
  ['FAN_COIL', 'Fan-coils'], ['CONDUCTOS', 'Conductos'], ['EXPANSION_DIRECTA', 'Expansión directa'], ['OTROS', 'Otros']];
// tipo de edificio (TipoEdificio)
const TIPOS_EDIFICIO: [string, string][] = [['VIVIENDA_UNIFAMILIAR', 'Vivienda unifamiliar'],
  ['VIVIENDA_PLURIFAMILIAR', 'Vivienda plurifamiliar'], ['NO_RESIDENCIAL', 'No residencial']];
// clasificación del RSIF (arts. 6 y 7 del RD 552/2019)
const CLASIF_EMPLAZAMIENTO: [string, string][] = [['tipo1', 'Tipo 1'], ['tipo2', 'Tipo 2'],
  ['tipo3', 'Tipo 3'], ['tipo4', 'Tipo 4']];
const CLASIF_LOCAL: [string, string][] = [['a', 'A · acceso general'], ['b', 'B · acceso supervisado'],
  ['c', 'C · acceso autorizado']];
const SALA_MAQUINAS: [string, string][] = [['especifica', 'Sala específica'],
  ['sinsalademaquinas', 'Sin sala de máquinas'], ['alairelibre', 'Al aire libre']];
const DISCIPLINA_LABELS: Record<string, string> = {
  climatizacion: 'Clima', fontaneria: 'Fontanería', ventilacion: 'Ventilación',
  saneamiento: 'Saneamiento', electricidad: 'Eléctrica', telecom: 'Teleco',
  pci: 'PCI', solar: 'Solar', aerotermia: 'Aerotermia', legalizacion: 'Legalización',
};

// Reparto por disciplina del informe de obras: Miguel y Sergio llevan eléctrica,
// teleco y FV; Alejandro el resto (PCI, clima, ventilación, fontanería, saneamiento).
// Ariel lleva las legalizaciones. Lorena y Salva van sin reparto automático.
const INGENIERO_POR_DISCIPLINA: Record<string, string[]> = {
  electricidad: ['Miguel', 'Sergio'],
  telecom: ['Miguel', 'Sergio'],
  solar: ['Miguel', 'Sergio'],
  climatizacion: ['Alejandro'],
  fontaneria: ['Alejandro'],
  ventilacion: ['Alejandro'],
  saneamiento: ['Alejandro'],
  pci: ['Alejandro'],
  aerotermia: ['Alejandro'],
  legalizacion: ['Ariel'],
};

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ onClose, editing }: { onClose: () => void; editing?: ProyectoIngenieria }) {
  const qc = useQueryClient();

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
  const [oficios, setOficios] = useState<string[]>(editing?.disciplinas ?? []);
  const toggleOficio = (c: string) =>
    setOficios(o => o.includes(c) ? o.filter(x => x !== c) : [...o, c]);

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
      d.disciplinas = oficios;
      if (!oficios.length) delete d.disciplinas;
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
          <h2 className="font-semibold text-slate-900">{editing ? 'Editar obra' : 'Nueva obra'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre de la obra *</label>
              <input value={form.nombre} onChange={set('nombre')} placeholder="Ej: 9 Viviendas Pasaje del Sur"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cliente *</label>
              <input value={form.cliente} onChange={set('cliente')} placeholder="Nombre del cliente"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Oficios que hacemos en esta obra</label>
            <div className="flex flex-wrap gap-2">
              {ORDEN_CATEGORIAS.filter(c => c !== 'todas').map(c => {
                const puesto = oficios.includes(c);
                return (
                  <button key={c} type="button" onClick={() => toggleOficio(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border ${puesto ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    {CATEGORIA_LABELS[c]}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Con esto la obra aparece en los apartados de esas disciplinas y en el reparto de trabajo.
            </p>
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
function ProyectoCard({ p, onEdit, onOpen }: {
  p: ProyectoIngenieria;
  onEdit: (p: ProyectoIngenieria) => void;
  onOpen?: (p: ProyectoIngenieria) => void;
}) {
  return (
    <div onClick={() => onOpen?.(p)}
      className={`bg-white rounded-xl border border-slate-200 p-5 transition-all hover:border-brand hover:shadow-sm ${onOpen ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{p.nombre}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{p.cliente}</p>
        </div>
        <button onClick={e => { e.stopPropagation(); onEdit(p); }} className="text-slate-300 hover:text-brand p-1 flex-shrink-0">
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

      {(p.direccion || p.jefe_obra) && (
        <div className="text-xs text-slate-500 space-y-0.5 mb-2">
          {p.direccion && <p className="truncate">📍 {p.direccion}</p>}
          {p.jefe_obra && (
            <p className="truncate">👷 Jefe de obra: {p.jefe_obra}{p.jefe_obra_contacto ? ` · ${p.jefe_obra_contacto}` : ''}</p>
          )}
        </div>
      )}

      {(p.disciplinas ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {(p.disciplinas ?? []).map(d => (
            <span key={d} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
              {DISCIPLINA_LABELS[d as keyof typeof DISCIPLINA_LABELS] ?? d}
            </span>
          ))}
        </div>
      )}

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
        {(p.responsables ?? []).length > 0 && (
          <div className="flex items-center gap-1">
            <Wrench size={11} className="flex-shrink-0" />
            <span className="truncate">{(p.responsables ?? []).join(', ')}</span>
          </div>
        )}
      </div>

      {p.descripcion && (
        <p className="mt-2 text-xs text-slate-400 line-clamp-2">{p.descripcion}</p>
      )}
    </div>
  );
}

// ── Barras del dashboard (como las hojas de resumen del Excel) ──────────────
function Barras({ titulo, datos }: { titulo: string; datos: [string, number, string][] }) {
  const total = datos.reduce((s, [, n]) => s + n, 0);
  const max = Math.max(1, ...datos.map(([, n]) => n));
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{titulo}</p>
        <p className="text-xs text-slate-400">{total} obras</p>
      </div>
      <div className="space-y-2">
        {datos.map(([etiqueta, n, color]) => (
          <div key={etiqueta} className="flex items-center gap-3 text-xs">
            <span className="w-28 flex-shrink-0 text-slate-600 truncate">{etiqueta}</span>
            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={color} style={{ width: `${(n / max) * 100}%`, height: '100%' }} />
            </div>
            <span className="w-8 text-right font-semibold text-slate-700">{n}</span>
          </div>
        ))}
        {datos.length === 0 && <p className="text-xs text-slate-400">Sin datos todavía</p>}
      </div>
    </div>
  );
}

// ── Ficha del proyecto: se entra dentro de la tarjeta ────────────────────────
function DetalleProyecto({ p, onClose, onEdit, disciplinaActual }: {
  p: ProyectoIngenieria; onClose: () => void; onEdit: (p: ProyectoIngenieria) => void;
  disciplinaActual?: string;
}) {
  const qc = useQueryClient();
  const { data: tareasProy = [] } = useQuery({
    queryKey: ['tareas', p.id],
    queryFn: () => tareasApi.list({ proyecto_id: p.id }),
  });
  const [notas, setNotas] = useState(p.notas ?? '');
  const [direccion, setDireccion] = useState(p.direccion ?? '');
  const [jefeObra, setJefeObra] = useState(p.jefe_obra ?? '');
  const [contacto, setContacto] = useState(p.jefe_obra_contacto ?? '');
  const [nuevaTarea, setNuevaTarea] = useState('');
  const [ingenieros, setIngenieros] = useState<string[]>(p.responsables ?? []);
  const [aviso, setAviso] = useState('');

  const guardarNotas = useMutation({
    mutationFn: () => api.update(p.id, {
      notas,
      direccion: direccion || null,
      jefe_obra: jefeObra || null,
      jefe_obra_contacto: contacto || null,
    } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ingenieria'] }); setAviso('Notas guardadas'); },
  });
  const asignarIngenieros = useMutation({
    mutationFn: (n: string[]) => api.update(p.id, { responsables: n }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingenieria'] }),
  });
  const crearTarea = useMutation({
    mutationFn: () => tareasApi.create({
      titulo: nuevaTarea.trim(),
      proyecto_id: p.id,
      ...(disciplinaActual ? { disciplina: disciplinaActual } : {}),
      ...(ingenieros.length ? { responsables: ingenieros } : {}),
    }),
    onSuccess: () => { setNuevaTarea(''); qc.invalidateQueries({ queryKey: ['tareas'] }); },
  });
  const finalizarTarea = useMutation({
    mutationFn: (t: Tarea) => tareasApi.update(t.id, { estado: t.estado === 'hecha' ? 'pendiente' : 'hecha' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tareas'] }),
  });
  const borrarTarea = useMutation({
    mutationFn: (id: string) => tareasApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tareas'] }),
  });
  const filas: [string, string][] = [
    ['Cliente', p.cliente],
    ['Tipo de obra', TIPO_LABELS[p.tipo]],
    ['Estado', ESTADO_LABELS[p.estado]],
    ['Potencia', p.potencia_kwp != null ? `${Number(p.potencia_kwp)} kWp` : '—'],
    ['Presupuesto', p.presupuesto != null ? `${Number(p.presupuesto).toLocaleString('es-ES')} €` : '—'],
    ['Entrega estimada', p.fechaEntregaEstimada ? new Date(p.fechaEntregaEstimada).toLocaleDateString('es-ES') : '—'],
    ['Provincia', p.provincia || '—'],
    ['Ingenieros responsables', (p.responsables ?? []).join(', ') || 'Sin asignar'],
    ['Alta', p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-ES') : '—'],
  ];
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-slate-400">{p.cliente}</p>
            <h2 className="text-lg font-semibold text-slate-900 break-words">{p.nombre}</h2>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${TIPO_COLORS[p.tipo]}`}>
                <Zap size={10} />{TIPO_LABELS[p.tipo]}
              </span>
              <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${ESTADO_COLORS[p.estado]}`}>
                {ESTADO_LABELS[p.estado]}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
          {filas.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2">
              <span className="text-xs text-slate-500">{etiqueta}</span>
              <span className="text-sm text-slate-800 text-right">{valor}</span>
            </div>
          ))}
          {p.descripcion && (
            <div className="sm:col-span-2 pt-3">
              <p className="text-xs text-slate-500 mb-1">Descripción</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{p.descripcion}</p>
            </div>
          )}
          <div className="sm:col-span-2 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Ingeniero responsable</p>
              {aviso && <span className="text-[11px] text-green-600">{aviso}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {PERSONAL_INGENIERIA.map(n => {
                const puesto = ingenieros.includes(n);
                return (
                  <button key={n} type="button"
                    onClick={() => {
                      const nuevo = puesto ? ingenieros.filter(x => x !== n) : [...ingenieros, n];
                      setIngenieros(nuevo);
                      asignarIngenieros.mutate(nuevo);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border ${puesto ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    {n}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Puedes poner a varias personas en la misma obra.</p>
          </div>

          <div className="sm:col-span-2 pt-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Datos de la obra</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <input value={direccion} onChange={e => { setDireccion(e.target.value); setAviso(''); }}
                placeholder="Dirección de la obra"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              <input value={jefeObra} onChange={e => { setJefeObra(e.target.value); setAviso(''); }}
                placeholder="Jefe de obra (nombre)"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              <input value={contacto} onChange={e => { setContacto(e.target.value); setAviso(''); }}
                placeholder="Contacto del jefe de obra (teléfono o correo)"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Notas</p>
            <textarea value={notas} onChange={e => { setNotas(e.target.value); setAviso(''); }} rows={3}
              placeholder="Anotaciones de la obra..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            <div className="flex justify-end mt-2">
              <button onClick={() => guardarNotas.mutate()} disabled={guardarNotas.isPending}
                className="px-3 py-1.5 text-xs bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                {guardarNotas.isPending ? 'Guardando...' : 'Guardar datos'}
              </button>
            </div>
          </div>

          <div className="sm:col-span-2 pt-4 border-t border-slate-200">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tareas</p>
              <span className="text-xs text-slate-400">
                {tareasProy.filter(t => t.estado !== 'hecha').length} abiertas · {tareasProy.filter(t => t.estado === 'hecha').length} hechas
              </span>
            </div>

            <div className="space-y-1.5 mb-3">
              {tareasProy.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/60">
                  <button onClick={() => finalizarTarea.mutate(t)}
                    title={t.estado === 'hecha' ? 'Reabrir' : 'Finalizar'}
                    className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${t.estado === 'hecha' ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-brand'}`}>
                    {t.estado === 'hecha' && <Check size={12} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${t.estado === 'hecha' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{t.titulo}</p>
                    <p className="text-[11px] text-slate-400">
                      {[(t.responsables ?? []).join(', '),
                        t.disciplina ? (DISCIPLINA_LABELS[t.disciplina as keyof typeof DISCIPLINA_LABELS] ?? t.disciplina) : null,
                        t.estado === 'hecha' && t.completada_en ? 'finalizada ' + new Date(t.completada_en).toLocaleDateString('es-ES') : null,
                      ].filter(Boolean).join(' · ') || 'sin asignar'}
                    </p>
                  </div>
                  <button onClick={() => borrarTarea.mutate(t.id)} className="text-slate-300 hover:text-red-500 flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {tareasProy.length === 0 && <p className="text-xs text-slate-400">Todavía no hay tareas en esta obra.</p>}
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
              <input value={nuevaTarea} onChange={e => setNuevaTarea(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && nuevaTarea.trim()) crearTarea.mutate(); }}
                placeholder="Nueva tarea y Enter..."
                className="flex-1 min-w-[170px] border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />

              <button onClick={() => nuevaTarea.trim() && crearTarea.mutate()} disabled={!nuevaTarea.trim() || crearTarea.isPending}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50">
                <Plus size={14} /> Añadir
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Cerrar</button>
          <button onClick={() => { onClose(); onEdit(p); }}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark">
            <Pencil size={14} /> Editar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Apartado Legalizaciones (dentro de Ingeniería) ───────────────────────────
const ESTADO_LEG_LABELS: Record<string, string> = {
  bloqueado: 'Bloqueado', con_avisos: 'Con avisos', listo_presentar: 'Listo para presentar',
  presentado: 'Presentado', inscrito: 'Inscrito',
};
const ESTADO_LEG_COLORS: Record<string, string> = {
  bloqueado: 'bg-red-100 text-red-700',
  con_avisos: 'bg-amber-100 text-amber-700',
  listo_presentar: 'bg-green-100 text-green-700',
  presentado: 'bg-blue-100 text-blue-700',
  inscrito: 'bg-slate-100 text-slate-600',
};
// Tipo de instalación del expediente, según el equipo del que va la legalización.
function tipoInstalacion(e: Legalizacion): 'clima' | 'fotovoltaica' {
  const texto = `${e.maquina ?? ''} ${e.motivo ?? ''}`.toLowerCase();
  return /solar|fotovolt|inversor|placa|panel|string/.test(texto) ? 'fotovoltaica' : 'clima';
}
const TIPO_INST_LABELS: Record<string, string> = { clima: 'Clima', fotovoltaica: 'Fotovoltaica' };

const ESTADO_LEG_BARRAS: Record<string, string> = {
  bloqueado: 'bg-red-400', con_avisos: 'bg-amber-400', listo_presentar: 'bg-green-500',
  presentado: 'bg-blue-500', inscrito: 'bg-slate-400',
};

function ApartadoLegalizaciones() {
  const qc = useQueryClient();
  const { data: exps = [], isLoading } = useQuery({ queryKey: ['legalizaciones'], queryFn: () => legApi.list() });
  const { data: resumen } = useQuery({ queryKey: ['legalizaciones-resumen'], queryFn: () => legApi.resumen() });
  const [filtro, setFiltro] = useState<string>('');
  const [tipoInst, setTipoInst] = useState<'todas' | 'clima' | 'fotovoltaica'>('clima');
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [nuevo, setNuevo] = useState<Record<string, string>>({
    num_obra: '', partner: '', cliente: '', nif: '', direccion: '', cp: '', municipio: '',
    provincia: '', oca: '', maquina: '', potencia: '', responsable: '',
    fecha_inicio: '', fecha_fin: '',
    comunidad: '', superficie: '', tipo_edificio: '', dormitorios: '',
    tipo_emisor: '', clasificacion_emplazamiento: '', clasificacion_local: '', sala_maquinas: '',
  });
  const [marca, setMarca] = useState('');
  const [modeloElegido, setModeloElegido] = useState('');
  const [otraMaquina, setOtraMaquina] = useState(false);
  const { data: fabricantes = [] } = useQuery({
    queryKey: ['maquinas-fabricantes'],
    queryFn: () => maquinasApi.fabricantes(),
  });
  const { data: modelos = [] } = useQuery({
    queryKey: ['maquinas', marca],
    queryFn: () => maquinasApi.listar(marca),
    enabled: !!marca && !otraMaquina,
  });
  // Al elegir modelo se rellenan solos el nombre y la potencia: no se teclean
  const elegirModelo = (id: string) => {
    setModeloElegido(id);
    const m = modelos.find(x => String(x.id) === id);
    if (m) {
      setNuevo(n => ({
        ...n,
        maquina: `${m.fabricante ?? ''} ${m.modelo ?? ''}`.trim(),
        ...(m.potencia_calorifica_kw ? { potencia: String(m.potencia_calorifica_kw) } : {}),
      }));
    }
  };
  const limpiarFormulario = () => {
    setNuevo({ num_obra: '', partner: '', cliente: '', nif: '', direccion: '', cp: '', municipio: '',
      provincia: '', oca: '', maquina: '', potencia: '', responsable: '', fecha_inicio: '', fecha_fin: '',
      comunidad: '', superficie: '', tipo_edificio: '', dormitorios: '',
      tipo_emisor: '', clasificacion_emplazamiento: '', clasificacion_local: '', sala_maquinas: '' });
    setMarca(''); setModeloElegido(''); setOtraMaquina(false);
  };
  const crear = useMutation({
    mutationFn: () => {
      const cuerpo: Record<string, any> = { ...nuevo, hidraulica: false };
      for (const num of ['potencia', 'superficie', 'dormitorios']) {
        if (nuevo[num]) cuerpo[num] = Number(nuevo[num]); else delete cuerpo[num];
      }
      for (const k of ['num_obra', 'partner', 'cliente', 'nif', 'direccion', 'cp', 'municipio', 'provincia',
        'oca', 'maquina', 'responsable', 'fecha_inicio', 'fecha_fin', 'comunidad', 'tipo_edificio',
        'tipo_emisor', 'clasificacion_emplazamiento', 'clasificacion_local', 'sala_maquinas']) {
        if (!cuerpo[k]) delete cuerpo[k];
      }
      return legApi.create(cuerpo as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['legalizaciones'] });
      qc.invalidateQueries({ queryKey: ['legalizaciones-resumen'] });
      setNuevoAbierto(false);
      limpiarFormulario();
    },
  });
  const finalizar = useMutation({
    mutationFn: ({ id, fin }: { id: string; fin: string | null }) => legApi.update(id, { fecha_fin: fin } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['legalizaciones'] });
      qc.invalidateQueries({ queryKey: ['legalizaciones-resumen'] });
    },
  });
  const borrar = useMutation({
    mutationFn: (id: string) => legApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['legalizaciones'] });
      qc.invalidateQueries({ queryKey: ['legalizaciones-resumen'] });
    },
  });
  const [busca, setBusca] = useState('');

  const asignar = useMutation({
    mutationFn: (v: { id: string; responsable: string }) =>
      legApi.update(v.id, { responsable: v.responsable || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['legalizaciones'] });
      qc.invalidateQueries({ queryKey: ['legalizaciones-resumen'] });
    },
  });

  const porEstado = Object.entries(resumen?.porEstado ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => [ESTADO_LEG_LABELS[k] ?? k, n, ESTADO_LEG_BARRAS[k] ?? 'bg-slate-400'] as [string, number, string]);
  const porProvincia = Object.entries(resumen?.porProvincia ?? {})
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([k, n]) => [k, n, 'bg-slate-400'] as [string, number, string]);

  const cuentaTipo = (t: 'clima' | 'fotovoltaica') => exps.filter(e => tipoInstalacion(e) === t).length;

  const visibles = exps.filter(e => {
    if (tipoInst !== 'todas' && tipoInstalacion(e) !== tipoInst) return false;
    if (filtro && e.estado !== filtro) return false;
    if (!busca) return true;
    const t = `${e.cliente ?? ''} ${e.municipio ?? ''} ${e.maquina ?? ''} ${e.motivo ?? ''}`.toLowerCase();
    return t.includes(busca.toLowerCase());
  });

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Expedientes</p>
          <p className="text-2xl font-semibold text-slate-900">{resumen?.total ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Listos para presentar</p>
          <p className="text-2xl font-semibold text-green-600">{resumen?.porEstado?.listo_presentar ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Bloqueados / parados</p>
          <p className="text-2xl font-semibold text-red-600">
            {resumen?.porEstado?.bloqueado ?? 0} / {resumen?.parados ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Documentos listos</p>
          <p className="text-2xl font-semibold text-slate-900">
            {resumen?.documentos?.listos ?? 0}<span className="text-sm text-slate-400"> / {resumen?.documentos?.total ?? 0}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {([['clima', cuentaTipo('clima')], ['fotovoltaica', cuentaTipo('fotovoltaica')], ['todas', exps.length]] as const).map(([k, n]) => (
          <button key={k} onClick={() => setTipoInst(k as 'clima' | 'fotovoltaica' | 'todas')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${tipoInst === k ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {k === 'todas' ? 'Todas las instalaciones' : TIPO_INST_LABELS[k]}
            <span className={`ml-2 text-xs ${tipoInst === k ? 'text-white/70' : 'text-slate-400'}`}>{n}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Barras titulo="Expedientes por estado" datos={porEstado} />
        <Barras titulo="Expedientes por provincia" datos={porProvincia} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <button onClick={() => setNuevoAbierto(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark">
          <Plus size={16} /> Crear Nuevo Trámite
        </button>
        <input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por cliente, municipio, máquina o motivo..."
          className="flex-1 min-w-[220px] border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        <select value={filtro} onChange={e => setFiltro(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Todos los estados</option>
          {Object.keys(ESTADO_LEG_LABELS).map(k => <option key={k} value={k}>{ESTADO_LEG_LABELS[k]}</option>)}
        </select>
      </div>

      {isLoading && <p className="text-sm text-slate-400">Cargando expedientes...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibles.map(e => (
          <div key={e.id} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-slate-400">Expediente {e.id_externo ?? '—'}</p>
                <p className="font-semibold text-slate-900 truncate">{e.cliente || 'Sin cliente'}</p>
                <p className="text-xs text-slate-500 truncate">
                  {[e.municipio, e.provincia].filter(Boolean).join(' · ') || 'Sin ubicación'}
                </p>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${ESTADO_LEG_COLORS[e.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                {ESTADO_LEG_LABELS[e.estado] ?? e.estado}
              </span>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              {e.maquina && <p className="truncate">🔧 {e.maquina}{e.hidraulica ? ' · hidráulica' : ''}</p>}
              <p>📄 {e.n_listo} de {e.n_total} documentos{e.n_bloqueado ? ` · ${e.n_bloqueado} bloqueados` : ''}</p>
              {e.motivo && <p className="text-amber-700 line-clamp-2">⚠︎ {e.motivo}</p>}
              {e.dias != null && <p className="text-slate-400">{e.dias} días en este estado</p>}
            </div>

            <label className="text-[11px] text-slate-500 mt-1">Ingeniero responsable</label>
            <select value={e.responsable ?? ''}
              onChange={ev => asignar.mutate({ id: e.id, responsable: ev.target.value })}
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">— Sin asignar —</option>
              {PERSONAL_INGENIERIA.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
              <span>Inicio: {e.fecha_inicio ? new Date(e.fecha_inicio).toLocaleDateString('es-ES') : '—'}</span>
              <span>Fin: {e.fecha_fin ? new Date(e.fecha_fin).toLocaleDateString('es-ES') : '—'}</span>
              {e.creado_por && <span className="truncate">· {e.creado_por}</span>}
            </div>
            <button
              onClick={() => finalizar.mutate({ id: e.id, fin: e.fecha_fin ? null : new Date().toISOString().slice(0, 10) })}
              disabled={finalizar.isPending}
              className={`mt-1 w-full px-3 py-1.5 text-xs rounded-lg border ${e.fecha_fin ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
              {e.fecha_fin ? 'Reabrir trámite' : 'Finalizar trámite'}
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Eliminar el trámite de ${e.cliente || 'este cliente'} (obra ${e.num_obra || 'sin número'})?` +
                  ' No se puede deshacer.')) borrar.mutate(e.id);
              }}
              disabled={borrar.isPending}
              className="mt-1 w-full px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50">
              Eliminar trámite
            </button>
          </div>
        ))}
        {!isLoading && visibles.length === 0 && (
          <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">
            No hay expedientes con esos filtros.
          </div>
        )}
      </div>
      {nuevoAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-slate-900">Crear Nuevo Trámite</h2>
                <p className="text-xs text-slate-500">Datos mínimos para poder generar la documentación</p>
              </div>
              <button onClick={() => setNuevoAbierto(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([['num_obra', 'Número de obra *'], ['partner', 'Partner'],
                 ['cliente', 'Titular / cliente *'], ['nif', 'NIF del titular'],
                 ['direccion', 'Dirección de la instalación'], ['cp', 'Código postal'],
                 ['municipio', 'Municipio']] as const).map(([k, etiqueta]) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{etiqueta}</label>
                  <input value={nuevo[k] ?? ''} onChange={e => setNuevo(n => ({ ...n, [k]: e.target.value }))}
                    type="text"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Provincia</label>
                <select value={nuevo.provincia ?? ''} onChange={e => setNuevo(n => ({ ...n, provincia: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                  <option value="">— Elegir provincia —</option>
                  {PROVINCIAS.map(([valor]) => <option key={valor} value={valor}>{valor}</option>)}
                </select>
              </div>
              {([
                ['tipo_emisor', 'Emisor', EMISORES],
                ['tipo_edificio', 'Tipo de edificio', TIPOS_EDIFICIO],
                ['clasificacion_emplazamiento', 'Clasificación del emplazamiento (RSIF)', CLASIF_EMPLAZAMIENTO],
                ['clasificacion_local', 'Clasificación del local (RSIF)', CLASIF_LOCAL],
                ['sala_maquinas', 'Sala de máquinas', SALA_MAQUINAS],
              ] as [string, string, [string, string][]][]).map(([k, etiqueta, opciones]) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{etiqueta}</label>
                  <select value={nuevo[k] ?? ''} onChange={e => setNuevo(n => ({ ...n, [k]: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                    <option value="">— Elegir —</option>
                    {opciones.map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {otraMaquina ? 'Marca (a mano)' : 'Marca de la máquina'}
                </label>
                {otraMaquina ? (
                  <input value={marca} onChange={e => setMarca(e.target.value)} placeholder="Marca"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                ) : (
                  <select value={marca} onChange={e => { setMarca(e.target.value); setModeloElegido(''); }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                    <option value="">— Elegir marca —</option>
                    {fabricantes.map(f => (
                      <option key={f.fabricante} value={f.fabricante}>{f.fabricante} ({f.cuantas})</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {otraMaquina ? 'Modelo (a mano)' : 'Modelo'}
                </label>
                {otraMaquina ? (
                  <input value={nuevo.maquina ?? ''} onChange={e => setNuevo(n => ({ ...n, maquina: e.target.value }))}
                    placeholder="Marca y modelo"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                ) : (
                  <select value={modeloElegido} onChange={e => elegirModelo(e.target.value)} disabled={!marca}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand">
                    <option value="">{marca ? '— Elegir modelo —' : '— Elige antes la marca —'}</option>
                    {modelos.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.modelo}{m.potencia_calorifica_kw ? ` · ${m.potencia_calorifica_kw} kW` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-2">
                <input type="checkbox" checked={otraMaquina}
                  onChange={e => { setOtraMaquina(e.target.checked); setMarca(''); setModeloElegido(''); setNuevo(n => ({ ...n, maquina: '' })); }} />
                Máquina que no está en el catálogo (escribirla a mano)
              </label>
              {([['comunidad', 'Comunidad autónoma'], ['oca', 'OCA'],
                 ['superficie', 'Superficie (m²)'], ['dormitorios', 'Dormitorios (1 a 7)'],
                 ['potencia', 'Potencia (kW)']] as const).map(([k, etiqueta]) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{etiqueta}</label>
                  <input value={nuevo[k] ?? ''} onChange={e => setNuevo(n => ({ ...n, [k]: e.target.value }))}
                    type={k === 'potencia' ? 'number' : 'text'}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ingeniero responsable</label>
                <select value={nuevo.responsable} onChange={e => setNuevo(n => ({ ...n, responsable: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                  <option value="">— Sin asignar —</option>
                  {PERSONAL_INGENIERIA.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <p className="text-[11px] text-slate-400 sm:col-span-2">La fecha de inicio se pone sola al crear el trámite; la de fin, al finalizarlo.</p>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setNuevoAbierto(false)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={() => crear.mutate()} disabled={crear.isPending || !nuevo.cliente || !nuevo.num_obra}
                className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50">
                {crear.isPending ? 'Creando...' : 'Crear trámite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

// ── Cuadro de mando del departamento (mismos criterios que el informe en PDF) ──
const ESTADOS_OBRA: [string, string][] = [
  ['presupuestado', '📝 Presupuestado (sin aceptar)'], ['aceptado', '✅ Aceptado (sin empezar)'],
  ['por_empezar', '🟡 Por empezar (adjudicada)'], ['en_ejecucion', '🔨 En ejecución'],
  ['pendiente_legalizacion', '📋 Pendiente de legalización'], ['terminado', '🏁 Terminada (cierre pendiente)'],
  ['cobrado', '💰 Cobrado / cerrado'], ['parado', '⛔ PARADO / bloqueado'],
  ['por_confirmar', '❔ Por confirmar (falta el estado)'],
];
const PROGRESO_ESTADO: Record<string, number> = {
  presupuestado: 0, aceptado: 0, por_empezar: 0, por_confirmar: 0,
  en_ejecucion: 50, pendiente_legalizacion: 90, terminado: 100, cobrado: 100, parado: 50,
};

// Pantalla «Mi departamento» (cuadro de mando del departamento). Todavía no está
// enganchada a la navegación, así que se exporta para no romper el build (tsc -b).
export function ApartadoDepartamento() {
  const { data: obras = [] } = useQuery({ queryKey: ['ingenieria'], queryFn: () => api.list() });
  const { data: tramites = [] } = useQuery({ queryKey: ['legalizaciones'], queryFn: () => legApi.list() });
  const { data: tareas = [] } = useQuery({ queryKey: ['tareas'], queryFn: () => tareasApi.list({}) });

  const porEstado = ESTADOS_OBRA.map(([clave, etiqueta]) => ({
    clave, etiqueta, cuantas: obras.filter((o: any) => o.estado_obra === clave).length,
  })).filter(e => e.cuantas > 0);
  const maxEstado = Math.max(1, ...porEstado.map(e => e.cuantas));

  const porCliente: [string, any[]][] = Object.entries(
    obras.reduce((acc: Record<string, any[]>, o: any) => {
      const k = o.cliente || 'Sin cliente';
      (acc[k] = acc[k] || []).push(o);
      return acc;
    }, {}),
  ).sort((a, b) => b[1].length - a[1].length) as [string, any[]][];
  const maxCliente = Math.max(1, ...porCliente.map(([, l]) => l.length));

  const etiquetaEstado = (clave?: string | null) =>
    (ESTADOS_OBRA.find(([c]) => c === clave) || ['', clave || 'sin estado'])[1];

  const fase = (t: any) => (!t.fecha_inicio ? 'por_iniciar' : (!t.fecha_fin ? 'en_tramite' : 'finalizada'));
  const fases = [
    { clave: 'por_iniciar', etiqueta: 'Por iniciar', color: 'bg-slate-400' },
    { clave: 'en_tramite', etiqueta: 'En trámite', color: 'bg-amber-500' },
    { clave: 'finalizada', etiqueta: 'Finalizadas', color: 'bg-green-500' },
  ].map(f => ({ ...f, cuantos: tramites.filter((t: any) => fase(t) === f.clave).length }));
  const tareasAbiertas = tareas.filter((t: any) => t.estado !== 'hecha').length;
  const avanceMedio = obras.length
    ? Math.round(obras.reduce((a: number, o: any) => a + (o.progreso ?? PROGRESO_ESTADO[o.estado_obra] ?? 0), 0) / obras.length)
    : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {([['Obras', obras.length], ['Trámites', tramites.length], ['Tareas abiertas', tareasAbiertas],
           ['Paradas', obras.filter((o: any) => o.estado_obra === 'parado').length],
           ['Avance medio', avanceMedio + ' %']] as [string, any][]).map(([t, v]) => (
          <div key={t} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">{t}</p>
            <p className="text-2xl font-semibold text-slate-900">{v}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-medium text-slate-800 mb-4">Obras por estado</h3>
        <div className="space-y-2">
          {porEstado.map(e => (
            <div key={e.clave} className="flex items-center gap-3">
              <span className="w-64 text-xs text-slate-600">{e.etiqueta}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-4">
                <div className="bg-brand h-4 rounded-full" style={{ width: `${Math.round((e.cuantas / maxEstado) * 100)}%` }} />
              </div>
              <span className="w-8 text-xs text-slate-500 text-right">{e.cuantas}</span>
            </div>
          ))}
          {!porEstado.length && <p className="text-xs text-slate-400">Sin datos todavía.</p>}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-medium text-slate-800 mb-4">Obras por cliente</h3>
        <div className="space-y-4">
          {porCliente.map(([cliente, lista]) => (
            <div key={cliente}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">{cliente}</span>
                <span className="text-slate-400">{lista.length} obra{lista.length > 1 ? 's' : ''}</span>
              </div>
              <div className="bg-slate-100 rounded-full h-3 mb-2">
                <div className="bg-slate-700 h-3 rounded-full" style={{ width: `${Math.round((lista.length / maxCliente) * 100)}%` }} />
              </div>
              <div className="flex flex-wrap gap-1">
                {lista.map((o: any) => (
                  <span key={o.id} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600"
                    title={etiquetaEstado(o.estado_obra)}>
                    {o.num_obra ? o.num_obra + ' · ' : ''}{o.nombre}{o.estado_obra ? ' · ' + etiquetaEstado(o.estado_obra) : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {!porCliente.length && <p className="text-xs text-slate-400">Sin obras todavía.</p>}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-medium text-slate-800 mb-4">Trámites por fase</h3>
        <div className="grid grid-cols-3 gap-5">
          {fases.map(f => (
            <div key={f.clave}>
              <p className="text-xs text-slate-500 mb-1">{f.etiqueta}</p>
              <p className="text-xl font-semibold text-slate-900 mb-2">{f.cuantos}</p>
              <div className="bg-slate-100 rounded-full h-2">
                <div className={`${f.color} h-2 rounded-full`}
                  style={{ width: `${tramites.length ? Math.round((f.cuantos / tramites.length) * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


export default function Ingenieria() {
  const { data = [], isLoading } = useQuery({ queryKey: ['ingenieria'], queryFn: () => api.list() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProyectoIngenieria | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoProyecto | ''>('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoProyecto | ''>('');
  const [vista, setVista] = useState<'kanban' | 'lista' | 'tarjetas'>('tarjetas');
  const [categoria, setCategoria] = useState<Categoria>('todas');
  const [apartado, setApartado] = useState<'proyectos' | 'legalizaciones'>('proyectos');
  const [detalle, setDetalle] = useState<ProyectoIngenieria | null>(null);

  const proyectos = data as ProyectoIngenieria[];

  const filtrados = useMemo(() => {
    let res = proyectos;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      res = res.filter(p => p.nombre.toLowerCase().includes(q) || p.cliente.toLowerCase().includes(q) || p.provincia?.toLowerCase().includes(q));
    }
    if (filtroTipo) res = res.filter(p => p.tipo === filtroTipo);
    if (filtroEstado) res = res.filter(p => p.estado === filtroEstado);
    if (categoria !== 'todas') res = res.filter(p => (p.disciplinas ?? []).includes(categoria));
    return res;
  }, [proyectos, busqueda, filtroTipo, filtroEstado, categoria]);

  // ── Datos del dashboard (tareas incluidas) ─────────────────────────────────
  const { data: tareas = [] } = useQuery({ queryKey: ['tareas'], queryFn: () => tareasApi.list() });

  const delApartado = useMemo(
    () => categoria === 'todas' ? proyectos : proyectos.filter(p => (p.disciplinas ?? []).includes(categoria)),
    [proyectos, categoria],
  );

  const porDisciplina = useMemo(() => {
    const c: Record<string, number> = {};
    delApartado.forEach(p => (p.disciplinas ?? []).forEach(d => { c[d] = (c[d] ?? 0) + 1; }));
    return Object.keys(c)
      .sort((a, b) => c[b] - c[a])
      .map(d => [DISCIPLINA_LABELS[d] ?? d, c[d], DISCIPLINA_BARRAS[d] ?? 'bg-slate-400'] as [string, number, string]);
  }, [delApartado]);

  // Carga por ingeniero: obras que caen en su reparto (regla del informe)
  const cargaIngeniero = useMemo(() => {
    const c: Record<string, number> = {};
    PERSONAL_INGENIERIA.forEach(n => { c[n] = 0; });
    delApartado.forEach(p => {
      const gente = new Set<string>();
      (p.disciplinas ?? []).forEach(d => (INGENIERO_POR_DISCIPLINA[d] ?? []).forEach(n => gente.add(n)));
      (p.responsables ?? []).forEach(n => gente.add(n));
      gente.forEach(n => { c[n] = (c[n] ?? 0) + 1; });
    });
    return Object.keys(c).map(n => [
      n, c[n], n === 'Miguel' || n === 'Sergio' ? 'bg-amber-400' : 'bg-brand',
    ] as [string, number, string]).sort((a, b) => b[1] - a[1]);
  }, [delApartado]);

  // Tareas abiertas por ingeniero (dato real, de la tabla de tareas)
  const tareasIngeniero = useMemo(() => {
    const c: Record<string, number> = {};
    tareas.filter(t => t.estado !== 'hecha').forEach(t => {
      const gente = (t.responsables ?? []).length ? t.responsables! : ['Sin asignar'];
      gente.forEach(n => { c[n] = (c[n] ?? 0) + 1; });
    });
    return Object.keys(c).sort((a, b) => c[b] - c[a])
      .map(n => [n, c[n], 'bg-violet-500'] as [string, number, string]);
  }, [tareas]);

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
            <button onClick={() => setVista('tarjetas')}
              className={`px-3 py-2 ${vista === 'tarjetas' ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              Tarjetas
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

      {/* Apartados dentro de Ingeniería */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {([['proyectos', 'Obras de ingeniería'], ['legalizaciones', 'Legalizaciones']] as const).map(([k, etiqueta]) => (
          <button key={k} onClick={() => setApartado(k)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${apartado === k ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {etiqueta}
          </button>
        ))}
      </div>

      {apartado === 'legalizaciones' ? (
        <ApartadoLegalizaciones />
      ) : (
        <>
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

      {/* Apartados por disciplina + Legalizaciones */}
      <div className="flex flex-wrap gap-2">
        {ORDEN_CATEGORIAS.map(c => {
          const n = c === 'todas'
            ? proyectos.length
            : proyectos.filter(p => (p.disciplinas ?? []).includes(c)).length;
          const activa = categoria === c;
          return (
            <button key={c} onClick={() => setCategoria(c)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border ${activa ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {CATEGORIA_LABELS[c]}
              <span className={`ml-2 text-xs ${activa ? 'text-white/70' : 'text-slate-400'}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Carga de trabajo: por disciplina, por ingeniero y tareas abiertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Barras titulo="Obras por disciplina" datos={porDisciplina} />
        <Barras titulo="Carga de trabajo por ingeniero" datos={cargaIngeniero} />
        <Barras titulo="Tareas abiertas por ingeniero" datos={tareasIngeniero} />
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
                    <ProyectoCard key={p.id} p={p} onEdit={setEditing} onOpen={setDetalle} />
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
                  <ProyectoCard key={p.id} p={p} onEdit={setEditing} onOpen={setDetalle} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vista Tarjetas: cada obra se abre por dentro */}
      {!isLoading && vista === 'tarjetas' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrados.map(p => (
            <ProyectoCard key={p.id} p={p} onEdit={setEditing} onOpen={setDetalle} />
          ))}
          {filtrados.length === 0 && (
            <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">
              No hay obras en este apartado con los filtros puestos.
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

        </>
      )}

      {detalle && <DetalleProyecto p={detalle} onClose={() => setDetalle(null)} onEdit={setEditing}
        disciplinaActual={categoria === 'todas' ? undefined : categoria} />}
      {open && <Modal onClose={() => setOpen(false)} />}
      {editing && <Modal editing={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
