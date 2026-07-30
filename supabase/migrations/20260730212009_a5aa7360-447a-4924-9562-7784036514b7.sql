GRANT SELECT ON public.tasks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

GRANT SELECT ON public.task_tiers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_tiers TO authenticated;
GRANT ALL ON public.task_tiers TO service_role;

GRANT SELECT ON public.floating_widgets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.floating_widgets TO authenticated;
GRANT ALL ON public.floating_widgets TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_task_progress TO authenticated;
GRANT ALL ON public.user_task_progress TO service_role;