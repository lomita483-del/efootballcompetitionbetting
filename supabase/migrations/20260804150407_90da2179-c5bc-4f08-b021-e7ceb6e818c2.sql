ALTER TABLE public.advertisements
  ADD COLUMN IF NOT EXISTS placement text NOT NULL DEFAULT 'both' CHECK (placement IN ('home','matches','both')),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_fit text NOT NULL DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS image_position text NOT NULL DEFAULT 'center',
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS matches_arena_image_url text,
  ADD COLUMN IF NOT EXISTS matches_arena_image_fit text NOT NULL DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS matches_arena_image_position text NOT NULL DEFAULT 'center';

CREATE TABLE public.leaderboard_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_type text NOT NULL CHECK (leaderboard_type IN ('gangs','shooters','scorers')),
  rank integer NOT NULL CHECK (rank > 0),
  title text NOT NULL,
  description text,
  reward_value text NOT NULL,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (leaderboard_type, rank)
);
GRANT SELECT ON public.leaderboard_rewards TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.leaderboard_rewards TO authenticated;
GRANT ALL ON public.leaderboard_rewards TO service_role;
ALTER TABLE public.leaderboard_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active leaderboard rewards" ON public.leaderboard_rewards FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage leaderboard rewards" ON public.leaderboard_rewards FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.leaderboard_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_type text CHECK (leaderboard_type IS NULL OR leaderboard_type IN ('gangs','shooters','scorers')),
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'trophy',
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.leaderboard_achievements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.leaderboard_achievements TO authenticated;
GRANT ALL ON public.leaderboard_achievements TO service_role;
ALTER TABLE public.leaderboard_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active leaderboard achievements" ON public.leaderboard_achievements FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage leaderboard achievements" ON public.leaderboard_achievements FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_leaderboard_feature_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER touch_leaderboard_rewards_updated_at BEFORE UPDATE ON public.leaderboard_rewards FOR EACH ROW EXECUTE FUNCTION public.touch_leaderboard_feature_updated_at();
CREATE TRIGGER touch_leaderboard_achievements_updated_at BEFORE UPDATE ON public.leaderboard_achievements FOR EACH ROW EXECUTE FUNCTION public.touch_leaderboard_feature_updated_at();

INSERT INTO public.leaderboard_rewards (leaderboard_type, rank, title, reward_value, description, display_order) VALUES
('gangs',1,'Champion Reward','₦200,000','Trophy, exclusive badge and season recognition',1),
('gangs',2,'Runner-up Reward','₦100,000','Medal and VIP access reward',2),
('gangs',3,'Third Place Reward','₦50,000','Medal and bonus tokens',3),
('shooters',1,'Elite Shooter','₦100,000','Top shooter trophy and exclusive badge',1),
('shooters',2,'Sharpshooter','₦60,000','Silver medal and bonus tokens',2),
('shooters',3,'Marksman','₦30,000','Bronze medal and bonus tokens',3),
('scorers',1,'Golden Boot','₦100,000','Golden boot trophy and exclusive badge',1),
('scorers',2,'Silver Boot','₦60,000','Silver boot medal and bonus tokens',2),
('scorers',3,'Bronze Boot','₦30,000','Bronze boot medal and bonus tokens',3)
ON CONFLICT (leaderboard_type, rank) DO NOTHING;

INSERT INTO public.leaderboard_achievements (leaderboard_type,title,description,icon,display_order) VALUES
(NULL,'Leaderboard King','Reach #1 on any leaderboard','crown',1),
(NULL,'Point Collector','Earn 10,000 leaderboard points','trophy',2),
(NULL,'Win Streak','Win 5 matches in a row','flame',3),
(NULL,'Top 10 Club','Finish in the Top 10','award',4);