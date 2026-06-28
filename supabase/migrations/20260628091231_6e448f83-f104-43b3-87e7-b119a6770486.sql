
-- 1) Saldo de Brasas no profile
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brasas INT NOT NULL DEFAULT 0;

-- 2) Histórico de movimentações
CREATE TABLE public.brasas_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  source TEXT NOT NULL, -- 'xp_conversion' | 'shop_purchase' | 'bonus' | 'refund'
  ref_id UUID,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.brasas_events TO authenticated;
GRANT ALL ON public.brasas_events TO service_role;
ALTER TABLE public.brasas_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own brasas events read" ON public.brasas_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own brasas events insert" ON public.brasas_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_brasas_events_user ON public.brasas_events(user_id, created_at DESC);

-- 3) Catálogo da loja
CREATE TABLE public.shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'frame' | 'title' | 'avatar_icon' | 'theme'
  price INT NOT NULL CHECK (price >= 0),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  required_level INT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shop_items TO authenticated;
GRANT ALL ON public.shop_items TO service_role;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop catalog public to auth" ON public.shop_items
  FOR SELECT TO authenticated USING (active = true);

-- 4) Inventário do usuário
CREATE TABLE public.user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  equipped BOOLEAN NOT NULL DEFAULT false,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);
GRANT SELECT, UPDATE ON public.user_inventory TO authenticated;
GRANT ALL ON public.user_inventory TO service_role;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own inventory read" ON public.user_inventory
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own inventory update equip" ON public.user_inventory
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5) Trigger: converter XP em Brasas (1 brasa por 10 XP)
CREATE OR REPLACE FUNCTION public.award_brasas_from_xp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  brasas_amount INT;
BEGIN
  brasas_amount := GREATEST(1, NEW.amount / 10);
  INSERT INTO public.brasas_events (user_id, amount, source, ref_id, meta)
  VALUES (NEW.user_id, brasas_amount, 'xp_conversion', NEW.id,
          jsonb_build_object('xp_source', NEW.source, 'xp_amount', NEW.amount));
  UPDATE public.profiles SET brasas = brasas + brasas_amount WHERE id = NEW.user_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_award_brasas_from_xp ON public.xp_events;
CREATE TRIGGER trg_award_brasas_from_xp
AFTER INSERT ON public.xp_events
FOR EACH ROW EXECUTE FUNCTION public.award_brasas_from_xp();

-- 6) RPC: comprar item da loja (atômica)
CREATE OR REPLACE FUNCTION public.purchase_shop_item(_item_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_price INT;
  v_required_level INT;
  v_active BOOLEAN;
  v_balance INT;
  v_user_level INT;
  v_already_owned BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT price, required_level, active INTO v_price, v_required_level, v_active
  FROM public.shop_items WHERE id = _item_id;
  IF NOT FOUND OR NOT v_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'item_unavailable');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.user_inventory WHERE user_id = v_user AND item_id = _item_id)
    INTO v_already_owned;
  IF v_already_owned THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_owned');
  END IF;

  SELECT brasas, public.player_level(xp) INTO v_balance, v_user_level
  FROM public.profiles WHERE id = v_user;

  IF v_user_level < v_required_level THEN
    RETURN jsonb_build_object('ok', false, 'error', 'level_locked', 'required_level', v_required_level);
  END IF;

  IF v_balance < v_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_brasas', 'balance', v_balance, 'price', v_price);
  END IF;

  UPDATE public.profiles SET brasas = brasas - v_price WHERE id = v_user;
  INSERT INTO public.brasas_events (user_id, amount, source, ref_id)
  VALUES (v_user, -v_price, 'shop_purchase', _item_id);
  INSERT INTO public.user_inventory (user_id, item_id) VALUES (v_user, _item_id);

  RETURN jsonb_build_object('ok', true, 'balance', v_balance - v_price);
END $$;

REVOKE ALL ON FUNCTION public.purchase_shop_item(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_shop_item(UUID) TO authenticated;

-- 7) RPC: equipar/desequipar item (1 ativo por categoria)
CREATE OR REPLACE FUNCTION public.equip_inventory_item(_item_id UUID, _equip BOOLEAN)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_category TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT category INTO v_category FROM public.shop_items WHERE id = _item_id;
  IF v_category IS NULL THEN RETURN FALSE; END IF;

  IF _equip THEN
    -- desequipa outros itens da mesma categoria
    UPDATE public.user_inventory ui
       SET equipped = false
      FROM public.shop_items si
     WHERE ui.item_id = si.id
       AND ui.user_id = v_user
       AND si.category = v_category
       AND ui.equipped = true;
  END IF;

  UPDATE public.user_inventory SET equipped = _equip
   WHERE user_id = v_user AND item_id = _item_id;
  RETURN TRUE;
END $$;

REVOKE ALL ON FUNCTION public.equip_inventory_item(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equip_inventory_item(UUID, BOOLEAN) TO authenticated;

-- 8) Seed do catálogo
INSERT INTO public.shop_items (slug, name, description, category, price, required_level, payload) VALUES
  ('frame-ember',     'Moldura Brasa',       'Anel de brasa pulsante ao redor do avatar.',           'frame',       150, 1,  '{"glow":"ember"}'),
  ('frame-gold',      'Moldura Áurea',       'Borda dourada para quem cruzou o limiar.',             'frame',       400, 5,  '{"glow":"gold"}'),
  ('frame-obsidian',  'Moldura Obsidiana',   'Negro espelhado, sóbrio e implacável.',                'frame',       650, 10, '{"glow":"obsidian"}'),
  ('frame-mythic',    'Moldura Mítica',      'Aura prismática reservada aos lendários.',             'frame',       1200,20, '{"glow":"prism"}'),
  ('title-arquiteto', 'Título: Arquiteto',   'Quem desenha os próprios alicerces.',                  'title',       300, 3,  '{"label":"Arquiteto"}'),
  ('title-pioneiro',  'Título: Pioneiro',    'Aquele que abre trilhas inéditas.',                    'title',       300, 3,  '{"label":"Pioneiro"}'),
  ('title-lendario',  'Título: Lendário',    'Reservado aos que cruzaram a soleira do mito.',        'title',       800, 15, '{"label":"Lendário"}'),
  ('icon-phoenix',    'Ícone: Fênix',        'Renasce a cada ciclo.',                                'avatar_icon', 200, 2,  '{"icon":"phoenix"}'),
  ('icon-wolf',       'Ícone: Lobo',         'Instinto e matilha.',                                  'avatar_icon', 200, 2,  '{"icon":"wolf"}'),
  ('icon-mountain',   'Ícone: Montanha',     'Inabalável.',                                          'avatar_icon', 200, 2,  '{"icon":"mountain"}'),
  ('theme-volcanic',  'Tema: Vulcânico',     'Skin exclusiva, lava sob o charcoal.',                 'theme',       900, 8,  '{"theme":"volcanic"}'),
  ('theme-celestial', 'Tema: Celestial',     'Skin exclusiva, índigo profundo com estrelas.',        'theme',       900, 8,  '{"theme":"celestial"}')
ON CONFLICT (slug) DO NOTHING;
