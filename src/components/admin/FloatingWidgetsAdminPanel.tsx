import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageSettingControl } from "@/components/admin/ImageSettingControl";
import { WIDGET_ICONS, WIDGET_ICON_NAMES } from "@/lib/floating-widgets";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

type Widget = {
  id: string;
  name: string;
  icon_name: string | null;
  image_url: string | null;
  destination_type: string;
  destination_value: string;
  is_active: boolean;
  position: string;
  sort_order: number;
};

const BLANK = {
  name: "New Widget",
  icon_name: "Sparkles",
  image_url: null as string | null,
  destination_type: "tasks",
  destination_value: "/tasks",
  is_active: true,
  position: "right",
  sort_order: 0,
};

export function FloatingWidgetsAdminPanel() {
  const [rows, setRows] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("floating_widgets").select("*").order("sort_order");
    setRows((data as Widget[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const { error } = await supabase.from("floating_widgets").insert({ ...BLANK, sort_order: rows.length });
    if (error) return toast.error(error.message);
    toast.success("Widget created");
    load();
  };

  const save = async (w: Widget) => {
    const { id, ...patch } = w;
    const { error } = await supabase.from("floating_widgets").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("floating_widgets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((p) => p.filter((r) => r.id !== id));
  };

  const patch = (id: string, p: Partial<Widget>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black uppercase tracking-wide text-primary">Floating Icons</h2>
          <p className="text-xs text-muted-foreground">Draggable shortcuts shown on every page for all users.</p>
        </div>
        <Button onClick={create} className="btn-luxury"><Plus className="mr-1 h-4 w-4" />New icon</Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && rows.length === 0 && <Card className="p-6 text-sm text-muted-foreground">No floating icons yet.</Card>}

      {rows.map((w) => {
        const Icon = WIDGET_ICONS[w.icon_name ?? ""] ?? WIDGET_ICONS.Sparkles;
        return (
          <Card key={w.id} className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-gradient-gold text-background">
                {w.image_url ? <img src={w.image_url} alt="" className="h-full w-full object-cover" /> : <Icon className="h-5 w-5" />}
              </span>
              <div className="min-w-[180px] flex-1">
                <Label>Name / label</Label>
                <Input value={w.name} onChange={(e) => patch(w.id, { name: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={w.is_active} onCheckedChange={(v) => patch(w.id, { is_active: v })} />
                <span className="text-xs font-bold uppercase tracking-wide">{w.is_active ? "Active" : "Disabled"}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label>Icon</Label>
                <Select value={w.icon_name ?? "Sparkles"} onValueChange={(v) => patch(w.id, { icon_name: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WIDGET_ICON_NAMES.map((n) => {
                      const I = WIDGET_ICONS[n];
                      return <SelectItem key={n} value={n}><span className="flex items-center gap-2"><I className="h-4 w-4" />{n}</span></SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Side</Label>
                <Select value={w.position} onValueChange={(v) => patch(w.id, { position: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Destination</Label>
                <Select
                  value={w.destination_type}
                  onValueChange={(v) => patch(w.id, { destination_type: v, destination_value: v === "tasks" ? "/tasks" : w.destination_value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tasks">Tasks page</SelectItem>
                    <SelectItem value="route">Internal route</SelectItem>
                    <SelectItem value="external">External link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{w.destination_type === "external" ? "URL" : "Route path"}</Label>
                <Input
                  value={w.destination_value}
                  disabled={w.destination_type === "tasks"}
                  placeholder={w.destination_type === "external" ? "https://…" : "/leaderboard"}
                  onChange={(e) => patch(w.id, { destination_value: e.target.value })}
                />
              </div>
            </div>

            <ImageSettingControl
              label="Custom image (optional — overrides icon)"
              value={w.image_url}
              onChange={(url) => patch(w.id, { image_url: url })}
              showFitControls={false}
              aspect="1 / 1"
            />

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => save(w)}><Save className="mr-1 h-4 w-4" />Save</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(w.id)}>
                <Trash2 className="mr-1 h-4 w-4" />Delete
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
