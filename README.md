# Ensaio Elétrico v2

Sistema de gestão operacional para empresa de inspeção e manutenção elétrica. Permite gerenciar clientes, ordens de serviço, relatórios técnicos e propostas comerciais com exportação em PDF.

## Tecnologias

| Camada | Stack |
|--------|-------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4, React Router 7, TanStack Query 5 |
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
cd ensaio-eletrico-v2
```

### 2. Configure o backend

```bash
cd backend
cp .env.example .env
```

Edite o arquivo `backend/.env` com suas credenciais:

```env
DATABASE_URL=postgresql://postgres:[SUA-SENHA]@db.[SEU-PROJETO].supabase.co:5432/postgres
JWT_SECRET=uma-string-longa-e-aleatoria-aqui
PORT=3001
```

Instale as dependências e inicie:

```bash
npm install
npm run dev
```

O backend ficará disponível em `http://localhost:3001`.

### 3. Configure o frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

O frontend ficará disponível em `http://localhost:5173`.

---

## Scripts disponíveis

### Backend

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia em modo desenvolvimento com hot reload |
| `npm run build` | Gera bundle de produção em `dist/` |
| `npm start` | Executa o build de produção |

### Frontend

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento (porta 5173) |
| `npm run build` | Verificação TypeScript + build de produção |
| `npm run preview` | Pré-visualiza o build de produção |

---

## Primeiro acesso

Após subir o projeto, acesse `http://localhost:5173` e faça login com:

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
ensaio-eletrico-v2/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Entrada do servidor
│   │   ├── auth.ts           # JWT e hashing de senha
│   │   ├── db.ts             # Camada de acesso ao banco
│   │   ├── constants.ts      # Dados da empresa e normas elétricas
│   │   ├── routes/           # Rotas da API
│   │   └── pdf/              # Geração de PDFs
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── App.tsx           # Rotas e providers
    │   ├── api/              # Chamadas à API
    │   ├── hooks/            # Hooks com TanStack Query
    │   ├── pages/            # Páginas da aplicação
    │   ├── components/       # Componentes reutilizáveis
    │   └── utils/            # Utilitários e formatadores
    └── vite.config.ts
```

---

## Variáveis de ambiente

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `DATABASE_URL` | URL de conexão PostgreSQL | Sim |
| `JWT_SECRET` | Chave secreta para assinar tokens JWT | Sim |
| `PORT` | Porta do servidor backend (padrão: 3001) | Não |

---

## Deploy em produção

### Backend

```bash
cd backend
npm run build
npm start
```

### Frontend

```bash
cd frontend
npm run build
# Arquivos gerados em frontend/dist/ — sirva com nginx, Vercel, Netlify, etc.
```

Certifique-se de configurar a variável de ambiente `VITE_API_URL` no frontend se o backend estiver em um domínio diferente, e atualize a configuração de proxy no `vite.config.ts` conforme necessário.
