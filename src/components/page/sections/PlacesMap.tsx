"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { z } from "zod";
import type { PlaceSchema } from "@/lib/content/schema";

type Place = z.infer<typeof PlaceSchema>;

function heartIcon(color: string) {
  return L.divIcon({
    className: "heart-pin",
    iconSize: [34, 34],
    iconAnchor: [17, 32],
    popupAnchor: [0, -28],
    html: `<svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.4 5 6.8 5c2 0 3.6 1.1 5.2 3 1.6-1.9 3.2-3 5.2-3 3.4 0 5.8 3.3 4.3 6.8C19.5 16.4 12 21 12 21z" fill="${color}" stroke="white" stroke-width="1.6"/></svg>`,
  });
}

function FitBounds({ points, active }: { points: [number, number][]; active: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (active) map.flyTo(active, 14, { duration: 0.8 });
    else if (points.length === 1) map.setView(points[0]!, 13);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  }, [map, points, active]);
  return null;
}

export default function PlacesMap({ places, active, onSelect, color }: { places: Place[]; active: string | null; onSelect: (id: string) => void; color: string }) {
  const located = places.filter((p): p is Place & { lat: number; lng: number } => p.lat !== null && p.lng !== null);
  const key = located.map((p) => `${p.lat},${p.lng}`).join("|");
  const points = useMemo(() => (key ? key.split("|").map((pair) => pair.split(",").map(Number) as [number, number]) : []), [key]);
  const icon = useMemo(() => heartIcon(color), [color]);
  const activePlace = located.find((p) => p.id === active);
  if (!located.length) return null;

  return (
    <div className="love-card aspect-[4/3] w-full overflow-hidden @md:aspect-video">
      <MapContainer center={points[0]} zoom={12} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }} attributionControl>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {located.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={icon} eventHandlers={{ click: () => onSelect(p.id) }}>
            <Popup>
              <strong>{p.name}</strong>
              {p.story ? <div style={{ maxWidth: 200 }}>{p.story.slice(0, 160)}</div> : null}
            </Popup>
          </Marker>
        ))}
        <FitBounds points={points} active={activePlace ? [activePlace.lat, activePlace.lng] : null} />
      </MapContainer>
    </div>
  );
}
