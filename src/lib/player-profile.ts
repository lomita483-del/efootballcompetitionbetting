import { supabase } from "@/integrations/supabase/client";

export type ProfileMatch = {
  opponentName: string;
  myScore: number;
  theirScore: number;
  result: "W" | "L" | "D";
  timestamp: string; // ISO
  kind: "team" | "shooter";
};

export type TeammateSummary = {
  id: string;
  name: string;
  avatar_url: string | null;
};

export type PlayerProfile = {
  playerId: string;
  name: string;
  avatarUrl: string | null;
  teamId: string | null;
  teamName: string | null;
  linkedUsername: string | null; // null if not linked to a website account

  team: { played: number; wins: number; losses: number; draws: number; points: number; goals: number; present: number; absent: number };
  shooter: { played: number; wins: number; losses: number; draws: number; points: number; kills: number; present: number; absent: number };
  scorerGoals: number; // goals personally credited to this player in team matches

  matchHistory: ProfileMatch[]; // newest first
  teammates: TeammateSummary[]; // other players on the same team ("shooters from this team")
};

/**
 * Loads a full profile for a player by name. Pulls team + shooter match history,
 * present/absent counts, and the linked website account (if any) — all scoped to
 * real, ended, non-virtual, non-archived matches (same pool the leaderboard uses).
 */
export async function loadPlayerProfile(name: string): Promise<PlayerProfile | null> {
  // Leaderboard rows show UPPERCASED team/player labels, while `players.name`
  // is stored in mixed case — match case-insensitively.
  const { data: playerRows } = await supabase
    .from("players")
    .select("id, name, avatar_url, team_id, user_id")
    .ilike("name", name)
    .limit(1);
  let player: any = playerRows?.[0] ?? null;

  // Fall back to a team label (Top Team rows use the team name, which has no
  // matching player row) — build the profile around the team instead.
  if (!player) {
    const { data: teamRows } = await supabase
      .from("teams")
      .select("id, name")
      .ilike("name", name)
      .limit(1);
    const team = teamRows?.[0] as any;
    if (!team) return null;
    const { data: roster } = await supabase
      .from("players")
      .select("id, name, avatar_url, team_id, user_id")
      .eq("team_id", team.id)
      .limit(1);
    player = roster?.[0] ?? {
      id: "00000000-0000-0000-0000-000000000000",
      name: team.name,
      avatar_url: null,
      team_id: team.id,
      user_id: null,
    };
  }

  if (!player) return null;

  const [{ data: teamRow }, { data: linkedUser }, { data: teammates }] = await Promise.all([
    player.team_id ? supabase.from("teams").select("id, name").eq("id", player.team_id).maybeSingle() : Promise.resolve({ data: null as any }),
    (player as any).user_id
      ? supabase.from("player_public_usernames").select("username").eq("id", (player as any).user_id).maybeSingle()
      : Promise.resolve({ data: null as any }),
    player.team_id ? supabase.from("players").select("id, name, avatar_url").eq("team_id", player.team_id).neq("id", player.id) : Promise.resolve({ data: [] as any[] }),
  ]);

  const { data: matches } = await supabase
    .from("matches")
    .select("home_team_id,away_team_id,home_player_id,away_player_id,home_score,away_score,status,is_virtual,is_archived,match_kind,settled_at,created_at,home_present,away_present")
    .eq("status", "ended")
    .eq("is_virtual", false)
    .eq("is_archived", false)
    .or(
      [
        player.team_id ? `home_team_id.eq.${player.team_id}` : null,
        player.team_id ? `away_team_id.eq.${player.team_id}` : null,
        `home_player_id.eq.${player.id}`,
        `away_player_id.eq.${player.id}`,
      ].filter(Boolean).join(",")
    );

  const oppTeamIds = new Set<string>();
  const oppPlayerIds = new Set<string>();
  (matches ?? []).forEach((m: any) => {
    if (m.home_team_id) oppTeamIds.add(m.home_team_id);
    if (m.away_team_id) oppTeamIds.add(m.away_team_id);
    if (m.home_player_id) oppPlayerIds.add(m.home_player_id);
    if (m.away_player_id) oppPlayerIds.add(m.away_player_id);
  });
  const [{ data: allTeams }, { data: allPlayers }] = await Promise.all([
    oppTeamIds.size ? supabase.from("teams").select("id,name").in("id", Array.from(oppTeamIds)) : Promise.resolve({ data: [] as any[] }),
    oppPlayerIds.size ? supabase.from("players").select("id,name").in("id", Array.from(oppPlayerIds)) : Promise.resolve({ data: [] as any[] }),
  ]);
  const teamNameById = new Map<string, string>(); (allTeams ?? []).forEach((t: any) => teamNameById.set(t.id, t.name));
  const playerNameById = new Map<string, string>(); (allPlayers ?? []).forEach((p: any) => playerNameById.set(p.id, p.name));

  const teamStats = { played: 0, wins: 0, losses: 0, draws: 0, points: 0, goals: 0, present: 0, absent: 0 };
  const shooterStats = { played: 0, wins: 0, losses: 0, draws: 0, points: 0, kills: 0, present: 0, absent: 0 };
  let scorerGoals = 0;
  const matchHistory: ProfileMatch[] = [];

  (matches ?? []).forEach((m: any) => {
    const ts = m.settled_at ?? m.created_at ?? new Date(0).toISOString();
    const isTeamSide = !!player.team_id && (m.home_team_id === player.team_id || m.away_team_id === player.team_id) && m.match_kind !== "shooter";
    const isShooterSide = (m.home_player_id === player.id || m.away_player_id === player.id) && m.match_kind === "shooter";

    if (isTeamSide) {
      const iAmHome = m.home_team_id === player.team_id;
      const present = iAmHome ? m.home_present === true : m.away_present === true;
      if (present) teamStats.present += 1; else teamStats.absent += 1;
      if (present) {
        const my = Number(iAmHome ? m.home_score : m.away_score) || 0;
        const their = Number(iAmHome ? m.away_score : m.home_score) || 0;
        const oppTeamId = iAmHome ? m.away_team_id : m.home_team_id;
        teamStats.played += 1;
        teamStats.goals += my;
        let result: "W" | "L" | "D" = "D";
        if (my > their) { result = "W"; teamStats.wins += 1; teamStats.points += 3; }
        else if (my < their) { result = "L"; teamStats.losses += 1; }
        else { teamStats.draws += 1; teamStats.points += 1; }
        matchHistory.push({
          opponentName: teamNameById.get(oppTeamId) || "Unknown Team",
          myScore: my, theirScore: their, result, timestamp: ts, kind: "team",
        });
        // credit personal goal-scorer stat only if this player was the recorded scorer for their side
        const pid = iAmHome ? m.home_player_id : m.away_player_id;
        if (pid === player.id) scorerGoals += my;
      }
    }

    if (isShooterSide) {
      const iAmHome = m.home_player_id === player.id;
      const present = iAmHome ? m.home_present === true : m.away_present === true;
      if (present) shooterStats.present += 1; else shooterStats.absent += 1;
      if (present) {
        const my = Number(iAmHome ? m.home_score : m.away_score) || 0;
        const their = Number(iAmHome ? m.away_score : m.home_score) || 0;
        const oppPlayerId = iAmHome ? m.away_player_id : m.home_player_id;
        shooterStats.played += 1;
        shooterStats.kills += my;
        let result: "W" | "L" | "D" = "D";
        if (my > their) { result = "W"; shooterStats.wins += 1; shooterStats.points += 3; }
        else if (my < their) { result = "L"; shooterStats.losses += 1; }
        else { shooterStats.draws += 1; shooterStats.points += 1; }
        matchHistory.push({
          opponentName: playerNameById.get(oppPlayerId) || "Unknown Shooter",
          myScore: my, theirScore: their, result, timestamp: ts, kind: "shooter",
        });
      }
    }
  });

  matchHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    playerId: player.id,
    name: player.name,
    avatarUrl: (player as any).avatar_url ?? null,
    teamId: player.team_id,
    teamName: (teamRow as any)?.name ?? null,
    linkedUsername: (linkedUser as any)?.username ?? null,
    team: teamStats,
    shooter: shooterStats,
    scorerGoals,
    matchHistory,
    teammates: ((teammates ?? []) as any[]).map((t) => ({ id: t.id, name: t.name, avatar_url: t.avatar_url ?? null })),
  };
}
