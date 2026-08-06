import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Calendar, ChevronRight, Crown, Crosshair, Gift, Headphones, RefreshCw, Search, Target, Ticket, Trophy, X } from "lucide-react";
import { Layout } from "@/components/Layout";
import { HomeBannerSlider } from "@/components/HomeBannerSlider";
import { ArenaMatchRow } from "@/components/ArenaMatchRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchMatches, type MatchRow } from "@/lib/queries";
import { loadStandings, type LbRow } from "@/lib/leaderboard";

export const Route = createFileRoute("/matches")({
  head: () => ({
    meta: [
      { title: "All Matches — E-Football Competition Bet" },
      { name: "description", content: "Browse every upcoming, live, and finished ECB match with real-time odds and quick-pick wagering." },
      { property: "og:title", content: "All Matches — E-Football Competition Bet" },
      { property: "og:description", content: "Upcoming, live, and finished ECB matches with real-time odds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchesPage,
});

function MatchesPage() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [arena, setArena] = useState<any>(null);
  const [competitors, setCompetitors] = useState<LbRow[]>([]);
  useEffect(() => {
    const refresh = () => fetchMatches().then(setMatches).finally(() => setLoading(false));
    refresh();
    loadStandings().then(({ gangs }) => setCompetitors(gangs.slice(0, 3)));
    supabase.from("app_settings").select("matches_arena_image_url,matches_arena_image_fit,matches_arena_image_position").eq("id", 1).maybeSingle().then(({ data }) => setArena(data));
    const ch = supabase.channel("all-matches")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "odds" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const regular = matches.filter((match) => match.match_kind !== "future");
  const featured = regular.filter((match) => match.is_featured && match.status !== "ended");
  const heroMatch = featured[0] ?? regular.find((match) => match.status === "scheduled" || match.status === "live");
  return <Layout><main className="ecb-home container pb-3"><div data-tour="matches-promo"><HomeBannerSlider embedded placement="matches" /></div>{heroMatch && <FeaturedMatch match={heroMatch} arena={arena} />}<TopCompetitors rows={competitors} /><Arena matches={regular} loading={loading} /><Stats matches={regular} /></main></Layout>;
}

function FeaturedMatch({ match, arena }: { match: MatchRow; arena: any }) {
  const image = arena?.matches_arena_image_url || match.featured_image_url;
  return <section className="ecb-reference-hero mt-4">{image && <img src={image} alt="The Arena featured competition" className="ecb-reference-hero-image" style={{ objectFit: arena?.matches_arena_image_fit || "cover", objectPosition: arena?.matches_arena_image_position || "center" }} />}<div className="ecb-reference-hero-shade" /><div className="ecb-reference-hero-copy"><p>FEATURED COMPETITION</p><h1 className="sr-only">Featured E-Football match</h1><span>Real-time odds, quick picks,<br />epic matches and instant staking.</span></div><div className="ecb-reference-hero-title"><span>E-FOOTBALL</span><strong>COMPETITION</strong><b>THE ARENA</b></div><div className="ecb-next-match"><small>NEXT BIG MATCH</small><strong>{match.home_team?.name ?? "HOME"} vs {match.away_team?.name ?? "AWAY"}</strong><span>{new Date(match.start_time).toLocaleString()}</span><Button asChild size="sm" className="btn-luxury"><Link to="/matches/$matchId" params={{ matchId: match.id }}>Bet Now <ArrowRight /></Link></Button></div></section>;
}

function TopCompetitors({ rows }: { rows: LbRow[] }) {
  if (!rows.length) return null;
  return <section className="mt-4 grid gap-3 md:grid-cols-[1.2fr_2fr]"><div className="flex items-center gap-3 rounded-md border border-primary/35 bg-card/70 p-4"><span className="grid h-12 w-12 place-items-center rounded-md border border-primary/50 bg-primary/10"><Trophy className="text-primary" /></span><div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Live leaderboard</p><h2 className="text-2xl font-black">Top Competitors</h2></div></div><div className="grid grid-cols-3 gap-2">{rows.map((row, index) => <Link key={row.name} to="/leaderboard" className="flex min-w-0 items-center gap-2 rounded-md border border-primary/25 bg-background/60 p-3 hover:border-primary"><Crown className={index === 0 ? "text-primary" : "text-muted-foreground"} /><div className="min-w-0"><b className="block truncate text-xs">{row.name}</b><span className="text-[10px] text-muted-foreground">#{index + 1} · {row.PTS} pts</span></div></Link>)}</div></section>;
}

function Arena({ matches, loading }: { matches: MatchRow[]; loading: boolean }) {
  const [tab, setTab] = useState<"all" | "live" | "ended">("all");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const categories = Array.from(new Map(matches.filter((match) => match.category).map((match) => [match.category?.id, match.category])).values()).filter((category) => category !== null && category !== undefined);
  const groups = {
    all: matches.filter((match) => match.status === "live" || match.status === "scheduled"),
    live: matches.filter((match) => match.status === "live"),
    ended: matches.filter((match) => match.status === "ended"),
  };
  const shown = groups[tab].filter((match) => {
    const matchesCategory = categoryId === "all" || (categoryId === "uncategorized" ? !match.category_id : match.category_id === categoryId);
    const matchesSearch = `${match.name} ${match.id} ${match.home_team?.name ?? ""} ${match.away_team?.name ?? ""}`.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  // In the "All" view every fixture is presented under its own competition
  // category (with uncategorized fixtures collected at the end) so players can
  // tell at a glance which competition a match belongs to.
  const sections = (() => {
    if (tab !== "all") return [{ id: "flat", title: "", rows: shown }];
    const buckets = new Map<string, { title: string; rows: MatchRow[] }>();
    const loose: MatchRow[] = [];
    for (const match of shown) {
      const category = match.category;
      if (!category) { loose.push(match); continue; }
      const bucket = buckets.get(category.id) ?? { title: `${category.icon ? `${category.icon} ` : ""}${category.name}`, rows: [] };
      bucket.rows.push(match);
      buckets.set(category.id, bucket);
    }
    return [
      ...Array.from(buckets.entries()).map(([id, bucket]) => ({ id, ...bucket })),
      ...(loose.length ? [{ id: "uncategorized", title: "Uncategorized Matches", rows: loose }] : []),
    ];
  })();
  return <section className="ecb-arena"><header className="ecb-arena-header"><div className="ecb-arena-heading"><span><Crosshair /></span><div><small>THE ARENA</small><h2>All Matches <Badge variant="destructive">● LIVE</Badge></h2><p>Browse active fixtures here, with completed fixtures kept separately under Ended.</p></div></div><div className="ecb-arena-search"><Search /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search matches, teams or match ID..." /><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger aria-label="Filter by match category"><SelectValue placeholder="All categories" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.icon ? `${category.icon} ` : ""}{category.name}</SelectItem>)}<SelectItem value="uncategorized">Uncategorized</SelectItem></SelectContent></Select></div></header><div className="ecb-filter-pills">{(["all", "live", "ended"] as const).map((key) => <Button key={key} size="sm" variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)}>{key.toUpperCase()} ({groups[key].length})</Button>)}</div><div className="ecb-arena-tabs">{(["all", "live", "ended"] as const).map((key) => <button key={key} onClick={() => setTab(key)} className={tab === key ? "active" : ""}>{key[0].toUpperCase() + key.slice(1)} ({groups[key].length})</button>)}</div><div className="ecb-arena-grid"><div className="ecb-match-list"><div className="ecb-odds-head"><span>Competition / Match</span><b>1</b><b>X</b><b>2</b></div>{loading ? <p className="p-6 text-muted-foreground">Loading matches…</p> : shown.length ? sections.map((section) => <div key={section.id}>{section.title && <div className="flex items-center justify-between gap-2 border-y border-primary/25 bg-primary/5 px-3 py-2"><b className="truncate text-[11px] font-black uppercase tracking-[0.2em] text-primary">{section.title}</b><span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">{section.rows.length} match{section.rows.length === 1 ? "" : "es"}</span></div>}{section.rows.map((match) => <ArenaMatchRow key={match.id} match={match} />)}</div>) : <p className="p-6 text-muted-foreground">No matches in this category.</p>}<Button variant="outline" className="ecb-load-more" onClick={() => { setTab("all"); setCategoryId("all"); setSearch(""); }}><RefreshCw /> View All Active Matches</Button></div><aside className="ecb-home-rail"><InlineBetSlip /><PopularMarkets /></aside></div></section>;
}

function InlineBetSlip() {
  const { selections, remove, clear, totalOdds, setOpen } = useBetSlip();
  return <Card className="ecb-rail-card"><div className="ecb-rail-title"><b>BET SLIP <Badge>{selections.length}</Badge></b><button onClick={clear}>Clear All</button></div>{selections.length ? selections.slice(0, 3).map((selection) => <div key={selection.odd_id} className="ecb-slip-pick"><Ticket /><span><b>{selection.selection_label}</b><small>{selection.match_name}</small></span><strong>{selection.odds.toFixed(2)}</strong><button aria-label={`Remove ${selection.selection_label}`} onClick={() => remove(selection.odd_id)}><X /></button></div>) : <p className="py-6 text-center text-xs text-muted-foreground">Choose odds to build your bet slip.</p>}<div className="ecb-slip-total"><span>Total Odds <b>{totalOdds.toFixed(2)}</b></span><span>Potential Win <strong>₦{(totalOdds * 5000).toLocaleString()}</strong></span></div><Button className="btn-luxury w-full" onClick={() => setOpen(true)}>Place Bet <ArrowRight /></Button></Card>;
}

function PopularMarkets() {
  return <Card className="ecb-rail-card"><div className="ecb-rail-title"><b>POPULAR MARKETS</b></div>{["Match Winner", "Total Goals", "Both Teams to Score", "Correct Score"].map((name) => <div key={name} className="ecb-market-link"><Target /><span>{name}</span><ChevronRight /></div>)}</Card>;
}

function Stats({ matches }: { matches: MatchRow[] }) {
  const stats = [{ icon: Crosshair, value: matches.filter((m) => m.status === "live").length, label: "LIVE MATCHES" }, { icon: Calendar, value: matches.filter((m) => m.status === "scheduled").length, label: "UPCOMING FIXTURES" }, { icon: Target, value: "98.6%", label: "PAYOUT RATE" }, { icon: Headphones, value: "24/7", label: "SUPPORT" }];
  return <section className="ecb-stats-strip">{stats.map((stat) => <div key={stat.label}><span><stat.icon /></span><b>{stat.value}<small>{stat.label}</small></b></div>)}<div className="ecb-refer"><Gift /><span><b>REFER &amp; EARN</b><small>Invite friends and earn rewards</small></span><Button asChild size="sm" className="btn-luxury"><Link to="/referrals">Invite Now</Link></Button></div></section>;
}
