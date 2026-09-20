import { useRef, useState } from 'react'
import {
  Check,
  ChevronRight,
  FileCheck2,
  FileText,
  Landmark,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { useFinance } from './store'
import { currency, fingerprint, parseMoney, today, uid } from './finance'
import { guessColumns, parseRows, readStatement } from './importer'
import type { ColumnMap, Statement } from './importer'
import type { Account, Transaction } from './model'
import { Modal } from './components'
import { downloadBlob, saveDocument } from './storage'

export default function ImportDialog() {
  const { state, commit, notify, setImporting, navigate } = useFinance()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [statement, setStatement] = useState<Statement | null>(null)
  const [mapping, setMapping] = useState<ColumnMap>({
    date: -1,
    description: -1,
    amount: -1,
    debit: -1,
    credit: -1,
  })
  const [mode, setMode] = useState('signed')
  const [accountId, setAccountId] = useState('')
  const [newAccountId] = useState(uid)
  const [accountName, setAccountName] = useState('')
  const [bank, setBank] = useState('')
  const [last4, setLast4] = useState('')
  const [accountType, setAccountType] = useState<Account['type']>('Checking')
  const [opening, setOpening] = useState('0.00')
  const [dateOrder, setDateOrder] = useState(state.settings.dateOrder)
  const [year, setYear] = useState(new Date().getFullYear())
  const [statementCurrency, setStatementCurrency] = useState<string>(
    state.settings.currency,
  )
  const [positiveCharges, setPositiveCharges] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [skipped, setSkipped] = useState<{ row: number; reason: string }[]>([])
  const [included, setIncluded] = useState(new Set<string>())
  const [duplicates, setDuplicates] = useState(new Set<string>())
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [archive, setArchive] = useState(true)
  const [verified, setVerified] = useState(false)
  const sample = `Chase account ending in 4829 (${state.settings.currency})\nDate,Description,Amount\n${today()},AMZN Marketplace,-42.50\n${today()},Whole Foods Market,-68.24\n${today()},UNKNOWN SHOP 829,-19.99\n${today()},Acme payroll,3200.00`
  const choose = async (next: File) => {
    setBusy(true)
    setError('')
    try {
      const result = await readStatement(next)
      if (result.rows.length > 10000)
        throw new Error(
          'Split statements with more than 10,000 rows into smaller files.',
        )
      const columns = guessColumns(result.headers)
      setFile(next)
      setStatement(result)
      setMapping(columns)
      setMode(columns.debit >= 0 || columns.credit >= 0 ? 'columns' : 'signed')
      setBank(result.bank)
      setLast4(result.last4)
      setAccountName(
        result.bank ? `${result.bank} account` : 'Imported account',
      )
      const matches = state.accounts.filter(
        (account) =>
          result.last4 &&
          account.last4 === result.last4 &&
          (!result.bank ||
            account.bank.toLowerCase() === result.bank.toLowerCase()),
      )
      setAccountId(
        matches.length === 1
          ? matches[0].id
          : state.accounts.length
            ? ''
            : 'new',
      )
      const detectedCurrency = result.text.match(
        /\b(USD|INR|EUR|GBP|CAD|AUD)\b/,
      )?.[1]
      setStatementCurrency(detectedCurrency || state.settings.currency)
      setStep(2)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to read this statement.',
      )
    } finally {
      setBusy(false)
    }
  }
  const preview = () => {
    setError('')
    if (!statement || !accountId) {
      setError('Select an account or create a new one.')
      return
    }
    if (statementCurrency !== state.settings.currency) {
      setError(
        `This workspace is in ${state.settings.currency}. Foreign-currency amounts cannot be imported without conversion. Use a matching-currency export or a separate workspace.`,
      )
      return
    }
    if (
      accountId === 'new' &&
      (!accountName.trim() ||
        !/^\d{0,4}$/.test(last4) ||
        parseMoney(opening) === null)
    ) {
      setError(
        'Enter an account name, up to four ending digits, and a valid opening balance.',
      )
      return
    }
    if (
      mapping.date < 0 ||
      mapping.description < 0 ||
      (mode === 'signed'
        ? mapping.amount < 0
        : mapping.debit < 0 && mapping.credit < 0)
    ) {
      setError('Map a date, description, and amount column.')
      return
    }
    const chosen = [
      mapping.date,
      mapping.description,
      ...(mode === 'signed'
        ? [mapping.amount]
        : [mapping.debit, mapping.credit].filter((index) => index >= 0)),
    ]
    if (new Set(chosen).size !== chosen.length) {
      setError('Each mapped column must be different.')
      return
    }
    if (year < 1900 || year > 2200 || !Number.isInteger(year)) {
      setError('Enter a valid statement year.')
      return
    }
    const result = parseRows(
      statement,
      {
        ...mapping,
        debit: mode === 'columns' ? mapping.debit : -1,
        credit: mode === 'columns' ? mapping.credit : -1,
      },
      state.rules,
      accountId === 'new' ? newAccountId : accountId,
      dateOrder,
      positiveCharges,
      year,
    )
    const seen = new Set(state.transactions.map(fingerprint))
    for (const transaction of result.transactions) {
      if (!state.categories.some(category => category.id === transaction.category)) {
        transaction.category = 'uncategorized'
        transaction.review = true
      }
    }
    const duplicateIds = new Set<string>()
    for (const transaction of result.transactions) {
      const key = fingerprint(transaction)
      if (seen.has(key)) duplicateIds.add(transaction.id)
      seen.add(key)
    }
    setTransactions(result.transactions)
    setSkipped(result.skipped)
    setDuplicates(duplicateIds)
    setIncluded(
      new Set(
        result.transactions
          .filter((item) => !duplicateIds.has(item.id))
          .map((item) => item.id),
      ),
    )
    setVerified(false)
    setStep(3)
  }
  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const selected = transactions.filter((item) => included.has(item.id))
      if (!verified || !selected.length)
        throw new Error(
          'Select at least one transaction and confirm your review.',
        )
      if (
        selected.some(
          (item) =>
            !item.date ||
            !item.merchant.trim() ||
            !Number.isSafeInteger(item.amount) ||
            item.amount === 0,
        )
      )
        throw new Error(
          'Each selected row needs a date, merchant, and valid nonzero amount.',
        )
      if (
        selected.some((item) => duplicates.has(item.id)) &&
        !confirm(
          'Some selected rows are possible duplicates. Import them anyway?',
        )
      ) {
        setBusy(false)
        return
      }
      const documentId = uid()
      if (archive && file) await saveDocument(documentId, file)
      commit(
        (draft) => {
          if (accountId === 'new')
            draft.accounts.push({
              id: newAccountId,
              name: accountName.trim(),
              bank: bank.trim(),
              last4,
              type: accountType,
              opening: parseMoney(opening)!,
              color: '#26745b',
            })
          draft.transactions.push(...selected)
          if (archive && file)
            draft.documents.push({
              id: documentId,
              name: file.name,
              mime: file.type || 'application/octet-stream',
              size: file.size,
              kind: 'Statement',
              created: today(),
              hasFile: true,
              year: String(year),
              amount: 0,
              note: `Imported ${selected.length} transactions; ${skipped.length} rows skipped.`,
            })
        },
        `Imported ${selected.length} transactions from ${file?.name || 'statement'}; ${skipped.length} rows skipped`,
      )
      setImporting(false)
      navigate('transactions')
      notify(
        `Imported ${selected.length} transactions. ${selected.filter((item) => item.review).length} need review.`,
      )
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Import failed. Your ledger has not been changed.',
      )
    } finally {
      setBusy(false)
    }
  }
  const update = (id: string, changes: Partial<Transaction>) =>
    setTransactions((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    )
  return (
    <Modal
      title="A new piece of your money story."
      subtitle="Import a bank or card statement"
      onClose={() => {
        if (!busy) setImporting(false)
      }}
      wide={step === 3}
    >
      <div className="import-steps">
        {['Upload', 'Match & map', 'Review & import'].map((label, index) => (
          <span
            key={label}
            className={
              step === index + 1 ? 'active' : step > index + 1 ? 'complete' : ''
            }
          >
            <b>{step > index + 1 ? <Check size={12} /> : index + 1}</b>
            {label}
            {index < 2 && <ChevronRight size={12} />}
          </span>
        ))}
      </div>
      {state.demo && (
        <div className="notice warning">
          You are in the demo workspace. Before importing real finances, use
          Settings &gt; Start fresh to remove the sample data.
        </div>
      )}
      {step === 1 && (
        <>
          <button
            className={`upload-zone ${busy ? 'upload-busy' : ''}`}
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const next = event.dataTransfer.files[0]
              if (next && !busy) void choose(next)
            }}
          >
            <span className="upload-icon">
              <Upload size={25} strokeWidth={1.5} />
            </span>
            <strong>
              {busy ? 'Reading your statement...' : 'Drop your statement here'}
            </strong>
            <span>or choose a file</span>
            <small>CSV or text-based PDF &middot; up to 15 MB</small>
          </button>
          <input
            type="file"
            className="sr-only"
            ref={fileRef}
            aria-label="Choose statement file"
            accept=".csv,.pdf"
            onChange={(event) => {
              const next = event.target.files?.[0]
              if (next) void choose(next)
            }}
          />
          <div className="import-privacy">
            <ShieldCheck size={16} />
            <span>
              Processed on your device. No statement is sent to a server.
            </span>
          </div>
          <div className="sample-actions">
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                void choose(
                  new File([sample], 'sample-chase-statement.csv', {
                    type: 'text/csv',
                  }),
                )
              }
            >
              <FileText size={14} />
              Try a sample statement
            </button>
            <button
              className="text-button"
              onClick={() =>
                downloadBlob(
                  new Blob([sample], { type: 'text/csv' }),
                  'folio-sample-statement.csv',
                )
              }
            >
              Download sample CSV
            </button>
          </div>
          <p className="footnote">
            Scanned or password-protected PDFs need a bank CSV export. Any PDF
            can still be stored in the document vault.
          </p>
        </>
      )}
      {step === 2 && statement && (
        <>
          <div className="detected-account">
            <Landmark size={23} />
            <div>
              <strong>
                {statement.bank || 'Institution not detected'}
                {statement.last4 ? ` · ending ${statement.last4}` : ''}
              </strong>
              <p>
                {file?.name} &middot; {statement.rows.length} source rows
              </p>
            </div>
          </div>
          <div className="form-grid">
            <label className="field full-width">
              <span>Destination account</span>
              <select
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                <option value="">Choose an account...</option>
                {state.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.bank} - {account.name}{' '}
                    {account.last4 ? `(${account.last4})` : ''}
                  </option>
                ))}
                <option value="new">+ Create a new account</option>
              </select>
            </label>
            {accountId === 'new' && (
              <>
                <label className="field">
                  <span>Account nickname</span>
                  <input
                    value={accountName}
                    maxLength={200}
                    onChange={(event) => setAccountName(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Bank / institution</span>
                  <input
                    value={bank}
                    maxLength={200}
                    onChange={(event) => setBank(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Account type</span>
                  <select
                    value={accountType}
                    onChange={(event) =>
                      setAccountType(event.target.value as Account['type'])
                    }
                  >
                    {['Checking', 'Savings', 'Credit card', 'Cash'].map(
                      (type) => (
                        <option key={type}>{type}</option>
                      ),
                    )}
                  </select>
                </label>
                <label className="field">
                  <span>Last four digits only</span>
                  <input
                    value={last4}
                    maxLength={4}
                    inputMode="numeric"
                    onChange={(event) => setLast4(event.target.value)}
                  />
                </label>
                <label className="field full-width">
                  <span>Balance before these transactions</span>
                  <input
                    type="number"
                    step="0.01"
                    value={opening}
                    onChange={(event) => setOpening(event.target.value)}
                  />
                  <small className="field-hint">
                    Negative for credit card debt. This is not the closing
                    statement balance.
                  </small>
                </label>
              </>
            )}
            <label className="field">
              <span>Statement currency</span>
              <select
                value={statementCurrency}
                onChange={(event) => setStatementCurrency(event.target.value)}
              >
                {['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD'].map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Date convention</span>
              <select
                value={dateOrder}
                onChange={(event) =>
                  setDateOrder(event.target.value as typeof dateOrder)
                }
              >
                <option value="MDY">Month / day / year</option>
                <option value="DMY">Day / month / year</option>
              </select>
            </label>
            <label className="field">
              <span>Statement year (for missing years)</span>
              <input
                type="number"
                min="1900"
                max="2200"
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
              />
            </label>
            <label className="field">
              <span>Amount format</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value)}
              >
                <option value="signed">Single amount column</option>
                <option value="columns">Separate debit / credit columns</option>
              </select>
            </label>
            {(
              [
                'date',
                'description',
                ...(mode === 'signed' ? ['amount'] : ['debit', 'credit']),
              ] as (keyof ColumnMap)[]
            ).map((key) => (
              <label className="field" key={key}>
                <span>{key.charAt(0).toUpperCase() + key.slice(1)} column</span>
                <select
                  value={mapping[key]}
                  onChange={(event) =>
                    setMapping((previous) => ({
                      ...previous,
                      [key]: Number(event.target.value),
                    }))
                  }
                >
                  <option value="-1">Not mapped</option>
                  {statement.headers.map((header, index) => (
                    <option key={index} value={index}>
                      {header || `Column ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {mode === 'signed' && (
              <label className="field checkbox-field full-width">
                <input
                  type="checkbox"
                  checked={positiveCharges}
                  onChange={(event) => setPositiveCharges(event.target.checked)}
                />
                <span>Positive amounts are card charges (reverse signs)</span>
              </label>
            )}
          </div>
          {statement.warning && (
            <div className="notice warning">{statement.warning}</div>
          )}
          <div className="modal-footer">
            <button className="button" onClick={() => setStep(1)}>
              Choose another file
            </button>
            <div className="spacer" />
            <button className="button primary" onClick={preview}>
              Review transactions
              <ChevronRight size={15} />
            </button>
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <div className="import-summary">
            <span>
              <FileCheck2 size={19} />
              <strong>{included.size}</strong> selected
            </span>
            <span>{duplicates.size} possible duplicates</span>
            <span>{skipped.length} skipped source rows</span>
          </div>
          {statement?.pdf && (
            <div className="notice warning">{statement.warning}</div>
          )}
          {duplicates.size > 0 && (
            <div className="notice">
              Possible duplicates are unchecked. Compare them with your
              statement; identical legitimate purchases can look like
              duplicates.
            </div>
          )}
          <div className="table-scroll import-preview">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select all import rows"
                      checked={
                        transactions.length > 0 &&
                        transactions.every((item) => included.has(item.id))
                      }
                      onChange={(event) =>
                        setIncluded(
                          event.target.checked
                            ? new Set(transactions.map((item) => item.id))
                            : new Set(),
                        )
                      }
                    />
                  </th>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th>Signed amount ({state.settings.currency})</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((item) => (
                  <tr
                    key={item.id}
                    className={!included.has(item.id) ? 'excluded-row' : ''}
                  >
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Import ${item.description}`}
                        checked={included.has(item.id)}
                        onChange={(event) =>
                          setIncluded((previous) => {
                            const next = new Set(previous)
                            if (event.target.checked) next.add(item.id)
                            else next.delete(item.id)
                            return next
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Date for ${item.description}`}
                        type="date"
                        value={item.date}
                        onChange={(event) =>
                          update(item.id, { date: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Merchant for ${item.description}`}
                        value={item.merchant}
                        maxLength={200}
                        onChange={(event) =>
                          update(item.id, { merchant: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <select
                        aria-label={`Category for ${item.description}`}
                        value={item.category}
                        onChange={(event) =>
                          update(item.id, {
                            category: event.target.value,
                            review:
                              event.target.value === 'uncategorized' ||
                              Boolean(statement?.pdf),
                          })
                        }
                      >
                        {state.categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label={`Amount for ${item.description}`}
                        type="number"
                        step="0.01"
                        defaultValue={(item.amount / 100).toFixed(2)}
                        onChange={(event) =>
                          update(item.id, {
                            amount: Math.round(
                              Number(event.target.value) * 100,
                            ),
                          })
                        }
                      />
                    </td>
                    <td>
                      <span
                        className={`pill ${duplicates.has(item.id) || item.review ? 'warning-text' : 'positive'}`}
                      >
                        {duplicates.has(item.id)
                          ? 'Possible duplicate'
                          : item.review
                            ? 'Needs review'
                            : 'Categorized'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!transactions.length && (
            <div className="notice warning">
              No valid transactions. Go back and check the date convention,
              amount format, and column mappings.
            </div>
          )}
          {skipped.length > 0 && (
            <details className="skipped-details">
              <summary>{skipped.length} skipped rows</summary>
              <ul>
                {skipped.map((item) => (
                  <li key={item.row}>
                    Source row {item.row}: {item.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="import-net">
            Net change to account{' '}
            <strong>
              {currency(
                transactions
                  .filter((item) => included.has(item.id))
                  .reduce((sum, item) => sum + item.amount, 0),
                state.settings.currency,
              )}
            </strong>
          </div>
          <label className="import-check">
            <input
              type="checkbox"
              checked={archive}
              onChange={(event) => setArchive(event.target.checked)}
            />
            Save original statement in the document vault
          </label>
          <label className="import-check">
            <input
              type="checkbox"
              checked={verified}
              onChange={(event) => setVerified(event.target.checked)}
            />
            I checked the account, dates, currency, signs, and selected rows
            against the statement.
          </label>
          <div className="modal-footer">
            <button
              className="button"
              disabled={busy}
              onClick={() => setStep(2)}
            >
              Back to mapping
            </button>
            <div className="spacer" />
            <button
              className="button primary"
              disabled={!included.size || !verified || busy}
              onClick={() => void save()}
            >
              <Check size={15} />
              {busy ? 'Importing...' : `Import ${included.size} transactions`}
            </button>
          </div>
        </>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
    </Modal>
  )
}
