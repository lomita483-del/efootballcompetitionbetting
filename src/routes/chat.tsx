import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageSquare, Send, Paperclip, Lock, Reply, Pencil, Trash2, X, AtSign, Flag, Mic, Square,
  Search, ChevronsDown, Pin, PinOff, Smile, FileText, Megaphone, CalendarClock, Filter,
  Hash, ChevronDown, ClipboardList,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_LABELS, type AppRole } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { notifyChatMessage } from "@/lib/chat-notifications.functions";
import { MAX_ATTACHMENTS, attachmentTypeFor, bubbleStyle, dayLabel, formatDuration, normalizeAttachments, rankFor, uploadChatFile, type ChatAttachment } from "@/lib/chat-ui";
import { fetchMatches, type MatchRow } from "@/lib/queries";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Community Chat — ECB" }, { name: "description", content: "Live chat with shooters, your gang, and moderators." }] }),
  component: ChatPage,
});

type Room = "general" | "gang" | "moderator";

const ROOM_META: Record<Room, { label: string; subtitle: string }> = {
  general: { label: "General Chat", subtitle: "Be respectful. No spam. No abusive accounts." },
  gang: { label: "Gang Chats", subtitle: "Talk tactics with your gang." },
  moderator: { label: "Moderator Chats", subtitle: "Staff-only discussion." },
};

function formatMatchWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today • ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow • ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} • ${time}`;
}

function formatCountdown(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Live soon";
  const mins = Math.floor(diff / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const remMins = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${remMins}m`;
  return `${remMins}m`;
}

function ChatPage() {
  const { user, profile, isMod, roles } = useAuth();
  const nav = useNavigate();
  const [room, setRoom] = useState<Room>("general");
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [sections, setSections] = useState({ channels: true, announcements: true, reminders: true });

  useEffect(() => { if (!user) nav({ to: "/login" }); }, [user, nav]);

  useEffect(() => {
    const load = () => {
      (supabase as any)
        .from("chat_messages")
        .select("id,room,kind,content,meta,created_at")
        .in("kind", ["announcement", "match_reminder"])
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(10)
        .then(({ data }: any) => setAnnouncements(data ?? []));
    };
    load();
    const ch = supabase.channel("chat-announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    fetchMatches()
      .then((all) => {
        const upcoming = all
          .filter((m) => m.status === "scheduled")
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
          .slice(0, 3);
        setMatches(upcoming);
      })
      .catch(() => {});
  }, []);

  if (!user || !profile) return <Layout><div className="container py-10">Loading…</div></Layout>;

  const canGang = ["gang_leader", "moderator", "admin"].some((r) => roles.includes(r as any));

  return (
    <Layout>
      <div className="container py-6 md:py-10">
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Sidebar room={room} setRoom={setRoom} canGang={canGang} isMod={isMod} matches={matches} announcements={announcements} sections={sections} setSections={setSections} />
          <div className="min-w-0">
            <Room room={room} muted={profile.is_muted} title={ROOM_META[room].label} subtitle={ROOM_META[room].subtitle} />
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Sidebar({ room, setRoom, canGang, isMod, matches, announcements, sections, setSections }: {
  room: Room; setRoom: (r: Room) => void; canGang: boolean; isMod: boolean; matches: MatchRow[]; announcements: any[];
  sections: { channels: boolean; announcements: boolean; reminders: boolean };
  setSections: React.Dispatch<React.SetStateAction<{ channels: boolean; announcements: boolean; reminders: boolean }>>;
}) {
  const visibleAnnouncements = announcements.filter((a) =>
    a.room === "general" || (a.room === "gang" && canGang) || (a.room === "moderator" && isMod),
  );
  const channels: { id: Room; label: string; locked: boolean }[] = [
    { id: "general", label: "General Chat", locked: false },
    { id: "gang", label: "Gang Chats", locked: !canGang },
    { id: "moderator", label: "Moderator Chats", locked: !isMod },
  ];

  return (
    <aside className="lg:sticky lg:top-20 h-fit">
      <div className="flex items-center gap-2 px-1 pb-3 lg:hidden">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-black gradient-gold-text">Community Chat</h1>
      </div>
      <div className="rounded-2xl border border-primary/25 bg-background/40 backdrop-blur-xl p-3 space-y-4">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black uppercase tracking-widest gradient-gold-text">Channels</span>
        </div>

        <SidebarSection
          title="Chat Channels"
          open={sections.channels}
          onToggle={() => setSections((s) => ({ ...s, channels: !s.channels }))}
        >
          {channels.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={c.locked}
              onClick={() => setRoom(c.id)}
              className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-sm transition-colors ${
                room === c.id && !c.locked
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground hover:border-border/60 hover:text-foreground"
              } ${c.locked ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {c.locked ? <Lock className="h-3.5 w-3.5 shrink-0" /> : <Hash className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate font-semibold">{c.label}</span>
              {room === c.id && !c.locked && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_1px] shadow-emerald-400/70" />
              )}
            </button>
          ))}
        </SidebarSection>

        <SidebarSection
          title="Announcements"
          open={sections.announcements}
          onToggle={() => setSections((s) => ({ ...s, announcements: !s.announcements }))}
        >
          {visibleAnnouncements.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">No announcements yet.</p>
          )}
          {visibleAnnouncements.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                setRoom(a.room as Room);
                setTimeout(() => document.getElementById(`msg-${a.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 350);
              }}
              className="flex w-full items-start gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
            >
              {a.kind === "match_reminder"
                ? <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                : <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />}
              <span className="min-w-0">
                <span className="block truncate font-semibold text-foreground">{a.meta?.title ?? (a.kind === "match_reminder" ? "Match reminder" : "Announcement")}</span>
                <span className="block truncate text-[11px]">{a.content ?? ""}</span>
              </span>
            </button>
          ))}
        </SidebarSection>

        <SidebarSection
          title="Match Reminders"
          open={sections.reminders}
          onToggle={() => setSections((s) => ({ ...s, reminders: !s.reminders }))}
        >
          {matches.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">No upcoming matches.</p>}
          {matches.map((m) => (
            <Link
              key={m.id}
              to="/matches/$matchId"
              params={{ matchId: m.id }}
              className="block rounded-xl border border-border/50 bg-background/40 px-3 py-2 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-semibold">
                  {m.home_team?.name ?? "Home"} vs {m.away_team?.name ?? "Away"}
                </span>
                <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">
                  {formatCountdown(m.start_time)}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{formatMatchWhen(m.start_time)}</div>
            </Link>
          ))}
        </SidebarSection>
      </div>
    </aside>
  );
}

function SidebarSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div>
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-1 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <span>{title}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="mt-1 space-y-1">{children}</div>}
    </div>
  );
}

type MediaFilter = "all" | "image" | "video" | "audio" | "file" | "sticker";

function Room({ room, muted, title, subtitle }: { room: Room; muted: boolean; title: string; subtitle: string }) {
  const { user, isMod, profile: myProfile } = useAuth();
  const sendChatNotification = useServerFn(notifyChatMessage);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [reactions, setReactions] = useState<Record<string, any[]>>({});
  const [text, setText] = useState("");
  const [pending, setPending] = useState<{ file: File; preview: string; type: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [active, setActive] = useState<any>(null);
  const [profilesById, setProfilesById] = useState<Record<string, any>>({});
  const [rolesById, setRolesById] = useState<Record<string, string[]>>({});
  const [members, setMembers] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimer = useRef<number | null>(null);
  const holdRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const mentionTerm = useMemo(() => {
    const m = text.match(/@([\w\s.-]{0,24})$/);
    return m ? m[1].toLowerCase() : null;
  }, [text]);
  const mentionMatches = useMemo(() => mentionTerm === null ? [] : [
    { id: "all", full_name: "all", gang_name: "Notify everyone" },
    ...members.filter((m) => String(m.full_name ?? "").toLowerCase().includes(mentionTerm)).slice(0, 5),
  ].filter((m) => String(m.full_name).toLowerCase().includes(mentionTerm)), [members, mentionTerm]);

  const mentionNames = useMemo(
    () => members.map((m) => String(m.full_name ?? "").trim()).filter(Boolean),
    [members],
  );
  const myNames = useMemo(
    () => [myProfile?.full_name, (myProfile as any)?.ingame_name].filter(Boolean).map((n: any) => String(n)),
    [myProfile],
  );

  useEffect(() => { setBannerDismissed(false); }, [room]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data, error } = await supabase.from("chat_messages").select("*").eq("room", room).order("created_at", { ascending: true }).limit(200);
      if (!mounted) return;
      if (error) { toast.error(error.message); return; }
      setMsgs(data ?? []);
      await loadProfiles((data ?? []).flatMap((m: any) => [m.user_id, m.deleted_by].filter(Boolean)));
      await loadReactions((data ?? []).map((m: any) => m.id));
    };
    load();
    supabase.rpc("public_profiles").then(({ data }) => setMembers((data ?? []).slice(0, 200).map((p: any) => ({ id: p.id, full_name: p.full_name, gang_name: p.gang_name }))));
    (supabase as any).from("chat_assets").select("*").eq("is_active", true).order("sort_order").then(({ data }: any) => setAssets(data ?? []));
    const ch = supabase.channel(`chat-${room}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `room=eq.${room}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_message_reactions" }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [room]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  async function loadProfiles(ids: string[]) {
    const need = Array.from(new Set(ids)).filter((id) => id && !profilesById[id]);
    if (need.length === 0) return;
    const [{ data }, { data: r }] = await Promise.all([
      supabase.rpc("public_profiles", { _ids: need }),
      (supabase as any).rpc("public_display_roles", { _ids: need }),
    ]);
    setProfilesById((prev) => {
      const next = { ...prev };
      (data ?? []).forEach((p: any) => { next[p.id] = p; });
      return next;
    });
    setRolesById((prev) => {
      const next = { ...prev };
      (r ?? []).forEach((row: any) => { next[row.user_id] = row.roles ?? []; });
      return next;
    });
  }

  async function loadReactions(ids: string[]) {
    if (ids.length === 0) return;
    const { data } = await supabase.from("chat_message_reactions").select("*").in("message_id", ids);
    const grouped: Record<string, any[]> = {};
    (data ?? []).forEach((r: any) => { grouped[r.message_id] = [...(grouped[r.message_id] ?? []), r]; });
    setReactions(grouped);
  }

  async function insertMessage(payload: any) {
    const { data, error } = await (supabase as any).from("chat_messages").insert(payload).select("id").single();
    if (error) { toast.error(error.message); return null; }
    if (data?.id) sendChatNotification({ data: { messageId: data.id } }).catch(() => {});
    return data;
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!text.trim() && pending.length === 0) return;
    if (editing) {
      const { error } = await supabase.from("chat_messages").update({ content: text.trim(), edited_at: new Date().toISOString() }).eq("id", editing.id);
      if (error) toast.error(error.message); else { setEditing(null); setText(""); }
      return;
    }
    setSending(true);
    const attachments: ChatAttachment[] = [];
    try {
      for (const p of pending) {
        const { url } = await uploadChatFile(user.id, p.file, p.file.name);
        attachments.push({ url, type: attachmentTypeFor(p.file), name: p.file.name, mime: p.file.type, size: p.file.size });
      }
    } catch (err: any) { setSending(false); toast.error(err?.message ?? "Upload failed"); return; }
    await insertMessage({
      user_id: user.id,
      room,
      content: text.trim() || null,
      image_url: attachments.find((a) => a.type === "image")?.url ?? null,
      attachments,
      reply_to_id: replyTo?.id ?? null,
    });
    setSending(false);
    setText(""); setReplyTo(null); clearAttachments();
  }

  async function sendAsset(asset: any) {
    if (!user) return;
    await insertMessage({
      user_id: user.id, room, content: null,
      attachments: [{ url: asset.url, type: asset.kind === "gif" ? "gif" : "sticker", name: asset.name }],
      reply_to_id: replyTo?.id ?? null,
    });
    setReplyTo(null);
  }

  function attachFiles(files: File[]) {
    const slots = MAX_ATTACHMENTS - pending.length;
    if (slots <= 0) { toast.error(`You can attach up to ${MAX_ATTACHMENTS} files`); return; }
    if (files.length > slots) toast.error(`Only ${slots} more file${slots === 1 ? "" : "s"} allowed — extras ignored`);
    const next = files.slice(0, slots).map((f) => ({ file: f, preview: URL.createObjectURL(f), type: attachmentTypeFor(f) }));
    setPending((p) => [...p, ...next]);
  }
  function removePending(i: number) {
    setPending((p) => { URL.revokeObjectURL(p[i].preview); return p.filter((_, idx) => idx !== i); });
  }
  function clearAttachments() {
    pending.forEach((p) => URL.revokeObjectURL(p.preview));
    setPending([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1200 || !user) { toast.error("That voice note was empty — try again"); return; }
        try {
          const ext = (rec.mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm";
          const { url } = await uploadChatFile(user.id, blob, `voice-note.${ext}`);
          await insertMessage({ user_id: user.id, room, content: null, attachments: [{ url, type: "audio", name: "Voice note", mime: blob.type }], reply_to_id: replyTo?.id ?? null });
          setReplyTo(null);
        } catch (err: any) { toast.error(err?.message ?? "Could not send the voice note"); }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true); setRecSeconds(0);
      recTimer.current = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch { toast.error("Microphone access is needed to record a voice note"); }
  }
  function stopRecording(cancel = false) {
    if (recTimer.current) window.clearInterval(recTimer.current);
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") { if (cancel) rec.onstop = () => rec.stream.getTracks().forEach((t) => t.stop()); rec.stop(); }
    recorderRef.current = null;
    setRecording(false); setRecSeconds(0);
  }

  async function del(m: any) {
    const patch = { content: null, image_url: null, attachments: [], deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null };
    const { error } = await (supabase as any).from("chat_messages").update(patch).eq("id", m.id);
    if (error) toast.error(error.message);
    setActive(null);
  }

  async function togglePin(m: any) {
    const { error } = await (supabase as any).from("chat_messages")
      .update({ is_pinned: !m.is_pinned, pinned_at: m.is_pinned ? null : new Date().toISOString(), pinned_by: m.is_pinned ? null : user?.id ?? null })
      .eq("id", m.id);
    if (error) toast.error(error.message); else toast.success(m.is_pinned ? "Unpinned" : "Pinned to this channel");
    setActive(null);
  }

  async function react(messageId: string, emoji: string) {
    if (!user) return;
    const mine = (reactions[messageId] ?? []).find((r) => r.user_id === user.id && r.emoji === emoji);
    const res = mine
      ? await supabase.from("chat_message_reactions").delete().eq("id", mine.id)
      : await supabase.from("chat_message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
    if (res.error) toast.error(res.error.message);
    setActive(null);
  }

  function startHold(m: any) {
    if (holdRef.current) window.clearTimeout(holdRef.current);
    holdRef.current = window.setTimeout(() => setActive(m), 450);
  }
  function stopHold() { if (holdRef.current) window.clearTimeout(holdRef.current); }
  function chooseMention(name: string) { setText((v) => v.replace(/@[\w\s.-]{0,24}$/, `@${name} `)); }
  function jumpToLatest() { endRef.current?.scrollIntoView({ behavior: "smooth" }); }

  const pinned = msgs.filter((m) => m.is_pinned && !m.deleted_at);
  const latestPinned = pinned[pinned.length - 1];
  const q = search.trim().toLowerCase();
  const visible = msgs.filter((m) => {
    const atts = normalizeAttachments(m);
    if (mediaFilter !== "all") {
      const has = mediaFilter === "sticker"
        ? atts.some((a) => a.type === "sticker" || a.type === "gif")
        : atts.some((a) => a.type === mediaFilter);
      if (!has) return false;
    }
    if (!q) return true;
    const name = String(profilesById[m.user_id]?.full_name ?? "").toLowerCase();
    return String(m.content ?? "").toLowerCase().includes(q) || name.includes(q);
  });

  const filters: { id: MediaFilter; label: string }[] = [
    { id: "all", label: "All" }, { id: "image", label: "Photos" }, { id: "video", label: "Videos" },
    { id: "audio", label: "Voice" }, { id: "file", label: "Files" }, { id: "sticker", label: "Stickers" },
  ];

  return (
    <Card className="glass-strong flex flex-col h-[74vh] overflow-hidden border-primary/25 rounded-2xl">
      <div className="border-b border-border/50 p-4 space-y-3 bg-background/40 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-black gradient-gold-text truncate">{title}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_1px] shadow-emerald-400/70" />
              {subtitle}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search in chat…" className="h-9 w-40 sm:w-56 pl-8 text-sm rounded-full bg-background/60" />
            </div>
            <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-full shrink-0 border-primary/30 text-primary" title="Filter" onClick={() => setShowFilters((s) => !s)}>
              <Filter className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-full shrink-0" title="Jump to latest" onClick={jumpToLatest}>
              <ChevronsDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {filters.map((f) => (
              <button key={f.id} type="button" onClick={() => setMediaFilter(f.id)}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${mediaFilter === f.id ? "border-primary/60 bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-primary/40"}`}>{f.label}</button>
            ))}
          </div>
        )}

        {latestPinned && !bannerDismissed && (
          <div className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3">
            <Pin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-primary">
                Announcement{pinned.length > 1 ? ` · ${pinned.length} pinned` : ""}
              </div>
              <p className="mt-0.5 truncate text-sm">
                <b>{profilesById[latestPinned.user_id]?.full_name ?? "Pinned"}:</b> {latestPinned.content ?? "Attachment"}
              </p>
            </div>
            <Button
              type="button" size="sm" className="btn-luxury shrink-0 h-8 rounded-full px-3 text-xs"
              onClick={() => document.getElementById(`msg-${latestPinned.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            >
              View
            </Button>
            <button type="button" onClick={() => setBannerDismissed(true)} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {visible.length === 0 && <p className="text-muted-foreground text-sm text-center py-6">{msgs.length === 0 ? "Be the first to say something." : "No messages match your search."}</p>}
        {visible.map((m: any, i: number) => {
          const prev = visible[i - 1];
          const showDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
          return (
            <div key={m.id}>
              {showDay && <div className="my-3 flex justify-center"><span className="rounded-full border border-border/50 bg-background/60 px-3 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur">{dayLabel(m.created_at)}</span></div>}
              <MessageRow
                m={m}
                mine={m.user_id === user?.id}
                profile={profilesById[m.user_id]}
                roles={rolesById[m.user_id] ?? []}
                replyMsg={msgs.find((x) => x.id === m.reply_to_id)}
                replyName={profilesById[msgs.find((x) => x.id === m.reply_to_id)?.user_id]?.full_name}
                reactions={reactions[m.id] ?? []}
                onReact={react}
                onHoldStart={() => startHold(m)}
                onHoldEnd={stopHold}
                onOpen={() => setActive(m)}
                mentionNames={mentionNames}
                myNames={myNames}
              />
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {active && <MessageActions message={active} mine={active.user_id === user?.id} isMod={isMod} onClose={() => setActive(null)} onReply={() => { setReplyTo(active); setActive(null); }} onEdit={() => { setEditing(active); setText(active.content ?? ""); setActive(null); }} onDelete={() => del(active)} onPin={() => togglePin(active)} onReport={async () => {
        if (!user) return;
        const { error } = await (supabase as any).from("chat_message_flags").insert({ message_id: active.id, reporter_id: user.id, reason: "inappropriate" });
        if (error) toast.error(error.code === "23505" ? "You already reported this message" : error.message); else toast.success("Message sent to moderation");
        setActive(null);
      }} onReact={(e: string) => react(active.id, e)} />}

      {muted ? <div className="p-3 border-t border-border text-sm text-destructive text-center">You are muted and cannot send messages.</div> : (
        <form onSubmit={send} className="relative p-3 border-t border-border space-y-2">
          {(replyTo || editing) && <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs"><span>{editing ? "Editing" : "Replying to"} <b>{profilesById[(editing ?? replyTo).user_id]?.full_name ?? "Shooter"}</b></span><button type="button" onClick={() => { setReplyTo(null); setEditing(null); setText(""); }}><X className="h-3.5 w-3.5" /></button></div>}
          {mentionMatches.length > 0 && <div className="absolute bottom-16 left-14 right-16 z-10 rounded-xl border border-primary/30 bg-popover p-1 shadow-luxury">{mentionMatches.map((m) => <button type="button" key={m.id} onClick={() => chooseMention(m.full_name)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-primary/10"><AtSign className="h-3 w-3 text-primary" />{m.full_name}<span className="ml-auto text-[10px] text-muted-foreground">{m.gang_name ?? "Independent"}</span></button>)}</div>}
          {pending.length > 0 && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2">
              {pending.map((p, i) => (
                <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-primary/40 bg-background/60">
                  {p.type === "image" || p.type === "gif" ? <img src={p.preview} alt={p.file.name} className="h-full w-full object-cover" />
                    : p.type === "video" ? <video src={p.preview} className="h-full w-full object-cover" muted />
                    : <div className="grid h-full w-full place-items-center text-[9px] text-muted-foreground px-1 text-center"><FileText className="h-4 w-4" /></div>}
                  <button type="button" onClick={() => removePending(i)} className="absolute right-0 top-0 rounded-bl-lg bg-background/80 p-0.5"><X className="h-3 w-3" /></button>
                </div>
              ))}
              <div className="self-center text-[11px] text-muted-foreground">{pending.length}/{MAX_ATTACHMENTS} attached — add a caption below.</div>
            </div>
          )}
          <div className="flex items-end gap-2 rounded-full border border-primary/25 bg-background/50 px-2 py-1.5 focus-within:border-primary/60 transition-colors">
            <input ref={fileRef} type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" hidden onChange={(e) => { if (e.target.files) attachFiles(Array.from(e.target.files)); e.target.value = ""; }} />
            <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full border border-primary/30 text-primary hover:bg-primary/10" onClick={() => fileRef.current?.click()}><Paperclip className="h-4 w-4" /></Button>
            <StickerPicker assets={assets} onPick={sendAsset} />
            {recording ? (
              <div className="flex flex-1 items-center gap-2 px-2 text-sm">
                <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                <span className="font-mono">{formatDuration(recSeconds)}</span>
                <span className="text-xs text-muted-foreground">Recording voice note…</span>
                <Button type="button" size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => stopRecording(true)}>Cancel</Button>
                <Button type="button" size="icon" className="btn-luxury h-9 w-9 rounded-full" onClick={() => stopRecording(false)}><Square className="h-4 w-4" /></Button>
              </div>
            ) : (
              <>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onPaste={(e) => { const f = Array.from(e.clipboardData.files); if (f.length) { e.preventDefault(); attachFiles(f); } }}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(e as any); } }}
                  rows={1}
                  placeholder="Type a message…"
                  className="flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none max-h-40 min-h-[2.5rem]"
                />
                <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full border border-primary/30 text-primary hover:bg-primary/10" onClick={startRecording} title="Record a voice note"><Mic className="h-4 w-4" /></Button>
                <Button type="submit" disabled={sending || (!text.trim() && pending.length === 0)} className="btn-luxury shrink-0 rounded-full h-10 w-10 p-0"><Send className="h-4 w-4" /></Button>
              </>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}

function StickerPicker({ assets, onPick }: { assets: any[]; onPick: (a: any) => void }) {
  const [open, setOpen] = useState(false);
  const stickers = assets.filter((a) => a.kind !== "gif");
  const gifs = assets.filter((a) => a.kind === "gif");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full border border-primary/30 text-primary hover:bg-primary/10"><Smile className="h-4 w-4" /></Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 border-primary/30 bg-card/95 backdrop-blur-xl p-3 space-y-3">
        {assets.length === 0 && <div className="text-xs text-muted-foreground">No stickers or GIFs yet — an admin can add them from the chat moderation panel.</div>}
        {[["Stickers", stickers], ["GIFs", gifs]].map(([label, list]: any) => list.length > 0 && (
          <div key={label}>
            <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
            <div className="grid grid-cols-4 gap-2">
              {list.map((a: any) => (
                <button key={a.id} type="button" onClick={() => { onPick(a); setOpen(false); }} className="aspect-square overflow-hidden rounded-lg border border-border/60 hover:border-primary/60">
                  <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function MessageRow({ m, mine, profile, roles, replyMsg, replyName, reactions, onReact, onHoldStart, onHoldEnd, onOpen, mentionNames = [], myNames = [] }: any) {
  const atts: ChatAttachment[] = normalizeAttachments(m);
  const deleted = !!m.deleted_at;
  const rank = rankFor(profile?.xp);
  const grouped = Object.entries((reactions ?? []).reduce((a: any, r: any) => { a[r.emoji] = (a[r.emoji] ?? 0) + 1; return a; }, {}));
  const isSponsor = roles.includes("sponsor");
  const isVip = ["gold", "platinum", "legend"].includes(String(profile?.vip_tier ?? "").toLowerCase());
  const name = profile?.ingame_name || profile?.full_name || "Shooter";

  if (m.kind === "announcement" || m.kind === "match_reminder") {
    const isReminder = m.kind === "match_reminder";
    return (
      <div id={`msg-${m.id}`} className="mx-auto max-w-lg rounded-2xl border border-primary/40 bg-primary/10 p-4 backdrop-blur-xl shadow-[0_10px_40px_-20px_hsl(var(--primary)/0.9)]">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary font-black">
          {isReminder ? <CalendarClock className="h-3.5 w-3.5" /> : <Megaphone className="h-3.5 w-3.5" />}
          {isReminder ? "Match reminder" : "Announcement"}
          <span className="ml-auto text-muted-foreground normal-case tracking-normal">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        {m.meta?.title && <div className="mt-1.5 text-base font-bold">{m.meta.title}</div>}
        {m.content && <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{highlightMentions(m.content, mentionNames, myNames)}</div>}
        {m.meta?.kickoff && (
          <div className="mt-1.5 text-xs font-semibold text-primary">
            Starts {formatCountdown(m.meta.kickoff)} · {new Date(m.meta.kickoff).toLocaleString()}
          </div>
        )}
        {isReminder && m.meta?.matchId && (
          <Button asChild size="sm" variant="outline" className="mt-3 rounded-full border-primary/50 text-primary hover:bg-primary/10">
            <Link to="/matches/$matchId" params={{ matchId: m.meta.matchId }}>View Match</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`} onPointerDown={onHoldStart} onPointerUp={onHoldEnd} onPointerLeave={onHoldEnd} onContextMenu={(e) => { e.preventDefault(); onOpen(); }}>
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-gold grid place-items-center text-primary-foreground font-bold text-xs shadow-[0_0_16px_-4px_hsl(var(--primary)/0.8)]" style={{ boxShadow: `0 0 0 2px ${rank.style.ring}` }}>
        {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}
      </div>
      <div className={`max-w-[78%] min-w-0 ${mine ? "items-end" : "items-start"} flex flex-col`}>
        <div
          id={`msg-${m.id}`}
          style={bubbleStyle(profile?.xp, mine)}
          className={`relative rounded-2xl border px-3 py-2 backdrop-blur-xl backdrop-saturate-150 ${mine ? "rounded-br-sm" : "rounded-bl-sm"} ${isSponsor ? "ring-1 ring-amber-300/60" : isVip ? "ring-1 ring-fuchsia-300/40" : ""}`}
        >
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            <UserBadge userId={m.user_id} name={name} />
            <span className="rounded-full border px-1.5 py-[1px] text-[9px] font-black uppercase tracking-wide" style={{ borderColor: rank.style.ring, color: rank.style.text }}>{rank.title}</span>
            {isSponsor && <span className="rounded-full bg-amber-400/20 px-1.5 py-[1px] text-[9px] font-black uppercase text-amber-200">Sponsor</span>}
            {!isSponsor && isVip && <span className="rounded-full bg-fuchsia-400/20 px-1.5 py-[1px] text-[9px] font-black uppercase text-fuchsia-200">VIP {profile?.vip_tier}</span>}
            {roles.includes("admin") && <span className="rounded-full bg-violet-400/20 px-1.5 py-[1px] text-[9px] font-black uppercase text-violet-200">Admin</span>}
            {roles.includes("moderator") && !roles.includes("admin") && <span className="rounded-full bg-amber-400/20 px-1.5 py-[1px] text-[9px] font-black uppercase text-amber-200">Mod</span>}
            {roles.includes("gang_leader") && !roles.includes("admin") && !roles.includes("moderator") && <span className="rounded-full bg-emerald-400/20 px-1.5 py-[1px] text-[9px] font-black uppercase text-emerald-200">Gang Leader</span>}
            {m.is_pinned && <Pin className="h-3 w-3 text-primary" />}
            <span className="text-muted-foreground">· {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{m.edited_at ? " · edited" : ""}</span>
          </div>
          {replyMsg && <button onClick={() => document.getElementById(`msg-${replyMsg.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} className="mt-1 w-full text-left rounded-lg border-l-2 border-primary bg-background/30 px-2 py-1 text-[11px] text-muted-foreground truncate">↪ {replyName ?? "Shooter"}: {replyMsg.content ?? "Attachment"}</button>}
          {deleted ? <div className="text-sm italic text-muted-foreground">Message deleted</div> : (
            <>
              {m.content && <div className="mt-0.5 text-sm break-words whitespace-pre-wrap">{highlightMentions(m.content, mentionNames, myNames)}</div>}
              {atts.length > 0 && <Attachments items={atts} />}
            </>
          )}
          {grouped.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{grouped.map(([emoji, count]) => <button key={emoji} onClick={() => onReact(m.id, emoji)} className="rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-xs">{emoji} {count as number}</button>)}</div>}
        </div>
      </div>
    </div>
  );
}

function Attachments({ items }: { items: ChatAttachment[] }) {
  const [viewer, setViewer] = useState<ChatAttachment | null>(null);
  const media = items.filter((a) => a.type === "image" || a.type === "video" || a.type === "gif" || a.type === "sticker");
  const others = items.filter((a) => !media.includes(a));
  return (
    <div className="mt-1 space-y-1">
      {media.length > 0 && (
        <div className={`grid gap-1 ${media.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {media.map((a, i) => a.type === "video"
            ? <video key={i} src={a.url} controls playsInline className="max-h-64 w-full rounded-lg border border-border/60 object-cover" />
            : (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); setViewer(a); }}
                onPointerDown={(e) => e.stopPropagation()}
                className="block"
                title="Tap to view"
              >
                <img src={a.url} alt={a.name ?? "Attachment"} className={`cursor-zoom-in rounded-lg border border-border/60 object-cover ${a.type === "sticker" ? "max-h-28 w-28 border-none" : "max-h-64 w-full"}`} />
              </button>
            ))}
        </div>
      )}
      {others.map((a, i) => a.type === "audio"
        ? <audio key={i} src={a.url} controls className="w-56 max-w-full" />
        : <a key={i} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-xs hover:border-primary/50"><FileText className="h-3.5 w-3.5 text-primary" /><span className="truncate">{a.name ?? "File"}</span></a>)}
      {viewer && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-fade-in"
          onClick={(e) => { e.stopPropagation(); setViewer(null); }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <img src={viewer.url} alt={viewer.name ?? "Attachment"} className="max-h-[85vh] max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
          <div className="absolute right-4 top-4 flex gap-2">
            <a href={viewer.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="rounded-full border border-white/30 bg-black/60 px-3 py-1.5 text-xs text-white">Open</a>
            <button type="button" onClick={() => setViewer(null)} className="rounded-full border border-white/30 bg-black/60 p-1.5 text-white"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageActions({ message, mine, isMod, onClose, onReply, onEdit, onDelete, onReport, onReact, onPin }: any) {
  const emojis = ["🔥", "💀", "👑", "✅", "😂", "🎯"];
  return <div className="border-t border-border bg-card/95 p-3 backdrop-blur-xl animate-fade-in">
    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>Message actions</span><button onClick={onClose}><X className="h-4 w-4" /></button></div>
    <div className="mb-2 flex flex-wrap gap-1">{emojis.map((e) => <button key={e} onClick={() => onReact(e)} className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-lg hover:bg-primary/10">{e}</button>)}</div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Button type="button" variant="outline" size="sm" onClick={onReply}><Reply className="h-3.5 w-3.5 mr-1" />Reply</Button>
      {mine && !message.deleted_at && <Button type="button" variant="outline" size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>}
      {isMod && <Button type="button" variant="outline" size="sm" onClick={onPin}>{message.is_pinned ? <><PinOff className="h-3.5 w-3.5 mr-1" />Unpin</> : <><Pin className="h-3.5 w-3.5 mr-1" />Pin</>}</Button>}
      {(mine || isMod) && <Button type="button" variant="outline" size="sm" onClick={onDelete} className="text-destructive"><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>}
      {!mine && <Button type="button" variant="outline" size="sm" onClick={onReport} className="text-destructive"><Flag className="h-3.5 w-3.5 mr-1" />Report</Button>}
    </div>
  </div>;
}

function highlightMentions(content: string, mentionNames: string[] = [], myNames: string[] = []) {
  const known = [...mentionNames, "all", "everyone"].filter(Boolean);
  const mine = new Set(myNames.map((n) => n.toLowerCase()));
  const nodes: React.ReactNode[] = [];
  let rest = content;
  let key = 0;
  while (rest.length > 0) {
    const at = rest.indexOf("@");
    if (at === -1) { nodes.push(rest); break; }
    if (at > 0) nodes.push(rest.slice(0, at));
    const after = rest.slice(at + 1);
    // longest known name that this mention starts with (names can contain spaces)
    const match = known
      .filter((n) => after.toLowerCase().startsWith(n.toLowerCase()))
      .sort((a, b) => b.length - a.length)[0];
    if (!match) { nodes.push("@"); rest = after; continue; }
    const label = `@${after.slice(0, match.length)}`;
    const isEveryone = match.toLowerCase() === "all" || match.toLowerCase() === "everyone";
    const isMe = mine.has(match.toLowerCase()) || isEveryone;
    nodes.push(
      <span
        key={`m-${key++}`}
        className={`rounded px-1 font-bold ${isMe ? "bg-primary/25 text-primary ring-1 ring-primary/40" : "bg-primary/10 text-primary"}`}
      >
        {label}
      </span>,
    );
    rest = after.slice(match.length);
  }
  return nodes;
}

function UserBadge({ userId, name }: { userId: string; name: string }) {
  const [profile, setProfile] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || profile) return;
    (async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.rpc("public_profiles", { _ids: [userId] }),
        supabase.rpc("get_display_roles", { _user_id: userId }),
      ]);
      setProfile(Array.isArray(p) ? p[0] ?? null : p);
      setRoles((r ?? []) as string[]);
    })();
  }, [open, userId, profile]);

  const tier = profile?.vip_tier || "bronze";
  const tierColor: Record<string, string> = {
    bronze: "from-amber-700 to-amber-900",
    silver: "from-slate-300 to-slate-500",
    gold: "from-amber-300 to-amber-600",
    platinum: "from-cyan-200 to-cyan-500",
    legend: "from-fuchsia-300 to-violet-600",
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="font-bold text-primary hover:underline">{name}</button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 overflow-hidden border-primary/40 bg-card/95 backdrop-blur-xl">
        <div className={`h-16 bg-gradient-to-r ${tierColor[tier] ?? tierColor.bronze}`} />
        <div className="-mt-8 px-4 pb-4">
          <div className="h-16 w-16 rounded-2xl border-2 border-card bg-gradient-gold grid place-items-center text-primary-foreground font-bold shadow-xl">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full rounded-2xl object-cover" /> : (name).slice(0, 2).toUpperCase()}
          </div>
          <div className="mt-2 font-bold text-base">{profile?.ingame_name || profile?.full_name || name}</div>
          {profile?.profile_title && <div className="text-xs text-amber-300">{profile.profile_title}</div>}
          <div className="text-xs text-muted-foreground">{profile?.gang_name ?? "Independent"}{profile?.country ? ` · ${profile.country}` : ""}</div>

          <div className="flex flex-wrap gap-1 mt-3">
            <Badge variant="outline" className="text-[10px] uppercase border-primary/40 text-primary capitalize">{tier} VIP</Badge>
            <Badge variant="outline" className="text-[10px]" style={{ borderColor: rankFor(profile?.xp).style.ring, color: rankFor(profile?.xp).style.text }}>{rankFor(profile?.xp).title}</Badge>
            {roles.map((r) => <Badge key={r} variant="outline" className="text-[10px]">{ROLE_LABELS[r as AppRole] ?? r}</Badge>)}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-border/60 bg-background/40 p-2">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">XP</div>
              <div className="font-bold gradient-gold-text text-sm">{Number(profile?.xp ?? 0).toLocaleString()}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-2">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Streak</div>
              <div className="font-bold text-amber-300 text-sm">{profile?.streak_days ?? 0}🔥</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-2">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Best</div>
              <div className="font-bold text-emerald-300 text-sm">{profile?.longest_streak ?? 0}</div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
