import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Megaphone, CalendarClock, Sticker, Trash2, Plus, History, Upload } from "lucide-react";
import { uploadChatFile } from "@/lib/chat-ui";

const sb = supabase as any;
type Room = "general" | "gang" | "moderator";

export function ChatToolsPanel() {
  const { user } = useAuth();
  const [room, setRoom] = useState<Room>("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [matches, setMatches] = useState<any[]>([]);
  const [matchId, setMatchId] = useState("");
  const [assets, setAssets] = useState<any[]>([]);
  const [assetName, setAssetName] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [assetKind, setAssetKind] = useState<"sticker" | "gif">("sticker");
  const [busy, setBusy] = useState(false);

  async function loadAssets() {
    const { data } = await sb.from("chat_assets").select("*").order("sort_order").order("created_at", { ascending: false });
    setAssets(data ?? []);
  }
  useEffect(() => {
    loadAssets();
    sb.from("matches").select("id,name,start_time,status,home_team:home_team_id(name),away_team:away_team_id(name)")
      .in("status", ["scheduled", "live"]).order("start_time").limit(50)
      .then(({ data }: any) => setMatches(data ?? []));
  }, []);

  async function post(kind: "announcement" | "match_reminder", meta: any, content: string) {
    if (!user) return;
    setBusy(true);
    const { data, error } = await sb.from("chat_messages").insert({
      user_id: user.id, room, kind, meta, content, attachments: [], is_pinned: true, pinned_at: new Date().toISOString(), pinned_by: user.id,
    }).select("id").single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(kind === "announcement" ? "Announcement posted to chat" : "Match reminder posted to chat");
    setTitle(""); setBody("");
    return data;
  }

  async function sendAnnouncement() {
    if (!title.trim() && !body.trim()) return toast.error("Add a title or a message");
    await post("announcement", { title: title.trim() || "Announcement" }, `@all ${body.trim()}`.trim());
  }

  async function sendReminder() {
    const m = matches.find((x) => x.id === matchId);
    if (!m) return toast.error("Pick a match first");
    const label = m.name || `${m.home_team?.name ?? "Home"} vs ${m.away_team?.name ?? "Away"}`;
    await post("match_reminder", { title: label, kickoff: m.start_time, matchId: m.id }, `@all ${body.trim() || `${label} is coming up — get your picks in!`}`);
  }

  async function addAsset(url?: string) {
    const finalUrl = url ?? assetUrl.trim();
    if (!finalUrl || !assetName.trim()) return toast.error("Name and image are required");
    const { error } = await sb.from("chat_assets").insert({ name: assetName.trim(), url: finalUrl, kind: assetKind, is_active: true });
    if (error) return toast.error(error.message);
    setAssetName(""); setAssetUrl(""); toast.success("Added to the chat library"); loadAssets();
  }

  async function uploadAsset(file: File) {
    if (!user) return;
    if (!assetName.trim()) return toast.error("Give the sticker a name first");
    setBusy(true);
    try {
      const { url } = await uploadChatFile(user.id, file, file.name);
      await addAsset(url);
    } catch (e: any) { toast.error(e?.message ?? "Upload failed"); }
    setBusy(false);
  }

  async function toggleAsset(a: any) {
    await sb.from("chat_assets").update({ is_active: !a.is_active }).eq("id", a.id); loadAssets();
  }
  async function delAsset(a: any) {
    if (!confirm(`Remove "${a.name}" from the chat library?`)) return;
    await sb.from("chat_assets").delete().eq("id", a.id); loadAssets();
  }

  return (
    <div className="space-y-4">
      <Card className="glass-strong p-4 space-y-3 border-primary/25">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <h3 className="font-black uppercase text-sm">Chat broadcasts</h3>
          <Link to="/admin/chat-history" className="ml-auto">
            <Button size="sm" variant="outline"><History className="h-3.5 w-3.5 mr-1" />Chat history</Button>
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["general", "gang", "moderator"] as Room[]).map((r) => (
            <button key={r} type="button" onClick={() => setRoom(r)} className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${room === r ? "border-primary/60 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground"}`}>{r}</button>
          ))}
        </div>
        <Input placeholder="Announcement title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea rows={3} placeholder="Message to everyone in this channel (tags @all automatically)" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button className="btn-luxury" disabled={busy} onClick={sendAnnouncement}><Megaphone className="h-4 w-4 mr-1" />Post announcement</Button>
        </div>
        <div className="border-t border-border/50 pt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold"><CalendarClock className="h-4 w-4 text-primary" />Match reminder</div>
          <select value={matchId} onChange={(e) => setMatchId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">Select a scheduled or live match…</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id}>{m.name || `${m.home_team?.name ?? "Home"} vs ${m.away_team?.name ?? "Away"}`} · {m.start_time ? new Date(m.start_time).toLocaleString() : "TBD"}</option>
            ))}
          </select>
          <Button variant="outline" disabled={busy} onClick={sendReminder}><CalendarClock className="h-4 w-4 mr-1" />Send reminder to chat</Button>
        </div>
      </Card>

      <Card className="glass-strong p-4 space-y-3 border-primary/25">
        <div className="flex items-center gap-2"><Sticker className="h-4 w-4 text-primary" /><h3 className="font-black uppercase text-sm">Stickers & GIF library</h3><Badge variant="outline" className="ml-auto">{assets.length}</Badge></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Name (e.g. Golden Boot)" value={assetName} onChange={(e) => setAssetName(e.target.value)} />
          <div className="flex gap-2">
            {(["sticker", "gif"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setAssetKind(k)} className={`flex-1 rounded-md border px-3 py-2 text-xs font-semibold uppercase ${assetKind === k ? "border-primary/60 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground"}`}>{k}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Paste an image / GIF URL" value={assetUrl} onChange={(e) => setAssetUrl(e.target.value)} className="flex-1 min-w-[200px]" />
          <Button variant="outline" disabled={busy} onClick={() => addAsset()}><Plus className="h-4 w-4 mr-1" />Add URL</Button>
          <label className="inline-flex">
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadAsset(e.target.files[0])} />
            <span className="inline-flex cursor-pointer items-center rounded-md border border-primary/40 px-3 py-2 text-sm text-primary hover:bg-primary/10"><Upload className="h-4 w-4 mr-1" />Upload file</span>
          </label>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {assets.map((a) => (
            <div key={a.id} className={`relative overflow-hidden rounded-lg border ${a.is_active ? "border-primary/40" : "border-border/40 opacity-40"}`}>
              <img src={a.url} alt={a.name} className="aspect-square w-full object-cover" />
              <div className="flex items-center justify-between bg-background/70 px-1 py-0.5 text-[9px]">
                <button type="button" onClick={() => toggleAsset(a)} className="truncate">{a.is_active ? "On" : "Off"}</button>
                <button type="button" onClick={() => delAsset(a)} className="text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
          {assets.length === 0 && <div className="col-span-full text-xs text-muted-foreground">No stickers or GIFs yet.</div>}
        </div>
      </Card>
    </div>
  );
}
