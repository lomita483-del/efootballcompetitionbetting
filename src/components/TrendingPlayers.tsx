import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { loadStandings, type LbRow } from "@/lib/leaderboard";
import { Star, Crown, ChevronRight } from "lucide-react";

/** Top 3 players from the Top Scorer leaderboard, shown on the home page. */
export function TrendingPlayers() {
  const [rows, setRows] = useState<LbRow[]>([]);

  useEffect(() => {
    let alive = true;
    loadStandings()
      .then((s) => { if (alive) setRows((s.scorers ?? []).slice(0, 3)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (rows.length === 0) return null;

  return (
    <Card className="glass-strong border-primary/25 overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-primary/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-black uppercase tracking-[0.18em]">Top Players</h2>
        </div>
        <Link to="/leaderboard" className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition">
          View All <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3">
        {rows.map((r, i) => {
          const initials = r.name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
          return (
            <div
              key={r.name}
              className={`relative overflow-hidden rounded-xl border p-3 text-center transition hover:-translate-y-0.5 ${
                i === 0 ? "border-primary/50 bg-gradient-to-b from-primary/15 to-transparent" : "border-primary/20 bg-card/60"
              }`}
            >
              <div className="absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-gradient-gold text-[10px] font-black text-background">
                {i + 1}
              </div>
              {i === 0 && <Crown className="absolute right-2 top-2 h-4 w-4 text-primary" />}
              <div className="mx-auto mt-3 h-14 w-14 overflow-hidden rounded-full border-2 border-primary/40 bg-primary/10 grid place-items-center">
                {r.image_url
                  ? <img src={r.image_url} alt={r.name} className="h-full w-full object-cover" loading="lazy" />
                  : <span className="text-sm font-black text-primary">{initials}</span>}
              </div>
              <div className="mt-2 truncate text-[11px] font-black uppercase tracking-wide">{r.name}</div>
              <div className="text-[11px] font-bold text-primary">{r.TS} goals</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
