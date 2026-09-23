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
    <div
      className="fixed inset-0 z-[99999] flex items-stretch justify-stretch bg-black/90 backdrop-blur-md"
      style={{ width: "100vw", height: "100vh", minHeight: "100vh" }}
    >
      <div
        className="flex flex-col overflow-y-auto bg-background"
        style={{
          width: "100vw",
          height: "100vh",
          minHeight: "100vh",
          maxWidth: "100vw",
          maxHeight: "100vh",
          padding: "32px",
          boxSizing: "border-box",
        }}
      >
        <div className="mb-8 flex items-start gap-5">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
            {mandatory ? <RefreshCw className="h-10 w-10" /> : <Download className="h-9 w-9" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black uppercase tracking-[0.25em] text-primary">E-Football Competition Bet</p>
            <h2 className="mt-2 text-[40px] leading-tight font-black">
              {mandatory ? "Update required" : "New app update available"}
            </h2>
            <p className="mt-4 text-[24px] leading-9 text-muted-foreground">
              Version {release.latestVersion} is ready. You are on {currentVersion || "your current version"}.
            </p>
          </div>
          {!mandatory && (
            <button
              aria-label="Dismiss update"
              className="rounded-full p-3 text-muted-foreground hover:bg-muted"
              onClick={() => setDismissed(true)}
            >
              <X className="h-7 w-7" />
            </button>
          )}
        </div>

        <div className="mb-8 rounded-2xl border border-border/60 bg-muted/20 p-6">
          <div className="flex items-start gap-4">
            <ShieldCheck className="mt-1 h-8 w-8 shrink-0 text-emerald-400" />
            <p className="text-[22px] leading-8 text-muted-foreground">
              Your account, balances, tickets, matches and other server data stay on your account.
              Installing an update does not require clearing the app or signing in again.
            </p>
          </div>
        </div>

        {notes.length > 0 && (
          <div className="mb-8">
            <p className="mb-4 text-lg font-black uppercase tracking-wider text-muted-foreground">What's new in this version</p>
            <ul className="space-y-4 text-[22px] leading-8 text-muted-foreground">
              {notes.slice(0, 8).map((note) => <li key={note}>• {note}</li>)}
            </ul>
          </div>
        )}

        {download ? (
          <Button className="mt-auto h-20 w-full text-[22px] font-black" onClick={install}>
            <Download className="mr-3 h-6 w-6" />
            Download latest update
          </Button>
        ) : (
          <p className="rounded-xl bg-muted p-4 text-center text-base text-muted-foreground">
            The new build is published but the download package is not ready yet.
          </p>
        )}

        {!mandatory && (
          <button
            className="mt-4 w-full py-3 text-base text-muted-foreground hover:text-foreground"
            onClick={() => setDismissed(true)}
          >
            Remind me later
          </button>
        )}
      </div>
    </div>
  );
}
