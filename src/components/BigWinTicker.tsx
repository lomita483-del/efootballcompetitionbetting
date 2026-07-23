import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type BigWin = { id: string; amount: number; source: string; created_at: string; profiles: { full_name: string | null; ingame_name: string | null } | null };

export function BigWinTicker() {
  const [wins, setWins] = useState<BigWin[]>([]);

  useEffect(() => {
    supabase
      .from("big_wins")
      .select("id, amount, source, created_at, profiles:user_id(full_name, ingame_name)")
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) => setWins((data as any) ?? []));

    const ch = supabase
      .channel("big-wins-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "big_wins" }, (payload) => {
        const row: any = payload.new;
        supabase
          .from("profiles")
          .select("full_name, ingame_name")
          .eq("id", row.user_id)
          .maybeSingle()
          .then(({ data: profile }) => {
            setWins((prev) => [{ ...row, profiles: profile }, ...prev].slice(0, 15));
          });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  if (wins.length === 0) return null;

  return (
    <div className="border-y border-primary/20 bg-background/40 overflow-hidden py-2">
      <div className="flex gap-8 animate-marquee whitespace-nowrap">
        {[...wins, ...wins].map((w, i) => (
          <div key={`${w.id}-${i}`} className="flex items-center gap-2 text-sm shrink-0">
            <Trophy className="h-4 w-4 text-primary shrink-0" />
            <span className="font-bold text-primary">{w.profiles?.ingame_name || w.profiles?.full_name || "A player"}</span>
            <span className="text-muted-foreground">just won</span>
            <span className="font-black text-primary">{w.amount.toLocaleString()} tokens</span>
            <span className="text-muted-foreground text-xs uppercase tracking-widest">· {w.source === "wager" ? "P2P Wager" : "Sportsbook"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
