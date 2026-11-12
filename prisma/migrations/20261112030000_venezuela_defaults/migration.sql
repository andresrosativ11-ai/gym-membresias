-- Valores por defecto para Venezuela: dólares, hora de Caracas, código +58.
-- Solo cambia los DEFAULT; las filas existentes conservan lo configurado en Ajustes.
ALTER TABLE "Plan" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "Settings" ALTER COLUMN "timezone" SET DEFAULT 'America/Caracas',
ALTER COLUMN "currency" SET DEFAULT 'USD',
ALTER COLUMN "countryCode" SET DEFAULT '58';
