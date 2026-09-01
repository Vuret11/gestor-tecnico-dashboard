import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instalaciones as api, clientes as clientesApi, inventario as inventarioApi, visitas as visitasApi, checklists as checklistsApi } from '../api/endpoints';
import type { Instalacion, Cliente, VisitaArticulo } from '../types';
import { Plus, Pencil, MapPin, Trash2, Search, X, FileText, Upload, Package, ClipboardList } from 'lucide-react';

function Modal({ item, onClose }: { item?: Instalacion; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: partners = [] } = useQuery({ queryKey: ['clientes'], queryFn: clientesApi.list });
  const { data: materiales = [] } = useQuery({
    queryKey: ['instalacion-articulos', item?.id],
    queryFn: () => inventarioApi.instalacion.list(item!.id),
    enabled: !!item,
  });
  const { data: todasVisitas = [] } = useQuery({ queryKey: ['visitas'], queryFn: visitasApi.list, enabled: !!item });
  const atsCount = item ? todasVisitas.filter(v => v.instalacion_id === item.id && v.llevaAts && v.tipo === 'instalacion_nueva_fv').length : 0;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [archivoError, setArchivoError] = useState('');

  const [form, setForm] = useState({
    nombre: item?.nombre ?? '',
    clienteId: item?.clienteId ?? '',
    cliente: item?.cliente ?? '',
    direccion: item?.direccion ?? '',
    ciudad: item?.ciudad ?? '',
    provincia: item?.provincia ?? '',
    telefono: item?.telefono ?? '',
    notas: item?.notas ?? '',
    tipoInstalacion: item?.tipoInstalacion ?? '' as string,
    checklistPlantillaId: item?.checklistPlantillaId ?? '',
    importe: item?.importe != null ? String(item.importe) : '',
  });

  const { data: plantillasChecklist = [] } = useQuery({
    queryKey: ['plantillas-by-tipo', form.tipoInstalacion],
    queryFn: () => checklistsApi.plantillasByTipo(form.tipoInstalacion),
    enabled: !!item && !!form.tipoInstalacion,
  });

  const save = useMutation({
    mutationFn: () => {
      const raw = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '')) as any;
      if (raw.importe !== undefined) raw.importe = Number(raw.importe);
      const data = raw as Partial<Instalacion>;
      return item ? api.update(item.id, data) : api.create(data);
    },
    onSuccess: async (saved) => {
      if (archivo) {
        setSubiendoArchivo(true);
        try {
          await api.uploadMemoriaTecnica(saved.id, archivo);
        } catch {
          setArchivoError('La instalación se guardó, pero la memoria técnica no se pudo subir.');
          setSubiendoArchivo(false);
          qc.invalidateQueries({ queryKey: ['instalaciones'] });
          return;
        }
        setSubiendoArchivo(false);
      }
      qc.invalidateQueries({ queryKey: ['instalaciones'] });
      onClose();
    },
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  function handlePartnerChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = partners.find((p: Cliente) => p.id === e.target.value);
    setForm(f => ({
      ...f,
      clienteId: selected?.id ?? '',
      cliente: selected?.nombre ?? '',
    }));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
          <h2 className="font-semibold text-slate-900">{item ? 'Editar instalación' : 'Nueva instalación'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 grid grid-cols-3 gap-4 overflow-y-auto flex-1">
          <div className="col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
            <input value={form.nombre} onChange={set('nombre')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>

          <div className="col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Partner vinculado</label>
            <select
              value={form.clienteId}
              onChange={handlePartnerChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
            >
              <option value="">— Sin partner —</option>
              {partners.map((p: Cliente) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div className="col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Dirección {!item && <span className="text-red-500">*</span>}</label>
            <input value={form.direccion} onChange={set('direccion')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ciudad {!item && <span className="text-red-500">*</span>}</label>
            <input value={form.ciudad} onChange={set('ciudad')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Provincia</label>
            <input value={form.provincia} onChange={set('provincia')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono</label>
            <input type="tel" value={form.telefono} onChange={set('telefono')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Importe instalación (€)</label>
            <input type="number" min="0" step="0.01" value={form.importe} onChange={set('importe')} placeholder="—"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de instalación</label>
            <select
              value={form.tipoInstalacion}
              onChange={e => setForm(f => ({ ...f, tipoInstalacion: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
            >
              <option value="">— Sin especificar —</option>
              <option value="fv">Fotovoltaica (FV)</option>
              <option value="rite">RITE / Aerotermia</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea value={form.notas} onChange={set('notas')} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
          </div>

          <div className="col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Memoria técnica {item?.memoriaTecnicaNombre && !archivo && <span className="text-slate-400 font-normal">(el técnico la ve como "Anotaciones" en la app)</span>}
            </label>
            <input ref={fileInputRef} type="file" className="hidden"
              onChange={e => setArchivo(e.target.files?.[0] ?? null)} />
            {item?.memoriaTecnicaNombre && !archivo && (
              <a href={item.memoriaTecnicaUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 mb-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-100">
                <FileText size={14} className="text-brand flex-shrink-0" />
                <span className="truncate flex-1">{item.memoriaTecnicaNombre}</span>
              </a>
            )}
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-500 hover:border-brand hover:text-brand">
              <Upload size={14} />
              {archivo ? archivo.name : item?.memoriaTecnicaNombre ? 'Sustituir archivo' : 'Adjuntar archivo (PDF)'}
            </button>
            {archivoError && <p className="text-xs text-red-600 mt-1">{archivoError}</p>}
          </div>

          {item && (
            <div className="col-span-3">
              <label className="block text-xs font-medium text-slate-600 mb-2 flex items-center gap-1.5">
                <ClipboardList size={13} /> Plantilla de Checklist
              </label>
              {!form.tipoInstalacion ? (
                <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  Selecciona un tipo de instalación para elegir su plantilla de checklist.
                </p>
              ) : plantillasChecklist.length === 0 ? (
                <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  No hay plantillas de checklist para este tipo de instalación.
                </p>
              ) : (
                <>
                  <select
                    value={form.checklistPlantillaId}
                    onChange={e => setForm(f => ({ ...f, checklistPlantillaId: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                  >
                    <option value="">— Autoseleccionar por tipo —</option>
                    {plantillasChecklist.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({p.secciones?.length ?? 0} secciones · {p.secciones?.reduce((n, s) => n + s.items.length, 0) ?? 0} campos)
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Se usará en las visitas de esta instalación. Si no eliges ninguna, se autoselecciona por tipo.
                  </p>
                </>
              )}
            </div>
          )}

          {item && (
            <div className="col-span-3">
              <label className="block text-xs font-medium text-slate-600 mb-2 flex items-center gap-1.5">
                <Package size={13} /> Material instalado
                {(materiales.length + (atsCount > 0 ? 1 : 0)) > 0 && (
                  <span className="text-slate-400 font-normal">({materiales.length + (atsCount > 0 ? 1 : 0)})</span>
                )}
              </label>
              {materiales.length === 0 && atsCount === 0 ? (
                <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  Sin material registrado en las visitas de esta instalación.
                </p>
              ) : (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {atsCount > 0 && (
                    <div className="flex items-center justify-between px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-amber-600 text-[10px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">ATS</span>
                        <span className="font-medium text-slate-800">Automatic Transfer Switch</span>
                        {atsCount > 1 && <span className="text-slate-400 ml-1.5">× {atsCount}</span>}
                      </div>
                    </div>
                  )}
                  {(materiales as VisitaArticulo[]).map(va => (
                    <div key={va.id} className="flex items-center justify-between px-3 py-2 text-xs">
                      <div>
                        <span className="font-medium text-slate-800">{va.articulo?.nombre}</span>
                        <span className="text-slate-400 ml-1.5">
                          × {Number(va.cantidad).toLocaleString('es-ES', { maximumFractionDigits: 3 })} {va.articulo?.unidad}
                        </span>
                        {va.almacen?.nombre && <span className="text-slate-400 ml-1.5">· {va.almacen.nombre}</span>}
                      </div>
                      {va.precioUnitario != null && (
                        <span className="text-slate-500">
                          {(Number(va.precioUnitario) * Number(va.cantidad)).toFixed(2)} €
                        </span>
                      )}
                    </div>
                  ))}
                  {materiales.some(va => va.precioUnitario != null) && (
                    <div className="px-3 py-2 text-xs text-right font-medium text-slate-600">
                      Total: {materiales.reduce((s, va) =>
                        s + (va.precioUnitario != null ? Number(va.precioUnitario) * Number(va.cantidad) : 0), 0
                      ).toFixed(2)} €
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {save.isError && (
          <div className="mx-6 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium flex-shrink-0">
            Error: {(save.error as any)?.response?.data?.message ?? (save.error as any)?.message ?? 'No se pudo guardar. Revisa los campos.'}
          </div>
        )}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || subiendoArchivo || !form.nombre.trim() || (!item && (!form.direccion.trim() || !form.ciudad.trim()))}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50"
          >
            {subiendoArchivo ? 'Subiendo archivo...' : save.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Instalaciones() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['instalaciones'], queryFn: api.list });
  const { data: partners = [] } = useQuery({ queryKey: ['clientes'], queryFn: clientesApi.list });
  const [modal, setModal] = useState<{ open: boolean; item?: Instalacion }>({ open: false });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroPartner, setFiltroPartner] = useState('');

  const filtradas = useMemo(() => {
    const q = busqueda.toLowerCase();
    return (data as Instalacion[]).filter(inst => {
      if (filtroTipo && inst.tipoInstalacion !== filtroTipo) return false;
      if (filtroPartner && inst.clienteId !== filtroPartner && inst.cliente !== filtroPartner) return false;
      if (q && !(
        inst.nombre.toLowerCase().includes(q) ||
        (inst.clienteData?.nombre ?? inst.cliente ?? '').toLowerCase().includes(q) ||
        (inst.ciudad ?? '').toLowerCase().includes(q) ||
        (inst.provincia ?? '').toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [data, busqueda, filtroTipo, filtroPartner]);

  const hayFiltros = busqueda || filtroTipo || filtroPartner;

  const eliminar = useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: () => {
      setConfirmDelete(null);
      setDeleteError(null);
      qc.invalidateQueries({ queryKey: ['instalaciones'] });
    },
    onError: (err: any) => {
      setConfirmDelete(null);
      setDeleteError(err?.response?.data?.message ?? err?.message ?? 'Error al eliminar');
    },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Instalaciones</h1>
          <p className="text-sm text-slate-500">
            {filtradas.length}{filtradas.length !== data.length ? ` de ${data.length}` : ''} instalaciones
          </p>
        </div>
        <button onClick={() => setModal({ open: true })}
          className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-dark">
          <Plus size={16} /> Nueva
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, partner, ciudad..."
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
          />
        </div>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">Todos los tipos</option>
          <option value="fv">Fotovoltaica (FV)</option>
          <option value="rite">RITE / Aerotermia</option>
          <option value="otro">Otro</option>
        </select>
        <select
          value={filtroPartner}
          onChange={e => setFiltroPartner(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">Todos los partners</option>
          {(partners as Cliente[]).map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        {hayFiltros && (
          <button
            onClick={() => { setBusqueda(''); setFiltroTipo(''); setFiltroPartner(''); }}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 border border-slate-200 rounded-lg px-2 py-2"
          >
            <X size={12} /> Limpiar
          </button>
        )}
      </div>

      {isLoading
        ? <p className="text-sm text-slate-400">Cargando...</p>
        : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Partner', 'Nombre', 'Ciudad', 'Teléfono', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtradas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">
                      {hayFiltros ? 'Sin resultados para los filtros aplicados' : 'Sin instalaciones registradas'}
                    </td>
                  </tr>
                )}
                {filtradas.map(inst => (
                  <tr key={inst.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">
                      {inst.clienteData?.nombre ?? inst.cliente
                        ? <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{inst.clienteData?.nombre ?? inst.cliente}</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <span>{inst.nombre}</span>
                      {inst.tipoInstalacion && (
                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${
                          inst.tipoInstalacion === 'fv' ? 'bg-yellow-100 text-yellow-700' :
                          inst.tipoInstalacion === 'rite' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {inst.tipoInstalacion === 'fv' ? 'FV' : inst.tipoInstalacion === 'rite' ? 'RITE' : 'Otro'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="flex items-center gap-1"><MapPin size={12} />{inst.ciudad}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{inst.telefono || '—'}</td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                      <button onClick={() => setModal({ open: true, item: inst })}
                        className="text-slate-400 hover:text-brand p-1">
                        <Pencil size={14} />
                      </button>
                      {confirmDelete === inst.id ? (
                        <>
                          <span className="text-xs text-red-600 mr-1">¿Eliminar?</span>
                          <button
                            onClick={() => eliminar.mutate(inst.id)}
                            disabled={eliminar.isPending}
                            className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 disabled:opacity-50"
                          >Sí</button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs border border-slate-200 px-2 py-1 rounded hover:bg-slate-50"
                          >No</button>
                        </>
                      ) : (
                        <button
                          onClick={() => { setDeleteError(null); setConfirmDelete(inst.id); }}
                          className="text-slate-400 hover:text-red-500 p-1"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {deleteError && (
        <div className="mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {modal.open && <Modal item={modal.item} onClose={() => setModal({ open: false })} />}
    </div>
  );
}
