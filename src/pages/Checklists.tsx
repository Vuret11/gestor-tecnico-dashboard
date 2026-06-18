import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { checklists as api } from '../api/endpoints';
import type { ChecklistPlantilla, ChecklistSeccion, ChecklistItem, ItemTipo } from '../types';
import { Plus, Trash2, ChevronDown, ChevronRight, ClipboardList, X, GripVertical } from 'lucide-react';

const TIPO_LABEL: Record<ItemTipo, string> = {
  text: 'Texto', number: 'Número', boolean: 'Sí/No',
  select: 'Selección', photo: 'Foto', textarea: 'Texto largo',
};
const TIPO_COLOR: Record<ItemTipo, string> = {
  text: 'bg-slate-100 text-slate-600', number: 'bg-blue-50 text-blue-700',
  boolean: 'bg-green-50 text-green-700', select: 'bg-purple-50 text-purple-700',
  photo: 'bg-orange-50 text-orange-700', textarea: 'bg-slate-100 text-slate-600',
};

// ──────────── Modal crear plantilla ────────────
type DraftItem = { etiqueta: string; tipo: ItemTipo; unidad: string; obligatorio: boolean; opciones: string };
type DraftSeccion = { titulo: string; items: DraftItem[] };

function makeItem(): DraftItem {
  return { etiqueta: '', tipo: 'text', unidad: '', obligatorio: false, opciones: '' };
}
function makeSeccion(): DraftSeccion {
  return { titulo: '', items: [makeItem()] };
}

function NuevaPlantillaModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [secciones, setSecciones] = useState<DraftSeccion[]>([makeSeccion()]);

  const mutation = useMutation({
    mutationFn: api.crearPlantilla,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plantillas'] }); onClose(); },
  });

  const addSeccion = () => setSecciones(s => [...s, makeSeccion()]);
  const removeSeccion = (si: number) => setSecciones(s => s.filter((_, i) => i !== si));
  const updateSeccion = (si: number, titulo: string) =>
    setSecciones(s => s.map((sec, i) => i === si ? { ...sec, titulo } : sec));

  const addItem = (si: number) =>
    setSecciones(s => s.map((sec, i) => i === si ? { ...sec, items: [...sec.items, makeItem()] } : sec));
  const removeItem = (si: number, ii: number) =>
    setSecciones(s => s.map((sec, i) => i === si ? { ...sec, items: sec.items.filter((_, j) => j !== ii) } : sec));
  const updateItem = (si: number, ii: number, field: keyof DraftItem, value: any) =>
    setSecciones(s => s.map((sec, i) => i === si
      ? { ...sec, items: sec.items.map((item, j) => j === ii ? { ...item, [field]: value } : item) }
      : sec));

  const handleSubmit = () => {
    if (!nombre.trim()) return;
    mutation.mutate({
      nombre,
      descripcion: descripcion || undefined,
      secciones: secciones.map((sec, si) => ({
        titulo: sec.titulo || `Sección ${si + 1}`,
        orden: si,
        items: sec.items
          .filter(item => item.etiqueta.trim())
          .map((item, ii) => ({
            etiqueta: item.etiqueta,
            tipo: item.tipo,
            unidad: item.unidad || undefined,
            obligatorio: item.obligatorio,
            orden: ii,
            opciones: item.tipo === 'select' && item.opciones
              ? item.opciones.split(',').map(o => o.trim()).filter(Boolean)
              : undefined,
          })),
      })),
    } as any);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8">
      <div className="bg-white rounded-xl w-full max-w-3xl mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-slate-800">Nueva plantilla de checklist</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Nombre *</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Revisión Fotovoltaica"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Descripción</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción opcional"
              />
            </div>
          </div>

          {secciones.map((sec, si) => (
            <div key={si} className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 bg-slate-50 px-4 py-3 border-b border-slate-200">
                <GripVertical size={14} className="text-slate-400" />
                <input
                  className="flex-1 bg-transparent text-sm font-semibold text-slate-700 focus:outline-none"
                  value={sec.titulo} onChange={e => updateSeccion(si, e.target.value)}
                  placeholder={`Sección ${si + 1}`}
                />
                {secciones.length > 1 && (
                  <button onClick={() => removeSeccion(si)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-100">
                {sec.items.map((item, ii) => (
                  <div key={ii} className="px-4 py-3 grid grid-cols-12 gap-2 items-center">
                    <input
                      className="col-span-4 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                      value={item.etiqueta} onChange={e => updateItem(si, ii, 'etiqueta', e.target.value)}
                      placeholder="Etiqueta del campo"
                    />
                    <select
                      className="col-span-2 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                      value={item.tipo} onChange={e => updateItem(si, ii, 'tipo', e.target.value as ItemTipo)}
                    >
                      {(Object.keys(TIPO_LABEL) as ItemTipo[]).map(t => (
                        <option key={t} value={t}>{TIPO_LABEL[t]}</option>
                      ))}
                    </select>
                    {item.tipo === 'number' && (
                      <input
                        className="col-span-2 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                        value={item.unidad} onChange={e => updateItem(si, ii, 'unidad', e.target.value)}
                        placeholder="Unidad (V, mA…)"
                      />
                    )}
                    {item.tipo === 'select' && (
                      <input
                        className="col-span-3 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                        value={item.opciones} onChange={e => updateItem(si, ii, 'opciones', e.target.value)}
                        placeholder="Op1, Op2, Op3"
                      />
                    )}
                    {item.tipo !== 'number' && item.tipo !== 'select' && (
                      <div className="col-span-2" />
                    )}
                    <label className="col-span-2 flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                      <input type="checkbox" className="rounded" checked={item.obligatorio}
                        onChange={e => updateItem(si, ii, 'obligatorio', e.target.checked)} />
                      Obligatorio
                    </label>
                    <button
                      onClick={() => removeItem(si, ii)}
                      className="col-span-1 text-red-400 hover:text-red-600 flex justify-center"
                      disabled={sec.items.length === 1}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
                <button
                  onClick={() => addItem(si)}
                  className="flex items-center gap-1 text-xs text-brand hover:text-brand font-medium"
                >
                  <Plus size={13} /> Añadir campo
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={addSeccion}
            className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-brand hover:text-brand flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Añadir sección
          </button>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={!nombre.trim() || mutation.isPending}
            className="px-5 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark disabled:opacity-50"
          >
            {mutation.isPending ? 'Guardando…' : 'Crear plantilla'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────── Vista de plantilla ────────────
function PlantillaDetalle({ plantilla }: { plantilla: ChecklistPlantilla }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen(p => ({ ...p, [id]: !p[id] }));

  const totalItems = plantilla.secciones.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center">
          <ClipboardList size={18} className="text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">{plantilla.nombre}</h3>
          {plantilla.descripcion && <p className="text-xs text-slate-500">{plantilla.descripcion}</p>}
        </div>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
          {plantilla.secciones.length} secciones · {totalItems} campos
        </span>
      </div>

      {[...plantilla.secciones].sort((a, b) => a.orden - b.orden).map(sec => (
        <div key={sec.id} className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => toggle(sec.id)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
          >
            {open[sec.id] ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
            <span className="text-sm font-semibold text-slate-700">{sec.titulo}</span>
            <span className="ml-auto text-xs text-slate-400">{sec.items.length} campos</span>
          </button>

          {open[sec.id] && (
            <div className="divide-y divide-slate-100">
              {[...sec.items].sort((a, b) => a.orden - b.orden).map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-sm text-slate-700 flex-1">{item.etiqueta}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLOR[item.tipo]}`}>
                    {TIPO_LABEL[item.tipo]}{item.unidad ? ` (${item.unidad})` : ''}
                  </span>
                  {item.obligatorio && (
                    <span className="text-xs text-red-500 font-medium">*</span>
                  )}
                  {item.opciones?.length > 0 && (
                    <span className="text-xs text-slate-400 truncate max-w-32">{item.opciones.join(', ')}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ──────────── Página principal ────────────
export default function Checklists() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<ChecklistPlantilla | null>(null);
  const [showModal, setShowModal] = useState(false);

  const { data: plantillas = [], isLoading } = useQuery({
    queryKey: ['plantillas'],
    queryFn: api.plantillas,
  });

  const deleteMutation = useMutation({
    mutationFn: api.eliminarPlantilla,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plantillas'] });
      setSelected(null);
    },
  });

  return (
    <div className="flex h-full">
      {/* Sidebar lista */}
      <div className="w-72 border-r border-slate-200 flex flex-col bg-white">
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Plantillas</h2>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-xs bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand-dark"
          >
            <Plus size={13} /> Nueva
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : plantillas.length === 0 ? (
            <div className="text-center py-12 px-4">
              <ClipboardList size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">Sin plantillas</p>
              <p className="text-xs text-slate-400 mt-1">Crea una plantilla para usarla en las visitas</p>
            </div>
          ) : (
            plantillas.map(p => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${selected?.id === p.id ? 'bg-brand-light border-l-4 border-l-brand' : ''}`}
              >
                <p className="text-sm font-medium text-slate-800 truncate">{p.nombre}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {p.secciones?.length ?? 0} secciones · {p.secciones?.reduce((n, s) => n + s.items.length, 0) ?? 0} campos
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detalle */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        {selected ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold text-slate-800">{selected.nombre}</h1>
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar plantilla "${selected.nombre}"?`)) {
                    deleteMutation.mutate(selected.id);
                  }
                }}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50"
              >
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
            <PlantillaDetalle plantilla={selected} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ClipboardList size={48} className="text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Selecciona una plantilla</p>
            <p className="text-sm text-slate-400 mt-1">o crea una nueva con el botón "Nueva"</p>
          </div>
        )}
      </div>

      {showModal && <NuevaPlantillaModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
