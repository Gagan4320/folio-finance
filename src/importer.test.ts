import { describe, expect, it } from 'vitest'
import { detectInstitution, guessColumns, parseRows, readCSV } from './importer'
import { makeState } from './seed'
import { stateSchema } from './model'
import { validateReferences } from './finance'

describe('statement imports', () => {
  it('recognizes account hints without mistaking purchase amounts for account numbers', () => {
    expect(detectInstitution('Chase\nAccount ending in 4829')).toEqual({
      bank: 'Chase',
      last4: '4829',
    })
    expect(detectInstitution('HDFC card XXXX1234')).toEqual({
      bank: 'HDFC',
      last4: '1234',
    })
    expect(detectInstitution('Amazon 1234.00')).toEqual({ bank: '', last4: '' })
  })
  it('parses CSV preambles, quoted merchants, and separate debit/credit columns', () => {
    const statement = readCSV(
      'Chase account ending in 4829\nDate,Description,Debit,Credit\n09/01/2026,"Amazon, Marketplace",25.99,\n09/02/2026,Payroll,,1000.00\ninvalid,Garbage,nope,',
    )
    const result = parseRows(
      statement,
      guessColumns(statement.headers),
      [],
      'checking',
      'MDY',
    )
    expect(result.transactions.map((item) => item.amount)).toEqual([
      -2599, 100000,
    ])
    expect(result.transactions[0].category).toBe('shopping')
    expect(result.skipped).toHaveLength(1)
  })
  it('lets credit card exports reverse signs explicitly', () => {
    const statement = readCSV(
      'Date,Description,Amount\n2026-09-01,Amazon,25.99\n2026-09-02,Card payment,-100.00',
    )
    expect(
      parseRows(
        statement,
        guessColumns(statement.headers),
        [],
        'credit',
        'MDY',
        true,
      ).transactions.map((item) => item.amount),
    ).toEqual([-2599, 10000])
  })
  it('rejects rows with both debit and credit rather than silently netting them', () => {
    const statement = readCSV(
      'Date,Description,Debit,Credit\n2026-09-01,Unknown,20,30',
    )
    expect(
      parseRows(
        statement,
        guessColumns(statement.headers),
        [],
        'checking',
        'MDY',
      ).skipped,
    ).toHaveLength(1)
  })
  it('validates both demo and empty state including cross-record references', () => {
    expect(() =>
      validateReferences(stateSchema.parse(makeState())),
    ).not.toThrow()
    expect(() =>
      validateReferences(stateSchema.parse(makeState(false))),
    ).not.toThrow()
  })
})
