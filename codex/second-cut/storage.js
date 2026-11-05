// Existing secure-context installations keep their original localStorage key.
// Without Web Locks, IndexedDB compares and replaces one snapshot atomically.
export function createStorage(key, onChange) {
  const marker = key + '.indexed';
  const ping = key + '.notify';
  let connection;
  const indexed = () => !navigator.locks || localStorage.getItem(marker) === '1';

  function openDatabase() {
    if (!connection) {
      connection = new Promise((resolve, reject) => {
        const request = indexedDB.open(key, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('inventory');
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); connection = undefined; };
          resolve(db);
        };
        request.onerror = () => reject(request.error);
      }).catch(error => { connection = undefined; throw error; });
    }
    return connection;
  }

  async function indexedSnapshot(write) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      // Read-write even on first load: concurrent tabs must migrate the legacy value once.
      const tx = db.transaction('inventory', 'readwrite');
      const store = tx.objectStore('inventory');
      const read = store.get('snapshot');
      let result, failure;
      read.onsuccess = () => {
        try {
          const missing = read.result === undefined;
          const current = missing ? localStorage.getItem(key) : read.result;
          if (write && current !== write.expected) {
            result = false;
          } else if (write) {
            store.put(write.value, 'snapshot');
            result = true;
          } else {
            if (missing) store.put(current, 'snapshot');
            result = current;
          }
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure ?? tx.error ?? Error('Inventory update aborted.'));
    });
  }

  window.addEventListener('storage', event => {
    if ([null, key, ping, marker].includes(event.key)) onChange();
  });
  return {
    async read() {
      if (!indexed()) return localStorage.getItem(key);
      const value = await indexedSnapshot();
      if (localStorage.getItem(marker) !== '1') localStorage.setItem(marker, '1');
      return value;
    },
    async replace(expected, value) {
      if (!indexed()) {
        return navigator.locks.request(key, () => {
          if (localStorage.getItem(key) !== expected) return false;
          localStorage.setItem(key, value);
          return true;
        });
      }
      const saved = await indexedSnapshot({expected, value});
      if (saved) {
        // Notification is best effort. IndexedDB already contains the committed value.
        try { localStorage.setItem(ping, Array.from(crypto.getRandomValues(new Uint32Array(2))).join('-')); }
        catch { /* Other tabs will detect the new snapshot before their next write. */ }
      }
      return saved;
    }
  };
}
