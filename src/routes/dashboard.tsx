import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Ticket as TicketIcon, ChevronRight, Wallet, UserCog, Coins, Tag, Trophy, ListChecks, ClipboardCheck,
  Sparkles, Lock, ArrowLeftRight, Gift, Receipt, Crown, Calendar, Plus, Activity,
  XCircle, Clock, FileText, PieChart, Bell, LifeBuoy, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { ChallengesPanel } from "@/components/ChallengesPanel";
import { ReferralCard } from "@/components/UserHubSections";
import { getTierProgress } from "@/lib/tiers";
import { TourGuide, type TourStep } from "@/components/TourGuide";

const DASHBOARD_TOUR: TourStep[] = [
  { target: "[data-tour='top-navigation']", title: "Platform Navigation", description: "Top navigation — move directly between Matches, Virtual, Lottery, Wagers, Support, Settings, and the other platform areas.", placement: "bottom" },
  { target: "[data-tour='dashboard-welcome']", title: "Account Summary", description: "Welcome panel — review your profile image, membership tier, member date, and progress toward your next XP tier." },
  { target: "[data-tour='dashboard-balance']", title: "Balance & Active Stakes", description: "Account summary — see your current token balance, active bets, total bet count, and use Add Funds when you need more tokens.", placement: "left" },
  { target: "[data-tour='dashboard-quick']", title: "Quick Access", description: "Quick Access — open your bet slips, edit your profile, withdraw, transfer tokens, request tokens, and reach frequently used account tools." },
  { target: "[data-tour='dashboard-transactions-link']", title: "Transaction Records", description: "Transaction Records — open the complete history of token credits, debits, deposits, stakes, rewards, and transfers." },
  { target: "[data-tour='dashboard-referrals-link']", title: "Referrals", description: "Invite Now — share your referral details and track the rewards earned when new competitors join through you." },
  { target: "[data-tour='dashboard-rewards-link']", title: "Rewards & Achievements", description: "Achievements — review badges and milestones you have unlocked through matches, activity, and platform challenges." },
  { target: "[data-tour='dashboard-support-link']", title: "Support Center", description: "Help Center — create and follow support tickets when you need account, payment, match, or betting assistance." },
  { target: "[data-tour='dashboard-activity']", title: "Activity Overview", description: "Activity Overview — compare active, won, lost, pending, and total bets alongside your current win rate." },
  { target: "[data-tour='dashboard-challenges']", title: "Challenges & Streaks", description: "Challenges — monitor challenge progress, daily streak goals, and claimable rewards tied to your activity." },
  { target: "[data-tour='dashboard-wallet']", title: "Wallet", description: "Wallet Overview — check your main token balance and jump directly to funding, withdrawal, or full wallet history." },
  { target: "[data-tour='dashboard-recent']", title: "Recent Transactions", description: "Recent Transactions — inspect your five latest balance movements, including the amount, reason, and exact time." },
];

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your Dashboard — E-Football Competition Bet" },
      { name: "description", content: "Manage your bet slips, token balance, withdrawals, promo codes, achievements, and account settings in one place." },
      { property: "og:title", content: "Your Dashboard — E-Football Competition Bet" },
      { property: "og:description", content: "Manage your bet slips, balance, withdrawals, and achievements at ECB." },
      { property: "og:url", content: "https://lslonlinebetting.lovable.app/dashboard" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://lslonlinebetting.lovable.app/dashboard" }],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, profile, roles, refresh } = useAuth();
  const [bets, setBets] = useState<any[]>([]);
  const [promoOpen, setPromoOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const isSponsor = roles?.includes("sponsor") || roles?.includes("admin");
  useEffect(() => {
    if (!user) return;
    const load = () => supabase.from("bets")
      .select("*, bet_selections(*, matches!match_id(name))")
      .eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setBets(data ?? []));
    load();
    const ch = supabase.channel(`my-bets-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bets", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  if (!user) return <Layout><div className="container mx-auto px-4 py-16 text-center"><p>Please <Link to="/login" className="text-primary underline">sign in</Link>.</p></div></Layout>;

  const firstName = profile?.full_name?.split(" ")[0] ?? "Shooter";
  const wins = bets.filter((b) => b.status === "won").length;
  const losses = bets.filter((b) => b.status === "lost").length;
  const active = bets.filter((b) => b.status === "open").length;
  const settled = wins + losses;
  const winRate = settled > 0 ? Math.round((wins / settled) * 100) : 0;
  const tier = (profile?.vip_tier ?? "bronze") as string;
  const xp = Number((profile as any)?.xp ?? 0);
  const { meta: tierMeta, nextMeta, gained, span, percent } = getTierProgress(tier, xp);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* ============ WELCOME HERO ============ */}
        <Card data-tour="dashboard-welcome"
          className="relative overflow-hidden bg-gradient-to-br from-card/80 via-card/70 to-background p-0"
          style={{ borderColor: `${tierMeta.accent}66` }}
        >
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl" style={{ background: `${tierMeta.accent}33` }} />
          <div className="relative grid gap-5 p-5 md:grid-cols-[1fr_320px] md:p-7">
            <div className="flex items-center gap-5">
              <div
                className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 bg-black/40 grid place-items-center md:h-32 md:w-32"
                style={{ borderColor: tierMeta.accent, boxShadow: `0 0 28px -6px ${tierMeta.accent}` }}
              >
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt={firstName} className="h-full w-full object-contain" />
                  : <span className="text-3xl font-black" style={{ color: tierMeta.accent }}>{firstName.slice(0, 2).toUpperCase()}</span>}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Welcome back,</p>
                <h1 className={`mt-1 truncate bg-gradient-to-r ${tierMeta.color} bg-clip-text text-4xl font-extrabold uppercase text-transparent md:text-6xl`}>{firstName}</h1>
                <div
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide"
                  style={{ borderColor: `${tierMeta.accent}99`, background: `${tierMeta.accent}22`, color: tierMeta.accent }}
                >
                  <Crown className="h-3.5 w-3.5" /> {tierMeta.label} member
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" style={{ color: tierMeta.accent }} /> Member since {new Date((profile as any)?.created_at ?? user.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </div>

                {/* ===== TIER RANK-UP PROGRESS ===== */}
                <div className="mt-3 max-w-sm">
                  <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                    <span style={{ color: tierMeta.accent }}>{tierMeta.label}</span>
                    <span className="text-muted-foreground">{nextMeta ? nextMeta.label : "Max tier"}</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full border border-white/10 bg-black/50">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.max(4, percent)}%`,
                        background: `linear-gradient(90deg, ${tierMeta.accent}, ${nextMeta?.accent ?? tierMeta.accent})`,
                        boxShadow: `0 0 14px -2px ${tierMeta.accent}`,
                      }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="font-bold" style={{ color: tierMeta.accent }}>
                      {gained.toLocaleString()} / {(span || gained).toLocaleString()} XP
                    </span>
                    <span className="text-muted-foreground">{percent}%</span>
                  </div>
                </div>
              </div>
            </div>
            <div data-tour="dashboard-balance" className="rounded-2xl border bg-background/50 p-4 backdrop-blur-xl space-y-3" style={{ borderColor: `${tierMeta.accent}44` }}>
              <HeroStat icon={Coins} label="Token Balance" value={profile?.token_balance?.toLocaleString() ?? "0"} gold />
              <HeroStat icon={TicketIcon} label="Active Bets" value={String(active)} />
              <HeroStat icon={FileText} label="Total Bets" value={String(bets.length)} />
              <Link to="/checkout" className="block">
                <Button className="btn-luxury w-full font-black">Add Funds <Plus className="ml-1 h-4 w-4" /></Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* ============ QUICK ACCESS ============ */}
        <section data-tour="dashboard-quick">
          <h2 className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" /> Quick Access</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <PanelCard to="/bet-history" icon={TicketIcon} title="Bet Slips" subtitle={`${bets.length} total`} />
            <PanelCard to="/profile" icon={UserCog} title="Edit Profile" subtitle="Update details" />
            <PanelCard to="/withdraw" icon={Wallet} title="Withdraw" subtitle="Cash out tokens" />
            <PanelCard onClick={() => setTransferOpen(true)} icon={ArrowLeftRight} title="Transfer Tokens" subtitle="Send to user ID" />
            <PanelCard to="/checkout" icon={Coins} title="Request Tokens" subtitle="Top up balance" />
            {isSponsor && <PanelCard onClick={() => setPromoOpen(true)} icon={Tag} title="Promo Codes" subtitle="Sponsor only" gold />}
            <div data-tour="dashboard-transactions-link"><PanelCard to="/transactions" icon={Receipt} title="Transaction Records" subtitle="Credits & debits" /></div>
            <div data-tour="dashboard-referrals-link"><PanelCard to="/referrals" icon={Gift} title="Invite Now" subtitle="Refer & earn" gold /></div>
            <div data-tour="dashboard-rewards-link"><PanelCard to="/achievements" icon={Trophy} title="Achievements" subtitle="Your badges" /></div>
            <PanelCard to="/tasks" icon={ClipboardCheck} title="Task" subtitle="Admin assigned" />
            <PanelCard to="/quests" icon={ListChecks} title="Quest" subtitle="Earn tokens" />
            <div data-tour="dashboard-support-link"><PanelCard to="/support" icon={LifeBuoy} title="Help Center" subtitle="Get support" /></div>
          </div>
        </section>

        {/* ============ ACTIVITY OVERVIEW ============ */}
        <Card data-tour="dashboard-activity" className="border-primary/20 bg-card/60 p-5 backdrop-blur-xl">
          <h2 className="mb-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">Activity Overview</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <ActivityStat icon={Activity} label="Active" value={String(active)} tone="text-emerald-300" />
            <ActivityStat icon={Trophy} label="Wins" value={String(wins)} tone="text-primary" />
            <ActivityStat icon={XCircle} label="Losses" value={String(losses)} tone="text-destructive" />
            <ActivityStat icon={Clock} label="Pending" value={String(bets.filter((b) => b.status === "pending").length)} tone="text-amber-300" />
            <ActivityStat icon={FileText} label="Total" value={String(bets.length)} tone="text-sky-300" />
            <ActivityStat icon={PieChart} label="Win Rate" value={`${winRate}%`} tone="text-violet-300" />
          </div>
        </Card>

        {/* ============ CHALLENGES ============ */}
        <div data-tour="dashboard-challenges" className="grid gap-4 items-start">
          <ChallengesPanel />
        </div>

        {/* ============ WALLET · TRANSACTIONS · REFERRALS ============ */}
        <div className="grid gap-4 lg:grid-cols-3 items-start">
          <div data-tour="dashboard-wallet"><WalletOverview balance={profile?.token_balance ?? 0} /></div>
          <div data-tour="dashboard-recent"><RecentTransactions userId={user.id} /></div>
          <ReferralCard />
        </div>

        {/* ============ GIFTS · SPIN ============ */}
        <div className="grid gap-4 items-start">
          <GiftsAndSpin onClaimed={refresh} />
        </div>
      </div>
      <PromoRequestDialog open={promoOpen} onClose={() => setPromoOpen(false)} userId={user.id} />
      <TransferDialog open={transferOpen} onClose={() => setTransferOpen(false)} onDone={refresh} />
      <TourGuide tourKey="dashboard" steps={DASHBOARD_TOUR} />
    </Layout>
  );
}

function HeroStat({ icon: Icon, label, value, gold }: { icon: any; label: string; value: string; gold?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${gold ? "bg-gradient-to-br from-primary/35 to-primary/10" : "bg-gradient-to-br from-accent/25 to-primary/10"}`}>
        <Icon className={`h-5 w-5 ${gold ? "text-primary" : "text-accent"}`} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className={`truncate text-xl font-extrabold ${gold ? "gradient-gold-text" : "text-foreground"}`}>{value}</div>
      </div>
    </div>
  );
}

function ActivityStat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/15 bg-background/40 p-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-card/80 border border-primary/15">
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">{label}</div>
        <div className={`text-xl font-extrabold ${tone}`}>{value}</div>
      </div>
    </div>
  );
}

function WalletOverview({ balance }: { balance: number }) {
  return (
    <Card className="border-primary/25 bg-card/60 p-5 backdrop-blur-xl">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Wallet className="h-4 w-4 text-primary" /> Wallet Overview</h2>
      <div className="rounded-xl border border-primary/20 bg-background/40 p-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Main balance</div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="text-2xl font-extrabold gradient-gold-text">{balance.toLocaleString()}</div>
          <Link to="/checkout"><Button size="sm" className="btn-luxury">Add Funds</Button></Link>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Link to="/withdraw" className="rounded-xl border border-primary/20 bg-background/40 p-3 hover:border-primary/50 transition">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Withdraw</div>
          <div className="text-sm font-bold">Cash out</div>
        </Link>
        <Link to="/transactions" className="rounded-xl border border-primary/20 bg-background/40 p-3 hover:border-primary/50 transition">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">History</div>
          <div className="text-sm font-bold">All records</div>
        </Link>
      </div>
    </Card>
  );
}

function RecentTransactions({ userId }: { userId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (supabase as any).from("token_transactions").select("*").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(5)
      .then(({ data }: any) => setRows(data ?? []));
  }, [userId]);
  return (
    <Card className="border-primary/25 bg-card/60 p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Receipt className="h-4 w-4 text-primary" /> Recent Transactions</h2>
        <Link to="/transactions" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary">View All</Link>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No transactions yet.</p>}
      <div className="space-y-2">
        {rows.map((t) => {
          const credit = Number(t.amount) >= 0;
          return (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border border-primary/15 bg-background/40 p-2.5">
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${credit ? "bg-emerald-500/15" : "bg-destructive/15"}`}>
                {credit ? <ArrowDownRight className="h-4 w-4 text-emerald-300" /> : <ArrowUpRight className="h-4 w-4 text-destructive" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold capitalize">{t.description || String(t.kind ?? "").replace(/_/g, " ")}</div>
                <div className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
              </div>
              <div className={`shrink-0 text-xs font-extrabold ${credit ? "text-emerald-300" : "text-destructive"}`}>
                {credit ? "+" : "-"}{Math.abs(Number(t.amount)).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function RecentNotifications({ userId }: { userId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("notifications").select("*").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(5)
      .then(({ data }) => setRows(data ?? []));
  }, [userId]);
  return (
    <Card className="border-primary/25 bg-card/60 p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Bell className="h-4 w-4 text-primary" /> Notifications</h2>
        <Link to="/notifications" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary">View All</Link>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing new right now.</p>}
      <div className="space-y-2">
        {rows.map((n) => (
          <div key={n.id} className="flex items-start gap-3 rounded-lg border border-primary/15 bg-background/40 p-2.5">
            <Bell className={`mt-0.5 h-4 w-4 shrink-0 ${n.is_read ? "text-muted-foreground" : "text-primary"}`} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold">{n.title}</div>
              {n.body && <div className="truncate text-[11px] text-muted-foreground">{n.body}</div>}
            </div>
            <div className="shrink-0 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function GiftsAndSpin({ onClaimed }: { onClaimed: () => void }) {
  const { user } = useAuth();
  const [gifts, setGifts] = useState<any[]>([]);
  const [spinCfg, setSpinCfg] = useState<{ enabled: boolean; cooldown: number; min: number; max: number } | null>(null);
  const [lastSpin, setLastSpin] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);

  const loadGifts = () => {
    if (!user) return;
    (supabase as any).from("user_gifts").select("*").eq("user_id", user.id).eq("status", "pending").order("created_at", { ascending: false })
      .then(({ data }: any) => setGifts(data ?? []));
  };
  const loadSpin = () => {
    if (!user) return;
    supabase.from("app_settings").select("spin_enabled,spin_cooldown_hours,spin_min_reward,spin_max_reward").eq("id", 1).maybeSingle()
      .then(({ data }: any) => { if (data) setSpinCfg({ enabled: !!data.spin_enabled, cooldown: Number(data.spin_cooldown_hours ?? 24), min: Number(data.spin_min_reward ?? 0), max: Number(data.spin_max_reward ?? 0) }); });
    (supabase as any).from("spins").select("created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1)
      .then(({ data }: any) => setLastSpin(data?.[0]?.created_at ?? null));
  };

  useEffect(() => {
    if (!user) return;
    loadGifts(); loadSpin();
    const ch = supabase.channel(`my-gifts-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_gifts", filter: `user_id=eq.${user.id}` }, loadGifts)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  async function claim(id: string) {
    setClaiming(id);
    const { data, error } = await (supabase.rpc as any)("claim_gift", { _gift_id: id });
    setClaiming(null);
    if (error) return toast.error(error.message);
    toast.success(`Claimed ${Number(data?.amount ?? 0).toLocaleString()} tokens! 🎁`);
    loadGifts(); onClaimed();
  }

  const cooldownLeft = (() => {
    if (!spinCfg || !lastSpin) return 0;
    const next = new Date(lastSpin).getTime() + spinCfg.cooldown * 3600_000;
    return Math.max(0, next - Date.now());
  })();
  const canSpin = !!spinCfg?.enabled && cooldownLeft === 0;

  async function spin() {
    setSpinning(true);
    const { data, error } = await (supabase.rpc as any)("spin_wheel");
    setSpinning(false);
    if (error) return toast.error(error.message);
    toast.success(`You won ${Number(data?.reward ?? 0).toLocaleString()} tokens! 🎉`);
    loadSpin(); onClaimed();
  }

  const fmtLeft = (ms: number) => {
    const h = Math.floor(ms / 3600_000), m = Math.floor((ms % 3600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <>
      {/* Gifts */}
      <Card className="p-5 border-primary/20">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-3"><Gift className="h-5 w-5 text-primary" />Your Gifts</h2>
        {gifts.length === 0 && <p className="text-sm text-muted-foreground">No gifts to claim right now.</p>}
        <div className="space-y-2">
          {gifts.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-card/60 p-3">
              <div className="min-w-0">
                <div className="font-bold text-primary">{Number(g.amount).toLocaleString()} tokens</div>
                {g.message && <div className="text-[11px] text-muted-foreground truncate">{g.message}</div>}
              </div>
              <Button size="sm" className="btn-luxury" disabled={claiming === g.id} onClick={() => claim(g.id)}>{claiming === g.id ? "…" : "Claim"}</Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Lucky Spin */}
      <Card className="relative overflow-hidden p-5 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-3"><Sparkles className="h-5 w-5 text-amber-300" />Lucky Spin</h2>
        {!spinCfg?.enabled ? (
          <p className="text-sm text-muted-foreground">The lucky spin is currently disabled. Check back soon!</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">Spin to win between <span className="text-amber-300 font-semibold">{spinCfg.min.toLocaleString()}</span> and <span className="text-amber-300 font-semibold">{spinCfg.max.toLocaleString()}</span> tokens.</p>
            <Button onClick={spin} disabled={!canSpin || spinning} className="btn-luxury w-full">
              {spinning ? "Spinning…" : canSpin ? "🎰 Spin now" : `Next spin in ${fmtLeft(cooldownLeft)}`}
            </Button>
          </>
        )}
      </Card>
    </>
  );
}

function PanelCard({ to, onClick, icon: Icon, title, subtitle, comingSoon, gold }: any) {
  const inner = (
    <Card className={`relative h-full overflow-hidden p-4 text-center backdrop-blur-xl bg-card/60 border ${gold ? "border-amber-500/40" : "border-primary/20"} hover:border-primary/60 transition group ${comingSoon ? "opacity-70" : "hover:-translate-y-0.5"} cursor-${comingSoon ? "not-allowed" : "pointer"}`}>
      <div className={`mx-auto h-11 w-11 rounded-xl grid place-items-center mb-2.5 ${gold ? "bg-gradient-to-br from-amber-400/30 to-amber-600/20" : "bg-gradient-to-br from-primary/30 to-accent/20"}`}>
        <Icon className={`h-5 w-5 ${gold ? "text-amber-300" : "text-primary"}`} />
      </div>
      <div className="font-bold text-sm flex items-center justify-center gap-1.5">{title}{comingSoon && <Lock className="h-3 w-3 text-muted-foreground" />}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>
      {gold && <Sparkles className="absolute top-3 right-3 h-3 w-3 text-amber-300 animate-pulse" />}
    </Card>
  );
  if (comingSoon) return <div>{inner}</div>;
  if (to && to.startsWith("#")) return <a href={to} className="block h-full">{inner}</a>;
  if (to) return <Link to={to} className="block h-full">{inner}</Link>;
  return <button type="button" onClick={onClick} className="block h-full w-full text-left">{inner}</button>;
}

function TransferDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [specialId, setSpecialId] = useState("");
  const [amount, setAmount] = useState(1_000_000);
  const [recipient, setRecipient] = useState<{ full_name: string; special_id: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function lookup() {
    const id = specialId.trim();
    if (!id) return toast.error("Enter a Special ID");
    setChecking(true);
    const { data, error } = await (supabase.rpc as any)("resolve_special_id", { _special_id: id });
    setChecking(false);
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) { setRecipient(null); return toast.error("No user found with that Special ID"); }
    setRecipient({ full_name: row.full_name, special_id: row.special_id });
  }

  async function submit() {
    if (!recipient) return toast.error("Confirm the recipient first");
    if (amount <= 0) return toast.error("Enter a valid amount");
    setSubmitting(true);
    const { data, error } = await (supabase.rpc as any)("transfer_tokens", { _recipient_special_id: recipient.special_id, _amount: amount });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`Sent ${amount.toLocaleString()} tokens to ${recipient.full_name}`);
    setSpecialId(""); setRecipient(null); setAmount(1_000_000);
    onDone();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong border-primary/30 max-w-md backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Coins className="h-5 w-5 text-primary" />Transfer Tokens</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Recipient Special ID</label>
            <div className="flex gap-2">
              <Input value={specialId} onChange={(e) => { setSpecialId(e.target.value.toUpperCase()); setRecipient(null); }} placeholder="e.g. XHA6HD8" />
              <Button variant="outline" onClick={lookup} disabled={checking}>{checking ? "…" : "Check"}</Button>
            </div>
            {recipient && <p className="text-xs text-emerald-300 mt-1">Sending to: <span className="font-bold">{recipient.full_name}</span></p>}
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Amount</label>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={submit} disabled={submitting || !recipient} className="flex-1 btn-luxury">{submitting ? "Sending…" : "Send Tokens"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PromoRequestDialog({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const [amount, setAmount] = useState(1_000_000);
  const [usageLimit, setUsageLimit] = useState(1);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit() {
    if (amount <= 0 || usageLimit <= 0) return toast.error("Invalid amount or usage limit");
    setSubmitting(true);
    const { error } = await supabase.from("promo_code_requests").insert({ user_id: userId, amount, usage_limit: usageLimit, reason });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Promo code request submitted");
    onClose();
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong border-amber-500/30 max-w-md backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tag className="h-5 w-5 text-amber-300" />Request a Promo Code</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><label className="text-xs uppercase tracking-widest text-muted-foreground">Token amount per redemption</label><Input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
          <div><label className="text-xs uppercase tracking-widest text-muted-foreground">Number of uses</label><Input type="number" min={1} value={usageLimit} onChange={(e) => setUsageLimit(Number(e.target.value))} /></div>
          <div><label className="text-xs uppercase tracking-widest text-muted-foreground">Reason / campaign</label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What's this promo for?" /></div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="flex-1 btn-luxury">{submitting ? "Submitting…" : "Submit Request"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
