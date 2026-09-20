import { useDeferredValue, useEffect, useState } from 'react'
import {
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  parseISO,
} from 'date-fns'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Home,
  Landmark,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-react'
import { useFinance } from './store'
import {
  accountBalance,
  currency,
  currentMonth,
  debtProjection,
  today,
  totals,
  uid,
} from './finance'
import {
  Empty,
  FormDialog,
  IconButton,
  MerchantIcon,
  PageTitle,
  Progress,
  SectionTitle,
  Stat,
  TransactionTable,
} from './components'
import { downloadCSV } from './storage'
import type { Bill, Goal, Transaction } from './model'

export function TransactionsPage() {
  const { state, commit, edit, setImporting } = useFinance()
  const [search, setSearch] = useState('')
  const query = useDeferredValue(search)
  const [tab, setTab] = useState(() =>
    sessionStorage.getItem('folio-review') ? 'review' : 'all',
  )
  useEffect(() => {
    sessionStorage.removeItem('folio-review')
  }, [])
  const [account, setAccount] = useState('all')
  const [category, setCategory] = useState('all')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [sort, setSort] = useState('newest')
  const [selection, setSelection] = useState(new Set<string>())
  const [bulkCategory, setBulkCategory] = useState('')
  const [page, setPage] = useState(0)
  const filtered = state.transactions
    .filter(
      (item) =>
        (tab !== 'review' || item.review) &&
        (tab !== 'income' || item.amount > 0) &&
        (tab !== 'expenses' || item.amount < 0) &&
        (account === 'all' || item.accountId === account) &&
        (category === 'all' || item.category === category) &&
        (!start || item.date >= start) &&
        (!end || item.date <= end) &&
        `${item.merchant} ${item.description} ${item.notes}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((first, second) =>
      sort === 'amount'
        ? Math.abs(second.amount) - Math.abs(first.amount)
        : sort === 'oldest'
          ? first.date.localeCompare(second.date)
          : second.date.localeCompare(first.date),
    )
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20))
  const safePage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(safePage * 20, (safePage + 1) * 20)
  const selectedIds = new Set(
    filtered.filter((item) => selection.has(item.id)).map((item) => item.id),
  )
  const summary = totals(filtered)
  const exportRows = () =>
    downloadCSV(
      filtered.map((item) => ({
        Date: item.date,
        Merchant: item.merchant,
        Description: item.description,
        Amount: (item.amount / 100).toFixed(2),
        Currency: state.settings.currency,
        Category:
          state.categories.find((category) => category.id === item.category)
            ?.name || '',
        Account:
          state.accounts.find((account) => account.id === item.accountId)
            ?.name || '',
        Notes: item.notes,
        Deductible: item.deductible,
      })),
      'folio-transactions.csv',
    )
  return (
    <>
      <PageTitle
        eyebrow="THE EVERYDAY DETAILS"
        title="Transactions"
        description="Every coffee, every payday, every little thing in between."
      >
        <button className="button" onClick={exportRows}>
          <Download size={15} />
          Export
        </button>
        <button className="button" onClick={() => setImporting(true)}>
          <Upload size={15} />
          Import
        </button>
        <button className="button primary" onClick={() => edit('transactions')}>
          <Plus size={15} />
          Add transaction
        </button>
      </PageTitle>
      <div className="tabs" role="tablist" aria-label="Transaction view">
        {[
          ['all', 'All transactions'],
          ['expenses', 'Expenses'],
          ['income', 'Income'],
          ['review', 'Needs review'],
        ].map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? 'active' : ''}
            onClick={() => {
              setTab(value)
              setPage(0)
            }}
          >
            {label}
            {value === 'review' && (
              <span>
                {state.transactions.filter((item) => item.review).length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="filter-bar">
        <label className="search-filter">
          <Search size={16} />
          <input
            aria-label="Search transactions"
            placeholder="Search merchant, notes, description..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
          />
        </label>
        <select
          aria-label="Filter account"
          className="filter-select"
          value={account}
          onChange={(event) => {
            setAccount(event.target.value)
            setPage(0)
          }}
        >
          <option value="all">All accounts</option>
          {state.accounts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter category"
          className="filter-select"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value)
            setPage(0)
          }}
        >
          <option value="all">All categories</option>
          {state.categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort transactions"
          className="filter-select"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="amount">Largest amount</option>
        </select>
      </div>
      <div className="date-filter">
        <label>
          From
          <input
            type="date"
            aria-label="From date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            aria-label="To date"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        {(start || end) && (
          <button
            className="text-button"
            onClick={() => {
              setStart('')
              setEnd('')
            }}
          >
            Clear dates
          </button>
        )}
        <span className="spacer" />
        <span>{filtered.length} transactions</span>
        <span className="positive">
          In {currency(summary.income, state.settings.currency)}
        </span>
        <span>Out {currency(summary.spent, state.settings.currency)}</span>
      </div>
      <div className="bulk-bar">
        <label>
          <input
            type="checkbox"
            aria-label="Select visible transactions"
            checked={
              visible.length > 0 &&
              visible.every((item) => selection.has(item.id))
            }
            onChange={(event) =>
              setSelection((previous) => {
                const next = new Set(previous)
                visible.forEach((item) =>
                  event.target.checked
                    ? next.add(item.id)
                    : next.delete(item.id),
                )
                return next
              })
            }
          />
          {selectedIds.size ? `${selectedIds.size} selected` : 'Select page'}
        </label>
        {selectedIds.size > 0 && (
          <>
            <select
              aria-label="Bulk category"
              value={bulkCategory}
              onChange={(event) => setBulkCategory(event.target.value)}
            >
              <option value="">Set category...</option>
              {state.categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              className="button small"
              disabled={!bulkCategory}
              onClick={() => {
                commit((draft) => {
                  draft.transactions.forEach((item) => {
                    if (selectedIds.has(item.id)) {
                      item.category = bulkCategory
                      item.review = bulkCategory === 'uncategorized'
                    }
                  })
                }, `Updated ${selectedIds.size} transaction categories`)
                setSelection(new Set())
              }}
            >
              <Check size={13} />
              Apply
            </button>
            <button
              className="button small"
              onClick={() => {
                commit((draft) => {
                  draft.transactions.forEach((item) => {
                    if (selectedIds.has(item.id)) item.review = false
                  })
                }, `Reviewed ${selectedIds.size} transactions`)
                setSelection(new Set())
              }}
            >
              Mark reviewed
            </button>
            <button
              className="button small danger-text"
              onClick={() => {
                if (
                  confirm(`Delete ${selectedIds.size} selected transactions?`)
                ) {
                  commit((draft) => {
                    draft.transactions = draft.transactions.filter(
                      (item) => !selectedIds.has(item.id),
                    )
                  }, `Deleted ${selectedIds.size} transactions`)
                  setSelection(new Set())
                }
              }}
            >
              Delete
            </button>
          </>
        )}
      </div>
      <div className="section-block">
        <TransactionTable
          transactions={visible}
          selection={selection}
          toggle={(id) =>
            setSelection((previous) => {
              const next = new Set(previous)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
        />
        <div className="pagination">
          <span>
            {filtered.length
              ? `${safePage * 20 + 1}-${Math.min((safePage + 1) * 20, filtered.length)} of ${filtered.length}`
              : '0 transactions'}
          </span>
          <div>
            <IconButton
              label="Previous transaction page"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              <ChevronLeft size={16} />
            </IconButton>
            <span>
              Page {safePage + 1} of {pageCount}
            </span>
            <IconButton
              label="Next transaction page"
              disabled={safePage + 1 >= pageCount}
              onClick={() => setPage(safePage + 1)}
            >
              <ChevronRight size={16} />
            </IconButton>
          </div>
        </div>
      </div>
    </>
  )
}

export function AccountsPage() {
  const { state, edit, commit, setImporting } = useFinance()
  const [transfer, setTransfer] = useState(false)
  const balances = state.accounts.map((account) => ({
    ...account,
    balance: accountBalance(account, state.transactions),
  }))
  const options = state.accounts.map((item) => ({
    value: item.id,
    label: item.name,
  }))
  return (
    <>
      <PageTitle
        eyebrow="ONE CLEAR PICTURE"
        title="Accounts & cards"
        description="The places your money calls home."
      >
        <button
          className="button"
          disabled={state.accounts.length < 2}
          onClick={() => setTransfer(true)}
        >
          <ArrowLeftRight size={15} />
          Transfer
        </button>
        <button className="button primary" onClick={() => edit('accounts')}>
          <Plus size={15} />
          Add account
        </button>
      </PageTitle>
      <div className="stats-grid three">
        <Stat
          title="Cash & savings"
          value={currency(
            balances
              .filter((item) => item.type !== 'Credit card')
              .reduce((sum, item) => sum + item.balance, 0),
            state.settings.currency,
          )}
          note="Current ledger balances"
          icon={<Wallet size={18} />}
          featured
        />
        <Stat
          title="Credit card balances"
          value={currency(
            -balances
              .filter((item) => item.type === 'Credit card')
              .reduce((sum, item) => sum + Math.min(0, item.balance), 0),
            state.settings.currency,
          )}
          note="Outstanding card debt"
          icon={<CreditCard size={18} />}
        />
        <Stat
          title="Accounts tracked"
          value={String(state.accounts.length)}
          note="Manual and statement imports"
          icon={<Landmark size={18} />}
        />
      </div>
      <div className="account-grid">
        {balances.map((account) => (
          <article className="account-card" key={account.id}>
            <div className="record-card-top">
              <span
                className="bank-mark large"
                style={{ background: account.color }}
              >
                {account.bank.slice(0, 1) || 'C'}
              </span>
              <span className="pill">{account.type}</span>
              <IconButton
                label={`Edit ${account.name}`}
                onClick={() => edit('accounts', account)}
              >
                <MoreHorizontal size={19} />
              </IconButton>
            </div>
            <span className="muted account-bank">
              {account.bank || 'Personal account'}
            </span>
            <h2>{account.name}</h2>
            <span className="account-digits">
              •••• {account.last4 || '----'}
            </span>
            <div className="account-balance">
              <span>Current balance</span>
              <strong>
                {currency(account.balance, state.settings.currency)}
              </strong>
            </div>
            <div className="record-card-footer">
              <span>
                {
                  state.transactions.filter(
                    (item) => item.accountId === account.id,
                  ).length
                }{' '}
                transactions
              </span>
              <button
                className="text-button"
                onClick={() => setImporting(true)}
              >
                Import statement
                <ArrowUpRight size={14} />
              </button>
            </div>
          </article>
        ))}
        <button className="add-record-card" onClick={() => edit('accounts')}>
          <Plus size={23} />
          <span>Add another account</span>
        </button>
      </div>
      <p className="footnote">
        <ShieldCheck size={14} />
        No bank login or live connection. Balances reflect your opening balance
        and recorded transactions.
      </p>
      {transfer && (
        <FormDialog
          title="Record an account transfer"
          subtitle="For a payment already made. Both sides are excluded from income and spending."
          fields={[
            { name: 'from', label: 'From account', type: 'select', options },
            { name: 'to', label: 'To account', type: 'select', options },
            { name: 'amount', label: 'Amount', type: 'money', min: 0.01 },
            { name: 'date', label: 'Transfer date', type: 'date' },
          ]}
          initial={{
            from: state.accounts[0]?.id,
            to: state.accounts[1]?.id,
            date: today(),
            amount: 0,
          }}
          onClose={() => setTransfer(false)}
          onSave={(values) => {
            if (values.from === values.to)
              throw new Error('Select two different accounts.')
            if (
              !confirm(
                'Only record this if the transfer is not already in your imported transactions. Continue?',
              )
            )
              throw new Error('Transfer was not recorded.')
            commit((draft) => {
              const base = {
                date: String(values.date),
                merchant: 'Account transfer',
                description: 'Internal account transfer',
                category: 'transfer',
                notes: '',
                review: false,
                deductible: false,
              }
              draft.transactions.push(
                {
                  ...base,
                  id: uid(),
                  amount: -Number(values.amount),
                  accountId: String(values.from),
                },
                {
                  ...base,
                  id: uid(),
                  amount: Number(values.amount),
                  accountId: String(values.to),
                },
              )
            }, 'Recorded an account transfer')
          }}
        />
      )}
    </>
  )
}

export function BudgetsPage() {
  const { state, edit } = useFinance()
  const [month, setMonth] = useState(currentMonth())
  const categories = state.categories.filter(
    (item) => !['salary', 'freelance', 'transfer'].includes(item.id),
  )
  const budget = categories.reduce((sum, item) => sum + item.budget, 0)
  const transactions = state.transactions.filter((item) =>
    item.date.startsWith(month),
  )
  const spent = totals(transactions).spent
  return (
    <>
      <PageTitle
        eyebrow="SPEND WITH INTENTION"
        title="Room for what matters"
        description="A plan for your money, with a little breathing room."
      >
        <input
          className="month-input"
          type="month"
          aria-label="Budget month"
          value={month}
          onChange={(event) => setMonth(event.target.value || currentMonth())}
        />
        <button className="button primary" onClick={() => edit('categories')}>
          <Plus size={15} />
          Add category
        </button>
      </PageTitle>
      <div className="stats-grid three">
        <Stat
          title="Monthly plan"
          value={currency(budget, state.settings.currency)}
          note="Across all spending categories"
          icon={<Target size={18} />}
          featured
        />
        <Stat
          title="Spent so far"
          value={currency(spent, state.settings.currency)}
          note={format(parseISO(`${month}-01`), 'MMMM yyyy')}
          icon={<ArrowUpRight size={18} />}
        />
        <Stat
          title="Available to spend"
          value={currency(budget - spent, state.settings.currency)}
          note={
            spent > budget ? 'Above your monthly plan' : 'A little room to live'
          }
          icon={<Wallet size={18} />}
        />
      </div>
      <div className="record-grid">
        {categories.map((category) => {
          const used = totals(
            transactions.filter((item) => item.category === category.id),
          ).spent
          const percent = category.budget ? (used / category.budget) * 100 : 0
          return (
            <article key={category.id} className="budget-card">
              <div className="record-card-top">
                <span
                  className="category-swatch"
                  style={{
                    background: `${category.color}20`,
                    color: category.color,
                  }}
                >
                  <Target size={19} />
                </span>
                <h3>{category.name}</h3>
                <IconButton
                  label={`Edit ${category.name} budget`}
                  onClick={() => edit('categories', category)}
                >
                  <MoreHorizontal size={18} />
                </IconButton>
              </div>
              <div className="budget-amount">
                <strong>{currency(used, state.settings.currency)}</strong>
                <span>
                  of {currency(category.budget, state.settings.currency)}
                </span>
              </div>
              <Progress
                value={percent}
                color={percent > 100 ? 'var(--danger)' : category.color}
              />
              <div className="budget-card-bottom">
                <span className={percent > 100 ? 'negative' : 'muted'}>
                  {category.budget
                    ? `${currency(Math.abs(category.budget - used), state.settings.currency)} ${percent > 100 ? 'over budget' : 'remaining'}`
                    : 'No budget set'}
                </span>
                <span>{Math.round(percent)}%</span>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}

export function RecurringPage() {
  const { state, edit, commit } = useFinance()
  const [tab, setTab] = useState('All payments')
  const [paying, setPaying] = useState<Bill | null>(null)
  const active = state.bills.filter((item) => item.active)
  const monthly = active.reduce(
    (sum, item) =>
      sum +
      (item.cycle === 'Yearly'
        ? Math.round(item.amount / 12)
        : item.cycle === 'Weekly'
          ? Math.round((item.amount * 52) / 12)
          : item.cycle === 'Once'
            ? 0
            : item.amount),
    0,
  )
  const bills = state.bills
    .filter(
      (item) =>
        tab === 'All payments' ||
        (tab === 'Subscriptions' ? item.kind === 'Subscription' : !item.active),
    )
    .sort((first, second) => first.due.localeCompare(second.due))
  return (
    <>
      <PageTitle
        eyebrow="NO MORE SURPRISES"
        title="Bills & subscriptions"
        description="A little foresight for the things that come around again."
      >
        <button className="button primary" onClick={() => edit('bills')}>
          <Plus size={15} />
          Add payment
        </button>
      </PageTitle>
      <div className="stats-grid three">
        <Stat
          title="Monthly commitments"
          value={currency(monthly, state.settings.currency)}
          note="Weekly & annual payments normalized"
          icon={<CalendarDays size={18} />}
          featured
        />
        <Stat
          title="Subscriptions"
          value={String(
            active.filter((item) => item.kind === 'Subscription').length,
          )}
          note="Active services"
          icon={<CreditCard size={18} />}
        />
        <Stat
          title="Due in the next 7 days"
          value={currency(
            active
              .filter(
                (item) =>
                  differenceInCalendarDays(parseISO(item.due), new Date()) <= 7,
              )
              .reduce((sum, item) => sum + item.amount, 0),
            state.settings.currency,
          )}
          note="Includes overdue payments"
          icon={<ArrowUpRight size={18} />}
        />
      </div>
      <div className="tabs">
        {['All payments', 'Subscriptions', 'Paused'].map((item) => (
          <button
            key={item}
            className={tab === item ? 'active' : ''}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="section-block">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Payment</th>
                <th>Frequency</th>
                <th>Next due</th>
                <th>Account</th>
                <th className="align-right">Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td>
                    <button
                      className="merchant-cell"
                      onClick={() => edit('bills', bill)}
                    >
                      <MerchantIcon name={bill.name} category={bill.category} />
                      <span>
                        <strong>{bill.name}</strong>
                        <small>{bill.kind}</small>
                      </span>
                    </button>
                  </td>
                  <td>{bill.cycle}</td>
                  <td
                    className={
                      bill.active && bill.due < today()
                        ? 'negative nowrap'
                        : 'nowrap'
                    }
                  >
                    {format(parseISO(bill.due), 'MMM d, yyyy')}
                  </td>
                  <td className="muted">
                    {
                      state.accounts.find((item) => item.id === bill.accountId)
                        ?.name
                    }
                  </td>
                  <td className="amount align-right">
                    {currency(bill.amount, state.settings.currency)}
                  </td>
                  <td>
                    <span className={`pill ${bill.active ? 'positive' : ''}`}>
                      {bill.active ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="button small"
                        disabled={!bill.active}
                        onClick={() => setPaying(bill)}
                      >
                        Record paid
                      </button>
                      <IconButton
                        label={
                          bill.active
                            ? `Pause ${bill.name}`
                            : `Resume ${bill.name}`
                        }
                        onClick={() =>
                          commit(
                            (draft) => {
                              const item = draft.bills.find(
                                (item) => item.id === bill.id,
                              )!
                              item.active = !item.active
                            },
                            `${bill.active ? 'Paused' : 'Resumed'} ${bill.name}`,
                          )
                        }
                      >
                        {bill.active ? <Pause size={14} /> : <Play size={14} />}
                      </IconButton>
                      <IconButton
                        label={`Edit ${bill.name}`}
                        onClick={() => edit('bills', bill)}
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
        {!bills.length && (
          <Empty
            text="Add a bill or subscription to get started."
            onClick={() => edit('bills')}
          />
        )}
      </div>
      {paying && (
        <FormDialog
          title={`Record payment: ${paying.name}`}
          subtitle="Records an already-completed payment and moves the reminder to its next due date. It does not pay the provider."
          fields={[
            { name: 'date', label: 'Payment date', type: 'date' },
            { name: 'amount', label: 'Amount paid', type: 'money', min: 0.01 },
            {
              name: 'create',
              label:
                'Also create a bank transaction (only if not already imported)',
              type: 'checkbox',
            },
          ]}
          initial={{ date: today(), amount: paying.amount, create: false }}
          onClose={() => setPaying(null)}
          onSave={(values) =>
            commit((draft) => {
              const bill = draft.bills.find((item) => item.id === paying.id)!
              if (values.create)
                draft.transactions.push({
                  id: uid(),
                  date: String(values.date),
                  amount: -Number(values.amount),
                  accountId: bill.accountId,
                  merchant: bill.name,
                  description: bill.name,
                  category: bill.category,
                  review: false,
                  deductible: false,
                  notes: `Bill due ${bill.due}`,
                  billId: bill.id,
                })
              const due = parseISO(bill.due)
              if (bill.cycle === 'Once') bill.active = false
              else
                bill.due = format(
                  bill.cycle === 'Monthly'
                    ? addMonths(due, 1)
                    : bill.cycle === 'Yearly'
                      ? addYears(due, 1)
                      : addWeeks(due, 1),
                  'yyyy-MM-dd',
                )
            }, `Recorded payment for ${paying.name}`)
          }
        />
      )}
    </>
  )
}

export function GoalsPage() {
  const { state, edit, commit } = useFinance()
  const [fund, setFund] = useState<Goal | null>(null)
  return (
    <>
      <PageTitle
        eyebrow="A FUTURE WORTH PLANNING FOR"
        title="Dream a little. Save a little."
        description="Give your next chapter a head start."
      >
        <button className="button primary" onClick={() => edit('goals')}>
          <Plus size={15} />
          New goal
        </button>
      </PageTitle>
      <div className="goal-grid">
        {state.goals.map((goal) => {
          const percent = goal.target
            ? Math.round((goal.saved / goal.target) * 100)
            : 0
          return (
            <article className="goal-card" key={goal.id}>
              {goal.kind === 'Travel' ? (
                <img
                  className="goal-cover"
                  src="/alpine-lake.jpg"
                  alt="Alpine lake and mountains"
                />
              ) : (
                <div
                  className={`goal-cover goal-cover-icon ${goal.kind === 'Home' ? 'home-cover' : ''}`}
                >
                  {goal.kind === 'Home' ? (
                    <Home size={48} strokeWidth={1} />
                  ) : (
                    <ShieldCheck size={48} strokeWidth={1} />
                  )}
                </div>
              )}
              <div className="goal-body">
                <div className="record-card-top">
                  <span className="pill">{goal.kind}</span>
                  <IconButton
                    label={`Edit ${goal.name}`}
                    onClick={() => edit('goals', goal)}
                  >
                    <MoreHorizontal size={18} />
                  </IconButton>
                </div>
                <h2>{goal.name}</h2>
                <div className="goal-amount">
                  <strong>
                    {currency(goal.saved, state.settings.currency, true)}
                  </strong>
                  <span>
                    of {currency(goal.target, state.settings.currency, true)}
                  </span>
                </div>
                <Progress value={percent} />
                <div className="goal-meta">
                  <span>{percent}% saved</span>
                  <span>{format(parseISO(goal.date), 'MMM yyyy')}</span>
                </div>
                <button
                  className="button full-button"
                  onClick={() => setFund(goal)}
                >
                  <Plus size={14} />
                  Add contribution
                </button>
              </div>
            </article>
          )
        })}
        <button className="add-record-card" onClick={() => edit('goals')}>
          <Target size={28} />
          <span>What are you saving for?</span>
          <small>Create a new goal</small>
        </button>
      </div>
      <p className="footnote">
        Goal allocations are not added to net worth and do not move money
        between accounts.
      </p>
      {fund && (
        <FormDialog
          title={`Add to ${fund.name}`}
          fields={[
            {
              name: 'amount',
              label: 'Contribution amount',
              type: 'money',
              min: 0.01,
            },
          ]}
          initial={{ amount: 0 }}
          onClose={() => setFund(null)}
          onSave={(values) =>
            commit((draft) => {
              draft.goals.find((item) => item.id === fund.id)!.saved += Number(
                values.amount,
              )
            }, `Added a contribution to ${fund.name}`)
          }
        />
      )}
    </>
  )
}

export function WealthPage() {
  const { state, edit } = useFinance()
  const [extra, setExtra] = useState(0)
  const money = (amount: number) => currency(amount, state.settings.currency)
  const assetTotal = state.assets.reduce((sum, item) => sum + item.value, 0)
  const cost = state.assets.reduce((sum, item) => sum + item.cost, 0)
  return (
    <>
      <PageTitle
        eyebrow="PLAY THE LONG GAME"
        title="Investments & debts"
        description="Where you are today, and what you're building toward."
      >
        <button className="button" onClick={() => edit('debts')}>
          <Plus size={15} />
          Add debt
        </button>
        <button className="button primary" onClick={() => edit('assets')}>
          <Plus size={15} />
          Add asset
        </button>
      </PageTitle>
      <div className="stats-grid three">
        <Stat
          title="Asset value"
          value={money(assetTotal)}
          note="Manually recorded valuations"
          icon={<Landmark size={18} />}
          featured
        />
        <Stat
          title="Unrealized gain / loss"
          value={money(assetTotal - cost)}
          note="Current value minus cost basis"
          icon={<TrendingUp size={18} />}
        />
        <Stat
          title="Loan balances"
          value={money(
            state.debts.reduce((sum, item) => sum + item.balance, 0),
          )}
          note="Excludes cards in Accounts"
          icon={<ArrowDownLeft size={18} />}
        />
      </div>
      <section className="section-block spaced-section">
        <SectionTitle
          title="Your portfolio"
          subtitle="Valuations are manual, not live market prices"
        />
        <div className="table-scroll section-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Type</th>
                <th>Cost basis</th>
                <th>Current value</th>
                <th>Gain / loss</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.assets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <strong>{asset.name}</strong>
                  </td>
                  <td>{asset.type}</td>
                  <td>{money(asset.cost)}</td>
                  <td className="amount">{money(asset.value)}</td>
                  <td
                    className={
                      asset.value >= asset.cost ? 'positive' : 'negative'
                    }
                  >
                    {money(asset.value - asset.cost)}
                  </td>
                  <td>
                    <IconButton
                      label={`Edit ${asset.name}`}
                      onClick={() => edit('assets', asset)}
                    >
                      <MoreHorizontal size={17} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!state.assets.length && (
          <Empty
            text="Add an investment, property, or other asset."
            onClick={() => edit('assets')}
          />
        )}
      </section>
      <SectionTitle
        title="A clearer path to debt-free"
        subtitle="Estimates assume fixed APR, monthly interest, and no new charges"
      />
      <label className="debt-slider">
        <span>
          Extra monthly payment per loan <strong>{money(extra)}</strong>
        </span>
        <input
          aria-label="Extra monthly loan payment"
          type="range"
          min="0"
          max="100000"
          step="1000"
          value={extra}
          onChange={(event) => setExtra(Number(event.target.value))}
        />
      </label>
      <div className="record-grid">
        {state.debts.map((debt) => {
          const projection = debtProjection(
            debt.balance,
            debt.apr,
            debt.payment + extra,
          )
          return (
            <article className="budget-card" key={debt.id}>
              <div className="record-card-top">
                <Landmark size={18} />
                <h3>{debt.name}</h3>
                <IconButton
                  label={`Edit ${debt.name}`}
                  onClick={() => edit('debts', debt)}
                >
                  <MoreHorizontal size={18} />
                </IconButton>
              </div>
              <div className="debt-balance">{money(debt.balance)}</div>
              <div className="detail-row">
                <span>Interest rate</span>
                <strong>{debt.apr}% APR</strong>
              </div>
              <div className="detail-row">
                <span>Monthly payment</span>
                <strong>{money(debt.payment + extra)}</strong>
              </div>
              <div className="detail-row">
                <span>Estimated payoff</span>
                <strong>
                  {projection
                    ? `${projection.months} months`
                    : 'Payment too low'}
                </strong>
              </div>
              <div className="detail-row">
                <span>Estimated interest</span>
                <strong>
                  {projection ? money(projection.interest) : 'Not covered'}
                </strong>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}

export function transactionExport(transactions: Transaction[], code: string) {
  return transactions.map((item) => ({
    Date: item.date,
    Merchant: item.merchant,
    Amount: (item.amount / 100).toFixed(2),
    Currency: code,
    Category: item.category,
    Deductible: item.deductible,
    Notes: item.notes,
  }))
}
