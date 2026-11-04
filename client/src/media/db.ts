export type TrackMeta = { id: number; name: string; type: string; size: number; added: number };
const DB = "vxo-media", STORE = "tracks";
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((res, rej) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
}
export const addTrack = (f: File) => tx<IDBValidKey>("readwrite", (s) => s.add({ name: f.name, type: f.type, size: f.size, added: Date.now(), blob: f }));
export const getBlob = (id: number) => tx<{ blob: Blob } | undefined>("readonly", (s) => s.get(id)).then((r) => r?.blob);
export const deleteTrack = (id: number) => tx("readwrite", (s) => s.delete(id));
export const clearTracks = () => tx("readwrite", (s) => s.clear());
export function listTracks(): Promise<TrackMeta[]> {
  return open().then((db) => new Promise((res, rej) => {
    const out: TrackMeta[] = [];
    const req = db.transaction(STORE).objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return res(out);
      const { id, name, type, size, added } = c.value;
      out.push({ id, name, type, size, added });
      c.continue();
    };
    req.onerror = () => rej(req.error);
  }));
}
