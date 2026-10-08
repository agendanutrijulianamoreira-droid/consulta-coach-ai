import { describe, expect, test } from "bun:test";
import { parsePatientCsv } from "./patient-import";

describe("patient CSV import", () => {
  test("validates required fields and duplicate emails", () => {
    const result = parsePatientCsv(
      "Nome,E-mail,Tags\nAna,ana@example.com,retorno|vip\n,invalid,vip\nBruna,ana@example.com,",
    );
    expect(result.valid.length).toBe(1);
    expect(result.invalid.length).toBe(2);
    expect(result.duplicates.length).toBe(1);
    expect(result.valid[0]?.tags).toEqual(["retorno", "vip"]);
  });

  test("accepts semicolon-delimited files and existing patients", () => {
    const result = parsePatientCsv("Nome;Telefone\nCarlos;(11) 99999-0000", [
      { name: "Já existe", phone: "11999990000" },
    ]);
    expect(result.invalid[0]?.errors).toContain("Paciente duplicado.");
  });

  test("checks email and phone independently", () => {
    const result = parsePatientCsv(
      "Nome,E-mail,Telefone\nAna,new@example.com,(11) 99999-0000\nBruna,other@example.com,(11) 99999-0000",
      [{ name: "Já existe", email: "old@example.com", phone: "11999990000" }],
    );
    expect(result.duplicates.length).toBe(2);
    expect(result.valid.length).toBe(0);
  });
});
