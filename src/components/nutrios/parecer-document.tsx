import type { ParecerDocument, ParecerGauge, ParecerRow } from "@/modules/parecer/domain/parecer";
import { biaRows, circumferenceRows, compositionGauges } from "@/modules/parecer/domain/parecer";

const GREEN = "#0B5D3B";
const GREEN_DARK = "#08482F";
const GREEN_SOFT = "#E6F2EC";
const GOLD = "#C6A244";
const INK = "#202522";
const MUTED = "#67716B";
const LINE = "#D8E2DC";
const ALERT = "#D95C4B";
const AMBER = "#D68A22";
const BLUE_SOFT = "#E9F1FA";

export function ParecerDocument({ doc }: { doc: ParecerDocument }) {
  const { patient, metrics, texts } = doc;
  const rows = biaRows(metrics);
  const circ = circumferenceRows(metrics);
  const gauges = compositionGauges(metrics);

  return <div className="parecer-doc mx-auto w-full max-w-[850px] text-[12px] leading-relaxed" style={{ color: INK, fontFamily: "Arial, Helvetica, sans-serif" }}>
    <Sheet>
      <Header patient={patient} />
      <Section title="Identificação da paciente">
        <table className="w-full border-collapse text-[11px]"><tbody>
          <tr><Cell label="Paciente" value={patient.name} wide /><Cell label="Data da avaliação" value={patient.evaluationDate} /></tr>
          <tr><Cell label="Responsável técnico" value="Dra. Juliana Moreira | CRN-9 22234" wide /><Cell label="" value="" /></tr>
          <tr><Cell label="Fase" value={patient.phase} wide /><Cell label="Idade da paciente" value={patient.age !== null ? `${patient.age} anos` : "—"} /></tr>
        </tbody></table>
      </Section>

      <Section title="Parâmetros antropométricos básicos">
        <div className="grid grid-cols-4 overflow-hidden border" style={{ borderColor: LINE }}>
          <Stat label="Peso atual" value={fmt(metrics.weight, "kg")} caption={metrics.weightEstimated ? "Peso estimado · Chumlea" : "Base de cálculo"} />
          <Stat label="Altura" value={fmt(metrics.height, "cm", 0)} caption="Estatura" />
          <Stat label="IMC" value={fmt(metrics.bmi, "")} caption={metrics.bmiClass ?? "—"} tone={metrics.bmi !== null && metrics.bmi >= 30 ? "attention" : "ok"} />
          <Stat label="Gordura visceral" value={metrics.visceral !== null ? `IGV ${metrics.visceral}` : "—"} caption={metrics.visceralClass ?? "—"} tone="attention" />
        </div>
      </Section>

      {rows.length ? <Section title="Análise por bioimpedância (BIA) e composição interna">
        <Table rows={rows} headers={["Parâmetro", "Resultado", "Classificação / Referência Clínica"]} />
        <p className="mt-2 text-[9px] leading-4" style={{ color: MUTED }}>(*) Valores calculados são identificados no próprio documento. Peso ósseo só é calculado quando existem os diâmetros antropométricos necessários; não é estimado por percentual fixo da massa magra.</p>
      </Section> : null}

      <Section title="Score de composição corporal"><Gauge score={metrics.score} /></Section>
      <Footer page={1} name={patient.name} />
    </Sheet>

    <Sheet>
      <Header patient={patient} />
      {circ.length ? <Section title="Circunferências e risco metabólico"><Table rows={circ} headers={["Circunferência", "Medida", "Referência / Status"]} /></Section> : null}
      {gauges.length ? <Section title="Mapa de composição corporal">
        <p className="mb-4 text-[10px]" style={{ color: MUTED }}>Zona verde = referência saudável. Marcador = valor atual da paciente.</p>
        <div className="space-y-5">{gauges.map((gauge) => <Bar key={gauge.label} gauge={gauge} />)}</div>
      </Section> : null}
      <Section title="Interpretação clínica"><div className="space-y-3 text-[11.5px] leading-[1.65]"><p>{texts.interpretacao_1}</p><p>{texts.interpretacao_2}</p></div></Section>
      <Footer page={2} name={patient.name} />
    </Sheet>

    <Sheet>
      <Header patient={patient} />
      <Section title="Prioridades clínicas e direcionamento nutricional">
        <div className="space-y-5">{texts.prioridades.map((item, index) => <div key={`${item.titulo}-${index}`} className="grid grid-cols-[46px_1fr] gap-4"><div className="flex h-10 w-10 items-center justify-center text-[18px] font-bold" style={{ color: GREEN }}>{String(index + 1).padStart(2, "0")}</div><div><h3 className="text-[13px] font-bold" style={{ color: GREEN }}>{item.titulo}</h3><p className="mt-1 text-[11.5px] leading-[1.7]">{item.texto}</p></div></div>)}</div>
      </Section>
      <Footer page={3} name={patient.name} />
    </Sheet>

    <Sheet>
      <Header patient={patient} />
      {texts.metas.length ? <Section title="Metas quantitativas para próxima avaliação">
        <table className="w-full border-collapse text-[10.5px]"><thead><tr style={{ background: GREEN, color: "white" }}>{["Parâmetro", "Atual", "Meta (60-90 dias)", "Meta final (1ª etapa)"].map((h) => <th key={h} className="border px-2 py-2 text-left font-semibold" style={{ borderColor: LINE }}>{h}</th>)}</tr></thead><tbody>{texts.metas.map((meta, index) => <tr key={`${meta.parametro}-${index}`} style={{ background: index % 2 ? "#F9FBFA" : GREEN_SOFT }}><td className="border px-2 py-2 font-semibold" style={{ borderColor: LINE, color: GREEN_DARK }}>{meta.parametro}</td><td className="border px-2 py-2" style={{ borderColor: LINE }}>{meta.atual}</td><td className="border px-2 py-2" style={{ borderColor: LINE }}>{meta.meta_60_90}</td><td className="border px-2 py-2" style={{ borderColor: LINE }}>{meta.meta_final}</td></tr>)}</tbody></table>
        {texts.nota_metas ? <p className="mt-3 text-[9.5px] leading-4" style={{ color: MUTED }}>{texts.nota_metas}</p> : null}
      </Section> : null}
      <div className="mt-10 max-w-[320px] border-t-2 pt-2" style={{ borderColor: GREEN }}><div className="text-[13px] font-bold" style={{ color: GREEN }}>Dra. Juliana Moreira</div><div className="text-[10px]" style={{ color: MUTED }}>Nutricionista Especialista em Saúde da Mulher</div><div className="text-[10px]" style={{ color: MUTED }}>CRN-9 22234</div></div>
      <p className="mt-6 text-[9px] leading-4" style={{ color: MUTED }}>Documento gerado em {doc.generatedAt}. Este parecer é de uso clínico exclusivo e não substitui consulta médica. Válido somente em conjunto com o prontuário completo da paciente.</p>
      <Footer page={4} name={patient.name} />
    </Sheet>
  </div>;
}

function Sheet({ children }: { children: React.ReactNode }) {
  return <section className="relative mb-6 flex min-h-[1080px] flex-col bg-white px-12 py-8 shadow-sm print:mb-0 print:min-h-[1080px] print:shadow-none" style={{ border: `1px solid ${LINE}`, breakAfter: "page" }}>{children}</section>;
}

function Header({ patient }: { patient: ParecerDocument["patient"] }) {
  return <header className="-mx-12 -mt-8 mb-14 px-12 py-5 text-white" style={{ background: GREEN }}><div className="grid grid-cols-3 items-center gap-3"><div><div className="text-[13px] font-bold">Dra. Juliana Moreira</div><div className="mt-1 text-[9px]">Nutricionista | CRN-9 22234</div></div><div className="text-center text-[9px] font-semibold">Nutrição Funcional e Saúde da Mulher</div><div className="text-right"><div className="text-[9px] uppercase">Parecer Nutricional</div><div className="mt-1 text-[9px]">Data: {patient.evaluationDate}</div></div></div><div className="mt-4 h-px" style={{ background: GOLD }} /></header>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-7" style={{ breakInside: "avoid" }}><h2 className="mb-2 border-b-2 pb-1 text-[12px] font-bold uppercase" style={{ color: GREEN, borderColor: GREEN }}>{title}</h2>{children}</section>;
}

function Cell({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <td className={`border px-2 py-2 ${wide ? "w-[58%]" : ""}`} style={{ borderColor: LINE, background: label ? GREEN_SOFT : "white" }}><span className="font-semibold">{label}{label ? " " : ""}</span>{value}</td>;
}

function Stat({ label, value, caption, tone = "ok" }: { label: string; value: string; caption: string; tone?: "ok" | "attention" }) {
  return <div className="border-r p-3 text-center last:border-r-0" style={{ borderColor: LINE, background: tone === "attention" ? "#FFF9E8" : GREEN_SOFT }}><div className="text-[9px]" style={{ color: GREEN_DARK }}>{label}</div><div className="mt-3 text-[18px] font-bold" style={{ color: tone === "attention" ? AMBER : GREEN }}>{value}</div><div className="mt-2 text-[9px] font-semibold" style={{ color: tone === "attention" ? AMBER : MUTED }}>{caption}</div></div>;
}

function Table({ rows, headers }: { rows: ParecerRow[]; headers: string[] }) {
  return <table className="w-full border-collapse text-[10px]"><thead><tr style={{ background: GREEN, color: "white" }}>{headers.map((h) => <th key={h} className="border px-2 py-1.5 text-left font-semibold" style={{ borderColor: LINE }}>{h}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.label}-${index}`} style={{ background: row.calculated ? BLUE_SOFT : index % 2 ? "#F8FBF9" : GREEN_SOFT }}><td className="border px-2 py-1.5 font-semibold" style={{ borderColor: LINE, color: GREEN_DARK }}>{row.label}</td><td className="border px-2 py-1.5 text-center font-semibold tabular-nums" style={{ borderColor: LINE }}>{row.value}</td><td className="border px-2 py-1.5" style={{ borderColor: LINE, color: row.tone === "alto" ? ALERT : row.tone === "atencao" ? AMBER : INK }}>{row.reference}</td></tr>)}</tbody></table>;
}

function Gauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const angle = Math.PI + (clamped / 100) * Math.PI;
  const x = 100 + 62 * Math.cos(angle); const y = 92 + 62 * Math.sin(angle);
  return <div className="flex flex-col items-center"><svg viewBox="0 0 200 115" className="w-[260px]" aria-label={`Score de composição corporal ${score} de 100`}><path d="M25 92 A75 75 0 0 1 175 92" fill="none" stroke="#E24F43" strokeWidth="18" /><path d="M63 28 A75 75 0 0 1 137 28" fill="none" stroke="#F2C315" strokeWidth="18" /><path d="M137 28 A75 75 0 0 1 175 92" fill="none" stroke="#27985E" strokeWidth="18" /><line x1="100" y1="92" x2={x} y2={y} stroke="#252525" strokeWidth="3" /><circle cx="100" cy="92" r="6" fill="#252525" /></svg><div className="-mt-1 text-[28px] font-bold" style={{ color: GREEN }}>{score}</div><div className="text-[10px]" style={{ color: MUTED }}>/ 100 pontos</div></div>;
}

function Bar({ gauge }: { gauge: ParecerGauge }) {
  const pct = (value: number) => Math.max(0, Math.min(100, ((value - gauge.min) / (gauge.max - gauge.min)) * 100));
  const current = pct(gauge.value); const healthyStart = pct(gauge.refMin); const healthyEnd = pct(gauge.refMax); const inRange = gauge.value >= gauge.refMin && gauge.value <= gauge.refMax;
  return <div className="grid grid-cols-[180px_1fr_70px] items-center gap-3"><div className="font-semibold">{gauge.label}</div><div><div className="relative h-5 overflow-visible rounded-full bg-[#D8D8D8]"><div className="absolute inset-y-0" style={{ left: `${healthyStart}%`, width: `${Math.max(3, healthyEnd - healthyStart)}%`, background: "#9BE0B9" }} /><div className="absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{ left: `${current}%`, background: inRange ? "#22B573" : ALERT }} /></div><div className="mt-1 text-center text-[8px]" style={{ color: MUTED }}>Ref: {gauge.refMin.toLocaleString("pt-BR")}-{gauge.refMax.toLocaleString("pt-BR")}</div></div><div className="font-semibold tabular-nums">{gauge.display}</div></div>;
}

function Footer({ page, name }: { page: number; name: string }) {
  return <footer className="mt-auto pt-8"><div className="h-px" style={{ background: GOLD }} /><div className="mt-3 flex justify-between text-[8.5px]" style={{ color: MUTED }}><span>Uso clínico exclusivo. Não substitui consulta médica.</span><span className="font-semibold" style={{ color: GREEN }}>Página {page} | {name}</span></div></footer>;
}

function fmt(value: number | null, unit: string, digits = 1) {
  return value === null ? "—" : `${value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}${unit ? ` ${unit}` : ""}`;
}
