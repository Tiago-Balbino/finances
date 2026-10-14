const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[ch]);
const brl = value => value == null ? '—' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value / 100);
const day = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—';
const decimal = cents => (cents / 100).toFixed(2);
const cents = value => Math.round(Number(String(value).replace(',', '.')) * 100);
const rate = value => Math.round(Number(String(value).replace(',', '.')) * 100);
const periodName = {daily:'ao dia',monthly:'ao mês',yearly:'ao ano'};
const billStateName = {pending:'Pendente',overdue:'Vencida',paid:'Paga'};
let data = null, view = 'overview', billFilter = 'all', chartRange = 12;

async function request(url, options = {}) {
  const response = await fetch(url, { credentials:'same-origin', ...options,
    headers: { 'Content-Type':'application/json', ...(options.headers || {}) } });
  let value;
  try { value = await response.json(); } catch { throw new Error('Não foi possível falar com a API.'); }
  if (!response.ok) throw new Error(value.error || 'Não foi possível concluir.');
  return value;
}
const send = (url, method, value) => request(url, { method, body: value === undefined ? undefined : JSON.stringify(value) });
function toast(message, error = false) {
  const element = $('#toast'); element.textContent = message; element.className = `show${error ? ' error' : ''}`;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => element.className = '', 3500);
}

async function start() {
  try {
    const bootstrap = await request('/api/bootstrap');
    if (bootstrap.user) await refresh(); else showAuth(bootstrap.setupRequired);
  } catch (error) { showConnectionError(error.message); }
}
function showConnectionError(message) {
  $('#app').hidden = true; $('#auth').hidden = false;
  $('#auth').innerHTML = `<div class="auth-art"><div class="brand"><span class="brand-mark">F<span>.</span></span><span>finances</span></div><div><h1>Vamos<br><em>reconectar.</em></h1><p>Precisamos da API para abrir suas informações financeiras.</p></div></div>
    <div class="auth-form-wrap"><div class="auth-card"><div class="eyebrow">CONEXÃO INDISPONÍVEL</div><h2>Não foi possível carregar</h2><p>${escapeHtml(message)} Verifique se a API e o PostgreSQL estão em execução.</p><button class="button" id="retry-connection">Tentar novamente →</button></div></div>`;
  $('#retry-connection').onclick = start;
}
function showAuth(setup) {
  $('#app').hidden = true; $('#auth').hidden = false;
  $('#auth').innerHTML = `<div class="auth-art"><div class="brand"><span class="brand-mark">F<span>.</span></span><span>finances</span></div><div><h1>Seu dinheiro,<br><em>mais claro.</em></h1><p>Um espaço para o grupo acompanhar contas, movimentos e investimentos com tranquilidade.</p></div><small>FINANCES © ${new Date().getFullYear()}</small></div>
    <div class="auth-form-wrap"><div class="auth-card"><div class="eyebrow">${setup ? 'PRIMEIRO ACESSO' : 'BEM-VINDO DE VOLTA'}</div><h2>${setup ? 'Crie o administrador' : 'Acesse sua conta'}</h2><p>${setup ? 'Este usuário poderá convidar as outras pessoas do grupo.' : 'Entre para acompanhar as finanças compartilhadas.'}</p>
    <form id="auth-form">${setup ? '<div><label for="auth-name">Seu nome</label><input id="auth-name" name="name" required maxlength="80" autocomplete="name" placeholder="Como podemos chamar você?"></div>' : ''}<div><label for="auth-email">Email</label><input id="auth-email" name="email" type="email" required autocomplete="email" placeholder="voce@exemplo.com"></div><div><label for="auth-password">Senha</label><input id="auth-password" name="password" type="password" required minlength="12" autocomplete="${setup ? 'new-password' : 'current-password'}" placeholder="Mínimo de 12 caracteres"></div><p class="form-error" id="auth-error"></p><button class="button" type="submit">${setup ? 'Criar espaço' : 'Entrar'} →</button></form></div></div>`;
  $('#auth-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true;
    const values = Object.fromEntries(new FormData(form));
    try { await send(setup ? '/api/setup' : '/api/login', 'POST', values); await refresh(); }
    catch (error) { $('#auth-error').textContent = error.message; button.disabled = false; }
  });
}
async function refresh() {
  try {
    data = await request('/api/state');
    if (!Array.isArray(data.bills)) return showConnectionError('A API precisa ser reiniciada para carregar a nova versão.');
    $('#auth').hidden = true; $('#app').hidden = false;
    $('#user-label').textContent = data.user.name; $('#avatar').textContent = data.user.name.charAt(0).toUpperCase();
    $('#users-nav').hidden = data.user.role !== 'admin';
    $('#today-label').textContent = new Intl.DateTimeFormat('pt-BR',{dateStyle:'full'}).format(new Date(`${data.today}T12:00:00`));
    render();
  } catch (error) { if (error.message === 'Entre na sua conta.') return showAuth(false); if (!data) return showConnectionError(error.message); toast(error.message, true); }
}
function setView(next) {
  view = next; document.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('active', x.dataset.view === view)); render();
}
function head(title, subtitle, action, label) {
  return `<div class="page-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> FINANÇAS COMPARTILHADAS</div><h1>${title}</h1><p>${subtitle}</p></div>${action ? `<button class="button" data-action="${action}"><span class="plus">＋</span> ${label}</button>` : ''}</div>`;
}
const empty = message => `<div class="empty"><span class="empty-icon">◌</span>${message}</div>`;
function transactionTable(items, compact = false) {
  if (!items.length) return empty('Nenhum lançamento por aqui ainda.');
  return `<div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Conta</th><th>Data</th><th>Valor</th>${compact ? '' : '<th></th>'}</tr></thead><tbody>${items.map(t => `<tr><td><strong>${escapeHtml(t.description)}</strong><br><span class="muted">${escapeHtml(t.category)}</span></td><td class="muted">${escapeHtml(t.account_name)}</td><td class="muted">${day(t.date)}</td><td class="${t.kind === 'income' ? 'amount-plus' : 'amount-minus'}">${t.kind === 'income' ? '+' : '−'} ${brl(t.amount_cents)}</td>${compact ? '' : `<td>${t.bill_id ? '<span class="muted">Pagamento</span>' : `<button class="button tiny ghost" data-action="delete-transaction" data-id="${t.id}" aria-label="Excluir lançamento">Excluir</button>`}</td>`}</tr>`).join('')}</tbody></table></div>`;
}
const monthLabel = iso => new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:'UTC'}).format(new Date(`${iso}T12:00:00Z`)).replace('.','');
function lineChart(series, id, accent) {
  if (!series.length || series.every(x => !x.value_cents)) return `<div class="chart-empty"><span>◌</span>${id === 'investment' ? 'Cadastre um investimento para ver a projeção.' : 'Cadastre uma despesa para ver a projeção da dívida.'}</div>`;
  const values = series.map(x => x.value_cents || 0), max = Math.max(...values,1) * 1.12;
  const x = i => 28 + i * (564 / Math.max(1,series.length-1));
  const y = value => 192 - value / max * 158;
  const points = series.map((p,i) => `${x(i)},${y(p.value_cents || 0)}`).join(' ');
  const area = `28,192 ${points} 592,192`;
  return `<div class="chart-plot"><svg viewBox="0 0 620 220" role="img" aria-label="Projeção mensal de ${id === 'investment' ? 'investimentos' : 'dívidas'}">
    <defs><linearGradient id="fade-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${accent}" stop-opacity=".24"/><stop offset="100%" stop-color="${accent}" stop-opacity="0"/></linearGradient></defs>
    ${[0,1,2,3].map(i => `<line x1="28" y1="${34+i*52}" x2="592" y2="${34+i*52}" class="chart-grid"/>`).join('')}
    <polygon points="${area}" fill="url(#fade-${id})"/><polyline points="${points}" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${series.map((p,i) => `<circle class="chart-point" cx="${x(i)}" cy="${y(p.value_cents || 0)}" r="5" fill="${accent}" tabindex="0" data-point-date="${p.date}" data-point-value="${p.value_cents || 0}" aria-label="${monthLabel(p.date)}: ${brl(p.value_cents)}"/>`).join('')}
    ${series.map((p,i) => i % Math.max(1,Math.floor((series.length-1)/4)) === 0 || i === series.length-1 ? `<text x="${x(i)}" y="215" text-anchor="middle" class="chart-axis">${monthLabel(p.date)}</text>` : '').join('')}
    </svg><div class="chart-tooltip" id="tooltip-${id}">Passe o ponteiro pelos pontos para ver os valores</div></div>`;
}
function dueBars(series) {
  const max = Math.max(1,...series.map(x => x.value_cents || 0));
  return `<div class="bar-chart" aria-label="Vencimentos por mês">${series.map((x,i) => `<button class="bar-column" type="button" data-due-index="${i}" aria-label="${monthLabel(x.date)}: ${brl(x.value_cents)}"><span class="bar-value">${x.value_cents ? brl(x.value_cents) : '—'}</span><span class="bar-track"><span class="bar-fill" style="height:${Math.max(x.value_cents ? 9 : 2,(x.value_cents || 0)/max*100)}%"></span></span><span class="bar-month">${monthLabel(x.date)}</span></button>`).join('')}</div>`;
}
function overview() {
  const balance = data.accounts.reduce((sum,x) => sum + x.balance_cents,0);
  const invest = data.investments.reduce((sum,x) => sum + (x.current_cents ?? 0),0);
  const bills = data.bills || [];
  const debt = bills.filter(x => x.status !== 'paid').reduce((sum,x) => sum + (x.current_cents || 0),0);
  const overdue = bills.filter(x => x.status === 'overdue');
  const month = data.today.slice(0,7);
  const monthly = data.transactions.filter(x => x.date.startsWith(month) && x.date <= data.today);
  const income = monthly.filter(x => x.kind === 'income').reduce((sum,x) => sum + x.amount_cents,0);
  const expense = monthly.filter(x => x.kind === 'expense').reduce((sum,x) => sum + x.amount_cents,0);
  const series = (data.investment_series || []).slice(0,chartRange+1);
  return head('Visão geral','Seu dinheiro em movimento, hoje e nos próximos meses.') + `<section class="stats four" aria-label="Resumo financeiro">
    <div class="stat featured"><div class="stat-top"><span class="stat-label">Saldo em contas</span><span class="stat-symbol">↗</span></div><div class="stat-value">${brl(balance)}</div><div class="stat-foot">Disponível em ${data.accounts.length} ${data.accounts.length === 1 ? 'conta' : 'contas'}</div></div>
    <div class="stat"><div class="stat-top"><span class="stat-label">Investido hoje</span><span class="stat-symbol copper">◈</span></div><div class="stat-value">${brl(invest)}</div><div class="stat-foot">Projeção atualizada diariamente</div></div>
    <div class="stat"><div class="stat-top"><span class="stat-label">Contas a pagar</span><span class="stat-symbol rose">◷</span></div><div class="stat-value">${brl(debt)}</div><div class="stat-foot">${bills.filter(x=>x.status!=='paid').length} em aberto · ${overdue.length} vencidas</div></div>
    <div class="stat"><div class="stat-top"><span class="stat-label">Balanço do mês</span><span class="stat-symbol">⇄</span></div><div class="stat-value ${income-expense < 0 ? 'amount-minus' : 'amount-plus'}">${brl(income-expense)}</div><div class="stat-foot">${brl(income)} entradas · ${brl(expense)} saídas</div></div></section>
    <div class="grid-two charts-grid"><section class="panel chart-panel"><div class="panel-header"><div><div class="eyebrow">PROJEÇÃO</div><h2>Crescimento dos investimentos</h2><p>Rendimento bruto estimado dia a dia</p></div><div class="segmented"><button class="${chartRange===6?'selected':''}" data-chart-range="6">6 meses</button><button class="${chartRange===12?'selected':''}" data-chart-range="12">12 meses</button></div></div>${lineChart(series,'investment','#d59a70')}</section>
    <section class="panel chart-panel"><div class="panel-header"><div><div class="eyebrow">PLANEJAMENTO</div><h2>Próximos vencimentos</h2><p>Valores em aberto por mês</p></div><button class="link-button" data-view="bills">Ver despesas →</button></div>${dueBars(data.due_series || [])}<div class="chart-caption">Despesas vencidas aparecem no mês atual.</div></section></div>
    <div class="grid-two"><section class="panel"><div class="panel-header"><div><h2>Despesas em atenção</h2><p>Vencidas e próximas do prazo</p></div><button class="link-button" data-view="bills">Ver todas →</button></div>${bills.filter(x=>x.status!=='paid').length ? `<div class="attention-list">${bills.filter(x=>x.status!=='paid').sort((a,b)=>a.due_date.localeCompare(b.due_date)).slice(0,4).map(x=>`<button class="attention-row" data-view="bills"><span class="attention-dot ${x.status}"></span><span><strong>${escapeHtml(x.description)}</strong><small>${x.status==='overdue' ? `${x.days_overdue} dias de atraso` : `Vence ${day(x.due_date)}`}</small></span><b>${brl(x.current_cents)}</b></button>`).join('')}</div>` : empty('Nenhuma despesa em aberto.')}</section>
    <section class="panel"><div class="panel-header"><div><h2>Últimos lançamentos</h2><p>Entradas e pagamentos registrados</p></div><button class="link-button" data-view="transactions">Ver todos →</button></div>${transactionTable(data.transactions.slice(0,4),true)}</section></div>`;
}
function accounts() {
  return head('Contas','Cada conta com seu saldo, tudo em um só lugar.','new-account','Nova conta') + `<div class="cards">${data.accounts.map(x => `<article class="item-card"><div class="item-top"><span class="account-icon">▤</span><span class="pill">${escapeHtml(x.type)}</span></div><h3>${escapeHtml(x.name)}</h3><small>Saldo atual</small><div class="big-value">${brl(x.balance_cents)}</div><div class="divider"></div><div class="flex"><span>Saldo inicial</span><b>${brl(x.opening_cents)}</b></div><div class="item-actions"><button class="button tiny secondary" data-action="edit-account" data-id="${x.id}">Editar</button><button class="button tiny ghost" data-action="delete-account" data-id="${x.id}">Excluir</button></div></article>`).join('')}</div>${data.accounts.length ? '' : `<div class="panel">${empty('Você ainda não tem contas. Comece cadastrando uma.')}</div>`}`;
}
function bills() {
  const all = data.bills || [];
  const immediate = data.transactions.filter(x => x.kind === 'expense' && !x.bill_id);
  const open = all.filter(x => x.status !== 'paid');
  const overdue = all.filter(x => x.status === 'overdue');
  const selected = billFilter === 'all' ? all : all.filter(x => x.status === billFilter);
  const ordered = [...selected].sort((a,b) => ({overdue:0,pending:1,paid:2})[a.status] - ({overdue:0,pending:1,paid:2})[b.status] || a.due_date.localeCompare(b.due_date));
  const debt = open.reduce((sum,x) => sum + (x.current_cents || 0),0);
  const overdueCents = overdue.reduce((sum,x) => sum + (x.current_cents || 0),0);
  return head('Despesas','Organize vencimentos, juros e pagamentos em um só lugar.','new-bill','Nova despesa') + `<section class="debt-summary"><div><span>Em aberto</span><strong>${brl(debt)}</strong><small>${open.length} ${open.length===1?'despesa':'despesas'} para acompanhar</small></div><div><span>Vencidas</span><strong>${brl(overdueCents)}</strong><small>${overdue.length} com prazo ultrapassado</small></div><div><span>Quitadas</span><strong>${all.filter(x=>x.status==='paid').length + immediate.length}</strong><small>Inclui saídas imediatas recentes</small></div></section>
    <section class="panel chart-panel debt-chart"><div class="panel-header"><div><div class="eyebrow">CENÁRIO</div><h2>Se nada mais for pago</h2><p>Saldo devedor projetado com juros e vencimentos cadastrados</p></div><div class="segmented"><button class="${chartRange===6?'selected':''}" data-chart-range="6">6 meses</button><button class="${chartRange===12?'selected':''}" data-chart-range="12">12 meses</button></div></div>${lineChart((data.debt_series||[]).slice(0,chartRange+1),'debt','#dca792')}</section>
    <div class="section-heading"><div><h2>Contas a pagar</h2><p>Selecione uma despesa para registrar pagamentos.</p></div><div class="filter-row">${[['all','Todas'],['pending','Pendentes'],['overdue','Vencidas'],['paid','Pagas']].map(([key,label])=>`<button class="filter ${billFilter===key?'active':''}" data-bill-filter="${key}">${label} <span>${key==='all'?all.length+immediate.length:key==='paid'?all.filter(x=>x.status==='paid').length+immediate.length:all.filter(x=>x.status===key).length}</span></button>`).join('')}</div></div>
    <div class="bill-grid">${ordered.map(x => `<article class="bill-card ${x.status}"><div class="bill-card-top"><span class="status-pill ${x.status}"><span></span>${billStateName[x.status]}</span><span class="bill-due">${x.status==='overdue' ? `${x.days_overdue} ${x.days_overdue===1?'dia':'dias'} em atraso` : `Vencimento ${day(x.due_date)}`}</span></div><h3>${escapeHtml(x.description)}</h3><p class="bill-meta">${escapeHtml(x.category)} · ${escapeHtml(x.account_name)}</p><div class="bill-amount"><span>Saldo ${x.status==='paid'?'quitado':'atualizado'}</span><strong>${brl(x.current_cents)}</strong></div><div class="bill-details"><span>Valor original <b>${brl(x.amount_cents)}</b></span><span>Juros <b>${x.interest_rate_basis_points ? `${(x.interest_rate_basis_points/100).toLocaleString('pt-BR',{maximumFractionDigits:2})}% ${periodName[x.interest_period]}` : 'Sem juros'}</b></span><span>Já pago <b>${brl(x.paid_cents)}</b></span></div>${x.payments.length ? `<details class="payment-history"><summary>${x.payments.length} ${x.payments.length===1?'pagamento':'pagamentos'}</summary>${x.payments.map(p=>`<div class="payment-row"><span>${day(p.date)} · ${escapeHtml(p.account_name)}</span><b>${brl(p.amount_cents)}</b><button data-action="delete-payment" data-id="${x.id}" data-payment-id="${p.id}" aria-label="Excluir pagamento">×</button></div>`).join('')}</details>` : ''}<div class="bill-actions">${x.status!=='paid' ? `<button class="button tiny" data-action="pay-bill" data-id="${x.id}">Registrar pagamento</button><button class="button tiny secondary" data-action="interest-bill" data-id="${x.id}">Juros</button>` : ''}${!x.payments.length ? `<button class="button tiny ghost" data-action="edit-bill" data-id="${x.id}">Editar</button><button class="button tiny ghost" data-action="delete-bill" data-id="${x.id}">Excluir</button>` : ''}</div></article>`).join('')}</div>${(billFilter==='all'||billFilter==='paid') && immediate.length ? `<section class="panel legacy-panel"><div class="panel-header"><div><h2>Saídas imediatas pagas</h2><p>Lançamentos antigos ou registrados diretamente na conta</p></div><span class="status-pill paid"><span></span>Pagas</span></div>${transactionTable(immediate,true)}</section>` : ''}${ordered.length || ((billFilter==='all'||billFilter==='paid') && immediate.length) ? '' : `<div class="panel">${empty(billFilter==='all'?'Nenhuma despesa cadastrada.':'Nenhuma despesa neste status.')}</div>`}`;
}
function transactions() {
  return head('Lançamentos','Histórico de entradas, saídas e pagamentos realizados.','new-transaction','Lançamento imediato') + `<section class="panel"><div class="panel-header"><div><h2>Histórico</h2><p>Até 500 lançamentos mais recentes</p></div><span class="pill">${data.transactions.length} registros</span></div>${transactionTable(data.transactions)}</section>`;
}
function investments() {
  return head('Investimentos','Os rendimentos são atualizados diariamente pela taxa de cada caixa.','new-investment','Novo investimento') + `<section class="panel chart-panel"><div class="panel-header"><div><div class="eyebrow">EVOLUÇÃO</div><h2>Patrimônio projetado</h2><p>Juros compostos acumulados ao longo do tempo</p></div><div class="segmented"><button class="${chartRange===6?'selected':''}" data-chart-range="6">6 meses</button><button class="${chartRange===12?'selected':''}" data-chart-range="12">12 meses</button></div></div>${lineChart((data.investment_series||[]).slice(0,chartRange+1),'investment','#d59a70')}</section><div class="cards">${data.investments.map(x => `<article class="item-card"><div class="item-top"><span class="account-icon">◈</span><span class="pill blue">${escapeHtml(x.type)}</span></div><h3>${escapeHtml(x.name)}</h3><small>Valor estimado hoje</small><div class="big-value">${brl(x.current_cents)}</div><div class="divider"></div><div class="flex"><span>Valor inicial</span><b>${brl(x.principal_cents)}</b></div><div class="flex"><span>Taxa</span><b>${(x.rate_basis_points/100).toLocaleString('pt-BR',{maximumFractionDigits:2})}% ${periodName[x.period]}</b></div><div class="flex"><span>Início</span><b>${day(x.start_date)}</b></div><div class="flex"><span>Em 12 meses</span><b>${brl(x.future_cents)}</b></div><div class="item-actions"><button class="button tiny ghost" data-action="delete-investment" data-id="${x.id}">Excluir caixa</button></div></article>`).join('')}</div>${data.investments.length ? '<p class="muted" style="font-size:11px;margin-top:18px">Projeções brutas. Não incluem impostos, aportes ou resgates.</p>' : `<div class="panel">${empty('Crie um caixa para acompanhar uma projeção.')}</div>`}`;
}
function users() {
  if (data.user.role !== 'admin') return overview();
  return head('Pessoas','Todos os usuários ativos acessam as mesmas informações.','new-user','Nova pessoa') + `<section class="panel"><div class="panel-header"><div><h2>Acessos do grupo</h2><p>Somente o administrador pode gerenciar pessoas</p></div></div><div class="table-wrap"><table><thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Estado</th><th></th></tr></thead><tbody>${data.users.map(x => `<tr><td><strong>${escapeHtml(x.name)}</strong></td><td class="muted">${escapeHtml(x.email)}</td><td>${x.role === 'admin' ? 'Administrador' : 'Membro'}</td><td><span class="pill">${x.active ? 'Ativo' : 'Inativo'}</span></td><td>${x.role === 'member' ? `<button class="button tiny ghost" data-action="reset-user" data-id="${x.id}">Nova senha</button> <button class="button tiny ghost" data-action="toggle-user" data-id="${x.id}">${x.active ? 'Desativar' : 'Ativar'}</button>` : ''}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function profile() {
  return head('Seu perfil','Gerencie a segurança do seu acesso.') + `<section class="panel" style="max-width:540px"><div class="panel-header"><div><h2>Seus dados</h2><p>${escapeHtml(data.user.email)}</p></div></div><div style="padding:0 24px 24px"><div class="flex"><span>Nome</span><b>${escapeHtml(data.user.name)}</b></div><div class="flex"><span>Perfil</span><b>${data.user.role === 'admin' ? 'Administrador' : 'Membro'}</b></div><button class="button secondary" data-action="change-password" style="margin-top:15px">Trocar senha</button></div></section>`;
}
function render() { $('#content').innerHTML = ({overview,accounts,bills,transactions,investments,users,profile})[view](); }

function modal(title, subtitle, fields, onSubmit, button = 'Salvar') {
  $('#modal-body').innerHTML = `<h2>${title}</h2><p>${subtitle}</p><form id="modal-form"><div class="form-grid">${fields}</div><p class="form-error" id="modal-error"></p><div class="modal-actions"><button type="button" class="button secondary" id="cancel-modal">Cancelar</button><button type="submit" class="button">${button}</button></div></form>`;
  $('#cancel-modal').onclick = () => $('#modal').close();
  $('#modal-form').onsubmit = async event => {
    event.preventDefault(); const form = event.currentTarget, submit = form.querySelector('[type=submit]'); submit.disabled = true;
    try { await onSubmit(Object.fromEntries(new FormData(form))); $('#modal').close(); await refresh(); toast('Salvo com sucesso.'); }
    catch (error) { $('#modal-error').textContent = error.message; submit.disabled = false; }
  };
  $('#modal').showModal();
}
const field = (label,name,type='text',value='',extra='') => `<div><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" required ${extra}></div>`;
const select = (label,name,options,selected) => `<div><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}">${options.map(([value,text]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${text}</option>`).join('')}</select></div>`;
function accountForm(existing) {
  modal(existing ? 'Editar conta' : 'Nova conta','Defina o saldo inicial e identifique onde o dinheiro está.',
    field('Nome da conta','name','text',existing?.name || '', 'maxlength="120"') + select('Tipo','type',[['Conta corrente','Conta corrente'],['Poupança','Poupança'],['Carteira','Carteira'],['Outro','Outro']],existing?.type) + field('Saldo inicial (R$)','opening','number',existing ? decimal(existing.opening_cents) : '0.00','min="0" step="0.01"'),
    v => send(existing ? `/api/accounts/${existing.id}` : '/api/accounts',existing ? 'PATCH' : 'POST',{name:v.name,type:v.type,openingCents:cents(v.opening)}));
}
function billForm(existing) {
  if (!data.accounts.length) return toast('Cadastre uma conta antes da despesa.',true);
  modal(existing ? 'Editar despesa' : 'Nova despesa','O valor só sai da conta quando um pagamento for registrado.',
    field('Descrição','description','text',existing?.description || '', 'maxlength="120"') + field('Categoria','category','text',existing?.category || '', 'maxlength="60"') + select('Conta prevista','accountId',data.accounts.map(x => [String(x.id),escapeHtml(x.name)]),String(existing?.account_id || data.accounts[0].id)) + field('Valor original (R$)','amount','number',existing ? decimal(existing.amount_cents) : '', 'min="0.01" step="0.01"') + field('Vencimento','dueDate','date',existing?.due_date || data.today) + field('Juros após vencimento (%)','interestRate','number',existing ? decimal(existing.interest_rate_basis_points) : '0.00','min="0" max="100" step="0.01"') + select('Periodicidade dos juros','interestPeriod',[['monthly','Ao mês'],['daily','Ao dia']],existing?.interest_period || 'monthly'),
    v => send(existing ? `/api/bills/${existing.id}` : '/api/bills',existing ? 'PATCH' : 'POST',{accountId:Number(v.accountId),description:v.description,category:v.category,amountCents:cents(v.amount),dueDate:v.dueDate,interestRateBasisPoints:rate(v.interestRate),interestPeriod:v.interestPeriod}));
}
function payBillForm(bill) {
  if (bill.current_cents == null) return toast('Não foi possível calcular este saldo. Revise a taxa de juros.',true);
  modal('Registrar pagamento',`${escapeHtml(bill.description)} · saldo de ${brl(bill.current_cents)}. Pagamentos parciais são aceitos.`,
    select('Pagar pela conta','accountId',data.accounts.map(x => [String(x.id),escapeHtml(x.name)]),String(bill.account_id)) + field('Valor pago (R$)','amount','number',decimal(bill.current_cents),`min="0.01" max="${decimal(bill.current_cents)}" step="0.01"`) + field('Data do pagamento','date','date',data.today,`max="${data.today}"`),
    v => send(`/api/bills/${bill.id}/payments`,'POST',{accountId:Number(v.accountId),amountCents:cents(v.amount),date:v.date}),'Confirmar pagamento');
}
function interestBillForm(bill) {
  modal('Juros da despesa',`A nova taxa será aplicada desde o vencimento de ${escapeHtml(bill.description)}.`,
    field('Taxa (%)','interestRate','number',decimal(bill.interest_rate_basis_points),'min="0" max="100" step="0.01"') + select('Periodicidade','interestPeriod',[['monthly','Ao mês'],['daily','Ao dia']],bill.interest_period),
    v => send(`/api/bills/${bill.id}/interest`,'PATCH',{interestRateBasisPoints:rate(v.interestRate),interestPeriod:v.interestPeriod}),'Atualizar juros');
}
function transactionForm() {
  if (!data.accounts.length) return toast('Cadastre uma conta primeiro.', true);
  modal('Lançamento imediato','Para despesas futuras, use a página Despesas.',
    select('Tipo','kind',[['expense','Despesa'],['income','Entrada']]) + select('Conta','accountId',data.accounts.map(x => [String(x.id),escapeHtml(x.name)])) + field('Descrição','description','text','','maxlength="120"') + field('Categoria','category','text','','maxlength="60"') + field('Valor (R$)','amount','number','','min="0.01" step="0.01"') + field('Data','date','date',data.today),
    v => send('/api/transactions','POST',{kind:v.kind,accountId:Number(v.accountId),description:v.description,category:v.category,amountCents:cents(v.amount),date:v.date}));
}
function investmentForm() {
  modal('Novo investimento','Configure a taxa para ver o crescimento estimado.',
    field('Nome do caixa','name','text','','maxlength="120"') + field('Tipo','type','text','','maxlength="60" list="investment-types"') + '<datalist id="investment-types"><option value="CDB"><option value="Tesouro Direto"><option value="Fundo"><option value="Ações"><option value="Outro"></datalist>' + field('Valor inicial (R$)','principal','number','','min="0.01" step="0.01"') + field('Taxa (%)','rate','number','','min="-99.99" max="1000" step="0.01"') + select('Periodicidade','period',[['monthly','Ao mês'],['yearly','Ao ano'],['daily','Ao dia']]) + field('Data inicial','startDate','date',data.today),
    v => send('/api/investments','POST',{name:v.name,type:v.type,principalCents:cents(v.principal),rateBasisPoints:rate(v.rate),period:v.period,startDate:v.startDate}));
}
function userForm() {
  modal('Nova pessoa','Crie um acesso individual para alguém do grupo.',
    field('Nome','name','text','','maxlength="80"') + field('Email','email','email','','autocomplete="email"') + field('Senha temporária','password','password','','minlength="12" maxlength="200" autocomplete="new-password"'),
    v => send('/api/users','POST',v),'Criar acesso');
}
function passwordForm() {
  modal('Trocar senha','Use uma nova senha com pelo menos 12 caracteres.',
    field('Senha atual','currentPassword','password','','autocomplete="current-password"') + field('Nova senha','newPassword','password','','minlength="12" maxlength="200" autocomplete="new-password"'),
    v => send('/api/profile/password','POST',v),'Atualizar senha');
}
function resetUserForm(id) {
  const member = data.users.find(x => x.id === id);
  modal('Definir nova senha',`A senha anterior de ${escapeHtml(member.name)} deixará de funcionar.`,
    field('Nova senha','password','password','','minlength="12" maxlength="200" autocomplete="new-password"'),
    v => send(`/api/users/${id}/password`,'POST',v),'Atualizar senha');
}
async function action(name,id,paymentId) {
  if (name === 'new-account') return accountForm();
  if (name === 'edit-account') return accountForm(data.accounts.find(x => x.id === id));
  if (name === 'new-bill') return billForm();
  if (name === 'edit-bill') return billForm(data.bills.find(x => x.id === id));
  if (name === 'pay-bill') return payBillForm(data.bills.find(x => x.id === id));
  if (name === 'interest-bill') return interestBillForm(data.bills.find(x => x.id === id));
  if (name === 'new-transaction') return transactionForm();
  if (name === 'new-investment') return investmentForm();
  if (name === 'new-user') return userForm();
  if (name === 'change-password') return passwordForm();
  if (name === 'reset-user') return resetUserForm(id);
  if (name.startsWith('delete-') && !confirm('Excluir este registro? Esta ação não pode ser desfeita.')) return;
  try {
    if (name === 'delete-account') await send(`/api/accounts/${id}`,'DELETE');
    if (name === 'delete-bill') await send(`/api/bills/${id}`,'DELETE');
    if (name === 'delete-payment') await send(`/api/bills/${id}/payments/${paymentId}`,'DELETE');
    if (name === 'delete-transaction') await send(`/api/transactions/${id}`,'DELETE');
    if (name === 'delete-investment') await send(`/api/investments/${id}`,'DELETE');
    if (name === 'toggle-user') { const member = data.users.find(x => x.id === id); await send(`/api/users/${id}`,'PATCH',{active:!member.active}); }
    await refresh(); toast('Alteração concluída.');
  } catch (error) { toast(error.message,true); }
}
document.addEventListener('click', event => {
  const target = event.target.closest('[data-view],[data-action],[data-bill-filter],[data-chart-range]'); if (!target) return;
  if (target.dataset.view) setView(target.dataset.view);
  if (target.dataset.billFilter) { billFilter = target.dataset.billFilter; render(); }
  if (target.dataset.chartRange) { chartRange = Number(target.dataset.chartRange); render(); }
  if (target.dataset.action) action(target.dataset.action,Number(target.dataset.id),Number(target.dataset.paymentId));
});
function showPoint(target) {
  const plot = target.closest('.chart-plot');
  const tooltip = plot?.querySelector('.chart-tooltip');
  if (tooltip) tooltip.textContent = `${day(target.dataset.pointDate)} · ${brl(Number(target.dataset.pointValue))}`;
}
document.addEventListener('pointerover', event => { const point = event.target.closest('[data-point-date]'); if (point) showPoint(point); });
document.addEventListener('pointerdown', event => { const point = event.target.closest('[data-point-date]'); if (point) showPoint(point); });
document.addEventListener('focusin', event => { const point = event.target.closest?.('[data-point-date]'); if (point) showPoint(point); });
$('#logout').addEventListener('click',async () => { try { await send('/api/logout','POST'); data = null; view='overview'; showAuth(false); } catch (error) { toast(error.message,true); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden && data) refresh(); });
setInterval(() => { if (!document.hidden && data) refresh(); }, 60_000);
start();
