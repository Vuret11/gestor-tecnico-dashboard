import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

export interface VisitaNotificacion {
  visitaId: string;
  instalacionNombre: string;
  instalacionDireccion: string;
  fechaProgramada: string;
  tipo: string;
}

interface NotificationsContextType {
  notificaciones: VisitaNotificacion[];
  dismiss: (visitaId: string) => void;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notificaciones, setNotificaciones] = useState<VisitaNotificacion[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) return;

    const socket = io(import.meta.env.VITE_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3000', {
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('register', user.id);
    });

    socket.on('nueva-visita', (payload: VisitaNotificacion) => {
      setNotificaciones(prev => [payload, ...prev]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  const dismiss = (visitaId: string) => {
    setNotificaciones(prev => prev.filter(n => n.visitaId !== visitaId));
  };

  return (
    <NotificationsContext.Provider value={{ notificaciones, dismiss }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
