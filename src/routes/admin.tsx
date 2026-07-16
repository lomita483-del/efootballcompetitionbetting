import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RiskPanel, PnLPanel, ReferralsAdminPanel, EmblemModerationPanel, VipAdminPanel, StreakAndPushPanel, TokenRulesPanel, BroadcastPanel, ActivityPanel, ReportsPanel, AdminAILivePanel } from "@/components/admin/AdminExtensions";
import { UserExperiencePanel } from "@/components/admin/UserExperiencePanel";
import { VirtualAdminPanel } from "@/components/admin/VirtualAdminPanel";
import { ChampionshipAdminPanel } from "@/components/admin/ChampionshipAdminPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Shield, Users, Trophy, Coins, Megaphone, Settings as SettingsIcon, Ticket, AlertTriangle,
  Calendar, Tag, Image as ImageIcon, BarChart3, History, Send, Plus, Trash2, Pencil, ChevronRight, ChevronLeft, Wallet, ListOrdered, Sparkles, ClipboardList, Lock, Pause,
  Play, Check, X, MessageSquare, Eye, RotateCw, Copy, Globe, MapPin, Smartphone, Clock, Filter,
  Dice5, LogOut, Crosshair, Target, Flame, ThumbsUp, ThumbsDown,
  Gift, BellRing, GalleryHorizontalEnd, Gamepad2, Vote, ShoppingBag, LifeBuoy, Newspaper,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import _ecbLogo from "@/assets/ecb-logo.png.asset.json";
const lslLogo = _ecbLogo.url;
import tileBattle from "@/assets/tile-battle.jpg";
import tileVirtual from "@/assets/tile-virtual.jpg";
import tileChallenges from "@/assets/tile-challenges.jpg";
import tileReferrals from "@/assets/tile-referrals.jpg";
import tileUsers from "@/assets/tile-users.jpg";
import tileClans from "@/assets/tile-clans.jpg";
const tileBattleAsset = { url: tileBattle };
const tileVirtualAsset = { url: tileVirtual };
const tileChallengesAsset = { url: tileChallenges };
const tileUsersAsset = { url: tileUsers };
const tileClansAsset = { url: tileClans };
import adminConsoleSeed from "@/assets/admin-console-seed.jpg";
import leagueSkullFire from "@/assets/league-skull-fire.jpg";
import { Countdown } from "@/components/Countdown";
import { useAuth, ROLE_LABELS, type AppRole } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { fetchTeams } from "@/lib/queries";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
} from "recharts";
import { useConfirm } from "@/components/ConfirmDialog";
import { ActionConfirmDialog } from "@/components/ActionConfirmDialog";
import { notifyAction, humanizeAction } from "@/lib/notify-action";
import { SpotlightsAdminPanel } from "@/components/Spotlight";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ImageSettingControl } from "@/components/admin/ImageSettingControl";
import { ClansAdminPanel } from "@/components/admin/ClansAdminPanel";
import { LotteryAdminPanel } from "@/components/admin/LotteryAdminPanel";
import { GiftsSpinAdminPanel } from "@/components/admin/GiftsSpinAdminPanel";
import { SurveysAdminPanel } from "@/components/admin/SurveysAdminPanel";
import { PollsAdminPanel, ShopAdminPanel, FaqAdminPanel } from "@/components/admin/CommunityAdminPanel";
import { NewsAdminPanel } from "@/components/admin/NewsAdminPanel";
import { PushBroadcastPanel } from "@/components/admin/PushBroadcastPanel";
import { RecurringPushPanel } from "@/components/admin/RecurringPushPanel";
import { HomeBannersAdminPanel } from "@/components/admin/HomeBannersAdminPanel";
import { ArcadeAdminPanel } from "@/components/admin/ArcadeAdminPanel";
import { CasinoHistoryPanel } from "@/components/admin/CasinoHistoryPanel";
import { TopBetsPanel } from "@/components/admin/TopBetsPanel";
import { TournamentAdminPanel } from "@/components/admin/TournamentAdminPanel";
import { BrandingAdminPanel } from "@/components/admin/BrandingAdminPanel";
import { seedLegacyUsers } from "@/lib/seed-users.functions";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { loadStandings, type LbRow } from "@/lib/leaderboard";

// High-frequency admin actions that should not trigger a pop-out dialog.
const SILENT_AUDIT_ACTIONS = new Set(["match_live_score", "match_presence"]);

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — ECB" }, { name: "description", content: "League administration dashboard." }] }),
  component: AdminPage,
});

export function AdminPage() {
  const { isAdmin, isMod, loading } = useAuth();
  const nav = useNavigate();
  const [alerts, setAlerts] = useState<Record<string, number>>({});
  // Admin-configurable console header image (falls back to bundled seed art).
  const [heroBg, setHeroBg] = useState<string | null>(null);
  const [heroFit, setHeroFit] = useState<string>("cover");
  const [heroPos, setHeroPos] = useState<string>("center right");
  useEffect(() => {
    supabase.from("app_settings").select("admin_hero_url,admin_hero_fit,admin_hero_position").eq("id", 1).maybeSingle()
      .then(({ data }) => {
        setHeroBg((data as any)?.admin_hero_url ?? null);
        setHeroFit((data as any)?.admin_hero_fit ?? "cover");
        setHeroPos((data as any)?.admin_hero_position ?? "center right");
      });
  }, []);
  // Toggle the frosted-glass blur on the whole console so admins can verify
  // sensitive data alignment/layout against a clean, unblurred surface.
  const [unblurred, setUnblurred] = useState(false);
  // Default to analytics for admins; re-sync once auth resolves so a reload
  // never lands on the Tickets tab when an admin refreshes the page.
  // re-sync once auth resolves so a reload
  // never lands on the Tickets tab when an admin refreshes the page.
  const [activeTab, setActiveTab] = useState<string>("analytics");
  useEffect(() => {
    if (loading) return;
    setActiveTab((prev) => (isAdmin ? (prev === "tickets" ? "analytics" : prev) : "tickets"));
  }, [loading, isAdmin]);
  useEffect(() => { if (!loading && !isAdmin && !isMod) nav({ to: "/" }); }, [isAdmin, isMod, loading, nav]);
  useEffect(() => {
    if (!isAdmin) return;
    const loadAlerts = async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [users, tokens, withdrawals, tickets, bets, promos, appeals, chat] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("token_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("withdrawal_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).neq("status", "closed"),
        supabase.from("bets").select("id", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("promo_code_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("ban_appeals").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("chat_messages").select("id", { count: "exact", head: true }).gte("created_at", since),
      ]);
      setAlerts({ users: users.count ?? 0, tokens: tokens.count ?? 0, withdrawals: withdrawals.count ?? 0, tickets: tickets.count ?? 0, bettracker: bets.count ?? 0, promorelqs: promos.count ?? 0, appeals: appeals.count ?? 0, chat: chat.count ?? 0 });
    };
    loadAlerts();
    const ch = supabase.channel("admin-alert-indicators")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadAlerts)
      .on("postgres_changes", { event: "*", schema: "public", table: "token_requests" }, loadAlerts)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests" }, loadAlerts)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, loadAlerts)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_messages" }, loadAlerts)
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, loadAlerts)
      .on("postgres_changes", { event: "*", schema: "public", table: "promo_code_requests" }, loadAlerts)
      .on("postgres_changes", { event: "*", schema: "public", table: "ban_appeals" }, loadAlerts)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, loadAlerts)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "string") setActiveTab(detail);
    };
    window.addEventListener("admin:set-tab", handler);
    return () => window.removeEventListener("admin:set-tab", handler);
  }, []);
  if (loading) return <Layout><div className="container py-10">Loading…</div></Layout>;
  if (!isAdmin && !isMod) return null;

  return (
    <Layout>
      <main className={`admin-console-page${unblurred ? " admin-unblurred" : ""} w-full min-h-[calc(100vh-3.5rem)] overflow-x-hidden`}>
        <div className="mx-auto w-full max-w-[1280px] px-3 sm:px-4 py-4 sm:py-6 space-y-4">

          <div
            className="admin-hero-frame relative overflow-hidden rounded-2xl admin-user-bg admin-user-frame p-5 sm:p-7"
            style={{ backgroundImage: `linear-gradient(90deg, rgba(3,12,10,0.76) 0%, rgba(3,12,10,0.44) 42%, rgba(3,12,10,0.18) 100%), url(${heroBg || adminConsoleSeed})`, backgroundSize: `auto, ${heroFit === "contain" ? "contain" : heroFit === "fill" ? "100% 100%" : "cover"}`, backgroundPosition: `center, ${heroPos || "center right"}`, backgroundRepeat: "no-repeat" }}
          >
            <div className="absolute inset-0 " />
            <div className="relative flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl grid place-items-center bg-gradient-gold shadow-gold">
                  <Users className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.32em] text-primary/80">Member Registry</div>
                  <div className="text-xl font-display admin-user-foil">Users Panel</div>
                </div>
                <Badge variant="outline" className={`ml-auto ${isAdmin ? "border-accent/50 text-accent" : "border-primary/50 text-primary"}`}>
                  {isAdmin ? "Super Admin" : "Admin"}
                </Badge>
                {isAdmin && (
                  <div className="flex items-center gap-1 w-full sm:w-auto sm:ml-2">
                    <Button size="sm" variant="outline" className="text-[11px]" onClick={() => setUnblurred((v) => !v)} title="Toggle frosted-glass blur to verify alignment & layout">
                      {unblurred ? "🔍 Unblurred" : "🔒 Blurred"}
                    </Button>
                    <Button size="sm" variant="outline" className="text-[11px]" onClick={() => { if (typeof window !== "undefined") window.location.reload(); }} title="Reload this admin page">
                      ↻ Reload
                    </Button>
                    <Button size="sm" variant="outline" className="text-[11px]" onClick={async () => {
                      try {
                        if ("serviceWorker" in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map((r) => r.unregister())); }
                        if (typeof caches !== "undefined") { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); }
                      } catch {}
                      if (typeof window !== "undefined") window.location.reload();
                    }} title="Clear caches & service workers, then reload">
                      🔄 Hard refresh
                    </Button>
                    <Button size="sm" variant="destructive" className="text-[11px]" onClick={async () => {
                      const { error } = await (supabase as any).from("app_settings").update({ force_reload_at: new Date().toISOString() }).eq("id", 1);
                      if (error) { (await import("sonner")).toast.error(error.message); return; }
                      (await import("sonner")).toast.success("Reload broadcast sent to every active browser.");
                    }} title="Force every logged-in browser to reload right now">
                      📡 Broadcast reload
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="users" className="mt-4"><UsersPanel /></TabsContent>
            <TabsContent value="bannedusers" className="mt-4"><BannedUsersPanel /></TabsContent>
            <TabsContent value="virtual" className="mt-4"><VirtualAdminPanel /></TabsContent>
            <TabsContent value="championship" className="mt-4"><ChampionshipAdminPanel /></TabsContent>
            <TabsContent value="matches" className="mt-4"><MatchesPanel /></TabsContent>
            <TabsContent value="futures" className="mt-4"><FuturesAdminPanel /></TabsContent>
            <TabsContent value="events" className="mt-4"><EventsPanel /></TabsContent>
            <TabsContent value="tokens" className="mt-4"><TokensPanel /></TabsContent>
            <TabsContent value="tokenmovement" className="mt-4"><TokenMovementPanel /></TabsContent>
            <TabsContent value="wonbets" className="mt-4"><BetsByStatusPanel status="won" /></TabsContent>
            <TabsContent value="lostbets" className="mt-4"><BetsByStatusPanel status="lost" /></TabsContent>
            <TabsContent value="withdrawals" className="mt-4"><WithdrawalsPanel /></TabsContent>
            <TabsContent value="housewallet" className="mt-4"><HouseWalletPanel /></TabsContent>
            <TabsContent value="leaderboard" className="mt-4"><LeaderboardAdminPanel /></TabsContent>
            <TabsContent value="lottery" className="mt-4"><LotteryAdminPanel /></TabsContent>
            <TabsContent value="giftsspin" className="mt-4"><GiftsSpinAdminPanel /></TabsContent>
            <TabsContent value="promos" className="mt-4"><PromoPanel /></TabsContent>
            <TabsContent value="content" className="mt-4"><ContentPanel /></TabsContent>
            <TabsContent value="tickets" className="mt-4"><TicketsPanel /></TabsContent>
            <TabsContent value="tasks" className="mt-4"><TasksAchievementsPanel /></TabsContent>
            <TabsContent value="surveys" className="mt-4"><SurveysAdminPanel /></TabsContent>
            <TabsContent value="polls" className="mt-4"><PollsAdminPanel /></TabsContent>
            <TabsContent value="shop" className="mt-4"><ShopAdminPanel /></TabsContent>
            <TabsContent value="faq" className="mt-4"><FaqAdminPanel /></TabsContent>
            <TabsContent value="news" className="mt-4"><NewsAdminPanel /></TabsContent>
            <TabsContent value="challenges" className="mt-4"><ChallengesAdminPanel /></TabsContent>
            <TabsContent value="seasons" className="mt-4"><SeasonsAdminPanel /></TabsContent>
            <TabsContent value="bettracker" className="mt-4"><BetTrackerPanel /></TabsContent>
            <TabsContent value="promorelqs" className="mt-4"><PromoRequestsPanel /></TabsContent>
            <TabsContent value="appeals" className="mt-4"><AppealsPanel /></TabsContent>
            <TabsContent value="chat" className="mt-4"><ChatMonitorPanel /></TabsContent>
            <TabsContent value="notify" className="mt-4"><NotifyPanel /></TabsContent>
            <TabsContent value="audit" className="mt-4"><AuditPanel /></TabsContent>
            <TabsContent value="analytics" className="mt-4"><AnalyticsPanel /></TabsContent>
            <TabsContent value="settings" className="mt-4"><SettingsPanel /></TabsContent>
            <TabsContent value="adminai" className="mt-4"><AdminAILivePanel /></TabsContent>
            <TabsContent value="risk" className="mt-4"><RiskPanel /></TabsContent>
            <TabsContent value="pnl" className="mt-4"><PnLPanel /></TabsContent>
            <TabsContent value="reports" className="mt-4"><ReportsPanel /></TabsContent>
            <TabsContent value="tokenrules" className="mt-4"><TokenRulesPanel /></TabsContent>
            <TabsContent value="broadcast" className="mt-4"><BroadcastPanel /></TabsContent>
            <TabsContent value="pushblast" className="mt-4"><PushBroadcastPanel /></TabsContent>
            <TabsContent value="pushrecurring" className="mt-4"><RecurringPushPanel /></TabsContent>
            <TabsContent value="banners" className="mt-4"><HomeBannersAdminPanel /></TabsContent>
            <TabsContent value="arcade" className="mt-4"><ArcadeAdminPanel /></TabsContent>
            <TabsContent value="casinohistry" className="mt-4"><CasinoHistoryPanel /></TabsContent>
            <TabsContent value="activity" className="mt-4"><ActivityPanel /></TabsContent>
            <TabsContent value="streakpush" className="mt-4"><StreakAndPushPanel /></TabsContent>
            <TabsContent value="referrals" className="mt-4"><ReferralsAdminPanel /></TabsContent>
            <TabsContent value="emblems" className="mt-4"><EmblemModerationPanel /></TabsContent>
            <TabsContent value="vip" className="mt-4"><VipAdminPanel /></TabsContent>
            <TabsContent value="spotlights" className="mt-4"><SpotlightsAdminPanel /></TabsContent>
            <TabsContent value="clans" className="mt-4"><ClansAdminPanel /></TabsContent>
            <TabsContent value="topbets" className="mt-4"><TopBetsPanel /></TabsContent>
            <TabsContent value="tournaments" className="mt-4"><TournamentAdminPanel /></TabsContent>
            <TabsContent value="attendance" className="mt-4"><AttendancePanel /></TabsContent>
            <TabsContent value="branding" className="mt-4"><BrandingAdminPanel /></TabsContent>
            <TabsContent value="ux" className="mt-4"><UserExperiencePanel /></TabsContent>
          </Tabs>
        </div>
        <ActionConfirmDialog />
      </main>
    </Layout>
  );
}

async function logAudit(action: string, target_type: string, target_id?: string, metadata?: any) {
  const u = (await supabase.auth.getUser()).data.user;
  if (!u) return;
  const enriched: any = {
    ...(metadata ?? {}),
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    route: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
    origin: typeof window !== "undefined" ? window.location.origin : null,
    locale: typeof navigator !== "undefined" ? navigator.language : null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    source: "admin_panel",
  };
  if (target_type === "user" && target_id) enriched.target_user_id = target_id;
  const { error } = await (supabase as any).rpc("admin_log_action", {
    _action: action,
    _target_type: target_type,
    _target_id: target_id ?? null,
    _metadata: enriched,
  });
  if (error) console.warn("audit log failed", error.message);
  else if (!SILENT_AUDIT_ACTIONS.has(action)) notifyAction("Action saved", humanizeAction(action));
}

function AdminTab({ icon: Icon, label, count = 0 }: { icon: any; label: string; count?: number }) {
  return (
    <span className="relative inline-flex items-center gap-1">
      <Icon className="h-3 w-3" />{label}
      {count > 0 && <span className="ml-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background" title={`${count} new/pending`} />}
    </span>
  );
}

function AdminSectionRail({ alerts, onOpen }: { alerts: Record<string, number>; onOpen: (tab: string) => void }) {
  const { isAdmin } = useAuth();
  const all = [
    { tab: "tickets", icon: Ticket, label: "Open reports", count: alerts.tickets ?? 0, mod: true },
    { tab: "bettracker", icon: ClipboardList, label: "Booked tickets", count: alerts.bettracker ?? 0, mod: false },
    { tab: "tokens", icon: Coins, label: "Token requests", count: alerts.tokens ?? 0, mod: false },
    { tab: "withdrawals", icon: Wallet, label: "Withdrawals", count: alerts.withdrawals ?? 0, mod: false },
    { tab: "promorelqs", icon: Tag, label: "Promo requests", count: alerts.promorelqs ?? 0, mod: false },
    { tab: "appeals", icon: AlertTriangle, label: "Ban appeals", count: alerts.appeals ?? 0, mod: true },
  ];
  const items = isAdmin ? all : all.filter((i) => i.mod);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
      {items.map((item) => (
        <button key={item.tab} onClick={() => onOpen(item.tab)} className="group relative overflow-hidden rounded-xl border border-primary/20 bg-card/70 p-3 text-left shadow-luxury transition hover:-translate-y-0.5 hover:border-primary/50">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-gold" />
          <item.icon className="h-4 w-4 text-primary mb-2" />
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{item.label}</div>
          <div className={`mt-1 text-2xl font-black ${item.count > 0 ? "text-emerald-400" : item.count < 0 ? "text-red-400" : "text-foreground"}`}>{item.count}</div>
          {item.count > 0 && <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background" />}
        </button>
      ))}
    </div>
  );
}

function ChatMonitorPanel() {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  async function load() {
    const { data } = await supabase.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(120);
    setMsgs(data ?? []);
    const ids = Array.from(new Set((data ?? []).map((m: any) => m.user_id).filter(Boolean)));
    if (ids.length) {
      const { data: p } = await supabase.from("profiles").select("id,full_name,email,gang_name,is_muted,is_banned").in("id", ids);
      const map: Record<string, any> = {}; (p ?? []).forEach((x: any) => { map[x.id] = x; }); setProfiles(map);
    }
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("admin-chat-monitor").on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  async function del(id: string) { await supabase.from("chat_messages").delete().eq("id", id); load(); }
  return (
    <div className="space-y-3">
      <Card className="glass-strong p-4 flex items-center gap-3">
        <MessageSquare className="h-5 w-5 text-primary" />
        <div>
          <div className="font-bold">Live Chat Monitor</div>
          <div className="text-xs text-muted-foreground">Newest messages across all rooms with quick moderation access.</div>
        </div>
      </Card>
      {msgs.map((m) => {
        const p = profiles[m.user_id];
        return (
          <Card key={m.id} className="glass p-3 flex items-start gap-3 flex-wrap">
            <Badge variant="outline" className="capitalize border-primary/40 text-primary">{m.room}</Badge>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">{p?.full_name ?? "Unknown"} <span className="text-xs text-muted-foreground">{p?.email}</span></div>
              {m.content && <div className="text-sm mt-1 break-words">{m.content}</div>}
              {m.image_url && <a href={m.image_url} target="_blank" rel="noreferrer"><img src={m.image_url} alt="Chat upload" className="mt-2 max-h-28 rounded-lg border border-border" /></a>}
              <div className="text-[10px] text-muted-foreground mt-1">{p?.gang_name ?? "Independent"}  · {new Date(m.created_at).toLocaleString()}</div>
            </div>
            <Button size="sm" variant="destructive" onClick={() => del(m.id)}><Trash2 className="h-3 w-3" /></Button>
          </Card>
        );
      })}
    </div>
  );
}

function Stats() {
  const [s, setS] = useState({ users: 0, matches: 0, pending: 0, tokens: 0 });
  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("matches").select("id", { count: "exact", head: true }).neq("status", "ended"),
      supabase.from("token_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("profiles").select("token_balance"),
    ]).then(([u, m, p, t]) => setS({
      users: u.count ?? 0, matches: m.count ?? 0, pending: p.count ?? 0,
      tokens: (t.data ?? []).reduce((acc: number, x: any) => acc + (x.token_balance ?? 0), 0),
    }));
  }, []);
  const items = [
    { icon: Users, label: "Users", value: s.users.toString() },
    { icon: Trophy, label: "Open matches", value: s.matches.toString() },
    { icon: AlertTriangle, label: "Pending requests", value: s.pending.toString() },
    { icon: Coins, label: "Tokens circulating", value: s.tokens.toLocaleString() },
  ];
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((x) => (
        <Card key={x.label} className="glass p-4">
          <x.icon className="h-5 w-5 text-primary mb-2" />
          <div className="text-2xl font-bold text-emerald-400">{x.value}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{x.label}</div>
        </Card>
      ))}
    </div>
  );
}

/* ============================ MATCHES ============================ */
function MatchesPanel() {
  const confirm = useConfirm();
  const [matches, setMatches] = useState<any[]>([]);
  const [wizard, setWizard] = useState(false);
  const [shooterWizard, setShooterWizard] = useState(false);

  async function load() {
    const { data } = await (supabase as any).from("matches").select("*, markets(id,is_open), home_team:teams!home_team_id(name,logo_url), away_team:teams!away_team_id(name,logo_url), home_player:players!home_player_id(name,avatar_url), away_player:players!away_player_id(name,avatar_url)").eq("is_archived", false).neq("match_kind", "future").order("start_time", { ascending: false });
    setMatches(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    const { data, error } = await supabase
      .from("matches")
      .update({ status: status as any })
      .eq("id", id)
      .select("id");
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) {
      toast.error("Update blocked — you may not have admin permissions for this match.");
      return;
    }
    await logAudit(`match_${status}`, "match", id);
    toast.success(status === "live" ? "Match is now live" : `Match ${status}`);
    load();
  }
  async function toggleOdds(m: any) {
    const anyOpen = (m.markets ?? []).some((mk: any) => mk.is_open);
    const next = !anyOpen;
    const { error } = await supabase.from("markets").update({ is_open: next }).eq("match_id", m.id);
    if (error) { toast.error(error.message); return; }
    await logAudit(next ? "match_odds_unlock" : "match_odds_lock", "match", m.id);
    toast.success(next ? "Odds unlocked — betting open" : "Odds locked — betting closed");
    load();
  }
  async function togglePresence(m: any, side: "home" | "away") {
    const field = side === "home" ? "home_present" : "away_present";
    const current = m[field] === true;
    const { error } = await supabase.from("matches").update({ [field]: !current } as any).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    await logAudit("match_presence", "match", m.id, { side, present: !current });
    load();
  }
  async function settle(m: any) {
    const homeLabel = m.match_kind === "shooter" ? m.home_player?.name : m.home_team?.name;
    const awayLabel = m.match_kind === "shooter" ? m.away_player?.name : m.away_team?.name;
    const ok = await confirm({ title: "End match and settle bets?", description: `Final score will be ${homeLabel} ${m.home_score}–${m.away_score} ${awayLabel}. Suspended/refunded tickets will not be credited.`, confirmText: "Settle match" });
    if (!ok) return;
    const hs = Number(m.home_score ?? 0), as = Number(m.away_score ?? 0);
    let winnerId = null;
    if (hs > as) winnerId = m.home_team_id;
    else if (as > hs) winnerId = m.away_team_id;
    await supabase.from("matches").update({ home_score: hs, away_score: as, status: "ended", winner_team_id: winnerId }).eq("id", m.id);
    await supabase.from("markets").update({ is_open: false }).eq("match_id", m.id);
    await settleBetsForMatch(m.id, winnerId, hs, as);
    // Self-heal: an accumulator whose last-resolving leg completes here may have
    // been wrongly stranded at "lost" earlier — credit any all-won ticket now.
    await supabase.rpc("resettle_won_bets");
    await logAudit("match_settled", "match", m.id, { home_score: hs, away_score: as, winner_team_id: winnerId });
    window.dispatchEvent(new CustomEvent("admin:futures-refresh", { detail: { matchId: m.id } }));
    // Refresh leaderboard after match settlement
    window.dispatchEvent(new CustomEvent("admin:leaderboard-refresh"));
    toast.success("Match settled — bets paid out");
    load();
  }
  async function deleteMatch(id: string) {
    if (!await confirm({ title: "Remove this match from the panel?", description: "The match will be hidden from the matches list but kept in the database so existing bet vouchers keep showing team and stake info.", tone: "danger", confirmText: "Remove" })) return;
    const { error } = await supabase.from("matches").update({ is_archived: true }).eq("id", id);
    if (error) toast.error(error.message); else { logAudit("match_archived", "match", id); load(); toast.success("Match archived"); }
  }

  async function clearEnded() {
    const clearable = matches.filter((m) => m.status === "ended" || m.status === "cancelled");
    const endedCount = clearable.length;
    if (endedCount === 0) { toast.info("No ended or cancelled matches to clear."); return; }
    if (!await confirm({
      title: `Clear ${endedCount} match${endedCount === 1 ? "" : "es"}?`,
      description: "All matches with status 'ended' or 'cancelled' will be archived from the panel so you can create new ones. User bet vouchers and history stay intact — only the match listing here is cleared.",
      tone: "danger", confirmText: "Clear ended & cancelled",
    })) return;
    const { data: archived, error } = await supabase
      .from("matches").update({ is_archived: true }).eq("is_archived", false).in("status", ["ended", "cancelled"]).select("id");
    if (error) { toast.error(error.message); return; }
    await logAudit("matches_bulk_archive_ended", "matches", undefined, { count: archived?.length ?? 0, match_ids: (archived ?? []).map((m: any) => m.id) });
    toast.success(`Archived ${archived?.length ?? 0} match${archived?.length === 1 ? "" : "es"} (ended + cancelled)`);
    load();
  }

  async function updateLiveScore(m: any, hs: number, as: number) {
    await supabase.from("matches").update({ home_score: hs, away_score: as }).eq("id", m.id);
    await logAudit("match_live_score", "match", m.id, { home_score: hs, away_score: as });
    window.dispatchEvent(new CustomEvent("admin:futures-refresh", { detail: { matchId: m.id } }));
    load();
  }

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <Card className="glass-strong p-4 flex items-center justify-between">
        <div>
          <div className="font-bold text-lg">Match Control</div>
          <div className="text-xs text-muted-foreground">Create, live-score, and settle matches</div>
        </div>
        <Button onClick={() => setWizard(true)}>+ New Match</Button>
      </Card>

      {/* QUICK ACTIONS */}
      <div className="grid gap-2">
        <Button variant="outline" size="sm" onClick={clearEnded} className="w-full justify-start">Clear ended/cancelled matches ({matches.filter((m) => ["ended", "cancelled"].includes(m.status)).length})</Button>
        <Button variant="outline" size="sm" onClick={() => setShooterWizard(true)} className="w-full justify-start">+ Shooter 1v1 Match</Button>
      </div>

      {/* MATCHES TABLE */}
      {matches.length === 0 && <Card className="p-6 text-center text-muted-foreground">No matches. <Button variant="link" onClick={() => setWizard(true)}>Create one</Button></Card>}
      <div className="space-y-2">
        {matches.map((m) => (
          <Card key={m.id} className="glass p-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex-1 min-w-[200px]">
              <div className="font-bold truncate">{m.match_kind === "shooter" ? m.home_player?.name : m.home_team?.name} vs {m.match_kind === "shooter" ? m.away_player?.name : m.away_team?.name} {m.status === "ended" && <span className="text-xs text-muted-foreground">({m.home_score}–{m.away_score})</span>}</div>
              <div className="text-xs text-muted-foreground">{m.name} · {m.start_time ? new Date(m.start_time).toLocaleString() : ""} {m.match_kind === "shooter" && <Badge variant="outline" className="ml-2 text-[9px] border-accent/40 text-accent">Shooter 1v1</Badge>}</div>
            </div>
            <div className="flex gap-1 items-center flex-wrap">
              <Badge variant="outline" className="capitalize">{m.status}</Badge>
              {m.status === "scheduled" && <Button size="xs" variant="outline" onClick={() => setStatus(m.id, "live")}>▶ Live</Button>}
              {["scheduled", "live"].includes(m.status) && <Button size="xs" variant="outline" onClick={() => setStatus(m.id, "cancelled")}>✕ Cancel</Button>}
              {m.status === "live" && <Button size="xs" variant="outline" onClick={() => setStatus(m.id, "ended")}>⏹ End</Button>}
              {["scheduled", "live"].includes(m.status) && <Button size="xs" variant={m.status === "scheduled" ? "outline" : "default"} onClick={() => toggleOdds(m)}>{(m.markets ?? []).some((mk: any) => mk.is_open) ? "🔓 Open" : "🔒 Closed"}</Button>}
              <Button size="xs" variant="outline" onClick={() => togglePresence(m, "home")} className={m.home_present ? "border-green-500/50 text-green-500" : ""}>{m.match_kind === "shooter" ? m.home_player?.name?.split(" ")[0] : m.home_team?.name?.split(" ")[0]} {m.home_present ? "✓" : "?"}</Button>
              <Button size="xs" variant="outline" onClick={() => togglePresence(m, "away")} className={m.away_present ? "border-green-500/50 text-green-500" : ""}>{m.match_kind === "shooter" ? m.away_player?.name?.split(" ")[0] : m.away_team?.name?.split(" ")[0]} {m.away_present ? "✓" : "?"}</Button>
              {(["scheduled", "live"].includes(m.status) || (m.status === "ended" && !m.settled_at)) && (
                <Button size="xs" variant="default" onClick={() => settle(m)}>
                  {m.status === "ended" ? "✓ Settle" : "⏹ End & settle"}
                </Button>
              )}
              <Button size="xs" variant="outline" onClick={() => deleteMatch(m.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </Card>
        ))}
      </div>

      {/* WIZARDS */}
      {wizard && <MatchWizard onClose={() => { setWizard(false); load(); }} />}
      {shooterWizard && <ShooterWizard onClose={() => { setShooterWizard(false); load(); }} />}
    </div>
  );
}

async function settleBetsForMatch(matchId: string, winnerTeamId: string | null, homeScore?: number, awayScore?: number) {
  // Get all bet selections for this match
  const { data: sels } = await supabase.from("bet_selections").select("*, markets!market_id(name), odds!odd_id(label)").eq("match_id", matchId);
  if (!sels || sels.length === 0) return;
  // Get team names for label comparison
  const { data: match } = await (supabase as any).from("matches").select("home_team_id,away_team_id,home_player_id,away_player_id,match_kind,home_player:players!home_player_id(name),away_player:players!away_player_id(name),home_team:teams!home_team_id(name),away_team:teams!away_team_id(name),home_score,away_score").eq("id", matchId).single() as any;
  const hs = homeScore ?? Number(match?.home_score ?? 0);
  const as_ = awayScore ?? Number(match?.away_score ?? 0);
  const scoreLabel = `${hs}-${as_}`;
  const winnerLabel = winnerTeamId === null
    ? "Draw"
    : match?.match_kind === "shooter"
    ? (winnerTeamId === match?.home_team_id ? match?.home_player?.name : match?.away_player?.name)
    : (winnerTeamId === match?.home_team_id ? match?.home_team?.name : match?.away_team?.name);
  for (const s of sels) {
    const marketName = (s as any).markets?.name ?? "";
    const oddLabel = (s as any).odds?.label ?? "";
    let result: "won" | "lost";
    if (/correct\s*score/i.test(marketName)) {
      // Normalize: accept "2-1", "2:1", "2 - 1"
      const norm = (v: string) => v.replace(/[^0-9]/g, "-").replace(/-+/g, "-");
      result = norm(oddLabel) === norm(scoreLabel) ? "won" : "lost";
    } else {
      // Tolerant match: ignore case + surrounding whitespace so labels still settle.
      const norm = (v: string) => (v ?? "").trim().toLowerCase();
      result = winnerLabel != null && norm(oddLabel) === norm(winnerLabel) ? "won" : "lost";
    }
    await supabase.from("bet_selections").update({ result }).eq("id", s.id);
  }
  // Settle bets that have all selections resolved
  const betIds = Array.from(new Set(sels.map((s: any) => s.bet_id)));
  for (const bid of betIds) {
    const { data: betSels } = await supabase.from("bet_selections").select("result").eq("bet_id", bid);
    if (!betSels || betSels.some((s: any) => !s.result)) continue;
    const allWon = betSels.every((s: any) => s.result === "won");
    const { data: bet } = await supabase.from("bets").select("*").eq("id", bid).single();
    if (!bet) continue;
    if (["suspended", "refunded", "void", "cashed_out"].includes(bet.status)) continue;
    if (allWon) {
      const { error } = await supabase.rpc("settle_pay_winning_bet", { _bet_id: bid });
      if (error) {
        toast.error(`Could not credit winnings for ${bet.tracking_id}: ${error.message}`);
      }
    } else {
      await supabase.from("bets").update({ status: "lost", settled_at: new Date().toISOString() }).eq("id", bid);
      await supabase.from("notifications").insert({ user_id: bet.user_id, title: "Bet lost", body: `Your ticket ${bet.tracking_id} did not win.`, link: `/ticket/${bid}` });
    }
  }
}

async function settleFutureBets(matchId: string, winningOddIds: string[], winningLabel: string) {
  const { data: sels } = await supabase.from("bet_selections").select("*").eq("match_id", matchId);
  if (!sels || sels.length === 0) return;
  for (const s of sels) {
    await supabase.from("bet_selections").update({ result: s.odd_id && winningOddIds.includes(s.odd_id) ? "won" : "lost" }).eq("id", s.id);
  }
  const betIds = Array.from(new Set(sels.map((s: any) => s.bet_id)));
  for (const bid of betIds) {
    const { data: betSels } = await supabase.from("bet_selections").select("result").eq("bet_id", bid);
    if (!betSels || betSels.some((s: any) => !s.result)) continue;
    const allWon = betSels.every((s: any) => s.result === "won");
    const { data: bet } = await supabase.from("bets").select("*").eq("id", bid).single();
    if (!bet || ["suspended", "refunded", "void", "cashed_out"].includes(bet.status)) continue;
    if (allWon) {
      const { error } = await supabase.rpc("settle_pay_winning_bet", { _bet_id: bid });
      if (error) toast.error(`Could not credit ${bet.tracking_id}: ${error.message}`);
    } else {
      await supabase.from("bets").update({ status: "lost", settled_at: new Date().toISOString() }).eq("id", bid);
      await supabase.from("notifications").insert({ user_id: bet.user_id, title: "Bet lost", body: `Your ticket ${bet.tracking_id} did not win.`, link: `/ticket/${bid}` });
    }
  }
}

function LeaderboardAdminPanel() {
  const [gangs, setGangs] = useState<LbRow[]>([]);
  const [shooters, setShooters] = useState<LbRow[]>([]);
  const [tab, setTab] = useState<"gang" | "shooter">("gang");
  const [edits, setEdits] = useState<Record<string, Partial<LbRow>>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [headerUrl, setHeaderUrl] = useState<string>("");
  const [headerBusy, setHeaderBusy] = useState(false);
  const confirm = useConfirm();

  async function load() {
    const { gangs, shooters } = await loadStandings();
    setGangs(gangs);
    setShooters(shooters);
    setEdits({});
  }
  
  useEffect(() => {
    load();
    supabase.from("app_settings").select("leaderboard_header_url").eq("id", 1).maybeSingle()
      .then(({ data }) => setHeaderUrl((data as any)?.leaderboard_header_url ?? ""));
    
    // Listen for admin:leaderboard-refresh event from MatchesPanel
    const handler = () => load();
    window.addEventListener("admin:leaderboard-refresh", handler);
    return () => window.removeEventListener("admin:leaderboard-refresh", handler);
  }, []);

  async function saveHeaderUrl(url: string) {
    const { error } = await supabase.from("app_settings").update({ leaderboard_header_url: url || null } as any).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    setHeaderUrl(url);
    await logAudit("leaderboard_header_update", "app_settings", undefined, { url });
    toast.success("Leaderboard header saved");
  }
  async function uploadHeader(file: File) {
    setHeaderBusy(true);
    try {
      const path = `leaderboard/header-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error } = await supabase.storage.from("ads").upload(path, file, { upsert: true });
      if (error) { toast.error(error.message); return; }
      const url = supabase.storage.from("ads").getPublicUrl(path).data.publicUrl;
      await saveHeaderUrl(url);
    } finally {
      setHeaderBusy(false);
    }
  }

  const rows = tab === "gang" ? gangs : shooters;
  const rowKey = (r: LbRow) => `${tab}:${r.name}`;
  function field(r: LbRow, k: keyof LbRow): any {
    const e = edits[rowKey(r)];
    return e && k in e ? (e as any)[k] : (r as any)[k];
  }
  function setField(r: LbRow, k: keyof LbRow, v: any) {
    setEdits((prev) => ({ ...prev, [rowKey(r)]: { ...prev[rowKey(r)], [k]: v } }));
  }

  // ... rest of the LeaderboardAdminPanel component
  return (
    <div>
      <Card className="glass-strong p-4 flex items-center gap-3">
        <Trophy className="h-5 w-5 text-primary" />
        <div>
          <div className="font-bold">Leaderboard Management</div>
          <div className="text-xs text-muted-foreground">Edit standings and customize header image.</div>
        </div>
      </Card>
      {/* Component UI continues here */}
    </div>
  );
}
