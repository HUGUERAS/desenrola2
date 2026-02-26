/**
 * apply-migration.mjs
 * Aplica a migration SQL ao banco Supabase remoto e cria o bucket de storage.
 *
 * Uso: node scripts/apply-migration.mjs
 * Requer: npm install pg (ou usa npx)
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Ler .env ──
function loadEnv() {
    const envPath = resolve(ROOT, 'apps/api/.env');
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    const env = {};
    for (const line of lines) {
        const m = line.match(/^\s*([^#][^=]+)=(.*)$/);
        if (m) env[m[1].trim()] = m[2].trim();
    }
    return env;
}

const env = loadEnv();
const DB_URL = env.DB_URL;
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY;

if (!DB_URL) {
    console.error('ERROR: DB_URL not found in apps/api/.env');
    process.exit(1);
}

// ── 1. Aplicar SQL via pg ──
async function applySQL() {
    console.log('=== Applying SQL migration ===');
    const sqlPath = resolve(ROOT, 'supabase/migrations/20260226000001_create_missing_resources.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Dynamic import para pg
    const pg = await import('pg');
    const Client = pg.default?.Client || pg.Client;
    const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();
        console.log('Connected to database.');

        await client.query(sql);
        console.log('Migration applied successfully!');
    } catch (err) {
        console.error('SQL Error:', err.message);
        // Try running statements one by one
        console.log('\nRetrying with individual statements...');
        const statements = sql.split(/;\s*$/m).filter(s => s.trim());
        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i].trim();
            if (!stmt || stmt.startsWith('--')) continue;
            try {
                await client.query(stmt);
                console.log(`  [${i + 1}/${statements.length}] OK`);
            } catch (e) {
                console.error(`  [${i + 1}/${statements.length}] FAIL: ${e.message}`);
            }
        }
    } finally {
        await client.end();
    }
}

// ── 2. Criar bucket de storage ──
async function createBucket() {
    console.log('\n=== Creating storage bucket "documentos" ===');

    if (!SUPABASE_URL || !SERVICE_KEY) {
        console.error('SUPABASE_URL or SUPABASE_SERVICE_KEY not found. Skipping bucket creation.');
        return;
    }

    try {
        const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'apikey': SERVICE_KEY,
            },
            body: JSON.stringify({
                id: 'documentos',
                name: 'documentos',
                public: true,
                file_size_limit: 52428800, // 50MB
            }),
        });

        const body = await res.json().catch(() => ({}));

        if (res.ok) {
            console.log('Bucket "documentos" created successfully!');
        } else if (res.status === 409 || (body.message && body.message.includes('already exists'))) {
            console.log('Bucket "documentos" already exists. OK.');
        } else {
            console.error(`Failed to create bucket: ${res.status}`, body);
        }
    } catch (err) {
        console.error('Bucket creation error:', err.message);
    }
}

// ── Run ──
async function main() {
    await applySQL();
    await createBucket();
    console.log('\n=== Done ===');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
