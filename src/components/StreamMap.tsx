import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { InvestigationResult } from "../../engine/index.ts";
import { siteSummary, type DemoState, type Network } from "../demo.ts";
interface Props {
  data: Network;
  result: InvestigationResult;
  state: DemoState;
  reducedMotion: boolean;
  onSelect: (code: string) => void;
  onTileFailure: () => void;
}
export function StreamMap({
  data,
  result,
  state,
  reducedMotion,
  onSelect,
  onTileFailure,
}: Props) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null);
  const layers = useRef<L.LayerGroup | null>(null);
  const select = useRef(onSelect),
    failure = useRef(onTileFailure);
  select.current = onSelect;
  failure.current = onTileFailure;
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
      scrollWheelZoom: false,
      zoomAnimation: !reducedMotion,
      fadeAnimation: !reducedMotion,
      markerZoomAnimation: !reducedMotion,
    }).fitBounds(boundsRef.current, { padding: [28, 28] });
    map.current = instance;
    layers.current = L.layerGroup().addTo(instance);
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        maxZoom: 19,
        keepBuffer: 0,
        updateWhenIdle: true,
        detectRetina: false,
      },
    ).addTo(instance);
    let failed = false;
    tiles.on("tileerror", () => {
      if (!failed) {
        failed = true;
        failure.current();
      }
    });
    instance
      .getContainer()
      .setAttribute(
        "aria-label",
        "Coimbra stream map. Use arrow keys to pan, plus and minus to zoom.",
      );
    instance.getContainer().setAttribute("role", "region");
    instance
      .getContainer()
      .querySelector(".leaflet-control-zoom-in")
      ?.setAttribute("aria-label", "Zoom in");
    instance
      .getContainer()
      .querySelector(".leaflet-control-zoom-out")
      ?.setAttribute("aria-label", "Zoom out");
    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      instance.remove();
      map.current = null;
      layers.current = null;
    };
  }, [data, reducedMotion]);
  useEffect(() => {
    const layer = layers.current;
    if (!layer) return;
    layer.clearLayers();
    const candidates = new Set(result.candidates);
    for (const r of data.reaches) {
      const candidate = candidates.has(r.id),
        single = candidate && candidates.size === 1;
      const path = L.polyline(
        r.geometry.map(([lon, lat]) => [lat!, lon!] as L.LatLngTuple),
        {
          color: single ? "#a34924" : candidate ? "#245b83" : "#bac3c5",
          weight: single ? 7 : candidate ? 4 : 2,
          opacity: candidate ? 1 : 0.7,
          className: candidate && !reducedMotion ? "reach-flow" : "",
          interactive: false,
        },
      ).addTo(layer);
      if (single)
        path.bindTooltip("Priority area for further investigation", {
          permanent: true,
          direction: "center",
        });
    }
    for (const s of data.sites) {
      const recommended = result.recommendation?.siteCode === s.code;
      const summary = siteSummary(state, s.code);
      const content = document.createElement("div");
      content.className = `site-pin${recommended ? " site-pin-next" : ""}`;
      const label = document.createElement("span");
      label.className = "site-code";
      label.textContent = s.code;
      content.append(label);
      if (summary !== "No observations") {
        const text = document.createElement("small");
        text.textContent = summary;
        content.append(text);
      }
      const marker = L.marker([s.coordinates[1]!, s.coordinates[0]!], {
        icon: L.divIcon({
          html: content,
          className: "atlas-marker",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        }),
        keyboard: true,
        title: `Site ${s.code}: ${summary}${recommended ? ". Check here next" : ""}`,
      }).addTo(layer);
      const el = marker.getElement();
      el?.setAttribute("role", "button");
      el?.setAttribute(
        "aria-label",
        `Open site ${s.code}: ${summary}${recommended ? ". Check here next" : ""}`,
      );
      el?.addEventListener("keydown", (event) => {
        if (event.key === " ") {
          event.preventDefault();
          select.current(s.code);
        }
      });
      marker.on("click", () => select.current(s.code));
      if (recommended)
        marker.bindTooltip("Check here next", {
          permanent: true,
          direction: "top",
          offset: [0, -18],
        });
    }
  }, [data, result, state, reducedMotion]);
  return (
    <div className="map-wrap">
      <div className="leaflet-host" ref={host} />
      <button
        className="map-fit"
        onClick={() =>
          map.current?.fitBounds(boundsRef.current, {
            padding: [28, 28],
            animate: false,
          })
        }
      >
        Fit study area
      </button>
      <div className="map-caption">
        Coimbra, Portugal <span>Provisional OSM flow direction</span>
      </div>
    </div>
  );
}
