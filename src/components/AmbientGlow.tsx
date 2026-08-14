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

// Value noise com interpolacao quintica (C2) para eliminar descontinuidades.
float valueNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  vec2 fade = local * local * local * (local * (local * 6.0 - 15.0) + 10.0);

  float a = hash21(cell);
  float b = hash21(cell + vec2(1.0, 0.0));
  float c = hash21(cell + vec2(0.0, 1.0));
  float d = hash21(cell + vec2(1.0, 1.0));

  return mix(mix(a, b, fade.x), mix(c, d, fade.x), fade.y);
}

float fbm(vec2 point) {
  float value = 0.0;
  float amplitude = 0.5;
  float total = 0.0;
  mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);

  for (int octave = 0; octave < 6; octave++) {
    value += amplitude * valueNoise(point);
    total += amplitude;
    point = rotation * point * 1.92 + 3.17;
    amplitude *= 0.5;
  }

  return value / total;
}

// Ruido espacial decorrelacionado, base do dither triangular.
float interleavedGradientNoise(vec2 position) {
  return fract(52.9829189 * fract(dot(position, vec2(0.06711056, 0.00583715))));
}

// Intensidade continua da massa luminosa numa coordenada de tela.
float glowIntensity(vec2 fragment) {
  vec2 uv = fragment / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 point = (uv - 0.5) * vec2(aspect, 1.0) * 2.0;
  vec2 mouse = (uMouse - 0.5) * 2.0;
  float time = uTime * 0.12;

  point += vec2(mouse.x * 0.58, mouse.y * 0.44);

  vec2 noisePoint = point * 0.47;
  vec2 warp = vec2(
    fbm(noisePoint + vec2(time * 0.58, -time * 0.31) + mouse * 0.24),
    fbm(noisePoint + vec2(4.7 - time * 0.37, 2.4 + time * 0.46) - mouse * 0.18)
  );
  point += (warp - 0.5) * 1.28;

  float flowA = sin(point.x * 1.18 + point.y * 0.82 + time * 1.15);
  float flowB = sin(-point.x * 0.73 + point.y * 1.31 - time * 0.82);
  float flowC = cos(point.x * 0.44 - point.y * 0.67 + time * 0.61);
  float field = flowA * 0.56 + flowB * 0.30 + flowC * 0.25;

  // Uma unica curva gaussiana: queda monotonica, sem thresholds nem camadas.
  float distanceToFlow = abs(field - 0.06);
  float sigma = 0.52;
  float t = distanceToFlow / sigma;
  float intensity = 0.150 * exp(-0.5 * t * t);

  // Vazio organico acompanhando o cursor, tambem com queda gaussiana suave.
  vec2 voidDelta = (uv - uMouse) * vec2(aspect, 1.0);
  voidDelta += (warp - 0.5) * 0.18;
  float voidT = length(voidDelta) / 0.30;
  intensity *= 1.0 - exp(-0.5 * voidT * voidT);

  return max(intensity, 0.0);
}

void main() {
  // Supersampling 2x2 em subpixels para suavizar as regioes escuras.
  float alpha = 0.0;
  alpha += glowIntensity(gl_FragCoord.xy + vec2(-0.25, -0.25));
  alpha += glowIntensity(gl_FragCoord.xy + vec2(0.25, -0.25));
  alpha += glowIntensity(gl_FragCoord.xy + vec2(-0.25, 0.25));
  alpha += glowIntensity(gl_FragCoord.xy + vec2(0.25, 0.25));
  alpha *= 0.25;

  vec3 yellow = vec3(1.0, 0.996078, 0.560784);
  vec3 finalColor = yellow * alpha;

  // Dither triangular decorrelacionado no RGB final, ~1.2 LSB p2p.
  // Fase temporal muito lenta (ciclo de ~80s) e de baixa amplitude para evitar
  // cintilacao/TV noise; em reduced-motion uTime == 0, portanto estatico.
  float phase = sin(uTime * 0.078) * 0.8 + cos(uTime * 0.053) * 0.6;
  vec2 ditherSeed = gl_FragCoord.xy + phase;
  float n1 = interleavedGradientNoise(ditherSeed);
  float n2 = interleavedGradientNoise(ditherSeed + vec2(17.31, 41.77));
  float triangular = (n1 - n2) * 0.6;

  // Mascara suave baseada na intensidade: zero no preto verdadeiro, entrada
  // gradual nas regioes onde o dither e util. A mascara multiplica apenas o ruido.
  float ditherMask = smoothstep(0.0, 0.06, alpha);
  finalColor = clamp(finalColor + vec3(triangular * ditherMask / 255.0), 0.0, 1.0);

  fragColor = vec4(finalColor, 1.0);
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
    alpha: false,
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
    let frame = 0;
    const startedAt = performance.now();

    const resize = () => {
      const bounds = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
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
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;

      gl.uniform2f(mouseUniform, currentX, 1.0 - currentY);
      gl.uniform1f(timeUniform, reducedMotion ? 0 : (now - startedAt) / 1000);
      gl.uniform1f(frameUniform, reducedMotion ? 0 : frame);
      frame += 1;
      gl.clearColor(0, 0, 0, 1);
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
      disposeRenderer?.();
      disposeRenderer = null;

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
