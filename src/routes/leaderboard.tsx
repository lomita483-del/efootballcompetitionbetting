import { Trophy, Medal as MedalIcon, ArrowUp, ArrowDown, Star, Users, Target, Goal, Download, Link2, Link2Off, CheckCircle2, XCircle, Users as UsersIcon, Crown, CalendarDays, Award, Equal, CircleCheck, UserX, X } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  const tiers = [
    "from-amber-300 via-yellow-500 to-yellow-700 border-amber-200 text-black shadow-[0_0_18px_-2px_rgba(255,200,60,0.75)]",
    "from-slate-100 via-slate-300 to-slate-500 border-slate-100 text-black shadow-[0_0_16px_-3px_rgba(220,220,230,0.6)]",
    "from-amber-500 via-orange-600 to-orange-800 border-amber-400 text-black shadow-[0_0_16px_-3px_rgba(230,130,40,0.7)]",
  ];
  const ribbonColors = ["text-yellow-300", "text-slate-100", "text-amber-500"];
  if (i < 3) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className={`inline-grid place-items-center h-8 w-8 rounded-lg bg-gradient-to-b ${tiers[i]} font-black text-sm border-2 tabular-nums`}>
          {i + 1}
        </span>
        <MedalIcon className={`h-4 w-4 ${ribbonColors[i]} drop-shadow-[0_0_6px_rgba(212,175,55,0.7)]`} />
      </span>
    );
  }
  return (
    <span className="inline-grid place-items-center h-8 w-8 rounded-lg bg-black/40 border-2 border-emerald-500/60 text-emerald-300 font-black text-sm shadow-[inset_0_0_10px_rgba(16,185,129,0.15)] tabular-nums">
      {i + 1}
    </span>
  );
}

function RankArrow({ delta }: { delta?: number }) {
  if (!delta) return <span className="inline-block w-3" aria-hidden />;
  if (delta > 0) return <ArrowUp className="h-3 w-3 text-emerald-400 shrink-0" />;
  return <ArrowDown className="h-3 w-3 text-destructive shrink-0" />;
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
  const [downloading, setDownloading] = useState(false);
  const [selected, setSelected] = useState<{ name: string; source: "gangs" | "shooters" | "scorers"; image: string | null } | null>(null);
  const [activeBoard, setActiveBoard] = useState<"gangs" | "shooters" | "scorers">("gangs");
  const [rewards, setRewards] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const run = async () => {
    const { gangs, shooters, scorers } = await loadStandings();
      setGangs(gangs);
      setShooters(shooters);
      setScorers(scorers);
    };
    run();
    (supabase as any).from("leaderboard_rewards").select("*").eq("is_active", true).order("display_order").then(({ data }: any) => setRewards(data ?? []));
    (supabase as any).from("leaderboard_achievements").select("*").eq("is_active", true).order("display_order").then(({ data }: any) => setAchievements(data ?? []));
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

          <Tabs value={activeBoard} onValueChange={(value) => setActiveBoard(value as typeof activeBoard)}>
            <TabsList className="h-auto bg-black/25 backdrop-blur-[2px] border border-amber-400/40 p-1 gap-1">
              <TabsTrigger
                value="gangs"
                className="gap-1.5 rounded-lg border border-amber-400/25 px-2.5 py-1 data-[state=active]:border-amber-300/90 data-[state=active]:bg-amber-400/15 data-[state=active]:shadow-[0_0_16px_-4px_rgba(212,175,55,0.6)] data-[state=active]:text-amber-100"
              >
                <Users className="h-3.5 w-3.5" />
                Top Team / Scorer
              </TabsTrigger>
              <TabsTrigger
                value="shooters"
                className="gap-1.5 rounded-lg border border-amber-400/25 px-2.5 py-1 data-[state=active]:border-amber-300/90 data-[state=active]:bg-amber-400/15 data-[state=active]:shadow-[0_0_16px_-4px_rgba(212,175,55,0.6)] data-[state=active]:text-amber-100"
              >
                <Target className="h-3.5 w-3.5" />
                Top Shooters
              </TabsTrigger>
              <TabsTrigger
                value="scorers"
                className="gap-1.5 rounded-lg border border-amber-400/25 px-2.5 py-1 data-[state=active]:border-amber-300/90 data-[state=active]:bg-amber-400/15 data-[state=active]:shadow-[0_0_16px_-4px_rgba(212,175,55,0.6)] data-[state=active]:text-amber-100"
              >
                <Goal className="h-3.5 w-3.5" />
                Top Scorer
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gangs" className="mt-3">
              <Board rows={gangs} firstCol="Team / Scorer" secondCol="Top Player" pick={(g) => g.name} secondPick={(g) => g.top_player || "—"} emptyText="No data yet." onOpen={(name, image) => setSelected({ name, image, source: "gangs" })} />
            </TabsContent>

            <TabsContent value="shooters" className="mt-3">
              <Board rows={shooters} firstCol="Team & Scorer" secondCol="Player" pick={(p) => p.name} firstPick={(p) => p.gang_faction || "—"} emptyText="No shooters yet." onOpen={(name, image) => setSelected({ name, image, source: "shooters" })} />
            </TabsContent>

            <TabsContent value="scorers" className="mt-3">
              <ScorerBoard rows={scorers} onOpen={(name, image) => setSelected({ name, image, source: "scorers" })} />
            </TabsContent>
          </Tabs>
          <LeaderboardFeatures board={activeBoard} rows={activeBoard === "gangs" ? gangs : activeBoard === "shooters" ? shooters : scorers} rewards={rewards} achievements={achievements} />
        </div>
      </div>

      <PlayerProfileDialog
        selection={selected}
        onClose={() => setSelected(null)}
        gangs={gangs}
        shooters={shooters}
        scorers={scorers}
      />
    </Layout>
  );
}

function LeaderboardFeatures({ board, rows, rewards, achievements }: { board: "gangs" | "shooters" | "scorers"; rows: LbRow[]; rewards: any[]; achievements: any[] }) {
  const [showAll, setShowAll] = useState(false);
  const boardRewards = rewards.filter((reward) => reward.leaderboard_type === board);
  const boardAchievements = achievements.filter((achievement) => !achievement.leaderboard_type || achievement.leaderboard_type === board);
  return <section className="mt-4 grid gap-3 lg:grid-cols-[1.25fr_1fr]"><div className="rounded-md border border-primary/40 bg-background/65 p-4"><div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Live positions</p><h2 className="text-xl font-black">Rewards for Top 3</h2></div><Trophy className="text-primary" /></div><div className="space-y-2">{boardRewards.slice(0, showAll ? undefined : 3).map((reward) => { const holder = rows[reward.rank - 1]; return <div key={reward.id} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-primary/20 bg-card/55 p-3"><span className="grid h-9 w-9 place-items-center rounded-md border border-primary/45 font-black text-primary">#{reward.rank}</span><div className="min-w-0"><b className="block truncate">{holder?.name ?? "Position open"}</b><span className="text-[10px] text-muted-foreground">{reward.title} · {reward.description}</span></div><strong className="text-primary">{reward.reward_value}</strong></div>; })}</div>{boardRewards.length > 3 && <Button variant="outline" className="mt-3 w-full" onClick={() => setShowAll((value) => !value)}>{showAll ? "Show Top 3" : "View All Rewards"}</Button>}</div><div className="rounded-md border border-accent/35 bg-background/65 p-4"><div className="mb-3 flex items-center gap-2"><Award className="text-accent" /><h2 className="text-xl font-black">Achievements</h2></div><div className="space-y-2">{boardAchievements.map((achievement) => <div key={achievement.id} className="flex gap-3 rounded-md border border-accent/20 bg-card/55 p-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent/10"><Star className="text-accent" /></span><div><b className="text-sm">{achievement.title}</b><p className="text-[10px] text-muted-foreground">{achievement.description}</p></div></div>)}</div></div></section>;
}

function Board({
  rows, firstCol, secondCol, pick, firstPick, secondPick, emptyText, onOpen,
}: {
  rows: LbRow[];
  firstCol: string;
  secondCol: string;
  pick: (r: LbRow) => string;
  firstPick?: (r: LbRow) => string;
  secondPick?: (r: LbRow) => string;
  emptyText: string;
  onOpen: (name: string, image: string | null) => void;
}) {
  const top = rows.slice(0, 10);
  const rest = rows.slice(10);
  return (
    <div className="relative rounded-2xl p-2 sm:p-3 bg-gradient-to-b from-black/20 via-black/10 to-black/20 border-2 border-emerald-500/60 shadow-[0_0_40px_-12px_rgba(16,185,129,0.45),inset_0_0_40px_-20px_rgba(16,185,129,0.3)]">
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          {/* header */}
          <div className="grid grid-cols-[52px_1.4fr_1fr_48px_38px_38px_38px_48px_38px_52px] items-center gap-1.5 px-2.5 py-1.5 text-[10px] uppercase tracking-widest text-amber-300/90 font-bold">
            <div>Rank</div>
            <div>{firstCol}</div>
            <div>{secondCol}</div>
            <div className="text-center">TS</div>
            <div className="text-center">W</div>
            <div className="text-center">L</div>
            <div className="text-center">D</div>
            <div className="text-center">GD</div>
            <div className="text-center">P</div>
            <div className="text-center">PTS</div>
          </div>

          {rows.length === 0 && (
            <div className="p-6 text-center text-muted-foreground">{emptyText}</div>
          )}

          <div className="flex flex-col gap-1.5">
            {top.map((r, i) => (
              <LbRowCard key={r.name} r={r} i={i} firstPick={firstPick} pick={pick} secondPick={secondPick} onOpen={onOpen} />
            ))}
          </div>

          {rest.length > 0 && (
            <div className="my-2.5 flex items-center justify-center gap-3 text-amber-300/90">
              <span className="h-px w-16 bg-gradient-to-r from-transparent to-amber-400/60" />
              <span className="text-amber-300">✦</span>
              <span className="text-[10px] uppercase tracking-[0.25em] font-bold">Other Teams</span>
              <span className="text-amber-300">✦</span>
              <span className="h-px w-16 bg-gradient-to-l from-transparent to-amber-400/60" />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {rest.map((r, idx) => (
              <LbRowCard key={r.name} r={r} i={idx + 10} firstPick={firstPick} pick={pick} secondPick={secondPick} onOpen={onOpen} />
            ))}
          </div>
        </div>
      </div>

      {/* legend */}
      <div className="mt-3 rounded-xl border border-amber-400/40 bg-black/20 px-2.5 py-1.5 overflow-x-auto">
        <div className="flex items-center gap-3 text-[10px] whitespace-nowrap">
          <LegendItem k="TS" label="Total Score" color="text-amber-300" />
          <LegendItem k="W" label="Wins" color="text-emerald-400" />
          <LegendItem k="L" label="Losses" color="text-red-400" />
          <LegendItem k="D" label="Draws" color="text-amber-300" />
          <LegendItem k="GD" label="Goal Difference" color="text-emerald-400" />
          <LegendItem k="P" label="Played" color="text-emerald-400" />
          <LegendItem k="PTS" label="Points" color="text-emerald-400" />
        </div>
      </div>
    </div>
  );
}

function LegendItem({ k, label, color }: { k: string; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`font-black ${color}`}>{k}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function LbRowCard({
  r, i, firstPick, pick, secondPick, onOpen,
}: {
  r: LbRow;
  i: number;
  firstPick?: (r: LbRow) => string;
  pick: (r: LbRow) => string;
  secondPick?: (r: LbRow) => string;
  onOpen: (name: string, image: string | null) => void;
}) {
  const isFirst = i === 0;
  const isSecond = i === 1;
  const isThird = i === 2;
  const rowBorder = isFirst
    ? "border-amber-300/90 shadow-[0_0_24px_-4px_rgba(255,200,60,0.55),inset_0_0_24px_-10px_rgba(255,200,60,0.4)] bg-black/30 bg-gradient-to-r from-amber-500/20 via-amber-400/15 to-amber-500/20"
    : isSecond
    ? "border-slate-200/70 shadow-[0_0_18px_-6px_rgba(220,220,230,0.5)] bg-black/30 bg-gradient-to-r from-slate-400/15 via-slate-300/10 to-slate-400/15"
    : isThird
    ? "border-orange-500/70 shadow-[0_0_18px_-6px_rgba(230,130,40,0.55)] bg-black/30 bg-gradient-to-r from-orange-600/20 via-amber-700/15 to-orange-600/20"
    : "border-emerald-500/50 bg-black/35 hover:border-emerald-400/70 hover:bg-black/45";
  const nameLabel = firstPick ? firstPick(r) : pick(r);
  const secondary = secondPick ? secondPick(r) : (firstPick ? pick(r) : (r.top_player || "—"));
  return (
    <div className={`grid grid-cols-[52px_1.4fr_1fr_48px_38px_38px_38px_48px_38px_52px] items-center gap-1.5 rounded-xl border-2 px-2.5 py-2 transition-colors ${rowBorder}`}>
      <div><Medal i={i} /></div>
      <div className="flex items-center gap-1.5 min-w-0">
        <Avatar url={r.image_url ?? null} name={nameLabel} />
        <button
          type="button"
          onClick={() => onOpen(nameLabel, r.image_url ?? null)}
          className="truncate text-sm font-black uppercase tracking-wide text-[#9FD65C] hover:underline hover:text-[#c2f08a] transition-colors text-left"
          style={{ textShadow: "0 0 8px rgba(159,214,92,0.55)" }}
        >
          {nameLabel}
        </button>
        <RankArrow delta={r.rank_delta} />
      </div>
      <div className="flex items-center gap-1 min-w-0">
        <span className="truncate text-xs text-muted-foreground">{secondary}</span>
        {isFirst && (
          <span className="inline-flex items-center gap-0.5 shrink-0 rounded-md border border-amber-300/70 bg-amber-400/15 px-1 py-0.5 text-[9px] font-black text-amber-200">
            <Star className="h-2.5 w-2.5 fill-amber-300 text-amber-300" />MVP
          </span>
        )}
      </div>
      <TsBox>{r.TS}</TsBox>
      <StatText className="text-emerald-400">{r.W}</StatText>
      <StatText className="text-red-400">{r.L}</StatText>
      <StatText className="text-amber-300">{r.D}</StatText>
      <StatText className={r.GD >= 0 ? "text-emerald-400" : "text-red-400"}>{`${r.GD >= 0 ? "+" : ""}${r.GD}`}</StatText>
      <StatText className="text-emerald-400">{r.P}</StatText>
      <PtsBox>{r.PTS}</PtsBox>
    </div>
  );
}

function TsBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto inline-grid place-items-center min-w-[40px] h-7 rounded-md border border-amber-400/60 bg-black/30 px-1.5 font-black text-xs tabular-nums text-amber-100 shadow-[inset_0_0_10px_rgba(212,175,55,0.15)]">
      {children}
    </div>
  );
}
function PtsBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto inline-grid place-items-center min-w-[44px] h-7 rounded-md border-2 border-emerald-400/70 bg-emerald-500/10 px-1.5 font-black text-xs tabular-nums text-emerald-300 shadow-[inset_0_0_10px_rgba(16,185,129,0.2)]">
      {children}
    </div>
  );
}
function StatText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-center font-black text-xs tabular-nums ${className}`}>{children}</div>;
}

function ScorerBoard({ rows, onOpen }: { rows: LbRow[]; onOpen: (name: string, image: string | null) => void }) {
  const top = rows.slice(0, 10);
  const rest = rows.slice(10);
  return (
    <div className="relative rounded-2xl p-2 sm:p-3 bg-gradient-to-b from-black/20 via-black/10 to-black/20 border-2 border-emerald-500/60 shadow-[0_0_40px_-12px_rgba(16,185,129,0.45),inset_0_0_40px_-20px_rgba(16,185,129,0.3)]">
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          {/* header */}
          <div className="grid grid-cols-[52px_1fr_130px_110px] items-center gap-1.5 px-2.5 py-1.5 text-[10px] uppercase tracking-widest text-amber-300/90 font-bold">
            <div>Rank</div>
            <div>Name</div>
            <div className="text-center">Matches Played</div>
            <div className="text-center">Total Goals</div>
          </div>

          {rows.length === 0 && (
            <div className="p-6 text-center text-muted-foreground">No goals logged yet.</div>
          )}

          <div className="flex flex-col gap-1.5">
            {top.map((r, i) => (
              <ScorerRowCard key={r.name} r={r} i={i} onOpen={onOpen} />
            ))}
          </div>

          {rest.length > 0 && (
            <div className="my-2.5 flex items-center justify-center gap-3 text-amber-300/90">
              <span className="h-px w-16 bg-gradient-to-r from-transparent to-amber-400/60" />
              <span className="text-amber-300">✦</span>
              <span className="text-[10px] uppercase tracking-[0.25em] font-bold">Other Scorers</span>
              <span className="text-amber-300">✦</span>
              <span className="h-px w-16 bg-gradient-to-l from-transparent to-amber-400/60" />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {rest.map((r, idx) => (
              <ScorerRowCard key={r.name} r={r} i={idx + 10} onOpen={onOpen} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScorerRowCard({ r, i, onOpen }: { r: LbRow; i: number; onOpen: (name: string, image: string | null) => void }) {
  const isFirst = i === 0;
  const isSecond = i === 1;
  const isThird = i === 2;
  const rowBorder = isFirst
    ? "border-amber-300/90 shadow-[0_0_24px_-4px_rgba(255,200,60,0.55),inset_0_0_24px_-10px_rgba(255,200,60,0.4)] bg-black/30 bg-gradient-to-r from-amber-500/20 via-amber-400/15 to-amber-500/20"
    : isSecond
    ? "border-slate-200/70 shadow-[0_0_18px_-6px_rgba(220,220,230,0.5)] bg-black/30 bg-gradient-to-r from-slate-400/15 via-slate-300/10 to-slate-400/15"
    : isThird
    ? "border-orange-500/70 shadow-[0_0_18px_-6px_rgba(230,130,40,0.55)] bg-black/30 bg-gradient-to-r from-orange-600/20 via-amber-700/15 to-orange-600/20"
    : "border-emerald-500/50 bg-black/35 hover:border-emerald-400/70 hover:bg-black/45";
  return (
    <div className={`grid grid-cols-[52px_1fr_130px_110px] items-center gap-1.5 rounded-xl border-2 px-2.5 py-2 transition-colors ${rowBorder}`}>
      <div><Medal i={i} /></div>
      <div className="flex items-center gap-1.5 min-w-0">
        <Avatar url={r.image_url ?? null} name={r.name} />
        <button
          type="button"
          onClick={() => onOpen(r.name, r.image_url ?? null)}
          className="truncate text-sm font-black uppercase tracking-wide text-[#9FD65C] hover:underline hover:text-[#c2f08a] transition-colors text-left"
          style={{ textShadow: "0 0 8px rgba(159,214,92,0.55)" }}
        >
          {r.name}
        </button>
        <RankArrow delta={r.rank_delta} />
      </div>
      <StatText className="text-emerald-400">{r.P}</StatText>
      <PtsBox>{r.TS}</PtsBox>
    </div>
  );
}

function StatBox({ label, value, tone, icon }: { label: string; value: string | number; tone?: "emerald" | "destructive" | "amber" | "default"; icon?: React.ReactNode }) {
  const cls = tone === "emerald" ? "text-emerald-400" : tone === "destructive" ? "text-red-400" : tone === "amber" ? "text-amber-300" : "text-amber-50";
  return (
    <div className="rounded-xl border border-amber-400/45 bg-gradient-to-b from-black/70 to-amber-950/25 px-2 py-2 text-center shadow-[inset_0_1px_0_rgba(255,215,120,0.18)]">
      {icon && <div className="mb-0.5 grid place-items-center text-amber-300/90">{icon}</div>}
      <div className={`text-xl font-black tabular-nums ${cls}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-[0.12em] text-amber-200/70 font-bold">{label}</div>
    </div>
  );
}

/** Ornate gold rank plaque with laurel flourishes, as in the design reference. */
function RankPlaque({ value, label }: { value: string; label: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-amber-400/70 bg-gradient-to-b from-amber-900/40 via-black/70 to-black/80 px-2 py-2.5 text-center shadow-[0_0_18px_-6px_rgba(212,175,55,0.7),inset_0_0_18px_-10px_rgba(255,215,120,0.6)]">
      <div className="text-xl font-black tabular-nums text-amber-200 drop-shadow-[0_0_8px_rgba(212,175,55,0.8)]">{value}</div>
      <div className="text-[8.5px] uppercase tracking-[0.18em] font-black text-amber-100/85 leading-tight">{label}</div>
      <div className="mt-1 flex items-center justify-center gap-0.5 text-amber-300/90">
        <Star className="h-2 w-2 fill-amber-300 text-amber-300" />
        <Star className="h-2.5 w-2.5 fill-amber-300 text-amber-300" />
        <Star className="h-2 w-2 fill-amber-300 text-amber-300" />
      </div>
      <span className="pointer-events-none absolute inset-y-2 left-1 w-3 rounded-full bg-gradient-to-r from-amber-400/25 to-transparent" />
      <span className="pointer-events-none absolute inset-y-2 right-1 w-3 rounded-full bg-gradient-to-l from-amber-400/25 to-transparent" />
    </div>
  );
}

function SectionFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-amber-400/55 bg-black/50 p-2.5 shadow-[inset_0_0_24px_-14px_rgba(255,215,120,0.7)]">
      <div className="mb-2 text-[10px] uppercase tracking-[0.2em] font-black text-amber-200">{title}</div>
      {children}
    </div>
  );
}

function PlayerProfileDialog({
  selection, onClose, gangs, shooters, scorers,
}: {
  selection: { name: string; source: "gangs" | "shooters" | "scorers"; image: string | null } | null;
  onClose: () => void;
  gangs: LbRow[];
  shooters: LbRow[];
  scorers: LbRow[];
}) {
  const name = selection?.name ?? null;
  const source = selection?.source ?? "gangs";
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!name) { setProfile(null); return; }
    let active = true;
    setLoading(true);
    loadPlayerProfile(name).then((p) => { if (active) { setProfile(p); setLoading(false); } });
    return () => { active = false; };
  }, [name]);

  if (!name || !selection) return null;

  const teamRank = source === "gangs"
    ? gangs.findIndex((g) => g.name.toLowerCase() === name.toLowerCase())
    : profile?.teamName ? gangs.findIndex((g) => g.name.toLowerCase() === profile.teamName!.toLowerCase()) : -1;
  const shooterRank = profile ? shooters.findIndex((s) => s.name.toLowerCase() === profile.name.toLowerCase()) : -1;
  const scorerRank = profile ? scorers.findIndex((s) => s.name.toLowerCase() === profile.name.toLowerCase()) : -1;

  const showTeam = source === "gangs" || source === "scorers";
  const showShooter = source === "shooters" || source === "scorers";
  const history = (profile?.matchHistory ?? []).filter((m) =>
    source === "gangs" ? m.kind === "team" : source === "shooters" ? m.kind === "shooter" : true
  );
  const avatarUrl = selection.image ?? profile?.avatarUrl ?? null;

  return (
    <Dialog open={!!name} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto border-2 border-amber-400/70 bg-[#080604] p-0 shadow-[0_0_60px_-10px_rgba(212,175,55,0.6)] [&>button]:hidden">
        <div className="relative rounded-lg border border-amber-400/30 bg-gradient-to-b from-[#100c06] via-black to-[#0b0805] p-3 space-y-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border-2 border-amber-400/80 bg-black/70 text-amber-200 hover:bg-amber-400/20"
          >
            <X className="h-4 w-4" />
          </button>

          <DialogHeader className="space-y-0">
            <DialogTitle className="sr-only">{name} profile</DialogTitle>
          </DialogHeader>

          {/* Crest / hero */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/60 bg-gradient-to-b from-amber-900/25 via-black to-black px-4 pb-4 pt-7 text-center shadow-[inset_0_0_50px_-22px_rgba(255,200,80,0.8)]">
            <Crown className="absolute left-1/2 top-1.5 h-6 w-6 -translate-x-1/2 fill-amber-300 text-amber-300 drop-shadow-[0_0_10px_rgba(212,175,55,0.9)]" />
            <div className="mx-auto mt-2 grid h-28 w-28 place-items-center rounded-full border-[3px] border-amber-400/90 bg-gradient-to-b from-amber-950/60 to-black shadow-[0_0_30px_-6px_rgba(212,175,55,0.85),inset_0_0_24px_-8px_rgba(255,215,120,0.7)] overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="font-display text-4xl font-black text-amber-200 drop-shadow-[0_0_10px_rgba(212,175,55,0.8)]">
                  {name.trim().charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="mt-3 font-display text-xl font-black uppercase tracking-[0.12em] text-amber-100 drop-shadow-[0_0_10px_rgba(212,175,55,0.5)]">
              {name}
            </div>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-400/50 bg-black/70 px-3 py-1 text-[11px]">
              {profile?.linkedUsername ? (
                <>
                  <Link2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="font-bold text-emerald-300">{profile.linkedUsername}</span>
                </>
              ) : (
                <>
                  <Link2Off className="h-3.5 w-3.5 text-amber-200/70" />
                  <span className="text-amber-100/80">Not linked to a website account</span>
                </>
              )}
            </div>
          </div>

          {loading && <div className="py-8 text-center text-sm text-amber-200/70">Loading profile…</div>}
          {!loading && !profile && (
            <div className="py-8 text-center text-sm text-amber-200/70">No profile data found for this name.</div>
          )}

          {!loading && profile && (
            <>
              {/* Rank plaques — scoped to the board the profile was opened from */}
              <div className={`grid gap-2 ${source === "scorers" ? "grid-cols-3" : "grid-cols-1"}`}>
                {(source === "gangs" || source === "scorers") && (
                  <RankPlaque value={teamRank >= 0 ? `#${teamRank + 1}` : "—"} label="Team Rank" />
                )}
                {(source === "shooters" || source === "scorers") && (
                  <RankPlaque value={shooterRank >= 0 ? `#${shooterRank + 1}` : "—"} label="Shooter Rank" />
                )}
                {source === "scorers" && (
                  <RankPlaque value={scorerRank >= 0 ? `#${scorerRank + 1}` : "—"} label="Scorer Rank" />
                )}
              </div>

              {showTeam && (
                <SectionFrame title={`Team — ${profile.teamName ?? name}`}>
                  <div className="grid grid-cols-4 gap-2">
                    <StatBox label="Played" value={profile.team.played} icon={<CalendarDays className="h-3.5 w-3.5" />} />
                    <StatBox label="Won" value={profile.team.wins} tone="emerald" icon={<Trophy className="h-3.5 w-3.5" />} />
                    <StatBox label="Lost" value={profile.team.losses} tone="destructive" icon={<XCircle className="h-3.5 w-3.5" />} />
                    <StatBox label="Drawn" value={profile.team.draws} tone="amber" icon={<Equal className="h-3.5 w-3.5" />} />
                    <StatBox label="Points" value={profile.team.points} icon={<Star className="h-3.5 w-3.5" />} />
                    <StatBox label="Goals" value={profile.team.goals} icon={<Goal className="h-3.5 w-3.5" />} />
                    <StatBox label="Present" value={profile.team.present} tone="emerald" icon={<CircleCheck className="h-3.5 w-3.5" />} />
                    <StatBox label="Absent" value={profile.team.absent} tone="destructive" icon={<UserX className="h-3.5 w-3.5" />} />
                  </div>
                </SectionFrame>
              )}

              {showShooter && profile.shooter.played + profile.shooter.absent > 0 && (
                <SectionFrame title={`Shooter — ${profile.name}`}>
                  <div className="grid grid-cols-4 gap-2">
                    <StatBox label="Played" value={profile.shooter.played} icon={<CalendarDays className="h-3.5 w-3.5" />} />
                    <StatBox label="Won" value={profile.shooter.wins} tone="emerald" icon={<Trophy className="h-3.5 w-3.5" />} />
                    <StatBox label="Lost" value={profile.shooter.losses} tone="destructive" icon={<XCircle className="h-3.5 w-3.5" />} />
                    <StatBox label="Drawn" value={profile.shooter.draws} tone="amber" icon={<Equal className="h-3.5 w-3.5" />} />
                    <StatBox label="Points" value={profile.shooter.points} icon={<Star className="h-3.5 w-3.5" />} />
                    <StatBox label="Kills" value={profile.shooter.kills} icon={<Target className="h-3.5 w-3.5" />} />
                    <StatBox label="Present" value={profile.shooter.present} tone="emerald" icon={<CircleCheck className="h-3.5 w-3.5" />} />
                    <StatBox label="Absent" value={profile.shooter.absent} tone="destructive" icon={<UserX className="h-3.5 w-3.5" />} />
                  </div>
                </SectionFrame>
              )}

              {source === "scorers" && (
                <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/70 bg-gradient-to-r from-amber-900/40 via-black to-amber-900/40 px-3 py-3 shadow-[0_0_24px_-10px_rgba(212,175,55,0.8)]">
                  <div className="text-[10px] uppercase tracking-[0.2em] font-black text-amber-200">Top Scorer</div>
                  <div className="mt-1 flex items-center justify-center gap-3">
                    <Award className="h-8 w-8 fill-amber-400/20 text-amber-300 drop-shadow-[0_0_10px_rgba(212,175,55,0.8)]" />
                    <div className="text-center">
                      <div className="font-display text-3xl font-black text-amber-200 drop-shadow-[0_0_12px_rgba(212,175,55,0.9)] tabular-nums">
                        {profile.scorerGoals}
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-amber-100/85">Total Goals Scored</div>
                    </div>
                  </div>
                </div>
              )}

              <SectionFrame title="Match History">
                {history.length === 0 && <div className="text-xs text-amber-200/70">No matches recorded yet.</div>}
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {history.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 rounded-xl border border-amber-400/35 bg-black/60 px-2.5 py-2 text-xs">
                      <div className="flex min-w-0 items-center gap-2">
                        {m.result === "W" ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        ) : m.result === "L" ? (
                          <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                        ) : (
                          <Equal className="h-4 w-4 shrink-0 text-amber-300" />
                        )}
                        <span className="truncate font-black text-amber-50">vs {m.opponentName}</span>
                        <span className="shrink-0 rounded border border-amber-400/40 px-1 text-[9px] uppercase text-amber-200/80">
                          {m.kind === "team" ? "Team" : "Shooter"}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-black tabular-nums text-amber-100">{m.myScore} – {m.theirScore}</span>
                        <span className="text-amber-200/70 tabular-nums">{new Date(m.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionFrame>

              {source === "gangs" && profile.teammates.length > 0 && (
                <SectionFrame title={`Shooters on ${profile.teamName ?? name}`}>
                  <div className="flex flex-wrap gap-2">
                    {profile.teammates.map((t) => (
                      <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-black/60 px-2 py-1 text-xs text-amber-50">
                        <Avatar url={t.avatar_url} name={t.name} />
                        {t.name}
                      </span>
                    ))}
                  </div>
                </SectionFrame>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Avatar({ url, name, large }: { url: string | null; name: string; large?: boolean }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const size = large ? "h-12 w-12 text-base" : "h-6 w-6 text-[10px]";
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
