import { format, isValid, parse } from 'date-fns'
import type {
  Account,
  AppState,
  Group,
  Rule,
  Settlement,
  SharedExpense,
  Transaction,
} from './model'

export const uid = () => crypto.randomUUID()
export const today = () => format(new Date(), 'yyyy-MM-dd')
export const currentMonth = () => format(new Date(), 'yyyy-MM')
export const currency = (amount: number, code = 'USD', compact = false) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    maximumFractionDigits: compact ? 0 : 2,
  }).format(amount / 100)

export function parseMoney(input: string): number | null {
  const raw = input.trim()
  if (!raw) return null
  if (/\d\s*[-+]\s*\d/.test(raw)) return null
  const negative = /^\(.*\)$/.test(raw) || /-|DR$/i.test(raw)
  let clean = raw.replace(
    /(?:USD|INR|EUR|GBP|CAD|AUD|CR|DR)|[$£€₹\s()\-+]/gi,
    '',
  )
  if (!/^[\d.,]+$/.test(clean)) return null
  const comma = clean.lastIndexOf(',')
  const dot = clean.lastIndexOf('.')
  if (comma > dot && /^\d{1,2}$/.test(clean.slice(comma + 1)))
    clean = clean.replace(/\./g, '').replace(',', '.')
  else clean = clean.replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  const value = Math.round(Number(clean) * 100) * (negative ? -1 : 1)
  return Number.isSafeInteger(value) ? value : null
}

export function parseStatementDate(
  input: string,
  order: 'MDY' | 'DMY',
  year = new Date().getFullYear(),
): string | null {
  const formats = [
    'yyyy-MM-dd',
    'yyyy/MM/dd',
    ...(order === 'DMY'
      ? ['dd/MM/yyyy', 'dd/MM/yy', 'dd-MM-yyyy', 'dd-MM-yy']
      : ['MM/dd/yyyy', 'MM/dd/yy', 'MM-dd-yyyy', 'MM-dd-yy']),
    'dd MMM yyyy',
    'MMM dd, yyyy',
    'MMM dd yyyy',
    'dd-MMM-yyyy',
    'dd MMM',
    'MMM dd',
    ...(order === 'DMY' ? ['dd/MM', 'dd-MM'] : ['MM/dd', 'MM-dd']),
  ]
  for (const pattern of formats) {
    const result = parse(input.trim(), pattern, new Date(year, 0, 1))
    if (
      isValid(result) &&
      result.getFullYear() >= 1900 &&
      result.getFullYear() <= 2200
    )
      return format(result, 'yyyy-MM-dd')
  }
  return null
}

const merchantPatterns: [RegExp, string, string][] = [
  [/amazon|amzn|temu|target|walmart|ebay|etsy/i, 'shopping', ''],
  [
    /whole foods|trader joe|aldi|kroger|costco|grocery|safeway|instacart/i,
    'groceries',
    '',
  ],
  [
    /starbucks|chipotle|restaurant|cafe|coffee|doordash|ubereats|uber eats|mcdonald/i,
    'dining',
    '',
  ],
  [/uber|lyft|shell|chevron|transit|parking|metro/i, 'transport', ''],
  [
    /netflix|spotify|hulu|youtube|apple\.com|adobe|openai|chatgpt|microsoft/i,
    'subscriptions',
    '',
  ],
  [/rent|apartment|mortgage/i, 'housing', ''],
  [/hospital|medical|pharmacy|clinic|dental|cvs|walgreens/i, 'health', ''],
  [/electric|water bill|internet|comcast|verizon|utility/i, 'utilities', ''],
  [/airbnb|hotel|airlines|airways|booking\.com/i, 'travel', ''],
  [/payroll|salary|direct deposit/i, 'salary', ''],
]

export function categorize(
  description: string,
  rules: Rule[],
): { category: string; merchant: string; review: boolean } {
  const rule = rules.find((item) =>
    description.toLowerCase().includes(item.keyword.toLowerCase()),
  )
  if (rule)
    return {
      category: rule.category,
      merchant: rule.merchant || description,
      review: false,
    }
  const match = merchantPatterns.find(([pattern]) => pattern.test(description))
  return {
    category: match?.[1] || 'uncategorized',
    merchant: description.replace(/\s+/g, ' ').trim(),
    review: !match,
  }
}

export function accountBalance(account: Account, transactions: Transaction[]) {
  return (
    account.opening +
    transactions
      .filter((item) => item.accountId === account.id)
      .reduce((sum, item) => sum + item.amount, 0)
  )
}

export function totals(transactions: Transaction[]) {
  return transactions
    .filter((item) => item.category !== 'transfer')
    .reduce(
      (result, item) => ({
        income: result.income + Math.max(0, item.amount),
        spent: result.spent + Math.max(0, -item.amount),
      }),
      { income: 0, spent: 0 },
    )
}

export function fingerprint(
  transaction: Pick<
    Transaction,
    'date' | 'description' | 'amount' | 'accountId'
  >,
) {
  return [
    transaction.accountId,
    transaction.date,
    transaction.amount,
    transaction.description.toLowerCase().replace(/[^a-z0-9]/g, ''),
  ].join('|')
}

export function equalShares(amount: number, members: string[]) {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    !members.length ||
    new Set(members).size !== members.length
  )
    throw new Error('Enter a valid amount and unique members.')
  const share = Math.floor(amount / members.length)
  return Object.fromEntries(
    members.map((member, index) => [
      member,
      share + (index < amount % members.length ? 1 : 0),
    ]),
  )
}

export function groupBalances(
  group: Group,
  expenses: SharedExpense[],
  settlements: Settlement[],
) {
  const balances: Record<string, number> = Object.fromEntries(
    group.members.map((member) => [member, 0]),
  )
  for (const expense of expenses.filter((item) => item.groupId === group.id)) {
    balances[expense.paidBy] += expense.amount
    for (const [member, share] of Object.entries(expense.shares))
      balances[member] -= share
  }
  for (const settlement of settlements.filter(
    (item) => item.groupId === group.id,
  )) {
    balances[settlement.from] += settlement.amount
    balances[settlement.to] -= settlement.amount
  }
  return balances
}

export function simplifyDebts(balances: Record<string, number>) {
  const creditors = Object.entries(balances)
    .filter(([, amount]) => amount > 0)
    .map(([name, amount]) => ({ name, amount }))
  const debtors = Object.entries(balances)
    .filter(([, amount]) => amount < 0)
    .map(([name, amount]) => ({ name, amount: -amount }))
  const transfers: { from: string; to: string; amount: number }[] = []
  for (const debtor of debtors)
    for (const creditor of creditors) {
      const amount = Math.min(debtor.amount, creditor.amount)
      if (amount > 0) {
        transfers.push({ from: debtor.name, to: creditor.name, amount })
        debtor.amount -= amount
        creditor.amount -= amount
      }
    }
  return transfers
}

export function debtProjection(balance: number, apr: number, payment: number) {
  let remaining = balance
  let interest = 0
  let months = 0
  if (balance <= 0) return { months: 0, interest: 0 }
  if (payment <= Math.round((balance * apr) / 1200)) return null
  while (remaining > 0 && months < 1200) {
    const added = Math.round((remaining * apr) / 1200)
    interest += added
    remaining = Math.max(0, remaining + added - payment)
    months++
  }
  return remaining > 0 ? null : { months, interest }
}

export function validateReferences(state: AppState) {
  const accountIds = new Set(state.accounts.map((item) => item.id))
  const categoryIds = new Set(state.categories.map((item) => item.id))
  for (const [key, value] of Object.entries(state))
    if (
      Array.isArray(value) &&
      new Set(value.map((item) => item.id)).size !== value.length
    )
      throw new Error(`Duplicate IDs in ${key}.`)
  if (!categoryIds.has('uncategorized') || !categoryIds.has('transfer'))
    throw new Error('Required categories are missing.')
  for (const item of [...state.transactions, ...state.bills])
    if (!accountIds.has(item.accountId) || !categoryIds.has(item.category))
      throw new Error('An account or category reference is missing.')
  for (const rule of state.rules)
    if (!categoryIds.has(rule.category))
      throw new Error('A rule references a missing category.')
  for (const group of state.groups)
    if (new Set(group.members).size !== group.members.length)
      throw new Error('Group members must be unique.')
  for (const item of state.shared) {
    const group = state.groups.find((group) => group.id === item.groupId)
    if (
      !group ||
      !group.members.includes(item.paidBy) ||
      Object.keys(item.shares).some(
        (member) => !group.members.includes(member),
      ) ||
      Object.values(item.shares).reduce((sum, value) => sum + value, 0) !==
        item.amount
    )
      throw new Error('An expense has invalid shares.')
  }
  for (const item of state.settlements) {
    const group = state.groups.find((group) => group.id === item.groupId)
    if (
      !group ||
      !group.members.includes(item.from) ||
      !group.members.includes(item.to) ||
      item.from === item.to
    )
      throw new Error('A settlement has invalid members.')
  }
  for (const slip of state.payslips)
    if (slip.tax + slip.other > slip.gross)
      throw new Error('Payslip deductions exceed gross pay.')
  return state
}
