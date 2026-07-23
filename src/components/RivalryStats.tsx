import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Swords } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function RivalryStats({ userAId, userBId, nameA, nameB }: { userAId: string; userBId: string; nameA: string; nameB: string }) {
  const [stats, setStats] = useState<{ aWins: number; bWins: number; draws: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from("wagers")
        .select("winner_id, is_draw, status")
        .eq("status", "settled")
        .or(
          `and(challenger_id.eq.${userAId},opponent_id.eq.${userBId}),and(challenger_id.eq.${userBId},opponent_id.eq.${userAId})`
        );
      if (cancelled || error || !data) return;
      const aWins = data.filter((w: any) => w.winner_id === userAId).length;
      const bWins = data.filter((w: any) => w.winner_id === userBId).length;
      const draws = data.filter((w: any) => w.is_draw).length;
      setStats({ aWins, bWins, draws, total: data.length });
    }
    load();
    return () => { cancelled = true; };
  }, [userAId, userBId]);

  if (!stats || stats.total === 0) return null;

  return (
    <Card className="glass p-4 mt-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
        <Swords className="h-3 w-3" />Head to head
      </div>
      <div className="flex items-center justify-center gap-6 text-center">
        <div>
          <div className="text-2xl font-black text-primary">{stats.aWins}</div>
          <div className="text-[10px] text-muted-foreground truncate max-w-[90px]">{nameA}</div>
        </div>
        {stats.draws > 0 && (
          <div>
            <div className="text-2xl font-black text-muted-foreground">{stats.draws}</div>
            <div className="text-[10px] text-muted-foreground">Draws</div>
          </div>
        )}
        <div>
          <div className="text-2xl font-black text-primary">{stats.bWins}</div>
          <div className="text-[10px] text-muted-foreground truncate max-w-[90px]">{nameB}</div>
        </div>
      </div>
      <div className="text-center text-[10px] text-muted-foreground mt-2">{stats.total} previous settled wager{stats.total === 1 ? "" : "s"} between you two</div>
    </Card>
  );
}
