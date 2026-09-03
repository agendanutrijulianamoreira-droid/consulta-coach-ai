const DB_NAME = "cach-ai-favorite-material-files";
const DB_VERSION = 1;
const STORE_NAME = "files";

export const MAX_MATERIAL_FILE_SIZE = 25 * 1024 * 1024;

export type StoredMaterialFile = {
  materialId: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  blob: Blob;
};

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Armazenamento de arquivos não está disponível neste navegador."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "materialId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir o armazenamento local de arquivos."));
  });
}

async function withStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Falha ao acessar o arquivo armazenado."));
      transaction.onerror = () => reject(transaction.error ?? new Error("Falha na transação do arquivo."));
    });
  } finally {
    database.close();
  }
}

export async function saveMaterialFile(materialId: string, file: File): Promise<StoredMaterialFile> {
  if (file.size > MAX_MATERIAL_FILE_SIZE) {
    throw new Error("O arquivo deve ter no máximo 25 MB.");
  }

  const stored: StoredMaterialFile = {
    materialId,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    lastModified: file.lastModified,
    blob: file,
  };

  await withStore("readwrite", (store) => store.put(stored));
  return stored;
}

export async function getMaterialFile(materialId: string): Promise<StoredMaterialFile | null> {
  const result = await withStore<StoredMaterialFile | undefined>("readonly", (store) => store.get(materialId));
  return result ?? null;
}

export async function hasMaterialFile(materialId: string): Promise<boolean> {
  const result = await withStore<IDBValidKey | undefined>("readonly", (store) => store.getKey(materialId));
  return result !== undefined;
}

export async function removeMaterialFile(materialId: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(materialId));
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}
