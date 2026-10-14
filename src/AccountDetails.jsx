import React, { useEffect, useState } from 'react';
import { LineChart } from './Charts.jsx';
import { api, brl, day, decimal } from './lib.js';

export default function AccountDetails({ accountId, data, onBack, onEdit, onView }) {
  const [month, setMonth] = useState('all');
  const [offset, setOffset] = useState(0);
  const [response, setDetails] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { setOffset(0); }, [accountId, month]);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ offset: String(offset) });
    if (month !== 'all') params.set('month', month);
    api(`/api/accounts/${accountId}/details?${params}`).then(value => { if (active) { setDetails(value); setError(''); } })
      .catch(caught => { if (active) setError(caught.message); });
    return () => { active = false; };
  }, [accountId, month, offset, data]);
  const details = response?.account.id === accountId && response.offset === offset
    && response.month === (month === 'all' ? null : `${month}-01`) ? response : null;
  const account = details?.account;
  const projection = details?.projection || [];
  const current = projection[0]?.value_cents || 0;
  const annual = account?.annual_basis_points == null ? null : account.annual_basis_points * account.yield_multiplier_basis_points / 10000;
  const bills = data.bills.filter(item => item.account_id === accountId && item.status !== 'paid').sort((a, b) => a.due_date.localeCompare(b.due_date));
  const incomes = (data.incomes || []).filter(item => item.account_id === accountId && item.remaining_cents > 0).sort((a, b) => a.due_date.localeCompare(b.due_date));
  return <>
    <button className="account-back" onClick={onBack}>← Todas as contas</button>
    {error && <div className="panel dashboard-error" role="alert">{error}</div>}
    {!details && !error && <div className="panel dashboard-loading">Carregando conta...</div>}
    {account && <>
      <div className="account-hero"><div><div className="eyebrow"><span className="eyebrow-line" /> DETALHE DA CONTA</div><h1>{account.name}</h1><p>{account.type}{account.note ? ` · ${account.note}` : ''}</p></div><button className="button secondary" onClick={() => onEdit(data.accounts.find(item => item.id === accountId) || account)}>Editar conta</button></div>
      <section className="stats dashboard-stats account-stats"><div className="stat featured dashboard-stat"><span className="stat-label">Saldo atual</span><strong className="stat-value">{brl(account.balance_cents)}</strong><span className="stat-foot">Saldo inicial: {brl(account.opening_cents)}</span></div><div className="stat dashboard-stat"><span className="stat-label">Entradas acumuladas</span><strong className="stat-value amount-plus">{brl(details.summary.income_cents)}</strong><span className="stat-foot">Inclui rendimentos recebidos</span></div><div className="stat dashboard-stat"><span className="stat-label">Saídas acumuladas</span><strong className="stat-value amount-minus">{brl(details.summary.expense_cents)}</strong><span className="stat-foot">Pagamentos e transferências lançadas</span></div><div className="stat dashboard-stat"><span className="stat-label">Rendimentos lançados</span><strong className="stat-value amount-plus">{brl(details.summary.yield_cents)}</strong><span className="stat-foot">Histórico automático desta conta</span></div></section>
      <section className="panel account-projection"><div className="panel-header"><div><div className="eyebrow">SIMULAÇÃO</div><h2>Previsão de rendimentos</h2><p>Usa o saldo atual e mantém a taxa de hoje constante, sem aportes ou retiradas.</p></div>{annual != null && <span className="pill blue">{decimal(Math.round(annual))}% ao ano</span>}</div>
        {annual != null ? <><div className="projection-highlights"><div><small>Em 1 mês</small><strong>{brl(projection[1]?.value_cents)}</strong><span>+ {brl((projection[1]?.value_cents || current) - current)}</span></div><div><small>Em 6 meses</small><strong>{brl(projection[6]?.value_cents)}</strong><span>+ {brl((projection[6]?.value_cents || current) - current)}</span></div><div><small>Em 12 meses</small><strong>{brl(projection[12]?.value_cents)}</strong><span>+ {brl((projection[12]?.value_cents || current) - current)}</span></div></div><LineChart series={projection} title={`Projeção da conta ${account.name}`} accent="#a8cb9b" /><p className="projection-note">{decimal(account.yield_multiplier_basis_points)}% de {account.yield_rate_name} ({decimal(account.annual_basis_points)}% a.a.){account.source_date ? ` · Referência de ${day(account.source_date)}` : ''}. Valores brutos, sem impostos ou tarifas; dias úteis considerados no cálculo.</p></> : <div className="chart-empty"><span>％</span>Configure uma taxa de rendimento para ver esta projeção.</div>}
      </section>
      <div className="grid-two account-plans"><section className="panel"><div className="panel-header"><div><div className="eyebrow">COMPROMISSOS</div><h2>Despesas desta conta</h2><p>{bills.length} em aberto</p></div><button className="link-button" onClick={() => onView('bills')}>Ver todas →</button></div>{bills.length ? <div className="account-plan-list">{bills.slice(0, 5).map(item => <div key={item.id}><span><strong>{item.description}</strong><small>{item.status === 'overdue' ? 'Vencida' : 'Vence'} em {day(item.due_date)}</small></span><b className="amount-minus">{brl(item.current_cents)}</b></div>)}</div> : <div className="account-plan-empty">Nenhuma despesa em aberto nesta conta.</div>}</section><section className="panel"><div className="panel-header"><div><div className="eyebrow">A RECEBER</div><h2>Entradas desta conta</h2><p>{incomes.length} em aberto</p></div><button className="link-button" onClick={() => onView('incomes')}>Ver todas →</button></div>{incomes.length ? <div className="account-plan-list">{incomes.slice(0, 5).map(item => <div key={item.id}><span><strong>{item.description}</strong><small>{item.status === 'overdue' ? 'Atrasada desde' : 'Prevista para'} {day(item.due_date)}</small></span><b className="amount-plus">{brl(item.remaining_cents)}</b></div>)}</div> : <div className="account-plan-empty">Nenhuma entrada pendente nesta conta.</div>}</section></div>
      <section className="panel account-history"><div className="panel-header"><div><div className="eyebrow">EXTRATO</div><h2>Histórico da conta</h2><p>{details.history_count} lançamentos no filtro selecionado · saldo após cada movimento</p></div><div className="account-history-filter"><label htmlFor="account-history-month">Período</label><select id="account-history-month" value={month} onChange={event => setMonth(event.target.value)}><option value="all">Todo o histórico</option><option value={data.today.slice(0, 7)}>Mês atual</option>{month !== 'all' && month !== data.today.slice(0, 7) && <option value={month}>Mês escolhido</option>}</select><input aria-label="Escolher mês do histórico" type="month" max={data.today.slice(0, 7)} value={month === 'all' ? '' : month} onChange={event => event.target.value && setMonth(event.target.value)} /></div></div>
        {details.history.length ? <><div className="table-wrap"><table><thead><tr><th>Data</th><th>Lançamento</th><th>Categoria</th><th>Valor</th><th>Saldo após</th></tr></thead><tbody>{details.history.map(item => <tr key={item.id}><td className="muted">{day(item.date)}</td><td><strong>{item.description}</strong>{item.automatic_yield && <span className="sub-label">Rendimento automático</span>}{item.note && <span className="row-note">{item.note}</span>}</td><td><span className="pill">{item.category_name}</span>{item.subcategory_name && <span className="sub-label">{item.subcategory_name}</span>}</td><td className={item.kind === 'income' ? 'amount-plus' : 'amount-minus'}>{item.kind === 'income' ? '+' : '−'} {brl(item.amount_cents)}</td><td><strong>{brl(item.balance_after_cents)}</strong></td></tr>)}</tbody></table></div><div className="history-pages"><span>{offset + 1}–{Math.min(offset + 50, details.history_count)} de {details.history_count}</span><div><button className="button tiny secondary" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>Anterior</button><button className="button tiny secondary" disabled={offset + 50 >= details.history_count} onClick={() => setOffset(value => value + 50)}>Próxima</button></div></div></> : <div className="chart-empty"><span>◌</span>Nenhum lançamento neste período.</div>}
      </section>
    </>}
  </>;
}
