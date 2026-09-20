import { expect, test } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-19T12:00:00') })
  await page.goto('/')
  await expect(
    page.getByRole('heading', {
      name: 'A little clarity. A lot of possibility.',
    }),
  ).toBeVisible()
})

test('all fifteen workspace views render without runtime errors', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const routes = [
    'transactions',
    'accounts',
    'budgets',
    'recurring',
    'goals',
    'wealth',
    'shared',
    'income',
    'documents',
    'taxes',
    'reports',
    'rules',
    'activity',
    'settings',
    'overview',
  ]
  for (const route of routes) {
    await page.goto(`/#${route}`)
    await expect(page.locator('main h1')).toBeVisible()
    await expect(page.locator('main')).not.toContainText(
      'Your finance workspace',
    )
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy()
  }
  expect(errors).toEqual([])
})

test('manual transactions can be created, edited, persisted and deleted', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'Add transaction', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Merchant / payee').fill('QA coffee receipt')
  await dialog.getByLabel('Amount', { exact: true }).fill('17.29')
  await dialog.getByLabel('Category', { exact: true }).selectOption('dining')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog).not.toBeVisible()
  await page.goto('/#transactions')
  await page.getByLabel('Search transactions').fill('QA coffee receipt')
  await expect(page.locator('tbody')).toContainText('$17.29')
  await page
    .getByRole('button', { name: 'Edit QA coffee receipt', exact: true })
    .click()
  await dialog.getByLabel('Amount', { exact: true }).fill('18.30')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.locator('tbody')).toContainText('$18.30')
  await expect(page.getByText('Saved on this device')).toBeVisible()
  await page.reload()
  await page.getByLabel('Search transactions').fill('QA coffee receipt')
  await expect(page.locator('tbody')).toContainText('$18.30')
  await page
    .getByRole('button', { name: 'Edit QA coffee receipt', exact: true })
    .click()
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete', exact: true })
    .click()
  await expect(
    page.getByText('No transactions found', { exact: true }),
  ).toBeVisible()
})

test('CSV import matches account, categorizes, skips bad rows and avoids reimport duplicates', async ({
  page,
}) => {
  const content =
    'Chase account ending in 4829 (USD)\nDate,Description,Amount\n09/19/2026,QA AMZN Market,-42.50\n09/19/2026,QA Mystery Shop,-19.99\ninvalid,Invalid row,bad'
  const upload = async () => {
    await page
      .getByRole('button', { name: 'Import a statement', exact: false })
      .click()
    await page
      .getByLabel('Choose statement file')
      .setInputFiles({
        name: 'qa-statement.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(content),
      })
    await expect(page.getByLabel('Destination account')).toHaveValue('checking')
    await page
      .getByRole('button', { name: 'Review transactions', exact: true })
      .click()
  }
  await upload()
  await expect(page.getByLabel('Category for QA AMZN Market')).toHaveValue(
    'shopping',
  )
  await expect(page.getByLabel('Category for QA Mystery Shop')).toHaveValue(
    'uncategorized',
  )
  await expect(
    page.getByText('1 skipped source rows', { exact: true }),
  ).toBeVisible()
  await page.getByLabel('I checked the account', { exact: false }).check()
  await page
    .getByRole('button', { name: 'Import 2 transactions', exact: true })
    .click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByLabel('Search transactions').fill('QA ')
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await page.reload()
  await upload()
  await expect(
    page.getByText('2 possible duplicates', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Import 0 transactions', exact: true }),
  ).toBeDisabled()
})

test('real text-based PDF extracts rows and marks them for review', async ({
  page,
}) => {
  const pdf = await PDFDocument.create()
  const sheet = pdf.addPage()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const lines = [
    'Chase - Account ending in 4829 - USD',
    '2026-09-18 QA PDF Coffee 12.50',
    '2026-09-19 QA PDF Amazon 32.99',
  ]
  lines.forEach((line, index) =>
    sheet.drawText(line, { x: 45, y: 760 - index * 25, size: 12, font }),
  )
  await page
    .getByRole('button', { name: 'Import statement', exact: true })
    .click()
  await page
    .getByLabel('Choose statement file')
    .setInputFiles({
      name: 'qa-statement.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(await pdf.save()),
    })
  await expect(page.getByLabel('Destination account')).toHaveValue('checking')
  await page.getByLabel('Positive amounts are card charges').check()
  await page
    .getByRole('button', { name: 'Review transactions', exact: true })
    .click()
  await expect(page.getByLabel('Amount for QA PDF Coffee')).toHaveValue(
    '-12.50',
  )
  await expect(page.locator('.import-preview tbody tr')).toHaveCount(2)
  await expect(page.locator('.import-preview')).toContainText('Needs review')
  await page.getByLabel('I checked the account', { exact: false }).check()
  await page
    .getByRole('button', { name: 'Import 2 transactions', exact: true })
    .click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByLabel('Search transactions').fill('QA PDF')
  await expect(page.locator('tbody tr')).toHaveCount(2)
})

test('custom split validation, equal split creation and settlement work', async ({
  page,
}) => {
  await page.goto('/#shared')
  await page.getByRole('button', { name: 'Add expense', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Expense name').fill('QA group lunch')
  await dialog.getByLabel('Total amount').fill('10.00')
  await dialog.getByLabel('Split method').selectOption('Custom amounts')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog.getByRole('alert')).toContainText(
    'Custom shares must add up',
  )
  await dialog.getByLabel('Split method').selectOption('Equal')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(
    page.getByRole('button', { name: /QA group lunch/ }),
  ).toContainText('$3.34')
  const settlementsBefore = await page.locator('tbody tr').count()
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Settle up', exact: true })
    .first()
    .click()
  await expect(page.locator('tbody tr')).toHaveCount(settlementsBefore + 1)
})

test('salary and timesheet records save without adding bank income', async ({
  page,
}) => {
  await page.goto('/#income')
  await page.getByRole('button', { name: 'Add payslip', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Employer', { exact: true }).fill('QA Employer')
  await dialog.getByLabel('Gross pay').fill('1000')
  await dialog.getByLabel('Tax withheld').fill('200')
  await dialog.getByLabel('Other deductions').fill('50')
  await dialog.getByLabel('Status', { exact: true }).selectOption('Received')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(
    page.locator('tbody tr').filter({ hasText: 'QA Employer' }),
  ).toContainText('$750.00')
  await page.getByRole('button', { name: 'Timesheets', exact: true }).click()
  await page.getByRole('button', { name: 'Log hours', exact: true }).click()
  await dialog.getByLabel('Project / work description').fill('QA Contract')
  await dialog.getByLabel('Hours', { exact: true }).fill('2.5')
  await dialog.getByLabel('Hourly rate').fill('40')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(
    page.locator('tbody tr').filter({ hasText: 'QA Contract' }),
  ).toContainText('$100.00')
  await page.goto('/#transactions')
  await page.getByLabel('Search transactions').fill('QA Employer')
  await expect(
    page.getByText('No transactions found', { exact: true }),
  ).toBeVisible()
})

test('bill payment advances reminder without silently duplicating bank spending', async ({
  page,
}) => {
  await page.goto('/#recurring')
  const row = page
    .locator('tbody tr')
    .filter({ hasText: 'Adobe Creative Cloud' })
  await expect(row).toContainText('Sep 21, 2026')
  await row.getByRole('button', { name: 'Record paid', exact: true }).click()
  await expect(
    page.getByLabel('Also create a bank transaction'),
  ).not.toBeChecked()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save changes' })
    .click()
  await expect(row).toContainText('Oct 21, 2026')
})

test('documents survive a complete backup and restore', async ({
  page,
}, testInfo) => {
  await page.goto('/#documents')
  await page.getByLabel('Document upload type').selectOption('Medical')
  await page
    .getByLabel('Upload document files')
    .setInputFiles({
      name: 'QA-medical.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Item,Cost\nCheckup,50'),
    })
  await expect(
    page.getByRole('heading', { name: 'QA-medical.csv' }),
  ).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Download QA-medical.csv', exact: true })
    .click()
  expect((await downloadPromise).suggestedFilename()).toBe('QA-medical.csv')
  await page.goto('/#settings')
  const backupPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup', exact: true }).click()
  const backup = await backupPromise
  const backupPath = testInfo.outputPath('backup.json')
  await backup.saveAs(backupPath)
  await page.getByRole('button', { name: 'Start fresh', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Confirmation').fill('RESET')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save changes' })
    .click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Clear workspace', exact: true }),
  ).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByLabel('Restore backup file').setInputFiles(backupPath)
  await expect(
    page.getByRole('button', { name: 'Start fresh', exact: true }),
  ).toBeVisible()
  await page.goto('/#documents')
  await expect(
    page.getByRole('heading', { name: 'QA-medical.csv' }),
  ).toBeVisible()
  const restoredPromise = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Download QA-medical.csv', exact: true })
    .click()
  expect((await restoredPromise).suggestedFilename()).toBe('QA-medical.csv')
  await page.getByRole('button', { name: 'Edit QA-medical.csv', exact: true }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'QA-medical.csv' })).not.toBeVisible()
  const storedFiles = await page.evaluate(() => new Promise<string[]>((resolve, reject) => {
    const request = indexedDB.open('folio-finance')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const keys = database.transaction('workspace').objectStore('workspace').getAllKeys()
      keys.onsuccess = () => { resolve(keys.result.map(String).filter(key => key.startsWith('document:'))); database.close() }
    }
  }))
  expect(storedFiles).toEqual([])
})

test('fresh workspace can create its first account and rejects another currency', async ({
  page,
}) => {
  await page.goto('/#settings')
  await page.getByRole('button', { name: 'Start fresh', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Confirmation').fill('RESET')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save changes' })
    .click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page
    .getByRole('button', { name: 'Import a statement', exact: false })
    .click()
  await page
    .getByLabel('Choose statement file')
    .setInputFiles({
      name: 'fresh.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'Date,Description,Amount\n2026-09-19,QA Unknown,-10.25',
      ),
    })
  await expect(page.getByLabel('Destination account')).toHaveValue('new')
  await page.getByLabel('Account nickname').fill('My first bank')
  await page.getByLabel('Statement currency').selectOption('EUR')
  await page
    .getByRole('button', { name: 'Review transactions', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    'Foreign-currency amounts cannot be imported',
  )
  await page.getByLabel('Statement currency').selectOption('USD')
  await page
    .getByRole('button', { name: 'Review transactions', exact: true })
    .click()
  await page.getByLabel('I checked the account', { exact: false }).check()
  await page
    .getByRole('button', { name: 'Import 1 transactions', exact: true })
    .click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.goto('/#accounts')
  await expect(
    page.getByRole('heading', { name: 'My first bank' }),
  ).toBeVisible()
  await expect(page.locator('.account-balance')).toContainText('-$10.25')
})

test('responsive light and dark themes render without overflow', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.screenshot({
    path: testInfo.outputPath('desktop-light.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Dark theme', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.screenshot({
    path: testInfo.outputPath('desktop-dark.png'),
    fullPage: true,
  })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.locator('.sidebar').evaluate(element => Math.round(element.getBoundingClientRect().right))).toBeLessThanOrEqual(0)
  await expect(page.locator('.recharts-pie-sector')).not.toHaveCount(0)
  await page.screenshot({
    path: testInfo.outputPath('mobile-dark.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Light theme', exact: true }).click()
  await page.screenshot({
    path: testInfo.outputPath('mobile-light.png'),
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy()
  await page
    .getByRole('button', { name: 'Open navigation', exact: true })
    .click()
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Shared expenses', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Shared expenses', exact: true }),
  ).toBeVisible()
  for (const route of [
    'transactions',
    'accounts',
    'budgets',
    'recurring',
    'goals',
    'wealth',
    'income',
    'documents',
    'taxes',
    'reports',
    'rules',
    'settings',
  ]) {
    await page.goto(`/#${route}`)
    await expect(page.locator('main h1')).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Horizontal overflow on ${route}`,
    ).toBeTruthy()
  }
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/#overview')
  await expect(page.locator('main h1')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
})
