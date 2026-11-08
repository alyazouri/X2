// ════════════════════════════════════════════════════════════════
// ALYAZOURI 2026 — FLOATING PARTICLES
// Pure deterministic generation: eliminates runtime re-render churn
// and satisfies React 19 compiler purity rules. Memoized — the parent
// app re-renders on every state change but this layer never does.
// ════════════════════════════════════════════════════════════════
import { memo } from "react";

const STATIC_PARTICLES = Array.from({ length: 35 }, (_, i) => {
  const seed1 = Math.sin((i + 1) * 12.9898) * 43758.5453;
  const rand1 = seed1 - Math.floor(seed1);
  const seed2 = Math.cos((i + 1) * 78.233) * 43758.5453;
  const rand2 = seed2 - Math.floor(seed2);
  const seed3 = Math.sin((i + 1) * 93.31) * 43758.5453;
  const rand3 = seed3 - Math.floor(seed3);

  const size = Math.round((2 + rand1 * 4) * 10) / 10;
  const left = Math.round(rand2 * 1000) / 10;
  const duration = Math.round((12 + rand3 * 20) * 10) / 10;
  const delay = Math.round(((i * 0.43) % 15) * 10) / 10;
  const hue = i % 2 === 0 ? "rgba(255,122,0," : "rgba(255,60,0,";
  const opacity = Math.round((0.15 + rand1 * 0.35) * 100) / 100;

  return { id: i, size, left, duration, delay, hue, opacity };
});

export const Particles = memo(function Particles() {
  return (
    <div className="particles" aria-hidden="true">
      {STATIC_PARTICLES.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            background: `${p.hue}${p.opacity})`,
            boxShadow: `0 0 ${p.size * 3}px ${p.size}px ${p.hue}${p.opacity * 0.5})`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
});
