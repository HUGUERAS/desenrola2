/**
 * PecasPanel — Geração de peças técnicas SEAPA
 * Dados do proprietário vêm do cadastro do cliente (MeusDadosPanel → Supabase user_metadata).
 *
 * Documentos obrigatórios:
 *   02 - Requerimento de Ordem de Serviço
 *   03 - Declaração de Respeito de Limites (por confrontante)
 *   13 - Ordem de Serviço
 *   Memorial Descritivo
 *   Planta Topográfica (área do projeto)
 */
import { useState, useEffect } from 'react';
import {
    FileText, Printer, AlertCircle, CheckCircle,
    Loader2, MapPin, Users, ClipboardList, Map
} from 'lucide-react';
import { useApp } from '../../pages/AppShell';
import { supabase } from '../../lib/supabase';
import apiClient from '../../services/api';
import {
    gerarRequerimentoOS,
    gerarDeclaracaoLimites,
    gerarOrdemServico,
    gerarMemorialDescritivo,
    gerarPlantaTopografica,
    abrirDocumento,
    type DadosDocumento,
    type DadosConfrontante,
} from '../../lib/doc-generator';

interface ConfigRT {
    nome: string;
    cpf: string;
    qualificacao: string;
    conselho_tipo: string;
    conselho_num: string;
    credenciamento_incra: string;
    art_num: string;
}

const DEFAULT_RT: ConfigRT = {
    nome: '',
    cpf: '',
    qualificacao: 'TÉCNICO EM AGRIMENSURA',
    conselho_tipo: 'CFT',
    conselho_num: '',
    credenciamento_incra: '',
    art_num: '',
};

// Dados do proprietário vindos do cadastro do cliente
interface DadosCliente {
    nome: string;
    cpf: string;
    rg: string;
    profissao: string;
    estado_civil: string;
    nacionalidade: string;
    email: string;
    telefone: string;
    endereco: string;
    cidade: string;
    uf: string;
    cep: string;
    // Dados do Imóvel (do cliente)
    nome_imovel: string;
    matricula: string;
    gleba: string;
    municipio_imovel: string;
    uf_imovel: string;
    area_imovel: string;
    // Cônjuge
    conjuge_nome: string;
    conjuge_cpf: string;
    conjuge_rg: string;
}

export default function PecasPanel() {
    const { loteAtual, projetoAtual, mapGeometries } = useApp();
    const [rt, setRt] = useState<ConfigRT>(() => {
        const saved = localStorage.getItem('desenrola_rt');
        return saved ? JSON.parse(saved) : DEFAULT_RT;
    });
    const [showConfig, setShowConfig] = useState(false);
    const [confrontantes, setConfrontantes] = useState<DadosConfrontante[]>([]);
    const [cliente, setCliente] = useState<DadosCliente | null>(null);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    // Salvar configuração do RT
    useEffect(() => {
        localStorage.setItem('desenrola_rt', JSON.stringify(rt));
    }, [rt]);

    // Carregar dados do cliente do Supabase user_metadata
    useEffect(() => {
        const loadCliente = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const m = user.user_metadata || {};
                    setCliente({
                        nome: m.display_name || m.nome || '',
                        cpf: m.cpf || '',
                        rg: m.rg || '',
                        profissao: m.profissao || '',
                        estado_civil: m.estado_civil || '',
                        nacionalidade: m.nacionalidade || 'Brasileiro(a)',
                        email: user.email || '',
                        telefone: m.phone || m.telefone || '',
                        endereco: m.endereco || '',
                        cidade: m.cidade || '',
                        uf: m.uf || '',
                        cep: m.cep || '',
                        // Imóvel
                        nome_imovel: m.nome_imovel || '',
                        matricula: m.matricula || '',
                        gleba: m.gleba || '',
                        municipio_imovel: m.municipio_imovel || '',
                        uf_imovel: m.uf_imovel || '',
                        area_imovel: m.area_imovel || '',
                        // Cônjuge
                        conjuge_nome: m.conjuge_nome || '',
                        conjuge_cpf: m.conjuge_cpf || '',
                        conjuge_rg: m.conjuge_rg || '',
                    });
                }
            } catch (err) {
                console.error('Erro ao carregar dados do cliente:', err);
            }
        };
        loadCliente();
    }, [loteAtual]);

    // Carregar confrontantes do lote
    useEffect(() => {
        if (!loteAtual) return;
        apiClient.getConfrontacoes(loteAtual.id).then((res: any) => {
            if (res.data && Array.isArray(res.data)) {
                setConfrontantes(res.data.map((c: any) => ({
                    nome: c.nome_confrontante || c.nome || '________________',
                    cpf: c.cpf_confrontante || '________________',
                    imovel: c.imovel_confrontante || '________________',
                    matricula: c.matricula_confrontante || '________________',
                    direcao: c.direcao || c.lado || '',
                })));
            }
        });
    }, [loteAtual]);

    const buildDados = (): DadosDocumento | null => {
        if (!loteAtual || !projetoAtual) return null;
        if (!rt.nome) {
            setMsg({ ok: false, text: 'Configure os dados do Responsável Técnico primeiro.' });
            setShowConfig(true);
            return null;
        }

        // Dados do proprietário: prioriza cadastro do cliente, fallback para loteAtual
        const prop = cliente;

        return {
            proprietario: {
                nome: prop?.nome || loteAtual.nome_cliente || '________________',
                cpf: prop?.cpf || (loteAtual as any).cpf_cnpj_cliente || '________________',
                rg: prop?.rg,
                profissao: prop?.profissao,
                estado_civil: prop?.estado_civil,
                nacionalidade: prop?.nacionalidade,
                email: prop?.email || loteAtual.email_cliente,
                telefone: prop?.telefone || (loteAtual as any).telefone_cliente,
                endereco: prop?.endereco,
                municipio: prop?.cidade || (projetoAtual as any).municipio || '________________',
                estado: prop?.uf || (projetoAtual as any).estado || 'GO',
                cep: prop?.cep,
            },
            imovel: {
                nome: prop?.nome_imovel || projetoAtual.nome,
                municipio: prop?.municipio_imovel || (projetoAtual as any).municipio || '________________',
                estado: prop?.uf_imovel || (projetoAtual as any).estado || 'GO',
                matricula: prop?.matricula || (loteAtual as any).matricula,
                gleba: prop?.gleba,
                area_matricula: prop?.area_imovel,
                lote_id: loteAtual.id,
            },
            responsavel_tecnico: rt,
            confrontantes,
            geom_wkt: loteAtual.geom,
        };
    };

    const handleGerar = (tipo: string) => {
        setMsg(null);
        const dados = buildDados();
        if (!dados) return;

        try {
            let html: string;
            switch (tipo) {
                case 'requerimento_os':
                    html = gerarRequerimentoOS(dados);
                    break;
                case 'ordem_servico':
                    html = gerarOrdemServico(dados);
                    break;
                case 'memorial':
                    html = gerarMemorialDescritivo(dados);
                    break;
                case 'planta':
                    // Planta usa todas as geometrias do projeto
                    const dadosPlanta = {
                        ...dados,
                        geom_wkt: dados.geom_wkt, // lote ativo
                    };
                    html = gerarPlantaTopografica(dadosPlanta);
                    break;
                default:
                    return;
            }
            abrirDocumento(html);
            setMsg({ ok: true, text: `Documento gerado com sucesso!` });
        } catch (err) {
            setMsg({ ok: false, text: 'Erro ao gerar documento.' });
        }
    };

    const handleGerarDeclaracao = (confrontante: DadosConfrontante) => {
        const dados = buildDados();
        if (!dados) return;

        try {
            const html = gerarDeclaracaoLimites(dados, confrontante);
            abrirDocumento(html);
            setMsg({ ok: true, text: `Declaração para "${confrontante.nome}" gerada!` });
        } catch (err) {
            setMsg({ ok: false, text: 'Erro ao gerar declaração.' });
        }
    };

    if (!projetoAtual || !loteAtual) {
        return (
            <div className="panel">
                <div className="panel-header"><h3>📄 Peças Técnicas</h3></div>
                <div className="panel-warning">
                    <AlertCircle size={14} /> Selecione um projeto e um lote.
                </div>
            </div>
        );
    }

    return (
        <div className="panel">
            <div className="panel-header">
                <h3>📄 Peças Técnicas SEAPA</h3>
                <button className="panel-btn panel-btn--sm" onClick={() => setShowConfig(!showConfig)}>
                    ⚙️
                </button>
            </div>

            {/* Configuração do RT */}
            {showConfig && (
                <div className="panel-form">
                    <div className="panel-label">Responsável Técnico</div>
                    <input className="panel-input" placeholder="#RESPONSAVEL_TECNICO — Nome"
                        value={rt.nome} onChange={(e) => setRt({ ...rt, nome: e.target.value })} />
                    <input className="panel-input" placeholder="#RT_CPF — CPF"
                        value={rt.cpf} onChange={(e) => setRt({ ...rt, cpf: e.target.value })} />
                    <input className="panel-input" placeholder="#QUALIFICACAO_PROFISSIONAL"
                        value={rt.qualificacao} onChange={(e) => setRt({ ...rt, qualificacao: e.target.value })} />
                    <div style={{ display: 'flex', gap: 6 }}>
                        <input className="panel-input" placeholder="#TIPO_CONSELHO" style={{ flex: 1 }}
                            value={rt.conselho_tipo} onChange={(e) => setRt({ ...rt, conselho_tipo: e.target.value })} />
                        <input className="panel-input" placeholder="#CREA / #CFT" style={{ flex: 1 }}
                            value={rt.conselho_num} onChange={(e) => setRt({ ...rt, conselho_num: e.target.value })} />
                    </div>
                    <input className="panel-input" placeholder="#COD_INCRA — Credenciamento"
                        value={rt.credenciamento_incra} onChange={(e) => setRt({ ...rt, credenciamento_incra: e.target.value })} />
                    <input className="panel-input" placeholder="#ART — Número (opcional)"
                        value={rt.art_num} onChange={(e) => setRt({ ...rt, art_num: e.target.value })} />
                    <button className="panel-btn panel-btn--primary panel-btn--full"
                        onClick={() => setShowConfig(false)}>
                        <CheckCircle size={14} /> Salvar
                    </button>
                </div>
            )}

            {/* Status */}
            {msg && (
                <div className={msg.ok ? 'panel-success' : 'panel-error'}>
                    {msg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />} {msg.text}
                </div>
            )}

            {/* Info do contexto */}
            <div className="panel-info" style={{ fontSize: '.75rem' }}>
                <strong>Projeto:</strong> {projetoAtual.nome} &nbsp;|&nbsp;
                <strong>Lote:</strong> #{loteAtual.id} — {loteAtual.nome_cliente}
            </div>

            {/* Botões de geração */}
            <div className="panel-section">
                <h4><ClipboardList size={14} /> Documentos Obrigatórios</h4>
                <div className="panel-list">

                    <button className="panel-card" onClick={() => handleGerar('requerimento_os')}>
                        <div className="panel-card-header">
                            <span className="panel-card-title">
                                <FileText size={14} /> 02 — Requerimento de O.S.
                            </span>
                            <Printer size={12} />
                        </div>
                        <div className="panel-card-desc">Solicitar ordem de serviço topográfico</div>
                    </button>

                    <button className="panel-card" onClick={() => handleGerar('ordem_servico')}>
                        <div className="panel-card-header">
                            <span className="panel-card-title">
                                <ClipboardList size={14} /> 13 — Ordem de Serviço
                            </span>
                            <Printer size={12} />
                        </div>
                        <div className="panel-card-desc">Designação do profissional e serviço</div>
                    </button>

                    <button className="panel-card" onClick={() => handleGerar('memorial')}>
                        <div className="panel-card-header">
                            <span className="panel-card-title">
                                <MapPin size={14} /> Memorial Descritivo
                            </span>
                            <Printer size={12} />
                        </div>
                        <div className="panel-card-desc">
                            Coordenadas, azimutes, distâncias — SIRGAS 2000
                            {!loteAtual.geom && <span style={{ color: 'var(--warning)', marginLeft: 4 }}>(sem geometria)</span>}
                        </div>
                    </button>

                    <button className="panel-card" onClick={() => handleGerar('planta')}>
                        <div className="panel-card-header">
                            <span className="panel-card-title">
                                <Map size={14} /> Planta Topográfica
                            </span>
                            <Printer size={12} />
                        </div>
                        <div className="panel-card-desc">
                            Mapa da área do projeto com quadro de coordenadas
                        </div>
                    </button>

                </div>
            </div>

            {/* Declarações de Limites — uma por confrontante */}
            <div className="panel-section">
                <h4><Users size={14} /> 03 — Declarações de Limites</h4>
                {confrontantes.length === 0 ? (
                    <div className="panel-info">
                        Nenhum confrontante salvo. Identifique vizinhos primeiro no painel "Vizinhos".
                    </div>
                ) : (
                    <div className="panel-list">
                        {confrontantes.map((c, i) => (
                            <button key={i} className="panel-card" onClick={() => handleGerarDeclaracao(c)}>
                                <div className="panel-card-header">
                                    <span className="panel-card-title">
                                        {c.direcao ? `${c.direcao} — ` : ''}{c.nome}
                                    </span>
                                    <Printer size={12} />
                                </div>
                                <div className="panel-card-desc">CPF: {c.cpf}</div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="panel-muted" style={{ marginTop: 8 }}>
                💡 Documentos abrem em nova aba prontos para impressão (Ctrl+P).
            </div>
        </div>
    );
}
