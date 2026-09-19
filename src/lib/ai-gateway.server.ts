/**
 * Acesso ao Lovable AI Gateway (somente servidor).
 * Todas as chamadas usam a Responses API em streaming e devolvem o texto final,
 * evitando timeouts em gerações longas.
 */

const ENDPOINT = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-5.6-sol";

interface CallOptions {
  instructions: string;
  input: string;
  /** JSON Schema estrito (todo campo em required, additionalProperties false). */
  schema?: { name: string; schema: Record<string, unknown> };
  effort?: "low" | "medium";
}

export async function callAi({ instructions, input, schema, effort = "low" }: CallOptions): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("A integração de IA não está configurada no servidor.");

  const body: Record<string, unknown> = {
    model: MODEL,
    instructions,
    input,
    stream: true,
    reasoning: { effort, summary: "auto" },
  };

  if (schema) {
    body["text"] = {
      format: {
        type: "json_schema",
        name: schema.name,
        strict: true,
        schema: schema.schema,
      },
    };
  }

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    if (response.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (response.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    throw new Error(`Falha na IA (${response.status}): ${detail.slice(0, 300)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as { type?: string; delta?: string; response?: { output_text?: string } };
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          text += event.delta;
        } else if (event.type === "response.completed" && !text && event.response?.output_text) {
          text = event.response.output_text;
        }
      } catch {
        // fragmento incompleto — ignorado
      }
    }
  }

  return text.trim();
}

/** Chamada com saída estruturada; devolve null quando o modelo não produz JSON válido. */
export async function callAiJson<T>(options: CallOptions & { schema: NonNullable<CallOptions["schema"]> }): Promise<T | null> {
  const raw = await callAi(options);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}