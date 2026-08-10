import { useEffect, useRef } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";
const FALLBACK_BACKGROUND =
  "linear-gradient(135deg, transparent 5%, hsl(var(--primary) / 0.025) 36%, hsl(var(--primary) / 0.055) 58%, transparent 88%)";

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
uniform vec2 uMouse;
uniform float uTime;
out vec4 fragColor;

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

float valueNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  local = local * local * (3.0 - 2.0 * local);

  float a = hash21(cell);
  float b = hash21(cell + vec2(1.0, 0.0));
  float c = hash21(cell + vec2(0.0, 1.0));
  float d = hash21(cell + vec2(1.0, 1.0));

  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

float fbm(vec2 point) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);

  for (int octave = 0; octave < 4; octave++) {
    value += amplitude * valueNoise(point);
    point = rotation * point * 1.92 + 3.17;
    amplitude *= 0.5;
  }

  return value;
}

float interleavedGradientNoise(vec2 position) {
  return fract(52.9829189 * fract(dot(position, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 point = (uv - 0.5) * vec2(aspect, 1.0) * 2.0;
  vec2 mouse = (uMouse - 0.5) * 2.0;
  float time = uTime * 0.10;

  // O mouse deforma o campo inteiro; nao existe uma fonte circular no cursor.
  point += vec2(mouse.x * 0.42, mouse.y * 0.30);

  vec2 noisePoint = point * 0.47;
  vec2 warp = vec2(
    fbm(noisePoint + vec2(time * 0.58, -time * 0.31) + mouse * 0.16),
    fbm(noisePoint + vec2(4.7 - time * 0.37, 2.4 + time * 0.46) - mouse * 0.12)
  );
  point += (warp - 0.5) * 1.28;

  float flowA = sin(point.x * 1.18 + point.y * 0.82 + time * 1.15);
  float flowB = sin(-point.x * 0.73 + point.y * 1.31 - time * 0.82);
  float flowC = cos(point.x * 0.44 - point.y * 0.67 + time * 0.61);
  float field = flowA * 0.56 + flowB * 0.30 + flowC * 0.25;

  // Uma fita larga com halo cria massas fluidas, nunca uma bolha isolada.
  float distanceToFlow = abs(field - 0.06);
  float halo = 1.0 - smoothstep(0.39, 0.91, distanceToFlow);
  float ribbon = 1.0 - smoothstep(0.15, 0.47, distanceToFlow);
  float alpha = 0.035 * halo + 0.110 * ribbon;

  // Dither estatico evita banding nas areas escuras sem parecer grain animado.
  float dither = (interleavedGradientNoise(gl_FragCoord.xy) - 0.5) / 255.0;
  alpha = clamp(alpha + dither * smoothstep(0.0, 0.018, alpha), 0.0, 0.145);

  fragColor = vec4(vec3(0.898039, 1.0, 0.560784), alpha);
}
`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Nao foi possivel criar o shader do gradiente liquido.");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Falha ao compilar o shader do gradiente liquido.";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function mountLiquidGradient(container: HTMLDivElement, reducedMotion: boolean) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.ambientGlowCanvas = "liquid";
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
    powerPreference: "high-performance",
  });

  if (!gl) return () => undefined;

  let vertexShader: WebGLShader | null = null;
  let fragmentShader: WebGLShader | null = null;
  let program: WebGLProgram | null = null;
  let vertexArray: WebGLVertexArrayObject | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let animationFrame: number | null = null;

  try {
    vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    program = gl.createProgram();
    if (!program) throw new Error("Nao foi possivel criar o programa do gradiente liquido.");

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "Falha ao conectar os shaders do gradiente liquido.");
    }

    vertexArray = gl.createVertexArray();
    if (!vertexArray) throw new Error("Nao foi possivel criar o vertex array do gradiente liquido.");

    const resolution = gl.getUniformLocation(program, "uResolution");
    const mouseUniform = gl.getUniformLocation(program, "uMouse");
    const timeUniform = gl.getUniformLocation(program, "uTime");
    if (!resolution || !mouseUniform || !timeUniform) {
      throw new Error("Uniforms do gradiente liquido nao encontrados.");
    }

    gl.useProgram(program);
    gl.bindVertexArray(vertexArray);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    let targetX = 0.5;
    let targetY = 0.42;
    let currentX = targetX;
    let currentY = targetY;
    let width = 1;
    let height = 1;
    const startedAt = performance.now();

    const resize = () => {
      const bounds = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, Math.round(bounds.width * dpr));
      height = Math.max(1, Math.round(bounds.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
      gl.uniform2f(resolution, width, height);
    };

    const draw = (now: number) => {
      currentX += (targetX - currentX) * 0.085;
      currentY += (targetY - currentY) * 0.085;

      gl.uniform2f(mouseUniform, currentX, 1.0 - currentY);
      gl.uniform1f(timeUniform, reducedMotion ? 0 : (now - startedAt) / 1000);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (!reducedMotion) animationFrame = window.requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      targetX = event.clientX / window.innerWidth;
      targetY = event.clientY / window.innerHeight;
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      container.style.background = FALLBACK_BACKGROUND;
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    };

    canvas.addEventListener("webglcontextlost", onContextLost);
    if (!reducedMotion) window.addEventListener("pointermove", onPointerMove, { passive: true });
    container.appendChild(canvas);
    container.style.background = "none";

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();
    draw(performance.now());

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      container.style.background = FALLBACK_BACKGROUND;
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
    if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    canvas.remove();
    if (vertexArray) gl.deleteVertexArray(vertexArray);
    if (program) gl.deleteProgram(program);
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return () => undefined;
  }
}

/**
 * Campo de luz liquido global. Em desktop se deforma com o mouse; em mobile
 * nao cria canvas nem contexto WebGL. Reduced-motion recebe um quadro estatico.
 */
export function AmbientGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const desktop = window.matchMedia(DESKTOP_QUERY);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposeRenderer: (() => void) | null = null;

    const syncRenderer = () => {
      if (disposeRenderer) {
        disposeRenderer();
        disposeRenderer = null;
      }

      if (desktop.matches) {
        disposeRenderer = mountLiquidGradient(container, reducedMotion.matches);
      }
    };

    syncRenderer();
    desktop.addEventListener("change", syncRenderer);
    reducedMotion.addEventListener("change", syncRenderer);

    return () => {
      desktop.removeEventListener("change", syncRenderer);
      reducedMotion.removeEventListener("change", syncRenderer);
      disposeRenderer?.();
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 hidden overflow-hidden lg:block"
      style={{ background: FALLBACK_BACKGROUND }}
    />
  );
}
