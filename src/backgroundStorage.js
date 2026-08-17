const DATABASE_NAME = 'church-song-ui'
const DATABASE_VERSION = 1
const STORE_NAME = 'projection-backgrounds'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(
      DATABASE_NAME,
      DATABASE_VERSION
    )

    request.onerror = () => {
      reject(request.error)
    }

    request.onupgradeneeded = () => {
      const database = request.result

      if (
        !database.objectStoreNames.contains(
          STORE_NAME
        )
      ) {
        database.createObjectStore(STORE_NAME, {
          keyPath: 'id',
        })
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }
  })
}

export async function saveBackgroundImage({
  id,
  file,
}) {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      STORE_NAME,
      'readwrite'
    )
    const store = transaction.objectStore(
      STORE_NAME
    )

    transaction.oncomplete = () => {
      resolve({
        id,
        fileName: file.name,
        mimeType: file.type,
      })
    }

    transaction.onerror = () => {
      reject(transaction.error)
    }

    store.put({
      id,
      file,
      fileName: file.name,
      mimeType: file.type,
      updatedAt: Date.now(),
    })
  })
}

export async function loadBackgroundImage(id) {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      STORE_NAME,
      'readonly'
    )
    const store = transaction.objectStore(
      STORE_NAME
    )
    const request = store.get(id)

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve(request.result || null)
    }
  })
}
