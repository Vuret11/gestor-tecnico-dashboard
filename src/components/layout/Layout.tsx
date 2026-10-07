import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import NotificationToasts from '../NotificationToast';
import AvisoVersionNueva from '../AvisoVersionNueva';

export default function Layout() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: '#EFEBE1' }}>
        <Outlet />
      </main>
      <NotificationToasts />
      {/* Avisa si esta pestaña se quedó con el código de antes del último despliegue. */}
      <AvisoVersionNueva />
    </div>
  );
}
