import React, { useEffect, useState } from 'react';
import { LineChart, SpendingChart } from './Charts.jsx';
import { api, brl, day, methodName, monthName } from './lib.js';

const monthTitle = value => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
  .format(new Date(`${value}-01T12:00:00`)).replace(/^./, letter => letter.toUpperCase());
const moveMonth = (value, offset) => {
  const [year, month] = value.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
};

function Stat({ label, value, detail, tone = '' }) {
  return <div className={`stat dashboard-stat ${tone}`}><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-foot">{detail}</span></div>;
}

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

function SourceList({ rows }) {
  const grouped = new Map();
  for (const row of rows) grouped.set(row.category, (grouped.get(row.category) || 0) + row.amount_cents);
  const ordered = [...grouped].sort((a, b) => b[1] - a[1]);
  const total = ordered.reduce((sum, [, amount]) => sum + amount, 0);
  if (!ordered.length) return <div className="chart-empty"><span>◌</span>As entradas recebidas neste mês aparecerão aqui.</div>;
  return <div className="source-list">{ordered.map(([name, amount]) => <div className="source-item" key={name}><div><strong>{name}</strong><b>{brl(amount)}</b></div><span className="source-track"><span style={{ width: `${amount / total * 100}%` }} /></span><small>{Math.round(amount / total * 100)}% das entradas</small></div>)}</div>;
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

export default function Dashboard({ data, onAccount, onView }) {
  const [month, setMonth] = useState(data.today.slice(0, 7));
  const thisMonth = data.today.slice(0, 7);
  const lastMonth = moveMonth(thisMonth, 12);
  const forecasting = month > thisMonth;
  const [accountId, setAccountId] = useState('all');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ month });
    if (accountId !== 'all') params.set('accountId', accountId);
    api(`/api/dashboard?${params}`).then(value => { if (active) { setReport(value); setError(''); } })
      .catch(caught => { if (active) setError(caught.message); });
    return () => { active = false; };
  }, [month, accountId, data]);
  const current = report?.month === `${month}-01` && String(report.account_id ?? 'all') === accountId ? report : null;
  const totals = current?.totals;
  const income = totals?.income_cents || 0;
  const expense = totals?.expense_cents || 0;
  const spending = current?.categories?.filter(item => item.kind === 'expense') || [];
  const sources = current?.categories?.filter(item => item.kind === 'income') || [];
  const balance = current?.accounts?.reduce((sum, account) => sum + account.balance_cents, 0) || 0;
  return <>
    <div className="page-head"><div><div className="eyebrow"><span className="eyebrow-line" /> PAINEL FINANCEIRO</div><h1>Visão geral</h1><p>{forecasting ? 'Previsão do mês considerando que nada em aberto é pago.' : 'Movimento, saldos e compromissos do período selecionado.'}</p></div></div>
    <div className="dashboard-toolbar"><div className="period-picker"><button type="button" onClick={() => setMonth(value => moveMonth(value, -1))} aria-label="Mês anterior">←</button><label htmlFor="dashboard-month">{monthTitle(month)}{forecasting && <span className="pill forecast-pill">Previsão</span>}</label><input id="dashboard-month" aria-label="Selecionar mês" type="month" max={lastMonth} value={month} onChange={event => event.target.value && setMonth(event.target.value <= lastMonth ? event.target.value : lastMonth)} /><button type="button" disabled={month >= lastMonth} onClick={() => setMonth(value => moveMonth(value, 1))} aria-label="Próximo mês">→</button></div><div className="dashboard-account-filter"><label htmlFor="dashboard-account">Conta</label><select id="dashboard-account" value={accountId} onChange={event => setAccountId(event.target.value)}><option value="all">Todas as contas</option>{data.accounts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>{forecasting && <button type="button" className="button tiny secondary" onClick={() => setMonth(thisMonth)}>Voltar para hoje</button>}</div>
    {error && <div className="panel dashboard-error" role="alert">{error}</div>}
    {!current && !error && <div className="panel dashboard-loading">Carregando dados do período...</div>}
    {current?.mode === 'forecast' && <ForecastView report={current} onMonth={setMonth} />}
    {current && current.mode !== 'forecast' && <>
      <section className="stats dashboard-stats"><Stat label="Saldo na data de referência" value={brl(balance)} detail={accountId === 'all' ? `${current.accounts.length} contas · fim do mês ou hoje` : 'Fim do mês ou hoje'} tone="featured" /><Stat label="Entradas recebidas" value={brl(income)} detail={`${totals.transaction_count} lançamentos no período`} /><Stat label="Saídas realizadas" value={brl(expense)} detail="Pagamentos e despesas registradas" /><Stat label="Resultado do mês" value={brl(income - expense)} detail={`Rendimentos: ${brl(totals.yield_cents)}`} tone={income - expense < 0 ? 'negative' : 'positive'} /></section>
      <div className="dashboard-plan"><div><span>Previsto para receber</span><strong>{brl(current.planned.income_cents)}</strong><small>{current.planned.income_count} {current.planned.income_count === 1 ? 'entrada em aberto' : 'entradas em aberto'} com data neste mês</small></div><div><span>Previsto para pagar</span><strong>{brl(current.planned.bills_cents)}</strong><small>{current.planned.bills_count} {current.planned.bills_count === 1 ? 'despesa em aberto' : 'despesas em aberto'} com vencimento neste mês</small></div><div><span>Diferença prevista</span><strong className={current.planned.income_cents - current.planned.bills_cents < 0 ? 'amount-minus' : 'amount-plus'}>{brl(current.planned.income_cents - current.planned.bills_cents)}</strong><small>Valores ainda não liquidados</small></div></div>
      <div className="grid-two dashboard-charts"><section className="panel"><div className="panel-header"><div><div className="eyebrow">FLUXO DIÁRIO</div><h2>Como o mês evoluiu</h2><p>Passe o mouse sobre as barras para comparar os dias.</p></div></div><FlowChart rows={current.days} month={month} /></section><section className="panel"><div className="panel-header"><div><div className="eyebrow">DESPESAS</div><h2>Onde o dinheiro foi gasto</h2><p>Selecione uma categoria para ver os detalhes.</p></div></div><SpendingChart rows={spending} transactions={current.recent} /></section></div>
      <div className="grid-two dashboard-charts"><section className="panel"><div className="panel-header"><div><div className="eyebrow">ENTRADAS</div><h2>Origem dos recebimentos</h2><p>Participação de cada categoria no mês.</p></div></div><SourceList rows={sources} /></section><section className="panel"><div className="panel-header"><div><div className="eyebrow">ATIVIDADE</div><h2>Últimos lançamentos do mês</h2><p>{accountId === 'all' ? 'Todas as contas' : data.accounts.find(item => String(item.id) === accountId)?.name}</p></div></div>{current.recent.length ? <div className="dashboard-activity">{current.recent.map(item => <div key={item.id}><span><strong>{item.description}</strong><small>{day(item.date)} · {item.account_name} · {item.category}{item.payment_method ? ` · ${methodName[item.payment_method]}` : ''}</small></span><b className={item.kind === 'income' ? 'amount-plus' : 'amount-minus'}>{item.kind === 'income' ? '+' : '−'} {brl(item.amount_cents)}</b></div>)}</div> : <div className="chart-empty"><span>◌</span>Nenhum lançamento neste mês.</div>}</section></div>
      {accountId === 'all' && current.accounts.length > 0 && <section className="panel dashboard-accounts"><div className="panel-header"><div><h2>Contas no período</h2><p>Selecione uma para abrir o histórico e a projeção.</p></div><button className="link-button" onClick={() => onView('accounts')}>Ver contas →</button></div><div>{current.accounts.map(item => <button key={item.id} className="dashboard-account-row" onClick={() => onAccount(item.id)}><span><strong>{item.name}</strong><small>{item.type}</small></span><b>{brl(item.balance_cents)}</b><span aria-hidden="true">↗</span></button>)}</div></section>}
    </>}
  </>;
}
