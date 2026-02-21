/**
 * ClienteDadosPanel — Visualização dos dados enviados pelo cliente via magic link
 * Usado pelo topógrafo para revisar o que o cliente preencheu.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { useApp } from '../../pages/AppShell';
import { User, Copy, ExternalLink, MapPin, Hash, Phone, Mail, FileText, CheckCircle } from 'lucide-react';

export default function ClienteDadosPanel() {
    const { loteAtual, setPanel } = useApp();
    const [copied, setCopied] = useState(false);

    if (!loteAtual) {
        return (
            <div className="panel">
                <div className="panel-empty">
                    <User size={24} />
                    <p>Selecione um lote para ver os dados do cliente</p>
                    <button className="panel-btn panel-btn--primary" onClick={() => setPanel('lotes')}>
                        Ver Lotes
                    </button>
                </div>
            </div>
        );
    }

    const copiarLink = () => {
        if (!loteAtual.token_acesso) return;
        const url = `${window.location.origin}/acesso/${loteAtual.token_acesso}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success('Link copiado!');
        setTimeout(() => setCopied(false), 2000);
    };

    const abrirLink = () => {
        if (!loteAtual.token_acesso) return;
        window.open(`${window.location.origin}/acesso/${loteAtual.token_acesso}`, '_blank');
    };

    const temDadosCliente = !!(loteAtual.cpf_cnpj_cliente || loteAtual.telefone_cliente || loteAtual.rg_cliente);
    const temDadosImovel = !!(loteAtual.denominacao_imovel || loteAtual.municipio || loteAtual.matricula_imovel);

    const Row = ({ label, value }: { label: string; value?: string }) => {
        if (!value) return null;
        return (
            <div style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 14, color: 'var(--color-text-default)', textAlign: 'right' }}>{value}</span>
            </div>
        );
    };

    return (
        <div className="panel">
            <div className="panel-header">
                <div>
                    <button className="panel-link" onClick={() => setPanel('lotes')}>← Lotes</button>
                    <h3>👤 Dados do Cliente</h3>
                </div>
            </div>

            {/* Status badge */}
            <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: loteAtual.status === 'VALIDACAO' ? '#dcfce7' : loteAtual.status === 'PENDENTE' ? '#fef9c3' : '#e0e7ff',
                    color: loteAtual.status === 'VALIDACAO' ? '#16a34a' : loteAtual.status === 'PENDENTE' ? '#a16207' : '#4338ca',
                }}>
                    {loteAtual.status || 'PENDENTE'}
                </span>
                {temDadosCliente && (
                    <span style={{ fontSize: 11, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={12} /> Dados recebidos
                    </span>
                )}
            </div>

            {/* Magic Link */}
            {loteAtual.token_acesso && (
                <div style={{ background: '#f0f9ff', border: '1.5px dashed #93c5fd', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
                        Magic Link do Cliente
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="panel-btn panel-btn--primary" style={{ flex: 1, fontSize: 12, padding: '7px 0' }} onClick={copiarLink}>
                            <Copy size={12} /> {copied ? 'Copiado!' : 'Copiar link'}
                        </button>
                        <button className="panel-btn" style={{ fontSize: 12, padding: '7px 10px' }} onClick={abrirLink} title="Abrir link">
                            <ExternalLink size={12} />
                        </button>
                    </div>
                </div>
            )}

            {/* Dados Pessoais */}
            <div style={{ background: '#fff', borderRadius: 10, padding: '4px 12px 4px', marginBottom: 12, border: '1px solid var(--color-border)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '10px 0 6px' }}>
                    <User size={10} style={{ display: 'inline', marginRight: 4 }} />Dados pessoais
                </p>
                <Row label="Nome" value={loteAtual.nome_cliente} />
                <Row label="CPF / CNPJ" value={loteAtual.cpf_cnpj_cliente} />
                <Row label="RG" value={loteAtual.rg_cliente} />
                <Row label="Estado Civil" value={loteAtual.estado_civil_cliente} />
                <Row label="E-mail" value={loteAtual.email_cliente} />
                <Row label="Telefone" value={loteAtual.telefone_cliente} />
                {!temDadosCliente && !loteAtual.nome_cliente && (
                    <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: '8px 0' }}>Aguardando preenchimento pelo cliente.</p>
                )}
            </div>

            {/* Dados do Imóvel */}
            <div style={{ background: '#fff', borderRadius: 10, padding: '4px 12px 4px', marginBottom: 12, border: '1px solid var(--color-border)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '10px 0 6px' }}>
                    <MapPin size={10} style={{ display: 'inline', marginRight: 4 }} />Dados do imóvel
                </p>
                <Row label="Denominação" value={loteAtual.denominacao_imovel} />
                <Row label="Município / UF" value={loteAtual.municipio ? `${loteAtual.municipio}${loteAtual.uf ? ' / ' + loteAtual.uf : ''}` : undefined} />
                <Row label="Comarca" value={loteAtual.comarca} />
                <Row label="Matrícula" value={loteAtual.matricula_imovel} />
                <Row label="Código SIGEF" value={loteAtual.codigo_sigef} />
                {!temDadosImovel && (
                    <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: '8px 0' }}>Aguardando preenchimento pelo cliente.</p>
                )}
            </div>
        </div>
    );
}