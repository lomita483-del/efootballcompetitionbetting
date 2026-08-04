ALTER TABLE public.lucky_wheel_campaigns DROP CONSTRAINT IF EXISTS lucky_wheel_campaigns_created_by_fkey;
ALTER TABLE public.lucky_wheel_campaigns ADD CONSTRAINT lucky_wheel_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.lucky_wheel_user_state DROP CONSTRAINT IF EXISTS lucky_wheel_user_state_user_id_fkey;
ALTER TABLE public.lucky_wheel_user_state ADD CONSTRAINT lucky_wheel_user_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.lucky_wheel_spins DROP CONSTRAINT IF EXISTS lucky_wheel_spins_user_id_fkey;
ALTER TABLE public.lucky_wheel_spins ADD CONSTRAINT lucky_wheel_spins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;