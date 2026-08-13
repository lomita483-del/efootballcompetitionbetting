import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, History, Search, Download } from "lucide-react";
import { normalizeAttachments } from "@/lib/chat-ui";

export const Route = createFileRoute("/admin_/chat-history")({
  head: () => ({ meta: [
    { title: "Chat History — ECB Admin" },
    { name: "description", content: "Search and filter the full community chat history by member, date, channel and keyword." },
    { property: "og:title", content: "Chat History — ECB Admin" },
    { property: "og:description", content: "Search and filter the full community chat history." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ChatHistoryPage,
});

function ChatHistoryPage() {
  const { user, isMod, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [channel, setChannel] = useState<"all" | "general" | "gang" | "moderator">("all");
  const [media, setMedia] = useState<"all" | "image" | "video" | "audio" | "file">("all");

  useEffect(() => { if (!loading && (!user || !isMod)) nav({ to: "/" }); }, [loading, user, isMod, nav]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(1000);
      setRows(data ?? []);
      const ids = Array.from(new Set((data ?? []).map((m: any) => m.user_id)));
      if (ids.length) {
        const { data: ps } = await supabase.rpc("public_profiles", { _ids: ids as any });
        setProfiles(Object.fromEntries((ps ?? []).map((p: any) => [p.id, p])));
      }
    })();
  }, []);

  const filtered = useMemo(() => rows.filter((m) => {
    if (channel !== "all" && m.room !== channel) return false;
    const who = String(profiles[m.user_id]?.full_name ?? "").toLowerCase();
    if (name.trim() && !who.includes(name.trim().toLowerCase())) return false;
    if (q.trim() && !String(m.content ?? "").toLowerCase().includes(q.trim().toLowerCase())) return false;
    if (date && new Date(m.created_at).toISOString().slice(0, 10) !== date) return false;
    if (media !== "all" && !normalizeAttachments(m).some((a) => a.type === media)) return false;
    return true;
  }), [rows, profiles, channel, name, q, date, media]);

  function exportCsv() {
    const head = ["Date", "Channel", "Member", "Message", "Attachments", "Pinned", "Deleted"];
    const body = filtered.map((m) => [
      new Date(m.created_at).toISOString(),
      m.room,
      profiles[m.user_id]?.full_name ?? m.user_id,
      (m.content ?? "").replace(/"/g, '""'),
      normalizeAttachments(m).map((a) => a.type).join(" "),
      m.is_pinned ? "yes" : "no",
      m.deleted_at ? "yes" : "no",
    ]);
    const csv = [head, ...body].map((r) => r.map((c) => `"${String(c ?? "")}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `chat-history-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout>
      <div className="container py-8 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/admin"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Admin</Button></Link>
          <h1 className="text-2xl font-black gradient-gold-text flex items-center gap-2"><History className="h-5 w-5" />Chat History</h1>
          <Badge variant="outline" className="ml-auto">{filtered.length} messages</Badge>
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
        </div>

        <Card className="glass p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by word…" className="pl-8" />
          </div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Filter by member name" />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="flex gap-2">
            <select value={channel} onChange={(e) => setChannel(e.target.value as any)} className="flex-1 rounded-md border border-border bg-background px-2 py-2 text-sm">
              <option value="all">All channels</option><option value="general">General</option><option value="gang">Gang</option><option value="moderator">Moderator</option>
            </select>
            <select value={media} onChange={(e) => setMedia(e.target.value as any)} className="flex-1 rounded-md border border-border bg-background px-2 py-2 text-sm">
              <option value="all">Any media</option><option value="image">Photos</option><option value="video">Videos</option><option value="audio">Voice</option><option value="file">Files</option>
            </select>
          </div>
        </Card>

        <Card className="glass divide-y divide-border/40">
          {filtered.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No messages match those filters.</div>}
          {filtered.map((m) => (
            <div key={m.id} className="p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <b className="text-foreground">{profiles[m.user_id]?.full_name ?? "Member"}</b>
                <Badge variant="outline" className="capitalize text-[9px]">{m.room}</Badge>
                {m.kind && m.kind !== "user" && <Badge variant="outline" className="text-[9px] capitalize">{String(m.kind).replace("_", " ")}</Badge>}
                {m.is_pinned && <Badge variant="outline" className="text-[9px] border-primary/50 text-primary">Pinned</Badge>}
                <span className="ml-auto">{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <div className={`mt-1 ${m.deleted_at ? "italic text-muted-foreground" : ""}`}>{m.deleted_at ? "Message deleted" : (m.content || "—")}</div>
              {normalizeAttachments(m).length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {normalizeAttachments(m).map((a, i) => <a key={i} href={a.url} target="_blank" rel="noreferrer" className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] capitalize hover:border-primary/50">{a.type}</a>)}
                </div>
              )}
            </div>
          ))}
        </Card>
      </div>
    </Layout>
  );
}
