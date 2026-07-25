import { Trophy, Medal as MedalIcon, ArrowUp, ArrowDown, User, Target, Footprints, Link2, Link2Off, CheckCircle2, XCircle, Users as UsersIcon, Download } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { loadStandings, type LbRow } from "@/lib/leaderboard";
import { loadPlayerProfile, type PlayerProfile } from "@/lib/player-profile";
import { supabase } from "@/integrations/supabase/client";
import leaderboardHeaderAsset from "@/assets/leaderboard-header.png.asset.json";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — E-Football Competition Bet" },
      { name: "description", content: "See the top shooters and top teams ranked by total score, season points, wins, and tokens won across the E-Football Competition Bet." },
      { property: "og:title", content: "ECB Leaderboard — Top Shooters & Teams" },
      { property: "og:description", content: "Top shooters and teams ranked by total score, season points, wins, and tokens won." },
      { property: "og:url", content: "https://lslonlinebetting.lovable.app/leaderboard" },
    ],
    links: [{ rel: "canonical", href: "https://lslonlinebetting.lovable.app/leaderboard" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "ECB Leaderboard",
        description: "Top shooters and teams in the E-Football Competition Bet.",
        url: "https://lslonlinebetting.lovable.app/leaderboard",
      }),
    }],
  }),
  component: Page,
});

function Medal({ i }: { i: number }) {
  const tiers = ["from-amber-300 to-yellow-600", "from-slate-200 to-slate-400", "from-amber-600 to-orange-800"];
  const medalColors = ["text-yellow-300", "text-slate-200", "text-amber-600"];
  if (i < 3) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className={`inline-grid place-items-center h-8 w-8 rounded-lg bg-gradient-to-b ${tiers[i]} text-black font-black text-sm shadow-[0_0_14px_-2px_rgba(212,175,55,0.6)] border border-white/30`}>
          {i + 1}
        </span>
        <MedalIcon className={`h-5 w-5 ${medalColors[i]} drop-shadow-[0_0_6px_rgba(212,175,55,0.6)]`} />
      </span>
    );
  }
  return (
    <span className="inline-grid place-items-center h-8 w-8 rounded-lg bg-gradient-to-b from-[#3a3120] to-[#1a160d] border border-[#7BBA4A]/50 text-[#a8d16a] font-black text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_10px_-3px_rgba(123,186,74,0.5)] tabular-nums">
      {i + 1}
    </span>
  );
}

function RankArrow({ delta }: { delta?: number }) {
  if (!delta) return <span className="inline-block w-3.5" aria-hidden />;
  if (delta > 0) return <ArrowUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
  return <ArrowDown className="h-3.5 w-3.5 text-destructive shrink-0" />;
}

function MvpBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-amber-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-300 shrink-0">
      ★ MVP
    </span>
  );
}

/** Clickable name — opens the player profile dialog. */
function ClickableName({ name, onOpen, children }: { name: string; onOpen: (name: string) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(name)}
      className="text-base font-bold text-[#9FD65C] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] hover:underline hover:text-[#c2f08a] transition-colors text-left"
      style={{ textShadow: "0 0 6px rgba(159,214,92,0.5)" }}
    >
      {children}
    </button>
  );
}

// Fetches an image and converts it to a base64 data URL so it can be safely
// drawn onto a canvas regardless of the host's CORS configuration.
// Returns null if the image can't be fetched (e.g. host blocks CORS entirely).
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function Page() {
  const [shooters, setShooters] = useState<LbRow[]>([]);
  const [scorers, setScorers] = useState<LbRow[]>([]);
  const [gangs, setGangs] = useState<LbRow[]>([]);
  const [headerUrl, setHeaderUrl] = useState<string | null>(leaderboardHeaderAsset.url);
  const [openName, setOpenName] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const run = async () => {
    const { gangs, shooters, scorers } = await loadStandings();
      setGangs(gangs);
      setShooters(shooters);
      setScorers(scorers);
    };
    run();
    const ch = supabase
      .channel("leaderboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "leaderboard_overrides" }, run)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, run)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, run)
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, run)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () =>
        supabase.from("app_settings").select("leaderboard_header_url").eq("id", 1).maybeSingle().then(({ data }) => setHeaderUrl((data as any)?.leaderboard_header_url || leaderboardHeaderAsset.url))
      )
      .subscribe();
    const onFocus = () => run();
    const onVis = () => { if (document.visibilityState === "visible") run(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const poll = window.setInterval(run, 20000);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase.from("app_settings").select("leaderboard_header_url").eq("id", 1).maybeSingle();
        if (active && !error) setHeaderUrl((data as any)?.leaderboard_header_url || leaderboardHeaderAsset.url);
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, []);

  const handleDownload = async () => {
    if (!captureRef.current || downloading) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: "#07090b",
        useCORS: true,
        scale: 2,
        logging: false,
        onclone: async (clonedDoc) => {
          // Before html2canvas draws the leaderboard, replace every <img> src
          // with an inline base64 data URL. This guarantees no cross-origin
          // image ever "taints" the canvas, regardless of the image host's
          // CORS headers. If a specific image truly can't be fetched, hide it
          // instead of failing the entire export.
          const imgs = Array.from(clonedDoc.querySelectorAll("img"));
          await Promise.all(
            imgs.map(async (img) => {
              const src = img.getAttribute("src");
              if (!src || src.startsWith("data:")) return;
              const dataUrl = await toDataUrl(src);
              if (dataUrl) {
                img.setAttribute("src", dataUrl);
              } else {
                img.style.display = "none";
              }
            })
          );
        },
      });
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png")
      );
      if (!blob) throw new Error("Canvas export returned empty blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "e-football-leaderboard.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate leaderboard image", err);
      const msg = err instanceof Error ? err.message : "unknown error";
      toast.error(`Couldn't generate the image (${msg}).`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Layout>
      <div className="container py-8 max-w-5xl">
        <div className="flex items-center justify-end mb-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-black/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-200 hover:bg-amber-400/15 hover:border-amber-300/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading ? "Preparing…" : "Download"}
          </button>
        </div>

        <div ref={captureRef} className="rounded-2xl bg-[#07090b]/70 backdrop-blur-sm p-2 sm:p-3">
          {headerUrl ? (
            <div className="relative mb-4 rounded-2xl overflow-hidden border-2 border-amber-400/60 shadow-[0_0_40px_-10px_rgba(212,175,55,0.55)]">
              <img
                src={headerUrl}
                alt="E-Football Competition Bet Leaderboard"
                className="w-full h-auto block"
                crossOrigin="anonymous"
              />
            </div>
          ) : (
            <div className="relative mb-4 rounded-2xl overflow-hidden bg-black/20 backdrop-blur-[2px] border-2 border-amber-400/60 shadow-[0_0_40px_-10px_rgba(212,175,55,0.55)]">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent" />
              <div className="relative flex items-center gap-3 px-5 py-5">
                <span className="grid place-items-center h-12 w-12 rounded-xl border border-amber-400/40 bg-black/40 shadow-[0_0_20px_-4px_rgba(212,175,55,0.6)]">
                  <Trophy className="h-6 w-6 text-amber-300" />
                </span>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight gradient-gold-text drop-shadow-[0_2px_8px_rgba(212,175,55,0.3)]">E-FOOTBALL</h1>
              </div>
            </div>
          )}

          <Tabs defaultValue="gangs">
            <TabsList className="bg-black/25 backdrop-blur-[2px] border border-amber-400/40">
              <TabsTrigger value="gangs" className="gap-1.5"><User className="h-3.5 w-3.5" /> Top Team / Scorer</TabsTrigger>
              <TabsTrigger value="shooters" className="gap-1.5"><Target className="h-3.5 w-3.5" /> Top Shooters</TabsTrigger>
              <TabsTrigger value="scorers" className="gap-1.5"><Footprints className="h-3.5 w-3.5" /> Top Scorer</TabsTrigger>
            </TabsList>

            <TabsContent value="gangs" className="mt-4">
              <Board rows={gangs} firstCol="Team / Scorer" secondCol="Top Player" pick={(g) => g.name} secondPick={(g) => g.top_player || "—"} emptyText="No data yet." showMvp onOpen={setOpenName} />
            </TabsContent>

            <TabsContent value="shooters" className="mt-4">
              <Board rows={shooters} firstCol="Team & Scorer" secondCol="Player" pick={(p) => p.name} firstPick={(p) => p.gang_faction || "—"} emptyText="No shooters yet." onOpen={setOpenName} />
            </TabsContent>

            <TabsContent value="scorers" className="mt-4">
              <ScorerBoard rows={scorers} onOpen={setOpenName} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <PlayerProfileDialog
        name={openName}
        onClose={() => setOpenName(null)}
        gangs={gangs}
        shooters={shooters}
        scorers={scorers}
      />
    </Layout>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["TS", "Total Score"], ["W", "Wins"], ["L", "Losses"], ["D", "Draws"],
    ["GD", "Goal Difference"], ["P", "Played"], ["PTS", "Points"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-3 border-t border-amber-400/20 bg-black/20 text-[11px] text-muted-foreground">
      {items.map(([abbr, full]) => (
        <span key={abbr}><span className="font-bold text-amber-200/80">{abbr}</span> {full}</span>
      ))}
    </div>
  );
}

function OtherTeamsDivider({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={10} className="py-2">
        <div className="flex items-center gap-3 px-4">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
          <span className="text-[10px] uppercase tracking-[0.3em] text-amber-300/70 font-bold flex items-center gap-1.5">
            <span className="text-amber-400">✦</span> {label} <span className="text-amber-400">✦</span>
          </span>
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
        </div>
      </td>
    </tr>
  );
}

function Board({
  rows, firstCol, secondCol, pick, firstPick, secondPick, emptyText, showMvp, onOpen,
}: {
  rows: LbRow[];
  firstCol: string;
  secondCol: string;
  pick: (r: LbRow) => string;
  firstPick?: (r: LbRow) => string;
  secondPick?: (r: LbRow) => string;
  emptyText: string;
  showMvp?: boolean;
  onOpen: (name: string) => void;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-black/15 backdrop-blur-[2px] border-2 border-amber-400/55 shadow-[0_0_40px_-12px_rgba(212,175,55,0.5)]">
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-widest text-amber-200/80 border-b border-amber-400/30 bg-black/20">
              <Th>Rank</Th><Th>{firstCol}</Th><Th>{secondCol}</Th>
              <Th right>TS</Th><Th right>W</Th><Th right>L</Th><Th right>D</Th><Th right>GD</Th><Th right>P</Th><Th right>PTS</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">{emptyText}</td></tr>}
            {rows.map((r, i) => {
              const clickName = firstPick ? firstPick(r) : pick(r);
              return (
                <Fragment key={r.name}>
                  {i === 10 && rows.length > 10 && <OtherTeamsDivider label="Other Teams" />}
                  <tr className="border-b border-amber-400/10 hover:bg-amber-400/10 transition-colors">
                    <Td><Medal i={i} /></Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar url={r.image_url ?? null} name={clickName} />
                        <ClickableName name={clickName} onOpen={onOpen}>{clickName}</ClickableName>
                        <RankArrow delta={r.rank_delta} />
                        {showMvp && i === 0 && <MvpBadge />}
                      </div>
                    </Td>
                    <Td><span className={firstPick ? "font-bold" : "text-muted-foreground"}>{secondPick ? secondPick(r) : (firstPick ? pick(r) : (r.top_player || "—"))}</span></Td>
                    <Td right><Pill tone="amber">{r.TS}</Pill></Td>
                    <Td right><span className="text-emerald-400 font-bold">{r.W}</span></Td>
                    <Td right><span className="text-destructive font-bold">{r.L}</span></Td>
                    <Td right><span className="text-amber-400 font-bold">{r.D}</span></Td>
                    <Td right><span className={r.GD >= 0 ? "text-emerald-400 font-bold" : "text-destructive font-bold"}>{r.GD >= 0 ? "+" : ""}{r.GD}</span></Td>
                    <Td right><span className="text-muted-foreground">{r.P}</span></Td>
                    <Td right><Pill tone="emerald">{r.PTS}</Pill></Td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <Legend />
    </div>
  );
}

function ScorerBoard({ rows, onOpen }: { rows: LbRow[]; onOpen: (name: string) => void }) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-black/15 backdrop-blur-[2px] border-2 border-amber-400/55 shadow-[0_0_40px_-12px_rgba(212,175,55,0.5)]">
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm min-w-[420px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-widest text-amber-200/80 border-b border-amber-400/30 bg-black/20">
              <Th>Rank</Th><Th>Name</Th><Th right>Matches Played</Th><Th right>Total Goals</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No goals logged yet.</td></tr>}
            {rows.map((r, i) => (
              <Fragment key={r.name}>
                {i === 10 && rows.length > 10 && (
                  <tr>
                    <td colSpan={4} className="py-2">
                      <div className="flex items-center gap-3 px-4">
                        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
                        <span className="text-[10px] uppercase tracking-[0.3em] text-amber-300/70 font-bold flex items-center gap-1.5">
                          <span className="text-amber-400">✦</span> Other Scorers <span className="text-amber-400">✦</span>
                        </span>
                        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
                      </div>
                    </td>
                  </tr>
                )}
                <tr className="border-b border-amber-400/10 hover:bg-amber-400/10 transition-colors">
                  <Td><Medal i={i} /></Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar url={r.image_url ?? null} name={r.name} />
                      <ClickableName name={r.name} onOpen={onOpen}>{r.name}</ClickableName>
                      <RankArrow delta={r.rank_delta} />
                      {i === 0 && <MvpBadge />}
                    </div>
                  </Td>
                  <Td right><span className="text-muted-foreground">{r.P}</span></Td>
                  <Td right><Pill tone="emerald">{r.TS}</Pill></Td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <Legend />
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: string | number; tone?: "emerald" | "destructive" | "amber" | "default" }) {
  const cls = tone === "emerald" ? "text-emerald-400" : tone === "destructive" ? "text-destructive" : tone === "amber" ? "text-amber-400" : "text-foreground";
  return (
    <div className="rounded-lg border border-amber-400/20 bg-black/20 px-3 py-2 text-center">
      <div className={`text-lg font-black tabular-nums ${cls}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function PlayerProfileDialog({
  name, onClose, gangs, shooters, scorers,
}: {
  name: string | null;
  onClose: () => void;
  gangs: LbRow[];
  shooters: LbRow[];
  scorers: LbRow[];
}) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!name) { setProfile(null); return; }
    let active = true;
    setLoading(true);
    loadPlayerProfile(name).then((p) => { if (active) { setProfile(p); setLoading(false); } });
    return () => { active = false; };
  }, [name]);

  if (!name) return null;

  const teamRank = profile?.teamName ? gangs.findIndex((g) => g.name === profile.teamName) : -1;
  const shooterRank = profile ? shooters.findIndex((s) => s.name === profile.name) : -1;
  const scorerRank = profile ? scorers.findIndex((s) => s.name === profile.name) : -1;

  return (
    <Dialog open={!!name} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar url={profile?.avatarUrl ?? null} name={name} large />
            <span>{name}</span>
          </DialogTitle>
        </DialogHeader>

        {loading && <div className="py-8 text-center text-sm text-muted-foreground">Loading profile…</div>}

        {!loading && !profile && (
          <div className="py-8 text-center text-sm text-muted-foreground">No profile data found for this name.</div>
        )}

        {!loading && profile && (
          <div className="space-y-4">
            {/* Linked website account */}
            <div className="flex items-center gap-2 rounded-lg border border-amber-400/20 bg-black/20 px-3 py-2 text-sm">
              {profile.linkedUsername ? (
                <>
                  <Link2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-muted-foreground">Linked account:</span>
                  <span className="font-bold text-emerald-300">{profile.linkedUsername}</span>
                </>
              ) : (
                <>
                  <Link2Off className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Not linked to a website account</span>
                </>
              )}
            </div>

            {/* Current positions */}
            <div className="grid grid-cols-3 gap-2">
              <StatBox label="Team Rank" value={teamRank >= 0 ? `#${teamRank + 1}` : "—"} />
              <StatBox label="Shooter Rank" value={shooterRank >= 0 ? `#${shooterRank + 1}` : "—"} />
              <StatBox label="Scorer Rank" value={scorerRank >= 0 ? `#${scorerRank + 1}` : "—"} />
            </div>

            {/* Team stats */}
            {profile.teamName && (
              <div>
                <div className="text-xs uppercase tracking-wide text-amber-300/80 font-bold mb-1.5">Team — {profile.teamName}</div>
                <div className="grid grid-cols-4 gap-2">
                  <StatBox label="Played" value={profile.team.played} />
                  <StatBox label="Won" value={profile.team.wins} tone="emerald" />
                  <StatBox label="Lost" value={profile.team.losses} tone="destructive" />
                  <StatBox label="Drawn" value={profile.team.draws} tone="amber" />
                  <StatBox label="Points" value={profile.team.points} />
                  <StatBox label="Goals" value={profile.team.goals} />
                  <StatBox label="Present" value={profile.team.present} tone="emerald" />
                  <StatBox label="Absent" value={profile.team.absent} tone="destructive" />
                </div>
              </div>
            )}

            {/* Shooter stats */}
            {profile.shooter.played + profile.shooter.absent > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-amber-300/80 font-bold mb-1.5">Shooter Duels</div>
                <div className="grid grid-cols-4 gap-2">
                  <StatBox label="Played" value={profile.shooter.played} />
                  <StatBox label="Won" value={profile.shooter.wins} tone="emerald" />
                  <StatBox label="Lost" value={profile.shooter.losses} tone="destructive" />
                  <StatBox label="Drawn" value={profile.shooter.draws} tone="amber" />
                  <StatBox label="Points" value={profile.shooter.points} />
                  <StatBox label="Kills" value={profile.shooter.kills} />
                  <StatBox label="Present" value={profile.shooter.present} tone="emerald" />
                  <StatBox label="Absent" value={profile.shooter.absent} tone="destructive" />
                </div>
              </div>
            )}

            {/* Scorer stat */}
            <div>
              <div className="text-xs uppercase tracking-wide text-amber-300/80 font-bold mb-1.5">Top Scorer</div>
              <StatBox label="Total Goals Scored" value={profile.scorerGoals} tone="emerald" />
            </div>

            {/* Teammates / shooters from this team */}
            {profile.teammates.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-amber-300/80 font-bold mb-1.5 flex items-center gap-1.5">
                  <UsersIcon className="h-3.5 w-3.5" /> Shooters on {profile.teamName}
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.teammates.map((t) => (
                    <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-black/20 px-2 py-1 text-xs">
                      <Avatar url={t.avatar_url} name={t.name} />
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Match history */}
            <div>
              <div className="text-xs uppercase tracking-wide text-amber-300/80 font-bold mb-1.5">Match History</div>
              {profile.matchHistory.length === 0 && <div className="text-xs text-muted-foreground">No matches recorded yet.</div>}
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {profile.matchHistory.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-amber-400/15 bg-black/15 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      {m.result === "W" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : m.result === "L" ? <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" /> : <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-amber-400/70" />}
                      <span className="font-bold">vs {m.opponentName}</span>
                      <span className="text-[9px] uppercase text-muted-foreground border border-amber-400/20 rounded px-1">{m.kind === "team" ? "Team" : "Shooter"}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-black tabular-nums">{m.myScore} – {m.theirScore}</span>
                      <span className="text-muted-foreground">{new Date(m.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "amber" | "emerald" }) {
  const cls = tone === "amber"
    ? "border-amber-400/40 text-amber-200 bg-amber-400/10"
    : "border-emerald-400/40 text-emerald-300 bg-emerald-400/10";
  return <span className={`inline-grid place-items-center min-w-[40px] rounded-md border px-2 py-1 font-black tabular-nums ${cls}`}>{children}</span>;
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) { return <th className={`px-4 py-3 ${right ? "text-right" : ""}`}>{children}</th>; }
function Td({ children, right }: { children: React.ReactNode; right?: boolean }) { return <td className={`px-4 py-3 ${right ? "text-right" : ""}`}>{children}</td>; }

function Avatar({ url, name, large }: { url: string | null; name: string; large?: boolean }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const size = large ? "h-12 w-12 text-base" : "h-8 w-8 text-xs";
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${size} rounded-full object-cover border border-amber-400/50 shadow-[0_0_8px_-2px_rgba(212,175,55,0.5)] bg-black/30`}
        loading="lazy"
        crossOrigin="anonymous"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <span className={`${size} grid place-items-center rounded-full border border-amber-400/40 bg-gradient-to-br from-amber-500/30 to-amber-800/30 text-amber-100 font-black`}>
      {initial}
    </span>
  );
}
