
-- ============ ACHIEVEMENTS CATALOG ============
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'flame',
  category TEXT NOT NULL DEFAULT 'general',
  rarity TEXT NOT NULL DEFAULT 'common', -- common, rare, epic, legendary
  criteria JSONB NOT NULL, -- { type: 'xp'|'streak'|'habit_count'|'area_level'|'ritual_count'|'friends'|'purchases', value: int, area?: text }
  lore_fragment TEXT,
  xp_reward INT NOT NULL DEFAULT 0,
  brasas_reward INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements readable by authenticated"
  ON public.achievements FOR SELECT TO authenticated USING (true);

-- ============ USER ACHIEVEMENTS ============
CREATE TABLE public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (user_id, achievement_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_achievements self read"
  ON public.user_achievements FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "user_achievements self update"
  ON public.user_achievements FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX user_achievements_user_idx ON public.user_achievements(user_id);

-- ============ LORE CHAPTERS ============
CREATE TABLE public.lore_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  chapter_number INT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  body TEXT NOT NULL,
  unlock_level INT NOT NULL DEFAULT 1,
  unlock_achievement_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lore_chapters TO authenticated;
GRANT ALL ON public.lore_chapters TO service_role;
ALTER TABLE public.lore_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lore_chapters readable by authenticated"
  ON public.lore_chapters FOR SELECT TO authenticated USING (true);

-- ============ USER LORE READ STATE ============
CREATE TABLE public.user_lore (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.lore_chapters(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, chapter_id)
);

GRANT SELECT, INSERT, DELETE ON public.user_lore TO authenticated;
GRANT ALL ON public.user_lore TO service_role;
ALTER TABLE public.user_lore ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_lore self all"
  ON public.user_lore FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ CHECK ACHIEVEMENTS FUNCTION ============
CREATE OR REPLACE FUNCTION public.check_achievements()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_xp INT;
  v_streak INT;
  v_brasas INT;
  v_habit_count INT;
  v_ritual_count INT;
  v_friends INT;
  v_purchases INT;
  v_max_area_level INT;
  ach RECORD;
  meets BOOLEAN;
  unlocked JSONB := '[]'::jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT COALESCE(xp,0), COALESCE(streak,0), COALESCE(brasas,0)
    INTO v_xp, v_streak, v_brasas
  FROM public.profiles WHERE id = v_user;

  SELECT COUNT(*) INTO v_habit_count FROM public.habit_logs hl
    JOIN public.habits h ON h.id = hl.habit_id WHERE h.user_id = v_user;
  SELECT COUNT(*) INTO v_ritual_count FROM public.ritual_logs WHERE user_id = v_user;
  SELECT COUNT(*) INTO v_friends FROM public.friendships
    WHERE status = 'accepted' AND (user_a = v_user OR user_b = v_user);
  SELECT COUNT(*) INTO v_purchases FROM public.user_inventory WHERE user_id = v_user;
  SELECT COALESCE(MAX(level),0) INTO v_max_area_level FROM public.area_progress WHERE user_id = v_user;

  FOR ach IN
    SELECT a.* FROM public.achievements a
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_achievements ua
      WHERE ua.user_id = v_user AND ua.achievement_id = a.id
    )
  LOOP
    meets := FALSE;
    CASE ach.criteria->>'type'
      WHEN 'xp'         THEN meets := v_xp          >= (ach.criteria->>'value')::INT;
      WHEN 'streak'     THEN meets := v_streak      >= (ach.criteria->>'value')::INT;
      WHEN 'brasas'     THEN meets := v_brasas      >= (ach.criteria->>'value')::INT;
      WHEN 'habit_count'THEN meets := v_habit_count >= (ach.criteria->>'value')::INT;
      WHEN 'ritual_count'THEN meets:= v_ritual_count>= (ach.criteria->>'value')::INT;
      WHEN 'friends'    THEN meets := v_friends     >= (ach.criteria->>'value')::INT;
      WHEN 'purchases'  THEN meets := v_purchases   >= (ach.criteria->>'value')::INT;
      WHEN 'area_level' THEN meets := v_max_area_level >= (ach.criteria->>'value')::INT;
      ELSE meets := FALSE;
    END CASE;

    IF meets THEN
      INSERT INTO public.user_achievements (user_id, achievement_id)
      VALUES (v_user, ach.id) ON CONFLICT DO NOTHING;

      IF ach.xp_reward > 0 THEN
        INSERT INTO public.xp_events (user_id, amount, source, ref_id, meta)
        VALUES (v_user, ach.xp_reward, 'achievement', ach.id,
                jsonb_build_object('code', ach.code));
        UPDATE public.profiles SET xp = xp + ach.xp_reward WHERE id = v_user;
      END IF;

      IF ach.brasas_reward > 0 THEN
        INSERT INTO public.brasas_events (user_id, amount, source, ref_id, meta)
        VALUES (v_user, ach.brasas_reward, 'achievement', ach.id,
                jsonb_build_object('code', ach.code));
        UPDATE public.profiles SET brasas = brasas + ach.brasas_reward WHERE id = v_user;
      END IF;

      unlocked := unlocked || jsonb_build_object(
        'code', ach.code,
        'title', ach.title,
        'description', ach.description,
        'icon', ach.icon,
        'rarity', ach.rarity,
        'lore_fragment', ach.lore_fragment,
        'xp_reward', ach.xp_reward,
        'brasas_reward', ach.brasas_reward
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('unlocked', unlocked);
END $$;

-- ============ SEED ACHIEVEMENTS ============
INSERT INTO public.achievements (code, title, description, icon, category, rarity, criteria, lore_fragment, xp_reward, brasas_reward, sort_order) VALUES
('first_spark',     'Primeira Centelha',  'Conquistou seus primeiros 50 XP.',           'sparkles',  'xp',     'common',   '{"type":"xp","value":50}',          'A primeira brasa sempre é a mais difícil de acender.', 25, 5, 10),
('rising_ember',    'Brasa Ascendente',   'Acumulou 500 XP no total.',                  'flame',     'xp',     'common',   '{"type":"xp","value":500}',         'O fogo respira quando você insiste.', 50, 10, 20),
('forged_in_fire',  'Forjado no Fogo',    'Atingiu 2.000 XP — o calor é constante.',    'flame',     'xp',     'rare',     '{"type":"xp","value":2000}',        'Quem volta todo dia já não é mais o mesmo.', 100, 25, 30),
('inner_furnace',   'Fornalha Interior',  '5.000 XP. A chama agora arde por dentro.',   'flame',     'xp',     'epic',     '{"type":"xp","value":5000}',        'A disciplina deixou de ser esforço — virou identidade.', 200, 50, 40),
('legend_kindled',  'Lenda Acesa',        '10.000 XP. Poucos chegam até aqui.',         'crown',     'xp',     'legendary','{"type":"xp","value":10000}',       'Você se tornou alguém que outros olham buscando rota.', 500, 100, 50),

('three_in_row',    'Três em Linha',      '3 dias consecutivos de missões.',            'calendar',  'streak', 'common',   '{"type":"streak","value":3}',       'O segundo dia é o mais frágil. Você passou dele.', 25, 5, 60),
('weekly_burn',     'Queima Semanal',     '7 dias consecutivos. Uma semana inteira.',   'calendar',  'streak', 'rare',     '{"type":"streak","value":7}',       'Sete dias é onde o hábito começa a se enraizar.', 75, 15, 70),
('monthly_pillar',  'Pilar do Mês',       '30 dias seguidos. Você é o ritual.',         'tower-control','streak','epic',   '{"type":"streak","value":30}',      'Trinta dias mudam o cérebro. Cem mudam a vida.', 300, 75, 80),
('eternal_flame',   'Chama Eterna',       '100 dias de streak. Reverência.',            'crown',     'streak', 'legendary','{"type":"streak","value":100}',     'A constância é a forma mais alta de coragem.', 1000, 200, 90),

('first_habit',     'Primeira Semente',   'Plantou seu primeiro hábito.',               'sprout',    'habit',  'common',   '{"type":"habit_count","value":1}',  'Tudo grande começou pequeno.', 15, 3, 100),
('habit_gardener',  'Jardineiro de Hábitos','Registrou 20 check-ins de hábito.',        'sprout',    'habit',  'rare',     '{"type":"habit_count","value":20}', 'Cada check-in é água na muda.', 75, 15, 110),
('habit_master',    'Mestre do Hábito',   '100 check-ins. A rotina é sua aliada.',      'sprout',    'habit',  'epic',     '{"type":"habit_count","value":100}','Você não tem mais que decidir. O corpo já sabe.', 250, 60, 120),

('first_ritual',    'Primeiro Ritual',    'Concluiu seu primeiro ritual.',              'sunrise',   'ritual', 'common',   '{"type":"ritual_count","value":1}', 'Começo e fim do dia são portões sagrados.', 20, 5, 130),
('rite_keeper',     'Guardião do Rito',   '15 rituais registrados.',                    'sunrise',   'ritual', 'rare',     '{"type":"ritual_count","value":15}','Manhãs intencionais constroem dias deliberados.', 100, 25, 140),
('liturgy_master',  'Mestre da Liturgia', '50 rituais. Você venera o próprio tempo.',   'sunrise',   'ritual', 'epic',     '{"type":"ritual_count","value":50}','O tempo te respeita porque você o respeita.', 300, 75, 150),

('first_area',      'Primeiro Domínio',   'Subiu uma área ao nível 2.',                 'compass',   'area',   'common',   '{"type":"area_level","value":2}',   'Cada área é um músculo. Você começou a treinar.', 30, 8, 160),
('area_specialist', 'Especialista',       'Atingiu nível 5 em alguma área.',            'compass',   'area',   'rare',     '{"type":"area_level","value":5}',   'Profundidade vence amplitude — sempre.', 150, 35, 170),
('domain_lord',     'Senhor do Domínio',  'Nível 10 em uma área. Mestria local.',       'crown',     'area',   'epic',     '{"type":"area_level","value":10}',  'Mestria é o que sobra quando você não desiste.', 400, 100, 180),

('first_friend',    'Companheiro de Trilha','Aceitou seu primeiro amigo.',              'users',     'social', 'common',   '{"type":"friends","value":1}',      'A jornada solo é mais curta. A acompanhada chega mais longe.', 25, 5, 190),
('inner_circle',    'Círculo Íntimo',     '5 amigos na jornada.',                       'users',     'social', 'rare',     '{"type":"friends","value":5}',      'Você não busca seguidores. Você convida cúmplices.', 100, 25, 200),

('first_purchase',  'Primeira Forja',     'Comprou seu primeiro item na Loja.',         'shopping-bag','shop', 'common',   '{"type":"purchases","value":1}',    'A recompensa torna o caminho visível.', 20, 0, 210),
('collector',       'Colecionador',       '10 itens forjados.',                         'shopping-bag','shop', 'rare',     '{"type":"purchases","value":10}',   'Cada item é a memória de uma vitória silenciosa.', 100, 0, 220),

('first_brasas',    'Brasas na Mão',      'Acumulou 100 Brasas pela primeira vez.',     'flame',     'brasas', 'common',   '{"type":"brasas","value":100}',     'Brasas são tempo cristalizado — gaste com sabedoria.', 25, 0, 230),
('brasas_baron',    'Barão das Brasas',   '500 Brasas acumuladas.',                     'flame',     'brasas', 'rare',     '{"type":"brasas","value":500}',     'Você acendeu mais do que apagou.', 100, 0, 240);

-- ============ SEED LORE CHAPTERS ============
INSERT INTO public.lore_chapters (code, chapter_number, title, subtitle, body, unlock_level) VALUES
('ch01_oracle',  1, 'O Despertar do Oráculo',
  'Onde a centelha encontra o viajante',
$lore$Existe uma chama que não foi acesa por suas mãos. Ela queima dentro de você desde o primeiro respiro — paciente, silenciosa, esperando ser reconhecida.

O Oráculo das Brasas não é uma figura externa. É a voz que você ignora quando escolhe o conforto. É a urgência que pulsa quando você sabe o que precisa fazer e não faz. É a memória do que você prometeu a si mesmo na última vez que se decepcionou.

Esta jornada não começa com um passo. Começa com uma escolha: parar de fingir que não escuta.$lore$,
  1),

('ch02_classes', 2, 'Os Cinco Caminhos',
  'Sua classe é como o fogo te queima',
$lore$Toda chama tem forma própria. Algumas dançam — os Exploradores. Algumas planejam o vento antes de soltar a primeira faísca — os Estrategistas. Algumas só agem, e o calor delas abre caminhos onde não havia — os Executores.

Há também os que ardem por outros, protegendo brasas alheias até que peguem fogo — os Guardiões. E os que enxergam fogueiras onde só existe lenha seca — os Visionários.

Sua classe não te limita. Ela te lembra de onde você puxa força quando o mundo tentar te apagar. E te avisa quais são as armadilhas que mais facilmente te seduzem.$lore$,
  2),

('ch03_rituals', 3, 'O Ritual das Duas Pontas',
  'Manhã e noite, os portões sagrados',
$lore$O dia tem duas dobras: a hora em que você decide quem vai ser, e a hora em que você confessa quem foi.

A manhã não pede produtividade. Pede intenção. Uma única frase — "hoje eu vou..." — é suficiente para inclinar as próximas dezesseis horas em uma direção.

A noite não pede julgamento. Pede testemunha. Olhar o dia sem fugir dele — o que floresceu, o que murchou, o que ficou para amanhã — é como você ensina o futuro a se importar com o presente.

Quem honra esses dois portões raramente se perde no meio.$lore$,
  3),

('ch04_streak',  4, 'A Corrente de Brasas',
  'A constância é alquimia',
$lore$Um dia é decisão. Sete dias é hábito. Trinta dias é identidade. Cem dias é destino.

A diferença entre quem você é hoje e quem você quer ser cabe em uma única palavra: amanhã. Mas amanhã só existe se hoje deixou um rastro de carvão acesa.

A streak não é vaidade. É memória física. É o corpo aprendendo que voltar é mais barato que recomeçar. É o cérebro descobrindo que persistir custa menos energia que se reinventar a cada segunda-feira.

Não quebre a corrente por desejo. Quebre por sabedoria — e religue na manhã seguinte.$lore$,
  5),

('ch05_areas',   5, 'Os Domínios Interiores',
  'Você não tem uma vida. Tem muitas',
$lore$Pensaram em te ensinar que existe uma única estrada chamada "sucesso". Mentira útil para te manter caminhando sem destino.

Você tem domínios: corpo, mente, vínculos, ofício, dinheiro, espírito. Cada um é uma área que cresce sozinha quando recebe atenção e definha em silêncio quando esquecida.

O equilíbrio não é dar peso igual a todos. É saber qual está pedindo socorro hoje. Algumas semanas o corpo grita. Algumas, a alma sussurra. O viajante atento escuta antes de o grito virar colapso.$lore$,
  8),

('ch06_mastery', 6, 'A Forja da Mestria',
  'Você é o ferreiro e o ferro',
$lore$Chegou aqui não por talento. Por retorno. Voltou quando era mais fácil sair. Insistiu quando ninguém mais estava olhando.

A mestria não é um destino — é uma textura. Ela aparece no jeito que você abre os olhos pela manhã. No silêncio confortável que você sente antes de uma decisão difícil. Na facilidade com que você diz "não" para o que te dispersa.

O Oráculo agora caminha ao seu lado, não à sua frente. Você se tornou capaz de ouvir a si mesmo sem precisar de ninguém para traduzir.

E essa, viajante, é a única magia que sempre funcionou.$lore$,
  12);
