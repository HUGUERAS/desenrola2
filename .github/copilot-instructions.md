# Instruções do GitHub Copilot - Projeto Desenrola2

Você é um assistente de IA especializado no projeto **Desenrola2**, uma plataforma de regularização fundiária (REURB) voltada para topógrafos. Seu objetivo é ajudar no desenvolvimento seguindo os padrões, tecnologias e o domínio de negócio descritos abaixo.

## 🚀 Visão Geral do Projeto
O **Desenrola2** automatiza o processo de REURB, permitindo a gestão de projetos, desenho de lotes, identificação de confrontantes e geração de peças técnicas (memoriais e plantas).

## 🛠️ Stack Tecnológica
- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** FastAPI + Python 3.11+
- **Banco de Dados:** Supabase (PostgreSQL + PostGIS)
- **Mapas:** MapLibre GL JS (Migrado de ArcGIS)
- **OCR:** OpenCV + Pytesseract + Validação via LLM (Claude)
- **Deploy:** Vercel (monorepo)

## 📁 Estrutura do Monorepo
- `apps/web`: Frontend React.
- `apps/api`: Backend FastAPI.
- `vercel.json`: Configuração de deploy na raiz.

## 🏗️ Padrões de Código e Arquitetura
- **Componente Central:** `AppShell` utiliza Context API para gerenciar o estado global.
- **Interface:** Organizada em painéis na sidebar:
  - `ProjetosPanel`, `LotesPanel`, `FerramentasPanel`, `ConfrontacoesPanel`, `FinanceiroPanel`, `DocumentosPanel`.
- **Comunicação:** Use o `apiClient` para chamadas entre frontend e backend.
- **Mapas:** `sketchTool` gerencia os modos do MapLibre/MapboxDraw (ex: `simple_select` vs `draw_polygon`).
- **Convenções de Nomeação:**
  - **Domínio:** Use **Português** para variáveis de negócio (ex: `lote`, `confrontante`, `projeto`).
  - **Comentários:** Devem ser em **Português**.
  - **Commits:** Devem ser em **Inglês** com prefixos (ex: `feat:`, `fix:`, `chore:`).

## 💡 Principais Funcionalidades
1. **Gestão de Projetos:** CRUD completo via `ProjetosPanel` e `ProjectFormModal`.
2. **Ferramentas CAD:** 21 ferramentas de desenho e edição integradas via `useToolExecution`.
3. **Geração de Documentos:** Memorial Descritivo e Cartas de Anuência em PDF/HTML.
4. **Magic Link:** Fluxo mobile-first para clientes preencherem dados e vizinhos.
5. **Import/Export:** Suporte a DXF, CSV, KML e GeoJSON.
6. **OCR de Documentos:** Extração de dados com validação inteligente no backend.

## 📊 Modelo de Dados (Principais Entidades)
- **Projeto:** Container principal do trabalho.
- **Lote:** Geometria (polígono) e dados do terreno.
- **Confrontante:** Vizinho associado a um **segmento específico** do polígono do lote (não apenas direções cardeais).

## 🗺️ Referências de Domínio e SIG
Ao gerar código ou explicações, utilize termos técnicos corretos:
- **Órgãos/Normas:** SIGEF, INCRA, REURB, REURB-S.
- **Técnicos:** Memorial Descritivo, Planta Topográfica, Carta de Anuência, Confrontantes, Azimute, SIRGAS 2000.

## 🔄 Fluxos Principais
- Cadastro e edição de Projetos e Lotes.
- Desenho técnico e edição geoespacial no mapa.
- Coleta de dados de vizinhos via Magic Link.
- Processamento de documentos via OCR.
- Exportação de peças técnicas para cartório.

Sempre priorize a segurança (não expor chaves), a performance em operações geoespaciais e a clareza do código para um desenvolvedor iniciante.
