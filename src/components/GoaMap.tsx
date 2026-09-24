import { useEffect, useRef } from "react";
import * as maplibregl from 'maplibre-gl';
import "maplibre-gl/dist/maplibre-gl.css";

export default function GoaMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      // 3. Change base map style to a dark theme
      style: "https://tiles.openfreemap.org/styles/dark",

      // 4. Center on Goa
      center: [74.124, 15.35],

      // Initial zoom focused on Goa
      zoom: 9.5,
    });
    
    map.current.on("error", (e) => {
      console.error("MAPLIBRE ERROR:", e);
    });

    map.current.addControl(
      new maplibregl.NavigationControl(),
      "bottom-right"
    );

    // Wait for the base style to load before adding the custom WebGL layer
    map.current.on("load", () => {
      if (!map.current) return;

      // Override map styles to match the GoaCharge premium dark theme
      const style = map.current.getStyle();
      if (style && style.layers) {
        style.layers.forEach((layer) => {
          if (layer.id === 'background') {
            map.current!.setPaintProperty(layer.id, 'background-color', '#0a1d24');
          } else if (layer.id === 'water') {
            map.current!.setPaintProperty(layer.id, 'fill-color', '#02060b');
          } else if (layer.id.startsWith('landcover') || layer.id.startsWith('landuse')) {
            map.current!.setPaintProperty(layer.id, 'fill-color', '#0c242c');
          } else if (layer.id.startsWith('highway') || layer.id.startsWith('railway') || layer.id.startsWith('aeroway')) {
            if (layer.type === 'line') {
              map.current!.setPaintProperty(layer.id, 'line-color', 'rgba(255, 255, 255, 0.02)');
            }
          } else if (layer.id.startsWith('boundary')) {
            if (layer.type === 'line') {
              map.current!.setPaintProperty(layer.id, 'line-color', '#14b8a6');
              map.current!.setPaintProperty(layer.id, 'line-opacity', 0.4);
            }
          } else if (layer.id === 'water_name') {
            map.current!.setPaintProperty(layer.id, 'text-color', 'rgba(20, 184, 166, 0.3)');
            map.current!.setPaintProperty(layer.id, 'text-halo-width', 0);
          } else if (layer.id === 'place_village' || layer.id === 'place_suburb') {
             map.current!.setPaintProperty(layer.id, 'text-color', 'rgba(203, 213, 225, 0.4)');
             map.current!.setPaintProperty(layer.id, 'text-halo-color', '#02060b');
             map.current!.setPaintProperty(layer.id, 'text-halo-width', 2);
          } else if (layer.id.startsWith('place')) {
             map.current!.setPaintProperty(layer.id, 'text-color', '#f8fafc');
             map.current!.setPaintProperty(layer.id, 'text-halo-color', '#02060b');
             map.current!.setPaintProperty(layer.id, 'text-halo-width', 2);
          }
        });
      }

      // Add Goa boundary GeoJSON source and glow layers
      map.current.addSource("goa-boundary", {
        type: "geojson",
        data: "/data/goa-boundary.geojson"
      });

      // Outer glow
      map.current.addLayer({
        id: "goa-boundary-glow",
        type: "line",
        source: "goa-boundary",
        paint: {
          "line-color": "#5EEAD4",
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 4, 12, 10],
          "line-opacity": 0.3,
          "line-blur": ["interpolate", ["linear"], ["zoom"], 8, 2, 12, 6]
        }
      });

      // Inner core line
      map.current.addLayer({
        id: "goa-boundary-core",
        type: "line",
        source: "goa-boundary",
        paint: {
          "line-color": "#5EEAD4",
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1, 12, 3],
          "line-opacity": 0.8
        }
      });

      // Variables to store WebGL state across frames
      let program: WebGLProgram | null = null;
      let aPos: number = -1;
      let aUv: number = -1;
      let uMatrix: WebGLUniformLocation | null = null;
      let uTime: WebGLUniformLocation | null = null;
      let buffer: WebGLBuffer | null = null;

      // 6. Custom WebGL layer for the animated energy pulse
      // This integrates directly into MapLibre's rendering pipeline.
      const customLayer: maplibregl.CustomLayerInterface = {
        id: "energy-pulse",
        type: "custom",
        renderingMode: "2d",
        
        // onAdd is called when the layer is added to the map.
        // This is where we compile shaders and set up geometry.
        onAdd: function (mapInstance, gl) {
          // Vertex Shader: Projects mercator coordinate to screen space and passes UV to fragment shader
          const vertexSource = `
            attribute vec2 a_pos;
            attribute vec2 a_uv;
            uniform mat4 u_matrix;
            varying vec2 v_uv;
            
            void main() {
                v_uv = a_uv;
                // u_matrix converts from mercator to gl_Position, automatically handling panning/zooming
                gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
            }
          `;

          // Fragment Shader: Draws the pulsing animated ring
          const fragmentSource = `
            precision mediump float;
            varying vec2 v_uv;
            uniform float u_time;
            
            void main() {
                float dist = length(v_uv);
                
                // Pulse phase continuously looping from 0.0 to 1.0
                float phase = fract(u_time * 0.4); 
                
                // Expanding ring
                float ring = smoothstep(0.1, 0.0, abs(dist - phase));
                
                // Fade out as it reaches the edge or time passes
                float edgeFade = 1.0 - smoothstep(0.8, 1.0, dist);
                float timeFade = 1.0 - smoothstep(0.5, 1.0, phase);
                
                // Cyan/teal GoaCharge color
                vec3 color = vec3(0.37, 0.92, 0.83);
                
                float alpha = ring * edgeFade * timeFade;
                
                // Inner core glow
                float core = smoothstep(0.1, 0.0, dist) * 0.3;
                alpha += core;
                
                // Discard pixels outside the quad boundary to keep it strictly circular
                if (dist > 1.0) discard;
                
                gl_FragColor = vec4(color, alpha);
            }
          `;

          const createShader = (type: number, source: string) => {
            const shader = gl.createShader(type)!;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error("Shader error:", gl.getShaderInfoLog(shader));
            }
            return shader;
          };

          const vertexShader = createShader(gl.VERTEX_SHADER, vertexSource);
          const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentSource);

          program = gl.createProgram()!;
          gl.attachShader(program, vertexShader);
          gl.attachShader(program, fragmentShader);
          gl.linkProgram(program);
          if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
              console.error("Program error:", gl.getProgramInfoLog(program));
          }

          aPos = gl.getAttribLocation(program, "a_pos");
          aUv = gl.getAttribLocation(program, "a_uv");
          uMatrix = gl.getUniformLocation(program, "u_matrix");
          uTime = gl.getUniformLocation(program, "u_time");

          // Convert geographic coordinate (Ponda, Goa) to MapLibre's internal Mercator projection
          const pondaLngLat: [number, number] = [74.01, 15.40];
          const center = maplibregl.MercatorCoordinate.fromLngLat(pondaLngLat);
          
          // Radius in mercator units (approx 8km)
          const radius = 8000 * center.meterInMercatorCoordinateUnits();

          const x = center.x;
          const y = center.y;

          // Quad vertices: x, y, u, v
          // x, y are mercator coordinates
          // u, v are local quad coordinates from -1 to 1 for the fragment shader to draw a circle
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
        
        // render is called every frame by MapLibre
        render: function (gl, matrix) {
          if (!program || !buffer) return;

          gl.useProgram(program);
          
          // Enable alpha blending for the glow effect
          gl.enable(gl.BLEND);
          // Additive blending works well for energy/glow effects
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE); 

          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          
          // Position attribute (2 floats starting at offset 0, stride 16)
          gl.enableVertexAttribArray(aPos);
          gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
          
          // UV attribute (2 floats starting at offset 8, stride 16)
          gl.enableVertexAttribArray(aUv);
          gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

          // Pass the view-projection matrix from MapLibre
          gl.uniformMatrix4fv(uMatrix, false, matrix);
          
          // Pass elapsed time for animation
          gl.uniform1f(uTime, performance.now() / 1000.0);

          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

          // Trigger repaint continuously to animate the pulse smoothly
          map.current?.triggerRepaint();
        }
      };

      map.current.addLayer(customLayer);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  return <div ref={mapContainer} className="goa-map" />;
}