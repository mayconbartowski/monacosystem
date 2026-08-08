import { useEffect, useRef } from "react";

/**
 * Uma única luz ambiental global. Em desktop acompanha o mouse com inércia;
 * em touch ou reduced-motion permanece estática. Não provoca re-render React.
 */
export function AmbientGlow() {
  const ref = useRef<HTMLDivElement>(null);

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
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        ref={ref}
        className="absolute left-0 top-0 will-change-transform"
        style={{
          width: "clamp(800px, 78vw, 1200px)",
          height: "clamp(800px, 78vw, 1200px)",
          transform: "translate3d(50vw, 36vh, 0) translate3d(-50%, -50%, 0)",
          background:
            "radial-gradient(circle at center, hsl(var(--primary) / 0.15) 0%, hsl(var(--primary) / 0.08) 25%, hsl(var(--primary) / 0.025) 50%, transparent 72%)",
        }}
      />
    </div>
  );
}
