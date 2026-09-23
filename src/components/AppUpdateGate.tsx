import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Download, ShieldCheck, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const RELEASE_MANIFESTS = [
  "/app-release.json",
  "https://lslonlinebetting.lovable.app/app-release.json",
  "https://raw.githubusercontent.com/lomita483-del/efootballcompetitionbetting/main/public/app-release.json",
  "https://cdn.jsdelivr.net/gh/lomita483-del/efootballcompetitionbetting@main/public/app-release.json",
];

type ReleaseManifest = {
  latestVersion: string;
  latestBuild: number;
  minimumSupportedVersion?: string;
  minimumSupportedBuild?: number;
  forceUpdate?: boolean;
  downloadUrl?: string;
  releaseNotes?: string[];
};

function isEcbAndroidWebView() {
  return /ECBAndroidApp\/[0-9.]+/i.test(navigator.userAgent);
}

function versionToNumber(version: string) {
  return version
    .split(".")
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0)
    .reduce((value, part, index) => value + part * 10 ** (4 - index * 2), 0);
}

export function AppUpdateGate() {
  const [release, setRelease] = useState<ReleaseManifest | null>(null);
  const [currentVersion, setCurrentVersion] = useState("");
  const [currentBuild, setCurrentBuild] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const checkingRef = useRef(false);

  const checkForUpdate = async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    const webViewNative = typeof navigator !== "undefined" && isEcbAndroidWebView();
    const capacitorNative = Capacitor.isNativePlatform();
    if (!webViewNative && !capacitorNative) return;

    try {
      let version = "";
      let build = 0;

      if (capacitorNative) {
        const info = await App.getInfo();
        version = info.version || "";
        build = Number(info.build) || 0;
      } else {
        const match = navigator.userAgent.match(/ECBAndroidApp\/([0-9.]+)/i);
        version = match?.[1] || "";
        build = versionToNumber(version);
      }

      let next: ReleaseManifest | null = null;
      for (const manifestUrl of RELEASE_MANIFESTS) {
        try {
          const separator = manifestUrl.includes("?") ? "&" : "?";
          const url = manifestUrl + separator + "t=" + Date.now();
          const res = await fetch(url, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
          });
          if (!res.ok) continue;
          next = (await res.json()) as ReleaseManifest;
          break;
        } catch {
          // Try the next manifest source.
        }
      }

      if (!next) return;

      setCurrentVersion(version);
      setCurrentBuild(build);

      const newerBuild = Number(next.latestBuild) > build;
      const newerVersion = versionToNumber(next.latestVersion) > versionToNumber(version);
      if (newerBuild || newerVersion) setRelease(next);
      else setRelease(null);
    } catch {
      // An unavailable update server must never log the user out or destroy data.
    } finally {
      checkingRef.current = false;
    }
  };

  useEffect(() => {
    checkForUpdate();
    const timer = window.setInterval(checkForUpdate, 60_000);

    let removeListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) checkForUpdate();
      }).then((handle) => {
        removeListener = () => handle.remove();
      });
    } else if (isEcbAndroidWebView()) {
      const onVisible = () => {
        if (document.visibilityState === "visible") checkForUpdate();
      };
      document.addEventListener("visibilitychange", onVisible);
      removeListener = () => document.removeEventListener("visibilitychange", onVisible);
    }

    return () => {
      window.clearInterval(timer);
      removeListener?.();
    };
  }, []);

  if (!release || dismissed) return null;

  const minimumBuild = Number(release.minimumSupportedBuild ?? 0);
  const mandatory = Boolean(release.forceUpdate) ||
    (minimumBuild > 0 && currentBuild > 0 && currentBuild < minimumBuild);
  const notes = release.releaseNotes ?? [];
  const download = release.downloadUrl?.trim();

  const install = () => {
    if (download) window.open(download, "_blank");
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 p-5 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-primary/30 bg-background/95 p-6 shadow-2xl">
        <div className="mb-5 flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
            {mandatory ? <RefreshCw className="h-7 w-7" /> : <Download className="h-7 w-7" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">E-Football Competition Bet</p>
            <h2 className="mt-1 text-xl font-black">
              {mandatory ? "Update required" : "New app update available"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Version {release.latestVersion} is ready. You are on {currentVersion || "your current version"}.
            </p>
          </div>
          {!mandatory && (
            <button
              aria-label="Dismiss update"
              className="rounded-full p-2 text-muted-foreground hover:bg-muted"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mb-5 rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <p className="text-xs leading-5 text-muted-foreground">
              Your account, balances, tickets, matches and other server data stay on your account.
              Installing an update does not require clearing the app or signing in again.
            </p>
          </div>
        </div>

        {notes.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">What's new</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {notes.slice(0, 6).map((note) => <li key={note}>• {note}</li>)}
            </ul>
          </div>
        )}

        {download ? (
          <Button className="h-12 w-full font-black" onClick={install}>
            <Download className="mr-2 h-4 w-4" />
            Download latest update
          </Button>
        ) : (
          <p className="rounded-xl bg-muted p-3 text-center text-xs text-muted-foreground">
            The new build is published but the download package is not ready yet.
          </p>
        )}

        {!mandatory && (
          <button
            className="mt-3 w-full py-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setDismissed(true)}
          >
            Remind me later
          </button>
        )}
      </div>
    </div>
  );
}
