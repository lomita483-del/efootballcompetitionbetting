import { supabase } from "@/integrations/supabase/client";

export type LbRow = {
  name: string;
  top_player?: string;
  gang_faction?: string;
  image_url?: string | null;
  team_id?: string | null;
  TS: number;
  W: number;
  L: number;
  D: number;
  P: number;
  PTS: number;
  GD: number; // Goal Difference
  manual_rank?: number | null;
  override_id?: string | null;
  is_override?: boolean;
  rank_delta?: number; // positive = moved up since last snapshot, negative = moved down, undefined = no prior data yet
};

export type Standings = { gangs: LbRow[]; shooters: LbRow[]; scorers: LbRow[] };

export function sortRows(a: LbRow, b: LbRow) {
  if (a.manual_rank != null && b.manual_rank != null) return a.manual_rank - b.manual_rank;
  if (a.manual_rank != null) return -1;
  if (b.manual_rank != null) return 1;
  return b.PTS - a.PTS || b.GD - a.GD || b.W - a.W || b.TS - a.TS;
}

/** Single source of truth for the leaderboard — used by the public page AND the admin editor. */
export async function loadStandings(): Promise<Standings> {
  const { data: settings } = await supabase
    .from("app_settings")
    .select("leaderboard_gangs_reset_at, leaderboard_shooters_reset_at")
    .eq("id", 1)
    .maybeSingle();
  const gangsReset = (settings as any)?.leaderboard_gangs_reset_at ? new Date((settings as any).leaderboard_gangs_reset_at).getTime() : 0;
  const shootersReset = (settings as any)?.leaderboard_shooters_reset_at ? new Date((settings as any).leaderboard_shooters_reset_at).getTime() : 0;

  const { data: matches } = await supabase
    .from("matches")
    .select("home_team_id,away_team_id,home_player_id,away_player_id,home_score,away_score,winner_team_id,status,is_virtual,match_kind,settled_at,created_at,home_present,away_present,is_archived")
    .eq("status", "ended")
    .eq("is_virtual", false)
    .eq("is_archived", false);
  const { data: teams } = await supabase.from("teams").select("id,name,logo_url");
  const { data: players } = await supabase.from("players").select("id,name,team_id,avatar_url");
  const { data: overrides } = await supabase.from("leaderboard_overrides").select("*");

  const teamMap = new Map<string, string>(); (teams ?? []).forEach((t) => teamMap.set(t.id, t.name));
  const teamLogo = new Map<string, string | null>(); (teams ?? []).forEach((t: any) => teamLogo.set(t.id, t.logo_url ?? null));
  const teamLogoByName = new Map<string, string | null>(); (teams ?? []).forEach((t: any) => teamLogoByName.set(t.name, t.logo_url ?? null));
  const teamIdByName = new Map<string, string>(); (teams ?? []).forEach((t: any) => teamIdByName.set(t.name, t.id));
  const playerMap = new Map<string, any>(); (players ?? []).forEach((p) => playerMap.set(p.id, p));
  const playerAvatarByName = new Map<string, string | null>(); (players ?? []).forEach((p: any) => playerAvatarByName.set(p.name, p.avatar_url ?? null));
  const teamPlayers = new Map<string, string[]>();
  (players ?? []).forEach((p) => {
    if (!p.team_id) return;
    const a = teamPlayers.get(p.team_id) ?? [];
    a.push(p.name);
    teamPlayers.set(p.team_id, a);
  });

  const gangAgg = new Map<string, LbRow>();
  const playerAgg = new Map<string, LbRow>();
  const scorerAgg = new Map<string, LbRow>();
  // team name -> (player name -> goals scored) so each gang card can show its
  // actual top scorer instead of an arbitrary first roster member.
  const gangPlayerGoals = new Map<string, Map<string, number>>();
  (players ?? []).forEach((p) => {
    if (!p.name) return;
    const tname = p.team_id ? (teamMap.get(p.team_id) || "") : "";
    playerAgg.set(p.name, { name: p.name, gang_faction: tname || "—", image_url: (p as any).avatar_url ?? null, TS: 0, W: 0, L: 0, D: 0, PTS: 0, P: 0, GD: 0 });
  });

  (matches ?? []).forEach((m: any) => {
    const ts = new Date(m.settled_at ?? m.created_at ?? 0).getTime();
    const countForGangs = ts >= gangsReset;
    const countForShooters = ts >= shootersReset;
    if (!countForGangs && !countForShooters) return;
    if (m.match_kind === "future") return;
    // Strict: a side only counts toward the leaderboard when explicitly marked Present.
    const homePresent = m.home_present === true;
    const awayPresent = m.away_present === true;

    if (m.match_kind === "shooter") {
      if (!countForShooters) return;
      const homeScore = Number(m.home_score ?? 0);
      const awayScore = Number(m.away_score ?? 0);
      const draw = homeScore === awayScore;
      const winnerPlayerId = draw ? null : homeScore > awayScore ? m.home_player_id : m.away_player_id;
      const sides: Array<[string | null, boolean, number]> = [
        [m.home_player_id, homePresent, homeScore],
        [m.away_player_id, awayPresent, awayScore],
      ];
      for (const [pid, present, kills] of sides) {
        if (!present) continue;
        const pl = pid ? playerMap.get(pid) : null;
        if (!pl?.name) continue;
        const tname = pl.team_id ? (teamMap.get(pl.team_id) || "—") : "—";
        const pc = playerAgg.get(pl.name) ?? { name: pl.name, gang_faction: tname, TS: 0, W: 0, L: 0, D: 0, PTS: 0, P: 0, GD: 0 };
        pc.gang_faction = tname;
        pc.P += 1;
        pc.TS += kills; // total kills scored in this match
        if (draw) { pc.D += 1; pc.PTS += 1; pc.GD += 0; }
        else if (winnerPlayerId === pid) { pc.W += 1; pc.PTS += 3; pc.GD += (kills - (pid === m.home_player_id ? awayScore : homeScore)); }
        else { pc.L += 1; pc.GD += (kills - (pid === m.home_player_id ? awayScore : homeScore)); }
        playerAgg.set(pl.name, pc);
      }
      return;
    }

    const homeScore = Number(m.home_score ?? 0);
    const awayScore = Number(m.away_score ?? 0);
    const sides: Array<["home" | "away", boolean, number]> = [
      ["home", homePresent, homeScore],
      ["away", awayPresent, awayScore],
    ];
    for (const [side, present, teamScore] of sides) {
      if (!present) continue;
      const tid = side === "home" ? m.home_team_id : m.away_team_id;
      const tname = teamMap.get(tid) || "Team";
      const opponentScore = side === "home" ? awayScore : homeScore;
      const draw = teamScore === opponentScore;
      const won = !draw && (m.winner_team_id
        ? m.winner_team_id === tid
        : teamScore > opponentScore);
      const gd = teamScore - opponentScore;
      if (countForGangs) {
        const cur = gangAgg.get(tname) ?? { name: tname, top_player: (teamPlayers.get(tid) ?? [])[0], image_url: teamLogo.get(tid) ?? null, team_id: tid, TS: 0, W: 0, L: 0, D: 0, PTS: 0, P: 0, GD: 0 };
        cur.team_id = cur.team_id ?? tid;
        cur.P += 1;
        cur.TS += teamScore; // total kills scored by the gang in this match
        cur.GD += gd; // accumulate goal difference
        if (draw) { cur.D += 1; cur.PTS += 1; }
        else if (won) { cur.W += 1; cur.PTS += 3; }
        else { cur.L += 1; }
        gangAgg.set(tname, cur);
        const pidForGoals = side === "home" ? m.home_player_id : m.away_player_id;
        const plForGoals = pidForGoals ? playerMap.get(pidForGoals) : null;
        if (plForGoals?.name) {
          const bucket = gangPlayerGoals.get(tname) ?? new Map<string, number>();
          bucket.set(plForGoals.name, (bucket.get(plForGoals.name) ?? 0) + teamScore);
          gangPlayerGoals.set(tname, bucket);
        }
      }
      if (countForGangs) {
        const pid = side === "home" ? m.home_player_id : m.away_player_id;
        if (pid) {
          const pl = playerMap.get(pid);
          if (pl?.name) {
            // Fall back to the player's team logo when they have no personal
            // avatar uploaded, so "Top Scorer" never shows a blank initial
            // when a real seeded image already exists at the team level.
            const fallbackLogo = pl.team_id ? (teamLogo.get(pl.team_id) ?? null) : null;
            const sc = scorerAgg.get(pl.name) ?? { name: pl.name, gang_faction: pl.team_id ? (teamMap.get(pl.team_id) || "—") : "—", image_url: pl.avatar_url ?? fallbackLogo ?? null, team_id: pl.team_id ?? null, TS: 0, W: 0, L: 0, D: 0, PTS: 0, P: 0, GD: 0 };
            sc.gang_faction = pl.team_id ? (teamMap.get(pl.team_id) || "—") : "—";
            sc.gang_faction = tname || sc.gang_faction || "—";
            sc.P += 1;
            // Individual tally: only the goals this player personally scored in
            // the match they played — never a team-wide aggregate.
            sc.TS += teamScore;
            scorerAgg.set(pl.name, sc);
          }
        }
      }
      // Top Shooters is driven exclusively by seeded 1v1 shooter matches.
      // Team (non-shooter) matches never credit a team's players here.
    }
  });

  // Players with no personal avatar still fall back to their team logo, even
  // if they never appeared as a scorer in a match (e.g. brand-new players).
  playerAgg.forEach((pc, pname) => {
    if (pc.image_url) return;
    const tid = pc.team_id ?? (pc.gang_faction ? teamIdByName.get(pc.gang_faction) : undefined);
    if (tid) pc.image_url = teamLogo.get(tid) ?? null;
  });

  (overrides ?? []).forEach((o: any) => {
    const target = o.kind === "gang" ? gangAgg : playerAgg;
    if (o.is_hidden) { target.delete(o.name); return; }
    const existing = target.get(o.name);
    target.set(o.name, {
      name: o.name,
      top_player: o.top_player ?? existing?.top_player ?? undefined,
      gang_faction: o.gang_faction ?? o.team_name ?? existing?.gang_faction ?? "—",
      image_url:
        o.image_url ??
        existing?.image_url ??
        (o.kind === "gang" ? (teamLogoByName.get(o.name) ?? null) : (playerAvatarByName.get(o.name) ?? null)),
      team_id: existing?.team_id ?? (o.kind === "gang" ? (teamIdByName.get(o.name) ?? null) : null),
      TS: o.total_score ?? o.points ?? 0,
      W: o.wins, L: o.losses, D: o.draws, P: o.played, PTS: o.points,
      GD: o.goal_difference ?? existing?.GD ?? 0,
      manual_rank: o.manual_rank,
      override_id: o.id,
      is_override: true,
    });
  });

  const gangsSorted = Array.from(gangAgg.values()).sort(sortRows);
  const shootersSorted = Array.from(playerAgg.values()).sort(sortRows);
  const scorersSorted = Array.from(scorerAgg.values())
    .filter((r) => r.TS > 0)
    .sort((a, b) => b.TS - a.TS || a.P - b.P || a.name.localeCompare(b.name));

  await Promise.all([
    applyRankDeltas("gangs", gangsSorted),
    applyRankDeltas("shooters", shootersSorted),
    applyRankDeltas("scorers", scorersSorted),
  ]);

  return { gangs: gangsSorted, shooters: shootersSorted, scorers: scorersSorted };
}

async function applyRankDeltas(board: "gangs" | "shooters" | "scorers", rows: LbRow[]) {
  if (rows.length === 0) return;
  const names = rows.map((r) => r.name);

  const { data: prevRows } = await supabase
    .from("leaderboard_rank_snapshots")
    .select("name, rank")
    .eq("board", board)
    .in("name", names);

  const prevRankByName = new Map<string, number>();
  (prevRows ?? []).forEach((r: any) => prevRankByName.set(r.name, r.rank));

  rows.forEach((r, i) => {
    const currentRank = i + 1;
    const prevRank = prevRankByName.get(r.name);
    r.rank_delta = prevRank != null ? prevRank - currentRank : undefined;
  });

  const upserts = rows.map((r, i) => ({
    board,
    name: r.name,
    rank: i + 1,
    updated_at: new Date().toISOString(),
  }));

  await supabase.from("leaderboard_rank_snapshots").upsert(upserts, { onConflict: "board,name" });
}
