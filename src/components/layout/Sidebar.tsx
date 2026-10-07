import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Building2, Users, Wrench,
  FileText, AlertTriangle, LogOut, ClipboardList, UserCheck, ShieldCheck,
  HardHat, FolderOpen, Package, Cpu, Lock, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions, type Modulo } from '../../hooks/usePermissions';
import { ingenieria as ingenieriaApi, legalizaciones as legalizacionesApi, homologaciones as homologacionesApi } from '../../api/endpoints';
import clsx from 'clsx';

const NAV_ARRIBA: { to: string; icon: any; label: string; modulo: Modulo }[] = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard',     modulo: 'dashboard' },
  { to: '/clientes',     icon: UserCheck,       label: 'Partners',      modulo: 'clientes' },
  { to: '/tecnicos',     icon: Users,           label: 'Personal',      modulo: 'usuarios' },
  { to: '/instalaciones',icon: Building2,       label: 'Instalaciones', modulo: 'instalaciones' },
  { to: '/visitas',      icon: Wrench,          label: 'Visitas',       modulo: 'visitas' },
  { to: '/informes',     icon: FileText,        label: 'Informes',      modulo: 'visitas' },
  { to: '/incidencias',  icon: AlertTriangle,   label: 'Incidencias',   modulo: 'incidencias' },
  { to: '/checklists',   icon: ClipboardList,   label: 'Checklists',    modulo: 'visitas' },
  { to: '/planificacion',icon: HardHat,         label: 'Planificación', modulo: 'planificacion' },
  { to: '/inventario',   icon: Package,         label: 'Inventario',    modulo: 'inventario' },
  { to: '/repositorio',  icon: FolderOpen,      label: 'Repositorio',   modulo: 'repositorio' },
  { to: '/auditorias',   icon: ShieldCheck,     label: 'Auditorías',    modulo: 'auditorias' },
];

// Los que van DESPUÉS del grupo de Ingeniería
const NAV_ABAJO: { to: string; icon: any; label: string; modulo: Modulo }[] = [
  { to: '/permisos',     icon: Lock,            label: 'Permisos',      modulo: 'permisos' },
];

/**
 * Los dos apartados de Ingeniería. Antes eran dos pestañas dentro de la página y ahora cuelgan del
 * propio menú de la izquierda, que es donde Salva los busca.
 */
const APARTADOS_INGENIERIA = [
  { to: '/ingenieria/obras',          label: 'Obras de ingeniería' },
  { to: '/ingenieria/legalizaciones', label: 'Legalizaciones' },
  { to: '/ingenieria/homologaciones', label: 'Homologaciones' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { puede } = usePermissions();
  const { pathname } = useLocation();

  const dentroDeIngenieria = pathname.startsWith('/ingenieria');
  const [abierto, setAbierto] = useState(() => localStorage.getItem('menu-ingenieria') !== 'cerrado');

  // Al entrar en Ingeniería el grupo se abre solo, aunque se hubiera dejado cerrado.
  useEffect(() => {
    if (dentroDeIngenieria) setAbierto(true);
  }, [dentroDeIngenieria]);

  const alternar = () => setAbierto(previo => {
    localStorage.setItem('menu-ingenieria', previo ? 'cerrado' : 'abierto');
    return !previo;
  });

  // Contadores del menú: usan las MISMAS claves de consulta que las páginas, así que al entrar en
  // cada apartado no suponen ninguna petición de más.
  const { data: proyectos = [] } = useQuery({
    queryKey: ['ingenieria'], queryFn: () => ingenieriaApi.list(), enabled: puede('ingenieria'),
  });
  const { data: tramites = [] } = useQuery({
    queryKey: ['legalizaciones'], queryFn: () => legalizacionesApi.list(), enabled: puede('ingenieria'),
  });
  const { data: homologaciones = [] } = useQuery({
    queryKey: ['homologaciones'], queryFn: () => homologacionesApi.list(), enabled: puede('ingenieria'),
  });
  const cuenta: Record<string, number> = {
    '/ingenieria/obras': proyectos.length,
    '/ingenieria/legalizaciones': tramites.filter((t: any) => t.activo).length,
    '/ingenieria/homologaciones': homologaciones.length,
  };

  const nav = NAV_ARRIBA.filter(item => puede(item.modulo));

  const claseItem = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
      isActive ? 'bg-brand text-white shadow-sm' : 'hover:bg-slate-800 hover:text-white',
    );

  return (
    <aside className="w-56 bg-slate-900 text-slate-300 flex flex-col h-screen sticky top-0 shrink-0">
      <div className="px-4 py-5 border-b border-slate-700/60">
        <img
          src="/homeserve-solar-blanco.svg"
          alt="HomeServe Solar"
          className="h-8 w-auto"
          onError={e => {
            const el = e.currentTarget as HTMLImageElement;
            el.style.display = 'none';
            (el.nextSibling as HTMLElement).style.display = 'flex';
          }}
        />
        <div className="items-center gap-2 hidden">
          <span className="font-semibold text-white text-sm">HomeServe Solar</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5 uppercase tracking-widest">Panel de gestión</p>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} className={claseItem}>
            <Icon size={16} />
            {label}
          </NavLink>
        ))}

        {/* Ingeniería: sus apartados van dentro, en este mismo menú */}
        {puede('ingenieria') && (
          <div>
            <button
              onClick={alternar}
              aria-expanded={abierto}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors w-full',
                dentroDeIngenieria ? 'text-white font-semibold' : 'hover:bg-slate-800 hover:text-white',
              )}
            >
              <Cpu size={16} />
              Ingeniería
              <ChevronRight
                size={13}
                className={clsx('ml-auto text-slate-500 transition-transform', abierto && 'rotate-90')}
              />
            </button>

            {abierto && (
              <div className="ml-5 my-1 pl-3 border-l border-slate-700/60 space-y-0.5">
                {APARTADOS_INGENIERIA.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] relative transition-colors',
                        isActive
                          ? 'bg-white/[0.07] text-white font-semibold'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute -left-[13px] top-1.5 bottom-1.5 w-[3px] bg-brand rounded-r" />
                        )}
                        {label}
                        <span className={clsx('ml-auto text-[11px]', isActive ? 'text-red-300' : 'text-slate-500')}>
                          {cuenta[to]}
                        </span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )}

        {NAV_ABAJO.filter(item => puede(item.modulo)).map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={claseItem}>
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-700/60">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{user?.nombre?.[0]?.toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-200 truncate font-medium">{user?.nombre}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{user?.rol}</p>
            {user?.departamento && (
              <p className="text-[10px] text-slate-600 truncate">{user.departamento}</p>
            )}
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors w-full"
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
