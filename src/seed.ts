import { addDays, format, subMonths } from 'date-fns'
import type { AppState, Transaction } from './model'
import { currentMonth, equalShares, today } from './finance'

export const palette = [
  '#258566',
  '#e5ad62',
  '#6b88c5',
  '#ab8ec5',
  '#d27878',
  '#7d9b92',
  '#86adce',
  '#bab879',
]

export function makeState(demo = true): AppState {
  const month = currentMonth()
  const now = new Date()
  const date = (day: number) => `${month}-${String(day).padStart(2, '0')}`
  const state: AppState = {
    version: 1,
    demo,
    settings: {
      name: demo ? 'Alex Morgan' : 'My workspace',
      currency: 'USD',
      dateOrder: 'MDY',
      theme: 'light',
      taxRate: 22,
      taxAllowance: 0,
    },
    categories: [
      ['housing', 'Housing', '#7190c1', 180000],
      ['shopping', 'Shopping', '#dca560', 50000],
      ['groceries', 'Groceries', '#258566', 45000],
      ['dining', 'Food & dining', '#a58cc1', 35000],
      ['transport', 'Transport', '#85aabc', 20000],
      ['subscriptions', 'Subscriptions', '#c78591', 10000],
      ['utilities', 'Utilities', '#8aa37f', 25000],
      ['health', 'Health & wellness', '#cc9276', 20000],
      ['travel', 'Travel', '#54a3a0', 30000],
      ['salary', 'Salary', '#258566', 0],
      ['freelance', 'Freelance', '#79a883', 0],
      ['transfer', 'Transfer', '#939aa7', 0],
      ['uncategorized', 'Uncategorized', '#a0a5ae', 0],
    ].map(([id, name, color, budget]) => ({
      id: String(id),
      name: String(name),
      color: String(color),
      budget: Number(budget),
    })),
    accounts: [],
    transactions: [],
    bills: [],
    goals: [],
    groups: [],
    shared: [],
    settlements: [],
    payslips: [],
    timesheets: [],
    assets: [],
    debts: [],
    documents: [],
    rules: [],
    activity: [],
  }
  if (!demo) return state
  state.accounts = [
    {
      id: 'checking',
      name: 'Everyday checking',
      bank: 'Chase',
      type: 'Checking',
      last4: '4829',
      opening: 0,
      color: '#26745b',
    },
    {
      id: 'savings',
      name: 'High-yield savings',
      bank: 'Ally',
      type: 'Savings',
      last4: '9012',
      opening: 1845000,
      color: '#7471a6',
    },
    {
      id: 'credit',
      name: 'Sapphire Preferred',
      bank: 'Chase',
      type: 'Credit card',
      last4: '6301',
      opening: 0,
      color: '#485e72',
    },
  ]
  const add = (
    transaction: Omit<Transaction, 'id' | 'notes' | 'deductible' | 'review'> &
      Partial<Transaction>,
  ) =>
    state.transactions.push({
      notes: '',
      deductible: false,
      review: false,
      ...transaction,
      id: `demo-${state.transactions.length}`,
    })
  for (let offset = 5; offset >= 1; offset--) {
    const prefix = format(subMonths(now, offset), 'yyyy-MM')
    add({
      date: `${prefix}-01`,
      merchant: 'Acme Studio',
      description: 'ACME PAYROLL',
      amount: 645000,
      category: 'salary',
      accountId: 'checking',
    })
    const expenses = [
      ['Rent payment', 'housing', 165000],
      ['Whole Foods Market', 'groceries', 34100 + offset * 810],
      ['Amazon', 'shopping', 28100 + offset * 4230],
      ['Restaurants & coffee', 'dining', 31200 + offset * 1260],
      ['Uber', 'transport', 14000 + offset * 970],
      ['Monthly subscriptions', 'subscriptions', 8497],
      ['Electric & internet', 'utilities', 17900],
    ] as const
    expenses.forEach(([merchant, category, amount], index) =>
      add({
        date: `${prefix}-${String(index * 3 + 2).padStart(2, '0')}`,
        merchant,
        description: merchant,
        amount: -amount,
        category,
        accountId: 'checking',
      }),
    )
  }
  const current: [number, string, number, string, string][] = [
    [1, 'Acme Studio', 645000, 'salary', 'checking'],
    [1, 'Rent payment', -165000, 'housing', 'checking'],
    [2, 'Whole Foods Market', -8642, 'groceries', 'credit'],
    [3, 'Spotify', -1199, 'subscriptions', 'credit'],
    [4, 'Blue Bottle Coffee', -875, 'dining', 'credit'],
    [5, 'Amazon', -6849, 'shopping', 'credit'],
    [6, 'Verizon', -6500, 'utilities', 'checking'],
    [7, "Trader Joe's", -7260, 'groceries', 'credit'],
    [8, 'Uber', -2450, 'transport', 'credit'],
    [9, 'Netflix', -1549, 'subscriptions', 'credit'],
    [10, 'Sweetgreen', -1895, 'dining', 'credit'],
    [11, 'CVS Pharmacy', -3299, 'health', 'credit'],
    [12, 'Nike', -12900, 'shopping', 'credit'],
    [13, 'Whole Foods Market', -9450, 'groceries', 'credit'],
    [14, 'Electric company', -9250, 'utilities', 'checking'],
    [15, 'Figma freelance project', 35000, 'freelance', 'checking'],
    [15, 'Temu', -3475, 'shopping', 'credit'],
    [16, 'SQ * WILLOW & CO', -4250, 'uncategorized', 'credit'],
    [17, 'Amazon', -8499, 'shopping', 'credit'],
    [17, 'Blue Bottle Coffee', -1250, 'dining', 'credit'],
    [18, 'Uber', -2840, 'transport', 'credit'],
    [18, 'POS PURCHASE 0918', -2790, 'uncategorized', 'credit'],
    [19, 'Whole Foods Market', -7684, 'groceries', 'credit'],
  ]
  current
    .filter(([day]) => day <= now.getDate())
    .forEach(([day, merchant, amount, category, accountId]) =>
      add({
        date: date(day),
        merchant,
        description: merchant,
        amount,
        category,
        accountId,
        review: category === 'uncategorized',
        deductible: category === 'health',
      }),
    )
  state.accounts[0].opening =
    823465 -
    state.transactions
      .filter((item) => item.accountId === 'checking')
      .reduce((sum, item) => sum + item.amount, 0)
  state.accounts[2].opening =
    -84235 -
    state.transactions
      .filter((item) => item.accountId === 'credit')
      .reduce((sum, item) => sum + item.amount, 0)
  state.bills = [
    {
      id: 'b1',
      name: 'Adobe Creative Cloud',
      amount: 5999,
      due: format(addDays(now, 2), 'yyyy-MM-dd'),
      cycle: 'Monthly',
      kind: 'Subscription',
      category: 'subscriptions',
      accountId: 'credit',
      active: true,
    },
    {
      id: 'b2',
      name: 'Internet',
      amount: 6500,
      due: format(addDays(now, 4), 'yyyy-MM-dd'),
      cycle: 'Monthly',
      kind: 'Bill',
      category: 'utilities',
      accountId: 'checking',
      active: true,
    },
    {
      id: 'b3',
      name: 'Rent payment',
      amount: 165000,
      due: format(addDays(now, 12), 'yyyy-MM-dd'),
      cycle: 'Monthly',
      kind: 'Bill',
      category: 'housing',
      accountId: 'checking',
      active: true,
    },
    {
      id: 'b4',
      name: 'Spotify Premium',
      amount: 1199,
      due: format(addDays(now, 14), 'yyyy-MM-dd'),
      cycle: 'Monthly',
      kind: 'Subscription',
      category: 'subscriptions',
      accountId: 'credit',
      active: true,
    },
    {
      id: 'b5',
      name: 'Netflix',
      amount: 1549,
      due: format(addDays(now, 20), 'yyyy-MM-dd'),
      cycle: 'Monthly',
      kind: 'Subscription',
      category: 'subscriptions',
      accountId: 'credit',
      active: true,
    },
  ]
  state.goals = [
    {
      id: 'g1',
      name: 'A little escape to Italy',
      target: 400000,
      saved: 265000,
      date: `${now.getFullYear() + 1}-06-01`,
      kind: 'Travel',
    },
    {
      id: 'g2',
      name: 'Peace-of-mind fund',
      target: 2000000,
      saved: 1450000,
      date: `${now.getFullYear() + 1}-03-01`,
      kind: 'Emergency fund',
    },
    {
      id: 'g3',
      name: 'A place of my own',
      target: 5000000,
      saved: 820000,
      date: `${now.getFullYear() + 3}-01-01`,
      kind: 'Home',
    },
  ]
  state.groups = [
    {
      id: 'roommates',
      name: 'The apartment',
      members: ['You', 'Jamie', 'Sam'],
    },
    {
      id: 'weekend',
      name: 'Weekend away',
      members: ['You', 'Jamie', 'Taylor', 'Chris'],
    },
  ]
  state.shared = [
    {
      id: 's1',
      groupId: 'roommates',
      name: 'Groceries for the apartment',
      date: date(7),
      amount: 12600,
      paidBy: 'You',
      shares: equalShares(12600, state.groups[0].members),
    },
    {
      id: 's2',
      groupId: 'roommates',
      name: 'Pizza night',
      date: date(9),
      amount: 5400,
      paidBy: 'Jamie',
      shares: equalShares(5400, state.groups[0].members),
    },
    {
      id: 's3',
      groupId: 'weekend',
      name: 'Lake house booking',
      date: date(12),
      amount: 64000,
      paidBy: 'You',
      shares: equalShares(64000, state.groups[1].members),
    },
  ]
  state.payslips = [0, 1, 2].map((offset) => ({
    id: `pay-${offset}`,
    employer: 'Acme Studio',
    period: format(subMonths(now, offset), 'yyyy-MM'),
    gross: 850000,
    tax: 162500,
    other: 42500,
    date: format(
      subMonths(new Date(now.getFullYear(), now.getMonth(), 1), offset),
      'yyyy-MM-dd',
    ),
    status: 'Received',
  }))
  state.timesheets = [0, 1, 2, 3, 4].map((offset) => ({
    id: `time-${offset}`,
    date: format(addDays(now, -offset), 'yyyy-MM-dd'),
    project: offset === 0 ? 'Website redesign' : 'Product design',
    hours: offset === 0 ? 6.5 : 8,
    rate: 4500,
    status: offset < 2 ? 'Draft' : 'Approved',
  }))
  state.assets = [
    {
      id: 'a1',
      name: 'Index fund portfolio',
      type: 'Investment',
      value: 1265000,
      cost: 1100000,
    },
    {
      id: 'a2',
      name: 'Retirement account',
      type: 'Investment',
      value: 1840000,
      cost: 1620000,
    },
  ]
  state.debts = [
    {
      id: 'd1',
      name: 'Student loan',
      balance: 825000,
      apr: 4.5,
      payment: 25000,
    },
  ]
  state.documents = [
    {
      id: 'doc1',
      name: 'Chase_September_statement.pdf',
      mime: 'application/pdf',
      size: 245760,
      kind: 'Statement',
      created: today(),
      hasFile: false,
      year: String(now.getFullYear()),
      amount: 0,
      note: 'Demo metadata only. No file is attached.',
    },
    {
      id: 'doc2',
      name: 'Annual_health_check.pdf',
      mime: 'application/pdf',
      size: 184320,
      kind: 'Medical',
      created: date(11),
      hasFile: false,
      year: String(now.getFullYear()),
      amount: 3299,
      note: 'Demo metadata only. No file is attached.',
    },
  ]
  state.rules = [
    { id: 'r1', keyword: 'amzn', merchant: 'Amazon', category: 'shopping' },
    {
      id: 'r2',
      keyword: 'acme payroll',
      merchant: 'Acme Studio',
      category: 'salary',
    },
  ]
  state.activity = [
    {
      id: 'log1',
      date: now.toISOString(),
      text: 'Demo workspace created. Sample balances, transactions, and documents are fictional.',
    },
  ]
  return state
}
