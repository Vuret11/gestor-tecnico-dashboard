import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientes as api, instalaciones as instApi } from '../api/endpoints';
import type { Cliente, Instalacion } from '../types';
import { ArrowLeft, Plus, Pencil, Trash2, MapPin, Building2, Phone, Mail, FileText } from 'lucide-react';

/* ── Modal editar partner ── */
function PartnerModal({ item, onClose }: { item: Cliente; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nombre: item.nombre,
    email: item.email ?? '',
    notas: item.notas ?? '',
  });

  const save = useMutation({
    mutationFn: () => api.update(item.id, Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cliente', item.id] });
      qc.invalidateQueries({ queryKey: ['clientes'] });
      onClose();
    },
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900">Editar partner</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre / Razón social</label>
            <input type="text" value={form.nombre} onChange={set('nombre')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input type="email" value={form.email} onChange={set('email')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea value={form.notas} onChange={set('notas')} rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
          </div>
        </div>
        {save.isError && (
          <div className="mx-6 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {(save.error as any)?.response?.data?.message ?? 'Error al guardar'}
          </div>
        )}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={save.isPending || !form.nombre.trim()}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50">
            {save.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal crear / editar instalación ── */
function InstalacionModal({
  cliente,
  item,
  onClose,
}: {
  cliente: Cliente;
  item?: Instalacion;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nombre: item?.nombre ?? '',
    cliente: cliente.nombre,
    clienteId: cliente.id,
    direccion: item?.direccion ?? '',
    ciudad: item?.ciudad ?? '',
    provincia: item?.provincia ?? '',
    cp: item?.cp ?? '',
    telefono: item?.telefono ?? '',
    notas: item?.notas ?? '',
  });

  const save = useMutation({
    mutationFn: () => {
      const data = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '')) as Partial<Instalacion>;
      return item ? instApi.update(item.id, data) : instApi.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instalaciones-cliente', cliente.id] });
      qc.invalidateQueries({ queryKey: ['instalaciones'] });
      onClose();
    },
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const esNueva = !item;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-slate-900">{esNueva ? 'Nueva instalación' : 'Editar instalación'}</h2>
            <p className="text-xs text-slate-500">Partner: {cliente.nombre}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Nombre de la instalación {esNueva && <span className="text-red-500">*</span>}
            </label>
            <input type="text" value={form.nombre} onChange={set('nombre')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Dirección {esNueva && <span className="text-red-500">*</span>}
            </label>
            <input type="text" value={form.direccion} onChange={set('direccion')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Ciudad {esNueva && <span className="text-red-500">*</span>}
            </label>
            <input type="text" value={form.ciudad} onChange={set('ciudad')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Provincia</label>
            <input type="text" value={form.provincia} onChange={set('provincia')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">C.P.</label>
            <input type="text" value={form.cp} onChange={set('cp')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono</label>
            <input type="tel" value={form.telefono} onChange={set('telefono')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea value={form.notas} onChange={set('notas')} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
          </div>
        </div>
        {save.isError && (
          <div className="mx-6 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
            Error: {(save.error as any)?.response?.data?.message ?? 'No se pudo guardar'}
          </div>
        )}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.nombre.trim() || (esNueva && (!form.direccion.trim() || !form.ciudad.trim()))}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50"
          >
            {save.isPending ? 'Guardando...' : esNueva ? 'Crear instalación' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Página detalle del partner ── */
export default function ClienteDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editPartner, setEditPartner] = useState(false);
  const [instModal, setInstModal] = useState<{ open: boolean; item?: Instalacion }>({ open: false });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const eliminarInst = useMutation({
    mutationFn: (instId: string) => instApi.remove(instId),
    onSuccess: () => {
      setConfirmDelete(null);
      setDeleteError(null);
      qc.invalidateQueries({ queryKey: ['instalaciones-cliente', id] });
      qc.invalidateQueries({ queryKey: ['instalaciones'] });
      qc.invalidateQueries({ queryKey: ['plan-obras'] });
      qc.invalidateQueries({ queryKey: ['plan-semana'] });
      qc.invalidateQueries({ queryKey: ['visitas-semana'] });
    },
    onError: (err: any) => {
      setConfirmDelete(null);
      setDeleteError(err?.response?.data?.message ?? err?.message ?? 'Error al eliminar la instalación');
    },
  });

  const { data: cliente, isLoading: loadingCliente } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => api.get(id!),
    enabled: !!id,
  });

  const { data: insts = [], isLoading: loadingInsts } = useQuery({
    queryKey: ['instalaciones-cliente', id],
    queryFn: () => instApi.byCliente(id!),
    enabled: !!id,
  });

  if (loadingCliente) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-400">Cargando...</p>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-500">Partner no encontrado.</p>
        <button onClick={() => navigate('/clientes')} className="mt-2 text-sm text-brand hover:underline">
          ← Volver a Partners
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumb / back */}
      <button
        onClick={() => navigate('/clientes')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand mb-5 transition-colors"
      >
        <ArrowLeft size={15} />
        Partners
      </button>

      {/* Header del partner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
              <span className="text-brand font-bold text-lg">{cliente.nombre[0].toUpperCase()}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-brand bg-brand/10 px-2 py-0.5 rounded">
                  Partner
                </span>
              </div>
              <h1 className="text-xl font-semibold text-slate-900">{cliente.nombre}</h1>
            </div>
          </div>
          <button
            onClick={() => setEditPartner(true)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand border border-slate-200 hover:border-brand px-3 py-1.5 rounded-lg transition-colors"
          >
            <Pencil size={13} />
            Editar
          </button>
        </div>

        {(cliente.email || cliente.notas) && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-4">
            {cliente.email && (
              <span className="flex items-center gap-1.5 text-sm text-slate-600">
                <Mail size={13} className="text-slate-400" />
                {cliente.email}
              </span>
            )}
            {cliente.notas && (
              <span className="flex items-center gap-1.5 text-sm text-slate-600">
                <FileText size={13} className="text-slate-400" />
                {cliente.notas}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Sección instalaciones */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Instalaciones</h2>
            <p className="text-xs text-slate-500 mt-0.5">{insts.length} instalaciones vinculadas</p>
          </div>
          <button
            onClick={() => setInstModal({ open: true })}
            className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-dark"
          >
            <Plus size={15} />
            Nueva instalación
          </button>
        </div>

        {loadingInsts ? (
          <p className="text-sm text-slate-400 p-6">Cargando instalaciones...</p>
        ) : insts.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium text-sm">Sin instalaciones aún</p>
            <p className="text-slate-400 text-xs mt-1">Añade la primera instalación de este partner</p>
            <button
              onClick={() => setInstModal({ open: true })}
              className="mt-4 flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-dark mx-auto"
            >
              <Plus size={15} />
              Nueva instalación
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {insts.map((inst: Instalacion) => (
              <li key={inst.id} className="px-6 py-4 hover:bg-slate-50 flex items-start justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Building2 size={14} className="text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 text-sm">{inst.nombre}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                      {inst.direccion && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin size={10} />
                          {inst.direccion}{inst.ciudad ? `, ${inst.ciudad}` : ''}
                          {inst.provincia ? ` (${inst.provincia})` : ''}
                        </span>
                      )}
                      {inst.telefono && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Phone size={10} />
                          {inst.telefono}
                        </span>
                      )}
                    </div>
                    {inst.notas && (
                      <p className="text-xs text-slate-400 mt-0.5">{inst.notas}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  {confirmDelete === inst.id ? (
                    <>
                      <span className="text-xs text-red-600 mr-1">
                        {eliminarInst.isPending ? 'Eliminando...' : '¿Eliminar?'}
                      </span>
                      <button
                        onClick={() => eliminarInst.mutate(inst.id)}
                        disabled={eliminarInst.isPending}
                        className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 disabled:opacity-50"
                      >
                        Sí
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        disabled={eliminarInst.isPending}
                        className="text-xs border border-slate-200 px-2 py-1 rounded hover:bg-slate-50 disabled:opacity-50"
                      >
                        No
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setInstModal({ open: true, item: inst })}
                        className="text-slate-400 hover:text-brand p-1"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(inst.id)}
                        className="text-slate-400 hover:text-red-500 p-1"
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {deleteError && (
          <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {deleteError}
          </div>
        )}
      </div>

      {editPartner && (
        <PartnerModal item={cliente} onClose={() => setEditPartner(false)} />
      )}

      {instModal.open && (
        <InstalacionModal
          cliente={cliente}
          item={instModal.item}
          onClose={() => setInstModal({ open: false })}
        />
      )}
    </div>
  );
}
