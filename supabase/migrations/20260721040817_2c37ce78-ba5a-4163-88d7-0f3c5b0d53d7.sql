
REVOKE ALL ON FUNCTION public.aggregate_execution_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.extend_mission_today(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.extend_mission_today(uuid, int) TO authenticated;
