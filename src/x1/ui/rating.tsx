import { useState, useEffect } from "react";
import { useLang } from "../LanguageContext";
import { fetchJsonWithHardTimeout } from "../../lib/fetch-timeout";

/* ════════════════ RATING SECTION ════════════════ */
const RATING_KEY = "alyazouri_rating_v1";
interface RatingData { rating: number; comment: string; savedAt: number; }
export function RatingSection() {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [initialData] = useState<RatingData | null>(() => {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(RATING_KEY) : null;
      if (raw) return JSON.parse(raw) as RatingData;
    } catch { /* */ }
    return null;
  });
  const [rating, setRating] = useState<number>(() => initialData?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState<string>(() => initialData?.comment ?? "");
  const [submitted, setSubmitted] = useState<boolean>(() => Boolean(initialData));
  const [saved, setSaved] = useState<RatingData | null>(() => initialData);
  const [community, setCommunity] = useState<{ average: number; count: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  useEffect(() => {
    // Community aggregate — hard timeout; silently stays hidden in local-only mode.
    fetchJsonWithHardTimeout<{ average?: number; count?: number }>("/api/ratings", {}, 8000)
      .then((d) => { if (typeof d.count === "number" && d.count > 0 && typeof d.average === "number") setCommunity({ average: d.average, count: d.count }); })
      .catch(() => { /* local-only mode */ });
  }, []);
  const handleSubmit = async () => {
    if (rating === 0 || sending) return;
    setSending(true);
    setSendError(false);
    const data: RatingData = { rating, comment, savedAt: Date.now() };
    try { localStorage.setItem(RATING_KEY, JSON.stringify(data)); } catch { /* */ }
    setSaved(data); setSubmitted(true);
    try {
      const d = await fetchJsonWithHardTimeout<{ ok?: boolean; average?: number; count?: number }>("/api/ratings", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rating, comment }),
      }, 8000);
      if (d.ok && typeof d.count === "number" && typeof d.average === "number") setCommunity({ average: d.average, count: d.count });
    } catch {
      // Local rating remains saved; show the cloud-sync failure honestly.
      setSendError(true);
    } finally {
      setSending(false);
    }
  };
  const stars = [1, 2, 3, 4, 5];
  const activeRating = hoverRating || rating;
  return (
    <div className="card neon-box rounded-2xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><span className="text-2xl">💬</span><h3 className="font-display text-lg font-bold text-white">{isAr ? "قيّم تجربتك" : "Rate Your Experience"}</h3></div>
        {community && community.count > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1.5 text-[11px] font-bold text-orange-200">
            <span>🌍</span>
            <span>{isAr ? "تقييم المجتمع" : "Community"}: {community.average}/5</span>
            <span className="text-white/40">·</span>
            <span className="tabular-nums">{community.count} {isAr ? "تقييم" : "ratings"}</span>
          </div>
        )}
      </div>
      {submitted && saved ? (
        <div className="py-4 text-center">
          <div className="mb-3 text-4xl">🎉</div>
          <div className="mb-1 text-lg font-bold text-white">{isAr ? "شكراً لتقييمك!" : "Thanks for your rating!"}</div>
          <div className="mb-3 flex justify-center gap-1">{stars.map((s) => <span key={s} className={`text-2xl ${s <= saved.rating ? "opacity-100" : "opacity-20"}`}>⭐</span>)}</div>
          {saved.comment && <div className="mx-auto max-w-sm rounded-xl border border-white/5 bg-black/30 p-3 text-sm text-white/70">&ldquo;{saved.comment}&rdquo;</div>}
          {sendError && <p className="mt-3 text-[10px] text-amber-300">{isAr ? "تم الحفظ محلياً، لكن تعذرت المزامنة المجتمعية." : "Saved locally; community sync is unavailable."}</p>}
          <button onClick={() => { setSubmitted(false); setSaved(null); setSendError(false); }} className="mt-4 text-xs text-orange-300 hover:text-orange-200">{isAr ? "تعديل التقييم" : "Edit rating"}</button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex justify-center gap-2">
            {stars.map((s) => (
              <button key={s} onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)} onClick={() => setRating(s)}
                className={`text-3xl transition-transform hover:scale-125 ${s <= activeRating ? "scale-110 opacity-100" : "opacity-30"}`}>⭐</button>
            ))}
          </div>
          <div className="mb-4 text-center text-xs text-white/50">
            {activeRating === 1 && (isAr ? "ضعيف" : "Poor")}
            {activeRating === 2 && (isAr ? "مقبول" : "Fair")}
            {activeRating === 3 && (isAr ? "جيد" : "Good")}
            {activeRating === 4 && (isAr ? "ممتاز" : "Excellent")}
            {activeRating === 5 && (isAr ? "🏆 أسطوري!" : "🏆 Legendary!")}
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={isAr ? "اكتب تعليقك هنا... (اختياري)" : "Write your comment... (optional)"}
            className="h-20 w-full resize-none rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white placeholder-white/30 focus:border-orange-400/50 focus:outline-none" />
          <button onClick={() => void handleSubmit()} disabled={rating === 0 || sending} className="btn-primary mt-3 w-full rounded-xl px-5 py-3 text-sm disabled:opacity-40">
            {sending ? (isAr ? "جاري الإرسال…" : "Submitting…") : (isAr ? "إرسال التقييم" : "Submit Rating")}
          </button>
        </>
      )}
    </div>
  );
}
