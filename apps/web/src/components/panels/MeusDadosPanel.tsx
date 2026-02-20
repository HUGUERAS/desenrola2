/**
 * MeusDadosPanel — Formulário completo do cliente e dados profissionais do topógrafo
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useApp } from '../../pages/AppShell';
import apiClient from '../../services/api';
import { Save, Loader2, AlertCircle, ChevronDown, ChevronRight, CheckCircle, Briefcase, UserCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCPF, formatPhone, formatCEP } from '../../lib/format-utils';
import { Button, Card, Input, Select, Badge } from '../ui/Components';

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
    // Profissional
    crea: string;
    empresa: string;
}

const EMPTY: DadosCadastro = {
    nome: '', cpf: '', rg: '', orgao_exp: '', email: '', telefone: '',
    profissao: '', estado_civil: '', nacionalidade: 'Brasileiro(a)', data_nascimento: '',
    endereco: '', numero: '', bairro: '', cidade: '', uf: '', cep: '',
    nome_imovel: '', matricula: '', gleba: '', municipio_imovel: '', uf_imovel: '', area_imovel: '',
    conjuge_nome: '', conjuge_cpf: '', conjuge_rg: '', conjuge_profissao: '', conjuge_nacionalidade: '',
    crea: '', empresa: '',
};

type SectionKey = 'pessoal' | 'endereco' | 'imovel' | 'conjuge' | 'profissional' | 'conta';

export default function MeusDadosPanel() {
    const { role, setPanel, refreshUser } = useApp();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [data, setData] = useState<DadosCadastro>(EMPTY);
    const [currentRole, setCurrentRole] = useState(role);
    const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
        pessoal: true, endereco: false, imovel: false, conjuge: false, profissional: false, conta: true
    });

    const toggle = (s: SectionKey) =>
        setOpenSections((prev) => ({ ...prev, [s]: !prev[s] }));

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await apiClient.getPerfilMe();
                const perfil = res.data;
                const { data: { user } } = await supabase.auth.getUser();

                if (user && perfil) {
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
                        nome_imovel: m.nome_imovel || '',
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
                        crea: perfil.crea || '',
                        empresa: perfil.empresa || '',
                    });
                    setCurrentRole(perfil.role as any);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const salvar = async () => {
        setSaving(true);
        setSaved(false);
        try {
            // 1. Atualiza Perfil no DB (Role + Profissional)
            await apiClient.setPerfilRole(currentRole as any, {
                crea: data.crea,
                empresa: data.empresa
            });

            // 2. Atualiza Metadata no Auth
            const { email, crea, empresa, ...metadata } = data;
            await supabase.auth.updateUser({
                data: { display_name: data.nome, ...metadata },
            });

            setSaved(true);
            toast.success('Perfil atualizado com sucesso');

            // Re-inicializa o contexto para aplicar mudanças de role sem recarregar a página
            if (currentRole !== role) {
                setTimeout(() => refreshUser(), 1500);
            }
        } catch (err) {
            console.error(err);
            toast.error('Erro ao atualizar dados');
        } finally {
            setSaving(false);
        }
    };

    const set = (key: keyof DadosCadastro, val: string) =>
        setData((prev) => ({ ...prev, [key]: val }));

    const completude = () => {
        const obrigatorios: (keyof DadosCadastro)[] = [
            'nome', 'cpf', 'rg', 'telefone'
        ];
        if (currentRole === 'topografo') {
            obrigatorios.push('crea', 'empresa');
        }
        const preenchidos = obrigatorios.filter((k) => data[k] && data[k].trim() !== '').length;
        return Math.round((preenchidos / obrigatorios.length) * 100);
    };

    if (loading) return <div className="panel-loading"><Loader2 size={20} className="spin" /> Carregando perfil...</div>;

    const pct = completude();
    const isCasado = data.estado_civil.toLowerCase().includes('casado');

    return (
        <div className="panel">
            <div className="panel-header mb-4">
                <div className="flex flex-col">
                    <h3 className="flex items-center gap-2"><UserCircle size={18} className="text-primary" /> Meus Dados</h3>
                    <span className="text-[10px] text-titanium-400 font-bold uppercase tracking-widest mt-0.5">Gestão de Perfil</span>
                </div>
            </div>

            {/* Barra de completude */}
            <Card className="mb-6 bg-primary/5 border-primary/10">
                <div className="p-3">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-primary flex items-center gap-1">
                            <AlertCircle size={12} /> STATUS DO CADASTRO
                        </span>
                        <Badge variant={pct === 100 ? 'success' : 'warning'} size="sm">
                            {pct}% Completo
                        </Badge>
                    </div>
                    <div className="h-1.5 bg-titanium-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            </Card>

            {/* === TIPO DE CONTA === */}
            <button className="panel-section-toggle" onClick={() => toggle('conta')}>
                {openSections.conta ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <strong>Tipo de Conta</strong>
            </button>
            {openSections.conta && (
                <div className="panel-form">
                    <Select
                        label="Eu sou um..."
                        value={currentRole}
                        onChange={(e) => setCurrentRole(e.target.value as any)}
                        options={[
                            { value: 'proprietario', label: 'Proprietário de Lote (Cliente)' },
                            { value: 'topografo', label: 'Topógrafo / Profissional (Gestor)' }
                        ]}
                    />
                    {currentRole !== role && (
                        <div className="text-[10px] bg-warning/10 text-warning p-2 rounded border border-warning/20 mb-4">
                            ⚠️ A alteração de tipo de conta reiniciará a aplicação para carregar as novas ferramentas.
                        </div>
                    )}
                </div>
            )}

            {/* === DADOS PROFISSIONAIS (Se Topográfico) === */}
            {currentRole === 'topografo' && (
                <>
                    <button className="panel-section-toggle" onClick={() => toggle('profissional')}>
                        {openSections.profissional ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <strong>Dados Profissionais</strong>
                    </button>
                    {openSections.profissional && (
                        <div className="panel-form">
                            <Input
                                label="Número CREA / CFT *"
                                placeholder="Ex: 12345/D-GO"
                                value={data.crea}
                                onChange={e => set('crea', e.target.value)}
                                icon="file"
                            />
                            <Input
                                label="Empresa / Escritório *"
                                placeholder="Nome da sua empresa..."
                                value={data.empresa}
                                onChange={e => set('empresa', e.target.value)}
                                icon="spark"
                            />
                        </div>
                    )}
                </>
            )}

            {/* === SEÇÃO 1: Dados Pessoais === */}
            <button className="panel-section-toggle" onClick={() => toggle('pessoal')}>
                {openSections.pessoal ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <strong>Dados Pessoais</strong>
            </button>
            {openSections.pessoal && (
                <div className="panel-form">
                    <Input
                        label="Nome Completo *"
                        value={data.nome}
                        onChange={(e) => set('nome', e.target.value)}
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="CPF *"
                            value={data.cpf}
                            onChange={(e) => set('cpf', formatCPF(e.target.value))}
                        />
                        <Input
                            label="RG *"
                            value={data.rg}
                            onChange={(e) => set('rg', e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Órgão Exp."
                            placeholder="SSP/GO"
                            value={data.orgao_exp}
                            onChange={(e) => set('orgao_exp', e.target.value)}
                        />
                        <Input
                            label="Nascimento"
                            type="date"
                            value={data.data_nascimento}
                            onChange={(e) => set('data_nascimento', e.target.value)}
                        />
                    </div>

                    <Input
                        label="Email"
                        type="email"
                        disabled
                        value={data.email}
                    />

                    <Input
                        label="Telefone *"
                        type="tel"
                        placeholder="(62) 99999-0000"
                        value={data.telefone}
                        onChange={(e) => set('telefone', formatPhone(e.target.value))}
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Profissão"
                            value={data.profissao}
                            onChange={(e) => set('profissao', e.target.value)}
                        />
                        <Input
                            label="Nacionalidade"
                            value={data.nacionalidade}
                            onChange={(e) => set('nacionalidade', e.target.value)}
                        />
                    </div>

                    <Select
                        label="Estado Civil *"
                        value={data.estado_civil}
                        onChange={(e) => set('estado_civil', e.target.value)}
                        options={[
                            { value: 'Solteiro(a)', label: 'Solteiro(a)' },
                            { value: 'Casado(a)', label: 'Casado(a)' },
                            { value: 'Viúvo(a)', label: 'Viúvo(a)' },
                            { value: 'Divorciado(a)', label: 'Divorciado(a)' },
                            { value: 'Outros', label: 'Outros' }
                        ]}
                    />
                </div>
            )}

            {/* === SEÇÃO 2: Endereço === */}
            <button className="panel-section-toggle" onClick={() => toggle('endereco')}>
                {openSections.endereco ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <strong>Endereço de Correspondência</strong>
            </button>
            {openSections.endereco && (
                <div className="panel-form">
                    <Input
                        label="Endereço / Logradouro *"
                        value={data.endereco}
                        onChange={(e) => set('endereco', e.target.value)}
                    />

                    <div className="grid grid-cols-3 gap-3">
                        <Input
                            label="Nº"
                            value={data.numero}
                            onChange={(e) => set('numero', e.target.value)}
                        />
                        <div className="col-span-2">
                            <Input
                                label="Bairro / Setor"
                                value={data.bairro}
                                onChange={(e) => set('bairro', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <Input
                                label="Cidade *"
                                value={data.cidade}
                                onChange={(e) => set('cidade', e.target.value)}
                            />
                        </div>
                        <Input
                            label="UF *"
                            placeholder="GO"
                            maxLength={2}
                            value={data.uf}
                            onChange={(e) => set('uf', e.target.value.toUpperCase())}
                        />
                    </div>

                    <Input
                        label="CEP"
                        value={data.cep}
                        onChange={(e) => set('cep', formatCEP(e.target.value))}
                    />
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
                            <Input
                                label="Nome do Cônjuge"
                                value={data.conjuge_nome}
                                onChange={(e) => set('conjuge_nome', e.target.value)}
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="CPF"
                                    value={data.conjuge_cpf}
                                    onChange={(e) => set('conjuge_cpf', formatCPF(e.target.value))}
                                />
                                <Input
                                    label="RG"
                                    value={data.conjuge_rg}
                                    onChange={(e) => set('conjuge_rg', e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="Profissão"
                                    value={data.conjuge_profissao}
                                    onChange={(e) => set('conjuge_profissao', e.target.value)}
                                />
                                <Input
                                    label="Nacionalidade"
                                    value={data.conjuge_nacionalidade}
                                    onChange={(e) => set('conjuge_nacionalidade', e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Botão salvar */}
            <div className="p-4 pt-0">
                <Button
                    variant="primary"
                    className="w-full py-4 shadow-lg shadow-primary/20"
                    onClick={salvar}
                    disabled={saving}
                    icon={saved ? undefined : (saving ? undefined : 'save')}
                >
                    {saved ? '✓ Perfil Atualizado' : (saving ? 'Salvando...' : 'Salvar Alterações')}
                </Button>
            </div>
        </div>
    );
}

