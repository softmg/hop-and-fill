import { useEffect, useRef, type ReactNode } from "react";
import bgImage from "@/assets/parallax-bg.png";

interface ParallaxBackgroundProps {
  children: ReactNode;
}

/**
 * Многослойный параллакс-фон.
 * - Десктоп: реагирует на движение мыши.
 * - Мобильные: реагирует на свайпы (touch) с пружинящим возвратом.
 *
 * Слои:
 *  1) Background  — дальний (картинка), сдвиг ~2%
 *  2) Midground   — размытые оранжевые сферы, сдвиг ~5%
 *  3) Foreground  — игровое поле (children), сдвиг ~ -1% (контр-параллакс)
 */
export const ParallaxBackground = ({ children }: ParallaxBackgroundProps) => {
  const bgRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<HTMLDivElement>(null);

  // Текущая нормализованная позиция курсора/импульса (-1..1)
  const targetRef = useRef({ x: 0, y: 0 });
  // Сглаженная позиция для рендера
  const currentRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const isTouch =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0);

    const apply = () => {
      // Lerp для плавности
      currentRef.current.x += (targetRef.current.x - currentRef.current.x) * 0.08;
      currentRef.current.y += (targetRef.current.y - currentRef.current.y) * 0.08;

      const { x, y } = currentRef.current;

      if (bgRef.current) {
        bgRef.current.style.transform = `translate3d(${x * 2}%, ${y * 2}%, 0) scale(1.08)`;
      }
      if (midRef.current) {
        midRef.current.style.transform = `translate3d(${x * 5}%, ${y * 5}%, 0)`;
      }
      if (fgRef.current) {
        fgRef.current.style.transform = `translate3d(${x * -1}%, ${y * -1}%, 0)`;
      }

      // На мобильных импульс плавно затухает к 0 (пружинящий возврат)
      if (isTouch) {
        targetRef.current.x *= 0.9;
        targetRef.current.y *= 0.9;
      }

      rafRef.current = requestAnimationFrame(apply);
    };

    rafRef.current = requestAnimationFrame(apply);

    const onMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      targetRef.current.x = (e.clientX - cx) / cx; // -1..1
      targetRef.current.y = (e.clientY - cy) / cy;
    };

    let touchStartX = 0;
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      // Импульс пропорционален свайпу, ограничен диапазоном -1..1
      const mag = Math.max(window.innerWidth, window.innerHeight) / 2;
      targetRef.current.x = Math.max(-1, Math.min(1, dx / mag));
      targetRef.current.y = Math.max(-1, Math.min(1, dy / mag));
    };

    if (isTouch) {
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchend", onTouchEnd, { passive: true });
    } else {
      window.addEventListener("mousemove", onMouseMove);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Слой 1 — дальний фон (картинка) */}
      <div
        ref={bgRef}
        className="absolute inset-0 -m-[6%] bg-cover bg-center transition-transform duration-100 ease-out will-change-transform"
        style={{
          backgroundImage: `url(${bgImage})`,
        }}
        aria-hidden
      />

      {/* Затемняющий градиент поверх дальнего фона для контраста с UI */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(var(--game-sky-bottom) / 0.15) 0%, hsl(var(--background) / 0.55) 70%, hsl(var(--background) / 0.85) 100%)",
        }}
        aria-hidden
      />

      {/* Слой 2 — средний план: размытые оранжевые сферы */}
      <div
        ref={midRef}
        className="absolute inset-0 pointer-events-none transition-transform duration-100 ease-out will-change-transform"
        aria-hidden
      >
        <div
          className="absolute rounded-full opacity-40"
          style={{
            top: "12%",
            left: "8%",
            width: "320px",
            height: "320px",
            background:
              "radial-gradient(circle, hsl(var(--game-sky-bottom)) 0%, transparent 65%)",
            filter: "blur(50px)",
          }}
        />
        <div
          className="absolute rounded-full opacity-35"
          style={{
            bottom: "10%",
            right: "6%",
            width: "380px",
            height: "380px",
            background:
              "radial-gradient(circle, hsl(var(--tile-start-top)) 0%, transparent 65%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute rounded-full opacity-25"
          style={{
            top: "55%",
            left: "45%",
            width: "260px",
            height: "260px",
            background:
              "radial-gradient(circle, hsl(var(--game-sky-top)) 0%, transparent 65%)",
            filter: "blur(70px)",
          }}
        />
      </div>

      {/* Слой 3 — передний план (игра) */}
      <div
        ref={fgRef}
        className="relative w-full h-full transition-transform duration-100 ease-out will-change-transform"
      >
        {children}
      </div>
    </div>
  );
};
