import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Coins, Gamepad2, Sparkles, CircleDollarSign } from "lucide-react";

export const Route = createFileRoute("/arcade")({
  head: () => ({
    meta: [
      { title: "Arcade — Coin Flip, Wheel & Scratch Cards | ECB" },
      { name: "description", content: "Play ECB arcade games: flip a coin, spin the wheel of fortune and reveal scratch cards to multiply your tokens." },
      { property: "og:title", content: "ECB Arcade" },
      { property: "og:description", content: "Coin flip, wheel of fortune and scratch cards." },
    ],
  }),
  component: ArcadePage,
});

function ArcadePage() {
  const { user, profile, refresh } = useAuth();
  const [s, setS] = useState<any>(null);

  async function load() {
    const { data } = await (supabase as any).from("app_settings")
      .select("coinflip_enabled,coinflip_min,coinflip_max,coinflip_payout,wheel_enabled,wheel_min,wheel_max,scratch_enabled,scratch_price")
      .eq("id", 1).maybeSingle();
    setS(data ?? {});
  }
  useEffect(() => { load(); }, []);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10">
        <div className="relative overflow-hidden rounded-3xl p-8 mb-8 border border-primary/30 bg-gradient-to-br from-fuchsia-500/10 via-background to-background">
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-gold grid place-items-center shadow-gold"><Gamepad2 className="h-7 w-7 text-background" /></div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold gradient-gold-text">Arcade</h1>
              <p className="text-sm text-muted-foreground">Quick games of chance. Win big, instantly.</p>
            </div>
          </div>
          {user && <p className="text-xs text-muted-foreground mt-3">Balance: <span className="text-primary font-bold">{profile?.token_balance?.toLocaleString() ?? 0}</span> tokens</p>}
        </div>

        {!user && <Card className="p-8 text-center"><p>Please <Link to="/login" className="text-primary underline">sign in</Link> to play.</p></Card>}

        {user && s && (
          <Tabs defaultValue="coinflip">
            <TabsList className="grid grid-cols-3 max-w-md mb-6">
              <TabsTrigger value="coinflip">Coin Flip</TabsTrigger>
              <TabsTrigger value="wheel">Wheel</TabsTrigger>
              <TabsTrigger value="scratch">Scratch</TabsTrigger>
            </TabsList>
            <TabsContent value="coinflip"><CoinFlip s={s} onDone={() => { refresh(); }} /></TabsContent>
            <TabsContent value="wheel"><Wheel s={s} onDone={() => { refresh(); }} /></TabsContent>
            <TabsContent value="scratch"><Scratch s={s} onDone={() => { refresh(); }} /></TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}

function CoinFlip({ s, onDone }: { s: any; onDone: () => void }) {
  const min = Number(s.coinflip_min ?? 100000);
  const [choice, setChoice] = useState<"heads" | "tails">("heads");
  const [stake, setStake] = useState(min);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<any>(null);
  if (!s.coinflip_enabled) return <Card className="p-8 text-center text-muted-foreground">Coin flip is currently closed.</Card>;

  async function play() {
    setBusy(true); setLast(null);
    const { data, error } = await (supabase.rpc as any)("play_coinflip", { _choice: choice, _stake: stake });
    if (error) { setBusy(false); return toast.error(error.message); }
    await new Promise((r) => setTimeout(r, 1100));
    setBusy(false);
    setLast(data);
    if (data.payout > 0) toast.success(`It's ${data.outcome}! You won ${Number(data.payout).toLocaleString()} tokens 🎉`);
    else toast.error(`It's ${data.outcome}. Better luck next time.`);
    onDone();
  }
  return (
    <Card className={`relative overflow-hidden p-8 max-w-lg mx-auto border-2 border-amber-400/50 bg-gradient-to-b from-black/40 via-background to-black/60 shadow-[0_0_60px_-15px_rgba(212,175,55,0.5)] text-center space-y-5 ${last?.payout > 0 ? "animate-win-glow" : ""}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-gold" />
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300/70 font-bold">Premium Coin Flip</div>
      <div className="relative grid place-items-center py-6" style={{ perspective: "1000px" }}>
        <div className="absolute h-56 w-56 rounded-full border border-amber-400/20 shadow-[0_0_50px_-5px_rgba(212,175,55,0.4)]" />
        <div className="absolute h-48 w-48 rounded-full border border-amber-400/30" />
        <div
          key={busy ? "flip" : last ? last.outcome : "idle"}
          className={`relative grid place-items-center h-48 w-48 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff7d6,transparent_35%),linear-gradient(145deg,#fde68a_0%,#d4af37_35%,#8a6d1f_75%,#4a3a10_100%)] border-[3px] border-amber-200/60 shadow-[0_20px_60px_-10px_rgba(212,175,55,0.8),inset_0_2px_6px_rgba(255,255,255,0.5),inset_0_-6px_14px_rgba(0,0,0,0.4)] text-8xl ${busy ? "animate-coin-flip" : "animate-coin-idle"}`}
        >
          <span className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{busy ? "🪙" : last ? (last.outcome === "heads" ? "👑" : "⚡") : "🪙"}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
        {(["heads", "tails"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setChoice(c)}
            disabled={busy}
            className={`relative flex items-center justify-center gap-2 h-14 rounded-xl border-2 font-black text-sm uppercase tracking-wide transition-all ${choice === c ? "border-amber-300 bg-gradient-to-b from-amber-400/30 to-amber-600/20 text-amber-200 shadow-[0_0_20px_-4px_rgba(212,175,55,0.7)]" : "border-primary/20 bg-black/20 text-muted-foreground hover:border-amber-400/40 hover:text-foreground"}`}
          >
            {c === "heads" ? "👑 Heads" : "⚡ Tails"}
          </button>
        ))}
      </div>
      <div className="max-w-xs mx-auto space-y-1">
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Stake</label>
        <div className="relative">
          <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400" />
          <Input type="number" value={stake} min={min} disabled={busy} onChange={(e) => setStake(Number(e.target.value))} className="pl-9 h-12 text-base font-bold border-amber-400/30 bg-black/20 focus-visible:ring-amber-400/40" />
        </div>
      </div>
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Win pays</span>
        <span className="text-emerald-300 font-black text-lg">{(stake * Number(s.coinflip_payout ?? 1.95)).toLocaleString()}</span>
        <span className="text-[10px] text-emerald-400/70 font-bold">({Number(s.coinflip_payout ?? 1.95)}x)</span>
      </div>
      <Button className="w-full h-14 text-base font-black tracking-wide bg-gradient-to-b from-amber-300 to-amber-600 hover:from-amber-200 hover:to-amber-500 text-black shadow-[0_10px_30px_-6px_rgba(212,175,55,0.7)] border border-amber-200/50" onClick={play} disabled={busy}>
        {busy ? "Flipping…" : "Flip Coin"}
      </Button>
      {last && !busy && (
        <div className="animate-prize-pop">
          <Badge variant="outline" className={last.payout > 0 ? "border-emerald-500/50 text-emerald-300 text-sm px-4 py-1.5" : "border-destructive/50 text-destructive text-sm px-4 py-1.5"}>
            {last.payout > 0 ? `🎉 WON ${Number(last.payout).toLocaleString()}` : "😔 LOST"}
          </Badge>
        </div>
      )}
    </Card>
  );
}
function Wheel({ s, onDone }: { s: any; onDone: () => void }) {
  const min = Number(s.wheel_min ?? 100000);
  const [stake, setStake] = useState(min);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<any>(null);
  if (!s.wheel_enabled) return <Card className="p-8 text-center text-muted-foreground">The wheel is currently closed.</Card>;
  async function play() {
    setBusy(true); setLast(null);
    const { data, error } = await (supabase.rpc as any)("play_wheel", { _stake: stake });
    if (error) { setBusy(false); return toast.error(error.message); }
    await new Promise((r) => setTimeout(r, 2400));
    setBusy(false);
    setLast(data);
    if (data.payout > 0) toast.success(`Landed on ${data.outcome}! Won ${Number(data.payout).toLocaleString()} 🎉`);
    else toast.error(`Landed on ${data.outcome}. No win this time.`);
    onDone();
  }
  return (
    <Card className={`relative overflow-hidden p-8 max-w-lg mx-auto border-2 border-amber-400/50 bg-gradient-to-b from-black/40 via-background to-black/60 shadow-[0_0_60px_-15px_rgba(212,175,55,0.5)] text-center space-y-5 ${last?.payout > 0 ? "animate-win-glow" : ""}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-gold" />
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-fuchsia-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300/70 font-bold">Wheel of Fortune</div>
      <div className="relative grid place-items-center py-6">
        <div className="absolute h-72 w-72 rounded-full border border-amber-400/20 shadow-[0_0_60px_-5px_rgba(212,175,55,0.35)]" />
        <div className="absolute -top-3 z-20 text-3xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">🔻</div>
        <div className="relative h-64 w-64 rounded-full p-[6px] bg-gradient-to-br from-amber-200 via-amber-500 to-amber-800 shadow-[0_25px_60px_-12px_rgba(212,175,55,0.75)]">
          <div
            key={busy ? "spin" : "still"}
            className={`relative h-full w-full rounded-full grid place-items-center text-4xl border-[3px] border-black/40 ${busy ? "animate-wheel-spin" : ""}`}
            style={{ background: "conic-gradient(#f59e0b 0 45deg,#d946ef 45deg 90deg,#10b981 90deg 135deg,#3b82f6 135deg 180deg,#ef4444 180deg 225deg,#a855f7 225deg 270deg,#eab308 270deg 315deg,#06b6d4 315deg 360deg)" }}
          >
            <div className="absolute inset-0 rounded-full" style={{ background: "repeating-conic-gradient(rgba(0,0,0,0.18) 0 2deg, transparent 2deg 45deg)" }} />
            <span className="relative h-16 w-16 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff7d6,transparent_35%),linear-gradient(145deg,#fde68a_0%,#d4af37_40%,#8a6d1f_80%,#4a3a10_100%)] border-2 border-amber-200/70 grid place-items-center text-2xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.5),inset_0_-4px_10px_rgba(0,0,0,0.4),0_6px_18px_-4px_rgba(0,0,0,0.6)]">
              🎯
            </span>
          </div>
        </div>
      </div>
      <div className="inline-flex flex-wrap justify-center gap-1.5">
        {["0x","0.5x","1.2x","1.5x","2x","3x","5x"].map((m) => (
          <span key={m} className="text-[10px] font-bold px-2 py-1 rounded-full border border-amber-400/30 bg-amber-400/5 text-amber-200/80">{m}</span>
        ))}
      </div>
      <div className="max-w-xs mx-auto space-y-1">
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Stake</label>
        <div className="relative">
          <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400" />
          <Input type="number" value={stake} min={min} disabled={busy} onChange={(e) => setStake(Number(e.target.value))} className="pl-9 h-12 text-base font-bold border-amber-400/30 bg-black/20 focus-visible:ring-amber-400/40" />
        </div>
      </div>
      <Button className="w-full h-14 text-base font-black tracking-wide bg-gradient-to-b from-amber-300 to-amber-600 hover:from-amber-200 hover:to-amber-500 text-black shadow-[0_10px_30px_-6px_rgba(212,175,55,0.7)] border border-amber-200/50" onClick={play} disabled={busy}>
        {busy ? "Spinning…" : "Spin the Wheel"}
      </Button>
      {last && !busy && (
        <div className="animate-prize-pop">
          <Badge variant="outline" className={last.payout > 0 ? "border-emerald-500/50 text-emerald-300 text-sm px-4 py-1.5" : "border-destructive/50 text-destructive text-sm px-4 py-1.5"}>
            {last.outcome} · {last.payout > 0 ? `🎉 WON ${Number(last.payout).toLocaleString()}` : "NO WIN"}
          </Badge>
        </div>
      )}
    </Card>
  );
}

function Scratch({ s, onDone }: { s: any; onDone: () => void }) {
  const price = Number(s.scratch_price ?? 500000);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<any>(null);
  if (!s.scratch_enabled) return <Card className="p-8 text-center text-muted-foreground">Scratch cards are currently closed.</Card>;
  async function play() {
    setBusy(true); setLast(null);
    const { data, error } = await (supabase.rpc as any)("play_scratch", {});
    if (error) { setBusy(false); return toast.error(error.message); }
    await new Promise((r) => setTimeout(r, 1200));
    setBusy(false);
    setLast(data);
    if (data.payout > 0) toast.success(`You revealed ${data.outcome}! Won ${Number(data.payout).toLocaleString()} 🎉`);
    else toast.error(`No prize this card. Try again!`);
    onDone();
  }
  return (
    <Card className={`p-6 max-w-md mx-auto border-primary/30 text-center space-y-4 ${last?.payout > 0 ? "animate-win-glow" : ""}`}>
      <div className={`relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-amber-500/10 to-fuchsia-500/10 p-10 ${busy ? "animate-scratch-shimmer" : ""}`}>
        <div className={`text-7xl mb-2 ${last && !busy ? "animate-prize-pop" : ""}`}>{busy ? "✨" : last ? (last.payout > 0 ? "💎" : "🃏") : "🎫"}</div>
        <div className="text-sm font-bold">{busy ? "Scratching…" : last ? (last.payout > 0 ? `${last.outcome} — ${Number(last.payout).toLocaleString()} tokens!` : "No prize") : "Buy a card to reveal your prize"}</div>
      </div>
      <div className="text-xs text-muted-foreground">Card price: <span className="text-primary font-bold">{price.toLocaleString()}</span> tokens · prizes up to 10x</div>
      <Button className="btn-luxury w-full" onClick={play} disabled={busy}><CircleDollarSign className="h-4 w-4 mr-1" />{busy ? "Revealing…" : "Buy & Scratch"}</Button>
    </Card>
  );
}
