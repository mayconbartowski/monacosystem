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
uniform vec2 uDrag;
uniform float uTime;
out vec4 fragColor;

// Ruido apenas para dither subpixel. Ele nao participa do desenho do gradiente.
float interleavedGradientNoise(vec2 position) {
  return fract(52.9829189 * fract(dot(position, vec2(0.06711056, 0.00583715))));
}

float softBlob(vec2 point, vec2 center, vec2 radius, float aspect) {
  vec2 delta = point - center;
  delta.x *= aspect;
  delta /= radius;
  return exp(-dot(delta, delta));
}

// Mesh gradient analitico: pontos de cor de queda gaussiana formam uma unica
// superficie continua. Nao ha linhas, celulas, thresholds ou faixas no desenho.
vec3 gradientColor(vec2 fragment) {
  vec2 uv = fragment / uResolution;
  float aspect = uResolution.x / uResolution.y;
  float time = uTime * 0.18;

  // Deriva autonoma: mantem todo o campo em movimento lento mesmo quando o
  // mouse esta parado. A amplitude e deliberadamente visivel, enquanto as duas
  // frequencias longas evitam um ciclo mecanico curto.
  vec2 idleDrift = vec2(
    sin(time * 0.83) + sin(time * 0.37 + 1.4) * 0.38,
    cos(time * 0.69) + cos(time * 0.41 + 2.1) * 0.36
  ) * vec2(0.085, 0.065);
  float idleBreath = 0.5 + 0.5 * sin(time * 0.78 + 0.6);

  // O campo acompanha o cursor com atraso. A area de influencia e ampla para
  // que os dois pocos escuros sejam arrastados como partes da mesma superficie.
  vec2 point = uv + idleDrift - (uMouse - 0.5) * vec2(0.095, 0.075);
  vec2 mouseDelta = (point - uMouse) * vec2(aspect, 1.0);
  float dragInfluence = exp(-dot(mouseDelta, mouseDelta) / 0.18);
  point -= uDrag * dragInfluence * 4.2;

  // Deformacao de dominio ampla e continua. As frequencias baixas evitam que o
  // movimento gere contornos ou aparencia de textura sobre o gradiente.
  vec2 flow = vec2(
    sin(point.y * 3.1 + time * 0.83) + sin((point.x + point.y) * 1.8 - time * 0.47),
    cos(point.x * 2.7 - time * 0.69) + cos((point.x - point.y) * 1.6 + time * 0.41)
  );
  point += flow * 0.026;

  vec2 warmA = vec2(0.16 + sin(time * 0.73) * 0.10, 0.21 + cos(time * 0.58) * 0.09);
  vec2 warmB = vec2(0.77 + cos(time * 0.51) * 0.09, 0.72 + sin(time * 0.64) * 0.11);
  vec2 warmC = vec2(0.52 + sin(time * 0.37 + 2.1) * 0.12, 0.43 + cos(time * 0.46 + 1.3) * 0.10);

  vec2 grayA = vec2(0.74 + sin(time * 0.43 + 0.8) * 0.12, 0.18 + cos(time * 0.52) * 0.08);
  vec2 grayB = vec2(0.24 + cos(time * 0.48 + 2.4) * 0.11, 0.78 + sin(time * 0.39) * 0.09);
  vec2 grayC = vec2(0.50 + cos(time * 0.31) * 0.15, 0.54 + sin(time * 0.44 + 2.7) * 0.12);

  float warmField =
    softBlob(point, warmA, vec2(0.54, 0.43), aspect) * 0.92 +
    softBlob(point, warmB, vec2(0.60, 0.50), aspect) * 0.86 +
    softBlob(point, warmC, vec2(0.72, 0.58), aspect) * 0.42;

  float grayField =
    softBlob(point, grayA, vec2(0.70, 0.52), aspect) * 0.95 +
    softBlob(point, grayB, vec2(0.66, 0.56), aspect) * 0.90 +
    softBlob(point, grayC, vec2(0.88, 0.70), aspect) * 0.72;

  // O primeiro poco fica no centro. O segundo percorre outra regiao do campo,
  // evitando que a interacao dependa de um unico ponto escuro.
  vec2 blackHoleA = vec2(
    0.50 + sin(time * 0.53 + 0.2) * 0.045,
    0.50 + cos(time * 0.47 + 1.1) * 0.038
  );
  vec2 blackHoleB = vec2(
    0.24 + sin(time * 0.61 + 1.7) * 0.11,
    0.74 + cos(time * 0.49 + 0.4) * 0.09
  );
  // O poco principal usa exatamente o dobro dos raios anteriores (0.34/0.28).
  float holeA = softBlob(point, blackHoleA, vec2(0.68, 0.56) * (0.96 + idleBreath * 0.08), aspect);
  float holeB = softBlob(point, blackHoleB, vec2(0.30, 0.25) * (1.04 - idleBreath * 0.08), aspect);
  float blackHoleMix = clamp(1.08 * (1.0 - (1.0 - holeA) * (1.0 - holeB)), 0.0, 1.0);

  // Compressao exponencial preserva uma derivada suave em todo o intervalo.
  float grayMix = 1.0 - exp(-grayField * 0.82);
  float warmMix = 1.0 - exp(-warmField * 0.72);

  vec3 black = vec3(0.0);
  vec3 darkGray = vec3(0.065, 0.064, 0.056);
  vec3 warm = vec3(0.192157, 0.176471, 0.133333); // #312D22

  // O tom #312D22 ocupa a massa luminosa em opacidade total; os pocos sao
  // aplicados por ultimo para que o centro seja preto, como um buraco negro.
  vec3 color = mix(darkGray, warm, 0.58 + warmMix * 0.42);
  color = mix(color, darkGray, grayMix * 0.28);
  color = mix(color, black, blackHoleMix);

  // Vinheta larga, sem borda perceptivel, mantem o centro util e as extremidades escuras.
  vec2 edge = (uv - 0.5) * vec2(0.90, 1.0);
  color *= 1.0 - dot(edge, edge) * 0.34;
  return max(color, 0.0);
}

void main() {
  // Supersampling 2x2 mantem as deformacoes limpas mesmo em telas de alto DPI.
  vec3 finalColor = vec3(0.0);
  finalColor += gradientColor(gl_FragCoord.xy + vec2(-0.25, -0.25));
  finalColor += gradientColor(gl_FragCoord.xy + vec2( 0.25, -0.25));
  finalColor += gradientColor(gl_FragCoord.xy + vec2(-0.25,  0.25));
  finalColor += gradientColor(gl_FragCoord.xy + vec2( 0.25,  0.25));
  finalColor *= 0.25;

  // Dither triangular estatico quebra os degraus de 8 bits sem criar cintilacao.
  float n1 = interleavedGradientNoise(gl_FragCoord.xy);
  float n2 = interleavedGradientNoise(gl_FragCoord.xy + vec2(17.31, 41.77));
  float triangular = (n1 - n2) * 0.82;
  finalColor = clamp(finalColor + vec3(triangular / 255.0), 0.0, 1.0);

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
    const dragUniform = gl.getUniformLocation(program, "uDrag");
    const timeUniform = gl.getUniformLocation(program, "uTime");
    if (!resolution || !mouseUniform || !dragUniform || !timeUniform) {
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
    let dragTargetX = 0;
    let dragTargetY = 0;
    let dragX = 0;
    let dragY = 0;
    let width = 1;
    let height = 1;
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
      currentX += (targetX - currentX) * 0.055;
      currentY += (targetY - currentY) * 0.055;
      dragX += (dragTargetX - dragX) * 0.09;
      dragY += (dragTargetY - dragY) * 0.09;
      dragTargetX *= 0.94;
      dragTargetY *= 0.94;

      gl.uniform2f(mouseUniform, currentX, 1.0 - currentY);
      gl.uniform2f(dragUniform, dragX, -dragY);
      gl.uniform1f(timeUniform, reducedMotion ? 0 : (now - startedAt) / 1000);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);


      if (!reducedMotion) animationFrame = window.requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const nextX = event.clientX / window.innerWidth;
      const nextY = event.clientY / window.innerHeight;
      const deltaX = Math.max(-0.08, Math.min(0.08, nextX - targetX));
      const deltaY = Math.max(-0.08, Math.min(0.08, nextY - targetY));

      dragTargetX = dragTargetX * 0.58 + deltaX * 1.65;
      dragTargetY = dragTargetY * 0.58 + deltaY * 1.65;
      targetX = nextX;
      targetY = nextY;
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
