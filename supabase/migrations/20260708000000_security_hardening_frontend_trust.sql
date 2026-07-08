-- Security hardening — fronteira de confiança frontend↔backend
-- Origem: _contexto-lovable/SECURITY_REVIEW.md (2026-07-08)
-- Cobre F1 (PII em profiles) e F2 (trapaça de economia em profiles/user_crystals).
-- REVISAR E TESTAR em staging antes de produção (não foi possível testar no ambiente do agente).

-- =====================================================================
-- F1 — profiles: remover SELECT aberto (USING true).
--      Todo usuário logado conseguia ler TODAS as colunas de TODOS os perfis
--      (telefone, idade, peso, etc.). RLS filtra linha, não coluna.
--      Mantemos apenas a leitura da própria linha e expomos colunas públicas
--      por uma VIEW dedicada.
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated can read public profile fields" ON public.profiles;
DROP POLICY IF EXISTS "Public profile fields readable via view" ON public.profiles;
-- A policy "Users can view their own profile" (USING auth.uid() = id) permanece.

-- View pública só com colunas não sensíveis (para social / ranking / painel).
-- Roda com direitos do owner (bypassa RLS da tabela base) e só devolve estas colunas.
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, display_name, behavioral_class, xp, level
  FROM public.profiles;

REVOKE ALL ON public.public_profiles FROM anon, authenticated;
GRANT SELECT ON public.public_profiles TO authenticated;

-- =====================================================================
-- F2a — profiles: impedir que o cliente altere colunas de economia.
--       O caminho legítimo (funções SECURITY DEFINER: award_quest_xp,
--       purchase_shop_item, etc.) roda como owner e NÃO é bloqueado.
--       Só a escrita DIRETA do cliente (role 'authenticated'/'anon') é neutralizada.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.protect_profile_economy()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.xp     := OLD.xp;
    NEW.brasas := OLD.brasas;
    NEW.level  := OLD.level;
    NEW.streak := OLD.streak;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_profile_economy ON public.profiles;
CREATE TRIGGER trg_protect_profile_economy
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_economy();

-- =====================================================================
-- F2b — user_crystals: remover escrita direta do cliente (manter só leitura).
--       Aquisição/consumo deve passar por RPC SECURITY DEFINER.
--       (No cliente, crystals.ts faz apenas SELECT.)
-- =====================================================================
DROP POLICY IF EXISTS "user_crystals_modify_own" ON public.user_crystals;
REVOKE INSERT, UPDATE, DELETE ON public.user_crystals FROM authenticated;
-- Mantém a leitura da própria linha (policy user_crystals_select_own + GRANT SELECT).
