-- Política UPDATE para que el owner de la comunidad pueda editar sus WODs
CREATE POLICY "community_owner_update_wods"
  ON wods FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM programs
      WHERE slug = wods.program AND owner_id = auth.uid() AND type = 'community'
    )
  );
