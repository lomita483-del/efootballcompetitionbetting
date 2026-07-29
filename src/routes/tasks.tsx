import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListChecks, ArrowLeft, Sparkles, CheckCircle2, Coins, Trophy } from "lucide-react";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks & Quests — ECB" },
      { name: "description", content: "Track your ECB quests, hit every tier and earn token and achievement rewards automatically." },
      { property: "og:title", content: "Tasks & Quests — ECB" },
      { property: "og:description", content: "Track your ECB quests, hit every tier and earn token and achievement rewards automatically." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "/tasks" },
    ],
    links: [{ rel: "canonical", href: "/tasks" }],
  }),
  component: TasksPage,
});

const METRIC_LABEL: Record<string, string> = {
  tokens_spent: "tokens spent",
  tokens_deposited: "tokens received",
  bets_placed: "bets placed",
  tokens_staked: "tokens staked",
};

type Task = { id: string; name: string; description: string | null; monitor_metric: string };
type Tier = { id: string; task_id: string; tier_order: number; target_value: number; reward_kind: string; reward_value: string };
type Progress = { tier_id: string; current_value: number; completed_at: string | null; reward_claimed: boolean };

function TasksPage() {
  const { user, refresh } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [t, ti] = await Promise.all([
        supabase.from("tasks").select("id,name,description,monitor_metric").eq("is_active", true).order("created_at"),
        supabase.from("task_tiers").select("*").order("tier_order"),
      ]);
      if (!alive) return;
      setTasks((t.data as Task[]) ?? []);
      setTiers((ti.data as Tier[]) ?? []);
      setLoading(false);
    };
    load();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const loadProgress = async () => {
      const { data } = await supabase
        .from("user_task_progress")
        .select("tier_id,current_value,completed_at,reward_claimed")
        .eq("user_id", user.id);
      if (!alive) return;
      const map: Record<string, Progress> = {};
      ((data as Progress[]) ?? []).forEach((p) => { map[p.tier_id] = p; });
      setProgress(map);
    };
    loadProgress();
    const ch = supabase
      .channel(`task-progress-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_task_progress", filter: `user_id=eq.${user.id}` },
        () => { loadProgress(); refresh(); })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [user?.id]);

  if (!user) {
    return <Layout><div className="container py-10"><Link to="/login" className="text-primary underline">Sign in</Link> to view your tasks.</div></Layout>;
  }

  return (
    <Layout>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Link to="/dashboard" className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Earn rewards</p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-extrabold gradient-gold-text md:text-4xl">
            <ListChecks className="h-7 w-7 text-primary" />Tasks & Quests
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Progress tracks itself as you play — rewards are credited the moment you hit a tier.</p>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && tasks.length === 0 && (
          <Card className="glass p-6 text-center text-muted-foreground"><Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />No active tasks — check back soon.</Card>
        )}

        <div className="space-y-4">
          {tasks.map((t) => {
            const myTiers = tiers.filter((x) => x.task_id === t.id).sort((a, b) => a.tier_order - b.tier_order);
            const unit = METRIC_LABEL[t.monitor_metric] ?? t.monitor_metric;
            return (
              <Card key={t.id} className="overflow-hidden border-primary/25">
                <div className="border-b border-primary/20 px-4 py-3">
                  <div className="font-black uppercase tracking-wide">{t.name}</div>
                  {t.description && <div className="mt-0.5 text-xs text-muted-foreground">{t.description}</div>}
                  <div className="mt-1 text-[11px] uppercase tracking-widest text-primary">Tracks: {unit}</div>
                </div>
                <div className="space-y-3 p-4">
                  {myTiers.length === 0 && <p className="text-xs text-muted-foreground">No tiers configured yet.</p>}
                  {myTiers.map((tier) => {
                    const p = progress[tier.id];
                    const cur = Math.min(Number(p?.current_value ?? 0), tier.target_value);
                    const pct = Math.round((cur / Math.max(1, tier.target_value)) * 100);
                    const done = !!p?.completed_at;
                    return (
                      <div key={tier.id} className={`rounded-xl border p-3 ${done ? "border-emerald-400/40 bg-emerald-500/5" : "border-primary/20 bg-card/60"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-bold">Tier {tier.tier_order}</span>
                          {done ? (
                            <Badge variant="outline" className="border-emerald-400/40 text-emerald-300">
                              <CheckCircle2 className="mr-1 h-3 w-3" />{p?.reward_claimed ? "Reward granted" : "Completed"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-400/40 text-amber-300">In progress</Badge>
                          )}
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full transition-all ${done ? "bg-emerald-400" : "bg-gradient-gold"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <span className="text-muted-foreground">{cur.toLocaleString()} / {Number(tier.target_value).toLocaleString()} {unit} · {pct}%</span>
                          <span className="inline-flex items-center gap-1 font-bold text-primary">
                            {tier.reward_kind === "tokens"
                              ? <><Coins className="h-3 w-3" />{Number(tier.reward_value || 0).toLocaleString()} tokens</>
                              : <><Trophy className="h-3 w-3" />{tier.reward_value}</>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
