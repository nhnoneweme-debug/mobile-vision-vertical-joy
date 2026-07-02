
-- Marketplace: perks temporários, bundles e itens sazonais
ALTER TABLE public.shop_items
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'cosmetic',
  ADD COLUMN IF NOT EXISTS duration_hours INT,
  ADD COLUMN IF NOT EXISTS perk_code TEXT,
  ADD COLUMN IF NOT EXISTS season_tag TEXT,
  ADD COLUMN IF NOT EXISTS stock INT,
  ADD COLUMN IF NOT EXISTS available_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS available_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bundle_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.user_inventory
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS uses_left INT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'purchase';

-- Permitir múltiplas compras do mesmo item (perks temporários)
ALTER TABLE public.user_inventory DROP CONSTRAINT IF EXISTS user_inventory_user_id_item_id_key;
CREATE INDEX IF NOT EXISTS idx_user_inventory_user_expires ON public.user_inventory(user_id, expires_at);

-- Verifica se usuário tem perk ativo
CREATE OR REPLACE FUNCTION public.has_active_perk(_user UUID, _perk_code TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_inventory ui
    JOIN public.shop_items si ON si.id = ui.item_id
    WHERE ui.user_id = _user
      AND si.perk_code = _perk_code
      AND (ui.expires_at IS NULL OR ui.expires_at > now())
      AND (ui.uses_left IS NULL OR ui.uses_left > 0)
  )
$$;

REVOKE ALL ON FUNCTION public.has_active_perk(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_perk(UUID, TEXT) TO authenticated, service_role;

-- Substitui purchase_shop_item para suportar perks/bundles/stock/janelas
CREATE OR REPLACE FUNCTION public.purchase_shop_item(_item_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  it RECORD;
  v_balance INT;
  v_level INT;
  v_already BOOLEAN;
  v_expires TIMESTAMPTZ;
  v_bundle_id TEXT;
  child_id UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT * INTO it FROM public.shop_items WHERE id = _item_id;
  IF NOT FOUND OR NOT it.active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'item_unavailable');
  END IF;
  IF it.available_from IS NOT NULL AND now() < it.available_from THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_yet_available');
  END IF;
  IF it.available_until IS NOT NULL AND now() > it.available_until THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;
  IF it.stock IS NOT NULL AND it.stock <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sold_out');
  END IF;

  -- Cosméticos permanentes: bloqueia duplicata
  IF it.kind = 'cosmetic' AND it.duration_hours IS NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.user_inventory
      WHERE user_id = v_user AND item_id = _item_id) INTO v_already;
    IF v_already THEN
      RETURN jsonb_build_object('ok', false, 'error', 'already_owned');
    END IF;
  END IF;

  -- Perk ativo mesmo código: bloqueia sobreposição
  IF it.perk_code IS NOT NULL AND public.has_active_perk(v_user, it.perk_code) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'perk_already_active');
  END IF;

  SELECT brasas, public.player_level(xp) INTO v_balance, v_level
  FROM public.profiles WHERE id = v_user;
  IF v_level < it.required_level THEN
    RETURN jsonb_build_object('ok', false, 'error', 'level_locked', 'required_level', it.required_level);
  END IF;
  IF v_balance < it.price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_brasas',
      'balance', v_balance, 'price', it.price);
  END IF;

  UPDATE public.profiles SET brasas = brasas - it.price WHERE id = v_user;
  INSERT INTO public.brasas_events (user_id, amount, source, ref_id)
  VALUES (v_user, -it.price, 'shop_purchase', _item_id);

  IF it.stock IS NOT NULL THEN
    UPDATE public.shop_items SET stock = stock - 1 WHERE id = _item_id;
  END IF;

  IF it.duration_hours IS NOT NULL THEN
    v_expires := now() + (it.duration_hours || ' hours')::INTERVAL;
  END IF;

  INSERT INTO public.user_inventory (user_id, item_id, expires_at, source)
  VALUES (v_user, _item_id, v_expires, 'purchase');

  -- Bundle: entrega itens filhos
  IF it.kind = 'bundle' THEN
    FOR v_bundle_id IN SELECT jsonb_array_elements_text(it.bundle_items) LOOP
      BEGIN
        child_id := v_bundle_id::UUID;
        INSERT INTO public.user_inventory (user_id, item_id, source)
        VALUES (v_user, child_id, 'bundle')
        ON CONFLICT DO NOTHING;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('ok', true, 'balance', v_balance - it.price,
    'expires_at', v_expires, 'kind', it.kind);
END $$;

-- Seed: perks temporários e pacotes
INSERT INTO public.shop_items (slug, name, description, category, kind, price, required_level, duration_hours, perk_code, icon, featured, payload)
VALUES
  ('perk-xp-boost-24h', 'Chama Dobrada', 'Dobra o XP de todas as ações por 24 horas.', 'perk', 'perk', 300, 3, 24, 'xp_x2', '🔥', true, '{"multiplier":2}'::jsonb),
  ('perk-streak-shield', 'Escudo de Brasa', 'Protege seu streak por 48h caso perca um dia.', 'perk', 'perk', 250, 2, 48, 'streak_shield', '🛡️', true, '{}'::jsonb),
  ('perk-brasas-boost-12h', 'Forja Ardente', '+50% Brasas ganhas por 12 horas.', 'perk', 'perk', 200, 2, 12, 'brasas_boost', '⚒️', false, '{"multiplier":1.5}'::jsonb),
  ('perk-mentor-eco-6h', 'Eco do Mentor', 'Respostas do orientador com contexto aprofundado por 6h.', 'perk', 'perk', 150, 1, 6, 'echo_mentor', '🧙', false, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  kind = EXCLUDED.kind, duration_hours = EXCLUDED.duration_hours,
  perk_code = EXCLUDED.perk_code, icon = EXCLUDED.icon,
  featured = EXCLUDED.featured, description = EXCLUDED.description;

-- Item sazonal exemplo
INSERT INTO public.shop_items (slug, name, description, category, kind, price, required_level, season_tag, available_until, icon, featured, payload)
VALUES
  ('seasonal-solstice-frame', 'Moldura Solstício', 'Edição limitada da temporada. Some do mercado em breve.', 'frame', 'seasonal', 500, 1, 'summer_2026', now() + INTERVAL '30 days', '☀️', true, '{"frame":"solstice"}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  kind = 'seasonal', season_tag = EXCLUDED.season_tag,
  available_until = EXCLUDED.available_until, icon = EXCLUDED.icon,
  featured = EXCLUDED.featured;
