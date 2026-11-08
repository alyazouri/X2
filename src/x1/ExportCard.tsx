// ════════════════════════════════════════════════════════════════
// ALYAZOURI 2026 — EXPORT SENSITIVITY AS IMAGE
// Renders the final sensitivity to a PNG share card on a plain 2D canvas
// (no dependency, deterministic drawing) so the setup can be sent over
// WhatsApp/Telegram — how the audience actually shares PUBG configs.
// Visual identity preserved: gold/orange on warm black, Orbitron display.
// ════════════════════════════════════════════════════════════════
import { useCallback, useState } from "react";
import { useLang } from "./LanguageContext";
import type { Sens, SensObj } from "./sensitivity";

const CARD_W = 1000;
const CARD_H = 1400;

/** Scope rows shown per table (game order, universal labels). */
const SCOPE_ROWS: { key: keyof SensObj; label: string }[] = [
  { key: "tpp", label: "TPP" },
  { key: "fpp", label: "FPP" },
  { key: "red", label: "Red Dot" },
  { key: "scope2", label: "2x" },
  { key: "scope3", label: "3x" },
  { key: "scope4", label: "4x" },
  { key: "scope6", label: "6x" },
  { key: "scope8", label: "8x" },
];

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw one sensitivity table panel. */
function drawTable(
  ctx: CanvasRenderingContext2D,
  title: string,
  data: SensObj,
  x: number, y: number, w: number, h: number,
  accent: string,
) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 18);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,158,46,0.22)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Title
  ctx.fillStyle = accent;
  ctx.font = "700 26px Orbitron, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(title, x + 24, y + 34);

  // Rows
  const rowH = (h - 70) / SCOPE_ROWS.length;
  SCOPE_ROWS.forEach((row, i) => {
    const ry = y + 62 + i * rowH + rowH / 2;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "600 20px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(row.label, x + 24, ry);

    const value = data[row.key];
    // Bar (max 300 for cam/ads, 400 for gyro — normalize to the panel max)
    const max = /Gyro/i.test(title) ? 400 : 300;
    const barX = x + 150;
    const barW = w - 150 - 90;
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    roundRect(ctx, barX, ry - 5, barW, 10, 5);
    ctx.fill();
    const fillW = Math.max(4, (value / max) * barW);
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, "#ff7a00");
    grad.addColorStop(1, "#ffd166");
    ctx.fillStyle = grad;
    roundRect(ctx, barX, ry - 5, fillW, 10, 5);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 22px Orbitron, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(String(value), x + w - 24, ry);
  });
  ctx.restore();
}

/** Render the full share card to a canvas (pure, deterministic). */
function renderCard(sens: Sens, deviceName: string, weaponName: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;

  // Background — warm black gradient (brand base)
  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, "#0c0700");
  bg.addColorStop(0.5, "#150d03");
  bg.addColorStop(1, "#06040a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Soft gold glow top-left
  const glow = ctx.createRadialGradient(180, 120, 0, 180, 120, 520);
  glow.addColorStop(0, "rgba(255,158,46,0.18)");
  glow.addColorStop(1, "rgba(255,158,46,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.textBaseline = "middle";

  // Header
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffd166";
  ctx.font = "900 46px Orbitron, sans-serif";
  ctx.fillText("ALYAZOURI 2026", 44, 78);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "600 24px system-ui, sans-serif";
  ctx.fillText(`${deviceName}  ·  ${weaponName}`, 44, 128);

  // AI score ring (top-right)
  const cx = CARD_W - 108;
  const cy = 96;
  const r = 54;
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  const scoreGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  scoreGrad.addColorStop(0, "#ff7a00");
  scoreGrad.addColorStop(1, "#ffd166");
  ctx.strokeStyle = scoreGrad;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (sens.aiScore / 100) * Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ffd9a0";
  ctx.font = "900 40px Orbitron, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(sens.aiScore), cx, cy - 4);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "700 13px Orbitron, sans-serif";
  ctx.fillText("AI SCORE", cx, cy + 28);

  // Divider
  ctx.strokeStyle = "rgba(255,122,0,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(44, 178);
  ctx.lineTo(CARD_W - 44, 178);
  ctx.stroke();

  // 2×2 table grid
  const pad = 44;
  const gap = 26;
  const colW = (CARD_W - pad * 2 - gap) / 2;
  const topY = 206;
  const tableH = 470;
  drawTable(ctx, "CAMERA", sens.cam, pad, topY, colW, tableH, "#ffbe6b");
  drawTable(ctx, "ADS", sens.ads, pad + colW + gap, topY, colW, tableH, "#ffbe6b");
  drawTable(ctx, "GYRO CAMERA", sens.gyroCam, pad, topY + tableH + gap, colW, tableH, "#7dd3fc");
  drawTable(ctx, "GYRO ADS", sens.gyroAds, pad + colW + gap, topY + tableH + gap, colW, tableH, "#7dd3fc");

  // Free look strip
  const flY = topY + tableH * 2 + gap + 18;
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffd166";
  ctx.font = "700 22px Orbitron, sans-serif";
  ctx.fillText("FREE LOOK", pad, flY);
  const fl = [
    { k: "Camera", v: sens.freeLook.cam },
    { k: "Parachute", v: sens.freeLook.parashoot },
    { k: "Vehicle", v: sens.freeLook.vehicle },
  ];
  const flW = (CARD_W - pad * 2 - gap * 2) / 3;
  fl.forEach((f, i) => {
    const bx = pad + i * (flW + gap);
    roundRect(ctx, bx, flY + 20, flW, 70, 14);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "600 17px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(f.k, bx + flW / 2, flY + 44);
    ctx.fillStyle = "#ffd9a0";
    ctx.font = "900 26px Orbitron, sans-serif";
    ctx.fillText(`${f.v}%`, bx + flW / 2, flY + 72);
  });

  // Footer
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.fillText("PUBG Mobile Sensitivity · Deterministic AI Engine", CARD_W / 2, CARD_H - 34);

  return canvas;
}

export function ExportCard({ sens, deviceName, weaponName }: {
  sens: Sens; deviceName: string; weaponName: string;
}) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "download" | "share" | "pdf">(null);

  const flash = (kind: "download" | "share" | "pdf") => {
    setDone(kind);
    setTimeout(() => setDone(null), 2200);
  };

  const toBlob = useCallback((): Promise<Blob | null> => new Promise((resolve) => {
    try {
      renderCard(sens, deviceName, weaponName).toBlob((b) => resolve(b), "image/png");
    } catch { resolve(null); }
  }), [sens, deviceName, weaponName]);

  const download = useCallback(async () => {
    setBusy(true);
    const blob = await toBlob();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alyazouri-${deviceName.replace(/\s+/g, "-")}-${weaponName.replace(/\s+/g, "-")}.png`;
      a.click();
      URL.revokeObjectURL(url);
      flash("download");
    }
    setBusy(false);
  }, [toBlob, deviceName, weaponName]);

  const share = useCallback(async () => {
    setBusy(true);
    const blob = await toBlob();
    if (blob && typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([blob], "card.png", { type: "image/png" })] })) {
      try {
        await navigator.share({
          files: [new File([blob], `alyazouri-${weaponName}.png`, { type: "image/png" })],
          title: "ALYAZOURI 2026 Sensitivity",
        });
        flash("share");
      } catch { /* cancelled */ }
    } else if (blob) {
      // No file-share support → fall back to download.
      await download();
    }
    setBusy(false);
  }, [toBlob, download, weaponName]);

  const exportPdf = useCallback(async () => {
    setBusy(true);
    try {
      // Dynamic import: PDF code lives in a separate chunk and never burdens
      // initial page load. The same deterministic card canvas is embedded.
      const [{ jsPDF }, canvas] = await Promise.all([
        import("jspdf"),
        Promise.resolve(renderCard(sens, deviceName, weaponName)),
      ]);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const jpeg = canvas.toDataURL("image/jpeg", 0.92);
      // A4 = 210×297mm; preserve card ratio with a small vertical margin.
      pdf.addImage(jpeg, "JPEG", 0, 1.5, 210, 294, undefined, "FAST");
      pdf.setProperties({
        title: `ALYAZOURI 2026 — ${deviceName} · ${weaponName}`,
        subject: "PUBG Mobile sensitivity profile",
        author: "ALYAZOURI 2026",
      });
      pdf.save(`alyazouri-${deviceName.replace(/\s+/g, "-")}-${weaponName.replace(/\s+/g, "-")}.pdf`);
      flash("pdf");
    } catch { /* PDF generation unsupported — keep UI stable */ }
    finally { setBusy(false); }
  }, [sens, deviceName, weaponName]);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <button onClick={download} disabled={busy}
        className="btn-ghost rounded-xl px-4 py-3 text-sm disabled:opacity-50">
        {done === "download" ? `✅ ${isAr ? "تم التنزيل!" : "Saved!"}` : `🖼️ ${isAr ? "تصدير صورة" : "Export image"}`}
      </button>
      <button onClick={share} disabled={busy}
        className="btn-ghost rounded-xl px-4 py-3 text-sm disabled:opacity-50">
        {done === "share" ? `✅ ${isAr ? "تمت المشاركة!" : "Shared!"}` : `📱 ${isAr ? "مشاركة الصورة" : "Share image"}`}
      </button>
      <button onClick={exportPdf} disabled={busy}
        className="btn-ghost rounded-xl px-4 py-3 text-sm disabled:opacity-50">
        {done === "pdf" ? `✅ ${isAr ? "تم إنشاء PDF!" : "PDF saved!"}` : `📄 ${isAr ? "تصدير PDF" : "Export PDF"}`}
      </button>
    </div>
  );
}
