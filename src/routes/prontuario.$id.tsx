import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowLeft, CalendarDays, CheckCircle2, ChefHat, Clipboard, FileText, Printer, Save, Share2, ShoppingCart, UserRound, Utensils } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/nutrios/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import * as db from "@/lib/nutrios/repository";
import { ageFromBirthDate, analyzeAnthropometry, type AnthroData, type AnthroResult, type SkinfoldFormula } from "@/modules/avaliacao/domain/anthropometry";
import { calculateEnergy, DEFAULT_ENERGY, type EnergyInputs } from "@/modules/avaliacao/domain/energy";
import { MEAL_SLOT_LABELS, type MealPlan, type RecallItem } from "@/lib/nutrios/types";

export const Route = createFileRoute("/prontuario/$id")({
  head: () => ({
    meta: [
      { title: "Parecer nutricional — NutriOS" },
      { name: "description", content: "Parecer nutricional completo com avaliação clínica, cálculos energéticos e cardápio." },
      { property: "og:title", content: "Parecer nutricional — NutriOS" },
      { property: "og:description", content: "Documento clínico organizado para revisão, impressão e compartilhamento com o paciente." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecordPage,
});

function RecordPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const consultation = useQuery({ queryKey: ["consultation", id], queryFn: () => db.getConsultation(id) });
  const plan = useQuery({ queryKey: ["plan", id], queryFn: () => db.getMealPlan(id) });
  const anthropometry = useQuery({ queryKey: ["anthro", id], queryFn: () => db.getAnthropometry(id) });
  const conduct = useQuery({ queryKey: ["conduct", id], queryFn: () => db.getConduct(id) });
  const diagnosis = useQuery({ queryKey: ["diagnosis", id], queryFn: () => db.getDiagnoses(id) });
  const anamnesis = useQuery({ queryKey: ["anamnesis", id], queryFn: () => db.getAnamnesis(id) });
  const recall = useQuery({ queryKey: ["recall", id], queryFn: () => db.listRecall(id) });
  const record = useQuery({ queryKey: ["record", id], queryFn: () => db.getRecord(id) });
  const [report, setReport] = useState("");
  const [reportDirty, setReportDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (record.data && !reportDirty) setReport(record.data.report);
  }, [record.data, reportDirty]);

  const patient = consultation.data?.patients;
  const profile = useMemo(() => ({ age: ageFromBirthDate(patient?.birth_date), sex: patient?.sex ?? null }), [patient?.birth_date, patient?.sex]);
  const anthroData = (anthropometry.data?.data ?? {}) as AnthroData;
  const formula = (anthroData["formula"] ?? "pollock3") as SkinfoldFormula;
  const analysis = useMemo(() => analyzeAnthropometry(anthroData, profile, formula), [anthroData, profile, formula]);
  const energyInputs = useMemo(() => ({ ...DEFAULT_ENERGY, ...((conduct.data?.energy ?? {}) as Partial<EnergyInputs>) }), [conduct.data?.energy]);
  const energyResult = useMemo(() => calculateEnergy(energyInputs), [energyInputs]);
  const activeAnamnesis = Object.entries(anamnesis.data ?? {}).filter(([, field]) => field?.value && field.status !== "recusado");

  const saveReport = async () => {
    setSaving(true);
    try {
      await db.saveReport(id, report);
      setReportDirty(false);
      await queryClient.invalidateQueries({ queryKey: ["record", id] });
      toast.success("Parecer salvo.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const shareReport = async () => {
    const text = `${patient?.name ?? "Paciente"}\n\n${plainText(report)}`.trim();
    try {
      if (navigator.share) {
        await navigator.share({ title: `Parecer nutricional — ${patient?.name ?? "Paciente"}`, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success("Parecer copiado para a área de transferência.");
    } catch (error) {
      if ((error as Error).name !== "AbortError") toast.error("Não foi possível compartilhar o parecer.");
    }
  };

  return (
    <AppShell title="Parecer nutricional">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between print:hidden">
          <div>
            <Link to="/consulta/$id" params={{ id }} className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Voltar para a consulta</Link>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Documento clínico</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Parecer nutricional</h1>
            <p className="mt-2 text-sm text-muted-foreground">{patient?.name ?? "Paciente"} · {formatDate(consultation.data?.consultation_date)}</p>
          </div>
          <div className="flex flex-wrap gap-2"><Link to="/parecer/$id" params={{ id }}><Button size="sm" variant="secondary"><FileText /> Parecer do paciente</Button></Link><Button variant="outline" size="sm" onClick={() => void shareReport()}><Share2 /> Compartilhar</Button><Button variant="outline" size="sm" onClick={() => window.print()}><Printer /> Imprimir / PDF</Button><Button size="sm" onClick={() => void saveReport()} disabled={saving || !reportDirty}><Save /> {saving ? "Salvando…" : "Salvar parecer"}</Button></div>
        </div>

        <article className="space-y-8 print:space-y-5">
          <header className="border-b border-border pb-6 print:pb-4"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">NutriOS · Parecer da consulta</p><h2 className="mt-2 text-3xl font-semibold tracking-tight print:text-2xl">{patient?.name ?? "Paciente"}</h2><p className="mt-2 text-sm text-muted-foreground">Documento gerado em {formatDate(new Date().toISOString())}</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground print:hidden"><CheckCircle2 className="size-4 text-primary" /> {consultation.data?.status === "finalizada" ? "Consulta finalizada" : "Em revisão"}</div></div></header>

          <section className="grid gap-3 sm:grid-cols-4 print:grid-cols-4"><Stat icon={<UserRound />} label="Idade / sexo" value={`${profile.age ?? "—"} anos · ${labelSex(patient?.sex)}`} /><Stat icon={<CalendarDays />} label="Data da consulta" value={formatDate(consultation.data?.consultation_date)} /><Stat icon={<Activity />} label="IMC" value={analysis.bmi ? `${analysis.bmi} kg/m²` : "Não informado"} /><Stat icon={<Utensils />} label="GET" value={energyResult.tee ? `${energyResult.tee} kcal/dia` : "Não calculado"} /></section>

          <Section title="Identificação e contexto" icon={<UserRound />}><div className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3"><DataPoint label="Paciente" value={patient?.name ?? "Não informado"} /><DataPoint label="CPF" value={patient?.cpf ?? "Não informado"} /><DataPoint label="Sexo biológico" value={labelSex(patient?.sex)} /><DataPoint label="Data de nascimento" value={formatDate(patient?.birth_date)} /><DataPoint label="Contato" value={patient?.phone ?? patient?.email ?? "Não informado"} /><DataPoint label="Gestação" value={patient?.is_pregnant ? `${patient.pregnancy_weeks ?? "—"} semanas` : "Não se aplica"} /></div></Section>
          <Section title="Resumo clínico" icon={<FileText />}><div className="whitespace-pre-wrap text-sm leading-6">{consultation.data?.clinical_summary || "Resumo clínico ainda não gerado."}</div></Section>
          <Section title="Anamnese revisada" icon={<Clipboard />}>{activeAnamnesis.length ? <div className="grid gap-4 sm:grid-cols-2">{activeAnamnesis.map(([key, field]) => <DataPoint key={key} label={humanize(key)} value={field?.value ?? ""} multiline />)}</div> : <Empty text="Nenhum campo de anamnese revisado." />}</Section>
          <Section title="Avaliação antropométrica" icon={<Activity />}><div className="space-y-5">{analysis.groups.map((group) => <ResultGroup key={group.title} title={group.title} results={group.results} />)}<div className="whitespace-pre-wrap border-l-2 border-primary pl-4 text-sm leading-6 text-muted-foreground">{anthropometry.data?.interpretation || "Interpretação profissional ainda não registrada."}</div></div></Section>
          <Section title="Necessidades energéticas" icon={<Activity />}><div className="grid gap-3 sm:grid-cols-4"><Stat label="TMB escolhida" value={energyResult.bmr ? `${energyResult.bmr} kcal` : "—"} /><Stat label="Atividade" value={`${energyInputs.activityFactor}`} /><Stat label="Injúria" value={`${energyInputs.injuryFactor}`} /><Stat label="GET final" value={energyResult.tee ? `${energyResult.tee} kcal` : "—"} /></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{energyResult.estimates.map((estimate) => <div key={estimate.key} className="flex items-center justify-between border-b border-border py-2 text-sm"><span>{estimate.label}</span><span className="tabular-nums text-muted-foreground">{estimate.kcal ? `${estimate.kcal} kcal` : "Dados insuficientes"}</span></div>)}</div><p className="mt-3 text-xs text-muted-foreground">Adicionais aplicados: MET {energyResult.metKcal} kcal · gestação/lactação {energyResult.pregnancyKcal} kcal · ajuste manual {energyInputs.manualAdjust} kcal.</p></Section>
          <Section title="Hipóteses e pontos de atenção" icon={<Clipboard />}><div className="grid gap-6 sm:grid-cols-2"><ListBlock title="Hipóteses para avaliação profissional" items={diagnosis.data?.hypotheses ?? []} empty="Nenhuma hipótese registrada." /><ListBlock title="Sinalizações do padrão alimentar" items={diagnosis.data?.recall_flags ?? []} empty="Nenhuma sinalização registrada." /></div></Section>
          <Section title="Recordatório alimentar" icon={<Utensils />}><RecallTable items={(recall.data ?? []) as RecallItem[]} /></Section>
          <Section title="Cardápio proposto" icon={<Utensils />}>{plan.data ? <MealPlanView plan={plan.data.plan} rationale={plan.data.rationale} /> : <Empty text="Cardápio ainda não gerado." />}</Section>

          <section className="space-y-4 print:hidden"><div className="flex items-end justify-between gap-3 border-b border-border pb-3"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Edição profissional</p><h2 className="mt-1 text-lg font-semibold">Parecer para o paciente</h2></div><span className="text-xs text-muted-foreground">{reportDirty ? "Alterações não salvas" : "Salvo"}</span></div><Textarea value={report} onChange={(event) => { setReport(event.target.value); setReportDirty(true); }} className="min-h-[280px] resize-y font-mono text-sm leading-6" placeholder="Gere o parecer na última etapa da consulta ou escreva uma versão personalizada." aria-label="Parecer nutricional editável" /></section>
          <section className="print-report space-y-4"><div className="border-b border-border pb-3"><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Parecer final</p><h2 className="mt-1 text-lg font-semibold">Orientações e interpretação</h2></div>{report ? <ReportText text={report} /> : <Empty text="Parecer final ainda não gerado." />}</section>
          <footer className="border-t border-border pt-5 text-xs text-muted-foreground">Documento de apoio ao acompanhamento nutricional. Não substitui avaliação ou consulta médica.</footer>
        </article>
      </div>
    </AppShell>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) { return <section className="space-y-3 break-inside-avoid"><div className="flex items-center gap-2 border-b border-border pb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground"><span className="text-foreground">{icon}</span>{title}</div>{children}</section>; }
function Stat({ icon, label, value }: { icon?: ReactNode; label: string; value: string | number }) { return <div className="rounded-md border border-border px-3 py-2 print:bg-transparent"><div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{icon}{label}</div><div className="mt-1 text-sm font-semibold tabular-nums">{value}</div></div>; }
function DataPoint({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) { return <div className={multiline ? "rounded-md border border-border p-3" : ""}><div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div><div className={`mt-1 text-sm ${multiline ? "whitespace-pre-wrap leading-5" : "truncate"}`}>{value}</div></div>; }
function ResultGroup({ title, results }: { title: string; results: AnthroResult[] }) { return <div><h3 className="mb-2 text-sm font-medium">{title}</h3><div className="grid gap-x-6 sm:grid-cols-2">{results.map((result) => <div key={result.label} className="border-b border-border py-2"><div className="flex items-baseline justify-between gap-3 text-sm"><span>{result.label}</span><span className="text-right font-medium tabular-nums">{result.value}</span></div>{result.detail ? <p className="mt-1 text-xs text-muted-foreground">{result.detail}</p> : null}</div>)}</div></div>; }
function ListBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) { return <div><h3 className="mb-2 text-sm font-medium">{title}</h3>{items.length ? <ul className="space-y-2 text-sm">{items.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{item}</li>)}</ul> : <Empty text={empty} />}</div>; }
function RecallTable({ items }: { items: RecallItem[] }) { if (!items.length) return <Empty text="Nenhum recordatório registrado." />; return <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="text-left text-xs text-muted-foreground"><tr className="border-b border-border"><th className="py-2 pr-3 font-medium">Horário</th><th className="py-2 pr-3 font-medium">Alimentos</th><th className="py-2 pr-3 font-medium">Quantidade</th><th className="py-2 font-medium">Preparo / observações</th></tr></thead><tbody className="divide-y divide-border">{items.map((item) => <tr key={item.id}><td className="py-2 pr-3 align-top">{item.time_label || "—"}</td><td className="py-2 pr-3 align-top">{item.foods || "—"}</td><td className="py-2 pr-3 align-top">{item.amount || "—"}</td><td className="py-2 align-top text-muted-foreground">{[item.preparation, item.notes].filter(Boolean).join(" · ") || "—"}</td></tr>)}</tbody></table></div>; }
function MealPlanView({ plan, rationale }: { plan: MealPlan; rationale: string }) {
  return <div className="space-y-5">
    <div className="rounded-lg border border-[#D8E2DC] bg-[#EAF5EE] p-4 print:bg-transparent">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0B5D3B]"><Utensils className="size-4" /> Plano alimentar estruturado</div>
      <div className="grid gap-2 sm:grid-cols-4"><Stat label="Total" value={`${Math.round(plan.totals.kcal)} kcal`} /><Stat label="Proteínas" value={`${plan.totals.protein_g} g`} /><Stat label="Carboidratos" value={`${plan.totals.carb_g} g`} /><Stat label="Gorduras" value={`${plan.totals.fat_g} g`} /></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">{plan.meals.map((meal) => <div key={meal.slot} className="break-inside-avoid overflow-hidden rounded-lg border border-border bg-background"><div className="flex items-center justify-between border-b border-border bg-[#F8FBF9] px-4 py-3 print:bg-transparent"><span className="font-semibold text-[#0B5D3B]">{MEAL_SLOT_LABELS[meal.slot]}</span><span className="text-xs tabular-nums text-muted-foreground">{Math.round(meal.totals.kcal)} kcal</span></div><ul className="divide-y divide-border text-sm">{meal.items.map((item, index) => <li key={`${item.food_id}-${index}`} className="px-4 py-3"><div className="flex items-start justify-between gap-3"><span className="font-medium">{item.name}</span><span className="shrink-0 text-xs tabular-nums text-muted-foreground">{Math.round(item.macros.kcal)} kcal</span></div><div className="mt-1 text-xs text-muted-foreground">{item.grams} g · {item.household_measure}</div>{item.substitutions.length ? <div className="mt-2 text-[11px] leading-4 text-muted-foreground"><span className="font-semibold text-[#0B5D3B]">Substituições:</span> {item.substitutions.map((sub) => `${sub.name} (${sub.grams} g · ${sub.household_measure})`).join(" · ")}</div> : null}</li>)}</ul></div>)}</div>
    {rationale ? <div className="whitespace-pre-wrap rounded-lg border-l-2 border-[#C6A244] bg-[#FFFDF5] p-4 text-sm leading-6 text-muted-foreground print:bg-transparent">{rationale}</div> : null}
    {plan.shopping_list?.length ? <section className="break-inside-avoid rounded-lg border border-border p-4"><h3 className="flex items-center gap-2 font-semibold text-[#0B5D3B]"><ShoppingCart className="size-4" /> Lista de compras</h3><div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">{plan.shopping_list.map((group) => <div key={group.category}><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labelCategory(group.category)}</div><ul className="mt-1 space-y-1 text-sm">{group.items.map((item) => <li key={item.name} className="flex justify-between gap-3"><span>{item.name}</span><span className="tabular-nums text-muted-foreground">{item.grams} g</span></li>)}</ul></div>)}</div></section> : null}
    {plan.recipes?.length ? <section className="break-inside-avoid rounded-lg border border-border p-4"><h3 className="flex items-center gap-2 font-semibold text-[#0B5D3B]"><ChefHat className="size-4" /> Receitas do plano</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{plan.recipes.map((recipe) => <div key={recipe.id} className="rounded-md bg-muted/30 p-3"><div className="font-medium">{recipe.name}</div><div className="mt-1 text-xs text-muted-foreground">{recipe.yield_label} · {recipe.prep_minutes} min · {Math.round(recipe.kcal)} kcal</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{recipe.steps}</p></div>)}</div></section> : null}
  </div>;
}

function labelCategory(category: string) {
  const labels: Record<string, string> = { hortifruti: "Hortifruti", carnes: "Carnes e ovos", laticinios: "Laticínios", mercearia: "Mercearia", temperos: "Temperos", congelados: "Congelados", bebidas: "Bebidas" };
  return labels[category] ?? category;
}
function ReportText({ text }: { text: string }) { return <div className="space-y-3 text-sm leading-6">{text.split(/\r?\n/).map((line, index) => { const trimmed = line.trim(); if (!trimmed) return <div key={`${index}-space`} className="h-1" />; if (trimmed.startsWith("## ")) return <h3 key={index} className="pt-2 text-base font-semibold">{trimmed.slice(3)}</h3>; if (trimmed.startsWith("# ")) return <h2 key={index} className="pt-2 text-xl font-semibold">{trimmed.slice(2)}</h2>; if (trimmed.startsWith("- ")) return <p key={index} className="pl-4 before:mr-2 before:content-['•']">{trimmed.slice(2)}</p>; return <p key={index}>{trimmed}</p>; })}</div>; }
function Empty({ text }: { text: string }) { return <p className="text-sm text-muted-foreground">{text}</p>; }
function labelSex(sex: string | null | undefined) { if (!sex) return "Não informado"; return sex === "feminino" ? "Feminino" : sex === "masculino" ? "Masculino" : sex; }
function humanize(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value: string | null | undefined) { if (!value) return "Não informado"; const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value); return Number.isNaN(date.getTime()) ? "Não informado" : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date); }
function plainText(value: string) { return value.replace(/^#{1,6}\s?/gm, "").replace(/^[-*]\s?/gm, ""); }
