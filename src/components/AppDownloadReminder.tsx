import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "ecb-app-download-reminder";
const REMIND_DAYS = 7;
const APK_URL = "https://raw.githubusercontent.com/lomita483-del/efootballcompetitionbetting/main/public/downloads/efootball-competition-bet-latest.apk";

function isEcbAndroidWebView() {
  return typeof navigator !== "undefined" && /ECBAndroidApp\/[0-9.]+/i.test(navigator.userAgent);
}

export function AppDownloadReminder() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || isEcbAndroidWebView()) return;
    if (window.matchMedia?.("(display-mode: standalone)").matches) return;

    const last = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (last && Date.now() - last < REMIND_DAYS * 24 * 60 * 60 * 1000) return;

    const timer = window.setTimeout(() => setShow(true), 12000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-3 z-[70] px-3 sm:bottom-5 sm:px-4 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-lg rounded-2xl border border-primary/30 bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
        <button onClick={dismiss} aria-label="Dismiss" className="absolute" style={{ marginLeft: "calc(100% - 38px)" }}>
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-3 pr-8">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-sm">Get the E-Football app</div>
            <p className="text-xs text-muted-foreground mt-0.5">Optional: use the standalone Android app for a dedicated app experience and in-app updates.</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="btn-luxury flex-1" onClick={() => window.open(APK_URL, "_blank")}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Download app
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>Not now</Button>
        </div>
      </div>
    </div>
  );
}
