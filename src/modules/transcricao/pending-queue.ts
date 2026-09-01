/**
 * Fila local durável para janelas de áudio ainda não confirmadas pelo servidor.
 *
 * Cada trecho é persistido em IndexedDB antes da chamada de transcrição e só é
 * removido depois que a transcrição e o salvamento no Supabase terminam. Assim,
 * uma queda de internet ou recarregamento da página não descarta áudio já captado.
 */

const DB_NAME = "cach-ai-clinical";
const DB_VERSION = 1;
const STORE = "pending-transcription";

export interface PendingTranscription {
  id: string;
  consultationId: string;
  audioBase64: string;
  offsetSeconds: number;
  context: string;
  createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("consultationId", "consultationId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir armazenamento local."));
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, done: (value: T) => void, fail: (error: unknown) => void) => void,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result: T;
    let resolved = false;

    const done = (value: T) => {
      result = value;
      resolved = true;
    };
    const fail = (error: unknown) => reject(error instanceof Error ? error : new Error(String(error)));

    run(store, done, fail);
    tx.oncomplete = () => {
      db.close();
      if (resolved) resolve(result!);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Falha no armazenamento local."));
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("Operação local cancelada."));
    };
  });
}

export async function enqueuePendingTranscription(
  item: Omit<PendingTranscription, "id" | "createdAt">,
): Promise<PendingTranscription> {
  const pending: PendingTranscription = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await transaction<void>("readwrite", (store, done, fail) => {
    const request = store.put(pending);
    request.onsuccess = () => done();
    request.onerror = () => fail(request.error);
  });
  return pending;
}

export async function removePendingTranscription(id: string): Promise<void> {
  await transaction<void>("readwrite", (store, done, fail) => {
    const request = store.delete(id);
    request.onsuccess = () => done();
    request.onerror = () => fail(request.error);
  });
}

export async function listPendingTranscriptions(
  consultationId: string,
): Promise<PendingTranscription[]> {
  return transaction<PendingTranscription[]>("readonly", (store, done, fail) => {
    const index = store.index("consultationId");
    const request = index.getAll(IDBKeyRange.only(consultationId));
    request.onsuccess = () => {
      const rows = (request.result as PendingTranscription[]).sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );
      done(rows);
    };
    request.onerror = () => fail(request.error);
  });
}
