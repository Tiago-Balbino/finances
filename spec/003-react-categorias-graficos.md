# SDD 003 — React e análise por categoria

## Objetivo

Migrar a interface para React, melhorar a nomenclatura dos formulários, oferecer catálogo de categorias e subcategorias e tornar os gráficos interativos.

## Regras

1. Cada formulário usa nomes claros como “Nome da despesa”, “Categoria”, “Subcategoria” e “Observações”.
2. O painel mostra a categoria com maior gasto realizado no mês, ranking das demais e detalhamento por subcategoria ao selecionar uma barra. O valor vem de toda a base do mês na API, sem limite dos últimos 500 lançamentos.
3. Projeções de investimento e dívida têm pontos selecionáveis por mouse, toque e teclado, com data e valor. O controle alterna 6 e 12 meses.
4. Transições de páginas, cartões e gráficos respeitam a preferência de movimento reduzido do sistema.
5. A interface conserva o tema escuro marrom, navegação para contas, despesas, lançamentos, categorias, investimentos, pessoas e perfil.

## Critérios de aceitação

- Criar categoria e subcategoria permite selecioná-las ao cadastrar despesa ou lançamento.
- O gráfico do mês destaca a categoria que consumiu mais e mostra subcategorias ao clique.
- Observações aparecem nos cartões e tabelas sem exigir preenchimento.
- `npm run build` gera o frontend React sem erros.
