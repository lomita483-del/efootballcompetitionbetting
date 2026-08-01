import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Copy, Coins, Trophy, Shield, Lock, MessageSquare, AlertTriangle, LogOut,
  Wallet, Activity, ShieldCheck, Gavel, User as UserIcon, Clock, Check, X, Smartphone, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_LABELS, type AppRole } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/admin_/members/$userId")({
  head: () => ({
    meta: [
      { title: "Member Management — ECB Admin" },
      { name: "description", content: "Detailed member profile, financials, activity, security and moderation controls." },
      { property: "og:title", content: "Member Management — ECB Admin" },
      { property: "og:description", content: "Detailed member profile, financials, activity, security and moderation controls." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MemberDetailPage,
});

type SectionKey = "overview" | "financials" | "activity" | "security" | "moderation";

const SECTIONS: { key: SectionKey; label: string; icon: any }[] = [
  { key: "overview", label: "Overview", icon: UserIcon },
  { key: "financials", label: "Financials", icon: Wallet },
  { key: "activity", label: "Activity", icon: Activity },
  { key: "security", label: "Security", icon: ShieldCheck },
  { key: "moderation", label: "Moderation", icon: Gavel },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}

function Panel({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className="admin-user-bg admin-user-frame border-0 rounded-2xl p-4 sm:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-4">
        <div className="min-w-0">
          <div className="text-sm font-black admin-user-foil truncate">{title}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-primary/20 p-6 text-center text-xs text-muted-foreground">{text}</div>;
}

function MemberDetailPage() {
  const { userId } = Route.useParams();
  const nav = useNavigate();
  const { isAdmin, isMod, loading: authLoading, user: me } = useAuth();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [roles, setRoles] = useState<string[]>([]);
  const [section, setSection] = useState<SectionKey>("overview");

  const [bets, setBets] = useState<any[]>([]);
  const [tx, setTx] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [kyc, setKyc] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [actorMap, setActorMap] = useState<Record<string, string>>({});

  const [tokenDelta, setTokenDelta] = useState(0);
  const [tokenReason, setTokenReason] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [banDuration, setBanDuration] = useState("permanent");
  const [newNote, setNewNote] = useState("");

  useEffect(() => { if (!authLoading && !isAdmin && !isMod) nav({ to: "/" }); }, [authLoading, isAdmin, isMod, nav]);

  async function loadUser() {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setUser(data);
    setForm(data ?? {});
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles((r ?? []).map((x: any) => x.role));
    setLoading(false);
  }

  async function loadRelated() {
    const [b, t, dep, w, a, aBy, aMeta, s, k, n] = await Promise.all([
      supabase.from("bets").select("*, bet_selections(id, selection_label, locked_odds, result, matches!match_id(name, status, home_score, away_score), markets!market_id(name))").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("token_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(60),
      supabase.from("token_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
      supabase.from("withdrawal_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
      supabase.from("audit_logs").select("*").eq("target_type", "user").eq("target_id", userId).order("created_at", { ascending: false }).limit(60),
      supabase.from("audit_logs").select("*").eq("actor_id", userId).order("created_at", { ascending: false }).limit(30),
      supabase.from("audit_logs").select("*").contains("metadata", { target_user_id: userId } as any).order("created_at", { ascending: false }).limit(40),
      supabase.from("user_sessions").select("*").eq("user_id", userId).order("last_seen", { ascending: false }).limit(20),
      (supabase as any).from("kyc_documents").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      (supabase as any).from("admin_user_notes").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    const map = new Map<string, any>();
    for (const row of [...(a.data ?? []), ...(aBy.data ?? []), ...(aMeta.data ?? [])]) if (row?.id) map.set(row.id, row);
    const merged = Array.from(map.values()).sort((x, y) => +new Date(y.created_at) - +new Date(x.created_at));
    setBets(b.data ?? []); setTx(t.data ?? []); setDeposits(dep.data ?? []);
    setWithdrawals(w.data ?? []); setAudits(merged); setSessions(s.data ?? []);
    setKyc((k as any).data ?? []); setNotes((n as any).data ?? []);

    const ids = Array.from(new Set([
      ...merged.map((x: any) => x.actor_id).filter(Boolean),
      ...((w.data ?? []) as any[]).map((x) => x.reviewed_by).filter(Boolean),
      ...(((n as any).data ?? []) as any[]).map((x) => x.author_id).filter(Boolean),
    ]));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const m: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { m[p.id] = p.full_name ?? p.id; });
      setActorMap(m);
    }
  }

  useEffect(() => { loadUser(); loadRelated(); /* eslint-disable-next-line */ }, [userId]);

  const wonCount = useMemo(() => bets.filter((b) => b.status === "won").length, [bets]);
  const settled = useMemo(() => bets.filter((b) => b.status === "won" || b.status === "lost").length, [bets]);
  const winRate = settled ? Math.round((wonCount / settled) * 100) : 0;

  async function saveProfile() {
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name, phone: form.phone, discord_username: form.discord_username,
      discord_full_name: form.discord_full_name, country: form.country,
      gang_name: form.gang_name, gang_type: form.gang_type,
    }).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved");
    logAudit("update_profile", "user", userId);
    loadUser();
  }

  async function applyTokens() {
    if (!tokenDelta || !tokenReason) { toast.error("Amount and reason required"); return; }
    const newBal = (user?.token_balance ?? 0) + tokenDelta;
    if (newBal < 0) { toast.error("Balance cannot go negative"); return; }
    const { error } = await supabase.from("profiles").update({ token_balance: newBal }).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    await supabase.from("notifications").insert({ user_id: userId, title: tokenDelta > 0 ? "Tokens credited" : "Tokens debited", body: `${tokenDelta > 0 ? "+" : ""}${tokenDelta} tokens — ${tokenReason}` });
    await logAudit(tokenDelta > 0 ? "grant_tokens" : "revoke_tokens", "user", userId, {
      amount: tokenDelta, reason: tokenReason, balance_from: user?.token_balance ?? 0, balance_to: newBal,
      target_user_email: user?.email, target_user_name: user?.full_name,
    });
    toast.success("Applied"); setTokenDelta(0); setTokenReason("");
    loadUser(); loadRelated();
  }

  async function flagAction(field: "is_banned" | "is_muted" | "is_restricted", val: boolean, reasonField: string) {
    if (val && !actionReason.trim()) { toast.error("Reason is required"); return; }
    const reason = val ? `${actionReason.trim()}${field === "is_banned" && banDuration !== "permanent" ? ` (duration: ${banDuration})` : ""}` : null;
    const { error } = await supabase.from("profiles").update({ [field]: val, [reasonField]: reason } as any).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    await supabase.from("notifications").insert({ user_id: userId, title: val ? `You were ${field.replace("is_", "")}` : `You were un-${field.replace("is_", "")}`, body: reason ?? "Restriction lifted." });
    await logAudit(val ? `apply_${field}` : `lift_${field}`, "user", userId, { reason, duration: banDuration });
    toast.success("Updated"); setActionReason("");
    loadUser(); loadRelated();
  }

  async function kickUser() {
    if (!isAdmin) return;
    if (!actionReason.trim()) { toast.error("Reason is required to kick a user."); return; }
    const { error } = await (supabase as any).rpc("admin_kick_user", { _user_id: userId, _reason: actionReason.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success("User kicked — their active session will sign out.");
    setActionReason(""); loadRelated();
  }

  async function addRole(role: AppRole) {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) { toast.error(error.message); return; }
    logAudit("add_role", "user", userId, { role, target_user_email: user?.email, target_user_name: user?.full_name });
    toast.success(`+ ${ROLE_LABELS[role]}`); loadUser();
  }
  async function removeRole(role: string) {
    await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as AppRole);
    logAudit("remove_role", "user", userId, { role, target_user_email: user?.email, target_user_name: user?.full_name });
    toast.success(`− ${role}`); loadUser();
  }

  async function reviewKyc(id: string, status: "approved" | "rejected") {
    const { error } = await (supabase as any).from("kyc_documents").update({
      status, reviewed_by: me?.id ?? null, reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    logAudit(`kyc_${status}`, "user", userId, { document_id: id });
    toast.success(`Document ${status}`); loadRelated();
  }

  async function revokeSession(sessionUserId: string) {
    if (!isAdmin) { toast.error("Admin only"); return; }
    const { error } = await (supabase as any).rpc("admin_kick_user", { _user_id: sessionUserId, _reason: "Session revoked by admin" });
    if (error) { toast.error(error.message); return; }
    toast.success("Session revoked"); loadRelated();
  }

  async function addNote() {
    if (!newNote.trim()) return;
    const { error } = await (supabase as any).from("admin_user_notes").insert({ user_id: userId, author_id: me?.id, note: newNote.trim() });
    if (error) { toast.error(error.message); return; }
    setNewNote(""); toast.success("Note added"); loadRelated();
  }
  async function deleteNote(id: string) {
    await (supabase as any).from("admin_user_notes").delete().eq("id", id);
    loadRelated();
  }

  if (loading) {
    return <Layout><div className="p-10 text-center text-muted-foreground text-sm">Loading member…</div></Layout>;
  }
  if (!user) {
    return (
      <Layout>
        <div className="p-10 text-center space-y-3">
          <div className="text-sm text-muted-foreground">Member not found.</div>
          <Link to="/admin"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1" />Back to Members</Button></Link>
        </div>
      </Layout>
    );
  }

  const initials = (user.full_name ?? user.email ?? "U").split(/\s|@/).filter(Boolean).map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-3 sm:px-5 pb-16">
        {/* Sticky header */}
        <div className="sticky top-0 z-30 -mx-3 sm:-mx-5 px-3 sm:px-5 pt-4 pb-3 backdrop-blur-xl bg-background/85 border-b border-primary/20">
          <Link to="/admin" className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.24em] text-primary/80 hover:text-primary transition mb-3">
            <ArrowLeft className="h-3.5 w-3.5" />Back to Members
          </Link>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:flex lg:flex-wrap lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative shrink-0">
                <div className="absolute inset-[-5px] rounded-2xl blur-lg bg-[radial-gradient(circle,oklch(0.82_0.17_90/0.5),transparent_70%)]" />
                <div className="relative h-14 w-14 rounded-2xl border-2 border-primary/70 bg-card grid place-items-center overflow-hidden shadow-gold">
                  {user.avatar_url
                    ? <img src={user.avatar_url} alt={user.full_name ?? "Member avatar"} className="h-full w-full object-cover" />
                    : <span className="font-display text-lg admin-user-foil">{initials}</span>}
                </div>
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg sm:text-2xl font-black admin-user-foil leading-tight">{user.full_name || "Unnamed member"}</h1>
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${user.is_banned ? "border-destructive/50 text-destructive bg-destructive/10" : "border-emerald-400/50 text-emerald-300 bg-emerald-500/10"}`}>
                    {user.is_banned ? "BANNED" : "ACTIVE"}
                  </span>
                  {user.is_muted && <span className="text-[9px] px-2 py-0.5 rounded-full font-bold border border-amber-400/50 text-amber-300 bg-amber-500/10">MUTED</span>}
                  {user.is_restricted && <span className="text-[9px] px-2 py-0.5 rounded-full font-bold border border-orange-400/50 text-orange-300 bg-orange-500/10">RESTRICTED</span>}
                  <span className="text-[11px] text-muted-foreground truncate">{user.email}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" className="btn-luxury h-9 font-bold" onClick={saveProfile}>Save Profile</Button>
              {isAdmin && (
                <Button
                  size="sm"
                  variant={user.is_banned ? "outline" : "destructive"}
                  className="h-9 font-bold"
                  onClick={() => { setSection("moderation"); if (user.is_banned) flagAction("is_banned", false, "ban_reason"); }}
                >
                  <Lock className="h-3.5 w-3.5 mr-1" />{user.is_banned ? "Unban" : "Suspend / Ban"}
                </Button>
              )}
            </div>
          </div>

          {/* Quick stat chips */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {[
              { i: Coins, l: "Tokens", v: (user.token_balance ?? 0).toLocaleString() },
              { i: Activity, l: "Total bets", v: bets.length.toLocaleString() },
              { i: Trophy, l: "Matches won", v: wonCount.toLocaleString() },
              { i: Trophy, l: "Win rate", v: `${winRate}%` },
            ].map((c) => (
              <div key={c.l} className="admin-user-inner rounded-xl px-3 py-1.5 flex items-center gap-2 shrink-0">
                <c.i className="h-3.5 w-3.5 text-primary" />
                <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{c.l}</span>
                <span className="text-sm font-black admin-user-foil">{c.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Sidebar (desktop) / segmented tabs (mobile) */}
          <nav className="lg:sticky lg:top-[190px] lg:self-start">
            <div className="flex lg:flex-col gap-2 overflow-x-auto pb-1">
              {SECTIONS.map((s) => {
                const active = section === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSection(s.key)}
                    className={`shrink-0 lg:w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold tracking-wide transition border ${
                      active
                        ? "bg-primary/15 text-primary border-primary/50 shadow-gold"
                        : "border-primary/15 text-muted-foreground hover:text-primary hover:border-primary/35"
                    }`}
                  >
                    <s.icon className="h-4 w-4" />{s.label}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="min-w-0 space-y-4">
            {section === "overview" && (
              <Panel title="Profile" subtitle="Core member identity details">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Display name"><Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
                  <Field label="User ID">
                    <div className="flex gap-2">
                      <Input readOnly value={String(user.id)} className="font-mono text-[11px]" />
                      <Button className="btn-luxury shrink-0" onClick={() => { navigator.clipboard?.writeText(String(user.id)); toast.success("User ID copied"); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </Field>
                  <Field label="Email / login"><Input readOnly value={form.email ?? ""} className="bg-muted/40" /></Field>
                  <Field label="Phone"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                  <Field label="Discord"><Input value={form.discord_username ?? ""} onChange={(e) => setForm({ ...form, discord_username: e.target.value })} /></Field>
                  <Field label="Discord full name"><Input value={form.discord_full_name ?? ""} onChange={(e) => setForm({ ...form, discord_full_name: e.target.value })} /></Field>
                  <Field label="Country"><Input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
                  <Field label="Gang name"><Input value={form.gang_name ?? ""} onChange={(e) => setForm({ ...form, gang_name: e.target.value })} /></Field>
                </div>
                <Button className="btn-luxury w-full h-11 mt-4 font-bold" onClick={saveProfile}>Save Profile</Button>
              </Panel>
            )}

            {section === "financials" && (
              <>
                <Panel title="Wallet" subtitle="Current balance and token management">
                  <div className="grid sm:grid-cols-[200px_minmax(0,1fr)] gap-4 items-start">
                    <div className="admin-user-inner rounded-2xl p-4 text-center">
                      <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Balance</div>
                      <div className="text-3xl font-black gradient-gold-text mt-1">{(user.token_balance ?? 0).toLocaleString()}</div>
                    </div>
                    {isAdmin ? (
                      <div className="space-y-3">
                        <div className="grid sm:grid-cols-2 gap-3">
                          <Field label="Amount (negative to deduct)">
                            <Input type="number" value={tokenDelta || ""} onChange={(e) => setTokenDelta(Number(e.target.value))} />
                          </Field>
                          <Field label="Reason (required)">
                            <Input value={tokenReason} onChange={(e) => setTokenReason(e.target.value)} />
                          </Field>
                        </div>
                        <Button className="btn-luxury h-10 w-full font-bold" onClick={applyTokens}>Apply adjustment</Button>
                      </div>
                    ) : <Empty text="Token management is admin-only." />}
                  </div>
                </Panel>

                <Panel title={`Deposits (${deposits.length})`} subtitle="Token purchase / top-up requests">
                  {deposits.length === 0 ? <Empty text="No deposits recorded yet." /> : (
                    <div className="space-y-2">
                      {deposits.map((d) => (
                        <div key={d.id} className="admin-user-inner rounded-xl p-3 text-[11px] flex items-center justify-between gap-3 flex-wrap">
                          <span className="font-bold text-emerald-300">+{Number(d.amount).toLocaleString()} tokens</span>
                          <span className="text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] uppercase ${d.status === "approved" ? "text-emerald-300 border-emerald-400/40 bg-emerald-500/10" : d.status === "rejected" ? "text-destructive border-destructive/40 bg-destructive/10" : "text-muted-foreground border-border"}`}>{d.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title={`Withdrawals (${withdrawals.length})`} subtitle="Payout requests">
                  {withdrawals.length === 0 ? <Empty text="No withdrawal requests yet." /> : (
                    <div className="space-y-2">
                      {withdrawals.map((w) => (
                        <div key={w.id} className="admin-user-inner rounded-xl p-3 text-[11px] space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold">{Number(w.amount).toLocaleString()} tokens</span>
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] uppercase ${w.status === "approved" ? "text-emerald-300 border-emerald-400/40 bg-emerald-500/10" : w.status === "rejected" ? "text-destructive border-destructive/40 bg-destructive/10" : "text-muted-foreground border-border"}`}>{w.status}</span>
                          </div>
                          <div className="text-muted-foreground">To <span className="text-foreground font-bold">{w.ingame_name}</span> ({w.gang_name})</div>
                          <div className="text-muted-foreground">Requested {new Date(w.created_at).toLocaleString()}{w.reviewed_by ? ` · reviewed by ${actorMap[w.reviewed_by] ?? "—"}` : ""}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title={`Token transactions (${tx.length})`}>
                  {tx.length === 0 ? <Empty text="No token movement yet." /> : (
                    <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                      {tx.map((t) => {
                        const isIn = Number(t.amount) > 0;
                        return (
                          <div key={t.id} className="admin-user-inner rounded-lg px-3 py-2 text-[11px] flex items-center justify-between gap-3">
                            <span className="truncate text-muted-foreground">{String(t.kind).replace(/_/g, " ")}</span>
                            <span className="text-muted-foreground shrink-0">{new Date(t.created_at).toLocaleDateString()}</span>
                            <span className={`shrink-0 font-bold ${isIn ? "text-emerald-300" : "text-destructive"}`}>{isIn ? "+" : ""}{Number(t.amount).toLocaleString()}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Panel>
              </>
            )}

            {section === "activity" && (
              <>
                <Panel title={`Betting history (${bets.length})`} subtitle="Most recent 50 tickets">
                  {bets.length === 0 ? <Empty text="This member has not placed any bets." /> : (
                    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                      {bets.map((b) => {
                        const sels = b.bet_selections ?? [];
                        const cls = b.status === "won" ? "text-emerald-300 border-emerald-400/40 bg-emerald-500/10"
                          : b.status === "lost" ? "text-destructive border-destructive/40 bg-destructive/10"
                          : "text-muted-foreground border-border bg-muted/20";
                        return (
                          <div key={b.id} className="admin-user-inner rounded-xl p-3 text-[11px] space-y-1.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-mono font-bold truncate">{b.tracking_id}</span>
                              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${cls}`}>{b.status}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-muted-foreground flex-wrap">
                              <span><Clock className="h-3 w-3 inline mr-1" />{new Date(b.created_at).toLocaleString()}</span>
                              <span className="font-bold text-foreground">{Number(b.stake).toLocaleString()} → <span className="text-primary">{Number(b.potential_payout).toLocaleString()}</span></span>
                            </div>
                            {sels.length > 0 && (
                              <div className="border-t border-border/40 pt-1.5 space-y-1">
                                {sels.map((s: any) => (
                                  <div key={s.id} className="flex items-center justify-between gap-2">
                                    <span className="truncate"><span className="text-muted-foreground">{s.markets?.name}:</span> <span className="font-bold">{s.selection_label}</span> — {s.matches?.name}</span>
                                    <span className={`shrink-0 font-mono ${s.result === "won" ? "text-emerald-300" : s.result === "lost" ? "text-destructive" : "text-muted-foreground"}`}>{Number(s.locked_odds).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Panel>

                <Panel title="Match history" subtitle="Matches this member wagered on">
                  {(() => {
                    const matches = new Map<string, any>();
                    bets.forEach((b) => (b.bet_selections ?? []).forEach((s: any) => {
                      const name = s.matches?.name;
                      if (name && !matches.has(name)) matches.set(name, { name, status: s.matches?.status, score: `${s.matches?.home_score ?? "-"} : ${s.matches?.away_score ?? "-"}`, result: s.result });
                    }));
                    const rows = Array.from(matches.values());
                    if (!rows.length) return <Empty text="No match participation recorded." />;
                    return (
                      <div className="space-y-1.5">
                        {rows.map((m) => (
                          <div key={m.name} className="admin-user-inner rounded-lg px-3 py-2 text-[11px] flex items-center justify-between gap-3">
                            <span className="truncate font-semibold">{m.name}</span>
                            <span className="text-muted-foreground shrink-0">{m.score}</span>
                            <span className="uppercase text-[10px] text-primary shrink-0">{m.status}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </Panel>
              </>
            )}

            {section === "security" && (
              <>
                <Panel title={`KYC documents (${kyc.length})`} subtitle="Identity verification uploads">
                  {kyc.length === 0 ? <Empty text="No KYC documents uploaded for this member yet." /> : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {kyc.map((d) => (
                        <div key={d.id} className="admin-user-inner rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1"><FileText className="h-3.5 w-3.5 text-primary" />{String(d.doc_type).replace(/_/g, " ")}</span>
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] uppercase ${d.status === "approved" ? "text-emerald-300 border-emerald-400/40 bg-emerald-500/10" : d.status === "rejected" ? "text-destructive border-destructive/40 bg-destructive/10" : "text-amber-300 border-amber-400/40 bg-amber-500/10"}`}>{d.status}</span>
                          </div>
                          {d.file_url && (
                            <a href={d.file_url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-primary/20">
                              <img src={d.file_url} alt="KYC document" className="w-full h-32 object-cover" />
                            </a>
                          )}
                          <div className="text-[10px] text-muted-foreground">Uploaded {new Date(d.created_at).toLocaleString()}</div>
                          {d.status === "pending" && isMod && (
                            <div className="flex gap-2">
                              <Button size="sm" className="h-8 flex-1 btn-luxury" onClick={() => reviewKyc(d.id, "approved")}><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>
                              <Button size="sm" variant="destructive" className="h-8 flex-1" onClick={() => reviewKyc(d.id, "rejected")}><X className="h-3.5 w-3.5 mr-1" />Reject</Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title={`Login sessions (${sessions.length})`} subtitle="Device, location and last activity">
                  {sessions.length === 0 ? <Empty text="No session activity recorded." /> : (
                    <div className="space-y-2">
                      {sessions.map((s, i) => (
                        <div key={`${s.user_id}-${i}`} className="admin-user-inner rounded-xl p-3 text-[11px] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                          <div className="min-w-0">
                            <div className="font-bold flex items-center gap-1.5 truncate">
                              <Smartphone className="h-3.5 w-3.5 text-primary shrink-0" />
                              {s.device_type ?? "Unknown device"}{s.browser ? ` · ${s.browser}` : ""}{s.os ? ` · ${s.os}` : ""}
                            </div>
                            <div className="text-muted-foreground truncate">IP {s.ip_address ?? "—"} · Route {s.route ?? "—"}</div>
                            <div className="text-muted-foreground">Last active {s.last_seen ? new Date(s.last_seen).toLocaleString() : "—"}</div>
                          </div>
                          {isAdmin && <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => revokeSession(s.user_id)}><LogOut className="h-3.5 w-3.5 mr-1" />Revoke</Button>}
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title="Device / IP log" subtitle="Raw user agents seen on this account">
                  {sessions.length === 0 ? <Empty text="No device logs available." /> : (
                    <div className="space-y-1.5">
                      {sessions.map((s, i) => (
                        <div key={`ua-${i}`} className="admin-user-inner rounded-lg px-3 py-2 text-[10px] font-mono text-muted-foreground break-all">
                          {s.ip_address ?? "0.0.0.0"} — {s.user_agent ?? "unknown agent"}
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </>
            )}

            {section === "moderation" && (
              <>
                <Panel title="Ban & suspension" subtitle="Restrictive actions require a reason">
                  <div className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Field label="Duration">
                        <Select value={banDuration} onValueChange={setBanDuration}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="24h">24 hours</SelectItem>
                            <SelectItem value="7d">7 days</SelectItem>
                            <SelectItem value="30d">30 days</SelectItem>
                            <SelectItem value="permanent">Permanent</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Reason"><Input value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="Reason for this action" /></Field>
                    </div>
                    <div className="grid gap-2">
                      {isAdmin ? (
                        <Button variant={user.is_banned ? "outline" : "destructive"} className="h-11 justify-start" onClick={() => flagAction("is_banned", !user.is_banned, "ban_reason")}>
                          <Lock className="h-4 w-4 mr-2" />{user.is_banned ? "Unban user" : "Ban user from platform"}
                        </Button>
                      ) : <Button variant="outline" disabled className="h-11 justify-start opacity-60"><Lock className="h-4 w-4 mr-2" />Ban (admin only)</Button>}
                      <Button variant={user.is_muted ? "outline" : "destructive"} className="h-11 justify-start" onClick={() => flagAction("is_muted", !user.is_muted, "mute_reason")}>
                        <MessageSquare className="h-4 w-4 mr-2" />{user.is_muted ? "Unmute chat" : "Mute in chat"}
                      </Button>
                      <Button variant={user.is_restricted ? "outline" : "destructive"} className="h-11 justify-start" onClick={() => flagAction("is_restricted", !user.is_restricted, "restrict_reason")}>
                        <AlertTriangle className="h-4 w-4 mr-2" />{user.is_restricted ? "Allow betting" : "Restrict betting"}
                      </Button>
                      {isAdmin && (
                        <Button variant="destructive" className="h-11 justify-start" onClick={kickUser}>
                          <LogOut className="h-4 w-4 mr-2" />Kick active session
                        </Button>
                      )}
                    </div>
                  </div>
                </Panel>

                <Panel title="Roles & permissions" subtitle="Grants access across the platform">
                  {isAdmin ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2 min-h-[36px]">
                        {roles.length === 0 && <div className="text-xs text-muted-foreground">No roles assigned.</div>}
                        {roles.map((r) => (
                          <Badge key={r} variant="outline" className="border-primary/40 text-primary bg-primary/10 px-3 py-1">
                            {ROLE_LABELS[r as AppRole] ?? r}
                            <button onClick={() => removeRole(r)} className="ml-2 text-destructive hover:scale-110">×</button>
                          </Badge>
                        ))}
                      </div>
                      <Field label="Add role">
                        <Select onValueChange={(v) => addRole(v as AppRole)}>
                          <SelectTrigger><SelectValue placeholder="Add role…" /></SelectTrigger>
                          <SelectContent>
                            {(["viewer", "shooter", "gang_leader", "registered", "sponsor", "moderator", "admin"] as AppRole[]).map((r) => (
                              <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  ) : <Empty text="Role management is admin-only." />}
                </Panel>

                <Panel title={`Admin notes (${notes.length})`} subtitle="Private staff notes — never shown to the member">
                  <div className="space-y-3">
                    <Textarea rows={3} value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add an internal note about this member…" />
                    <Button className="btn-luxury h-10 font-bold" onClick={addNote}>Add note</Button>
                    {notes.length === 0 ? <Empty text="No notes yet." /> : (
                      <div className="space-y-2">
                        {notes.map((n) => (
                          <div key={n.id} className="admin-user-inner rounded-xl p-3 text-[11px] space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-primary">{actorMap[n.author_id] ?? "Staff"}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                                <button onClick={() => deleteNote(n.id)} className="text-destructive hover:scale-110">×</button>
                              </div>
                            </div>
                            <div className="whitespace-pre-wrap">{n.note}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel title={`Audit log (${audits.length})`} subtitle="Timestamped actions taken on this account">
                  {audits.length === 0 ? <Empty text="No admin actions recorded." /> : (
                    <div className="relative pl-4 space-y-3 border-l border-primary/25 max-h-[420px] overflow-y-auto">
                      {audits.map((a) => (
                        <div key={a.id} className="relative">
                          <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-gradient-gold border-2 border-background" />
                          <div className="text-[11px]">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-bold capitalize">{String(a.action).replace(/_/g, " ")}</span>
                              <span className="text-muted-foreground"><Clock className="h-3 w-3 inline mr-1" />{new Date(a.created_at).toLocaleString()}</span>
                            </div>
                            <div className="text-muted-foreground">By <span className="font-bold text-foreground">{actorMap[a.actor_id] ?? a.actor_id?.slice(0, 8) ?? "system"}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
