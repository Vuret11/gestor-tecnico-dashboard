import { useAuth } from '../context/AuthContext';

export const TODOS_LOS_MODULOS = [
  'dashboard', 'visitas', 'instalaciones', 'clientes',
  'planificacion', 'inventario', 'auditorias', 'repositorio',
  'ingenieria', 'incidencias', 'usuarios', 'permisos',
] as const;

export type Modulo = typeof TODOS_LOS_MODULOS[number];

export const MODULO_LABELS: Record<Modulo, string> = {
  dashboard: 'Panel principal',
  visitas: 'Visitas',
  instalaciones: 'Instalaciones',
  clientes: 'Clientes',
  planificacion: 'Planificación',
  inventario: 'Inventario',
  auditorias: 'Auditorías',
  repositorio: 'Repositorio',
  ingenieria: 'Ingeniería',
  incidencias: 'Incidencias',
  usuarios: 'Usuarios',
  permisos: 'Permisos',
};

const ROL_DEFAULTS: Record<string, Modulo[]> = {
  admin: [...TODOS_LOS_MODULOS],
  oficina: ['dashboard', 'visitas', 'instalaciones', 'clientes', 'planificacion', 'inventario', 'auditorias', 'repositorio', 'incidencias'],
  tecnico: ['dashboard', 'visitas', 'repositorio', 'ingenieria'],
};

export function usePermissions() {
  const { user } = useAuth();

  if (!user) return { puede: () => false, modulos: [] as Modulo[] };

  const modulos: Modulo[] = user.modulosAcceso != null
    ? (user.modulosAcceso as Modulo[])
    : (ROL_DEFAULTS[user.rol] ?? ['dashboard']);

  const puede = (modulo: Modulo) => modulos.includes(modulo);

  return { puede, modulos };
}
