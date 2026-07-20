import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Swords, Coins, Lock, Search, Plus, User, ShieldCheck, Timer, Trophy,
} from "lucide-react";
import {
  createChallenge, findOpponent, getMyWagerWallet, listMyWagers,
  type Wager, type WagerWallet,
} from "@/lib/wagers";

export const Route = createFileRoute("/wagers")({
  head: () => ({
    meta: [
      { title: "P2P Wagers — ECB" },
      { name: "description", content: "Private player-vs-player wagers with premium bet slips and live match tracking." },
    ],
  }),
  component: Page,
});

const STATUS_TONE: Record<string, string> = {
  pending_approval: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  awaiting_payment: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  awaiting_funding: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  funded: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  live: "bg-red-500/20 text-red-300 border-red-500/40",
  awaiting_settlement: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  settled: "bg-primary/20 text-primary border-primary/40",
  cancelled: "bg-muted/40 text-muted-foreground border-muted",
  refunded: "bg-muted/40 text-muted-foreground border-muted",
  rejected: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  terminated: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  disputed: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40",
};

function Page() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WagerWallet | null>(null);
  const [wagers, setWagers] = useState<Wager[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [tab, setTab] = useState("all");

  async function refresh() {
    if (!user) return;
    const [w, list] = await Promise.all([getMyWagerWallet(user.id), listMyWagers(user.id)]);
    setWallet(w); setWagers(list);
  }
  useEffect(() => { if (user) refresh(); }, [user?.id]);
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`my-wagers-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wagers" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "wager_wallets", filter: `user_id=eq.${user.id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (tab === "all") return wagers;
    if (tab === "open") return wagers.filter((w) => ["pending_approval","awaiting_payment","awaiting_funding"].includes(w.status));
    if (tab === "active") return wagers.filter((w) => ["funded","active","live","awaiting_settlement"].includes(w.status));
    if (tab === "history") return wagers.filter((w) => ["settled","cancelled","refunded","rejected","terminated","disputed"].includes(w.status));
    return wagers;
  }, [wagers, tab]);

  if (!user) return <Layout><div className="container py-10 text-center">Sign in to view wagers.</div></Layout>;

  return (
    <Layout>
      <div className="container py-8 max-w-5xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black gradient-gold-text flex items-center gap-2">
              <Swords className="h-7 w-7" />P2P Wagers
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Private wagers, verified funding, admin-settled. No house edge in the pot.</p>
          </div>
          <Button className="btn-luxury" onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />New Challenge
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <StatCard label="Wager Balance" value={wallet?.balance ?? 0} icon={Coins} tone="text-primary" />
          <StatCard label="Locked in Wagers" value={wallet?.locked_balance ?? 0} icon={Lock} tone="text-amber-400" />
          <StatCard label="Active" value={wagers.filter((w) => ["active","live","funded","awaiting_settlement"].includes(w.status)).length} icon={Timer} tone="text-emerald-400" />
          <StatCard label="Won" value={wagers.filter((w) => w.status === "settled" && w.winner_id === user.id).length} icon={Trophy} tone="text-yellow-400" />
        </div>

        <Card className="glass-strong p-4 mt-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-4 w-full max-w-md">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-4 space-y-2">
              {filtered.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No wagers here yet. Challenge a friend to get started.
                </div>
              )}
              {filtered.map((w) => (
                <WagerRow key={w.id} w={w} viewer={user.id} />
              ))}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
      <CreateChallengeDialog open={openCreate} onOpenChange={setOpenCreate} onCreated={refresh} />
    </Layout>
  );
}

function StatCard({ label, value, icon: Icon, tone }: any) {
  return (
    <Card className="glass p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-2xl font-black flex items-center gap-2 mt-1 ${tone}`}>
        <Icon className="h-5 w-5" />{Number(value).toLocaleString()}
      </div>
    </Card>
  );
}

function WagerRow({ w, viewer }: { w: Wager; viewer: string }) {
  const isChallenger = w.challenger_id === viewer;
  const won = w.status === "settled" && w.winner_id === viewer;
  const lost = w.status === "settled" && w.loser_id === viewer;
  return (
    <Link
      to="/wagers/$id" params={{ id: w.id }}
      className="block rounded-lg border border-primary/20 bg-background/30 hover:bg-background/50 p-3 transition"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 shrink-0">
          <Swords className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">{w.public_id}</span>
            <Badge className={`text-[9px] uppercase ${STATUS_TONE[w.status] || ""}`} variant="outline">{w.status.replace(/_/g, " ")}</Badge>
            {won && <Badge className="text-[9px] bg-emerald-500/20 text-emerald-300 border-emerald-500/40" variant="outline">WON +{w.prize_paid?.toLocaleString()}</Badge>}
            {lost && <Badge className="text-[9px] bg-rose-500/20 text-rose-300 border-rose-500/40" variant="outline">LOST</Badge>}
          </div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {w.event_label || w.bet_type} • {isChallenger ? "You challenged" : "You were challenged"}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-muted-foreground">Stake</div>
          <div className="font-black text-primary">{w.stake.toLocaleString()}</div>
        </div>
      </div>
    </Link>
  );
}

function CreateChallengeDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; username: string | null }[]>([]);
  const [picked, setPicked] = useState<{ id: string; username: string | null } | null>(null);
  const [stake, setStake] = useState(500);
  const [eventLabel, setEventLabel] = useState("");
  const [betType, setBetType] = useState("winner");
  const [agreement, setAgreement] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setPicked(null); setResults([]); setQ(""); setStake(500); setEventLabel(""); setBetType("winner"); setAgreement(""); }, [open]);

  useEffect(() => {
    if (!q || picked) return;
    const t = setTimeout(async () => setResults(await findOpponent(q)), 250);
    return () => clearTimeout(t);
  }, [q, picked]);

  async function submit() {
    if (!user || !picked) return;
    if (picked.id === user.id) { toast.error("You can't challenge yourself"); return; }
    if (stake < 100) { toast.error("Minimum stake is 100 tokens"); return; }
    setBusy(true);
    try {
      await createChallenge({
        opponent_id: picked.id, stake, event_label: eventLabel || null as any,
        bet_type: betType, agreement,
      });
      toast.success("Challenge sent — waiting for opponent to accept");
      onOpenChange(false); onCreated();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-primary/30 max-w-lg">
        <DialogHeader><DialogTitle className="gradient-gold-text flex items-center gap-2"><Swords className="h-5 w-5" />New P2P Challenge</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Opponent</label>
            {picked ? (
              <div className="flex items-center justify-between gap-2 mt-1 border border-primary/30 rounded-md px-3 py-2 bg-background/30">
                <div className="flex items-center gap-2"><User className="h-4 w-4 text-primary" /><span className="font-bold">{picked.username || picked.id.slice(0, 8)}</span></div>
                <Button size="sm" variant="outline" onClick={() => { setPicked(null); setQ(""); }}>Change</Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mt-1">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search username or Discord…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                {results.length > 0 && (
                  <div className="mt-2 border border-primary/20 rounded-md divide-y divide-primary/10 bg-background/40 max-h-48 overflow-y-auto">
                    {results.map((r) => (
                      <button key={r.id} className="w-full text-left px-3 py-2 hover:bg-primary/10 text-sm" onClick={() => setPicked(r)}>
                        {r.username || r.id.slice(0, 8)}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Stake (tokens)</label>
              <Input type="number" min={100} step={100} value={stake} onChange={(e) => setStake(Number(e.target.value))} />
              <div className="text-[10px] text-muted-foreground mt-1">Total pot: {(stake * 2).toLocaleString()}</div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Bet type</label>
              <select value={betType} onChange={(e) => setBetType(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="winner">Winner takes all</option>
                <option value="first_to_score">First to score</option>
                <option value="total_over">Total over</option>
                <option value="handicap">Handicap</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Event label (optional)</label>
            <Input placeholder="e.g. Bo3 e-Football Friendly" value={eventLabel} onChange={(e) => setEventLabel(e.target.value)} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Agreement / Rules</label>
            <Textarea rows={3} placeholder="Any specific rules both sides agree to" value={agreement} onChange={(e) => setAgreement(e.target.value)} />
          </div>
          <div className="text-[11px] text-muted-foreground flex items-start gap-1.5 border border-primary/20 rounded-md p-2 bg-background/30">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
            Both sides must fund off-platform and upload proof. An admin verifies before the wager goes live.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="btn-luxury" disabled={busy || !picked} onClick={submit}>{busy ? "Sending…" : "Send Challenge"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
