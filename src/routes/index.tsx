import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MatchCardLive } from "@/components/MatchCardLive";
import { EventBanner } from "@/components/EventBanner";
import { AnnouncementSlider, HighlightsRow, AdsRow } from "@/components/HomeContent";
import { HomeBannerSlider } from "@/components/HomeBannerSlider";
import { HomeQuickMenu } from "@/components/HomeQuickMenu";
import { GrandPrizeWinners } from "@/components/GrandPrizeWinners";
import { HotBets } from "@/components/HotBets";
import { NewsSlider } from "@/components/NewsSlider";
import { LotteryResultsCard } from "@/components/LotteryResultsCard";
import { SeasonBanner } from "@/components/SeasonBanner";
import { Spotlight } from "@/components/Spotlight";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { Crosshair, Flame, Trophy, ChevronRight, Coins, Ticket as TicketIcon, ClipboardPaste, X, Dice5 } from "lucide-react";
import { Countdown } from "@/components/Countdown";
import { TeamLogo } from "@/components/TeamLogo";
import hero from "@/assets/hero.jpg";
import { fetchMatches, fetchSettings, type MatchRow } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { toast } from "sonner";
import { DraggableFab } from "@/components/DraggableFab";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lomita Shooters League — Virtual Token Shooting League" },
      { name: "description", content: "Live matches, gang leaderboards and virtual-token wagering for the Lomita Shooters League." },
      { property: "og:title", content: "Lomita Shooters League" },
      { property: "og:description", content: "Follow live shooting matches, back your gang with virtual tokens, and climb the seasonal leaderboard." },
      { property: "og:url", content: "https://lslonlinebetting.lovable.app/" },
      { property: "og:image", content: hero },
      { name: "twitter:title", content: "Lomita Shooters League" },
      { name: "twitter:description", content: "Follow live shooting matches, back your gang with virtual tokens, and climb the seasonal leaderboard." },
    ],
    links: [
      { rel: "canonical", href: "https://lslonlinebetting.lovable.app/" },
      { rel: "preload", as: "image", href: hero, fetchpriority: "high" },
    ],
  }),
  component: Index,
});

function Index() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchMatches(), fetchSettings()]).then(([m, s]) => { setMatches(m); setSettings(s); }).finally(() => setLoading(false));
    // Debounce refetches so a burst of realtime row changes (odds/markets
    // updating together) only triggers one network round-trip, not dozens.
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

  const futures = matches.filter((m) => m.match_kind === "future" && m.status === "scheduled");
  const normalMatches = matches.filter((m) => m.match_kind !== "future");
  const live = normalMatches.filter((m) => m.status === "live");
  const upcoming = normalMatches.filter((m) => m.status === "scheduled");
  const featuredAll = matches.filter((m) => m.is_featured && m.status !== "ended");
  const featuredFallback = featuredAll.length === 0 && upcoming[0] ? [upcoming[0]] : featuredAll;

  // Group upcoming by category for the category sections
  const byCategory: Record<string, { name: string; icon: string | null; items: MatchRow[] }> = {};
  for (const m of [...live, ...upcoming]) {
    const cat = m.category;
    if (!cat) continue;
    if (!byCategory[cat.id]) byCategory[cat.id] = { name: cat.name, icon: cat.icon, items: [] };
    byCategory[cat.id].items.push(m);
  }
  const categoryGroups = Object.entries(byCategory);
  const tagline = settings?.hero_tagline || "Season 4 · Live";

  return (
    <Layout>
      <section className="container mt-4">
        <div className="flex items-stretch gap-2 sm:gap-3">
          <div className="min-w-0 flex-1"><HomeBannerSlider embedded /></div>
          <HomeQuickMenu />
        </div>
      </section>
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
        <div className="container relative py-20 md:py-32">
          {settings?.site_logo_url && (
            <img
              src={settings.site_logo_url}
              alt={settings?.site_name || "Platform logo"}
              className="mb-6 h-20 md:h-28 w-auto object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)]"
            />
          )}
          <Badge variant="outline" className="border-primary/50 text-primary mb-4">
            <Flame className="h-3 w-3 mr-1" /> {tagline}
          </Badge>
          {settings?.hero_title ? (
            <h1 className="text-4xl md:text-7xl font-bold leading-tight max-w-3xl uppercase gradient-gold-text">
              {settings.hero_title}
            </h1>
          ) : (
            <h1 className="text-4xl md:text-7xl font-bold leading-tight max-w-3xl uppercase">
              Where gangs clash and{" "}
              <span className="gradient-gold-text">legends</span> are{" "}
              <span className="gradient-emerald-text">gold-plated</span>.
            </h1>
          )}
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            {settings?.hero_subtitle || "The Lomita Shooters League is a virtual-token competitive shooting circuit. Pick your gang, place your wagers, and climb the leaderboard."}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/matches"><Button size="lg" className="btn-luxury">View Matches <ChevronRight className="h-4 w-4 ml-1" /></Button></Link>
            <Link to="/leaderboard"><Button size="lg" variant="outline" className="border-primary/40">Leaderboard</Button></Link>
            <Link to="/checkout"><Button size="lg" variant="outline" className="border-accent/40 text-accent"><Coins className="h-4 w-4 mr-1" />Buy Tokens</Button></Link>
          </div>
        </div>
      </section>

      <EventBanner />
      <SeasonBanner />
      <Spotlight />

      {/* Highlights → Announcements → Ads → Matches */}
      <HighlightsRow />
      <AnnouncementSlider />
      <AdsRow />
      {futures.length > 0 && (
        <FuturesSection title={settings?.futures_section_title || "TOURNAMENT FUTURES"} markets={futures} maxSelections={Number(settings?.futures_max_selections ?? 1)} featured={featuredAll} />
      )}

      <BookingCodeFab />

      {/* Match feed on the left · Hot Bets + Hall of Fame stacked on the right.
          The two-column layout kicks in from ~560px so phones in desktop mode
          keep the sidebar (Hot Bets + Hall of Fame) on the right, scaled small. */}
      <section className="container mt-6">
        <div className="grid gap-3 min-[560px]:gap-5 min-[560px]:grid-cols-[minmax(0,1fr)_minmax(0,200px)] lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] items-start">
          <div className="space-y-10 min-w-0">
          {loading && <p className="text-muted-foreground">Loading league…</p>}
          {!loading && featuredFallback.length > 0 && (
            <div>
              <SectionHeader icon={Trophy} title="Featured Matches" subtitle="The biggest matchups of the round." />
              <div className="mt-4">
                <Carousel opts={{ loop: featuredFallback.length > 1 }} plugins={featuredFallback.length > 1 ? [Autoplay({ delay: 5000, stopOnInteraction: false })] : []}>
                  <CarouselContent>
                    {featuredFallback.map((m) => {
                      const bg = futures.length === 0 ? m.featured_image_url : null;
                      return (
                        <CarouselItem key={m.id}>
                          {bg ? (
                            <div className="relative overflow-hidden rounded-3xl border border-primary/25 shadow-gold">
                              <img
                                src={bg}
                                alt=""
                                className="absolute inset-0 h-full w-full"
                                style={{ objectFit: (m.featured_image_fit as any) || "cover", objectPosition: m.featured_image_position || "center" }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/35 to-background/70" />
                              <div className="relative p-4 md:p-6"><MatchCardLive match={m} /></div>
                            </div>
                          ) : (
                            <MatchCardLive match={m} />
                          )}
                        </CarouselItem>
                      );
                    })}
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
              <div className="space-y-2 mt-4">
                {upcoming.slice(0, 6).map((m) => <MatchCardLive key={m.id} match={m} variant="row" />)}
              </div>
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
            <div>
              <SectionHeader icon={Flame} title="Hot Bets" subtitle="What the league is backing right now." />
              <div className="mt-3"><HotBets /></div>
            </div>
            <div>
              <SectionHeader icon={Dice5} title="Lottery Results" subtitle="Latest lucky numbers — auto-drawn every 30 min." />
              <div className="mt-3"><LotteryResultsCard /></div>
            </div>
            <div>
              <SectionHeader icon={Trophy} title="Hall of Fame" subtitle="Grand prize winners — most tokens won." />
              <div className="mt-3"><GrandPrizeWinners /></div>
            </div>
          </aside>
        </div>
      </section>

    </Layout>
  );
}

function FuturesSection({ title, markets, maxSelections, featured = [] }: { title: string; markets: MatchRow[]; maxSelections: number; featured?: MatchRow[] }) {
  const { selections, add, remove, setOpen } = useBetSlip();
  return (
    <section className="container mt-10">
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
                  // Lost contenders stay bookable — only a disqualified (or fully settled) outcome blocks a pick.
                  const blocked = !market?.is_open || future.status !== "scheduled" || ["disqualified", "settled"].includes(status);
                  return (
                    <button
                      key={odd.id}
                      onClick={() => {
                        if (selected) remove(odd.id);
                        else {
                          if (blocked) return;
                          if (selections.filter((s) => s.is_future).length >= maxSelections) { toast.error(`This market allows up to ${maxSelections} futures selection${maxSelections === 1 ? "" : "s"}.`); return; }
                          add({ match_id: future.id, match_name: future.name, market_id: market.id, market_name: market.name, odd_id: odd.id, selection_label: odd.label, odds: Number(odd.value), is_future: true });          )}
          <Badge variant="outline" className="border-primary/50 text-primary mb-4">
            <Flame className="h-3 w-3 mr-1" /> {tagline}
          </Badge>
          {settings?.hero_title ? (
            <h1 className="text-4xl md:text-7xl font-bold leading-tight max-w-3xl uppercase gradient-gold-text">
              {settings.hero_title}
            </h1>
          ) : (
            <h1 className="text-4xl md:text-7xl font-bold leading-tight max-w-3xl uppercase">
              Where gangs clash and{" "}
              <span className="gradient-gold-text">legends</span> are{" "}
              <span className="gradient-emerald-text">gold-plated</span>.
            </h1>
          )}
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            {settings?.hero_subtitle || "The Lomita Shooters League is a virtual-token competitive shooting circuit. Pick your gang, place your wagers, and climb the leaderboard."}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/matches"><Button size="lg" className="btn-luxury">View Matches <ChevronRight className="h-4 w-4 ml-1" /></Button></Link>
            <Link to="/leaderboard"><Button size="lg" variant="outline" className="border-primary/40">Leaderboard</Button></Link>
            <Link to="/checkout"><Button size="lg" variant="outline" className="border-accent/40 text-accent"><Coins className="h-4 w-4 mr-1" />Buy Tokens</Button></Link>
          </div>
        </div>
      </section>

      <EventBanner />
      <SeasonBanner />
      <Spotlight />

      {/* Highlights → Announcements → Ads → Matches */}
      <HighlightsRow />
      <AnnouncementSlider />
      <AdsRow />
      {futures.length > 0 && (
        <FuturesSection title={settings?.futures_section_title || "TOURNAMENT FUTURES"} markets={futures} maxSelections={Number(settings?.futures_max_selections ?? 1)} featured={featuredAll} />
      )}

      <BookingCodeFab />

      {/* Match feed on the left · Hot Bets + Hall of Fame stacked on the right.
          The two-column layout kicks in from ~560px so phones in desktop mode
          keep the sidebar (Hot Bets + Hall of Fame) on the right, scaled small. */}
      <section className="container mt-6">
        <div className="grid gap-3 min-[560px]:gap-5 min-[560px]:grid-cols-[minmax(0,1fr)_minmax(0,200px)] lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] items-start">
          <div className="space-y-10 min-w-0">
          {loading && <p className="text-muted-foreground">Loading league…</p>}
          {!loading && featuredFallback.length > 0 && (
            <div>
              <SectionHeader icon={Trophy} title="Featured Matches" subtitle="The biggest matchups of the round." />
              <div className="mt-4">
                <Carousel opts={{ loop: featuredFallback.length > 1 }} plugins={featuredFallback.length > 1 ? [Autoplay({ delay: 5000, stopOnInteraction: false })] : []}>
                  <CarouselContent>
                    {featuredFallback.map((m) => {
                      const bg = futures.length === 0 ? m.featured_image_url : null;
                      return (
                        <CarouselItem key={m.id}>
                          {bg ? (
                            <div className="relative overflow-hidden rounded-3xl border border-primary/25 shadow-gold">
                              <img
                                src={bg}
                                alt=""
                                className="absolute inset-0 h-full w-full"
                                style={{ objectFit: (m.featured_image_fit as any) || "cover", objectPosition: m.featured_image_position || "center" }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/35 to-background/70" />
                              <div className="relative p-4 md:p-6"><MatchCardLive match={m} /></div>
                            </div>
                          ) : (
                            <MatchCardLive match={m} />
                          )}
                        </CarouselItem>
                      );
                    })}
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
              <div className="space-y-2 mt-4">
                {upcoming.slice(0, 6).map((m) => <MatchCardLive key={m.id} match={m} variant="row" />)}
              </div>
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
            <div>
              <SectionHeader icon={Flame} title="Hot Bets" subtitle="What the league is backing right now." />
              <div className="mt-3"><HotBets /></div>
            </div>
            <div>
              <SectionHeader icon={Dice5} title="Lottery Results" subtitle="Latest lucky numbers — auto-drawn every 30 min." />
              <div className="mt-3"><LotteryResultsCard /></div>
            </div>
            <div>
              <SectionHeader icon={Trophy} title="Hall of Fame" subtitle="Grand prize winners — most tokens won." />
              <div className="mt-3"><GrandPrizeWinners /></div>
            </div>
          </aside>
        </div>
      </section>

    </Layout>
  );
}

function FuturesSection({ title, markets, maxSelections, featured = [] }: { title: string; markets: MatchRow[]; maxSelections: number; featured?: MatchRow[] }) {
  const { selections, add, remove, setOpen } = useBetSlip();
  return (
    <section className="container mt-10">
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
                  // Lost contenders stay bookable — only a disqualified (or fully settled) outcome blocks a pick.
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
