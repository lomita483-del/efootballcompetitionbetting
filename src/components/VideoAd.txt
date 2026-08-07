import { useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Volume2, X } from "lucide-react";

type VideoAdRecord = {
  id: string;
  is_active: boolean;
  title: string | null;
  video_url: string;
  target_page: string;
  skip_label: string;
  display_order: number;
};

function targetsPath(targetPage: string, pathname: string) {
  if (!targetPage || targetPage === "all") return true;
  if (targetPage === "/") return pathname === "/";
  return pathname === targetPage || pathname.startsWith(`${targetPage}/`);
}

/**
 * Full-screen, looping, sound-on video ad. Mounted once globally (see Layout.tsx)
 * so it works on any page an admin targets without per-page wiring.
 *
 * Browsers block autoplay-with-sound until the visitor has interacted with the
 * page, so we always attempt unmuted playback first; if the browser rejects it
 * (NotAllowedError), we fall back to a muted loop plus a one-tap "Enable sound"
 * prompt.
 *
 * FIT STRATEGY: a landscape video can never fill a portrait screen edge-to-edge
 * without either cropping content or leaving gaps — that's geometry, not a bug.
 * We solve it the way Instagram/TikTok do: a blurred, zoomed copy of the same
 * video fills every pixel behind it (its cropping is invisible because it's
 * blurred), while the real, sharp video sits on top always fully visible via
 * object-contain. Net result: no crop on the video you actually watch, and no
 * visible black gaps anywhere.
 *
 * On portrait screens (phone held normally), both video layers are rotated 90°
 * so a landscape video reads correctly filling the screen. On landscape
 * screens (desktop, or phone turned sideways), no rotation is applied.
 */
export function VideoAd() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [ads, setAds] = useState<VideoAdRecord[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [needsSoundTap, setNeedsSoundTap] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [vw, setVw] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 0));
  const [vh, setVh] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 0));

  useEffect(() => {
    const measure = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await (supabase as any)
        .from("video_ads")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: false });
      if (cancelled || error) return;
      setAds((data ?? []) as VideoAdRecord[]);
    })();
    return () => { cancelled = true; };
  }, []);

  const ad = useMemo(
    () => ads.find((a) => targetsPath(a.target_page, pathname) && !dismissed.includes(a.id)),
    [ads, pathname, dismissed],
  );

  useEffect(() => {
    setNeedsSoundTap(false);
    const el = videoRef.current;
    if (!ad || !el) return;
    el.muted = false;
    el.currentTime = 0;
    el.play().catch(() => {
      el.muted = true;
      setNeedsSoundTap(true);
      el.play().catch(() => {});
    });
  }, [ad?.id]);

  if (!ad) return null;

  const enableSound = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    void el.play();
    setNeedsSoundTap(false);
  };

  const skip = () => setDismissed((d) => [...d, ad.id]);

  const isPortrait = vh > vw;
  const boxStyle = isPortrait
    ? { width: vh || "100vh", height: vw || "100vw", transform: "translate(-50%, -50%) rotate(90deg)" as const }
    : undefined;
  const backdropClass = isPortrait
    ? "absolute top-1/2 left-1/2 object-cover blur-3xl scale-110 opacity-60"
    : "absolute inset-0 h-full w-full object-cover blur-3xl scale-110 opacity-60";
  const sharpClass = isPortrait
    ? "absolute top-1/2 left-1/2 object-contain z-10"
    : "absolute inset-0 h-full w-full object-contain z-10";

  return (
    <div className="fixed inset-0 z-[200] bg-black overflow-hidden flex items-center justify-center">
      {/* Blurred backdrop — fills every edge; its own cropping is invisible because it's blurred */}
      <video
        src={ad.video_url}
        autoPlay
        loop
        muted
        playsInline
        aria-hidden
        className={backdropClass}
        style={boxStyle}
      />
      <div className="absolute inset-0 bg-black/20" />

      {/* Sharp foreground — the real video, always fully visible, never cropped */}
      <video
        ref={videoRef}
        src={ad.video_url}
        autoPlay
        loop
        playsInline
        className={sharpClass}
        style={boxStyle}
        onClick={needsSoundTap ? enableSound : undefined}
      />

      {needsSoundTap && (
        <button
          onClick={enableSound}
          className="absolute left-1/2 top-6 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/50 bg-black/80 px-4 py-2 text-sm font-bold text-primary shadow-lg backdrop-blur"
        >
          <Volume2 className="h-4 w-4" /> Tap to enable sound
        </button>
      )}

      <button
        onClick={skip}
        className="absolute bottom-6 right-6 z-20 flex items-center gap-2 rounded-full border-2 border-primary bg-primary px-6 py-3 text-base font-black text-black shadow-[0_0_20px_rgba(212,175,55,0.8)] hover:scale-105 transition-transform"
      >
        {ad.skip_label || "Skip Intro"} <X className="h-5 w-5" />
      </button>
    </div>
  );
}
