-- Nome personalizado da inteligência digital.
--
-- Default '' (não 'Weme') de propósito: distingue "não escolheu" de "escolheu
-- Weme", e mantém o fallback num único ponto do código (assistantName()).
-- Trocar o default aqui depois não obrigaria a migrar linha nenhuma.

ALTER TABLE public.chat_settings
  ADD COLUMN IF NOT EXISTS assistant_name TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.chat_settings.assistant_name IS
  'Nome que o usuário deu à IA. Vazio = usar o padrão (Weme).';
