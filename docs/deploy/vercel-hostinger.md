# Deploy: Vercel (Web) + Hostinger VPS (API)

## Arquitetura

- Frontend React/Vite: Vercel
- Backend FastAPI: Hostinger VPS (Ubuntu + systemd + Nginx)
- Banco/Auth: Supabase

## 1) Backend no Hostinger VPS

### 1.1 Preparar servidor

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip nginx certbot python3-certbot-nginx git
```

### 1.2 Clonar projeto e instalar dependências

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone <SEU_REPO_GIT> desenrola
sudo chown -R $USER:$USER /var/www/desenrola

cd /var/www/desenrola
python3 -m venv .venv
source .venv/bin/activate
pip install -r apps/api/requirements.txt
```

### 1.3 Configurar ambiente da API

```bash
cp apps/api/.env.example apps/api/.env
nano apps/api/.env
```

Defina no `.env` (produção):

- `ENV=production`
- `DEBUG=False`
- `HOST=127.0.0.1`
- `PORT=8010`
- `CORS_ORIGINS=https://SEU_APP.vercel.app,https://seu-dominio.com`
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`

### 1.4 Criar serviço systemd

```bash
sudo cp apps/api/deploy/desenrola-api.service.example /etc/systemd/system/desenrola-api.service
sudo systemctl daemon-reload
sudo systemctl enable desenrola-api
sudo systemctl start desenrola-api
sudo systemctl status desenrola-api
```

### 1.5 Configurar Nginx + HTTPS

```bash
sudo cp apps/api/deploy/nginx-api.conf.example /etc/nginx/sites-available/desenrola-api
sudo nano /etc/nginx/sites-available/desenrola-api
# ajustar server_name para api.seu-dominio.com

sudo ln -s /etc/nginx/sites-available/desenrola-api /etc/nginx/sites-enabled/desenrola-api
sudo nginx -t
sudo systemctl reload nginx

sudo certbot --nginx -d api.seu-dominio.com
```

## 2) Frontend na Vercel

### 2.1 Importar projeto

- Crie projeto na Vercel com o mesmo repositório.
- **Root Directory**: `apps/web`
- Framework: `Vite`

### 2.2 Variáveis de ambiente (Vercel)

- `VITE_API_URL=https://api.seu-dominio.com`
- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`
- `VITE_ESRI_API_KEY=...`

### 2.3 Publicar

- Faça deploy.
- O arquivo `apps/web/vercel.json` já configura rewrite de SPA.

## 3) DNS

- Crie `A` record: `api.seu-dominio.com` -> IP do VPS
- (Opcional) `CNAME` do domínio principal para Vercel

## 4) Versão para celular

### Opção rápida (recomendada agora)

- Use o app Vercel no navegador mobile e "Adicionar à tela inicial".
- Isso já funciona como versão mobile web.

### Opção loja (depois)

- Empacotar com Capacitor para Android/iOS e publicar nas lojas.

## 5) Checklist final

- API acessível em `https://api.seu-dominio.com/api/health`
- Frontend carregando em HTTPS
- Login e chamadas API funcionando sem erro de CORS
