-- coach_messages: mensajes semanales del coach para todos los atletas de su programa

CREATE TABLE IF NOT EXISTS coach_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_slug text        NOT NULL,
  week_start   date        NOT NULL,
  content      text        NOT NULL,
  created_by   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (program_slug, week_start)
);

ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;

-- Atletas y coaches pueden leer mensajes de su propio programa
CREATE POLICY "Read own program messages"
  ON coach_messages FOR SELECT
  USING (
    program_slug = (
      SELECT program FROM profiles WHERE id = auth.uid()
    )
  );

-- Solo el coach que creó el mensaje puede insertar o actualizar
CREATE POLICY "Coach write own messages"
  ON coach_messages FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coach update own messages"
  ON coach_messages FOR UPDATE
  USING (created_by = auth.uid());
