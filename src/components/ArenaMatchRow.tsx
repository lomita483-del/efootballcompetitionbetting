import { Link } from "@tanstack/react-router";
import { TeamLogo } from "@/components/TeamLogo";
import { Button } from "@/components/ui/button";
import { useBetSlip } from "@/contexts/BetSlipContext";
import type { MatchRow } from "@/lib/queries";

export function ArenaMatchRow({ match }: { match: MatchRow }) {
  const { selections, add, remove } = useBetSlip();
  // The 1 / X / 2 buttons must always come from the match-winner market — never
  // from Correct Score, which also has open odds but is not a 1X2 market.
  const isCorrectScore = (name?: string) => /correct\s*score/i.test(name ?? "");
  const winnerMarkets = (match.markets ?? []).filter((item) => !isCorrectScore(item.name));
  const market = winnerMarkets.find((item) => item.is_open) ?? winnerMarkets[0];
  const correctScore = (match.markets ?? []).find((item) => isCorrectScore(item.name) && item.is_open);
  const odds = (market?.odds ?? []).slice(0, 3);
  const date = new Date(match.start_time);

  return (
    <article className="ecb-match-row">
      <Link to="/matches/$matchId" params={{ matchId: match.id }} className="ecb-match-meta">
        <small className="font-black">{match.category?.name ?? "EFA CHAMPIONS LEAGUE"}</small>
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
              }}
            >
              {Number(odd.value).toFixed(2)}
            </Button>
          );
        })}
        {correctScore ? (
          <Link
            to="/matches/$matchId"
            params={{ matchId: match.id }}
            hash="correct-score"
            className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
            title="Open the Correct Score market"
          >
            CS +{correctScore.odds.length}
          </Link>
        ) : (
          <span>+{Math.max(0, (market?.odds.length ?? 3) - 3)}</span>
        )}
      </div>
    </article>
  );
}