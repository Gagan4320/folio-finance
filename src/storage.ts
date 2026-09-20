import { createStore, delMany, get, promisifyRequest, set } from 'idb-keyval'
import Papa from 'papaparse'
import { z } from 'zod'
import { stateSchema } from './model'
import type { AppState } from './model'
import { validateReferences } from './finance'

const store = createStore('folio-finance', 'workspace')
let writes: Promise<void> = Promise.resolve()
export const loadState = async () => {
  const value = await get('state', store)
  return value ? validateReferences(stateSchema.parse(value)) : null
}
export const saveState = (state: AppState) => {
  writes = writes.catch(() => undefined).then(() => set('state', state, store))
  return writes
}
export const saveDocument = (id: string, file: Blob) =>
  set(`document:${id}`, file, store)
export const loadDocument = (id: string) => get<Blob>(`document:${id}`, store)
export const removeDocuments = (ids: string[]) =>
  delMany(
    ids.map((id) => `document:${id}`),
    store,
  )

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadCSV(
  rows: Record<string, string | number | boolean>[],
  name: string,
) {
  downloadBlob(
    new Blob([Papa.unparse(rows, { escapeFormulae: true })], {
      type: 'text/csv;charset=utf-8',
    }),
    name,
  )
}

export async function exportBackup(state: AppState) {
  const files = []
  for (const document of state.documents.filter((item) => item.hasFile)) {
    const blob = await loadDocument(document.id)
    if (!blob)
      throw new Error(
        `The file ${document.name} is missing. Remove its record or re-upload it before backing up.`,
      )
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    for (let start = 0; start < bytes.length; start += 8192)
      binary += String.fromCharCode(...bytes.subarray(start, start + 8192))
    files.push({ id: document.id, type: blob.type, data: btoa(binary) })
  }
  downloadBlob(
    new Blob([JSON.stringify({ format: 'folio-backup-v1', state, files })], {
      type: 'application/json',
    }),
    `lekka-backup-${new Date().toISOString().slice(0, 10)}.json`,
  )
}

export async function restoreBackup(file: File) {
  if (file.size > 100 * 1024 * 1024)
    throw new Error('Backups must be smaller than 100 MB.')
  const schema = z.object({
    format: z.literal('folio-backup-v1'),
    state: stateSchema,
    files: z.array(
      z.object({ id: z.string(), type: z.string(), data: z.string() }),
    ),
  })
  const parsed = schema.parse(JSON.parse(await file.text()))
  validateReferences(parsed.state)
  const fileIds = new Set(parsed.files.map((item) => item.id))
  if (
    fileIds.size !== parsed.files.length ||
    parsed.state.documents.some((item) => item.hasFile && !fileIds.has(item.id))
  )
    throw new Error('The backup is missing a document or has duplicate files.')
  const entries: [IDBValidKey, unknown][] = parsed.files.map((item) => {
    if (
      !parsed.state.documents.some(
        (document) => document.id === item.id && document.hasFile,
      )
    )
      throw new Error('The backup contains an unexpected file.')
    const bytes = Uint8Array.from(atob(item.data), (character) =>
      character.charCodeAt(0),
    )
    return [`document:${item.id}`, new Blob([bytes], { type: item.type })]
  })
  entries.push(['state', parsed.state])
  await writes.catch(() => undefined)
  await store('readwrite', objectStore => {
    objectStore.clear()
    for (const [key, value] of entries) objectStore.put(value, key)
    return promisifyRequest(objectStore.transaction)
  })
  return parsed.state
}
