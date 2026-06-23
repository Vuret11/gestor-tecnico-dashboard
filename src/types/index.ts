export type Rol = 'tecnico' | 'oficina' | 'admin';
export type EstadoVisita = 'programada' | 'en_curso' | 'completada' | 'cancelada';
export type TipoVisita = 'visita_tecnica_fv' | 'visita_tecnica_aerotermia' | 'instalacion_nueva_fv' | 'instalacion_nueva_aerotermia';
export type Prioridad = 'baja' | 'media' | 'alta' | 'critica';
export type EstadoIncidencia = 'abierta' | 'en_progreso' | 'resuelta' | 'cerrada';

export interface Cliente {
  id: string;
  nombre: string;
  nif?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  notas?: string;
  activo: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  telefono?: string;
  createdAt: string;
}

export interface Instalacion {
  id: string;
  nombre: string;
  cliente: string;
  clienteId?: string;
  direccion: string;
  ciudad: string;
  provincia?: string;
  cp?: string;
  telefono?: string;
  latitud?: number;
  longitud?: number;
  notas?: string;
  activo: boolean;
  createdAt: string;
}

export interface Visita {
  id: string;
  instalacion: Instalacion;
  instalacion_id: string;
  tecnico: User;
  tecnico_id: string;
  fechaProgramada: string;
  fechaInicio?: string;
  fechaFin?: string;
  tipo: TipoVisita;
  estado: EstadoVisita;
  notas?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Foto {
  id: string;
  visita_id: string;
  url: string;
  nombre?: string;
  tipo: 'foto' | 'documento';
  thumbnail?: string;
  latitud?: number;
  longitud?: number;
  descripcion?: string;
  createdAt: string;
}

export interface Informe {
  id: string;
  visita: Visita;
  visita_id: string;
  descripcion: string;
  trabajosRealizados?: string;
  materialesUsados?: string;
  tiempoEmpleado?: number;
  firmaClienteUrl?: string;
  nombreFirmante?: string;
  createdAt: string;
}

export interface Incidencia {
  id: string;
  titulo: string;
  descripcion: string;
  prioridad: Prioridad;
  estado: EstadoIncidencia;
  instalacion: Instalacion;
  instalacion_id: string;
  creadoPor: User;
  asignadoA?: User;
  resolucion?: string;
  createdAt: string;
  updatedAt: string;
}

export type ItemTipo = 'text' | 'number' | 'boolean' | 'select' | 'photo' | 'textarea';

export interface ChecklistItem {
  id: string;
  etiqueta: string;
  tipo: ItemTipo;
  opciones?: string[];
  unidad?: string;
  obligatorio: boolean;
  orden: number;
}

export interface ChecklistSeccion {
  id: string;
  titulo: string;
  orden: number;
  items: ChecklistItem[];
}

export interface ChecklistPlantilla {
  id: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  secciones: ChecklistSeccion[];
  createdAt: string;
}

export interface VisitaRespuesta {
  id: string;
  itemId: string;
  item: ChecklistItem;
  valor: string | null;
}

export interface VisitaChecklist {
  id: string;
  visitaId: string;
  plantillaId: string;
  plantilla: ChecklistPlantilla;
  firmante?: string;
  completadoEn?: string;
  respuestas: VisitaRespuesta[];
  createdAt: string;
}

export interface AuthResponse {
  access_token: string;
  user: Pick<User, 'id' | 'nombre' | 'email' | 'rol'>;
}
