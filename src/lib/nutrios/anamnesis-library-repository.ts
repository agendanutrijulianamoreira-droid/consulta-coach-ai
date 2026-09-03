import { supabase } from "@/integrations/supabase/client";
import type { AnamnesisFields } from "./types";
import * as db from "./repository";

const FAVORITES_KEY = "favorite_anamneses";
const VERSIONS_KEY = "anamnesis_versions";

export type FavoriteAnamnesis = {
  id: string;
  sourceConsultationId: string;
  name: string;
  fields: AnamnesisFields;
  savedAt: string;
};

export type AnamnesisVersion = {
  id: string;
  fields: AnamnesisFields;
  savedAt: string;
};

export async function listFavoriteAnamneses(): Promise<FavoriteAnamnesis[]> {
  const result = await supabase.from("records").select("consultation_id, sections");
  if (result.error) throw new Error(result.error.message);

  const output: FavoriteAnamnesis[] = [];
  for (const row of result.data ?? []) {
    const sections = (row.sections ?? {}) as Record<string, unknown>;
    for (const item of parseFavorites(sections[FAVORITES_KEY])) {
      output.push({ ...item, sourceConsultationId: item.sourceConsultationId || row.consultation_id });
    }
  }
  return output.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function saveFavoriteAnamnesis(consultationId: string, name: string, fields: AnamnesisFields) {
  const record = await db.getRecord(consultationId);
  const sections = { ...(record.sections ?? {}) };
  const current = parseFavorites(sections[FAVORITES_KEY]);
  const favorite: FavoriteAnamnesis = {
    id: crypto.randomUUID(),
    sourceConsultationId: consultationId,
    name: name.trim() || "Anamnese favorita",
    fields,
    savedAt: new Date().toISOString(),
  };
  sections[FAVORITES_KEY] = JSON.stringify([favorite, ...current]);
  await db.saveRecord(consultationId, sections);
  return favorite;
}

export async function removeFavoriteAnamnesis(favorite: FavoriteAnamnesis) {
  const record = await db.getRecord(favorite.sourceConsultationId);
  const sections = { ...(record.sections ?? {}) };
  const current = parseFavorites(sections[FAVORITES_KEY]);
  sections[FAVORITES_KEY] = JSON.stringify(current.filter((item) => item.id !== favorite.id));
  await db.saveRecord(favorite.sourceConsultationId, sections);
}

export async function archiveAnamnesisVersion(consultationId: string, fields: AnamnesisFields) {
  if (!hasContent(fields)) return;
  const record = await db.getRecord(consultationId);
  const sections = { ...(record.sections ?? {}) };
  const current = parseVersions(sections[VERSIONS_KEY]);
  const version: AnamnesisVersion = { id: crypto.randomUUID(), fields, savedAt: new Date().toISOString() };
  sections[VERSIONS_KEY] = JSON.stringify([version, ...current].slice(0, 20));
  await db.saveRecord(consultationId, sections);
}

export async function listAnamnesisVersions(consultationId: string): Promise<AnamnesisVersion[]> {
  const record = await db.getRecord(consultationId);
  return parseVersions(record.sections?.[VERSIONS_KEY]);
}

function hasContent(fields: AnamnesisFields) {
  return Object.values(fields).some((field) => Boolean(field?.value.trim()));
}

function parseFavorites(value: unknown): FavoriteAnamnesis[] {
  const parsed = parseArray(value);
  return parsed.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Partial<FavoriteAnamnesis>;
    if (!item.id || !item.name || !item.fields) return [];
    return [{
      id: item.id,
      sourceConsultationId: item.sourceConsultationId ?? "",
      name: item.name,
      fields: item.fields,
      savedAt: item.savedAt ?? "",
    }];
  });
}

function parseVersions(value: unknown): AnamnesisVersion[] {
  const parsed = parseArray(value);
  return parsed.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Partial<AnamnesisVersion>;
    if (!item.id || !item.fields) return [];
    return [{ id: item.id, fields: item.fields, savedAt: item.savedAt ?? "" }];
  });
}

function parseArray(value: unknown): unknown[] {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value) as unknown; } catch { return []; }
  }
  return Array.isArray(parsed) ? parsed : [];
}
