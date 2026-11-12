import { SubmitButton } from "@/components/action-form";
import { PhotoInput } from "@/components/photo-input";

export type MemberDefaults = {
  firstName?: string;
  lastName?: string;
  documentId?: string | null;
  email?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  enrolledAt: string;
  notes?: string | null;
  photoUrl?: string | null;
  notifyWhatsapp?: boolean;
  notifyEmail?: boolean;
};

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  autoComplete,
  inputMode,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="field-input"
      />
    </div>
  );
}

/** Campos del formulario de socio (se usa dentro de <ActionForm>). */
export function MemberFields({ defaults, submitLabel }: { defaults: MemberDefaults; submitLabel: string }) {
  return (
    <div className="space-y-4">
      <PhotoInput currentUrl={defaults.photoUrl} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" name="firstName" defaultValue={defaults.firstName} required autoComplete="off" />
        <Field label="Apellidos" name="lastName" defaultValue={defaults.lastName} required autoComplete="off" />
        <Field label="Documento / ID" name="documentId" defaultValue={defaults.documentId} />
        <Field label="Fecha de nacimiento" name="birthDate" type="date" defaultValue={defaults.birthDate} />
        <Field label="Teléfono (WhatsApp)" name="phone" type="tel" inputMode="tel" defaultValue={defaults.phone} />
        <Field label="Email" name="email" type="email" defaultValue={defaults.email} />
        <Field label="Fecha de inscripción" name="enrolledAt" type="date" defaultValue={defaults.enrolledAt} required />
      </div>
      <div>
        <label className="field-label" htmlFor="notes">
          Notas
        </label>
        <textarea id="notes" name="notes" rows={3} defaultValue={defaults.notes ?? ""} className="field-input py-2" />
      </div>
      <fieldset className="space-y-1">
        <legend className="field-label">Avisos de vencimiento</legend>
        <p className="text-sm text-zinc-500">Pregúntale al socio antes de marcarlos.</p>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="notifyWhatsapp"
            defaultChecked={defaults.notifyWhatsapp ?? false}
            className="size-5 shrink-0"
          />
          Acepta recibir avisos por WhatsApp
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="notifyEmail" defaultChecked={defaults.notifyEmail ?? false} className="size-5 shrink-0" />
          Acepta recibir avisos por email
        </label>
      </fieldset>
      <SubmitButton>{submitLabel}</SubmitButton>
    </div>
  );
}
