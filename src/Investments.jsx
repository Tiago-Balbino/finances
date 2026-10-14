import React, { useState } from 'react';
import { LineChart } from './Charts.jsx';
import { useApi } from './MonthPicker.jsx';
import { brl, day } from './lib.js';
import { Empty, Header, RangeButtons, Stat } from './ui.jsx';

const kindLabel = { box: 'Caixa', account: 'Conta com rendimento', collateral: 'Limite garantido' };

export default function Investments({ data, open, remove, onAccount, onView }) {
  const [range, setRange] = useState(12);
  const { value: report, error } = useApi('/api/investments/summary', data);
  const boxes = new Map((report?.boxes || []).map(item => [item.id, item]));
  return <>
    <Header title="Investimentos" subtitle="Quanto você tem investido, quanto rende e quanto deve render com as taxas atuais." action="Novo investimento" onAction={() => open('investment')} />
    {error && <div className="panel dashboard-error" role="alert">{error}</div>}
    {!report && !error && <div className="panel dashboard-loading">Carregando investimentos...</div>}
    {report && <>
      <section className="stats month-stats four">
        <Stat label="Total investido" value={brl(report.total_cents)} detail="Caixas, contas com rendimento e limite garantido" tone="featured" />
        <Stat label="Rendimento acumulado" value={brl(report.yield_cents)} detail="Tudo o que já rendeu até hoje" tone="positive" />
        <Stat label="Rendeu este mês" value={brl(report.month_yield_cents)} detail="Desde o dia 1º" tone="positive" />
        <Stat label="Estimativa para o próximo mês" value={brl(report.next_month_yield_cents)} detail="Com as taxas de hoje, sem novos aportes" />
      </section>
      <section className="panel chart-panel"><div className="panel-header"><div><div className="eyebrow">PROJEÇÃO</div><h2>Patrimônio investido</h2><p>Saldo atual rendendo pelas taxas de cada aplicação, sem aportes ou resgates.</p></div><RangeButtons value={range} onChange={setRange} /></div><LineChart series={report.series.slice(0, range + 1)} title="Projeção dos investimentos" accent="#a8cb9b" /></section>
      <div className="cards">{report.items.map(item => {
        const box = item.kind === 'box' ? boxes.get(item.id) : null;
        return <article className="item-card" key={`${item.kind}-${item.id}`}>
          <div className="item-top"><span className="account-icon">{item.kind === 'box' ? '◈' : item.kind === 'collateral' ? '▭' : '▤'}</span><span className="pill blue">{kindLabel[item.kind]}</span></div>
          <h3>{item.name}</h3>{box?.note && <p className="card-note">{box.note}</p>}
          <small>Valor hoje</small><div className="big-value">{brl(item.value_cents)}</div>
          <div className="divider" />
          <div className="flex"><span>Aplicado</span><b>{brl(item.invested_cents)}</b></div>
          <div className="flex"><span>Rendimento</span><b className="amount-plus">{brl(item.yield_cents)}</b></div>
          <div className="flex"><span>Rendeu este mês</span><b>{brl(item.month_yield_cents)}</b></div>
          <div className="flex"><span>Taxa</span><b>{item.rate_label}</b></div>
          <div className="flex"><span>Em 12 meses</span><b>{brl(item.future_cents)}</b></div>
          {box?.movements.length > 0 && <details className="payment-history"><summary>{box.movements.length} movimentos</summary>{box.movements.map(movement => <div className="payment-row" key={movement.id}><span>{day(movement.date)} · {movement.direction === 'deposit' ? 'Aporte' : 'Resgate'}{movement.account_name ? ` · ${movement.account_name}` : ''}{movement.note && <small className="row-note">{movement.note}</small>}</span><b className={movement.direction === 'deposit' ? '' : 'amount-minus'}>{movement.direction === 'deposit' ? '' : '− '}{brl(movement.amount_cents)}</b><button onClick={() => remove(`/api/investments/${box.id}/movements/${movement.id}`, 'Excluir este movimento? O lançamento na conta também será removido.')} aria-label="Excluir movimento">×</button></div>)}</details>}
          <div className="item-actions wrap">{box
            ? <><button className="button tiny" onClick={() => open('investmentMovement', box, { direction: 'deposit' })}>Aportar</button><button className="button tiny secondary" disabled={item.value_cents <= 0} onClick={() => open('investmentMovement', box, { direction: 'withdraw' })}>Resgatar</button><button className="button tiny ghost" onClick={() => open('investment', box)}>Editar</button><button className="button tiny ghost" onClick={() => remove(`/api/investments/${box.id}`, 'Excluir este caixa? Os lançamentos já feitos nas contas continuam no histórico.')}>Excluir</button></>
            : item.kind === 'collateral' ? <button className="button tiny secondary" onClick={() => onView('cards')}>Ver cartão</button> : <button className="button tiny secondary" onClick={() => onAccount(item.id)}>Ver conta</button>}</div>
        </article>;
      })}</div>
      {!report.items.length && <div className="panel"><Empty>Crie um caixa ou configure uma taxa de rendimento em uma conta.</Empty></div>}
      <p className="muted investment-disclaimer">Valores brutos, sem impostos. Caixas rendem pela taxa cadastrada; contas e limite garantido rendem em dias úteis pela taxa de referência.</p>
    </>}
  </>;
}
