import React, { useEffect, useState } from 'react';
import { LineChart } from './Charts.jsx';
import { useApi } from './MonthPicker.jsx';
import { api, brl, day, monthName } from './lib.js';
import { Empty, Header, Stat } from './ui.jsx';

const dateTime = value => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
const capitalized = value => value.replace(/^./, letter => letter.toUpperCase());
const months = count => `${count} ${count === 1 ? 'mês' : 'meses'}`;

function payoffText(summary) {
  if (summary.months_to_payoff == null) return 'Mais de 5 anos';
  return summary.months_to_payoff === 0 ? 'Em dia este mês' : months(summary.months_to_payoff);
}

function Report({ simulation }) {
  const { summary, result } = simulation;
  const short = summary.year_gap_cents > 0;
  const hasDebt = result.timeline.some(month => month.debt_cents > 0);
  const withCash = result.timeline[0]?.opening_cash_cents != null;
  return <>
    <section className="stats month-stats four">
      <Stat label="Para ficar em dia hoje" value={brl(summary.need_today_cents)} detail={`${brl(summary.overdue_cents)} atrasado (${summary.overdue_count}) + ${brl(summary.this_month_cents)} deste mês (${summary.this_month_count})`} tone="featured" />
      <Stat label="Saldo nas contas" value={brl(summary.balance_cents)} detail={summary.missing_today_cents ? `Faltam ${brl(summary.missing_today_cents)} para resolver hoje` : 'Cobre tudo o que vence até o fim do mês'} tone={summary.missing_today_cents ? 'negative' : 'positive'} />
      <Stat label="Tempo para quitar" value={payoffText(summary)} detail={summary.months_to_payoff == null ? `Em 5 anos ainda ficam ${brl(summary.unpaid_at_horizon_cents)} em aberto` : `Tudo quitado em ${day(summary.payoff_date)}`} tone={summary.months_to_payoff == null ? 'negative' : summary.months_to_payoff === 0 ? 'positive' : ''} />
      <Stat label="Juros e multas no caminho" value={brl(summary.interest_cents)} detail="O que as atrasadas ainda vão custar até serem pagas" tone={summary.interest_cents ? 'negative' : 'positive'} />
    </section>
    <section className="panel simulation-year"><div className="panel-header"><div><div className="eyebrow">PRÓXIMOS 12 MESES</div><h2>{short ? `Faltam ${brl(summary.year_gap_cents)} para pagar tudo o que vence até ${summary.year_end ? day(summary.year_end) : 'o fim de 12 meses'}` : `Sobram ${brl(-summary.year_gap_cents)} depois de pagar tudo o que vence até ${summary.year_end ? day(summary.year_end) : 'o fim de 12 meses'}`}</h2><p>Tudo o que vence nos próximos 12 meses (atrasadas, fixas, eventuais e faturas), com os juros e multas que a simulação calcula, comparado com o saldo de hoje e as entradas previstas no período.</p></div></div>
      <div className="simulation-equation">
        <div><span>A pagar em 12 meses (com juros)</span><strong>{brl(summary.year_bills_cents)}</strong></div><b>−</b>
        <div><span>Saldo de hoje + entradas</span><strong>{brl(summary.balance_cents + summary.year_incomes_cents)}</strong></div><b>=</b>
        <div className={short ? 'is-short' : 'is-ok'}><span>{short ? 'Precisaria entrar a mais' : 'Sobra no fim do período'}</span><strong>{brl(Math.abs(summary.year_gap_cents))}</strong>{short && <small>≈ {brl(summary.monthly_extra_needed_cents)} por mês</small>}</div>
      </div>
    </section>
    <section className="panel chart-panel"><div className="panel-header"><div><div className="eyebrow">EVOLUÇÃO</div><h2>Dívida em aberto mês a mês</h2><p>Usando 100% de tudo que entra para pagar, começando pelas de maior juros.</p></div></div>
      {hasDebt ? <LineChart series={result.timeline.map(month => ({ date: month.month, value_cents: month.debt_cents }))} title="Dívida em aberto na simulação" accent="#dca792" /> : <div className="chart-empty"><span>✓</span>Nenhuma dívida fica em aberto no fim de nenhum mês.</div>}
    </section>
    <section className="panel"><div className="panel-header"><div><div className="eyebrow">PLANO</div><h2>Como seria o pagamento</h2><p>Em cada mês: caixa do início + o que entra − o que é pago = caixa do fim, que passa para o mês seguinte. Abra um mês para ver cada pagamento.</p>{!withCash && <p className="form-hint">Simulação antiga, sem o caixa mês a mês. Gere uma nova para ver a conta completa.</p>}</div></div>
      <div className="simulation-months">{result.timeline.map(month => <details key={month.month} className="simulation-month">
        <summary><span>{capitalized(monthName(month.month))}</span><small>{withCash ? `Caixa ${brl(month.opening_cash_cents)} + entra ${brl(month.income_cents)} − paga ${brl(month.paid_cents)} = ${brl(month.closing_cash_cents)}` : `Entra ${brl(month.income_cents)} · paga ${brl(month.paid_cents)}`}</small><b className={month.debt_cents ? 'amount-minus' : 'amount-plus'}>{month.debt_cents ? `${brl(month.debt_cents)} em aberto` : 'Em dia'}</b></summary>
        {month.payments.length ? month.payments.map((payment, index) => <div className="payment-row" key={index}><span>{day(payment.date)} · {payment.description}<small className="row-note">{payment.settled ? 'Quitada' : 'Pagamento parcial'}{payment.late ? ` · venceu em ${day(payment.due_date)}` : ''}</small></span><b>{brl(payment.amount_cents)}</b></div>) : <p className="card-note">Nenhum pagamento neste mês.</p>}
      </details>)}</div>
    </section>
  </>;
}

export default function Simulation({ setMessage }) {
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const { value: history, error } = useApi('/api/simulations', version);
  useEffect(() => {
    if (!selected && history?.length) api(`/api/simulations/${history[0].id}`).then(setSelected).catch(caught => setMessage(caught.message));
  }, [history, selected, setMessage]);
  async function run() {
    setBusy(true);
    try { setSelected(await api('/api/simulations', 'POST')); setVersion(value => value + 1); }
    catch (caught) { setMessage(caught.message); }
    finally { setBusy(false); }
  }
  async function remove(id) {
    if (!window.confirm('Excluir esta simulação do histórico?')) return;
    try {
      await api(`/api/simulations/${id}`, 'DELETE');
      if (selected?.id === id) setSelected(null);
      setVersion(value => value + 1);
    } catch (caught) { setMessage(caught.message); }
  }
  return <>
    <Header title="Simulação" subtitle="E se tudo que entrar for usado para pagar as contas? Quanto tempo leva e quanto você precisa hoje." action={busy ? 'Simulando...' : 'Nova simulação'} onAction={busy ? undefined : run} />
    <p className="simulation-rules">Considera que tudo o que está previsto entra na data certa (as entradas atrasadas, hoje) e que 100% do dinheiro vai para as contas, começando pelo saldo de hoje das contas (sem investimentos e limite garantido), por até 5 anos. A cada entrada: paga o que vence no dia, guarda o necessário para as contas que vencem antes da próxima entrada (para pagá-las em dia) e usa o resto nas atrasadas, começando pela de maior juros. Juros e multas continuam correndo sobre o que ficar para trás.</p>
    {error && <div className="panel dashboard-error" role="alert">{error}</div>}
    {selected ? <>
      <div className="simulation-meta"><span>Simulação de {dateTime(selected.created_at)}{selected.user_name ? ` · por ${selected.user_name}` : ''}</span></div>
      <Report simulation={selected} />
    </> : history && !history.length && <div className="panel"><Empty>Nenhuma simulação ainda. Clique em "Nova simulação" para gerar o primeiro relatório.</Empty></div>}
    {history?.length > 0 && <section className="panel"><div className="panel-header"><div><div className="eyebrow">HISTÓRICO</div><h2>Simulações anteriores</h2><p>Compare para ver se a situação está melhorando.</p></div></div>
      <div className="simulation-history">{history.map(item => <div key={item.id} className={`simulation-history-row ${selected?.id === item.id ? 'selected' : ''}`}>
        <button type="button" onClick={() => api(`/api/simulations/${item.id}`).then(setSelected).catch(caught => setMessage(caught.message))}><span><strong>{dateTime(item.created_at)}</strong><small>{item.user_name || '—'}</small></span><span><small>Para ficar em dia</small><b>{brl(item.summary.need_today_cents)}</b></span><span><small>Quitar em</small><b>{payoffText(item.summary)}</b></span><span><small>12 meses</small><b className={item.summary.year_gap_cents > 0 ? 'amount-minus' : 'amount-plus'}>{item.summary.year_gap_cents > 0 ? `faltam ${brl(item.summary.year_gap_cents)}` : `sobram ${brl(-item.summary.year_gap_cents)}`}</b></span></button>
        <button type="button" className="simulation-delete" onClick={() => remove(item.id)} aria-label="Excluir simulação">×</button>
      </div>)}</div>
    </section>}
  </>;
}
