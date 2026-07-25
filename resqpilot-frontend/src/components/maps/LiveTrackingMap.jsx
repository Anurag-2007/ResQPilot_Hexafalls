import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import L from "leaflet";

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

export default function LiveTrackingMap({ patientLocation, driverLocation, status, routeCoordinates }) {
  const defaultCenter = patientLocation || { lat: 22.5726, lng: 88.3639 };
  
  return (
    <div className="w-full h-full relative" style={{ minHeight: "400px" }}>
      <MapContainer 
        center={[defaultCenter.lat, defaultCenter.lng]} 
        zoom={14} 
        style={{ width: "100%", height: "100%", minHeight: "400px", zIndex: 0 }}
      >
        <MapViewController center={driverLocation || patientLocation} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        {/* Render OSRM route line between ambulance and patient */}
        {routeCoordinates && routeCoordinates.length > 0 && (
          <Polyline 
            positions={routeCoordinates.map(pt => [pt.lat, pt.lng])} 
            color="#0d9488" 
            weight={5} 
            opacity={0.8} 
          />
        )}

        {patientLocation && (
          <Marker position={[patientLocation.lat, patientLocation.lng]}>
            <Popup>Patient Location</Popup>
          </Marker>
        )}
        
        {driverLocation && (
          <Marker position={[driverLocation.lat, driverLocation.lng]}>
            <Popup>Ambulance - {status}</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}