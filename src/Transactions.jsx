import React, { useState } from 'react';
import { CategoryStrip } from './Charts.jsx';
import MonthPicker, { useApi } from './MonthPicker.jsx';
import { brl, methodName } from './lib.js';
import { Header, Progress, Stat, TransactionTable } from './ui.jsx';

export default function Transactions({ data, open, remove, setMessage }) {
  const thisMonth = data.today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [filter, setFilter] = useState('all');
  const { value: report, error } = useApi(`/api/transactions/month?month=${month}`, data);
  const items = (report?.items || []).filter(item => filter === 'all' || (filter === 'credit' ? item.card_purchase_id : item.kind === filter));
  const create = kind => data.accounts.length ? open('transaction', { kind }) : setMessage('Cadastre uma conta primeiro.');
  return <>
    <Header title="Lançamentos" subtitle="As saídas e entradas avulsas do dia a dia." action="Nova saída" onAction={() => create('expense')} secondary="Nova entrada" onSecondary={() => create('income')} />
    <MonthPicker id="transactions-month" value={month} onChange={setMonth} today={data.today} max={thisMonth} />
    {error && <div className="panel dashboard-error" role="alert">{error}</div>}
    {!report && !error && <div className="panel dashboard-loading">Carregando lançamentos do mês...</div>}
    {report && <>
      <section className="stats month-stats four">
        {month === thisMonth && <Stat label="Gasto hoje" value={brl(report.today_expense_cents)} detail="Saídas avulsas registradas hoje" tone="featured" />}
        <Stat label="Saídas avulsas no mês" value={brl(report.expense_cents)} detail={`${report.expense_count} ${report.expense_count === 1 ? 'saída' : 'saídas'} · compras no cartão pelo total`} tone={month === thisMonth ? '' : 'featured'} />
        <Stat label="Entradas avulsas no mês" value={brl(report.income_cents)} detail="Sem salários previstos e rendimentos" />
        <Stat label="No cartão de crédito" value={brl(report.by_method.credit)} detail="Vai para as próximas faturas · divisão por forma de pagamento:">
          <div className="method-split">{Object.entries(methodName).map(([key, label]) => <div key={key}><span>{label}</span><b>{brl(report.by_method[key])}</b><Progress value={report.by_method[key]} total={report.expense_cents} /></div>)}</div>
        </Stat>
      </section>
      <section className="panel"><div className="panel-header"><div><div className="eyebrow">POR CATEGORIA</div><h2>Onde foi o dinheiro</h2><p>Saídas avulsas do mês, compras no cartão pelo total.</p></div><span className="pill">{brl(report.expense_cents)}</span></div><CategoryStrip rows={report.by_category} empty="As saídas avulsas do mês aparecerão aqui." /></section>
      <section className="panel direct-expenses"><div className="panel-header"><div><div className="eyebrow">DIA A DIA</div><h2>Lançamentos do mês</h2><p>Pagamentos de despesas, recebimentos e rendimentos ficam nas próprias páginas.</p></div><div className="filter-row">{[['all', 'Todos'], ['expense', 'Saídas'], ['credit', 'Cartão'], ['income', 'Entradas']].map(([value, label]) => <button key={value} className={`filter ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
        <div className="hidden-scroll tall"><TransactionTable items={items} onEdit={item => open('transaction', item)} onDelete={(id, confirmation) => remove(`/api/transactions/${id}`, confirmation)} /></div>
      </section>
    </>}
  </>;
}
