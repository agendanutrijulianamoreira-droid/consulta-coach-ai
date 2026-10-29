export const CONDITIONS = [
  { key: "mioma", label: "Mioma" },
  { key: "endometriose", label: "Endometriose" },
  { key: "adenomiose", label: "Adenomiose" },
  { key: "somp", label: "SOMP" },
  { key: "intestino_inflamado", label: "Intestino inflamado" },
  { key: "compulsao", label: "Compulsão" },
  { key: "retencao", label: "Retenção" },
  { key: "fadiga_hormonal", label: "Fadiga hormonal" },
  { key: "outro", label: "Outro" },
] as const;

export type ConditionKey = (typeof CONDITIONS)[number]["key"];

export const CONDITION_LABEL: Record<ConditionKey, string> = CONDITIONS.reduce(
  (acc, c) => ({ ...acc, [c.key]: c.label }),
  {} as Record<ConditionKey, string>,
);

export interface Protocolo {
  id: string;
  title: string;
  conditions: ConditionKey[];
  objetivo: string;
  pilares: string[];
  atencao: string[];
  alimentosSugeridos: string[];
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProtocoloInput = {
  title: string;
  conditions: ConditionKey[];
  objetivo: string;
  pilares: string[];
  atencao: string[];
  alimentosSugeridos: string[];
  observacoes: string | null;
};

/** Texto para a profissional copiar e adaptar — nunca enviado automaticamente. */
export function formatProtocoloAsText(protocolo: Protocolo): string {
  const lines = [`${protocolo.title}`, ""];
  if (protocolo.objetivo.trim()) lines.push(`Objetivo: ${protocolo.objetivo.trim()}`, "");
  if (protocolo.pilares.length) {
    lines.push("Pilares:", ...protocolo.pilares.map((p) => `- ${p}`), "");
  }
  if (protocolo.alimentosSugeridos.length) {
    lines.push(
      "Alimentos do dia a dia sugeridos:",
      ...protocolo.alimentosSugeridos.map((a) => `- ${a}`),
      "",
    );
  }
  if (protocolo.atencao.length) {
    lines.push("Pontos de atenção:", ...protocolo.atencao.map((a) => `- ${a}`), "");
  }
  if (protocolo.observacoes?.trim()) lines.push(`Observações: ${protocolo.observacoes.trim()}`);
  return lines.join("\n").trim();
}
