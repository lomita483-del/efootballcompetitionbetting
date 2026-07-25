import { Trophy, Medal as MedalIcon, ArrowUp, ArrowDown, Users, Target, Goal } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loadStandings, type LbRow } from "@/lib/leaderboard";
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
        <span className={`inline-grid place-items-center h-8 w-8 rounded-full bg-gradient-to-b ${tiers[i]} text-black font-black text-sm shadow-[0_0_14px_-2px_rgba(212,175,55,0.6)] border border-white/30`}>
          {i + 1}
        </span>
        <MedalIcon className={`h-5 w-5 ${medalColors[i]} drop-shadow-[0_0_6px_rgba(212,175,55,0.6)]`} />
      </span>
    );
  }
  return (
    <span className="inline-grid place-items-center h-8 w-8 rounded-full bg-gradient-to-b from-[#1c2a1c] to-[#10160f] border border-emerald-400/40 text-emerald-300 font-black text-sm tabular-nums">
      {i + 1}
    </span>
  );
}

function RankArrow({ delta }: { delta?: number }) {
  if (!delta) return <span className="inline-block w-3.5" aria-hidden />;
  if (delta > 0) return <ArrowUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
  return <ArrowDown className="h-3.5 w-3.5 text-destructive shrink-0" />;
}

function Page() {
  const [shooters, setShooters] = useState<LbRow[]>([]);
  const [scorers, setScorers] = useState<LbRow[]>([]);
  const [gangs, setGangs] = useState<LbRow[]>([]);
  const [headerUrl, setHeaderUrl] = useState<string | null>(leaderboardHeaderAsset.url);

  useEffect(() => {
    const run = async () => {
      const standings: any = await loadStandings();
      setGangs(standings.gangs ?? []);
      setShooters(standings.shooters ?? []);
      setScorers(standings.scorers ?? []);
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

  return (
    <Layout>
      <div className="container py-8 max-w-5xl">
        {headerUrl ? (
          <div className="relative mb-6 rounded-2xl overflow-hidden border-2 border-amber-400/60 shadow-[0_0_40px_-10px_rgba(212,175,55,0.55)]">
            <img src={headerUrl} alt="E-Football Competition Bet Leaderboard" className="w-full h-auto block" />
          </div>
        ) : (
          <div className="relative mb-6 rounded-2xl overflow-hidden bg-black/20 backdrop-blur-[2px] border-2 border-amber-400/60 shadow-[0_0_40px_-10px_rgba(212,175,55,0.55)]">
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
          <TabsList className="bg-black/25 backdrop-blur-[2px] border border-amber-400/40 gap-1 p-1">
            <TabsTrigger value="gangs" className="gap-1.5 data-[state=active]:bg-emerald-500/90 data-[state=active]:text-black font-bold"><Users className="h-3.5 w-3.5" />Top Team / Scorer</TabsTrigger>
            <TabsTrigger value="shooters" className="gap-1.5 data-[state=active]:bg-emerald-500/90 data-[state=active]:text-black font-bold"><Target className="h-3.5 w-3.5" />Top Shooters</TabsTrigger>
            <TabsTrigger value="scorers" className="gap-1.5 data-[state=active]:bg-emerald-500/90 data-[state=active]:text-black font-bold"><Goal className="h-3.5 w-3.5" />Top Scorer</TabsTrigger>
          </TabsList>

          <TabsContent value="gangs" className="mt-4">
            <Board rows={gangs} firstCol="Team / Scorer" secondCol="Top Player" pick={(g) => g.name} secondPick={(g) => g.top_player || "—"} emptyText="No data yet." showMvp otherDivider />
          </TabsContent>

          <TabsContent value="shooters" className="mt-4">
            <Board rows={shooters} firstCol="Team & Scorer" secondCol="Player" pick={(p) => p.name} firstPick={(p) => p.gang_faction || "—"} emptyText="No shooters yet." />
          </TabsContent>

          <TabsContent value="scorers" className="mt-4">
            <ScorerBoard rows={scorers} />
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mt-4 px-2 text-[10px] text-muted-foreground">
          <span><b className="text-amber-200">TS</b> Total Score</span>
          <span><b className="text-emerald-400">W</b> Wins</span>
          <span><b className="text-destructive">L</b> Losses</span>
          <span><b className="text-amber-400">D</b> Draws</span>
          <span><b className="text-foreground">GD</b> Goal Difference</span>
          <span><b className="text-foreground">P</b> Played</span>
          <span><b className="text-emerald-300">PTS</b> Points</span>
        </div>
      </div>
    </Layout>
  );
}

function Board({
  rows, firstCol, secondCol, pick, firstPick, secondPick, emptyText, showMvp, otherDivider,
}: {
  rows: LbRow[];
  firstCol: string;
  secondCol: string;
  pick: (r: LbRow) => string;
  firstPick?: (r: LbRow) => string;
  secondPick?: (r: LbRow) => string;
  emptyText: string;
  showMvp?: boolean;
  otherDivider?: boolean;
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
            {rows.map((r, i) => (
              <>
                {otherDivider && i === 10 && (
                  <tr key="divider" aria-hidden>
                    <td colSpan={10} className="py-2">
                      <div className="flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.3em] text-amber-300/70 font-bold">
                        <span className="h-px w-10 bg-amber-400/30" />✦ Other Teams ✦<span className="h-px w-10 bg-amber-400/30" />
                      </div>
                    </td>
                  </tr>
                )}
                <tr key={r.name} className="border-b border-amber-400/10 hover:bg-amber-400/10 transition-colors">
                  <Td><Medal i={i} /></Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar url={r.image_url ?? null} name={firstPick ? firstPick(r) : pick(r)} />
                      <span className="text-base font-bold text-[#9FD65C] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" style={{ textShadow: "0 0 6px rgba(159,214,92,0.5)" }}>{firstPick ? firstPick(r) : pick(r)}</span>
                      <RankArrow delta={r.rank_delta} />
                    </div>
                  </Td>
                  <Td>
                    <span className={firstPick ? "font-bold" : "text-muted-foreground"}>{secondPick ? secondPick(r) : (firstPick ? pick(r) : (r.top_player || "—"))}</span>
                    {showMvp && i === 0 && <span className="ml-2 inline-block align-middle rounded-full border border-amber-300/60 bg-amber-400/15 text-amber-200 text-[9px] font-black px-1.5 py-0.5">★MVP</span>}
                  </Td>
                  <Td right><Pill tone="neutral">{r.TS}</Pill></Td>
                  <Td right><span className="text-emerald-400 font-bold">{r.W}</span></Td>
                  <Td right><span className="text-destructive font-bold">{r.L}</span></Td>
                  <Td right><span className="text-amber-400 font-bold">{r.D}</span></Td>
                  <Td right><span className={r.GD >= 0 ? "text-emerald-400 font-bold" : "text-destructive font-bold"}>{r.GD >= 0 ? "+" : ""}{r.GD}</span></Td>
                  <Td right><span className="text-muted-foreground">{r.P}</span></Td>
                  <Td right><Pill tone="emerald">{r.PTS}</Pill></Td>
                </tr>
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScorerBoard({ rows }: { rows: LbRow[] }) {
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
              <tr key={r.name} className="border-b border-amber-400/10 hover:bg-amber-400/10 transition-colors">
                <Td><Medal i={i} /></Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Avatar url={r.image_url ?? null} name={r.name} />
                    <span className="text-base font-bold text-[#9FD65C] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" style={{ textShadow: "0 0 6px rgba(159,214,92,0.5)" }}>{r.name}</span>
                    <RankArrow delta={r.rank_delta} />
                  </div>
                </Td>
                <Td right><span className="text-muted-foreground">{r.P}</span></Td>
                <Td right><Pill tone="emerald">{r.TS}</Pill></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "amber" | "emerald" | "neutral" }) {
  const cls = tone === "amber"
    ? "border-amber-400/40 text-amber-200 bg-amber-400/10"
    : tone === "emerald"
    ? "border-emerald-400/40 text-emerald-300 bg-emerald-400/10"
    : "border-white/15 text-foreground bg-black/30";
  return <span className={`inline-grid place-items-center min-w-[40px] rounded-md border px-2 py-1 font-black tabular-nums ${cls}`}>{children}</span>;
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) { return <th className={`px-4 py-3 ${right ? "text-right" : ""}`}>{children}</th>; }
function Td({ children, right }: { children: React.ReactNode; right?: boolean }) { return <td className={`px-4 py-3 ${right ? "text-right" : ""}`}>{children}</td>; }

function Avatar({ url, name }: { url: string | null; name: string }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="h-8 w-8 rounded-full object-cover border border-amber-400/50 shadow-[0_0_8px_-2px_rgba(212,175,55,0.5)] bg-black/30"
        loading="lazy"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <span className="h-8 w-8 grid place-items-center rounded-full border border-amber-400/40 bg-gradient-to-br from-amber-500/30 to-amber-800/30 text-amber-100 text-xs font-black">
      {initial}
    </span>
  );
}
