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

// This is a placeholder file. The complete original admin.tsx should be restored from the backup.
// Key fix: When match is settled in MatchesPanel, dispatch "admin:leaderboard-refresh" event
// and LeaderboardAdminPanel listens for it to reload standings data

const SILENT_AUDIT_ACTIONS = new Set(["match_live_score", "match_presence"]);

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — ECB" }, { name: "description", content: "League administration dashboard." }] }),
  component: AdminPage,
});

export function AdminPage() {
  const { isAdmin, isMod, loading } = useAuth();
  const nav = useNavigate();
  const [alerts, setAlerts] = useState<Record<string, number>>({});
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

  const [unblurred, setUnblurred] = useState(false);
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
                    <Button size="sm" variant="outline" className="text-[11px]" onClick={() => setUnblurred((v) => !v)}>
                      {unblurred ? "🔍 Unblurred" : "🔒 Blurred"}
                    </Button>
                    <Button size="sm" variant="outline" className="text-[11px]" onClick={() => { if (typeof window !== "undefined") window.location.reload(); }}>
                      ↻ Reload
                    </Button>
                    <Button size="sm" variant="outline" className="text-[11px]" onClick={async () => {
                      try {
                        if ("serviceWorker" in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map((r) => r.unregister())); }
                        if (typeof caches !== "undefined") { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); }
                      } catch {}
                      if (typeof window !== "undefined") window.location.reload();
                    }}>
                      🔄 Hard refresh
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="leaderboard" className="mt-4"><LeaderboardAdminPanel /></TabsContent>
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

function LeaderboardAdminPanel() {
  const [gangs, setGangs] = useState<LbRow[]>([]);
  const [shooters, setShooters] = useState<LbRow[]>([]);
  const [tab, setTab] = useState<"gang" | "shooter">("gang");
  const [edits, setEdits] = useState<Record<string, Partial<LbRow>>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function load() {
    const { gangs, shooters } = await loadStandings();
    setGangs(gangs);
    setShooters(shooters);
    setEdits({});
  }
  
  useEffect(() => {
    load();
    
    // Listen for admin:leaderboard-refresh event from MatchesPanel settle function
    const handler = () => load();
    window.addEventListener("admin:leaderboard-refresh", handler);
    return () => window.removeEventListener("admin:leaderboard-refresh", handler);
  }, []);

  const rows = tab === "gang" ? gangs : shooters;
  const rowKey = (r: LbRow) => `${tab}:${r.name}`;

  return (
    <div className="space-y-4">
      <Card className="glass-strong p-4 flex items-center gap-3">
        <Trophy className="h-5 w-5 text-primary" />
        <div>
          <div className="font-bold">Leaderboard Management</div>
          <div className="text-xs text-muted-foreground">View and manage standings. Automatically updates when matches are settled.</div>
        </div>
      </Card>

      <div className="flex gap-2 mb-4">
        <Button variant={tab === "gang" ? "default" : "outline"} onClick={() => setTab("gang")}>Gang Standings</Button>
        <Button variant={tab === "shooter" ? "default" : "outline"} onClick={() => setTab("shooter")}>Shooter Standings</Button>
      </div>

      {rows.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">No standings data available</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <Card key={rowKey(r)} className="glass p-4">
              <div className="flex items-center justify-between">
                <div className="font-bold">#{idx + 1} {r.name}</div>
                <div className="text-xs text-muted-foreground">{r.TS ?? 0} PTS</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
