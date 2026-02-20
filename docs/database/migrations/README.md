# Migrações do Desenrola

## 001_carretel_integracao_campos

Adiciona colunas para integração Carretel (NovoProjeto wizard, Profile, Financeiro, status atrasado).

### Como executar

#### Opção A: Supabase CLI (recomendado)

1. **Login** (uma vez):
   ```bash
   npx supabase login
   ```

2. **Vincular** o projeto (uma vez):
   ```bash
   npx supabase link --project-ref SEU_PROJECT_ID
   ```
   O project-id está na URL: `https://supabase.com/dashboard/project/SEU_PROJECT_ID`

3. **Enviar** migrações:
   ```bash
   npx supabase db push
   ```
   Ou use o script:
   ```powershell
   .\scripts\supabase-migrate.ps1 -Action push
   ```

4. **Ver status** das migrações:
   ```bash
   npx supabase migration list
   ```

#### Opção B: Supabase SQL Editor

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard) → seu projeto
2. Menu **SQL Editor** → **New query**
3. Copie o conteúdo de `supabase/migrations/20250220000000_carretel_integracao_campos.sql`
4. Cole e clique em **Run**

#### Opção C: psql direto

```bash
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" -f supabase/migrations/20250220000000_carretel_integracao_campos.sql
```

### Nota sobre tabela `usuarios`

Se seu projeto usa **Supabase Auth** e a tabela de perfis é `profiles` (não `usuarios`), crie uma migração separada ou edite para usar `profiles` em vez de `usuarios`.
