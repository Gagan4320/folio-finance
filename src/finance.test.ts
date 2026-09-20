import { describe, expect, it } from 'vitest'
import {
  accountBalance,
  categorize,
  debtProjection,
  equalShares,
  fingerprint,
  groupBalances,
  parseMoney,
  parseStatementDate,
  simplifyDebts,
  totals,
} from './finance'
import type { Transaction } from './model'

const transaction: Transaction = {
  id: 't1',
  date: '2026-09-19',
  merchant: 'Amazon',
  description: 'AMZN Marketplace',
  amount: -1025,
  category: 'shopping',
  accountId: 'a1',
  notes: '',
  review: false,
  deductible: false,
}

describe('financial arithmetic', () => {
  it('parses currency, European decimals and debit notation without float drift', () => {
    expect(parseMoney('$1,234.56')).toBe(123456)
    expect(parseMoney('1.234,56')).toBe(123456)
    expect(parseMoney('(10.25)')).toBe(-1025)
    expect(parseMoney('10.25 DR')).toBe(-1025)
    expect(parseMoney('10.25DR')).toBe(-1025)
    expect(parseMoney('10.25CR')).toBe(1025)
    expect(parseMoney('10-25')).toBeNull()
    expect(parseMoney('0.29')).toBe(29)
    expect(parseMoney('garbage')).toBeNull()
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('1e6')).toBeNull()
  })
  it('respects the selected ambiguous date convention and rejects impossible dates', () => {
    expect(parseStatementDate('09/08/2026', 'MDY')).toBe('2026-09-08')
    expect(parseStatementDate('09/08/2026', 'DMY')).toBe('2026-08-09')
    expect(parseStatementDate('31/02/2026', 'DMY')).toBeNull()
  })
  it('excludes transfers from cash flow and computes balances from the ledger', () => {
    expect(
      totals([
        transaction,
        { ...transaction, id: 't2', amount: 10000, category: 'transfer' },
      ]),
    ).toEqual({ income: 0, spent: 1025 })
    expect(
      accountBalance(
        {
          id: 'a1',
          name: 'Cash',
          bank: '',
          last4: '',
          type: 'Cash',
          opening: 5000,
          color: '#fff',
        },
        [transaction],
      ),
    ).toBe(3975)
  })
  it('applies custom rules first and flags unknown merchants', () => {
    expect(
      categorize('AMZN Marketplace', [
        {
          id: 'r1',
          keyword: 'amzn',
          merchant: 'Office supplies',
          category: 'utilities',
        },
      ]).category,
    ).toBe('utilities')
    expect(categorize('UNKNOWN 984', []).review).toBe(true)
    expect(categorize('Temu order', []).category).toBe('shopping')
  })
  it('matches repeated imports per account without mixing accounts', () => {
    expect(fingerprint(transaction)).toBe(
      fingerprint({ ...transaction, description: 'amzn marketplace' }),
    )
    expect(fingerprint(transaction)).not.toBe(
      fingerprint({ ...transaction, accountId: 'a2' }),
    )
  })
  it('splits every cent and settles balances without changing the total', () => {
    const members = ['You', 'Sam', 'Mia']
    const shares = equalShares(1000, members)
    expect(Object.values(shares).reduce((sum, amount) => sum + amount, 0)).toBe(
      1000,
    )
    const group = { id: 'g1', name: 'Trip', members }
    const expenses = [
      {
        id: 'e1',
        groupId: 'g1',
        name: 'Lunch',
        date: '2026-09-19',
        amount: 1000,
        paidBy: 'You',
        shares,
      },
    ]
    const balances = groupBalances(group, expenses, [])
    const transfers = simplifyDebts(balances)
    expect(transfers).toHaveLength(2)
    expect(
      Object.values(
        groupBalances(
          group,
          expenses,
          transfers.map((item, index) => ({
            ...item,
            id: String(index),
            groupId: 'g1',
            date: '2026-09-19',
          })),
        ),
      ),
    ).toEqual([0, 0, 0])
  })
  it('detects debt payments that do not cover interest', () => {
    expect(debtProjection(100000, 24, 1000)).toBeNull()
    expect(debtProjection(100000, 0, 10000)).toEqual({
      months: 10,
      interest: 0,
    })
  })
})
