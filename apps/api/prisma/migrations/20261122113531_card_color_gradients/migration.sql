-- Spec 002, design adjustments (data-model.md → Card.color): the six card colors become
-- gradients with new keys. Written by hand: Prisma's generated SQL drops the old values and
-- fails when a card still uses one. Existing cards are mapped to the closest new color:
--   grafito → negro, ciruela → morado, indigo → morado,
--   bosque → verde, petroleo → verde, terracota → marron
-- amarillo and naranja are new and have no previous key.

CREATE TYPE "card_color_new" AS ENUM ('negro', 'morado', 'amarillo', 'naranja', 'verde', 'marron');

ALTER TABLE "cards"
  ALTER COLUMN "color" TYPE "card_color_new"
  USING (
    CASE "color"::text
      WHEN 'grafito' THEN 'negro'
      WHEN 'ciruela' THEN 'morado'
      WHEN 'indigo' THEN 'morado'
      WHEN 'bosque' THEN 'verde'
      WHEN 'petroleo' THEN 'verde'
      WHEN 'terracota' THEN 'marron'
    END
  )::"card_color_new";

DROP TYPE "card_color";

ALTER TYPE "card_color_new" RENAME TO "card_color";
