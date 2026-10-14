# SDD 005 — Cada página conta uma parte da história

| Página | Responde |
|---|---|
| Visão geral | Quanto devo (tudo em aberto), quanto está vencido, quanto preciso para as fixas do mês, quanto vai entrar, onde gastei e como está a fatura de cada cartão. Depois, o movimento do mês. |
| Lançamentos | Gasto hoje, saídas e entradas avulsas do mês, divisão por Pix/Débito/Crédito e por categoria. Botões "Nova saída" e "Nova entrada". |
| Despesas | Falta pagar (a vencer + atrasado), atrasado, já pago no mês, fixas (custo de vida e % da renda fixa) e eventuais (+ faturas). Lista e cartões do mês com as atrasadas. |
| Entradas | Recebido no mês, rendimentos, o que ainda vai entrar, entradas fixas previstas e recebimentos por categoria. |
| Investimentos | Total investido, rendimento acumulado, do mês e estimativa do próximo; projeção de 12 meses; aportes e resgates nos caixas. |

## Critérios de aceitação
- Visão geral, Despesas, Entradas e Lançamentos têm seletor de mês (`MonthPicker`) e os números acompanham o mês.
- Todos os cadastros anteriores continuam disponíveis nas mesmas páginas.
- `npm run build` sem erros.
