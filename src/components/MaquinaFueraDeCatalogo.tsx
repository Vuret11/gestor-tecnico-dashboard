import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { maquinasApi } from '../api/endpoints';
import type { DatoLeido, FichaCandidata, FichaLeida, MaquinaCatalogo } from '../api/endpoints';
import { Check, FileText, Loader2, Search, Upload, X } from 'lucide-react';

/**
 * MÁQUINA QUE NO ESTÁ EN EL CATÁLOGO (petición de Salva, 7-oct-2026: «da la opción de poner máquinas
 * que no tengas en el catálogo y buscas la ficha técnica»).
 *
 * El bloque de máquinas del alta solo ofrece lo que hay en el catálogo, así que una máquina nueva
 * (otra marca, un modelo que nadie ha legalizado todavía) no se podía declarar. Aquí se pide su marca
 * y su modelo, se BUSCA la ficha técnica en la web, se LEE el documento elegido y se enseñan los
 * valores que la ficha publica **con el trozo de texto del que sale cada uno**, para poder
 * comprobarlos. Al guardar, la máquina queda en el catálogo (y en la instalación) como una más.
 *
 * Regla de la casa, y es la razón de que se enseñe la evidencia: lo que la ficha no publica queda
 * VACÍO. No se rellena «lo que debería ser» — un valor inventado en un documento oficial es peor que
 * un hueco.
 */
type Props = {
  /** La máquina ya guardada en el catálogo: el alta del trámite la añade a la instalación. */
  onAnadida: (maquina: MaquinaCatalogo, etiqueta: string) => void;
  onCerrar: () => void;
};

/** Los campos que se rellenan a mano o con lo leído de la ficha, en el orden en que se piden. */
const CAMPOS: { clave: string; etiqueta: string; numero?: boolean; ayuda?: string }[] = [
  { clave: 'fabricante', etiqueta: 'Marca / fabricante' },
  { clave: 'modelo', etiqueta: 'Modelo' },
  { clave: 'gama', etiqueta: 'Gama (opcional)' },
  { clave: 'codigo_fabricante', etiqueta: 'Referencia del fabricante (opcional)' },
  { clave: 'refrigerante', etiqueta: 'Refrigerante', ayuda: 'R32, R290, R410A…' },
  { clave: 'carga_refrigerante_kg', etiqueta: 'Carga de refrigerante (kg)', numero: true },
  { clave: 'gwp_refrigerante', etiqueta: 'PCA / GWP (kg CO₂eq)', numero: true },
  { clave: 'potencia_calorifica_kw', etiqueta: 'Potencia calorífica (kW)', numero: true },
  { clave: 'potencia_frigorifica_kw', etiqueta: 'Potencia frigorífica (kW)', numero: true },
  { clave: 'cop_35', etiqueta: 'COP a A7/W35', numero: true, ayuda: 'el de suelo radiante y fancoils' },
  { clave: 'cop_55', etiqueta: 'COP a A7/W55', numero: true, ayuda: 'el de radiadores' },
  { clave: 'eer_7', etiqueta: 'EER a A35/W7', numero: true, ayuda: 'el de fancoils' },
  { clave: 'eer_18', etiqueta: 'EER a A35/W18', numero: true, ayuda: 'el de suelo radiante' },
  { clave: 'scop_medio_35c', etiqueta: 'SCOP (calefacción)', numero: true },
  { clave: 'scop_dhw_medio', etiqueta: 'SCOP de ACS', numero: true, ayuda: 'el SPF del RITE' },
  { clave: 'alimentacion', etiqueta: 'Alimentación', ayuda: 'MONOFASICA 230 V / TRIFASICA 400 V' },
];

const USOS_MAQUINA: [string, string][] = [
  ['CLIMATIZACION_ACS', 'Climatización + ACS'],
  ['SOLO_CLIMATIZACION', 'Climatización sola (sin ACS)'],
  ['SOLO_ACS', 'Solo ACS'],
];

/** Cómo se llama cada campo de la ficha en la caja a la que va. */
const CAMPO_A_CAJA: Record<string, string> = {
  refrigerante: 'refrigerante',
  carga_refrigerante_kg: 'carga_refrigerante_kg',
  gwp_refrigerante: 'gwp_refrigerante',
  potencia_calorifica_kw: 'potencia_calorifica_kw',
  potencia_frigorifica_kw: 'potencia_frigorifica_kw',
  scop_medio_35c: 'scop_medio_35c',
  scop_dhw_medio: 'scop_dhw_medio',
  alimentacion: 'alimentacion',
};

export default function MaquinaFueraDeCatalogo({ onAnadida, onCerrar }: Props) {
  const qc = useQueryClient();
  const [fabricante, setFabricante] = useState('');
  const [modelo, setModelo] = useState('');
  const [tipoUso, setTipoUso] = useState('CLIMATIZACION_ACS');
  const [candidatas, setCandidatas] = useState<FichaCandidata[]>([]);
  const [leida, setLeida] = useState<FichaLeida | null>(null);
  const [datos, setDatos] = useState<Record<string, string>>({});
  const [evidencias, setEvidencias] = useState<Record<string, string>>({});
  /** Valores que la ficha trae en una fila con varios modelos: se enseñan, pero no se copian solos. */
  const [dudosos, setDudosos] = useState<DatoLeido[]>([]);
  const [enlace, setEnlace] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const textoError = (e: any) =>
    `${e?.response?.data?.message ?? e?.message ?? 'Error del servidor'}` +
    (e?.response?.status ? ` (código ${e.response.status})` : '');

  /** Lo leído de la ficha se vuelca en sus cajas; el COP y el EER, en su punto de ensayo. */
  const volcar = (ficha: FichaLeida) => {
    const nuevos: Record<string, string> = {};
    const evidenciasNuevas: Record<string, string> = {};
    const dudosos: DatoLeido[] = [];
    for (const dato of ficha.datos) {
      const evidencia = String(dato.evidencia ?? '');
      let clave = CAMPO_A_CAJA[dato.campo];
      if (dato.campo === 'cop') clave = /55\s*º?C|W55/.test(evidencia) ? 'cop_55' : 'cop_35';
      if (dato.campo === 'eer') clave = /A?35\s*[/\- ]?\s*W?\s?18/.test(evidencia) ? 'eer_18' : 'eer_7';
      // El SEER y el ηs no tienen caja propia: se enseñan como dato leído y no se guardan.
      if (!clave) continue;
      // Un valor de una fila con VARIOS modelos no se copia solo: el de la fila es el primero y puede
      // ser el de otro tamaño (una máquina de 12 kW se quedaba con 4,2). Se enseña, y lo copia él.
      if (dato.dudoso) {
        dudosos.push(dato);
        continue;
      }
      nuevos[clave] = String(dato.valor);
      evidenciasNuevas[clave] = evidencia;
    }
    setLeida(ficha);
    setDatos(d => ({ ...d, ...nuevos }));
    setEvidencias(evidenciasNuevas);
    setDudosos(dudosos);
    const sinCaja = ficha.datos.filter(d => !CAMPO_A_CAJA[d.campo] && d.campo !== 'cop' && d.campo !== 'eer' && !d.dudoso);
    setAviso(sinCaja.length
      ? `De la ficha también se ha leído: ${sinCaja.map(d => `${d.etiqueta} = ${d.valor}`).join(' · ')} (no tiene casilla propia).`
      : '');
  };

  const buscar = useMutation({
    mutationFn: () => maquinasApi.buscarFichas(fabricante, modelo),
    onSuccess: (r) => {
      setError('');
      setCandidatas(r.candidatas);
      if (r.candidatas.length === 0) {
        setError(`La búsqueda «${r.consulta}» no ha devuelto ningún documento. Prueba con el nombre exacto del modelo o pega el enlace de la ficha.`);
      }
    },
    onError: (e: any) => { setError(textoError(e)); setCandidatas([]); },
  });

  const leer = useMutation({
    mutationFn: (url: string) => maquinasApi.leerFicha(url, fabricante, modelo),
    onSuccess: (ficha) => {
      setError('');
      volcar(ficha);
      if (ficha.datos.length === 0) {
        setError(`El documento se ha leído (${ficha.paginas} páginas) pero no se ha encontrado ningún dato etiquetado: rellena a mano lo que veas en la ficha y guarda.`);
      }
    },
    onError: (e: any) => setError(textoError(e)),
  });

  const subir = useMutation({
    mutationFn: (file: File) => maquinasApi.subirFicha(file, fabricante, modelo),
    onSuccess: (ficha) => { setError(''); volcar(ficha); },
    onError: (e: any) => setError(textoError(e)),
  });

  const guardar = useMutation({
    mutationFn: () => {
      const cuerpo: Record<string, unknown> = { tipo_uso: tipoUso };
      for (const def of CAMPOS) {
        const valor = String(datos[def.clave] ?? '').trim();
        if (valor === '') continue;
        if (def.numero) {
          const n = Number(valor.replace(',', '.'));
          if (Number.isFinite(n)) cuerpo[def.clave] = n;
        } else {
          cuerpo[def.clave] = valor;
        }
      }
      // Los rendimientos van a su PUNTO DE ENSAYO, que es de donde los lee el documento: el punto de
      // calefacción sale de los emisores (A7/W55 con radiadores, A7/W35 el resto) y el de refrigeración
      // también (A35/W18 suelo radiante, A35/W7 fancoils). Sin punto, el valor no llega al impreso.
      const num = (clave: string) => {
        const v = String(datos[clave] ?? '').trim();
        if (v === '') return undefined;
        const n = Number(v.replace(',', '.'));
        return Number.isFinite(n) ? n : undefined;
      };
      const potenciaCalorifica = num('potencia_calorifica_kw');
      const potenciaFrigorifica = num('potencia_frigorifica_kw');
      const puntos: Record<string, Record<string, number>> = {};
      const cop35 = num('cop_35'); const cop55 = num('cop_55');
      const eer7 = num('eer_7'); const eer18 = num('eer_18');
      if (cop35 !== undefined || potenciaCalorifica !== undefined) {
        puntos.A7W35 = { ...(cop35 !== undefined ? { COP: cop35 } : {}), ...(potenciaCalorifica !== undefined ? { potencia_calorifica_kW: potenciaCalorifica } : {}) };
      }
      if (cop55 !== undefined || potenciaCalorifica !== undefined) {
        puntos.A7W55 = { ...(cop55 !== undefined ? { COP: cop55 } : {}), ...(potenciaCalorifica !== undefined ? { potencia_calorifica_kW: potenciaCalorifica } : {}) };
      }
      if (eer7 !== undefined || potenciaFrigorifica !== undefined) {
        puntos.A35W7 = { ...(eer7 !== undefined ? { EER: eer7 } : {}), ...(potenciaFrigorifica !== undefined ? { potencia_frigorifica_kW: potenciaFrigorifica } : {}) };
      }
      if (eer18 !== undefined || potenciaFrigorifica !== undefined) {
        puntos.A35W18 = { ...(eer18 !== undefined ? { EER: eer18 } : {}), ...(potenciaFrigorifica !== undefined ? { potencia_frigorifica_kW: potenciaFrigorifica } : {}) };
      }
      if (Object.keys(puntos).length > 0) cuerpo.datos_variante = { puntos_ensayo_EN14511: puntos };
      // De dónde sale el dato: la ficha queda guardada en el servidor y su enlace, en la máquina.
      if (leida) {
        cuerpo.fuente_url = leida.fuente_url;
        cuerpo.fuente_documento = leida.fichero;
        cuerpo.fuente_paginas = leida.paginas ? `${leida.paginas} páginas` : null;
      }
      return maquinasApi.crear(cuerpo);
    },
    onSuccess: (creada) => {
      qc.invalidateQueries({ queryKey: ['maquinas-fabricantes'] });
      qc.invalidateQueries({ queryKey: ['maquinas-todas'] });
      onAnadida(creada, `${creada.fabricante ?? fabricante} ${creada.modelo ?? modelo}`.trim());
    },
    onError: (e: any) => setError(textoError(e)),
  });

  const bloqueado = !fabricante.trim() && !modelo.trim();
  const ocupado = buscar.isPending || leer.isPending || subir.isPending;

  const caja = (def: (typeof CAMPOS)[number]) => (
    <div key={def.clave}>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {def.etiqueta}{def.ayuda ? <span className="text-slate-400"> · {def.ayuda}</span> : null}
      </label>
      <input value={datos[def.clave] ?? ''} onChange={e => setDatos(d => ({ ...d, [def.clave]: e.target.value }))}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
      {evidencias[def.clave] && (
        <p className="text-[11px] text-slate-400 mt-1 leading-snug">📄 {evidencias[def.clave]}</p>
      )}
    </div>
  );

  return (
    <div className="mt-3 border border-amber-200 bg-amber-50/50 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-slate-600">
          <strong>Máquina que no está en el catálogo.</strong> Escribe la marca y el modelo, busca su
          ficha técnica, y el programa lee de ella los datos que publica. Se guarda como una máquina
          más del catálogo. Lo que la ficha no diga se queda en blanco.
        </p>
        <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Marca</label>
          <input value={fabricante} onChange={e => setFabricante(e.target.value)} placeholder="Daikin"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Modelo</label>
          <input value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Altherma 3 R W 8 kW"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <button type="button" onClick={() => buscar.mutate()} disabled={bloqueado || ocupado}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed">
          {buscar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Buscar la ficha técnica
        </button>
      </div>

      {/* La salida cuando el buscador no encuentra nada: el PDF que el instalador ya tiene en el PC. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 items-end">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">… o pega el enlace de la ficha (PDF)</label>
          <input value={enlace} onChange={e => setEnlace(e.target.value)} placeholder="https://…/ficha-tecnica.pdf"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <button type="button" onClick={() => leer.mutate(enlace)} disabled={!enlace.trim() || ocupado}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm border border-slate-300 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
          {leer.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          Leer ese enlace
        </button>
      </div>

      <label className={`flex items-center justify-center gap-2 mt-2 px-4 py-2 text-sm border border-dashed border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50 ${ocupado ? 'opacity-40' : ''}`}>
        {subir.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        Subir la ficha en PDF desde este ordenador
        <input type="file" accept="application/pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) subir.mutate(f); e.target.value = ''; }} />
      </label>

      {candidatas.length > 0 && !leida && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-2">
            Documentos encontrados: {candidatas.length}
          </p>
          <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white max-h-60 overflow-y-auto">
            {candidatas.map(c => (
              <li key={c.url} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-xs text-slate-800" title={c.url}>{c.titulo}</span>
                  <span className="block text-[11px] text-slate-400">
                    {c.dominio}
                    {c.esPdf ? ' · PDF' : ' · página web'}
                    {c.delFabricante ? ' · 🏭 del fabricante' : ''}
                  </span>
                </span>
                <button type="button" onClick={() => leer.mutate(c.url)} disabled={ocupado}
                  className="shrink-0 text-[11px] px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40">
                  Leer
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {leida && (
        <div className="mt-3 border-t border-amber-200 pt-3">
          <p className="text-[11px] text-slate-600 mb-2">
            ✅ Ficha leída: <span className="font-medium">{leida.fichero}</span> ({leida.paginas} páginas).
            Cada dato lleva debajo el texto de la ficha del que sale: <strong>compruébalo antes de guardar</strong> y
            corrige o rellena lo que falte.
            <a href={leida.fichero_url} target="_blank" rel="noreferrer" className="ml-1 underline text-slate-700">Ver la ficha</a>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CAMPOS.map(caja)}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de uso</label>
              <select value={tipoUso} onChange={e => setTipoUso(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                {USOS_MAQUINA.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </div>
          </div>
          {dudosos.length > 0 && (
            <div className="mt-3 border border-amber-300 bg-amber-50 rounded-lg p-3">
              <p className="text-[11px] font-semibold text-amber-800">
                ⚠️ La ficha trae estos datos en una fila con VARIOS modelos, así que NO se han copiado
                solos (el primero de la fila sería el de otro tamaño): mira el de TU modelo y escríbelo.
              </p>
              <ul className="mt-2 space-y-2">
                {dudosos.map(d => (
                  <li key={d.campo + d.etiqueta} className="text-[11px] text-slate-700">
                    <strong>{d.etiqueta}:</strong>{' '}
                    <span className="font-mono">{(d.candidatos ?? []).join(' · ')}</span>
                    <span className="block text-slate-400">{d.evidencia}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {aviso && <p className="text-[11px] text-slate-500 mt-2">{aviso}</p>}
          <button type="button" onClick={() => guardar.mutate()} disabled={guardar.isPending}
            className="mt-3 flex items-center gap-2 px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-40">
            {guardar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Guardar la máquina en el catálogo y añadirla a la instalación
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
