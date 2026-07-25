import React, { useEffect } from "react";
import { MapPin } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";

// Fix React-Leaflet marker icon bug
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function MapViewController({ center }) {
  const map = useMap();
  useEffect(() => { 
    if (center?.lat) map.setView([center.lat, center.lng], map.getZoom(), { animate: true }); 
  }, [center, map]);
  return null;
}

export default function LocationPicker({ location }) {
  // Use Kolkata coordinates as a fallback while GPS loads
  const center = location || { lat: 22.5726, lng: 88.3639 };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl flex flex-col gap-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <MapPin className="text-teal-600 w-4 h-4" /> 
          Incident Location
        </h3>
        <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2.5 py-1 rounded-md uppercase tracking-wider">
          GPS Active
        </span>
      </div>

      {/* Mini Map Container */}
      <div className="h-[200px] w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 relative z-0">
         <MapContainer center={[center.lat, center.lng]} zoom={15} style={{ width: "100%", height: "100%", zIndex: 0 }}>
            <MapViewController center={center} />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {location && <Marker position={[location.lat, location.lng]} />}
         </MapContainer>
      </div>

      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300">
        {location ? `Lat: ${location.lat.toFixed(4)}, Lng: ${location.lng.toFixed(4)}` : "Detecting..."}
      </div>
    </div>
  );
}