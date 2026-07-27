import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MatchCardLive } from "@/components/MatchCardLive";
import { EventBanner } from "@/components/EventBanner";
import { AnnouncementSlider, HighlightsRow, AdsRow } from "@/components/HomeContent";
import { GrandPrizeWinners } from "@/components/GrandPrizeWinners";
import { NewsSlider } from "@/components/NewsSlider";
import { LotteryResultsCard } from "@/components/LotteryResultsCard";
import { SeasonBanner } from "@/components/SeasonBanner";
import { Spotlight } from "@/components/Spotlight";
import { TrendingPlayers } from "@/components/TrendingPlayers";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import {
  Crosshair, Flame, Trophy, ChevronRight, Coins, Ticket as TicketIcon, ClipboardPaste, X, Dice5,
  Users, Radio, Award, Shield, Handshake, Target, Sparkles, Twitter, Instagram, Youtube, MessageCircle, PlayCircle,
} from "lucide-react";
import { Countdown } from "@/components/Countdown";
import { TeamLogo } from "@/components/TeamLogo";
import hero from "@/assets/hero.jpg";
import { fetchMatches, fetchSettings, type MatchRow } from "@/lib/queries";
import { loadStandings, type LbRow } from "@/lib/leaderboard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { toast } from "sonner";
import { DraggableFab } from "@/components/DraggableFab";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "E-Football Competition Bet — Virtual Token Shooting League" },
      { name: "description", content: "Live matches, gang leaderboards and virtual-token wagering for the E-Football Competition Bet." },
      { property: "og:title", content: "E-Football Competition Bet — Virtual Token Shooting League" },
      { property: "og:description", content: "Live matches, gang leaderboards and virtual-token wagering for the E-Football Competition Bet." },
      { property: "og:url", content: "https://lslonlinebetting.lovable.app/" },
      { property: "og:image", content: hero },
      { name: "twitter:title", content: "E-Football Competition Bet — Virtual Token Shooting League" },
      { name: "twitter:description", content: "Live matches, gang leaderboards and virtual-token wagering for the E-Football Competition Bet." },
    ],
    links: [
      { rel: "canonical", href: "https://lslonlinebetting.lovable.app/" },
      { rel: "preload", as: "image", href: hero, fetchPriority: "high" },
    ],
  }),
  component: Index,
});

function Index() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gangRankByTeamId, setGangRankByTeamId] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    Promise.all([fetchMatches(), fetchSettings()]).then(([m, s]) => { setMatches(m); setSettings(s); }).finally(() => setLoading(false));
    let matchTimer: ReturnType<typeof setTimeout> | undefined;
    const refetchMatches = () => {
      clearTimeout(matchTimer);
      matchTimer = setTimeout(() => { fetchMatches().then(setMatches); }, 600);
    };
    let settingsTimer: ReturnType<typeof setTimeout> | undefined;
    const refetchSettings = () => {
      clearTimeout(settingsTimer);
      settingsTimer = setTimeout(() => { fetchSettings().then(setSettings); }, 600);
    };
    const ch = supabase.channel("home-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, refetchMatches)
      .on("postgres_changes", { event: "*", schema: "public", table: "odds" }, refetchMatches)
      .on("postgres_changes", { event: "*", schema: "public", table: "markets" }, refetchMatches)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "app_settings" }, refetchSettings)
      .subscribe();
    return () => { clearTimeout(matchTimer); clearTimeout(settingsTimer); supabase.removeChannel(ch); };
  }, []);

  // Team ranks (from the Top Team leaderboard) so the Featured Match card can
  // show "Rank #N" under each team, like the reference design.
  useEffect(() => {
    let alive = true;
    loadStandings().then((s) => {
      if (!alive) return;
      const map = new Map<string, number>();
      (s.gangs ?? []).forEach((r, i) => { if (r.team_id) map.set(r.team_id, i + 1); });
      setGangRankByTeamId(map);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const futures = matches.filter((m) => m.match_kind === "future" && m.status === "scheduled");
  const normalMatches = matches.filter((m) => m.match_kind !== "future");
  const live = normalMatches.filter((m) => m.status === "live");
  const upcoming = normalMatches.filter((m) => m.status === "scheduled");
  const featuredAll = matches.filter((m) => m.is_featured && m.status !== "ended");
  const featuredFallback = featuredAll.length === 0 && upcoming[0] ? [upcoming[0]] : featuredAll;

  const byCategory: Record<string, { name: string; icon: string | null; items: MatchRow[] }> = {};
  for (const m of [...live, ...upcoming]) {
    const cat = m.category;
    if (!cat) continue;
    if (!byCategory[cat.id]) byCategory[cat.id] = { name: cat.name, icon: cat.icon, items: [] };
    byCategory[cat.id].items.push(m);
  }
  const categoryGroups = Object.entries(byCategory);
  const tagline = settings?.hero_tagline || "Season 4 · Live";

  const liveMatchCount = live.length + upcoming.length;
  const teamsInPlay = useMemo(() => {
    const ids = new Set<string>();
    for (const m of [...live, ...upcoming]) {
      if (m.home_team) ids.add(m.home_team.id);
      if (m.away_team) ids.add(m.away_team.id);
    }
    return ids.size;
  }, [live, upcoming]);

  return (
    <Layout>
      <HeroBanner settings={settings} tagline={tagline} liveMatchCount={liveMatchCount} teamsInPlay={teamsInPlay} />

      <EventBanner />
      <SeasonBanner />
      <Spotlight />

      {/* Top Highlights + Top Players, side by side */}
      <section className="container mt-6 grid lg:grid-cols-[1fr_1fr] gap-4 items-start">
        <HighlightsRow embedded />
        <TrendingPlayers />
      </section>

      <AnnouncementSlider />
      <AdsRow />
      {futures.length > 0 && (
        <FuturesSection title={settings?.futures_section_title || "TOURNAMENT FUTURES"} markets={futures} maxSelections={Number(settings?.futures_max_selections ?? 1)} featured={featuredAll} />
      )}

      <BookingCodeFab />

      <section className="container mt-3">
        <div className="grid gap-3 min-[500px]:gap-5 min-[500px]:grid-cols-[minmax(0,1fr)_minmax(0,200px)] lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_300px] items-start">
          <div className="space-y-3 min-w-0">
          {loading && <p className="text-muted-foreground">Loading league…</p>}
          {!loading && featuredFallback.length > 0 && (
            <div>
              <div>
                <Carousel opts={{ loop: featuredFallback.length > 1 }} plugins={featuredFallback.length > 1 ? [Autoplay({ delay: 5000, stopOnInteraction: false })] : []}>
                  <CarouselContent>
                    {featuredFallback.map((m) => (
                      <CarouselItem key={m.id}>
                        <FeaturedGoldenMatches matches={[m]} bgImage={m.featured_image_url} bgFit={m.featured_image_fit} bgPos={m.featured_image_position} rankByTeamId={gangRankByTeamId} />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {featuredFallback.length > 1 && (<><CarouselPrevious /><CarouselNext /></>)}
                </Carousel>
              </div>
            </div>
          )}
          {!loading && live.length > 0 && (
            <div>
              <SectionHeader icon={Flame} title="Live Now" subtitle="Live odds. Markets close round-by-round." />
              <div className="space-y-2 mt-4">
                {live.map((m) => <MatchCardLive key={m.id} match={m} variant="row" />)}
              </div>
            </div>
          )}
          {!loading && upcoming.length > 0 && (
            <div>
              <SectionHeader icon={Crosshair} title="Upcoming Matches" subtitle="Lock your picks before the round starts." />
              <UpcomingMatchesTable matches={upcoming.slice(0, 6)} />
            </div>
          )}
          {categoryGroups.map(([id, g]) => (
            <div key={id}>
              <SectionHeader icon={Crosshair} title={g.name} subtitle={`${g.items.length} match${g.items.length === 1 ? "" : "es"} in this category.`} />
              <div className="space-y-2 mt-4">
                {g.items.map((m) => <MatchCardLive key={m.id} match={m} variant="row" />)}
              </div>
            </div>
          ))}
          </div>
          <aside className="space-y-6 min-w-0 lg:sticky lg:top-20 self-start">
            <NewsSlider />
            <div><div className="mt-3"><LotteryResultsCard /></div></div>
            <div><div className="mt-3"><MiniLiveLeaderboard /></div></div>
            <div><div className="mt-3"><GrandPrizeWinners /></div></div>
          </aside>
        </div>
      </section>

      <PromoFooterBand />
    </Layout>
  );
}

/** New two-column hero: headline + CTAs on the left, trophy emblem + live-stats card on the right. */
function HeroBanner({ settings, tagline, liveMatchCount, teamsInPlay }: { settings: any; tagline: string; liveMatchCount: number; teamsInPlay: number }) {
  return (
    <section className="relative overflow-hidden">
      {settings?.hero_bg_url && (
        <img
          src={settings.hero_bg_url}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full opacity-40"
          style={{ objectFit: (settings.hero_bg_fit as any) || "cover", objectPosition: settings.hero_bg_position || "center" }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background" />
      <div className="container relative py-8 md:py-14">
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div>
            {settings?.site_logo_url && (
              <img
                src={settings.site_logo_url}
                alt={settings?.site_name || "Platform logo"}
                className="mb-6 h-20 md:h-24 w-auto object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)]"
              />
            )}
            <Badge variant="outline" className="border-primary/50 text-primary mb-4">
              <Flame className="h-3 w-3 mr-1" /> {tagline}
            </Badge>
            {settings?.hero_title ? (
              <h1 className="text-4xl md:text-6xl font-bold leading-tight uppercase gradient-gold-text">
                {settings.hero_title}
              </h1>
            ) : (
              <h1 className="text-4xl md:text-6xl font-bold leading-tight uppercase">
                Where <span className="gradient-emerald-text">E-Football</span> meets{" "}
                <span className="gradient-gold-text">gold-plated</span> glory.
              </h1>
            )}
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              {settings?.hero_subtitle || "E-Football Competition Bet is a virtual-token e-football league. Pick your squad, place your wagers, and climb the leaderboard — kick-off is instant."}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/matches"><Button size="lg" className="btn-luxury">View Matches <ChevronRight className="h-4 w-4 ml-1" /></Button></Link>
              <Link to="/leaderboard"><Button size="lg" variant="outline" className="border-primary/40">Leaderboard</Button></Link>
              <Link to="/checkout"><Button size="lg" variant="outline" className="border-accent/40 text-accent"><Coins className="h-4 w-4 mr-1" />Buy Tokens</Button></Link>
            </div>
          </div>

          <div className="relative">
            <div className="relative mx-auto max-w-sm rounded-3xl border-2 border-primary/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl p-6 text-center shadow-[0_20px_60px_-20px_rgba(212,175,55,0.5)]">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border-2 border-primary/60 bg-primary/10 shadow-[0_0_30px_-6px_rgba(212,175,55,0.7)]">
                <Trophy className="h-10 w-10 text-primary" />
              </div>
              <div className="mt-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">Competition</div>
              <div className="text-2xl font-black gradient-gold-text uppercase tracking-wide">{settings?.site_name || "EFC"}</div>
              <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> {tagline}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-primary/30 bg-background/40 py-2.5">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] uppercase tracking-widest"><Users className="h-3 w-3" /> Teams</div>
                  <div className="text-xl font-black text-primary">{teamsInPlay}</div>
                </div>
                <div className="rounded-xl border border-primary/30 bg-background/40 py-2.5">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] uppercase tracking-widest"><Radio className="h-3 w-3" /> Matches</div>
                  <div className="text-xl font-black text-primary">{liveMatchCount}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Upcoming matches rendered as a real table with team logos and a 1-X-2 odds header, like the reference design. */
function UpcomingMatchesTable({ matches }: { matches: MatchRow[] }) {
  const { selections, add, remove, setOpen } = useBetSlip();
  if (matches.length === 0) return null;
  return (
    <Card className="glass overflow-hidden mt-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/60">
              <th className="px-3 py-2.5">Date &amp; Time</th>
              <th className="px-3 py-2.5">Match</th>
              <th className="px-3 py-2.5 text-right">Odds (1 · X · 2)</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => {
              const market = m.markets?.find((mk) => mk.is_open) ?? m.markets?.[0];
              const odds = (market?.odds ?? []).slice(0, 3);
              const dt = new Date(m.start_time);
              return (
                <tr key={m.id} className="border-b border-border/40 hover:bg-primary/5 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {dt.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" })} · {dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link to="/matches/$matchId" params={{ matchId: m.id }} className="flex items-center gap-2 min-w-0">
                      <TeamLogo name={m.home_team?.name} url={m.home_team?.logo_url} size={22} rounded="full" />
                      <span className="font-bold truncate text-sm">{m.home_team?.name ?? m.name}</span>
                      <span className="text-muted-foreground text-xs">vs</span>
                      <span className="font-bold truncate text-sm">{m.away_team?.name}</span>
                      {m.away_team && <TeamLogo name={m.away_team?.name} url={m.away_team?.logo_url} size={22} rounded="full" />}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {odds.map((o) => {
                        const selected = selections.some((s) => s.odd_id === o.id);
                        const blocked = !market?.is_open || m.status !== "scheduled";
                        return (
                          <button
                            key={o.id}
                            disabled={blocked && !selected}
                            onClick={() => {
                              if (selected) { remove(o.id); return; }
                              if (blocked) return;
                              add({ match_id: m.id, match_name: m.name, market_id: market!.id, market_name: market!.name, odd_id: o.id, selection_label: o.label, odds: Number(o.value) });
                              setOpen(true);
                            }}
                            className={`min-w-[52px] rounded-md border px-2 py-1.5 text-xs font-mono font-black transition disabled:opacity-40 ${
                              selected ? "border-primary bg-primary/20 text-primary" : "border-border/60 bg-background/40 hover:border-primary/50"
                            }`}
                          >
                            {Number(o.value).toFixed(2)}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2.5 border-t border-border/60 text-right">
        <Link to="/matches" className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition">
          View All <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}

/** Compact top-5 live leaderboard widget for the homepage sidebar. */
function MiniLiveLeaderboard() {
  const [rows, setRows] = useState<LbRow[]>([]);
  useEffect(() => {
    let alive = true;
    loadStandings().then((s) => { if (alive) setRows((s.gangs ?? []).slice(0, 5)); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (rows.length === 0) return null;
  const rankColor = (i: number) => i === 0 ? "text-primary" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-500" : "text-muted-foreground";
  return (
    <Card className="glass p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <div className="font-bold tracking-widest text-sm">LIVE LEADERBOARD</div>
        </div>
        <Link to="/leaderboard" className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition">
          View Full <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-muted-foreground text-left">
            <th className="py-1 font-normal">Rank</th>
            <th className="py-1 font-normal">Team / Player</th>
            <th className="py-1 font-normal text-right">P</th>
            <th className="py-1 font-normal text-right">GD</th>
            <th className="py-1 font-normal text-right">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} className="border-t border-border/40">
              <td className={`py-1.5 font-black ${rankColor(i)}`}>{i + 1}</td>
              <td className="py-1.5 font-bold truncate max-w-[110px]">{r.name}</td>
              <td className="py-1.5 text-right text-muted-foreground">{r.P}</td>
              <td className={`py-1.5 text-right font-bold ${r.GD >= 0 ? "text-emerald-400" : "text-destructive"}`}>{r.GD >= 0 ? "+" : ""}{r.GD}</td>
              <td className="py-1.5 text-right font-black text-primary">{r.PTS}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** Promo band at the bottom of the homepage: Fair Play / Respect / Compete / Glory + social links. */
function PromoFooterBand() {
  const values = [
    { icon: Shield, title: "Fair Play", body: "We play clean" },
    { icon: Handshake, title: "Respect", body: "Every player, every match" },
    { icon: Target, title: "Compete", body: "For glory and rewards" },
    { icon: Award, title: "Glory", body: "Only the best rise" },
  ];
  return (
    <section className="container mt-12">
      <div className="rounded-2xl border border-primary/20 bg-card/40 backdrop-blur px-5 py-6 flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-wrap gap-8">
          {values.map((v) => (
            <div key={v.title} className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary shrink-0">
                <v.icon className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xs font-black uppercase tracking-wide">{v.title}</div>
                <div className="text-[10px] text-muted-foreground">{v.body}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground mr-1">Follow Us</span>
          <a href="#" aria-label="Discord" className="grid h-8 w-8 place-items-center rounded-full border border-primary/30 text-muted-foreground hover:text-primary hover:border-primary/60 transition"><MessageCircle className="h-4 w-4" /></a>
          <a href="#" aria-label="Twitter" className="grid h-8 w-8 place-items-center rounded-full border border-primary/30 text-muted-foreground hover:text-primary hover:border-primary/60 transition"><Twitter className="h-4 w-4" /></a>
          <a href="#" aria-label="Instagram" className="grid h-8 w-8 place-items-center rounded-full border border-primary/30 text-muted-foreground hover:text-primary hover:border-primary/60 transition"><Instagram className="h-4 w-4" /></a>
          <a href="#" aria-label="Youtube" className="grid h-8 w-8 place-items-center rounded-full border border-primary/30 text-muted-foreground hover:text-primary hover:border-primary/60 transition"><Youtube className="h-4 w-4" /></a>
        </div>
      </div>
    </section>
  );
}

function FuturesSection({ title, markets, maxSelections, featured = [] }: { title: string; markets: MatchRow[]; maxSelections: number; featured?: MatchRow[] }) {
  const { selections, add, remove, setOpen } = useBetSlip();
  return (
    <section className="container mt-6">
      <div className="seasonal-golden relative overflow-hidden rounded-3xl mb-5 px-5 py-6 md:px-8 md:py-8">
        <div className="pointer-events-none absolute -right-10 -top-10 opacity-25">
          <Trophy className="h-44 w-44 text-amber-200" />
        </div>
        <div className="pointer-events-none absolute inset-0 seasonal-golden-shine" />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-black/30 backdrop-blur px-3 py-1 text-[10px] uppercase tracking-[0.32em] font-black text-amber-100">
              <Trophy className="h-3.5 w-3.5" /> Seasonal Tournament
            </div>
            <h2 className="mt-2 font-display text-3xl md:text-5xl font-black uppercase tracking-tight seasonal-golden-title">
              {title}
            </h2>
            <p className="mt-1 text-sm md:text-base font-semibold text-amber-50/90">
              Season-long markets · pick up to {maxSelections} contender{maxSelections === 1 ? "" : "s"}.
            </p>
          </div>
          <Link to="/tournament">
            <Button className="seasonal-golden-btn font-black tracking-wide">
              Go to Tournament <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        {featured.length > 0 && (
          <FeaturedGoldenMatches matches={featured} />
        )}
      </div>
      {markets.length === 0 && (
        <Card className="glass-strong p-5 border-accent/30">
          <div className="text-[10px] uppercase tracking-[0.28em] text-accent">Tournament futures</div>
          <div className="mt-1 font-black text-xl">No active seasonal market yet</div>
          <p className="mt-1 text-sm text-muted-foreground">New champion, top shooter, best clan, and most-wins markets will appear here when posted.</p>
        </Card>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        {markets.map((future) => {
          const market = future.markets?.[0];
          return (
            <Card key={future.id} className="glass overflow-hidden border-accent/30">
              <div className="border-b border-border/60 bg-card/60 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.28em] text-accent">Tournament Futures</div>
                  <div className="font-black text-lg truncate">{future.name}</div>
                </div>
                <div className="text-right text-[10px] text-muted-foreground shrink-0">
                  Closes in<br /><span className="font-mono text-primary"><Countdown target={future.start_time} /></span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-border/50 p-px">
                {(market?.odds ?? []).map((odd) => {
                  const selected = selections.some((s) => s.odd_id === odd.id);
                  const status = odd.future_status ?? "active";
                  const blocked = !market?.is_open || future.status !== "scheduled" || ["disqualified", "settled"].includes(status);
                  return (
                    <button
                      key={odd.id}
                      onClick={() => {
                        if (selected) remove(odd.id);
                        else {
                          if (blocked) return;
                          if (selections.filter((s) => s.is_future).length >= maxSelections) { toast.error(`This market allows up to ${maxSelections} futures selection${maxSelections === 1 ? "" : "s"}.`); return; }
                          add({ match_id: future.id, match_name: future.name, market_id: market.id, market_name: market.name, odd_id: odd.id, selection_label: odd.label, odds: Number(odd.value), is_future: true });
                          setOpen(true);
                        }
                      }}
                      disabled={blocked && !selected}
                      className={`min-h-24 bg-card/90 px-3 py-2 text-left transition hover:bg-primary/10 disabled:opacity-45 disabled:hover:bg-card/90 ${selected ? "ring-2 ring-primary bg-primary/15" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <FutureEmblem label={odd.label} url={odd.future_emblem_url} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-foreground truncate">{odd.label}</div>
                          <div className="text-[9px] uppercase tracking-widest text-muted-foreground truncate">{odd.future_candidate_type ?? "Contender"}</div>
                        </div>
                        <div className="font-mono font-black text-accent">{Number(odd.value).toFixed(2)}</div>
                      </div>
                      <FutureProgress odd={odd} />
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function FutureEmblem({ label, url }: { label: string; url?: string | null }) {
  const initials = label.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "LS";
  return (
    <span className="h-10 w-10 shrink-0 rounded-full border border-primary/35 bg-primary/10 grid place-items-center overflow-hidden text-[11px] font-black text-primary">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials}
    </span>
  );
}

/**
 * Featured Match card, redesigned to match the reference layout: large team
 * badges either side of a big "VS", a rank line under each team name, a
 * countdown, three odds boxes (Home Win / Draw / Away Win — labels come from
 * whatever the admin named the odds), and two action buttons (Watch Live /
 * Place Bet, both leading into the real match + bet-slip flow).
 *
 * `bgImage` is the optional admin-uploaded background for the card — wired
 * to each match's existing `featured_image_url` / `featured_image_fit` /
 * `featured_image_position` fields.
 */
function FeaturedGoldenMatches({
  matches, bgImage, bgFit, bgPos, rankByTeamId,
}: {
  matches: MatchRow[];
  bgImage?: string | null;
  bgFit?: string | null;
  bgPos?: string | null;
  rankByTeamId?: Map<string, number>;
}) {
  const { selections, add, remove, setOpen } = useBetSlip();
  if (matches.length === 0) return null;
  return (
    <div className="seasonal-golden relative overflow-hidden rounded-3xl px-4 py-4 md:px-7 md:py-6 space-y-3">
      {bgImage && (
        <>
          <img
            src={bgImage}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full"
            style={{ objectFit: (bgFit as any) || "cover", objectPosition: bgPos || "center" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        </>
      )}
      <div className="relative flex items-center gap-2.5">
        <Trophy className="h-7 w-7 md:h-8 md:w-8 text-amber-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]" />
        <div>
          <div className="text-2xl md:text-3xl font-black tracking-wider text-amber-100 uppercase drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">FEATURED MATCH</div>
          <div className="text-[11px] uppercase tracking-widest text-amber-100/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">The biggest matchup of the round.</div>
        </div>
      </div>
      {matches.map((m) => {
        const market = m.markets?.find((mk) => mk.is_open) ?? m.markets?.[0];
        const odds = (market?.odds ?? []).slice(0, 3);
        const live = m.status === "live";
        const homeRank = m.home_team ? rankByTeamId?.get(m.home_team.id) : undefined;
        const awayRank = m.away_team ? rankByTeamId?.get(m.away_team.id) : undefined;
        return (
          <div key={m.id} className="relative rounded-2xl border border-amber-300/40 bg-black/30 overflow-hidden shadow-[0_12px_40px_-14px_rgba(0,0,0,0.75)]">
            <div className="flex items-center justify-between gap-2 px-4 pt-3 text-[11px] uppercase tracking-widest">
              <span className="inline-flex items-center gap-1.5 font-black text-amber-200">
                {m.match_kind === "future" ? "Futures" : live ? (
                  <><span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" /></span> Live</>
                ) : "Upcoming"}
              </span>
              <span className="font-mono text-amber-50/70">
                {m.match_kind === "future" ? <>Closes in <Countdown target={m.start_time} /></> : live ? "Round in play" : <>Starts in <Countdown target={m.start_time} /></>}
              </span>
            </div>

            {m.match_kind === "future" ? (
              <Link to="/matches/$matchId" params={{ matchId: m.id }} className="flex items-center gap-3 px-4 py-4 hover:bg-amber-400/5 transition">
                <span className="h-12 w-12 shrink-0 rounded-full border border-amber-300/50 bg-amber-400/15 grid place-items-center text-amber-200"><Trophy className="h-6 w-6" /></span>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-lg text-amber-50 leading-tight truncate uppercase">
                    <span className="text-amber-300 mr-1.5">FUTURES</span>{m.name}
                  </div>
                  <div className="text-xs text-amber-100/60 truncate">{market?.name ?? "Outright market"}</div>
                </div>
              </Link>
            ) : (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-5 md:py-7">
                <div className="flex flex-col items-center gap-2 min-w-0">
                  <TeamLogo name={m.home_team?.name} url={m.home_team?.logo_url} size={64} rounded="full" />
                  <div className="text-center min-w-0">
                    <div className="font-black text-sm md:text-base text-amber-50 uppercase truncate max-w-[140px]">{m.home_team?.name ?? m.name}</div>
                    {homeRank != null && <div className="text-[10px] uppercase tracking-widest text-amber-200/70">Rank #{homeRank}</div>}
                  </div>
                </div>
                <div className="font-black text-2xl md:text-3xl text-amber-200/80 px-1">VS</div>
                <div className="flex flex-col items-center gap-2 min-w-0">
                  <TeamLogo name={m.away_team?.name} url={m.away_team?.logo_url} size={64} rounded="full" />
                  <div className="text-center min-w-0">
                    <div className="font-black text-sm md:text-base text-amber-50 uppercase truncate max-w-[140px]">{m.away_team?.name}</div>
                    {awayRank != null && <div className="text-[10px] uppercase tracking-widest text-amber-200/70">Rank #{awayRank}</div>}
                  </div>
                </div>
              </div>
            )}

            {odds.length > 0 && (
              <div className="grid gap-2.5 px-4" style={{ gridTemplateColumns: `repeat(${Math.min(odds.length, 3)}, minmax(0,1fr))` }}>
                {odds.map((o) => {
                  const selected = selections.some((s) => s.odd_id === o.id);
                  const blocked = !market?.is_open || m.status === "ended";
                  return (
                    <button
                      key={o.id}
                      disabled={blocked && !selected}
                      onClick={() => {
                        if (selected) { remove(o.id); return; }
                        if (blocked) return;
                        add({ match_id: m.id, match_name: m.name, market_id: market!.id, market_name: market!.name, odd_id: o.id, selection_label: o.label, odds: Number(o.value) });
                        setOpen(true);
                      }}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl py-3 px-2 min-h-[64px] backdrop-blur-md transition shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_12px_-8px_rgba(0,0,0,0.7)] disabled:opacity-40 ${
                        selected
                          ? "bg-emerald-500/30 border-2 border-emerald-300 ring-2 ring-emerald-300/60 text-emerald-50"
                          : "bg-emerald-950/70 border-2 border-emerald-600/60 hover:bg-emerald-800/70 hover:border-emerald-400/80 text-emerald-50"
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-100/80 truncate max-w-full leading-none">{o.label}</span>
                      <span className="font-mono font-black text-lg text-emerald-50 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] leading-none">{Number(o.value).toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {m.match_kind !== "future" && (
              <div className="grid grid-cols-2 gap-2.5 px-4 py-4">
                <Link to="/matches/$matchId" params={{ matchId: m.id }}>
                  <Button className="w-full seasonal-golden-btn font-black tracking-wide">
                    <PlayCircle className="h-4 w-4 mr-1.5" /> {live ? "Watch Live" : "View Match"}
                  </Button>
                </Link>
                <Link to="/matches/$matchId" params={{ matchId: m.id }}>
                  <Button variant="outline" className="w-full border-emerald-400/60 text-emerald-200 font-black tracking-wide">
                    Place Bet
                  </Button>
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FutureProgress({ odd }: { odd: any }) {
  const progress = Array.isArray(odd.future_progress) ? odd.future_progress : [];
  const status = odd.future_status ?? "active";
  const latest = progress[progress.length - 1];
  const completed = progress.filter((p: any) => p && p.round != null).length;
  const tone = status === "winner" ? "text-emerald-300" : ["lost", "disqualified", "settled"].includes(status) ? "text-destructive" : "text-primary";
  const lostRound = latest?.round ?? (completed > 0 ? completed : 1);
  const headline = status === "winner"
    ? "CHAMPION"
    : status === "lost"
      ? `LOST ROUND ${lostRound}`
      : status === "disqualified"
        ? "DISQUALIFIED"
        : odd.future_next_title || `Round ${completed + 1}`;
  return (
    <div className="mt-2 border-t border-border/40 pt-2">
      <div className={`text-[10px] uppercase tracking-widest font-bold ${tone}`}>{headline}</div>
      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-gradient-gold" style={{ width: `${Math.min(100, Math.max(18, (completed + 1) * 22))}%` }} />
      </div>
      {latest?.round != null ? (
        <div className="mt-1 text-[10px] text-muted-foreground truncate">
          Round {latest.round}{latest.score ? ` · ${latest.score}` : ""}
          {latest.opponent ? ` · ${["lost", "disqualified"].includes(latest.status) ? "lost to" : "beat"} ${latest.opponent}` : ""}
        </div>
      ) : (
        <div className="mt-1 text-[10px] text-muted-foreground truncate">
          {odd.future_next_title ? `Next: ${odd.future_next_title}` : "Awaiting next round"}
        </div>
      )}
    </div>
  );
}

function BookingCodeFab() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { add, clear } = useBetSlip();
  const nav = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("code");
    if (c) { setCode(c.toUpperCase()); setOpen(true); }
  }, []);

  async function pasteFromClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) { setCode(t.trim().toUpperCase()); toast.success("Pasted from clipboard"); }
      else toast.error("Clipboard is empty");
    } catch {
      toast.error("Clipboard not accessible — paste manually");
    }
  }

  async function load() {
    if (!user) { nav({ to: "/login" }); return; }
    if (!code.trim()) return;
    setLoading(true);
    const { data: bet } = await supabase.from("bets")
      .select("id, booking_code, bet_selections(*, matches!match_id(name, status), markets!market_id(name))")
      .eq("booking_code", code.trim().toUpperCase()).maybeSingle();
    setLoading(false);
    if (!bet) { toast.error("Booking code not found", { description: `We couldn't locate any ticket with the code "${code.trim().toUpperCase()}". Double-check spelling or ask the owner to re-share.` }); return; }
    const sels = bet.bet_selections ?? [];
    const expired = sels.filter((s: any) => s.matches?.status && s.matches.status !== "scheduled");
    if (expired.length === sels.length && sels.length > 0) {
      toast.error("Booking code expired", {
        description: `All ${sels.length} match(es) in this booking are already live or finished. New bets can only be placed before kick-off.`,
      });
      return;
    }
    clear();
    let added = 0;
    sels.forEach((s: any) => {
      if (s.matches?.status !== "scheduled") return;
      add({
        match_id: s.match_id, match_name: s.matches?.name ?? "Match",
        market_id: s.market_id, market_name: s.markets?.name ?? "Market",
        odd_id: s.odd_id, selection_label: s.selection_label, odds: Number(s.locked_odds),
      });
      added++;
    });
    if (added === 0) {
      toast.error("Booking code expired", {
        description: "Every match on this slip has already started — picks can no longer be copied.",
      });
      return;
    }
    if (expired.length > 0) {
      toast.warning(`Loaded ${added} pick(s) — ${expired.length} expired`, {
        description: "Some matches on this booking are already live and were skipped.",
      });
    } else {
      toast.success(`Loaded ${added} pick(s)`, { description: "Set your stake and place the bet to lock in." });
    }
    setOpen(false);
    nav({ to: "/matches" });
  }

  return (
    <>
      <DraggableFab
        storageKey="lsl-booking-code-fab-pos"
        defaultSide="left"
        ariaLabel="Paste booking code"
        onClick={() => setOpen(true)}
        className="group"
      >
        <span className="absolute inset-0 rounded-full bg-gradient-gold blur-md opacity-60 group-hover:opacity-90 transition" />
        <span className="relative h-14 w-14 rounded-full bg-gradient-gold text-primary-foreground grid place-items-center shadow-gold border border-primary/40 active:scale-95 transition">
          <ClipboardPaste className="h-6 w-6" />
        </span>
        <span className="absolute -top-1 -right-1 h-4 px-1 rounded-full bg-accent text-accent-foreground text-[9px] font-black grid place-items-center shadow">CODE</span>
      </DraggableFab>
      {open && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md grid place-items-center p-4" onClick={() => setOpen(false)}>
          <Card className="glass-strong w-full max-w-md p-5 space-y-3 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            <div className="flex items-center gap-2">
              <span className="h-9 w-9 rounded-xl bg-gradient-gold grid place-items-center text-primary-foreground"><TicketIcon className="h-4 w-4" /></span>
              <div>
                <div className="font-bold">Play a friend's booking</div>
                <div className="text-xs text-muted-foreground">Paste a booking code to copy their picks to your slip.</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Input autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BOOKING CODE" className="font-mono uppercase" />
              <Button variant="outline" onClick={pasteFromClipboard} title="Paste from clipboard"><ClipboardPaste className="h-4 w-4" /></Button>
            </div>
            <Button onClick={load} disabled={loading || !code.trim()} className="btn-luxury w-full">{loading ? "Loading…" : "Load picks"}</Button>
          </Card>
        </div>
      )}
    </>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-primary/50 bg-gradient-to-r from-emerald-950/80 via-background/80 to-emerald-950/80 px-4 py-3 shadow-[0_8px_30px_-12px_rgba(212,175,55,0.5)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-gold opacity-80" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-gold opacity-60" />
      <div className="pointer-events-none absolute -left-10 -top-10 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/50 bg-background/70 text-primary shadow-inner">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg sm:text-2xl font-black uppercase tracking-wide gradient-gold-text truncate">{title}</h2>
          <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
