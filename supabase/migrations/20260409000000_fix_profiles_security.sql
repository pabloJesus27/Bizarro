-- 1. Eliminar columna email de profiles (no se usa en la app; emails se leen via admin API)
ALTER TABLE profiles DROP COLUMN IF EXISTS email;

-- 2. Eliminar triggers de sincronización de email (ya no necesarios)
DROP TRIGGER IF EXISTS on_auth_user_created_sync_email ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated_sync_email ON auth.users;
DROP FUNCTION IF EXISTS sync_user_email();

-- 3. Restringir la policy "Public profiles are viewable by everyone" a usuarios autenticados
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);
