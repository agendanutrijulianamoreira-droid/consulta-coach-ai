const DB_NAME = "cach-ai-transcription";
const DB_VERSION = 1;
const STORE_NAME = "pending-audio-windows";
const CONSULTATION_INDEX = "consultation-id";

export interface PendingAudioWindow {
  id: string;
  consultationId: string;
  offsetSeconds: number;
  createdAt: number;
  attempts: number;
  audio: Blob;
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Armazenamento local indisponível neste navegador."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(STORE_NAME)
        ? request.transaction?.objectStore(STORE_NAME)
        : database.createObjectStore(STORE_NAME, { keyPath: "id" });

      if (store && !store.indexNames.contains(CONSULTATION_INDEX)) {
        store.createIndex(CONSULTATION_INDEX, "consultationId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir armazenamento local."));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Falha no armazenamento local."));
      transaction.onerror = () => reject(transaction.error ?? new Error("Falha no armazenamento local."));
    });
  } finally {
    database.close();
  }
}

export async function savePendingAudioWindow(window: PendingAudioWindow): Promise<void> {
  await withStore("readwrite", (store) => store.put(window));
}

export async function removePendingAudioWindow(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function markPendingAudioAttempt(id: string): Promise<void> {
  const existing = await withStore<PendingAudioWindow | undefined>("readonly", (store) => store.get(id));
  if (!existing) return;
  await savePendingAudioWindow({ ...existing, attempts: existing.attempts + 1 });
}

export async function listPendingAudioWindows(consultationId: string): Promise<PendingAudioWindow[]> {
  const database = await openDatabase();
  try {
    return await new Promise<PendingAudioWindow[]>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index(CONSULTATION_INDEX);
      const request = index.getAll(IDBKeyRange.only(consultationId));
      request.onsuccess = () => {
        const rows = (request.result as PendingAudioWindow[]).sort(
          (a, b) => a.offsetSeconds - b.offsetSeconds || a.createdAt - b.createdAt,
        );
        resolve(rows);
      };
      request.onerror = () => reject(request.error ?? new Error("Falha ao ler áudio pendente."));
    });
  } finally {
    database.close();
  }
}

export async function countPendingAudioWindows(consultationId: string): Promise<number> {
  const database = await openDatabase();
  try {
    return await new Promise<number>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index(CONSULTATION_INDEX);
      const request = index.count(IDBKeyRange.only(consultationId));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Falha ao contar áudios pendentes."));
    });
  } finally {
    database.close();
  }
}
