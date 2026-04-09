-- Fix: añadir SET search_path = public a todas las funciones con search_path mutable
-- Fix: restricción correcta en wods_insert
-- Fix: eliminar sync_profile_email (ya no se usa tras borrar email de profiles)

-- 1. get_my_role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. get_my_community_program_ids
CREATE OR REPLACE FUNCTION public.get_my_community_program_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ap.program_id
  FROM athlete_programs ap
  JOIN programs p ON p.id = ap.program_id
  WHERE ap.athlete_id = auth.uid()
    AND p.type = 'community'
$$;

-- 3. accept_join_request
CREATE OR REPLACE FUNCTION public.accept_join_request(
  p_request_id  uuid,
  p_athlete_id  uuid,
  p_program_id  uuid,
  p_program_slug text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE join_requests
    SET status = 'accepted'
    WHERE id = p_request_id;

  INSERT INTO athlete_programs (athlete_id, program_id)
    VALUES (p_athlete_id, p_program_id)
    ON CONFLICT DO NOTHING;

  UPDATE profiles
    SET program = p_program_slug, role = 'athlete'
    WHERE id = p_athlete_id;
END;
$$;

-- 4. create_join_request_on_signup
CREATE OR REPLACE FUNCTION public.create_join_request_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program_id uuid;
BEGIN
  IF NEW.program IS NULL OR NEW.program = 'libre' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_program_id
  FROM programs
  WHERE slug = NEW.program AND type != 'community';

  IF v_program_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO join_requests (athlete_id, program_id, status)
  VALUES (NEW.id, v_program_id, 'pending')
  ON CONFLICT (athlete_id, program_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 5. Eliminar sync_profile_email (ya no existe columna email en profiles)
DROP TRIGGER IF EXISTS on_auth_user_created_sync_profile_email ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated_sync_profile_email ON auth.users;
DROP FUNCTION IF EXISTS public.sync_profile_email() CASCADE;

-- 6. Fix wods_insert: solo el owner puede insertar WODs en su propio programa
DROP POLICY IF EXISTS "wods_insert" ON wods;
CREATE POLICY "wods_insert"
  ON wods FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);
