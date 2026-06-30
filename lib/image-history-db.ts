"use client";

import type { GeneratedImage } from "@/types/image";

const DB_NAME = "ai-image-studio-image-history";
const DB_VERSION = 1;
const STORE_NAME = "images";

type StoredImage = GeneratedImage & {
  storedAt: string;
};

function openImageHistoryDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open image history database."));
  });
}

function runImageTransaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => Promise<T>,
) {
  return new Promise<T>(async (resolve, reject) => {
    let db: IDBDatabase;

    try {
      db = await openImageHistoryDb();
    } catch (error) {
      reject(error);
      return;
    }

    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    transaction.oncomplete = () => db.close();
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error("Image history transaction was aborted."));
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("Image history transaction failed."));
    };

    try {
      const result = await action(store);
      resolve(result);
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

export async function saveImagesToHistory(images: GeneratedImage[]) {
  if (images.length === 0) {
    return;
  }

  await runImageTransaction("readwrite", async (store) => {
    await Promise.all(
      images.map((image) =>
        requestToPromise(
          store.put({
            ...image,
            storedAt: new Date().toISOString(),
          } satisfies StoredImage),
        ),
      ),
    );
  });
}

export async function getImagesFromHistory(ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  return runImageTransaction("readonly", async (store) => {
    const images = await Promise.all(
      ids.map(async (id) => {
        const image = await requestToPromise<StoredImage | undefined>(store.get(id));
        return image || null;
      }),
    );

    return images.filter((image): image is GeneratedImage => Boolean(image));
  });
}

export async function deleteImagesFromHistory(ids: string[]) {
  if (ids.length === 0) {
    return;
  }

  await runImageTransaction("readwrite", async (store) => {
    await Promise.all(ids.map((id) => requestToPromise(store.delete(id))));
  });
}
