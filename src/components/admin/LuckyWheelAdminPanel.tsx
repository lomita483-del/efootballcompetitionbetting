import { useEffect, useState } from "react";
import { Gift, History, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Campaign = { id: string; title: string; subtitle: string | null; page_path: string; is_active: boolean; max_unique_users: number | null; base_spins_per_user: number; display_mode: string; max_displays_per_user: number | null; linked_task_id: string | null; task_spin_points: number };
type Segment = { id: string; campaign_id: string; label: string; outcome_kind: string; reward_amount: number; weight: number; color_token: string; sort_order: number };
type Task = { id: string; name: string };
type Spin = { id: string; campaign_id: string; user_id: string; outcome_kind: string; label: string; reward_amount: number; page_path: string | null; created_at: string };

export function LuckyWheelAdminPanel() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [spins, setSpins] = useState<Spin[]>([]);
  const [spinProfiles, setSpinProfiles] = useState<Record<string, { full_name: string; email: string }>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const current = campaigns.find((c) => c.id === selected) ?? null;

  async function load(preferred?: string) {
    const [c, s, t] = await Promise.all([
      (supabase as any).from("lucky_wheel_campaigns").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("lucky_wheel_segments").select("*").order("sort_order"),
      supabase.from("tasks").select("id,name").eq("is_active", true).order("name"),
    ]);
    setCampaigns(c.data ?? []); setSegments(s.data ?? []); setTasks((t.data as Task[]) ?? []);
    setSelected(preferred ?? selected ?? c.data?.[0]?.id ?? null);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const loadHistory = async () => {
      const { data } = await (supabase as any).from("lucky_wheel_spins").select("id,campaign_id,user_id,outcome_kind,label,reward_amount,page_path,created_at").order("created_at", { ascending: false }).limit(200);
      const rows = (data ?? []) as Spin[];
      setSpins(rows);
      const ids = Array.from(new Set(rows.map((row) => row.user_id)));
      if (!ids.length) return;
      const { data: users } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      setSpinProfiles(Object.fromEntries((users ?? []).map((user: any) => [user.id, user])));
    };
    loadHistory();
    const channel = supabase.channel("admin-lucky-wheel-history").on("postgres_changes", { event: "INSERT", schema: "public", table: "lucky_wheel_spins" }, loadHistory).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function createCampaign() {
    const { data, error } = await (supabase as any).from("lucky_wheel_campaigns").insert({ title: "LUCKY WHEEL", page_path: "/", max_unique_users: 100, base_spins_per_user: 1, display_mode: "once", max_displays_per_user: 1 }).select("id").single();
    if (error) return toast.error(error.message);
    await (supabase as any).from("lucky_wheel_segments").insert([
      { campaign_id: data.id, label: "10,000 TOKENS", outcome_kind: "tokens", reward_amount: 10000, weight: 1, color_token: "gold", sort_order: 0 },
      { campaign_id: data.id, label: "YOU LOST", outcome_kind: "lost", reward_amount: 0, weight: 1, color_token: "ruby", sort_order: 1 },
    ]);
    toast.success("Lucky Wheel created"); load(data.id);
  }
  const patch = (value: Partial<Campaign>) => setCampaigns((all) => all.map((c) => c.id === selected ? { ...c, ...value } : c));
  const patchSegment = (id: string, value: Partial<Segment>) => setSegments((all) => all.map((s) => s.id === id ? { ...s, ...value } : s));
  async function saveCampaign() {
    if (!current) return;
    const { id, ...values } = current;
    const { error } = await (supabase as any).from("lucky_wheel_campaigns").update(values).eq("id", id);
    error ? toast.error(error.message) : toast.success("Lucky Wheel saved");
  }
  async function removeCampaign() {
    if (!current) return;
    const { error } = await (supabase as any).from("lucky_wheel_campaigns").delete().eq("id", current.id);
    if (error) return toast.error(error.message);
    toast.success("Lucky Wheel deleted"); setSelected(null); load();
  }
  async function addSegment() {
    if (!current) return;
    const mine = segments.filter((s) => s.campaign_id === current.id);
    const { error } = await (supabase as any).from("lucky_wheel_segments").insert({ campaign_id: current.id, label: "NEW REWARD", outcome_kind: "tokens", reward_amount: 1000, weight: 1, color_token: "emerald", sort_order: mine.length });
    if (error) return toast.error(error.message); load(current.id);
  }
  async function saveSegment(segment: Segment) {
    const { id, campaign_id, ...values } = segment;
    const { error } = await (supabase as any).from("lucky_wheel_segments").update(values).eq("id", id).eq("campaign_id", campaign_id);
    error ? toast.error(error.message) : toast.success("Wheel section saved");
  }
  async function removeSegment(id: string) {
    const { error } = await (supabase as any).from("lucky_wheel_segments").delete().eq("id", id);
    if (error) return toast.error(error.message); setSegments((all) => all.filter((s) => s.id !== id));
  }

  return <div className="max-w-5xl space-y-4">
    <div className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-black uppercase text-primary"><Gift className="h-5 w-5" />Lucky Wheel</h2><p className="text-xs text-muted-foreground">Create page-targeted reward wheels with secure spin limits and task-earned points.</p></div><Button className="btn-luxury" onClick={createCampaign}><Plus className="mr-1 h-4 w-4" />New wheel</Button></div>
    {campaigns.length > 0 && <Select value={selected ?? ""} onValueChange={setSelected}><SelectTrigger><SelectValue placeholder="Choose a Lucky Wheel" /></SelectTrigger><SelectContent>{campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.title} · {c.page_path}</SelectItem>)}</SelectContent></Select>}
    {!current && <Card className="p-8 text-center text-sm text-muted-foreground">Create a Lucky Wheel campaign to begin.</Card>}
    {current && <>
      <Card className="space-y-4 border-primary/25 p-5">
        <div className="grid gap-3 md:grid-cols-2"><Field label="Wheel title"><Input value={current.title} onChange={(e) => patch({ title: e.target.value })} /></Field><Field label="Target page"><Input value={current.page_path} onChange={(e) => patch({ page_path: e.target.value.trim() || "/" })} placeholder="/, /matches, or all" /></Field></div>
        <Field label="Description"><Textarea rows={2} value={current.subtitle ?? ""} onChange={(e) => patch({ subtitle: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Users allowed"><Input type="number" min={1} value={current.max_unique_users ?? ""} onChange={(e) => patch({ max_unique_users: e.target.value ? Number(e.target.value) : null })} placeholder="Unlimited" /></Field><Field label="Base spins per user"><Input type="number" min={0} value={current.base_spins_per_user} onChange={(e) => patch({ base_spins_per_user: Number(e.target.value) })} /></Field><Field label="Maximum pop-out displays"><Input type="number" min={1} value={current.max_displays_per_user ?? ""} onChange={(e) => patch({ max_displays_per_user: e.target.value ? Number(e.target.value) : null })} placeholder="Unlimited" /></Field><Field label="Pop-out behavior"><Select value={current.display_mode} onValueChange={(v) => patch({ display_mode: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="once">Limited displays</SelectItem><SelectItem value="reload">Every reload</SelectItem><SelectItem value="earned">Only with spin points</SelectItem></SelectContent></Select></Field></div>
        <div className="grid gap-3 md:grid-cols-2"><Field label="Linked task"><Select value={current.linked_task_id ?? "none"} onValueChange={(v) => patch({ linked_task_id: v === "none" ? null : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No linked task</SelectItem>{tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Spins earned per completed tier"><Input type="number" min={0} value={current.task_spin_points} onChange={(e) => patch({ task_spin_points: Number(e.target.value) })} /></Field></div>
        <div className="flex flex-wrap items-center gap-2"><Switch checked={current.is_active} onCheckedChange={(v) => patch({ is_active: v })} /><span className="mr-auto text-xs font-black uppercase">{current.is_active ? "Wheel is live" : "Wheel is off"}</span><Button onClick={saveCampaign}><Save className="mr-1 h-4 w-4" />Save wheel</Button><Button variant="destructive" onClick={removeCampaign}><Trash2 className="mr-1 h-4 w-4" />Delete wheel</Button></div>
      </Card>
      <Card className="space-y-3 border-primary/25 p-5"><div className="flex items-center justify-between"><div><h3 className="font-black uppercase">Wheel rewards & losses</h3><p className="text-xs text-muted-foreground">Weight controls how often a section is selected.</p></div><Button variant="outline" onClick={addSegment}><Plus className="mr-1 h-4 w-4" />Add section</Button></div>
        {segments.filter((s) => s.campaign_id === current.id).map((s) => <div key={s.id} className="grid items-end gap-2 border-t border-border pt-3 md:grid-cols-[1.5fr_1fr_1fr_90px_1fr_auto]">
          <Field label="Wheel label"><Input value={s.label} onChange={(e) => patchSegment(s.id, { label: e.target.value })} /></Field><Field label="Outcome"><Select value={s.outcome_kind} onValueChange={(v) => patchSegment(s.id, { outcome_kind: v, reward_amount: v === "lost" ? 0 : s.reward_amount })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tokens">Token reward</SelectItem><SelectItem value="lost">You lost</SelectItem></SelectContent></Select></Field><Field label="Reward"><Input type="number" min={0} disabled={s.outcome_kind === "lost"} value={s.reward_amount} onChange={(e) => patchSegment(s.id, { reward_amount: Number(e.target.value) })} /></Field><Field label="Weight"><Input type="number" min={1} value={s.weight} onChange={(e) => patchSegment(s.id, { weight: Number(e.target.value) })} /></Field><Field label="Color"><Select value={s.color_token} onValueChange={(v) => patchSegment(s.id, { color_token: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["gold","emerald","ruby","navy","violet","silver"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></Field><div className="flex gap-1"><Button size="icon" onClick={() => saveSegment(s)} aria-label="Save section"><Save className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeSegment(s.id)} aria-label="Delete section"><Trash2 className="h-4 w-4" /></Button></div>
        </div>)}
      </Card>
      <Card className="space-y-3 border-primary/25 p-5">
        <div className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /><div><h3 className="font-black uppercase">Spin history</h3><p className="text-xs text-muted-foreground">Who spun, total spins, date, time, page and result.</p></div></div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-background/40 p-3"><div className="text-[10px] uppercase text-muted-foreground">Campaign spins</div><div className="text-xl font-black">{spins.filter((spin) => spin.campaign_id === current.id).length}</div></div>
          <div className="rounded-md border border-border bg-background/40 p-3"><div className="text-[10px] uppercase text-muted-foreground">Unique users</div><div className="text-xl font-black">{new Set(spins.filter((spin) => spin.campaign_id === current.id).map((spin) => spin.user_id)).size}</div></div>
          <div className="rounded-md border border-border bg-background/40 p-3"><div className="text-[10px] uppercase text-muted-foreground">Tokens awarded</div><div className="text-xl font-black">{spins.filter((spin) => spin.campaign_id === current.id && spin.outcome_kind === "tokens").reduce((sum, spin) => sum + Number(spin.reward_amount), 0).toLocaleString()}</div></div>
        </div>
        <div className="max-h-96 overflow-auto rounded-md border border-border">
          <table className="w-full min-w-[760px] text-left text-xs"><thead className="sticky top-0 bg-card"><tr>{["User", "Spin #", "Result", "Page", "Date", "Time"].map((heading) => <th key={heading} className="border-b border-border px-3 py-2 uppercase text-muted-foreground">{heading}</th>)}</tr></thead><tbody>
            {spins.filter((spin) => spin.campaign_id === current.id).map((spin, index, filtered) => {
              const user = spinProfiles[spin.user_id];
              const spinNumber = filtered.slice(index).filter((row) => row.user_id === spin.user_id).length;
              const date = new Date(spin.created_at);
              return <tr key={spin.id} className="border-b border-border/50"><td className="px-3 py-2"><div className="font-bold">{user?.full_name ?? "Unknown"}</div><div className="text-muted-foreground">{user?.email}</div></td><td className="px-3 py-2 font-mono">#{spinNumber}</td><td className={`px-3 py-2 font-bold ${spin.outcome_kind === "tokens" ? "text-accent" : "text-destructive"}`}>{spin.label}{spin.outcome_kind === "tokens" ? ` · ${Number(spin.reward_amount).toLocaleString()}` : ""}</td><td className="px-3 py-2 font-mono">{spin.page_path ?? current.page_path}</td><td className="px-3 py-2">{date.toLocaleDateString()}</td><td className="px-3 py-2">{date.toLocaleTimeString()}</td></tr>;
            })}
          </tbody></table>
          {spins.filter((spin) => spin.campaign_id === current.id).length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No spins recorded for this wheel yet.</div>}
        </div>
      </Card>
    </>}
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>{children}</div>; }