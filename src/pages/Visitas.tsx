import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { visitas as api, instalaciones as instApi, users as usersApi, fotos as fotosApi } from '../api/endpoints';
import { Plus, Wrench, Zap, Search, ChevronUp, ChevronDown, ChevronsUpDown, X, Paperclip, FileText, ImageIcon, Trash2 } from 'lucide-react';
import Badge from '../components/ui/Badge';
import type { TipoVisita, EstadoVisita, Visita } from '../types';

const TIPO_LABELS: Record<TipoVisita, string> = {
  visita_tecnica_fv: 'V.T. Fotovoltaica',
  visita_tecnica_aerotermia: 'V.T. Aerotermia',
  instalacion_nueva_fv: 'Inst. Nueva FV',
  instalacion_nueva_aerotermia: 'Inst. Nueva Aerotermia',
};

const TIPO_STYLES: Record<TipoVisita, string> = {
  visita_tecnica_fv: 'bg-blue-50 text-blue-700 border border-blue-200',
  visita_tecnica_aerotermia: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  instalacion_nueva_fv: 'bg-amber-50 text-amber-700 border border-amber-200',
  instalacion_nueva_aerotermia: 'bg-orange-50 text-orange-700 border border-orange-200',
};

const TIPO_ICON: Record<TipoVisita, React.ReactNode> = {
  visita_tecnica_fv: <Wrench size={10} />,
  visita_tecnica_aerotermia: <Wrench size={10} />,
  instalacion_nueva_fv: <Zap size={10} />,
  instalacion_nueva_aerotermia: <Zap size={10} />,
};

function TipoBadge({ tipo }: { tipo?: TipoVisita }) {
  const t = tipo ?? 'visita_tecnica_fv';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${TIPO_STYLES[t]}`}>
      {TIPO_ICON[t]}
      {TIPO_LABELS[t]}
    </span>
  );
}

// ─── Modal programar visita ───────────────────────────────────────────────────
function Modal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: insts = [] } = useQuery({ queryKey: ['instalaciones'], queryFn: instApi.list });
  const { data: users = [] } = useQuery({ queryKey: ['usuarios'], queryFn: usersApi.list });
  const tecnicos = users.filter(u => u.rol === 'tecnico' && u.activo);

  const [form, setForm] = useState({
    instalacion_id: '',
    tecnico_id: '',
    fechaProgramada: '',
    tipo: 'visita_tecnica_fv' as TipoVisita,
    notas: '',
  });
  const [busqInst, setBusqInst] = useState('');
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const instsFiltradas = insts.filter(i =>
    i.nombre.toLowerCase().includes(busqInst.toLowerCase()) ||
    i.cliente.toLowerCase().includes(busqInst.toLowerCase())
  );

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setAdjuntos(prev => [
      ...prev,
      ...Array.from(files).filter(f =>
        !prev.some(p => p.name === f.name && p.size === f.size)
      ),
    ]);
  };

  const save = useMutation({
    mutationFn: () => api.create(form as any),
    onSuccess: async (visita) => {
      if (adjuntos.length > 0) {
        setUploading(true);
        try {
          await Promise.all(adjuntos.map(f => fotosApi.upload(visita.id, f)));
        } catch {
          setUploadError('Visita creada, pero algún adjunto no se subió correctamente.');
          setUploading(false);
          qc.invalidateQueries({ queryKey: ['visitas'] });
          qc.invalidateQueries({ queryKey: ['visitas-hoy'] });
          return;
        }
        setUploading(false);
      }
      qc.invalidateQueries({ queryKey: ['visitas'] });
      qc.invalidateQueries({ queryKey: ['visitas-hoy'] });
      onClose();
    },
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const instSel = insts.find(i => i.id === form.instalacion_id);
  const busy = save.isPending || uploading;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900">Programar visita</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">
          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de visita</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TIPO_LABELS) as TipoVisita[]).map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, tipo: t }))}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    form.tipo === t
                      ? t.startsWith('visita') ? 'bg-brand text-white border-brand' : 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                  }`}>
                  {t.startsWith('visita') ? <Wrench size={14} /> : <Zap size={14} />}
                  {TIPO_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Instalación */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Instalación</label>
            <div className="relative mb-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={busqInst} onChange={e => setBusqInst(e.target.value)}
                placeholder="Buscar instalación o cliente..."
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <select value={form.instalacion_id} onChange={set('instalacion_id')} size={4}
              className="w-full border border-slate-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">— Seleccionar —</option>
              {instsFiltradas.map(i => (
                <option key={i.id} value={i.id}>{i.nombre} · {i.cliente}</option>
              ))}
            </select>
            {instSel && <p className="text-xs text-brand mt-1">✓ {instSel.nombre} — {instSel.ciudad}</p>}
          </div>

          {/* Técnico */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Técnico</label>
            <select value={form.tecnico_id} onChange={set('tecnico_id')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Seleccionar...</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha y hora</label>
            <input type="datetime-local" value={form.fechaProgramada} onChange={set('fechaProgramada')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea value={form.notas} onChange={set('notas')} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>

          {/* Adjuntos */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Documentación adjunta <span className="font-normal text-slate-400">(fotos, PDFs)</span>
            </label>
            <div
              className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center cursor-pointer hover:border-brand/40 hover:bg-slate-50 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            >
              <Paperclip size={18} className="mx-auto text-slate-300 mb-1" />
              <p className="text-xs text-slate-400">Arrastra aquí o <span className="text-brand">selecciona archivos</span></p>
              <p className="text-[10px] text-slate-300 mt-0.5">Imágenes y PDFs</p>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,.pdf,application/pdf"
                className="hidden"
                onChange={e => addFiles(e.target.files)}
              />
            </div>

            {adjuntos.length > 0 && (
              <ul className="mt-2 space-y-1">
                {adjuntos.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg text-xs">
                    {f.type.startsWith('image/') ? (
                      <ImageIcon size={13} className="text-brand flex-shrink-0" />
                    ) : (
                      <FileText size={13} className="text-red-500 flex-shrink-0" />
                    )}
                    <span className="truncate flex-1 text-slate-700">{f.name}</span>
                    <span className="text-slate-400 flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => setAdjuntos(a => a.filter((_, j) => j !== i))}
                      className="text-slate-300 hover:text-red-500 flex-shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {uploadError && (
          <div className="mx-6 mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            {uploadError}
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
          <button onClick={() => save.mutate()}
            disabled={busy || !form.instalacion_id || !form.tecnico_id || !form.fechaProgramada}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50">
            {uploading ? `Subiendo ${adjuntos.length} archivo${adjuntos.length > 1 ? 's' : ''}...` : save.isPending ? 'Guardando...' : 'Programar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cabecera de columna ordenable ───────────────────────────────────────────
type SortKey = 'instalacion' | 'tipo' | 'tecnico' | 'fecha' | 'estado';
type SortDir = 'asc' | 'desc';

function ColHeader({
  label, sortKey, current, dir, onSort,
}: {
  label: string; sortKey: SortKey; current: SortKey | null; dir: SortDir; onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700 group"
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className="text-slate-300 group-hover:text-slate-400">
          {active
            ? dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
            : <ChevronsUpDown size={12} />}
        </span>
      </span>
    </th>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Visitas() {
  const { data = [], isLoading } = useQuery({ queryKey: ['visitas'], queryFn: api.list });
  const [open, setOpen] = useState(false);

  // Búsqueda global
  const [busqueda, setBusqueda] = useState('');

  // Filtros de columna
  const [filtroTipo, setFiltroTipo] = useState<TipoVisita | 'todas'>('todas');
  const [filtroTecnico, setFiltroTecnico] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoVisita | ''>('');

  // Ordenación
  const [sortKey, setSortKey] = useState<SortKey | null>('fecha');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  };

  // Opciones únicas para selectores
  const tecnicosUnicos = useMemo(() =>
    [...new Map(data.map(v => [v.tecnico_id, v.tecnico?.nombre ?? ''])).entries()]
      .filter(([, n]) => n)
      .sort((a, b) => a[1].localeCompare(b[1])),
    [data]);

  const activeFilters = [
    busqueda && `"${busqueda}"`,
    filtroTipo !== 'todas' && TIPO_LABELS[filtroTipo as TipoVisita],
    filtroTecnico && data.find(v => v.tecnico_id === filtroTecnico)?.tecnico?.nombre,
    filtroEstado && filtroEstado.replace('_', ' '),
  ].filter(Boolean);

  const clearAll = () => {
    setBusqueda('');
    setFiltroTipo('todas');
    setFiltroTecnico('');
    setFiltroEstado('');
  };

  const filtradas = useMemo(() => {
    let res = data as Visita[];

    if (busqueda) {
      const q = busqueda.toLowerCase();
      res = res.filter(v =>
        v.instalacion?.nombre?.toLowerCase().includes(q) ||
        v.instalacion?.cliente?.toLowerCase().includes(q) ||
        v.instalacion?.ciudad?.toLowerCase().includes(q) ||
        v.tecnico?.nombre?.toLowerCase().includes(q) ||
        v.notas?.toLowerCase().includes(q)
      );
    }
    if (filtroTipo !== 'todas') res = res.filter(v => v.tipo === filtroTipo);
    if (filtroTecnico) res = res.filter(v => v.tecnico_id === filtroTecnico);
    if (filtroEstado) res = res.filter(v => v.estado === filtroEstado);

    if (sortKey) {
      res = [...res].sort((a, b) => {
        let va = '', vb = '';
        if (sortKey === 'instalacion') { va = a.instalacion?.nombre ?? ''; vb = b.instalacion?.nombre ?? ''; }
        if (sortKey === 'tipo') { va = a.tipo ?? ''; vb = b.tipo ?? ''; }
        if (sortKey === 'tecnico') { va = a.tecnico?.nombre ?? ''; vb = b.tecnico?.nombre ?? ''; }
        if (sortKey === 'fecha') { va = a.fechaProgramada; vb = b.fechaProgramada; }
        if (sortKey === 'estado') { va = a.estado; vb = b.estado; }
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return res;
  }, [data, busqueda, filtroTipo, filtroTecnico, filtroEstado, sortKey, sortDir]);

  return (
    <div className="p-6">
      {/* Cabecera */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Visitas</h1>
          <p className="text-sm text-slate-500">
            {filtradas.length} de {data.length} visitas
          </p>
        </div>
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-dark">
          <Plus size={16} /> Programar visita
        </button>
      </div>

      {/* Barra de búsqueda + filtros de columna */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
        {/* Buscador global */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por instalación, cliente, ciudad, técnico o notas…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-slate-50"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filtros de columna */}
        <div className="flex flex-wrap gap-2">
          {/* Tipo */}
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value as any)}
            className={`px-3 py-1.5 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand ${
              filtroTipo !== 'todas' ? 'border-brand/40 bg-brand-muted text-brand' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            <option value="todas">Todos los tipos</option>
            {(Object.keys(TIPO_LABELS) as TipoVisita[]).map(t => (
              <option key={t} value={t}>{TIPO_LABELS[t]}</option>
            ))}
          </select>

          {/* Técnico */}
          <select
            value={filtroTecnico}
            onChange={e => setFiltroTecnico(e.target.value)}
            className={`px-3 py-1.5 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand ${
              filtroTecnico ? 'border-brand/40 bg-brand-muted text-brand' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            <option value="">Todos los técnicos</option>
            {tecnicosUnicos.map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>

          {/* Estado */}
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value as any)}
            className={`px-3 py-1.5 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand ${
              filtroEstado ? 'border-brand/40 bg-brand-muted text-brand' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            <option value="">Todos los estados</option>
            {(['programada', 'en_curso', 'completada', 'cancelada'] as EstadoVisita[]).map(e => (
              <option key={e} value={e}>{e.replace('_', ' ')}</option>
            ))}
          </select>

          {/* Limpiar filtros */}
          {activeFilters.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 px-3 py-1.5 border border-red-200 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
            >
              <X size={11} /> Limpiar filtros
            </button>
          )}
        </div>

        {/* Chips de filtros activos */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.map(f => (
              <span key={f as string} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-muted text-brand rounded-full text-xs">
                {f as string}
              </span>
            ))}
            <span className="text-xs text-slate-400 self-center">{filtradas.length} resultado{filtradas.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {isLoading
        ? <p className="text-sm text-slate-400">Cargando...</p>
        : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <ColHeader label="Instalación" sortKey="instalacion" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <ColHeader label="Tipo" sortKey="tipo" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <ColHeader label="Técnico" sortKey="tecnico" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <ColHeader label="Fecha" sortKey="fecha" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <ColHeader label="Estado" sortKey="estado" current={sortKey} dir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtradas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                      No hay visitas que coincidan con los filtros
                    </td>
                  </tr>
                )}
                {filtradas.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{v.instalacion?.nombre ?? '—'}</p>
                      <p className="text-xs text-slate-400">{v.instalacion?.cliente}</p>
                    </td>
                    <td className="px-4 py-3"><TipoBadge tipo={v.tipo} /></td>
                    <td className="px-4 py-3 text-slate-600">{v.tecnico?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {new Date(v.fechaProgramada).toLocaleString('es-ES', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3"><Badge value={v.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {open && <Modal onClose={() => setOpen(false)} />}
    </div>
  );
}
