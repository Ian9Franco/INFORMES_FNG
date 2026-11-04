export const FOLDER_PATH_KEY = 'informe-fng-report-folder'
export const FOLDER_CONNECTED_KEY = 'informe-fng-report-folder-connected'

type FolderWindow = Window & { showDirectoryPicker?: (options?: { mode?: 'readwrite'; id?: string }) => Promise<FileSystemDirectoryHandle> }
type GrantedFolder = FileSystemDirectoryHandle & {
  queryPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState>
  requestPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState>
  entries: () => AsyncIterable<[string, FileSystemHandle]>
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('informes-fng-folder', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('folder')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveFolderHandle(handle: FileSystemDirectoryHandle) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction('folder', 'readwrite').objectStore('folder').put(handle, 'reports')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  db.close()
}

export async function loadFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb()
  const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const request = db.transaction('folder', 'readonly').objectStore('folder').get('reports')
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return handle
}

export function folderPickerAvailable() {
  return typeof window !== 'undefined' && typeof (window as FolderWindow).showDirectoryPicker === 'function'
}

export async function pickReportFolder(): Promise<FileSystemDirectoryHandle> {
  const picker = (window as FolderWindow).showDirectoryPicker
  if (!picker) throw new Error('Este navegador no puede escribir en una carpeta. Usá Chrome.')
  const handle = await picker({ mode: 'readwrite', id: 'informes-fng' })
  await saveFolderHandle(handle)
  return handle
}

const asGranted = (handle: FileSystemDirectoryHandle) => handle as GrantedFolder

export async function folderPermission(handle: FileSystemDirectoryHandle, request: boolean) {
  const folder = asGranted(handle)
  const mode = { mode: 'readwrite' as const }
  if ((await folder.queryPermission(mode)) === 'granted') return true
  return request && (await folder.requestPermission(mode)) === 'granted'
}

export async function listFolderFiles(handle: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = []
  for await (const [name] of asGranted(handle).entries()) names.push(name)
  return names
}

export async function writeFolderFile(handle: FileSystemDirectoryHandle, name: string, bytes: Uint8Array) {
  const file = await handle.getFileHandle(name, { create: true })
  const writable = await file.createWritable()
  await writable.write(bytes as BufferSource)
  await writable.close()
}

export async function deleteFolderFiles(handle: FileSystemDirectoryHandle, names: readonly string[]) {
  for (const name of names) await handle.removeEntry(name)
}
