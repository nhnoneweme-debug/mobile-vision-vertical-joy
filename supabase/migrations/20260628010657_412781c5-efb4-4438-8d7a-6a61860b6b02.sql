
-- Skill tree: perks por classe + unlocks por usuário

CREATE TABLE public.skill_perks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class TEXT NOT NULL,
  tier INT NOT NULL,
  unlock_level INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class, tier)
);

GRANT SELECT ON public.skill_perks TO authenticated, anon;
GRANT ALL ON public.skill_perks TO service_role;
ALTER TABLE public.skill_perks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perks readable by anyone" ON public.skill_perks FOR SELECT USING (true);

CREATE TABLE public.user_perks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  perk_id UUID NOT NULL REFERENCES public.skill_perks(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, perk_id)
);

GRANT SELECT, INSERT, DELETE ON public.user_perks TO authenticated;
GRANT ALL ON public.user_perks TO service_role;
ALTER TABLE public.user_perks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own perks read" ON public.user_perks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own perks insert" ON public.user_perks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Função: nível global do jogador = floor(xp / 500) + 1
CREATE OR REPLACE FUNCTION public.player_level(_xp INT)
RETURNS INT
LANGUAGE sql IMMUTABLE
AS $$ SELECT GREATEST(1, (_xp / 500) + 1) $$;

-- Função: checa e cria unlocks pro usuário (idempotente)
CREATE OR REPLACE FUNCTION public.check_perk_unlocks(_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class TEXT;
  v_level INT;
  v_inserted INT;
BEGIN
  SELECT behavioral_class, public.player_level(xp)
    INTO v_class, v_level
  FROM public.profiles WHERE id = _user_id;

  IF v_class IS NULL THEN RETURN 0; END IF;

  WITH ins AS (
    INSERT INTO public.user_perks (user_id, perk_id)
    SELECT _user_id, sp.id
    FROM public.skill_perks sp
    WHERE sp.class = v_class
      AND sp.unlock_level <= v_level
      AND NOT EXISTS (
        SELECT 1 FROM public.user_perks up
        WHERE up.user_id = _user_id AND up.perk_id = sp.id
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  RETURN v_inserted;
END $$;

GRANT EXECUTE ON FUNCTION public.check_perk_unlocks(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.player_level(INT) TO authenticated, anon;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER skill_perks_touch BEFORE UPDATE ON public.skill_perks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed: 6 perks por classe (tiers 1, 5, 10, 15, 20, 30)
INSERT INTO public.skill_perks (class, tier, unlock_level, title, description, sort_order) VALUES
-- EXECUTOR
('executor', 1, 1,  'Aprendiz da Ação',     'Você jurou movimento. Cada quest conta.', 1),
('executor', 2, 5,  'Executor de Campo',    'Ritmo travado. +1 hábito sugerido por semana.', 2),
('executor', 3, 10, 'Tático de Ferro',      'Combos de 3 dias contam streak duplo silencioso.', 3),
('executor', 4, 15, 'Mestre Executor',      'Missões de área ganham brasa extra visual.', 4),
('executor', 5, 20, 'Vanguarda',            'Desbloqueia missões raras semanais.', 5),
('executor', 6, 30, 'Arquiteto da Ação',    'Título máximo. Você desenha seu próprio loop.', 6),
-- ESTRATEGISTA
('estrategista', 1, 1,  'Aprendiz do Plano',    'Cada semana começa com um mapa interno.', 1),
('estrategista', 2, 5,  'Tático Semanal',       'Visão de 7 dias destrava no Mapa.', 2),
('estrategista', 3, 10, 'Mente de Tabuleiro',   'Hábitos recebem sugestão de horário ideal.', 3),
('estrategista', 4, 15, 'Mestre Estrategista',  'Você lê padrões antes deles aparecerem.', 4),
('estrategista', 5, 20, 'Grande Estrategista',  'Acesso a missões de longo prazo (mensal).', 5),
('estrategista', 6, 30, 'Arquiteto do Plano',   'Título máximo. Seu calendário é arte.', 6),
-- EXPLORADOR
('explorador', 1, 1,  'Aprendiz do Mapa',     'Curiosidade aberta. O mundo responde.', 1),
('explorador', 2, 5,  'Andarilho',            'Quests de áreas novas dão +20% XP por 7 dias.', 2),
('explorador', 3, 10, 'Caçador de Rotas',     'Missões raras aparecem mais cedo pra você.', 3),
('explorador', 4, 15, 'Mestre Explorador',    'Rotação semanal de hábitos sem perder streak.', 4),
('explorador', 5, 20, 'Cartógrafo',           'Você mapeia o que ainda não existe.', 5),
('explorador', 6, 30, 'Arquiteto da Jornada', 'Título máximo. Toda direção vira caminho.', 6),
-- GUARDIAO
('guardiao', 1, 1,  'Aprendiz do Cuidado',   'Zelo virou prática diária.', 1),
('guardiao', 2, 5,  'Sentinela',             'Hábitos de recuperação contam XP extra.', 2),
('guardiao', 3, 10, 'Guarda Constante',      'Streak protegido: 1 falha por mês não quebra.', 3),
('guardiao', 4, 15, 'Mestre Guardião',       'Missões de sono e corpo desbloqueadas.', 4),
('guardiao', 5, 20, 'Protetor Maior',        'Sua constância silenciosa vira referência.', 5),
('guardiao', 6, 30, 'Arquiteto do Zelo',     'Título máximo. Cuidar é seu legado.', 6),
-- VISIONARIO
('visionario', 1, 1,  'Aprendiz da Visão',     'Você enxerga o eu-futuro com clareza.', 1),
('visionario', 2, 5,  'Sonhador Lúcido',       'Quests ganham "porquê" gerado pelo Orientador.', 2),
('visionario', 3, 10, 'Vidente de Rota',       'Marcos trimestrais aparecem no perfil.', 3),
('visionario', 4, 15, 'Mestre Visionário',     'Sua história ganha capítulos visíveis.', 4),
('visionario', 5, 20, 'Profeta de Si',         'O futuro responde quando você chama.', 5),
('visionario', 6, 30, 'Arquiteto do Horizonte','Título máximo. Você desenha o horizonte.', 6);
