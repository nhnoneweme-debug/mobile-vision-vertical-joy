-- Restaurar GRANTs ausentes em public.profiles (RLS continua aplicando)
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;