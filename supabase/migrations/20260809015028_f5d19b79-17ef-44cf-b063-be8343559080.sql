UPDATE public.app_settings SET
  max_selections_per_ticket = CASE WHEN COALESCE(max_selections_per_ticket,0) < 1 THEN 20 ELSE max_selections_per_ticket END,
  min_selections_per_ticket = CASE WHEN COALESCE(min_selections_per_ticket,0) < 1 THEN 1 ELSE min_selections_per_ticket END,
  virtual_max_selections = CASE WHEN COALESCE(virtual_max_selections,0) < 1 THEN 20 ELSE virtual_max_selections END,
  virtual_min_selections = CASE WHEN COALESCE(virtual_min_selections,0) < 1 THEN 1 ELSE virtual_min_selections END,
  futures_max_selections = CASE WHEN COALESCE(futures_max_selections,0) < 1 THEN 1 ELSE futures_max_selections END,
  virtual_min_stake = CASE WHEN COALESCE(virtual_min_stake,0) < 1 THEN 100000 ELSE virtual_min_stake END,
  virtual_max_stake = CASE WHEN COALESCE(virtual_max_stake,0) < 1 THEN 10000000 ELSE virtual_max_stake END,
  virtual_max_payout = CASE WHEN COALESCE(virtual_max_payout,0) < 1 THEN 100000000 ELSE virtual_max_payout END,
  futures_min_stake = CASE WHEN COALESCE(futures_min_stake,0) < 1 THEN 1 ELSE futures_min_stake END,
  futures_max_payout = CASE WHEN COALESCE(futures_max_payout,0) < 1 THEN 100000000 ELSE futures_max_payout END
WHERE id = 1;

ALTER TABLE public.app_settings
  ALTER COLUMN max_selections_per_ticket SET DEFAULT 20,
  ALTER COLUMN min_selections_per_ticket SET DEFAULT 1,
  ALTER COLUMN virtual_max_selections SET DEFAULT 20,
  ALTER COLUMN virtual_min_selections SET DEFAULT 1,
  ALTER COLUMN futures_max_selections SET DEFAULT 1;