import { useEffect, useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { X, Sparkles, Crown } from "lucide-react";

export type PopupAdRecord = {
  id: string;
  is_active: boolean;
  title: string | null;
  headline: string | null;
  body_text: string | null;
  image_url: string | null;
  link_url: string | null;
  cta_label: string | null;
  cta_title: string | null;
  cta_subtitle: string | null;
  promo_badge: string | null;
  size: string | null;
  pages: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  display_order: number | null;
  updated_at?: string | null;
};

/** Page targets offered to admins. `all` matches every route. */
export const POPUP_PAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All pages" },
  { value: "/", label: "Homepage" },
  { value: "/matches", label: "Match page / Competition Arena" },
  { value: "/leaderboard", label: "Leaderboard" },
  { value: "/dashboard", label: "Dashboard" },
  { value: "/wagers", label: "Wagers" },
  { value: "/arcade", label: "Arcade" },
  { value: "/lottery", label: "Lottery" },
  { value: "/chat", label: "Chat" },
  { value: "/shop", label: "Shop" },
  { value: "/tasks", label: "Tasks & Quests" },
  { value: "/virtual", label: "Virtual league" },
  { value: "/admin", label: "Admin Console" },
];

function targetsPath(pages: string[] | null, pathname: string) {
  const list = pages?.length ? pages : ["all"];
  return list.some((p) => {
    if (p === "all") return true;
    if (p === "/") return pathname === "/";
    return pathname === p || pathname.startsWith(`${p}/`);
  });
}

export function PopupAd() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [ads, setAds] = useState<PopupAdRecord[]>([]);
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const nowIso = new Date().toISOString();
      const { data } = await (supabase as any)
        .from("popup_ads")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (cancelled) return;
      const live = ((data ?? []) as PopupAdRecord[]).filter(
        (a) => (!a.starts_at || a.starts_at <= nowIso) && (!a.ends_at || a.ends_at >= nowIso),
      );
      if (live.length) { setAds(live); setIndex(0); return; }
      // Legacy single-ad fallback so existing configured ads keep working.
      const { data: s } = await supabase
        .from("app_settings")
        .select("popup_ad_active,popup_ad_image,popup_ad_text,popup_ad_link,popup_ad_size,updated_at")
        .eq("id", 1).maybeSingle();
      if (cancelled || !s?.popup_ad_active) return;
      setAds([{
        id: `legacy-${s.updated_at}`, is_active: true, title: null, headline: null,
        body_text: s.popup_ad_text, image_url: s.popup_ad_image, link_url: s.popup_ad_link,
        cta_label: null, cta_title: null, cta_subtitle: null, promo_badge: null,
        size: s.popup_ad_size, pages: ["all"], starts_at: null, ends_at: null, display_order: 0,
      }]);
    })();
    return () => { cancelled = true; };
  }, []);

  const queue = useMemo(
    () => ads.filter((a) => targetsPath(a.pages, pathname) && !dismissed.includes(a.id)
      && !sessionStorage.getItem(`popup-ad-${a.id}`)),
    [ads, pathname, dismissed],
  );
  const ad = queue[Math.min(index, queue.length - 1)];
  if (!ad) return null;

  const close = () => {
    sessionStorage.setItem(`popup-ad-${ad.id}`, "1");
    setDismissed((d) => [...d, ad.id]);
    setIndex(0);
  };

  const size = ad.size ?? "large";
  const sizeCls = size === "full" ? "max-w-[96vw]" : size === "xl" ? "max-w-3xl" : size === "medium" ? "max-w-md" : "max-w-xl";
  const imgCls = size === "full" ? "max-h-[70vh]" : size === "xl" ? "max-h-[56vh]" : size === "medium" ? "max-h-64" : "max-h-[46vh]";

  const body = (
    <div className={`relative w-full ${sizeCls}`}>
      {/* translucent promo panel — page stays faintly visible behind it */}
      <div className="relative rounded-3xl border border-primary/30 bg-black/70 backdrop-blur-md px-4 pb-5 pt-6 shadow-[0_25px_80px_-20px_rgba(0,0,0,0.9)]">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); close(); }}
          aria-label="Close advertisement"
          className="absolute -top-3 -right-3 z-30 h-10 w-10 grid place-items-center rounded-full border border-primary/50 bg-black/80 text-primary-foreground/90 shadow-lg backdrop-blur hover:bg-black"
        >
          <X className="h-5 w-5" />
        </button>

        {/* floating decorative accents */}
        <Sparkles className="pointer-events-none absolute left-4 top-3 h-5 w-5 text-primary/60 popup-float" />
        <Crown className="pointer-events-none absolute right-10 bottom-6 h-5 w-5 text-primary/40 popup-float-slow" />

        {ad.headline && (
          <h2 className="relative z-10 text-center text-xl sm:text-3xl font-black uppercase tracking-tight text-primary drop-shadow">
            {ad.headline}
          </h2>
        )}

        {(ad.cta_title || ad.cta_label) && (
          <div className="relative z-10 mt-4 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-3 py-2.5 backdrop-blur">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary/40 bg-black/40">
              <Crown className="h-4 w-4 text-primary" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground">{ad.cta_title}</span>
              {ad.cta_subtitle && <span className="block truncate text-[11px] text-muted-foreground">{ad.cta_subtitle}</span>}
            </span>
            {ad.cta_label && (
              <span className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-black text-primary-foreground shadow">
                {ad.cta_label}
              </span>
            )}
          </div>
        )}

        {ad.image_url && (
          /* featured art is allowed to break out of the banner bounds */
          <div className="relative z-20 -mx-6 -mb-6 mt-3 flex justify-center">
            <img src={ad.image_url} alt={ad.title ?? "Promotion"} className={`w-full ${imgCls} object-contain drop-shadow-2xl`} />
          </div>
        )}

        {ad.promo_badge && (
          <div className="relative z-30 mx-auto -mt-6 w-fit max-w-[92%] rounded-2xl bg-sky-500 px-4 py-2 text-center text-sm font-black leading-tight text-white shadow-xl">
            {ad.promo_badge}
          </div>
        )}

        {ad.body_text && (
          <p className="relative z-10 mt-4 whitespace-pre-wrap text-center text-sm text-muted-foreground">{ad.body_text}</p>
        )}
      </div>

      {queue.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {queue.map((q, i) => (
            <button key={q.id} aria-label={`Show ad ${i + 1}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIndex(i); }}
              className={`h-1.5 rounded-full transition-all ${i === Math.min(index, queue.length - 1) ? "w-6 bg-primary" : "w-1.5 bg-primary/40"}`} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    /*
     * FIX: was `grid place-items-center` on a scrollable `fixed inset-0` container.
     * That combo is a known CSS trap — when the centered content is taller than the
     * viewport, the browser anchors it to the start edge instead of truly centering,
     * which is why the ad looked pinned to one side / cut off at the top instead of
     * sitting centered with equal breathing room. `flex` + `m-auto` on the child
     * centers correctly in both axes AND still lets you scroll to see the whole thing
     * when it doesn't fit.
     */
    <div className="fixed inset-0 z-[100] flex overflow-y-auto p-4 bg-black/40 backdrop-blur-[2px]" onClick={close}>
      <div className="m-auto w-full max-w-full py-8" onClick={(e) => e.stopPropagation()}>
        {ad.link_url
          ? <a href={ad.link_url} target="_blank" rel="noreferrer" className="block">{body}</a>
          : body}
      </div>
    </div>
  );
}
