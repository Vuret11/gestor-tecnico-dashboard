import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, Filter, Search, X } from 'lucide-react';
import { legalizaciones as legApi } from '../api/endpoints';
import type { Legalizacion } from '../types';

/**
 * LISTADO de legalizaciones, al final de la pantalla, con la forma de la hoja que lleva Salva (lo pidió
 * el 7-oct-2026 con una captura de su Excel delante): una fila por expediente y las columnas Código,
 * Partner, C. Autónoma, Tipo de instalación, Nombre, Estado, Fecha y Facturada, con la fila coloreada
 * según el estado, leyenda de colores al pie y **filtro en cada columna** (como el autofiltro de su
 * hoja: se escribe para buscar o se marcan los valores que se quieren ver).
 *
 * El «Facturada» se marca desde aquí mismo, pulsando la casilla de la fila.
 */

/** Los estados del trámite con su rótulo y el color de la fila (los mismos que las barras del resumen). */
/**
 * El estado que se ve en el listado. Se saca del propio trámite —bloqueado o la etapa «Finalizado»—,
 * no de un campo escrito a mano, así cambia solo al mover la tarjeta de columna (Salva, 7-oct-2026):
 * finalizada en verde, en curso en gris y bloqueada en rojo.
 */
type EstadoListado = 'finalizado' | 'en_curso' | 'bloqueado';

const estadoDe = (e: Legalizacion): EstadoListado => {
  // Está finalizada si tiene fecha de finalización (el botón «Finalizar trámite») o si tiene marcada la
  // etapa «Finalizado». Manda eso antes que el «bloqueado» de la base (Salva, 7-oct-2026: «la
  // instalación de Salva está finalizada y en el listado sale bloqueada»).
  if (e.fecha_fin || (e.etapas_hechas ?? []).includes('finalizado')) return 'finalizado';
  return e.estado === 'bloqueado' ? 'bloqueado' : 'en_curso';
};

const ESTADOS: Record<EstadoListado, { etiqueta: string; fila: string; punto: string }> = {
  finalizado: { etiqueta: 'Finalizado', fila: 'bg-green-50', punto: 'bg-green-500' },
  en_curso: { etiqueta: 'En curso', fila: '', punto: 'bg-slate-300' },
  bloqueado: { etiqueta: 'Bloqueada', fila: 'bg-red-50', punto: 'bg-red-400' },
};

/** Tipo de instalación: de qué va el expediente (RITE = clima, FV = fotovoltaica). */
function tipoDe(e: Legalizacion): string {
  const texto = `${e.maquina ?? ''} ${e.motivo ?? ''}`.toLowerCase();
  if (/solar|fotovolt|inversor|placa|panel|string/.test(texto)) return 'FV';
  return 'RITE';
}


/** ¿La columna es de fechas? Se enseñan cortas y el buscador las entiende igual. */
const esFecha = (clave: string) => clave === 'inicio' || clave === 'fin';

/** La fecha en corto para la tabla («07/10/26»). */
const fechaCorta = (iso: string) => {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return d && m && a ? `${d}/${m}/${a.slice(2)}` : iso;
};

type Columna = {
  clave: string;
  titulo: string;
  valor: (e: Legalizacion) => string;
  ancho?: string;
  /** Las columnas de sí/no se filtran con Sí y No en lugar de con la lista de valores. */
  siNo?: boolean;
};

const COLUMNAS: Columna[] = [
  // El «código» de su hoja es el número de obra del expediente (y si aún no lo tiene, el del CRM).
  { clave: 'codigo', titulo: 'Código', valor: e => e.num_obra || (e.id_externo ? String(e.id_externo) : ''), ancho: 'w-28' },
  { clave: 'partner', titulo: 'Partner', valor: e => e.partner ?? '', ancho: 'w-32' },
  { clave: 'comunidad', titulo: 'C. Autónoma', valor: e => e.comunidad || e.provincia || '', ancho: 'w-40' },
  { clave: 'tipo', titulo: 'Tipo inst.', valor: e => tipoDe(e), ancho: 'w-24' },
  { clave: 'cliente', titulo: 'Nombre', valor: e => e.cliente ?? '' },
  { clave: 'estado', titulo: 'Estado', valor: e => ESTADOS[estadoDe(e)].etiqueta, ancho: 'w-40' },
  { clave: 'inicio', titulo: 'Inicio', valor: e => (e.fecha_inicio ?? '').split('T')[0], ancho: 'w-24' },
  { clave: 'fin', titulo: 'Finalización', valor: e => (e.fecha_fin ?? '').split('T')[0], ancho: 'w-28' },
  { clave: 'facturada', titulo: 'Facturada', valor: e => (e.facturada ? 'Sí' : 'No'), ancho: 'w-24', siNo: true },
];

/** Lo que se está filtrando en una columna: un texto libre y/o una lista de valores marcados. */
type Filtro = { texto: string; valores: string[] };

export function ListadoLegalizaciones() {
  const qc = useQueryClient();
  const [archivados, setArchivados] = useState(false);
  const [busca, setBusca] = useState('');
  const [orden, setOrden] = useState<{ clave: string; asc: boolean }>({ clave: 'inicio', asc: false });
  const [filtros, setFiltros] = useState<Record<string, Filtro>>({});
  /** Dónde se ha pulsado el embudo, para colgar el desplegable justo debajo de esa columna. */
  const [filtroAbierto, setFiltroAbierto] = useState<{ clave: string; x: number; y: number } | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['legalizaciones-listado', archivados],
    queryFn: () => legApi.list(archivados ? { archivados: '1' } : undefined),
  });

  /** Marca o desmarca «Facturada» desde la propia fila. */
  const facturar = useMutation({
    mutationFn: ({ id, facturada }: { id: string; facturada: boolean }) => legApi.update(id, { facturada }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['legalizaciones-listado'] });
      await qc.invalidateQueries({ queryKey: ['legalizaciones'] });
    },
  });

  const filtroDe = (clave: string): Filtro => filtros[clave] ?? { texto: '', valores: [] };
  const hayFiltro = (clave: string) => {
    const f = filtroDe(clave);
    return f.texto.trim() !== '' || f.valores.length > 0;
  };
  const cuantasFiltradas = COLUMNAS.filter(c => hayFiltro(c.clave)).length;

  const filas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const pasa = (e: Legalizacion) => {
      if (t) {
        const enAlguna = COLUMNAS.some(c =>
          c.valor(e).toLowerCase().includes(t) || (esFecha(c.clave) && fechaCorta(c.valor(e)).includes(t)));
        if (!enAlguna) return false;
      }
      for (const c of COLUMNAS) {
        const f = filtros[c.clave];
        if (!f) continue;
        const valor = c.valor(e);
        if (f.valores.length > 0 && !f.valores.includes(valor)) return false;
        const texto = f.texto.trim().toLowerCase();
        if (texto && !valor.toLowerCase().includes(texto) &&
            !(esFecha(c.clave) && fechaCorta(valor).includes(texto))) return false;
      }
      return true;
    };
    const col = COLUMNAS.find(c => c.clave === orden.clave) ?? COLUMNAS[COLUMNAS.length - 1];
    return data.filter(pasa).sort((a, b) => {
      const x = col.valor(a), y = col.valor(b);
      return orden.asc ? x.localeCompare(y, 'es') : y.localeCompare(x, 'es');
    });
  }, [data, busca, filtros, orden]);

  /** Los valores distintos de una columna, con cuántos hay de cada uno (para el desplegable). */
  const valoresDe = (c: Columna): [string, number][] => {
    const cuenta = new Map<string, number>();
    for (const e of data) {
      const v = c.valor(e) || '';
      cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
    }
    return [...cuenta.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  };

  const estadosPresentes = useMemo(
    () => (['en_curso', 'finalizado', 'bloqueado'] as EstadoListado[]).filter(k => data.some(e => estadoDe(e) === k)),
    [data],
  );

  const columnasConFiltro = COLUMNAS.filter(c => hayFiltro(c.clave));

  const marcarValor = (c: Columna, valor: string) => {
    setFiltros(f => {
      const actual = f[c.clave] ?? { texto: '', valores: [] };
      const valores = actual.valores.includes(valor)
        ? actual.valores.filter(v => v !== valor)
        : [...actual.valores, valor];
      return { ...f, [c.clave]: { ...actual, valores } };
    });
  };

  const columnaAbierta = filtroAbierto ? COLUMNAS.find(c => c.clave === filtroAbierto.clave) ?? null : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Listado de legalizaciones</h3>
          <p className="text-[11px] text-slate-500">
            {filas.length} de {data.length} {data.length === 1 ? 'expediente' : 'expedientes'}
            {cuantasFiltradas > 0 ? ` · ${cuantasFiltradas} ${cuantasFiltradas === 1 ? 'columna filtrada' : 'columnas filtradas'}` : ''}
            {' '}· se ordena pulsando en el título y se filtra con el embudo de cada columna
          </p>
        </div>
        <div className="flex-1" />
        {cuantasFiltradas > 0 && (
          <button
            onClick={() => setFiltros({})}
            className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
          >
            <X size={12} /> Quitar los filtros
          </button>
        )}
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

      {/* Lo que se está filtrando, dicho en claro (y se quita pulsando la cruz) */}
      {columnasConFiltro.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50/60">
          {columnasConFiltro.map(c => {
            const f = filtroDe(c.clave);
            const detalle = [
              f.valores.length ? `en: ${f.valores.map(v => v || '(en blanco)').join(', ')}` : '',
              f.texto.trim() ? `contiene «${f.texto.trim()}»` : '',
            ].filter(Boolean).join(' y ');
            return (
              <span key={c.clave} className="inline-flex items-center gap-1 text-[11px] bg-white border border-slate-200 rounded-full px-2 py-0.5 text-slate-600">
                <Filter size={10} className="text-brand" />
                <strong className="font-medium">{c.titulo}</strong>: {detalle}
                <button
                  onClick={() => setFiltros(prev => {
                    const copia = { ...prev };
                    delete copia[c.clave];
                    return copia;
                  })}
                  className="text-slate-400 hover:text-slate-700"
                  title="Quitar este filtro"
                >
                  <X size={11} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="max-h-[560px] overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-slate-50 z-10">
            <tr>
              {COLUMNAS.map(c => (
                <th key={c.clave} className={`text-left font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap px-3 py-2 ${c.ancho ?? ''}`}>
                  <span className="inline-flex items-center gap-1">
                    <button
                      onClick={() => setOrden(o => ({ clave: c.clave, asc: o.clave === c.clave ? !o.asc : true }))}
                      className="inline-flex items-center gap-1 hover:text-brand"
                      title="Pulsa para ordenar por esta columna"
                    >
                      {c.titulo}
                      {orden.clave === c.clave && (orden.asc ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                    </button>
                    <button
                      onClick={ev => {
                        const r = ev.currentTarget.getBoundingClientRect();
                        setFiltroAbierto(f => (f?.clave === c.clave ? null : { clave: c.clave, x: r.left, y: r.bottom + 4 }));
                      }}
                      title={`Filtrar por ${c.titulo}`}
                      className={`p-0.5 rounded hover:bg-slate-200 ${hayFiltro(c.clave) ? 'text-brand' : 'text-slate-400'}`}
                    >
                      <Filter size={12} />
                    </button>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map(e => {
              const estado = ESTADOS[estadoDe(e)];
              return (
                <tr key={e.id} className={`${estado.fila} hover:bg-brand/5`}>
                  {COLUMNAS.map(c => (
                    <td
                      key={c.clave}
                      className={`px-3 py-1.5 border-b border-slate-100 ${
                        c.clave === 'cliente' ? 'text-slate-800' : 'text-slate-600'
                      } ${c.clave === 'codigo' ? 'font-medium' : ''} truncate`}
                      title={esFecha(c.clave) ? fechaCorta(c.valor(e)) : c.valor(e)}
                    >
                      {c.clave === 'facturada' ? (
                        <button
                          onClick={() => facturar.mutate({ id: e.id, facturada: !e.facturada })}
                          disabled={facturar.isPending}
                          title={e.facturada ? 'Facturada: pulsa para desmarcar' : 'Sin facturar: pulsa para marcar'}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] ${
                            e.facturada
                              ? 'bg-green-50 border-green-300 text-green-700'
                              : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                          }`}
                        >
                          {e.facturada && <Check size={11} />} {e.facturada ? 'Facturada' : 'No'}
                        </button>
                      ) : esFecha(c.clave) && c.valor(e) ? (
                        fechaCorta(c.valor(e))
                      ) : (
                        c.valor(e) || <span className="text-slate-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
            {!isLoading && filas.length === 0 && (
              <tr>
                <td colSpan={COLUMNAS.length} className="px-3 py-8 text-center text-slate-400">
                  No hay expedientes que enseñar con esos filtros.
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

      {/* El desplegable del filtro de una columna, colgado debajo de su embudo */}
      {columnaAbierta && filtroAbierto && (() => {
        const c = columnaAbierta;
        const f = filtroDe(c.clave);
        const valores: [string, string][] = c.siNo
          ? [['Sí', 'Sí'], ['No', 'No']]
          : valoresDe(c).map(([v, n]) => [v, `${v || '(en blanco)'} (${n})`]);
        const ancho = 256;
        const izquierda = Math.min(filtroAbierto.x, Math.max(8, window.innerWidth - ancho - 8));
        return (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setFiltroAbierto(null)} />
            <div
              className="fixed z-30 bg-white border border-slate-200 rounded-xl shadow-xl p-3"
              style={{ left: izquierda, top: filtroAbierto.y, width: ancho }}
            >
              <p className="text-xs font-semibold text-slate-700 mb-2">Filtrar por {c.titulo}</p>
              <input
                autoFocus
                value={f.texto}
                onChange={ev => setFiltros(prev => ({ ...prev, [c.clave]: { ...f, texto: ev.target.value } }))}
                placeholder="Escribe para buscar..."
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs mb-2 focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <div className="max-h-52 overflow-auto space-y-0.5">
                {valores.map(([valor, etiqueta]) => (
                  <label key={valor || '(en blanco)'} className="flex items-center gap-2 px-1 py-0.5 text-xs text-slate-600 hover:bg-slate-50 rounded">
                    <input
                      type="checkbox"
                      checked={f.valores.includes(valor)}
                      onChange={() => marcarValor(c, valor)}
                      className="accent-brand"
                    />
                    <span className="truncate">{etiqueta}</span>
                  </label>
                ))}
                {valores.length === 0 && <p className="text-xs text-slate-400 px-1">No hay valores.</p>}
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setFiltros(prev => {
                    const copia = { ...prev };
                    delete copia[c.clave];
                    return copia;
                  })}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Quitar este filtro
                </button>
                <button onClick={() => setFiltroAbierto(null)} className="text-xs text-brand font-medium">
                  Hecho
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* Leyenda de colores, como la que lleva su hoja al pie */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-t border-slate-100 text-[11px] text-slate-500">
        {(estadosPresentes.length ? estadosPresentes : Object.keys(ESTADOS)).map(k => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-sm ${ESTADOS[k as EstadoListado].punto}`} />
            {ESTADOS[k as EstadoListado].etiqueta}
          </span>
        ))}
      </div>
    </div>
  );
}

export default ListadoLegalizaciones;
