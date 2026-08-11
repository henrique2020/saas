# 6) Compilação, Desenvolvimento e Implantação em Produção

Este guia fornece as instruções completas para configurar o ambiente de desenvolvimento, compilar o código (TypeScript e assets estáticos) e realizar a implantação em ambiente de produção do **StockSaaS**.

---

## 1. Pré-requisitos de Ambiente

Antes de iniciar, certifique-se de que o servidor ou máquina local atenda aos seguintes requisitos:

- **Node.js**: Versão 18.x ou superior (LTS recomendado).
- **Gerenciador de Pacotes**: `npm` v9+ (ou `yarn` / `pnpm`).
- **Banco de Dados**: MySQL 8.0+ ou MariaDB 10.5+.
- **Sistema Operacional**: Linux (Ubuntu 22.04 LTS recomendado para produção), macOS ou Windows.
- **Chave de API**: Credencial da API [Alpha Vantage](https://www.alphavantage.co/support/#api-key) para cotações e dividendos.

---

## 2. Execução em Ambiente de Desenvolvimento (Dev Mode)

### 2.1. Configuração do Banco de Dados

Crie um banco de dados MySQL para o projeto:

```sql
CREATE DATABASE stock_saas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2.2. Configuração do Backend (`server/`)

1. Navegue até a pasta do servidor e instale as dependências:
   ```bash
   cd server
   npm install
   ```

2. Crie o arquivo de variáveis de ambiente `.env` (baseado no `.env.example` ou modelo abaixo):
   ```env
   PORT=3001
   NODE_ENV=development
   DATABASE_URL="mysql://usuario:senha@localhost:3306/stock_saas"
   JWT_SECRET="chave-secreta-desenvolvimento-jwt-123"
   JWT_REFRESH_SECRET="chave-secreta-desenvolvimento-refresh-456"
   ALPHA_VANTAGE_KEY="sua_chave_alpha_vantage"
   TZ="America/Sao_Paulo"

   # CRON - Sincronização de preços
   PRICE_SYNC_CRON="15 22 * * 1-5"
   PRICE_SYNC_TIMEZONE="America/Sao_Paulo"
   PRICE_SYNC_STARTUP="false"

   # CRON - Sincronização de dividendos
   DIVIDEND_SYNC_CRON="0 23 * * 1-5"
   DIVIDEND_SYNC_TIMEZONE="America/Sao_Paulo"
   DIVIDEND_SYNC_STARTUP="false"
   ```

3. Gere os artefatos do Prisma ORM e aplique o esquema no banco de dados:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. Inicie o servidor backend em modo de desenvolvimento (com auto-reload):
   ```bash
   npm run dev
   ```
   O servidor backend estará escutando na porta **`http://localhost:3001`**.

---

### 2.3. Configuração do Frontend (`client/`)

1. Em um novo terminal, navegue até a pasta do cliente e instale as dependências:
   ```bash
   cd client
   npm install
   ```

2. Caso necessário, crie o arquivo `.env` para apontar a URL base da API:
   ```env
   VITE_API_URL=http://localhost:3001/api
   ```

3. Inicie o servidor de desenvolvimento do Vite (com Hot Module Replacement - HMR):
   ```bash
   npm run dev
   ```
   A aplicação React estará acessível em **`http://localhost:5173`**.

---

## 3. Como "Compilar" o Projeto (Production Build)

A compilação transforma o código TypeScript e os componentes React em arquivos JavaScript puros e otimizados.

### 3.1. Compilação e Checagem do Backend (`server/`)

1. **Checagem de Tipos (sem gerar arquivos)**:
   ```bash
   cd server
   npx tsc --noEmit
   ```

2. **Geração do Cliente Prisma**:
   ```bash
   npx prisma generate
   ```

3. **Compilação para JavaScript (Pasta `dist/`)**:
   ```bash
   npm run build
   ```
   *Nota: Caso o script `build` não esteja definido no `package.json`, execute:*
   ```bash
   npx tsc
   ```
   Isso gerará os arquivos compilados JavaScript na pasta `server/dist/`.

---

### 3.2. Compilação do Frontend (`client/`)

1. **Verificação de Tipos e Build Estático**:
   ```bash
   cd client
   npx tsc -b
   npm run build
   ```
   O comando `npm run build` executa o `vite build`, gerando o bundle minificado, otimizado para produção na pasta **`client/dist/`** (contendo `index.html`, arquivos `.js` e `.css` com hash para cache-busting).

---

## 4. Como Colocar em Produção (Production Deployment)

### 4.1. Preparação das Variáveis de Ambiente de Produção

No servidor de produção, defina o arquivo `server/.env` com valores seguros:

```env
PORT=3001
NODE_ENV=production
DATABASE_URL="mysql://usuario_prod:senha_forte_prod@localhost:3306/stock_saas"
JWT_SECRET="GERAR_UM_HASH_COMPLEXO_E_ALEATORIO_AQUI"
JWT_REFRESH_SECRET="GERAR_OUTRO_HASH_COMPLEXO_E_ALEATORIO_AQUI"
ALPHA_VANTAGE_KEY="sua_chave_alpha_vantage_oficial"
TZ="America/Sao_Paulo"

# Habilita execução de rotinas automáticas de mercado
PRICE_SYNC_CRON="15 22 * * 1-5"
DIVIDEND_SYNC_CRON="0 23 * * 1-5"
```

---

### 4.2. Implantação e Execução do Backend em Produção (com PM2)

Recomenda-se utilizar o **PM2** (Process Manager) para manter o servidor Node.js ativo 24/7, com reinício automático em caso de falha ou reboot do servidor OS.

1. Instale o PM2 globalmente no servidor:
   ```bash
   npm install -g pm2
   ```

2. Execute o banco de dados em produção e compile o backend:
   ```bash
   cd server
   npm install --omit=dev
   npx prisma generate
   npx prisma db push
   npm run build
   ```

3. Inicie a aplicação com o PM2:
   ```bash
   pm2 start dist/index.js --name "stock-saas-api"
   ```

4. Configure o PM2 para iniciar no boot do sistema operacional:
   ```bash
   pm2 save
   pm2 startup
   ```

5. Comandos úteis de gerenciamento PM2:
   ```bash
   pm2 status                 # Exibe status da aplicação
   pm2 logs stock-saas-api    # Exibe logs em tempo real
   pm2 restart stock-saas-api # Reinicia o serviço
   ```

---

### 4.3. Hospedagem do Frontend e Configuração do Nginx (Reverse Proxy)

Em produção, o servidor de desenvolvimento do Vite **não deve ser usado**. Em vez disso, os arquivos compilados da pasta `client/dist/` devem ser servidos via **Nginx** ou **Caddy**, que também atuam como proxy reverso para a API.

#### Exemplo de Configuração Nginx (`/etc/nginx/sites-available/stock-saas`)

```nginx
server {
    listen 80;
    server_name seudominio.com.br www.seudominio.com.br;

    # Frontend (Arquivos estáticos compilados do React)
    location / {
        root /var/www/stock-saas/client/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Reverse Proxy para a API REST (Backend Node.js)
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ative o site e reinicie o Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/stock-saas /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### 4.4. Configuração de SSL / HTTPS com Certbot (Let's Encrypt)

Obtenha um certificado HTTPS gratuito para o seu domínio:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seudominio.com.br -d www.seudominio.com.br
```

---

## 5. Checklist de Verificação Pós-Implantação

Após colocar a aplicação em produção, confirme os seguintes pontos:

1. **Healthcheck da API**:
   Acesse `https://seudominio.com.br/api/health` e confirme se o retorno é `{"status":"ok"}`.
2. **Registro de Logs**:
   Verifique se o arquivo `server/logs/routes.log` e a tabela `route_logs` estão gravando o tráfego HTTP das requisições.
3. **Execução de CRONs**:
   Consulte a tela `/admin/audit-logs` no perfil de Administrador para acompanhar as execuções automáticas das tarefas de cotação (`CRON_PRICE_SYNC`) e dividendos (`CRON_DIVIDEND_SYNC`).
4. **Segurança de Tokens**:
   Garanta que `JWT_SECRET` e `JWT_REFRESH_SECRET` sejam exclusivos de produção e nunca compartilhados no repositório Git.
