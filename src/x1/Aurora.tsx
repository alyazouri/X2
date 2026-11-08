// ════════════════════════════════════════════════════════════════
// ALYAZOURI 2026 — CINEMATIC ATMOSPHERE (Astra-language background)
//
// Layered rendering system reconstructed from the visual language of
// OpenAI's GPT-6 Astra showcase:
//   • deep near-black base with a warm core
//   • large atmospheric light fields with soft falloff baked into the
//     gradient (no animated blur filters) — drifting on long, uneven
//     Lissajous cycles so motion never reads as a loop
//   • a few faint luminous filaments for Astra's thread-of-light character
//   • pointer lens bloom, hover energy, click ripples, scroll drift,
//     device-tilt parallax (all previous interactivity preserved)
//   • CSS layers (globals.css) add the atmospheric fields, horizon glow,
//     film-grain weave, warm vignette + faint scanline texture
//
// Canvas renders at half resolution and is CSS-blurred once, so the whole
// system stays compositor-friendly. Reduced motion → one calm static frame.
// Publishes --aurora-energy / --aurora-hue so the UI glows with it.
// ════════════════════════════════════════════════════════════════
import { memo, useEffect, useRef } from "react";

interface Field {
  /** anchor position, normalized 0..1 */
  x: number; y: number;
  /** radius as a share of min(viewport w,h) */
  r: number;
  hue: number; sat: number; light: number; alpha: number;
  /** two independent drift frequencies per axis (uneven ⇒ organic) */
  fxA: number; fyA: number; fxB: number; fyB: number;
  pA: number; pB: number;
  /** drift amplitudes (normalized) */
  ax: number; ay: number;
  /** parallax depth: ± direction/strength */
  depth: number;
}

/** Brand aurora palette, composed as Astra-style atmospheric washes. */
const FIELDS: Field[] = [
  { x: 0.26, y: 0.18, r: 0.66, hue: 40,  sat: 92, light: 56, alpha: 0.19, fxA: 0.052, fyA: 0.041, fxB: 0.023, fyB: 0.060, pA: 0.4, pB: 2.6, ax: 0.075, ay: 0.055, depth: 0.9 },
  { x: 0.82, y: 0.26, r: 0.54, hue: 22,  sat: 88, light: 50, alpha: 0.12, fxA: 0.044, fyA: 0.056, fxB: 0.065, fyB: 0.028, pA: 2.1, pB: 0.7, ax: 0.060, ay: 0.070, depth: 0.55 },
  { x: 0.70, y: 0.78, r: 0.60, hue: 262, sat: 68, light: 52, alpha: 0.11, fxA: 0.038, fyA: 0.050, fxB: 0.059, fyB: 0.033, pA: 4.2, pB: 1.3, ax: 0.070, ay: 0.050, depth: -0.7 },
  { x: 0.14, y: 0.72, r: 0.50, hue: 198, sat: 76, light: 46, alpha: 0.10, fxA: 0.058, fyA: 0.035, fxB: 0.027, fyB: 0.048, pA: 1.1, pB: 3.8, ax: 0.055, ay: 0.065, depth: -0.5 },
  { x: 0.52, y: 0.04, r: 0.46, hue: 32,  sat: 90, light: 58, alpha: 0.10, fxA: 0.047, fyA: 0.062, fxB: 0.031, fyB: 0.052, pA: 5.0, pB: 2.0, ax: 0.050, ay: 0.045, depth: 0.4 },
  { x: 0.96, y: 0.92, r: 0.42, hue: 288, sat: 62, light: 52, alpha: 0.08, fxA: 0.036, fyA: 0.054, fxB: 0.061, fyB: 0.025, pA: 3.3, pB: 5.4, ax: 0.045, ay: 0.055, depth: -0.35 },
];

interface Filament {
  y: number; amp: number; freqA: number; freqB: number; phA: number; phB: number;
  speed: number; depth: number; hue: number; sat: number; light: number; alpha: number;
}

/** A few faint threads of light — Astra's filament character, never neon. */
const FILAMENTS: Filament[] = [
  { y: 0.30, amp: 0.052, freqA: 0.9,  freqB: 1.5, phA: 0.4, phB: 2.2, speed: 0.10,  depth: 0.8,  hue: 42,  sat: 90, light: 58, alpha: 0.10 },
  { y: 0.55, amp: 0.060, freqA: 1.1,  freqB: 1.7, phA: 2.8, phB: 0.9, speed: 0.085, depth: -0.6, hue: 26,  sat: 84, light: 54, alpha: 0.08 },
  { y: 0.78, amp: 0.050, freqA: 0.8,  freqB: 1.3, phA: 4.4, phB: 3.1, speed: 0.075, depth: 0.5,  hue: 264, sat: 56, light: 56, alpha: 0.06 },
];

const INTERACTIVE_SELECTOR = "button, a, input, select, textarea, summary, [role='button'], .chip, .card, .kbd";

/** Low-frequency, smooth vertical drift for one filament at u ∈ [0,1] + t (s). */
function filamentY(u: number, t: number, fb: Filament): number {
  const a = Math.sin(u * fb.freqA * Math.PI + t * fb.speed + fb.phA) * 0.6;
  const b = Math.sin(u * fb.freqB * Math.PI * 0.83 + t * fb.speed * 0.7 + fb.phB) * 0.4;
  return a + b;
}

/** Pre-render one soft light sprite (Astra-style falloff baked into stops). */
function buildSprite(hue: number, sat: number, light: number): HTMLCanvasElement {
  const size = 320;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const g = c.getContext("2d")!;
  const cx = size / 2;
  const grad = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grad.addColorStop(0.0, `hsla(${hue}, ${sat}%, ${light + 8}%, 0.9)`);
  grad.addColorStop(0.3, `hsla(${hue}, ${sat}%, ${light}%, 0.48)`);
  grad.addColorStop(0.62, `hsla(${hue}, ${Math.max(0, sat - 8)}%, ${light - 4}%, 0.14)`);
  grad.addColorStop(1.0, `hsla(${hue}, ${sat}%, ${light}%, 0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export const Aurora = memo(function Aurora() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const sprites = FIELDS.map((f) => buildSprite(f.hue, f.sat, f.light));

    let width = 0; let height = 0;
    let raf = 0;
    let running = true;

    // Pointer (eased)
    const pointer = { x: 0.5, y: 0.42, tx: 0.5, ty: 0.42, lastX: 0.5, lastY: 0.42, speed: 0 };
    let energy = 0; let energyTarget = 0;
    let hueBias = 0; let hueBiasTarget = 0;
    let scrollNorm = 0;
    const tilt = { x: 0, y: 0 };
    const ripples: { x: number; y: number; t: number }[] = [];

    const RESOLUTION = 0.5;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = Math.max(2, Math.round(rect.width * dpr * RESOLUTION));
      height = Math.max(2, Math.round(rect.height * dpr * RESOLUTION));
      canvas.width = width;
      canvas.height = height;
    };
    resize();

    const onPointerMove = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth;
      const ny = e.clientY / window.innerHeight;
      pointer.tx = nx; pointer.ty = ny;
      const dx = nx - pointer.lastX; const dy = ny - pointer.lastY;
      pointer.speed = Math.min(1, Math.hypot(dx, dy) * 9);
      pointer.lastX = nx; pointer.lastY = ny;
    };
    const onOver = (e: Event) => {
      const el = (e.target as HTMLElement | null)?.closest?.(INTERACTIVE_SELECTOR) as HTMLElement | null;
      if (el) {
        energyTarget = 1;
        const accent = el.getAttribute("data-aurora-hue");
        hueBiasTarget = accent ? Number(accent) : 26;
      } else {
        energyTarget = 0;
        hueBiasTarget = 0;
      }
    };
    const onDown = (e: PointerEvent) => {
      ripples.push({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight, t: 0 });
      if (ripples.length > 5) ripples.shift();
      energyTarget = Math.max(energyTarget, 1);
    };
    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      scrollNorm = window.scrollY / max;
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tilt.x = Math.max(-1, Math.min(1, e.gamma / 45));
      tilt.y = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
    };
    const onVisibility = () => {
      running = document.visibilityState === "visible";
      if (running) raf = requestAnimationFrame(frame);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    if (typeof DeviceOrientationEvent !== "undefined") {
      window.addEventListener("deviceorientation", onTilt, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    onScroll();

    const SAMPLES = 26;
    const frame = () => {
      if (!running) return;
      const t = performance.now() / 1000;

      const EASE = 0.075;
      pointer.x += (pointer.tx - pointer.x) * EASE;
      pointer.y += (pointer.ty - pointer.y) * EASE;
      pointer.speed *= 0.9;
      energy += (energyTarget - energy) * 0.06;
      hueBias += (hueBiasTarget - hueBias) * 0.05;
      const boost = energy + pointer.speed * 0.6;
      const w = width; const h = height;
      const minDim = Math.min(w, h);

      // ── base: warm near-black with the faintest cool lift ──
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "lighter";

      // ── atmospheric light fields (drifting, parallax, additive) ──
      for (let i = 0; i < FIELDS.length; i += 1) {
        const f = FIELDS[i];
        const driftX = Math.sin(t * f.fxA * Math.PI * 2 + f.pA) * f.ax
          + Math.sin(t * f.fxB * Math.PI * 2 + f.pB) * f.ax * 0.5;
        const driftY = Math.cos(t * f.fyA * Math.PI * 2 + f.pB) * f.ay
          + Math.sin(t * f.fyB * Math.PI * 2 + f.pA) * f.ay * 0.5;

        const px = (pointer.x - 0.5) * f.depth * 0.10 + tilt.x * f.depth * 0.04;
        const py = (pointer.y - 0.5) * f.depth * 0.10 + tilt.y * f.depth * 0.04;
        const sy = (scrollNorm - 0.5) * 0.16 * (f.depth > 0 ? 1 : -0.55);

        const cx = (f.x + driftX + px) * w;
        const cy = (f.y + driftY + py + sy) * h;
        const rad = f.r * minDim * (1 + boost * 0.08);

        ctx.globalAlpha = Math.min(0.85, f.alpha * (1 + boost * 0.5));
        ctx.drawImage(sprites[i], cx - rad, cy - rad, rad * 2, rad * 2);
      }
      ctx.globalAlpha = 1;

      // ── faint luminous filaments ──
      for (const fb of FILAMENTS) {
        const pyp = (pointer.y - 0.5) * fb.depth * 0.14 + tilt.y * fb.depth * 0.05;
        const syy = (scrollNorm - 0.5) * 0.2 * (fb.depth > 0 ? 1 : -0.6);
        const hue = fb.hue + hueBias * (fb.hue >= 20 && fb.hue <= 60 ? 0.4 : -0.3);
        const alpha = Math.min(0.9, fb.alpha * (1 + boost * 0.5));

        const pts: [number, number][] = [];
        for (let s = 0; s <= SAMPLES; s += 1) {
          const u = s / SAMPLES;
          const x = u * w * 1.18 - w * 0.09;
          const yWave = filamentY(u, t, fb) * fb.amp + filamentY(u, t * 1.6, fb) * fb.amp * 0.35;
          const dxu = u - pointer.x;
          const localBend = Math.exp(-(dxu * dxu) * 24) * (1 + boost * 0.8);
          const yBend = (pointer.y * h - (fb.y + pyp + syy) * h) * 0.06 * (1 + boost * 0.5);
          const y = (fb.y + pyp + syy) * h + yWave * h * (0.8 + boost * 0.5) + yBend * localBend;
          pts.push([x, y]);
        }
        const stroke = () => {
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let s = 1; s < pts.length; s += 1) {
            const [x2, y2] = pts[s];
            const [x1, y1] = pts[s - 1];
            ctx.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
          }
          ctx.stroke();
        };
        ctx.lineCap = "round";
        // halo
        ctx.lineWidth = Math.max(2, h * 0.02) * (1 + boost * 0.3);
        ctx.strokeStyle = `hsla(${hue}, ${fb.sat}%, ${fb.light + 6}%, ${alpha * 0.22})`;
        stroke();
        // soft core
        ctx.lineWidth = Math.max(1, h * 0.005) * (1 + boost * 0.3);
        ctx.strokeStyle = `hsla(${hue}, ${Math.min(100, fb.sat + 4)}%, ${Math.min(80, fb.light + 12 + boost * 4)}%, ${alpha * 0.7})`;
        stroke();
      }

      // ── pointer lens: a soft circular bloom following the cursor ──
      const lx = pointer.x * w;
      const ly = pointer.y * h;
      const lr = Math.min(w, h) * (0.20 + boost * 0.16);
      const lens = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      lens.addColorStop(0, `hsla(${44 + hueBias * 0.45}, 96%, ${64 + boost * 8}%, ${0.16 + boost * 0.26})`);
      lens.addColorStop(0.45, `hsla(${32 + hueBias * 0.3}, 92%, 54%, ${0.07 + boost * 0.14})`);
      lens.addColorStop(1, "hsla(0, 0%, 0%, 0)");
      ctx.fillStyle = lens;
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();

      // ── click ripples ──
      ctx.globalCompositeOperation = "lighter";
      for (let i = ripples.length - 1; i >= 0; i -= 1) {
        const rp = ripples[i];
        rp.t += 1 / 60;
        const life = rp.t / 1.2;
        if (life >= 1) { ripples.splice(i, 1); continue; }
        const rr = Math.min(w, h) * (0.05 + life * 0.62);
        const a = (1 - life) * (1 - life) * 0.30;
        ctx.strokeStyle = `hsla(${46 + hueBias * 0.5}, 96%, 70%, ${a})`;
        ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.004 * (1 - life));
        ctx.beginPath();
        ctx.arc(rp.x * w, rp.y * h, rr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Publish live energy/hue so the UI glows with the background.
      document.documentElement.style.setProperty("--aurora-energy", boost.toFixed(3));
      document.documentElement.style.setProperty("--aurora-hue", (44 + hueBias * 0.5).toFixed(1));

      if (reduced) { running = false; return; }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      if (typeof DeviceOrientationEvent !== "undefined") {
        window.removeEventListener("deviceorientation", onTilt);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} aria-hidden="true" className="aurora-canvas" />
      {/* ── Astra-style CSS atmosphere: independent drifting light fields,
             horizon glow, warm vignette + faint film scanlines ── */}
      <div className="astra-field astra-field-a" aria-hidden="true" />
      <div className="astra-field astra-field-b" aria-hidden="true" />
      <div className="astra-field astra-field-c" aria-hidden="true" />
      <div className="astra-horizon" aria-hidden="true" />
      <div className="astra-vignette" aria-hidden="true" />
    </>
  );
});
