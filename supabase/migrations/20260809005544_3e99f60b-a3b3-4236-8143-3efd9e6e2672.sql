DELETE FROM public.leaderboard_rank_snapshots t USING (
  SELECT ctid, row_number() OVER (PARTITION BY board, name ORDER BY ctid DESC) rn
  FROM public.leaderboard_rank_snapshots
) d WHERE t.ctid = d.ctid AND d.rn > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_lb_rank_snapshots_board_name
  ON public.leaderboard_rank_snapshots (board, name);

DELETE FROM public.referrals t USING (
  SELECT ctid, row_number() OVER (PARTITION BY referee_id ORDER BY ctid DESC) rn
  FROM public.referrals
) d WHERE t.ctid = d.ctid AND d.rn > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_referrals_referee_id
  ON public.referrals (referee_id);