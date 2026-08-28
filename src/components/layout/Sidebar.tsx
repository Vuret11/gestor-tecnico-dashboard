import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, Wrench,
  FileText, AlertTriangle, LogOut, ClipboardList, UserCheck, ShieldCheck,
  HardHat, FolderOpen, Package, Cpu, Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions, type Modulo } from '../../hooks/usePermissions';
import clsx from 'clsx';

const ALL_NAV: { to: string; icon: any; label: string; modulo: Modulo }[] = [
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
  { to: '/ingenieria',   icon: Cpu,             label: 'Ingeniería',    modulo: 'ingenieria' },
  { to: '/permisos',     icon: Lock,            label: 'Permisos',      modulo: 'permisos' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { puede } = usePermissions();

  const nav = ALL_NAV.filter(item => puede(item.modulo));

  return (
    <aside className="w-56 bg-slate-900 text-slate-300 flex flex-col h-screen sticky top-0 shrink-0">
      <div className="px-4 py-5 border-b border-slate-700/60">
        <img
          src="https://homeservesolar.es/wp-content/uploads/2024/07/HomeServe-Solar-brand-blanco.svg"
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
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-brand text-white shadow-sm'
                  : 'hover:bg-slate-800 hover:text-white',
              )
            }
          >
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
