-- Permitir a miembros de una comunidad ver a los demás miembros de esa comunidad
CREATE POLICY "community_members_see_all_members"
  ON athlete_programs FOR SELECT
  USING (
    program_id IN (
      SELECT ap2.program_id
      FROM athlete_programs ap2
      JOIN programs p ON p.id = ap2.program_id
      WHERE ap2.athlete_id = auth.uid() AND p.type = 'community'
    )
  );
