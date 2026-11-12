import { describe, expect, it } from "vitest";
import { buildReminderEmail, escapeHtml } from "./email-templates";

describe("escapeHtml", () => {
  it("escapa caracteres peligrosos", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;",
    );
  });
});

describe("buildReminderEmail", () => {
  const data = { firstName: "Ana", gymName: "Mi Gimnasio", endDate: "2026-11-13" };

  it("por vencer", () => {
    const e = buildReminderEmail("EXPIRING_SOON", data);
    expect(e.subject).toBe("Tu membresía en Mi Gimnasio vence el 13/11/2026");
    expect(e.text).toContain("Hola Ana,");
    expect(e.text).toContain("Renuévala en recepción");
    expect(e.html).toContain("vence el 13/11/2026");
  });

  it("vencida", () => {
    const e = buildReminderEmail("EXPIRED", data);
    expect(e.subject).toBe("Tu membresía en Mi Gimnasio venció el 13/11/2026");
    expect(e.text).toContain("venció el 13/11/2026");
  });

  it("no permite inyectar HTML con el nombre del socio o del gimnasio", () => {
    const e = buildReminderEmail("EXPIRING_SOON", { ...data, firstName: "<img src=x onerror=alert(1)>", gymName: "A&B" });
    expect(e.html).not.toContain("<img");
    expect(e.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(e.html).toContain("A&amp;B");
    // el texto plano no se escapa
    expect(e.text).toContain("<img src=x onerror=alert(1)>");
  });
});
