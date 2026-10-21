// Paste the whole file into DevTools Console at each original WorshipView origin.
// Reads application storage and downloads one JSON file. Never writes storage.
(async () => {
  // Empty preserves the original standalone export. For a hosted church, set its
  // exact prefix from /auth/session, for example boc:u5:c2:. Export one scope at a time.
  const storageNamespace = '';
  const local = {};
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key?.startsWith(storageNamespace + 'church-song-')) local[key] = localStorage.getItem(key);
  }
  const databaseName = storageNamespace + 'church-song-ui';
  let backgrounds = [];
  let databaseStatus = 'absent';
  const available = typeof indexedDB.databases === 'function' ? await indexedDB.databases() : null;
  if (!available || available.some(database => database.name === databaseName)) {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      // Opening a missing database would create it: abort that transaction.
      let absent = false;
      request.onupgradeneeded = () => { absent = true; request.transaction.abort(); };
      request.onerror = () => absent ? resolve(null) : reject(request.error);
      request.onblocked = () => reject(new Error('Database open blocked; export did not change storage.'));
      request.onsuccess = () => resolve(request.result);
    });
    if (database) {
      try {
        databaseStatus = 'present';
        if (database.objectStoreNames.contains('projection-backgrounds')) {
          const records = await new Promise((resolve, reject) => {
            const transaction = database.transaction('projection-backgrounds', 'readonly');
            const request = transaction.objectStore('projection-backgrounds').getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            transaction.onabort = () => reject(transaction.error);
          });
          backgrounds = await Promise.all(records.map(async record => {
            if (!(record.file instanceof Blob)) throw new Error('Background has no readable Blob; retain this browser profile.');
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(record.file);
            });
            return { id: record.id, fileName: record.fileName, mimeType: record.mimeType,
              updatedAt: record.updatedAt, lastModified: record.file.lastModified ?? null,
              blobType: record.file.type, size: record.file.size, dataUrl };
          }));
        }
      } finally { database.close(); }
    }
  }
  const exported = { format: 'boc-browser-preservation', version: 1,
    origin: location.origin, exportedAt: new Date().toISOString(),
    localStorage: local, indexedDB: { name: databaseName, status: databaseStatus, backgrounds } };
  const url = URL.createObjectURL(new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `boc-browser-${location.hostname}-${location.port || 'default'}-${Date.now()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { origin: exported.origin, localStorageKeys: Object.keys(local).length,
    backgrounds: backgrounds.length, databaseStatus, storageChanged: false };
})();
