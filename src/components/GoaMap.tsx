import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GoaChargeStation } from "../types/station";
import type { RouteData } from "../services/routeService";
import type { UserCoords } from "../hooks/useGeolocation";

interface GoaMapProps {
  stations: GoaChargeStation[];
  selectedStationId: number | null;
  onSelectStation: (station: GoaChargeStation) => void;
  flyToCoords?: [number, number] | null;
  activeRoute?: RouteData | null;
  isNavigating?: boolean;
  onFitRoute?: () => void;
  /** Live user position from geolocation (null when unavailable) */
  userLocation?: UserCoords | null;
  /** Whether geolocation watch is currently active */
  isLocating?: boolean;
  /** Called when user clicks the "Near Me" button */
  onToggleNearMe?: () => void;
}

const GOA_CENTER: [number, number] = [74.05, 15.35];
const GOA_DEFAULT_ZOOM = 9.8;

export default function GoaMap({
  stations,
  selectedStationId,
  onSelectStation,
  flyToCoords,
  activeRoute,
  isNavigating = false,
  userLocation,
  isLocating = false,
  onToggleNearMe,
}: GoaMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<number, { marker: maplibregl.Marker; el: HTMLDivElement }>>(
    new Map()
  );
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const nearMeMarkerRef = useRef<maplibregl.Marker | null>(null);
  const perimeterAnimRef = useRef<number | null>(null);
  const stateLabelMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pulseGoaBoundaryRef = useRef<(() => void) | null>(null);
  const hasFlownToUserRef = useRef(false);

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

    map.current.on("load", async () => {
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

      // ── 1. Load Goa GeoJSON & Setup Visual Mask / Boundaries ────────
      try {
        const res = await fetch("/data/goa-boundary.geojson");
        const boundaryGeoJSON = await res.json();
        if (!map.current) return;

        // Extract polygon rings for the outside-Goa dimming mask
        const worldBox = [
          [-180, 85],
          [180, 85],
          [180, -85],
          [-180, -85],
          [-180, 85],
        ];

        let holes: number[][][] = [];
        const geom = boundaryGeoJSON.features[0].geometry;
        if (geom.type === "MultiPolygon") {
          holes = geom.coordinates.map((poly: number[][][]) => poly[0]);
        } else if (geom.type === "Polygon") {
          holes = [geom.coordinates[0]];
        }

        const maskGeoJSON = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "Polygon",
                coordinates: [worldBox, ...holes],
              },
            },
          ],
        };

        // Source: Outside Goa mask (world polygon with Goa as cutout holes)
        map.current.addSource("goa-mask", {
          type: "geojson",
          data: maskGeoJSON as any,
        });

        // Layer: Outside Goa dimming overlay (quiet, less saturated, yet roads & geography remain visible)
        map.current.addLayer({
          id: "goa-mask-layer",
          type: "fill",
          source: "goa-mask",
          paint: {
            "fill-color": "#03080d",
            "fill-opacity": 0.52,
          },
        });

        // Source: Official Goa boundary
        map.current.addSource("goa-boundary", {
          type: "geojson",
          data: boundaryGeoJSON,
        });

        // Layer: Subtle translucent teal fill INSIDE Goa
        map.current.addLayer({
          id: "goa-fill",
          type: "fill",
          source: "goa-boundary",
          paint: {
            "fill-color": "#0d9488",
            "fill-opacity": 0.08,
          },
        });

        // Layer: Soft, elegant ambient glow around the Goa boundary
        map.current.addLayer({
          id: "goa-boundary-glow",
          type: "line",
          source: "goa-boundary",
          paint: {
            "line-color": "#14b8a6",
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 4, 12, 10],
            "line-opacity": 0.35,
            "line-blur": ["interpolate", ["linear"], ["zoom"], 8, 2, 12, 6],
          },
        });

        // Layer: Crisp, refined teal outline around Goa
        map.current.addLayer({
          id: "goa-boundary-core",
          type: "line",
          source: "goa-boundary",
          paint: {
            "line-color": "#5EEAD4",
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.2, 12, 2.5],
            "line-opacity": 0.85,
          },
        });

        // ── 2. Animated Energy Pulse Travelling Around Perimeter ────────
        let perimeterCoords: [number, number][] = [];
        if (geom.type === "MultiPolygon") {
          perimeterCoords = geom.coordinates[0][0];
        } else if (geom.type === "Polygon") {
          perimeterCoords = geom.coordinates[0];
        }

        // Sample every 12th point for smooth ~640 point circuit (~30 FPS)
        const sampledPerimeter = perimeterCoords.filter((_, idx) => idx % 12 === 0);

        if (sampledPerimeter.length > 0) {
          map.current.addSource("goa-perimeter-pulse", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "Point",
                    coordinates: sampledPerimeter[0],
                  },
                },
              ],
            },
          });

          // Soft traveling halo
          map.current.addLayer({
            id: "goa-perimeter-pulse-halo",
            type: "circle",
            source: "goa-perimeter-pulse",
            paint: {
              "circle-color": "#5EEAD4",
              "circle-radius": 8,
              "circle-blur": 0.75,
              "circle-opacity": 0.5,
            },
          });

          // Crisp radiant core
          map.current.addLayer({
            id: "goa-perimeter-pulse-core",
            type: "circle",
            source: "goa-perimeter-pulse",
            paint: {
              "circle-color": "#ffffff",
              "circle-radius": 2.2,
              "circle-opacity": 0.95,
            },
          });

          let pulseIdx = 0;
          let lastPulseTick = performance.now();

          const stepPerimeterPulse = (now: number) => {
            if (!map.current) return;
            if (now - lastPulseTick >= 32) {
              lastPulseTick = now;
              pulseIdx = (pulseIdx + 1) % sampledPerimeter.length;
              const pt = sampledPerimeter[pulseIdx];
              const src = map.current.getSource("goa-perimeter-pulse") as
                | maplibregl.GeoJSONSource
                | undefined;
              if (src) {
                src.setData({
                  type: "FeatureCollection",
                  features: [
                    {
                      type: "Feature",
                      properties: {},
                      geometry: {
                        type: "Point",
                        coordinates: pt,
                      },
                    },
                  ],
                });
              }
            }
            perimeterAnimRef.current = requestAnimationFrame(stepPerimeterPulse);
          };

          perimeterAnimRef.current = requestAnimationFrame(stepPerimeterPulse);
        }

        // ── 3. Central Goa Branding Label ────────────────────────────
        const labelEl = document.createElement("div");
        labelEl.className = "goa-central-label";
        labelEl.innerHTML = `
          <div class="goa-central-label-title">GOA</div>
          <div class="goa-central-label-subtitle">EV CHARGING NETWORK</div>
        `;

        stateLabelMarkerRef.current = new maplibregl.Marker({
          element: labelEl,
          anchor: "center",
        })
          .setLngLat([74.05, 15.35])
          .addTo(map.current);

        const updateLabelOpacity = () => {
          if (!map.current) return;
          const zoom = map.current.getZoom();
          if (zoom > 12) {
            labelEl.style.opacity = "0";
          } else if (zoom <= 10.5) {
            labelEl.style.opacity = "0.85";
          } else {
            const factor = (12 - zoom) / 1.5;
            labelEl.style.opacity = (factor * 0.85).toFixed(2);
          }
        };

        map.current.on("zoom", updateLabelOpacity);
        updateLabelOpacity();

        // ── 4. Interactive Boundary Hover & Click (queryRenderedFeatures) ──
        let isHovering = false;

        const pulseGoaBoundary = () => {
          if (!map.current || !map.current.getLayer("goa-boundary-glow")) return;
          const start = performance.now();
          const duration = 850;

          const pulseStep = (now: number) => {
            if (!map.current || !map.current.getLayer("goa-boundary-glow")) return;
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const wave = Math.sin(progress * Math.PI);

            map.current.setPaintProperty("goa-boundary-glow", "line-width", 5 + wave * 11);
            map.current.setPaintProperty("goa-boundary-glow", "line-opacity", 0.35 + wave * 0.45);
            map.current.setPaintProperty("goa-fill", "fill-opacity", 0.08 + wave * 0.07);

            if (progress < 1) {
              requestAnimationFrame(pulseStep);
            } else {
              map.current.setPaintProperty("goa-boundary-glow", "line-width", [
                "interpolate",
                ["linear"],
                ["zoom"],
                8,
                4,
                12,
                10,
              ]);
              map.current.setPaintProperty("goa-boundary-glow", "line-opacity", 0.35);
              map.current.setPaintProperty("goa-fill", "fill-opacity", 0.08);
            }
          };

          requestAnimationFrame(pulseStep);
        };

        pulseGoaBoundaryRef.current = pulseGoaBoundary;

        map.current.on("mousemove", (e) => {
          if (!map.current || !map.current.getLayer("goa-fill")) return;
          const features = map.current.queryRenderedFeatures(e.point, {
            layers: ["goa-fill"],
          });
          const hovering = features.length > 0;
          if (hovering !== isHovering) {
            isHovering = hovering;
            map.current.getCanvas().style.cursor = hovering ? "pointer" : "";

            if (hovering) {
              map.current.setPaintProperty("goa-boundary-glow", "line-opacity", 0.65);
              map.current.setPaintProperty("goa-boundary-glow", "line-width", 8);
              map.current.setPaintProperty("goa-boundary-core", "line-opacity", 1.0);
              map.current.setPaintProperty("goa-fill", "fill-opacity", 0.13);
            } else {
              map.current.setPaintProperty("goa-boundary-glow", "line-opacity", 0.35);
              map.current.setPaintProperty("goa-boundary-glow", "line-width", [
                "interpolate",
                ["linear"],
                ["zoom"],
                8,
                4,
                12,
                10,
              ]);
              map.current.setPaintProperty("goa-boundary-core", "line-opacity", 0.85);
              map.current.setPaintProperty("goa-fill", "fill-opacity", 0.08);
            }
          }
        });

        map.current.on("click", (e) => {
          if (!map.current || !map.current.getLayer("goa-fill")) return;
          const features = map.current.queryRenderedFeatures(e.point, {
            layers: ["goa-fill"],
          });
          if (features.length > 0) {
            map.current.flyTo({
              center: GOA_CENTER,
              zoom: GOA_DEFAULT_ZOOM,
              pitch: 0,
              bearing: 0,
              essential: true,
              duration: 1000,
            });
            pulseGoaBoundary();
          }
        });
      } catch (err) {
        console.error("Failed to load Goa boundary GeoJSON:", err);
      }

      // ── Dedicated Route Source and Layers ────────────────────────────
      map.current.addSource("goacharge-route", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      // Outer glow / casing for driving route
      map.current.addLayer({
        id: "goacharge-route-casing",
        type: "line",
        source: "goacharge-route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#0f766e",
          "line-width": 9,
          "line-opacity": 0.6,
          "line-blur": 3,
        },
      });

      // Vibrant electric route line
      map.current.addLayer({
        id: "goacharge-route-core",
        type: "line",
        source: "goacharge-route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#5EEAD4",
          "line-width": 4.5,
          "line-opacity": 0.95,
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
      if (perimeterAnimRef.current != null) {
        cancelAnimationFrame(perimeterAnimRef.current);
        perimeterAnimRef.current = null;
      }
      if (stateLabelMarkerRef.current) {
        stateLabelMarkerRef.current.remove();
        stateLabelMarkerRef.current = null;
      }
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update MapLibre markers when station data changes
  useEffect(() => {
    if (!map.current) return;

    // Clear existing station markers
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();

    stations.forEach((station) => {
      const isSelected = station.ocmId === selectedStationId;

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

  // FlyTo coordinates when flyToCoords changes (and no route is actively being fitted)
  useEffect(() => {
    if (!map.current || !flyToCoords || activeRoute) return;

    map.current.flyTo({
      center: flyToCoords,
      zoom: 13.5,
      pitch: 25,
      essential: true,
      duration: 1000,
    });
  }, [flyToCoords, activeRoute]);

  // ── Synchronize Active Route with MapLibre Source and User Marker ───
  useEffect(() => {
    if (!map.current) return;

    const source = map.current.getSource("goacharge-route") as
      | maplibregl.GeoJSONSource
      | undefined;

    if (activeRoute) {
      // 1. Draw route GeoJSON geometry
      if (source) {
        source.setData(activeRoute.geometry);
      }

      // 2. Add or update user location origin marker
      if (!userMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "user-location-marker";
        el.innerHTML = `
          <div class="user-pulse-ring"></div>
          <div class="user-dot">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="8"></circle>
            </svg>
          </div>
        `;
        userMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat(activeRoute.origin)
          .addTo(map.current);
      } else {
        userMarkerRef.current.setLngLat(activeRoute.origin);
      }

      // 3. Automatically fit route in viewport
      const coords = activeRoute.geometry.coordinates;
      if (coords.length > 0) {
        const bounds = coords.reduce(
          (acc, coord) => acc.extend(coord as [number, number]),
          new maplibregl.LngLatBounds(coords[0], coords[0])
        );

        map.current.fitBounds(bounds, {
          padding: { top: 100, bottom: 120, left: 360, right: 100 },
          duration: 1200,
          essential: true,
          maxZoom: 15,
        });
      }
    } else {
      // Clear route line
      if (source) {
        source.setData({
          type: "FeatureCollection",
          features: [],
        });
      }

      // Remove user origin marker
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    }
  }, [activeRoute]);

  // Adjust pitch when navigation preview mode toggles
  useEffect(() => {
    if (!map.current || !activeRoute) return;
    if (isNavigating) {
      map.current.easeTo({ pitch: 45, duration: 900 });
    } else {
      map.current.easeTo({ pitch: 0, duration: 700 });
    }
  }, [isNavigating, activeRoute]);

  // ── Render / Update the "Near Me" user location marker on the map ────
  useEffect(() => {
    if (!map.current) return;

    if (userLocation) {
      const lngLat: [number, number] = [userLocation.longitude, userLocation.latitude];

      if (!nearMeMarkerRef.current) {
        // Create a new user-location marker with pulsing animation
        const el = document.createElement("div");
        el.className = "nearme-user-marker";
        el.innerHTML = `
          <div class="nearme-pulse-ring"></div>
          <div class="nearme-pulse-ring nearme-pulse-ring-2"></div>
          <div class="nearme-accuracy-circle"></div>
          <div class="nearme-dot">
            <div class="nearme-dot-core"></div>
          </div>
        `;
        nearMeMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat(lngLat)
          .addTo(map.current);
      } else {
        nearMeMarkerRef.current.setLngLat(lngLat);
      }

      // Fly to user on first fix only
      if (!hasFlownToUserRef.current) {
        hasFlownToUserRef.current = true;
        map.current.flyTo({
          center: lngLat,
          zoom: 13,
          essential: true,
          duration: 1200,
        });
      }
    } else {
      // Remove marker when location tracking stops
      if (nearMeMarkerRef.current) {
        nearMeMarkerRef.current.remove();
        nearMeMarkerRef.current = null;
        hasFlownToUserRef.current = false;
      }
    }
  }, [userLocation]);

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
    pulseGoaBoundaryRef.current?.();
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

        {/* Near Me toggle button */}
        {onToggleNearMe && (
          <button
            className={`map-control-btn nearme-btn ${isLocating ? "active" : ""}`}
            onClick={onToggleNearMe}
            title={isLocating ? "Stop tracking location" : "Find chargers near me"}
            aria-label={isLocating ? "Stop tracking location" : "Find chargers near me"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isLocating ? (
                <>
                  <circle cx="12" cy="12" r="3" fill="currentColor" />
                  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                </>
              ) : (
                <>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                </>
              )}
            </svg>
            <span>{isLocating ? "Tracking" : "Near Me"}</span>
          </button>
        )}
      </div>
    </div>
  );
}