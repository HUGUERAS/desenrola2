# **Guia definitivo para desenvolvimento consistente com IA**

---

## 🎯 ANTES DE COMEÇAR - LEIA ISTO!

### **Problema Comum:**
```
❌ IA gera código rápido
❌ Mas fica voltando nas mesmas coisas
❌ Refaz código já feito
❌ Perde contexto
❌ Inconsistências
```

### **Solução:**
```
✅ SEMPRE copie o PROMPT MASTER antes de gerar código
✅ SEMPRE consulte as REGRAS RÍGIDAS
✅ SEMPRE siga a ESTRUTURA DE ARQUIVOS
✅ NUNCA desvie dos PADRÕES
```

---

## 🧠 PROMPT MASTER PARA IA

**COPIE E COLE ESTE PROMPT NO VS CODE COPILOT/CURSOR/CHAT:**

```
# CONTEXTO: Desenrola - Sistema de Topografia

Você é um desenvolvedor sênior trabalhando no **Desenrola**, um sistema que conecta clientes e topógrafos para projetos de regularização fundiária.

## OBJETIVO DO APP:
- Clientes desenham suas áreas e fornecem dados
- Sistema identifica vizinhos AUTOMATICAMENTE (loteamentos)
- Topógrafos validam e geram documentos (memoriais, plantas)

## CENÁRIO PRINCIPAL (MOTIVAÇÃO DO APP):
Loteamento com 50 lotes:
- 50 clientes diferentes desenham seus lotes
- Cada cliente fornece seus dados (nome, CPF, endereço)
- Sistema detecta topologia (quais lotes se tocam)
- Sistema cruza dados: Lote 1 = João, Lote 2 = Maria → João é vizinho de Maria
- Topógrafo gera 50 memoriais individuais automaticamente

## STACK TECNOLÓGICO:
- Frontend: React 19 + TypeScript + Vite + ArcGIS Maps SDK 4.34.8
- Backend: FastAPI (Python 3.11+)
- Database: Supabase (PostgreSQL + PostGIS)
- Monorepo: Nx
- Deploy: Hostinger VPS (SEM Docker)
- Geodesia: SIRGAS 2000 (SRID 4674) — padrão brasileiro oficial

## FORMATOS GEOESPACIAIS SUPORTADOS:
- WKT: formato interno (salvar/ler do PostGIS)
- KML: importar/exportar (Google Earth)
- DXF: importar (AutoCAD/levantamentos topográficos)
- SHP: importar/exportar (Shapefile ESRI — SIGEF/INCRA)

## USUÁRIOS:
1. CLIENTE (leigo):
   - Acessa por curiosidade ou link do topógrafo
   - Cria projeto, preenche dados, desenha área
   - Acompanha status
   - Recebe documentos

2. TOPÓGRAFO (especialista):
   - Recebe projetos de clientes
   - Valida e corrige desenhos
   - Sistema identifica vizinhos automaticamente
   - Gera documentos (memoriais, plantas)
   - Envia para clientes

## FUNCIONALIDADES CORE:
1. ✅ Autenticação (Supabase Auth + RBAC com roles)
2. ✅ Cliente: criar projeto, desenhar, upload docs, confrontações
3. ✅ Topógrafo: dashboard, validar, editar, identificar vizinhos
4. ✅ Identificação automática de vizinhos (CRÍTICO!)
5. ✅ Geração de documentos (templates + PDF)
6. ✅ Financeiro: orçamentos, despesas, pagamentos

## REGRAS RÍGIDAS - NUNCA DESVIE:

### 1. ESTRUTURA DE ARQUIVOS (NÃO MUDE):
```
apps/
├── web/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/          # Componentes reutilizáveis (Button, Input)
│   │   │   ├── map/         # Componentes de mapa (MapView, DrawTools)
│   │   │   ├── forms/       # Formulários (DadosTerreno, Confrontacoes)
│   │   │   └── tools/       # Ferramentas CAD (já existe, não mexer)
│   │   ├── pages/
│   │   │   ├── auth/        # Login, Registro
│   │   │   ├── cliente/     # Dashboard, Projeto, Status
│   │   │   └── topografo/   # Dashboard, Validar, Vizinhos
│   │   ├── lib/
│   │   │   ├── auth.ts      # Funções de autenticação
│   │   │   ├── supabase.ts  # Cliente Supabase
│   │   │   └── utils.ts     # Utilitários
│   │   └── types/
│   │       └── index.ts     # Tipos TypeScript
│   └── package.json
└── api/
    ├── main.py              # FastAPI app
    ├── db.py                # Cliente Supabase (backend)
    ├── auth.py              # RBAC: get_perfil, require_topografo
    ├── routes/
    │   ├── projetos.py
    │   ├── lotes.py         # Inclui topology + confrontações
    │   └── documents.py     # Geração de documentos
    ├── services/
    │   ├── topology.py      # Lógica de topologia
    │   └── documents.py     # Lógica de documentos
    ├── models/              # Pydantic models
    └── requirements.txt
```

### 2. PADRÕES DE CÓDIGO:

**TypeScript (Frontend):**
```typescript
// ✅ SEMPRE use tipos explícitos
interface Lote {
  id: number
  numero: number
  geom: string       // WKT (SRID=4674)
  area: number
  cliente_id: string
}

// ✅ SEMPRE use async/await (não .then())
async function buscarLotes(projetoId: number): Promise<Lote[]> {
  const { data, error } = await supabase
    .from('lotes')
    .select('*')
    .eq('projeto_id', projetoId)
  
  if (error) throw error
  return data
}

// ✅ SEMPRE trate erros
try {
  const lotes = await buscarLotes(projetoId)
} catch (error) {
  console.error('Erro ao buscar lotes:', error)
  alert('Erro ao carregar dados')
}

// ✅ SEMPRE use nomes descritivos
const handleSubmitDadosTerreno = async () => { /* ... */ }
```

**Python (Backend):**
```python
# ✅ SEMPRE use type hints
from typing import List, Dict, Optional
from pydantic import BaseModel
from fastapi import Depends

class Lote(BaseModel):
    id: int
    numero: int
    geom: Optional[str]  # WKT com SRID=4674
    area: float
    cliente_id: str

# ✅ SEMPRE use RBAC nos endpoints
@router.get("/api/lotes/{projeto_id}")
def get_lotes(projeto_id: int, perfil: dict = Depends(get_perfil)):
    try:
        _projeto_autorizado(projeto_id, perfil)
        response = supabase.table('lotes') \
            .select('*') \
            .eq('projeto_id', projeto_id) \
            .execute()
        return {'success': True, 'data': response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 3. CONVENÇÕES DE NOMES:

```
✅ Arquivos:    kebab-case     → criar-projeto.tsx
✅ Componentes: PascalCase     → CriarProjeto
✅ Funções:     camelCase      → handleSubmit
✅ Constantes:  UPPER_SNAKE    → MAX_FILE_SIZE
✅ Types:       PascalCase     → interface Usuario
✅ Rotas API:   snake_case     → /api/projetos/criar_projeto
✅ Tabelas DB:  snake_case     → usuarios, lotes, confrontacoes
```

### 4. REGRAS DE NEGÓCIO CRÍTICAS:

**IDENTIFICAÇÃO DE VIZINHOS:**
```
SE projeto_tipo == "loteamento" OU "regularizacao_contigua":
  → Sistema identifica automaticamente (topologia)
  → Detecta lotes adjacentes via PostGIS (ST_Touches)
  → Calcula azimute (ST_Azimuth) → direção cardeal (N, S, L, O)
  → Cruza com dados de clientes
  → Retorna para REVISÃO do topógrafo (não salva automaticamente)

SE projeto_tipo == "individual":
  → Cliente informa manualmente
  → Campos: nome, CPF, matrícula, confrontação
  → Cliente é RESPONSÁVEL pelos dados
```

**CONFRONTAÇÕES:**
```
Cada lote tem 4 confrontações (Norte, Sul, Leste, Oeste)

Tipos:
- 'lote_interno':    outro lote do projeto
- 'pessoa_externa':  proprietário externo (dados manuais)
- 'rua':             logradouro
- 'rio':             corpo d'água
- 'outro':           área pública, etc.
```

**LGPD:**
```
✅ Cada cliente fornece SEUS PRÓPRIOS dados
✅ Dados de vizinhos = outros clientes que também forneceram
✅ Sistema NÃO busca dados de terceiros externos
✅ Cliente informa confrontações externas manualmente
✅ Termo de responsabilidade obrigatório
```

### 5. BANCO DE DADOS - SCHEMA:

```sql
-- ⚠️ SRID=4674 (SIRGAS 2000) — padrão oficial do Brasil
-- ⚠️ Coluna de geometria = geom (WKT)
-- ⚠️ IDs numéricos (serial/int) para lotes

CREATE TABLE perfis (
  id SERIAL PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('proprietario', 'topografo', 'admin')),
  tenant_id UUID
);

CREATE TABLE projetos (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'INDIVIDUAL',
  status TEXT NOT NULL DEFAULT 'RASCUNHO',
  tenant_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE lotes (
  id SERIAL PRIMARY KEY,
  projeto_id INT REFERENCES projetos(id) ON DELETE CASCADE,
  nome_cliente TEXT,
  email_cliente TEXT,
  telefone_cliente TEXT,
  cpf_cnpj_cliente TEXT,
  numero INT,
  geom GEOMETRY(Polygon, 4674),  -- SIRGAS 2000
  area NUMERIC,
  perimetro NUMERIC,
  status TEXT DEFAULT 'PENDENTE',
  token_acesso TEXT UNIQUE,
  link_expira_em TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE confrontacoes (
  id SERIAL PRIMARY KEY,
  lote_id INT REFERENCES lotes(id) ON DELETE CASCADE,
  vizinho_lote_id INT REFERENCES lotes(id) ON DELETE SET NULL,
  numero_vizinho INT,
  direcao TEXT NOT NULL CHECK (direcao IN ('norte', 'sul', 'leste', 'oeste')),
  tipo TEXT DEFAULT 'LOTE',
  nome TEXT,
  cpf TEXT,
  UNIQUE(lote_id, direcao)
);

CREATE TABLE documentos (
  id SERIAL PRIMARY KEY,
  lote_id INT REFERENCES lotes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  formato TEXT NOT NULL,
  arquivo_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices espaciais
CREATE INDEX idx_lotes_geom ON lotes USING GIST (geom);
CREATE INDEX idx_confrontacoes_lote ON confrontacoes(lote_id);

-- Função RPC para identificar vizinhos
-- Nome: buscar_vizinhos_adjacentes(lote_id_param INT)
-- Retorna: vizinho_id, vizinho_numero, azimute_graus, distancia_metros, cliente_nome, cliente_cpf
```

### 6. ARCGIS MAPS SDK - PADRÕES:

```typescript
// ✅ SEMPRE use este setup
import Map from '@arcgis/core/Map'
import MapView from '@arcgis/core/views/MapView'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import Sketch from '@arcgis/core/widgets/Sketch'
import * as webMercatorUtils from '@arcgis/core/geometry/support/webMercatorUtils'

// Inicialização padrão
const map = new Map({
  basemap: 'topo-vector'
})

const view = new MapView({
  container: mapRef.current,
  map: map,
  center: [-47.9292, -15.7801],  // Brasília default
  zoom: 15
})

// Layer para desenhos
const graphicsLayer = new GraphicsLayer({ title: 'Desenhos' })
map.add(graphicsLayer)

// Widget Sketch nativo (não SketchViewModel)
const sketch = new Sketch({
  view: view,
  layer: graphicsLayer,
  creationMode: 'single',
  availableCreateTools: ['polygon'],
  defaultCreateOptions: { mode: 'click' }
})
view.ui.add(sketch, 'top-right')

// ✅ SEMPRE converta para WKT (SRID=4674) antes de salvar
function polygonToWKT(polygon: __esri.Polygon): string {
  const geog = webMercatorUtils.webMercatorToGeographic(polygon) as __esri.Polygon
  const coords = geog.rings[0]
  const pairs = coords.map(([lon, lat]) => `${lon} ${lat}`).join(', ')
  return `POLYGON((${pairs}))`
}

// No backend, salvar com SRID:
// data["geom"] = f"SRID=4674;{body.geom_wkt}"
```

### 7. SUPABASE - PADRÕES:

```typescript
// ✅ SEMPRE use este cliente
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ✅ SEMPRE use select com campos específicos
const { data, error } = await supabase
  .from('lotes')
  .select('id, numero, geom, area, nome_cliente, cpf_cnpj_cliente')
  .eq('projeto_id', projetoId)

// ✅ SEMPRE trate erro
if (error) {
  console.error('Erro Supabase:', error)
  throw error
}
```

### 8. AUTENTICAÇÃO E RBAC:

```python
# Backend: auth.py
# Funções de autenticação e autorização

def get_perfil(token) -> dict:
    """Retorna perfil do usuário autenticado.
    Returns: { user_id, email, role, tenant_id }
    """

def require_topografo(perfil) -> dict:
    """Depends() — exige role=topografo para escrita."""

def get_current_user_required(token) -> dict:
    """Depends() — exige usuário autenticado."""

# Uso nos endpoints:
@app.get("/api/projetos")
def listar_projetos(perfil: dict = Depends(get_perfil)):
    # topógrafo: vê projetos do seu tenant
    # proprietário: não vê lista de projetos
    ...

@app.post("/api/lotes")
def criar_lote(lote: LoteCreate, perfil: dict = Depends(require_topografo)):
    # apenas topógrafo pode criar
    ...

# Autorização por recurso:
def _lote_autorizado(lote_id, perfil, escrita=False):
    """Verifica se usuário pode acessar o lote."""
    # topógrafo: verifica tenant_id
    # proprietário: verifica email_cliente (só leitura)

def _projeto_autorizado(projeto_id, perfil):
    """Verifica se projeto pertence ao tenant."""
```

### 9. O QUE NUNCA FAZER:

```
❌ NUNCA mude a estrutura de pastas sem avisar
❌ NUNCA use Docker (problemas de performance)
❌ NUNCA use OpenLayers (só ArcGIS)
❌ NUNCA faça busca automática de dados de terceiros (LGPD!)
❌ NUNCA crie tabelas no banco sem seguir o schema
❌ NUNCA use .then() (sempre async/await)
❌ NUNCA deixe código sem tratamento de erro
❌ NUNCA use any sem necessidade (TypeScript)
❌ NUNCA faça commit sem testar
❌ NUNCA ignore os tipos do banco de dados
❌ NUNCA use SRID 4326 (sempre 4674 SIRGAS 2000)
❌ NUNCA salve geometria como GeoJSON no banco (sempre WKT)
❌ NUNCA crie endpoint sem RBAC (sempre Depends(get_perfil))
```

### 10. FLUXOS PRINCIPAIS:

**FLUXO CLIENTE:**
```
1. Login/Registro
2. Criar projeto (escolhe tipo: individual ou loteamento)
3. Preencher dados do terreno
4. Desenhar área no mapa (ArcGIS)
5. SE individual: informar confrontações manualmente
6. Upload documentos (escritura, IPTU, fotos)
7. Enviar para topógrafo
8. Acompanhar status
9. Receber documentos prontos
```

**FLUXO TOPÓGRAFO:**
```
1. Login
2. Ver dashboard com projetos pendentes
3. Abrir projeto
4. Validar dados do cliente
5. Corrigir/ajustar geometrias (ferramentas CAD)
6. SE loteamento: clicar "Identificar Vizinhos" (automático)
7. Revisar/ajustar confrontações
8. Gerar documentos (memorial, planta)
9. Enviar para cliente
10. Arquivar projeto
```

**ALGORITMO IDENTIFICAÇÃO DE VIZINHOS:**
```
⚠️ PROCESSA 1 LOTE POR VEZ!

1. Receber lote_id
2. Chamar RPC buscar_vizinhos_adjacentes(lote_id_param)
3. Para cada vizinho retornado:
   a. Ler azimute_graus
   b. Converter para direção cardeal (N/S/L/O)
   c. Incluir dados do cliente (nome, CPF)
4. Agrupar por direção (vizinhos_por_direcao)
5. Retornar para REVISÃO do topógrafo
6. Topógrafo aprova → POST /salvar-confrontacoes
```

---

## FIM DO PROMPT MASTER

Sempre que você (IA) for gerar código para o Desenrola:
1. ✅ Releia as seções relevantes deste prompt
2. ✅ Siga os padrões EXATAMENTE
3. ✅ Não invente estruturas novas
4. ✅ Use WKT com SRID=4674 (SIRGAS 2000)
5. ✅ Inclua RBAC em todo endpoint
6. ✅ Trate erros SEMPRE
7. ✅ Use tipos SEMPRE
```
