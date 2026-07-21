import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { MessageSquare, Paperclip, Send, ShieldAlert, Plus } from "lucide-react";

/**
 * Dispute thread for a wager. Both parties + admins can post messages and
 * attach evidence images. If no dispute exists yet, either party can open one.
 */
export function WagerDisputeThread({
  wagerId,
  challengerId,
  opponentId,
  isAdmin = false,
}: {
  wagerId: string;
  challengerId: string;
  opponentId: string;
  isAdmin?: boolean;
}) {
  const { user } = useAuth();
  const [dispute, setDispute] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [openReason, setOpenReason] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  async function load() {
    const { data: d } = await supabase
      .from("wager_disputes")
      .select("*")
      .eq("wager_id", wagerId)
      .order("created_at", { ascending: false })
      .limit(1);
    const disp = (d ?? [])[0] ?? null;
    setDispute(disp);
    if (disp) {
      const { data: m } = await supabase
        .from("wager_dispute_messages")
        .select("*")
        .eq("dispute_id", disp.id)
        .order("created_at", { ascending: true });
      setMessages((m as any) ?? []);
      const ids = Array.from(new Set([...(m ?? []).map((x: any) => x.sender_id), challengerId, opponentId]));
      const { data: profs } = await supabase.from("profiles").select("id, full_name, ingame_name, avatar_url").in("id", ids);
      const map: Record<string, any> = {};
      (profs ?? []).forEach((p: any) => (map[p.id] = p));
      setProfiles(map);
    }
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`wager-dispute-${wagerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wager_disputes", filter: `wager_id=eq.${wagerId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "wager_dispute_messages", filter: `wager_id=eq.${wagerId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [wagerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const isParty = !!user && (user.id === challengerId || user.id === opponentId);
  const canPost = !!dispute && !!user && (isParty || isAdmin);

  async function openDispute() {
    if (!user) return;
    if (!openReason.trim()) { toast.error("Enter a reason to open a dispute"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("wager_disputes").insert({
        wager_id: wagerId,
        opened_by: user.id,
        reason: openReason.trim(),
        status: "open",
      });
      if (error) throw error;
      await supabase.from("wagers").update({ status: "disputed" }).eq("id", wagerId);
      setOpenReason("");
      toast.success("Dispute opened — admin will review.");
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function send() {
    if (!user || !dispute) return;
    if (!body.trim() && !file) return;
    setBusy(true);
    try {
      let attachments: any[] = [];
      if (file) {
        const path = `${wagerId}/${Date.now()}-${file.name}`;
        const { error: ue } = await supabase.storage.from("token-proofs").upload(path, file);
        if (ue) throw ue;
        const url = supabase.storage.from("token-proofs").getPublicUrl(path).data.publicUrl;
        attachments = [{ url, name: file.name, type: file.type }];
      }
      const { error } = await supabase.from("wager_dispute_messages").insert({
        dispute_id: dispute.id,
        wager_id: wagerId,
        sender_id: user.id,
        sender_role: isAdmin ? "admin" : "player",
        body: body.trim() || null,
        attachments,
      });
      if (error) throw error;
      setBody(""); setFile(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Card className="glass p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="h-4 w-4 text-fuchsia-300" />
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Dispute thread</div>
      </div>

      {!dispute && (
        <div className="space-y-2">
          {isParty ? (
            <>
              <div className="text-xs text-muted-foreground">Open a dispute if the result is contested. Both players and admin can chat and share proof here.</div>
              <Textarea rows={2} placeholder="Why are you opening this dispute?" value={openReason} onChange={(e) => setOpenReason(e.target.value)} />
              <Button className="btn-luxury" disabled={busy} onClick={openDispute}><Plus className="h-4 w-4 mr-1" />Open dispute</Button>
            </>
          ) : (
            <div className="text-xs text-muted-foreground">No dispute open on this wager.</div>
          )}
        </div>
      )}

      {dispute && (
        <>
          <div className="mb-2 rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 p-2 text-xs">
            <div className="font-bold text-fuchsia-200">Reason</div>
            <div className="text-fuchsia-100/90">{dispute.reason || "—"}</div>
            <div className="mt-1 text-[10px] text-fuchsia-200/60">Status: {dispute.status}</div>
          </div>
          <div ref={scrollRef} className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {messages.length === 0 && <div className="text-xs text-muted-foreground">No messages yet — say something.</div>}
            {messages.map((m) => {
              const p = profiles[m.sender_id];
              const mine = user?.id === m.sender_id;
              return (
                <div key={m.id} className={`flex gap-2 ${mine ? "justify-end" : ""}`}>
                  {!mine && (
                    p?.avatar_url
                      ? <img src={p.avatar_url} className="h-6 w-6 rounded-full object-cover" alt="" />
                      : <div className="h-6 w-6 rounded-full bg-primary/20 grid place-items-center text-[9px] font-bold">{(p?.ingame_name || p?.full_name || "?").charAt(0).toUpperCase()}</div>
                  )}
                  <div className={`max-w-[75%] rounded-lg px-2.5 py-1.5 text-xs ${mine ? "bg-primary/20 border border-primary/30" : "bg-background/40 border border-primary/10"}`}>
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      {p?.ingame_name || p?.full_name || "Player"}
                      {m.sender_role === "admin" && <span className="text-fuchsia-300">• admin</span>}
                      <span className="ml-auto">{new Date(m.created_at).toLocaleTimeString()}</span>
                    </div>
                    {m.body && <div className="mt-0.5 whitespace-pre-wrap">{m.body}</div>}
                    {(m.attachments as any[])?.map((a, i) => (
                      <a key={i} href={a.url} target="_blank" rel="noreferrer" className="mt-1 block">
                        {a.type?.startsWith?.("image/")
                          ? <img src={a.url} alt="" className="rounded-md max-h-40 border border-primary/20" />
                          : <span className="text-primary underline">{a.name || "attachment"}</span>}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {canPost && (
            <div className="mt-3 border-t border-primary/10 pt-2 space-y-2">
              <Textarea rows={2} placeholder="Write a message…" value={body} onChange={(e) => setBody(e.target.value)} />
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
                  <Paperclip className="h-3.5 w-3.5" />
                  {file ? file.name : "Attach evidence"}
                  <Input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                <Button className="btn-luxury ml-auto" size="sm" disabled={busy} onClick={send}>
                  <Send className="h-4 w-4 mr-1" />Send
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}