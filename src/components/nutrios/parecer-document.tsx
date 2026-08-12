/**
 * Documento visual do Parecer Nutricional entregue ao paciente.
 * Layout inspirado no modelo impresso da Dra. Juliana Moreira, com a paleta
 * da marca (vinho, dourado, areia e creme). Otimizado para tela e impressão A4.
 */
import type { ParecerDocument, ParecerGauge, ParecerRow } from "@/modules/parecer/domain/parecer";
import { biaRows, circumferenceRows, compositionGauges } from "@/modules/parecer/domain/parecer";

const WINE = "#6B2233";
const WINE_SOFT = "#8C3A46";
const GOLD = "#C08A2E";
const SAND = "#EFE3D6";
const CREAM = "#FBF6F0";
const INK = "#2B2320";
const MUTED = "#7A6A61";

export function ParecerDocument({ doc }: { doc: ParecerDocument }) {
  const { patient, metrics, texts } = doc;
  const rows = biaRows(metrics);
  const circ = circumferenceRows(metrics);
  const gauges = compositionGauges(metrics);

  return (
    <div className="parecer-doc mx-auto w-full max-w-[820px] text-[13px] leading-relaxed" style={{ color: INK, fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
      <Sheet>
        <Header patient={patient} />
        <Block title="Identificação da paciente">
          <div className="grid grid-cols-2 gap-px" style={{ background: SAND }}>
            <Field label="Paciente" value={patient.name} />
            <Field label="Data da avaliação" value={patient.evaluationDate} />
            <Field label="Responsável técnico" value="Dra. Juliana Moreira | CRN-9 22234" />
            <Field label="Idade" value={patient.age !== null ? `${patient.age} anos` : "—"} />
            <Field label="Fase" value={patient.phase} />
            <Field label="Documento gerado em" value={doc.generatedAt} />
          </div>
        </Block>

        <Block title="Parâmetros antropométricos básicos">
          <div className="grid grid-cols-4 gap-3">
            <BigStat label="Peso atual" value={fmt(metrics.weight, "kg")} caption="Base de cálculo" />
            <BigStat label="Altura" value={fmt(metrics.height, "cm", 0)} caption="Estatura" />
            <BigStat label="IMC" value={fmt(metrics.bmi, "")} caption={metrics.bmiClass ?? "—"} accent />
            <BigStat label="Gordura visceral" value={metrics.visceral !== null ? `IGV ${metrics.visceral}` : "—"} caption={metrics.visceralClass ?? "—"} accent />
          </div>
        </Block>

        {rows.length ? (
          <Block title="Análise por bioimpedância e composição interna">
            <Table rows={rows} headers={["Parâmetro", "Resultado", "Classificação / referência clínica"]} />
            <p className="mt-2 text-[10px] leading-4" style={{ color: MUTED, fontFamily: "system-ui, sans-serif" }}>
              (*) Linhas em destaque: valores obtidos por cálculo clínico validado (peso ósseo a partir da massa livre de gordura; hidratação corporal; taxa metabólica basal; CMB e AMB a partir da dobra tricipital e da circunferência do braço). Apresentados como achados clínicos.
            </p>
          </Block>
        ) : null}

        <Block title="Score de composição corporal">
          <Gauge score={metrics.score} />
        </Block>
        <Footer page={1} name={patient.name} />
      </Sheet>

      <Sheet>
        <Header patient={patient} />
        {circ.length ? (
          <Block title="Circunferências e risco metabólico">
            <Table rows={circ} headers={["Circunferência", "Medida", "Referência e status"]} />
          </Block>
        ) : null}

        {gauges.length ? (
          <Block title="Mapa de composição corporal">
            <p className="mb-3 text-[11px]" style={{ color: MUTED, fontFamily: "system-ui, sans-serif" }}>
              Faixa em destaque = referência saudável. Marcador = valor atual da paciente.
            </p>
            <div className="space-y-4">
              {gauges.map((gauge) => (
                <Bar key={gauge.label} gauge={gauge} />
              ))}
            </div>
          </Block>
        ) : null}

        <Block title="Interpretação clínica">
          <div className="space-y-3 text-[13.5px]">
            <p>{texts.interpretacao_1}</p>
            <p>{texts.interpretacao_2}</p>
          </div>
        </Block>
        <Footer page={2} name={patient.name} />
      </Sheet>

      <Sheet>
        <Header patient={patient} />
        <Block title="Prioridades clínicas e direcionamento nutricional">
          <div className="space-y-3">
            {texts.prioridades.map((item, index) => (
              <div key={item.titulo} className="flex overflow-hidden rounded-sm" style={{ background: CREAM, border: `1px solid ${SAND}` }}>
                <div className="flex w-11 shrink-0 items-center justify-center text-base font-semibold text-white" style={{ background: index % 2 === 0 ? WINE : WINE_SOFT }}>
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="px-4 py-3">
                  <div className="text-[14px] font-semibold" style={{ color: WINE }}>{item.titulo}</div>
                  <p className="mt-1 text-[13px]">{item.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </Block>

        {texts.metas.length ? (
          <Block title="Metas do ciclo de acompanhamento">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr style={{ background: WINE, color: "#fff", fontFamily: "system-ui, sans-serif" }}>
                  {["Parâmetro", "Atual", "Meta 60-90 dias", "Meta da jornada"].map((header) => (
                    <th key={header} className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wider">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {texts.metas.map((meta, index) => (
                  <tr key={meta.parametro} style={{ background: index % 2 ? CREAM : "transparent" }}>
                    <td className="border-b px-3 py-2 font-semibold" style={{ borderColor: SAND, color: WINE }}>{meta.parametro}</td>
                    <td className="border-b px-3 py-2" style={{ borderColor: SAND }}>{meta.atual}</td>
                    <td className="border-b px-3 py-2" style={{ borderColor: SAND }}>{meta.meta_60_90}</td>
                    <td className="border-b px-3 py-2" style={{ borderColor: SAND }}>{meta.meta_final}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {texts.nota_metas ? <p className="mt-3 text-[12px] italic" style={{ color: MUTED }}>{texts.nota_metas}</p> : null}
          </Block>
        ) : null}

        <div className="mt-10 flex flex-col items-center gap-1 text-center">
          <div className="h-px w-56" style={{ background: GOLD }} />
          <div className="text-[13px] font-semibold" style={{ color: WINE }}>Dra. Juliana Moreira</div>
          <div className="text-[11px]" style={{ color: MUTED, fontFamily: "system-ui, sans-serif" }}>Nutricionista · CRN-9 22234 · Nutrição Funcional e Saúde da Mulher</div>
        </div>
        <Footer page={3} name={patient.name} />
      </Sheet>
    </div>
  );
}

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="relative mb-6 flex min-h-[1000px] flex-col px-10 py-8 shadow-sm print:mb-0 print:min-h-[1040px] print:shadow-none"
      style={{ background: "#fff", border: `1px solid ${SAND}`, breakAfter: "page" }}
    >
      {children}
    </section>
  );
}

function Header({ patient }: { patient: ParecerDocument["patient"] }) {
  return (
    <header className="mb-7">
      <div className="flex items-end justify-between border-b pb-3" style={{ borderColor: GOLD }}>
        <div>
          <div className="text-[19px] font-semibold leading-tight" style={{ color: WINE }}>Dra. Juliana Moreira</div>
          <div className="text-[10.5px] uppercase tracking-[0.18em]" style={{ color: MUTED, fontFamily: "system-ui, sans-serif" }}>Nutricionista | CRN-9 22234</div>
        </div>
        <div className="text-center text-[11px] italic" style={{ color: WINE_SOFT }}>Nutrição Funcional e Saúde da Mulher</div>
        <div className="text-right">
          <div className="text-[10.5px] uppercase tracking-[0.18em]" style={{ color: WINE, fontFamily: "system-ui, sans-serif" }}>Parecer nutricional</div>
          <div className="text-[11px]" style={{ color: MUTED }}>Data: {patient.evaluationDate}</div>
        </div>
      </div>
    </header>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7" style={{ breakInside: "avoid" }}>
      <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em]" style={{ color: WINE, fontFamily: "system-ui, sans-serif" }}>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 bg-white px-3 py-2">
      <span className="w-40 shrink-0 text-[10.5px] uppercase tracking-wide" style={{ color: MUTED, fontFamily: "system-ui, sans-serif" }}>{label}</span>
      <span className="text-[13px] font-medium">{value}</span>
    </div>
  );
}

function BigStat({ label, value, caption, accent = false }: { label: string; value: string; caption: string; accent?: boolean }) {
  return (
    <div className="overflow-hidden rounded-sm text-center" style={{ border: `1px solid ${SAND}` }}>
      <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-white" style={{ background: accent ? WINE_SOFT : WINE, fontFamily: "system-ui, sans-serif" }}>{label}</div>
      <div className="px-2 py-3" style={{ background: CREAM }}>
        <div className="text-[22px] font-semibold leading-none" style={{ color: accent ? GOLD : WINE }}>{value}</div>
        <div className="mt-1 text-[10.5px]" style={{ color: MUTED, fontFamily: "system-ui, sans-serif" }}>{caption}</div>
      </div>
    </div>
  );
}

function Table({ rows, headers }: { rows: ParecerRow[]; headers: string[] }) {
  return (
    <table className="w-full border-collapse text-[12.5px]">
      <thead>
        <tr style={{ background: WINE, color: "#fff", fontFamily: "system-ui, sans-serif" }}>
          {headers.map((header, index) => (
            <th key={header} className={`px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider ${index === 1 ? "text-right" : "text-left"}`}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.label} style={{ background: index % 2 ? CREAM : "transparent", color: row.calculated ? WINE_SOFT : INK }}>
            <td className="border-b px-3 py-2 font-medium" style={{ borderColor: SAND }}>{row.label}</td>
            <td className="border-b px-3 py-2 text-right font-semibold tabular-nums" style={{ borderColor: SAND }}>{row.value}</td>
            <td className="border-b px-3 py-2 text-[12px]" style={{ borderColor: SAND, color: row.tone === "alto" ? "#9C3B2E" : undefined }}>{row.reference}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Gauge({ score }: { score: number }) {
  const angle = -90 + (score / 100) * 180;
  const arc = (from: number, to: number, color: string) => {
    const rad = (deg: number) => ((deg - 180) * Math.PI) / 180;
    const p = (deg: number) => `${100 + 78 * Math.cos(rad(deg))},${90 + 78 * Math.sin(rad(deg))}`;
    return <path key={`${from}-${color}`} d={`M ${p(from)} A 78 78 0 0 1 ${p(to)}`} stroke={color} strokeWidth={16} fill="none" strokeLinecap="butt" />;
  };
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-[280px]">
        {arc(0, 45, "#9C3B2E")}
        {arc(45, 90, "#C87941")}
        {arc(90, 135, GOLD)}
        {arc(135, 180, "#5C7A52")}
        <line x1={100} y1={90} x2={100 + 62 * Math.cos(((angle - 90) * Math.PI) / 180)} y2={90 + 62 * Math.sin(((angle - 90) * Math.PI) / 180)} stroke={WINE} strokeWidth={3} strokeLinecap="round" />
        <circle cx={100} cy={90} r={5} fill={WINE} />
      </svg>
      <div className="-mt-3 text-[32px] font-semibold leading-none" style={{ color: WINE }}>{score}</div>
      <div className="text-[11px]" style={{ color: MUTED, fontFamily: "system-ui, sans-serif" }}>/ 100 pontos</div>
    </div>
  );
}

function Bar({ gauge }: { gauge: ParecerGauge }) {
  const pct = (value: number) => Math.max(0, Math.min(100, ((value - gauge.min) / (gauge.max - gauge.min)) * 100));
  const inRange = gauge.value >= gauge.refMin && gauge.value <= gauge.refMax;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[12px]">
        <span className="font-medium">{gauge.label}</span>
        <span className="font-semibold" style={{ color: inRange ? "#5C7A52" : WINE }}>{gauge.display}</span>
      </div>
      <div className="relative h-3 w-full rounded-full" style={{ background: SAND }}>
        <div className="absolute inset-y-0 rounded-full" style={{ left: `${pct(gauge.refMin)}%`, width: `${pct(gauge.refMax) - pct(gauge.refMin)}%`, background: "#9BB08C" }} />
        <div className="absolute -top-1 h-5 w-1 rounded-full" style={{ left: `calc(${pct(gauge.value)}% - 2px)`, background: WINE }} />
      </div>
      <div className="mt-1 text-[10px]" style={{ color: MUTED, fontFamily: "system-ui, sans-serif" }}>
        Referência: {gauge.refMin} – {gauge.refMax}
      </div>
    </div>
  );
}

function Footer({ page, name }: { page: number; name: string }) {
  return (
    <div className="mt-auto pt-6">
      <div className="border-t pt-2 text-right text-[10.5px] font-medium" style={{ borderColor: GOLD, color: WINE }}>Página {page} | {name}</div>
      <div className="mt-1 text-[9.5px]" style={{ color: MUTED, fontFamily: "system-ui, sans-serif" }}>Uso clínico exclusivo. Não substitui consulta médica. Válido somente com o prontuário completo da paciente.</div>
    </div>
  );
}

function fmt(value: number | null, unit: string, digits = 1) {
  if (value === null) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}${unit ? ` ${unit}` : ""}`;
}