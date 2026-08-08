import { useEffect, useRef } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";
const FALLBACK_GRADIENT =
  "radial-gradient(circle at center, hsl(var(--primary) / 0.10) 0%, hsl(var(--primary) / 0.092) 10%, hsl(var(--primary) / 0.081) 20%, hsl(var(--primary) / 0.068) 30%, hsl(var(--primary) / 0.054) 40%, hsl(var(--primary) / 0.041) 50%, hsl(var(--primary) / 0.029) 60%, hsl(var(--primary) / 0.019) 70%, hsl(var(--primary) / 0.011) 80%, hsl(var(--primary) / 0.004) 90%, transparent 100%)";

const VERTEX_SHADER = `#version 300 es
precision highp float;

const vec2 POSITIONS[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2(3.0, -1.0),
  vec2(-1.0, 3.0)
);

void main() {
  gl_Position = vec4(POSITIONS[gl_VertexID], 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2 uResolution;
out vec4 fragColor;

float interleavedGradientNoise(vec2 position) {
  return fract(52.9829189 * fract(dot(position, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 point = (uv - 0.5) * 2.0;
  float radius = length(point);

  // A queda de luz e calculada continuamente em alta precisao, sem color stops.
  float falloff = 1.0 - smoothstep(0.0, 1.0, radius);
  falloff = pow(max(falloff, 0.0), 0.92);
  float alpha = 0.10 * falloff;

  // Dither estatico menor que um passo de alpha quebra o banding sem virar grain visivel.
  float ditherMask = smoothstep(0.0, 0.012, alpha);
  float dither = (interleavedGradientNoise(gl_FragCoord.xy) - 0.5) / 255.0;
  alpha = clamp(alpha + dither * ditherMask, 0.0, 0.10);

  fragColor = vec4(vec3(0.898039, 1.0, 0.560784), alpha);
}
`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Nao foi possivel criar o shader do glow.");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Falha ao compilar o shader do glow.";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function mountWebGlGlow(container: HTMLDivElement) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.ambientGlowCanvas = "true";
  Object.assign(canvas.style, {
    display: "block",
    width: "100%",
    height: "100%",
  });

  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  });

  if (!gl) return () => undefined;

  let vertexShader: WebGLShader | null = null;
  let fragmentShader: WebGLShader | null = null;
  let program: WebGLProgram | null = null;
  let vertexArray: WebGLVertexArrayObject | null = null;
  let resizeObserver: ResizeObserver | null = null;

  try {
    vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    program = gl.createProgram();
    if (!program) throw new Error("Nao foi possivel criar o programa do glow.");

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "Falha ao conectar os shaders do glow.");
    }

    vertexArray = gl.createVertexArray();
    if (!vertexArray) throw new Error("Nao foi possivel criar o vertex array do glow.");

    const resolution = gl.getUniformLocation(program, "uResolution");
    if (!resolution) throw new Error("Uniform de resolucao do glow nao encontrado.");

    gl.useProgram(program);
    gl.bindVertexArray(vertexArray);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    const draw = () => {
      const bounds = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(bounds.width * dpr));
      const height = Math.max(1, Math.round(bounds.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
      gl.uniform2f(resolution, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      container.style.background = FALLBACK_GRADIENT;
    };

    canvas.addEventListener("webglcontextlost", onContextLost);
    container.appendChild(canvas);
    container.style.background = "none";
    draw();

    resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(container);

    return () => {
      resizeObserver?.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      container.style.background = FALLBACK_GRADIENT;
      canvas.remove();
      gl.deleteVertexArray(vertexArray);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  } catch (error) {
    console.warn("AmbientGlow manteve o fallback CSS:", error);
    resizeObserver?.disconnect();
    canvas.remove();
    if (vertexArray) gl.deleteVertexArray(vertexArray);
    if (program) gl.deleteProgram(program);
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return () => undefined;
  }
}

/**
 * Uma unica luz ambiental global. Em desktop acompanha o mouse com inercia;
 * em touch ou reduced-motion permanece estatica. Nao provoca re-render React.
 */
export function AmbientGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const desktop = window.matchMedia(DESKTOP_QUERY);
    let disposeWebGl: (() => void) | null = null;

    const syncRenderer = () => {
      if (desktop.matches && !disposeWebGl) {
        disposeWebGl = mountWebGlGlow(el);
      } else if (!desktop.matches && disposeWebGl) {
        disposeWebGl();
        disposeWebGl = null;
      }
    };

    syncRenderer();
    desktop.addEventListener("change", syncRenderer);

    return () => {
      desktop.removeEventListener("change", syncRenderer);
      disposeWebGl?.();
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const staticX = window.innerWidth * 0.5;
    const staticY = window.innerHeight * 0.36;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let targetX = staticX;
    let targetY = staticY;
    let currentX = staticX;
    let currentY = staticY;
    let frame: number | null = null;

    const place = () => {
      el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate3d(-50%, -50%, 0)`;
    };

    const animate = () => {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;

      const remainingX = Math.abs(targetX - currentX);
      const remainingY = Math.abs(targetY - currentY);

      if (remainingX < 0.4 && remainingY < 0.4) {
        currentX = targetX;
        currentY = targetY;
        place();
        frame = null;
        return;
      }

      place();
      frame = window.requestAnimationFrame(animate);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      targetX = event.clientX;
      targetY = event.clientY;

      if (frame === null) {
        frame = window.requestAnimationFrame(animate);
      }
    };

    place();

    if (!finePointer || reducedMotion) return;

    window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden hidden lg:block">
      <div
        ref={ref}
        className="absolute left-0 top-0 will-change-transform"
        style={{
          width: "clamp(1600px, 156vw, 2400px)",
          height: "clamp(1600px, 156vw, 2400px)",
          transform: "translate3d(50vw, 36vh, 0) translate3d(-50%, -50%, 0)",
          filter: "blur(80px)",
          background: FALLBACK_GRADIENT,
        }}
      />
    </div>
  );
}
