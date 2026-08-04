REVOKE ALL ON FUNCTION public.lucky_wheel_register_display(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lucky_wheel_spin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lucky_wheel_award_task_points() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lucky_wheel_register_display(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lucky_wheel_spin(uuid) TO authenticated;