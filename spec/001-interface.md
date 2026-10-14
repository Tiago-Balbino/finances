# SDD 001 — Interface financeira

## Objetivo

Oferecer uma interface responsiva, em português, para um grupo acompanhar e editar contas, lançamentos e investimentos compartilhados.

## Contrato

- A interface usa endpoints `/api/*` na mesma origem. Em produção, o servidor web deve enviar esse caminho para `api-finances`.
- No desenvolvimento local, Vite serve o React com `npm run dev` e encaminha `/api/*` para `http://127.0.0.1:3000`.
- Sem sessão, a tela mostra login. Se não há usuários, mostra o cadastro inicial do administrador.
- Usuários ativos podem acessar Visão geral, Contas, Despesas, Lançamentos, Categorias, Investimentos e Perfil para trocar a senha. O administrador também vê Pessoas.

## Critérios de aceitação

- Saldos e valores aparecem em reais, com duas casas decimais.
- Cada formulário apresenta erros retornados pela API e atualiza a lista após salvar.
- Investimentos mostram valor inicial, estimativa atual e projeção para 12 meses, com taxa e periodicidade visíveis.
- A interface funciona em larguras de celular e computador.
