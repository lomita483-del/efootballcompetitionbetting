import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Swords, Coins, Trophy, Ban, RefreshCw, Radio } from "lucide-react";
import {
  adminVerifyPayment, adminSettleWager, adminRefundWager, adminTerminateWager, adminPostLiveEvent,
  type Wager, type WagerPayment,
} from "@/lib/wagers";

export function WagersAdminPanel() {
  const [wagers, setWagers] = useState<Wager[]>([]);
  const [payments, setPayments] = useState<WagerPayment[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [q, setQ] = useState("");
  const [live, setLive] = useState<Wager | null>(null);

  async function load() {
    const { data: w } = await supabase.from("wagers").select("*").order("created_at", { ascending: false }).limit(200);
    const { data: p } = await supabase.from("wager_payments").select("*").order("created_at", { ascending: false }).limit(200);
    const { data: d } = await supabase.from("wager_disputes").select("*").order("created_at", { ascending: false }).limit(50);
    setWagers((w as any) ?? []); setPayments((p as any) ?? []); setDisputes((d as any) ?? []);
    const ids = new Set<string>();
    (w ?? []).forEach((r: any) => { ids.add(r.challenger_id); ids.add(r.opponent_id); });
    if (ids.size) {
      const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", Array.from(ids));
      const m: any = {}; (profs ?? []).forEach((r: any) => m[r.id] = r); setProfiles(m);
    }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const ch = supabase.channel("admin-wagers")
      .on("postgres_changes", { event: "*", schema: "public", table: "wagers" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "wager_payments" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filter = (list: Wager[]) => {
    if (!q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter((w) => w.public_id.toLowerCase().includes(s)
      || (profiles[w.challenger_id]?.username || "").toLowerCase().includes(s)
      || (profiles[w.opponent_id]?.username || "").toLowerCase().includes(s));
  };
  const groups = useMemo(() => ({
    pending: filter(wagers.filter((w) => ["pending_approval","awaiting_payment","awaiting_funding"].includes(w.status))),
    active: filter(wagers.filter((w) => ["active","live","awaiting_settlement"].includes(w.status))),
    disputed: filter(wagers.filter((w) => w.status === "disputed")),
    settled: filter(wagers.filter((w) => ["settled","refunded","terminated","rejected","cancelled"].includes(w.status))),
  }), [wagers, q, profiles]);
  const pendingPayments = payments.filter((p) => p.status === "pending");

  const stats = {
    active: wagers.filter((w) => ["active","live"].includes(w.status)).length,
    pending: wagers.filter((w) => ["pending_approval","awaiting_payment","awaiting_funding"].includes(w.status)).length,
    pot: wagers.filter((w) => ["active","live","awaiting_settlement"].includes(w.status)).reduce((a, w) => a + (w.stake * 2), 0),
    disputed: disputes.filter((d: any) => d.status === "open").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Active Wagers" value={stats.active} icon={Swords} tone="text-emerald-400" />
        <Stat label="Pending" value={stats.pending} icon={RefreshCw} tone="text-amber-400" />
        <Stat label="Locked Pot" value={stats.pot} icon={Coins} tone="text-primary" />
        <Stat label="Open Disputes" value={stats.disputed} icon={Ban} tone="text-rose-400" />
      </div>

      {pendingPayments.length > 0 && (
        <Card className="glass-strong p-4 border-amber-500/40">
          <div className="text-xs uppercase tracking-widest text-amber-300 font-bold mb-2">Payments awaiting verification</div>
          <div className="space-y-2">
            {pendingPayments.map((p) => {
              const w = wagers.find((x) => x.id === p.wager_id);
              return (
                <div key={p.id} className="flex items-center gap-3 border border-primary/20 bg-background/30 rounded-md p-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold">{w?.public_id} • {profiles[p.user_id]?.username || p.user_id.slice(0, 6)}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.amount.toLocaleString()} tokens • {p.method || "—"} • {p.reference || "—"}</div>
                  </div>
                  {p.receipt_url && <a href={p.receipt_url} target="_blank" rel="noopener" className="text-xs text-primary underline">Receipt</a>}
                  <Button size="sm" className="btn-luxury" onClick={async () => { try { await adminVerifyPayment(p.id); toast.success("Verified"); } catch (e: any) { toast.error(e.message); } }}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Verify
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="glass-strong p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="font-bold flex items-center gap-2"><Swords className="h-4 w-4 text-primary" />Wagers Queue</div>
          <Input placeholder="Search WGR-… or username" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        </div>
        <Tabs defaultValue="pending">
          <TabsList className="grid grid-cols-4 max-w-lg">
            <TabsTrigger value="pending">Pending ({groups.pending.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({groups.active.length})</TabsTrigger>
            <TabsTrigger value="disputed">Disputed ({groups.disputed.length})</TabsTrigger>
            <TabsTrigger value="settled">History ({groups.settled.length})</TabsTrigger>
          </TabsList>
          {(["pending","active","disputed","settled"] as const).map((k) => (
            <TabsContent key={k} value={k} className="mt-4 space-y-2">
              {groups[k].length === 0 && <div className="text-center text-muted-foreground text-sm py-6">None</div>}
              {groups[k].map((w) => (
                <WagerAdminRow key={w.id} w={w} profiles={profiles} onLive={() => setLive(w)} onChange={load} />
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </Card>

      <LiveControlDialog wager={live} onOpenChange={(o) => !o && setLive(null)} />
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: any) {
  return (
    <Card className="glass p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-2xl font-black mt-1 flex items-center gap-2 ${tone}`}><Icon className="h-5 w-5" />{Number(value).toLocaleString()}</div>
    </Card>
  );
}

function WagerAdminRow({ w, profiles, onLive, onChange }: { w: Wager; profiles: any; onLive: () => void; onChange: () => void }) {
  const [settleOpen, setSettleOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const ch = profiles[w.challenger_id]?.username || w.challenger_id.slice(0, 6);
  const op = profiles[w.opponent_id]?.username || w.opponent_id.slice(0, 6);
  return (
    <div className="border border-primary/20 rounded-lg bg-background/30 p-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-sm">{w.public_id}</span>
            <Badge variant="outline" className="text-[9px] uppercase">{w.status.replace(/_/g, " ")}</Badge>
            <span className="text-xs text-muted-foreground">{w.event_label || w.bet_type}</span>
          </div>
          <div className="text-xs mt-1"><span className="font-bold">{ch}</span> vs <span className="font-bold">{op}</span> • stake <span className="text-primary font-bold">{w.stake.toLocaleString()}</span></div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {["active","live","awaiting_settlement"].includes(w.status) && (
            <Button size="sm" variant="outline" onClick={onLive}><Radio className="h-3.5 w-3.5 mr-1" />Live</Button>
          )}
          {["active","live","awaiting_settlement"].includes(w.status) && (
            <Button size="sm" className="btn-luxury" onClick={() => setSettleOpen(true)}><Trophy className="h-3.5 w-3.5 mr-1" />Settle</Button>
          )}
          {["funded","active","live","awaiting_settlement","disputed"].includes(w.status) && (
            <Button size="sm" variant="outline" onClick={async () => {
              const r = prompt("Refund reason?"); if (r == null) return;
              try { await adminRefundWager(w.id, r); toast.success("Refunded"); onChange(); } catch (e: any) { toast.error(e.message); }
            }}><RefreshCw className="h-3.5 w-3.5 mr-1" />Refund</Button>
          )}
          {w.status !== "settled" && w.status !== "terminated" && (
            <Button size="sm" variant="destructive" onClick={async () => {
              const r = prompt("Terminate reason?"); if (r == null) return;
              try { await adminTerminateWager(w.id, r, true); toast.success("Terminated"); onChange(); } catch (e: any) { toast.error(e.message); }
            }}><Ban className="h-3.5 w-3.5 mr-1" />Terminate</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setChatOpen((v) => !v)}>
            <MessageSquare className="h-3.5 w-3.5 mr-1" />Dispute chat
          </Button>
        </div>
      </div>
      {chatOpen && (
        <div className="mt-3">
          <WagerDisputeThread wagerId={w.id} challengerId={w.challenger_id} opponentId={w.opponent_id} isAdmin />
        </div>
      )}
      <SettleDialog wager={w} open={settleOpen} onOpenChange={setSettleOpen} profiles={profiles} onDone={onChange} />
    </div>
  );
}

function SettleDialog({ wager, open, onOpenChange, profiles, onDone }: any) {
  const [choice, setChoice] = useState<"ch"|"op"|"draw">("ch");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await adminSettleWager({
        wager_id: wager.id,
        winner_id: choice === "draw" ? null : (choice === "ch" ? wager.challenger_id : wager.opponent_id),
        is_draw: choice === "draw",
        final_home: home ? Number(home) : null, final_away: away ? Number(away) : null, notes,
      });
      toast.success("Settled"); onOpenChange(false); onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-primary/30">
        <DialogHeader><DialogTitle>Settle {wager.public_id}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {(["ch","draw","op"] as const).map((k) => (
              <button key={k} onClick={() => setChoice(k)}
                className={`p-2 rounded-md border text-sm font-bold ${choice === k ? "border-primary bg-primary/10 text-primary" : "border-primary/20"}`}>
                {k === "ch" ? (profiles[wager.challenger_id]?.username || "Challenger") : k === "op" ? (profiles[wager.opponent_id]?.username || "Opponent") : "Draw"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Home score" value={home} onChange={(e) => setHome(e.target.value)} type="number" />
            <Input placeholder="Away score" value={away} onChange={(e) => setAway(e.target.value)} type="number" />
          </div>
          <Input placeholder="Settlement notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="btn-luxury" disabled={busy} onClick={go}>{busy ? "…" : "Confirm & Payout"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LiveControlDialog({ wager, onOpenChange }: { wager: Wager | null; onOpenChange: (o: boolean) => void }) {
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setHome(0); setAway(0); setMsg(""); }, [wager?.id]);
  if (!wager) return null;
  async function post(kind: string, payload: any) {
    setBusy(true);
    try { await adminPostLiveEvent(wager!.id, kind, payload); toast.success("Posted"); } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  async function markLive() {
    setBusy(true);
    try { await supabase.from("wagers").update({ status: "live", live_at: new Date().toISOString() }).eq("id", wager!.id); toast.success("Marked live"); } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={!!wager} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-primary/30">
        <DialogHeader><DialogTitle>Live control • {wager.public_id}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {wager.status !== "live" && <Button className="btn-luxury w-full" disabled={busy} onClick={markLive}>Mark match as LIVE</Button>}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Home</label>
              <Input type="number" value={home} onChange={(e) => setHome(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Away</label>
              <Input type="number" value={away} onChange={(e) => setAway(Number(e.target.value))} />
            </div>
          </div>
          <Button variant="outline" className="w-full" disabled={busy} onClick={() => post("score_update", { home, away })}>Post score</Button>
          <Input placeholder="Commentary…" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <Button variant="outline" className="w-full" disabled={busy || !msg} onClick={() => { post("commentary", { text: msg }); setMsg(""); }}>Post commentary</Button>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
