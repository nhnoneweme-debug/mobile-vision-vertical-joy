
-- Lock down SECURITY DEFINER functions that should only run via triggers
-- or internal helpers. Revoke from PUBLIC and authenticated; keep service_role.

DO $$
DECLARE
  fn TEXT;
  trigger_or_internal TEXT[] := ARRAY[
    'handle_new_user()',
    'handle_new_group()',
    'set_friend_code()',
    'add_owner_to_group()',
    'award_orientador_mission_xp()',
    'award_habit_xp()',
    'award_quest_xp()',
    'award_ritual_xp()',
    'award_area_mission_xp()',
    'award_brasas_from_xp()',
    'refund_area_mission_xp()',
    'remove_habit_xp()',
    'touch_updated_at()',
    'update_profiles_updated_at()',
    'generate_friend_code()',
    'is_group_member(uuid, uuid)',
    'is_crystal_active(uuid, text)',
    'can_view_post(uuid, uuid)',
    'save_weekly_score_snapshot()'
  ];
BEGIN
  FOREACH fn IN ARRAY trigger_or_internal LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
END $$;

-- Keep these SECURITY DEFINER functions callable by authenticated (used via RPC by the app):
-- has_role, check_perk_unlocks, redeem_orientador_invite, equip_inventory_item,
-- calendar_activity, evaluate_challenge, compute_personal_ia_score, check_achievements,
-- join_group_by_invite, purchase_shop_item.
-- For these, also lock out anon and PUBLIC defaults to be safe.
DO $$
DECLARE
  fn TEXT;
  rpc_fns TEXT[] := ARRAY[
    'has_role(uuid, app_role)',
    'check_perk_unlocks()',
    'redeem_orientador_invite(text)',
    'equip_inventory_item(uuid, boolean)',
    'calendar_activity(date, date)',
    'evaluate_challenge(uuid, uuid)',
    'compute_personal_ia_score(uuid)',
    'check_achievements()',
    'join_group_by_invite(text)',
    'purchase_shop_item(uuid)',
    'player_level(integer)',
    'habit_streak(uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY rpc_fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
END $$;
