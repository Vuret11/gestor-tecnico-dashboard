import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientes as api, instalaciones as instApi } from '../api/endpoints';
import type { Cliente, Instalacion } from '../types';
import { Plus, Pencil, Building2, X, ChevronRight, MapPin } from 'lucide-react';

/* ── Modal crear/editar cliente ── */
function ClienteModal({ item, onClose }: { item?: Cliente; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nombre: item?.nombre ?? '',
    nif: item?.nif ?? '',
    telefono: item?.telefono ?? '',
    email: item?.email ?? '',
    direccion: item?.direccion ?? '',
    notas: item?.notas ?? '',
  });

  const save = useMutation({
    mutationFn: () => {
      const data = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== ''),
      ) as Partial<Cliente>;
      return item ? api.update(item.id, data) : api.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      onClose();
    },
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const fields: [keyof typeof form, string, string][] = [
    ['nombre', 'Nombre / Razón social', 'text'],
    ['nif', 'NIF / CIF', 'text'],
    ['telefono', 'Teléfono', 'tel'],
    ['email', 'Email', 'email'],
    ['direccion', 'Dirección', 'text'],
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900">{item ? 'Editar cliente' : 'Nuevo cliente'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          {fields.map(([k, label, type]) => (
            <div key={k}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <input
                type={type}
                value={form[k]}
                onChange={set(k)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea
              value={form.notas}
              onChange={set('notas')}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
            />
          </div>
        </div>
        {save.isError && (
          <div className="mx-6 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {(save.error as any)?.response?.data?.message
              ?? (save.error as any)?.message
              ?? 'Error al guardar'}
          </div>
        )}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
            Cancelar
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.nombre.trim()}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50"
          >
            {save.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal crear instalación desde cliente ── */
function InstalacionModal({ cliente, onClose }: { cliente: Cliente; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nombre: '',
    cliente: cliente.nombre,
    clienteId: cliente.id,
    direccion: '',
    ciudad: '',
    provincia: '',
    cp: '',
    telefono: '',
    notas: '',
  });

  const save = useMutation({
    mutationFn: () => {
      const data = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== ''),
      ) as Partial<Instalacion>;
      return instApi.create(data);
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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-slate-900">Nueva instalación</h2>
            <p className="text-xs text-slate-500">Cliente: {cliente.nombre}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre de la instalación</label>
            <input type="text" value={form.nombre} onChange={set('nombre')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Dirección</label>
            <input type="text" value={form.direccion} onChange={set('direccion')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ciudad</label>
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
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
            Cancelar
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.nombre.trim() || !form.direccion.trim() || !form.ciudad.trim()}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50"
          >
            {save.isPending ? 'Guardando...' : 'Crear instalación'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Panel lateral: instalaciones del cliente ── */
function InstalacionesPanel({
  cliente,
  onClose,
  onEdit,
}: {
  cliente: Cliente;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [showInstModal, setShowInstModal] = useState(false);

  const { data: insts = [], isLoading } = useQuery({
    queryKey: ['instalaciones-cliente', cliente.id],
    queryFn: () => instApi.byCliente(cliente.id),
  });

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[420px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-slate-900 text-base">{cliente.nombre}</h2>
            {cliente.nif && <p className="text-xs text-slate-500">{cliente.nif}</p>}
            <div className="flex gap-3 mt-1 text-xs text-slate-500">
              {cliente.telefono && <span>{cliente.telefono}</span>}
              {cliente.email && <span>{cliente.email}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="text-xs text-brand hover:underline flex items-center gap-1"
            >
              <Pencil size={12} /> Editar
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Instalaciones */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Instalaciones ({insts.length})
            </span>
            <button
              onClick={() => setShowInstModal(true)}
              className="flex items-center gap-1.5 text-xs bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand-dark"
            >
              <Plus size={12} /> Nueva
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-400 p-5">Cargando...</p>
          ) : insts.length === 0 ? (
            <div className="p-5 text-center">
              <Building2 size={32} className="mx-auto text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">Sin instalaciones</p>
              <button
                onClick={() => setShowInstModal(true)}
                className="mt-3 text-xs text-brand hover:underline"
              >
                Añadir primera instalación
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {insts.map((inst: Instalacion) => (
                <li key={inst.id} className="px-5 py-3 hover:bg-slate-50 group">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{inst.nombre}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={10} />
                        {inst.direccion}, {inst.ciudad}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-400 flex-shrink-0 mt-1" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {cliente.notas && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500 font-medium mb-1">Notas</p>
            <p className="text-xs text-slate-600">{cliente.notas}</p>
          </div>
        )}
      </div>

      {showInstModal && (
        <InstalacionModal
          cliente={cliente}
          onClose={() => setShowInstModal(false)}
        />
      )}
    </>
  );
}

/* ── Página principal ── */
export default function Clientes() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['clientes'],
    queryFn: api.list,
  });

  const [modal, setModal] = useState<{ open: boolean; item?: Cliente }>({ open: false });
  const [panel, setPanel] = useState<Cliente | null>(null);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Clientes</h1>
          <p className="text-sm text-slate-500">{data.length} clientes</p>
        </div>
        <button
          onClick={() => setModal({ open: true })}
          className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-dark"
        >
          <Plus size={16} /> Nuevo cliente
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Building2 size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">Sin clientes aún</p>
          <button
            onClick={() => setModal({ open: true })}
            className="mt-3 text-sm text-brand hover:underline"
          >
            Crear primer cliente
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Nombre', 'NIF / CIF', 'Teléfono', 'Email', 'Dirección', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((c: Cliente) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setPanel(c)}
                      className="font-medium text-slate-900 hover:text-brand text-left"
                    >
                      {c.nombre}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.nif || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{c.telefono || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">{c.direccion || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setPanel(c)}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand border border-slate-200 hover:border-brand px-2 py-1 rounded"
                      >
                        <Building2 size={12} /> Instalaciones
                      </button>
                      <button
                        onClick={() => setModal({ open: true, item: c })}
                        className="text-slate-400 hover:text-brand p-1"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && (
        <ClienteModal
          item={modal.item}
          onClose={() => setModal({ open: false })}
        />
      )}

      {panel && (
        <InstalacionesPanel
          cliente={panel}
          onClose={() => setPanel(null)}
          onEdit={() => {
            setModal({ open: true, item: panel });
            setPanel(null);
          }}
        />
      )}
    </div>
  );
}
