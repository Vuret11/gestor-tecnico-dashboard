import api from './client';
import type { AuthResponse, User, Instalacion, Visita, Informe, Incidencia, ChecklistPlantilla, VisitaChecklist, Foto } from '../types';

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
};

export const instalaciones = {
  list: () => api.get<Instalacion[]>('/instalaciones').then(r => r.data),
  get: (id: string) => api.get<Instalacion>(`/instalaciones/${id}`).then(r => r.data),
  create: (data: Partial<Instalacion>) =>
    api.post<Instalacion>('/instalaciones', data).then(r => r.data),
  update: (id: string, data: Partial<Instalacion>) =>
    api.patch<Instalacion>(`/instalaciones/${id}`, data).then(r => r.data),
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
};

export const checklists = {
  plantillas: () => api.get<ChecklistPlantilla[]>('/checklists/plantillas').then(r => r.data),
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

export const incidencias = {
  list: () => api.get<Incidencia[]>('/incidencias').then(r => r.data),
  abiertas: () => api.get<Incidencia[]>('/incidencias/abiertas').then(r => r.data),
  create: (data: Partial<Incidencia>) =>
    api.post<Incidencia>('/incidencias', data).then(r => r.data),
  update: (id: string, data: Partial<Incidencia>) =>
    api.patch<Incidencia>(`/incidencias/${id}`, data).then(r => r.data),
  cerrar: (id: string, resolucion: string) =>
    api.patch<Incidencia>(`/incidencias/${id}/cerrar`, { resolucion }).then(r => r.data),
};
