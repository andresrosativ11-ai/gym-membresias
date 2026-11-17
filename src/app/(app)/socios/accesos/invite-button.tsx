"use client";

import { markPortalInviteSent } from "../actions";

/** Abre WhatsApp con el mensaje y marca el acceso como enviado. */
export function InviteButton({
  memberId,
  href,
  className,
  children,
  onSent,
}: {
  memberId: string;
  href: string;
  className?: string;
  children: React.ReactNode;
  onSent?: () => void;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(e) => {
        // Abrir primero con el enlace de ESTE socio: si la cola avanza antes de que el
        // navegador siga el href, podría abrirse el chat del siguiente.
        e.preventDefault();
        window.open(href, "_blank", "noopener,noreferrer");
        onSent?.();
        void markPortalInviteSent(memberId, true);
      }}
    >
      {children}
    </a>
  );
}
