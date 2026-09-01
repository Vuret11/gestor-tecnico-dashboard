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
  departamento?: string;
  modulosAcceso?: string[] | null;
  createdAt: string;
}

export type TipoProyecto = 'fv' | 'rite' | 'aerotermia' | 'hibrido' | 'otro';
export type EstadoProyecto = 'diseño' | 'pendiente_aprobacion' | 'aprobado' | 'en_ejecucion' | 'completado' | 'cancelado';

export interface ProyectoIngenieria {
  id: string;
  nombre: string;
  cliente: string;
  tipo: TipoProyecto;
  estado: EstadoProyecto;
  descripcion?: string;
  potencia_kwp?: number;
  presupuesto?: number;
  fechaEntregaEstimada?: string;
  direccion?: string;
  provincia?: string;
  notas?: string;
  tecnico_id?: string;
  tecnico?: User;
  activo: boolean;
  createdAt: string;
}

export type TipoInstalacion = 'fv' | 'rite' | 'otro';

export interface Instalacion {
  id: string;
  nombre: string;
  cliente: string;
  clienteId?: string;
  clienteData?: Cliente;
  direccion: string;
  ciudad: string;
  provincia?: string;
  cp?: string;
  telefono?: string;
  latitud?: number;
  longitud?: number;
  notas?: string;
  memoriaTecnicaUrl?: string;
  memoriaTecnicaNombre?: string;
  tipoInstalacion?: TipoInstalacion | null;
  importe?: number;
  activo: boolean;
  createdAt: string;
}

export interface Visita {
  id: string;
  instalacion: Instalacion;
  instalacion_id: string;
  tecnico?: User;
  tecnico_id?: string;
  fechaProgramada: string;
  fechaInicio?: string;
  fechaFin?: string;
  tipo: TipoVisita;
  estado: EstadoVisita;
  notas?: string;
  modalidad?: 'nueva' | 'reforma';
  viaja?: boolean;
  llevaAts?: boolean;
  almacen_id?: string;
  almacen?: Almacen;
  importeExtras?: number;
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
  visibleTecnico?: boolean;
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
  asignado_a_id?: string;
  resolucion?: string;
  fecha?: string | null;
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
  tipoInstalacion?: TipoInstalacion | null;
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

// ── Planificación ─────────────────────────────────────────────────────────────
export interface PlanProvincia {
  id: string;
  nombre: string;
  color?: string;
  activo: boolean;
  createdAt: string;
}

export type TipoTecnico = 'propio' | 'externo' | 'subcontrata';

export interface PlanTecnico {
  id: string;
  nombre: string;
  matricula?: string;
  tipo: TipoTecnico;
  provincia?: PlanProvincia;
  provincia_id?: string;
  telefono?: string;
  email?: string;
  observaciones?: string;
  activo: boolean;
  viaja: boolean;
  user_id?: string;
  createdAt: string;
}

export interface PlanCliente {
  id: string;
  nombre: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  observaciones?: string;
  activo: boolean;
  createdAt: string;
}

export type EstadoObra = 'pendiente' | 'planificada' | 'confirmada' | 'en_curso' | 'realizada' | 'cancelada' | 'reprogramada';
export type TipoTrabajo = 'instalacion_fv' | 'instalacion_aerotermia' | 'mantenimiento' | 'incidencia' | 'visita_tecnica' | 'otro';

export interface InstalacionResumen {
  id: string;
  nombre: string;
  ciudad?: string;
  provincia?: string;
  direccion?: string;
}

export interface PlanObra {
  id: string;
  numeroObra: string;
  nombre: string;
  instalacion?: InstalacionResumen;
  instalacion_id?: string;
  cliente?: PlanCliente;
  cliente_id?: string;
  provincia?: PlanProvincia;
  provincia_id?: string;
  direccion?: string;
  ciudad?: string;
  tipoTrabajo: TipoTrabajo;
  estado: EstadoObra;
  fechaPrevista?: string;
  fechaRealizada?: string;
  observaciones?: string;
  activo: boolean;
  createdAt: string;
}

export type EstadoEspecial = 'vacaciones' | 'baja' | 'comp_horas' | 'libre' | 'fiesta_nacional' | 'medico' | 'sancion' | 'reconocimiento' | 'otros';

export interface PlanAsignacion {
  id: string;
  tecnico: PlanTecnico;
  tecnico_id: string;
  obra?: PlanObra;
  obra_id?: string;
  fecha: string;
  provinciatrabajo?: PlanProvincia;
  provincia_trabajo_id?: string;
  estadoEspecial?: EstadoEspecial | null;
  viaja: boolean;
  observaciones?: string;
  createdAt: string;
}

// ── Inventario ────────────────────────────────────────────────────────────────
export interface Almacen {
  id: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
}

export interface InventarioStock {
  id: string;
  articulo_id: string;
  almacen_id: string;
  almacen: Almacen;
  stockActual: number;
  stockMinimo: number;
}

export interface InventarioArticulo {
  id: string;
  referencia?: string;
  nombre: string;
  descripcion?: string;
  unidad: string;
  stocks: InventarioStock[];
  precioUnitario?: number;
  categoria?: string;
  activo: boolean;
  createdAt: string;
}

export interface VisitaArticulo {
  id: string;
  visita_id: string;
  articulo_id: string;
  articulo: InventarioArticulo;
  almacen_id?: string;
  almacen?: Almacen;
  cantidad: number;
  precioUnitario?: number;
  notas?: string;
  createdAt: string;
}

// ── Repositorio ───────────────────────────────────────────────────────────────
export interface RepoCarpeta {
  id: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  createdAt: string;
}

export interface RepoArchivo {
  id: string;
  carpeta_id: string;
  nombre: string;
  url: string;
  tipo?: string;
  tamaño?: number;
  subidoPor?: User;
  createdAt: string;
}

export interface AuthResponse {
  access_token: string;
  user: Pick<User, 'id' | 'nombre' | 'email' | 'rol' | 'departamento' | 'modulosAcceso'>;
}
