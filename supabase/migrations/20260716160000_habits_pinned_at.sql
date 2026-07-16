-- "Fixar" passa a viver no banco.
--
-- Antes os pins ficavam em localStorage (`habits.pinned.<uid>`), então eram por
-- dispositivo: quem fixava no celular não via o mesmo na Home do desktop, e
-- limpar o navegador zerava tudo. É preferência do usuário — pertence ao banco.
--
-- pinned_at (timestamptz nullable) em vez de um boolean: NULL já significa "não
-- fixado" e a data dá ordenação estável na Home (ordem em que foram fixados)
-- sem coluna extra.

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.habits.pinned_at IS
  'Quando o hábito foi fixado na Home. NULL = não fixado. Ordena a Home.';

-- Só os fixados são consultados por user_id — índice parcial cobre o caso e
-- fica pequeno.
CREATE INDEX IF NOT EXISTS habits_pinned_idx
  ON public.habits (user_id, pinned_at)
  WHERE pinned_at IS NOT NULL;
