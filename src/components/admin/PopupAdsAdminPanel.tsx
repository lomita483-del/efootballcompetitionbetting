import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { ImageSettingControl } from "@/components/admin/ImageSettingControl";
import { POPUP_PAGE_OPTIONS, type PopupAdRecord } from "@/components/PopupAd";

type Draft = Partial<PopupAdRecord> & { id?: string };

const EMPTY: Draft = {
  is_active: true, title: "", headline: "", body_text: "", image_url: null, link_url: "",
  cta_label: "", cta_title: "", cta_subtitle: "", promo_badge: "", size: "large",
  pages: ["all"], starts_at: null, ends_at: null, display_order: 0,
};

function toLocalInput(v?: string | null) { return v ? new Date(v).toISOString().slice(0, 16) : ""; }

export function PopupAdsAdminPanel() {
  const [ads, setAds] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await (supabase as any).from("popup_ads").select("*").order("display_order", { ascending: true });
    if (error) { toast.error(error.message); return; }
    setAds((data ?? []) as Draft[]);
  }
  useEffect(() => { void load(); }, []);

  function patch(i: number, p: Draft) {
    setAds((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...p } : a)));
  }

  async function save(i: number) {
    const a = ads[i];
    if (!a) return;
    setBusy(true);
    try {
      const row = {
        is_active: !!a.is_active, title: a.title || null, headline: a.headline || null,
        body_text: a.body_text || null, image_url: a.image_url || null, link_url: a.link_url || null,
        cta_label: a.cta_label || null, cta_title: a.cta_title || null, cta_subtitle: a.cta_subtitle || null,
        promo_badge: a.promo_badge || null, size: a.size || "large",
        pages: a.pages?.length ? a.pages : ["all"],
        starts_at: a.starts_at || null, ends_at: a.ends_at || null,
        display_order: Number(a.display_order ?? 0),
      };
      const q = a.id
        ? (supabase as any).from("popup_ads").update(row).eq("id", a.id)
        : (supabase as any).from("popup_ads").insert(row);
      const { error } = await q;
      if (error) { toast.error(error.message); return; }
      toast.success("Pop-out ad saved");
      await load();
    } finally { setBusy(false); }
  }

  async function remove(i: number) {
    const a = ads[i];
    if (!a) return;
    if (a.id) {
      const { error } = await (supabase as any).from("popup_ads").delete().eq("id", a.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Deleted");
      await load();
      return;
    }
    setAds((prev) => prev.filter((_, idx) => idx !== i));
  }

  function togglePage(i: number, value: string) {
    const cur = ads[i]?.pages ?? ["all"];
    let next: string[];
    if (value === "all") next = ["all"];
    else next = cur.includes(value) ? cur.filter((p) => p !== value && p !== "all") : [...cur.filter((p) => p !== "all"), value];
    patch(i, { pages: next.length ? next : ["all"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black tracking-wide text-primary">POP-OUT ADS</h3>
          <p className="text-[11px] text-muted-foreground">Run several translucent promo pop-ups at once. Ads targeting the same page queue one after another.</p>
        </div>
        <Button size="sm" onClick={() => setAds((p) => [{ ...EMPTY, display_order: p.length }, ...p])}>
          <Plus className="h-4 w-4 mr-1" />New ad
        </Button>
      </div>

      {ads.length === 0 && <p className="text-xs text-muted-foreground">No pop-out ads yet.</p>}

      {ads.map((a, i) => (
        <Card key={a.id ?? `new-${i}`} className="space-y-3 border-primary/20 bg-card/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <Input className="h-9 max-w-[240px]" placeholder="Internal name" value={a.title ?? ""} onChange={(e) => patch(i, { title: e.target.value })} />
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Active</span>
              <Switch checked={!!a.is_active} onCheckedChange={(v) => patch(i, { is_active: v })} />
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void remove(i)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Input className="h-9" placeholder="Headline (big bold text)" value={a.headline ?? ""} onChange={(e) => patch(i, { headline: e.target.value })} />
            <Input className="h-9" placeholder="Link URL (optional)" value={a.link_url ?? ""} onChange={(e) => patch(i, { link_url: e.target.value })} />
            <Input className="h-9" placeholder="CTA title (e.g. Unlock Premium Benefits)" value={a.cta_title ?? ""} onChange={(e) => patch(i, { cta_title: e.target.value })} />
            <Input className="h-9" placeholder="CTA subtitle (e.g. No ads · HD)" value={a.cta_subtitle ?? ""} onChange={(e) => patch(i, { cta_subtitle: e.target.value })} />
            <Input className="h-9" placeholder="CTA button label (e.g. Unlock)" value={a.cta_label ?? ""} onChange={(e) => patch(i, { cta_label: e.target.value })} />
            <Input className="h-9" placeholder="Promo code / bonus badge text" value={a.promo_badge ?? ""} onChange={(e) => patch(i, { promo_badge: e.target.value })} />
          </div>

          <Textarea rows={2} placeholder="Body text (optional)" value={a.body_text ?? ""} onChange={(e) => patch(i, { body_text: e.target.value })} />

          <ImageSettingControl
            label="Ad image"
            value={a.image_url}
            onChange={(url) => patch(i, { image_url: url })}
            showFitControls={false}
            aspect="4 / 3"
            help="Transparent PNG or animated GIF/WEBP works best. Animated files upload with animation preserved (crop is skipped)."
          />

          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Size</div>
              <Select value={a.size ?? "large"} onValueChange={(v) => patch(i, { size: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="xl">Extra Large</SelectItem>
                  <SelectItem value="full">Full screen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Starts at</div>
              <Input type="datetime-local" className="h-9" value={toLocalInput(a.starts_at)} onChange={(e) => patch(i, { starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Ends at</div>
              <Input type="datetime-local" className="h-9" value={toLocalInput(a.ends_at)} onChange={(e) => patch(i, { ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
          </div>

          <div>
            <div className="text-[10px] text-muted-foreground mb-1">Show on pages</div>
            <div className="flex flex-wrap gap-1.5">
              {POPUP_PAGE_OPTIONS.map((p) => {
                const on = (a.pages ?? ["all"]).includes(p.value);
                return (
                  <button key={p.value} type="button" onClick={() => togglePage(i, p.value)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${on ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Queue order</span>
              <Input type="number" className="h-9 w-20" value={a.display_order ?? 0} onChange={(e) => patch(i, { display_order: Number(e.target.value) })} />
            </div>
            <Button size="sm" disabled={busy} onClick={() => void save(i)}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}Save ad
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
