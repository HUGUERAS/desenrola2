"""
Pydantic Models — Desenrola API
✅ IDs int (serial)
✅ Geometria = geom (WKT, SRID=4674)
✅ SEMPRE use type hints
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


# ── Enums ──

class ProjetoTipo(str, Enum):
    INDIVIDUAL = "INDIVIDUAL"
    LOTEAMENTO = "LOTEAMENTO"


class ProjetoStatus(str, Enum):
    RASCUNHO = "RASCUNHO"
    EM_ANDAMENTO = "EM_ANDAMENTO"
    CONCLUIDO = "CONCLUIDO"
    ARQUIVADO = "ARQUIVADO"


class LoteStatus(str, Enum):
    PENDENTE = "PENDENTE"
    DESENHO = "DESENHO"
    VALIDACAO = "VALIDACAO"
    APROVADO = "APROVADO"
    REJEITADO = "REJEITADO"


class Direcao(str, Enum):
    norte = "norte"
    sul = "sul"
    leste = "leste"
    oeste = "oeste"


class ConfrontacaoTipo(str, Enum):
    LOTE = "LOTE"
    PESSOA = "PESSOA"
    RUA = "RUA"
    RIO = "RIO"
    OUTRO = "OUTRO"


# ── Projetos ──

class ProjetoCreate(BaseModel):
    nome: str = Field(..., min_length=1)
    descricao: Optional[str] = None
    tipo: str = "INDIVIDUAL"
    endereco: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    observacoes: Optional[str] = None


class ProjetoUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    tipo: Optional[str] = None
    status: Optional[str] = None
    endereco: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    observacoes: Optional[str] = None


# ── Lotes ──

class LoteCreate(BaseModel):
    projeto_id: int
    nome_cliente: str
    email_cliente: Optional[str] = None
    telefone_cliente: Optional[str] = None
    cpf_cnpj_cliente: Optional[str] = None
    geojson: Optional[Dict[str, Any]] = None


class GeometriaInput(BaseModel):
    geojson: Dict[str, Any]


class StatusLoteInput(BaseModel):
    status: str


# ── Confrontações ──

class ConfrontacaoDetectadaInput(BaseModel):
    lote_id: str
    numero: int
    direcao: str


class SalvarConfrontacoesInput(BaseModel):
    vizinhos: List[ConfrontacaoDetectadaInput]


# ── Vizinhos (manual) ──

class VizinhoInput(BaseModel):
    lote_id: int
    nome_vizinho: str
    lado: str


# ── Validação Topologia ──

class ValidarTopologiaInput(BaseModel):
    geojson: Optional[Dict[str, Any]] = None


class ConfrontacaoSalvar(BaseModel):
    """Modelo para salvar confrontação após revisão do topógrafo."""
    lote_id: Optional[int] = None
    direcao: str  # norte, sul, leste, oeste
    tipo: str = "LOTE"  # LOTE, PESSOA, RUA, RIO, OUTRO
    vizinho_lote_id: Optional[int] = None
    nome: Optional[str] = None
    cpf: Optional[str] = None
    matricula: Optional[str] = None
    descricao: Optional[str] = None
    imovel: Optional[str] = None  # Nome do imóvel confrontante (doc 03 SEAPA)


# ── Perfil ──

class PerfilSetInput(BaseModel):
    role: str  # topografo | proprietario


# ── Financeiro ──

class OrcamentoCreate(BaseModel):
    projeto_id: Optional[int] = None
    lote_id: Optional[int] = None
    valor: float
    status: str = "RASCUNHO"
    observacoes: Optional[str] = None
    data_emissao: Optional[str] = None
    data_vencimento: Optional[str] = None
    cliente_nome: Optional[str] = None


class OrcamentoUpdate(BaseModel):
    valor: Optional[float] = None
    status: Optional[str] = None
    observacoes: Optional[str] = None


class DespesaCreate(BaseModel):
    projeto_id: int
    descricao: str
    valor: float
    data: Optional[str] = None
    data_vencimento: Optional[str] = None
    categoria: Optional[str] = None
    observacoes: Optional[str] = None


class DespesaUpdate(BaseModel):
    descricao: Optional[str] = None
    valor: Optional[float] = None
    data: Optional[str] = None
    data_vencimento: Optional[str] = None
    categoria: Optional[str] = None
    observacoes: Optional[str] = None
    projeto_id: Optional[int] = None


class PagamentoCreate(BaseModel):
    lote_id: int
    valor_total: float
    valor_pago: float = 0.0
    status: str = "PENDENTE"
    data_pagamento: Optional[str] = None
    data_vencimento: Optional[str] = None
    metodo_pagamento: Optional[str] = None
    observacoes: Optional[str] = None


class PagamentoUpdate(BaseModel):
    valor_total: Optional[float] = None
    valor_pago: Optional[float] = None
    status: Optional[str] = None
    data_pagamento: Optional[str] = None
    metodo_pagamento: Optional[str] = None
    observacoes: Optional[str] = None
