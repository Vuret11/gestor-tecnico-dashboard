import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { visitas as api, instalaciones as instApi, users as usersApi, fotos as fotosApi, checklists as checklistsApi } from '../api/endpoints';
import { Plus, Wrench, Zap, Search, ChevronUp, ChevronDown, ChevronsUpDown, X, Paperclip, FileText, ImageIcon, Trash2, Pencil, AlertTriangle, Plane } from 'lucide-react';
import Badge from '../components/ui/Badge';
import type { TipoVisita, EstadoVisita, Visita } from '../types';

const TIPO_LABELS: Record<TipoVisita, string> = {
  visita_tecnica_fv: 'V.T. Fotovoltaica',
  visita_tecnica_aerotermia: 'V.T. Rite',
  instalacion_nueva_fv: 'Inst. Nueva FV',
  instalacion_nueva_aerotermia: 'Inst. Nueva Rite',
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

// ─── Modal programar / editar visita ─────────────────────────────────────────
function Modal({ onClose, editing }: { onClose: () => void; editing?: Visita }) {
  const qc = useQueryClient();
  const { data: insts = [] } = useQuery({ queryKey: ['instalaciones'], queryFn: instApi.list });
  const { data: users = [] } = useQuery({ queryKey: ['usuarios'], queryFn: usersApi.list });
  const tecnicos = users.filter(u => u.rol === 'tecnico' && u.activo);

  const [form, setForm] = useState({
    instalacion_id: editing?.instalacion_id ?? '',
    tecnico_id: editing?.tecnico_id ?? '',
    fechaProgramada: editing?.fechaProgramada
      ? new Date(editing.fechaProgramada).toISOString().slice(0, 16)
      : '',
    tipo: (editing?.tipo ?? 'visita_tecnica_fv') as TipoVisita,
    notas: editing?.notas ?? '',
    modalidad: editing?.modalidad ?? '',
    viaja: editing?.viaja ?? false,
    plantillaId: '',
  });
  const [busqInst, setBusqInst] = useState('');
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [saveError, setSaveError] = useState('');
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

  const formData = () => {
    const { plantillaId: _, ...rest } = form;
    const d: any = { ...rest };
    if (!d.modalidad) delete d.modalidad;
    if (!d.viaja) delete d.viaja;
    return d;
  };

  const save = useMutation({
    mutationFn: () => editing
      ? api.update(editing.id, formData())
      : api.create(formData()),
    onError: (err: any) => {
      setSaveError(err?.response?.data?.message ?? err?.message ?? 'Error al guardar');
    },
    onSuccess: async (visita) => {
      setSaveError('');
      if (!editing && form.plantillaId) {
        try { await checklistsApi.asignar(visita.id, form.plantillaId); } catch { /* non-fatal */ }
      }
      if (!editing && adjuntos.length > 0) {
        setUploading(true);
        try {
          await Promise.all(adjuntos.map(f => fotosApi.upload(visita.id, f)));
        } catch {
          setUploadError('Visita guardada, pero algún adjunto no se subió correctamente.');
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
  const tipoInst = instSel?.tipoInstalacion ?? null;

  const { data: plantillasFiltradas = [] } = useQuery({
    queryKey: ['plantillas-by-tipo', tipoInst ?? 'all'],
    queryFn: () => tipoInst ? checklistsApi.plantillasByTipo(tipoInst) : checklistsApi.plantillas(),
  });

  const busy = save.isPending || uploading;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
          <h2 className="font-semibold text-slate-900">{editing ? 'Editar visita' : 'Programar visita'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
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

          {/* Nueva / Reforma — solo para Rite (aerotermia) */}
          {form.tipo === 'visita_tecnica_aerotermia' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nueva o Reforma</label>
              <div className="flex gap-2">
                {(['nueva', 'reforma'] as const).map(m => (
                  <button key={m} type="button"
                    onClick={() => setForm(f => ({ ...f, modalidad: f.modalidad === m ? '' : m }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors capitalize ${
                      form.modalidad === m
                        ? 'bg-cyan-600 text-white border-cyan-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                    }`}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Instalación */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Instalación</label>
            <div className="relative mb-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={busqInst} onChange={e => setBusqInst(e.target.value)}
                placeholder="Buscar instalación o cliente..."
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <select value={form.instalacion_id} onChange={e => setForm(f => ({ ...f, instalacion_id: e.target.value, plantillaId: '' }))} size={4}
              className="w-full border border-slate-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">— Seleccionar —</option>
              {instsFiltradas.map(i => (
                <option key={i.id} value={i.id}>{i.nombre} · {i.cliente}</option>
              ))}
            </select>
            {instSel && <p className="text-xs text-brand mt-1">✓ {instSel.nombre} — {instSel.ciudad}</p>}
          </div>

          {/* Plantilla de checklist — solo al crear */}
          {!editing && plantillasFiltradas.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Plantilla de checklist
                {tipoInst && (
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${
                    tipoInst === 'fv' ? 'bg-yellow-100 text-yellow-700' :
                    tipoInst === 'rite' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {tipoInst === 'fv' ? 'FV' : tipoInst === 'rite' ? 'RITE' : 'Otro'}
                  </span>
                )}
              </label>
              <select
                value={form.plantillaId}
                onChange={e => setForm(f => ({ ...f, plantillaId: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="">— Sin checklist —</option>
                {plantillasFiltradas.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {p.tipoInstalacion ? ` · ${p.tipoInstalacion.toUpperCase()}` : ' · genérico'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Técnico */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Técnico</label>
            <select value={form.tecnico_id} onChange={set('tecnico_id')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Seleccionar...</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>

          {/* Viaja */}
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.viaja}
              onChange={e => setForm(f => ({ ...f, viaja: e.target.checked }))}
              className="rounded border-slate-300 text-red-500"
            />
            <Plane size={13} className="text-red-500" />
            <span className="text-slate-700">Técnico viaja (desplazamiento)</span>
          </label>

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

        {saveError && (
          <div className="mx-6 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {saveError}
          </div>
        )}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
          <button onClick={() => save.mutate()}
            disabled={busy || !form.instalacion_id || !form.tecnico_id || !form.fechaProgramada}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50">
            {uploading ? `Subiendo ${adjuntos.length} archivo${adjuntos.length > 1 ? 's' : ''}...` : save.isPending ? 'Guardando...' : editing ? 'Guardar cambios' : 'Programar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel lateral: detalle + adjuntos de una visita ─────────────────────────
function VisitaPanel({ visita, onClose, onEdit }: { visita: Visita; onClose: () => void; onEdit: (v: Visita) => void }) {
  const qc = useQueryClient();
  const { data: adjuntos = [], isLoading, refetch } = useQuery({
    queryKey: ['fotos-visita', visita.id],
    queryFn: () => fotosApi.porVisita(visita.id),
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const eliminar = useMutation({
    mutationFn: () => api.cancel(visita.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitas'] });
      qc.invalidateQueries({ queryKey: ['visitas-hoy'] });
      onClose();
    },
  });

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    await Promise.allSettled(Array.from(files).map(f => fotosApi.upload(visita.id, f)));
    await refetch();
    setUploading(false);
  };

  const fotos = adjuntos.filter(a => a.tipo === 'foto');
  const docs  = adjuntos.filter(a => a.tipo === 'documento');

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[440px] bg-white shadow-2xl z-50 flex flex-col">

        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 truncate">{visita.instalacion?.nombre ?? '—'}</p>
              <p className="text-xs text-slate-500">{visita.instalacion?.cliente} · {visita.instalacion?.ciudad}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 flex-shrink-0">
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <TipoBadge tipo={visita.tipo} />
            <Badge value={visita.estado} />
          </div>
          {/* Acciones */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onEdit(visita)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:bg-brand-dark"
            >
              <Pencil size={12} /> Editar
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
            >
              <Trash2 size={12} /> Eliminar
            </button>
          </div>

          {/* Confirmación eliminar */}
          {confirmDelete && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                <p className="text-xs font-medium text-red-700">¿Eliminar esta visita?</p>
              </div>
              <p className="text-xs text-red-600 mb-3">Esta acción no se puede deshacer.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => eliminar.mutate()}
                  disabled={eliminar.isPending}
                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {eliminar.isPending ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 text-xs border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detalles */}
        <div className="px-5 py-3 border-b border-slate-100 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-slate-400 mb-0.5">Técnico</p>
            <p className="font-medium text-slate-700">{visita.tecnico?.nombre ?? '—'}</p>
          </div>
          <div>
            <p className="text-slate-400 mb-0.5">Fecha programada</p>
            <p className="font-medium text-slate-700">
              {new Date(visita.fechaProgramada).toLocaleString('es-ES', {
                day: '2-digit', month: '2-digit', year: '2-digit',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
          {visita.modalidad && (
            <div>
              <p className="text-slate-400 mb-0.5">Modalidad</p>
              <p className="font-medium text-slate-700 capitalize">{visita.modalidad}</p>
            </div>
          )}
          {visita.notas && (
            <div className="col-span-2">
              <p className="text-slate-400 mb-0.5">Notas</p>
              <p className="text-slate-700">{visita.notas}</p>
            </div>
          )}
        </div>

        {/* Adjuntos */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Adjuntos {adjuntos.length > 0 && `(${adjuntos.length})`}
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand-dark disabled:opacity-50"
            >
              <Paperclip size={12} />
              {uploading ? 'Subiendo...' : 'Añadir'}
            </button>
            <input ref={fileRef} type="file" multiple accept="image/*,.pdf"
              className="hidden" onChange={e => uploadFiles(e.target.files)} />
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-400">Cargando...</p>
          ) : adjuntos.length === 0 ? (
            <div className="text-center py-8">
              <Paperclip size={28} className="mx-auto text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">Sin adjuntos</p>
              <button onClick={() => fileRef.current?.click()}
                className="mt-2 text-xs text-brand hover:underline">
                Añadir documentación
              </button>
            </div>
          ) : (
            <>
              {/* Fotos */}
              {fotos.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">
                    <ImageIcon size={11} className="inline mr-1" />Fotos ({fotos.length})
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {fotos.map(f => (
                      <a key={f.id} href={f.url} target="_blank" rel="noreferrer"
                        className="aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-brand transition-colors">
                        <img src={f.url} alt={f.nombre ?? 'foto'}
                          className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Documentos PDF */}
              {docs.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">
                    <FileText size={11} className="inline mr-1" />Documentos ({docs.length})
                  </p>
                  <ul className="space-y-1.5">
                    {docs.map(d => (
                      <li key={d.id}>
                        <a href={d.url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors group">
                          <FileText size={15} className="text-red-500 flex-shrink-0" />
                          <span className="text-xs text-slate-700 truncate flex-1">
                            {d.nombre ?? 'Documento'}
                          </span>
                          <span className="text-[10px] text-brand opacity-0 group-hover:opacity-100 flex-shrink-0">
                            Abrir →
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </>
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
  const [selected, setSelected] = useState<Visita | null>(null);
  const [editing, setEditing] = useState<Visita | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-abrir panel si viene ?id=xxx desde planificación
  useEffect(() => {
    const id = searchParams.get('id');
    if (!id || data.length === 0) return;
    const visita = data.find(v => v.id === id);
    if (visita) {
      setSelected(visita);
      setSearchParams({}, { replace: true });
    }
  }, [data, searchParams]);

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
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtradas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                      No hay visitas que coincidan con los filtros
                    </td>
                  </tr>
                )}
                {filtradas.map(v => (
                  <tr key={v.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => setSelected(v)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{v.instalacion?.nombre ?? '—'}</p>
                      <p className="text-xs text-slate-400">{v.instalacion?.cliente}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <TipoBadge tipo={v.tipo} />
                        {v.modalidad && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700 uppercase tracking-wide">
                            {v.modalidad}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{v.tecnico?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {new Date(v.fechaProgramada).toLocaleString('es-ES', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3"><Badge value={v.estado} /></td>
                    <td className="px-4 py-3 text-slate-300">
                      <ChevronDown size={14} className="-rotate-90" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {open && <Modal onClose={() => setOpen(false)} />}
      {editing && <Modal editing={editing} onClose={() => setEditing(null)} />}
      {selected && (
        <VisitaPanel
          visita={selected}
          onClose={() => setSelected(null)}
          onEdit={(v) => { setEditing(v); setSelected(null); }}
        />
      )}
    </div>
  );
}
