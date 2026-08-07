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
 * prompt — the moment they tap anywhere, we unmute and keep playing from where
 * it already is, rather than restarting or blocking the video entirely.
 */
export function VideoAd() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [ads, setAds] = useState<VideoAdRecord[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [needsSoundTap, setNeedsSoundTap] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
      // Autoplay-with-sound was blocked — fall back to a muted loop until the
      // visitor taps to enable sound.
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

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
  <div className="fixed inset-0 z-[200] bg-black overflow-hidden">
  <video
    ref={videoRef}
    src={ad.video_url}
    autoPlay
    loop
    playsInline
    className="absolute top-1/2 left-1/2 object-cover"
    style={{
      width: "100dvh",
      height: "100dvw",
      transform: "translate(-50%, -50%) rotate(90deg)",
    }}
    onClick={needsSoundTap ? enableSound : undefined}
  />
</div>

      {needsSoundTap && (
        <button
          onClick={enableSound}
          className="absolute left-1/2 top-6 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/50 bg-black/80 px-4 py-2 text-sm font-bold text-primary shadow-lg backdrop-blur"
        >
          <Volume2 className="h-4 w-4" /> Tap to enable sound
        </button>
      )}

      <button
        onClick={skip}
        className="absolute bottom-6 right-6 z-10 flex items-center gap-2 rounded-full border border-primary/50 bg-black/70 px-5 py-2.5 text-sm font-black text-primary-foreground shadow-lg backdrop-blur hover:bg-black/90"
      >
        {ad.skip_label || "Skip Intro"} <X className="h-4 w-4" />
      </button>
    </div>
  );
}
