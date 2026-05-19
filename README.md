# Ensaio Elétrico v2

Sistema de gestão operacional para empresa de inspeção e manutenção elétrica. Permite gerenciar clientes, ordens de serviço, relatórios técnicos e propostas comerciais com exportação em PDF.

## Tecnologias

| Camada | Stack |
|--------|-------|
| Backend | Hono, Node.js 20, TypeScript, esbuild |
| Banco de dados | PostgreSQL (Supabase) |
| Autenticação | JWT (jose) + bcryptjs |
| PDF | PDFKit |

---

## Pré-requisitos

- **Node.js** >= 20
- **npm** >= 9
- Conta no **[Supabase](https://supabase.com)** (ou outro PostgreSQL acessível)

---

## Configuração do banco de dados

1. Crie um projeto no [Supabase](https://supabase.com) (plano gratuito é suficiente).
2. Acesse **SQL Editor** e execute o script de criação das tabelas abaixo:

```sql
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  contato TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  sindico TEXT,
  torres INTEGER DEFAULT 1,
  ativo BOOLEAN DEFAULT true,
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  cliente_id UUID REFERENCES clientes(id),
  tipo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Aberta',
  prioridade TEXT NOT NULL DEFAULT 'Normal',
  descricao TEXT,
  data_abertura TIMESTAMPTZ DEFAULT now(),
  data_conclusao TIMESTAMPTZ,
  tecnico TEXT,
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE relatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  cliente_id UUID REFERENCES clientes(id),
  ordem_id UUID REFERENCES ordens_servico(id),
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Rascunho',
  data_vistoria TIMESTAMPTZ,
  tecnico TEXT,
  paineis JSONB DEFAULT '[]',
  normas JSONB DEFAULT '[]',
  nao_conformidades TEXT,
  recomendacoes TEXT,
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE propostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  cliente_id UUID REFERENCES clientes(id),
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Rascunho',
  validade INTEGER DEFAULT 30,
  servicos JSONB DEFAULT '[]',
  materiais JSONB DEFAULT '[]',
  etapas JSONB DEFAULT '[]',
  investimento JSONB DEFAULT '[]',
  valor_total NUMERIC(12,2) DEFAULT 0,
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- Usuário administrador padrão (senha: admin123)
INSERT INTO usuarios (nome, email, senha)
VALUES (
  'Administrador',
  'admin@ensaioeletrico.com.br',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
);
```

3. Copie a **Connection String** do projeto Supabase em **Settings > Database > Connection string > URI**.

---

## Instalação e execução

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd ensaio-eletrico-api
```

### 2. Configure o backend

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:

```env
DATABASE_URL=postgresql://postgres:[SUA-SENHA]@db.[SEU-PROJETO].supabase.co:5432/postgres
JWT_SECRET=uma-string-longa-e-aleatoria-aqui
APP_URL=http://localhost:3001
FRONTEND_URL=https://<seu-static-site>.onrender.com
BREVO_API_KEY=...
BREVO_SENDER=ensaioeletrico.servicos@gmail.com
SUPABASE_URL=https://<seu-projeto>.supabase.co
SUPABASE_ANON_KEY=...
```

Instale as dependências e inicie em modo de desenvolvimento:

```bash
npm install
npm run dev
```

Para rodar em produção localmente:

```bash
npm run build
npm start
```

O backend ficará disponível em `http://localhost:3001`.

## Deploy no Render

1. Crie um novo serviço **Web Service** no Render.
2. Conecte ao repositório GitHub do projeto.
3. Use `.` como diretório raiz do serviço.
4. Configure os comandos:
   - `Build Command`: `npm install && npm run build`
   - `Start Command`: `npm start`
   - `Health Check Path`: `/api/health`
5. Defina o ambiente como `Node 20` (ou equivalente).
6. Adicione as variáveis de ambiente a seguir no Render:

```env
DATABASE_URL=postgresql://usuario:senha@host:porta/banco
JWT_SECRET=uma-string-secreta-forte
APP_URL=https://<seu-servico>.onrender.com
FRONTEND_URL=https://<seu-static-site>.onrender.com
BREVO_API_KEY=...
BREVO_SENDER=ensaioeletrico.servicos@gmail.com
SUPABASE_URL=https://<seu-projeto>.supabase.co
SUPABASE_ANON_KEY=...
```

> O Render injeta automaticamente a variável `PORT`, então não é necessário definir `PORT` manualmente.

O backend usa `FRONTEND_URL` para liberar CORS para seu frontend hospedado, então essa variável é necessária quando o frontend rodar em outro domínio.

7. Inicie o deploy e verifique se o serviço sobe sem erro.
8. Teste o endpoint de saúde:

```bash
curl https://<seu-servico>.onrender.com/api/health
```

Se retornar `{ "ok": true }`, o deploy está funcionando.

---

## Scripts disponíveis

### Backend

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia em modo desenvolvimento com hot reload |
| `npm run build` | Gera bundle de produção em `dist/` |
| `npm start` | Executa o build de produção |

---

## Primeiro acesso

Após subir o backend, use a interface de frontend separada ou ferramentas de API para se conectar aos endpoints. Os dados de login padrão para o usuário administrador são:

- **E-mail:** `admin@ensaioeletrico.com.br`
- **Senha:** `admin123`

> Recomenda-se trocar a senha após o primeiro acesso.

---

## Funcionalidades

- **Clientes** — cadastro e gestão de clientes (condomínios, empresas)
- **Ordens de Serviço** — abertura, acompanhamento e conclusão de OS
- **Relatórios Técnicos** — laudos com checklists de painéis elétricos e conformidade com normas (NBR 5410, NR-10, NR-33, NR-35)
- **Propostas Comerciais** — orçamentos com itens de investimento e exportação em PDF
- **Dashboard** — KPIs e gráficos de distribuição por status

---

## Estrutura do projeto

```
ensaio-eletrico-api/
├── src/
│   ├── index.ts          # Entrada do servidor
│   ├── auth.ts           # JWT e hashing de senha
│   ├── db.ts             # Camada de acesso ao banco
│   ├── constants.ts      # Dados da empresa e normas elétricas
│   ├── routes/           # Rotas da API
│   └── pdf/              # Geração de PDFs
├── static/
└── .env.example
```

---

## Variáveis de ambiente

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `DATABASE_URL` | URL de conexão PostgreSQL | Sim |
| `JWT_SECRET` | Chave secreta para assinar tokens JWT | Sim |
| `APP_URL` | URL pública do backend | Sim |
| `BREVO_API_KEY` | API key para envio de e-mail via Brevo | Sim |
| `BREVO_SENDER` | E-mail remetente para notificações | Não |
| `SUPABASE_URL` | URL do projeto Supabase | Sim |
| `SUPABASE_ANON_KEY` | Chave anônima para uploads | Sim |
| `FRONTEND_URL` | URL pública do frontend para CORS | Sim |

---

## Deploy em produção

### Backend

```bash
npm run build
npm start
```

Este repositório contém apenas o backend. Use o frontend em outro repositório ou projeto separado.
