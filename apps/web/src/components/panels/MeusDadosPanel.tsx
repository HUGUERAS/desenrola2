/**
 * MeusDadosPanel — Formulário completo do cliente para documentos SEAPA
 *
 * Seções:
 *   1. Dados Pessoais (#PROPRIETARIO, #PROP_CPF, #PROP_RG, etc.)
 *   2. Dados do Imóvel (#IMOVEL, #MATRICULA, município, gleba)
 *   3. Dados do Cônjuge (quando casado)
 *
 * Esses dados alimentam diretamente os 5 documentos obrigatórios.
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useApp } from '../../pages/AppShell';
import { Save, Loader2, AlertCircle, ChevronDown, ChevronRight, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCPF, formatPhone, formatCEP } from '../../lib/format-utils';

interface DadosCadastro {
    // Pessoais
    nome: string;
    cpf: string;
    rg: string;
    orgao_exp: string;
    email: string;
    telefone: string;
    profissao: string;
    estado_civil: string;
    nacionalidade: string;
    data_nascimento: string;
    // Endereço
    endereco: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    // Imóvel
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
    conjuge_profissao: string;
    conjuge_nacionalidade: string;
}

const EMPTY: DadosCadastro = {
    nome: '', cpf: '', rg: '', orgao_exp: '', email: '', telefone: '',
    profissao: '', estado_civil: '', nacionalidade: 'Brasileiro(a)', data_nascimento: '',
    endereco: '', numero: '', bairro: '', cidade: '', uf: '', cep: '',
    nome_imovel: '', matricula: '', gleba: '', municipio_imovel: '', uf_imovel: '', area_imovel: '',
    conjuge_nome: '', conjuge_cpf: '', conjuge_rg: '', conjuge_profissao: '', conjuge_nacionalidade: '',
};

type SectionKey = 'pessoal' | 'endereco' | 'imovel' | 'conjuge';

export default function MeusDadosPanel() {
    const { loteAtual, projetoAtual } = useApp();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [data, setData] = useState<DadosCadastro>(EMPTY);
    const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
        pessoal: true, endereco: false, imovel: false, conjuge: false,
    });

    const toggle = (s: SectionKey) =>
        setOpenSections((prev) => ({ ...prev, [s]: !prev[s] }));

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const m = user.user_metadata || {};
                    setData({
                        nome: m.display_name || m.nome || '',
                        cpf: formatCPF(m.cpf || ''),
                        rg: m.rg || '',
                        orgao_exp: m.orgao_exp || '',
                        email: user.email || '',
                        telefone: formatPhone(m.phone || m.telefone || ''),
                        profissao: m.profissao || '',
                        estado_civil: m.estado_civil || '',
                        nacionalidade: m.nacionalidade || 'Brasileiro(a)',
                        data_nascimento: m.data_nascimento || '',
                        endereco: m.endereco || '',
                        numero: m.numero || '',
                        bairro: m.bairro || '',
                        cidade: m.cidade || '',
                        uf: m.uf || '',
                        cep: formatCEP(m.cep || ''),
                        nome_imovel: m.nome_imovel || projetoAtual?.nome || '',
                        matricula: m.matricula || '',
                        gleba: m.gleba || '',
                        municipio_imovel: m.municipio_imovel || '',
                        uf_imovel: m.uf_imovel || '',
                        area_imovel: m.area_imovel || '',
                        conjuge_nome: m.conjuge_nome || '',
                        conjuge_cpf: formatCPF(m.conjuge_cpf || ''),
                        conjuge_rg: m.conjuge_rg || '',
                        conjuge_profissao: m.conjuge_profissao || '',
                        conjuge_nacionalidade: m.conjuge_nacionalidade || '',
                    });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [projetoAtual]);

    const salvar = async () => {
        setSaving(true);
        setSaved(false);
        try {
            const { email, ...metadata } = data;
            await supabase.auth.updateUser({
                data: { display_name: data.nome, ...metadata },
            });
            setSaved(true);
            toast.success('Dados salvos');
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const set = (key: keyof DadosCadastro, val: string) =>
        setData((prev) => ({ ...prev, [key]: val }));

    const completude = () => {
        const obrigatorios: (keyof DadosCadastro)[] = [
            'nome', 'cpf', 'rg', 'telefone', 'estado_civil',
            'endereco', 'cidade', 'uf',
            'nome_imovel', 'matricula', 'municipio_imovel', 'uf_imovel',
        ];
        const preenchidos = obrigatorios.filter((k) => data[k].trim() !== '').length;
        return Math.round((preenchidos / obrigatorios.length) * 100);
    };

    if (loading) return <div className="panel-loading"><Loader2 size={20} className="spin" /> Carregando...</div>;

    const pct = completude();
    const isCasado = data.estado_civil.toLowerCase().includes('casado');

    return (
        <div className="panel">
            <div className="panel-header">
                <h3>👤 Meus Dados</h3>
            </div>

            {/* Barra de completude */}
            <div className="panel-info" style={{ fontSize: '.75rem', padding: '6px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span><AlertCircle size={12} /> Dados para documentos SEAPA</span>
                    <span style={{ fontWeight: 600, color: pct === 100 ? 'var(--success)' : 'var(--text-muted)' }}>
                        {pct}% completo
                    </span>
                </div>
                <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2 }}>
                    <div style={{
                        height: '100%', borderRadius: 2, transition: 'width 0.3s',
                        width: `${pct}%`,
                        background: pct === 100 ? 'var(--success)' : 'var(--primary)',
                    }} />
                </div>
            </div>

            {/* === SEÇÃO 1: Dados Pessoais === */}
            <button className="panel-section-toggle" onClick={() => toggle('pessoal')}>
                {openSections.pessoal ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <strong>Dados Pessoais</strong>
            </button>
            {openSections.pessoal && (
                <div className="panel-form">
                    <label className="panel-label">Nome Completo *</label>
                    <input className="panel-input" placeholder="#PROPRIETARIO"
                        value={data.nome} onChange={(e) => set('nome', e.target.value)} />

                    <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ flex: 1 }}>
                            <label className="panel-label">CPF *</label>
                            <input className="panel-input" placeholder="#PROP_CPF"
                                value={data.cpf} onChange={(e) => set('cpf', formatCPF(e.target.value))} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="panel-label">RG *</label>
                            <input className="panel-input" placeholder="#PROP_RG"
                                value={data.rg} onChange={(e) => set('rg', e.target.value)} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ flex: 1 }}>
                            <label className="panel-label">Órgão Exp.</label>
                            <input className="panel-input" placeholder="SSP/GO"
                                value={data.orgao_exp} onChange={(e) => set('orgao_exp', e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="panel-label">Nascimento</label>
                            <input className="panel-input" type="date"
                                value={data.data_nascimento} onChange={(e) => set('data_nascimento', e.target.value)} />
                        </div>
                    </div>

                    <label className="panel-label">Email</label>
                    <input className="panel-input" type="email" disabled value={data.email} />

                    <label className="panel-label">Telefone *</label>
                    <input className="panel-input" type="tel" placeholder="(62) 99999-0000"
                        value={data.telefone} onChange={(e) => set('telefone', formatPhone(e.target.value))} />

                    <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ flex: 1 }}>
                            <label className="panel-label">Profissão</label>
                            <input className="panel-input" placeholder="Agricultor"
                                value={data.profissao} onChange={(e) => set('profissao', e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="panel-label">Nacionalidade</label>
                            <input className="panel-input"
                                value={data.nacionalidade} onChange={(e) => set('nacionalidade', e.target.value)} />
                        </div>
                    </div>

                    <label className="panel-label">Estado Civil *</label>
                    <select className="panel-input" value={data.estado_civil}
                        onChange={(e) => set('estado_civil', e.target.value)}>
                        <option value="">Selecione...</option>
                        <option value="Solteiro(a)">Solteiro(a)</option>
                        <option value="Casado(a)">Casado(a)</option>
                        <option value="Viúvo(a)">Viúvo(a)</option>
                        <option value="Divorciado(a)">Divorciado(a)</option>
                        <option value="Outros">Outros</option>
                    </select>
                </div>
            )}

            {/* === SEÇÃO 2: Endereço === */}
            <button className="panel-section-toggle" onClick={() => toggle('endereco')}>
                {openSections.endereco ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <strong>Endereço</strong>
            </button>
            {openSections.endereco && (
                <div className="panel-form">
                    <label className="panel-label">Endereço *</label>
                    <input className="panel-input" placeholder="Rua / Fazenda"
                        value={data.endereco} onChange={(e) => set('endereco', e.target.value)} />

                    <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ flex: 1 }}>
                            <label className="panel-label">Nº</label>
                            <input className="panel-input" placeholder="S/N"
                                value={data.numero} onChange={(e) => set('numero', e.target.value)} />
                        </div>
                        <div style={{ flex: 2 }}>
                            <label className="panel-label">Bairro / Setor</label>
                            <input className="panel-input"
                                value={data.bairro} onChange={(e) => set('bairro', e.target.value)} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ flex: 2 }}>
                            <label className="panel-label">Cidade *</label>
                            <input className="panel-input"
                                value={data.cidade} onChange={(e) => set('cidade', e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="panel-label">UF *</label>
                            <input className="panel-input" placeholder="GO" maxLength={2}
                                value={data.uf} onChange={(e) => set('uf', e.target.value.toUpperCase())} />
                        </div>
                    </div>

                    <label className="panel-label">CEP</label>
                    <input className="panel-input" placeholder="00000-000"
                        value={data.cep} onChange={(e) => set('cep', formatCEP(e.target.value))} />
                </div>
            )}

            {/* === SEÇÃO 3: Dados do Imóvel === */}
            <button className="panel-section-toggle" onClick={() => toggle('imovel')}>
                {openSections.imovel ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <strong>Dados do Imóvel</strong>
            </button>
            {openSections.imovel && (
                <div className="panel-form">
                    <label className="panel-label">Nome do Imóvel *</label>
                    <input className="panel-input" placeholder="#IMOVEL — Fazenda, Chácara, Sítio..."
                        value={data.nome_imovel} onChange={(e) => set('nome_imovel', e.target.value)} />

                    <label className="panel-label">Matrícula *</label>
                    <input className="panel-input" placeholder="#MATRICULA — Nº do Cartório"
                        value={data.matricula} onChange={(e) => set('matricula', e.target.value)} />

                    <label className="panel-label">Gleba / Loteamento</label>
                    <input className="panel-input" placeholder="(quando houver)"
                        value={data.gleba} onChange={(e) => set('gleba', e.target.value)} />

                    <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ flex: 2 }}>
                            <label className="panel-label">Município do Imóvel *</label>
                            <input className="panel-input"
                                value={data.municipio_imovel} onChange={(e) => set('municipio_imovel', e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="panel-label">UF *</label>
                            <input className="panel-input" placeholder="GO" maxLength={2}
                                value={data.uf_imovel} onChange={(e) => set('uf_imovel', e.target.value.toUpperCase())} />
                        </div>
                    </div>

                    <label className="panel-label">Área (ha)</label>
                    <input className="panel-input" placeholder="Calculada automaticamente da geometria"
                        value={data.area_imovel} onChange={(e) => set('area_imovel', e.target.value)} />
                </div>
            )}

            {/* === SEÇÃO 4: Cônjuge (só se casado) === */}
            {isCasado && (
                <>
                    <button className="panel-section-toggle" onClick={() => toggle('conjuge')}>
                        {openSections.conjuge ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <strong>Dados do Cônjuge</strong>
                    </button>
                    {openSections.conjuge && (
                        <div className="panel-form">
                            <label className="panel-label">Nome do Cônjuge</label>
                            <input className="panel-input"
                                value={data.conjuge_nome} onChange={(e) => set('conjuge_nome', e.target.value)} />

                            <div style={{ display: 'flex', gap: 6 }}>
                                <div style={{ flex: 1 }}>
                                    <label className="panel-label">CPF</label>
                                    <input className="panel-input" placeholder="000.000.000-00"
                                        value={data.conjuge_cpf} onChange={(e) => set('conjuge_cpf', formatCPF(e.target.value))} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="panel-label">RG</label>
                                    <input className="panel-input"
                                        value={data.conjuge_rg} onChange={(e) => set('conjuge_rg', e.target.value)} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 6 }}>
                                <div style={{ flex: 1 }}>
                                    <label className="panel-label">Profissão</label>
                                    <input className="panel-input"
                                        value={data.conjuge_profissao} onChange={(e) => set('conjuge_profissao', e.target.value)} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="panel-label">Nacionalidade</label>
                                    <input className="panel-input"
                                        value={data.conjuge_nacionalidade} onChange={(e) => set('conjuge_nacionalidade', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Botão salvar */}
            <div style={{ padding: '8px 10px' }}>
                <button
                    className="panel-btn panel-btn--primary panel-btn--full"
                    onClick={salvar}
                    disabled={saving}
                >
                    {saved
                        ? <><CheckCircle size={14} /> Salvo!</>
                        : saving
                            ? <><Loader2 size={14} className="spin" /> Salvando...</>
                            : <><Save size={14} /> Salvar Dados</>}
                </button>
            </div>
        </div>
    );
}
