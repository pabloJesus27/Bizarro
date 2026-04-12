-- Fix: eliminar trigger y función sync_user_email que intenta escribir en
-- profiles.email, columna eliminada en 20260409000000_fix_profiles_security.sql
-- La migración anterior intentó borrar "sync_profile_email" (nombre incorrecto).

DROP TRIGGER IF EXISTS on_auth_user_created_sync_email ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated_sync_email ON auth.users;
DROP FUNCTION IF EXISTS public.sync_user_email() CASCADE;
