-- Registro de a quién ya se le envió el enlace del portal.
ALTER TABLE "Member" ADD COLUMN "portalInviteSentAt" TIMESTAMP(3);
