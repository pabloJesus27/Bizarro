-- auth_attempts: solo acceso server-side (service role bypassa RLS)
-- Policy explícita para silenciar el warning: ningún usuario accede directamente
CREATE POLICY "auth_attempts_no_direct_access"
  ON auth_attempts FOR ALL
  USING (false);

-- coach_invites: coaches pueden insertar sus propios tokens (client-side)
-- SELECT/UPDATE se hace desde API routes con service role (bypassa RLS)
CREATE POLICY "coaches_insert_own_invites"
  ON coach_invites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);
