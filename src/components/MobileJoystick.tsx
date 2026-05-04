import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Dir } from "@/game/iso";
import { screenVectorToDir } from "@/game/Input";
import { cn } from "@/lib/utils";

interface MobileJoystickProps {
  onDirection: (dir: Dir) => void;
  disabled?: boolean;
  className?: string;
}

const DEAD_ZONE = 18;
const KNOB_MAX_OFFSET = 38;
const MARKER_RADIUS = 45;
export const MOBILE_JOYSTICK_REPEAT_MS = 120;

const markerVectors: Array<{ dir: Dir; x: number; y: number; rotate: number }> = [
  { dir: "NW", x: 0, y: -1, rotate: 0 },
  { dir: "N", x: 0.72, y: -0.72, rotate: 45 },
  { dir: "NE", x: 1, y: 0, rotate: 90 },
  { dir: "E", x: 0.72, y: 0.72, rotate: 135 },
  { dir: "SE", x: 0, y: 1, rotate: 0 },
  { dir: "S", x: -0.72, y: 0.72, rotate: 45 },
  { dir: "SW", x: -1, y: 0, rotate: 90 },
  { dir: "W", x: -0.72, y: -0.72, rotate: 135 },
];

const getPointerId = (event: PointerEvent<HTMLDivElement>) => event.pointerId || 1;

export const MobileJoystick = ({ onDirection, disabled = false, className }: MobileJoystickProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const heldDirectionRef = useRef<Dir | null>(null);
  const repeatTimerRef = useRef<number | null>(null);
  const onDirectionRef = useRef(onDirection);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [activeDir, setActiveDir] = useState<Dir | null>(null);

  useEffect(() => {
    onDirectionRef.current = onDirection;
  }, [onDirection]);

  const stopRepeat = useCallback(() => {
    if (repeatTimerRef.current === null) return;
    window.clearInterval(repeatTimerRef.current);
    repeatTimerRef.current = null;
  }, []);

  const startRepeat = useCallback(() => {
    if (repeatTimerRef.current !== null) return;

    repeatTimerRef.current = window.setInterval(() => {
      const dir = heldDirectionRef.current;
      if (!dir) {
        stopRepeat();
        return;
      }

      onDirectionRef.current(dir);
    }, MOBILE_JOYSTICK_REPEAT_MS);
  }, [stopRepeat]);

  const setHeldDirection = useCallback((dir: Dir | null) => {
    const previousDir = heldDirectionRef.current;
    heldDirectionRef.current = dir;
    setActiveDir(dir);

    if (!dir) {
      stopRepeat();
      return;
    }

    if (dir !== previousDir) {
      onDirectionRef.current(dir);
    }
    startRepeat();
  }, [startRepeat, stopRepeat]);

  const reset = useCallback(() => {
    activePointerIdRef.current = null;
    heldDirectionRef.current = null;
    stopRepeat();
    setKnob({ x: 0, y: 0 });
    setActiveDir(null);
  }, [stopRepeat]);

  useEffect(() => {
    if (disabled) reset();
  }, [disabled, reset]);

  useEffect(() => () => stopRepeat(), [stopRepeat]);

  const applyPointer = (event: PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root) return null;

    const rect = root.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    const clampedDistance = Math.min(distance, KNOB_MAX_OFFSET);
    const clamp = distance > 0 ? clampedDistance / distance : 0;
    const nextKnob = { x: dx * clamp, y: dy * clamp };
    const dir = screenVectorToDir(dx, dy, DEAD_ZONE);

    setKnob(nextKnob);
    setHeldDirection(dir);

    return dir;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    const pointerId = getPointerId(event);
    activePointerIdRef.current = pointerId;
    event.currentTarget.setPointerCapture?.(pointerId);
    applyPointer(event);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || activePointerIdRef.current !== getPointerId(event)) return;
    event.preventDefault();
    applyPointer(event);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const pointerId = getPointerId(event);
    if (activePointerIdRef.current !== pointerId) return;
    event.preventDefault();
    event.currentTarget.releasePointerCapture?.(pointerId);
    reset();
  };

  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    const pointerId = getPointerId(event);
    if (activePointerIdRef.current !== pointerId) return;
    event.preventDefault();
    event.currentTarget.releasePointerCapture?.(pointerId);
    reset();
  };

  const rootStyle: CSSProperties = {
    bottom: "calc(1rem + env(safe-area-inset-bottom))",
    left: "calc(1rem + env(safe-area-inset-left))",
  };

  return (
    <div
      ref={rootRef}
      aria-disabled={disabled}
      aria-label="Виртуальный джойстик"
      className={cn(
        "absolute z-50 h-32 w-32 touch-none select-none sm:hidden",
        disabled && "opacity-45",
        className,
      )}
      data-testid="mobile-joystick"
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={rootStyle}
    >
      <div className="absolute inset-0 rounded-full border border-white/25 bg-black/45 shadow-2xl shadow-black/30 backdrop-blur-md ring-1 ring-black/30" />
      <div className="absolute inset-3 rounded-full border border-white/10 bg-white/5" aria-hidden />
      {markerVectors.map((marker) => (
        <div
          key={marker.dir}
          aria-hidden
          className={cn(
            "absolute left-1/2 top-1/2 h-5 w-1.5 rounded-full transition-colors duration-100",
            activeDir === marker.dir ? "bg-white shadow-[0_0_14px_rgba(255,255,255,0.7)]" : "bg-white/35",
          )}
          style={{
            transform: `translate(-50%, -50%) translate(${marker.x * MARKER_RADIUS}px, ${marker.y * MARKER_RADIUS}px) rotate(${marker.rotate}deg)`,
          }}
        />
      ))}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full border border-white/40 bg-white/85 shadow-xl shadow-black/35 transition-[background-color,box-shadow] duration-100"
        style={{
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
        }}
      >
        <div className="absolute inset-3 rounded-full bg-black/20" />
      </div>
    </div>
  );
};
