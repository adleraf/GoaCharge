import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GoaChargeStation } from "../types/station";

interface GoaMapProps {
  stations: GoaChargeStation[];
  selectedStationId: number | null;
  onSelectStation: (station: GoaChargeStation) => void;
  flyToCoords?: [number, number] | null;
}

const GOA_CENTER: [number, number] = [74.124, 15.35];
const GOA_DEFAULT_ZOOM = 9.5;

export default function GoaMap({
  stations,
  selectedStationId,
  onSelectStation,
  flyToCoords,
}: GoaMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<number, { marker: maplibregl.Marker; el: HTMLDivElement }>>(
    new Map()
  );

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/dark",
      center: GOA_CENTER,
      zoom: GOA_DEFAULT_ZOOM,
    });

    map.current.on("error", (e) => {
      console.error("MAPLIBRE ERROR:", e);
    });

    map.current.addControl(new maplibregl.NavigationControl(), "bottom-right");

    map.current.on("load", () => {
      if (!map.current) return;

      // Dark theme style adjustments
      const style = map.current.getStyle();
      if (style && style.layers) {
        style.layers.forEach((layer) => {
          if (layer.id === "background") {
            map.current!.setPaintProperty(layer.id, "background-color", "#0a1d24");
          } else if (layer.id === "water") {
            map.current!.setPaintProperty(layer.id, "fill-color", "#02060b");
          } else if (layer.id.startsWith("landcover") || layer.id.startsWith("landuse")) {
            map.current!.setPaintProperty(layer.id, "fill-color", "#0c242c");
          } else if (
            layer.id.startsWith("highway") ||
            layer.id.startsWith("railway") ||
            layer.id.startsWith("aeroway")
          ) {
            if (layer.type === "line") {
              map.current!.setPaintProperty(layer.id, "line-color", "rgba(255, 255, 255, 0.02)");
            }
          } else if (layer.id.startsWith("boundary")) {
            if (layer.type === "line") {
              map.current!.setPaintProperty(layer.id, "line-color", "#14b8a6");
              map.current!.setPaintProperty(layer.id, "line-opacity", 0.4);
            }
          } else if (layer.id === "water_name") {
            map.current!.setPaintProperty(layer.id, "text-color", "rgba(20, 184, 166, 0.3)");
            map.current!.setPaintProperty(layer.id, "text-halo-width", 0);
          } else if (layer.id === "place_village" || layer.id === "place_suburb") {
            map.current!.setPaintProperty(layer.id, "text-color", "rgba(203, 213, 225, 0.4)");
            map.current!.setPaintProperty(layer.id, "text-halo-color", "#02060b");
            map.current!.setPaintProperty(layer.id, "text-halo-width", 2);
          } else if (layer.id.startsWith("place")) {
            map.current!.setPaintProperty(layer.id, "text-color", "#f8fafc");
            map.current!.setPaintProperty(layer.id, "text-halo-color", "#02060b");
            map.current!.setPaintProperty(layer.id, "text-halo-width", 2);
          }
        });
      }

      // Goa boundary GeoJSON source and glow layers
      map.current.addSource("goa-boundary", {
        type: "geojson",
        data: "/data/goa-boundary.geojson",
      });

      map.current.addLayer({
        id: "goa-boundary-glow",
        type: "line",
        source: "goa-boundary",
        paint: {
          "line-color": "#5EEAD4",
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 4, 12, 10],
          "line-opacity": 0.3,
          "line-blur": ["interpolate", ["linear"], ["zoom"], 8, 2, 12, 6],
        },
      });

      map.current.addLayer({
        id: "goa-boundary-core",
        type: "line",
        source: "goa-boundary",
        paint: {
          "line-color": "#5EEAD4",
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1, 12, 3],
          "line-opacity": 0.8,
        },
      });

      // WebGL energy-pulse custom layer
      let program: WebGLProgram | null = null;
      let aPos: number = -1;
      let aUv: number = -1;
      let uMatrix: WebGLUniformLocation | null = null;
      let uTime: WebGLUniformLocation | null = null;
      let buffer: WebGLBuffer | null = null;

      const customLayer: maplibregl.CustomLayerInterface = {
        id: "energy-pulse",
        type: "custom",
        renderingMode: "2d",

        onAdd: function (_mapInstance, gl) {
          const vertexSource = `
            attribute vec2 a_pos;
            attribute vec2 a_uv;
            uniform mat4 u_matrix;
            varying vec2 v_uv;
            
            void main() {
                v_uv = a_uv;
                gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
            }
          `;

          const fragmentSource = `
            precision mediump float;
            varying vec2 v_uv;
            uniform float u_time;
            
            void main() {
                float dist = length(v_uv);
                float phase = fract(u_time * 0.4); 
                float ring = smoothstep(0.1, 0.0, abs(dist - phase));
                float edgeFade = 1.0 - smoothstep(0.8, 1.0, dist);
                float timeFade = 1.0 - smoothstep(0.5, 1.0, phase);
                vec3 color = vec3(0.37, 0.92, 0.83);
                float alpha = ring * edgeFade * timeFade;
                float core = smoothstep(0.1, 0.0, dist) * 0.3;
                alpha += core;
                if (dist > 1.0) discard;
                gl_FragColor = vec4(color, alpha);
            }
          `;

          const createShader = (type: number, source: string) => {
            const shader = gl.createShader(type)!;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            return shader;
          };

          const vertexShader = createShader(gl.VERTEX_SHADER, vertexSource);
          const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentSource);

          program = gl.createProgram()!;
          gl.attachShader(program, vertexShader);
          gl.attachShader(program, fragmentShader);
          gl.linkProgram(program);

          aPos = gl.getAttribLocation(program, "a_pos");
          aUv = gl.getAttribLocation(program, "a_uv");
          uMatrix = gl.getUniformLocation(program, "u_matrix");
          uTime = gl.getUniformLocation(program, "u_time");

          const pondaLngLat: [number, number] = [74.01, 15.4];
          const center = maplibregl.MercatorCoordinate.fromLngLat(pondaLngLat);
          const radius = 8000 * center.meterInMercatorCoordinateUnits();

          const x = center.x;
          const y = center.y;

          const vertices = new Float32Array([
            x - radius, y - radius, -1, -1,
            x + radius, y - radius,  1, -1,
            x - radius, y + radius, -1,  1,
            x + radius, y + radius,  1,  1,
          ]);

          buffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        },

        render: function (gl, matrix) {
          if (!program || !buffer) return;

          gl.useProgram(program);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

          gl.enableVertexAttribArray(aPos);
          gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);

          gl.enableVertexAttribArray(aUv);
          gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

          // WebGL2 uniformMatrix4fv compatibility check
          const mat =
            matrix instanceof Float32Array
              ? matrix
              : new Float32Array(Array.from(matrix as unknown as ArrayLike<number>));
          gl.uniformMatrix4fv(uMatrix, false, mat);

          gl.uniform1f(uTime, performance.now() / 1000.0);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

          map.current?.triggerRepaint();
        },
      };

      map.current.addLayer(customLayer);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update MapLibre markers when station data changes
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();

    stations.forEach((station) => {
      const isSelected = station.ocmId === selectedStationId;

      // Create custom marker DOM element
      const el = document.createElement("div");
      el.className = `ev-map-marker ${isSelected ? "selected" : ""}`;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `${station.name} (${station.town || "Goa"})`);
      el.setAttribute("tabindex", "0");

      const maxPower = station.connections.reduce<number | null>(
        (max, c) => (c.powerKW != null ? (max == null ? c.powerKW : Math.max(max, c.powerKW)) : max),
        null
      );

      el.innerHTML = `
        <div class="marker-pulse-ring"></div>
        <div class="marker-pin">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </div>
        ${maxPower ? `<div class="marker-badge">${maxPower}k</div>` : ""}
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectStation(station);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([station.longitude, station.latitude])
        .addTo(map.current!);

      markersRef.current.set(station.ocmId, { marker, el });
    });
  }, [stations, onSelectStation]);

  // Update marker selection classes when selectedStationId changes
  useEffect(() => {
    markersRef.current.forEach(({ el }, id) => {
      if (id === selectedStationId) {
        el.classList.add("selected");
      } else {
        el.classList.remove("selected");
      }
    });
  }, [selectedStationId]);

  // FlyTo coordinates when flyToCoords or selection changes
  useEffect(() => {
    if (!map.current || !flyToCoords) return;

    map.current.flyTo({
      center: flyToCoords,
      zoom: 13.5,
      pitch: 25,
      essential: true,
      duration: 1000,
    });
  }, [flyToCoords]);

  // Reset to full Goa view
  const handleResetGoa = () => {
    if (!map.current) return;
    map.current.flyTo({
      center: GOA_CENTER,
      zoom: GOA_DEFAULT_ZOOM,
      pitch: 0,
      bearing: 0,
      essential: true,
      duration: 900,
    });
  };

  return (
    <div className="goa-map-root">
      <div ref={mapContainer} className="goa-map" />

      {/* Floating map controls */}
      <div className="map-custom-controls">
        <button
          className="map-control-btn reset-goa-btn"
          onClick={handleResetGoa}
          title="Reset to full Goa view"
          aria-label="Focus Goa map view"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
            <line x1="8" y1="2" x2="8" y2="18"></line>
            <line x1="16" y1="6" x2="16" y2="22"></line>
          </svg>
          <span>Focus Goa</span>
        </button>
      </div>
    </div>
  );
}