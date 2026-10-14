import React, { useEffect, useState } from 'react';
import { api, monthTitle, moveMonth } from './lib.js';

// Loads a URL and reloads it whenever the shared state refreshes, keeping the last result on screen meanwhile.
export function useApi(url, refreshKey) {
  const [state, setState] = useState({ url: null, value: null, error: '' });
  useEffect(() => {
    let active = true;
    api(url).then(value => { if (active) setState({ url, value, error: '' }); })
      .catch(caught => { if (active) setState({ url, value: null, error: caught.message }); });
    return () => { active = false; };
  }, [url, refreshKey]);
  return state.url === url ? state : { value: null, error: '' };
}

export default function MonthPicker({ id, value, onChange, today, min, max, children }) {
  const thisMonth = today.slice(0, 7);
  const clamp = month => (max && month > max ? max : min && month < min ? min : month);
  return <div className="dashboard-toolbar">
    <div className="period-picker">
      <button type="button" disabled={Boolean(min) && value <= min} onClick={() => onChange(moveMonth(value, -1))} aria-label="Mês anterior">←</button>
      <label htmlFor={id}>{monthTitle(value)}{value > thisMonth && <span className="pill forecast-pill">Previsão</span>}</label>
      <input id={id} aria-label="Selecionar mês" type="month" min={min} max={max} value={value} onChange={event => event.target.value && onChange(clamp(event.target.value))} />
      <button type="button" disabled={Boolean(max) && value >= max} onClick={() => onChange(moveMonth(value, 1))} aria-label="Próximo mês">→</button>
    </div>
    <div className="toolbar-side">{children}{value !== thisMonth && <button type="button" className="button tiny secondary" onClick={() => onChange(thisMonth)}>Mês atual</button>}</div>
  </div>;
}
