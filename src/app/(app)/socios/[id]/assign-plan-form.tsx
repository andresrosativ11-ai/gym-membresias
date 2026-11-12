"use client";

import { useState } from "react";
import { ActionForm, SubmitButton, type FormState } from "@/components/action-form";
import type { ISODate } from "@/lib/domain/dates";
import { computeNewPeriod } from "@/lib/domain/membership";
import { formatDate, PAYMENT_METHOD_LABEL } from "@/lib/format";

export type PlanOption = {
  id: string;
  name: string;
  priceLabel: string;
  /** Precio en formato editable, ej. "500.00". */
  priceInput: string;
  durationMonths: number | null;
  durationDays: number | null;
};

export function AssignPlanForm({
  action,
  plans,
  currentEndDate,
  today,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  plans: PlanOption[];
  currentEndDate: ISODate | null;
  today: ISODate;
}) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [amount, setAmount] = useState(plans[0]?.priceInput ?? "");
  const [paidDate, setPaidDate] = useState<ISODate>(today);
  const plan = plans.find((p) => p.id === planId);
  const baseDate = paidDate && paidDate <= today ? paidDate : today;
  const preview = plan ? computeNewPeriod(currentEndDate, baseDate, plan) : null;

  if (plans.length === 0) {
    return <p className="text-sm text-zinc-500">No hay planes activos. Un administrador debe crearlos.</p>;
  }

  return (
    <ActionForm
      action={action}
      className="space-y-3"
      resetOnSuccess
      onSuccess={() => setPaidDate(today)}
      confirmMessage={(fd) =>
        `¿Cobrar $${fd.get("amount")} (${plan?.name ?? "plan"}) con ${
          PAYMENT_METHOD_LABEL[String(fd.get("method"))] ?? "otro método"
        }${baseDate !== today ? ` pagado el ${formatDate(baseDate)}` : ""} y renovar hasta ${
          preview ? formatDate(preview.endDate) : "—"
        }?`
      }
    >
      <div>
        <label className="field-label" htmlFor="planId">
          Plan
        </label>
        <select
          id="planId"
          name="planId"
          value={planId}
          onChange={(e) => {
            setPlanId(e.target.value);
            setAmount(plans.find((p) => p.id === e.target.value)?.priceInput ?? "");
          }}
          className="field-input"
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.priceLabel}
            </option>
          ))}
        </select>
      </div>
      {preview && (
        <p className="text-sm text-zinc-600">
          Periodo: <strong>{formatDate(preview.startDate)}</strong> → <strong>{formatDate(preview.endDate)}</strong>
          {currentEndDate && currentEndDate >= baseDate && " (se suma a la membresía vigente)"}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="amount">
            Monto cobrado
          </label>
          <input
            id="amount"
            name="amount"
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="method">
            Método
          </label>
          <select id="method" name="method" defaultValue="CASH" className="field-input">
            {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="paidDate">
          Fecha del pago <span className="font-normal text-zinc-500">(cámbiala si pagó antes de hoy)</span>
        </label>
        <input
          id="paidDate"
          name="paidDate"
          type="date"
          required
          max={today}
          value={paidDate}
          onChange={(e) => setPaidDate(e.target.value)}
          className="field-input"
        />
      </div>
      <div>
        <label className="field-label" htmlFor="reference">
          Referencia <span className="font-normal text-zinc-500">(opcional: folio, últimos 4 dígitos…)</span>
        </label>
        <input id="reference" name="reference" autoComplete="off" className="field-input" />
      </div>
      <SubmitButton pendingText="Registrando…">Cobrar y renovar</SubmitButton>
    </ActionForm>
  );
}
