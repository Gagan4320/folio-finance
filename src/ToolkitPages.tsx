import { useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Activity,
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpRight,
  Check,
  Download,
  HardDrive,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-react'
import { useFinance } from './store'
import { accountBalance, currency, currentMonth, totals } from './finance'
import {
  Empty,
  FormDialog,
  IconButton,
  MerchantIcon,
  PageTitle,
  Progress,
  SectionTitle,
  Stat,
} from './components'
import { CashFlow, SpendingBreakdown } from './Dashboard'
import {
  downloadCSV,
  exportBackup,
  removeDocuments,
  restoreBackup,
} from './storage'
import { makeState } from './seed'
import { transactionExport } from './FinancePages'

export function ReportsPage() {
  const { state } = useFinance()
  const [month, setMonth] = useState(currentMonth())
  const transactions = state.transactions.filter((item) =>
    item.date.startsWith(month),
  )
  const { income, spent } = totals(transactions)
  const merchantMap = new Map<
    string,
    { name: string; category: string; amount: number; count: number }
  >()
  for (const transaction of transactions.filter(
    (item) => item.amount < 0 && item.category !== 'transfer',
  )) {
    const key = transaction.merchant.toLowerCase()
    const record = merchantMap.get(key) || {
      name: transaction.merchant,
      category: transaction.category,
      amount: 0,
      count: 0,
    }
    record.amount -= transaction.amount
    record.count++
    merchantMap.set(key, record)
  }
  const merchants = [...merchantMap.values()].sort(
    (first, second) => second.amount - first.amount,
  )
  const money = (amount: number) => currency(amount, state.settings.currency)
  const accounts = state.accounts.reduce(
    (sum, item) => sum + accountBalance(item, state.transactions),
    0,
  )
  const assets = state.assets.reduce((sum, item) => sum + item.value, 0)
  const debts = state.debts.reduce((sum, item) => sum + item.balance, 0)
  return (
    <>
      <PageTitle
        eyebrow="STEP BACK. SEE MORE."
        title="Reports & insights"
        description="A little perspective goes a long way."
      >
        <input
          className="month-input"
          type="month"
          aria-label="Report month"
          value={month}
          onChange={(event) => setMonth(event.target.value || currentMonth())}
        />
        <button
          className="button primary"
          onClick={() =>
            downloadCSV(
              transactionExport(transactions, state.settings.currency),
              `folio-report-${month}.csv`,
            )
          }
        >
          <Download size={15} />
          Export report
        </button>
      </PageTitle>
      <div className="stats-grid">
        <Stat
          title="Total income"
          value={money(income)}
          note="Transfers excluded"
          icon={<ArrowDownLeft size={18} />}
          featured
        />
        <Stat
          title="Total spending"
          value={money(spent)}
          note="Transfers excluded"
          icon={<ArrowUpRight size={18} />}
        />
        <Stat
          title="Net cash flow"
          value={money(income - spent)}
          note="Income less spending"
          icon={<TrendingUp size={18} />}
        />
        <Stat
          title="Average transaction"
          value={money(
            merchants.length
              ? Math.round(
                  spent / merchants.reduce((sum, item) => sum + item.count, 0),
                )
              : 0,
          )}
          note="Expense transactions only"
          icon={<Wallet size={18} />}
        />
      </div>
      <div className="dashboard-charts">
        <section className="section-block">
          <SectionTitle
            title="Six-month cash flow"
            subtitle="Recorded income and spending"
          />
          <CashFlow month={month} full />
        </section>
        <section className="section-block">
          <SectionTitle
            title="Spending mix"
            subtitle={format(parseISO(`${month}-01`), 'MMMM yyyy')}
          />
          <SpendingBreakdown month={month} />
        </section>
      </div>
      <div className="split-layout">
        <section className="section-block">
          <SectionTitle
            title="Where you spend most"
            subtitle="Merchants ranked by total spending"
          />
          <div className="merchant-ranking">
            {merchants.slice(0, 8).map((merchant, index) => (
              <div key={merchant.name}>
                <span className="rank">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <MerchantIcon
                  name={merchant.name}
                  category={merchant.category}
                />
                <span className="rank-detail">
                  <strong>{merchant.name}</strong>
                  <Progress
                    value={spent ? (merchant.amount / spent) * 100 : 0}
                  />
                  <small>{merchant.count} transactions</small>
                </span>
                <b>{money(merchant.amount)}</b>
              </div>
            ))}
            {!merchants.length && (
              <Empty text="No spending recorded for this month." />
            )}
          </div>
        </section>
        <section className="section-block">
          <SectionTitle
            title="Your net worth, today"
            subtitle="Current balances, not historical valuations"
          />
          <div className="planning-breakdown">
            <div className="detail-row">
              <span>Accounts, including cards</span>
              <strong>{money(accounts)}</strong>
            </div>
            <div className="detail-row">
              <span>Investments & other assets</span>
              <strong>{money(assets)}</strong>
            </div>
            <div className="detail-row">
              <span>Loans & other debts</span>
              <strong>-{money(debts)}</strong>
            </div>
            <div className="detail-row total-row">
              <span>Total net worth</span>
              <strong>{money(accounts + assets - debts)}</strong>
            </div>
          </div>
          <div className="report-note">
            <ShieldCheck size={19} />
            <p>
              Savings goals and shared balances are not counted as extra assets.
            </p>
          </div>
        </section>
      </div>
    </>
  )
}

export function RulesPage() {
  const { state, edit, commit } = useFinance()
  const [all, setAll] = useState(false)
  const apply = () => {
    const targets = state.transactions.filter(
      (item) =>
        (all || item.review) &&
        state.rules.some((rule) =>
          item.description.toLowerCase().includes(rule.keyword.toLowerCase()),
        ),
    )
    if (
      all &&
      !confirm(
        `Apply rules to ${targets.length} matching transactions, including manually edited categories?`,
      )
    )
      return
    commit((draft) => {
      for (const transaction of draft.transactions)
        if (all || transaction.review) {
          const rule = draft.rules.find((item) =>
            transaction.description
              .toLowerCase()
              .includes(item.keyword.toLowerCase()),
          )
          if (rule) {
            transaction.category = rule.category
            transaction.merchant = rule.merchant || transaction.merchant
            transaction.review = rule.category === 'uncategorized'
          }
        }
    }, `Applied rules to ${targets.length} transactions`)
  }
  const move = (index: number, offset: number) =>
    commit((draft) => {
      const [rule] = draft.rules.splice(index, 1)
      draft.rules.splice(index + offset, 0, rule)
    }, 'Updated category rule priority')
  return (
    <>
      <PageTitle
        eyebrow="A LITTLE LESS REPETITION"
        title="Your money, your rules."
        description="Make the familiar things fall into place."
      >
        <button
          className="button"
          onClick={apply}
          disabled={!state.rules.length}
        >
          <Sparkles size={15} />
          Apply rules
        </button>
        <button className="button primary" onClick={() => edit('rules')}>
          <Plus size={15} />
          New rule
        </button>
      </PageTitle>
      <div className="rules-toolbar">
        <span>
          <Sparkles size={16} />
          First matching rule wins. Custom rules take priority over built-in
          merchant matching.
        </span>
        <label>
          <input
            type="checkbox"
            checked={all}
            onChange={(event) => setAll(event.target.checked)}
          />
          Include already categorized transactions
        </label>
      </div>
      <div className="section-block">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Description contains</th>
                <th>Rename merchant</th>
                <th>Assign category</th>
                <th>Matches</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.rules.map((rule, index) => (
                <tr key={rule.id}>
                  <td className="muted">
                    {String(index + 1).padStart(2, '0')}
                  </td>
                  <td>
                    <code className="rule-keyword">{rule.keyword}</code>
                  </td>
                  <td>
                    {rule.merchant || (
                      <span className="muted">Keep original</span>
                    )}
                  </td>
                  <td>
                    <span className="category-tag">
                      <span
                        style={{
                          background: state.categories.find(
                            (item) => item.id === rule.category,
                          )?.color,
                        }}
                      />
                      {
                        state.categories.find(
                          (item) => item.id === rule.category,
                        )?.name
                      }
                    </span>
                  </td>
                  <td>
                    {
                      state.transactions.filter((item) =>
                        item.description
                          .toLowerCase()
                          .includes(rule.keyword.toLowerCase()),
                      ).length
                    }
                  </td>
                  <td>
                    <div className="row-actions">
                      <IconButton
                        label={`Move ${rule.keyword} up`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp size={15} />
                      </IconButton>
                      <IconButton
                        label={`Move ${rule.keyword} down`}
                        disabled={index === state.rules.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown size={15} />
                      </IconButton>
                      <IconButton
                        label={`Edit rule ${rule.keyword}`}
                        onClick={() => edit('rules', rule)}
                      >
                        <MoreHorizontal size={17} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!state.rules.length && (
          <Empty
            title="A fresh set of rules"
            text="Create a rule for a merchant or statement description."
            onClick={() => edit('rules')}
            action="Create a rule"
          />
        )}
      </div>
      <section className="section-block spaced-section">
        <SectionTitle
          title="Categories"
          subtitle={`${state.categories.length} categories, all yours to organize`}
        />
        <div className="category-management">
          {state.categories.map((category) => (
            <button
              key={category.id}
              onClick={() => edit('categories', category)}
            >
              <span
                className="legend-dot"
                style={{ background: category.color }}
              />
              <span>{category.name}</span>
              <ArrowUpRight size={14} />
            </button>
          ))}
          <button className="text-button" onClick={() => edit('categories')}>
            <Plus size={14} />
            New category
          </button>
        </div>
      </section>
    </>
  )
}

export function ActivityPage() {
  const { state } = useFinance()
  const [search, setSearch] = useState('')
  const filtered = state.activity.filter((item) =>
    item.text.toLowerCase().includes(search.toLowerCase()),
  )
  return (
    <>
      <PageTitle
        eyebrow="THE PAPER TRAIL"
        title="Activity log"
        description="The latest 1,000 changes to your workspace."
      >
        <button
          className="button"
          onClick={() =>
            downloadCSV(
              filtered.map((item) => ({
                Time: item.date,
                Activity: item.text,
              })),
              'folio-activity.csv',
            )
          }
        >
          <Download size={15} />
          Export log
        </button>
      </PageTitle>
      <div className="filter-bar">
        <label className="search-filter">
          <Search size={16} />
          <input
            aria-label="Search activity"
            placeholder="Search activity..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      <section className="section-block">
        <div className="activity-list">
          {filtered.map((item) => (
            <div className="activity-entry" key={item.id}>
              <span className="activity-icon">
                <Activity size={16} />
              </span>
              <div>
                <strong>{item.text}</strong>
                <small>
                  {format(parseISO(item.date), 'MMM d, yyyy · h:mm a')}
                </small>
              </div>
              <span className="pill">Local</span>
            </div>
          ))}
          {!filtered.length && <Empty text="No matching activity yet." />}
        </div>
      </section>
    </>
  )
}

export function SettingsPage() {
  const { state, commit, replace, notify } = useFinance()
  const [name, setName] = useState(state.settings.name)
  const [code, setCode] = useState(state.settings.currency)
  const [order, setOrder] = useState(state.settings.dateOrder)
  const [busy, setBusy] = useState(false)
  const [reset, setReset] = useState(false)
  const restoreRef = useRef<HTMLInputElement>(null)
  const hasMoney =
    state.accounts.length +
      state.transactions.length +
      state.shared.length +
      state.assets.length +
      state.debts.length +
      state.payslips.length +
      state.goals.length >
    0
  const backup = async () => {
    setBusy(true)
    try {
      await exportBackup(state)
      notify('Backup downloaded, including attached documents')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Backup failed.', true)
    } finally {
      setBusy(false)
    }
  }
  const restore = async (file?: File) => {
    if (!file) return
    if (
      !confirm(
        'Replace the entire workspace with this backup? Export your current data first.',
      )
    )
      return
    setBusy(true)
    try {
      const restored = await restoreBackup(file)
      replace(restored)
      setName(restored.settings.name)
      setCode(restored.settings.currency)
      setOrder(restored.settings.dateOrder)
      notify('Workspace and documents restored')
    } catch (error) {
      notify(
        error instanceof Error
          ? `Restore failed: ${error.message.slice(0, 180)}`
          : 'Invalid backup.',
        true,
      )
    } finally {
      setBusy(false)
      if (restoreRef.current) restoreRef.current.value = ''
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="MAKE YOURSELF AT HOME"
        title="Workspace settings"
        description="The little details that make this yours."
      />
      <section className="settings-section">
        <div>
          <h2>Your preferences</h2>
          <p>Personal details and statement defaults.</p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!name.trim()) return
            commit((draft) => {
              draft.settings.name = name.trim()
              if (!hasMoney || draft.demo) draft.settings.currency = code
              draft.settings.dateOrder = order
            }, 'Updated workspace preferences')
          }}
        >
          <div className="form-grid">
            <label className="field">
              <span>Your name</span>
              <input
                required
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Workspace currency</span>
              <select
                disabled={hasMoney && !state.demo}
                value={code}
                onChange={(event) => setCode(event.target.value as typeof code)}
              >
                {['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD'].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <small className="field-hint">
                One currency per workspace. No exchange-rate conversion. Locked
                after adding real records.
              </small>
            </label>
            <label className="field">
              <span>Statement date convention</span>
              <select
                value={order}
                onChange={(event) =>
                  setOrder(event.target.value as typeof order)
                }
              >
                <option value="MDY">Month / day / year</option>
                <option value="DMY">Day / month / year</option>
              </select>
            </label>
            <label className="field">
              <span>Appearance</span>
              <select
                value={state.settings.theme}
                onChange={(event) =>
                  commit((draft) => {
                    draft.settings.theme = event.target.value as
                      'light' | 'dark'
                  }, 'Updated appearance')
                }
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
          </div>
          <button type="submit" className="button primary settings-save">
            <Check size={15} />
            Save preferences
          </button>
        </form>
      </section>
      <section className="settings-section">
        <div>
          <h2>Your data, your control</h2>
          <p>Local storage, portable backups, no bank credentials.</p>
        </div>
        <div className="settings-options">
          <div className="setting-row">
            <span className="setting-icon">
              <Download size={20} />
            </span>
            <div>
              <strong>Export a complete backup</strong>
              <p>
                All records and attached documents in one unencrypted JSON file.
                Store it securely.
              </p>
            </div>
            <button
              className="button"
              disabled={busy}
              onClick={() => void backup()}
            >
              {busy ? 'Working...' : 'Export backup'}
            </button>
          </div>
          <div className="setting-row">
            <span className="setting-icon">
              <Upload size={20} />
            </span>
            <div>
              <strong>Restore a workspace</strong>
              <p>
                Replace this workspace with a validated Folio backup, including
                its documents.
              </p>
            </div>
            <button
              className="button"
              disabled={busy}
              onClick={() => restoreRef.current?.click()}
            >
              Restore backup
            </button>
            <input
              type="file"
              accept=".json"
              aria-label="Restore backup file"
              ref={restoreRef}
              className="sr-only"
              onChange={(event) => void restore(event.target.files?.[0])}
            />
          </div>
          <div className="setting-row">
            <span className="setting-icon">
              <HardDrive size={20} />
            </span>
            <div>
              <strong>Keep storage on this device</strong>
              <p>
                Ask the browser to protect local data from automatic eviction.
                Backups are still essential.
              </p>
            </div>
            <button
              className="button"
              onClick={async () => {
                try {
                  const result = await navigator.storage?.persist?.()
                  notify(
                    result
                      ? 'Persistent storage granted by this browser'
                      : 'Browser did not grant persistence. Keep regular backups.',
                    !result,
                  )
                } catch {
                  notify(
                    'Persistent storage is unavailable in this browser.',
                    true,
                  )
                }
              }}
            >
              Request persistence
            </button>
          </div>
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>{state.demo ? 'Make a fresh start' : 'Reset workspace'}</h2>
          <p>
            {state.demo
              ? 'Leave the sample data behind when you are ready.'
              : 'Permanently clear local financial records.'}
          </p>
        </div>
        <div className="settings-options">
          <div className="setting-row">
            <span className="setting-icon">
              <Sparkles size={20} />
            </span>
            <div>
              <strong>
                {state.demo
                  ? 'Start with your own finances'
                  : 'Clear financial data'}
              </strong>
              <p>
                Deletes all records and attached files. Keeps your theme,
                currency, and default categories.
              </p>
            </div>
            <button
              className="button danger-text"
              onClick={() => setReset(true)}
            >
              {state.demo ? 'Start fresh' : 'Clear workspace'}
            </button>
          </div>
        </div>
      </section>
      <div className="privacy-note">
        <ShieldCheck size={21} />
        <div>
          <strong>Private by architecture, not a cloud vault.</strong>
          <p>
            Folio stores data in IndexedDB on this browser and origin. No
            account, bank sync, cross-device sync, server backup, or app-level
            encryption is included. Anyone with access to this browser profile
            can access your records. A hosted copy remains local to each
            visitor.
          </p>
        </div>
      </div>
      {reset && (
        <FormDialog
          title="Start a fresh workspace"
          subtitle="This permanently removes all current records and documents. Export a backup first. Type RESET to confirm."
          fields={[{ name: 'confirmation', label: 'Confirmation' }]}
          onClose={() => setReset(false)}
          onSave={async (values) => {
            if (values.confirmation !== 'RESET')
              throw new Error('Type RESET exactly to confirm.')
            await removeDocuments(state.documents.map((item) => item.id))
            const next = makeState(false)
            next.settings = {
              ...state.settings,
              name: state.demo ? 'My workspace' : state.settings.name,
            }
            replace(next)
            setName(next.settings.name)
            notify(
              'Fresh workspace ready. Set your preferences and add your first account.',
            )
          }}
        />
      )}
    </>
  )
}
