import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import basemap from "../assets/coimbra-basemap.svg?inline";
import basemapMetadata from "../../data/coimbra.basemap.json";
import type { Network } from "../demo.ts";

interface Props {
  data: Network;
  value: string;
  onChange: (code: string) => void;
}

export default function CitizenMap({ data, value, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.LayerGroup | null>(null);

  const select = useRef(onChange);
  select.current = onChange;

  const bounds = L.latLngBounds(
    data.reaches.flatMap((r) =>
      r.geometry.map(([lon, lat]) => [lat!, lon!] as L.LatLngTuple),
    ),
  );
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  useEffect(() => {
    if (!host.current) return;
    const instance = L.map(host.current, {
      zoomControl: true,
      maxZoom: 19,
      zoomSnap: 0.25,
      scrollWheelZoom: false,
    }).fitBounds(boundsRef.current, { padding: [28, 28] });
    
    map.current = instance;

    instance.createPane("bundled-basemap").style.zIndex = "190";
    L.imageOverlay(basemap, basemapMetadata.bounds as L.LatLngBoundsExpression, {
      pane: "bundled-basemap",
      interactive: false,
    }).addTo(instance);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(instance);

    layers.current = L.layerGroup().addTo(instance);

    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(host.current);

    return () => {
      resize.disconnect();
      instance.remove();
      map.current = null;
      layers.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layers.current;
    if (!layer) return;
    layer.clearLayers();

    for (const r of data.reaches) {
      L.polyline(
        r.geometry.map(([lon, lat]) => [lat!, lon!] as L.LatLngTuple),
        { color: "#245b83", weight: 3, opacity: 0.5, interactive: false }
      ).addTo(layer);
    }

    for (const s of data.sites) {
      const isSelected = s.code === value;
      const content = document.createElement("div");
      content.className = `site-pin ${isSelected ? "site-pin-selected" : ""}`;
      const label = document.createElement("span");
      label.className = "site-code";
      label.textContent = s.code;
      content.append(label);

      const marker = L.marker([s.coordinates[1]!, s.coordinates[0]!], {
        icon: L.divIcon({
          html: content,
          className: "citizen-marker",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        }),
        title: `Site ${s.code}`,
      }).addTo(layer);

      marker.on("click", () => select.current(s.code));
    }
  }, [data, value]);

  return (
    <div style={{ height: "350px", width: "100%", position: "relative", borderRadius: "12px", overflow: "hidden", border: "1px solid #ced7ca" }}>
      <div style={{ height: "100%", width: "100%" }} ref={host} />
    </div>
  );
}
