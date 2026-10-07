import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { homologaciones as api, ingenieria as obrasApi } from '../api/endpoints';
import type { Homologacion, ProyectoIngenieria } from '../types';
import { Plus, Pencil, Trash2, ShieldCheck, Ruler, AlertTriangle, X } from 'lucide-react';
import ResultadoHomologacion from './ResultadoHomologacion';

/**
 * HOMOLOGACIONES · segundo apartado de Ingeniería (junto a Obras de ingeniería y Legalizaciones).
 *
 * Una obra se clasifica en una o VARIAS de las cinco instalaciones y cada una tiene su base
 * normativa. El módulo prepara el BORRADOR de los dos informes —cumplimiento normativo y
 * mediciones vs planos— y un técnico del departamento lo revisa y lo firma: hasta entonces el
 * expediente está en «Borrador emitido».
 */
export const TIPOS_HOMOLOGACION: { valor: string; nombre: string; normativa: string; color: string }[] = [
  { valor: 'clima', nombre: 'Clima', normativa: 'RITE (RD 1027/2007) · CTE DB-HE',
    color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { valor: 'fontaneria', nombre: 'Fontanería', normativa: 'CTE DB-HS4 y HS5 · RD 3/2023',
    color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { valor: 'pci', nombre: 'PCI', normativa: 'RIPCI (RD 513/2017) · CTE DB-SI',
    color: 'bg-red-100 text-red-700 border-red-200' },
  { valor: 'teleco', nombre: 'Teleco', normativa: 'ICT (RD 346/2011)',
    color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { valor: 'electricidad', nombre: 'Electricidad', normativa: 'REBT (RD 842/2002) · ITC-BT',
    color: 'bg-amber-100 text-amber-700 border-amber-200' },
];

/** Estados del expediente. «Borrador emitido» es lo que espera la revisión y firma del técnico. */
const ESTADOS_HOMOLOGACION: [string, string, string][] = [
  ['recibida', 'Recibida', 'bg-slate-100 text-slate-600'],
  ['en_revision', 'En revisión', 'bg-amber-100 text-amber-700'],
  ['borrador_emitido', 'Borrador emitido', 'bg-blue-100 text-blue-700'],
  ['con_incidencias', 'Con incidencias', 'bg-red-100 text-red-600'],
  ['revisada', 'Revisada y firmada', 'bg-green-100 text-green-700'],
  ['cerrada', 'Cerrada', 'bg-slate-200 text-slate-700'],
];
const ESTADO_HOM_LABELS: Record<string, string> = Object.fromEntries(
  ESTADOS_HOMOLOGACION.map(([valor, nombre]) => [valor, nombre]),
);
const ESTADO_HOM_COLORS: Record<string, string> = Object.fromEntries(
  ESTADOS_HOMOLOGACION.map(([valor, , color]) => [valor, color]),
);
const ESTADO_HOM_BARRAS: Record<string, string> = {
  recibida: 'bg-slate-400', en_revision: 'bg-amber-400', borrador_emitido: 'bg-blue-500',
  con_incidencias: 'bg-red-500', revisada: 'bg-green-500', cerrada: 'bg-slate-600',
};

const PERSONAL_HOMOLOGACION = ['Alejandro', 'Lorena', 'Miguel', 'Sergio', 'Ariel', 'Gonzalo', 'Salva'];

const COLOR_TIPO: Record<string, string> = Object.fromEntries(
  TIPOS_HOMOLOGACION.map((t) => [t.valor, t.color]),
);
const NOMBRE_TIPO: Record<string, string> = Object.fromEntries(
  TIPOS_HOMOLOGACION.map((t) => [t.valor, t.nombre]),
);
const NORMATIVA_TIPO: Record<string, string> = Object.fromEntries(
  TIPOS_HOMOLOGACION.map((t) => [t.valor, t.normativa]),
);

const CAMPOS_ALTA: Record<string, string> = {
  cliente: '', num_obra: '', partner: '', nif: '', direccion: '', cp: '',
  municipio: '', provincia: '', responsable: '', estado: 'recibida', notas: '', motivo: '',
  n_incumplimientos: '0', n_dudas: '0', n_observaciones: '0', n_no_asociados: '0',
  impacto_favor: '', impacto_contra: '', proyecto_id: '', proyecto_nombre: '',
};

/**
 * Disciplinas del registro de obras → instalaciones de homologación (el MISMO criterio que aplica
 * el servidor). Al elegir la obra se marcan solas las instalaciones que esa obra tiene.
 * (Ventilación y aerotermia van con la térmica; saneamiento, con el agua.)
 */
const DISCIPLINA_A_TIPO: Record<string, string> = {
  climatizacion: 'clima', ventilacion: 'clima', aerotermia: 'clima',
  fontaneria: 'fontaneria', saneamiento: 'fontaneria',
  pci: 'pci', telecom: 'teleco', electricidad: 'electricidad',
};
const tiposDeLaObra = (disciplinas?: string[] | null): string[] => {
  const puestos = new Set<string>();
  for (const d of disciplinas ?? []) {
    const t = DISCIPLINA_A_TIPO[String(d).trim().toLowerCase()];
    if (t) puestos.add(t);
  }
  return TIPOS_HOMOLOGACION.map((t) => t.valor).filter((v) => puestos.has(v));
};

const euros = (n: number | null | undefined) =>
  `${Number(n ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** Barra de reparto (mismo aspecto que las de Obras de ingeniería). */
function BarrasHom({ titulo, datos }: { titulo: string; datos: [string, number, string][] }) {
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

export default function ApartadoHomologaciones() {
  const qc = useQueryClient();
  const { data: obras = [], isLoading } = useQuery({
    queryKey: ['homologaciones'], queryFn: () => api.list(),
  });
  const { data: resumen } = useQuery({
    queryKey: ['homologaciones-resumen'], queryFn: () => api.resumen(),
  });

  const [tipoFiltro, setTipoFiltro] = useState<string>('todas');
  const [estadoFiltro, setEstadoFiltro] = useState<string>('');
  const [obraFiltro, setObraFiltro] = useState<string>('');
  const [busca, setBusca] = useState('');
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState<Homologacion | null>(null);
  const [errorAlta, setErrorAlta] = useState('');
  const [nuevo, setNuevo] = useState<Record<string, string>>({ ...CAMPOS_ALTA });
  const [tiposElegidos, setTiposElegidos] = useState<string[]>([]);
  const [notaNueva, setNotaNueva] = useState('');
  // El trámite se define por su OBRA: se elige de las obras del registro de Ingeniería y de ahí
  // salen el titular, el número de obra, la dirección y las instalaciones que toca revisar.
  const [obraElegida, setObraElegida] = useState<ProyectoIngenieria | null>(null);
  const [buscaObra, setBuscaObra] = useState('');
  const [obraLibre, setObraLibre] = useState(false);
  // Documentación de la obra: los ficheros elegidos antes de guardar (trámite nuevo) y el aviso
  // de que se está subiendo algo. En un trámite que ya existe se suben al momento.
  const [archivosNuevos, setArchivosNuevos] = useState<File[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const { data: obrasRegistro = [] } = useQuery({
    queryKey: ['ingenieria'], queryFn: () => obrasApi.list(),
  });

  /** Obras que encajan con lo que se escribe: por nombre, cliente, número de obra o provincia. */
  const obrasQueEncajan = (buscaObra.trim()
    ? obrasRegistro.filter((o) => `${o.nombre} ${o.cliente} ${o.num_obra ?? ''} ${o.provincia ?? ''}`
      .toLowerCase().includes(buscaObra.trim().toLowerCase()))
    : obrasRegistro
  ).slice(0, 8);

  /**
   * Elegir la obra rellena el trámite: titular, número de obra, dirección, provincia, el
   * responsable (si la obra tiene uno solo) y las instalaciones de sus disciplinas.
   */
  const elegirObra = (o: ProyectoIngenieria) => {
    setObraElegida(o);
    setBuscaObra('');
    setTiposElegidos(tiposDeLaObra(o.disciplinas));
    setNuevo((n) => ({
      ...n,
      proyecto_id: o.id,
      proyecto_nombre: o.nombre,
      cliente: o.cliente ?? '',
      num_obra: o.num_obra ?? '',
      direccion: o.direccion ?? '',
      provincia: o.provincia ?? '',
      responsable: (o.responsables ?? []).length === 1 ? o.responsables![0] : n.responsable,
    }));
  };
  const quitarObra = () => {
    setObraElegida(null);
    setNuevo((n) => ({ ...n, proyecto_id: '', proyecto_nombre: '' }));
  };

  /** Trámites que ya existen de ESA obra con alguna de las instalaciones marcadas (aviso, no bloqueo). */
  const yaHayTramite = obraElegida
    ? obras.filter((h) => h.proyecto_id === obraElegida.id && h.id !== editando?.id
      && (h.instalaciones ?? []).some((t) => tiposElegidos.includes(t)))
    : [];

  // ── Documentación de la obra ────────────────────────────────────────────────────────────────
  /** Sube los ficheros uno a uno (el API los va apuntando en el trámite). */
  const subirArchivos = async (id: string, ficheros: File[]) => {
    for (const f of ficheros) await api.subirArchivo(id, f);
  };
  /**
   * Al elegir archivos: si el trámite ya existe se suben YA; si es nuevo, se quedan apuntados y
   * se suben en cuanto se guarde (no se puede subir a un trámite que todavía no tiene id).
   */
  const elegirArchivos = async (ficheros: FileList | null) => {
    const lista = Array.from(ficheros ?? []);
    if (lista.length === 0) return;
    if (editando) {
      setSubiendo(true);
      try {
        await subirArchivos(editando.id, lista);
        await qc.invalidateQueries({ queryKey: ['homologaciones'] });
        setErrorAlta('');
      } catch (e: any) {
        const mensaje = e?.response?.data?.message ?? e?.message ?? 'Error del servidor';
        setErrorAlta(`No ha subido el archivo: ${Array.isArray(mensaje) ? mensaje.join(' · ') : mensaje}`);
      }
      setSubiendo(false);
    } else {
      setArchivosNuevos((prev) => [...prev, ...lista]);
    }
  };
  const borrarDeLaObra = useMutation({
    mutationFn: (v: { id: string; indice: number }) => api.borrarArchivo(v.id, v.indice),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['homologaciones'] }),
  });
  const kb = (n?: number) => (n == null ? '' : n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} KB`
    : `${(n / (1024 * 1024)).toFixed(1)} MB`);
  const iconoTipo = (t: string) => (t === 'excel' ? '📊' : t === 'pdf' ? '📄' : t === 'dwg' ? '📐' : '📎');

  const refresca = () => {
    qc.invalidateQueries({ queryKey: ['homologaciones'] });
    qc.invalidateQueries({ queryKey: ['homologaciones-resumen'] });
  };

  const limpiarFormulario = () => {
    setNuevo({ ...CAMPOS_ALTA });
    setTiposElegidos([]);
    setNotaNueva('');
    setErrorAlta('');
    setObraElegida(null);
    setBuscaObra('');
    setObraLibre(false);
    setArchivosNuevos([]);
    setSubiendo(false);
  };

  const guardar = useMutation({
    mutationFn: () => {
      // Solo viaja lo que tiene valor: un campo en blanco no se manda.
      const cuerpo: Record<string, unknown> = { instalaciones: tiposElegidos };
      for (const [k, v] of Object.entries(nuevo)) {
        if (String(v ?? '').trim() !== '') cuerpo[k] = String(v).trim();
      }
      for (const num of ['n_incumplimientos', 'n_dudas', 'n_observaciones', 'n_no_asociados']) {
        if (cuerpo[num] !== undefined) cuerpo[num] = Number(cuerpo[num]);
      }
      for (const num of ['impacto_favor', 'impacto_contra']) {
        if (cuerpo[num] !== undefined) cuerpo[num] = Number(cuerpo[num]);
      }
      return editando ? api.update(editando.id, cuerpo) : api.create(cuerpo);
    },
    onSuccess: async (guardado: Homologacion) => {
      // Si se eligieron archivos antes de guardar, se suben ahora que el trámite ya tiene id.
      if (archivosNuevos.length > 0 && guardado?.id) {
        setSubiendo(true);
        try {
          await subirArchivos(guardado.id, archivosNuevos);
        } catch (e: any) {
          const mensaje = e?.response?.data?.message ?? e?.message ?? 'Error del servidor';
          setErrorAlta(`El trámite se guardó, pero un archivo no ha subido: ${
            Array.isArray(mensaje) ? mensaje.join(' · ') : mensaje}`);
          setSubiendo(false);
          refresca();
          return; // no cierra la ventana: así se ve el aviso y se puede reintentar
        }
        setSubiendo(false);
      }
      refresca();
      setFormAbierto(false);
      setEditando(null);
      limpiarFormulario();
    },
    onError: (e: any) => {
      const mensaje = e?.response?.data?.message ?? e?.message ?? 'Error del servidor';
      const codigo = e?.response?.status ? ` (código ${e.response.status})` : '';
      setErrorAlta(`${Array.isArray(mensaje) ? mensaje.join(' · ') : mensaje}${codigo}`);
    },
  });

  const asignar = useMutation({
    mutationFn: (v: { id: string; responsable: string }) =>
      api.update(v.id, { responsable: v.responsable || undefined }),
    onSuccess: refresca,
  });

  const cambiarEstado = useMutation({
    mutationFn: (v: { id: string; estado: string }) => api.update(v.id, { estado: v.estado as any }),
    onSuccess: refresca,
  });

  const finalizar = useMutation({
    mutationFn: (v: { id: string; fin: string | null }) => api.update(v.id, { fecha_fin: v.fin }),
    onSuccess: refresca,
  });

  const borrar = useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: refresca,
  });

  /** Bitácora del expediente: cada nota va en su línea con la fecha delante. */
  const observacionesDe = (h: Homologacion) =>
    (h.observaciones ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const ultimaObservacion = (h: Homologacion) => observacionesDe(h).pop() ?? '';
  const observacion = useMutation({
    mutationFn: (v: { id: string; texto: string }) => api.update(v.id, { observaciones: v.texto }),
    onSuccess: refresca,
  });
  const anadirObservacion = (h: Homologacion, texto: string) => {
    const t = texto.trim();
    if (!t) return;
    const linea = `${new Date().toLocaleDateString('es-ES')} · ${t}`;
    observacion.mutate({ id: h.id, texto: [...observacionesDe(h), linea].join('\n') });
  };
  const quitarObservacion = (h: Homologacion, linea: string) =>
    observacion.mutate({ id: h.id, texto: observacionesDe(h).filter((l) => l !== linea).join('\n') });

  const abrirEdicion = (h: Homologacion) => {
    const campos: Record<string, string> = { ...CAMPOS_ALTA };
    for (const k of Object.keys(CAMPOS_ALTA)) {
      const v = (h as unknown as Record<string, unknown>)[k];
      if (v !== undefined && v !== null) campos[k] = String(v);
    }
    setNuevo(campos);
    setTiposElegidos(h.instalaciones ?? []);
    // La obra del trámite: si la tiene, se recupera del registro; si no, queda en modo «a mano».
    const obra = h.proyecto_id ? obrasRegistro.find((o) => o.id === h.proyecto_id) ?? null : null;
    setObraElegida(obra);
    setObraLibre(!obra);
    setBuscaObra('');
    setErrorAlta('');
    setEditando(h);
    setFormAbierto(true);
  };

  const cerrarFormulario = () => {
    setFormAbierto(false);
    setEditando(null);
    limpiarFormulario();
  };

  const campo = (k: string, etiqueta: string, tipo: 'text' | 'number' = 'text') => (
    <div key={k}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{etiqueta}</label>
      <input value={nuevo[k] ?? ''} type={tipo}
        onChange={(e) => setNuevo((n) => ({ ...n, [k]: e.target.value }))}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
    </div>
  );
  const bloque = (titulo: string, hijos: ReactNode) => (
    <section key={titulo} className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-3">{titulo}</h3>
      {hijos}
    </section>
  );

  const editandoVivo = editando ? (obras.find((o) => o.id === editando.id) ?? editando) : null;

  const porEstado: [string, number, string][] = ESTADOS_HOMOLOGACION
    .map(([valor, nombre]) => [nombre, resumen?.porEstado?.[valor] ?? 0, ESTADO_HOM_BARRAS[valor] ?? 'bg-slate-400'] as [string, number, string])
    .filter(([, n]) => n > 0);
  const porTipo: [string, number, string][] = TIPOS_HOMOLOGACION
    .map((t) => [t.nombre, resumen?.porInstalacion?.[t.valor] ?? 0, 'bg-slate-400'] as [string, number, string])
    .filter(([, n]) => n > 0);
  // Trámites por obra: es lo que deja ver de un golpe qué obras están en el apartado.
  const porObra: [string, number, string][] = Object.entries(resumen?.porObra ?? {})
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([k, n]) => [k, n, k === 'Sin obra vinculada' ? 'bg-amber-400' : 'bg-brand'] as [string, number, string]);

  const visibles = obras.filter((h) => {
    if (tipoFiltro !== 'todas' && !(h.instalaciones ?? []).includes(tipoFiltro)) return false;
    if (estadoFiltro && h.estado !== estadoFiltro) return false;
    if (obraFiltro && h.proyecto_id !== obraFiltro) return false;
    if (!busca) return true;
    const t = `${h.cliente ?? ''} ${h.num_obra ?? ''} ${h.proyecto_nombre ?? ''} ${h.municipio ?? ''} ${h.provincia ?? ''} ${h.partner ?? ''}`;
    return t.toLowerCase().includes(busca.toLowerCase());
  });

  return (
    <>
      {/* Cifras del apartado */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Obras en el apartado</p>
          <p className="text-2xl font-semibold text-slate-900">{resumen?.total ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Pendientes de revisión técnica</p>
          <p className="text-2xl font-semibold text-blue-600">{resumen?.pendientes_revision ?? 0}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">borradores sin firmar</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Incumplimientos detectados</p>
          <p className="text-2xl font-semibold text-red-600">{resumen?.diagnosticos?.incumplimientos ?? 0}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {resumen?.diagnosticos?.dudas ?? 0} dudas · {resumen?.diagnosticos?.observaciones ?? 0} observaciones
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Impacto económico (en contra)</p>
          <p className="text-2xl font-semibold text-red-600">{euros(resumen?.impacto?.contra)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            a favor: {euros(resumen?.impacto?.favor)} · neto: {euros(resumen?.impacto?.neto)}
          </p>
        </div>
      </div>

      {/* Las cinco instalaciones: cada una con su normativa (es el filtro del apartado) */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <button onClick={() => setTipoFiltro('todas')}
          className={`rounded-xl border p-3 text-left transition-colors ${
            tipoFiltro === 'todas' ? 'bg-brand text-white border-brand' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
          <p className="text-sm font-semibold">Todas</p>
          <p className={`text-[10px] ${tipoFiltro === 'todas' ? 'text-white/70' : 'text-slate-400'}`}>
            las instalaciones
          </p>
          <p className="text-lg font-semibold mt-1">{obras.length}</p>
        </button>
        {TIPOS_HOMOLOGACION.map((t) => {
          const n = resumen?.porInstalacion?.[t.valor] ?? 0;
          const activo = tipoFiltro === t.valor;
          return (
            <button key={t.valor} onClick={() => setTipoFiltro(t.valor)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                activo ? 'bg-brand text-white border-brand' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
              <p className="text-sm font-semibold">{t.nombre}</p>
              <p className={`text-[10px] leading-tight ${activo ? 'text-white/70' : 'text-slate-400'}`}>
                {t.normativa}
              </p>
              <p className="text-lg font-semibold mt-1">{n}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BarrasHom titulo="Trámites por estado" datos={porEstado} />
        <BarrasHom titulo="Trámites por instalación" datos={porTipo} />
        <BarrasHom titulo="Trámites por obra" datos={porObra} />
      </div>

      {/* Alta y filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <button onClick={() => { limpiarFormulario(); setEditando(null); setFormAbierto(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark">
          <Plus size={16} /> Nueva obra de homologación
        </button>
        <input value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente, número de obra, municipio o partner..."
          className="flex-1 min-w-[220px] border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Todos los estados</option>
          {ESTADOS_HOMOLOGACION.map(([valor, nombre]) => (
            <option key={valor} value={valor}>{nombre}</option>
          ))}
        </select>
        {/* El trámite es de una obra: se puede mirar solo lo de una obra concreta. */}
        <select value={obraFiltro} onChange={(e) => setObraFiltro(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white max-w-[240px] focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Todas las obras</option>
          {obrasRegistro
            .filter((o) => obras.some((h) => h.proyecto_id === o.id))
            .map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
      </div>

      {isLoading && <p className="text-sm text-slate-400">Cargando obras...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibles.map((h) => (
          <div key={h.id} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-slate-400">
                  {h.num_obra ? `Obra ${h.num_obra} · ` : ''}
                  {(h.archivos ?? []).length > 0
                    ? `📎 ${(h.archivos ?? []).length} archivo${(h.archivos ?? []).length > 1 ? 's' : ''}: ${
                        (h.archivos ?? []).slice(0, 2).map((a) => a.nombre).join(' · ')}${
                        (h.archivos ?? []).length > 2 ? ` +${(h.archivos ?? []).length - 2}` : ''}`
                    : 'Sin documentación subida'}
                </p>
                <p className="font-semibold text-slate-900 truncate">{h.cliente || 'Sin titular'}</p>
                <p className="text-xs text-slate-500 truncate">
                  {[h.municipio, h.provincia].filter(Boolean).join(' · ') || 'Sin ubicación'}
                </p>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                ESTADO_HOM_COLORS[h.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                {ESTADO_HOM_LABELS[h.estado] ?? h.estado}
              </span>
            </div>

            {/* La obra del registro de Ingeniería de la que cuelga el trámite */}
            <p className={`text-[11px] truncate ${h.proyecto_nombre ? 'text-slate-500' : 'text-amber-700'}`}>
              {h.proyecto_nombre
                ? `🏗️ ${h.proyecto_nombre}`
                : '⚠︎ Sin obra vinculada (trámite suelto)'}
            </p>

            {/* Las instalaciones de esta obra, cada una con su normativa */}
            <div className="flex flex-wrap gap-1">
              {(h.instalaciones ?? []).length === 0 && (
                <span className="text-[11px] text-amber-700">Sin instalación clasificada</span>
              )}
              {(h.instalaciones ?? []).map((t) => (
                <span key={t} title={NORMATIVA_TIPO[t] ?? ''}
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                    COLOR_TIPO[t] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  {NOMBRE_TIPO[t] ?? t}
                </span>
              ))}
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <p className="flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-slate-400" />
                {h.n_incumplimientos} incumplimientos · {h.n_dudas} dudas · {h.n_observaciones} observaciones
              </p>
              <p className="flex items-center gap-1.5">
                <Ruler size={13} className="text-slate-400" />
                impacto en contra {euros(h.impacto_contra)} · a favor {euros(h.impacto_favor)}
              </p>
              {h.n_no_asociados > 0 && (
                <p className="flex items-center gap-1.5 text-amber-700">
                  <AlertTriangle size={13} /> {h.n_no_asociados} elementos sin asociar en el plano
                </p>
              )}
              {h.motivo && <p className="text-amber-700 line-clamp-2">⚠︎ {h.motivo}</p>}
            </div>

            <label className="text-[11px] text-slate-500 mt-1">Técnico responsable</label>
            <select value={h.responsable ?? ''}
              onChange={(e) => asignar.mutate({ id: h.id, responsable: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">— Sin asignar —</option>
              {PERSONAL_HOMOLOGACION.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>

            <label className="text-[11px] text-slate-500">Estado del expediente</label>
            <select value={h.estado}
              onChange={(e) => cambiarEstado.mutate({ id: h.id, estado: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              {ESTADOS_HOMOLOGACION.map(([valor, nombre]) => (
                <option key={valor} value={valor}>{nombre}</option>
              ))}
            </select>

            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
              <span>Alta: {h.fecha_inicio ? new Date(h.fecha_inicio).toLocaleDateString('es-ES') : '—'}</span>
              <span>Fin: {h.fecha_fin ? new Date(h.fecha_fin).toLocaleDateString('es-ES') : '—'}</span>
            </div>
            {ultimaObservacion(h) && (
              <p className="text-[11px] text-slate-600 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 line-clamp-2"
                title={observacionesDe(h).join('\n')}>
                📝 {ultimaObservacion(h)}
              </p>
            )}

            <button onClick={() => abrirEdicion(h)}
              className="mt-1 w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5">
              <Pencil size={13} /> Editar expediente
            </button>
            <button
              onClick={() => finalizar.mutate({ id: h.id, fin: h.fecha_fin ? null : new Date().toISOString().slice(0, 10) })}
              disabled={finalizar.isPending}
              className={`mt-1 w-full px-3 py-1.5 text-xs rounded-lg border ${
                h.fecha_fin ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
              {h.fecha_fin ? 'Reabrir expediente' : 'Cerrar expediente'}
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Eliminar la homologación de ${h.cliente || 'esta obra'} (obra ${h.num_obra || 'sin número'})?` +
                  ' No se puede deshacer.')) borrar.mutate(h.id);
              }}
              disabled={borrar.isPending}
              className="mt-1 w-full px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50">
              Eliminar expediente
            </button>
          </div>
        ))}
        {!isLoading && visibles.length === 0 && (
          <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">
            No hay obras de homologación con esos filtros.
          </div>
        )}
      </div>

      {formAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-slate-900">
                  {editando ? 'Editar obra de homologación' : 'Nueva obra de homologación'}
                </h2>
                <p className="text-xs text-slate-500">
                  {editando
                    ? `Corrigiendo el expediente de ${editando.cliente || 'esta obra'}; al guardar se actualiza el mismo`
                    : 'Los datos de la obra y las instalaciones que se van a revisar'}
                </p>
              </div>
              <button onClick={cerrarFormulario} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Lo PRIMERO: de qué obra es el trámite. El resto de los datos salen de la obra. */}
              {bloque('Obra del trámite', (
                <>
                  {obraElegida ? (
                    <div className="border border-brand/40 bg-brand/[0.04] rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Obra elegida</p>
                          <p className="font-semibold text-slate-900 truncate">{obraElegida.nombre}</p>
                          <p className="text-xs text-slate-500">
                            {[obraElegida.cliente, obraElegida.num_obra ? `obra ${obraElegida.num_obra}` : null,
                              obraElegida.provincia].filter(Boolean).join(' · ')}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {(obraElegida.disciplinas ?? []).map((d) => (
                              <span key={d} className="text-[10px] bg-white border border-slate-200 rounded-full px-2 py-0.5 text-slate-600">
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button type="button" onClick={quitarObra}
                          className="text-xs text-slate-500 hover:text-slate-800 shrink-0 inline-flex items-center gap-1">
                          <X size={13} /> Cambiar obra
                        </button>
                      </div>
                    </div>
                  ) : obraLibre ? (
                    <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                      Obra <strong>no registrada</strong>: se escribe a mano. Lo normal es elegirla de la
                      lista, para que el trámite cuelgue de la obra y no se llene el apartado de
                      expedientes sueltos.
                      <button type="button" onClick={() => setObraLibre(false)}
                        className="block mt-1.5 text-brand hover:underline">← Elegirla de la lista</button>
                    </div>
                  ) : (
                    <>
                      <input value={buscaObra} onChange={(e) => setBuscaObra(e.target.value)}
                        placeholder="Escribe el nombre de la obra, el cliente o el número de obra..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                      <div className="mt-2 max-h-52 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                        {obrasQueEncajan.map((o) => (
                          <button key={o.id} type="button" onClick={() => elegirObra(o)}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50">
                            <p className="text-sm text-slate-800 truncate">{o.nombre}</p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {[o.cliente, o.num_obra ? `obra ${o.num_obra}` : null, o.provincia]
                                .filter(Boolean).join(' · ')}
                              {(o.disciplinas ?? []).length > 0
                                ? ` · ${tiposDeLaObra(o.disciplinas).map((t) => NOMBRE_TIPO[t]).join(', ')}`
                                : ' · sin disciplinas'}
                            </p>
                          </button>
                        ))}
                        {obrasQueEncajan.length === 0 && (
                          <p className="px-3 py-3 text-xs text-slate-400">
                            Ninguna obra encaja con eso. Si la obra todavía no está en el registro de
                            Ingeniería, se puede escribir a mano.
                          </p>
                        )}
                      </div>
                      <button type="button" onClick={() => setObraLibre(true)}
                        className="mt-2 text-xs text-slate-500 hover:text-slate-800">
                        La obra no está en la lista (escribirla a mano)
                      </button>
                    </>
                  )}

                  {yaHayTramite.length > 0 && (
                    <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Esta obra ya tiene {yaHayTramite.length === 1 ? 'un trámite' : `${yaHayTramite.length} trámites`} con
                      alguna de estas instalaciones:{' '}
                      {yaHayTramite.map((h) => `${(h.instalaciones ?? []).map((t) => NOMBRE_TIPO[t]).join(' + ')} (${ESTADO_HOM_LABELS[h.estado] ?? h.estado}${h.responsable ? ` · ${h.responsable}` : ''})`).join(' · ')}.
                      Si es para añadir instalaciones, edita ese trámite en vez de crear otro.
                    </div>
                  )}

                  {/* Datos de la obra: se rellenan solos con la obra elegida y se pueden tocar. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    {campo('cliente', 'Titular / promotor *')}
                    {campo('num_obra', 'Número de obra')}
                    {campo('partner', 'Partner')}
                    {campo('nif', 'DNI / CIF')}
                    {campo('direccion', 'Dirección de la obra')}
                    {campo('cp', 'Código postal')}
                    {campo('municipio', 'Municipio')}
                    {campo('provincia', 'Provincia')}
                  </div>
                </>
              ))}

              {bloque('Instalaciones que se revisan (una o varias)', (
                <>
                  <div className="flex flex-wrap gap-2">
                    {TIPOS_HOMOLOGACION.map((t) => {
                      const marcado = tiposElegidos.includes(t.valor);
                      return (
                        <label key={t.valor}
                          className={`flex flex-col text-xs rounded-lg px-3 py-2 border cursor-pointer ${
                            marcado ? 'bg-slate-100 border-brand text-slate-900' : 'bg-white border-slate-300 text-slate-700'}`}>
                          <span className="flex items-center gap-1.5 font-medium">
                            <input type="checkbox" checked={marcado} onChange={(e) => {
                              setTiposElegidos((ts) => e.target.checked
                                ? [...ts, t.valor]
                                : ts.filter((v) => v !== t.valor));
                            }} />
                            {t.nombre}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5 ml-5">{t.normativa}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-3">
                    {obraElegida
                      ? 'Vienen marcadas las que tiene la obra según sus disciplinas; marca o desmarca lo que haga falta. '
                      : 'Marca las que se van a revisar. '}
                    Cada instalación se contrasta con su normativa vigente: clima (RITE y CTE DB-HE),
                    fontanería (CTE DB-HS4 y HS5), PCI (RIPCI y CTE DB-SI), teleco (ICT) y
                    electricidad (REBT y sus ITC-BT). Si un artículo no está en la base normativa,
                    queda como «pendiente de verificar» — no se inventa.
                  </p>
                </>
              ))}

              {bloque('Documentación de la obra (Excel, PDF y DWG/DXF)', (
                <>
                  {/* Zona para arrastrar los ficheros o elegirlos */}
                  <label
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); elegirArchivos(e.dataTransfer.files); }}
                    className="block border-2 border-dashed border-slate-300 rounded-lg px-4 py-6 text-center cursor-pointer hover:border-brand hover:bg-slate-50">
                    <input type="file" multiple className="hidden"
                      accept=".xlsx,.xls,.xlsm,.csv,.pdf,.dwg,.dxf"
                      onChange={(e) => { elegirArchivos(e.target.files); e.target.value = ''; }} />
                    <p className="text-sm text-slate-700 font-medium">
                      {subiendo ? 'Subiendo...' : 'Arrastra aquí los archivos o haz clic para elegirlos'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      📊 Excel del presupuesto y las mediciones · 📄 PDF de planos y memorias ·
                      📐 DWG/DXF de AutoCAD (los DWG se convierten solos antes de analizarlos)
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {editando
                        ? 'Se suben al momento; el trámite queda actualizado.'
                        : 'Se suben al guardar el trámite.'}
                    </p>
                  </label>

                  {/* Lo que ya está subido */}
                  {(editandoVivo?.archivos ?? []).length > 0 && (
                    <ul className="mt-3 border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {(editandoVivo?.archivos ?? []).map((a, i) => (
                        <li key={`${a.nombre}-${i}`} className="flex items-center justify-between gap-2 px-3 py-2">
                          <span className="min-w-0 text-xs text-slate-700 truncate">
                            {iconoTipo(a.tipo)} {a.nombre}
                            <span className="text-slate-400"> · {kb(a.bytes)}{a.subido ? ` · ${a.subido}` : ''}</span>
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            {a.url && (
                              <a href={a.url} target="_blank" rel="noreferrer"
                                className="text-[11px] text-brand hover:underline">Descargar</a>
                            )}
                            <button type="button" title="Quitar este archivo"
                              onClick={() => editandoVivo && borrarDeLaObra.mutate({ id: editandoVivo.id, indice: i })}
                              className="text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Los elegidos antes de guardar (trámite nuevo) */}
                  {archivosNuevos.length > 0 && (
                    <ul className="mt-3 border border-dashed border-slate-300 rounded-lg divide-y divide-slate-100">
                      {archivosNuevos.map((f, i) => (
                        <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 px-3 py-2">
                          <span className="min-w-0 text-xs text-slate-600 truncate">
                            📎 {f.name} <span className="text-slate-400">· {kb(f.size)} · se sube al guardar</span>
                          </span>
                          <button type="button" title="Quitar de la lista"
                            onClick={() => setArchivosNuevos((prev) => prev.filter((_, j) => j !== i))}
                            className="text-slate-400 hover:text-red-600 shrink-0"><X size={13} /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {editandoVivo && (editandoVivo.archivos ?? []).length === 0 && archivosNuevos.length === 0 && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                      Este trámite todavía no tiene documentación: sin el Excel de mediciones y los planos
                      no se pueden comparar las partidas.
                    </p>
                  )}
                </>
              ))}

              <details className="sm:col-span-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                <summary className="text-xs font-medium text-slate-700 cursor-pointer">
                  Resultado de los informes (se puede completar después)
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  {campo('n_incumplimientos', 'Incumplimientos (seguros)', 'number')}
                  {campo('n_dudas', 'Dudas (falta información)', 'number')}
                  {campo('n_observaciones', 'Observaciones (mejoras)', 'number')}
                  {campo('impacto_contra', 'Impacto en contra (€)', 'number')}
                  {campo('impacto_favor', 'Impacto a favor (€)', 'number')}
                  {campo('n_no_asociados', 'Elementos del plano sin asociar', 'number')}
                  <div className="sm:col-span-3">{campo('motivo', 'Motivo / aviso del expediente')}</div>
                </div>
              </details>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Estado del expediente</label>
                <select value={nuevo.estado} onChange={(e) => setNuevo((n) => ({ ...n, estado: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                  {ESTADOS_HOMOLOGACION.map(([valor, nombre]) => (
                    <option key={valor} value={valor}>{nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Técnico responsable</label>
                <select value={nuevo.responsable} onChange={(e) => setNuevo((n) => ({ ...n, responsable: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                  <option value="">— Sin asignar —</option>
                  {PERSONAL_HOMOLOGACION.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">{campo('notas', 'Notas del expediente')}</div>
              <p className="text-[11px] text-slate-400 sm:col-span-2">
                La fecha de alta se pone sola al crear el expediente; la de cierre, al cerrarlo.
              </p>
            </div>

            {editandoVivo && (
              <div className="px-6 pb-2">
                <section className="border-t border-slate-100 pt-4">
                  <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">Observaciones</h3>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Lo que va pasando con el expediente, como la columna del Excel. El programa pone la fecha
                    delante solo.
                  </p>
                  <ul className="space-y-1 mb-2">
                    {observacionesDe(editandoVivo).map((l) => (
                      <li key={l} className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5">
                        <span className="flex-1">{l}</span>
                        <button onClick={() => quitarObservacion(editandoVivo, l)} title="Quitar esta observación"
                          className="text-slate-400 hover:text-red-600 shrink-0"><Trash2 size={12} /></button>
                      </li>
                    ))}
                    {observacionesDe(editandoVivo).length === 0 && (
                      <li className="text-xs text-slate-400">Todavía no hay ninguna observación.</li>
                    )}
                  </ul>
                  <div className="flex gap-2">
                    <input value={notaNueva} onChange={(ev) => setNotaNueva(ev.target.value)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter') { ev.preventDefault(); anadirObservacion(editandoVivo, notaNueva); setNotaNueva(''); }
                      }}
                      placeholder="Ej.: borrador enviado al técnico para revisar"
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                    <button onClick={() => { anadirObservacion(editandoVivo, notaNueva); setNotaNueva(''); }}
                      disabled={!notaNueva.trim() || observacion.isPending}
                      className="px-3 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                      Añadir
                    </button>
                  </div>
                </section>
              </div>
            )}

            {editandoVivo && (
              <div className="px-6 pb-4">
                <ResultadoHomologacion tramite={editandoVivo} />
              </div>
            )}

            <div className="px-6 py-4 border-t border-slate-200 sm:flex sm:items-center sm:justify-between sm:gap-4">
              {errorAlta ? (
                <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 sm:mb-0 sm:max-w-md">
                  No se ha podido {editando ? 'guardar' : 'crear'} el expediente: {errorAlta}
                </p>
              ) : !nuevo.cliente ? (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 sm:mb-0">
                  Escribe <strong>el titular o promotor</strong> para poder guardar.
                </p>
              ) : tiposElegidos.length === 0 ? (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 sm:mb-0">
                  Puedes guardarlo, pero marca <strong>al menos una instalación</strong>: sin eso la obra no
                  entra en ningún grupo del apartado.
                </p>
              ) : (
                <p className="text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3 sm:mb-0">
                  Se guardará como «{ESTADO_HOM_LABELS[nuevo.estado] ?? nuevo.estado}».
                </p>
              )}
              <div className="flex justify-end gap-3 shrink-0">
                <button onClick={cerrarFormulario} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
                <button onClick={() => { setErrorAlta(''); guardar.mutate(); }}
                  disabled={guardar.isPending || !nuevo.cliente}
                  className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50">
                  {guardar.isPending
                    ? (editando ? 'Guardando...' : 'Creando...')
                    : (editando ? 'Guardar cambios' : 'Crear expediente')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
