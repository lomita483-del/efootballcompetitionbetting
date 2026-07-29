
-- ========== FLOATING WIDGETS ==========
CREATE TABLE public.floating_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon_name text,
  image_url text,
  destination_type text NOT NULL DEFAULT 'route' CHECK (destination_type IN ('route','tasks','external')),
  destination_value text NOT NULL DEFAULT '/',
  is_active boolean NOT NULL DEFAULT true,
  position text NOT NULL DEFAULT 'right' CHECK (position IN ('left','right')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.floating_widgets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.floating_widgets TO authenticated;
GRANT ALL ON public.floating_widgets TO service_role;
ALTER TABLE public.floating_widgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads active floating widgets" ON public.floating_widgets FOR SELECT USING (is_active OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage floating widgets" ON public.floating_widgets FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_floating_widgets_updated BEFORE UPDATE ON public.floating_widgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== TASKS ==========
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  monitor_metric text NOT NULL CHECK (monitor_metric IN ('tokens_spent','tokens_deposited','bets_placed','tokens_staked')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT ON public.tasks TO anon;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads active tasks" ON public.tasks FOR SELECT USING (is_active OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage tasks" ON public.tasks FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.task_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tier_order integer NOT NULL DEFAULT 1,
  target_value bigint NOT NULL CHECK (target_value > 0),
  reward_kind text NOT NULL DEFAULT 'tokens' CHECK (reward_kind IN ('tokens','achievement','badge')),
  reward_value text NOT NULL DEFAULT '0',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_tiers_task ON public.task_tiers(task_id, tier_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_tiers TO authenticated;
GRANT SELECT ON public.task_tiers TO anon;
GRANT ALL ON public.task_tiers TO service_role;
ALTER TABLE public.task_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads task tiers" ON public.task_tiers FOR SELECT USING (true);
CREATE POLICY "admins manage task tiers" ON public.task_tiers FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.user_task_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.task_tiers(id) ON DELETE CASCADE,
  current_value bigint NOT NULL DEFAULT 0,
  completed_at timestamptz,
  reward_claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tier_id)
);
CREATE INDEX idx_utp_user ON public.user_task_progress(user_id, task_id);
GRANT SELECT ON public.user_task_progress TO authenticated;
GRANT ALL ON public.user_task_progress TO service_role;
ALTER TABLE public.user_task_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own task progress" ON public.user_task_progress FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage task progress" ON public.user_task_progress FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_utp_updated BEFORE UPDATE ON public.user_task_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_task_progress;

-- ========== AUTOMATIC TRACKING ==========
CREATE OR REPLACE FUNCTION public.task_bump_metric(_user_id uuid, _metric text, _delta bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
  ti record;
  cum bigint;
  new_balance bigint;
  reward_tokens bigint;
BEGIN
  IF _user_id IS NULL OR _delta IS NULL OR _delta <= 0 THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN RETURN; END IF;

  FOR t IN SELECT * FROM public.tasks WHERE is_active AND monitor_metric = _metric LOOP
    SELECT COALESCE(MAX(p.current_value), 0) INTO cum
      FROM public.user_task_progress p WHERE p.user_id = _user_id AND p.task_id = t.id;
    cum := cum + _delta;

    FOR ti IN SELECT * FROM public.task_tiers WHERE task_id = t.id ORDER BY tier_order LOOP
      INSERT INTO public.user_task_progress (user_id, task_id, tier_id, current_value)
      VALUES (_user_id, t.id, ti.id, cum)
      ON CONFLICT (user_id, tier_id) DO UPDATE SET current_value = EXCLUDED.current_value;

      IF cum >= ti.target_value THEN
        UPDATE public.user_task_progress
          SET completed_at = COALESCE(completed_at, now())
          WHERE user_id = _user_id AND tier_id = ti.id AND completed_at IS NULL;

        IF EXISTS (SELECT 1 FROM public.user_task_progress
                    WHERE user_id = _user_id AND tier_id = ti.id AND NOT reward_claimed) THEN
          IF ti.reward_kind = 'tokens' THEN
            reward_tokens := GREATEST(0, COALESCE(NULLIF(regexp_replace(ti.reward_value, '[^0-9]', '', 'g'), '')::bigint, 0));
            IF reward_tokens > 0 THEN
              UPDATE public.profiles SET token_balance = token_balance + reward_tokens
                WHERE id = _user_id RETURNING token_balance INTO new_balance;
              INSERT INTO public.token_transactions (user_id, amount, balance_after, kind, description, metadata)
              VALUES (_user_id, reward_tokens, new_balance, 'task_reward',
                      'Task reward: ' || t.name || ' — Tier ' || ti.tier_order,
                      jsonb_build_object('task_id', t.id, 'tier_id', ti.id));
            END IF;
          ELSE
            INSERT INTO public.user_achievements (user_id, code, title, description, icon)
            VALUES (_user_id,
                    lower(regexp_replace(ti.reward_value, '[^a-zA-Z0-9]+', '_', 'g')),
                    ti.reward_value, t.name || ' — Tier ' || ti.tier_order, 'trophy')
            ON CONFLICT (user_id, code) DO NOTHING;
          END IF;

          UPDATE public.user_task_progress SET reward_claimed = true
            WHERE user_id = _user_id AND tier_id = ti.id;

          INSERT INTO public.notifications (user_id, title, body, link)
          VALUES (_user_id, 'Task tier completed!',
                  t.name || ' — Tier ' || ti.tier_order || ' reward granted.', '/tasks');
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.tasks_on_token_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'task_reward' THEN RETURN NEW; END IF;
  IF NEW.amount < 0 THEN
    PERFORM public.task_bump_metric(NEW.user_id, 'tokens_spent', ABS(NEW.amount));
  ELSIF NEW.amount > 0 THEN
    PERFORM public.task_bump_metric(NEW.user_id, 'tokens_deposited', NEW.amount);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tasks_token_tx
AFTER INSERT ON public.token_transactions
FOR EACH ROW EXECUTE FUNCTION public.tasks_on_token_transaction();

CREATE OR REPLACE FUNCTION public.tasks_on_bet_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.task_bump_metric(NEW.user_id, 'bets_placed', 1);
  PERFORM public.task_bump_metric(NEW.user_id, 'tokens_staked', COALESCE(NEW.stake, 0));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tasks_bet_insert
AFTER INSERT ON public.bets
FOR EACH ROW EXECUTE FUNCTION public.tasks_on_bet_insert();

-- Admin stats helper
CREATE OR REPLACE FUNCTION public.admin_task_tier_stats()
RETURNS TABLE(tier_id uuid, in_progress bigint, completed bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.tier_id,
         COUNT(*) FILTER (WHERE p.completed_at IS NULL),
         COUNT(*) FILTER (WHERE p.completed_at IS NOT NULL)
  FROM public.user_task_progress p
  GROUP BY p.tier_id;
$$;
GRANT EXECUTE ON FUNCTION public.admin_task_tier_stats() TO authenticated;
