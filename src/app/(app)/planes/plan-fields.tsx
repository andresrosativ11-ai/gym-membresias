import { SubmitButton } from "@/components/action-form";

export type PlanDefaults = {
  name?: string;
  durationUnit?: "months" | "days";
  durationValue?: number;
  price?: string;
  active?: boolean;
  benefits?: Record<string, string | null>; // benefitId → valor
};

/** Campos del formulario de plan (se usa dentro de <ActionForm>). */
export function PlanFields({
  defaults,
  catalog,
  submitLabel,
}: {
  defaults: PlanDefaults;
  catalog: { id: string; label: string }[];
  submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="field-label" htmlFor="name">
          Nombre
        </label>
        <input id="name" name="name" required defaultValue={defaults.name} className="field-input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="durationValue">
            Duración
          </label>
          <input
            id="durationValue"
            name="durationValue"
            type="number"
            min={1}
            required
            inputMode="numeric"
            defaultValue={defaults.durationValue ?? 1}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="durationUnit">
            Unidad
          </label>
          <select
            id="durationUnit"
            name="durationUnit"
            defaultValue={defaults.durationUnit ?? "months"}
            className="field-input"
          >
            <option value="months">Meses</option>
            <option value="days">Días</option>
          </select>
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="price">
          Precio
        </label>
        <input
          id="price"
          name="price"
          required
          inputMode="decimal"
          placeholder="499.00"
          defaultValue={defaults.price}
          className="field-input"
        />
      </div>
      <fieldset>
        <legend className="field-label">Beneficios incluidos</legend>
        {catalog.length === 0 && <p className="text-sm text-zinc-500">Agrega beneficios al catálogo primero.</p>}
        <div className="space-y-2">
          {catalog.map((b) => {
            const included = defaults.benefits ? b.id in defaults.benefits : false;
            return (
              <div key={b.id} className="flex items-center gap-3">
                <label className="flex min-h-11 flex-1 items-center gap-2 text-sm">
                  <input type="checkbox" name="benefitId" value={b.id} defaultChecked={included} className="size-5" />
                  {b.label}
                </label>
                <input
                  name={`benefitValue_${b.id}`}
                  placeholder="Detalle (opcional)"
                  defaultValue={defaults.benefits?.[b.id] ?? ""}
                  className="field-input max-w-44 text-sm"
                />
              </div>
            );
          })}
        </div>
      </fieldset>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={defaults.active ?? true} className="size-5" />
        Plan activo (disponible para asignar)
      </label>
      <SubmitButton>{submitLabel}</SubmitButton>
    </div>
  );
}
