import React, { useState } from 'react';
import { brl, decimal, spendableAccounts } from './lib.js';

function Field({ label, name, value = '', type = 'text', required = true, wide = false, ...props }) {
  return <div className={wide ? 'wide' : ''}><label htmlFor={`f-${name}`}>{label}</label>{type === 'textarea'
    ? <textarea id={`f-${name}`} name={name} defaultValue={value || ''} required={required} maxLength={2000} rows={3} placeholder="Adicione detalhes que ajudem a identificar este registro" />
    : <input id={`f-${name}`} name={name} type={type} defaultValue={value ?? ''} required={required} {...props} />}</div>;
}

function Select({ label, name, options, value, onChange, wide = false, required = true }) {
  return <div className={wide ? 'wide' : ''}><label htmlFor={`f-${name}`}>{label}</label><select id={`f-${name}`} name={name} {...(onChange ? { value, onChange } : { defaultValue: value })} required={required}>{!required && <option value="">Nenhuma</option>}{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></div>;
}

function CategoryFields({ data, kind, initialCategory, initialSubcategory }) {
  const options = data.categories.filter(item => item.kind === kind);
  const [category, setCategory] = useState(String(initialCategory || options[0]?.id || ''));
  const [subcategory, setSubcategory] = useState(String(initialSubcategory || ''));
  const validCategory = options.some(item => String(item.id) === category) ? category : String(options[0]?.id || '');
  const subOptions = data.subcategories.filter(item => String(item.category_id) === validCategory);
  return <>
    <Select label="Categoria" name="categoryId" options={options.map(item => [item.id, item.name])} value={validCategory} onChange={event => { setCategory(event.target.value); setSubcategory(''); }} />
    <Select label="Subcategoria" name="subcategoryId" options={subOptions.map(item => [item.id, item.name])} value={subOptions.some(item => String(item.id) === subcategory) ? subcategory : ''} onChange={event => setSubcategory(event.target.value)} required={false} />
    <p className="form-hint wide">Organize categorias e subcategorias na aba Categorias.</p>
  </>;
}

const periodDays = { daily: 1, monthly: 30, yearly: 360 };
const appliedName = { daily: 'por dia', monthly: 'por mês', yearly: 'por ano' };

function PenaltyFields({ record }) {
  const [rateValue, setRateValue] = useState(decimal(record.interest_rate_basis_points));
  const [ratePeriod, setRatePeriod] = useState(record.interest_rate_period || record.interest_period || 'monthly');
  const [applyPeriod, setApplyPeriod] = useState(record.interest_period || 'monthly');
  const applied = (Number(String(rateValue).replace(',', '.')) || 0) * periodDays[applyPeriod] / periodDays[ratePeriod];
  return <>
    <div><label htmlFor="f-interestRate">Juros após vencimento (%)</label><input id="f-interestRate" name="interestRate" type="number" value={rateValue} onChange={event => setRateValue(event.target.value)} min="0" max={ratePeriod === 'daily' ? '10' : '100'} step="0.01" required /></div>
    <Select label="A taxa informada é" name="interestRatePeriod" value={ratePeriod} onChange={event => setRatePeriod(event.target.value)} options={[['daily', 'Ao dia'], ['monthly', 'Ao mês'], ['yearly', 'Ao ano']]} />
    <Select label="Aplicar os juros" name="interestPeriod" value={applyPeriod} onChange={event => setApplyPeriod(event.target.value)} options={[['daily', 'Todo dia'], ['monthly', 'Todo mês'], ['yearly', 'Todo ano']]} />
    <p className="form-hint wide">{applied > 0 ? `Equivale a ${applied.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}% ${appliedName[applyPeriod]}, somado a cada período completo de atraso (mês = 30 dias, ano = 360).` : 'Sem juros após o vencimento.'}</p>
    <Field label="Multa por atraso (%, opcional)" name="fine" type="number" value={record.fine_basis_points ? decimal(record.fine_basis_points) : ''} required={false} min="0" max="100" step="0.01" />
    <Select label="Cobrar a multa após" name="fineAfter" value={record.fine_after || 'day'} options={[['day', '1 dia de atraso'], ['month', '1 mês de atraso'], ['year', '1 ano de atraso']]} />
    <p className="form-hint wide">A multa é cobrada uma única vez sobre o saldo em aberto. Os juros continuam a cada período, inclusive nas projeções.</p>
  </>;
}

function PaymentFields({ data, accountLabel, initialAccount, initialMethod, initialCard, allowCredit = true, planned = false }) {
  const accounts = spendableAccounts(data);
  const [accountId, setAccountId] = useState(String(initialAccount || accounts[0]?.id || ''));
  const [method, setMethod] = useState(initialMethod || 'pix');
  const cards = (data.credit_cards || []).filter(card => String(card.payment_account_id) === accountId);
  const creditAvailable = allowCredit && (planned || cards.length > 0);
  const current = method === 'credit' && !creditAvailable ? 'pix' : method;
  return <>
    <Select label={accountLabel} name="accountId" value={accountId} onChange={event => setAccountId(event.target.value)} options={accounts.map(item => [item.id, item.name])} />
    <Select label={planned ? 'Forma de pagamento prevista' : 'Forma de pagamento'} name="paymentMethod" value={current} onChange={event => setMethod(event.target.value)} options={[['pix', 'Pix'], ['debit', 'Débito'], ...(creditAvailable ? [['credit', 'Crédito']] : [])]} />
    {!planned && current === 'credit' && <>
      <Select key={accountId} label="Cartão" name="creditCardId" value={String((cards.find(card => card.id === initialCard) || cards[0])?.id || '')} options={cards.map(card => [card.id, `${card.name} · disponível ${brl(card.available_cents)}`])} />
      <Select label="Parcelas" name="installments" value="1" options={Array.from({ length: 24 }, (_, index) => [index + 1, index ? `${index + 1}x` : 'À vista'])} />
      <p className="form-hint wide">A compra consome o limite do cartão e entra nas próximas faturas. O saldo da conta só muda quando a fatura for paga.</p>
    </>}
    {allowCredit && !planned && !cards.length && <p className="form-hint wide">Para pagar no crédito, cadastre um cartão nesta conta na aba Cartões.</p>}
  </>;
}

export default function Modal({ modal, data, onClose, onSave }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const record = modal.record || {};
  const type = modal.type;
  const [kind, setKind] = useState(record.kind || 'expense');
  const [expenseType, setExpenseType] = useState(record.expense_type || 'eventual');
  const [incomeType, setIncomeType] = useState(record.income_type || 'eventual');
  const [yieldRateId, setYieldRateId] = useState(String(record.yield_rate_id || ''));
  const [rateSource, setRateSource] = useState(record.source_code || 'manual');
  const title = ({ account: record.id ? 'Editar conta' : 'Nova conta', bill: record.id ? 'Editar despesa' : 'Nova despesa',
    income: record.id ? 'Editar entrada' : 'Nova entrada', receipt: 'Registrar recebimento',
    transaction: record.id ? 'Editar lançamento' : 'Novo lançamento', investment: 'Novo investimento',
    payment: 'Registrar pagamento', interest: 'Juros e multa', category: record.id ? 'Renomear categoria' : 'Nova categoria',
    subcategory: record.id ? 'Renomear subcategoria' : 'Nova subcategoria', password: 'Trocar senha',
    user: 'Nova pessoa', resetUser: 'Definir nova senha', billNote: 'Editar observações', classification: 'Classificar despesa',
    yieldRate: record.id ? 'Editar taxa de referência' : 'Nova taxa de referência',
    card: record.id ? 'Editar cartão' : 'Novo cartão de crédito',
    collateral: modal.direction === 'withdraw' ? 'Resgatar limite garantido' : 'Aportar no limite garantido' })[type];
  const accounts = spendableAccounts(data).map(item => [item.id, item.name]);
  const [cardRateId, setCardRateId] = useState(String(record.yield_rate_id || ''));
  const selectedAccount = String(record.account_id || accounts[0]?.[0] || '');
  const noteField = <Field label="Observações (opcional)" name="note" type="textarea" value={record.note} required={false} wide />;
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await onSave(modal, Object.fromEntries(new FormData(event.currentTarget))); onClose(); }
    catch (caught) { setError(caught.message); setBusy(false); }
  }
  return <div className="modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar">×</button>
      <div className="eyebrow">FINANCES · CADASTRO</div><h2 id="modal-title">{title}</h2>
      <form onSubmit={submit}><div className="form-grid">
        {type === 'account' && <>
          <Field label="Nome da conta" name="name" value={record.name} maxLength={120} />
          <Select label="Tipo de conta" name="type" value={record.type || 'Conta corrente'} options={['Conta corrente', 'Poupança', 'Carteira', 'Outro'].map(item => [item, item])} />
          <Field label="Saldo inicial (R$)" name="opening" type="number" value={decimal(record.opening_cents)} min="0" step="0.01" />{noteField}
          <Select label="Taxa de rendimento" name="yieldRateId" value={yieldRateId} onChange={event => setYieldRateId(event.target.value)} options={data.yield_rates.map(item => [item.id, `${item.name} · ${decimal(item.annual_basis_points)}% a.a.`])} required={false} />
          {yieldRateId && <><Field label="Percentual da taxa (%)" name="yieldMultiplier" type="number" value={record.yield_rate_id ? decimal(record.yield_multiplier_basis_points) : '100.00'} min="0" max="1000" step="0.01" />
            <p className="form-hint wide">Exemplo: 105% de uma taxa de referência de 10% ao ano equivale a 10,5% ao ano. O rendimento usa o saldo da conta às 8h e é creditado a partir desse horário em dias úteis.</p></>}
        </>}
        {type === 'bill' && <>
          <Field label="Nome da despesa" name="description" value={record.description} maxLength={120} wide />
          {record.recurrence_origin_id
            ? <><input type="hidden" name="expenseType" value="fixed" /><p className="form-hint wide">Despesa fixa deste mês. Edite o valor e o vencimento desta parcela aqui.</p></>
            : <><Select label="Tipo de despesa" name="expenseType" value={expenseType} onChange={event => setExpenseType(event.target.value)} options={[["eventual", "Eventual"], ["fixed", "Fixa"]]} />
              <p className="form-hint wide">{expenseType === 'fixed' ? 'A despesa fixa se repete todo mês no mesmo dia do vencimento. Cada mês pode ser pago separadamente.' : 'A despesa eventual acontece somente uma vez, como gasolina ou um lanche.'}</p></>}
          <PaymentFields data={data} accountLabel="Conta prevista" initialAccount={record.account_id} initialMethod={record.payment_method} planned />
          <Field label="Valor original (R$)" name="amount" type="number" value={record.id ? decimal(record.amount_cents) : ''} min="0.01" step="0.01" />
          <CategoryFields data={data} kind="expense" initialCategory={record.category_id} initialSubcategory={record.subcategory_id} />
          <Field label="Vencimento" name="dueDate" type="date" value={record.due_date || data.today} />
          <PenaltyFields record={record} />
          {noteField}
        </>}
        {type === 'income' && <>
          <Field label="Nome da entrada" name="description" value={record.description} maxLength={120} wide />
          {record.recurrence_origin_id
            ? <><input type="hidden" name="incomeType" value="fixed" /><p className="form-hint wide">Entrada fixa deste mês. Edite esta parcela separadamente.</p></>
            : <><Select label="Tipo de entrada" name="incomeType" value={incomeType} onChange={event => setIncomeType(event.target.value)} options={[["eventual", "Eventual"], ["fixed", "Fixa"]]} />
              <p className="form-hint wide">{incomeType === 'fixed' ? 'Repete todo mês no mesmo dia. Cada salário pode ser recebido separadamente.' : 'Acontece uma única vez.'}</p></>}
          <Select label="Conta prevista" name="accountId" value={selectedAccount} options={accounts} />
          <Field label="Valor previsto (R$)" name="amount" type="number" value={record.id ? decimal(record.amount_cents) : ''} min="0.01" step="0.01" />
          <CategoryFields data={data} kind="income" initialCategory={record.category_id} initialSubcategory={record.subcategory_id} />
          <Field label="Data prevista" name="dueDate" type="date" value={record.due_date || data.today} />{noteField}
        </>}
        {type === 'receipt' && <>
          <p className="form-hint wide">Ainda falta receber <b>{brl(record.remaining_cents)}</b>. Recebimentos parciais são aceitos.</p>
          <Select label="Receber na conta" name="accountId" value={selectedAccount} options={accounts} />
          <Field label="Valor recebido (R$)" name="amount" type="number" value={decimal(record.remaining_cents)} min="0.01" max={decimal(record.remaining_cents)} step="0.01" />
          <Field label="Data do recebimento" name="date" type="date" value={data.today} max={data.today} />{noteField}
        </>}
        {type === 'transaction' && <>
          {record.card_purchase_id
            ? <><input type="hidden" name="kind" value="expense" /><p className="form-hint wide">Compra no cartão {record.card_name}. Aqui você altera nome, categoria e observações de todas as parcelas. Para mudar valor, data ou parcelas, exclua e lance novamente.</p>
              <Field label="Nome da compra" name="description" value={modal.purchaseDescription || record.description} maxLength={120} wide />
              <CategoryFields data={data} kind="expense" initialCategory={record.category_id} initialSubcategory={record.subcategory_id} /></>
            : <><Select label="Tipo de lançamento" name="kind" value={kind} onChange={event => setKind(event.target.value)} options={[["expense", "Despesa paga"], ["income", "Entrada"]]} />
              {kind === 'expense'
                ? <PaymentFields key="payment-expense" data={data} accountLabel="Conta" initialAccount={record.account_id} initialMethod={record.payment_method} initialCard={record.credit_card_id} allowCredit={!record.id} />
                : <Select label="Conta" name="accountId" value={selectedAccount} options={accounts} />}
              <Field label="Nome do lançamento" name="description" value={record.description} maxLength={120} wide />
              <CategoryFields key={kind} data={data} kind={kind} initialCategory={record.kind === kind ? record.category_id : null} initialSubcategory={record.kind === kind ? record.subcategory_id : null} />
              <Field label="Valor (R$)" name="amount" type="number" value={record.id ? decimal(record.amount_cents) : ''} min="0.01" step="0.01" />
              <Field label="Data" name="date" type="date" value={record.date || data.today} max={data.today} /></>}
          {noteField}
        </>}
        {type === 'investment' && <>
          <Field label="Nome do investimento" name="name" maxLength={120} />
          <Field label="Tipo" name="type" maxLength={60} placeholder="CDB, Tesouro, Fundo..." />
          <Field label="Valor inicial (R$)" name="principal" type="number" min="0.01" step="0.01" />
          <Field label="Taxa (%)" name="rate" type="number" min="-99.99" max="1000" step="0.01" />
          <Select label="Periodicidade" name="period" value="monthly" options={[["monthly", "Ao mês"], ["yearly", "Ao ano"], ["daily", "Ao dia"]]} />
          <Field label="Data inicial" name="startDate" type="date" value={data.today} />{noteField}
        </>}
        {type === 'yieldRate' && <><Field label="Nome da taxa" name="name" value={record.name} maxLength={80} placeholder="Ex.: CDI" />
          <Select label="Origem do valor" name="sourceCode" value={rateSource} onChange={event => setRateSource(event.target.value)} options={[["manual", "Manual"], ["cdi", "CDI · Banco Central"], ["selic_target", "Selic Meta · Banco Central"]]} />
          {rateSource === 'manual' && <Field label="Valor da taxa (% ao ano)" name="annualRate" type="number" value={record.id ? decimal(record.annual_basis_points) : ''} min="0" max="100" step="0.01" />}
          <p className="form-hint wide">{rateSource === 'manual' ? 'Você define o valor anual. Cada conta escolhe esta taxa e um percentual dela.' : 'O valor anual será consultado no Banco Central. A conta pode render, por exemplo, 105% desta taxa.'}</p></>}
        {type === 'payment' && <>
          <p className="form-hint wide">Saldo atualizado de <b>{brl(record.current_cents)}</b>. Pagamentos parciais são aceitos.</p>
          <PaymentFields data={data} accountLabel="Pagar pela conta" initialAccount={record.account_id} initialMethod={record.credit_card_id ? 'pix' : record.payment_method} allowCredit={!record.credit_card_id} />
          <Field label="Valor pago (R$)" name="amount" type="number" value={decimal(record.current_cents)} min="0.01" max={decimal(record.current_cents)} step="0.01" />
          <Field label="Data do pagamento" name="date" type="date" value={data.today} max={data.today} />{noteField}
        </>}
        {type === 'interest' && <>
          <p className="form-hint wide">A nova taxa será aplicada desde o vencimento desta despesa.</p>
          <PenaltyFields record={record} />
        </>}
        {type === 'category' && <>{!record.id && <Select label="Tipo" name="kind" value={modal.kind || 'expense'} options={[["expense", "Despesa"], ["income", "Entrada"]]} />}
          <Field label="Nome da categoria" name="name" value={record.name} maxLength={60} wide /></>}
        {type === 'subcategory' && <>{!record.id && <Select label="Categoria principal" name="categoryId" value={String(modal.categoryId || data.categories[0]?.id || '')} options={data.categories.map(item => [item.id, `${item.kind === 'expense' ? 'Despesa' : 'Entrada'} · ${item.name}`])} wide />}
          <Field label="Nome da subcategoria" name="name" value={record.name} maxLength={60} wide /></>}
        {type === 'password' && <><Field label="Senha atual" name="currentPassword" type="password" autoComplete="current-password" /><Field label="Nova senha" name="newPassword" type="password" minLength={12} maxLength={200} autoComplete="new-password" /></>}
        {type === 'user' && <><Field label="Nome da pessoa" name="name" maxLength={80} /><Field label="Email" name="email" type="email" maxLength={254} /><Field label="Senha temporária" name="password" type="password" minLength={12} maxLength={200} /></>}
        {type === 'resetUser' && <Field label="Nova senha" name="password" type="password" minLength={12} maxLength={200} wide />}
        {type === 'card' && <>
          <Field label="Nome do cartão" name="name" value={record.name} maxLength={80} placeholder="Ex.: Nubank" />
          <Select label="Conta do cartão" name="paymentAccountId" value={String(record.payment_account_id || modal.accountId || accounts[0]?.[0] || '')} options={accounts} />
          <Field label="Limite base (R$)" name="baseLimit" type="number" value={decimal(record.base_limit_cents)} min="0" step="0.01" />
          <Field label="Juros da fatura em atraso (% ao mês)" name="lateInterest" type="number" value={decimal(record.late_interest_basis_points)} min="0" max="100" step="0.01" />
          <Field label="Dia de fechamento" name="closingDay" type="number" value={record.closing_day || ''} min="1" max="31" step="1" />
          <Field label="Dia de vencimento" name="dueDay" type="number" value={record.due_day || ''} min="1" max="31" step="1" />
          <p className="form-hint wide">Compras feitas a partir do dia de fechamento entram na fatura seguinte. Cada fatura vira uma despesa a pagar pela conta do cartão.</p>
          <Select label="Rendimento do limite garantido" name="yieldRateId" value={cardRateId} onChange={event => setCardRateId(event.target.value)} options={data.yield_rates.map(item => [item.id, `${item.name} · ${decimal(item.annual_basis_points)}% a.a.`])} required={false} />
          {cardRateId && <Field label="Percentual da taxa (%)" name="yieldMultiplier" type="number" value={record.yield_rate_id ? decimal(record.yield_multiplier_basis_points) : '100.00'} min="0" max="1000" step="0.01" />}
          <p className="form-hint wide">O limite garantido é o dinheiro que você aporta no cartão. Ele rende pela taxa escolhida e o saldo com rendimentos soma ao limite base.</p>
          {noteField}
        </>}
        {type === 'collateral' && <>
          <input type="hidden" name="direction" value={modal.direction} />
          <p className="form-hint wide">Limite garantido atual: <b>{brl(record.collateral_cents)}</b> · disponível no cartão: <b>{brl(record.available_cents)}</b>.{modal.direction === 'withdraw' ? ' O resgate não pode deixar o limite abaixo do valor já usado.' : ' O valor sai da conta e passa a render como limite do cartão.'}</p>
          <Select label={modal.direction === 'withdraw' ? 'Devolver para a conta' : 'Retirar da conta'} name="accountId" value={String(record.payment_account_id || accounts[0]?.[0] || '')} options={accounts} />
          <Field label="Valor (R$)" name="amount" type="number" min="0.01" step="0.01" max={modal.direction === 'withdraw' ? decimal(Math.max(0, Math.min(record.collateral_cents, record.available_cents))) : undefined} />
          <Field label="Data" name="date" type="date" value={data.today} max={data.today} />{noteField}
        </>}
        {type === 'billNote' && noteField}
        {type === 'classification' && <CategoryFields data={data} kind="expense" initialCategory={record.category_id} initialSubcategory={record.subcategory_id} />}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button" disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</button></div>
      </form>
    </div>
  </div>;
}
