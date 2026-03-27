-- Añade Core y Mobility al constraint wods_type_check
ALTER TABLE wods DROP CONSTRAINT wods_type_check;

ALTER TABLE wods ADD CONSTRAINT wods_type_check
  CHECK (type = ANY (ARRAY[
    'For Time'::text,
    'AMRAP'::text,
    'EMOM'::text,
    'Strength'::text,
    'Gymnastics'::text,
    'Core'::text,
    'Mobility'::text,
    'Warmup'::text,
    'For Max'::text,
    'Other'::text
  ]));
