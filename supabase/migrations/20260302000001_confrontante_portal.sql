-- Confrontante portal: token, status e vínculo de documentos

alter table if exists public.confrontacoes
  add column if not exists token_acesso uuid unique default gen_random_uuid(),
  add column if not exists status text default 'identified_no_contact',
  add column if not exists whatsapp text,
  add column if not exists observacoes text,
  add column if not exists data_contato timestamptz,
  add column if not exists data_docs_recebidos timestamptz;

create index if not exists idx_confrontacoes_token_acesso
  on public.confrontacoes(token_acesso);

alter table if exists public.documentos
  add column if not exists confrontante_id bigint references public.confrontacoes(id) on delete set null;

-- Acesso público controlado por token
alter table if exists public.confrontacoes enable row level security;

drop policy if exists "Anon pode ler confrontacao por token" on public.confrontacoes;
create policy "Anon pode ler confrontacao por token"
  on public.confrontacoes
  for select
  to anon
  using (token_acesso is not null);

drop policy if exists "Anon pode atualizar confrontacao por token" on public.confrontacoes;
create policy "Anon pode atualizar confrontacao por token"
  on public.confrontacoes
  for update
  to anon
  using (token_acesso is not null)
  with check (token_acesso is not null);

alter table if exists public.documentos enable row level security;

drop policy if exists "Anon pode inserir documentos de confrontante" on public.documentos;
create policy "Anon pode inserir documentos de confrontante"
  on public.documentos
  for insert
  to anon
  with check (confrontante_id is not null);
