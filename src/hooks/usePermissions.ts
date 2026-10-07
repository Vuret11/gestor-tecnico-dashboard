import { useAuth } from '../context/AuthContext';

export const TODOS_LOS_MODULOS = [
  'dashboard', 'visitas', 'instalaciones', 'clientes',
  'planificacion', 'inventario', 'auditorias', 'repositorio',
  'ingenieria', 'incidencias', 'usuarios', 'permisos',
  // Permiso de ACCIÓN, no de pantalla: archivar instalaciones de legalizaciones. Va aquí porque es
  // donde se dan los permisos uno a uno. Lo lleva quien de verdad lo hace (los ingenieros), no todo el
  // que tiene el rol `tecnico` (que son más de veinte personas). Salva, 7-oct-2026.
  'borrar_legalizaciones',
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
  borrar_legalizaciones: 'Borrar instalaciones de legalizaciones',
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
