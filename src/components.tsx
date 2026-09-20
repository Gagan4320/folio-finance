import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Coffee,
  CreditCard,
  FileText,
  Music2,
  ShoppingBag,
  ShoppingBasket,
  Car,
  X,
  Plus,
  ArrowRight,
  Inbox,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { currency, parseMoney } from './finance'
import type { Transaction } from './model'
import { useFinance } from './store'

export function IconButton({
  label,
  children,
  onClick,
  className = '',
  disabled = false,
}: {
  label: string
  children: ReactNode
  onClick: () => void
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  )
}
export function SectionTitle({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: ReactNode
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
export function Empty({
  title = 'Nothing here yet',
  text,
  onClick,
  action = 'Add your first item',
}: {
  title?: string
  text: string
  onClick?: () => void
  action?: string
}) {
  return (
    <div className="empty-state">
      <Inbox size={30} strokeWidth={1.4} />
      <h3>{title}</h3>
      <p>{text}</p>
      {onClick && (
        <button className="button" onClick={onClick}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  )
}
export function Progress({ value, color }: { value: number; color?: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(Math.max(0, Math.min(value, 100)))}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progress"
    >
      <span
        style={{
          width: `${Math.max(0, Math.min(value, 100))}%`,
          background: color,
        }}
      />
    </div>
  )
}
export function Stat({
  title,
  value,
  note,
  icon,
  trend,
  featured = false,
}: {
  title: string
  value: string
  note: string
  icon: ReactNode
  trend?: string
  featured?: boolean
}) {
  return (
    <article className={`stat ${featured ? 'stat-featured' : ''}`}>
      <div className="stat-top">
        <span>{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <div className="stat-bottom">
        {trend && (
          <span className="trend">
            <ArrowUpRight size={13} />
            {trend}
          </span>
        )}
        <span>{note}</span>
      </div>
    </article>
  )
}
export function MerchantIcon({
  name,
  category,
  small = false,
}: {
  name: string
  category?: string
  small?: boolean
}) {
  const lower = name.toLowerCase()
  let icon: ReactNode = <ShoppingBag size={19} />
  let color = 'amber'
  if (lower.includes('amazon')) {
    icon = <span className="merchant-letter amazon-letter">a</span>
    color = 'neutral'
  } else if (lower.includes('spotify')) {
    icon = <Music2 size={19} />
    color = 'green'
  } else if (lower.includes('netflix')) {
    icon = <span className="merchant-letter">N</span>
    color = 'red'
  } else if (lower.includes('adobe')) {
    icon = <span className="merchant-letter">A</span>
    color = 'red'
  } else if (category === 'salary' || category === 'freelance') {
    icon = <ArrowDownLeft size={19} />
    color = 'green'
  } else if (category === 'groceries') {
    icon = <ShoppingBasket size={19} />
    color = 'green'
  } else if (category === 'dining') {
    icon = <Coffee size={19} />
    color = 'blue'
  } else if (category === 'transport') {
    icon = <Car size={19} />
    color = 'neutral'
  } else if (category === 'housing' || category === 'utilities') {
    icon = <FileText size={19} />
    color = 'lavender'
  } else if (category === 'uncategorized') {
    icon = <CreditCard size={19} />
    color = 'neutral'
  }
  return (
    <span className={`merchant-icon ${color} ${small ? 'small' : ''}`}>
      {icon}
    </span>
  )
}
export function TransactionTable({
  transactions,
  compact = false,
  selection,
  toggle,
}: {
  transactions: Transaction[]
  compact?: boolean
  selection?: Set<string>
  toggle?: (id: string) => void
}) {
  const { state, edit } = useFinance()
  if (!transactions.length)
    return (
      <Empty
        title="No transactions found"
        text="Try another filter or add a transaction."
      />
    )
  return (
    <div className="table-scroll">
      <table className="data-table transaction-table">
        <thead>
          <tr>
            {selection && (
              <th className="check-cell">
                <span className="sr-only">Select</span>
              </th>
            )}
            <th>Merchant</th>
            <th>Category</th>
            {!compact && <th>Account</th>}
            <th>Date</th>
            <th className="align-right">Amount</th>
            <th>
              <span className="sr-only">Edit</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => {
            const category = state.categories.find(
              (item) => item.id === transaction.category,
            )
            return (
              <tr key={transaction.id}>
                {selection && (
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${transaction.merchant} ${transaction.date}`}
                      checked={selection.has(transaction.id)}
                      onChange={() => toggle?.(transaction.id)}
                    />
                  </td>
                )}
                <td>
                  <button
                    className="merchant-cell"
                    onClick={() => edit('transactions', transaction)}
                  >
                    <MerchantIcon
                      name={transaction.merchant}
                      category={transaction.category}
                    />
                    <span>
                      <strong>{transaction.merchant}</strong>
                      {!compact && <small>{transaction.description}</small>}
                    </span>
                  </button>
                </td>
                <td>
                  <span
                    className={`category-tag ${transaction.review ? 'review-tag' : ''}`}
                  >
                    <span style={{ background: category?.color }} />
                    {category?.name || 'Uncategorized'}
                  </span>
                </td>
                {!compact && (
                  <td className="muted">
                    {
                      state.accounts.find(
                        (item) => item.id === transaction.accountId,
                      )?.name
                    }
                  </td>
                )}
                <td className="muted nowrap">
                  {format(parseISO(transaction.date), 'MMM d, yyyy')}
                </td>
                <td
                  className={`amount align-right ${transaction.amount > 0 ? 'positive' : ''}`}
                >
                  {transaction.amount > 0 ? '+' : '-'}
                  {currency(
                    Math.abs(transaction.amount),
                    state.settings.currency,
                  )}
                </td>
                <td>
                  <IconButton
                    label={`Edit ${transaction.merchant}`}
                    onClick={() => edit('transactions', transaction)}
                  >
                    <ArrowUpRight size={16} />
                  </IconButton>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide-modal' : ''}`}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose()
        }
      }}
    >
      <div className="modal-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      {children}
    </dialog>
  )
}
export type Field = {
  name: string
  label: string
  type?:
    | 'text'
    | 'money'
    | 'number'
    | 'date'
    | 'month'
    | 'select'
    | 'textarea'
    | 'checkbox'
    | 'color'
  options?: { value: string; label: string }[]
  required?: boolean
  min?: number
  max?: number
  hint?: string
  disabled?: boolean
}
export type Values = Record<string, string | number | boolean>
export function FormDialog({
  title,
  subtitle,
  fields,
  initial = {},
  onSave,
  onClose,
  onDelete,
  footer,
}: {
  title: string
  subtitle?: string
  fields: Field[]
  initial?: Record<string, unknown>
  onSave: (values: Values) => void | Promise<void>
  onClose: () => void
  onDelete?: () => void | Promise<void>
  footer?: ReactNode
}) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = new FormData(event.currentTarget)
      const values: Values = {}
      for (const field of fields) {
        if (field.disabled) {
          values[field.name] = initial[field.name] as string | number | boolean
          continue
        }
        const raw = String(data.get(field.name) || '').trim()
        if (field.type === 'checkbox') values[field.name] = data.has(field.name)
        else if (field.type === 'money') {
          const parsed = parseMoney(raw || '0')
          if (
            parsed === null ||
            (field.min !== undefined && parsed < field.min * 100)
          )
            throw new Error(`Enter a valid ${field.label.toLowerCase()}.`)
          values[field.name] = parsed
        } else if (field.type === 'number') {
          const value = Number(raw)
          if (!Number.isFinite(value))
            throw new Error(`Enter a valid ${field.label.toLowerCase()}.`)
          values[field.name] = value
        } else {
          if (field.required !== false && !raw)
            throw new Error(`${field.label} is required.`)
          values[field.name] = raw
        }
      }
      await onSave(values)
      onClose()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to save. Please check the fields.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title={title} subtitle={subtitle} onClose={() => { if (!busy) onClose() }}>
      <form onSubmit={submit}>
        <div className="form-grid">
          {fields.map((field) => (
            <label
              className={`field ${field.type === 'textarea' || field.type === 'checkbox' ? 'full-width' : ''} ${field.type === 'checkbox' ? 'checkbox-field' : ''}`}
              key={field.name}
            >
              {field.type !== 'checkbox' && (
                <span>
                  {field.label}
                  {field.required === false ? <small> Optional</small> : ''}
                </span>
              )}
              {field.type === 'select' ? (
                <select
                  aria-label={field.label}
                  name={field.name}
                  defaultValue={String(
                    initial[field.name] ?? field.options?.[0]?.value ?? '',
                  )}
                  required={field.required !== false}
                  disabled={field.disabled}
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  aria-label={field.label}
                  name={field.name}
                  defaultValue={String(initial[field.name] ?? '')}
                  rows={3}
                  maxLength={2000}
                  required={field.required !== false}
                />
              ) : field.type === 'checkbox' ? (
                <>
                  <input
                    aria-label={field.label}
                    type="checkbox"
                    name={field.name}
                    defaultChecked={Boolean(initial[field.name])}
                  />
                  <span>{field.label}</span>
                </>
              ) : (
                <input
                  aria-label={field.label}
                  name={field.name}
                  type={
                    field.type === 'money' ? 'number' : field.type || 'text'
                  }
                  defaultValue={
                    field.type === 'money'
                      ? (Number(initial[field.name] ?? 0) / 100).toFixed(2)
                      : String(initial[field.name] ?? '')
                  }
                  step={
                    field.type === 'money' || field.type === 'number'
                      ? '0.01'
                      : undefined
                  }
                  min={field.min}
                  max={field.max}
                  maxLength={
                    field.type === 'text' || !field.type ? 200 : undefined
                  }
                  required={field.required !== false}
                  disabled={field.disabled}
                />
              )}
              {field.hint && <small className="field-hint">{field.hint}</small>}
            </label>
          ))}
        </div>
        {footer}
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-footer">
          {onDelete && (
            <button
              type="button"
              className="button danger-text"
              disabled={busy}
              onClick={async () => {
                if (
                  window.confirm('Delete this record? This cannot be undone.')
                ) {
                  try {
                    setBusy(true)
                    await onDelete()
                    onClose()
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : 'Unable to delete.',
                    )
                  } finally { setBusy(false) }
                }
              }}
            >
              Delete
            </button>
          )}
          <div className="spacer" />
          <button type="button" className="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? (
              'Saving...'
            ) : (
              <>
                <Check size={16} />
                Save changes
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
export function ViewAll({
  onClick,
  text = 'View all',
}: {
  onClick: () => void
  text?: string
}) {
  return (
    <button className="text-button" onClick={onClick}>
      {text}
      <ArrowRight size={14} />
    </button>
  )
}
