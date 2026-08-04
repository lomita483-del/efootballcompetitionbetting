import { useEffect, useMemo, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Coins, Gift, RotateCw, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

type Segment = { id: string; label: string; outcome_kind: "tokens" | "lost"; reward_amount: number; color_token: string; sort_order: number };
type Campaign = { id: string; title: string; subtitle: string | null; page_path: string; display_mode: string; base_spins_per_user: number; lucky_wheel_segments: Segment[] };

const WHEEL_COLORS: Record<string, string> = {
  gold: "var(--primary)", emerald: "var(--accent)", ruby: "var(--destructive)",
  navy: "var(--secondary)", violet: "var(--ring)", silver: "var(--muted)",
};

export function LuckyWheelPopout() {
  const { user, refresh } = useAuth();
  const location = useLocation();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [open, setOpen] = useState(false);
  const [spins, setSpins] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ label: string; kind: string; amount: number } | null>(null);

  useEffect(() => {
    if (!user) { setCampaign(null); setOpen(false); return; }
    let alive = true;
    const load = async () => {
      const now = new Date().toISOString();
      const { data } = await (supabase as any).from("lucky_wheel_campaigns")
        .select("id,title,subtitle,page_path,display_mode,base_spins_per_user,lucky_wheel_segments(id,label,outcome_kind,reward_amount,color_token,sort_order)")
        .eq("is_active", true).in("page_path", [location.pathname, "all"])
        .or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gte.${now}`)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!alive || !data) return;
      const next = { ...data, lucky_wheel_segments: (data.lucky_wheel_segments ?? []).sort((a: Segment, b: Segment) => a.sort_order - b.sort_order) } as Campaign;
      if (next.lucky_wheel_segments.length < 2) return;
      const { data: registered } = await (supabase.rpc as any)("lucky_wheel_register_display", { _campaign_id: next.id });
      if (!alive || !registered?.show) return;
      setCampaign(next); setSpins(Number(registered.spins_remaining ?? 0)); setOpen(true); setResult(null);
    };
    load();
    return () => { alive = false; };
  }, [user?.id, location.pathname]);

  const gradient = useMemo(() => {
    const segments = campaign?.lucky_wheel_segments ?? [];
    const step = 360 / Math.max(segments.length, 1);
    return `conic-gradient(from -90deg, ${segments.map((s, i) => `${WHEEL_COLORS[s.color_token] ?? "var(--primary)"} ${i * step}deg ${(i + 1) * step}deg`).join(",")})`;
  }, [campaign]);

  if (!open || !campaign) return null;
  const segments = campaign.lucky_wheel_segments;
  const step = 360 / segments.length;

  async function spin() {
    if (spinning || spins <= 0) return;
    setSpinning(true); setResult(null);
    const { data, error } = await (supabase.rpc as any)("lucky_wheel_spin", { _campaign_id: campaign?.id });
    if (error || !data) { setSpinning(false); setResult({ label: error?.message ?? "Spin failed", kind: "error", amount: 0 }); return; }
    const index = segments.findIndex((s) => s.id === data.segment_id);
    const target = 360 - (index * step + step / 2);
    setRotation((previous) => previous + 1440 + ((target - (previous % 360) + 360) % 360));
    window.setTimeout(() => {
      setSpinning(false); setSpins(Number(data.spins_remaining ?? 0));
      setResult({ label: String(data.label), kind: String(data.outcome_kind), amount: Number(data.reward_amount ?? 0) });
      refresh();
    }, 4200);
  }

  return (
    <div className="fixed inset-0 z-[190] grid place-items-center overflow-y-auto bg-background/90 p-3 backdrop-blur-xl animate-fade-in" role="dialog" aria-modal="true" aria-label={campaign.title}>
      <div className="relative flex min-h-full w-full max-w-[760px] flex-col items-center justify-center py-8">
        <Button variant="outline" size="icon" className="absolute right-0 top-3 z-20" onClick={() => setOpen(false)} aria-label="Close Lucky Wheel"><X className="h-5 w-5" /></Button>
        <div className="mb-5 text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.3em] text-primary"><Sparkles className="h-4 w-4" />Exclusive reward drop</div>
          <h2 className="lucky-wheel-title mt-1 text-4xl font-black uppercase sm:text-6xl">{campaign.title}</h2>
          {campaign.subtitle && <p className="mt-1 text-sm text-muted-foreground">{campaign.subtitle}</p>}
        </div>
        <div className="lucky-wheel-stage relative aspect-square w-[min(92vw,720px)]">
          <div className="lucky-wheel-pointer absolute left-1/2 top-[-2.5%] z-40 -translate-x-1/2" aria-hidden="true"><span /></div>
          <div className="lucky-wheel-frame absolute inset-0 rounded-full">
            <div className="lucky-wheel-bulbs absolute inset-0 rounded-full" aria-hidden="true">
              {Array.from({ length: 24 }).map((_, index) => (
                <span key={index} style={{ transform: `rotate(${index * 15}deg)` }}><i /></span>
              ))}
            </div>
            <div className="lucky-wheel-bezel absolute rounded-full">
              <div className="lucky-wheel-face relative h-full w-full overflow-hidden rounded-full" style={{ background: gradient, transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 4.2s cubic-bezier(.12,.68,.08,1)" : "none" }}>
                <div className="lucky-wheel-face-shine absolute inset-0 rounded-full" />
              {segments.map((segment, index) => (
                <div key={segment.id} className="lucky-wheel-segment-label absolute inset-0" style={{ transform: `rotate(${index * step + step / 2}deg)` }}>
                  <div className="absolute left-1/2 top-[9%] flex w-[26%] -translate-x-1/2 flex-col items-center text-center text-primary-foreground">
                    {segment.outcome_kind === "tokens" ? <Coins className="mb-1 h-5 w-5 text-primary sm:h-7 sm:w-7" /> : <X className="mb-1 h-5 w-5 text-primary sm:h-7 sm:w-7" />}
                    <span className="line-clamp-2 text-[9px] font-black uppercase leading-none drop-shadow-md sm:text-sm">{segment.label}</span>
                    {segment.outcome_kind === "tokens" && segment.reward_amount > 0 && <small className="mt-1 text-[8px] font-bold sm:text-xs">{segment.reward_amount.toLocaleString()} TOKENS</small>}
                  </div>
                </div>
              ))}
              </div>
            </div>
          </div>
          <div className="lucky-wheel-hub absolute left-1/2 top-1/2 z-30 grid h-[24%] w-[24%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full">
            <Gift className="h-[42%] w-[42%] text-primary" />
          </div>
        </div>
        <div className="mt-6 min-h-14 text-center">
          {result && <div className={`animate-scale-in text-xl font-black ${result.kind === "tokens" ? "text-accent" : result.kind === "lost" ? "text-destructive" : "text-destructive"}`}>{result.kind === "tokens" ? `YOU WON ${result.amount.toLocaleString()} TOKENS!` : result.label}</div>}
          <p className="text-xs font-bold uppercase tracking-widest text-primary">{spins} spin{spins === 1 ? "" : "s"} remaining today</p>
        </div>
        <Button className="btn-luxury lucky-wheel-spin h-16 min-w-72 text-lg font-black uppercase" disabled={spinning || spins <= 0} onClick={spin}><RotateCw className={spinning ? "animate-spin" : ""} />{spinning ? "Spinning…" : spins > 0 ? "Spin the wheel" : "No spins remaining"}</Button>
      </div>
    </div>
  );
}