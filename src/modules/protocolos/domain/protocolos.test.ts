import { describe, expect, test } from "bun:test";
import { formatProtocoloAsText, type Protocolo } from "./protocolos";

const base: Protocolo = {
  id: "1",
  title: "Protocolo intestino inflamado",
  conditions: ["intestino_inflamado"],
  objetivo: "Reduzir inflamação e melhorar absorção",
  pilares: ["Priorizar fibras solúveis", "Hidratação adequada"],
  atencao: ["Evitar excesso de ultraprocessados"],
  alimentosSugeridos: ["Mandioquinha", "Banana da terra cozida"],
  observacoes: "Ajustar conforme tolerância individual.",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("formatProtocoloAsText", () => {
  test("inclui todas as seções preenchidas na ordem esperada", () => {
    const text = formatProtocoloAsText(base);
    expect(text).toContain("Protocolo intestino inflamado");
    expect(text).toContain("Objetivo: Reduzir inflamação e melhorar absorção");
    expect(text).toContain("- Priorizar fibras solúveis");
    expect(text).toContain("- Mandioquinha");
    expect(text).toContain("- Evitar excesso de ultraprocessados");
    expect(text).toContain("Observações: Ajustar conforme tolerância individual.");
  });

  test("omite seções vazias sem deixar linhas em branco soltas no fim", () => {
    const text = formatProtocoloAsText({
      ...base,
      pilares: [],
      atencao: [],
      alimentosSugeridos: [],
      observacoes: null,
    });
    expect(text.includes("Pilares:")).toBe(false);
    expect(text.includes("Pontos de atenção:")).toBe(false);
    expect(text.includes("Observações:")).toBe(false);
    expect(text.endsWith("absorção")).toBe(true);
  });
});
