import React, { useCallback, useEffect, useState } from 'react';
import { api, brl, cents, day, decimal, periodName, rate, statusName } from './lib.js';
import { DueChart, LineChart, SpendingChart } from './Charts.jsx';
import Modal from './Modal.jsx';

const nav = [
  ['overview', '◫', 'Visão geral'], ['accounts', '▤', 'Contas'], ['bills', '◷', 'Despesas'],
  ['transactions', '⇄', 'Lançamentos'], ['categories', '▦', 'Categorias'],
  ['investments', '◈', 'Investimentos'], ['users', '♙', 'Pessoas'], ['profile', '⚙', 'Perfil']
];

function Header({ title, subtitle, action, onAction }) {
  return <div className="page-head"><div><div className="eyebrow"><span className="eyebrow-line" /> FINANÇAS COMPARTILHADAS</div><h1>{title}</h1><p>{subtitle}</p></div>{action && <button className="button" onClick={onAction}><span className="plus">＋</span>{action}</button>}</div>;
}

function Empty({ children }) { return <div className="empty"><span className="empty-icon">◌</span>{children}</div>; }

function TransactionTable({ items, onEdit, onDelete, compact = false }) {
  if (!items.length) return <Empty>Nenhum lançamento por aqui ainda.</Empty>;
  return <div className="table-wrap"><table><thead><tr><th>Lançamento</th><th>Categoria</th><th>Conta</th><th>Data</th><th>Valor</th>{!compact && <th />}</tr></thead><tbody>{items.map(item => <tr key={item.id}>
    <td><strong>{item.description}</strong>{item.note && <span className="row-note">{item.note}</span>}</td>
    <td><span className="pill">{item.category}</span>{item.subcategory_name && <span className="sub-label">{item.subcategory_name}</span>}</td>
    <td className="muted">{item.account_name}</td><td className="muted">{day(item.date)}</td>
    <td className={item.kind === 'income' ? 'amount-plus' : 'amount-minus'}>{item.kind === 'income' ? '+' : '−'} {brl(item.amount_cents)}</td>
    {!compact && <td>{item.bill_id ? <span className="muted">Pagamento</span> : <div className="table-actions"><button className="button tiny ghost" onClick={() => onEdit(item)}>Editar</button><button className="button tiny ghost" onClick={() => onDelete(item.id)}>Excluir</button></div>}</td>}
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
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState('');
  const [chartRange, setChartRange] = useState(12);
  const [billFilter, setBillFilter] = useState('all');
  const [expenseTypeFilter, setExpenseTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categoryKind, setCategoryKind] = useState('expense');
  const [transactionFilter, setTransactionFilter] = useState('all');

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
  async function remove(path, confirmation = 'Excluir este registro? Esta ação não pode ser desfeita.') {
    if (!window.confirm(confirmation)) return;
    try { await change(path, 'DELETE'); } catch (error) { setMessage(error.message); }
  }
  function open(type, record = null, extras = {}) { setModal({ type, record, ...extras }); }
  async function saveModal(current, values) {
    const { type, record } = current;
    const selected = { categoryId: Number(values.categoryId), subcategoryId: values.subcategoryId ? Number(values.subcategoryId) : null };
    if (type === 'account') return change(record?.id ? `/api/accounts/${record.id}` : '/api/accounts', record?.id ? 'PATCH' : 'POST', { name: values.name, type: values.type, openingCents: cents(values.opening), note: values.note });
    if (type === 'bill') return change(record?.id ? `/api/bills/${record.id}` : '/api/bills', record?.id ? 'PATCH' : 'POST', { accountId: Number(values.accountId), description: values.description, expenseType: values.expenseType, ...selected, note: values.note, amountCents: cents(values.amount), dueDate: values.dueDate, interestRateBasisPoints: rate(values.interestRate), interestPeriod: values.interestPeriod });
    if (type === 'transaction') return change(record?.id ? `/api/transactions/${record.id}` : '/api/transactions', record?.id ? 'PATCH' : 'POST', { kind: values.kind, accountId: Number(values.accountId), description: values.description, ...selected, note: values.note, amountCents: cents(values.amount), date: values.date });
    if (type === 'investment') return change('/api/investments', 'POST', { name: values.name, type: values.type, principalCents: cents(values.principal), rateBasisPoints: rate(values.rate), period: values.period, startDate: values.startDate, note: values.note });
    if (type === 'payment') return change(`/api/bills/${record.id}/payments`, 'POST', { accountId: Number(values.accountId), amountCents: cents(values.amount), date: values.date, note: values.note });
    if (type === 'interest') return change(`/api/bills/${record.id}/interest`, 'PATCH', { interestRateBasisPoints: rate(values.interestRate), interestPeriod: values.interestPeriod });
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

  const monthlyTransactions = data.transactions.filter(item => item.date.startsWith(data.today.slice(0, 7)) && item.date <= data.today);
  const income = data.monthly_totals?.income_cents || 0;
  const expense = data.monthly_spending.reduce((sum, item) => sum + item.amount_cents, 0);
  const balance = data.accounts.reduce((sum, item) => sum + item.balance_cents, 0);
  const invested = data.investments.reduce((sum, item) => sum + (item.current_cents || 0), 0);
  const openBills = data.bills.filter(item => item.status !== 'paid');
  const debt = openBills.reduce((sum, item) => sum + (item.current_cents || 0), 0);
  const overdue = data.bills.filter(item => item.status === 'overdue');
  const categoryOptions = data.categories.filter(item => item.kind === 'expense');

  let page;
  if (view === 'overview') page = <>
    <Header title="Visão geral" subtitle="Seu dinheiro em movimento, hoje e nos próximos meses." />
    <section className="stats four"><div className="stat featured"><div className="stat-top"><span className="stat-label">Saldo em contas</span><span className="stat-symbol">↗</span></div><div className="stat-value">{brl(balance)}</div><div className="stat-foot">Disponível em {data.accounts.length} contas</div></div>
      <div className="stat"><div className="stat-top"><span className="stat-label">Investido hoje</span><span className="stat-symbol copper">◈</span></div><div className="stat-value">{brl(invested)}</div><div className="stat-foot">Projeção atualizada diariamente</div></div>
      <div className="stat"><div className="stat-top"><span className="stat-label">Contas a pagar</span><span className="stat-symbol rose">◷</span></div><div className="stat-value">{brl(debt)}</div><div className="stat-foot">{openBills.length} em aberto · {overdue.length} vencidas</div></div>
      <div className="stat"><div className="stat-top"><span className="stat-label">Balanço do mês</span><span className="stat-symbol">⇄</span></div><div className={`stat-value ${income - expense < 0 ? 'amount-minus' : 'amount-plus'}`}>{brl(income - expense)}</div><div className="stat-foot">{brl(income)} entradas · {brl(expense)} saídas</div></div></section>
    <div className="grid-two charts-grid"><section className="panel chart-panel spending-panel"><div className="panel-header"><div><div className="eyebrow">GASTOS REAIS · MÊS ATUAL</div><h2>Para onde foi o dinheiro?</h2><p>Clique em uma categoria para ver subcategorias e pagamentos.</p></div><span className="pill">{brl(expense)}</span></div><SpendingChart rows={data.monthly_spending} transactions={monthlyTransactions} /></section>
      <section className="panel chart-panel"><div className="panel-header"><div><div className="eyebrow">PLANEJAMENTO</div><h2>Próximos vencimentos</h2><p>Valores abertos por mês</p></div><button className="link-button" onClick={() => setView('bills')}>Ver despesas →</button></div><DueChart series={data.due_series} /><div className="chart-caption">Despesas vencidas aparecem no mês atual.</div></section></div>
    <div className="grid-two"><section className="panel chart-panel"><div className="panel-header"><div><div className="eyebrow">PROJEÇÃO</div><h2>Investimentos</h2><p>Juros compostos ao longo do tempo</p></div><RangeButtons value={chartRange} onChange={setChartRange} /></div><LineChart series={data.investment_series.slice(0, chartRange + 1)} title="Projeção de investimentos" /></section>
      <section className="panel"><div className="panel-header"><div><h2>Despesas em atenção</h2><p>Vencidas e próximas do prazo</p></div><button className="link-button" onClick={() => setView('bills')}>Ver todas →</button></div>{openBills.length ? <div className="attention-list">{[...openBills].sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 5).map(item => <button className="attention-row" key={item.id} onClick={() => setView('bills')}><span className={`attention-dot ${item.status}`} /><span><strong>{item.description}</strong><small>{item.category} · {item.status === 'overdue' ? `${item.days_overdue} dias de atraso` : `Vence ${day(item.due_date)}`}</small></span><b>{brl(item.current_cents)}</b></button>)}</div> : <Empty>Nenhuma despesa em aberto.</Empty>}</section></div>
  </>;
  if (view === 'accounts') page = <><Header title="Contas" subtitle="Cada conta com seu saldo e suas anotações." action="Nova conta" onAction={() => open('account')} /><div className="cards">{data.accounts.map(item => <article className="item-card" key={item.id}><div className="item-top"><span className="account-icon">▤</span><span className="pill">{item.type}</span></div><h3>{item.name}</h3>{item.note && <p className="card-note">{item.note}</p>}<small>Saldo atual</small><div className="big-value">{brl(item.balance_cents)}</div><div className="divider" /><div className="flex"><span>Saldo inicial</span><b>{brl(item.opening_cents)}</b></div><div className="item-actions"><button className="button tiny secondary" onClick={() => open('account', item)}>Editar</button><button className="button tiny ghost" onClick={() => remove(`/api/accounts/${item.id}`)}>Excluir</button></div></article>)}</div>{!data.accounts.length && <div className="panel"><Empty>Cadastre a primeira conta.</Empty></div>}</>;
  if (view === 'bills') {
    const immediate = data.transactions.filter(item => item.kind === 'expense' && !item.bill_id);
    const filtered = data.bills.filter(item => (billFilter === 'all' || item.status === billFilter) && (expenseTypeFilter === 'all' || (item.expense_type || 'eventual') === expenseTypeFilter) && (categoryFilter === 'all' || String(item.category_id) === categoryFilter));
    page = <><Header title="Despesas" subtitle="Planeje vencimentos, acompanhe juros e registre pagamentos." action="Nova despesa" onAction={() => data.accounts.length ? open('bill') : setMessage('Cadastre uma conta primeiro.')} />
      <section className="debt-summary"><div><span>Em aberto</span><strong>{brl(debt)}</strong><small>{openBills.length} despesas para acompanhar</small></div><div><span>Vencidas</span><strong>{brl(overdue.reduce((sum, item) => sum + (item.current_cents || 0), 0))}</strong><small>{overdue.length} com prazo ultrapassado</small></div><div><span>Quitadas</span><strong>{data.bills.filter(item => item.status === 'paid').length + immediate.length}</strong><small>Inclui saídas imediatas</small></div></section>
      <section className="panel chart-panel debt-chart"><div className="panel-header"><div><div className="eyebrow">CENÁRIO</div><h2>Se nada mais for pago</h2><p>Saldo devedor projetado com juros</p></div><RangeButtons value={chartRange} onChange={setChartRange} /></div><LineChart series={data.debt_series.slice(0, chartRange + 1)} title="Projeção de dívidas" accent="#dca792" /></section>
      <div className="section-heading"><div><h2>Contas a pagar</h2><p>Filtre e selecione uma despesa para registrar pagamentos.</p></div><div className="filter-row">{[['all', 'Todas'], ['pending', 'Pendentes'], ['overdue', 'Vencidas'], ['paid', 'Pagas']].map(([value, label]) => <button key={value} className={`filter ${billFilter === value ? 'active' : ''}`} onClick={() => setBillFilter(value)}>{label}</button>)}</div></div>
      <div className="inline-filter"><label htmlFor="bill-type-filter">Tipo</label><select id="bill-type-filter" value={expenseTypeFilter} onChange={event => setExpenseTypeFilter(event.target.value)}><option value="all">Todos os tipos</option><option value="fixed">Fixas</option><option value="eventual">Eventuais</option></select><label htmlFor="bill-category-filter">Categoria</label><select id="bill-category-filter" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="all">Todas as categorias</option>{categoryOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="bill-grid">{filtered.map(item => <article className={`bill-card ${item.status}`} key={item.id}><div className="bill-card-top"><span className={`status-pill ${item.status}`}><span />{statusName[item.status]}</span><span className="bill-due">{item.status === 'overdue' ? `${item.days_overdue} dias em atraso` : `Vencimento ${day(item.due_date)}`}</span></div><h3>{item.description}</h3><p className="bill-meta">{item.expense_type === "fixed" ? "Fixa · " : "Eventual · "}{item.category}{item.subcategory_name ? ` / ${item.subcategory_name}` : ''} · {item.account_name}</p>{item.note && <p className="card-note">{item.note}</p>}<div className="bill-amount"><span>Saldo {item.status === 'paid' ? 'quitado' : 'atualizado'}</span><strong>{brl(item.current_cents)}</strong></div><div className="bill-details"><span>Valor original <b>{brl(item.amount_cents)}</b></span><span>Juros <b>{item.interest_rate_basis_points ? `${decimal(item.interest_rate_basis_points)}% ${periodName[item.interest_period]}` : 'Sem juros'}</b></span><span>Já pago <b>{brl(item.paid_cents)}</b></span></div>{item.payments.length > 0 && <details className="payment-history"><summary>{item.payments.length} pagamentos</summary>{item.payments.map(payment => <div className="payment-row" key={payment.id}><span>{day(payment.date)} · {payment.account_name}{payment.note && <small className="row-note">{payment.note}</small>}</span><b>{brl(payment.amount_cents)}</b><button onClick={() => remove(`/api/bills/${item.id}/payments/${payment.id}`)} aria-label="Excluir pagamento">×</button></div>)}</details>}<div className="bill-actions">{item.status !== 'paid' && <><button className="button tiny" onClick={() => open('payment', item)}>Pagar</button><button className="button tiny secondary" onClick={() => open('interest', item)}>Juros</button></>}<button className="button tiny ghost" onClick={() => open('classification', item)}>Classificar</button><button className="button tiny ghost" onClick={() => open('billNote', item)}>Observações</button>{item.expense_type === 'fixed' && item.series_active && <button className="button tiny ghost" onClick={() => { if (window.confirm('Encerrar a repetição mensal? As próximas despesas ainda não pagas serão removidas.')) change(`/api/bills/${item.id}/stop-recurrence`, 'PATCH').catch(error => setMessage(error.message)); }}>Encerrar repetição</button>}{!item.payments.length && <><button className="button tiny ghost" onClick={() => open('bill', item)}>Editar</button><button className="button tiny ghost" onClick={() => remove(`/api/bills/${item.id}`, item.expense_type === 'fixed' && !item.recurrence_origin_id ? 'Excluir esta série fixa e todas as parcelas sem pagamento?' : undefined)}>{item.expense_type === 'fixed' && !item.recurrence_origin_id ? 'Excluir série' : 'Excluir'}</button></>}</div></article>)}</div>
      {!filtered.length && <div className="panel"><Empty>Nenhuma despesa neste filtro.</Empty></div>}{(billFilter === 'all' || billFilter === 'paid') && expenseTypeFilter !== 'fixed' && immediate.length > 0 && <section className="panel legacy-panel"><div className="panel-header"><div><h2>Despesas pagas diretamente</h2><p>Lançamentos imediatos</p></div></div><TransactionTable items={immediate} compact /></section>}</>;
  }
  if (view === 'transactions') {
    const filtered = data.transactions.filter(item => transactionFilter === 'all' || item.kind === transactionFilter);
    page = <><Header title="Lançamentos" subtitle="Entradas e saídas realizadas, com categoria e observações." action="Novo lançamento" onAction={() => data.accounts.length ? open('transaction') : setMessage('Cadastre uma conta primeiro.')} /><div className="filter-row page-filters">{[['all', 'Todos'], ['expense', 'Despesas'], ['income', 'Entradas']].map(([value, label]) => <button key={value} className={`filter ${transactionFilter === value ? 'active' : ''}`} onClick={() => setTransactionFilter(value)}>{label}</button>)}</div><section className="panel"><div className="panel-header"><div><h2>Histórico</h2><p>Até 500 lançamentos mais recentes</p></div><span className="pill">{filtered.length} registros</span></div><TransactionTable items={filtered} onEdit={item => open('transaction', item)} onDelete={id => remove(`/api/transactions/${id}`)} /></section></>;
  }
  if (view === 'categories') {
    const list = data.categories.filter(item => item.kind === categoryKind);
    page = <><Header title="Categorias" subtitle="Crie grupos e subgrupos para organizar receitas e despesas." action="Nova categoria" onAction={() => open('category', null, { kind: categoryKind })} /><div className="filter-row page-filters"><button className={`filter ${categoryKind === 'expense' ? 'active' : ''}`} onClick={() => setCategoryKind('expense')}>Despesas</button><button className={`filter ${categoryKind === 'income' ? 'active' : ''}`} onClick={() => setCategoryKind('income')}>Entradas</button></div><div className="category-grid">{list.map(item => <article className="category-card" key={item.id}><div className="category-card-head"><div><small>{categoryKind === 'expense' ? 'DESPESA' : 'ENTRADA'}</small><h3>{item.name}</h3></div><div><button className="button tiny ghost" onClick={() => open('category', item)}>Renomear</button><button className="button tiny ghost" onClick={() => remove(`/api/categories/${item.id}`)}>Excluir</button></div></div><div className="subcategory-list">{data.subcategories.filter(sub => sub.category_id === item.id).map(sub => <div key={sub.id}><span>{sub.name}</span><button onClick={() => open('subcategory', sub)} aria-label={`Renomear ${sub.name}`}>Editar</button><button onClick={() => remove(`/api/subcategories/${sub.id}`)} aria-label={`Excluir ${sub.name}`}>×</button></div>)}</div><button className="category-add" onClick={() => open('subcategory', null, { categoryId: item.id })}>＋ Adicionar subcategoria</button></article>)}</div>{!list.length && <div className="panel"><Empty>Nenhuma categoria cadastrada.</Empty></div>}</>;
  }
  if (view === 'investments') page = <><Header title="Investimentos" subtitle="Os rendimentos são atualizados diariamente pela taxa de cada caixa." action="Novo investimento" onAction={() => open('investment')} /><section className="panel chart-panel"><div className="panel-header"><div><div className="eyebrow">EVOLUÇÃO</div><h2>Patrimônio projetado</h2><p>Juros compostos acumulados ao longo do tempo</p></div><RangeButtons value={chartRange} onChange={setChartRange} /></div><LineChart series={data.investment_series.slice(0, chartRange + 1)} title="Projeção de investimentos" /></section><div className="cards">{data.investments.map(item => <article className="item-card" key={item.id}><div className="item-top"><span className="account-icon">◈</span><span className="pill blue">{item.type}</span></div><h3>{item.name}</h3>{item.note && <p className="card-note">{item.note}</p>}<small>Valor estimado hoje</small><div className="big-value">{brl(item.current_cents)}</div><div className="divider" /><div className="flex"><span>Valor inicial</span><b>{brl(item.principal_cents)}</b></div><div className="flex"><span>Taxa</span><b>{decimal(item.rate_basis_points)}% {periodName[item.period]}</b></div><div className="flex"><span>Início</span><b>{day(item.start_date)}</b></div><div className="flex"><span>Em 12 meses</span><b>{brl(item.future_cents)}</b></div><div className="item-actions"><button className="button tiny ghost" onClick={() => remove(`/api/investments/${item.id}`)}>Excluir caixa</button></div></article>)}</div>{!data.investments.length && <div className="panel"><Empty>Crie um caixa para acompanhar uma projeção.</Empty></div>}<p className="muted investment-disclaimer">Projeções brutas. Não incluem impostos, aportes ou resgates.</p></>;
  if (view === 'users') page = <><Header title="Pessoas" subtitle="Todos os usuários ativos acessam as mesmas informações." action="Nova pessoa" onAction={() => open('user')} /><section className="panel"><div className="panel-header"><div><h2>Acessos do grupo</h2><p>Somente o administrador gerencia pessoas</p></div></div><div className="table-wrap"><table><thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Estado</th><th /></tr></thead><tbody>{data.users.map(item => <tr key={item.id}><td><strong>{item.name}</strong></td><td className="muted">{item.email}</td><td>{item.role === 'admin' ? 'Administrador' : 'Membro'}</td><td><span className="pill">{item.active ? 'Ativo' : 'Inativo'}</span></td><td>{item.role === 'member' && <div className="table-actions"><button className="button tiny ghost" onClick={() => open('resetUser', item)}>Nova senha</button><button className="button tiny ghost" onClick={() => change(`/api/users/${item.id}`, 'PATCH', { active: !item.active }).catch(error => setMessage(error.message))}>{item.active ? 'Desativar' : 'Ativar'}</button></div>}</td></tr>)}</tbody></table></div></section></>;
  if (view === 'profile') page = <><Header title="Seu perfil" subtitle="Gerencie a segurança do seu acesso." /><section className="panel profile-panel"><div className="panel-header"><div><h2>Seus dados</h2><p>{data.user.email}</p></div></div><div className="profile-detail"><div className="flex"><span>Nome</span><b>{data.user.name}</b></div><div className="flex"><span>Perfil</span><b>{data.user.role === 'admin' ? 'Administrador' : 'Membro'}</b></div><button className="button secondary" onClick={() => open('password')}>Trocar senha</button></div></section></>;

  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">F<span>.</span></span><span>finances<small>ESPAÇO COMPARTILHADO</small></span></div><nav aria-label="Navegação principal">{nav.filter(([key]) => key !== 'users' || data.user.role === 'admin').map(([key, icon, label]) => <button key={key} className={`nav-item ${view === key ? 'active' : ''}`} onClick={() => setView(key)}><span className="nav-icon">{icon}</span>{label}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-note"><span className="note-dot" />Dados compartilhados com seu grupo</div><button className="logout" onClick={async () => { try { await api('/api/logout', 'POST'); setData(null); setView('overview'); } catch (error) { setMessage(error.message); } }}>Sair da conta <span>↗</span></button></div></aside><div className="content-wrap"><header className="topbar"><div className="mobile-brand">F<span>.</span> <strong>finances</strong></div><span>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date(`${data.today}T12:00:00`))}</span><div className="profile"><span className="avatar">{data.user.name.charAt(0).toUpperCase()}</span><span>{data.user.name}</span></div></header><main key={view} className="page-enter">{page}</main></div>{modal && <Modal key={`${modal.type}-${modal.record?.id || 'new'}`} modal={modal} data={data} onClose={() => setModal(null)} onSave={saveModal} />}{message && <div id="toast" className="show" role="status">{message}</div>}</div>;
}

function RangeButtons({ value, onChange }) { return <div className="segmented"><button className={value === 6 ? 'selected' : ''} onClick={() => onChange(6)}>6 meses</button><button className={value === 12 ? 'selected' : ''} onClick={() => onChange(12)}>12 meses</button></div>; }
