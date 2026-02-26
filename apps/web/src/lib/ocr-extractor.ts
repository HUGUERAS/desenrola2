/**
 * ocr-extractor.ts — OCR + regex para documentos brasileiros
 * Usa Tesseract.js (lazy-loaded) para extrair texto de fotos
 * e regex para encontrar CPF, nome, RG, matrícula, etc.
 */

export interface ExtractedFields {
    nome_cliente?: string;
    cpf_cnpj_cliente?: string;
    rg_cliente?: string;
    municipio?: string;
    uf?: string;
    matricula_imovel?: string;
    denominacao_imovel?: string;
    estado_civil_cliente?: string;
}

const UFS = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
    'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
    'SP', 'SE', 'TO',
];

/**
 * Extrai texto de uma imagem usando Tesseract.js (lazy-loaded)
 */
export async function extractTextFromImage(
    file: File,
    onProgress?: (pct: number) => void,
): Promise<string> {
    const Tesseract = await import('tesseract.js');
    const createWorker = Tesseract.createWorker;
    const worker = await createWorker('por', 1, {
        logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text' && onProgress) {
                onProgress(Math.round(m.progress * 100));
            }
        },
    });
    const { data: { text } } = await worker.recognize(file);
    await worker.terminate();
    return text;
}

/**
 * Extrai texto de um PDF (lazy-loaded pdfjs-dist).
 * Estratégia dupla: tenta text layer primeiro (PDF digital);
 * se texto insuficiente, renderiza página em canvas e usa Tesseract OCR.
 */
export async function extractTextFromPDF(
    file: File,
    onProgress?: (pct: number) => void,
): Promise<string> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
    ).toString();

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let allText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);

        // Tentar text layer (PDF digital — rápido)
        const content = await page.getTextContent();
        const pageText = content.items
            .map(item => ('str' in item ? item.str : ''))
            .join(' ');

        if (pageText.replace(/\s/g, '').length > 20) {
            allText += pageText + '\n';
            onProgress?.(Math.round((i / pdf.numPages) * 100));
        } else {
            // PDF escaneado → renderiza canvas → Tesseract OCR
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvas, viewport }).promise;

            const blob = await new Promise<Blob>(resolve =>
                canvas.toBlob(b => resolve(b!), 'image/png'),
            );
            const imgFile = new File([blob], 'page.png', { type: 'image/png' });
            const baseProgress = Math.round(((i - 1) / pdf.numPages) * 100);
            const pageRange = Math.round(100 / pdf.numPages);
            const ocrText = await extractTextFromImage(imgFile, (p) => {
                onProgress?.(baseProgress + Math.round((p / 100) * pageRange));
            });
            allText += ocrText + '\n';
        }
    }
    return allText;
}

/**
 * Extrai campos de documentos brasileiros a partir de texto OCR
 */
export function parseFieldsFromText(text: string): ExtractedFields {
    const fields: ExtractedFields = {};
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // CPF: ###.###.###-##
    const cpfMatch = text.match(/(\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\s]?\d{2})/);
    if (cpfMatch) {
        const digits = cpfMatch[1].replace(/\D/g, '');
        if (digits.length === 11) {
            fields.cpf_cnpj_cliente = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
    }

    // CNPJ: ##.###.###/####-##
    if (!fields.cpf_cnpj_cliente) {
        const cnpjMatch = text.match(/(\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[\-\s]?\d{2})/);
        if (cnpjMatch) {
            const digits = cnpjMatch[1].replace(/\D/g, '');
            if (digits.length === 14) {
                fields.cpf_cnpj_cliente = digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
            }
        }
    }

    // RG
    const rgMatch = text.match(/(?:RG|R\.?\s*G\.?|Registro\s+Geral|Identidade)[:\s]*[nN]?[°ºo]?\s*(\d[\d\.\-\s]{3,15})/i);
    if (rgMatch) {
        fields.rg_cliente = rgMatch[1].replace(/\s/g, '').trim();
    }

    // Matrícula
    const matMatch = text.match(/(?:matr[ií]cula|mat\.?)[:\s]*[nN]?[°ºo]?\s*([0-9][\d\.\-\/\s]{1,20})/i);
    if (matMatch) {
        fields.matricula_imovel = matMatch[1].replace(/\s+/g, '').trim();
    }

    // Estado civil
    const ecMatch = text.match(/(solteiro|solteira|casado|casada|divorciado|divorciada|vi[uú]vo|vi[uú]va|uni[aã]o\s+est[aá]vel)/i);
    if (ecMatch) {
        const ec = ecMatch[1].toLowerCase();
        if (ec.includes('solteir')) fields.estado_civil_cliente = 'Solteiro(a)';
        else if (ec.includes('casad')) fields.estado_civil_cliente = 'Casado(a)';
        else if (ec.includes('divorci')) fields.estado_civil_cliente = 'Divorciado(a)';
        else if (ec.includes('vi')) fields.estado_civil_cliente = 'Viúvo(a)';
        else if (ec.includes('uni')) fields.estado_civil_cliente = 'União estável';
    }

    // Nome — procura após keywords, ou a maior linha em CAPS
    const nomeKeywords = /(?:NOME|PROPRIETARIO|PROPRIETÁRIA|OUTORGANTE|COMPRADOR|ADQUIRENTE)[:\s]+(.+)/i;
    const nomeMatch = text.match(nomeKeywords);
    if (nomeMatch) {
        const candidate = nomeMatch[1].replace(/[,;].*/, '').trim();
        if (candidate.length >= 5 && candidate.length <= 80) {
            fields.nome_cliente = candidate;
        }
    }
    if (!fields.nome_cliente) {
        // Maior linha toda em maiúsculas (provavelmente o nome)
        const capsLines = lines.filter(l =>
            l === l.toUpperCase() &&
            l.length >= 8 &&
            l.length <= 60 &&
            /^[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ\s]+$/.test(l) &&
            !/(CERTID|REGIST|REPUB|MINIST|CARTORI|ESCRIT|LIVRO|FOLHA|ESTADO|BRAS|SERV)/i.test(l)
        );
        if (capsLines.length > 0) {
            capsLines.sort((a, b) => b.length - a.length);
            fields.nome_cliente = capsLines[0];
        }
    }

    // Denominação / nome do imóvel
    const denMatch = text.match(/(?:denomina[cç][aã]o|propriedade|im[oó]vel\s+denominad)[oa]?[:\s]+["""]?(.+?)[""\n]/i);
    if (denMatch) {
        const candidate = denMatch[1].replace(/[,;].*/, '').trim();
        if (candidate.length >= 3 && candidate.length <= 80) {
            fields.denominacao_imovel = candidate;
        }
    }

    // Município — após keyword
    const munMatch = text.match(/(?:munic[ií]pio|cidade)\s+(?:de|do|da)\s+([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇa-záàâãéèêíïóôõöúüç\s]{3,40})/i);
    if (munMatch) {
        fields.municipio = munMatch[1].trim();
    }
    if (!fields.municipio) {
        const comarcaMatch = text.match(/comarca\s+(?:de|do|da)\s+([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇa-záàâãéèêíïóôõöúüç\s]{3,40})/i);
        if (comarcaMatch) {
            fields.municipio = comarcaMatch[1].trim();
        }
    }

    // UF
    const ufMatch = text.match(/(?:Estado\s+(?:de|do|da)\s+|UF[:\s]+|\/\s*)([A-Z]{2})\b/);
    if (ufMatch && UFS.includes(ufMatch[1])) {
        fields.uf = ufMatch[1];
    }
    if (!fields.uf && fields.municipio) {
        // Procura UF após o município
        const afterMun = text.indexOf(fields.municipio);
        if (afterMun >= 0) {
            const after = text.slice(afterMun + fields.municipio.length, afterMun + fields.municipio.length + 20);
            const ufFind = after.match(/[\s\-\/]+([A-Z]{2})\b/);
            if (ufFind && UFS.includes(ufFind[1])) {
                fields.uf = ufFind[1];
            }
        }
    }

    // SIGEF (UUID pattern)
    const sigefMatch = text.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (sigefMatch) {
        fields.denominacao_imovel = fields.denominacao_imovel; // keep existing
        // Could add codigo_sigef but it's not in ExtractedFields for now
    }

    return fields;
}
