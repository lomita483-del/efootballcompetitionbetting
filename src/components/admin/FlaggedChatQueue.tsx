import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Ban, MessageSquareOff, ShieldX, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getChatModerationQueue, applyChatModerationAction } from "@/lib/chat-moderation.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function FlaggedChatQueue() {
  const getQueue = useServerFn(getChatModerationQueue);
  const applyAction = useServerFn(applyChatModerationAction);
  const [flags, setFlags] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const result: any = await getQueue();
      setFlags(result.flags ?? []);
      setProfiles(Object.fromEntries((result.profiles ?? []).map((profile: any) => [profile.id, profile])));
    } catch (error) {
      toast.error("Could not load flagged chats", { description: error instanceof Error ? error.message : "Try again." });
    }
  }

  useEffect(() => {
    load();
    const channel = supabase.channel("admin-flagged-chat-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_message_flags" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function act(flagId: string, action: "dismiss" | "delete" | "mute" | "ban") {
    setBusy(`${flagId}:${action}`);
    try {
      await applyAction({ data: { flagId, action } });
      toast.success(action === "dismiss" ? "Report dismissed" : `Moderation action applied: ${action}`);
      await load();
    } catch (error) {
      toast.error("Moderation action failed", { description: error instanceof Error ? error.message : "Try again." });
    } finally { setBusy(null); }
  }

  return <Card className="glass-strong border-destructive/25 p-4">
    <div className="mb-4 flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-destructive" /><div><h3 className="font-black uppercase">Live flagged-chat queue</h3><p className="text-xs text-muted-foreground">Super Admin review and one-click enforcement.</p></div><Badge className="ml-auto" variant="destructive">{flags.length} open</Badge></div>
    {flags.length === 0 ? <div className="py-6 text-center text-sm text-muted-foreground">No chats are awaiting review.</div> : <div className="space-y-3">{flags.map((flag) => {
      const message = Array.isArray(flag.chat_messages) ? flag.chat_messages[0] : flag.chat_messages;
      const sender = profiles[message?.user_id];
      const reporter = profiles[flag.reporter_id];
      return <div key={flag.id} className="rounded-md border border-border bg-background/40 p-3">
        <div className="flex flex-wrap items-start gap-2"><Badge variant="outline" className="capitalize">{flag.reason}</Badge><Badge variant="outline" className="capitalize">{message?.room ?? "chat"}</Badge><span className="ml-auto text-[10px] text-muted-foreground">{new Date(flag.created_at).toLocaleString()}</span></div>
        <div className="mt-2 text-xs text-muted-foreground">Sender: <b className="text-foreground">{sender?.full_name ?? "Unknown"}</b> · Reporter: {reporter?.full_name ?? "User"}</div>
        <div className="mt-2 rounded-md border border-border/60 bg-card/60 p-3 text-sm">{message?.content ?? (message?.image_url ? "Image attachment" : "Message unavailable")}</div>
        {flag.details && <p className="mt-2 text-xs text-muted-foreground">{flag.details}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(flag.id, "dismiss")}><ShieldX className="mr-1 h-3.5 w-3.5" />Dismiss</Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(flag.id, "delete")}><MessageSquareOff className="mr-1 h-3.5 w-3.5" />Delete message</Button>
          <Button size="sm" variant="outline" disabled={!!busy || sender?.is_muted} onClick={() => act(flag.id, "mute")}><VolumeX className="mr-1 h-3.5 w-3.5" />Mute user</Button>
          <Button size="sm" variant="destructive" disabled={!!busy || sender?.is_banned} onClick={() => act(flag.id, "ban")}><Ban className="mr-1 h-3.5 w-3.5" />Ban user</Button>
        </div>
      </div>;
    })}</div>}
  </Card>;
}