import { Link } from "@tanstack/react-router";
import { TeamLogo } from "@/components/TeamLogo";
import { Button } from "@/components/ui/button";
import { useBetSlip } from "@/contexts/BetSlipContext";
import type { MatchRow } from "@/lib/queries";

export function ArenaMatchRow({ match }: { match: MatchRow }) {
  const { selections, add, remove, setOpen } = useBetSlip();
  const market = match.markets?.find((item) => item.is_open) ?? match.markets?.[0];
  const odds = (market?.odds ?? []).slice(0, 3);
  const date = new Date(match.start_time);

  return (
    <article className="ecb-match-row">
      <Link to="/matches/$matchId" params={{ matchId: match.id }} className="ecb-match-meta">
        <small>{match.category?.name ?? "EFA CHAMPIONS LEAGUE"}</small>
        <b>{match.name}</b>
        <span>
          {date.toLocaleDateString(undefined, { weekday: "short" })} · {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          <br />
          {match.location ?? `Match ID: ${match.id}`}
        </span>
      </Link>
      <div className="ecb-versus">
        <div><TeamLogo name={match.home_team?.name} url={match.home_team?.logo_url} size={30} rounded="full" /><b>{match.home_team?.name ?? "Home"}</b></div>
        <span>VS</span>
        <div><TeamLogo name={match.away_team?.name} url={match.away_team?.logo_url} size={30} rounded="full" /><b>{match.away_team?.name ?? "Away"}</b></div>
      </div>
      <div className="ecb-row-odds">
        {odds.map((odd) => {
          const selected = selections.some((pick) => pick.odd_id === odd.id);
          const locked = match.status !== "scheduled" || !market?.is_open;
          return (
            <Button
              key={odd.id}
              disabled={locked}
              variant={selected ? "default" : "outline"}
              onClick={() => {
                if (selected) {
                  remove(odd.id);
                  return;
                }
                add({
                  match_id: match.id,
                  match_name: match.name,
                  market_id: market?.id ?? "",
                  market_name: market?.name ?? "Winner",
                  odd_id: odd.id,
                  selection_label: odd.label,
                  odds: Number(odd.value),
                });
                setOpen(true);
              }}
            >
              {Number(odd.value).toFixed(2)}
            </Button>
          );
        })}
        <span>+{Math.max(0, (market?.odds.length ?? 3) - 3)}</span>
      </div>
    </article>
  );
}