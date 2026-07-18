import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Wand2, ArrowUp, ArrowDown, Search, X, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { TournamentBracket, type TMatch, type TParticipant, type Tournament } from "@/components/TournamentBracket";
import { BracketPreviewDialog } from "@/components/admin/BracketPreviewDialog";

/** Upload a bracket image from device storage to a public bucket and return its URL. */
async function uploadBracketImage(file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `tournament-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("team-logos").upload(path, file, { upsert: true });
  if (error) { toast.error(error.message); return null; }
  return supabase.storage.from("team-logos").getPublicUrl(path).data.publicUrl;
}

function labelFor(matchesInRound: number, j: number) {
  if (matchesInRound === 1) return "FINAL";
  if (matchesInRound === 2) return `SF${j + 1}`;
  if (matchesInRound === 4) return `QF${j + 1}`;
  if (matchesInRound === 8) return `R16-${j + 1}`;
  return `M${j + 1}`;
}

function roundNameFor(playersInRound: number) {
  if (playersInRound <= 2) return "Grand Final";
  if (playersInRound <= 4) return "Semifinals";
  if (playersInRound <= 8) return "Quarterfinals";
  if (playersInRound <= 16) return "Round of 16";
  return `Round of ${playersInRound}`;
}

type Tournament_Type = Tournament & { futures_match_id?: string | null };

export function TeamWizardMatchSetup() {
  const confirm = useConfirm();
  const [tournaments, setTournaments] = useState<Tournament_Type[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<TParticipant[]>([]);
  const [matches, setMatches] = useState<TMatch[]>([]);
  const [futureMatches, setFutureMatches] = useState<any[]>([]);
  const [roster, setRoster] = useState<Array<{ id: string; name: string; logo_url: string | null; kind: "player" | "team" }>>([]);

  // Single-form state
  const [formOpen, setFormOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    tagline: "ONE LEAGUE. NO MERCY. RESPECT THE GAME.",
    eventDate: "",
    futuresMatchId: "",
  });
  const [participants_form, setParticipants_form] = useState<Array<{ id: string; name: string; logo_url: string | null }>>([]);
  const [pName, setPName] = useState("");
  const [pLogo, setPLogo] = useState("");
  const [pLogoBusy, setPLogoBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Bracket preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [bracketSlots, setBracketSlots] = useState<(string | null)[]>([]);
  const [slotAssignments, setSlotAssignments] = useState<Map<number, string | null>>(new Map());

  // Result dialog
  const [resultMatch, setResultMatch] = useState<TMatch | null>(null);
  const [sA, setSA] = useState("");
  const [sB, setSB] = useState("");

  const sel = tournaments.find((t) => t.id === selId) ?? null;
  const partMap = Object.fromEntries(participants.map((p) => [p.id, p]));

  const filteredParticipants = participants_form.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  async function loadTournaments() {
    const { data } = await (supabase as any).from("tournaments").select("*").order("created_at", { ascending: false });
    setTournaments(data ?? []);
    if (!selId && data?.length) setSelId(data[0].id);
    const { data: fm } = await (supabase as any).from("matches").select("id,name").eq("match_kind", "future").eq("is_archived", false).order("created_at", { ascending: false });
    setFutureMatches(fm ?? []);
    const [{ data: pls }, { data: tms }] = await Promise.all([
      supabase.from("players").select("id,name,avatar_url").order("name"),
      supabase.from("teams").select("id,name,logo_url").order("name"),
    ]);
    setRoster([
      ...((tms ?? []).map((t: any) => ({ id: `team:${t.id}`, name: t.name, logo_url: t.logo_url ?? null, kind: "team" as const }))),
      ...((pls ?? []).map((p: any) => ({ id: `player:${p.id}`, name: p.name, logo_url: p.avatar_url ?? null, kind: "player" as const }))),
    ]);
  }

  async function loadDetail(id: string) {
    const [{ data: ps }, { data: ms }] = await Promise.all([
      (supabase as any).from("tournament_participants").select("*").eq("tournament_id", id).order("seed").order("created_at"),
      (supabase as any).from("tournament_matches").select("*").eq("tournament_id", id).order("round").order("slot"),
    ]);
    setParticipants(ps ?? []);
    setMatches(ms ?? []);
  }

  useEffect(() => { loadTournaments(); }, []);
  useEffect(() => { if (selId) loadDetail(selId); }, [selId]);

  function openCreateForm() {
    setIsEdit(false);
    setFormData({ name: "", tagline: "ONE LEAGUE. NO MERCY. RESPECT THE GAME.", eventDate: "", futuresMatchId: "" });
    setParticipants_form([]);
    setPName("");
    setPLogo("");
    setSearchQuery("");
    setFormOpen(true);
  }

  function openEditForm() {
    if (!sel) return;
    setIsEdit(true);
    setFormData({
      name: sel.name,
      tagline: sel.tagline ?? "ONE LEAGUE. NO MERCY. RESPECT THE GAME.",
      eventDate: sel.event_date ?? "",
      futuresMatchId: sel.futures_match_id ?? "",
    });
    setParticipants_form([...participants]);
    setPName("");
    setPLogo("");
    setSearchQuery("");
    setFormOpen(true);
  }

  async function saveForm() {
    if (!formData.name.trim()) { toast.error("Enter tournament name"); return; }
    if (participants_form.length < 2) { toast.error("Add at least 2 participants"); return; }

    if (isEdit && sel) {
      // Update existing
      const { error: updateErr } = await (supabase as any).from("tournaments").update({
        name: formData.name.trim(),
        tagline: formData.tagline.trim() || null,
        event_date: formData.eventDate || null,
        futures_match_id: formData.futuresMatchId || null,
      }).eq("id", sel.id);
      if (updateErr) { toast.error(updateErr.message); return; }

      // Update participants
      await (supabase as any).from("tournament_participants").delete().eq("tournament_id", sel.id);
      const { error: partErr } = await (supabase as any).from("tournament_participants").insert(
        participants_form.map((p, i) => ({
          tournament_id: sel.id,
          name: p.name,
          logo_url: p.logo_url,
          seed: i + 1,
        }))
      );
      if (partErr) { toast.error(partErr.message); return; }
      toast.success("Tournament updated");
    } else {
      // Create new
      const { data, error } = await (supabase as any).from("tournaments").insert({
        name: formData.name.trim(),
        tagline: formData.tagline.trim() || null,
        event_date: formData.eventDate || null,
        status: "active",
        is_featured: true,
        futures_match_id: formData.futuresMatchId || null,
      }).select().single();
      if (error) { toast.error(error.message); return; }

      const { error: partErr } = await (supabase as any).from("tournament_participants").insert(
        participants_form.map((p, i) => ({
          tournament_id: data.id,
          name: p.name,
          logo_url: p.logo_url,
          seed: i + 1,
        }))
      );
      if (partErr) { toast.error(partErr.message); return; }
      toast.success("Tournament created — participants added");
    }

    setFormOpen(false);
    loadTournaments();
  }

  function addParticipantToForm() {
    if (!pName.trim()) { toast.error("Enter participant name"); return; }
    setParticipants_form([
      ...participants_form,
      { id: crypto.randomUUID(), name: pName.trim(), logo_url: pLogo.trim() || null },
    ]);
    setPName("");
    setPLogo("");
  }

  function removeParticipantFromForm(id: string) {
    setParticipants_form(participants_form.filter((p) => p.id !== id));
  }

  function moveParticipantInForm(index: number, dir: -1 | 1) {
    const other = index + dir;
    if (other < 0 || other >= participants_form.length) return;
    const arr = [...participants_form];
    [arr[index], arr[other]] = [arr[other], arr[index]];
    setParticipants_form(arr);
  }

  async function generateBracket() {
    if (participants_form.length < 2) { toast.error("Add at least 2 participants"); return; }

    let size = 2;
    while (size < participants_form.length) size *= 2;
    const totalRounds = Math.log2(size);

    let seedPos: number[] = [1, 2];
    for (let r = 1; r < totalRounds; r++) {
      const sum = seedPos.length * 2 + 1;
      const next: number[] = [];
      for (const p of seedPos) { next.push(p); next.push(sum - p); }
      seedPos = next;
    }

    const slots = seedPos.map((seed) => participants_form[seed - 1]?.id ?? null);
    setBracketSlots(slots);
    setSlotAssignments(new Map(slots.map((id, idx) => [idx, id])));
    setPreviewOpen(true);
  }

  async function generateBracketFromPreview() {
    if (!sel) return;

    const customSlotIds = Array.from({ length: bracketSlots.length }, (_, i) => slotAssignments.get(i) ?? null);

    await (supabase as any).from("tournament_matches").delete().eq("tournament_id", sel.id);

    let size = 2;
    while (size < bracketSlots.length) size *= 2;
    const totalRounds = Math.log2(size);

    let aboveIds: string[] = [];
    for (let r = totalRounds; r >= 1; r--) {
      const matchesInRound = size / Math.pow(2, r);
      const rows = Array.from({ length: matchesInRound }, (_, j) => {
        const next_match_id = r === totalRounds ? null : aboveIds[Math.floor(j / 2)] ?? null;
        const next_slot = r === totalRounds ? null : j % 2 === 0 ? "a" : "b";
        const row: any = {
          tournament_id: sel.id,
          round: r,
          slot: j,
          label: labelFor(matchesInRound, j),
          round_name: roundNameFor(matchesInRound * 2),
          next_match_id,
          next_slot,
          status: "pending",
        };
        if (r === 1) {
          const partA = participants_form.find((p) => p.id === customSlotIds[2 * j]);
          const partB = participants_form.find((p) => p.id === customSlotIds[2 * j + 1]);
          row.participant_a_id = partA?.id ?? null;
          row.participant_b_id = partB?.id ?? null;
        }
        return row;
      });
      const { data, error } = await (supabase as any).from("tournament_matches").insert(rows).select("id");
      if (error) { toast.error(error.message); return; }
      aboveIds = (data ?? []).sort((a: any, b: any) => a.slot - b.slot).map((d: any) => d.id);
    }

    toast.success("Bracket generated!");
    setPreviewOpen(false);
    loadDetail(sel.id);
  }

  async function deleteTournament() {
    if (!sel) return;
    const ok = await confirm({ title: "Delete this tournament?", description: "The bracket, participants and results will be removed.", confirmText: "Delete" });
    if (!ok) return;
    await (supabase as any).from("tournament_matches").delete().eq("tournament_id", sel.id);
    await (supabase as any).from("tournament_participants").delete().eq("tournament_id", sel.id);
    await (supabase as any).from("tournaments").delete().eq("id", sel.id);
    setSelId(null);
    loadTournaments();
    toast.success("Deleted");
  }

  return (
    <div className="space-y-4">
      {/* Tournaments list */}
      <Card className="glass-strong p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-bold flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" />Team Wizard Tournaments</div>
          <Button size="sm" onClick={openCreateForm}><Plus className="h-3 w-3 mr-1" />New Tournament</Button>
        </div>

        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
          {tournaments.length === 0 ? (
            <div className="text-xs text-muted-foreground py-3">No tournaments yet. Create one to get started.</div>
          ) : (
            tournaments.map((t) => (
              <div key={t.id} className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm border ${selId === t.id ? "border-primary bg-primary/10" : "border-border"}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{t.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{t.tagline ?? "—"}</div>
                </div>
                <Badge variant="outline" className="text-[9px] capitalize shrink-0">{t.status}</Badge>
                <button onClick={() => setSelId(t.id)} className="text-muted-foreground hover:text-primary text-xs font-bold px-2 py-1 rounded hover:bg-primary/10">Select</button>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Selected tournament actions */}
      {sel && (
        <Card className="glass-strong p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-bold flex items-center gap-2">Edit: {sel.name}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={openEditForm}>Edit form</Button>
              <Button size="sm" variant="destructive" onClick={deleteTournament}><Trash2 className="h-3 w-3 mr-1" />Delete</Button>
            </div>
          </div>

          {/* Quick info */}
          <div className="grid grid-cols-3 gap-2 text-sm bg-background/40 rounded-lg p-2">
            <div><div className="text-[10px] text-muted-foreground">Participants</div><div className="font-bold">{participants.length}</div></div>
            <div><div className="text-[10px] text-muted-foreground">Bracket rounds</div><div className="font-bold">{matches.length > 0 ? Math.log2(participants.length * 2 || 2) : "—"}</div></div>
            <div><div className="text-[10px] text-muted-foreground">Status</div><div className="font-bold capitalize">{sel.status}</div></div>
          </div>

          {/* Betting market link */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Link betting market</Label>
            <select className="bg-background border border-border rounded-md text-sm px-2 py-1.5 flex-1" value={sel.futures_match_id ?? ""} onChange={async (e) => {
              await (supabase as any).from("tournaments").update({ futures_match_id: e.target.value || null }).eq("id", sel.id);
              loadTournaments();
              toast.success(e.target.value ? "Market linked" : "Market unlinked");
            }}>
              <option value="">— none —</option>
              {futureMatches.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          {/* Generate bracket button */}
          {participants.length > 0 && matches.length === 0 && (
            <Button className="btn-luxury w-full" onClick={generateBracket}><Wand2 className="h-3 w-3 mr-1" />Generate Bracket</Button>
          )}
        </Card>
      )}

      {/* Live bracket */}
      {sel && matches.length > 0 && (
        <Card className="glass p-2">
          <div className="text-xs text-muted-foreground px-2 py-1">Click any matchup to enter scores and mark winners</div>
          <div className="h-[70vh] w-full rounded-xl overflow-hidden">
            <TournamentBracket tournament={sel} participants={partMap} matches={matches} onMatchClick={() => {}} />
          </div>
        </Card>
      )}

      {/* Single-form dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit tournament" : "Create team wizard tournament"}</DialogTitle>
            <DialogDescription>Add all participants and tournament details in one simple form.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Basic info */}
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase">Tournament details</Label>
              <Input placeholder="Tournament name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              <Input placeholder="Tagline" value={formData.tagline} onChange={(e) => setFormData({ ...formData, tagline: e.target.value })} />
              <Input type="date" value={formData.eventDate} onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })} />
            </div>

            {/* Add participants */}
            <div className="space-y-2 border-t pt-3">
              <Label className="font-bold text-xs uppercase">Participants</Label>
              <div className="flex gap-2">
                <Select value="" onValueChange={(v) => {
                  const r = roster.find((x) => x.id === v);
                  if (r) { setPName(r.name); if (r.logo_url) setPLogo(r.logo_url); }
                }}>
                  <SelectTrigger className="w-40 shrink-0"><SelectValue placeholder="Pick from roster" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {roster.length === 0 && <div className="px-2 py-3 text-xs text-muted-foreground">No teams/players</div>}
                    {roster.map((r) => (
                      <SelectItem key={r.id} value={r.id}><span className="text-[10px] text-muted-foreground mr-1">{r.kind.toUpperCase()}</span>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="or type name" onKeyDown={(e) => e.key === "Enter" && addParticipantToForm()} className="flex-1" />
                <Button size="sm" onClick={addParticipantToForm} disabled={pLogoBusy}><Plus className="h-3 w-3" /></Button>
              </div>

              {/* Search participants */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-8" />
                {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-2.5"><X className="h-4 w-4 text-muted-foreground" /></button>}
              </div>

              {/* Participants list */}
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                {filteredParticipants.length > 0 ? (
                  filteredParticipants.map((p, idx) => {
                    const origIdx = participants_form.indexOf(p);
                    return (
                      <div key={p.id} className="flex items-center gap-2 rounded border border-primary/20 bg-card/60 px-2 py-1">
                        <span className="text-[10px] text-muted-foreground w-5 text-right">{origIdx + 1}.</span>
                        {p.logo_url ? (
                          <img src={p.logo_url} alt="" className="h-6 w-6 rounded object-cover border border-primary/30" />
                        ) : (
                          <div className="h-6 w-6 rounded bg-primary/15 grid place-items-center text-[9px] font-bold text-primary">{p.name.charAt(0)}</div>
                        )}
                        <span className="text-sm font-semibold flex-1 truncate">{p.name}</span>
                        <button onClick={() => moveParticipantInForm(origIdx, -1)} disabled={origIdx === 0} className="text-muted-foreground disabled:opacity-30 hover:text-primary"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button onClick={() => moveParticipantInForm(origIdx, 1)} disabled={origIdx === participants_form.length - 1} className="text-muted-foreground disabled:opacity-30 hover:text-primary"><ArrowDown className="h-3.5 w-3.5" /></button>
                        <button onClick={() => removeParticipantFromForm(p.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    );
                  })
                ) : searchQuery ? (
                  <span className="text-xs text-muted-foreground text-center py-4">No matches</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Add participants above</span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground">Order = bracket seeding. Use arrows to reorder. Min 2 participants.</div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={saveForm}>Save & create bracket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bracket preview */}
      <BracketPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        participants={participants_form.map((p) => ({ id: p.id, name: p.name, logo_url: p.logo_url, seed: 0 }))}
        slots={bracketSlots}
        slotAssignments={slotAssignments}
        onAssign={(slotIndex, participantId) => { const n = new Map(slotAssignments); n.set(slotIndex, participantId); setSlotAssignments(n); }}
        onSwap={(a, b) => { const n = new Map(slotAssignments); const va = n.get(a) ?? null; const vb = n.get(b) ?? null; n.set(a, vb); n.set(b, va); setSlotAssignments(n); }}
        onShuffle={() => {
          const size = bracketSlots.length;
          let seedPos: number[] = [1, 2];
          const totalRounds = Math.log2(size);
          for (let r = 1; r < totalRounds; r++) {
            const sum = seedPos.length * 2 + 1;
            const next: number[] = [];
            for (const p of seedPos) { next.push(p); next.push(sum - p); }
            seedPos = next;
          }
          const fresh = seedPos.map((seed) => participants_form[seed - 1]?.id ?? null);
          setSlotAssignments(new Map(fresh.map((id, idx) => [idx, id])));
        }}
        onGenerate={generateBracketFromPreview}
      />
    </div>
  );
}
