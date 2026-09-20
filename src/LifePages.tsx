import { useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  Clock3,
  Download,
  FileText,
  FolderHeart,
  HeartPulse,
  MoreHorizontal,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  Upload,
  Users,
  Wallet,
} from 'lucide-react'
import { useFinance } from './store'
import {
  currency,
  currentMonth,
  groupBalances,
  simplifyDebts,
  today,
  uid,
} from './finance'
import {
  Empty,
  FormDialog,
  IconButton,
  PageTitle,
  SectionTitle,
  Stat,
} from './components'
import {
  downloadBlob,
  downloadCSV,
  loadDocument,
  removeDocuments,
  saveDocument,
} from './storage'
import type { Document } from './model'

export function SharedPage() {
  const { state, edit, commit } = useFinance()
  const [selected, setSelected] = useState(state.groups[0]?.id || '')
  const group =
    state.groups.find((item) => item.id === selected) || state.groups[0]
  const balances = group
    ? groupBalances(group, state.shared, state.settlements)
    : {}
  const transfers = simplifyDebts(balances)
  const money = (amount: number) => currency(amount, state.settings.currency)
  const expenses = state.shared
    .filter((item) => item.groupId === group?.id)
    .sort((first, second) => second.date.localeCompare(first.date))
  const yourTotal = state.groups.reduce(
    (sum, item) =>
      sum + (groupBalances(item, state.shared, state.settlements).You || 0),
    0,
  )
  return (
    <>
      <PageTitle
        eyebrow="GOOD FRIENDS. CLEAR BALANCES."
        title="Shared expenses"
        description="Split the bill, keep the good company."
      >
        <button className="button" onClick={() => edit('groups')}>
          <Users size={15} />
          New group
        </button>
        <button
          className="button primary"
          onClick={() => edit('shared', undefined, group?.id)}
        >
          <Plus size={15} />
          Add expense
        </button>
      </PageTitle>
      <div className="stats-grid three">
        <Stat
          title="Your net balance"
          value={money(yourTotal)}
          note={
            yourTotal >= 0
              ? 'Owed to you across all groups'
              : 'You owe across all groups'
          }
          icon={<Wallet size={18} />}
          featured
        />
        <Stat
          title="Active groups"
          value={String(state.groups.length)}
          note="Friends, trips & everyday life"
          icon={<Users size={18} />}
        />
        <Stat
          title="Shared expenses"
          value={money(
            state.shared.reduce((sum, item) => sum + item.amount, 0),
          )}
          note="Separate from your bank ledger"
          icon={<Receipt size={18} />}
        />
      </div>
      <div className="tabs">
        {state.groups.map((item) => (
          <button
            key={item.id}
            className={group?.id === item.id ? 'active' : ''}
            onClick={() => setSelected(item.id)}
          >
            {item.name}
            <span>{item.members.length}</span>
          </button>
        ))}
      </div>
      {group ? (
        <>
          <div className="split-layout">
            <section className="section-block">
              <SectionTitle
                title={group.name}
                subtitle={group.members.join(', ')}
              >
                <IconButton
                  label="Edit group"
                  onClick={() => edit('groups', group)}
                >
                  <MoreHorizontal size={18} />
                </IconButton>
              </SectionTitle>
              <div className="shared-expense-list">
                {expenses.map((expense) => (
                  <button
                    key={expense.id}
                    className="shared-expense"
                    onClick={() => edit('shared', expense, group.id)}
                  >
                    <span className="shared-date">
                      <strong>{format(parseISO(expense.date), 'dd')}</strong>
                      <small>{format(parseISO(expense.date), 'MMM')}</small>
                    </span>
                    <span>
                      <strong>{expense.name}</strong>
                      <small>
                        {expense.paidBy} paid {money(expense.amount)}
                      </small>
                    </span>
                    <span className="shared-your-share">
                      <strong>{money(expense.shares.You || 0)}</strong>
                      <small>Your share</small>
                    </span>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
                {!expenses.length && (
                  <Empty
                    text="The first shared memory can start here."
                    onClick={() => edit('shared', undefined, group.id)}
                    action="Add expense"
                  />
                )}
              </div>
            </section>
            <section className="section-block">
              <SectionTitle
                title="Settle the little things"
                subtitle="Simplified balances"
              />
              <div className="settlement-list">
                {transfers.map((transfer, index) => (
                  <div key={index} className="settlement">
                    <div>
                      <span className="member-avatar">
                        {transfer.from.slice(0, 1)}
                      </span>
                      <span>
                        <strong>
                          {transfer.from}
                          <ArrowRight size={12} />
                          {transfer.to}
                        </strong>
                        <small>{money(transfer.amount)}</small>
                      </span>
                    </div>
                    <button
                      className="button small"
                      onClick={() => {
                        if (
                          confirm(
                            `Record ${money(transfer.amount)} paid by ${transfer.from} to ${transfer.to}? No money will be sent.`,
                          )
                        )
                          commit((draft) => {
                            draft.settlements.push({
                              id: uid(),
                              groupId: group.id,
                              ...transfer,
                              date: today(),
                            })
                          }, `Recorded settlement from ${transfer.from} to ${transfer.to}`)
                      }}
                    >
                      <Check size={13} />
                      Settle up
                    </button>
                  </div>
                ))}
                {!transfers.length && (
                  <div className="settled-state">
                    <ShieldCheck size={30} />
                    <h3>All square.</h3>
                    <p>No outstanding balances in this group.</p>
                  </div>
                )}
                <button
                  className="text-button"
                  onClick={() => edit('settlements', undefined, group.id)}
                >
                  Record a partial payment
                  <Plus size={13} />
                </button>
              </div>
              <div className="group-balances">
                {Object.entries(balances).map(([member, balance]) => (
                  <div key={member}>
                    <span>{member}</span>
                    <strong className={balance >= 0 ? 'positive' : 'negative'}>
                      {balance >= 0 ? 'Gets back ' : 'Owes '}
                      {money(Math.abs(balance))}
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section className="section-block spaced-section">
            <SectionTitle
              title="Payment history"
              subtitle="Recorded settlements, not bank transfers"
            />
            <div className="table-scroll section-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {state.settlements
                    .filter((item) => item.groupId === group.id)
                    .map((item) => (
                      <tr key={item.id}>
                        <td>{item.date}</td>
                        <td>{item.from}</td>
                        <td>{item.to}</td>
                        <td className="amount">{money(item.amount)}</td>
                        <td>
                          <IconButton
                            label="Edit settlement"
                            onClick={() => edit('settlements', item, group.id)}
                          >
                            <MoreHorizontal size={17} />
                          </IconButton>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <Empty
          title="Make room for your people"
          text="Create a group for housemates, a trip, or dinner with friends."
          onClick={() => edit('groups')}
          action="Create a group"
        />
      )}
    </>
  )
}

export function IncomePage() {
  const { state, edit, commit } = useFinance()
  const [tab, setTab] = useState('Payslips')
  const [month, setMonth] = useState(currentMonth())
  const slips = state.payslips.filter((item) => item.period === month)
  const time = state.timesheets.filter((item) => item.date.startsWith(month))
  const net = slips.reduce(
    (sum, item) => sum + item.gross - item.tax - item.other,
    0,
  )
  const exportRecords = () => {
    if (tab === 'Payslips')
      downloadCSV(
        slips.map((item) => ({
          Employer: item.employer,
          Period: item.period,
          Gross: item.gross / 100,
          Tax: item.tax / 100,
          Deductions: item.other / 100,
          Net: (item.gross - item.tax - item.other) / 100,
          Currency: state.settings.currency,
          Status: item.status,
          Date: item.date,
        })),
        'lekka-payslips.csv',
      )
    else
      downloadCSV(
        time.map((item) => ({
          Date: item.date,
          Project: item.project,
          Hours: item.hours,
          Rate: item.rate / 100,
          Total: Math.round(item.hours * item.rate) / 100,
          Currency: state.settings.currency,
          Status: item.status,
        })),
        'lekka-timesheets.csv',
      )
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR HARD WORK, ACCOUNTED FOR"
        title="Income & timesheets"
        description="Paydays, projects, and everything you put into them."
      >
        <input
          className="month-input"
          aria-label="Income month"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value || currentMonth())}
        />
        <button className="button" onClick={exportRecords}>
          <Download size={15} />
          Export
        </button>
        <button
          className="button primary"
          onClick={() => edit(tab === 'Payslips' ? 'payslips' : 'timesheets')}
        >
          <Plus size={15} />
          {tab === 'Payslips' ? 'Add payslip' : 'Log hours'}
        </button>
      </PageTitle>
      <div className="stats-grid three">
        <Stat
          title="Net pay recorded"
          value={currency(net, state.settings.currency)}
          note={`${slips.filter((item) => item.status === 'Received').length} received, ${slips.filter((item) => item.status === 'Expected').length} expected`}
          icon={<BriefcaseBusiness size={18} />}
          featured
        />
        <Stat
          title="Hours logged"
          value={`${time.reduce((sum, item) => sum + item.hours, 0).toFixed(1)} hrs`}
          note={`${time.filter((item) => item.status === 'Approved').length} approved entries`}
          icon={<Clock3 size={18} />}
        />
        <Stat
          title="Time entry value"
          value={currency(
            time.reduce(
              (sum, item) => sum + Math.round(item.hours * item.rate),
              0,
            ),
            state.settings.currency,
          )}
          note="Estimate, not a salary deposit"
          icon={<ArrowDownLeft size={18} />}
        />
      </div>
      <div className="tabs">
        {['Payslips', 'Timesheets'].map((item) => (
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
            {tab === 'Payslips' ? (
              <>
                <thead>
                  <tr>
                    <th>Employer</th>
                    <th>Pay period</th>
                    <th>Gross pay</th>
                    <th>Tax withheld</th>
                    <th>Other deductions</th>
                    <th>Net pay</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {slips.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.employer}</strong>
                        <small className="cell-secondary">{item.date}</small>
                      </td>
                      <td>{item.period}</td>
                      <td>{currency(item.gross, state.settings.currency)}</td>
                      <td>{currency(item.tax, state.settings.currency)}</td>
                      <td>{currency(item.other, state.settings.currency)}</td>
                      <td className="amount positive">
                        {currency(
                          item.gross - item.tax - item.other,
                          state.settings.currency,
                        )}
                      </td>
                      <td>
                        <span
                          className={`pill ${item.status === 'Received' ? 'positive' : ''}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <IconButton
                          label={`Edit payslip ${item.period}`}
                          onClick={() => edit('payslips', item)}
                        >
                          <MoreHorizontal size={17} />
                        </IconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            ) : (
              <>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Project</th>
                    <th>Hours</th>
                    <th>Rate</th>
                    <th>Value</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {time.map((item) => (
                    <tr key={item.id}>
                      <td className="nowrap">{item.date}</td>
                      <td>{item.project}</td>
                      <td>{item.hours}</td>
                      <td>{currency(item.rate, state.settings.currency)}</td>
                      <td className="amount">
                        {currency(
                          Math.round(item.hours * item.rate),
                          state.settings.currency,
                        )}
                      </td>
                      <td>
                        <select
                          className="inline-select"
                          aria-label={`Status for ${item.project} ${item.date}`}
                          value={item.status}
                          onChange={(event) =>
                            commit((draft) => {
                              draft.timesheets.find(
                                (entry) => entry.id === item.id,
                              )!.status = event.target
                                .value as typeof item.status
                            }, `Updated timesheet status to ${event.target.value}`)
                          }
                        >
                          {['Draft', 'Submitted', 'Approved'].map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <IconButton
                          label={`Edit time entry ${item.date}`}
                          onClick={() => edit('timesheets', item)}
                        >
                          <MoreHorizontal size={17} />
                        </IconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        </div>
        {(tab === 'Payslips' ? !slips.length : !time.length) && (
          <Empty
            text={`No ${tab.toLowerCase()} for this month.`}
            onClick={() => edit(tab === 'Payslips' ? 'payslips' : 'timesheets')}
          />
        )}
      </div>
      <p className="footnote">
        Payroll and timesheet records do not add bank transactions. Import or
        add your salary deposits in Transactions.
      </p>
    </>
  )
}

export function DocumentsPage() {
  const { state, commit, edit, notify } = useFinance()
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('All documents')
  const [uploadKind, setUploadKind] = useState<Document['kind']>('Receipt')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const kinds: Document['kind'][] = [
    'Statement',
    'Receipt',
    'Medical',
    'Tax',
    'Payslip',
    'Other',
  ]
  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    const records: Document[] = []
    try {
      for (const file of Array.from(files)) {
        if (file.size > 15 * 1024 * 1024)
          throw new Error(`${file.name} exceeds 15 MB.`)
        if (!/\.(pdf|csv|png|jpe?g|webp)$/i.test(file.name))
          throw new Error('Choose PDF, CSV, PNG, JPG, or WebP files.')
        const id = uid()
        await saveDocument(id, file)
        records.push({
          id,
          name: file.name,
          mime: file.type || 'application/octet-stream',
          size: file.size,
          kind: uploadKind,
          created: today(),
          hasFile: true,
          year: String(new Date().getFullYear()),
          amount: 0,
          note: '',
        })
      }
      commit(
        (draft) => {
          draft.documents.push(...records)
        },
        `Stored ${records.length} document${records.length > 1 ? 's' : ''} on this device`,
      )
    } catch (error) {
      await removeDocuments(records.map(item => item.id)).catch(() => undefined)
      notify(
        error instanceof Error
          ? error.message
          : 'Could not save the documents.',
        true,
      )
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }
  const download = async (document: Document) => {
    try {
      const blob = await loadDocument(document.id)
      if (!blob) throw new Error('No file is attached to this record.')
      downloadBlob(blob, document.name)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'File unavailable.', true)
    }
  }
  const documents = state.documents
    .filter(
      (item) =>
        (kind === 'All documents' || item.kind === kind) &&
        `${item.name} ${item.note} ${item.year}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((first, second) => second.created.localeCompare(first.created))
  return (
    <>
      <PageTitle
        eyebrow="THE IMPORTANT PAPERWORK"
        title="Everything, in its place."
        description="Statements, medical bills, receipts, and a little peace of mind."
      >
        <select
          className="filter-select"
          aria-label="Document upload type"
          value={uploadKind}
          onChange={(event) =>
            setUploadKind(event.target.value as Document['kind'])
          }
        >
          {kinds.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={15} />
          {busy ? 'Storing...' : 'Upload documents'}
        </button>
        <input
          type="file"
          className="sr-only"
          aria-label="Upload document files"
          accept=".pdf,.csv,.png,.jpg,.jpeg,.webp"
          multiple
          ref={fileRef}
          onChange={(event) => void upload(event.target.files)}
        />
      </PageTitle>
      <div className="document-summary">
        <span className="document-summary-icon">
          <FolderHeart size={28} strokeWidth={1.4} />
        </span>
        <div>
          <strong>
            {state.documents.length} documents, one less thing to worry about.
          </strong>
          <p>
            {(
              state.documents.reduce(
                (sum, item) => sum + (item.hasFile ? item.size : 0),
                0,
              ) /
              1024 /
              1024
            ).toFixed(2)}{' '}
            MB stored locally &middot; 15 MB maximum per file
          </p>
        </div>
        <ShieldCheck size={21} />
      </div>
      <div className="tabs">
        {['All documents', ...kinds].map((item) => (
          <button
            key={item}
            className={kind === item ? 'active' : ''}
            onClick={() => setKind(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="filter-bar">
        <label className="search-filter">
          <Search size={16} />
          <input
            aria-label="Search documents"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search filename, notes, or year..."
          />
        </label>
        <span className="muted result-count">{documents.length} documents</span>
      </div>
      <div className="record-grid">
        {documents.map((document) => (
          <article className="document-card" key={document.id}>
            <div className="record-card-top">
              <span
                className={`document-icon ${document.kind === 'Medical' ? 'red' : document.kind === 'Tax' ? 'lavender' : 'green'}`}
              >
                {document.kind === 'Medical' ? (
                  <HeartPulse size={25} strokeWidth={1.5} />
                ) : (
                  <FileText size={25} strokeWidth={1.5} />
                )}
              </span>
              <span className="pill">{document.kind}</span>
              <IconButton
                label={`Edit ${document.name}`}
                onClick={() => edit('documents', document)}
              >
                <MoreHorizontal size={18} />
              </IconButton>
            </div>
            <h3 title={document.name}>{document.name}</h3>
            <p>
              {format(parseISO(document.created), 'MMM d, yyyy')} &middot;{' '}
              {Math.round(document.size / 1024)} KB
            </p>
            {document.note && <p className="document-note">{document.note}</p>}
            <div className="record-card-footer">
              <span>
                {document.hasFile
                  ? `Tax year ${document.year}`
                  : 'Sample record - no file'}
              </span>
              <IconButton
                label={`Download ${document.name}`}
                disabled={!document.hasFile}
                onClick={() => void download(document)}
              >
                <Download size={16} />
              </IconButton>
            </div>
          </article>
        ))}
      </div>
      {!documents.length && (
        <Empty
          title="A clean slate"
          text="Add receipts, medical bills, or important financial documents."
          onClick={() => fileRef.current?.click()}
          action="Upload documents"
        />
      )}
      <p className="footnote">
        <ShieldCheck size={14} />
        Files stay in this browser. They are not encrypted by the app. Include
        them in a backup before clearing site data.
      </p>
    </>
  )
}

export function TaxesPage() {
  const { state, commit, navigate } = useFinance()
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [planning, setPlanning] = useState(false)
  const slips = state.payslips.filter(
    (item) => item.period.startsWith(year) && item.status === 'Received',
  )
  const transactions = state.transactions.filter((item) =>
    item.date.startsWith(year),
  )
  const gross = slips.reduce((sum, item) => sum + item.gross, 0)
  const withheld = slips.reduce((sum, item) => sum + item.tax, 0)
  const otherIncome = transactions
    .filter(
      (item) =>
        item.amount > 0 && !['salary', 'transfer'].includes(item.category),
    )
    .reduce((sum, item) => sum + item.amount, 0)
  const flagged = transactions.filter(
    (item) =>
      item.deductible && item.amount < 0 && item.category !== 'transfer',
  )
  const deductions = -flagged.reduce((sum, item) => sum + item.amount, 0)
  const reserve =
    Math.round(
      (Math.max(
        0,
        gross + otherIncome - deductions - state.settings.taxAllowance,
      ) *
        state.settings.taxRate) /
        100,
    ) - withheld
  const money = (amount: number) => currency(amount, state.settings.currency)
  const documents = state.documents.filter(
    (item) =>
      item.year === year &&
      ['Tax', 'Medical', 'Payslip', 'Receipt'].includes(item.kind),
  )
  return (
    <>
      <PageTitle
        eyebrow="A CALMER TAX SEASON"
        title="Tax center"
        description="Your records, gathered. Your future self, grateful."
      >
        <select
          className="filter-select"
          aria-label="Tax year"
          value={year}
          onChange={(event) => setYear(event.target.value)}
        >
          {Array.from({ length: 8 }, (_, index) =>
            String(new Date().getFullYear() + 1 - index),
          ).map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button className="button" onClick={() => setPlanning(true)}>
          Planning assumptions
        </button>
        <button
          className="button primary"
          onClick={() =>
            downloadCSV(
              [
                {
                  Type: 'Summary',
                  Description: 'Gross pay from received payslips',
                  Amount: gross / 100,
                  Currency: state.settings.currency,
                },
                {
                  Type: 'Summary',
                  Description: 'Tax withheld',
                  Amount: withheld / 100,
                  Currency: state.settings.currency,
                },
                {
                  Type: 'Summary',
                  Description: 'Other positive income (review classification)',
                  Amount: otherIncome / 100,
                  Currency: state.settings.currency,
                },
                ...flagged.map((item) => ({
                  Type: 'Potential deduction',
                  Description: `${item.date} ${item.merchant}`,
                  Amount: -item.amount / 100,
                  Currency: state.settings.currency,
                })),
              ],
              `lekka-tax-organizer-${year}.csv`,
            )
          }
        >
          <Download size={15} />
          Export organizer
        </button>
      </PageTitle>
      <div className="notice warning">
        Planning organizer only, not tax advice or a tax return. The reserve
        uses your chosen flat effective rate, not jurisdiction-specific
        brackets. Verify deduction eligibility, refunds, transfers, and income
        with a qualified professional.
      </div>
      <div className="stats-grid">
        <Stat
          title="Gross salary recorded"
          value={money(gross)}
          note={`${slips.length} received payslips in ${year}`}
          icon={<BriefcaseBusiness size={18} />}
          featured
        />
        <Stat
          title="Tax withheld"
          value={money(withheld)}
          note="From your payslip records"
          icon={<ShieldCheck size={18} />}
        />
        <Stat
          title="Potential deductions"
          value={money(deductions)}
          note={`${flagged.length} flagged transactions`}
          icon={<Receipt size={18} />}
        />
        <Stat
          title="Planning reserve"
          value={money(Math.max(0, reserve))}
          note={`${state.settings.taxRate}% assumed effective rate`}
          icon={<Wallet size={18} />}
        />
      </div>
      {!slips.length && (
        <div className="notice">
          No received payslips for {year}. Salary is missing from this estimate;
          bank deposits alone do not establish gross taxable pay.
        </div>
      )}
      <div className="split-layout">
        <section className="section-block">
          <SectionTitle
            title="Your preparation checklist"
            subtitle={`Tax year ${year}`}
          />
          <div className="tax-checklist">
            {[
              [
                slips.length > 0,
                'Salary & withholding records',
                `${slips.length} received payslips`,
                'income',
              ],
              [
                flagged.length > 0,
                'Potential deductible expenses',
                `${flagged.length} flagged transactions`,
                'transactions',
              ],
              [
                documents.some((item) => item.kind === 'Medical'),
                'Medical bills & receipts',
                `${documents.filter((item) => item.kind === 'Medical').length} medical records`,
                'documents',
              ],
              [
                documents.some((item) => item.kind === 'Tax'),
                'Tax forms & supporting documents',
                `${documents.filter((item) => item.kind === 'Tax').length} tax documents`,
                'documents',
              ],
            ].map(([done, title, subtitle, page]) => (
              <button
                key={String(title)}
                onClick={() =>
                  navigate(page as 'income' | 'transactions' | 'documents')
                }
              >
                <span className={`check-indicator ${done ? 'done' : ''}`}>
                  {done ? <Check size={13} /> : <Plus size={13} />}
                </span>
                <span>
                  <strong>{String(title)}</strong>
                  <small>{String(subtitle)}</small>
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
        </section>
        <section className="section-block">
          <SectionTitle
            title="Planning breakdown"
            subtitle="Based only on recorded data"
          />
          <div className="planning-breakdown">
            <div className="detail-row">
              <span>Salary gross</span>
              <strong>{money(gross)}</strong>
            </div>
            <div className="detail-row">
              <span>Other positive income</span>
              <strong>{money(otherIncome)}</strong>
            </div>
            <div className="detail-row">
              <span>Flagged expenses</span>
              <strong>-{money(deductions)}</strong>
            </div>
            <div className="detail-row">
              <span>Assumed allowance</span>
              <strong>-{money(state.settings.taxAllowance)}</strong>
            </div>
            <div className="detail-row">
              <span>Withholding already recorded</span>
              <strong>-{money(withheld)}</strong>
            </div>
            <div className="detail-row total-row">
              <span>
                {reserve < 0
                  ? 'Withholding above estimate'
                  : 'Additional reserve estimate'}
              </span>
              <strong>{money(Math.abs(reserve))}</strong>
            </div>
          </div>
        </section>
      </div>
      {planning && (
        <FormDialog
          title="Tax planning assumptions"
          subtitle="These are personal scenario inputs, not official rates or validated tax allowances."
          fields={[
            {
              name: 'rate',
              label: 'Assumed effective tax rate (%)',
              type: 'number',
              min: 0,
              max: 100,
            },
            {
              name: 'allowance',
              label: 'Assumed allowance',
              type: 'money',
              min: 0,
            },
          ]}
          initial={{
            rate: state.settings.taxRate,
            allowance: state.settings.taxAllowance,
          }}
          onClose={() => setPlanning(false)}
          onSave={(values) =>
            commit((draft) => {
              draft.settings.taxRate = Number(values.rate)
              draft.settings.taxAllowance = Number(values.allowance)
            }, 'Updated tax planning assumptions')
          }
        />
      )}
    </>
  )
}
