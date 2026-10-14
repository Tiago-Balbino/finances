import React, { useState } from 'react';
import { LineChart, SpendingChart } from './Charts.jsx';
import MonthPicker, { useApi } from './MonthPicker.jsx';
import { brl, day, methodName, monthName, moveMonth, percent } from './lib.js';
import { Progress, Stat } from './ui.jsx';

function FlowChart({ rows, month }) {
  const grouped = new Map();
  for (const row of rows) {
    const dayNumber = Number(row.date.slice(-2));
    if (!grouped.has(dayNumber)) grouped.set(dayNumber, { income: 0, expense: 0 });
    grouped.get(dayNumber)[row.kind] += row.amount_cents;
  }
  const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const points = Array.from({ length: last }, (_, index) => ({ day: index + 1, ...(grouped.get(index + 1) || { income: 0, expense: 0 }) }));
  const maximum = Math.max(1, ...points.flatMap(point => [point.income, point.expense]));
  return <div className="flow-chart" role="img" aria-label="Entradas e saídas por dia no mês selecionado">
    <div className="flow-legend"><span><i className="flow-income" />Entradas</span><span><i className="flow-expense" />Saídas</span></div>
    <div className="flow-columns">{points.map(point => <div className="flow-day" key={point.day} title={`Dia ${point.day}: ${brl(point.income)} em entradas, ${brl(point.expense)} em saídas`}><div className="flow-pair"><span className="flow-income" style={{ height: `${Math.max(point.income ? 5 : 2, point.income / maximum * 100)}%` }} /><span className="flow-expense" style={{ height: `${Math.max(point.expense ? 5 : 2, point.expense / maximum * 100)}%` }} /></div><small>{point.day % 5 === 1 || point.day === last ? point.day : ''}</small></div>)}</div>
  </div>;
}

function ForecastView({ report, onMonth }) {
  const point = report.forecast;
  const short = point.gap_cents < 0;
  return <>
    <section className="stats dashboard-stats"><Stat label="Saldo projetado" value={brl(point.balance_cents)} detail="Saldo de hoje + entradas previstas até o fim do mês" tone="featured" /><Stat label="Entradas previstas" value={brl(point.receivable_cents)} detail={`${point.income_items.length} ${point.income_items.length === 1 ? 'entrada' : 'entradas'} até o fim do mês`} /><Stat label="A pagar acumulado" value={brl(point.payable_cents)} detail={`${brl(point.payable_month_cents)} deste mês · ${brl(point.payable_carried_cents)} de meses anteriores`} /><Stat label={short ? 'Falta para pagar tudo' : 'Sobra se pagar tudo'} value={brl(Math.abs(point.gap_cents))} detail="Saldo projetado menos o acumulado a pagar" tone={short ? 'negative' : 'positive'} /></section>
    <p className="forecast-note">Previsão: nenhuma despesa em aberto é considerada paga. O que vence e não é pago continua nos meses seguintes com juros e multa, e o saldo não é reduzido por essas despesas.</p>
    <div className="grid-two dashboard-charts">
      <section className="panel"><div className="panel-header"><div><div className="eyebrow">EM ABERTO</div><h2>O que estará para pagar</h2><p>Valores atualizados até o fim de {monthName(report.month)}.</p></div></div>
        {point.items.length ? <div className="monthly-list forecast-list">{point.items.map(item => <div className="monthly-row" key={item.id}><div><strong>{item.description}</strong><small>{item.carried ? `Em aberto desde ${day(item.due_date)}` : `Vence ${day(item.due_date)}`} · {item.account_name}{item.value_cents > item.amount_cents ? ` · + ${brl(item.value_cents - item.amount_cents)} de juros e multa` : ''}</small></div><span className={item.carried ? 'pill carry-pill' : 'pill'}>{item.card_name ? 'Fatura' : item.carried ? 'Anterior' : 'Deste mês'}</span><b>{brl(item.value_cents)}</b></div>)}</div> : <div className="chart-empty"><span>◌</span>Nada em aberto neste mês.</div>}
      </section>
      <section className="panel"><div className="panel-header"><div><div className="eyebrow">PRÓXIMOS MESES</div><h2>Saldo e acumulado</h2><p>Selecione um mês para ver os detalhes.</p></div></div>
        <div className="forecast-months">{report.series.map(item => <button type="button" key={item.date} className={`forecast-month ${item.date === report.month ? 'selected' : ''}`} onClick={() => onMonth(item.date.slice(0, 7))}><span>{monthName(item.date).replace(/^./, letter => letter.toUpperCase())}</span><small>Saldo {brl(item.balance_cents)} · a pagar {brl(item.payable_cents)}</small><b className={item.gap_cents < 0 ? 'amount-minus' : 'amount-plus'}>{brl(item.gap_cents)}</b></button>)}</div>
      </section>
    </div>
    <section className="panel chart-panel"><div className="panel-header"><div><div className="eyebrow">TENDÊNCIA</div><h2>Sobra ou falta projetada</h2><p>Saldo projetado menos tudo o que estaria em aberto em cada mês.</p></div></div><LineChart series={report.series.map(item => ({ date: item.date, value_cents: item.gap_cents }))} title="Sobra ou falta projetada" accent="#a8cb9b" /></section>
  </>;
}

function CardInvoices({ cards, onView }) {
  if (!cards.length) return <div className="chart-empty"><span>▭</span>Nenhum cartão cadastrado.<button className="link-button" onClick={() => onView('cards')}>Cadastrar cartão →</button></div>;
  return <div className="card-invoices">{cards.map(card => <button type="button" className="card-invoice" key={card.id} onClick={() => onView('cards')}>
    <span className="card-invoice-head"><span><strong>{card.name}</strong><small>{card.invoice ? `Vence ${day(card.invoice.due_date)} · ${card.invoice.note}` : 'Nenhuma fatura em aberto'}</small></span>{card.invoice?.status === 'overdue' && <span className="status-pill overdue"><span />Vencida</span>}<b className={card.invoice?.status === 'overdue' ? 'amount-minus' : ''}>{brl(card.invoice?.current_cents || 0)}</b></span>
    <Progress value={card.used_cents} total={card.limit_cents} label={`${brl(card.used_cents)} usados de ${brl(card.limit_cents)}`} />
    <small>{brl(card.available_cents)} disponível de {brl(card.limit_cents)}{card.open_invoices_cents > (card.invoice?.current_cents || 0) ? ` · ${brl(card.open_invoices_cents)} somando as próximas faturas` : ''}</small>
  </button>)}</div>;
}

export default function Dashboard({ data, onAccount, onView }) {
  const thisMonth = data.today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [accountId, setAccountId] = useState('all');
  const params = new URLSearchParams({ month });
  if (accountId !== 'all') params.set('accountId', accountId);
  const { value: current, error } = useApi(`/api/dashboard?${params}`, data);
  const forecasting = month > thisMonth;
  const totals = current?.totals;
  const income = totals?.income_cents || 0;
  const expense = totals?.expense_cents || 0;
  const spending = current?.categories?.filter(item => item.kind === 'expense') || [];
  const balance = current?.accounts?.reduce((sum, account) => sum + account.balance_cents, 0) || 0;
  const debt = current?.debt;
  const fixed = current?.bills_month?.fixed;
  const share = current?.bills_month?.living_cost_share_bp;
  const incoming = current?.incomes_month;
  return <>
    <div className="page-head"><div><div className="eyebrow"><span className="eyebrow-line" /> PAINEL FINANCEIRO</div><h1>Visão geral</h1><p>{forecasting ? 'Previsão do mês considerando que nada em aberto é pago.' : 'O que você deve, o que precisa pagar, o que vai entrar e onde o dinheiro foi.'}</p></div></div>
    <MonthPicker id="dashboard-month" value={month} onChange={setMonth} today={data.today} max={moveMonth(thisMonth, 12)}>
      <div className="dashboard-account-filter"><label htmlFor="dashboard-account">Conta</label><select id="dashboard-account" value={accountId} onChange={event => setAccountId(event.target.value)}><option value="all">Todas as contas</option>{data.accounts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
    </MonthPicker>
    {error && <div className="panel dashboard-error" role="alert">{error}</div>}
    {!current && !error && <div className="panel dashboard-loading">Carregando dados do período...</div>}
    {current?.mode === 'forecast' && <ForecastView report={current} onMonth={setMonth} />}
    {current && current.mode !== 'forecast' && <>
      <section className="stats four dashboard-stats">
        <Stat label="Quanto devo" value={brl(debt.total_cents)} detail={`${brl(debt.this_month_cents)} até o fim deste mês · ${brl(debt.later_cents)} depois`} tone="featured" />
        <Stat label="Vencido" value={brl(debt.overdue_cents)} detail={debt.overdue_count ? `${debt.overdue_count} ${debt.overdue_count === 1 ? 'despesa' : 'despesas'} em atraso` : 'Nada vencido'} tone={debt.overdue_cents ? 'negative' : 'positive'} />
        <Stat label={`Fixas de ${monthName(`${month}-01`).split(' ')[0]}`} value={brl(fixed.total_cents)} detail={`${brl(fixed.paid_cents)} pago · falta ${brl(fixed.remaining_cents)}${share != null ? ` · ${percent(share)} da renda fixa` : ''}`}><Progress value={fixed.paid_cents} total={fixed.total_cents} label={`${brl(fixed.paid_cents)} de ${brl(fixed.total_cents)} pagos`} /></Stat>
        <Stat label="Previsto para entrar" value={brl(incoming.expected_cents)} detail={`${brl(incoming.upcoming_cents)} no mês · ${brl(incoming.overdue_cents)} atrasado`} tone={incoming.overdue_cents ? 'negative' : ''} />
      </section>
      <div className="grid-two dashboard-charts">
        <section className="panel"><div className="panel-header"><div><div className="eyebrow">GASTOS</div><h2>Onde gastei</h2><p>Por categoria no mês. Selecione uma para ver os detalhes.</p></div></div><SpendingChart rows={spending} transactions={current.recent} /></section>
        <section className="panel"><div className="panel-header"><div><div className="eyebrow">CARTÕES</div><h2>Como está a fatura</h2><p>Fatura em aberto mais próxima e limite de cada cartão.</p></div><button className="link-button" onClick={() => onView('cards')}>Ver cartões →</button></div><CardInvoices cards={current.cards} onView={onView} /></section>
      </div>
      <div className="section-heading"><div><h2>Movimento do mês</h2><p>O que de fato entrou e saiu das contas.</p></div></div>
      <section className="stats four dashboard-stats compact-stats"><Stat label="Saldo nas contas" value={brl(balance)} detail={accountId === 'all' ? `${current.accounts.length} contas · fim do mês ou hoje` : 'Fim do mês ou hoje'} /><Stat label="Entradas recebidas" value={brl(income)} detail={`Rendimentos: ${brl(totals.yield_cents)}`} /><Stat label="Saídas" value={brl(expense)} detail={`${totals.transaction_count} lançamentos, compras no cartão pela data da compra`} /><Stat label="Resultado do mês" value={brl(income - expense)} detail="Entradas menos saídas" tone={income - expense < 0 ? 'negative' : 'positive'} /></section>
      <div className="grid-two dashboard-charts"><section className="panel"><div className="panel-header"><div><div className="eyebrow">FLUXO DIÁRIO</div><h2>Como o mês evoluiu</h2><p>Passe o mouse sobre as barras para comparar os dias.</p></div></div><FlowChart rows={current.days} month={month} /></section><section className="panel"><div className="panel-header"><div><div className="eyebrow">ATIVIDADE</div><h2>Últimos lançamentos do mês</h2><p>{accountId === 'all' ? 'Todas as contas' : data.accounts.find(item => String(item.id) === accountId)?.name}</p></div></div>{current.recent.length ? <div className="dashboard-activity">{current.recent.map(item => <div key={item.id}><span><strong>{item.description}</strong><small>{day(item.date)} · {item.account_name} · {item.category}{item.payment_method ? ` · ${methodName[item.payment_method]}` : ''}</small></span><b className={item.kind === 'income' ? 'amount-plus' : 'amount-minus'}>{item.kind === 'income' ? '+' : '−'} {brl(item.amount_cents)}</b></div>)}</div> : <div className="chart-empty"><span>◌</span>Nenhum lançamento neste mês.</div>}</section></div>
      {accountId === 'all' && current.accounts.length > 0 && <section className="panel dashboard-accounts"><div className="panel-header"><div><h2>Contas</h2><p>Selecione uma para abrir o histórico e a projeção.</p></div><button className="link-button" onClick={() => onView('accounts')}>Ver contas →</button></div><div>{current.accounts.map(item => <button key={item.id} className="dashboard-account-row" onClick={() => onAccount(item.id)}><span><strong>{item.name}</strong><small>{item.type}</small></span><b>{brl(item.balance_cents)}</b><span aria-hidden="true">↗</span></button>)}</div></section>}
    </>}
  </>;
}
