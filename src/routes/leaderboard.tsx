import { Trophy, Medal as MedalIcon, ArrowUp, ArrowDown, Star, Users, Target, Goal, Download, Link2, Link2Off, CheckCircle2, XCircle, Users as UsersIcon, Crown, CalendarDays, Equal, CircleDot, UserCheck, UserX, X as XIcon } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
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

type BoardKind = "gangs" | "shooters" | "scorers";

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
  const [openTarget, setOpenTarget] = useState<{ name: string; board: BoardKind } | null>(null);
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
              <Board rows={gangs} firstCol="Team / Scorer" secondCol="Top Player" pick={(g) => g.name} secondPick={(g) => g.top_player || "—"} emptyText="No data yet." onOpen={(n) => setOpenTarget({ name: n, board: "gangs" })} />
            </TabsContent>

            <TabsContent value="shooters" className="mt-3">
              <Board rows={shooters} firstCol="Team & Scorer" secondCol="Player" pick={(p) => p.name} firstPick={(p) => p.gang_faction || "—"} emptyText="No shooters yet." onOpen={(n) => setOpenTarget({ name: n, board: "shooters" })} />
            </TabsContent>

            <TabsContent value="scorers" className="mt-3">
              <ScorerBoard rows={scorers} onOpen={(n) => setOpenTarget({ name: n, board: "scorers" })} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <PlayerProfileDialog
        name={openTarget?.name ?? null}
        board={openTarget?.board ?? "gangs"}
        onClose={() => setOpenTarget(null)}
        gangs={gangs}
        shooters={shooters}
        scorers={scorers}
      />
    </Layout>
  );
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
  onOpen: (name: string) => void;
}) {
  const top = rows.slice(0, 10);
  const rest = rows.slice(10);
  return (
    <div className="relative rounded-2xl p-2 sm:p-3 bg-gradient-to-b from-black/20 via-black/10 to-black/20 border-2 border-emerald-500/60 shadow-[0_0_40px_-12px_rgba(16,185,129,0.45),inset_0_0_40px_-20px_rgba(16,185,129,0.3)]">
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
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
  onOpen: (name: string) => void;
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
          onClick={() => onOpen(nameLabel)}
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

function ScorerBoard({ rows, onOpen }: { rows: LbRow[]; onOpen: (name: string) => void }) {
  const top = rows.slice(0, 10);
  const rest = rows.slice(10);
  return (
    <div className="relative rounded-2xl p-2 sm:p-3 bg-gradient-to-b from-black/20 via-black/10 to-black/20 border-2 border-emerald-500/60 shadow-[0_0_40px_-12px_rgba(16,185,129,0.45),inset_0_0_40px_-20px_rgba(16,185,129,0.3)]">
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
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

function ScorerRowCard({ r, i, onOpen }: { r: LbRow; i: number; onOpen: (name: string) => void }) {
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
          onClick={() => onOpen(r.name)}
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

/* ───────────────────────── Player profile dialog (gold trophy-card style) ───────────────────────── */

/** Hand-drawn laurel branch — flanks the rank panel, mirrored for the right side. */
function LaurelBranch({ flip }: { flip?: boolean }) {
  const leaves = [0, 1, 2, 3, 4, 5, 6];
  return (
    <svg viewBox="0 0 34 90" className={`h-14 w-auto ${flip ? "-scale-x-100" : ""}`} style={{ opacity: 0.75 }}>
      <path d="M17 88 C 9 70, 6 52, 10 34 C 12 20, 15 9, 19 1" stroke="#d4af37" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {leaves.map((i) => {
        const t = i / (leaves.length - 1);
        const y = 84 - t * 78;
        const x = 13 - t * 3;
        const rot = 200 + t * 30;
        const size = 9 - t * 3.5;
        return (
          <ellipse
            key={i}
            cx={x}
            cy={y}
            rx={size}
            ry={size / 2.6}
            fill="#d4af37"
            opacity={0.9 - t * 0.35}
            transform={`rotate(${rot} ${x} ${y})`}
          />
        );
      })}
    </svg>
  );
}

/** CSS-only radiant starburst behind the avatar. */
function Starburst() {
  return (
    <div
      aria-hidden
      className="absolute -inset-6 rounded-full pointer-events-none"
      style={{
        background: "repeating-conic-gradient(from 0deg, rgba(251,191,36,0.35) 0deg 3deg, transparent 3deg 16deg)",
        WebkitMaskImage: "radial-gradient(circle, black 35%, transparent 68%)",
        maskImage: "radial-gradient(circle, black 35%, transparent 68%)",
      }}
    />
  );
}

/** Simple football-boot silhouette for the Top Scorer panel. */
function BootIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className} fill="currentColor">
      <path d="M6 36 C4 36 3 34 3 32 L3 20 C3 17 5 15 8 15 L14 15 L14 8 C14 5 16 3 19 3 L34 3 L46 15 L54 15 C58 15 61 18 61 22 L61 30 C61 33 59 36 55 36 Z" />
      <path d="M3 30 L61 30 L61 33 C61 35 59 36 57 36 L7 36 C5 36 3 34 3 32 Z" opacity={0.55} />
    </svg>
  );
}

function RankBadgeFull({ rank, label }: { rank: number; label: string }) {
  if (rank < 0) return null;
  return (
    <GoldPanel className="px-12 py-4 text-center">
  if (rank < 0) return null;
  return (
    <GoldPanel className="px-12 py-4 text-center">
      <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-90"><LaurelBranch /></div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-90"><LaurelBranch flip /></div>
      <div
        className="relative text-[2.6rem] leading-none font-black tabular-nums"
        style={{
          backgroundImage: "linear-gradient(180deg,#fff6cf 0%,#f2cf6a 45%,#c8931f 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          filter: "drop-shadow(0 2px 6px rgba(212,175,55,0.45))",
        }}
      >
        #{rank + 1}
      </div>
      <div className="relative text-[10px] uppercase tracking-[0.35em] text-amber-200/85 font-bold mt-1.5 pl-[0.35em]">{label}</div>
      <div className="relative flex justify-center gap-1.5 mt-2">
        {[0, 1, 2].map((s) => (
          <Star key={s} className="h-3 w-3 fill-amber-400 text-amber-400 drop-shadow-[0_0_5px_rgba(212,175,55,0.8)]" />
        ))}
      </div>
    </GoldPanel>
  );
}

const TONE_CLASSES: Record<string, string> = {
  emerald: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  destructive: "border-red-500/50 bg-red-500/10 text-red-300",
  amber: "border-amber-400/50 bg-amber-400/10 text-amber-200",
  neutral: "border-white/15 bg-white/5 text-slate-300",
};

function StatTile({
  icon: Icon, value, label, tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
  tone?: "emerald" | "destructive" | "amber" | "neutral";
}) {
  return (
    <div className={`rounded-xl border-2 px-2 py-2.5 text-center ${TONE_CLASSES[tone]}`}>
      <Icon className="mx-auto h-4 w-4 mb-1" />
      <div className="text-lg font-black tabular-nums leading-tight">{value}</div>
      <div className="text-[9px] uppercase tracking-wide opacity-80 font-bold">{label}</div>
    </div>
  );
}

function TopScorerPanel({ value }: { value: number }) {
  return (
    <div className="rounded-xl border-2 border-amber-400/70 bg-gradient-to-r from-amber-500/15 via-black/40 to-black/40 px-4 py-3 shadow-[0_0_20px_-6px_rgba(212,175,55,0.5)]">
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center shrink-0">
          <BootIcon className="h-6 w-8 text-amber-300 drop-shadow-[0_0_6px_rgba(212,175,55,0.6)]" />
          <div className="mt-1 h-1.5 w-9 rounded-full bg-gradient-to-r from-amber-600/0 via-amber-400/70 to-amber-600/0" />
        </div>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80 font-bold">Top Scorer</div>
          <div className="text-2xl font-black text-amber-200 tabular-nums leading-tight">{value}</div>
        </div>
        <div className="text-[9px] uppercase tracking-wide text-amber-300/70 font-bold text-right max-w-[80px]">Total Goals Scored</div>
      </div>
    </div>
  );
}

function MatchHistoryRow({ m }: { m: PlayerProfile["matchHistory"][number] }) {
  const won = m.result === "W";
  const lost = m.result === "L";
  return (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${won ? "border-emerald-500/30 bg-emerald-500/5" : lost ? "border-red-500/30 bg-red-500/5" : "border-amber-400/25 bg-amber-400/5"}`}>
      <div className="flex items-center gap-2 min-w-0">
        {won ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : lost ? <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" /> : <Equal className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
        <span className="font-bold truncate">vs {m.opponentName}</span>
        <span className="text-[9px] uppercase text-muted-foreground border border-white/15 rounded px-1 shrink-0">{m.kind === "team" ? "Team" : "Shooter"}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-black tabular-nums">{m.myScore} – {m.theirScore}</span>
        <span className="text-muted-foreground">{new Date(m.timestamp).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function PlayerProfileDialog({
  name, board, onClose, gangs, shooters, scorers,
}: {
  name: string | null;
  board: BoardKind;
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
  const isTopOfSomething = teamRank === 0 || shooterRank === 0 || scorerRank === 0;

  const contextRank = board === "gangs" ? teamRank : board === "shooters" ? shooterRank : scorerRank;
  const contextLabel = board === "gangs" ? "Team Rank" : board === "shooters" ? "Shooter Rank" : "Scorer Rank";

  return (
    <Dialog open={!!name} onOpenChange={(o) => !o && onClose()}>
      <DialogContent hideDefaultClose className="max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border-2 border-amber-400/60 bg-gradient-to-b from-[#0d0a05] via-[#0a0806] to-black p-5 shadow-[0_0_60px_-15px_rgba(212,175,55,0.5)]">
        <DialogClose className="absolute right-3 top-3 grid place-items-center h-8 w-8 rounded-full border-2 border-amber-400/60 bg-black/60 text-amber-300 hover:bg-amber-400/15 hover:border-amber-300 transition-colors z-10">
          <XIcon className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>

        {/* Avatar + crown + starburst */}
        <div className="flex flex-col items-center text-center pt-1 pb-3">
          <div className="relative">
            <Starburst />
            {isTopOfSomething && (
              <Crown className="absolute -top-4 left-1/2 -translate-x-1/2 h-6 w-6 text-amber-300 fill-amber-300 drop-shadow-[0_0_10px_rgba(212,175,55,0.8)] z-10" />
            )}
            <div className="relative h-24 w-24 rounded-full p-1 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-[0_0_30px_-4px_rgba(212,175,55,0.7)]">
              <div className="h-full w-full rounded-full border-2 border-black/60 overflow-hidden bg-black/40">
                <Avatar url={profile?.avatarUrl ?? null} name={name} large />
              </div>
            </div>
          </div>
          <div className="mt-2 text-xl font-black uppercase tracking-wide bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent">
            {name}
          </div>

          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-muted-foreground">
            {profile?.linkedUsername ? (
              <>
                <Link2 className="h-3 w-3 text-emerald-400" />
                <span className="font-bold text-emerald-300">{profile.linkedUsername}</span>
              </>
            ) : (
              <>
                <Link2Off className="h-3 w-3" />
                Not linked to a website account
              </>
            )}
          </div>
        </div>

        {loading && <div className="py-8 text-center text-sm text-muted-foreground">Loading profile…</div>}
        {!loading && !profile && (
          <div className="py-8 text-center text-sm text-muted-foreground">No profile data found for this name.</div>
        )}

        {!loading && profile && (
          <div className="space-y-4">
            <RankBadgeFull rank={contextRank} label={contextLabel} />

            {profile.teamName && (
              <div>
                <div className="text-xs uppercase tracking-wide text-amber-300/80 font-bold mb-1.5">Team — {profile.teamName}</div>
                <div className="grid grid-cols-4 gap-1.5">
                  <StatTile icon={CalendarDays} value={profile.team.played} label="Played" tone="amber" />
                  <StatTile icon={Trophy} value={profile.team.wins} label="Won" tone="emerald" />
                  <StatTile icon={XCircle} value={profile.team.losses} label="Lost" tone="destructive" />
                  <StatTile icon={Equal} value={profile.team.draws} label="Drawn" tone="neutral" />
                  <StatTile icon={Star} value={profile.team.points} label="Points" tone="amber" />
                  <StatTile icon={CircleDot} value={profile.team.goals} label="Goals" tone="amber" />
                  <StatTile icon={UserCheck} value={profile.team.present} label="Present" tone="emerald" />
                  <StatTile icon={UserX} value={profile.team.absent} label="Absent" tone="destructive" />
                </div>
              </div>
            )}

            {profile.shooter.played + profile.shooter.absent > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-amber-300/80 font-bold mb-1.5">Shooter Duels</div>
                <div className="grid grid-cols-4 gap-1.5">
                  <StatTile icon={CalendarDays} value={profile.shooter.played} label="Played" tone="amber" />
                  <StatTile icon={Trophy} value={profile.shooter.wins} label="Won" tone="emerald" />
                  <StatTile icon={XCircle} value={profile.shooter.losses} label="Lost" tone="destructive" />
                  <StatTile icon={Equal} value={profile.shooter.draws} label="Drawn" tone="neutral" />
                  <StatTile icon={Star} value={profile.shooter.points} label="Points" tone="amber" />
                  <StatTile icon={Target} value={profile.shooter.kills} label="Kills" tone="amber" />
                  <StatTile icon={UserCheck} value={profile.shooter.present} label="Present" tone="emerald" />
                  <StatTile icon={UserX} value={profile.shooter.absent} label="Absent" tone="destructive" />
                </div>
              </div>
            )}

            <TopScorerPanel value={profile.scorerGoals} />

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

            <div>
              <div className="text-xs uppercase tracking-wide text-amber-300/80 font-bold mb-1.5">Match History</div>
              {profile.matchHistory.length === 0 && <div className="text-xs text-muted-foreground">No matches recorded yet.</div>}
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {profile.matchHistory.map((m, idx) => <MatchHistoryRow key={idx} m={m} />)}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Avatar({ url, name, large }: { url: string | null; name: string; large?: boolean }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const size = large ? "h-full w-full text-2xl" : "h-6 w-6 text-[10px]";
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${size} rounded-full object-cover ${large ? "" : "border border-amber-400/50 shadow-[0_0_8px_-2px_rgba(212,175,55,0.5)]"} bg-black/30`}
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
