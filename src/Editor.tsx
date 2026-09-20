import type { Collection } from './model'
import { currentMonth, equalShares, today, uid } from './finance'
import { FormDialog, Modal } from './components'
import type { Field, Values } from './components'
import { useFinance } from './store'
import { removeDocuments } from './storage'

const options = (values: string[]) =>
  values.map((value) => ({ value, label: value }))
const text = (name: string, label: string, required = true): Field => ({
  name,
  label,
  required,
})
const money = (name: string, label: string, signed = false): Field => ({
  name,
  label,
  type: 'money',
  min: signed ? undefined : 0,
})
const select = (name: string, label: string, values: string[]): Field => ({
  name,
  label,
  type: 'select',
  options: options(values),
})
const date = (name: string, label: string): Field => ({
  name,
  label,
  type: 'date',
})

export default function EntityEditor() {
  const { state, editor, closeEditor, commit, edit } = useFinance()
  if (!editor) return null
  const collection = editor.collection
  const record = editor.record
  const account: Field = {
    name: 'accountId',
    label: 'Account',
    type: 'select',
    options: state.accounts.map((item) => ({
      value: item.id,
      label: `${item.bank} - ${item.name} ${item.last4 ? `(${item.last4})` : ''}`,
    })),
  }
  const category: Field = {
    name: 'category',
    label: 'Category',
    type: 'select',
    options: state.categories.map((item) => ({
      value: item.id,
      label: item.name,
    })),
  }
  const group =
    state.groups.find(
      (item) => item.id === (record?.groupId || editor.groupId),
    ) || state.groups[0]
  if (['transactions', 'bills'].includes(collection) && !state.accounts.length)
    return (
      <Modal title="Add an account first" onClose={closeEditor}>
        <div className="notice">
          An account keeps your balance and transactions connected.
        </div>
        <div className="modal-footer">
          <button className="button primary" onClick={() => edit('accounts')}>
            Add account
          </button>
        </div>
      </Modal>
    )
  if (['shared', 'settlements'].includes(collection) && !group)
    return (
      <Modal title="Create a group first" onClose={closeEditor}>
        <div className="modal-footer">
          <button className="button primary" onClick={() => edit('groups')}>
            Create group
          </button>
        </div>
      </Modal>
    )
  const definitions: Record<
    Collection,
    {
      title: string
      fields: Field[]
      defaults: Record<string, unknown>
      note?: string
    }
  > = {
    accounts: {
      title: 'account',
      fields: [
        text('name', 'Account nickname'),
        text('bank', 'Bank / institution', false),
        select('type', 'Account type', [
          'Checking',
          'Savings',
          'Credit card',
          'Cash',
        ]),
        text('last4', 'Last four digits', false),
        money('opening', 'Opening balance', true),
        { name: 'color', label: 'Account color', type: 'color' },
      ],
      defaults: {
        type: 'Checking',
        bank: '',
        last4: '',
        opening: 0,
        color: '#26745b',
      },
      note: 'Opening balance is the balance before your first recorded transaction. Enter credit card debt as a negative balance.',
    },
    transactions: {
      title: 'transaction',
      fields: [
        text('merchant', 'Merchant / payee'),
        money('amount', 'Amount'),
        select('flow', 'Direction', ['Expense', 'Income']),
        date('date', 'Transaction date'),
        account,
        category,
        text('description', 'Statement description', false),
        { name: 'notes', label: 'Notes', type: 'textarea', required: false },
        {
          name: 'deductible',
          label: 'Flag as potentially tax-deductible',
          type: 'checkbox',
        },
        { name: 'review', label: 'Keep in review queue', type: 'checkbox' },
      ],
      defaults: {
        amount: 0,
        date: today(),
        accountId: state.accounts[0]?.id,
        category: 'uncategorized',
        notes: '',
        description: '',
        deductible: false,
        review: false,
        flow: record && Number(record.amount) > 0 ? 'Income' : 'Expense',
      },
    },
    categories: {
      title: 'category & budget',
      fields: [
        text('name', 'Category name'),
        money('budget', 'Monthly budget'),
        { name: 'color', label: 'Chart color', type: 'color' },
      ],
      defaults: { color: '#258566', budget: 0 },
    },
    bills: {
      title: 'recurring payment',
      fields: [
        text('name', 'Payee / service'),
        money('amount', 'Amount per payment'),
        select('kind', 'Payment type', ['Bill', 'Subscription']),
        select('cycle', 'Frequency', ['Monthly', 'Yearly', 'Weekly', 'Once']),
        date('due', 'Next due date'),
        account,
        category,
        { name: 'active', label: 'Active reminder', type: 'checkbox' },
      ],
      defaults: {
        amount: 0,
        kind: 'Bill',
        cycle: 'Monthly',
        due: today(),
        category: 'subscriptions',
        accountId: state.accounts[0]?.id,
        active: true,
      },
    },
    goals: {
      title: 'savings goal',
      fields: [
        text('name', 'Goal name'),
        select('kind', 'Goal type', [
          'Emergency fund',
          'Travel',
          'Home',
          'Education',
          'Other',
        ]),
        money('target', 'Target amount'),
        money('saved', 'Amount set aside'),
        date('date', 'Target date'),
      ],
      defaults: { kind: 'Other', target: 0, saved: 0, date: today() },
      note: 'Goal allocations are tracking amounts, not additional assets or bank transfers.',
    },
    groups: {
      title: 'expense group',
      fields: [
        text('name', 'Group name'),
        {
          name: 'members',
          label: 'Members (comma separated)',
          hint: 'Include You for your own balance.',
          disabled: Boolean(
            record &&
            (state.shared.some((item) => item.groupId === record.id) ||
              state.settlements.some((item) => item.groupId === record.id)),
          ),
        },
      ],
      defaults: { members: 'You, ' },
      note: 'Shared expenses have a separate ledger and do not change your bank balances.',
    },
    shared: {
      title: 'shared expense',
      fields: [
        text('name', 'Expense name'),
        money('amount', 'Total amount'),
        date('date', 'Date'),
        select('paidBy', 'Paid by', group?.members || []),
        select('splitMode', 'Split method', ['Equal', 'Custom amounts']),
        ...(group?.members || []).map((member, index) => ({
          ...money(`share${index}`, `${member}: custom share`),
          required: false,
        })),
      ],
      defaults: {
        date: today(),
        amount: 0,
        groupId: group?.id,
        paidBy: group?.members[0],
        splitMode: 'Equal',
      },
      note: `Group: ${group?.name || ''}. Custom shares must add up to the total. Equal splits ignore the custom fields.`,
    },
    settlements: {
      title: 'settlement',
      fields: [
        select('from', 'Paid by', group?.members || []),
        select('to', 'Paid to', group?.members || []),
        money('amount', 'Amount'),
        date('date', 'Payment date'),
      ],
      defaults: {
        groupId: group?.id,
        from: group?.members[0],
        to: group?.members[1],
        amount: 0,
        date: today(),
      },
      note: 'Records a payment already made. No money is sent, and bank transactions are not created.',
    },
    payslips: {
      title: 'payslip',
      fields: [
        text('employer', 'Employer'),
        { name: 'period', label: 'Pay period', type: 'month' },
        money('gross', 'Gross pay'),
        money('tax', 'Tax withheld'),
        money('other', 'Other deductions'),
        date('date', 'Payment date'),
        select('status', 'Status', ['Expected', 'Received']),
      ],
      defaults: {
        period: currentMonth(),
        gross: 0,
        tax: 0,
        other: 0,
        date: today(),
        status: 'Expected',
      },
      note: 'Payslips are records only. Add or import the matching bank deposit separately.',
    },
    timesheets: {
      title: 'time entry',
      fields: [
        text('project', 'Project / work description'),
        date('date', 'Work date'),
        { name: 'hours', label: 'Hours', type: 'number', min: 0.01, max: 24 },
        money('rate', 'Hourly rate'),
        select('status', 'Status', ['Draft', 'Submitted', 'Approved']),
      ],
      defaults: { date: today(), hours: 8, rate: 0, status: 'Draft' },
    },
    assets: {
      title: 'asset',
      fields: [
        text('name', 'Asset name'),
        select('type', 'Asset type', ['Investment', 'Property', 'Other']),
        money('value', 'Current value'),
        money('cost', 'Cost basis'),
      ],
      defaults: { type: 'Investment', value: 0, cost: 0 },
      note: 'Enter valuations manually. Do not add an asset already counted in an account.',
    },
    debts: {
      title: 'debt',
      fields: [
        text('name', 'Loan name'),
        money('balance', 'Outstanding balance'),
        {
          name: 'apr',
          label: 'Annual interest rate (%)',
          type: 'number',
          min: 0,
          max: 100,
        },
        money('payment', 'Monthly payment'),
      ],
      defaults: { balance: 0, apr: 0, payment: 0 },
      note: 'Do not add credit card debt already represented by an account balance.',
    },
    documents: {
      title: 'document details',
      fields: [
        text('name', 'Document name'),
        select('kind', 'Document type', [
          'Statement',
          'Receipt',
          'Medical',
          'Tax',
          'Payslip',
          'Other',
        ]),
        {
          name: 'year',
          label: 'Tax year',
          type: 'number',
          min: 1900,
          max: 2200,
        },
        money('amount', 'Related amount'),
        { name: 'note', label: 'Notes', type: 'textarea', required: false },
      ],
      defaults: {
        mime: '',
        size: 0,
        created: today(),
        hasFile: false,
        kind: 'Other',
        year: String(new Date().getFullYear()),
        amount: 0,
        note: '',
      },
    },
    rules: {
      title: 'categorization rule',
      fields: [
        text('keyword', 'Description contains'),
        category,
        text('merchant', 'Rename merchant to', false),
      ],
      defaults: { category: 'uncategorized', merchant: '' },
      note: 'Case-insensitive. Rules run top to bottom, before built-in merchant matching. Use Apply rules to update existing transactions.',
    },
  }
  const definition = definitions[collection]
  const initial = { ...definition.defaults, ...record }
  if (collection === 'transactions' && record)
    initial.amount = Math.abs(Number(record.amount))
  if (collection === 'groups' && record)
    initial.members = (record.members as string[]).join(', ')
  if (collection === 'shared' && record) {
    initial.splitMode = 'Custom amounts'
    group?.members.forEach((member, index) => {
      initial[`share${index}`] =
        (record.shares as Record<string, number>)[member] || 0
    })
  }
  const save = (values: Values) => {
    const result: Record<string, unknown> = {
      ...initial,
      ...values,
      id: record?.id || uid(),
    }
    if (collection === 'transactions') {
      result.amount =
        Number(values.amount) * (values.flow === 'Expense' ? -1 : 1)
      if (!values.amount) throw new Error('Amount must be greater than zero.')
      result.description = values.description || values.merchant
      delete result.flow
    }
    if (
      collection === 'categories' &&
      state.categories.some(
        (item) =>
          item.name.toLowerCase() === String(values.name).toLowerCase() &&
          item.id !== result.id,
      )
    )
      throw new Error('A category with this name already exists.')
    if (collection === 'accounts' && !/^\d{0,4}$/.test(String(values.last4)))
      throw new Error('Use up to four digits, never your full account number.')
    if (collection === 'goals' && Number(values.target) <= 0)
      throw new Error('Set a target greater than zero.')
    if (collection === 'groups') {
      result.members = String(values.members)
        .split(',')
        .map((member) => member.trim())
        .filter(Boolean)
      if ((result.members as string[]).length < 2)
        throw new Error('Add at least two members.')
    }
    if (collection === 'shared' && group) {
      if (Number(values.amount) <= 0)
        throw new Error('Amount must be greater than zero.')
      result.groupId = group.id
      result.shares =
        values.splitMode === 'Equal'
          ? equalShares(Number(values.amount), group.members)
          : Object.fromEntries(
              group.members.map((member, index) => [
                member,
                Number(values[`share${index}`] || 0),
              ]),
            )
      if (
        Object.values(result.shares as Record<string, number>).reduce(
          (sum, value) => sum + value,
          0,
        ) !== values.amount
      )
        throw new Error('Custom shares must add up to the total amount.')
      delete result.splitMode
      group.members.forEach((_, index) => delete result[`share${index}`])
    }
    if (collection === 'settlements') {
      result.groupId = group?.id
      if (values.from === values.to || Number(values.amount) <= 0)
        throw new Error(
          'Choose different members and an amount greater than zero.',
        )
    }
    if (
      collection === 'payslips' &&
      Number(values.tax) + Number(values.other) > Number(values.gross)
    )
      throw new Error('Deductions cannot exceed gross pay.')
    if (collection === 'documents') result.year = String(values.year)
    commit(
      (draft) => {
        const list = draft[collection] as { id: string }[]
        const index = list.findIndex((item) => item.id === result.id)
        if (index >= 0) list[index] = result as { id: string }
        else list.push(result as { id: string })
      },
      `${record?.id ? 'Updated' : 'Added'} ${definition.title}: ${result.name || result.merchant || result.employer || result.project || result.keyword || 'record'}`,
    )
  }
  const remove = async () => {
    if (collection === 'documents' && record?.hasFile) await removeDocuments([String(record.id)])
    commit((draft) => {
      if (
        collection === 'accounts' &&
        (draft.transactions.some((item) => item.accountId === record?.id) ||
          draft.bills.some((item) => item.accountId === record?.id))
      )
        throw new Error(
          'Move or remove the transactions and bills attached to this account first.',
        )
      if (
        collection === 'categories' &&
        (['uncategorized', 'transfer'].includes(String(record?.id)) ||
          draft.transactions.some((item) => item.category === record?.id) ||
          draft.bills.some((item) => item.category === record?.id) ||
          draft.rules.some((item) => item.category === record?.id))
      )
        throw new Error(
          'This category is required or still in use. Reassign its transactions, bills, and rules first.',
        )
      if (
        collection === 'groups' &&
        (draft.shared.some((item) => item.groupId === record?.id) ||
          draft.settlements.some((item) => item.groupId === record?.id))
      )
        throw new Error("Delete this group's expenses and settlements first.")
      const list = draft[collection] as { id: string }[]
      list.splice(
        list.findIndex((item) => item.id === record?.id),
        1,
      )
    }, `Deleted ${definition.title}`)
  }
  return (
    <FormDialog
      key={`${collection}-${String(record?.id || 'new')}`}
      title={`${record?.id ? 'Edit' : 'Add'} ${definition.title}`}
      subtitle={definition.note}
      fields={definition.fields}
      initial={initial}
      onSave={save}
      onClose={closeEditor}
      onDelete={record?.id ? remove : undefined}
    />
  )
}
