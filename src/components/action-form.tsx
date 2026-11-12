"use client";

import { createContext, useActionState, useContext, useEffect, useRef, startTransition } from "react";

export type FormState = { error?: string; ok?: string };
type Action = (state: FormState, formData: FormData) => Promise<FormState>;

const PendingContext = createContext(false);

/**
 * Formulario ligado a una server action. Usa onSubmit (en vez de `action`) para
 * que React no limpie los campos cuando hay un error de validación.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  onSuccess,
  confirmMessage,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  /** Se llama tras un envío exitoso (ej. para reiniciar campos controlados). */
  onSuccess?: () => void;
  /** Si se indica, pide confirmación antes de enviar (ej. cobros). */
  confirmMessage?: (fd: FormData) => string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.ok) return;
    if (resetOnSuccess) formRef.current?.reset();
    onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar el resultado
  }, [state]);

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const fd = new FormData(e.currentTarget);
        if (confirmMessage && !window.confirm(confirmMessage(fd))) return;
        startTransition(() => formAction(fd));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      {state.error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          {state.ok}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  pendingText = "Guardando…",
  className = "btn-primary w-full",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Botón que pide confirmación antes de enviar su formulario. */
export function ConfirmButton({
  message,
  children,
  className = "btn-secondary",
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
