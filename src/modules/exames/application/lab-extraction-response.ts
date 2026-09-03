export type RawLabExtraction = {
  collection_date: string | null;
  laboratory_name: string | null;
  results: {
    analyte_name: string;
    analyte_code: string;
    value: number | null;
    value_text: string | null;
    unit: string | null;
    reference_min: number | null;
    reference_max: number | null;
    reference_text: string | null;
  }[];
};

type ResponsePayload = {
  output_text?: unknown;
  output?: unknown;
};

export function extractResponseText(payload: ResponsePayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  if (!Array.isArray(payload.output)) return "";

  const parts: string[] = [];
  for (const item of payload.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const value = part as { type?: unknown; text?: unknown };
      if (value.type === "output_text" && typeof value.text === "string") parts.push(value.text);
    }
  }
  return parts.join("");
}

export function parseLabExtraction(text: string): RawLabExtraction {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("A leitura do exame não retornou uma estrutura válida. Tente novamente ou use uma imagem nítida do laudo.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("A leitura do exame não retornou dados laboratoriais válidos.");
  }

  const candidate = parsed as Partial<RawLabExtraction>;
  const results = Array.isArray(candidate.results)
    ? candidate.results.filter((result) => result && typeof result.analyte_name === "string" && result.analyte_name.trim())
    : [];

  if (!results.length) {
    throw new Error("Nenhum resultado laboratorial foi identificado no arquivo. Confirme se o PDF contém resultados legíveis ou tente enviar imagens das páginas.");
  }

  return {
    collection_date: typeof candidate.collection_date === "string" ? candidate.collection_date : null,
    laboratory_name: typeof candidate.laboratory_name === "string" ? candidate.laboratory_name : null,
    results,
  };
}
