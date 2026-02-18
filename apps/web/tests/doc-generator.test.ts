
import { DocumentGenerators, DadosDocumento } from '../src/lib/doc-generator';

const mockDados: DadosDocumento = {
    proprietario: {
        nome: 'João Silva',
        cpf: '123.456.789-00',
        rg: 'RG-12345',
        profissao: 'Agricultor',
        estado_civil: 'Casado',
        nacionalidade: 'Brasileiro',
        endereco: 'Fazenda Boa Esperança',
        municipio: 'Goiânia',
        estado: 'GO'
    },
    imovel: {
        nome: 'Sítio do João',
        municipio: 'Anápolis',
        estado: 'GO',
        matricula: 'MAT-99999',
        gleba: 'Gleba A',
        area_matricula: '12.3456 ha'
    },
    responsavel_tecnico: {
        nome: 'Eng. Teste',
        cpf: '000.000.000-00',
        qualificacao: 'Engenheiro Agrimensor',
        conselho_tipo: 'CREA',
        conselho_num: '1234/D',
        credenciamento_incra: 'CODE-123'
    },
    data_documento: '2023-10-01'
};

console.log('--- TESTANDO GERAÇÃO DE DOCUMENTOS ---');

// Teste 1: Requerimento
try {
    const req = DocumentGenerators.requerimentoOS(mockDados);
    // Verificações
    const checks = [
        { text: 'Brasileiro', msg: 'Nacionalidade' },
        { text: 'Casado', msg: 'Estado Civil' },
        { text: 'Agricultor', msg: 'Profissão' },
        { text: 'Matrícula MAT-99999', msg: 'Matrícula' },
        { text: 'Gleba Gleba A', msg: 'Gleba' }
    ];

    let pass = true;
    for (const check of checks) {
        if (!req.includes(check.text)) {
            console.error(`❌ Requerimento OS: Falha ao encontrar '${check.text}' (${check.msg})`);
            pass = false;
        }
    }
    if (pass) console.log('✅ Requerimento OS: PASS');
} catch (e) {
    console.error('❌ Erro no Requerimento:', e);
}

// Teste 2: Memorial
try {
    const mem = DocumentGenerators.memorialDescritivo(mockDados);
    if (mem.includes('Gleba Gleba A') && mem.includes('MAT-99999')) {
        console.log('✅ Memorial Descritivo: PASS');
    } else {
        console.error('❌ Memorial Descritivo: FAIL (Faltando Gleba ou Matrícula)');
    }
} catch (e) {
    console.error('❌ Erro no Memorial:', e);
}

// Teste 3: Declaração
try {
    const decl = DocumentGenerators.declaracaoLimites(mockDados, {
        nome: 'Vizinho Teste',
        cpf: '111.111.111-11',
        imovel: 'Fazenda Vizinha',
        matricula: '88888',
        direcao: 'Norte'
    });

    // Check qualificação do proprietário na declaração
    if (decl.includes('Brasileiro, Casado, Agricultor') && decl.includes('Gleba Gleba A')) {
        console.log('✅ Declaração de Limites: PASS');
    } else {
        console.error('❌ Declaração de Limites: FAIL (Qualificação incorreta ou Gleba ausente)');
    }
} catch (e) {
    console.error('❌ Erro na Declaração:', e);
}
