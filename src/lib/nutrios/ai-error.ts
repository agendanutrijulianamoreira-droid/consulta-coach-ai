/**
 * Mensagens dos server functions de IA usam sempre o mesmo texto quando
 * LOVABLE_API_KEY está ausente no servidor. Centraliza a tradução para algo
 * acionável, em vez de repetir o `includes(...)` em cada tela que chama IA.
 */
export function describeAiError(error: unknown, fallbackHint?: string): string {
  const message = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
  if (message.includes("não está configurada no servidor")) {
    return fallbackHint ? `IA indisponível neste ambiente. ${fallbackHint}` : "IA indisponível neste ambiente.";
  }
  return message;
}
