import React, { useCallback, useEffect, useState } from 'react';
import { api, brl, cents, day, decimal, methodLabel, methodName, periodName, rate, spendableAccounts, statusName } from './lib.js';
import { LineChart } from './Charts.jsx';
import Dashboard from './Dashboard.jsx';
import AccountDetails from './AccountDetails.jsx';
import Modal from './Modal.jsx';

const nav = [
  ['overview', '◫', 'Visão geral'], ['accounts', '▤', 'Contas'], ['cards', '▭', 'Cartões'], ['bills', '◷', 'Despesas'], ['incomes', '↥', 'Entradas'],
  ['transactions', '⇄', 'Lançamentos'], ['categories', '▦', 'Categorias'], ['yieldRates', '％', 'Taxas'],
  ['investments', '◈', 'Investimentos'], ['users', '♙', 'Pessoas'], ['profile', '⚙', 'Perfil']
];

function Header({ title, subtitle, action, onAction }) {
  return <div className="page-head"><div><div className="eyebrow"><span className="eyebrow-line" /> FINANÇAS COMPARTILHADAS</div><h1>{title}</h1><p>{subtitle}</p></div>{action && <button className="button" onClick={onAction}><span className="plus">＋</span>{action}</button>}</div>;
}

function Empty({ children }) { return <div className="empty"><span className="empty-icon">◌</span>{children}</div>; }

// A credit purchase is stored as one row per installment; list it once with its full amount.
function purchaseRows(data) {
  const purchases = new Map((data.card_purchases || []).map(item => [item.id, item]));
  return data.transactions.filter(item => !item.card_purchase_id || item.installment_number === 1).map(item => {
    const purchase = purchases.get(item.card_purchase_id);
    return purchase ? { ...item, description: purchase.description, amount_cents: purchase.total_cents } : item;
  });
}

function TransactionTable({ items, onEdit, onDelete, compact = false }) {
  if (!items.length) return <Empty>Nenhum lançamento por aqui ainda.</Empty>;
  return <div className="table-wrap"><table><thead><tr><th>Lançamento</th><th>Categoria</th><th>Conta</th><th>Data</th><th>Valor</th>{!compact && <th />}</tr></thead><tbody>{items.map(item => <tr key={item.id}>
    <td><strong>{item.description}</strong>{item.note && <span className="row-note">{item.note}</span>}</td>
    <td><span className="pill">{item.category}</span>{item.subcategory_name && <span className="sub-label">{item.subcategory_name}</span>}</td>
    <td className="muted">{item.account_name}{methodLabel(item) && <span className="sub-label method-label">{methodLabel(item)}</span>}</td><td className="muted">{day(item.date)}</td>
    <td className={item.kind === 'income' ? 'amount-plus' : 'amount-minus'}>{item.kind === 'income' ? '+' : '−'} {brl(item.amount_cents)}</td>
    {!compact && <td>{item.bill_id ? <span className="muted">Pagamento</span> : item.planned_income_id ? <span className="muted">Recebimento</span> : item.automatic_yield ? <span className="muted">Rendimento automático</span> : item.movement_type === 'transfer' ? <div className="table-actions"><button className="button tiny ghost" onClick={() => onDelete(item.id, 'Excluir este aporte ou resgate do limite garantido?')}>Excluir</button></div> : <div className="table-actions"><button className="button tiny ghost" onClick={() => onEdit(item)}>Editar</button><button className="button tiny ghost" onClick={() => onDelete(item.id, item.card_purchase_id ? 'Excluir esta compra e todas as parcelas?' : undefined)}>{item.card_purchase_id ? 'Excluir compra' : 'Excluir'}</button></div>}</td>}
  </tr>)}</tbody></table></div>;
}

function Auth({ setup, onSuccess }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api(setup ? '/api/setup' : '/api/login', 'POST', Object.fromEntries(new FormData(event.currentTarget))); await onSuccess(); }
    catch (caught) { setError(caught.message); setBusy(false); }
  }
  return <div className="auth-shell"><div className="auth-art"><div className="brand"><span className="brand-mark">F<span>.</span></span><span>finances</span></div><div><h1>Seu dinheiro,<br /><em>mais claro.</em></h1><p>Contas, planos e investimentos do grupo reunidos em um só espaço.</p></div><small>FINANCES © {new Date().getFullYear()}</small></div><div className="auth-form-wrap"><div className="auth-card"><div className="eyebrow">{setup ? 'PRIMEIRO ACESSO' : 'BEM-VINDO DE VOLTA'}</div><h2>{setup ? 'Crie o administrador' : 'Acesse sua conta'}</h2><p>{setup ? 'Este acesso poderá convidar outras pessoas.' : 'Entre para acompanhar as finanças compartilhadas.'}</p><form onSubmit={submit}>{setup && <div><label htmlFor="auth-name">Seu nome</label><input id="auth-name" name="name" required maxLength={80} autoComplete="name" /></div>}<div><label htmlFor="auth-email">Email</label><input id="auth-email" name="email" type="email" required autoComplete="email" /></div><div><label htmlFor="auth-password">Senha</label><input id="auth-password" name="password" type="password" required minLength={setup ? 12 : undefined} autoComplete={setup ? 'new-password' : 'current-password'} /></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="button" disabled={busy}>{busy ? 'Aguarde...' : setup ? 'Criar espaço →' : 'Entrar →'}</button></form></div></div></div>;
}

export default function App() {
  const [data, setData] = useState(null);
  const [setup, setSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [view, setView] = useState('overview');
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState('');
  const [chartRange, setChartRange] = useState(12);
  const [billFilter, setBillFilter] = useState('all');
  const [expenseTypeFilter, setExpenseTypeFilter] = useState('all');
  const [billMonthOffset, setBillMonthOffset] = useState(0);
  const [incomeMonthOffset, setIncomeMonthOffset] = useState(0);
  const [incomeFilter, setIncomeFilter] = useState('all');
  const [incomeTypeFilter, setIncomeTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categoryKind, setCategoryKind] = useState('expense');
  const [transactionFilter, setTransactionFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');

  const refresh = useCallback(async () => {
    const state = await api('/api/state');
    if (!Array.isArray(state.categories)) throw new Error('A API FastAPI precisa estar em execução para abrir a nova interface.');
    setData(state); setConnectionError(''); setLoading(false);
  }, []);
  const boot = useCallback(async () => {
    try { const info = await api('/api/bootstrap'); setSetup(info.setupRequired); if (info.user) await refresh(); else { setData(null); setLoading(false); setConnectionError(''); } }
    catch (error) { setLoading(false); setConnectionError(error.message); }
  }, [refresh]);
  useEffect(() => { boot(); }, [boot]);
  useEffect(() => {
    if (!data) return;
    const update = () => { if (!document.hidden) refresh().catch(error => setMessage(error.message)); };
    const timer = setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [data, refresh]);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 4000); return () => clearTimeout(timer); }, [message]);

  async function change(path, method, body) {
    await api(path, method, body);
    await refresh();
    setMessage('Alteração salva com sucesso.');
  }
  async function syncRates() {
    try {
      const result = await api('/api/yield-rates/sync', 'POST');
      await refresh();
      setMessage(Object.keys(result.errors || {}).length ? 'Banco Central indisponível para alguns indicadores. O último valor conhecido foi mantido.' : 'Taxas atualizadas pelo Banco Central.');
    } catch (error) { setMessage(error.message); }
  }
  async function remove(path, confirmation) {
    if (!window.confirm(confirmation || 'Excluir este registro? Esta ação não pode ser desfeita.')) return;
    try { await change(path, 'DELETE'); } catch (error) { setMessage(error.message); }
  }
  function open(type, record = null, extras = {}) { setModal({ type, record, ...extras }); }
  async function saveModal(current, values) {
    const { type, record } = current;
    const selected = { categoryId: Number(values.categoryId), subcategoryId: values.subcategoryId ? Number(values.subcategoryId) : null };
    const payment = { paymentMethod: values.paymentMethod, creditCardId: values.creditCardId ? Number(values.creditCardId) : undefined, installments: values.installments ? Number(values.installments) : undefined };
    if (type === 'account') return change(record?.id ? `/api/accounts/${record.id}` : '/api/accounts', record?.id ? 'PATCH' : 'POST', { name: values.name, type: values.type, openingCents: cents(values.opening), note: values.note, yieldRateId: values.yieldRateId ? Number(values.yieldRateId) : null, yieldMultiplierBasisPoints: rate(values.yieldMultiplier || '100') });
    if (type === 'bill') return change(record?.id ? `/api/bills/${record.id}` : '/api/bills', record?.id ? 'PATCH' : 'POST', { accountId: Number(values.accountId), description: values.description, expenseType: values.expenseType, ...selected, note: values.note, amountCents: cents(values.amount), dueDate: values.dueDate, interestRateBasisPoints: rate(values.interestRate), interestPeriod: values.interestPeriod, interestRatePeriod: values.interestRatePeriod, fineBasisPoints: rate(values.fine || '0'), fineAfter: values.fineAfter, paymentMethod: values.paymentMethod });
    if (type === 'income') return change(record?.id ? `/api/incomes/${record.id}` : '/api/incomes', record?.id ? 'PATCH' : 'POST', { accountId: Number(values.accountId), description: values.description, incomeType: values.incomeType, ...selected, note: values.note, amountCents: cents(values.amount), dueDate: values.dueDate });
    if (type === 'receipt') return change(`/api/incomes/${record.id}/receipts`, 'POST', { accountId: Number(values.accountId), amountCents: cents(values.amount), date: values.date, note: values.note });
    if (type === 'transaction' && record?.card_purchase_id) return change(`/api/transactions/${record.id}`, 'PATCH', { description: values.description, ...selected, note: values.note });
    if (type === 'transaction') return change(record?.id ? `/api/transactions/${record.id}` : '/api/transactions', record?.id ? 'PATCH' : 'POST', { kind: values.kind, accountId: Number(values.accountId), description: values.description, ...selected, note: values.note, amountCents: cents(values.amount), date: values.date, ...payment });
    if (type === 'investment') return change('/api/investments', 'POST', { name: values.name, type: values.type, principalCents: cents(values.principal), rateBasisPoints: rate(values.rate), period: values.period, startDate: values.startDate, note: values.note });
    if (type === 'yieldRate') return change(record?.id ? `/api/yield-rates/${record.id}` : '/api/yield-rates', record?.id ? 'PATCH' : 'POST', { name: values.name, sourceCode: values.sourceCode === 'manual' ? null : values.sourceCode, annualBasisPoints: values.sourceCode === 'manual' ? rate(values.annualRate) : null });
    if (type === 'payment') return change(`/api/bills/${record.id}/payments`, 'POST', { accountId: Number(values.accountId), amountCents: cents(values.amount), date: values.date, note: values.note, ...payment });
    if (type === 'card') return change(record?.id ? `/api/cards/${record.id}` : '/api/cards', record?.id ? 'PATCH' : 'POST', { name: values.name, paymentAccountId: Number(values.paymentAccountId), baseLimitCents: cents(values.baseLimit || '0'), closingDay: Number(values.closingDay), dueDay: Number(values.dueDay), lateInterestBasisPoints: rate(values.lateInterest || '0'), note: values.note, yieldRateId: values.yieldRateId ? Number(values.yieldRateId) : null, yieldMultiplierBasisPoints: rate(values.yieldMultiplier || '100') });
    if (type === 'collateral') return change(`/api/cards/${record.id}/collateral`, 'POST', { direction: values.direction, accountId: Number(values.accountId), amountCents: cents(values.amount), date: values.date, note: values.note });
    if (type === 'interest') return change(`/api/bills/${record.id}/interest`, 'PATCH', { interestRateBasisPoints: rate(values.interestRate), interestPeriod: values.interestPeriod, interestRatePeriod: values.interestRatePeriod, fineBasisPoints: rate(values.fine || '0'), fineAfter: values.fineAfter });
    if (type === 'billNote') return change(`/api/bills/${record.id}/note`, 'PATCH', { note: values.note });
    if (type === 'classification') return change(`/api/bills/${record.id}/classification`, 'PATCH', selected);
    if (type === 'category') return change(record?.id ? `/api/categories/${record.id}` : '/api/categories', record?.id ? 'PATCH' : 'POST', { kind: values.kind, name: values.name });
    if (type === 'subcategory') return change(record?.id ? `/api/subcategories/${record.id}` : '/api/subcategories', record?.id ? 'PATCH' : 'POST', { categoryId: Number(values.categoryId), name: values.name });
    if (type === 'password') return change('/api/profile/password', 'POST', values);
    if (type === 'user') return change('/api/users', 'POST', values);
    if (type === 'resetUser') return change(`/api/users/${record.id}/password`, 'POST', values);
  }

  if (loading) return <div className="loading-screen"><span className="brand-mark">F.</span><p>Carregando suas finanças...</p></div>;
  if (connectionError) return <div className="connection-screen"><div className="eyebrow">CONEXÃO INDISPONÍVEL</div><h1>Vamos reconectar.</h1><p>{connectionError}</p><button className="button" onClick={boot}>Tentar novamente →</button></div>;
  if (!data) return <Auth setup={setup} onSuccess={refresh} />;

  const openBills = data.bills.filter(item => item.status !== 'paid');
  const debt = openBills.reduce((sum, item) => sum + (item.current_cents || 0), 0);
  const overdue = data.bills.filter(item => item.status === 'overdue');
  const categoryOptions = data.categories.filter(item => item.kind === 'expense');

  let page;
  if (view === 'overview') page = <Dashboard data={data} onAccount={id => { setSelectedAccountId(id); setView('accountDetail'); }} onView={setView} />;
  if (view === 'accountDetail') page = <AccountDetails accountId={selectedAccountId} data={data} onBack={() => setView('accounts')} onEdit={item => open('account', item)} onView={setView} />;
  if (view === 'accounts') page = <>
    <Header title="Contas" subtitle="Acompanhe saldos e configure rendimentos passivos." action="Nova conta" onAction={() => open('account')} />
    <div className="cards">{data.accounts.map(item => <article className="item-card" key={item.id}>
      <div className="item-top"><span className="account-icon">{item.collateral_card_id ? '▭' : '▤'}</span><span className="pill">{item.type}</span></div>
      <h3>{item.name}</h3>{item.note && <p className="card-note">{item.note}</p>}
      <small>Saldo atual</small><div className="big-value">{brl(item.balance_cents)}</div><div className="divider" />
      <div className="flex"><span>Saldo inicial</span><b>{brl(item.opening_cents)}</b></div>
      {item.yield_rate_id && <div className="flex"><span>Rendimento</span><b>{decimal(item.yield_multiplier_basis_points)}% de {item.yield_rate_name} · {decimal(Math.round(item.yield_annual_basis_points * item.yield_multiplier_basis_points / 10000))}% a.a.</b></div>}
      {(data.credit_cards || []).filter(card => card.payment_account_id === item.id).map(card => <div className="flex" key={card.id}><span>Cartão {card.name}</span><b>{brl(card.available_cents)} disponível</b></div>)}
      <div className="item-actions wrap"><button className="button tiny" onClick={() => { setSelectedAccountId(item.id); setView('accountDetail'); }}>Ver detalhes</button>{item.collateral_card_id
        ? <button className="button tiny secondary" onClick={() => setView('cards')}>Ver cartão</button>
        : <><button className="button tiny secondary" onClick={() => open('account', item)}>Editar</button><button className="button tiny ghost" onClick={() => open('card', null, { accountId: item.id })}>Novo cartão</button><button className="button tiny ghost" onClick={() => remove(`/api/accounts/${item.id}`)}>Excluir</button></>}</div>
    </article>)}</div>
    {!data.accounts.length && <div className="panel"><Empty>Cadastre a primeira conta.</Empty></div>}
    <p className="muted">Configure as taxas de referência na aba <button className="link-button" onClick={() => setView('yieldRates')}>Taxas →</button></p>
  </>;
  if (view === 'cards') page = <>
    <Header title="Cartões" subtitle="Limites, limite garantido com rendimento e faturas de cada cartão." action="Novo cartão" onAction={() => spendableAccounts(data).length ? open('card') : setMessage('Cadastre uma conta primeiro.')} />
    <div className="cards">{(data.credit_cards || []).map(card => {
      const invoices = data.bills.filter(item => item.credit_card_id === card.id && item.status !== 'paid');
      const purchases = (data.card_purchases || []).filter(item => item.credit_card_id === card.id).slice(0, 8);
      const usedShare = card.limit_cents ? Math.min(100, card.used_cents / card.limit_cents * 100) : 0;
      return <article className="item-card credit-card" key={card.id}>
        <div className="item-top"><span className="account-icon">▭</span><span className="pill">{card.payment_account_name}</span></div>
        <h3>{card.name}</h3>{card.note && <p className="card-note">{card.note}</p>}
        <small>Limite disponível</small><div className="big-value">{brl(card.available_cents)}</div>
        <div className="limit-bar" role="img" aria-label={`${Math.round(usedShare)}% do limite usado`}><span style={{ width: `${usedShare}%` }} /></div>
        <div className="flex"><span>Usado</span><b>{brl(card.used_cents)}</b></div>
        <div className="flex"><span>Limite total</span><b>{brl(card.limit_cents)}</b></div>
        <div className="divider" />
        <div className="flex"><span>Limite base</span><b>{brl(card.base_limit_cents)}</b></div>
        <div className="flex"><span>Limite garantido</span><b>{brl(card.collateral_cents)}</b></div>
        {card.yield_rate_id && <div className="flex"><span>Rendimento do garantido</span><b>{decimal(card.yield_multiplier_basis_points)}% de {card.yield_rate_name} · {decimal(Math.round(card.yield_annual_basis_points * card.yield_multiplier_basis_points / 10000))}% a.a.</b></div>}
        <div className="flex"><span>Fechamento · vencimento</span><b>dia {card.closing_day} · dia {card.due_day}</b></div>
        <div className="divider" />
        {invoices.length ? <div className="flex"><span>Próxima fatura · {day(invoices[0].due_date)}</span><b className={invoices[0].status === 'overdue' ? 'amount-minus' : ''}>{brl(invoices[0].current_cents)}</b></div> : <p className="card-note">Nenhuma fatura em aberto.</p>}
        {invoices.length > 1 && <details className="payment-history"><summary>{invoices.length} faturas em aberto</summary>{invoices.map(item => <div className="payment-row" key={item.id}><span>{day(item.due_date)} · {statusName[item.status]}</span><b>{brl(item.current_cents)}</b></div>)}</details>}
        {purchases.length > 0 && <details className="payment-history"><summary>Compras recentes</summary>{purchases.map(item => <div className="payment-row" key={item.id}><span>{item.description}<small className="row-note">{day(item.purchase_date)} · {item.installments > 1 ? `${item.installments}x · faltam ${brl(item.remaining_cents)}` : 'À vista'}</small></span><b>{brl(item.total_cents)}</b>{!item.bill_id && <button onClick={() => remove(`/api/card-purchases/${item.id}`, 'Excluir esta compra e todas as parcelas?')} aria-label={`Excluir compra ${item.description}`}>×</button>}</div>)}</details>}
        <div className="item-actions wrap"><button className="button tiny" onClick={() => open('transaction', { kind: 'expense', account_id: card.payment_account_id, payment_method: 'credit', credit_card_id: card.id })}>Nova compra</button><button className="button tiny secondary" onClick={() => open('collateral', card, { direction: 'deposit' })}>Aportar</button><button className="button tiny secondary" disabled={!card.collateral_cents} onClick={() => open('collateral', card, { direction: 'withdraw' })}>Resgatar</button><button className="button tiny ghost" onClick={() => open('card', card)}>Editar</button><button className="button tiny ghost" onClick={() => remove(`/api/cards/${card.id}`)}>Excluir</button></div>
      </article>;
    })}</div>
    {!(data.credit_cards || []).length && <div className="panel"><Empty>Cadastre um cartão em uma conta para lançar compras no crédito.</Empty></div>}
  </>;
  if (view === 'yieldRates') page = <>
    <Header title="Taxas de referência" subtitle="Crie taxas manuais ou vinculadas ao CDI e à Selic Meta do Banco Central." action="Nova taxa" onAction={() => open('yieldRate')} />
    {data.yield_rates.some(item => item.source_code) && <div className="rate-sync-row"><span>Taxas automáticas são consultadas diariamente e antes do rendimento das contas.</span><button className="button tiny secondary" onClick={syncRates}>Atualizar agora</button></div>}
    <div className="cards">{data.yield_rates.map(item => <article className="item-card" key={item.id}>
      <div className="item-top"><span className="account-icon">％</span><span className="pill">{item.source_code ? 'Automática' : 'Manual'}</span></div>
      <h3>{item.name}</h3><div className="big-value">{decimal(item.annual_basis_points)}%</div>
      {item.source_code && <p className="rate-source-detail">{item.source_code === 'cdi' ? 'CDI' : 'Selic Meta'} · Banco Central{item.source_date ? ` · Referência ${day(item.source_date)}` : ''}</p>}
      {item.sync_error && <p className="rate-sync-error" role="status">{item.sync_error}</p>}
      <div className="item-actions"><button className="button tiny secondary" onClick={() => open('yieldRate', item)}>Editar</button><button className="button tiny ghost" onClick={() => remove(`/api/yield-rates/${item.id}`)}>Excluir</button></div>
    </article>)}</div>
    {!data.yield_rates.length && <div className="panel"><Empty>Cadastre uma taxa para configurar rendimentos passivos nas contas.</Empty></div>}
  </>;
  if (view === 'bills') {
    const immediate = purchaseRows(data).filter(item => item.kind === 'expense' && !item.bill_id && item.movement_type !== 'transfer');
    const immediateRows = purchaseRows(data).filter(item => item.kind === 'expense' && !item.bill_id && item.movement_type !== 'transfer' && (methodFilter === 'all' || item.payment_method === methodFilter));
    const filtered = data.bills.filter(item => (billFilter === 'all' || item.status === billFilter) && (expenseTypeFilter === 'all' || (item.expense_type || 'eventual') === expenseTypeFilter) && (categoryFilter === 'all' || String(item.category_id) === categoryFilter) && (methodFilter === 'all' || (item.credit_card_id ? 'credit' : item.payment_method) === methodFilter));
    const selectedMonth = data.due_series[billMonthOffset] || data.due_series[0];
    const monthBills = (selectedMonth?.items || []).map(entry => ({ ...entry, bill: data.bills.find(item => item.id === entry.id) })).filter(entry => entry.bill);
    const monthLabel = selectedMonth ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(`${selectedMonth.date.slice(0, 7)}-01T12:00:00`)) : '';
    page = <><Header title="Despesas" subtitle="Planeje vencimentos, acompanhe juros e registre pagamentos." action="Nova despesa" onAction={() => data.accounts.length ? open('bill') : setMessage('Cadastre uma conta primeiro.')} />
      <section className="debt-summary"><div><span>Em aberto</span><strong>{brl(debt)}</strong><small>{openBills.length} despesas para acompanhar</small></div><div><span>Vencidas</span><strong>{brl(overdue.reduce((sum, item) => sum + (item.current_cents || 0), 0))}</strong><small>{overdue.length} com prazo ultrapassado</small></div><div><span>Quitadas</span><strong>{data.bills.filter(item => item.status === 'paid').length + immediate.length}</strong><small>Inclui saídas imediatas</small></div></section>
      <section className="panel monthly-payables"><div className="panel-header"><div><div className="eyebrow">CONTAS POR MÊS</div><h2>O que pagar em {monthLabel}</h2><p>Despesas anteriores sem pagamento continuam nos meses seguintes até serem quitadas.</p></div><div className="month-navigation"><button className="button tiny secondary" disabled={billMonthOffset === 0} onClick={() => setBillMonthOffset(value => value - 1)} aria-label="Mês anterior">←</button><button className="button tiny secondary" disabled={billMonthOffset >= data.due_series.length - 1} onClick={() => setBillMonthOffset(value => value + 1)} aria-label="Próximo mês">→</button></div></div>
        <div className="monthly-total"><span>Total previsto para o mês</span><strong>{brl(selectedMonth?.value_cents || 0)}</strong></div>
        {monthBills.length ? <div className="monthly-list">{monthBills.map(({ bill, value_cents, carried }) => <div className="monthly-row" key={bill.id}><div><strong>{bill.description}</strong><small>{carried ? `Pendente desde ${day(bill.due_date)}` : `Vence ${day(bill.due_date)}`} · {bill.account_name}</small></div><span className={carried ? 'pill carry-pill' : 'pill'}>{carried ? 'Anterior' : 'Deste mês'}</span><b>{brl(value_cents)}</b></div>)}</div> : <Empty>Nenhuma conta a pagar neste mês.</Empty>}
      </section>
      <section className="panel chart-panel debt-chart"><div className="panel-header"><div><div className="eyebrow">CENÁRIO</div><h2>Se nada mais for pago</h2><p>Saldo devedor projetado com juros</p></div><RangeButtons value={chartRange} onChange={setChartRange} /></div><LineChart series={data.debt_series.slice(0, chartRange + 1)} title="Projeção de dívidas" accent="#dca792" /></section>
      <div className="section-heading"><div><h2>Contas a pagar</h2><p>Filtre e selecione uma despesa para registrar pagamentos.</p></div><div className="filter-row">{[['all', 'Todas'], ['pending', 'Pendentes'], ['overdue', 'Vencidas'], ['paid', 'Pagas']].map(([value, label]) => <button key={value} className={`filter ${billFilter === value ? 'active' : ''}`} onClick={() => setBillFilter(value)}>{label}</button>)}</div></div>
      <div className="inline-filter"><label htmlFor="bill-type-filter">Tipo</label><select id="bill-type-filter" value={expenseTypeFilter} onChange={event => setExpenseTypeFilter(event.target.value)}><option value="all">Todos os tipos</option><option value="fixed">Fixas</option><option value="eventual">Eventuais</option></select><label htmlFor="bill-category-filter">Categoria</label><select id="bill-category-filter" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="all">Todas as categorias</option>{categoryOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><label htmlFor="bill-method-filter">Pagamento</label><select id="bill-method-filter" value={methodFilter} onChange={event => setMethodFilter(event.target.value)}><option value="all">Todas as formas</option>{Object.entries(methodName).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="bill-grid">{filtered.map(item => <article className={`bill-card ${item.status}`} key={item.id}><div className="bill-card-top"><span className={`status-pill ${item.status}`}><span />{statusName[item.status]}</span><span className="bill-due">{item.status === 'overdue' ? `${item.days_overdue} dias em atraso` : `Vencimento ${day(item.due_date)}`}</span></div><h3>{item.description}</h3><p className="bill-meta">{item.credit_card_id ? `Fatura do cartão ${item.card_name} · ${item.account_name}` : <>{item.expense_type === "fixed" ? "Fixa · " : "Eventual · "}{item.category}{item.subcategory_name ? ` / ${item.subcategory_name}` : ''} · {item.account_name} · {methodName[item.payment_method] || 'Pix'}</>}</p>{item.note && <p className="card-note">{item.note}</p>}<div className="bill-amount"><span>Saldo {item.status === 'paid' ? 'quitado' : 'atualizado'}</span><strong>{brl(item.current_cents)}</strong></div><div className="bill-details"><span>Valor original <b>{brl(item.amount_cents)}</b></span><span>Juros <b>{item.interest_rate_basis_points ? `${decimal(item.interest_rate_basis_points)}% ${periodName[item.interest_rate_period || item.interest_period]}${(item.interest_rate_period || item.interest_period) !== item.interest_period ? `, aplicado ${periodName[item.interest_period]}` : ''}` : 'Sem juros'}</b></span>{item.fine_basis_points > 0 && <span>Multa <b>{decimal(item.fine_basis_points)}% após 1 {{ day: 'dia', month: 'mês', year: 'ano' }[item.fine_after]}</b></span>}<span>Já pago <b>{brl(item.paid_cents)}</b></span></div>{item.payments.length > 0 && <details className="payment-history"><summary>{item.payments.length} pagamentos</summary>{item.payments.map(payment => <div className="payment-row" key={payment.id}><span>{day(payment.date)} · {payment.card_purchase_id ? `Crédito ${payment.card_name}${payment.installments > 1 ? ` · ${payment.installments}x` : ''}` : `${payment.account_name}${payment.payment_method ? ` · ${methodName[payment.payment_method]}` : ''}`}{payment.note && <small className="row-note">{payment.note}</small>}</span><b>{brl(payment.amount_cents)}</b><button onClick={() => remove(`/api/bills/${item.id}/payments/${payment.id}`, payment.card_purchase_id ? 'Excluir este pagamento no crédito e todas as parcelas?' : undefined)} aria-label="Excluir pagamento">×</button></div>)}</details>}<div className="bill-actions">{item.status !== 'paid' && <><button className="button tiny" onClick={() => open('payment', item)}>Pagar</button><button className="button tiny secondary" onClick={() => open('interest', item)}>Juros e multa</button></>}{!item.credit_card_id && <button className="button tiny ghost" onClick={() => open('classification', item)}>Classificar</button>}<button className="button tiny ghost" onClick={() => open('billNote', item)}>Observações</button>{item.expense_type === 'fixed' && item.series_active && <button className="button tiny ghost" onClick={() => { if (window.confirm('Encerrar a repetição mensal? As próximas despesas ainda não pagas serão removidas.')) change(`/api/bills/${item.id}/stop-recurrence`, 'PATCH').catch(error => setMessage(error.message)); }}>Encerrar repetição</button>}{!item.payments.length && !item.credit_card_id && <><button className="button tiny ghost" onClick={() => open('bill', item)}>Editar</button><button className="button tiny ghost" onClick={() => remove(`/api/bills/${item.id}`, item.expense_type === 'fixed' && !item.recurrence_origin_id ? 'Excluir esta série fixa e todas as parcelas sem pagamento?' : undefined)}>{item.expense_type === 'fixed' && !item.recurrence_origin_id ? 'Excluir série' : 'Excluir'}</button></>}</div></article>)}</div>
      {!filtered.length && <div className="panel"><Empty>Nenhuma despesa neste filtro.</Empty></div>}{(billFilter === 'all' || billFilter === 'paid') && expenseTypeFilter !== 'fixed' && immediateRows.length > 0 && <section className="panel legacy-panel"><div className="panel-header"><div><h2>Despesas pagas diretamente</h2><p>Lançamentos imediatos, inclusive compras no cartão</p></div></div><TransactionTable items={immediateRows} compact /></section>}</>;
  }
  if (view === 'incomes') {
    const entries = data.incomes || [];
    const filtered = entries.filter(item => (incomeFilter === 'all' || item.status === incomeFilter) && (incomeTypeFilter === 'all' || item.income_type === incomeTypeFilter));
    const selectedMonth = data.income_series?.[incomeMonthOffset] || data.income_series?.[0];
    const monthEntries = (selectedMonth?.items || []).map(entry => ({ ...entry, income: entries.find(item => item.id === entry.id) })).filter(entry => entry.income);
    const monthLabel = selectedMonth ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(`${selectedMonth.date.slice(0, 7)}-01T12:00:00`)) : '';
    page = <><Header title="Entradas" subtitle="Planeje salários e outras receitas e registre o recebimento quando acontecer." action="Nova entrada" onAction={() => data.accounts.length ? open('income') : setMessage('Cadastre uma conta primeiro.')} />
      <section className="debt-summary"><div><span>A receber</span><strong>{brl(entries.reduce((sum, item) => sum + item.remaining_cents, 0))}</strong><small>{entries.filter(item => item.remaining_cents > 0).length} entradas em aberto</small></div><div><span>Em atraso</span><strong>{brl(entries.filter(item => item.status === 'overdue').reduce((sum, item) => sum + item.remaining_cents, 0))}</strong><small>{entries.filter(item => item.status === 'overdue').length} entradas vencidas</small></div><div><span>Recebidas</span><strong>{entries.filter(item => item.status === 'received').length}</strong><small>Entradas integralmente recebidas</small></div></section>
      <section className="panel monthly-payables"><div className="panel-header"><div><div className="eyebrow">ENTRADAS POR MÊS</div><h2>O que receber em {monthLabel}</h2><p>Entradas anteriores pendentes continuam nos meses seguintes até serem recebidas.</p></div><div className="month-navigation"><button className="button tiny secondary" disabled={incomeMonthOffset === 0} onClick={() => setIncomeMonthOffset(value => value - 1)} aria-label="Mês anterior">←</button><button className="button tiny secondary" disabled={incomeMonthOffset >= (data.income_series?.length || 1) - 1} onClick={() => setIncomeMonthOffset(value => value + 1)} aria-label="Próximo mês">→</button></div></div>
        <div className="monthly-total"><span>Total previsto para receber</span><strong>{brl(selectedMonth?.value_cents || 0)}</strong></div>
        {monthEntries.length ? <div className="monthly-list">{monthEntries.map(({ income: item, value_cents, carried }) => <div className="monthly-row" key={item.id}><div><strong>{item.description}</strong><small>{carried ? `Pendente desde ${day(item.due_date)}` : `Prevista para ${day(item.due_date)}`} · {item.account_name}</small></div><span className={carried ? 'pill carry-pill' : 'pill'}>{carried ? 'Anterior' : 'Deste mês'}</span><b>{brl(value_cents)}</b></div>)}</div> : <Empty>Nenhuma entrada a receber neste mês.</Empty>}
      </section>
      <div className="section-heading"><div><h2>Entradas previstas</h2><p>Registre recebimentos totais ou parciais.</p></div><div className="filter-row">{[['all', 'Todas'], ['pending', 'Pendentes'], ['overdue', 'Atrasadas'], ['received', 'Recebidas']].map(([value, label]) => <button key={value} className={`filter ${incomeFilter === value ? 'active' : ''}`} onClick={() => setIncomeFilter(value)}>{label}</button>)}</div></div>
      <div className="inline-filter"><label htmlFor="income-type-filter">Tipo</label><select id="income-type-filter" value={incomeTypeFilter} onChange={event => setIncomeTypeFilter(event.target.value)}><option value="all">Todos os tipos</option><option value="fixed">Fixas</option><option value="eventual">Eventuais</option></select></div>
      <div className="bill-grid">{filtered.map(item => <article className={`bill-card income-card ${item.status}`} key={item.id}><div className="bill-card-top"><span className={`status-pill ${item.status}`}><span />{{ pending: 'Pendente', overdue: 'Atrasada', received: 'Recebida' }[item.status]}</span><span className="bill-due">Prevista para {day(item.due_date)}</span></div><h3>{item.description}</h3><p className="bill-meta">{item.income_type === 'fixed' ? 'Fixa' : 'Eventual'} · {item.category}{item.subcategory_name ? ` / ${item.subcategory_name}` : ''} · {item.account_name}</p>{item.note && <p className="card-note">{item.note}</p>}<div className="bill-amount"><span>Falta receber</span><strong>{brl(item.remaining_cents)}</strong></div><div className="bill-details"><span>Valor previsto <b>{brl(item.amount_cents)}</b></span><span>Já recebido <b>{brl(item.received_cents)}</b></span></div>{item.receipts.length > 0 && <details className="payment-history"><summary>{item.receipts.length} recebimentos</summary>{item.receipts.map(receipt => <div className="payment-row" key={receipt.id}><span>{day(receipt.date)} · {receipt.account_name}{receipt.note && <small className="row-note">{receipt.note}</small>}</span><b>{brl(receipt.amount_cents)}</b><button onClick={() => remove(`/api/incomes/${item.id}/receipts/${receipt.id}`)} aria-label="Excluir recebimento">×</button></div>)}</details>}<div className="bill-actions">{item.remaining_cents > 0 && <button className="button tiny" onClick={() => open('receipt', item)}>Receber</button>}{item.income_type === 'fixed' && item.series_active && <button className="button tiny ghost" onClick={() => { if (window.confirm('Encerrar a repetição mensal? As próximas entradas ainda não recebidas serão removidas.')) change(`/api/incomes/${item.id}/stop-recurrence`, 'PATCH').catch(error => setMessage(error.message)); }}>Encerrar repetição</button>}{!item.receipts.length && <><button className="button tiny ghost" onClick={() => open('income', item)}>Editar</button><button className="button tiny ghost" onClick={() => remove(`/api/incomes/${item.id}`, item.income_type === 'fixed' && !item.recurrence_origin_id ? 'Excluir esta série fixa e as parcelas sem recebimento?' : undefined)}>{item.income_type === 'fixed' && !item.recurrence_origin_id ? 'Excluir série' : 'Excluir'}</button></>}</div></article>)}</div>
      {!filtered.length && <div className="panel"><Empty>Nenhuma entrada neste filtro.</Empty></div>}</>;
  }
  if (view === 'transactions') {
    const filtered = purchaseRows(data).filter(item => transactionFilter === 'all' || (transactionFilter === 'credit' ? item.card_purchase_id : item.kind === transactionFilter));
    page = <><Header title="Lançamentos" subtitle="Entradas e saídas realizadas, com categoria e observações." action="Novo lançamento" onAction={() => data.accounts.length ? open('transaction') : setMessage('Cadastre uma conta primeiro.')} /><div className="filter-row page-filters">{[['all', 'Todos'], ['expense', 'Despesas'], ['credit', 'Cartão'], ['income', 'Entradas']].map(([value, label]) => <button key={value} className={`filter ${transactionFilter === value ? 'active' : ''}`} onClick={() => setTransactionFilter(value)}>{label}</button>)}</div><section className="panel"><div className="panel-header"><div><h2>Histórico</h2><p>Até 500 lançamentos mais recentes</p></div><span className="pill">{filtered.length} registros</span></div><TransactionTable items={filtered} onEdit={item => open('transaction', item)} onDelete={(id, confirmation) => remove(`/api/transactions/${id}`, confirmation)} /></section></>;
  }
  if (view === 'categories') {
    const list = data.categories.filter(item => item.kind === categoryKind);
    page = <><Header title="Categorias" subtitle="Crie grupos e subgrupos para organizar receitas e despesas." action="Nova categoria" onAction={() => open('category', null, { kind: categoryKind })} /><div className="filter-row page-filters"><button className={`filter ${categoryKind === 'expense' ? 'active' : ''}`} onClick={() => setCategoryKind('expense')}>Despesas</button><button className={`filter ${categoryKind === 'income' ? 'active' : ''}`} onClick={() => setCategoryKind('income')}>Entradas</button></div><div className="category-grid">{list.map(item => <article className="category-card" key={item.id}><div className="category-card-head"><div><small>{categoryKind === 'expense' ? 'DESPESA' : 'ENTRADA'}</small><h3>{item.name}</h3></div><div><button className="button tiny ghost" onClick={() => open('category', item)}>Renomear</button><button className="button tiny ghost" onClick={() => remove(`/api/categories/${item.id}`)}>Excluir</button></div></div><div className="subcategory-list">{data.subcategories.filter(sub => sub.category_id === item.id).map(sub => <div key={sub.id}><span>{sub.name}</span><button onClick={() => open('subcategory', sub)} aria-label={`Renomear ${sub.name}`}>Editar</button><button onClick={() => remove(`/api/subcategories/${sub.id}`)} aria-label={`Excluir ${sub.name}`}>×</button></div>)}</div><button className="category-add" onClick={() => open('subcategory', null, { categoryId: item.id })}>＋ Adicionar subcategoria</button></article>)}</div>{!list.length && <div className="panel"><Empty>Nenhuma categoria cadastrada.</Empty></div>}</>;
  }
  if (view === 'investments') page = <><Header title="Investimentos" subtitle="Os rendimentos são atualizados diariamente pela taxa de cada caixa." action="Novo investimento" onAction={() => open('investment')} /><section className="panel chart-panel"><div className="panel-header"><div><div className="eyebrow">EVOLUÇÃO</div><h2>Patrimônio projetado</h2><p>Juros compostos acumulados ao longo do tempo</p></div><RangeButtons value={chartRange} onChange={setChartRange} /></div><LineChart series={data.investment_series.slice(0, chartRange + 1)} title="Projeção de investimentos" /></section><div className="cards">{data.investments.map(item => <article className="item-card" key={item.id}><div className="item-top"><span className="account-icon">◈</span><span className="pill blue">{item.type}</span></div><h3>{item.name}</h3>{item.note && <p className="card-note">{item.note}</p>}<small>Valor estimado hoje</small><div className="big-value">{brl(item.current_cents)}</div><div className="divider" /><div className="flex"><span>Valor inicial</span><b>{brl(item.principal_cents)}</b></div><div className="flex"><span>Taxa</span><b>{decimal(item.rate_basis_points)}% {periodName[item.period]}</b></div><div className="flex"><span>Início</span><b>{day(item.start_date)}</b></div><div className="flex"><span>Em 12 meses</span><b>{brl(item.future_cents)}</b></div><div className="item-actions"><button className="button tiny ghost" onClick={() => remove(`/api/investments/${item.id}`)}>Excluir caixa</button></div></article>)}</div>{!data.investments.length && <div className="panel"><Empty>Crie um caixa para acompanhar uma projeção.</Empty></div>}<p className="muted investment-disclaimer">Projeções brutas. Não incluem impostos, aportes ou resgates.</p></>;
  if (view === 'users') page = <><Header title="Pessoas" subtitle="Todos os usuários ativos acessam as mesmas informações." action="Nova pessoa" onAction={() => open('user')} /><section className="panel"><div className="panel-header"><div><h2>Acessos do grupo</h2><p>Somente o administrador gerencia pessoas</p></div></div><div className="table-wrap"><table><thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Estado</th><th /></tr></thead><tbody>{data.users.map(item => <tr key={item.id}><td><strong>{item.name}</strong></td><td className="muted">{item.email}</td><td>{item.role === 'admin' ? 'Administrador' : 'Membro'}</td><td><span className="pill">{item.active ? 'Ativo' : 'Inativo'}</span></td><td>{item.role === 'member' && <div className="table-actions"><button className="button tiny ghost" onClick={() => open('resetUser', item)}>Nova senha</button><button className="button tiny ghost" onClick={() => change(`/api/users/${item.id}`, 'PATCH', { active: !item.active }).catch(error => setMessage(error.message))}>{item.active ? 'Desativar' : 'Ativar'}</button></div>}</td></tr>)}</tbody></table></div></section></>;
  if (view === 'profile') page = <><Header title="Seu perfil" subtitle="Gerencie a segurança do seu acesso." /><section className="panel profile-panel"><div className="panel-header"><div><h2>Seus dados</h2><p>{data.user.email}</p></div></div><div className="profile-detail"><div className="flex"><span>Nome</span><b>{data.user.name}</b></div><div className="flex"><span>Perfil</span><b>{data.user.role === 'admin' ? 'Administrador' : 'Membro'}</b></div><button className="button secondary" onClick={() => open('password')}>Trocar senha</button></div></section></>;

  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">F<span>.</span></span><span>finances<small>ESPAÇO COMPARTILHADO</small></span></div><nav aria-label="Navegação principal">{nav.filter(([key]) => key !== 'users' || data.user.role === 'admin').map(([key, icon, label]) => <button key={key} className={`nav-item ${view === key || view === 'accountDetail' && key === 'accounts' ? 'active' : ''}`} onClick={() => setView(key)}><span className="nav-icon">{icon}</span>{label}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-note"><span className="note-dot" />Dados compartilhados com seu grupo</div><button className="logout" onClick={async () => { try { await api('/api/logout', 'POST'); setData(null); setView('overview'); } catch (error) { setMessage(error.message); } }}>Sair da conta <span>↗</span></button></div></aside><div className="content-wrap"><header className="topbar"><div className="mobile-brand">F<span>.</span> <strong>finances</strong></div><span>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date(`${data.today}T12:00:00`))}</span><div className="profile"><span className="avatar">{data.user.name.charAt(0).toUpperCase()}</span><span>{data.user.name}</span></div></header><main key={view} className="page-enter">{page}</main></div>{modal && <Modal key={`${modal.type}-${modal.record?.id || 'new'}`} modal={modal} data={data} onClose={() => setModal(null)} onSave={saveModal} />}{message && <div id="toast" className="show" role="status">{message}</div>}</div>;
}

function RangeButtons({ value, onChange }) { return <div className="segmented"><button className={value === 6 ? 'selected' : ''} onClick={() => onChange(6)}>6 meses</button><button className={value === 12 ? 'selected' : ''} onClick={() => onChange(12)}>12 meses</button></div>; }
