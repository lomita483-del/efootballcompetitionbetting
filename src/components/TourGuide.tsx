import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Compass, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type TourStep = {
  target: string;
  title: string;
  description: string;
  placement?: "top" | "right" | "bottom" | "left";
};

type TutorialSettings = {
  tutorials_enabled: boolean;
  tutorials_for_new_users: boolean;
  tutorials_for_new_signins: boolean;
  tutorials_for_visitors: boolean;
};

type Rect = { top: number; left: number; right: number; bottom: number; width: number; height: number };

const DEFAULT_SETTINGS: TutorialSettings = {
  tutorials_enabled: true,
  tutorials_for_new_users: true,
  tutorials_for_new_signins: false,
  tutorials_for_visitors: false,
};

export function TourGuide({ tourKey, steps }: { tourKey: string; steps: TourStep[] }) {
  const { user, profile, loading } = useAuth();
  const [settings, setSettings] = useState<TutorialSettings | null>(null);
  const [mode, setMode] = useState<"hidden" | "welcome" | "tour">("hidden");
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const localKey = `ecb-tutorial:${tourKey}:${user?.id ?? "visitor"}`;

  useEffect(() => {
    let alive = true;
    supabase.from("app_settings")
      .select("tutorials_enabled,tutorials_for_new_users,tutorials_for_new_signins,tutorials_for_visitors")
      .eq("id", 1).maybeSingle()
      .then(({ data }) => { if (alive) setSettings({ ...DEFAULT_SETTINGS, ...(data as Partial<TutorialSettings> | null) }); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (loading || !settings || !settings.tutorials_enabled || steps.length === 0) return;
    let alive = true;
    const decide = async () => {
      if (!user) {
        if (settings.tutorials_for_visitors && !window.localStorage.getItem(localKey) && alive) setMode("welcome");
        return;
      }
      const { data } = await supabase.from("tutorial_states").select("status,current_step,remind_after")
        .eq("user_id", user.id).eq("tour_key", tourKey).maybeSingle();
      if (!alive) return;
      const createdAt = (profile as (typeof profile & { created_at?: string }) | null)?.created_at;
      const isNewUser = !createdAt || Date.now() - new Date(createdAt).getTime() < 14 * 24 * 60 * 60 * 1000;
      const reminderDue = data?.status === "remind_later" && (!data.remind_after || new Date(data.remind_after).getTime() <= Date.now());
      const eligible = (settings.tutorials_for_new_users && isNewUser) || settings.tutorials_for_new_signins || reminderDue;
      if (!eligible || data?.status === "completed" || data?.status === "skipped") return;
      if (data?.status === "in_progress") {
        setStepIndex(Math.min(Number(data.current_step ?? 0), steps.length - 1));
        setMode("tour");
      } else setMode("welcome");
    };
    decide();
    return () => { alive = false; };
  }, [loading, localKey, profile, settings, steps.length, tourKey, user]);

  const saveState = useCallback(async (status: "in_progress" | "completed" | "skipped" | "remind_later", currentStep = stepIndex) => {
    if (!user) {
      window.localStorage.setItem(localKey, JSON.stringify({ status, currentStep, updatedAt: new Date().toISOString() }));
      return;
    }
    const now = new Date();
    await supabase.from("tutorial_states").upsert({
      user_id: user.id,
      tour_key: tourKey,
      status,
      current_step: currentStep,
      started_at: status === "in_progress" ? now.toISOString() : undefined,
      completed_at: status === "completed" ? now.toISOString() : null,
      remind_after: status === "remind_later" ? new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() : null,
    }, { onConflict: "user_id,tour_key" });
  }, [localKey, stepIndex, tourKey, user]);

  const activeStep = steps[stepIndex];
  const updateTarget = useCallback(() => {
    if (mode !== "tour" || !activeStep) return;
    const element = document.querySelector(activeStep.target);
    if (!element) { setTargetRect(null); return; }
    const rect = element.getBoundingClientRect();
    setTargetRect({ top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height });
  }, [activeStep, mode]);

  useLayoutEffect(() => {
    if (mode !== "tour" || !activeStep) return;
    document.querySelector(activeStep.target)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    const timer = window.setTimeout(updateTarget, 380);
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [activeStep, mode, updateTarget]);

  const start = async () => { setStepIndex(0); await saveState("in_progress", 0); setMode("tour"); };
  const dismiss = async (status: "skipped" | "remind_later") => { await saveState(status); setMode("hidden"); };
  const go = async (next: number) => {
    if (next >= steps.length) { await saveState("completed", steps.length - 1); setMode("hidden"); return; }
    const safe = Math.max(0, next);
    setStepIndex(safe);
    await saveState("in_progress", safe);
  };

  const cardPosition = useMemo(() => positionCard(targetRect, activeStep?.placement), [activeStep?.placement, targetRect]);
  const displayName = profile?.full_name?.trim() || user?.user_metadata?.full_name || "Guest";

  return <>
    <Dialog open={mode === "welcome"} onOpenChange={(open) => { if (!open) dismiss("remind_later"); }}>
      <DialogContent className="max-w-xl overflow-hidden border-primary/45 bg-card p-0 shadow-gold">
        <div className="h-1 bg-gradient-gold" />
        <div className="p-6 sm:p-8">
          <span className="mb-5 grid h-14 w-14 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary"><Compass className="h-7 w-7" /></span>
          <DialogHeader>
            <DialogTitle className="text-left text-3xl font-black">Welcome, {displayName}! 👋</DialogTitle>
            <DialogDescription className="pt-2 text-left text-base leading-relaxed">Let&apos;s take a quick tour to help you get the most out of the platform.</DialogDescription>
          </DialogHeader>
          <div className="mt-7 grid gap-2 sm:grid-cols-2">
            <Button className="btn-luxury sm:col-span-2" onClick={start}>Start Tutorial <ChevronRight className="h-4 w-4" /></Button>
            <Button variant="outline" onClick={() => dismiss("remind_later")}>Remind Me Later</Button>
            <Button variant="ghost" onClick={() => dismiss("skipped")}>Skip Tutorial</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {mode === "tour" && activeStep && <div className="fixed inset-0 z-[250]" role="dialog" aria-modal="true" aria-label={`${activeStep.title} tutorial step`}>
      <div className="absolute inset-0 bg-background/78 backdrop-blur-[1px]" />
      {targetRect && <div className="pointer-events-none fixed rounded-md border-2 border-primary bg-primary/5 shadow-[0_0_0_9999px_color-mix(in_oklab,var(--background)_78%,transparent),0_0_30px_var(--primary)] transition-all duration-300" style={{ top: targetRect.top - 7, left: targetRect.left - 7, width: targetRect.width + 14, height: targetRect.height + 14 }} />}
      <section className="fixed w-[min(360px,calc(100vw-24px))] rounded-md border border-primary/60 bg-card p-4 shadow-gold" style={cardPosition}>
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-gold text-lg font-black text-primary-foreground">{stepIndex + 1}</span>
          <div className="min-w-0 flex-1"><div className="text-[10px] font-black uppercase text-primary">Tutorial • Page {stepIndex + 1}/{steps.length}</div><h2 className="mt-1 text-lg font-black">{activeStep.title}</h2></div>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Close tutorial" onClick={() => dismiss("remind_later")}><X className="h-4 w-4" /></Button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{activeStep.description}</p>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-gradient-gold transition-all" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} /></div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="outline" disabled={stepIndex === 0} onClick={() => go(stepIndex - 1)}><ChevronLeft className="h-4 w-4" /> Back</Button>
          <Button className="btn-luxury" onClick={() => go(stepIndex + 1)}>{stepIndex === steps.length - 1 ? "Finish" : "Next"} <ChevronRight className="h-4 w-4" /></Button>
        </div>
      </section>
    </div>}
  </>;
}

function positionCard(rect: Rect | null, preferred: TourStep["placement"]): CSSProperties {
  if (typeof window === "undefined") return {};
  const margin = 16;
  const cardWidth = Math.min(360, window.innerWidth - 24);
  const cardHeight = 260;
  if (!rect) return { left: Math.max(12, (window.innerWidth - cardWidth) / 2), top: Math.max(80, (window.innerHeight - cardHeight) / 2) };
  const placement = preferred ?? (rect.right + cardWidth + margin < window.innerWidth ? "right" : rect.bottom + cardHeight + margin < window.innerHeight ? "bottom" : "top");
  let left = rect.left;
  let top = rect.bottom + margin;
  if (placement === "right") { left = rect.right + margin; top = rect.top; }
  if (placement === "left") { left = rect.left - cardWidth - margin; top = rect.top; }
  if (placement === "top") { left = rect.left; top = rect.top - cardHeight - margin; }
  return { left: Math.min(Math.max(12, left), window.innerWidth - cardWidth - 12), top: Math.min(Math.max(12, top), window.innerHeight - cardHeight - 12) };
}