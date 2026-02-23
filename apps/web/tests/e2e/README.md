# E2E (Playwright)

## Pré-requisitos

- Frontend rodando em `http://127.0.0.1:5173` (ou configure `E2E_BASE_URL`)
- Backend/API disponível para os fluxos autenticados

## Execução

```bash
npm --prefix apps/web run test:e2e
```

## Variáveis úteis

- `E2E_BASE_URL`: URL base do app (default `http://127.0.0.1:5173`)
- `E2E_TOPO_EMAIL`: login E2E do topógrafo
- `E2E_TOPO_PASSWORD`: senha E2E do topógrafo
- `E2E_CLIENTE_TOKEN`: token do magic link para `/acesso/:token`

## Screenshots

As imagens são salvas em:

`output/playwright/e2e/`
