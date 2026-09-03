export type MaterialCategory = "lamina" | "orientacao" | "guia" | "ebook";
export type MaterialStatus = "active" | "archived";
export type MaterialFileStorage = "none" | "local" | "supabase";

export type FavoriteMaterial = {
  id: string;
  title: string;
  category: MaterialCategory;
  description: string;
  tags: string[];
  content: string;
  link: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileStorage: MaterialFileStorage;
  filePath: string;
  status: MaterialStatus;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "cach-ai-favorite-materials-v1";

const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function newFavoriteMaterial(category: MaterialCategory = "orientacao"): FavoriteMaterial {
  const now = new Date().toISOString();
  return {
    id: uid(),
    title: "",
    category,
    description: "",
    tags: [],
    content: "",
    link: "",
    fileName: "",
    fileType: "",
    fileSize: 0,
    fileStorage: "none",
    filePath: "",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeMaterial(value: Partial<FavoriteMaterial>): FavoriteMaterial | null {
  if (!value.id || !value.category) return null;
  const now = new Date().toISOString();
  return {
    id: value.id,
    title: value.title ?? "",
    category: value.category,
    description: value.description ?? "",
    tags: Array.isArray(value.tags) ? value.tags : [],
    content: value.content ?? "",
    link: value.link ?? "",
    fileName: value.fileName ?? "",
    fileType: value.fileType ?? "",
    fileSize: typeof value.fileSize === "number" ? value.fileSize : 0,
    fileStorage: value.fileStorage ?? (value.fileName ? "local" : "none"),
    filePath: value.filePath ?? "",
    status: value.status ?? "active",
    createdAt: value.createdAt ?? now,
    updatedAt: value.updatedAt ?? value.createdAt ?? now,
  };
}

export function listFavoriteMaterials(): FavoriteMaterial[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<FavoriteMaterial>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeMaterial).filter((item): item is FavoriteMaterial => item !== null);
  } catch {
    return [];
  }
}

export function saveFavoriteMaterial(material: FavoriteMaterial): FavoriteMaterial[] {
  const items = listFavoriteMaterials();
  const nextMaterial = { ...material, updatedAt: new Date().toISOString() };
  const exists = items.some((item) => item.id === material.id);
  const next = exists
    ? items.map((item) => item.id === material.id ? nextMaterial : item)
    : [nextMaterial, ...items];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function removeFavoriteMaterial(materialId: string): FavoriteMaterial[] {
  const next = listFavoriteMaterials().filter((item) => item.id !== materialId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function materialCategoryLabel(category: MaterialCategory) {
  switch (category) {
    case "lamina": return "Lâmina";
    case "orientacao": return "Orientação";
    case "guia": return "Guia";
    case "ebook": return "E-book";
  }
}
