import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wand2, Swords, ArrowLeftRight, Trophy } from "lucide-react";
import type { TParticipant } from "@/components/TournamentBracket";

/**
 * BracketPreviewDialog — visualise and customise opening-round matchups
 * before generating the tournament bracket. Shows live pairing cards
 * (Slot 1 vs Slot 2, Slot 3 vs Slot 4, …) that update instantly as the
 * admin re-assigns participants.
 */
export function BracketPreviewDialog({
  open,
  onOpenChange,
  participants,
  slots,
  slotAssignments,
  onAssign,
  onSwap,
  onShuffle,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  participants: TParticipant[];
  slots: (string | null)[];
  slotAssignments: Map<number, string | null>;
  onAssign: (slotIdx: number, participantId: string | null) => void;
  onSwap: (a: number, b: number) => void;
  onShuffle: () => void;
  onGenerate: () => void;
}) {
  const partMap = useMemo(
    () => Object.fromEntries(participants.map((p) => [p.id, p])),
    [participants],
  );

  const size = slots.length;
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < size; i += 2) pairs.push([i, i + 1]);

  // Round labels (Opening / QF / SF / Final)
  const rounds: string[] = [];
  let n = size;
  while (n > 1) {
    rounds.push(
      n === 2 ? "Grand Final"
      : n === 4 ? "Semifinals"
      : n === 8 ? "Quarterfinals"
      : n === 16 ? "Round of 16"
      : `Round of ${n}`,
    );
    n = n / 2;
  }

  const assignedCount = Array.from(slotAssignments.values()).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-primary/30 max-w-3xl backdrop-blur-2xl shadow-luxury overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-gold" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />Bracket Preview &amp; Customization
          </DialogTitle>
          <DialogDescription>
            Live matchup visualization — assign participants to slots and see who faces who instantly. Pairs form top-to-bottom (Slot 1 vs 2, 3 vs 4, …).
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 flex-wrap text-[11px] bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <span className="text-amber-200 font-bold">
            {assignedCount}/{size} slots assigned
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {participants.length} participants → {size} bracket slots (byes allowed)
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={onShuffle}>
              <ArrowLeftRight className="h-3 w-3 mr-1" />Auto-Seed
            </Button>
          </div>
        </div>

        {/* Round overview */}
        <div className="flex items-center gap-1 justify-center flex-wrap py-1">
          {rounds.map((r, i) => (
            <span key={i} className="text-[10px] uppercase tracking-widest">
              <span className={i === 0 ? "text-amber-300 font-bold" : "text-muted-foreground"}>{r}</span>
              {i < rounds.length - 1 && <span className="mx-1 text-muted-foreground/50">→</span>}
            </span>
          ))}
          <span className="mx-1 text-muted-foreground/50">→</span>
          <span className="text-[10px] uppercase tracking-widest text-primary font-bold flex items-center gap-1">
            <Trophy className="h-3 w-3" />Champion
          </span>
        </div>

        {/* Matchup cards */}
        <div className="grid sm:grid-cols-2 gap-2 max-h-[55vh] overflow-y-auto pr-1">
          {pairs.map(([a, b], idx) => {
            const pa = slotAssignments.get(a) ? partMap[slotAssignments.get(a)!] : null;
            const pb = slotAssignments.get(b) ? partMap[slotAssignments.get(b)!] : null;
            const label =
              pairs.length === 1 ? "FINAL"
              : pairs.length === 2 ? `SF${idx + 1}`
              : pairs.length === 4 ? `QF${idx + 1}`
              : pairs.length === 8 ? `R16-${idx + 1}`
              : `M${idx + 1}`;
            return (
              <div key={idx} className="border border-primary/30 rounded-lg p-2 bg-card/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-widest text-primary font-bold flex items-center gap-1">
                    <Swords className="h-3 w-3" />{label}
                  </div>
                  <button
                    className="text-[10px] text-muted-foreground hover:text-primary"
                    onClick={() => onSwap(a, b)}
                    title="Swap the two participants in this matchup"
                  >
                    <ArrowLeftRight className="h-3 w-3" />
                  </button>
                </div>
                <SlotRow
                  idx={a}
                  participant={pa}
                  participants={participants}
                  assigned={slotAssignments.get(a) ?? null}
                  onAssign={onAssign}
                />
                <div className="text-center text-[9px] text-muted-foreground tracking-widest">VS</div>
                <SlotRow
                  idx={b}
                  participant={pb}
                  participants={participants}
                  assigned={slotAssignments.get(b) ?? null}
                  onAssign={onAssign}
                />
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="btn-luxury" onClick={onGenerate}>
            <Wand2 className="h-4 w-4 mr-1" />Generate Bracket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SlotRow({
  idx,
  participant,
  participants,
  assigned,
  onAssign,
}: {
  idx: number;
  participant: TParticipant | null;
  participants: TParticipant[];
  assigned: string | null;
  onAssign: (slotIdx: number, participantId: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-muted-foreground w-6 text-right tabular-nums">S{idx + 1}</span>
      {participant?.logo_url
        ? <img src={participant.logo_url} alt="" className="h-6 w-6 rounded object-cover border border-primary/30 shrink-0" />
        : <div className="h-6 w-6 rounded bg-primary/15 grid place-items-center text-[10px] font-bold text-primary shrink-0">
            {participant?.name?.charAt(0).toUpperCase() ?? "—"}
          </div>}
      <Select
        value={assigned ?? ""}
        onValueChange={(v) => onAssign(idx, v === "__bye__" ? null : v)}
      >
        <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
          <SelectValue placeholder="— Bye —">
            {participant ? participant.name : "— Bye —"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__bye__">— Bye (empty) —</SelectItem>
          {participants.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}