import { useDeferredValue, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Bell,
  BookOpen,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CreditCard,
  FileStack,
  FolderHeart,
  Gauge,
  Landmark,
  LayoutDashboard,
  ListFilter,
  Menu,
  Moon,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Upload,
  Users,
  Wallet,
  X,
  PanelLeftClose,
  BriefcaseBusiness,
  Repeat2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Page } from './model'
import { LoadWorkspace, useFinance } from './store'
import { IconButton } from './components'
import Dashboard from './Dashboard'
import EntityEditor from './Editor'
import ImportDialog from './ImportDialog'
import {
  AccountsPage,
  BudgetsPage,
  GoalsPage,
  RecurringPage,
  TransactionsPage,
  WealthPage,
} from './FinancePages'
import { DocumentsPage, IncomePage, SharedPage, TaxesPage } from './LifePages'
import {
  ActivityPage,
  ReportsPage,
  RulesPage,
  SettingsPage,
} from './ToolkitPages'
import './workspace.css'
import './pages.css'

const navigation: {
  title: string
  items: { id: Page; label: string; icon: LucideIcon }[]
}[] = [
  {
    title: 'WORKSPACE',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'transactions', label: 'Transactions', icon: ArrowUpRight },
      { id: 'accounts', label: 'Accounts & cards', icon: Wallet },
      { id: 'budgets', label: 'Budgets', icon: ChartNoAxesCombined },
    ],
  },
  {
    title: 'PLAN & GROW',
    items: [
      { id: 'recurring', label: 'Bills & subscriptions', icon: Repeat2 },
      { id: 'goals', label: 'Savings goals', icon: Target },
      { id: 'wealth', label: 'Investments & debts', icon: Landmark },
    ],
  },
  {
    title: 'LIFE & MONEY',
    items: [
      { id: 'shared', label: 'Shared expenses', icon: Users },
      { id: 'income', label: 'Income & timesheets', icon: BriefcaseBusiness },
      { id: 'documents', label: 'Document vault', icon: FolderHeart },
      { id: 'taxes', label: 'Tax center', icon: FileStack },
    ],
  },
  {
    title: 'YOUR TOOLKIT',
    items: [
      { id: 'reports', label: 'Reports & insights', icon: Gauge },
      { id: 'rules', label: 'Category rules', icon: ListFilter },
      { id: 'activity', label: 'Activity log', icon: Activity },
    ],
  },
]

function Workspace() {
  const {
    state,
    page,
    navigate,
    commit,
    saved,
    edit,
    importing,
    setImporting,
  } = useFinance()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifications, setNotifications] = useState(false)
  const [help, setHelp] = useState(false)
  const navItems = navigation.flatMap((group) => group.items)
  const title =
    page === 'settings'
      ? 'Workspace settings'
      : navItems.find((item) => item.id === page)?.label || 'Overview'
  const review = state.transactions.filter((item) => item.review).length
  const results = deferredQuery.trim()
    ? state.transactions
        .filter((item) =>
          `${item.merchant} ${item.description}`
            .toLowerCase()
            .includes(deferredQuery.toLowerCase()),
        )
        .slice(0, 5)
    : []
  const go = (next: Page) => {
    navigate(next)
    setMobileOpen(false)
    setSearchOpen(false)
    setNotifications(false)
  }
  const setTheme = (theme: 'light' | 'dark') => {
    if (theme !== state.settings.theme)
      commit(
        (draft) => {
          draft.settings.theme = theme
        },
        `${theme === 'dark' ? 'Dark' : 'Light'} theme enabled`,
      )
  }
  return (
    <div className="app-layout">
      {mobileOpen && (
        <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <a
          className="brand"
          href="#overview"
          onClick={() => setMobileOpen(false)}
        >
          <span className="brand-symbol">
            <BookOpen size={23} strokeWidth={2.3} />
          </span>
          <span className="brand-word">
            folio<span>.</span>
          </span>
          <span className="brand-tag">PERSONAL FINANCE</span>
        </a>
        <div className="workspace-selector">
          <span className="workspace-avatar">
            {state.settings.name.slice(0, 1)}
          </span>
          <button onClick={() => go('settings')}>
            <strong>Personal workspace</strong>
            <small>
              {state.demo ? 'Your everyday, reimagined' : state.settings.name}
            </small>
            <ChevronDown size={13} />
          </button>
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((group) => (
            <div className="nav-group" key={group.title}>
              <h2>{group.title}</h2>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${page === item.id ? 'active' : ''}`}
                  aria-current={page === item.id ? 'page' : undefined}
                  onClick={() => go(item.id)}
                >
                  <item.icon size={17} strokeWidth={1.7} />
                  <span>{item.label}</span>
                  {item.id === 'transactions' && review > 0 && (
                    <b className="nav-badge">{review}</b>
                  )}
                  {item.id === 'overview' && (
                    <span className="nav-active-dot" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="sidebar-import"
            onClick={() => {
              setImporting(true)
              setMobileOpen(false)
            }}
          >
            <Upload size={17} />
            <span>Import a statement</span>
            <span className="import-plus" aria-hidden="true">+</span>
          </button>
          <button
            className={`nav-item ${page === 'settings' ? 'active' : ''}`}
            onClick={() => go('settings')}
          >
            <Settings2 size={17} />
            <span>Settings & preferences</span>
          </button>
          <div className="local-status">
            <ShieldCheck size={14} />
            <span>
              {saved === 'saved'
                ? 'Saved on this device'
                : saved === 'saving'
                  ? 'Saving changes...'
                  : 'Storage needs attention'}
            </span>
            <span
              className={`status-dot ${saved === 'error' ? 'error-dot' : ''}`}
            />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <IconButton
              label="Open navigation"
              className="mobile-menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </IconButton>
            <IconButton
              label="Go to overview"
              className="desktop-menu"
              onClick={() => go('overview')}
            >
              <PanelLeftClose size={17} />
            </IconButton>
            <span className="breadcrumb-home">My workspace</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={15} />
              <input
                aria-label="Search workspace"
                placeholder="Search anything..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setSearchOpen(false)
                }}
              />
              <span className="search-key">
                <Search size={11} />
              </span>
              {searchOpen && (
                <>
                  <button
                    className="popover-dismiss"
                    aria-label="Close search results"
                    onClick={() => setSearchOpen(false)}
                  />
                  <div className="search-results">
                    <div className="popover-label">
                      {deferredQuery ? 'WORKSPACE RESULTS' : 'JUMP TO'}
                    </div>
                    {navItems
                      .filter((item) =>
                        item.label
                          .toLowerCase()
                          .includes(deferredQuery.toLowerCase()),
                      )
                      .slice(0, 5)
                      .map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            go(item.id)
                            setQuery('')
                          }}
                        >
                          <item.icon size={16} />
                          <span>{item.label}</span>
                          <ChevronRight size={13} />
                        </button>
                      ))}
                    {results.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          edit('transactions', item)
                          setSearchOpen(false)
                          setQuery('')
                        }}
                      >
                        <CreditCard size={16} />
                        <span>
                          {item.merchant}
                          <small>{item.date}</small>
                        </span>
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                    {deferredQuery &&
                      !results.length &&
                      !navItems.some((item) =>
                        item.label
                          .toLowerCase()
                          .includes(deferredQuery.toLowerCase()),
                      ) && (
                        <p className="muted">
                          No matching pages or transactions.
                        </p>
                      )}
                  </div>
                </>
              )}
            </div>
            <div className="theme-toggle" role="group" aria-label="Color theme">
              <IconButton
                label="Light theme"
                className={state.settings.theme === 'light' ? 'selected' : ''}
                onClick={() => setTheme('light')}
              >
                <Sun size={15} />
              </IconButton>
              <IconButton
                label="Dark theme"
                className={state.settings.theme === 'dark' ? 'selected' : ''}
                onClick={() => setTheme('dark')}
              >
                <Moon size={15} />
              </IconButton>
            </div>
            <div className="notifications-wrap">
              <IconButton
                label="Notifications"
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={18} />
                {review > 0 && <i className="notification-dot" />}
              </IconButton>
              {notifications && (
                <div className="notifications-popover">
                  <h3>Your attention, please</h3>
                  <button
                    onClick={() => {
                      sessionStorage.setItem('folio-review', 'true')
                      go('transactions')
                    }}
                  >
                    <Sparkles size={17} />
                    <span>
                      <strong>{review} transactions to review</strong>
                      <small>Keep your categories in order</small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                  <button onClick={() => go('recurring')}>
                    <Repeat2 size={17} />
                    <span>
                      <strong>
                        {state.bills.filter((item) => item.active).length}{' '}
                        upcoming payments
                      </strong>
                      <small>Bills & recurring subscriptions</small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
            <button
              className="profile-avatar"
              title="Profile and settings"
              onClick={() => go('settings')}
            >
              {state.settings.name
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')}
            </button>
          </div>
        </header>
        <main className="main-content" id="main-content" key={page}>
          {page === 'overview' ? (
            <Dashboard />
          ) : page === 'transactions' ? (
            <TransactionsPage />
          ) : page === 'accounts' ? (
            <AccountsPage />
          ) : page === 'budgets' ? (
            <BudgetsPage />
          ) : page === 'recurring' ? (
            <RecurringPage />
          ) : page === 'goals' ? (
            <GoalsPage />
          ) : page === 'wealth' ? (
            <WealthPage />
          ) : page === 'shared' ? (
            <SharedPage />
          ) : page === 'income' ? (
            <IncomePage />
          ) : page === 'documents' ? (
            <DocumentsPage />
          ) : page === 'taxes' ? (
            <TaxesPage />
          ) : page === 'reports' ? (
            <ReportsPage />
          ) : page === 'rules' ? (
            <RulesPage />
          ) : page === 'activity' ? (
            <ActivityPage />
          ) : (
            <SettingsPage />
          )}
        </main>
      </div>
      <button
        className="help-button"
        title="Workspace information"
        aria-label="Workspace information"
        onClick={() => setHelp(!help)}
      >
        <CircleHelp size={19} />
      </button>
      {help && (
        <div className="help-popover">
          <IconButton
            label="Close workspace information"
            onClick={() => setHelp(false)}
          >
            <X size={16} />
          </IconButton>
          <h3>A home for your money.</h3>
          <p>
            Your data is stored in this browser, not uploaded to a server. Keep
            a backup before clearing browser data.
          </p>
          <button
            className="text-button"
            onClick={() => {
              go('settings')
              setHelp(false)
            }}
          >
            Storage & backups
            <ArrowUpRight size={14} />
          </button>
        </div>
      )}
      <EntityEditor />
      {importing && <ImportDialog />}
    </div>
  )
}
export default function App() {
  return (
    <LoadWorkspace>
      <Workspace />
    </LoadWorkspace>
  )
}
