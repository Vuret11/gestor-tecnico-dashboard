import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock } from 'lucide-react';
import { legalizaciones as legApi } from '../api/endpoints';
import type { EtapaTramiteNombre } from '../types';

/**
 * Las tres etapas del trámite: Inicio, Subida Portal y Finalizado.
 *
 * Lo pidió Salva el 7-oct-2026: «en cada ficha de legalización estén las siguientes fases: Inicio,
 * Subida Portal y Finalizado. Debe ser un botón y debe haber un registro de cada etapa». Pulsar el
 * botón marca la etapa; volver a pulsarlo la desmarca. **Cada pulsación** queda en el registro con la
 * fecha y quién la hizo (el API no borra nunca esas filas, así el histórico se puede consultar).
 */
export function EtapasLegalizacion({ tramiteId }: { tramiteId: string }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['etapas-tramite', tramiteId],
    queryFn: () => legApi.etapas(tramiteId),
  });

  const marcar = useMutation({
    mutationFn: ({ etapa, hecha }: { etapa: EtapaTramiteNombre; hecha: boolean }) =>
      legApi.marcarEtapa(tramiteId, etapa, hecha),
    // El API devuelve el estado completo y el registro ya actualizados.
    onSuccess: async (datos) => {
      qc.setQueryData(['etapas-tramite', tramiteId], datos);
      /**
       * Y se refresca la LISTA. Lo pidió Salva el 7-oct-2026: «si se marca un estado la tarjeta debe
       * cambiar automáticamente» — la tarjeta (y la columna en la que está) salen de la lista de
       * instalaciones, no de este componente, así que sin esto el botón se marcaba pero la ficha se
       * quedaba en la columna de antes hasta recargar.
       */
      await qc.invalidateQueries({ queryKey: ['legalizaciones'] });
      await qc.invalidateQueries({ queryKey: ['legalizaciones-listado'] });
    },
  });

  /** Fecha y hora cortas, en español («07/10/26, 16:07»). */
  const cuando = (iso: string) =>
    new Date(iso).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    });

  if (isLoading) return <p className="text-[11px] text-slate-400 mt-1">Cargando etapas…</p>;

  const etapas = data?.etapas ?? [];
  const registro = [...(data?.registro ?? [])].reverse(); // lo último primero

  return (
    <div className="mt-1 space-y-1">
      <div className="flex gap-1">
        {etapas.map((e, i) => {
          /**
           * Las etapas van EN ORDEN (Salva, 7-oct-2026: «no podemos dar al botón subido o finalizado sin
           * pasar por Inicio»): una etapa solo se puede marcar si la anterior está hecha, y una etapa
           * hecha solo se puede desmarcar si no hay ninguna posterior hecha. El servidor lo comprueba
           * igual, así que aquí lo que se hace es no dejar pulsar lo que va a rechazar.
           */
          const anteriorHecha = i === 0 || etapas[i - 1].hecha;
          const hayPosteriorHecha = etapas.slice(i + 1).some((x) => x.hecha);
          const bloqueado = e.hecha ? hayPosteriorHecha : !anteriorHecha;
          const motivo = e.hecha
            ? `Para desmarcar «${e.etiqueta}» desmarca antes «${etapas.slice(i + 1).find((x) => x.hecha)?.etiqueta}»`
            : `Para marcar «${e.etiqueta}» hay que marcar antes «${etapas[i - 1]?.etiqueta}»`;

          return (
            <button
              key={e.etapa}
              onClick={() => marcar.mutate({ etapa: e.etapa, hecha: !e.hecha })}
              disabled={marcar.isPending || bloqueado}
              title={bloqueado ? motivo : `${e.etiqueta}: ${e.ayuda}${e.hecha ? ' · pulsa para desmarcar' : ''}`}
              className={`flex-1 px-1.5 py-1 text-[11px] rounded-lg border inline-flex items-center justify-center gap-1 disabled:cursor-not-allowed ${
                e.hecha
                  ? 'bg-green-50 border-green-300 text-green-700 font-medium'
                  : bloqueado
                    ? 'border-dashed border-slate-200 text-slate-300 bg-slate-50'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              } ${marcar.isPending ? 'disabled:opacity-50' : ''}`}
            >
              {e.hecha ? <Check size={12} /> : <Clock size={12} />} {e.etiqueta}
            </button>
          );
        })}
      </div>

      {/* Cuándo y quién, debajo de cada etapa hecha */}
      {etapas.filter((e) => e.hecha && e.fecha).map((e) => (
        <p key={e.etapa} className="text-[10px] text-slate-400">
          {e.etiqueta}: {cuando(e.fecha as string)}
          {e.usuario ? ` · ${e.usuario}` : ''}
        </p>
      ))}

      {marcar.isError && (
        <p className="text-[10px] text-red-600">
          No se ha podido guardar la etapa:{' '}
          {(marcar.error as any)?.response?.data?.message ?? (marcar.error as any)?.message ?? 'error del servidor'}
        </p>
      )}

      {registro.length > 0 && (
        <details className="text-[10px] text-slate-500">
          <summary className="cursor-pointer text-slate-400">
            Registro de cada etapa ({registro.length})
          </summary>
          <ul className="mt-1 space-y-0.5">
            {registro.map((f, i) => (
              <li key={i}>
                {cuando(f.fecha)} · <span className={f.hecha ? 'text-green-700' : 'text-slate-500'}>
                  {f.etiqueta} {f.hecha ? 'marcada' : 'desmarcada'}
                </span>
                {f.usuario ? ` · ${f.usuario}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default EtapasLegalizacion;
