import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Swords, Coins, ArrowLeft, CheckCircle2, XCircle, Upload, Ban, ShieldAlert, Trophy, Clock,
} from "lucide-react";
import {
  acceptWager, rejectWager, requestTermination, submitPayment,
  type Wager, type WagerPayment,
} from "@/lib/wagers";

export const Route = createFileRoute("/wagers/$id")({
  head: ({ params }) => ({ meta: [{ title: `Wager ${params.id.slice(0, 8)} — ECB` }, { name: "robots", content: "noindex" }] }),
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
};

function Page() {
  const { id } = useParams({ from: "/wagers/$id" });
  const { user } = useAuth();
  const [w, setW] = useState<Wager | null>(null);
  const [payments, setPayments] = useState<WagerPayment[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from("wagers").select("*").eq("id", id).maybeSingle();
    setW(data as any);
    const { data: p } = await supabase.from("wager_payments").select("*").eq("wager_id", id).order("created_at", { ascending: false });
    setPayments((p as any) ?? []);
    const { data: ev } = await supabase.from("wager_live_events").select("*").eq("wager_id", id).order("created_at", { ascending: false }).limit(50);
    setEvents((ev as any) ?? []);
    if (data) {
      const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", [data.challenger_id, data.opponent_id]);
      const map: any = {}; (profs ?? []).forEach((r: any) => map[r.id] = r);
      setProfiles(map);
    }
  }

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    const ch = supabase.channel(`wager-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wagers", filter: `id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "wager_payments", filter: `wager_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "wager_live_events", filter: `wager_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  if (!user) return <Layout><div className="container py-10 text-center">Sign in required.</div></Layout>;
  if (!w) return <Layout><div className="container py-10 text-center text-muted-foreground">Loading wager…</div></Layout>;

  const isChallenger = w.challenger_id === user.id;
  const isParty = isChallenger || w.opponent_id === user.id;
  const myPayment = payments.find((p) => p.user_id === user.id);
  const bothFunded = w.status === "active" || w.status === "live" || w.status === "awaiting_settlement" || w.status === "settled";
  const canPay = isParty && (w.status === "awaiting_payment" || w.status === "awaiting_funding") && !myPayment;
  const canAccept = w.opponent_id === user.id && w.status === "pending_approval";
  const canReject = isParty && ["pending_approval","awaiting_payment"].includes(w.status);

  const challenger = profiles[w.challenger_id];
  const opponent = profiles[w.opponent_id];

  async function doAccept() { setBusy(true); try { await acceptWager(w!.id); toast.success("Accepted"); } catch (e: any) { toast.error(e.message); } finally { setBusy(false); } }
  async function doReject() {
    const reason = prompt("Reason (optional)") ?? "";
    setBusy(true); try { await rejectWager(w!.id, reason); toast.success("Rejected"); } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function doTerminate() {
    const reason = prompt("Reason for termination request?"); if (!reason) return;
    setBusy(true); try { await requestTermination(w!.id, reason); toast.success("Termination requested — awaiting opponent & admin"); } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <Layout>
      <div className="container py-8 max-w-4xl">
        <Link to="/wagers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" />Back to wagers
        </Link>

        {/* Premium slip */}
        <Card className="glass-strong border-primary/40 mt-4 overflow-hidden relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-gold" />
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Wager ID</div>
                <div className="font-black text-2xl gradient-gold-text">{w.public_id}</div>
              </div>
              <Badge className={`uppercase text-[10px] ${STATUS_TONE[w.status] || ""}`} variant="outline">{w.status.replace(/_/g, " ")}</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 items-center">
              <PartyCard label="Challenger" name={challenger?.username || w.challenger_id.slice(0, 8)} avatar={challenger?.avatar_url} highlight={w.winner_id === w.challenger_id} />
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Stake each</div>
                <div className="text-3xl font-black gradient-gold-text flex items-center justify-center gap-1"><Coins className="h-5 w-5" />{w.stake.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">Pot {(w.stake * 2).toLocaleString()}</div>
              </div>
              <PartyCard label="Opponent" name={opponent?.username || w.opponent_id.slice(0, 8)} avatar={opponent?.avatar_url} highlight={w.winner_id === w.opponent_id} />
            </div>

            {w.event_label && (
              <div className="mt-4 text-center">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Event</div>
                <div className="font-bold">{w.event_label}</div>
              </div>
            )}
            {w.agreement && (
              <div className="mt-3 border border-primary/20 bg-background/30 rounded-md p-3 text-xs">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Agreement</div>
                {w.agreement}
              </div>
            )}
            {w.status === "settled" && (
              <div className="mt-4 rounded-md border border-primary/40 bg-primary/10 p-3 text-center">
                {w.is_draw
                  ? <div className="font-bold text-primary">Draw — stake split</div>
                  : <div className="font-black text-primary flex items-center justify-center gap-1"><Trophy className="h-4 w-4" />Winner: {(w.winner_id === w.challenger_id ? challenger : opponent)?.username || "—"} • +{w.prize_paid?.toLocaleString()} tokens</div>}
              </div>
            )}
          </div>
        </Card>

        {/* Action panel */}
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <Card className="glass p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Your actions</div>
            <div className="flex flex-wrap gap-2">
              {canAccept && <Button className="btn-luxury" disabled={busy} onClick={doAccept}><CheckCircle2 className="h-4 w-4 mr-1" />Accept</Button>}
              {canReject && <Button variant="outline" disabled={busy} onClick={doReject}><XCircle className="h-4 w-4 mr-1" />Reject</Button>}
              {bothFunded && w.status !== "settled" && (
                <Button variant="outline" disabled={busy} onClick={doTerminate}><Ban className="h-4 w-4 mr-1" />Request termination</Button>
              )}
              {w.status === "disputed" && <Badge variant="outline" className="bg-fuchsia-500/20 text-fuchsia-300"><ShieldAlert className="h-3 w-3 mr-1" />Dispute in review</Badge>}
              {!canAccept && !canReject && w.status === "pending_approval" && (
                <div className="text-xs text-muted-foreground">Waiting for opponent to accept…</div>
              )}
            </div>
            <div className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Created {new Date(w.created_at).toLocaleString()}</div>
          </Card>

          <Card className="glass p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Funding</div>
            {canPay ? <PaymentForm wager={w} onDone={load} /> : (
              <div className="space-y-1 text-xs">
                {payments.length === 0 && <div className="text-muted-foreground">No payments yet.</div>}
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border-b border-primary/10 py-1.5">
                    <span className="truncate">{(profiles[p.user_id]?.username) || p.user_id.slice(0, 6)} • {p.amount.toLocaleString()}</span>
                    <Badge variant="outline" className="text-[9px] uppercase">{p.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Live feed */}
        {(w.status === "live" || w.status === "awaiting_settlement" || events.length > 0) && (
          <Card className="glass p-4 mt-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Live match feed</div>
            {events.length === 0
              ? <div className="text-xs text-muted-foreground">Admin will post live updates here.</div>
              : (
                <ul className="space-y-1.5 text-xs">
                  {events.map((e) => (
                    <li key={e.id} className="border-l-2 border-primary pl-2">
                      <div className="font-bold">{e.kind}</div>
                      <div className="text-muted-foreground">{JSON.stringify(e.payload)}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</div>
                    </li>
                  ))}
                </ul>
              )}
          </Card>
        )}
      </div>
    </Layout>
  );
}

function PartyCard({ label, name, avatar, highlight }: any) {
  return (
    <div className={`rounded-lg border p-3 text-center ${highlight ? "border-primary bg-primary/10" : "border-primary/20 bg-background/30"}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      {avatar ? <img src={avatar} className="h-12 w-12 rounded-full object-cover mx-auto mt-2" alt="" />
        : <div className="h-12 w-12 rounded-full grid place-items-center mx-auto mt-2 bg-primary/10 text-primary font-bold">{(name || "?").slice(0, 2).toUpperCase()}</div>}
      <div className="font-bold text-sm truncate mt-1">{name}</div>
    </div>
  );
}

function PaymentForm({ wager, onDone }: { wager: Wager; onDone: () => void }) {
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      await submitPayment({ wager_id: wager.id, amount: wager.stake, method, reference, file });
      toast.success("Payment submitted — awaiting admin verification");
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-2">
      <div className="text-xs">Stake to fund: <span className="font-bold text-primary">{wager.stake.toLocaleString()} tokens</span></div>
      <Input placeholder="Payment method (bank, mobile money, crypto…)" value={method} onChange={(e) => setMethod(e.target.value)} />
      <Input placeholder="Reference / transaction ID" value={reference} onChange={(e) => setReference(e.target.value)} />
      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Receipt image (optional)</label>
        <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <Button className="btn-luxury w-full" disabled={busy} onClick={submit}><Upload className="h-4 w-4 mr-1" />{busy ? "Submitting…" : "Submit payment proof"}</Button>
    </div>
  );
}
