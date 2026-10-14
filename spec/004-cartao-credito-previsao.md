# SDD 004 — Cartões, forma de pagamento, previsão e multa

## Regras
1. Despesas e lançamentos de saída têm forma de pagamento: Pix, Débito ou Crédito. Em Crédito, escolhe-se a conta, um cartão dessa conta e as parcelas.
2. A aba Cartões mostra disponível, usado, limite total, limite base, limite garantido com rendimento, próxima fatura, faturas em aberto e compras recentes, com ações de compra, aporte, resgate, edição e exclusão.
3. Faturas aparecem em Despesas como "Fatura do cartão", pagas por Pix ou Débito, sem editar/excluir/classificar.
4. Despesas aceitam juros com período da taxa e frequência de aplicação, mostrando a taxa equivalente, e multa opcional cobrada uma vez após 1 dia, 1 mês ou 1 ano de atraso.
5. A Visão geral navega até 12 meses à frente. Em meses futuros mostra saldo projetado, entradas previstas, acumulado a pagar (deste mês e anteriores), sobra/falta, a lista do que estará em aberto e a tendência dos próximos meses, sempre supondo que nada em aberto é pago.

## Critérios de aceitação
- Compra parcelada no crédito reduz o disponível do cartão, cria as faturas e não altera o saldo da conta.
- Pagar a fatura reduz o saldo da conta sem duplicar o gasto no painel.
- Despesa não paga reaparece como "Anterior" nos meses seguintes da previsão, com juros e multa.
- `npm run build` gera o frontend sem erros.
