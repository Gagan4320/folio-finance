import Papa from 'papaparse'
import { categorize, parseMoney, parseStatementDate, uid } from './finance'
import type { Rule, Transaction } from './model'

export type ColumnMap = {
  date: number
  description: number
  amount: number
  debit: number
  credit: number
}
export type Statement = {
  headers: string[]
  rows: string[][]
  text: string
  bank: string
  last4: string
  pdf: boolean
  warning: string
}

export function detectInstitution(text: string) {
  const banks: [RegExp, string][] = [
    [/\bchase\b|jpmorgan/i, 'Chase'],
    [/bank of america/i, 'Bank of America'],
    [/wells fargo/i, 'Wells Fargo'],
    [/capital one/i, 'Capital One'],
    [/american express|\bamex\b/i, 'American Express'],
    [/\bciti(?:bank)?\b/i, 'Citi'],
    [/\bdiscover\b/i, 'Discover'],
    [/\bally\b/i, 'Ally'],
    [/\bhdfc\b/i, 'HDFC'],
    [/\bicici\b/i, 'ICICI'],
    [/\baxis bank\b/i, 'Axis'],
    [/state bank of india|\bsbi\b/i, 'SBI'],
    [/\bhsbc\b/i, 'HSBC'],
    [/\brevolut\b/i, 'Revolut'],
    [/\bmonzo\b/i, 'Monzo'],
  ]
  const bank = banks.find(([pattern]) => pattern.test(text))?.[1] || ''
  const suffix =
    text.match(/(?:ending\s+(?:in\s+)?|[x*•]{3,}\s*)(\d{4})\b/i)?.[1] ||
    text.match(
      /(?:account|card)\s*(?:number|no\.?|#)?\s*[:\s]\s*[\d -]{4,}(\d{4})\b/i,
    )?.[1] ||
    ''
  return { bank, last4: suffix }
}

export function guessColumns(headers: string[]): ColumnMap {
  const find = (pattern: RegExp) =>
    headers.findIndex((header) => pattern.test(header.trim()))
  return {
    date: find(
      /^(transaction\s*date|date|posted\s*date|posting\s*date|value\s*date)$/i,
    ),
    description: find(
      /description|merchant|particulars|narration|details|payee/i,
    ),
    amount: find(/^(amount|transaction\s*amount|total)$/i),
    debit: find(/debit|withdrawal|money out|charge/i),
    credit: find(/credit|deposit|money in/i),
  }
}

export function readCSV(text: string): Statement {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    skipEmptyLines: 'greedy',
  })
  if (parsed.errors.some((error) => error.type === 'Quotes'))
    throw new Error(
      'The CSV contains an unclosed quoted field. Please export it again.',
    )
  const headerIndex = parsed.data.findIndex((row) =>
    row.some((cell) =>
      /^(transaction\s*date|date|posted\s*date|posting\s*date|value\s*date)$/i.test(
        cell.trim(),
      ),
    ),
  )
  if (headerIndex < 0)
    throw new Error(
      'No date header was found. Use a CSV with Date, Description, and Amount (or Debit and Credit) columns.',
    )
  const headers = parsed.data[headerIndex]
  return {
    headers,
    rows: parsed.data.slice(headerIndex + 1),
    text,
    ...detectInstitution(text.slice(0, 12000)),
    pdf: false,
    warning: '',
  }
}

export function parseRows(
  statement: Statement,
  mapping: ColumnMap,
  rules: Rule[],
  accountId: string,
  order: 'DMY' | 'MDY',
  positiveCharges = false,
  year = new Date().getFullYear(),
) {
  const transactions: Transaction[] = []
  const skipped: { row: number; reason: string }[] = []
  statement.rows.forEach((row, index) => {
    const date = parseStatementDate(row[mapping.date] || '', order, year)
    const description = (row[mapping.description] || '').trim()
    let amount: number | null
    if (mapping.debit >= 0 || mapping.credit >= 0) {
      const debitText = (row[mapping.debit] || '').trim()
      const creditText = (row[mapping.credit] || '').trim()
      const debit = debitText ? parseMoney(debitText) : 0
      const credit = creditText ? parseMoney(creditText) : 0
      amount =
        debit === null || credit === null || (debit !== 0 && credit !== 0)
          ? null
          : Math.abs(credit) - Math.abs(debit)
    } else {
      amount = parseMoney(row[mapping.amount] || '')
      if (amount !== null && positiveCharges) amount *= -1
    }
    if (
      !date ||
      !description ||
      amount === null ||
      amount === 0 ||
      /^(opening|closing|previous|available|total)\s+(balance|amount|credit|debit)/i.test(
        description,
      )
    ) {
      skipped.push({
        row: index + 1,
        reason: !date
          ? 'Unrecognized date'
          : !description
            ? 'Missing description'
            : amount === null
              ? 'Invalid or ambiguous amount'
              : 'Zero amount or balance summary',
      })
      return
    }
    const classified = categorize(description, rules)
    transactions.push({
      id: uid(),
      date,
      description,
      amount,
      ...classified,
      review: classified.review || statement.pdf,
      accountId,
      notes: '',
      deductible: false,
    })
  })
  return { transactions, skipped }
}

export async function readStatement(file: File): Promise<Statement> {
  if (file.size > 15 * 1024 * 1024)
    throw new Error('Please choose a statement smaller than 15 MB.')
  if (/\.csv$/i.test(file.name)) return readCSV(await file.text())
  if (!/\.pdf$/i.test(file.name))
    throw new Error('Choose a CSV or a text-based PDF statement.')
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  })
  try {
    const pdf = await loadingTask.promise
    if (pdf.numPages > 150)
      throw new Error(
        'Please split statements longer than 150 pages before importing.',
      )
    const lines: string[] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const rows = new Map<number, { x: number; text: string }[]>()
      for (const item of content.items)
        if ('str' in item) {
          const y = Math.round(item.transform[5] / 3) * 3
          rows.set(y, [
            ...(rows.get(y) || []),
            { x: item.transform[4], text: item.str },
          ])
        }
      for (const [, items] of [...rows.entries()].sort(
        ([first], [second]) => second - first,
      ))
        lines.push(
          items
            .sort((first, second) => first.x - second.x)
            .map((item) => item.text)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim(),
        )
    }
    const text = lines.join('\n')
    const parsed: string[][] = []
    for (const line of lines) {
      const match = line.match(
        /^(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{1,2}\s+[A-Za-z]{3}(?:\s+\d{4})?|[A-Za-z]{3}\s+\d{1,2}(?:,?\s+\d{4})?)\s+(.+?)\s+([($£€₹+-]?[\d,]+\.\d{2}\)?(?:\s*(?:CR|DR))?)$/i,
      )
      if (match && !/\d[,.]\d{2}\s/.test(match[2]))
        parsed.push([match[1], match[2], match[3]])
    }
    if (!parsed.length)
      throw new Error(
        'No reliable transaction rows were found. Scanned, password-protected, or complex multi-column PDFs need a bank CSV export. You can still store this PDF in the document vault.',
      )
    return {
      headers: ['Date', 'Description', 'Amount'],
      rows: parsed,
      text,
      ...detectInstitution(text),
      pdf: true,
      warning:
        'PDF extraction is best-effort and may omit rows. Check every amount and date against the original, especially credit/debit signs. Multi-column balance tables are not supported. All PDF transactions are marked for review.',
    }
  } catch (error) {
    if (error instanceof Error && /password/i.test(error.message))
      throw new Error(
        'This PDF is password-protected. Unlock a copy locally, or use your bank CSV export.',
      )
    throw error
  } finally {
    await loadingTask.destroy()
  }
}
