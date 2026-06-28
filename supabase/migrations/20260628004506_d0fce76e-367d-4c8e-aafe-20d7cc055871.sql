
-- =========================================================
-- AREA_MISSIONS: curated weekly missions per area
-- =========================================================
CREATE TABLE public.area_missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  xp_reward INT NOT NULL DEFAULT 25 CHECK (xp_reward > 0),
  weekly_target INT NOT NULL DEFAULT 1 CHECK (weekly_target > 0),
  class_affinity TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX area_missions_area_idx ON public.area_missions(area_slug) WHERE active;

GRANT SELECT ON public.area_missions TO authenticated;
GRANT ALL ON public.area_missions TO service_role;

ALTER TABLE public.area_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read active missions"
  ON public.area_missions FOR SELECT
  TO authenticated
  USING (active = true);

-- =========================================================
-- AREA_MISSION_LOGS
-- =========================================================
CREATE TABLE public.area_mission_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.area_missions(id) ON DELETE CASCADE,
  area_slug TEXT NOT NULL,
  xp_awarded INT NOT NULL DEFAULT 0,
  note TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX area_mission_logs_user_idx ON public.area_mission_logs(user_id, completed_at DESC);
CREATE INDEX area_mission_logs_mission_idx ON public.area_mission_logs(user_id, mission_id, completed_at DESC);

GRANT SELECT, INSERT, DELETE ON public.area_mission_logs TO authenticated;
GRANT ALL ON public.area_mission_logs TO service_role;

ALTER TABLE public.area_mission_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own mission logs"
  ON public.area_mission_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own mission logs"
  ON public.area_mission_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own mission logs"
  ON public.area_mission_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- AREA_PROGRESS
-- =========================================================
CREATE TABLE public.area_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area_slug TEXT NOT NULL,
  level INT NOT NULL DEFAULT 1,
  xp INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, area_slug)
);

GRANT SELECT ON public.area_progress TO authenticated;
GRANT ALL ON public.area_progress TO service_role;

ALTER TABLE public.area_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own area progress"
  ON public.area_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- updated_at trigger (reuse function if it exists)
-- =========================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER area_missions_touch
  BEFORE UPDATE ON public.area_missions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER area_progress_touch
  BEFORE UPDATE ON public.area_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- TRIGGER: award area XP + level up (200 XP per level)
-- =========================================================
CREATE OR REPLACE FUNCTION public.award_area_mission_xp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  reward INT;
BEGIN
  SELECT xp_reward INTO reward FROM public.area_missions WHERE id = NEW.mission_id;
  IF reward IS NULL THEN reward := 25; END IF;
  NEW.xp_awarded := reward;

  INSERT INTO public.area_progress (user_id, area_slug, xp, level)
  VALUES (NEW.user_id, NEW.area_slug, reward, 1 + (reward / 200))
  ON CONFLICT (user_id, area_slug) DO UPDATE
    SET xp = public.area_progress.xp + reward,
        level = 1 + ((public.area_progress.xp + reward) / 200),
        updated_at = now();

  -- also award global XP via existing xp_events table if present
  BEGIN
    INSERT INTO public.xp_events (user_id, amount, source, meta)
    VALUES (NEW.user_id, reward, 'area_mission',
            jsonb_build_object('area', NEW.area_slug, 'mission_id', NEW.mission_id));
  EXCEPTION WHEN undefined_table THEN
    -- xp_events not present; skip
    NULL;
  END;

  RETURN NEW;
END; $$;

CREATE TRIGGER area_mission_logs_award
  BEFORE INSERT ON public.area_mission_logs
  FOR EACH ROW EXECUTE FUNCTION public.award_area_mission_xp();

-- =========================================================
-- TRIGGER: refund on delete
-- =========================================================
CREATE OR REPLACE FUNCTION public.refund_area_mission_xp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.area_progress
     SET xp = GREATEST(0, xp - OLD.xp_awarded),
         level = 1 + (GREATEST(0, xp - OLD.xp_awarded) / 200),
         updated_at = now()
   WHERE user_id = OLD.user_id AND area_slug = OLD.area_slug;
  RETURN OLD;
END; $$;

CREATE TRIGGER area_mission_logs_refund
  AFTER DELETE ON public.area_mission_logs
  FOR EACH ROW EXECUTE FUNCTION public.refund_area_mission_xp();

-- =========================================================
-- SEED: 40 missions (4 per area)
-- =========================================================
INSERT INTO public.area_missions (area_slug, title, subtitle, xp_reward, weekly_target, class_affinity, sort_order) VALUES
-- CASA
('casa','Definir intenção da semana','Escreva em 1 frase o que quer destravar.',20,1,ARRAY['estrategista','visionario'],1),
('casa','Organizar um canto','15 min de ordem no seu espaço de trabalho.',15,2,ARRAY['guardiao','executor'],2),
('casa','Revisar avatar e objetivo','Confira se seus dados ainda refletem você.',10,1,ARRAY['explorador'],3),
('casa','Ritual de abertura do dia','3 min: respiração + intenção antes de começar.',15,5,ARRAY['guardiao','visionario'],4),

-- MISSÕES
('missoes','Completar 3 quests no streak','Mantenha o ritmo por 3 dias seguidos.',40,1,ARRAY['executor'],1),
('missoes','Quest difícil sem pular','Esforço 4+ em uma quest do dia.',25,2,ARRAY['executor','guardiao'],2),
('missoes','Planejar amanhã hoje à noite','Escreva sua quest de amanhã antes de dormir.',15,5,ARRAY['estrategista'],3),
('missoes','Diário pós-quest','Registre 1 aprendizado depois do check-in.',10,3,ARRAY['visionario','explorador'],4),

-- TREINO
('treino','Treino de força 30 min','Qualquer modalidade que aumente carga ou volume.',30,3,ARRAY['executor','guardiao'],1),
('treino','Mobilidade 10 min','Alongamento ativo, foco em quadril e ombros.',15,3,ARRAY['guardiao'],2),
('treino','Cardio leve 20 min','Caminhada rápida, bike ou corrida leve.',20,2,ARRAY['explorador','executor'],3),
('treino','Registrar progressão','Anote carga, reps ou tempo do treino de hoje.',10,3,ARRAY['estrategista'],4),

-- COZINHA
('cozinha','3L de água','Bater a meta de hidratação do dia.',15,5,ARRAY['guardiao','executor'],1),
('cozinha','Refeição com proteína em todas','3 refeições com proteína de qualidade.',20,4,ARRAY['executor','guardiao'],2),
('cozinha','Cozinhar uma refeição nova','Saia do automático, experimente algo.',25,1,ARRAY['explorador','visionario'],3),
('cozinha','Sem ultraprocessado no dia','24h sem snack industrializado.',20,3,ARRAY['guardiao'],4),

-- QUARTO
('quarto','7h+ de sono','Bater a meta mínima de descanso.',20,5,ARRAY['guardiao','executor'],1),
('quarto','Tela off 30 min antes','Sem celular nos 30 min finais do dia.',15,4,ARRAY['estrategista','guardiao'],2),
('quarto','Quarto escuro e frio','Preparar o ambiente para sono profundo.',10,3,ARRAY['visionario'],3),
('quarto','Acordar sem snooze','Levantar no primeiro alarme.',15,3,ARRAY['executor'],4),

-- MENTAL
('mental','5 min de respiração','Box breathing ou similar, sem celular.',15,4,ARRAY['guardiao','visionario'],1),
('mental','Escrever 3 gratidões','Tirar 2 min para registrar 3 coisas boas.',10,5,ARRAY['visionario','explorador'],2),
('mental','Identificar 1 crença limitante','Escreva e questione com evidência contrária.',25,1,ARRAY['estrategista','visionario'],3),
('mental','30 min sem redes sociais','Tempo de silêncio digital intencional.',15,3,ARRAY['guardiao','estrategista'],4),

-- SOCIAL
('social','Mensagem para alguém que importa','Sem motivo. Só presença.',15,3,ARRAY['explorador','visionario'],1),
('social','Encontro presencial','30 min com alguém olhando no olho.',30,1,ARRAY['explorador'],2),
('social','Dizer não com clareza','Recusar 1 compromisso que não serve você.',20,1,ARRAY['estrategista','guardiao'],3),
('social','Ajudar alguém sem pedir nada','Pequeno ato concreto.',20,2,ARRAY['guardiao','visionario'],4),

-- COACH
('coach','Conversar com o Orientador','Faça 1 pergunta real ao mentor IA.',15,3,ARRAY['estrategista','visionario'],1),
('coach','Revisar a última semana','5 min de retrospectiva guiada.',20,1,ARRAY['estrategista'],2),
('coach','Pedir feedback humano','Peça opinião sincera a 1 pessoa de confiança.',25,1,ARRAY['explorador','visionario'],3),
('coach','Definir 1 micro-experimento','Algo testável em 3 dias.',20,1,ARRAY['explorador','estrategista'],4),

-- PROGRESSO
('progresso','Registrar medida ou foto','Peso, cintura ou foto opcional.',15,1,ARRAY['estrategista','guardiao'],1),
('progresso','Comparar com o mês passado','Olhe seus dados e anote 1 evolução.',20,1,ARRAY['estrategista','visionario'],2),
('progresso','Celebrar uma vitória pequena','Reconheça publicamente ou pra si.',10,2,ARRAY['visionario','explorador'],3),
('progresso','Ajustar uma meta','Refinar com base no que aprendeu.',20,1,ARRAY['estrategista'],4),

-- ORIENTADOR
('orientador','Revisar alunos da semana','Check em quem está em alerta.',25,1,ARRAY['estrategista','guardiao'],1),
('orientador','Enviar 1 missão personalizada','Para um aluno específico.',20,2,ARRAY['estrategista','executor'],2),
('orientador','Estudar 20 min','Conteúdo técnico da sua área.',20,3,ARRAY['explorador','estrategista'],3),
('orientador','Feedback escrito a 1 aluno','Mensagem detalhada e útil.',25,1,ARRAY['guardiao','visionario'],4);
