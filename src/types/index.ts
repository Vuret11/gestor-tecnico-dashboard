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
  /** Número de obra que se teclea en la ficha de la obra (lo pone el departamento a mano). */
  num_obra?: string;
  /** Los 9 estados del registro de obras (los pinta el cuadro de mando y el informe en PDF). */
  estado_obra?: string | null;
  /** Avance en % de la obra. */
  progreso?: number | null;
  notas?: string;
  disciplinas?: string[];
  responsables?: string[];
  jefe_obra?: string;
  jefe_obra_contacto?: string;
  tecnico_id?: string;
  tecnico?: User;
  // ── Importes y márgenes: la parte de dinero de la obra ──
  /** Margen previsto (%) y margen real (%): vacíos hasta tener los costes de la obra. */
  margen_previsto?: number | string | null;
  margen_real?: number | string | null;
  /** Importe facturado al cliente (€). */
  importe_facturado?: number | string | null;
  /** Retención de garantía: 'pendiente' | 'liberada', con su fecha e importe (€). */
  retencion_estado?: string | null;
  retencion_fecha?: string | null;
  retencion_importe?: number | string | null;
  /** Cliente del registro de clientes (la obra guarda además el nombre en texto). */
  cliente_id?: string | null;
  activo: boolean;
  createdAt: string;
}

// ── Seguimiento de obras por cliente (fases, retenciones, mediciones y documentos) ──

/** Las 7 fases de una obra, en orden. La fase actual es la primera sin fecha_fin_real. */
export const FASES_OBRA: { slug: string; nombre: string }[] = [
  { slug: 'documentacion_inicio', nombre: 'Documentación inicio' },
  { slug: 'normativa', nombre: 'Normativa' },
  { slug: 'homologaciones', nombre: 'Homologaciones' },
  { slug: 'inicio_obra', nombre: 'Inicio obra' },
  { slug: 'documentacion_asbuilt', nombre: 'Documentación as-built' },
  { slug: 'legalizacion', nombre: 'Legalización' },
  { slug: 'finalizacion_obra', nombre: 'Finalización obra' },
];

export interface FaseObra {
  id: string;
  obra_id: string;
  fase: string;
  orden: number;
  fecha_inicio_prevista?: string | null;
  fecha_fin_prevista?: string | null;
  fecha_inicio_real?: string | null;
  fecha_fin_real?: string | null;
}

export interface Retencion {
  id: string;
  obra_id: string;
  importe?: number | string | null;
  /** '6_meses' o '1_ano'. */
  plazo?: string | null;
  fecha_vencimiento?: string | null;
  /** 'pendiente' o 'liberada'. */
  estado: string;
  fecha_liberacion?: string | null;
}

export interface MedicionDesviacion {
  id: string;
  obra_id: string;
  partida?: string | null;
  unidad?: string | null;
  cantidad_excel?: number | string | null;
  cantidad_plano?: number | string | null;
  diferencia_pct?: number | string | null;
  impacto_eur?: number | string | null;
}

export interface DocumentoObra {
  id: string;
  obra_id: string;
  /** XLSX, PDF, DWG u OTRO. */
  tipo: string;
  nombre: string;
  ruta?: string | null;
  fichero?: string | null;
  bytes?: number | null;
  fecha_subida: string;
}

export interface HitoObra {
  id: string;
  obra_id: string;
  nombre: string;
  fecha?: string | null;
  /** true = ya conseguido (rombo relleno en el Gantt). */
  hecho: boolean;
}

export interface NotaObra {
  id: string;
  obra_id: string;
  texto: string;
  autor?: string | null;
  autor_id?: string | null;
  createdAt: string;
}

/** En qué punto está la obra: finalizada y cuál es su fase actual. */
export interface EstadoFasesObra {
  finalizada: boolean;
  fase_actual: string | null;
  fases_hechas: number;
  /** Fecha real de fin de la fase «Finalización obra» (la que manda la obra a Finalizadas). */
  fecha_finalizacion?: string | null;
  /** Las 7 fases en orden, para poder marcarlas desde la tabla (puntos de la columna FASES). */
  fases?: {
    id: string;
    fase: string;
    orden: number;
    fecha_inicio_real: string | null;
    fecha_fin_real: string | null;
  }[];
}

export interface FichaObra extends Omit<EstadoFasesObra, 'fases'> {
  obra: ProyectoIngenieria;
  fases: FaseObra[];
  hitos: HitoObra[];
  retenciones: Retencion[];
  mediciones: MedicionDesviacion[];
  documentos: DocumentoObra[];
  /** El bloc de notas de la obra, la más reciente primero. */
  notas: NotaObra[];
}

/** Los cuatro indicadores de la cabecera. null = todavía no hay datos (se pinta «—»). */
export interface ResumenObras {
  clientes_activos: number;
  obras_activas: number;
  margen_real_medio: number | null;
  desviacion_total: number | null;
  obras_finalizadas: number;
  obras_totales: number;
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
  checklistPlantillaId?: string | null;
  checklistPlantilla?: ChecklistPlantilla | null;
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


export type EstadoTarea = 'pendiente' | 'en_curso' | 'hecha';

export interface Tarea {
  id: string;
  titulo: string;
  descripcion?: string;
  estado: EstadoTarea;
  disciplina?: string;
  responsables?: string[];
  fecha_limite?: string;
  /**
   * El día en que hay que EMPEZAR la tarea. Se elige al asignarla («Inicio»), no es `iniciada_en`
   * (esa se fecha sola cuando la tarea pasa a «en curso»). Lo pidió Salva el 7-oct-2026.
   */
  fecha_inicio?: string | null;
  /** Se fechan solas al cambiar el estado (no se teclean). */
  iniciada_en?: string | null;
  completada_en?: string;
  proyecto_id?: string;
  operario_id?: string;
  /** La persona a la que está asignada (el API la trae entera). */
  operario?: User;
  createdAt: string;
}


export type EstadoLegalizacion = 'bloqueado' | 'con_avisos' | 'listo_presentar' | 'presentado' | 'inscrito';

// ── Homologaciones (segundo apartado de Ingeniería, junto a Obras y Legalizaciones) ──────────
export type EstadoHomologacion =
  | 'recibida' | 'en_revision' | 'borrador_emitido' | 'con_incidencias' | 'revisada' | 'cerrada';

/** Los cinco tipos de instalación del apartado, cada uno con su base normativa. */
export type InstalacionHomologacion =
  | 'clima' | 'fontaneria' | 'pci' | 'teleco' | 'electricidad';

/** Base normativa de una instalación (la que se cita en el informe: no se inventan normas). */
export interface NormaHomologacion { norma: string; referencia: string; nota: string; }

/**
 * Un punto comprobado contra la norma, con su veredicto. `estado` es el resultado de contrastar lo
 * que declara la documentación con el mínimo del artículo: 'cumple', 'no_cumple' (va en rojo en el
 * panel y en los PDF) o 'sin_datos' (no se dictamina porque el dato no aparece).
 */
export interface VerificacionNorma {
  id: string;
  que: string;
  articulo: string;
  fuente: string;
  estado: 'cumple' | 'no_cumple' | 'sin_datos';
  gravedad: 'alta' | 'media' | 'baja' | null;
  evidencia: string;
  detalle: string;
  valores?: Record<string, unknown>;
}

/** Una partida del presupuesto, ya clasificada por instalación y buscada en los planos. */
export interface PartidaHomologacion {
  codigo: string;
  unidad: string;
  resumen: string;
  cantidad: number;
  precio: number;
  importe: number;
  /** Capítulo del presupuesto del que sale (03, 15, 16, 17, 18, 19, 21) e instalación a la que va. */
  capitulo: string;
  instalacion: string;
  /** 'localizada' (citada en el plano) · 'a_verificar' (no se ha encontrado: lo mira el técnico). */
  estado: string;
  /** Las marcas/modelos/secciones con las que se encontró en el plano. */
  coincidencias: string[];
  /** Hojas del PDF de planos donde aparece. */
  hojas: number[];
  /**
   * Si queda «a verificar»: qué hay que comprobar exactamente y con qué punto de la normativa
   * (p. ej. «Red de tierra: picas, conductor y caja de seccionamiento · REBT ITC-BT-18»).
   */
  verificacion?: { requisito: string; norma: string; donde: string; alcance?: boolean };
}

/** Resultado de UNA instalación: mediciones vs planos y cumplimiento normativo (borrador). */
export interface BloqueHomologacion {
  tipo: string;
  normativa: NormaHomologacion[];
  resumen: string;
  mediciones: {
    partidas: PartidaHomologacion[];
    totales: {
      partidas: number; importe: number; localizadas: number; a_verificar: number;
      importe_a_verificar: number;
    };
    capitulos: string[];
    aviso: string;
  };
  cumplimiento: {
    estado: string;
    requisitos: (NormaHomologacion & { estado: string })[];
    comprobaciones: { clave: string; que: string; norma?: string; localizada: boolean; estado: string; paginas: number[] }[];
    /** El veredicto de cada punto comprobado contra la norma: cumple / no cumple / sin datos. */
    verificaciones?: VerificacionNorma[];
    resumen?: { verificadas: number; cumple: number; no_cumple: number; sin_datos: number };
    incumplimientos: string[];
    dudas: string[];
    observaciones: string[];
    aviso: string;
  };
}

/** Resultado completo del análisis de la documentación de un trámite. Es un BORRADOR. */
export interface ResultadoHomologacion {
  generado: string;
  obra?: string | null;
  documentos: { nombre: string; tipo: string; bytes: number; subido?: string | null }[];
  /** Hojas de planos leídas del PDF. */
  hojas_de_plano: number;
  /** Lo que no se ha podido hacer y por qué (sin documentación, PDF ilegible, DWG sin convertir…). */
  avisos: string[];
  instalaciones: BloqueHomologacion[];
  totales: { partidas: number; importe: number; localizadas: number; a_verificar: number; con_cantidad: number };
  sello: string;
}

export interface Homologacion {
  id: string;
  num_obra?: string | null;
  cliente?: string | null;
  partner?: string | null;
  nif?: string | null;
  direccion?: string | null;
  cp?: string | null;
  municipio?: string | null;
  provincia?: string | null;
  /** Una obra se clasifica en una o varias de las cinco instalaciones. */
  instalaciones: string[] | null;
  /** Obra del registro de Ingeniería de la que cuelga el trámite. */
  proyecto_id?: string | null;
  proyecto_nombre?: string | null;
  estado: EstadoHomologacion;
  creado_por?: string | null;
  responsable?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  /** Documentación de la obra: Excel de mediciones, PDF de planos/memorias y DWG. */
  archivos?: {
    nombre: string; tipo: string; bytes?: number; subido?: string;
    fichero?: string; url?: string;
  }[] | null;
  /** Los dos informes del apartado (cumplimiento normativo y mediciones vs planos). */
  informes?: {
    cumplimiento?: { generado: string; archivo?: string } | null;
    mediciones?: { generado: string; archivo?: string } | null;
  } | null;
  /** Resultado del análisis de la documentación, un bloque por instalación (es un borrador). */
  resultados?: ResultadoHomologacion | null;
  /** Cuándo se lanzó el análisis (nulo = todavía no se ha analizado la documentación). */
  analizado_en?: string | null;
  n_incumplimientos: number;
  n_dudas: number;
  n_observaciones: number;
  impacto_favor?: number | null;
  impacto_contra?: number | null;
  n_no_asociados: number;
  motivo?: string | null;
  parado: boolean;
  notas?: string | null;
  observaciones?: string | null;
}

/** Las tres etapas de una instalación de legalizaciones (pedido de Salva, 7-oct-2026). */
export type EtapaTramiteNombre = 'inicio' | 'subida_portal' | 'finalizado';

/** Una etapa con su estado actual: cuándo se marcó por última vez y quién. */
export interface EtapaTramite {
  etapa: EtapaTramiteNombre;
  etiqueta: string;
  ayuda: string;
  hecha: boolean;
  fecha: string | null;
  usuario: string | null;
}

/** Una fila del registro: cada vez que alguien marcó o desmarcó una etapa. No se borra nunca. */
export interface FilaRegistroEtapa {
  etapa: EtapaTramiteNombre;
  etiqueta: string;
  hecha: boolean;
  fecha: string;
  usuario: string | null;
}

export interface EtapasTramite {
  id: string;
  etapas: EtapaTramite[];
  registro: FilaRegistroEtapa[];
}

export interface Legalizacion {
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  creado_por?: string | null;
  tipo_emisor?: string | null;
  comunidad?: string | null;
  superficie?: number | null;
  tipo_edificio?: string | null;
  dormitorios?: number | null;
  clasificacion_emplazamiento?: string | null;
  clasificacion_local?: string | null;
  sala_maquinas?: string | null;
  num_obra?: string;
  partner?: string;
  nif?: string;
  direccion?: string;
  cp?: string;
  id: string;
  id_externo?: number;
  cliente?: string;
  municipio?: string;
  provincia?: string;
  oca?: string;
  maquina?: string;
  potencia?: number;
  hidraulica?: boolean;
  estado: EstadoLegalizacion;
  n_listo: number;
  n_avisos: number;
  n_bloqueado: number;
  n_total: number;
  motivo?: string;
  dias?: number;
  parado: boolean;
  notas?: string;
  responsable?: string;
  // Datos que necesitan el formulario de edición y los documentos (2026-10-06).
  email?: string | null;
  telefono?: string | null;
  tipo_via?: string | null;
  numero?: string | null;
  bloque?: string | null;
  portal?: string | null;
  escalera?: string | null;
  piso?: string | null;
  puerta?: string | null;
  oca_cif?: string | null;
  tipo_instalacion?: string | null;
  tipo_energia?: string | null;
  tipo_uso?: string | null;
  viviendas?: number | null;
  acs_volumen_acumulador_l?: number | null;
  maquina_id?: number | null;
  maquinas_instalacion?: { maquina_id: number; unidades: number }[] | null;
  datos_obra?: Record<string, unknown> | null;
  /** Observaciones del trámite, una por línea y con la fecha delante (petición de Ariel). */
  observaciones?: string | null;
  /**
   * Etapas ya hechas del trámite (`inicio`, `subida_portal`, `finalizado`). Lo manda la lista de
   * instalaciones para que el tablero de etapas pueda pintar las tres columnas sin preguntar ficha a
   * ficha (Salva, 7-oct-2026).
   */
  etapas_hechas?: EtapaTramiteNombre[];
  /** Si el trámite está facturado (columna «Facturada» del listado). */
  facturada?: boolean;
  /**
   * Cuándo se marcó la etapa en la que está ahora (para poner arriba lo que lleva más tiempo en esa
   * columna). Si no tiene ninguna etapa marcada, es la fecha de inicio del expediente.
   */
  etapa_fecha?: string | null;
}
