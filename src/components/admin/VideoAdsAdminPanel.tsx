import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Loader2, Upload } from "lucide-react";
import { POPUP_PAGE_OPTIONS } from "@/components/PopupAd";

type Draft = {
  id?: string;
  is_active?: boolean;
  title?: string | null;
  video_url?: string | null;
  target_page?: string;
  skip_label?: string;
  display_order?: number;
};

const EMPTY: Draft = { is_active: true, title: "", video_url: null, target_page: "all", skip_label: "Skip Intro", display_order: 0 };

export function VideoAdsAdminPanel() {
  const [ads, setAds] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  async function load() {
    const { data, error } = await (supabase as any).from("video_ads").select("*").order("display_order", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setAds((data ?? []) as Draft[]);
  }
  useEffect(() => { void load(); }, []);

  function patch(i: number, p: Draft) {
    setAds((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...p } : a)));
  }

  async function uploadVideo(i: number, file: File) {
    if (!file.type.startsWith("video/")) { toast.error("Please choose a video file"); return; }
    setUploadingIdx(i);
    try {
      const path = `video-ad-${crypto.randomUUID()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("ads").upload(path, file);
      if (error) { toast.error(error.message); return; }
      const url = supabase.storage.from("ads").getPublicUrl(path).data.publicUrl;
      patch(i, { video_url: url });
      toast.success("Video uploaded");
    } finally {
      setUploadingIdx(null);
    }
  }

  async function save(i: number) {
    const a = ads[i];
    if (!a) return;
    if (!a.video_url) { toast.error("Upload a video first"); return; }
    setBusy(true);
    try {
      const row = {
        is_active: !!a.is_active,
        title: a.title || null,
        video_url: a.video_url,
        target_page: a.target_page || "all",
        skip_label: a.skip_label || "Skip Intro",
        display_order: Number(a.display_order ?? 0),
      };
      const q = a.id
        ? (supabase as any).from("video_ads").update(row).eq("id", a.id)
        : (supabase as any).from("video_ads").insert(row);
      const { error } = await q;
      if (error) { toast.error(error.message); return; }
      toast.success("Video ad saved");
      await load();
    } finally { setBusy(false); }
  }

  async function remove(i: number) {
    const a = ads[i];
    if (!a) return;
    if (a.id) {
      const { error } = await (supabase as any).from("video_ads").delete().eq("id", a.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Deleted");
      await load();
      return;
    }
    setAds((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black tracking-wide text-primary">FULL-SCREEN VIDEO ADS</h3>
          <p className="text-[11px] text-muted-foreground">
            Plays full-screen with sound on entry to the targeted page, loops until skipped. If a page has more than one
            active video ad, only the highest queue-order one plays.
          </p>
        </div>
        <Button size="sm" onClick={() => setAds((p) => [{ ...EMPTY, display_order: p.length }, ...p])}>
          <Plus className="h-4 w-4 mr-1" />New video ad
        </Button>
      </div>

      {ads.length === 0 && <p className="text-xs text-muted-foreground">No video ads yet.</p>}

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

          <div className="flex items-center gap-2">
            <input
              ref={(el) => { fileRefs.current[i] = el; }}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadVideo(i, f); if (fileRefs.current[i]) fileRefs.current[i]!.value = ""; }}
            />
            <Button size="sm" variant="outline" disabled={uploadingIdx === i} onClick={() => fileRefs.current[i]?.click()}>
              {uploadingIdx === i ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {a.video_url ? "Replace video" : "Upload video"}
            </Button>
            {a.video_url && <video src={a.video_url} muted className="h-16 rounded border border-border" />}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Target page</div>
              <Select value={a.target_page ?? "all"} onValueChange={(v) => patch(i, { target_page: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POPUP_PAGE_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input className="h-9" placeholder="Skip button label (default: Skip Intro)" value={a.skip_label ?? ""} onChange={(e) => patch(i, { skip_label: e.target.value })} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Priority (higher plays first if pages overlap)</span>
              <Input type="number" className="h-9 w-20" value={a.display_order ?? 0} onChange={(e) => patch(i, { display_order: Number(e.target.value) })} />
            </div>
            <Button size="sm" disabled={busy} onClick={() => void save(i)}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}Save video ad
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
