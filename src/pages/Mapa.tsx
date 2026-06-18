import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { instalaciones as api } from '../api/endpoints';
import type { Instalacion } from '../types';
import { Building2, MapPin, Phone, Users } from 'lucide-react';

// Fix Leaflet default icon paths broken by bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const activeIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const inactiveIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41"><path fill="#94a3b8" d="M12.5 0C5.596 0 0 5.596 0 12.5c0 9.375 12.5 28.5 12.5 28.5S25 21.875 25 12.5C25 5.596 19.404 0 12.5 0zm0 18.75a6.25 6.25 0 1 1 0-12.5 6.25 6.25 0 0 1 0 12.5z"/></svg>`),
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

function FlyToSelected({ selected }: { selected: Instalacion | null }) {
  const map = useMap();
  useEffect(() => {
    if (selected?.latitud && selected?.longitud) {
      map.flyTo([selected.latitud, selected.longitud], 15, { duration: 1 });
    }
  }, [selected, map]);
  return null;
}

export default function Mapa() {
  const [selected, setSelected] = useState<Instalacion | null>(null);
  const [search, setSearch] = useState('');
  const markerRefs = useRef<Record<string, L.Marker>>({});

  const { data: todas = [], isLoading } = useQuery({
    queryKey: ['instalaciones'],
    queryFn: api.list,
  });

  const conCoordenadas = todas.filter(i => i.latitud != null && i.longitud != null);
  const sinCoordenadas = todas.filter(i => i.latitud == null || i.longitud == null);

  const filtradas = conCoordenadas.filter(i =>
    !search || [i.nombre, i.cliente, i.ciudad].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  const centro: [number, number] = conCoordenadas.length > 0
    ? [
        conCoordenadas.reduce((s, i) => s + i.latitud!, 0) / conCoordenadas.length,
        conCoordenadas.reduce((s, i) => s + i.longitud!, 0) / conCoordenadas.length,
      ]
    : [40.4168, -3.7038];

  const handleSelect = (inst: Instalacion) => {
    setSelected(inst);
    markerRefs.current[inst.id]?.openPopup();
  };

  return (
    <div className="flex h-full">
      {/* ── Panel lateral ── */}
      <div className="w-72 flex flex-col border-r border-slate-200 bg-white shrink-0">
        <div className="px-4 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800 mb-3">Instalaciones</h2>
          <input
            type="text"
            placeholder="Buscar instalación…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <p className="text-xs text-slate-400 mt-2">
            {filtradas.length} en mapa{sinCoordenadas.length > 0 ? ` · ${sinCoordenadas.length} sin coordenadas` : ''}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-10 px-4">
              <MapPin size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">Sin resultados</p>
            </div>
          ) : (
            filtradas.map(inst => (
              <button
                key={inst.id}
                onClick={() => handleSelect(inst)}
                className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${selected?.id === inst.id ? 'bg-brand-light border-l-4 border-l-brand' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${inst.activo ? 'bg-green-500' : 'bg-slate-400'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{inst.nombre}</p>
                    <p className="text-xs text-slate-500 truncate">{inst.cliente}</p>
                    <p className="text-xs text-slate-400 truncate">{inst.ciudad}</p>
                  </div>
                </div>
              </button>
            ))
          )}

          {sinCoordenadas.length > 0 && (
            <div className="px-4 py-3 bg-amber-50">
              <p className="text-xs font-medium text-amber-700 mb-1">Sin coordenadas ({sinCoordenadas.length})</p>
              {sinCoordenadas.map(i => (
                <p key={i.id} className="text-xs text-amber-600 truncate">• {i.nombre}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Mapa ── */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full bg-slate-100">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Cargando instalaciones…</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={centro}
            zoom={conCoordenadas.length > 1 ? 6 : 13}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlyToSelected selected={selected} />

            {filtradas.map(inst => (
              <Marker
                key={inst.id}
                position={[inst.latitud!, inst.longitud!]}
                icon={inst.activo ? activeIcon : inactiveIcon}
                ref={ref => { if (ref) markerRefs.current[inst.id] = ref; }}
                eventHandlers={{ click: () => setSelected(inst) }}
              >
                <Popup minWidth={220}>
                  <div className="py-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${inst.activo ? 'bg-green-500' : 'bg-slate-400'}`} />
                      <span className="font-semibold text-slate-800 text-sm">{inst.nombre}</span>
                    </div>
                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Users size={11} className="shrink-0" />
                        <span>{inst.cliente}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin size={11} className="shrink-0" />
                        <span>{inst.direccion}, {inst.ciudad}</span>
                      </div>
                      {inst.telefono && (
                        <div className="flex items-center gap-1.5">
                          <Phone size={11} className="shrink-0" />
                          <span>{inst.telefono}</span>
                        </div>
                      )}
                    </div>
                    {inst.cp && <p className="text-xs text-slate-400 mt-1">CP {inst.cp}{inst.provincia ? ` · ${inst.provincia}` : ''}</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}

        {/* Badge contador */}
        <div className="absolute top-3 right-3 z-10 bg-white rounded-xl shadow-lg px-4 py-2.5 border border-slate-200">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-slate-600">{conCoordenadas.filter(i => i.activo).length} activas</span>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <Building2 size={13} className="text-slate-400" />
              <span className="text-slate-400">{todas.length} total</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
