/**
 * Aviso de versión nueva del panel.
 *
 * Por qué existe: al desplegar, el `index.html` cambia y apunta a un bundle nuevo, pero **una pestaña
 * ya abierta sigue con el código viejo** (el panel solo lee su código al cargar). Así se colaban
 * errores ya arreglados: Salva daba a una pestaña del panel y volvía a ver el comportamiento viejo, y
 * parecía que el arreglo no había llegado (7-oct-2026). Esto lo detecta solo y avisa con una banda.
 *
 * Cómo: al montar (y al volver a la pestaña, como mucho una vez por minuto) se pide el `index.html`
 * SIN caché, se mira qué bundle nombra y se compara con el que está corriendo. Si no es el mismo,
 * sale la banda. Cuando no hay nada nuevo no pinta nada.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/** El nombre del bundle que está corriendo esta pestaña (`index-XXXXXXXX.js`). */
function bundleEnUso(): string {
  const propio = Array.from(document.querySelectorAll('script[src]'))
    .map((s) => (s as HTMLScriptElement).getAttribute('src') ?? '')
    .find((src) => /assets\/index-[^/]+\.js/.test(src));
  return propio ? propio.split('/').pop()!.split('?')[0] : '';
}

/** El bundle que nombra el índice servido ahora mismo, sin caché. */
async function bundleServido(): Promise<string> {
  const r = await fetch(`/index.html?comprobar=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) return '';
  const html = await r.text();
  const m = html.match(/assets\/(index-[^"'?]+\.js)/);
  return m ? m[1] : '';
}

export default function AvisoVersionNueva() {
  const [hayNueva, setHayNueva] = useState(false);
  const ultima = useRef(0);

  const comprobar = useCallback(async () => {
    if (Date.now() - ultima.current < 60_000) return; // como mucho, una comprobación por minuto
    ultima.current = Date.now();
    try {
      const servido = await bundleServido();
      const enUso = bundleEnUso();
      if (servido && enUso && servido !== enUso) setHayNueva(true);
    } catch {
      // Sin poder comprobar no se avisa de nada: no se inventa una alarma.
    }
  }, []);

  useEffect(() => {
    comprobar();
    const alVolver = () => { if (document.visibilityState === 'visible') comprobar(); };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
  }, [comprobar]);

  if (!hayNueva) return null;

  return (
    <div className="fixed left-0 right-0 top-0 z-[60] flex items-center justify-center gap-3 px-4 py-2 text-[13px] font-medium text-white"
      style={{ background: '#0B4D3B' }}>
      <RefreshCw size={14} />
      Hay una versión nueva del panel: lo que ves es la copia de antes.
      <button onClick={() => window.location.reload()}
        className="rounded-lg bg-white/15 px-3 py-1 text-[12px] font-semibold underline decoration-white/40">
        Recargar ahora
      </button>
    </div>
  );
}
