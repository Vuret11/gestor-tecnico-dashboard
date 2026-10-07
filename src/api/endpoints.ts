import api from './client';
import type { AuthResponse, User, Cliente, Instalacion, InstalacionResumen, Visita, Informe, Incidencia, ChecklistPlantilla, VisitaChecklist, Foto, PlanProvincia, PlanTecnico, PlanCliente, PlanObra, PlanAsignacion, RepoCarpeta, RepoArchivo, InventarioArticulo, VisitaArticulo, Almacen, ProyectoIngenieria , Tarea, Legalizacion, Homologacion, ResumenObras, EstadoFasesObra, FichaObra, FaseObra, HitoObra, NotaObra, Retencion, MedicionDesviacion, DocumentoObra, EtapasTramite, EtapaTramiteNombre} from '../types';

export const auth = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }).then(r => r.data),
};

export const users = {
  list: () => api.get<User[]>('/usuarios').then(r => r.data),
  create: (data: Partial<User> & { password: string }) =>
    api.post<User>('/usuarios', data).then(r => r.data),
  update: (id: string, data: Partial<User>) =>
    api.patch<User>(`/usuarios/${id}`, data).then(r => r.data),
  setModulos: (id: string, modulosAcceso: string[] | null) =>
    api.patch<User>(`/usuarios/${id}/modulos`, { modulosAcceso }).then(r => r.data),
  remove: (id: string) => api.delete(`/usuarios/${id}`),
};

export const ingenieria = {
  list: (todos?: boolean) =>
    api.get<ProyectoIngenieria[]>('/ingenieria', { params: todos ? { todos: 'true' } : {} }).then(r => r.data),
  get: (id: string) => api.get<ProyectoIngenieria>(`/ingenieria/${id}`).then(r => r.data),
  create: (data: Partial<ProyectoIngenieria>) =>
    api.post<ProyectoIngenieria>('/ingenieria', data).then(r => r.data),
  update: (id: string, data: Partial<ProyectoIngenieria>) =>
    api.patch<ProyectoIngenieria>(`/ingenieria/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/ingenieria/${id}`),
};

/**
 * Seguimiento de obras por cliente: indicadores de la cabecera, estado de cada obra, ficha completa
 * (fases, retenciones, mediciones vs planos y documentación) y la subida de papeles.
 */
export const seguimiento = {
  resumen: () => api.get<ResumenObras>('/ingenieria/resumen-obras').then(r => r.data),
  estados: () => api.get<Record<string, EstadoFasesObra>>('/ingenieria/estados').then(r => r.data),
  ficha: (id: string) => api.get<FichaObra>(`/ingenieria/${id}/ficha`).then(r => r.data),
  siguienteNumero: () => api.get<{ num_obra: string }>('/ingenieria/siguiente-numero').then(r => r.data),
  actualizarFase: (faseId: string, data: Partial<FaseObra>) =>
    api.patch<FaseObra>(`/ingenieria/fases/${faseId}`, data).then(r => r.data),
  crearHito: (obraId: string, data: { nombre: string; fecha?: string | null; hecho?: boolean }) =>
    api.post<HitoObra>(`/ingenieria/${obraId}/hitos`, data).then(r => r.data),
  actualizarHito: (id: string, data: Partial<HitoObra>) =>
    api.patch<HitoObra>(`/ingenieria/hitos/${id}`, data).then(r => r.data),
  borrarHito: (id: string) => api.delete(`/ingenieria/hitos/${id}`),
  crearNota: (obraId: string, data: { texto: string; autor?: string; autor_id?: string }) =>
    api.post<NotaObra>(`/ingenieria/${obraId}/notas`, data).then(r => r.data),
  actualizarNota: (id: string, data: { texto?: string }) =>
    api.patch<NotaObra>(`/ingenieria/notas/${id}`, data).then(r => r.data),
  borrarNota: (id: string) => api.delete(`/ingenieria/notas/${id}`),
  crearRetencion: (obraId: string, data: Partial<Retencion>) =>
    api.post<Retencion>(`/ingenieria/${obraId}/retenciones`, data).then(r => r.data),
  actualizarRetencion: (id: string, data: Partial<Retencion>) =>
    api.patch<Retencion>(`/ingenieria/retenciones/${id}`, data).then(r => r.data),
  borrarRetencion: (id: string) => api.delete(`/ingenieria/retenciones/${id}`),
  guardarMediciones: (obraId: string, mediciones: Partial<MedicionDesviacion>[]) =>
    api.post<MedicionDesviacion[]>(`/ingenieria/${obraId}/mediciones`, { mediciones }).then(r => r.data),
  borrarMedicion: (id: string) => api.delete(`/ingenieria/mediciones/${id}`),
  subirDocumento: (obraId: string, file: File) => {
    const datos = new FormData();
    datos.append('file', file);
    return api.post<DocumentoObra>(`/ingenieria/${obraId}/documentos`, datos).then(r => r.data);
  },
  borrarDocumento: (obraId: string, docId: string) =>
    api.delete(`/ingenieria/${obraId}/documentos/${docId}`),
};

export const tareas = {
  list: (filtros?: { proyecto_id?: string; abiertas?: boolean }) =>
    api.get<Tarea[]>('/tareas', { params: filtros ?? {} }).then(r => r.data),
  create: (data: Partial<Tarea>) => api.post<Tarea>('/tareas', data).then(r => r.data),
  update: (id: string, data: Partial<Tarea>) => api.patch<Tarea>(`/tareas/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/tareas/${id}`),
  carga: () => api.get<{ nombre: string; abiertas: number; hechas: number; total: number }[]>('/tareas/resumen/operarios').then(r => r.data),
};

export const legalizaciones = {
  list: (filtros?: { estado?: string; responsable?: string; archivados?: string }) =>
    api.get<Legalizacion[]>('/legalizaciones', { params: filtros ?? {} }).then(r => r.data),
  resumen: () => api.get<{
    total: number; porEstado: Record<string, number>; porProvincia: Record<string, number>;
    porResponsable: Record<string, number>; documentos: { listos: number; total: number }; parados: number;
  }>('/legalizaciones/resumen').then(r => r.data),
  create: (data: Partial<Legalizacion>) => api.post<Legalizacion>('/legalizaciones', data).then(r => r.data),
  update: (id: string, data: Partial<Legalizacion>) => api.patch<Legalizacion>(`/legalizaciones/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/legalizaciones/${id}`),
  /** Las tres etapas del trámite (Inicio, Subida Portal y Finalizado) con su estado y su registro. */
  etapas: (id: string) => api.get<EtapasTramite>(`/legalizaciones/${id}/etapas`).then(r => r.data),
  /** Marca la etapa (`hecha: false` la desmarca). Cada pulsación queda registrada con quién y cuándo. */
  marcarEtapa: (id: string, etapa: EtapaTramiteNombre, hecha = true) =>
    api.post<EtapasTramite>(`/legalizaciones/${id}/etapas/${etapa}`, { hecha }).then(r => r.data),
};

/**
 * Homologaciones: el apartado hermano de Legalizaciones dentro de Ingeniería (oct-2026).
 * Una obra se clasifica en una o varias de las cinco instalaciones (clima, fontanería, PCI,
 * teleco y electricidad) y aquí se apunta el resultado de los dos informes: cumplimiento
 * normativo (incumplimientos, dudas y observaciones) y mediciones vs planos (impacto en €).
 */
export const homologaciones = {
  list: (filtros?: { estado?: string; responsable?: string; instalacion?: string }) =>
    api.get<Homologacion[]>('/homologaciones', { params: filtros ?? {} }).then(r => r.data),
  resumen: () => api.get<{
    total: number; porEstado: Record<string, number>; porInstalacion: Record<string, number>;
    porResponsable: Record<string, number>; porProvincia: Record<string, number>;
    porObra: Record<string, number>; sin_obra: number;
    diagnosticos: { incumplimientos: number; dudas: number; observaciones: number; no_asociados: number };
    impacto: { favor: number; contra: number; neto: number };
    parados: number; pendientes_revision: number;
  }>('/homologaciones/resumen').then(r => r.data),
  create: (data: Partial<Homologacion>) => api.post<Homologacion>('/homologaciones', data).then(r => r.data),
  update: (id: string, data: Partial<Homologacion>) => api.patch<Homologacion>(`/homologaciones/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/homologaciones/${id}`),
  /** Documentación de la obra: Excel de mediciones, PDF de planos/memorias y DWG. */
  subirArchivo: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<Homologacion>(`/homologaciones/${id}/archivos`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
  borrarArchivo: (id: string, indice: number) =>
    api.delete<Homologacion>(`/homologaciones/${id}/archivos/${indice}`).then(r => r.data),
  /**
   * Los informes en PDF del trámite, generados al momento en la API a partir del análisis guardado:
   * 'mediciones' (partidas vs planos), 'cumplimiento' (normativa) o 'completo' (los dos).
   */
  informePdf: (id: string, tipo: 'mediciones' | 'cumplimiento' | 'completo') =>
    api.get(`/homologaciones/${id}/informe/${tipo}`, { responseType: 'blob' }).then(r => r.data as Blob),
  /**
   * Analiza la documentación del trámite en la Pi y guarda el resultado POR INSTALACIÓN.
   * Devuelve el trámite entero con `resultados` y `analizado_en` ya puestos.
   */
  analizar: (id: string) =>
    api.post<Homologacion>(`/homologaciones/${id}/analizar`, {}, { timeout: 300000 }).then(r => r.data),
};

/**
 * Documentos oficiales del trámite, generados en la Pi (2-oct-2026).
 * Se generan solos al guardar un trámite con los datos completos; aquí se ven, se descargan y
 * se pueden regenerar a mano.
 */
export const documentosLegalizacion = {
  estado: (id: string) =>
    api.get<{
      id: string; num_obra: string | null; cliente: string | null;
      generados: Record<string, string>; faltan_datos: string[];
      documentos: { tipo: string; nombre: string; generado: string | null }[];
    }>(`/documentos-legalizacion/tramite/${id}`).then(r => r.data),
  generarTodos: (id: string) =>
    api.post<{ generados: Record<string, string>; fallos: Record<string, string>; carpeta: string }>(
      `/documentos-legalizacion/tramite/${id}`,
    ).then(r => r.data),
  descargar: (id: string, tipo: string) =>
    api.get(`/documentos-legalizacion/tramite/${id}/${tipo}/descargar`, { responseType: 'blob' })
      .then(r => r.data as Blob),
};

export const clientes = {
  list: () => api.get<Cliente[]>('/clientes').then(r => r.data),
  get: (id: string) => api.get<Cliente>(`/clientes/${id}`).then(r => r.data),
  create: (data: Partial<Cliente>) =>
    api.post<Cliente>('/clientes', data).then(r => r.data),
  update: (id: string, data: Partial<Cliente>) =>
    api.patch<Cliente>(`/clientes/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/clientes/${id}`),
};

export const instalaciones = {
  list: () => api.get<Instalacion[]>('/instalaciones').then(r => r.data),
  byCliente: (clienteId: string) =>
    api.get<Instalacion[]>(`/instalaciones/by-cliente/${clienteId}`).then(r => r.data),
  get: (id: string) => api.get<Instalacion>(`/instalaciones/${id}`).then(r => r.data),
  create: (data: Partial<Instalacion>) =>
    api.post<Instalacion>('/instalaciones', data).then(r => r.data),
  update: (id: string, data: Partial<Instalacion>) =>
    api.patch<Instalacion>(`/instalaciones/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/instalaciones/${id}`),
  uploadMemoriaTecnica: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<Instalacion>(`/instalaciones/${id}/memoria-tecnica`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
};

export const visitas = {
  list: () => api.get<Visita[]>('/visitas').then(r => r.data),
  hoy: () => api.get<Visita[]>('/visitas/hoy').then(r => r.data),
  semana: (desde: string, hasta: string) =>
    api.get<Visita[]>(`/visitas/semana?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`).then(r => r.data),
  get: (id: string) => api.get<Visita>(`/visitas/${id}`).then(r => r.data),
  create: (data: Partial<Visita>) =>
    api.post<Visita>('/visitas', data).then(r => r.data),
  update: (id: string, data: Partial<Visita>) =>
    api.patch<Visita>(`/visitas/${id}`, data).then(r => r.data),
  cancel: (id: string) => api.delete(`/visitas/${id}`),
};

export const informes = {
  list: () => api.get<Informe[]>('/informes').then(r => r.data),
  get: (id: string) => api.get<Informe>(`/informes/${id}`).then(r => r.data),
};

export const fotos = {
  porVisita: (visitaId: string) => api.get<Foto[]>(`/fotos/visita/${visitaId}`).then(r => r.data),
  upload: (visitaId: string, file: File, visibleTecnico = true) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('visita_id', visitaId);
    fd.append('nombre', file.name);
    fd.append('tipo', file.type.startsWith('image/') ? 'foto' : 'documento');
    fd.append('visibleTecnico', String(visibleTecnico));
    return api.post<Foto>('/fotos', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
};

export const checklists = {
  plantillas: () => api.get<ChecklistPlantilla[]>('/checklists/plantillas').then(r => r.data),
  plantillasByTipo: (tipo: string) =>
    api.get<ChecklistPlantilla[]>(`/checklists/plantillas/by-tipo/${tipo}`).then(r => r.data),
  plantilla: (id: string) => api.get<ChecklistPlantilla>(`/checklists/plantillas/${id}`).then(r => r.data),
  crearPlantilla: (data: Partial<ChecklistPlantilla>) =>
    api.post<ChecklistPlantilla>('/checklists/plantillas', data).then(r => r.data),
  eliminarPlantilla: (id: string) => api.delete(`/checklists/plantillas/${id}`),
  porVisita: (visitaId: string) =>
    api.get<VisitaChecklist>(`/checklists/visita/${visitaId}`).then(r => r.data),
  asignar: (visitaId: string, plantillaId: string) =>
    api.post<VisitaChecklist>(`/checklists/visita/${visitaId}`, { plantillaId }).then(r => r.data),
  guardar: (visitaId: string, data: { respuestas: { itemId: string; valor?: string }[]; firmante?: string }) =>
    api.patch<VisitaChecklist>(`/checklists/visita/${visitaId}`, data).then(r => r.data),
  completar: (visitaId: string) =>
    api.patch<VisitaChecklist>(`/checklists/visita/${visitaId}/completar`, {}).then(r => r.data),
};

export const planificacion = {
  instalacionesSistema: {
    list: () => api.get<InstalacionResumen[]>('/planificacion/instalaciones').then(r => r.data),
  },
  provincias: {
    list: () => api.get<PlanProvincia[]>('/planificacion/provincias').then(r => r.data),
    create: (d: Partial<PlanProvincia>) => api.post<PlanProvincia>('/planificacion/provincias', d).then(r => r.data),
    update: (id: string, d: Partial<PlanProvincia>) => api.patch<PlanProvincia>(`/planificacion/provincias/${id}`, d).then(r => r.data),
  },
  tecnicos: {
    list: (provinciaId?: string) => api.get<PlanTecnico[]>('/planificacion/tecnicos', { params: { provinciaId } }).then(r => r.data),
    create: (d: Partial<PlanTecnico>) => api.post<PlanTecnico>('/planificacion/tecnicos', d).then(r => r.data),
    update: (id: string, d: Partial<PlanTecnico>) => api.patch<PlanTecnico>(`/planificacion/tecnicos/${id}`, d).then(r => r.data),
    remove: (id: string) => api.delete(`/planificacion/tecnicos/${id}`),
    sincronizar: () => api.post<{ sincronizados: number; creados: number; reactivados: number }>('/planificacion/tecnicos/sincronizar').then(r => r.data),
    crearUsuarios: () => api.post<{ creados: number; omitidos: number; usuarios: { nombre: string; email: string; password: string }[] }>('/planificacion/tecnicos/crear-usuarios').then(r => r.data),
  },
  clientes: {
    list: () => api.get<PlanCliente[]>('/planificacion/clientes').then(r => r.data),
    create: (d: Partial<PlanCliente>) => api.post<PlanCliente>('/planificacion/clientes', d).then(r => r.data),
    update: (id: string, d: Partial<PlanCliente>) => api.patch<PlanCliente>(`/planificacion/clientes/${id}`, d).then(r => r.data),
    remove: (id: string) => api.delete(`/planificacion/clientes/${id}`),
  },
  obras: {
    list: (provinciaId?: string, clienteId?: string) => api.get<PlanObra[]>('/planificacion/obras', { params: { provinciaId, clienteId } }).then(r => r.data),
    create: (d: Partial<PlanObra>) => api.post<PlanObra>('/planificacion/obras', d).then(r => r.data),
    update: (id: string, d: Partial<PlanObra>) => api.patch<PlanObra>(`/planificacion/obras/${id}`, d).then(r => r.data),
    remove: (id: string) => api.delete(`/planificacion/obras/${id}`),
    sincronizar: () => api.post<{ sincronizadas: number; creadas: number; reactivadas: number }>('/planificacion/obras/sincronizar').then(r => r.data),
  },
  asignaciones: {
    semana: (desde: string, hasta: string, provinciaId?: string) =>
      api.get<PlanAsignacion[]>('/planificacion/asignaciones/semana', { params: { desde, hasta, provinciaId } }).then(r => r.data),
    mes: (year: number, month: number, provinciaId?: string) =>
      api.get<PlanAsignacion[]>('/planificacion/asignaciones/mes', { params: { year, month, provinciaId } }).then(r => r.data),
    conflictos: (desde: string, hasta: string) =>
      api.get('/planificacion/asignaciones/conflictos', { params: { desde, hasta } }).then(r => r.data),
    create: (d: Partial<PlanAsignacion>) => api.post<PlanAsignacion>('/planificacion/asignaciones', d).then(r => r.data),
    update: (id: string, d: Partial<PlanAsignacion>) => api.patch<PlanAsignacion>(`/planificacion/asignaciones/${id}`, d).then(r => r.data),
    remove: (id: string) => api.delete(`/planificacion/asignaciones/${id}`),
  },
};

export const inventario = {
  almacenes: {
    list: () => api.get<Almacen[]>('/inventario/almacenes').then(r => r.data),
    create: (nombre: string) => api.post<Almacen>('/inventario/almacenes', { nombre }).then(r => r.data),
  },
  articulos: {
    list: (todos?: boolean) =>
      api.get<InventarioArticulo[]>('/inventario/articulos', { params: todos ? { todos: 'true' } : {} }).then(r => r.data),
    create: (data: Partial<InventarioArticulo>) =>
      api.post<InventarioArticulo>('/inventario/articulos', data).then(r => r.data),
    update: (id: string, data: Partial<InventarioArticulo>) =>
      api.patch<InventarioArticulo>(`/inventario/articulos/${id}`, data).then(r => r.data),
    ajustarStock: (id: string, almacenId: string, delta?: number, stockMinimo?: number) =>
      api.patch<InventarioArticulo>(`/inventario/articulos/${id}/almacenes/${almacenId}`, { delta, stockMinimo }).then(r => r.data),
    remove: (id: string) => api.delete(`/inventario/articulos/${id}`),
  },
  visita: {
    list: (visitaId: string) =>
      api.get<VisitaArticulo[]>(`/inventario/visita/${visitaId}`).then(r => r.data),
    add: (visitaId: string, data: { articulo_id: string; cantidad: number; precioUnitario?: number; notas?: string }) =>
      api.post<VisitaArticulo>(`/inventario/visita/${visitaId}`, data).then(r => r.data),
    remove: (lineaId: string) => api.delete(`/inventario/visita/linea/${lineaId}`),
  },
  instalacion: {
    list: (instalacionId: string) =>
      api.get<VisitaArticulo[]>(`/inventario/instalacion/${instalacionId}`).then(r => r.data),
  },
  historial: (desde?: string, hasta?: string) =>
    api.get<VisitaArticulo[]>('/inventario/historial', { params: { desde, hasta } }).then(r => r.data),
};

export const stats = {
  kpisTecnicos: (desde?: string, hasta?: string) =>
    api.get<any[]>('/stats/kpis-tecnicos', { params: { desde, hasta } }).then(r => r.data),
};

export const repositorio = {
  carpetas: {
    list: () => api.get<RepoCarpeta[]>('/repositorio/carpetas').then(r => r.data),
    create: (data: { nombre: string; descripcion?: string }) =>
      api.post<RepoCarpeta>('/repositorio/carpetas', data).then(r => r.data),
    update: (id: string, data: { nombre?: string; descripcion?: string }) =>
      api.patch<RepoCarpeta>(`/repositorio/carpetas/${id}`, data).then(r => r.data),
    remove: (id: string) => api.delete(`/repositorio/carpetas/${id}`),
  },
  archivos: {
    list: (carpetaId: string) =>
      api.get<RepoArchivo[]>(`/repositorio/carpetas/${carpetaId}/archivos`).then(r => r.data),
    upload: (carpetaId: string, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post<RepoArchivo>(`/repositorio/carpetas/${carpetaId}/archivos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
    remove: (id: string) => api.delete(`/repositorio/archivos/${id}`),
  },
};

export const incidencias = {
  list: () => api.get<Incidencia[]>('/incidencias').then(r => r.data),
  abiertas: () => api.get<Incidencia[]>('/incidencias/abiertas').then(r => r.data),
  semana: (desde: string, hasta: string) =>
    api.get<Incidencia[]>(`/incidencias/semana?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`).then(r => r.data),
  create: (data: Partial<Incidencia>) =>
    api.post<Incidencia>('/incidencias', data).then(r => r.data),
  update: (id: string, data: Partial<Incidencia>) =>
    api.patch<Incidencia>(`/incidencias/${id}`, data).then(r => r.data),
  cerrar: (id: string, resolucion: string) =>
    api.patch<Incidencia>(`/incidencias/${id}/cerrar`, { resolucion }).then(r => r.data),
};

export interface MaquinaCatalogo {
  id: number;
  id_externo?: number | null;
  fabricante?: string | null;
  gama?: string | null;
  modelo?: string | null;
  potencia_calorifica_kw?: number | null;
  potencia_frigorifica_kw?: number | null;
}

// ── Máquinas que NO están en el catálogo (7-oct-2026) ────────────────────────────────────────────
// El alta de un trámite puede llevar una máquina que no está en el catálogo de las 191: la busca por
// marca y modelo en la web, lee su ficha técnica y de ahí saca los datos que la ficha publica (con la
// evidencia de cada uno). Lo que el instalador confirme se guarda como una máquina más del catálogo.
export interface FichaCandidata {
  titulo: string;
  url: string;
  dominio: string;
  esPdf: boolean;
  /** Parece del propio fabricante: es la fuente que vale. */
  delFabricante: boolean;
}

export interface DatoLeido {
  /** Campo del catálogo al que corresponde (`potencia_calorifica_kw`, `cop`, `eer`…). */
  campo: string;
  etiqueta: string;
  valor: number | string;
  /** El texto del documento del que sale el valor, para comprobarlo antes de guardarlo. */
  evidencia: string;
  /** El valor está en una fila con varios modelos: NO se rellena solo, hay que copiarlo a mano. */
  dudoso?: boolean;
  /** Los números de esa fila (los de todos los tamaños), para poder elegir el del modelo correcto. */
  candidatos?: number[];
}

export interface FichaLeida {
  fuente_url: string;
  fichero_url: string;
  fichero: string;
  paginas: number;
  datos: DatoLeido[];
  muestra: string;
}

export const maquinasApi = {
  listar: (fabricante?: string) =>
    api.get<MaquinaCatalogo[]>('/maquinas', { params: fabricante ? { fabricante } : {} }).then(r => r.data),
  fabricantes: () =>
    api.get<{ fabricante: string; cuantas: number }[]>('/maquinas/fabricantes').then(r => r.data),
  /** Busca en la web las fichas técnicas de una marca + modelo que no están en el catálogo. */
  buscarFichas: (fabricante: string, modelo: string) =>
    api.get<{ consulta: string; candidatas: FichaCandidata[] }>('/maquinas/buscar-fichas', {
      params: { fabricante, modelo },
    }).then(r => r.data),
  /** Lee un documento (por su enlace) y devuelve lo que la ficha publica, con su evidencia. */
  leerFicha: (url: string, fabricante: string, modelo: string) =>
    api.post<FichaLeida>('/maquinas/leer-ficha', { url, fabricante, modelo }).then(r => r.data),
  /** La ficha que el instalador ya tiene descargada: se sube y se lee igual. */
  subirFicha: (file: File, fabricante: string, modelo: string) => {
    const cuerpo = new FormData();
    cuerpo.append('file', file);
    cuerpo.append('fabricante', fabricante);
    cuerpo.append('modelo', modelo);
    return api.post<FichaLeida>('/maquinas/subir-ficha', cuerpo).then(r => r.data);
  },
  /** Guarda la máquina en el catálogo (con los datos que el instalador haya confirmado). */
  crear: (datos: Record<string, unknown>) =>
    api.post<MaquinaCatalogo>('/maquinas', datos).then(r => r.data),
};
