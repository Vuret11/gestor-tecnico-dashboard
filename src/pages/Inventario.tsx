import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventario as api } from '../api/endpoints';
import type { InventarioArticulo, Almacen } from '../types';
import { Plus, Pencil, Trash2, Package, AlertTriangle, Search, X, TrendingUp, TrendingDown } from 'lucide-react';

const UNIDADES = ['ud', 'kg', 'g', 'm', 'm²', 'm³', 'l', 'ml', 'caja', 'rollo', 'par'];

function formatEur(n?: number | null) {
  if (n == null) return '—';
  return `${Number(n).toFixed(2)} €`;
}

function stockDe(art: InventarioArticulo, almacenId: string) {
  return art.stocks?.find(s => s.almacen_id === almacenId);
}

function StockBadge({ actual, minimo, unidad }: { actual: number; minimo: number; unidad: string }) {
  const bajo = Number(actual) <= Number(minimo);
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
      bajo ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
    }`} title={`Mínimo: ${Number(minimo).toLocaleString('es-ES', { maximumFractionDigits: 3 })} ${unidad}`}>
      {bajo ? <AlertTriangle size={10} /> : null}
      {Number(actual).toLocaleString('es-ES', { maximumFractionDigits: 3 })} {unidad}
    </span>
  );
}

function ArticuloModal({ item, onClose }: { item?: InventarioArticulo; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    referencia: item?.referencia ?? '',
    nombre: item?.nombre ?? '',
    descripcion: item?.descripcion ?? '',
    unidad: item?.unidad ?? 'ud',
    precioUnitario: item?.precioUnitario != null ? String(item.precioUnitario) : '',
    categoria: item?.categoria ?? '',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      const data: Partial<InventarioArticulo> = {
        referencia: form.referencia || undefined,
        nombre: form.nombre,
        descripcion: form.descripcion || undefined,
        unidad: form.unidad,
        precioUnitario: form.precioUnitario ? Number(form.precioUnitario) : undefined,
        categoria: form.categoria || undefined,
      };
      return item ? api.articulos.update(item.id, data) : api.articulos.create(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventario'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900">{item ? 'Editar artículo' : 'Nuevo artículo'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Referencia / SKU</label>
            <input value={form.referencia} onChange={set('referencia')} placeholder="Opcional"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
            <input value={form.categoria} onChange={set('categoria')} placeholder="Ej: Cable, Protecciones..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre <span className="text-red-500">*</span></label>
            <input value={form.nombre} onChange={set('nombre')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
            <textarea value={form.descripcion} onChange={set('descripcion')} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Unidad</label>
            <select value={form.unidad} onChange={set('unidad')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white">
              {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Precio unitario (€)</label>
            <input type="number" min="0" step="0.01" value={form.precioUnitario} onChange={set('precioUnitario')} placeholder="—"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
        </div>
        {!item && (
          <p className="mx-6 mb-3 text-xs text-slate-400">
            El artículo se crea con stock 0 en todos los almacenes. Ajusta el stock por almacén después de guardar.
          </p>
        )}
        {save.isError && (
          <div className="mx-6 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {(save.error as any)?.response?.data?.message ?? 'Error al guardar'}
          </div>
        )}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
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

function AjusteStockModal({ item, almacenes, onClose }: { item: InventarioArticulo; almacenes: Almacen[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [modos, setModos] = useState<Record<string, 'entrada' | 'salida'>>({});
  const [minimos, setMinimos] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const al of almacenes) {
      init[al.id] = String(stockDe(item, al.id)?.stockMinimo ?? 0);
    }
    return init;
  });

  const ajustar = useMutation({
    mutationFn: ({ almacenId, delta, stockMinimo }: { almacenId: string; delta?: number; stockMinimo?: number }) =>
      api.articulos.ajustarStock(item.id, almacenId, delta, stockMinimo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventario'] }),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900">Stock por almacén — {item.nombre}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {almacenes.map(al => {
            const stock = stockDe(item, al.id);
            const actual = Number(stock?.stockActual ?? 0);
            const cantidad = cantidades[al.id] ?? '';
            const modo = modos[al.id] ?? 'entrada';
            return (
              <div key={al.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800 text-sm">{al.nombre}</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {actual.toLocaleString('es-ES', { maximumFractionDigits: 3 })} {item.unidad}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setModos(m => ({ ...m, [al.id]: 'entrada' }))}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border ${
                      modo === 'entrada' ? 'bg-green-50 border-green-400 text-green-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <TrendingUp size={12} /> Entrada
                  </button>
                  <button
                    onClick={() => setModos(m => ({ ...m, [al.id]: 'salida' }))}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border ${
                      modo === 'salida' ? 'bg-red-50 border-red-400 text-red-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <TrendingDown size={12} /> Salida
                  </button>
                  <input
                    type="number" min="0.001" step="0.001" value={cantidad}
                    onChange={e => setCantidades(c => ({ ...c, [al.id]: e.target.value }))}
                    placeholder="Cantidad"
                    className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <button
                    onClick={() => {
                      const n = Number(cantidad);
                      if (!n || n <= 0) return;
                      ajustar.mutate({ almacenId: al.id, delta: modo === 'entrada' ? n : -n });
                      setCantidades(c => ({ ...c, [al.id]: '' }));
                    }}
                    disabled={ajustar.isPending || !cantidad || Number(cantidad) <= 0}
                    className="px-3 py-1.5 text-xs bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50"
                  >
                    Aplicar
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Mínimo:</span>
                  <input
                    type="number" min="0" step="0.001" value={minimos[al.id] ?? '0'}
                    onChange={e => setMinimos(m => ({ ...m, [al.id]: e.target.value }))}
                    onBlur={() => ajustar.mutate({ almacenId: al.id, stockMinimo: Number(minimos[al.id] || 0) })}
                    className="w-24 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <span>{item.unidad}</span>
                </div>
              </div>
            );
          })}
          {ajustar.isError && (
            <p className="text-xs text-red-600">{(ajustar.error as any)?.response?.data?.message ?? 'Error'}</p>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default function Inventario() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['inventario'], queryFn: () => api.articulos.list() });
  const { data: almacenes = [] } = useQuery({ queryKey: ['almacenes'], queryFn: () => api.almacenes.list() });
  const [modal, setModal] = useState<{ open: boolean; item?: InventarioArticulo }>({ open: false });
  const [ajusteModal, setAjusteModal] = useState<InventarioArticulo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [soloStockBajo, setSoloStockBajo] = useState(false);

  const categorias = useMemo(() => {
    const set = new Set((data as InventarioArticulo[]).map(a => a.categoria).filter(Boolean));
    return [...set].sort() as string[];
  }, [data]);

  const stockBajoArticulo = (a: InventarioArticulo) =>
    (a.stocks ?? []).some(s => Number(s.stockActual) <= Number(s.stockMinimo));

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return (data as InventarioArticulo[]).filter(a => {
      if (filtroCategoria && a.categoria !== filtroCategoria) return false;
      if (soloStockBajo && !stockBajoArticulo(a)) return false;
      if (q && !(
        a.nombre.toLowerCase().includes(q) ||
        (a.referencia ?? '').toLowerCase().includes(q) ||
        (a.categoria ?? '').toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [data, busqueda, filtroCategoria, soloStockBajo]);

  const stockBajoCount = (data as InventarioArticulo[]).filter(stockBajoArticulo).length;

  const eliminar = useMutation({
    mutationFn: (id: string) => api.articulos.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventario'] }); setConfirmDelete(null); },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Inventario</h1>
          <p className="text-sm text-slate-500">
            {filtrados.length}{filtrados.length !== data.length ? ` de ${data.length}` : ''} artículos
            {stockBajoCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-600 font-medium">
                <AlertTriangle size={12} /> {stockBajoCount} con stock bajo
              </span>
            )}
          </p>
        </div>
        <button onClick={() => setModal({ open: true })}
          className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-dark">
          <Plus size={16} /> Nuevo artículo
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, referencia..."
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white" />
        </div>
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setSoloStockBajo(v => !v)}
          className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors ${
            soloStockBajo ? 'bg-red-50 border-red-300 text-red-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle size={13} /> Stock bajo
        </button>
        {(busqueda || filtroCategoria || soloStockBajo) && (
          <button onClick={() => { setBusqueda(''); setFiltroCategoria(''); setSoloStockBajo(false); }}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 border border-slate-200 rounded-lg px-2 py-2">
            <X size={12} /> Limpiar
          </button>
        )}
      </div>

      {isLoading
        ? <p className="text-sm text-slate-400">Cargando...</p>
        : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Referencia', 'Artículo', 'Categoría', 'Unidad', ...almacenes.map((a: Almacen) => a.nombre), 'Precio', ''].map((h, i) => (
                    <th key={`${h}-${i}`} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.length === 0 && (
                  <tr><td colSpan={5 + almacenes.length} className="px-4 py-10 text-center text-slate-400 text-sm">
                    {busqueda || filtroCategoria || soloStockBajo ? 'Sin resultados' : 'Sin artículos. Crea el primero.'}
                  </td></tr>
                )}
                {filtrados.map(art => (
                  <tr key={art.id} className={`hover:bg-slate-50 ${stockBajoArticulo(art) ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{art.referencia || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{art.nombre}</div>
                      {art.descripcion && <div className="text-xs text-slate-400 truncate max-w-[200px]">{art.descripcion}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {art.categoria
                        ? <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{art.categoria}</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{art.unidad}</td>
                    {almacenes.map((al: Almacen) => {
                      const s = stockDe(art, al.id);
                      return (
                        <td key={al.id} className="px-4 py-3">
                          <StockBadge actual={s?.stockActual ?? 0} minimo={s?.stockMinimo ?? 0} unidad={art.unidad} />
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-slate-600">{formatEur(art.precioUnitario)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setAjusteModal(art)}
                          className="text-slate-400 hover:text-brand p-1" title="Ajustar stock">
                          <Package size={14} />
                        </button>
                        <button onClick={() => setModal({ open: true, item: art })}
                          className="text-slate-400 hover:text-brand p-1">
                          <Pencil size={14} />
                        </button>
                        {confirmDelete === art.id ? (
                          <>
                            <button onClick={() => eliminar.mutate(art.id)} className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">Sí</button>
                            <button onClick={() => setConfirmDelete(null)} className="text-xs border border-slate-200 px-2 py-1 rounded hover:bg-slate-50">No</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmDelete(art.id)} className="text-slate-400 hover:text-red-500 p-1">
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

      {modal.open && <ArticuloModal item={modal.item} onClose={() => setModal({ open: false })} />}
      {ajusteModal && <AjusteStockModal item={ajusteModal} almacenes={almacenes} onClose={() => setAjusteModal(null)} />}
    </div>
  );
}
