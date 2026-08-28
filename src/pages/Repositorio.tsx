import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositorio as api } from '../api/endpoints';
import type { RepoCarpeta, RepoArchivo } from '../types';
import {
  FolderOpen, FolderPlus, Folder, Trash2, Upload, FileText, Image,
  FileArchive, File, Pencil, X, Check, Download,
} from 'lucide-react';

function fileIcon(tipo?: string) {
  if (!tipo) return <File size={16} className="text-slate-400" />;
  if (tipo.startsWith('image/')) return <Image size={16} className="text-blue-500" />;
  if (tipo === 'application/pdf') return <FileText size={16} className="text-red-500" />;
  if (tipo.includes('zip') || tipo.includes('rar')) return <FileArchive size={16} className="text-amber-500" />;
  return <File size={16} className="text-slate-400" />;
}

function formatBytes(n?: number) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Repositorio() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newCarpeta, setNewCarpeta] = useState(false);
  const [nuevaNombre, setNuevaNombre] = useState('');
  const [nuevaDesc, setNuevaDesc] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [confirmDeleteCarpeta, setConfirmDeleteCarpeta] = useState<string | null>(null);
  const [confirmDeleteArchivo, setConfirmDeleteArchivo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: carpetas = [], isLoading: loadCarpetas } = useQuery({
    queryKey: ['repo-carpetas'],
    queryFn: api.carpetas.list,
  });

  const { data: archivos = [], isLoading: loadArchivos } = useQuery({
    queryKey: ['repo-archivos', selectedId],
    queryFn: () => api.archivos.list(selectedId!),
    enabled: !!selectedId,
  });

  const crearCarpeta = useMutation({
    mutationFn: () => api.carpetas.create({ nombre: nuevaNombre.trim(), descripcion: nuevaDesc.trim() || undefined }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['repo-carpetas'] });
      setNewCarpeta(false);
      setNuevaNombre('');
      setNuevaDesc('');
      setSelectedId(c.id);
    },
  });

  const actualizarCarpeta = useMutation({
    mutationFn: ({ id, nombre }: { id: string; nombre: string }) =>
      api.carpetas.update(id, { nombre }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repo-carpetas'] });
      setEditandoId(null);
    },
  });

  const eliminarCarpeta = useMutation({
    mutationFn: (id: string) => api.carpetas.remove(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['repo-carpetas'] });
      if (selectedId === id) setSelectedId(null);
      setConfirmDeleteCarpeta(null);
    },
  });

  const eliminarArchivo = useMutation({
    mutationFn: (id: string) => api.archivos.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repo-archivos', selectedId] });
      setConfirmDeleteArchivo(null);
    },
  });

  async function handleUpload(files: FileList | null) {
    if (!files || !selectedId) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      await api.archivos.upload(selectedId, file).catch(() => {});
    }
    qc.invalidateQueries({ queryKey: ['repo-archivos', selectedId] });
    setUploading(false);
  }

  const selectedCarpeta = (carpetas as RepoCarpeta[]).find(c => c.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">

      {/* Sidebar carpetas */}
      <div className="w-64 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-slate-700">Carpetas</h2>
          <button
            onClick={() => { setNewCarpeta(true); setNuevaNombre(''); setNuevaDesc(''); }}
            className="text-slate-400 hover:text-brand p-1 rounded"
            title="Nueva carpeta"
          >
            <FolderPlus size={16} />
          </button>
        </div>

        {/* Formulario nueva carpeta */}
        {newCarpeta && (
          <div className="px-3 py-2 border-b border-slate-200 bg-white space-y-1.5">
            <input
              autoFocus
              value={nuevaNombre}
              onChange={e => setNuevaNombre(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && nuevaNombre.trim()) crearCarpeta.mutate(); if (e.key === 'Escape') setNewCarpeta(false); }}
              placeholder="Nombre de carpeta"
              className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <input
              value={nuevaDesc}
              onChange={e => setNuevaDesc(e.target.value)}
              placeholder="Descripción (opcional)"
              className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <div className="flex gap-1">
              <button
                onClick={() => crearCarpeta.mutate()}
                disabled={!nuevaNombre.trim() || crearCarpeta.isPending}
                className="flex-1 text-xs bg-brand text-white rounded py-1 hover:bg-brand-dark disabled:opacity-50"
              >
                Crear
              </button>
              <button onClick={() => setNewCarpeta(false)} className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        <div className="overflow-y-auto flex-1 py-1">
          {loadCarpetas && <p className="px-4 py-3 text-xs text-slate-400">Cargando...</p>}
          {!loadCarpetas && carpetas.length === 0 && (
            <p className="px-4 py-6 text-xs text-slate-400 text-center">Sin carpetas.<br />Crea la primera.</p>
          )}
          {(carpetas as RepoCarpeta[]).map(c => (
            <div
              key={c.id}
              onClick={() => { if (editandoId !== c.id) setSelectedId(c.id); }}
              className={`group flex items-center gap-2 px-3 py-2 cursor-pointer text-sm transition-colors ${
                selectedId === c.id ? 'bg-brand/10 text-brand font-medium' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {selectedId === c.id ? <FolderOpen size={15} /> : <Folder size={15} />}

              {editandoId === c.id ? (
                <input
                  autoFocus
                  value={editNombre}
                  onChange={e => setEditNombre(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && editNombre.trim()) actualizarCarpeta.mutate({ id: c.id, nombre: editNombre });
                    if (e.key === 'Escape') setEditandoId(null);
                  }}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 border border-brand rounded px-1 py-0.5 text-xs focus:outline-none"
                />
              ) : (
                <span className="flex-1 truncate">{c.nombre}</span>
              )}

              {editandoId === c.id ? (
                <button onClick={e => { e.stopPropagation(); actualizarCarpeta.mutate({ id: c.id, nombre: editNombre }); }} className="text-green-600 hover:text-green-700">
                  <Check size={13} />
                </button>
              ) : (
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={e => { e.stopPropagation(); setEditandoId(c.id); setEditNombre(c.nombre); }}
                    className="text-slate-400 hover:text-brand p-0.5"
                  ><Pencil size={12} /></button>
                  {confirmDeleteCarpeta === c.id ? (
                    <>
                      <button onClick={e => { e.stopPropagation(); eliminarCarpeta.mutate(c.id); }} className="text-xs text-red-600 hover:text-red-700 font-medium px-1">Sí</button>
                      <button onClick={e => { e.stopPropagation(); setConfirmDeleteCarpeta(null); }} className="text-xs text-slate-400 hover:text-slate-600 px-1">No</button>
                    </>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); setConfirmDeleteCarpeta(c.id); }} className="text-slate-400 hover:text-red-500 p-0.5">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Panel archivos */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <FolderOpen size={48} className="text-slate-200" />
            <p className="text-sm">Selecciona una carpeta para ver sus archivos</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h1 className="text-lg font-semibold text-slate-900">{selectedCarpeta?.nombre}</h1>
                {selectedCarpeta?.descripcion && (
                  <p className="text-sm text-slate-500">{selectedCarpeta.descripcion}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {uploading && <span className="text-xs text-slate-500">Subiendo...</span>}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => handleUpload(e.target.files)}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-dark disabled:opacity-50"
                >
                  <Upload size={15} /> Subir archivo
                </button>
              </div>
            </div>

            {/* Zona drop */}
            <div
              className="flex-1 overflow-y-auto p-6"
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
            >
              {loadArchivos ? (
                <p className="text-sm text-slate-400">Cargando archivos...</p>
              ) : archivos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 gap-2">
                  <Upload size={32} className="text-slate-300" />
                  <p className="text-sm">Sin archivos. Arrastra aquí o usa el botón.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Archivo', 'Tipo', 'Tamaño', 'Subido por', 'Fecha', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(archivos as RepoArchivo[]).map(a => (
                        <tr key={a.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {fileIcon(a.tipo)}
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-slate-900 hover:text-brand truncate max-w-[240px]"
                              >
                                {a.nombre}
                              </a>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{a.tipo?.split('/')[1]?.toUpperCase() ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{formatBytes(a.tamaño)}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{a.subidoPor?.nombre ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(a.createdAt)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <a
                                href={a.url}
                                download={a.nombre}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-400 hover:text-brand p-1"
                                title="Descargar"
                              >
                                <Download size={14} />
                              </a>
                              {confirmDeleteArchivo === a.id ? (
                                <>
                                  <button onClick={() => eliminarArchivo.mutate(a.id)} className="text-xs text-red-600 font-medium px-1">Sí</button>
                                  <button onClick={() => setConfirmDeleteArchivo(null)} className="text-xs text-slate-400 px-1">No</button>
                                </>
                              ) : (
                                <button onClick={() => setConfirmDeleteArchivo(a.id)} className="text-slate-400 hover:text-red-500 p-1">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
