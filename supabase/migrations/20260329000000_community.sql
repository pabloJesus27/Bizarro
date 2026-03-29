-- Comunidades: permite a atletas crear y compartir WODs con un grupo informal

-- 1. Añadir columna type a programs ('coach' por defecto para datos existentes)
ALTER TABLE programs ADD COLUMN type text NOT NULL DEFAULT 'coach';

-- 2. Tabla de invitaciones a comunidades
CREATE TABLE community_invites (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id  uuid        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  token         uuid        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_email text        NOT NULL,
  used_by       uuid        REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE community_invites ENABLE ROW LEVEL SECURITY;

-- Owner de la comunidad puede insertar invitaciones
CREATE POLICY "community_owner_insert_invites"
  ON community_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM programs
      WHERE id = community_invites.community_id AND owner_id = auth.uid()
    )
  );

-- Cualquiera autenticado puede leer invitaciones (para validar token al unirse)
CREATE POLICY "anyone_select_community_invites"
  ON community_invites FOR SELECT USING (true);

-- Owner puede actualizar invitaciones (marcar como usada)
CREATE POLICY "community_owner_update_invites"
  ON community_invites FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM programs
      WHERE id = community_invites.community_id AND owner_id = auth.uid()
    )
  );

-- 3. Permitir al owner de una comunidad insertar WODs para ella
CREATE POLICY "community_owner_insert_wods"
  ON wods FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM programs
      WHERE slug = wods.program AND owner_id = auth.uid() AND type = 'community'
    )
  );

-- 4. Permitir a miembros de una comunidad leer sus WODs
CREATE POLICY "community_member_select_wods"
  ON wods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM programs p
      JOIN athlete_programs ap ON ap.program_id = p.id
      WHERE p.slug = wods.program AND p.type = 'community' AND ap.athlete_id = auth.uid()
    )
  );
