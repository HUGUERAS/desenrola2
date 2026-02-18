// ✅ Tipos TypeScript completos conforme schema do banco

export interface Usuario {
    id: string
    email: string
    nome: string
    cpf: string | null
    telefone: string | null
    role: 'cliente' | 'topografo' | 'admin'
    created_at: string
}

export interface Projeto {
    id: string
    nome: string
    tipo: 'individual' | 'loteamento' | 'regularizacao'
    status: 'rascunho' | 'aguardando' | 'em_analise' | 'finalizado'
    topografo_id: string | null
    created_at: string
    updated_at: string
}

export interface Lote {
    id: string
    projeto_id: string
    cliente_id: string | null
    numero: number
    geometria: GeoJSONPolygon
    area: number | null
    perimetro: number | null
    token: string | null
    created_at: string
}

export interface Confrontacao {
    id: string
    lote_id: string
    direcao: 'norte' | 'sul' | 'leste' | 'oeste'
    tipo: 'lote_interno' | 'pessoa_externa' | 'rua' | 'rio' | 'outro'
    vizinho_lote_id: string | null
    nome: string | null
    cpf: string | null
    matricula: string | null
    descricao: string | null
    created_at: string
}

export interface Documento {
    id: string
    lote_id: string
    tipo: 'memorial' | 'planta' | 'relatorio' | 'sigef'
    formato: 'pdf' | 'dwg' | 'xml' | 'ods'
    arquivo_url: string
    template_usado: string | null
    created_at: string
}

export interface Upload {
    id: string
    lote_id: string
    tipo: 'escritura' | 'iptu' | 'foto' | 'outro'
    arquivo_url: string
    nome_original: string
    tamanho: number | null
    created_at: string
}

export interface GeoJSONPolygon {
    type: 'Polygon'
    coordinates: number[][][]
    crs?: {
        type: string
        properties: { name: string }
    }
}

export interface Vizinho {
    lote_id: string
    numero: number
    direcao: 'norte' | 'sul' | 'leste' | 'oeste'
    cliente: {
        nome: string
        cpf: string | null
    }
}
