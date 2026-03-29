-- Permitir a miembros de una comunidad ver a los demás miembros de esa comunidad.
-- Usamos SECURITY DEFINER para evitar recursión infinita en RLS
-- (la policy no puede referenciar athlete_programs directamente sin el wrapper).

CREATE OR REPLACE FUNCTION get_my_community_program_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT ap.program_id
  FROM athlete_programs ap
  JOIN programs p ON p.id = ap.program_id
  WHERE ap.athlete_id = auth.uid()
    AND p.type = 'community'
$$;

CREATE POLICY "community_members_see_all_members"
  ON athlete_programs FOR SELECT
  USING (
    program_id IN (SELECT get_my_community_program_ids())
  );
