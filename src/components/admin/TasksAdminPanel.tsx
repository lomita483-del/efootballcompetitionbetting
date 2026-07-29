import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Layers } from "lucide-react";
import { toast } from "sonner";

export const MONITOR_METRICS = [
  { v: "tokens_spent", l: "Tokens spent" },
  { v: "tokens_deposited", l: "Tokens received / deposited" },
  { v: "bets_placed", l: "Bets placed" },
  { v: "tokens_staked", l: "Tokens staked on bets" },
];

type Task = { id: string; name: string; description: string | null; monitor_metric: string; is_active: boolean };
type Tier = { id: string; task_id: string; tier_order: number; target_value: number; reward_kind: string; reward_value: string };
type Stat = { tier_id: string; in_progress: number; completed: number };

export function TasksAdminPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [t, ti, st] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("task_tiers").select("*").order("tier_order"),
      supabase.rpc("admin_task_tier_stats"),
    ]);
    setTasks((t.data as Task[]) ?? []);
    setTiers((ti.data as Tier[]) ?? []);
    const map: Record<string, Stat> = {};
    ((st.data as Stat[]) ?? []).forEach((s) => { map[s.tier_id] = s; });
    setStats(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const createTask = async () => {
    const { error } = await supabase.from("tasks").insert({ name: "New task", monitor_metric: "tokens_spent", is_active: true });
    if (error) return toast.error(error.message);
    toast.success("Task created"); load();
  };
  const saveTask = async (t: Task) => {
    const { id, ...patch } = t;
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    error ? toast.error(error.message) : toast.success("Task saved");
  };
  const delTask = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setTasks((p) => p.filter((x) => x.id !== id));
  };
  const addTier = async (task: Task) => {
    const existing = tiers.filter((x) => x.task_id === task.id);
    const { error } = await supabase.from("task_tiers").insert({
      task_id: task.id,
      tier_order: existing.length + 1,
      target_value: (existing.length + 1) * 100,
      reward_kind: "tokens",
      reward_value: "100",
    });
    if (error) return toast.error(error.message);
    load();
  };
  const saveTier = async (t: Tier) => {
    const { id, ...patch } = t;
    const { error } = await supabase.from("task_tiers").update(patch).eq("id", id);
    error ? toast.error(error.message) : toast.success("Tier saved");
  };
  const delTier = async (id: string) => {
    const { error } = await supabase.from("task_tiers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setTiers((p) => p.filter((x) => x.id !== id));
  };

  const patchTask = (id: string, p: Partial<Task>) => setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const patchTier = (id: string, p: Partial<Tier>) => setTiers((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black uppercase tracking-wide text-primary">Tasks & Quests</h2>
          <p className="text-xs text-muted-foreground">Tiered tasks tracked automatically from real user activity — rewards are granted instantly.</p>
        </div>
        <Button onClick={createTask} className="btn-luxury"><Plus className="mr-1 h-4 w-4" />New task</Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && tasks.length === 0 && <Card className="p-6 text-sm text-muted-foreground">No tasks yet.</Card>}

      {tasks.map((t) => {
        const myTiers = tiers.filter((x) => x.task_id === t.id).sort((a, b) => a.tier_order - b.tier_order);
        return (
          <Card key={t.id} className="space-y-4 p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
              <div>
                <Label>Name</Label>
                <Input value={t.name} onChange={(e) => patchTask(t.id, { name: e.target.value })} />
              </div>
              <div>
                <Label>Monitors</Label>
                <Select value={t.monitor_metric} onValueChange={(v) => patchTask(t.id, { monitor_metric: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONITOR_METRICS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={t.is_active} onCheckedChange={(v) => patchTask(t.id, { is_active: v })} />
                <span className="text-xs font-bold uppercase">{t.is_active ? "Active" : "Off"}</span>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={2} value={t.description ?? ""} onChange={(e) => patchTask(t.id, { description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => saveTask(t)}><Save className="mr-1 h-4 w-4" />Save task</Button>
              <Button size="sm" variant="outline" onClick={() => addTier(t)}><Layers className="mr-1 h-4 w-4" />Add tier</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => delTask(t.id)}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>
            </div>

            <div className="space-y-2 rounded-xl border border-primary/20 p-3">
              <div className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Tiers</div>
              {myTiers.length === 0 && <p className="text-xs text-muted-foreground">No tiers yet — add one.</p>}
              {myTiers.map((tier) => {
                const s = stats[tier.id];
                return (
                  <div key={tier.id} className="grid items-end gap-2 rounded-lg bg-card/60 p-2 md:grid-cols-[70px_1fr_1fr_1fr_auto]">
                    <div>
                      <Label className="text-[10px]">Order</Label>
                      <Input type="number" value={tier.tier_order} onChange={(e) => patchTier(tier.id, { tier_order: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-[10px]">Target</Label>
                      <Input type="number" value={tier.target_value} onChange={(e) => patchTier(tier.id, { target_value: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-[10px]">Reward type</Label>
                      <Select value={tier.reward_kind} onValueChange={(v) => patchTier(tier.id, { reward_kind: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tokens">Tokens</SelectItem>
                          <SelectItem value="achievement">Achievement</SelectItem>
                          <SelectItem value="badge">Badge</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">{tier.reward_kind === "tokens" ? "Token amount" : "Achievement / badge name"}</Label>
                      <Input value={tier.reward_value} onChange={(e) => patchTier(tier.id, { reward_value: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" onClick={() => saveTier(tier)}><Save className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => delTier(tier.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <div className="md:col-span-5 flex gap-2">
                      <Badge variant="outline" className="text-[10px]">In progress: {s?.in_progress ?? 0}</Badge>
                      <Badge variant="outline" className="text-[10px] border-emerald-400/40 text-emerald-300">Completed: {s?.completed ?? 0}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
