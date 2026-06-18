import { useEffect, useRef } from 'react';
import { X, Bell, MapPin, Calendar } from 'lucide-react';
import { useNotifications, type VisitaNotificacion } from '../context/NotificationsContext';

function Toast({ notif, onDismiss }: { notif: VisitaNotificacion; onDismiss: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timerRef.current);
  }, [onDismiss]);

  const fecha = new Date(notif.fechaProgramada).toLocaleString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="w-80 rounded-xl shadow-2xl overflow-hidden animate-slide-in">
      {/* Cabecera roja */}
      <div className="bg-brand px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Bell size={15} className="shrink-0" />
          <span className="text-sm font-semibold tracking-wide">Nueva visita asignada</span>
        </div>
        <button
          onClick={onDismiss}
          className="text-white/70 hover:text-white transition-colors"
          aria-label="Cerrar"
        >
          <X size={15} />
        </button>
      </div>

      {/* Cuerpo */}
      <div className="bg-white px-4 py-3 space-y-2">
        <p className="font-semibold text-slate-900 text-sm">{notif.instalacionNombre}</p>
        <p className="text-xs text-brand font-medium">{notif.tipo}</p>

        <div className="flex items-start gap-1.5 text-xs text-slate-500">
          <Calendar size={12} className="shrink-0 mt-0.5" />
          <span>{fecha}</span>
        </div>

        {notif.instalacionDireccion && (
          <div className="flex items-start gap-1.5 text-xs text-slate-500">
            <MapPin size={12} className="shrink-0 mt-0.5" />
            <span>{notif.instalacionDireccion}</span>
          </div>
        )}

        {/* Barra de progreso */}
        <div className="h-0.5 bg-slate-100 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-brand rounded-full animate-progress-bar" />
        </div>
      </div>
    </div>
  );
}

export default function NotificationToasts() {
  const { notificaciones, dismiss } = useNotifications();

  if (!notificaciones.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 items-end">
      {notificaciones.map(n => (
        <Toast key={n.visitaId} notif={n} onDismiss={() => dismiss(n.visitaId)} />
      ))}
    </div>
  );
}
