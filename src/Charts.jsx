import React, { useState } from 'react';
import { brl, day, month } from './lib.js';

export function LineChart({ series = [], title, accent = '#d9a274' }) {
  const [active, setActive] = useState(null);
  if (!series.length || series.every(point => !point.value_cents)) return <div className="chart-empty"><span>◌</span>Cadastre dados para ver a projeção.</div>;
  const max = Math.max(...series.map(point => point.value_cents || 0), 1) * 1.12;
  const x = index => 28 + index * 564 / Math.max(1, series.length - 1);
  const y = amount => 192 - (amount || 0) / max * 158;
  const points = series.map((point, index) => `${x(index)},${y(point.value_cents)}`).join(' ');
  const selected = series[active ?? 0] || series[0];
  return <div className="chart-plot interactive-chart">
    <svg viewBox="0 0 620 220" role="img" aria-label={title}>
      <defs><linearGradient id={`fade-${title.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={accent} stopOpacity=".28" /><stop offset="100%" stopColor={accent} stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3].map(index => <line key={index} x1="28" y1={34 + index * 52} x2="592" y2={34 + index * 52} className="chart-grid" />)}
      <polygon points={`28,192 ${points} 592,192`} fill={`url(#fade-${title.replace(/\W/g, '')})`} className="chart-area-animate" />
      <polyline points={points} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="chart-line-animate" />
      {series.map((point, index) => <circle key={point.date} className={`chart-point ${active === index ? 'is-active' : ''}`} cx={x(index)} cy={y(point.value_cents)} r="5" fill={accent} tabIndex="0" onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); setActive(Math.min(series.length - 1, Math.max(0, index + (event.key === 'ArrowRight' ? 1 : -1)))); } }} aria-label={`${day(point.date)}: ${brl(point.value_cents)}`} />)}
      {series.map((point, index) => (index % Math.max(1, Math.floor((series.length - 1) / 4)) === 0 || index === series.length - 1) && <text key={point.date} x={x(index)} y="215" textAnchor="middle" className="chart-axis">{month(point.date)}</text>)}
    </svg>
    <div className="chart-tooltip"><b>{day(selected.date)}</b><span>{brl(selected.value_cents)}</span><small>Selecione os pontos para explorar</small></div>
  </div>;
}

export function DueChart({ series = [] }) {
  const max = Math.max(1, ...series.map(item => item.value_cents || 0));
  return <div className="bar-chart" aria-label="Vencimentos por mês">{series.map(item => <button key={item.date} className="bar-column" title={`${month(item.date)}: ${brl(item.value_cents)}`} type="button"><span className="bar-value">{item.value_cents ? brl(item.value_cents) : '—'}</span><span className="bar-track"><span className="bar-fill" style={{ height: `${Math.max(item.value_cents ? 9 : 2, (item.value_cents || 0) / max * 100)}%` }} /></span><span className="bar-month">{month(item.date)}</span></button>)}</div>;
}

export function SpendingChart({ rows = [], transactions = [] }) {
  const [selected, setSelected] = useState(null);
  const byCategory = new Map();
  for (const row of rows) {
    const key = `${row.category_id ?? 'old'}:${row.category}`;
    if (!byCategory.has(key)) byCategory.set(key, { key, name: row.category, total: 0, items: [] });
    const group = byCategory.get(key);
    group.total += row.amount_cents;
    group.items.push(row);
  }
  const groups = [...byCategory.values()].sort((a, b) => b.total - a.total);
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  const focused = groups.find(group => group.key === selected) || groups[0];
  if (!groups.length) return <div className="chart-empty"><span>◌</span>Os gastos pagos neste mês aparecerão aqui.</div>;
  const matching = transactions.filter(item => item.kind === 'expense' && item.category === focused.name).slice(0, 4);
  return <div className="spending-chart">
    <div className="spending-lead"><div><small>Maior categoria do mês</small><strong>{groups[0].name}</strong></div><b>{brl(groups[0].total)}</b></div>
    <div className="spending-bars">{groups.map((group, index) => <button type="button" key={group.key} className={`spending-row ${focused.key === group.key ? 'selected' : ''}`} onClick={() => setSelected(group.key)} aria-pressed={focused.key === group.key}>
      <span className="spending-row-label"><span className="spending-rank">{String(index + 1).padStart(2, '0')}</span><b>{group.name}</b><em>{Math.round(group.total / total * 100)}%</em></span>
      <span className="spending-track"><span style={{ width: `${group.total / groups[0].total * 100}%` }} /></span>
      <span className="spending-amount">{brl(group.total)}</span>
    </button>)}</div>
    <div className="spending-detail"><div className="spending-detail-head"><b>{focused.name}</b><span>{brl(focused.total)} em pagamentos</span></div>
      <div className="sub-spending">{focused.items.map(item => <div key={`${item.subcategory_id}:${item.subcategory}`}><span>{item.subcategory || 'Sem subcategoria'}</span><b>{brl(item.amount_cents)}</b></div>)}</div>
      {matching.length > 0 && <div className="recent-spending">{matching.map(item => <div key={item.id}><span>{item.description}<small>{day(item.date)}</small></span><b>{brl(item.amount_cents)}</b></div>)}</div>}
    </div>
  </div>;
}
