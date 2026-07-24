import { useEffect, useState } from "react";
import { X, Trophy, Flame, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Milestone = { type: "first_win" | "streak" | "personal_best"; value: number };

export function WagerMilestone() {
  const { user } = useAuth();
  const [milestone, setMilestone] = useState<Milestone | null>(null);

  useEffect(() => {
    if (!user) return;
    const uid = user.id;

    async function checkMilestones(wagerId: string, prizePaid: number) {
      const seenKey = `lsl-milestone-${wagerId}`;
      if (localStorage.getItem(seenKey)) return;

      const { data } = await supabase
        .from("wagers")
        .select("id, winner_id, prize_paid, settled_at")
        .or(`challenger_id.eq.${uid},opponent_id.eq.${uid}`)
        .eq("status", "settled")
        .order("settled_at", { ascending: true });

      if (!data) return;
      localStorage.setItem(seenKey, "1");

      const wins = data.filter((w: any) => w.winner_id === uid);
      const totalWins = wins.length;
      const isFirstWin = totalWins === 1;
      const priorBest = Math.max(0, ...wins.filter((w: any) => w.id !== wagerId).map((w: any) => w.prize_paid || 0));
      const isPersonalBest = totalWins > 1 && prizePaid > priorBest;

      let streak = 0;
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].winner_id === uid) streak++;
        else break;
      }
      const isStreakMilestone = streak > 0 && streak % 5 === 0;

      if (isFirstWin) setMilestone({ type: "first_win", value: 1 });
      else if (isStreakMilestone) setMilestone({ type: "streak", value: streak });
      else if (isPersonalBest) setMilestone({ type: "personal_best", value: prizePaid });
    }

    const ch = supabase
      .channel(`wager-milestones-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wagers" },
        (payload) => {
          const next: any = payload.new;
          const old: any = payload.old;
          const isMe = next.challenger_id === user.id || next.opponent_id === user.id;
          if (isMe && next.status === "settled" && old?.status !== "settled" && next.winner_id === user.id) {
            checkMilestones(next.id, next.prize_paid || 0);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  if (!milestone) return null;

  const copy = {
    first_win: { icon: Trophy, title: "First Win!", sub: "You just won your very first P2P wager." },
    streak: { icon: Flame, title: `${milestone.value}-Win Streak!`, sub: "You're on fire — keep it going." },
    personal_best: { icon: Star, title: "New Personal Best!", sub: `Your biggest wager win yet — ${milestone.value.toLocaleString()} tokens.` },
  }[milestone.type];
  const Icon = copy.icon;

  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-black/90 backdrop-blur-md px-5 animate-fade-in">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => {
          const colors = ["#f5c518", "#ffd76a", "#10b981", "#34d399"];
          return (
            <span
              key={i}
              className="confetti-piece absolute top-0 rounded-[2px]"
              style={{
                left: `${(i * 41) % 100}%`,
                width: 6 + (i % 4) * 2,
                height: (6 + (i % 4) * 2) * 1.6,
                background: colors[i % colors.length],
                animationDelay: `${(i % 10) * 0.15}s`,
                animationDuration: `${2.4 + ((i * 11) % 20) / 10}s`,
              }}
            />
          );
        })}
      </div>
      <button aria-label="Close milestone" onClick={() => setMilestone(null)} className="absolute right-5 top-5 rounded-full border border-border bg-card/80 p-2 text-foreground shadow-luxury">
        <X className="h-5 w-5" />
      </button>
      <div className="relative w-full max-w-sm text-center">
        <Icon className="h-16 w-16 mx-auto text-primary drop-shadow-[0_2px_10px_rgba(212,175,55,0.5)]" />
        <h2 className="mt-4 font-display text-4xl font-black gradient-gold-text">{copy.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{copy.sub}</p>
        <button onClick={() => setMilestone(null)} className="btn-luxury mt-6 w-full rounded-xl px-5 py-4 text-lg font-black">Nice!</button>
      </div>
    </div>
  );
}
