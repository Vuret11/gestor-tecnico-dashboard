import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Download, History, Printer } from 'lucide-react';
import { legalizaciones as legApi } from '../api/endpoints';
import type { Legalizacion } from '../types';

/**
 * Auditorías · historial de legalizaciones descargable.
 *
 * Salva, 7-oct-2026: «también quiero dentro de legalización un apartado de auditorías, para poder
 * descargar un historial de legalizaciones por semanas, mes y año, también por partner o tipo de
 * instalación». Se apoya en la lista completa de trámites (incluidos los archivados) y filtra en el
 * navegador: no hace falta endpoint nuevo.
 */

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Tipos de instalación de la base (`legalizaciones.tipo_instalacion`). */
const TIPOS_INSTALACION = ['NUEVA', 'REFORMA'];

/** Usos de la máquina (`legalizaciones.tipo_uso`). */
const USOS: Record<string, string> = {
  CLIMATIZACION_ACS: 'Climatización + ACS',
  SOLO_ACS: 'Solo ACS',
  SOLO_CLIMATIZACION: 'Solo climatización',
  HIBRIDA_CALDERA: 'Híbrida con caldera',
};

/** El estado, igual que en el listado: sale del propio trámite y cambia solo (Salva, 7-oct-2026). */
const estadoDe = (t: Legalizacion) => {
  // Igual que en el listado: finalizada por su fecha de finalización o por la etapa «Finalizado»,
  // aunque la base la tenga por bloquear (Salva, 7-oct-2026).
  if (t.fecha_fin || (t.etapas_hechas ?? []).includes('finalizado')) return 'finalizado';
  return t.estado === 'bloqueado' ? 'bloqueado' : 'en_curso';
};

const ESTADOS: Record<string, string> = {
  finalizado: 'Finalizado',
  en_curso: 'En curso',
  bloqueado: 'Bloqueada',
};

/** ¿Es de clima o de fotovoltaica? Igual que en el apartado: mira la máquina y el motivo. */
type TipoInstal = 'clima' | 'fotovoltaica' | 'todas';

const tipoInstalacion = (e: Legalizacion): 'clima' | 'fotovoltaica' => {
  const texto = `${e.maquina ?? ''} ${e.motivo ?? ''}`.toLowerCase();
  return /solar|fotovolt|inversor|placa|panel|string/.test(texto) ? 'fotovoltaica' : 'clima';
};

/** La marca de la máquina: la primera palabra de su nombre. */
const marcaDe = (m?: string | null) => (m ?? '').trim().split(/\s+/)[0] ?? '';

/** El modelo: el nombre de la máquina sin la marca delante ni la potencia del final. */
const modeloDe = (m?: string | null) =>
  (m ?? '').trim().replace(/^\S+\s*/, '').replace(/\s*-\s*[\d.,]+\s*$/, '').trim();

const ETAPAS: Record<string, string> = {
  inicio: 'Inicio',
  subida_portal: 'Subida portal',
  finalizado: 'Finalizado',
};

/** Los cinco partners que dictó Salva, más los que ya estén en los datos. */
const PARTNERS_BASE = ['Solfy', 'Oscagas', 'B2C', 'Hidalgas', 'Obra Nueva'];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dia = (v?: string | null) => (v ?? '').slice(0, 10);
const bonito = (v?: string | null) => {
  const s = dia(v);
  return s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—';
};

type Periodo = 'semana' | 'mes' | 'año' | 'todo';

export function AuditoriaLegalizaciones({ tipoApartado = 'todas' }: { tipoApartado?: TipoInstal } = {}) {
  const hoy = iso(new Date());
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [fecha, setFecha] = useState(hoy);
  const [campo, setCampo] = useState<'inicio' | 'fin'>('inicio');
  const [partner, setPartner] = useState('');
  const [tipo, setTipo] = useState('');
  const [uso, setUso] = useState('');
  const [estado, setEstado] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [potMin, setPotMin] = useState('');
  const [potMax, setPotMax] = useState('');

  // Se piden TODOS los trámites, archivados incluidos: el historial tiene que ver el pasado entero.
  const { data, isLoading } = useQuery({
    queryKey: ['legalizaciones-auditoria'],
    queryFn: () => legApi.list({ archivados: '1' }),
  });
  // Solo el tipo del apartado en el que estamos: en Fotovoltaica no salen las obras de clima
  // (Salva, 7-oct-2026).
  const todos = useMemo(
    () => ((data ?? []) as Legalizacion[]).filter((t) => tipoApartado === 'todas' || tipoInstalacion(t) === tipoApartado),
    [data, tipoApartado],
  );

  const partners = useMemo(() => {
    const enDatos = todos.map((t) => (t.partner ?? '').trim()).filter(Boolean);
    const fuera = Array.from(new Set(enDatos)).filter((p) => !PARTNERS_BASE.includes(p));
    return [...PARTNERS_BASE, ...fuera.sort()];
  }, [todos]);

  /** Marcas que aparecen en las máquinas de los trámites (para el desplegable). */
  const marcas = useMemo(
    () => Array.from(new Set(todos.map((t) => marcaDe(t.maquina)).filter(Boolean))).sort(),
    [todos],
  );

  /** Modelos: si hay marca elegida, solo los suyos. */
  const modelos = useMemo(
    () =>
      Array.from(
        new Set(
          todos
            .filter((t) => !marca || marcaDe(t.maquina) === marca)
            .map((t) => modeloDe(t.maquina))
            .filter(Boolean),
        ),
      ).sort(),
    [todos, marca],
  );

  /** La ventana de fechas según el periodo elegido (semana = lunes a domingo). */
  const rango = useMemo(() => {
    if (periodo === 'todo') return { desde: '', hasta: '', etiqueta: 'Todo el histórico' };
    const d = new Date(`${fecha}T00:00:00`);
    if (periodo === 'semana') {
      const desde = new Date(d);
      desde.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lunes
      const hasta = new Date(desde);
      hasta.setDate(desde.getDate() + 6); // domingo
      return { desde: iso(desde), hasta: iso(hasta), etiqueta: `Semana del ${bonito(iso(desde))} al ${bonito(iso(hasta))}` };
    }
    if (periodo === 'mes') {
      const desde = new Date(d.getFullYear(), d.getMonth(), 1);
      const hasta = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { desde: iso(desde), hasta: iso(hasta), etiqueta: `${MESES[d.getMonth()]} de ${d.getFullYear()}` };
    }
    return { desde: `${d.getFullYear()}-01-01`, hasta: `${d.getFullYear()}-12-31`, etiqueta: `Año ${d.getFullYear()}` };
  }, [periodo, fecha]);

  const filas = useMemo(() => {
    return todos
      .filter((t) => {
        const f = dia(campo === 'fin' ? t.fecha_fin : t.fecha_inicio);
        if (rango.desde && (!f || f < rango.desde || f > rango.hasta)) return false;
        if (partner && (t.partner ?? '').trim() !== partner) return false;
        if (tipo && (t.tipo_instalacion ?? '') !== tipo) return false;
        if (uso && (t.tipo_uso ?? '') !== uso) return false;
        if (estado && estadoDe(t) !== estado) return false;
        if (marca && marcaDe(t.maquina) !== marca) return false;
        if (modelo && modeloDe(t.maquina) !== modelo) return false;
        if (potMin && Number(t.potencia ?? 0) < Number(potMin)) return false;
        if (potMax && Number(t.potencia ?? 0) > Number(potMax)) return false;
        return true;
      })
      .sort((a, b) => dia(campo === 'fin' ? b.fecha_fin : b.fecha_inicio).localeCompare(dia(campo === 'fin' ? a.fecha_fin : a.fecha_inicio)));
  }, [todos, rango, campo, partner, tipo, uso, estado, marca, modelo, potMin, potMax]);

  const resumen = useMemo(() => {
    const cuenta = (clave: (t: Legalizacion) => string) => {
      const m = new Map<string, number>();
      filas.forEach((t) => m.set(clave(t), (m.get(clave(t)) ?? 0) + 1));
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    };
    return {
      porPartner: cuenta((t) => (t.partner ?? '').trim() || 'Sin partner'),
      porTipo: cuenta((t) => (t.tipo_instalacion ?? '') || 'Sin tipo'),
      facturadas: filas.filter((t) => t.facturada).length,
    };
  }, [filas]);

  // Orden de las columnas que ha pedido Salva el 7-oct-2026: Expediente · Partner · Cliente · Provincia
  // · Municipio y el resto como estaba.
  const fila = (t: Legalizacion) => [
    t.id_externo ?? '',
    (t.partner ?? '').trim(),
    t.cliente ?? '',
    t.provincia ?? '',
    t.municipio ?? '',
    t.tipo_instalacion ?? '',
    USOS[t.tipo_uso ?? ''] ?? t.tipo_uso ?? '',
    ESTADOS[estadoDe(t)],
    dia(t.fecha_inicio),
    dia(t.fecha_fin),
    (t.etapas_hechas ?? []).map((e) => ETAPAS[e] ?? e).join(' + '),
    t.facturada ? 'Sí' : 'No',
    t.maquina ?? '',
    t.num_obra ?? '',
  ];

  const cabeza = [
    'Expediente', 'Partner', 'Cliente', 'Provincia', 'Municipio', 'Tipo instalación', 'Tipo de uso',
    'Estado', 'Inicio', 'Fin', 'Etapas', 'Facturada', 'Máquina', 'Nº obra',
  ];

  /** Descarga el historial filtrado en CSV (Excel en español: punto y coma y BOM para los acentos). */
  const descargar = () => {
    const csv = [cabeza, ...filas.map(fila)]
      .map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial-legalizaciones-${periodo}-${rango.desde || 'todo'}${rango.hasta ? `_${rango.hasta}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selector = (
    etiqueta: string,
    valor: string,
    cambia: (v: string) => void,
    opciones: { v: string; n: string }[],
  ) => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-slate-500">{etiqueta}</span>
      <select
        value={valor}
        onChange={(ev) => cambia(ev.target.value)}
        className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
      >
        {opciones.map((o) => (
          <option key={o.v} value={o.v}>{o.n}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-slate-900 inline-flex items-center gap-2">
            <History size={16} /> Auditorías · historial de legalizaciones
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Elige semana, mes o año y luego partner o tipo de instalación. Se puede descargar en Excel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={descargar}
            disabled={!filas.length}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-brand text-white hover:opacity-90 disabled:opacity-50"
          >
            <Download size={14} /> Descargar Excel (CSV)
          </button>
          <button
            onClick={() => window.print()}
            disabled={!filas.length}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Printer size={14} /> Imprimir / PDF
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-500">Periodo</span>
          <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
            {(['semana', 'mes', 'año', 'todo'] as Periodo[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 text-sm capitalize ${periodo === p ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </label>

        {periodo !== 'todo' && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-500">Fecha de referencia</span>
            <input
              type="date"
              value={fecha}
              onChange={(ev) => setFecha(ev.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
        )}

        {selector('Filtrar por fecha de', campo, (v) => setCampo(v as 'inicio' | 'fin'), [
          { v: 'inicio', n: 'Inicio del expediente' },
          { v: 'fin', n: 'Finalización' },
        ])}

        {selector('Partner', partner, setPartner, [
          { v: '', n: 'Todos los partners' },
          ...partners.map((p) => ({ v: p, n: p })),
        ])}

        {selector('Tipo de instalación', tipo, setTipo, [
          { v: '', n: 'Todos los tipos' },
          ...TIPOS_INSTALACION.map((t) => ({ v: t, n: t })),
        ])}

        {selector('Tipo de uso', uso, setUso, [
          { v: '', n: 'Todos los usos' },
          ...Object.entries(USOS).map(([v, n]) => ({ v, n })),
        ])}

        {selector('Estado', estado, setEstado, [
          { v: '', n: 'Todos los estados' },
          ...Object.entries(ESTADOS).map(([v, n]) => ({ v, n })),
        ])}

        {selector('Marca', marca, (v) => { setMarca(v); setModelo(''); }, [
          { v: '', n: 'Todas las marcas' },
          ...marcas.map((m) => ({ v: m, n: m })),
        ])}

        {selector('Modelo', modelo, setModelo, [
          { v: '', n: marca ? `Todos los de ${marca}` : 'Todos los modelos' },
          ...modelos.map((m) => ({ v: m, n: m })),
        ])}

        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-500">Potencia (kW)</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={potMin}
              onChange={(ev) => setPotMin(ev.target.value)}
              placeholder="desde"
              className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <span className="text-slate-400 text-sm">–</span>
            <input
              type="number"
              value={potMax}
              onChange={(ev) => setPotMax(ev.target.value)}
              placeholder="hasta"
              className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </label>

        {(partner || tipo || uso || estado || marca || modelo || potMin || potMax || periodo !== 'todo') && (
          <button
            onClick={() => { setPartner(''); setTipo(''); setUso(''); setEstado(''); setMarca(''); setModelo(''); setPotMin(''); setPotMax(''); setPeriodo('todo'); }}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Quitar filtros
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-[11px] text-slate-500 uppercase tracking-wide inline-flex items-center gap-1">
            <CalendarDays size={12} /> Periodo
          </p>
          <p className="text-sm font-medium text-slate-900 mt-0.5">{rango.etiqueta}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-[11px] text-slate-500 uppercase tracking-wide">Legalizaciones</p>
          <p className="text-xl font-semibold text-slate-900">{filas.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-[11px] text-slate-500 uppercase tracking-wide">Facturadas</p>
          <p className="text-xl font-semibold text-slate-900">
            {resumen.facturadas} <span className="text-xs font-normal text-slate-500">de {filas.length}</span>
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-[11px] text-slate-500 uppercase tracking-wide">Por partner</p>
          <p className="text-[11px] text-slate-700 mt-0.5">
            {resumen.porPartner.length
              ? resumen.porPartner.map(([p, n]) => `${p}: ${n}`).join(' · ')
              : '—'}
          </p>
        </div>
      </div>

      <div className="mt-3 overflow-auto max-h-[420px] border border-slate-200 rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              {cabeza.map((c) => (
                <th key={c} className="text-left font-medium text-slate-600 px-2 py-2 whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                {fila(t).map((c, i) => (
                  <td key={i} className="px-2 py-1.5 text-slate-700 whitespace-nowrap">{c || '—'}</td>
                ))}
              </tr>
            ))}
            {!filas.length && (
              <tr>
                <td colSpan={cabeza.length} className="px-2 py-6 text-center text-slate-400">
                  {isLoading ? 'Cargando…' : 'No hay legalizaciones con esos filtros.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400 mt-2">
        {filas.length} legalizaciones · el historial se filtra por {campo === 'fin' ? 'la fecha de finalización' : 'la fecha de inicio del expediente'}.
      </p>
    </div>
  );
}
