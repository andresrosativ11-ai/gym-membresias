-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';


-- Backfill: minúsculas y sin acentos (sin depender de la extensión unaccent).
UPDATE "Member"
SET "searchText" = trim(regexp_replace(lower(translate(
  concat_ws(' ', "firstName", "lastName", "documentId", "email"),
  'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
  'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
)), '\s+', ' ', 'g'));
