import { z } from 'zod'

const id = z.string().min(1).max(160)
const text = z.string().max(2000)
const money = z.number().int().safe()
const positiveMoney = money.nonnegative()
const date = z.iso.date()

export const accountSchema = z.object({
  id,
  name: text,
  bank: text,
  last4: z.string().regex(/^\d{0,4}$/),
  type: z.enum(['Checking', 'Savings', 'Credit card', 'Cash']),
  opening: money,
  color: text,
})
export const transactionSchema = z.object({
  id,
  date,
  merchant: text,
  description: text,
  amount: money,
  category: id,
  accountId: id,
  notes: text,
  review: z.boolean(),
  deductible: z.boolean(),
  billId: id.optional(),
})
export const categorySchema = z.object({
  id,
  name: text,
  color: text,
  budget: positiveMoney,
})
export const billSchema = z.object({
  id,
  name: text,
  amount: positiveMoney,
  due: date,
  cycle: z.enum(['Monthly', 'Yearly', 'Weekly', 'Once']),
  kind: z.enum(['Bill', 'Subscription']),
  category: id,
  accountId: id,
  active: z.boolean(),
})
export const goalSchema = z.object({
  id,
  name: text,
  target: positiveMoney,
  saved: positiveMoney,
  date,
  kind: z.enum(['Emergency fund', 'Travel', 'Home', 'Education', 'Other']),
})
export const groupSchema = z.object({
  id,
  name: text,
  members: z.array(z.string().min(1).max(80)).min(2).max(30),
})
export const sharedSchema = z.object({
  id,
  groupId: id,
  name: text,
  date,
  amount: positiveMoney,
  paidBy: text,
  shares: z.record(z.string(), positiveMoney),
})
export const settlementSchema = z.object({
  id,
  groupId: id,
  from: text,
  to: text,
  amount: positiveMoney,
  date,
})
export const payslipSchema = z.object({
  id,
  employer: text,
  period: z.string().regex(/^\d{4}-\d{2}$/),
  gross: positiveMoney,
  tax: positiveMoney,
  other: positiveMoney,
  date,
  status: z.enum(['Expected', 'Received']),
})
export const timesheetSchema = z.object({
  id,
  date,
  project: text,
  hours: z.number().min(0).max(24),
  rate: positiveMoney,
  status: z.enum(['Draft', 'Submitted', 'Approved']),
})
export const assetSchema = z.object({
  id,
  name: text,
  type: z.enum(['Investment', 'Property', 'Other']),
  value: positiveMoney,
  cost: positiveMoney,
})
export const debtSchema = z.object({
  id,
  name: text,
  balance: positiveMoney,
  apr: z.number().min(0).max(100),
  payment: positiveMoney,
})
export const documentSchema = z.object({
  id,
  name: text,
  mime: text,
  size: z.number().nonnegative(),
  kind: z.enum(['Statement', 'Receipt', 'Medical', 'Tax', 'Payslip', 'Other']),
  created: date,
  hasFile: z.boolean(),
  year: z.string().regex(/^\d{4}$/),
  amount: positiveMoney,
  note: text,
})
export const ruleSchema = z.object({
  id,
  keyword: z.string().min(1).max(200),
  category: id,
  merchant: text,
})
export const stateSchema = z.object({
  version: z.literal(1),
  demo: z.boolean(),
  settings: z.object({
    name: z.string().min(1).max(80),
    currency: z.enum(['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD']),
    dateOrder: z.enum(['MDY', 'DMY']),
    theme: z.enum(['light', 'dark']),
    taxRate: z.number().min(0).max(100),
    taxAllowance: positiveMoney,
  }),
  accounts: z.array(accountSchema),
  transactions: z.array(transactionSchema),
  categories: z.array(categorySchema),
  bills: z.array(billSchema),
  goals: z.array(goalSchema),
  groups: z.array(groupSchema),
  shared: z.array(sharedSchema),
  settlements: z.array(settlementSchema),
  payslips: z.array(payslipSchema),
  timesheets: z.array(timesheetSchema),
  assets: z.array(assetSchema),
  debts: z.array(debtSchema),
  documents: z.array(documentSchema),
  rules: z.array(ruleSchema),
  activity: z.array(z.object({ id, date: z.iso.datetime(), text })),
})

export type Account = z.infer<typeof accountSchema>
export type Transaction = z.infer<typeof transactionSchema>
export type Category = z.infer<typeof categorySchema>
export type Bill = z.infer<typeof billSchema>
export type Goal = z.infer<typeof goalSchema>
export type Group = z.infer<typeof groupSchema>
export type SharedExpense = z.infer<typeof sharedSchema>
export type Settlement = z.infer<typeof settlementSchema>
export type Payslip = z.infer<typeof payslipSchema>
export type Timesheet = z.infer<typeof timesheetSchema>
export type Asset = z.infer<typeof assetSchema>
export type Debt = z.infer<typeof debtSchema>
export type Document = z.infer<typeof documentSchema>
export type Rule = z.infer<typeof ruleSchema>
export type AppState = z.infer<typeof stateSchema>
export type Page =
  | 'overview'
  | 'transactions'
  | 'accounts'
  | 'budgets'
  | 'recurring'
  | 'shared'
  | 'income'
  | 'goals'
  | 'wealth'
  | 'documents'
  | 'taxes'
  | 'reports'
  | 'rules'
  | 'activity'
  | 'settings'
export type Collection = Exclude<
  keyof AppState,
  'version' | 'demo' | 'settings' | 'activity'
>
