# Análise: Integração Carretel-Plataforma → Desenrola

**Objetivo:** Incorporar o melhor do Carretel sem perder as características do Desenrola.

---

## 1. Visão Geral dos Repositórios

| Aspecto | Desenrola | Carretel-Plataforma |
|---------|-----------|---------------------|
| **Stack** | React + Vite + FastAPI + Supabase + PostGIS + ArcGIS | React + Vite (frontend only) |
| **Backend** | API real com retry, timeout, Zod | MockAPI + useKV (GitHub Spark) |
| **Mapa** | ArcGIS com Sketch, geometrias reais | Não tem mapa |
| **Layout** | Sidebar + mapa sempre visíveis | Full-page por view |
| **Auth** | Supabase | Simulado (view state) |
| **Formulários** | Baseados em órgãos (SEAPA, CREA) | Genéricos |
| **UI** | CSS custom (panel-*) | shadcn/ui + Radix + Tailwind v4 |

---

## 2. Características do Desenrola a PRESERVAR

### 2.1 Obrigatório manter

| Característica | Motivo |
|----------------|--------|
| **Sidebar + Mapa sempre visíveis** | Contexto geoespacial e navegação unificada |
| **Estrutura dos formulários SEAPA** | MeusDadosPanel, ConfrontacoesPanel, PecasPanel — campos e placeholders (#PROP_CPF, #CONF_CPF, etc.) exigidos pelos documentos oficiais |
| **MapContainer ArcGIS** | Desenho real, Sketch, legenda, coordenadas |
| **API Client Desenrola** | Retry, timeout, validação Zod, integração Supabase |
| **Backend FastAPI** | Endpoints modulares, SRID configurável |
| **Fluxo de painéis** | Navegação por `setPanel`, contexto `projetoAtual`/`loteAtual` |

### 2.2 Formulários que NÃO podem ser substituídos

- **MeusDadosPanel** — Dados pessoais, endereço, imóvel, cônjuge (SEAPA)
- **ConfrontacoesPanel** — direção, nome, CPF, imóvel, matrícula (#CONFRONTANTE, etc.)
- **PecasPanel Config RT** — CREA, INCRA, ART, qualificação
- **LotesPanel** — nome_cliente, email, telefone, cpf_cnpj (integração documentos)

---

## 3. O que INCORPORAR do Carretel

### 3.1 Prioridade Alta — Incorporação direta

| Item | Fonte | Como incorporar | Riscos |
|------|-------|-----------------|--------|
| **DirectionCompass** | Carretel | Copiar componente puro (SVG). Usa `highlightedDirections` e `size`. Sem dependências de MockAPI/useKV. | Nenhum. Trocar `@/lib/types` por tipo local. |
| **Componentes shadcn/ui** | Carretel | Copiar `button`, `card`, `input`, `label`, `badge`, `dialog`, `table`, `tabs`, `sonner`, etc. Adaptar Tailwind v4 → v3 se necessário. | Verificar compatibilidade Tailwind. |
| **Toast (Sonner)** | Carretel | Instalar Sonner. Substituir `alert()` e feedback inline por `toast.success()`/`toast.error()`. | Nenhum. |
| **Formatação CPF/telefone** | Profile do Carretel | Extrair funções `formatCPF` e `formatPhone`. Aplicar em MeusDadosPanel, ConfrontacoesPanel, LotesPanel. | Preservar valor armazenado (com ou sem máscara conforme backend). |
| **Tema Terra Cotta** | PRD Carretel | Adicionar variáveis CSS (oklch) em `index.css`. Opcional, sem quebrar nada. | Nenhum. |

### 3.2 Prioridade Alta — Adaptar como painéis

| Item | Fonte | Como incorporar | Mudanças necessárias |
|------|-------|-----------------|----------------------|
| **VizinhosPanel enriquecido** | NeighborWizard | Manter fluxo Desenrola (apiClient.identificarVizinhos). Adicionar: DirectionCompass, edição manual por direção, botão "Adicionar vizinho" por direção. | Trocar MockAPI por apiClient. Manter dados do Desenrola (nome_cliente, cpf). |
| **FinanceiroPanel com Table + Dialog** | FinancialManagement | Trocar lista de cards por Table shadcn. Dialog para criar/editar. Status automático (pendente→atrasado por data). | Trocar useKV por apiClient (getOrcamentos, getDespesas, getPagamentos). Campos do Desenrola (descricao, valor, categoria, etc.). |
| **ProjetosPanel com Tabs** | ProjectDashboard | Adicionar Tabs: Pendentes / Em Andamento / Finalizados / Todos. Opcional: sub-aba Financeiro. | Trocar MockAPI por apiClient.getProjects. Filtrar por status no frontend. |

### 3.3 Prioridade Média — Incorporação parcial

| Item | Fonte | Como incorporar | Observações |
|------|-------|-----------------|-------------|
| **Profile (troca de senha + CREA)** | Profile | Não substituir MeusDadosPanel. Criar seção "Configurações da conta" no Header ou painel: troca de senha (supabase.auth.updateUser). Se topógrafo: campos CREA/empresa (já existem em PecasPanel Config RT). | Evitar duplicar dados. PecasPanel já tem RT; Profile pode ter "perfil topógrafo" ou link para PecasPanel. |
| **NovoProjeto wizard** | NovoProjeto | Usar wizard 2 steps (tipo + dados) no fluxo de criar projeto. Campos: tipo (INDIVIDUAL/LOTEAMENTO), nome, endereco, cidade, estado, observacoes. | API Desenrola aceita `nome`, `descricao`, `tipo`. Verificar se backend suporta endereco, cidade, estado. Se não, manter só nome/descricao/tipo e migrar campos depois. |
| **LotesPanel com Table** | ProjectDetail | Tabela com colunas: número, proprietário, CPF, área, perímetro, status. Ação "Identificar vizinhos" por linha. | Desenrola já tem cards. Adicionar visualização em Table como alternativa ou substituição. |
| **Empty states** | ClienteDashboard, etc. | Padronizar empty states com ícone + mensagem + CTA. | Aplicar nos painéis que têm `panel-empty`. |

### 3.4 Prioridade Baixa

| Item | Fonte | Como incorporar |
|------|-------|-----------------|
| **IBM Plex Sans + JetBrains Mono** | PRD | Adicionar fontes via Google Fonts em index.html. |
| **Phosphor Icons** | Carretel | Opcional. Desenrola usa Lucide; manter Lucide ou adicionar Phosphor. |
| **Design tokens** | theme.json, PRD | Cores, espaçamentos como variáveis CSS. |

---

## 4. O que NÃO incorporar (ou substituir)

| Item | Motivo |
|------|--------|
| **Layout full-page** | Desenrola exige sidebar + mapa sempre. |
| **MockAPI / useKV** | Desenrola usa apiClient e Supabase. |
| **Sistema de rotas/views do App.tsx** | Desenrola usa `panel` + `setPanel`. |
| **Formulários do Profile** | Campos diferentes do MeusDadosPanel; MeusDados é base SEAPA. |
| **Estrutura de tipos Carretel** | Desenrola tem tipos próprios (Projeto, Lote, etc.). Usar tipos Carretel só como referência para mapeamento. |

---

## 5. Dependências e conflitos

| Carretel | Desenrola | Ação |
|----------|-----------|------|
| Tailwind v4 | Tailwind v3 | Manter v3 por ora; testar shadcn com v3. |
| @github/spark (useKV) | — | Não usar. Substituir por apiClient/Supabase. |
| Phosphor Icons | Lucide | Manter Lucide; traduzir ícones ao portar componentes. |
| @/ alias | Possível tsconfig paths | Garantir alias consistente. |
| Zod | Já existe em Desenrola | OK. |
| Sonner | Não tem | Adicionar. |
| Radix (via shadcn) | Não tem | Adicionar com shadcn. |

---

## 6. Ordem sugerida de implementação

1. **Sonner** — Substituir alerts por toasts (rápido, baixo risco).
2. **DirectionCompass** — Componente isolado, integrar no VizinhosPanel.
3. **shadcn base** — button, input, label, card, badge (necessários para os demais).
4. **VizinhosPanel** — DirectionCompass + edição manual + estrutura do NeighborWizard (fluxo).
5. **FinanceiroPanel** — Table + Dialog, trocar useKV por apiClient.
6. **ProjetosPanel** — Tabs por status.
7. **Formatação CPF/telefone** — Em MeusDadosPanel, ConfrontacoesPanel, LotesPanel.
8. **Tema** — Variáveis Terra Cotta, fontes (opcional).

---

## 7. Alterações nas Tabelas (Schema)

Para suportar os novos fluxos, as tabelas precisam ser alteradas. O arquivo de migração está em:

**`docs/database/migrations/001_carretel_integracao_campos.sql`**

### 7.1 Resumo das alterações

| Tabela | Colunas adicionadas | Motivo |
|--------|---------------------|--------|
| **projetos** | `endereco`, `cidade`, `estado`, `observacoes` | NovoProjeto wizard (Passo 2) |
| **usuarios** | `crea`, `empresa` | Profile topógrafo |
| **confrontacoes** | `imovel` | #CONF_IMOVEL (doc 03 SEAPA) |
| **despesas** | `projeto_id`, `data_vencimento` | Status atrasado, vínculo ao projeto |
| **orcamentos** | `projeto_id`, `data_emissao`, `data_vencimento`, `cliente_nome` | FinancialManagement, status atrasado |
| **pagamentos** | `data_vencimento` | Status atrasado |

### 7.2 Execução

```bash
# Supabase (SQL Editor) ou psql
psql $DATABASE_URL -f docs/database/migrations/001_carretel_integracao_campos.sql
```

### 7.3 Ajustes no backend

Após aplicar a migração, atualizar:

- **ProjetoCreate** (schemas.py): `endereco`, `cidade`, `estado`, `observacoes` opcionais
- **DespesaCreate**: garantir `projeto_id` e `data_vencimento` no insert
- **OrcamentoCreate**: `data_emissao`, `data_vencimento`, `cliente_nome` opcionais
- **PagamentoCreate**: `data_vencimento` opcional
- **ConfrontacaoSalvar** / salvar confrontações: incluir campo `imovel`

---

## 8. Checklist de não-regressão

Após cada incorporação:

- [ ] Sidebar e mapa continuam sempre visíveis no app autenticado.
- [ ] MeusDadosPanel mantém todos os campos e placeholders SEAPA.
- [ ] ConfrontacoesPanel mantém campos #CONFRONTANTE, #CONF_CPF, etc.
- [ ] PecasPanel Config RT mantém campos CREA/INCRA/ART.
- [ ] Fluxo de identificar vizinhos usa apiClient.identificarVizinhos (não MockAPI).
- [ ] Dados financeiros vêm de apiClient (getOrcamentos, getDespesas, getPagamentos).
- [ ] Autenticação continua via Supabase.
- [ ] MapContainer e desenho ArcGIS intactos.

---

## 9. Resumo executivo

| Incorporar | Manter Desenrola |
|------------|------------------|
| DirectionCompass, shadcn/ui, Sonner, formatação CPF/telefone, Table/Dialog no Financeiro, Tabs no Projetos, fluxo NeighborWizard (edição manual), tema opcional | Sidebar+mapa, formulários SEAPA, MapContainer ArcGIS, apiClient, Supabase, estrutura de painéis |

**Risco geral:** Baixo, desde que formulários oficiais e layout sidebar+mapa não sejam alterados.
