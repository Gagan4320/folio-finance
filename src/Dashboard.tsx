import { useState } from 'react'
import { addMonths, format, parseISO, subMonths } from 'date-fns'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Upload,
  Plus,
  ArrowRight,
  Sparkles,
  CalendarDays,
  ShieldCheck,
  ArrowDownRight,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { useFinance } from './store'
import { accountBalance, currency, currentMonth, totals } from './finance'
import {
  Empty,
  IconButton,
  MerchantIcon,
  PageTitle,
  Progress,
  SectionTitle,
  Stat,
  TransactionTable,
  ViewAll,
} from './components'

export function CashFlow({
  month,
  full = false,
}: {
  month: string
  full?: boolean
}) {
  const { state } = useFinance()
  const data = Array.from({ length: 6 }, (_, index) => {
    const date = subMonths(parseISO(`${month}-01`), 5 - index)
    const prefix = format(date, 'yyyy-MM')
    const values = totals(
      state.transactions.filter((item) => item.date.startsWith(prefix)),
    )
    return {
      name: format(date, 'MMM'),
      Income: values.income / 100,
      Spending: values.spent / 100,
    }
  })
  return (
    <div
      className={`cash-chart ${full ? 'full-chart' : ''}`}
      aria-label="Income and spending over six months"
      role="img"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 18, right: 6, bottom: 0, left: -18 }}
        >
          <defs>
            <linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64ac8c" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#64ac8c" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="spending-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#acb4ad" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#acb4ad" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--line)"
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--muted)', fontSize: 10 }}
            tickFormatter={(value) =>
              currency(Number(value) * 100, state.settings.currency, true)
            }
            width={72}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--text)',
            }}
            formatter={(value) =>
              currency(Number(value) * 100, state.settings.currency)
            }
          />
          <Area
            isAnimationActive={false}
            name="Income"
            type="monotone"
            dataKey="Income"
            stroke="#298867"
            strokeWidth={2.5}
            fill="url(#income-fill)"
            activeDot={{ r: 5, strokeWidth: 3, stroke: 'var(--surface)' }}
          />
          <Area
            isAnimationActive={false}
            name="Spending"
            type="monotone"
            dataKey="Spending"
            stroke="#b5b9ad"
            strokeWidth={2}
            fill="url(#spending-fill)"
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SpendingBreakdown({ month }: { month: string }) {
  const { state } = useFinance()
  const transactions = state.transactions.filter(
    (item) =>
      item.date.startsWith(month) &&
      item.amount < 0 &&
      item.category !== 'transfer',
  )
  const spent = totals(transactions).spent
  const all = state.categories
    .map((category) => ({
      ...category,
      value: -transactions
        .filter((item) => item.category === category.id)
        .reduce((sum, item) => sum + item.amount, 0),
    }))
    .filter((item) => item.value > 0)
    .sort((first, second) => second.value - first.value)
  const data =
    all.length > 5
      ? [
          ...all.slice(0, 4),
          {
            id: 'other',
            name: 'Other',
            color: '#c7cec7',
            budget: 0,
            value: all.slice(4).reduce((sum, item) => sum + item.value, 0),
          },
        ]
      : all
  if (!spent)
    return (
      <Empty
        title="A fresh month"
        text="Your spending breakdown will appear here."
      />
    )
  return (
    <div className="breakdown-content">
      <div className="donut-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              isAnimationActive={false}
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={66}
              outerRadius={86}
              paddingAngle={3}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((item) => (
                <Cell key={item.id} fill={item.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) =>
                currency(Number(value), state.settings.currency)
              }
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 6,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-label">
          <span>Total spent</span>
          <strong>{currency(spent, state.settings.currency, true)}</strong>
          <small>{format(parseISO(`${month}-01`), 'MMMM')}</small>
        </div>
      </div>
      <div className="category-legend">
        {data.map((item) => (
          <div key={item.id}>
            <span className="legend-dot" style={{ background: item.color }} />
            <span>{item.name}</span>
            <strong>{Math.round((item.value / spent) * 100)}%</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { state, navigate, edit, setImporting } = useFinance()
  const [month, setMonth] = useState(currentMonth())
  const money = (amount: number, compact = false) =>
    currency(amount, state.settings.currency, compact)
  const selected = state.transactions.filter((item) =>
    item.date.startsWith(month),
  )
  const { income, spent } = totals(selected)
  const previous = totals(
    state.transactions.filter((item) =>
      item.date.startsWith(
        format(subMonths(parseISO(`${month}-01`), 1), 'yyyy-MM'),
      ),
    ),
  )
  const balance = state.accounts.reduce(
    (sum, item) => sum + accountBalance(item, state.transactions),
    0,
  )
  const netWorth =
    balance +
    state.assets.reduce((sum, item) => sum + item.value, 0) -
    state.debts.reduce((sum, item) => sum + item.balance, 0)
  const savingsRate = income ? Math.round(((income - spent) / income) * 100) : 0
  const review = state.transactions.filter((item) => item.review).length
  const bills = state.bills
    .filter((item) => item.active)
    .sort((first, second) => first.due.localeCompare(second.due))
    .slice(0, 3)
  const goal =
    state.goals.find((item) => item.kind === 'Travel') || state.goals[0]
  const budgets = state.categories
    .filter((item) => item.budget > 0 && item.id !== 'housing')
    .map((item) => ({
      ...item,
      spent: totals(
        selected.filter((transaction) => transaction.category === item.id),
      ).spent,
    }))
    .sort(
      (first, second) =>
        second.spent / second.budget - first.spent / first.budget,
    )
    .slice(0, 3)
  return (
    <>
      <PageTitle
        eyebrow="YOUR MONEY, IN PERSPECTIVE"
        title={`A little clarity. A lot of possibility.`}
        description={`Here's where things stand, ${state.settings.name.split(' ')[0]}.`}
      >
        <button className="button" onClick={() => edit('transactions')}>
          <Plus size={16} />
          Add transaction
        </button>
        <button className="button primary" onClick={() => setImporting(true)}>
          <Upload size={16} />
          Import statement
        </button>
      </PageTitle>
      <div className="overview-toolbar">
        <div className="view-label">
          <span className="live-dot" />
          Financial overview
          {state.demo && <span className="demo-badge">Demo workspace</span>}
        </div>
        <div className="month-control">
          <IconButton
            label="Previous month"
            onClick={() =>
              setMonth(format(subMonths(parseISO(`${month}-01`), 1), 'yyyy-MM'))
            }
          >
            <ChevronLeft size={15} />
          </IconButton>
          <CalendarDays size={14} />
          <span>{format(parseISO(`${month}-01`), 'MMMM yyyy')}</span>
          <IconButton
            label="Next month"
            disabled={month >= currentMonth()}
            onClick={() =>
              setMonth(format(addMonths(parseISO(`${month}-01`), 1), 'yyyy-MM'))
            }
          >
            <ChevronRight size={15} />
          </IconButton>
        </div>
      </div>
      <div className="stats-grid">
        <Stat
          title="Total net worth"
          value={money(netWorth)}
          note="All accounts, assets & debts"
          icon={<Wallet size={18} />}
          featured
        />
        <Stat
          title="Money in"
          value={money(income)}
          note={previous.income ? 'vs. previous month' : 'This month'}
          trend={
            previous.income
              ? `${(((income - previous.income) / previous.income) * 100).toFixed(1)}%`
              : undefined
          }
          icon={<ArrowDownLeft size={18} />}
        />
        <Stat
          title="Money out"
          value={money(spent)}
          note={`${selected.filter((item) => item.amount < 0 && item.category !== 'transfer').length} transactions this month`}
          icon={<ArrowUpRight size={18} />}
        />
        <Stat
          title="Savings rate"
          value={`${savingsRate}%`}
          note={`${money(income - spent, true)} left after spending`}
          icon={<TrendingUp size={18} />}
        />
      </div>
      <div className="dashboard-charts">
        <section className="section-block cash-section">
          <SectionTitle
            title="Money in, money out"
            subtitle="The bigger picture, month by month"
          >
            <div className="chart-key">
              <span>
                <i className="green-dot" />
                Income
              </span>
              <span>
                <i className="gray-dot" />
                Spending
              </span>
            </div>
          </SectionTitle>
          <CashFlow month={month} />
          <div className="chart-foot">
            <span>
              <span className="tiny-icon">
                <TrendingUp size={14} />
              </span>
              {income >= spent
                ? 'Living within your means looks good on you.'
                : 'Spending is above income this month.'}
            </span>
            <ViewAll onClick={() => navigate('reports')} text="Full report" />
          </div>
        </section>
        <section className="section-block">
          <SectionTitle
            title="Where it goes"
            subtitle="Your spending, broken down"
          >
            <IconButton
              label="View spending report"
              onClick={() => navigate('reports')}
            >
              <ArrowUpRight size={17} />
            </IconButton>
          </SectionTitle>
          <SpendingBreakdown month={month} />
        </section>
      </div>
      {review > 0 && (
        <button
          className="review-banner"
          onClick={() => {
            sessionStorage.setItem('folio-review', 'true')
            navigate('transactions')
          }}
        >
          <span className="review-banner-icon">
            <Sparkles size={18} />
          </span>
          <span>
            <strong>A few things need your eye</strong>
            <small>
              {review} transactions are waiting to be categorized. Make them
              feel at home.
            </small>
          </span>
          <span className="review-action">
            Review transactions
            <ArrowRight size={16} />
          </span>
        </button>
      )}
      <div className="dashboard-lower">
        <div className="dashboard-main">
          <section className="section-block recent-section">
            <SectionTitle
              title="Recent transactions"
              subtitle="The everyday details"
            >
              <ViewAll onClick={() => navigate('transactions')} />
            </SectionTitle>
            <TransactionTable
              transactions={[...selected]
                .sort((first, second) => second.date.localeCompare(first.date))
                .slice(0, 5)}
              compact
            />
          </section>
          <section className="section-block account-strip">
            <SectionTitle
              title="Your accounts"
              subtitle={`${state.accounts.length} accounts. One clear picture.`}
            >
              <ViewAll onClick={() => navigate('accounts')} />
            </SectionTitle>
            <div className="mini-accounts">
              {state.accounts.map((account) => (
                <button
                  key={account.id}
                  className="mini-account"
                  onClick={() => edit('accounts', account)}
                >
                  <span
                    className="bank-mark"
                    style={{ background: account.color }}
                  >
                    {account.bank.slice(0, 1) || 'C'}
                  </span>
                  <span>
                    <strong>
                      {account.bank || account.name}
                      <small>
                        {account.type} &middot; {account.last4 || 'Cash'}
                      </small>
                    </strong>
                    <b>{money(accountBalance(account, state.transactions))}</b>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
        <aside className="dashboard-aside">
          <section className="section-block upcoming-section">
            <SectionTitle
              title="On the horizon"
              subtitle="Upcoming bills & subscriptions"
            >
              <ViewAll onClick={() => navigate('recurring')} text="All" />
            </SectionTitle>
            <div className="bill-list">
              {bills.map((bill) => (
                <button
                  key={bill.id}
                  className="bill-row"
                  onClick={() => edit('bills', bill)}
                >
                  <MerchantIcon
                    name={bill.name}
                    category={bill.category}
                    small
                  />
                  <span>
                    <strong>{bill.name}</strong>
                    <small>
                      {format(parseISO(bill.due), 'MMM d')}
                      <span className="inline-dot">&middot;</span>
                      {bill.cycle}
                    </small>
                  </span>
                  <b>{money(bill.amount)}</b>
                </button>
              ))}
              {!bills.length && (
                <Empty
                  title="All clear"
                  text="No upcoming bills."
                  onClick={() => edit('bills')}
                  action="Add bill"
                />
              )}
            </div>
          </section>
          {goal && (
            <section className="goal-feature">
              <img
                src="/alpine-lake.jpg"
                alt="Lake Como and the Italian Alps"
              />
              <div className="goal-image-shade" />
              <div className="goal-feature-top">
                <span>ONE STEP CLOSER</span>
                <IconButton
                  label="Edit savings goal"
                  onClick={() => edit('goals', goal)}
                >
                  <ArrowUpRight size={18} />
                </IconButton>
              </div>
              <div className="goal-feature-content">
                <h3>{goal.name}</h3>
                <p>
                  {money(goal.saved, true)}{' '}
                  <span>of {money(goal.target, true)}</span>
                </p>
                <Progress
                  value={goal.target ? (goal.saved / goal.target) * 100 : 0}
                />
                <div>
                  <span>
                    {goal.target
                      ? Math.round((goal.saved / goal.target) * 100)
                      : 0}
                    % of the way there
                  </span>
                  <button onClick={() => navigate('goals')}>
                    Your goals
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </section>
          )}
        </aside>
      </div>
      <section className="section-block budget-overview">
        <SectionTitle
          title="A little room to live"
          subtitle="Your monthly budgets at a glance"
        >
          <ViewAll onClick={() => navigate('budgets')} text="Manage budgets" />
        </SectionTitle>
        <div className="budget-mini-grid">
          {budgets.map((category) => (
            <button
              className="budget-mini"
              key={category.id}
              onClick={() => edit('categories', category)}
            >
              <div>
                <span
                  className="legend-dot"
                  style={{ background: category.color }}
                />
                <strong>{category.name}</strong>
                <span>
                  {money(category.spent, true)}{' '}
                  <small>/ {money(category.budget, true)}</small>
                </span>
              </div>
              <Progress
                value={(category.spent / category.budget) * 100}
                color={
                  category.spent > category.budget
                    ? 'var(--danger)'
                    : category.color
                }
              />
              <small>
                {category.spent > category.budget
                  ? `${money(category.spent - category.budget, true)} over budget`
                  : `${money(category.budget - category.spent, true)} left to spend`}
              </small>
            </button>
          ))}
        </div>
      </section>
      <footer className="page-footer">
        <span>
          <ShieldCheck size={13} />
          Stored on this device. Your money stays your business.
        </span>
        <span>
          Make room for what matters.
          <ArrowDownRight size={13} />
        </span>
      </footer>
    </>
  )
}
