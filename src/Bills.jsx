import React, { useState } from 'react';
import { CategoryStrip, LineChart } from './Charts.jsx';
import MonthPicker, { useApi } from './MonthPicker.jsx';
import { brl, day, decimal, methodName, monthName, moveMonth, percent, periodName, statusName } from './lib.js';
import { Empty, Header, Progress, RangeButtons, Stat, TransactionTable } from './ui.jsx';

const fineDelay = { day: 'dia', month: 'mês', year: 'ano' };

function BillCard({ item, entry, open, remove, change, setMessage }) {
  const ratePeriod = item.interest_rate_period || item.interest_period;
  return <article className={`bill-card ${item.status}`}>
    <div className="bill-card-top"><span className={`status-pill ${item.status}`}><span />{statusName[item.status]}</span><span className="bill-due">{item.status === 'overdue' ? `${item.days_overdue} dias em atraso` : `Vencimento ${day(item.due_date)}`}</span></div>
    <h3>{item.description}</h3>
    {entry.carried && <span className="pill carry-pill">Atrasada desde {day(item.due_date)}</span>}
    <p className="bill-meta">{item.credit_card_id ? `Fatura do cartão ${item.card_name} · ${item.account_name}` : <>{item.expense_type === 'fixed' ? 'Fixa · ' : 'Eventual · '}{item.category}{item.subcategory_name ? ` / ${item.subcategory_name}` : ''} · {item.account_name} · {methodName[item.payment_method] || 'Pix'}</>}</p>
    {item.note && <p className="card-note">{item.note}</p>}
    <div className="bill-amount"><span>Saldo {item.status === 'paid' ? 'quitado' : 'atualizado'}</span><strong>{brl(item.current_cents)}</strong></div>
    <div className="bill-details"><span>Valor original <b>{brl(item.amount_cents)}</b></span><span>Juros <b>{item.interest_rate_basis_points ? `${decimal(item.interest_rate_basis_points)}% ${periodName[ratePeriod]}${ratePeriod !== item.interest_period ? `, aplicado ${periodName[item.interest_period]}` : ''}` : 'Sem juros'}</b></span>{item.fine_basis_points > 0 && <span>Multa <b>{decimal(item.fine_basis_points)}% após 1 {fineDelay[item.fine_after]}</b></span>}<span>Já pago <b>{brl(item.paid_cents)}</b></span></div>
    {item.payments.length > 0 && <details className="payment-history"><summary>{item.payments.length} pagamentos</summary>{item.payments.map(payment => <div className="payment-row" key={payment.id}><span>{day(payment.date)} · {payment.card_purchase_id ? `Crédito ${payment.card_name}${payment.installments > 1 ? ` · ${payment.installments}x` : ''}` : `${payment.account_name}${payment.payment_method ? ` · ${methodName[payment.payment_method]}` : ''}`}{payment.note && <small className="row-note">{payment.note}</small>}</span><b>{brl(payment.amount_cents)}</b><button onClick={() => remove(`/api/bills/${item.id}/payments/${payment.id}`, payment.card_purchase_id ? 'Excluir este pagamento no crédito e todas as parcelas?' : undefined)} aria-label="Excluir pagamento">×</button></div>)}</details>}
    <div className="bill-actions">
      {item.status !== 'paid' && <><button className="button tiny" onClick={() => open('payment', item)}>Pagar</button><button className="button tiny secondary" onClick={() => open('interest', item)}>Juros e multa</button></>}
      {!item.credit_card_id && <button className="button tiny ghost" onClick={() => open('classification', item)}>Classificar</button>}
      <button className="button tiny ghost" onClick={() => open('billNote', item)}>Observações</button>
      {item.expense_type === 'fixed' && item.series_active && <button className="button tiny ghost" onClick={() => { if (window.confirm('Encerrar a repetição mensal? As próximas despesas ainda não pagas serão removidas.')) change(`/api/bills/${item.id}/stop-recurrence`, 'PATCH').catch(error => setMessage(error.message)); }}>Encerrar repetição</button>}
      {!item.payments.length && !item.credit_card_id && <><button className="button tiny ghost" onClick={() => open('bill', item)}>Editar</button><button className="button tiny ghost" onClick={() => remove(`/api/bills/${item.id}`, item.expense_type === 'fixed' && !item.recurrence_origin_id ? 'Excluir esta série fixa e todas as parcelas sem pagamento?' : undefined)}>{item.expense_type === 'fixed' && !item.recurrence_origin_id ? 'Excluir série' : 'Excluir'}</button></>}
    </div>
  </article>;
}

export default function Bills({ data, open, remove, change, setMessage }) {
  const thisMonth = data.today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [category, setCategory] = useState('all');
  const [method, setMethod] = useState('all');
  const [chartRange, setChartRange] = useState(12);
  const { value: report, error } = useApi(`/api/bills/month?month=${month}`, data);
  const { value: direct } = useApi(`/api/transactions/month?month=${month}`, data);
  const bills = new Map(data.bills.map(item => [item.id, item]));
  const entries = (report?.items || []).map(entry => ({ entry, item: bills.get(entry.id) })).filter(row => row.item);
  const shown = entries.filter(({ item }) => (status === 'all' || item.status === status)
    && (type === 'all' || (item.credit_card_id ? 'invoice' : item.expense_type) === type)
    && (category === 'all' || String(item.category_id) === category)
    && (method === 'all' || (item.credit_card_id ? 'credit' : item.payment_method) === method));
  const toPay = entries.filter(({ entry }) => entry.value_cents > 0);
  const directRows = (direct?.items || []).filter(item => item.kind === 'expense' && (method === 'all' || item.payment_method === method));
  // Month spending by category: bills due this month (invoices excluded, their purchases are already
  // among the direct expenses) plus day-to-day expenses.
  const byCategory = [
    ...entries.filter(({ entry, item }) => !entry.carried && !item.credit_card_id).map(({ item }) => ({ category: item.category, amount_cents: item.amount_cents })),
    ...(direct?.items || []).filter(item => item.kind === 'expense').map(item => ({ category: item.category, amount_cents: item.amount_cents }))];
  const monthTotal = report ? report.fixed.total_cents + report.eventual.total_cents + report.invoice.total_cents : 0;
  const monthPaid = report ? report.fixed.paid_cents + report.eventual.paid_cents + report.invoice.paid_cents : 0;
  return <>
    <Header title="Despesas" subtitle="O que é fixo, o que é eventual, o que atrasou e o que ainda vai vencer no mês." action="Nova despesa" onAction={() => data.accounts.length ? open('bill') : setMessage('Cadastre uma conta primeiro.')} />
    <MonthPicker id="bills-month" value={month} onChange={setMonth} today={data.today} min={report?.first_month?.slice(0, 7)} max={moveMonth(thisMonth, 12)} />
    {error && <div className="panel dashboard-error" role="alert">{error}</div>}
    {!report && !error && <div className="panel dashboard-loading">Carregando despesas do mês...</div>}
    {report && <>
      <section className="stats month-stats">
        <Stat label="Falta pagar" value={brl(report.remaining_cents)} detail={`${brl(report.upcoming_cents)} a vencer · ${brl(report.overdue_cents)} atrasado`} tone="featured"><Progress value={monthPaid} total={monthTotal} label={`${brl(monthPaid)} pagos de ${brl(monthTotal)} do mês`} /><span className="stat-foot">{brl(monthPaid)} pagos de {brl(monthTotal)} que vencem no mês</span></Stat>
        <Stat label="Atrasado" value={brl(report.overdue_cents)} detail={report.overdue_count ? `${report.overdue_count} ${report.overdue_count === 1 ? 'despesa vencida' : 'despesas vencidas'} sem pagamento` : 'Nada vencido'} tone={report.overdue_cents ? 'negative' : 'positive'} />
        <Stat label="Já pago no mês" value={brl(report.paid_cents)} detail={`${report.payments_count} ${report.payments_count === 1 ? 'pagamento' : 'pagamentos'} · ${brl(report.paid_month_bills_cents)} de contas deste mês`} />
        <Stat label="Fixas · custo de vida" value={brl(report.fixed.total_cents)} detail={`${report.fixed.count} contas · falta ${brl(report.fixed.remaining_cents)}${report.living_cost_share_bp != null ? ` · ${percent(report.living_cost_share_bp)} da renda fixa` : ''}`} />
        <Stat label="Eventuais do mês" value={brl(report.eventual.total_cents)} detail={`${report.eventual.count} despesas · falta ${brl(report.eventual.remaining_cents)}${report.invoice.total_cents ? ` · + ${brl(report.invoice.total_cents)} em faturas` : ''}`} />
      </section>
      <section className="panel"><div className="panel-header"><div><div className="eyebrow">POR CATEGORIA</div><h2>Para onde vai o dinheiro em {monthName(`${month}-01`)}</h2><p>Despesas que vencem no mês somadas às saídas avulsas, pelo valor original.</p></div><span className="pill">{brl(byCategory.reduce((sum, item) => sum + item.amount_cents, 0))}</span></div><CategoryStrip rows={byCategory} /></section>
      <section className="panel direct-expenses"><div className="panel-header"><div><div className="eyebrow">DIA A DIA</div><h2>Saídas avulsas do mês</h2><p>Registradas em Lançamentos, inclusive compras no cartão pelo total.</p></div><span className="pill">{brl(directRows.reduce((sum, item) => sum + item.amount_cents, 0))}</span></div>
        <div className="hidden-scroll"><TransactionTable items={directRows} compact /></div>
      </section>
      <section className="panel monthly-payables"><div className="panel-header"><div><div className="eyebrow">CONTAS DO MÊS</div><h2>O que pagar em {monthName(`${month}-01`)}</h2><p>Despesas atrasadas continuam nos meses seguintes até serem quitadas, com juros e multa.</p></div></div>
        <div className="monthly-total"><span>Total em aberto</span><strong>{brl(report.remaining_cents)}</strong></div>
        {toPay.length ? <div className="monthly-list">{toPay.map(({ entry, item }) => <div className="monthly-row" key={item.id}><div><strong>{item.description}</strong><small>{entry.carried ? `Pendente desde ${day(item.due_date)}` : `Vence ${day(item.due_date)}`} · {item.account_name}</small></div><span className={entry.overdue ? 'pill carry-pill' : 'pill'}>{item.credit_card_id ? 'Fatura' : entry.overdue ? 'Atrasada' : item.expense_type === 'fixed' ? 'Fixa' : 'Eventual'}</span><b>{brl(entry.value_cents)}</b></div>)}</div> : <Empty>Nada a pagar neste mês.</Empty>}
      </section>
      <div className="section-heading"><div><h2>Despesas do mês</h2><p>As que vencem em {monthName(`${month}-01`)} e as atrasadas ainda em aberto.</p></div><div className="filter-row">{[['all', 'Todas'], ['pending', 'Pendentes'], ['overdue', 'Vencidas'], ['paid', 'Pagas']].map(([value, label]) => <button key={value} className={`filter ${status === value ? 'active' : ''}`} onClick={() => setStatus(value)}>{label}</button>)}</div></div>
      <div className="inline-filter"><label htmlFor="bill-type-filter">Tipo</label><select id="bill-type-filter" value={type} onChange={event => setType(event.target.value)}><option value="all">Todos os tipos</option><option value="fixed">Fixas</option><option value="eventual">Eventuais</option><option value="invoice">Faturas do cartão</option></select><label htmlFor="bill-category-filter">Categoria</label><select id="bill-category-filter" value={category} onChange={event => setCategory(event.target.value)}><option value="all">Todas as categorias</option>{data.categories.filter(item => item.kind === 'expense').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><label htmlFor="bill-method-filter">Pagamento</label><select id="bill-method-filter" value={method} onChange={event => setMethod(event.target.value)}><option value="all">Todas as formas</option>{Object.entries(methodName).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="bill-grid">{shown.map(({ entry, item }) => <BillCard key={item.id} item={item} entry={entry} open={open} remove={remove} change={change} setMessage={setMessage} />)}</div>
      {!shown.length && <div className="panel"><Empty>Nenhuma despesa neste filtro.</Empty></div>}
    </>}
    <section className="panel chart-panel debt-chart"><div className="panel-header"><div><div className="eyebrow">CENÁRIO</div><h2>Se nada mais for pago</h2><p>Saldo devedor projetado com juros</p></div><RangeButtons value={chartRange} onChange={setChartRange} /></div><LineChart series={data.debt_series.slice(0, chartRange + 1)} title="Projeção de dívidas" accent="#dca792" /></section>
  </>;
}
