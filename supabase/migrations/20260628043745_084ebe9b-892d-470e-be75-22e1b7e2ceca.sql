
REVOKE EXECUTE ON FUNCTION public.generate_friend_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_friend_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_group() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_owner_to_group() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_group_member(UUID, UUID) FROM PUBLIC, anon;
-- is_group_member is referenced inside RLS USING clauses; RLS evaluator runs
-- as the table owner so it doesn't need authenticated EXECUTE grant either.
REVOKE EXECUTE ON FUNCTION public.is_group_member(UUID, UUID) FROM authenticated;
