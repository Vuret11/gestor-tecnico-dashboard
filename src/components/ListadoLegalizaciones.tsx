import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { legalizaciones as legApi } from '../api/endpoints';
import type { Legalizacion } from '../types';

/**
 * LISTADO de legalizaciones, al final de la pantalla, con la forma de la hoja que lleva Salva (lo pidió
 * el 7-oct-2026 con una captura de su Excel delante): una fila por expediente y las columnas Código,
 * Partner, C. Autónoma, Tipo de instalación, Nombre, Estado y Fecha, con la fila coloreada según el
 * estado y una leyenda de colores al pie.
 *
 * Va en tabla y no en tarjetas porque su hoja tiene 90 filas: mirando la tabla se compara de un vistazo
 * qué está pendiente y qué ya está presentado.
 */

/** Los estados del trámite con su rótulo y el color de la fila (los mismos que las barras del resumen). */
const ESTADOS: Record<string, { etiqueta: string; fila: string; punto: string }> = {
  bloqueado: { etiqueta: 'Bloqueado', fila: 'bg-red-50', punto: 'bg-red-400' },
  con_avisos: { etiqueta: 'Con avisos', fila: 'bg-amber-50', punto: 'bg-amber-400' },
  listo_presentar: { etiqueta: 'Listo para presentar', fila: 'bg-green-50', punto: 'bg-green-500' },
  presentado: { etiqueta: 'Presentado', fila: 'bg-blue-50', punto: 'bg-blue-500' },
  inscrito: { etiqueta: 'Inscrito', fila: 'bg-slate-100', punto: 'bg-slate-400' },
};

const COLOR_POR_DEFECTO = { etiqueta: 'Sin estado', fila: '', punto: 'bg-slate-300' };

/** Tipo de instalación: de qué va el expediente (RITE = clima, FV = fotovoltaica). */
function tipoDe(e: Legalizacion): string {
  const texto = `${e.maquina ?? ''} ${e.motivo ?? ''}`.toLowerCase();
  if (/solar|fotovolt|inversor|placa|panel|string/.test(texto)) return 'FV';
  return 'RITE';
}

/** La fecha que se enseña: la de fin si el trámite está cerrado y, si no, la de inicio. */
const fechaDe = (e: Legalizacion) => e.fecha_fin || e.fecha_inicio || '';

const COLUMNAS: { clave: string; titulo: string; valor: (e: Legalizacion) => string; ancho?: string }[] = [
  // El «código» de su hoja es el número de obra del expediente (y si aún no lo tiene, el del CRM).
  { clave: 'codigo', titulo: 'Código', valor: e => e.num_obra || (e.id_externo ? String(e.id_externo) : ''), ancho: 'w-28' },
  { clave: 'partner', titulo: 'Partner', valor: e => e.partner ?? '', ancho: 'w-32' },
  { clave: 'comunidad', titulo: 'C. Autónoma', valor: e => e.comunidad || e.provincia || '', ancho: 'w-40' },
  { clave: 'tipo', titulo: 'Tipo inst.', valor: e => tipoDe(e), ancho: 'w-20' },
  { clave: 'cliente', titulo: 'Nombre', valor: e => e.cliente ?? '' },
  { clave: 'estado', titulo: 'Estado', valor: e => ESTADOS[e.estado]?.etiqueta ?? e.estado, ancho: 'w-40' },
  { clave: 'fecha', titulo: 'Fecha', valor: e => fechaDe(e), ancho: 'w-24' },
];

export function ListadoLegalizaciones() {
  const [archivados, setArchivados] = useState(false);
  const [busca, setBusca] = useState('');
  const [orden, setOrden] = useState<{ clave: string; asc: boolean }>({ clave: 'fecha', asc: false });

  const { data = [], isLoading } = useQuery({
    queryKey: ['legalizaciones-listado', archivados],
    queryFn: () => legApi.list(archivados ? { archivados: '1' } : undefined),
  });

  const filas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const filtradas = t
      ? data.filter(e =>
          COLUMNAS.some(c => c.valor(e).toLowerCase().includes(t)),
        )
      : data;
    const col = COLUMNAS.find(c => c.clave === orden.clave) ?? COLUMNAS[COLUMNAS.length - 1];
    return [...filtradas].sort((a, b) => {
      const x = col.valor(a), y = col.valor(b);
      return orden.asc ? x.localeCompare(y, 'es') : y.localeCompare(x, 'es');
    });
  }, [data, busca, orden]);

  const estadosPresentes = useMemo(
    () => Object.keys(ESTADOS).filter(k => data.some(e => e.estado === k)),
    [data],
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Listado de legalizaciones</h3>
          <p className="text-[11px] text-slate-500">
            {filas.length} {filas.length === 1 ? 'expediente' : 'expedientes'}
            {busca ? ' con la búsqueda' : ''} · se ordena pulsando en el título de la columna
          </p>
        </div>
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={archivados}
            onChange={e => setArchivados(e.target.checked)}
            className="accent-brand"
          />
          Ver también los archivados
        </label>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar en el listado..."
            className="w-56 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>

      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-slate-50 z-10">
            <tr>
              {COLUMNAS.map(c => (
                <th
                  key={c.clave}
                  onClick={() => setOrden(o => ({ clave: c.clave, asc: o.clave === c.clave ? !o.asc : true }))}
                  className={`text-left font-semibold text-slate-600 px-3 py-2 border-b border-slate-200 cursor-pointer select-none whitespace-nowrap ${c.ancho ?? ''}`}
                  title="Pulsa para ordenar por esta columna"
                >
                  <span className="inline-flex items-center gap-1">
                    {c.titulo}
                    {orden.clave === c.clave && (orden.asc ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map(e => {
              const estado = ESTADOS[e.estado] ?? COLOR_POR_DEFECTO;
              return (
                <tr key={e.id} className={`${estado.fila} hover:bg-brand/5`}>
                  {COLUMNAS.map(c => (
                    <td
                      key={c.clave}
                      className={`px-3 py-1.5 border-b border-slate-100 ${
                        c.clave === 'cliente' ? 'text-slate-800' : 'text-slate-600'
                      } ${c.clave === 'codigo' ? 'font-medium' : ''} truncate`}
                      title={c.valor(e)}
                    >
                      {c.valor(e) || <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
            {!isLoading && filas.length === 0 && (
              <tr>
                <td colSpan={COLUMNAS.length} className="px-3 py-8 text-center text-slate-400">
                  No hay expedientes que enseñar{busca ? ' con esa búsqueda' : ''}.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={COLUMNAS.length} className="px-3 py-8 text-center text-slate-400">
                  Cargando el listado...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Leyenda de colores, como la que lleva su hoja al pie */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-t border-slate-100 text-[11px] text-slate-500">
        {(estadosPresentes.length ? estadosPresentes : Object.keys(ESTADOS)).map(k => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-sm ${ESTADOS[k].punto}`} />
            {ESTADOS[k].etiqueta}
          </span>
        ))}
      </div>
    </div>
  );
}

export default ListadoLegalizaciones;
