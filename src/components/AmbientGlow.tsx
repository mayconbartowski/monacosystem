import { useEffect, useRef } from "react";

/**
 * Glow radial amarelo difuso no fundo. Segue o ponteiro com inércia em desktop,
 * estático em touch e com prefers-reduced-motion. Sem state React por mousemove.
 */
export function AmbientGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight * 0.35;
    let x = targetX;
    let y = targetY;
    let raf = 0;
    let running = false;

    const tick = () => {
      x += (targetX - x) * 0.06;
      y += (targetY - y) * 0.06;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      if (Math.abs(targetX - x) < 0.5 && Math.abs(targetY - y) < 0.5) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      targetX = e.clientX;
      targetY = e.clientY;
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        ref={ref}
        className="absolute left-0 top-0 h-[900px] w-[900px] max-w-[160vw] will-change-transform"
        style={{
          transform: "translate3d(50vw, 35vh, 0) translate(-50%, -50%)",
          background:
            "radial-gradient(circle, hsl(var(--primary) / 0.10) 0%, hsl(var(--primary) / 0.05) 32%, hsl(var(--primary) / 0.015) 55%, transparent 72%)",
        }}
      />
    </div>
  );
}
