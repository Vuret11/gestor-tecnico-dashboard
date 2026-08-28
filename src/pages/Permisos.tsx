import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { users as usersApi } from '../api/endpoints';
import type { User } from '../types';
import { TODOS_LOS_MODULOS, MODULO_LABELS, type Modulo } from '../hooks/usePermissions';
import { Shield, Check, X, Info, RotateCcw } from 'lucide-react';

const ROL_DEFAULTS: Record<string, Modulo[]> = {
  admin: [...TODOS_LOS_MODULOS],
  oficina: ['dashboard', 'visitas', 'instalaciones', 'clientes', 'planificacion', 'inventario', 'auditorias', 'repositorio', 'incidencias'],
  tecnico: ['dashboard', 'visitas', 'repositorio', 'ingenieria'],
};

const ROL_LABELS: Record<string, string> = {
  admin: 'Administrador', oficina: 'Oficina', tecnico: 'Técnico',
};
const ROL_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700', oficina: 'bg-blue-100 text-blue-700', tecnico: 'bg-green-100 text-green-700',
};

const MODULO_GRUPOS: { label: string; modulos: Modulo[] }[] = [
  { label: 'Principal', modulos: ['dashboard', 'visitas', 'instalaciones', 'clientes'] },
  { label: 'Operaciones', modulos: ['planificacion', 'inventario', 'incidencias', 'repositorio'] },
  { label: 'Analytics', modulos: ['auditorias'] },
  { label: 'Técnico', modulos: ['ingenieria'] },
  { label: 'Administración', modulos: ['usuarios', 'permisos'] },
];

function UserRow({ user }: { user: User }) {
  const qc = useQueryClient();
  const defaultModulos = ROL_DEFAULTS[user.rol] ?? ['dashboard'];
  const tieneCustom = user.modulosAcceso != null;
  const modulos: Modulo[] = tieneCustom ? (user.modulosAcceso as Modulo[]) : defaultModulos;

  const [local, setLocal] = useState<Modulo[]>(modulos);
  const [editando, setEditando] = useState(false);
  const [modified, setModified] = useState(false);

  const save = useMutation({
    mutationFn: (nuevos: Modulo[] | null) => usersApi.setModulos(user.id, nuevos),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); setEditando(false); setModified(false); },
  });

  const toggle = (m: Modulo) => {
    setLocal(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
    setModified(true);
  };

  const resetToDefault = () => {
    setLocal(defaultModulos);
    setModified(true);
  };

  const handleSave = () => save.mutate(local);
  const handleReset = () => {
    save.mutate(null);
    setLocal(defaultModulos);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header fila */}
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
          <span className="text-brand text-sm font-bold">{user.nombre[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900">{user.nombre}</p>
            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${ROL_COLORS[user.rol]}`}>
              {ROL_LABELS[user.rol]}
            </span>
            {user.departamento && (
              <span className="text-[11px] text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">
                {user.departamento}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">{user.email}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {tieneCustom && (
            <span className="text-[11px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
              Permisos personalizados
            </span>
          )}
          {!tieneCustom && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Info size={11} /> Por defecto ({ROL_LABELS[user.rol]})
            </span>
          )}
          <button
            onClick={() => setEditando(v => !v)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${editando ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {editando ? 'Cerrar' : 'Editar permisos'}
          </button>
        </div>
      </div>

      {/* Panel de módulos */}
      {editando && (
        <div className="border-t border-slate-100 px-5 py-4 bg-slate-50">
          <div className="space-y-4">
            {MODULO_GRUPOS.map(grupo => (
              <div key={grupo.label}>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{grupo.label}</p>
                <div className="flex flex-wrap gap-2">
                  {grupo.modulos.map(m => {
                    const activo = local.includes(m);
                    const esDefault = defaultModulos.includes(m);
                    return (
                      <button
                        key={m}
                        onClick={() => toggle(m)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          activo
                            ? 'bg-brand text-white border-brand shadow-sm'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {activo ? <Check size={11} /> : <X size={11} />}
                        {MODULO_LABELS[m]}
                        {!esDefault && activo && <span className="text-[10px] opacity-70">(extra)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-200">
            <button
              onClick={handleSave}
              disabled={save.isPending || !modified}
              className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50"
            >
              {save.isPending ? 'Guardando...' : 'Guardar permisos'}
            </button>
            <button
              onClick={resetToDefault}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-white"
            >
              <RotateCcw size={12} /> Restaurar por defecto del rol
            </button>
            {tieneCustom && (
              <button
                onClick={handleReset}
                disabled={save.isPending}
                className="text-xs text-red-500 hover:text-red-700 ml-auto"
              >
                Eliminar personalización
              </button>
            )}
          </div>
        </div>
      )}

      {/* Vista compacta de módulos cuando no se edita */}
      {!editando && (
        <div className="border-t border-slate-100 px-5 py-3">
          <div className="flex flex-wrap gap-1.5">
            {TODOS_LOS_MODULOS.map(m => (
              <span
                key={m}
                className={`text-[11px] px-2 py-0.5 rounded-full ${
                  modulos.includes(m)
                    ? 'bg-brand/10 text-brand font-medium'
                    : 'bg-slate-100 text-slate-300 line-through'
                }`}
              >
                {MODULO_LABELS[m]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Permisos() {
  const { data: users = [], isLoading } = useQuery({ queryKey: ['usuarios'], queryFn: usersApi.list });
  const [filtroRol, setFiltroRol] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const filtrados = (users as User[]).filter(u => {
    if (!u.activo) return false;
    if (filtroRol && u.rol !== filtroRol) return false;
    if (busqueda && !u.nombre.toLowerCase().includes(busqueda.toLowerCase()) && !u.email.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  const conCustom = (users as User[]).filter(u => u.activo && u.modulosAcceso != null).length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Permisos de acceso</h1>
          <p className="text-sm text-slate-500">
            {(users as User[]).filter(u => u.activo).length} usuarios activos · {conCustom} con permisos personalizados
          </p>
        </div>
      </div>

      {/* Info de defaults */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 flex items-start gap-3">
        <Info size={16} className="flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Permisos por defecto según rol</p>
          <div className="mt-1 space-y-0.5 text-xs">
            {Object.entries(ROL_DEFAULTS).map(([rol, mods]) => (
              <p key={rol}><strong>{ROL_LABELS[rol]}:</strong> {mods.map(m => MODULO_LABELS[m]).join(', ')}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3">
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar usuario..."
          className="flex-1 min-w-[180px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-slate-50" />
        <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Todos los roles</option>
          <option value="admin">Administrador</option>
          <option value="oficina">Oficina</option>
          <option value="tecnico">Técnico</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>}

      <div className="space-y-4">
        {filtrados.map(u => <UserRow key={u.id} user={u} />)}
        {!isLoading && filtrados.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Sin usuarios que coincidan</p>
        )}
      </div>
    </div>
  );
}
