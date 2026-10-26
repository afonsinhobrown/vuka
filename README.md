# VUKA — Plataforma Multi-Editora de Publicações Digitais

> **Venda via WhatsApp • Leitura na Aplicação • Backend como Fonte Única de Verdade**

O **VUKA** é uma plataforma desenhada para separar o canal comercial do canal de consumo: o leitor adquire edições avulsas e assinaturas através do canal WhatsApp (M-Pesa / E-Mola) e acede aos conteúdos digitais protegidos (PDFs) através da aplicação móvel/web da VUKA.

---

## 🏛️ Arquitetura do Sistema

```
vuka/
├── packages/
│   └── shared/                 # Tipos TypeScript, Enums, DTOs e utilitários monetários (Meticais em minor units)
├── apps/
│   ├── api/                    # Backend REST em Node.js / TypeScript com Prisma ORM e Neon PostgreSQL
│   ├── admin-web/              # Painel Administrativo Web (React + Vite, porta 5174)
│   └── reader-app/             # Aplicação do Leitor (Mobile-first / PWA, porta 5173) com leitor PDF protegido
├── docs/                       # Especificações de requisitos e arquitetura técnica
└── README.md
```

---

## 🔐 Princípios de Segurança e Regras de Negócio (RB & RNF)

1. **Zero Confiança no Cliente (RB-03):** O leitor e a app cliente nunca decidem permissões; o backend é a fonte de verdade para direitos de acesso (*entitlements*).
2. **Proteção de Ficheiros (RNF-02, CA-06):** Ficheiros em armazenamento privado nunca possuem URLs públicas permanentes. A entrega é feita através de **tokens assinados HMAC de curta duração (5 minutos)**.
3. **Idempotência Estrita (RB-01, CA-03):** Webhooks de pagamento e criação de pedidos utilizam chaves de idempotência e transações atómicas para garantir que notificações duplicadas nunca criam direitos em duplicado.
4. **Precisão Monetária (RNF-08):** Valores financeiros são armazenados sempre em **unidades menores inteiras** (`minor_units`, ex.: 50,00 MT = `5000` centavos em MZN), eliminando imprecisões de ponto flutuante.
5. **Isolamento Multi-tenant (RF-12, CA-08):** Gestores de editora só acedem às suas publicações, edições e relatórios. Operações sensíveis são permanentemente gravadas na **trilha de auditoria** (`audit_events`).

---

## 👥 Contas de Acesso Pré-configuradas (Base de Dados Seed)

| Perfil | Identificador / Email | Palavra-passe | Permissões |
| :--- | :--- | :--- | :--- |
| **Administrador Global** | `admin@vuka.co.mz` | `admin123` | Controlo total, gestão de editoras, catálogo global, auditoria e relatórios |
| **Gestor Editorial (Notícias)** | `gestor@noticias.co.mz` | `editora123` | Gestão restrita da Sociedade do Notícias (Jornal Notícias e Domingo) |
| **Gestor Editorial (Mediacoop)** | `gestor@mediacoop.co.mz` | `editora123` | Gestão restrita do Semanário Savana |
| **Leitor Piloto** | `258841234567` | `leitor123` | Acesso à biblioteca pessoal (já com Jornal Notícias ativo) |

---

## 🚀 Como Executar o Sistema

### 1. Pré-requisitos
* Node.js v18+ ou v20+
* Base de Dados PostgreSQL (já configurada com o Neon Cloud)

### 2. Instalação e Povoamento
```bash
# Instalar dependências de todos os workspaces
npm install

# Compilar tipos partilhados
npm --workspace=packages/shared run build

# Sincronizar esquema com a base de dados Neon PostgreSQL
npm --workspace=apps/api run db:push

# Povoar a base de dados com editoras piloto, edições e utilizadores
npm --workspace=apps/api run db:seed
```

### 3. Execução dos Serviços
```bash
# Iniciar a API REST do Backend (porta 4000)
npm run dev:api

# Iniciar o Painel Administrativo Web (porta 5174)
npm run dev:admin

# Iniciar a Aplicação do Leitor (porta 5173)
npm run dev:reader
```

---

## 🌐 URLs dos Serviços em Execução

* **Backend REST API:** `http://localhost:4000/api/v1`
* **Painel Administrativo:** `http://localhost:5174/`
* **Aplicação do Leitor:** `http://localhost:5173/`

---

## 📱 Fluxo de Teste de Ponta a Ponta

1. **Testar Compra no WhatsApp:**
   * Aceda ao **Simulador WhatsApp** no Painel Admin (`http://localhost:5174/whatsapp-simulator`) ou na Banca do Leitor (`http://localhost:5173/store`).
   * Digite `MENU` ou escolha uma publicação (ex.: *Jornal Notícias*).
   * Escolha a oferta desejada (Edição Avulsa ou Assinatura Mensal).
   * Receba a referência de pagamento (ex.: `VUKA-XXXXXX`) e clique em **"Pagar Agora (Simular M-Pesa)"**.
2. **Testar Leitura Digital Protegida:**
   * Aceda à **App do Leitor** (`http://localhost:5173`).
   * Inicie sessão com o telefone do comprador (ex.: `258841234567` / `leitor123`).
   * A edição adquirida surgirá imediatamente na **Minha Biblioteca**.
   * Clique para abrir o **Leitor Digital PDF** com streaming assinado seguro.
3. **Testar Governança e Auditoria:**
   * No Painel Admin, consulte o menu **Trilha de Auditoria** para auditar as transações e alterações de preço com ator, data e motivo registados.
