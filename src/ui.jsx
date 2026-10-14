import React from 'react';
import { brl, day, methodLabel } from './lib.js';

export function Header({ title, subtitle, action, onAction, secondary, onSecondary }) {
  return <div className="page-head"><div><div className="eyebrow"><span className="eyebrow-line" /> FINANÇAS COMPARTILHADAS</div><h1>{title}</h1><p>{subtitle}</p></div>{(action || secondary) && <div className="page-actions">{secondary && <button className="button secondary" onClick={onSecondary}>{secondary}</button>}{action && <button className="button" onClick={onAction}><span className="plus">＋</span>{action}</button>}</div>}</div>;
}

export function Empty({ children }) { return <div className="empty"><span className="empty-icon">◌</span>{children}</div>; }

export function Stat({ label, value, detail, tone = '', children }) {
  return <div className={`stat dashboard-stat ${tone}`}><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-foot">{detail}</span>{children}</div>;
}

export function Progress({ value, total, label }) {
  const share = total > 0 ? Math.min(100, value / total * 100) : 0;
  return <div className="limit-bar" role="img" aria-label={label || `${Math.round(share)}%`}><span style={{ width: `${share}%` }} /></div>;
}

export function RangeButtons({ value, onChange }) { return <div className="segmented"><button className={value === 6 ? 'selected' : ''} onClick={() => onChange(6)}>6 meses</button><button className={value === 12 ? 'selected' : ''} onClick={() => onChange(12)}>12 meses</button></div>; }

export function TransactionTable({ items, onEdit, onDelete, compact = false }) {
  if (!items.length) return <Empty>Nenhum lançamento por aqui ainda.</Empty>;
  return <div className="table-wrap"><table><thead><tr><th>Lançamento</th><th>Categoria</th><th>Conta</th><th>Data</th><th>Valor</th>{!compact && <th />}</tr></thead><tbody>{items.map(item => <tr key={item.id}>
    <td><strong>{item.description}</strong>{item.note && <span className="row-note">{item.note}</span>}</td>
    <td><span className="pill">{item.category}</span>{item.subcategory_name && <span className="sub-label">{item.subcategory_name}</span>}</td>
    <td className="muted">{item.account_name}{methodLabel(item) && <span className="sub-label method-label">{methodLabel(item)}</span>}</td><td className="muted">{day(item.date)}</td>
    <td className={item.kind === 'income' ? 'amount-plus' : 'amount-minus'}>{item.kind === 'income' ? '+' : '−'} {brl(item.amount_cents)}</td>
    {!compact && <td>{item.bill_id ? <span className="muted">Pagamento</span> : item.planned_income_id ? <span className="muted">Recebimento</span> : item.automatic_yield ? <span className="muted">Rendimento automático</span> : item.movement_type === 'transfer' ? <div className="table-actions"><button className="button tiny ghost" onClick={() => onDelete(item.id, 'Excluir este aporte ou resgate do limite garantido?')}>Excluir</button></div> : <div className="table-actions"><button className="button tiny ghost" onClick={() => onEdit(item)}>Editar</button><button className="button tiny ghost" onClick={() => onDelete(item.id, item.card_purchase_id ? 'Excluir esta compra e todas as parcelas?' : undefined)}>{item.card_purchase_id ? 'Excluir compra' : 'Excluir'}</button></div>}</td>}
  </tr>)}</tbody></table></div>;
}
