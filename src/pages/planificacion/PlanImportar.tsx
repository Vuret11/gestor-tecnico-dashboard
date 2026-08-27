import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { planificacion as api } from '../../api/endpoints';
import * as XLSX from 'xlsx';
import { Upload, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';

const ESTADOS_ESPECIALES = new Set([
  'vacaciones', 'baja', 'comp. horas', 'libre', 'libre por horas',
  'fiesta nacional', 'medico', 'médico', 'sancion', 'sanción',
  'reconocimiento', 'recon', 'otros', 'aldeas', 'día del trabajador',
  'dia del trabajador', 'fiesta',
]);

function excelDateToStr(serial: number): string {
  const utc = Math.floor(serial - 25569) * 86400 * 1000;
  return new Date(utc).toISOString().split('T')[0];
}

interface FilaImport {
  tecnicoNombre: string;
  fecha: string;
  contenido: string;
  provinciaId: string;
  esEstadoEspecial: boolean;
}

export default function PlanImportar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<FilaImport[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<{ importadas: number } | null>(null);
  const [provinciaMap, setProvinciaMap] = useState<Record<string, string>>({});

  const { data: provincias = [] } = useQuery({ queryKey: ['plan-provincias'], queryFn: api.provincias.list });
  const { data: tecnicos = [] } = useQuery({ queryKey: ['plan-tecnicos'], queryFn: () => api.tecnicos.list() });

  const importar = useMutation({
    mutationFn: () => api.asignaciones.semana('2026-01-01', '2026-12-31').then(() =>
      fetch('/api/v1/planificacion/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ rows: preview.map(r => ({ ...r, provinciaId: provinciaMap[r.provinciaId] ?? r.provinciaId })) }),
      }).then(r => r.json())
    ),
    onSuccess: (data) => setResultado(data),
  });

  function procesarExcel(file: File) {
    setError('');
    setPreview([]);
    setResultado(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target!.result, { type: 'binary' });
        const ws = wb.Sheets['Planificacion'];
        if (!ws) { setError('No se encontró la hoja "Planificacion"'); return; }

        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const filas: FilaImport[] = [];

        // Fila 0: col 9+ son fechas (números de serie de Excel)
        const fechas: string[] = [];
        for (let c = 9; c < data[0].length; c++) {
          const val = data[0][c];
          if (typeof val === 'number' && val > 40000) {
            fechas.push(excelDateToStr(val));
          } else {
            fechas.push('');
          }
        }

        // Detectar provincias y técnicos
        const PROVINCIA_KEYS: Record<string, string> = {};
        let currentProvincia = '';
        const tempProvMap: Record<string, string> = {};

        provincias.forEach(p => {
          PROVINCIA_KEYS[p.nombre.toUpperCase()] = p.id;
          tempProvMap[p.nombre.toUpperCase()] = p.id;
        });
        // Fallback hardcoded
        ['BARCELONA', 'MADRID', 'NAVARRA'].forEach(n => {
          if (!PROVINCIA_KEYS[n]) PROVINCIA_KEYS[n] = n;
        });

        for (let row = 1; row < data.length; row++) {
          const nombreCol = String(data[row][7] ?? '').trim();
          if (!nombreCol) continue;

          // ¿Es cabecera de provincia?
          const upNombre = nombreCol.toUpperCase();
          if (PROVINCIA_KEYS[upNombre] !== undefined || ['BARCELONA','MADRID','NAVARRA','EXTERNOS','OFICINA','ALMACENEROS'].includes(upNombre)) {
            if (['BARCELONA','MADRID','NAVARRA'].includes(upNombre)) {
              currentProvincia = upNombre;
            }
            continue;
          }

          // Técnico
          const provId = tempProvMap[currentProvincia] ?? currentProvincia;
          const cells = data[row].slice(9);

          cells.forEach((cell: any, ci: number) => {
            const contenido = String(cell ?? '').trim();
            if (!contenido || !fechas[ci]) return;
            const contenidoLower = contenido.toLowerCase();
            const esEspecial = [...ESTADOS_ESPECIALES].some(e => contenidoLower.startsWith(e));

            filas.push({
              tecnicoNombre: nombreCol,
              fecha: fechas[ci],
              contenido,
              provinciaId: provId,
              esEstadoEspecial: esEspecial,
            });
          });
        }

        setPreview(filas.slice(0, 200)); // preview máx 200
        setProvinciaMap(tempProvMap);
      } catch (err: any) {
        setError('Error al procesar el archivo: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  }

  const tecnicosNombres = new Set(tecnicos.map(t => t.nombre));
  const tecnicosEnExcel = [...new Set(preview.map(r => r.tecnicoNombre))];
  const tecnicosSinMapear = tecnicosEnExcel.filter(n => !tecnicosNombres.has(n));
  const filasValidas = preview.filter(r => tecnicosNombres.has(r.tecnicoNombre));

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Importar planificación desde Excel</h2>
        <p className="text-sm text-slate-500 mt-1">Sube el archivo Excel de planificación anual para importar los datos históricos</p>
      </div>

      {/* Upload */}
      <div
        className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-brand hover:bg-brand/5 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) procesarExcel(f); }}
      >
        <FileSpreadsheet size={40} className="mx-auto text-slate-300 mb-3" />
        <p className="font-medium text-slate-600">{fileName || 'Arrastra el Excel aquí o haz clic para seleccionar'}</p>
        <p className="text-xs text-slate-400 mt-1">Planificacion Hs Solar 2026.xlsx</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) procesarExcel(f); }} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {preview.length > 0 && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{preview.length}</p>
              <p className="text-xs text-slate-500 mt-1">Entradas detectadas</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{filasValidas.length}</p>
              <p className="text-xs text-slate-500 mt-1">Listas para importar</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className={`text-2xl font-bold ${tecnicosSinMapear.length > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                {tecnicosSinMapear.length}
              </p>
              <p className="text-xs text-slate-500 mt-1">Técnicos sin mapear</p>
            </div>
          </div>

          {/* Técnicos sin mapear */}
          {tecnicosSinMapear.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-2">
                <AlertTriangle size={14} /> Técnicos del Excel no encontrados en el sistema (se ignorarán):
              </p>
              <div className="flex flex-wrap gap-2">
                {tecnicosSinMapear.map(n => (
                  <span key={n} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{n}</span>
                ))}
              </div>
              <p className="text-xs text-amber-600 mt-2">
                Añade estos técnicos en la pestaña "Técnicos" con el nombre exacto del Excel y vuelve a importar.
              </p>
            </div>
          )}

          {/* Preview tabla */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-medium text-slate-900">Vista previa (primeras 20 filas)</h3>
              <span className="text-xs text-slate-400">{filasValidas.length} importables</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Estado','Técnico','Fecha','Contenido','Provincia'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.slice(0, 20).map((r, i) => {
                    const valido = tecnicosNombres.has(r.tecnicoNombre);
                    return (
                      <tr key={i} className={valido ? 'hover:bg-slate-50' : 'opacity-40 bg-red-50/30'}>
                        <td className="px-3 py-1.5">
                          {valido
                            ? <CheckCircle2 size={12} className="text-green-500" />
                            : <AlertTriangle size={12} className="text-amber-400" />}
                        </td>
                        <td className="px-3 py-1.5 font-medium text-slate-800">{r.tecnicoNombre}</td>
                        <td className="px-3 py-1.5 text-slate-500">{r.fecha}</td>
                        <td className="px-3 py-1.5 text-slate-600 max-w-[200px] truncate">{r.contenido}</td>
                        <td className="px-3 py-1.5 text-slate-400">{r.provinciaId}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resultado */}
          {resultado && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 size={15} /> {resultado.importadas} entradas importadas correctamente
            </div>
          )}

          {/* Botón importar */}
          {!resultado && (
            <div className="flex justify-end">
              <button
                onClick={() => importar.mutate()}
                disabled={importar.isPending || filasValidas.length === 0}
                className="flex items-center gap-2 bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
              >
                <Upload size={15} />
                {importar.isPending ? 'Importando...' : `Importar ${filasValidas.length} entradas`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
