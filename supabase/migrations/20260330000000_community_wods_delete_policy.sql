-- Política DELETE para que el owner de la comunidad pueda borrar sus WODs
CREATE POLICY "community_owner_delete_wods"
  ON wods FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM programs
      WHERE slug = wods.program AND owner_id = auth.uid() AND type = 'community'
    )
  );
