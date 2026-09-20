import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { stateSchema } from './model'
import type { AppState, Collection, Page } from './model'
import { uid, validateReferences } from './finance'
import { loadState, saveState } from './storage'
import { makeState } from './seed'

export type EditorRequest = {
  collection: Collection
  record?: Record<string, unknown>
  groupId?: string
}
type FinanceContext = {
  state: AppState
  commit: (recipe: (draft: AppState) => void, message: string) => void
  replace: (next: AppState) => void
  notify: (message: string, error?: boolean) => void
  page: Page
  navigate: (page: Page) => void
  edit: (collection: Collection, record?: object, groupId?: string) => void
  editor: EditorRequest | null
  closeEditor: () => void
  importing: boolean
  setImporting: (value: boolean) => void
  saved: 'saving' | 'saved' | 'error'
}
const Context = createContext<FinanceContext | null>(null)
export function useFinance() {
  const context = useContext(Context)
  if (!context) throw new Error('Finance workspace not loaded.')
  return context
}
const pages: Page[] = [
  'overview',
  'transactions',
  'accounts',
  'budgets',
  'recurring',
  'shared',
  'income',
  'goals',
  'wealth',
  'documents',
  'taxes',
  'reports',
  'rules',
  'activity',
  'settings',
]
const hashPage = () => {
  const page = window.location.hash.slice(1) as Page
  return pages.includes(page) ? page : 'overview'
}

export function WorkspaceProvider({
  initial,
  children,
}: {
  initial: AppState
  children: ReactNode
}) {
  const [state, setState] = useState(initial)
  const [page, setPage] = useState<Page>(hashPage)
  const [saved, setSaved] = useState<'saving' | 'saved' | 'error'>('saved')
  const [toast, setToast] = useState<{
    message: string
    error: boolean
  } | null>(null)
  const [editor, setEditor] = useState<EditorRequest | null>(null)
  const [importing, setImporting] = useState(false)
  useEffect(() => {
    let active = true
    saveState(state)
      .then(() => {
        if (active) setSaved('saved')
      })
      .catch(() => {
        if (active) {
          setSaved('error')
          setToast({
            message:
              'Storage failed. Export a backup now; recent changes may not survive a reload.',
            error: true,
          })
        }
      })
    return () => {
      active = false
    }
  }, [state])
  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme
  }, [state.settings.theme])
  useEffect(() => {
    const handler = () => setPage(hashPage())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), toast.error ? 12000 : 4200)
    return () => clearTimeout(timer)
  }, [toast])
  const notify = (message: string, error = false) =>
    setToast({ message, error })
  const commit = (recipe: (draft: AppState) => void, message: string) => {
    const next = structuredClone(state)
    recipe(next)
    validateReferences(stateSchema.parse(next))
    next.activity = [
      { id: uid(), date: new Date().toISOString(), text: message },
      ...next.activity,
    ].slice(0, 1000)
    setSaved('saving')
    setState(next)
    notify(message)
  }
  return (
    <Context.Provider
      value={{
        state,
        commit,
        replace: (next) => {
          setSaved('saving')
          setState(next)
        },
        notify,
        page,
        navigate: (next) => {
          window.location.hash = next
          setPage(next)
          window.scrollTo({ top: 0 })
        },
        edit: (collection, record, groupId) =>
          setEditor({
            collection,
            record: record as Record<string, unknown> | undefined,
            groupId,
          }),
        editor,
        closeEditor: () => setEditor(null),
        importing,
        setImporting,
        saved,
      }}
    >
      {children}
      {toast && (
        <div
          className={`toast ${toast.error ? 'toast-error' : ''}`}
          role={toast.error ? 'alert' : 'status'}
        >
          <span className="status-dot" />
          {toast.message}
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        </div>
      )}
    </Context.Provider>
  )
}

export function LoadWorkspace({ children }: { children: ReactNode }) {
  const [initial, setInitial] = useState<AppState | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    loadState()
      .then((value) => setInitial(value || makeState()))
      .catch(() =>
        setError(
          'Your saved workspace could not be loaded. Nothing has been overwritten. Check that browser storage is allowed, then reload.',
        ),
      )
  }, [])
  if (error)
    return (
      <main className="boot">
        <h1>Workspace unavailable</h1>
        <p>{error}</p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload workspace
        </button>
      </main>
    )
  if (!initial)
    return (
      <main className="boot">
        <span className="brand-word">
          lekka<span>.</span>
        </span>
        <p>Opening your workspace...</p>
      </main>
    )
  return <WorkspaceProvider initial={initial}>{children}</WorkspaceProvider>
}
