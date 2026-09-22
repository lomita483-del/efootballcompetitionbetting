import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Download, ShieldCheck, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const RELEASE_MANIFEST =
  "https://raw.githubusercontent.com/lomita483-del/efootballcompetitionbetting/main/public/app-release.json";

type ReleaseManifest = {
  latestVersion: string;
  latestBuild: number;
  minimumSupportedVersion?: string;
  minimumSupportedBuild?: number;
  forceUpdate?: boolean;
  downloadUrl?: string;
  releaseNotes?: string[];
};

export function AppUpdateGate() {
  const [release, setRelease] = useState<ReleaseManifest | null>(null);
  const [currentVersion, setCurrentVersion] = useState("");
  const [currentBuild, setCurrentBuild] = useState(0);
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdate = async () => {
    if (!Capacitor.isNativePlatform()) return;
    setChecking(true);
    try {
      const info = await App.getInfo();
      const build = Number(info.build) || 0;
      const url = `${RELEASE_MANIFEST}?t=${Date.now()}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      if (!res.ok) return;
      const next = (await res.json()) as ReleaseManifest;
      setCurrentVersion(info.version);
      setCurrentBuild(build);
      if (Number(next.latestBuild) > build) setRelease(next);
      else setRelease(null);
    } catch {
      // An unavailable update server must never log the user out or destroy data.
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkForUpdate();
    const listener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) checkForUpdate();
    });
    return () => {
      listener.then((handle) => handle.remove());
    };
  }, []);

  if (!release || dismissed) return null;

  const minimumBuild = Number(release.minimumSupportedBuild ?? 0);
  const mandatory = Boolean(release.forceUpdate) || (minimumBuild > 0 && currentBuild < minimumBuild);
  const notes = release.releaseNotes ?? [];
  const download = release.downloadUrl?.trim();

  const install = () => {
    if (download) window.open(download, "_system");
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
              Version {release.latestVersion} is ready. You are on {currentVersion}.
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
          <Button className="h-12 w-full font-black" onClick={install} disabled={checking}>
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
