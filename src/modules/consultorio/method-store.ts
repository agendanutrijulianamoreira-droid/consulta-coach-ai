export type MethodStatus = "draft" | "active" | "archived";

export type MethodMaterial = {
  id: string;
  type: "recipe" | "material";
  label: string;
};

export type MethodPhase = {
  id: string;
  title: string;
  objective: string;
  goals: string[];
  materials: MethodMaterial[];
};

export type ClinicMethod = {
  id: string;
  name: string;
  description: string;
  status: MethodStatus;
  phases: MethodPhase[];
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "cach-ai-clinic-methods-v1";

const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function newPhase(position: number): MethodPhase {
  return {
    id: uid(),
    title: `Fase ${position}`,
    objective: "",
    goals: [],
    materials: [],
  };
}

export function newMethod(): ClinicMethod {
  const now = new Date().toISOString();
  return {
    id: uid(),
    name: "Novo método",
    description: "",
    status: "draft",
    phases: [newPhase(1)],
    createdAt: now,
    updatedAt: now,
  };
}

export function listMethods(): ClinicMethod[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClinicMethod[];
    return Array.isArray(parsed) ? parsed.map(normalizeMethod) : [];
  } catch {
    return [];
  }
}

export function saveMethod(method: ClinicMethod): ClinicMethod[] {
  const methods = listMethods();
  const nextMethod = normalizeMethod({ ...method, updatedAt: new Date().toISOString() });
  const next = upsertMethod(methods, nextMethod);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function normalizeMethod(method: ClinicMethod): ClinicMethod {
  return {
    ...method,
    phases: method.phases.map((phase) => ({
      ...phase,
      materials: phase.materials.filter((item) => item.type === "recipe" || item.type === "material"),
    })),
  };
}

export function upsertMethod(methods: ClinicMethod[], method: ClinicMethod): ClinicMethod[] {
  const index = methods.findIndex((item) => item.id === method.id);
  return index >= 0
    ? methods.map((item) => item.id === method.id ? method : item)
    : [method, ...methods];
}

export function removeMethod(methodId: string): ClinicMethod[] {
  const next = listMethods().filter((item) => item.id !== methodId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
