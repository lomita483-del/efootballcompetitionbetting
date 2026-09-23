import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Download, ShieldCheck, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const RELEASE_MANIFESTS = [
  "https://udwsxqdegrtaqlbwnrqg.supabase.co/rest/v1/app_release_control?id=eq.1&select=enabled,latest_version,latest_build,download_url,whats_new,force_update,minimum_supported_build,updated_at",
  "/api/public/app-release",
];

type ReleaseManifest = {
  latestVersion: string;
  latestBuild: number;
  minimumSupportedVersion?: string;
  minimumSupportedBuild?: number;
  forceUpdate?: boolean;
  downloadUrl?: string;
  releaseNotes?: string[];
  whatsNew?: string[];
  enabled?: boolean;
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
    const webViewNative = typeof navigator !== "undefined" && isEcbAndroidWebView();
    const capacitorNative = Capacitor.isNativePlatform();

    // The standalone ECB Android shell can be an older installed build whose
    // native updater has already been compiled. Because the website itself is
    // live inside that old WebView, the web gate must also be able to announce
    // a newer app release. This makes the release app-version based rather
    // than dependent on the account or the old native updater implementation.
    if (!webViewNative && !capacitorNative) return;

    checkingRef.current = true;

    try {
      let version = "";
      let build = 0;

      if (webViewNative) {
        const match = navigator.userAgent.match(/ECBAndroidApp\/([0-9]+(?:\.[0-9]+){1,3})/i);
        version = match?.[1] || "";
      } else {
        const info = await App.getInfo();
        version = info.version || "";
        build = Number(info.build) || 0;
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
          const payload = await res.json();
          // Supabase REST returns a one-row array with snake_case columns.
          // Normalize it here so this native-capable updater uses the same
          // admin-controlled release record as the Android shell.
          const row = Array.isArray(payload) ? payload[0] : payload;
          if (row && typeof row === "object" && "latest_version" in row) {
            next = {
              enabled: Boolean(row.enabled),
              latestVersion: String(row.latest_version ?? ""),
              latestBuild: Number(row.latest_build ?? 0),
              minimumSupportedBuild: Number(row.minimum_supported_build ?? 0),
              forceUpdate: Boolean(row.force_update),
              downloadUrl: String(row.download_url ?? ""),
              whatsNew: Array.isArray(row.whats_new) ? row.whats_new.filter((x: unknown) => typeof x === "string" && x.trim()) : [],
            };
          } else {
            next = payload as ReleaseManifest;
          }
          break;
        } catch {
          // Try the next manifest source.
        }
      }

      if (!next || next.enabled === false) return;

      setCurrentVersion(version);
      setCurrentBuild(build);

      const newerBuild = !webViewNative && Number(next.latestBuild) > build;
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
    const timer = window.setInterval(checkForUpdate, 3_000);

    let removeListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) checkForUpdate();
      }).then((handle) => {
        removeListener = () => handle.remove();
      });
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
  // The admin-controlled What's New list is the only release note source.
  const notes = release.whatsNew ?? [];
  const download = release.downloadUrl?.trim();

  const install = () => {
    if (!download) return;

    // New Android shells expose the native installer through ECBAndroid.
    // Use it first so the APK is downloaded, signature-checked, and handed
    // to Android's package installer without leaving the app.
    const bridge = typeof window !== "undefined" ? (window as any).ECBAndroid : null;
    if (typeof bridge?.downloadUpdate === "function") {
      bridge.downloadUpdate(download);
      return;
    }

    // Older WebViews do not have the native bridge. Avoid window.open():
    // Android WebView ignores new-window requests unless a WebChromeClient
    // explicitly handles them. Same-window navigation is the safe fallback.
    window.location.href = download;
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 p-2 backdrop-blur-md">
      <div className="flex max-h-[90vh] w-[94vw] max-w-none flex-col overflow-y-auto rounded-3xl border border-primary/30 bg-background/95 p-6 shadow-2xl sm:p-10">
        <div className="mb-5 flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
            {mandatory ? <RefreshCw className="h-7 w-7" /> : <Download className="h-7 w-7" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">E-Football Competition Bet</p>
            <h2 className="mt-1 text-2xl font-black">
              {mandatory ? "Update required" : "New app update available"}
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
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
            <ul className="space-y-2 text-base leading-6 text-muted-foreground">
              {notes.slice(0, 6).map((note) => <li key={note}>• {note}</li>)}
            </ul>
          </div>
        )}

        {download ? (
          <Button className="h-14 w-full text-base font-black" onClick={install}>
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
