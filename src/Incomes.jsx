import React, { useState } from 'react';
import { SourceList } from './Charts.jsx';
import MonthPicker, { useApi } from './MonthPicker.jsx';
import { brl, day, monthName, moveMonth } from './lib.js';
import { Empty, Header, OverdueToggle, Stat } from './ui.jsx';

const incomeStatus = { pending: 'Pendente', overdue: 'Atrasada', received: 'Recebida' };

function IncomeCard({ item, entry, open, remove, change, setMessage }) {
  return <article className={`bill-card income-card ${item.status}`}>
    <div className="bill-card-top"><span className={`status-pill ${item.status}`}><span />{incomeStatus[item.status]}</span><span className="bill-due">Prevista para {day(item.due_date)}</span></div>
    <h3>{item.description}</h3>
    {entry?.carried && <span className="pill carry-pill">Pendente desde {day(item.due_date)}</span>}
    <p className="bill-meta">{item.income_type === 'fixed' ? 'Fixa' : 'Eventual'} · {item.category}{item.subcategory_name ? ` / ${item.subcategory_name}` : ''} · {item.account_name}</p>
    {item.note && <p className="card-note">{item.note}</p>}
    <div className="bill-amount"><span>Falta receber</span><strong>{brl(item.remaining_cents)}</strong></div>
    <div className="bill-details"><span>Valor previsto <b>{brl(item.amount_cents)}</b></span><span>Já recebido <b>{brl(item.received_cents)}</b></span></div>
    {item.receipts.length > 0 && <details className="payment-history"><summary>{item.receipts.length} recebimentos</summary>{item.receipts.map(receipt => <div className="payment-row" key={receipt.id}><span>{day(receipt.date)} · {receipt.account_name}{receipt.note && <small className="row-note">{receipt.note}</small>}</span><b>{brl(receipt.amount_cents)}</b><button className="row-action" onClick={() => open('receipt', item, { receipt })}>Editar</button><button className="row-action danger" onClick={() => remove(`/api/incomes/${item.id}/receipts/${receipt.id}`, 'Cancelar este recebimento? A entrada volta a ficar pendente.')}>Cancelar</button></div>)}</details>}
    <div className="bill-actions">
      {item.remaining_cents > 0 && <button className="button tiny" onClick={() => open('receipt', item)}>Receber</button>}
      {item.income_type === 'fixed' && item.series_active && <button className="button tiny ghost" onClick={() => { if (window.confirm('Encerrar a repetição mensal? As próximas entradas ainda não recebidas serão removidas.')) change(`/api/incomes/${item.id}/stop-recurrence`, 'PATCH').catch(error => setMessage(error.message)); }}>Encerrar repetição</button>}
      {!item.receipts.length && <><button className="button tiny ghost" onClick={() => open('income', item)}>Editar</button><button className="button tiny ghost" onClick={() => remove(`/api/incomes/${item.id}`, item.income_type === 'fixed' && !item.recurrence_origin_id ? 'Excluir esta série fixa e as parcelas sem recebimento?' : undefined)}>{item.income_type === 'fixed' && !item.recurrence_origin_id ? 'Excluir série' : 'Excluir'}</button></>}
    </div>
  </article>;
}

export default function Incomes({ data, open, remove, change, setMessage }) {
  const thisMonth = data.today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [withOverdue, setWithOverdue] = useState(true);
  const { value: report, error } = useApi(`/api/incomes/month?month=${month}`, data);
  const incomes = new Map((data.incomes || []).map(item => [item.id, item]));
  const entries = new Map((report?.items || []).map(entry => [entry.id, entry]));
  const expected = report ? (withOverdue ? report.expected_cents : report.upcoming_cents) : 0;
  const start = `${month}-01`;
  // Everything planned for the month (received or not) plus earlier incomes still pending.
  const shown = (data.incomes || []).filter(item => (item.due_date.slice(0, 7) === month || entries.has(item.id))
    && (withOverdue || !entries.get(item.id)?.overdue)
    && (status === 'all' || item.status === status) && (type === 'all' || item.income_type === type));
  const toReceive = (report?.items || []).filter(entry => entry.remaining_cents > 0 && (withOverdue || !entry.overdue)).map(entry => ({ entry, item: incomes.get(entry.id) })).filter(row => row.item);
  return <>
    <Header title="Entradas" subtitle="Quanto entrou, quanto rendeu e quanto ainda vai entrar no mês." action="Nova entrada" onAction={() => data.accounts.length ? open('income') : setMessage('Cadastre uma conta primeiro.')} />
    <MonthPicker id="incomes-month" value={month} onChange={setMonth} today={data.today} min={report?.first_month?.slice(0, 7)} max={moveMonth(thisMonth, 12)}><OverdueToggle value={withOverdue} onChange={setWithOverdue} /></MonthPicker>
    {error && <div className="panel dashboard-error" role="alert">{error}</div>}
    {!report && !error && <div className="panel dashboard-loading">Carregando entradas do mês...</div>}
    {report && <>
      <section className="stats month-stats four">
        <Stat label="Recebido no mês" value={brl(report.received_cents)} detail={`Inclui ${brl(report.yield_cents)} de rendimentos`} tone="featured" />
        <Stat label="Rendimentos no mês" value={brl(report.yield_cents)} detail="Créditos automáticos das contas com taxa" tone="positive" />
        <Stat label={withOverdue ? 'Ainda vai entrar' : 'Ainda vai entrar, sem atrasadas'} value={brl(expected)} detail={withOverdue ? `${brl(report.upcoming_cents)} previsto · ${brl(report.overdue_cents)} atrasado` : `Só o que ainda está previsto · ${brl(report.overdue_cents)} atrasado fora da conta`} tone={withOverdue && report.overdue_cents ? 'negative' : ''} />
        <Stat label="Entradas fixas previstas" value={brl(report.fixed_expected_cents)} detail="Salários e outras entradas que se repetem" />
      </section>
      <div className="grid-two dashboard-charts">
        <section className="panel"><div className="panel-header"><div><div className="eyebrow">ORIGEM</div><h2>Quanto entrou por categoria</h2><p>Recebimentos de {monthName(start)}, inclusive rendimentos.</p></div></div><SourceList rows={report.categories} /></section>
        <section className="panel monthly-payables"><div className="panel-header"><div><div className="eyebrow">A RECEBER</div><h2>O que ainda vai entrar</h2><p>Entradas pendentes continuam nos meses seguintes até serem recebidas.</p></div></div>
          <div className="monthly-total"><span>{withOverdue ? 'Total a receber' : 'Total previsto (sem atrasadas)'}</span><strong>{brl(expected)}</strong></div>
          {toReceive.length ? <div className="monthly-list">{toReceive.map(({ entry, item }) => <div className="monthly-row" key={item.id}><div><strong>{item.description}</strong><small>{entry.carried ? `Pendente desde ${day(item.due_date)}` : `Prevista para ${day(item.due_date)}`} · {item.account_name}</small></div><span className={entry.overdue ? 'pill carry-pill' : 'pill'}>{entry.overdue ? 'Atrasada' : item.income_type === 'fixed' ? 'Fixa' : 'Eventual'}</span><b>{brl(entry.remaining_cents)}</b></div>)}</div> : <Empty>Nada a receber neste mês.</Empty>}
        </section>
      </div>
    </>}
    <div className="section-heading"><div><h2>Entradas do mês</h2><p>Registre recebimentos totais ou parciais.</p></div><div className="filter-row">{[['all', 'Todas'], ['pending', 'Pendentes'], ['overdue', 'Atrasadas'], ['received', 'Recebidas']].map(([value, label]) => <button key={value} className={`filter ${status === value ? 'active' : ''}`} onClick={() => setStatus(value)}>{label}</button>)}</div></div>
    <div className="inline-filter"><label htmlFor="income-type-filter">Tipo</label><select id="income-type-filter" value={type} onChange={event => setType(event.target.value)}><option value="all">Todos os tipos</option><option value="fixed">Fixas</option><option value="eventual">Eventuais</option></select></div>
    <div className="bill-grid">{shown.map(item => <IncomeCard key={item.id} item={item} entry={entries.get(item.id)} open={open} remove={remove} change={change} setMessage={setMessage} />)}</div>
    {!shown.length && <div className="panel"><Empty>Nenhuma entrada neste filtro.</Empty></div>}
  </>;
}
