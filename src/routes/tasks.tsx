import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, ArrowLeft, Sparkles, CheckCircle2, Coins, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Task — ECB" },
      { name: "description", content: "Your admin-assigned tasks and rewards on ECB." },
      { property: "og:title", content: "Task — ECB" },
      { property: "og:description", content: "Your admin-assigned tasks and rewards on ECB." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "/tasks" },
    ],
    links: [{ rel: "canonical", href: "/tasks" }],
  }),
  component: TaskPage,
});

type UserTask = {
  id: string;
  title: string;
  description: string | null;
  reward_tokens: number;
  reward_kind: string;
  status: "pending" | "completed" | "claimed" | string;
  progress: number | null;
  target_progress: number | null;
  banner_url: string | null;
  ends_at: string | null;
};

function TaskPage() {
  const { user, refresh } = useAuth();
  const [rows, setRows] = useState<UserTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_tasks")
      .select("id,title,description,reward_tokens,reward_kind,status,progress,target_progress,banner_url,ends_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data as UserTask[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`user-tasks-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_tasks", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  async function claim(id: string) {
    setClaiming(id);
    const { data, error } = await (supabase.rpc as any)("claim_task", { _task_id: id });
    setClaiming(null);
    if (error) return toast.error(error.message);
    toast.success(`Claimed ${Number(data?.reward ?? 0).toLocaleString()} tokens! 🎉`);
    load();
    refresh();
  }

  if (!user) {
    return <Layout><div className="container py-10"><Link to="/login" className="text-primary underline">Sign in</Link> to view your tasks.</div></Layout>;
  }

  return (
    <Layout>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Link to="/dashboard" className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Assigned by admin</p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-extrabold gradient-gold-text md:text-4xl">
            <ClipboardCheck className="h-7 w-7 text-primary" />Task
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Individual tasks assigned to you — claim your reward once a task is marked complete.</p>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && rows.length === 0 && (
          <Card className="glass p-6 text-center text-muted-foreground"><Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />No tasks assigned to you yet.</Card>
        )}

        <div className="space-y-3">
          {rows.map((t) => {
            const cur = Math.min(Number(t.progress ?? 0), Number(t.target_progress ?? 1) || 1);
            const target = Number(t.target_progress ?? 1) || 1;
            const pct = Math.round((cur / target) * 100);
            const claimed = t.status === "claimed";
            const completed = t.status === "completed" || claimed;
            return (
              <Card key={t.id} className={`overflow-hidden ${completed ? "border-emerald-400/40" : "border-primary/25"}`}>
                {t.banner_url && <img src={t.banner_url} alt="" className="h-24 w-full object-cover" />}
                <div className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-black uppercase tracking-wide">{t.title}</div>
                    {claimed ? (
                      <Badge variant="outline" className="border-emerald-400/40 text-emerald-300"><CheckCircle2 className="mr-1 h-3 w-3" />Reward claimed</Badge>
                    ) : completed ? (
                      <Badge variant="outline" className="border-amber-400/40 text-amber-300">Ready to claim</Badge>
                    ) : (
                      <Badge variant="outline" className="border-primary/30 text-muted-foreground">In progress</Badge>
                    )}
                  </div>
                  {t.description && <div className="mt-1 text-xs text-muted-foreground">{t.description}</div>}
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full transition-all ${completed ? "bg-emerald-400" : "bg-gradient-gold"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="text-muted-foreground">{cur.toLocaleString()} / {target.toLocaleString()} · {pct}%</span>
                    <span className="inline-flex items-center gap-1 font-bold text-primary">
                      {t.reward_kind === "tokens"
                        ? <><Coins className="h-3 w-3" />{Number(t.reward_tokens || 0).toLocaleString()} tokens</>
                        : <><Trophy className="h-3 w-3" />{t.reward_kind}</>}
                    </span>
                  </div>
                  {t.status === "completed" && (
                    <Button size="sm" className="btn-luxury mt-3 w-full" disabled={claiming === t.id} onClick={() => claim(t.id)}>
                      {claiming === t.id ? "Claiming…" : "Claim reward"}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
