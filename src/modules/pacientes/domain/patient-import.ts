import type { PatientInput } from "@/lib/nutrios/repository";

export type PatientImportRow = PatientInput & {
  row: number;
  errors: string[];
  duplicateKey?: string;
};

export type PatientImportResult = {
  rows: PatientImportRow[];
  valid: PatientImportRow[];
  invalid: PatientImportRow[];
  duplicates: PatientImportRow[];
};

/** CSV parser intentionally accepts comma or semicolon and quoted fields. */
export function parsePatientCsv(csv: string, existing: PatientInput[] = []): PatientImportResult {
  const records = parseCsv(csv);
  const headers = records.shift()?.map(normalizeHeader) ?? [];
  const rows: PatientImportRow[] = [];
  const seen = new Set<string>();
  const existingKeys = new Set(
    existing.flatMap((p) => [key(p.email), key(p.phone)].filter(Boolean)),
  );
  for (const [index, values] of records.entries()) {
    if (values.every((value) => !value.trim())) continue;
    const value = (name: string) => values[headers.indexOf(name)]?.trim() ?? "";
    const name = value("nome") || value("name");
    const email = value("email") || null;
    const phone = value("telefone") || value("phone") || null;
    const duplicateKey = key(email) || key(phone) || undefined;
    const errors: string[] = [];
    if (!name) errors.push("Nome é obrigatório.");
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push("E-mail inválido.");
    if (duplicateKey && (seen.has(duplicateKey) || existingKeys.has(duplicateKey)))
      errors.push("Paciente duplicado.");
    if (duplicateKey) seen.add(duplicateKey);
    rows.push({
      row: index + 2,
      name,
      email,
      phone,
      birth_date: value("nascimento") || value("birth_date") || null,
      sex: value("sexo") || null,
      notes: value("observacoes") || value("notes") || null,
      tags: splitTags(value("tags")),
      errors,
      ...(duplicateKey ? { duplicateKey } : {}),
    });
  }
  return {
    rows,
    valid: rows.filter((row) => !row.errors.length),
    invalid: rows.filter((row) => row.errors.length > 0),
    duplicates: rows.filter((row) => row.errors.includes("Paciente duplicado.")),
  };
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"' && input[i + 1] === '"') {
      field += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && (char === "," || char === ";")) {
      row.push(field);
      field = "";
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .trim();
}
function key(value: string | null | undefined) {
  if (!value) return "";
  return value.includes("@") ? value.trim().toLowerCase() : value.replace(/\D/g, "");
}
function splitTags(value: string) {
  return value
    ? value
        .split(/[|;]/)
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    : [];
}
