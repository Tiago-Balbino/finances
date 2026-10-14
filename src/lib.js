export const brl = cents => cents == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const day = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—';
export const month = value => new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)).replace('.', '');
export const cents = value => Math.round(Number(String(value).replace(',', '.')) * 100);
export const decimal = value => ((value || 0) / 100).toFixed(2);
export const rate = value => Math.round(Number(String(value).replace(',', '.')) * 100);
export const periodName = { daily: 'ao dia', monthly: 'ao mês', yearly: 'ao ano' };
export const statusName = { pending: 'Pendente', overdue: 'Vencida', paid: 'Paga' };
export const methodName = { pix: 'Pix', debit: 'Débito', credit: 'Crédito' };
export const monthName = value => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 7)}-01T12:00:00Z`));
export function methodLabel(item) {
  if (item.movement_type === 'transfer') return 'Transferência';
  if (item.card_purchase_id) return `Crédito · ${item.card_name}${item.installments > 1 ? ` · ${item.installments}x` : ''}`;
  return methodName[item.payment_method] || '';
}
export const spendableAccounts = data => data.accounts.filter(item => !item.collateral_card_id);

export async function api(path, method = 'GET', body) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || result.detail || 'Não foi possível concluir.');
  return result;
}
