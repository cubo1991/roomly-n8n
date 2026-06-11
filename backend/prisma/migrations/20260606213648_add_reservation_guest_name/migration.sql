-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "guestName" TEXT;

-- Backfill: las reservas existentes heredan el nombre actual de su huésped,
-- para que el dashboard siga mostrando un titular en el histórico.
UPDATE "Reservation" r
SET "guestName" = g."name"
FROM "Guest" g
WHERE g."id" = r."guestId" AND r."guestName" IS NULL;
