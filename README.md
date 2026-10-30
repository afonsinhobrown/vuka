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
│   ├── publisher-web/          # Portal da Editora / Criador do Jornal (React + Vite, porta 5175)
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
| **Gestor Editorial (Notícias)** | `gestor@noticias.co.mz` | `editora123` | Portal da Editora: gestão restrita da Sociedade do Notícias (Jornal Notícias e Domingo) |
| **Gestor Editorial (Mediacoop)** | `gestor@mediacoop.co.mz` | `editora123` | Portal da Editora: gestão restrita do Semanário Savana |
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

# Iniciar o Portal da Editora / Criador do Jornal (porta 5175)
npm run dev:publisher

# Iniciar a Aplicação do Leitor (porta 5173)
npm run dev:reader
```

---

## 🌐 URLs dos Serviços em Execução

* **Backend REST API:** `http://localhost:4000/api/v1`
* **Painel Administrativo:** `http://localhost:5174/admin/`
* **Portal da Editora (Criador do Jornal):** `http://localhost:5175/editora/`
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

---

## 🗄️ Armazenamento de PDFs (Cloudflare R2)

Na Vercel o disco das funções é **efémero e só-leitura** e o *body* de uma Function está limitado a **4,5 MB** — nenhum PDF de jornal passa por lá. Por isso o upload deixou de ir pela API e passou a ser **directo do browser para o R2** com URL assinado:

1. `POST /api/v1/catalog/upload/presign` → API devolve um `PUT` assinado (15 min) e uma `storageKey`.
2. O browser faz `PUT` do ficheiro para o R2 (não passa pela API).
3. `POST /api/v1/catalog/upload/complete` → API confirma que o objecto existe (`HEAD` assinado) e regista o `Asset` na BD.

A leitura é entregue por `302` para um URL assinado de **5 minutos** (`GET /api/v1/content/stream/:token`), alinhado com o token HMAC de leitura — os bytes saem do Cloudflare, com **egress gratuito**, em vez de gastar CPU da função.

### Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Exemplo |
| :--- | :--- |
| `OBJECT_STORAGE_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `OBJECT_STORAGE_BUCKET` | `vuka-editions` |
| `OBJECT_STORAGE_REGION` | `auto` |
| `OBJECT_STORAGE_ACCESS_KEY_ID` | *(token R2 — Object Read & Write)* |
| `OBJECT_STORAGE_SECRET_ACCESS_KEY` | *(token R2)* |
| `OBJECT_STORAGE_PREFIX` | `vuka` (isola as chaves de outras apps no mesmo bucket) |

Sem estas variáveis, o sistema cai para disco local (`STORAGE_DIR`) — útil em desenvolvimento. Para confirmar o que está activo em produção: `GET /api/v1/content/storage-status` → `{ "provider": "r2" }`.

### CORS do bucket (obrigatório para o PUT do browser)

No Cloudflare → R2 → bucket → **Settings → CORS Policy**:

```json
[
  {
    "AllowedOrigins": [
      "https://vuka-kappa.vercel.app",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

O bucket fica **privado** (sem domínio público `r2.dev`): todo o acesso é por URL assinado.

### Depois de correr `db:seed`

O seed grava os PDFs e capas de demonstração **só no disco local** (`apps/api/storage/`), que não existe na Vercel. É preciso enviá-los para o R2:

```bash
npm --workspace=apps/api run db:seed              # cria dados + ficheiros locais
npm --workspace=apps/api run storage:upload-seed  # envia esses ficheiros para o R2
```

Sem o segundo comando as edições aparecem na biblioteca mas o PDF devolve 404 (o leitor fica em branco).


---

## 💳 Pagamentos (PaySuite)

| Variável | Descrição |
| :--- | :--- |
| `PAYSUITE_API_URL` | `https://paysuite.tech/api/v1` (ou o host da sandbox, se for diferente) |
| `PAYSUITE_API_TOKEN` | Token da API (formato `id\|hash`) |
| `PAYSUITE_WEBHOOK_SECRET` | Secret do webhook (`whsec_...`) — usado para validar o HMAC |
| `BASE_URL` | **URL pública da API** (`https://vuka-kappa.vercel.app`). É com ela que se constrói o `webhook_url` enviado à PaySuite; com `localhost` o pagamento nunca confirma o pedido |
| `PAYSUITE_SANDBOX` | `true` em testes, **obrigatoriamente `false` em produção** |
| `PAYSUITE_SANDBOX_AMOUNT_MINOR_UNITS` | Valor fixo do sandbox (por omissão `1000` = 10,00 MT) |

### Testes em sandbox

Em modo de testes a PaySuite cobra um **valor fixo** (10 MT) independentemente do preço do jornal — o webhook chega com 1000 minor units enquanto o pedido vale, por exemplo, 10 000. Sem tratamento, a validação `RB-02` rejeitava com `AMOUNT_MISMATCH` e o pedido ficava `PENDING` para sempre.

Com `PAYSUITE_SANDBOX=true` a API aceita a notificação **apenas quando o valor recebido é exactamente o valor fixo do sandbox**, grava um evento de auditoria `SANDBOX_PAYMENT_ACCEPTED` e confirma o pedido. Qualquer outro valor continua a ser rejeitado, e em produção (`false`) a validação é estrita.

Diagnóstico sem expor segredos: `GET /api/v1/payments/config-status` (mostra `sandboxMode` e `sandboxFixedAmountMinorUnits`).

---

## 📰 Entrada de um novo jornal (auto-registo com convite)

O administrador do sistema **não cria jornais**. O fluxo é:

1. **Admin** → *Editoras / Jornais* → **Gerar convite** → obtém um código `VUKA-XXXX-XXXX` (1 uso).
2. O código é enviado ao jornal.
3. **Jornal** → `https://vuka-kappa.vercel.app/editora/registar` → cola o código e cria a conta (nome do jornal, responsável, email, password).
4. A API cria numa única transação: `Publisher` + `User` (`PUBLISHER_ADMIN`) + `PublisherMember`, e consome o convite de forma atómica.

Depois disso o jornal entra no portal, cria as publicações, carrega edições e define preços — sem intervenção do admin, que mantém apenas a fiscalização (suspender/reativar conta e anular convites por usar).

Endpoints: `POST /api/v1/publishers/register` (público, exige `inviteCode`), `GET|POST /api/v1/publishers/invites`, `DELETE /api/v1/publishers/invites/:id` (ADMIN).

---

## 💳 Planos de subscrição dos jornais

| Plano | Preço/mês | Títulos | Artigos/mês | Vendas/mês |
| :--- | ---: | ---: | ---: | ---: |
| **Basic** | 3.000 MT | 1 | 30 | 500 |
| **Standard** | 5.000 MT | 3 | 120 | 2.000 |
| **Premium** | 7.000 MT | 10 | ilimitado | 10.000 |

Os limites são definidos em [plans.ts](apps/api/src/lib/plans.ts) (fonte única de verdade) e aplicados no servidor:

- **criar título** → `PLAN_LIMIT_PUBLICATIONS` ([catalog.service.ts](apps/api/src/modules/catalog/catalog.service.ts))
- **publicar artigo** → `PLAN_LIMIT_ARTICLES` ([articles.service.ts](apps/api/src/modules/articles/articles.service.ts))
- **criar pedido/venda** → `PLAN_LIMIT_SALES` ([order.service.ts](apps/api/src/modules/orders/order.service.ts))
- subscrição inativa ou renovação em atraso → `SUBSCRIPTION_INACTIVE` / `SUBSCRIPTION_OVERDUE`

Um jornal novo entra no **Basic**. O administrador altera o plano, o estado e a data de renovação em *Editoras / Jornais → Plano*; o jornal vê o seu plano e o consumo do mês em *Subscrição*, dentro do portal.

A PaySuite não tem cobrança recorrente (só `createPayment`/`getPayment`), por isso a mensalidade é emitida por nós como **factura** — por botão no admin ou pela rotina diária de renovação.

### Mensalidades (facturas)

- `PublisherInvoice` (`publisher_invoices`): referência `SUB-XXXXXX`, plano, valor, período, estado (`PENDING | PAID | FAILED | CANCELLED`), `providerReference`, `checkoutUrl`.
- **Admin → Editoras → Plano → Cobrar agora** cria a factura do ciclo e pede a cobrança à PaySuite (link M-Pesa/e-Mola guardado em `checkoutUrl`). **Marcar paga** renova a subscrição até ao fim do período.
- **Webhook**: notificações com referência `SUB-` são encaminhadas para a factura (não para pedidos) e validam o valor recebido — aceitando o valor fixo quando o modo sandbox está ligado.
- **Rotina de renovação**: `GET /api/v1/publishers/subscriptions/run-renewals` (admin autenticado ou `Authorization: Bearer $CRON_SECRET`) emite facturas para os jornais com renovação vencida e sem factura pendente. Pode ser chamada por Vercel Cron, ou manualmente em *Configurações → Renovações*.
- **Carência**: `SUBSCRIPTION_GRACE_DAYS` (por omissão `5`). Durante a carência o jornal continua a publicar/vender com aviso no portal; depois disso é bloqueado (`SUBSCRIPTION_OVERDUE`).





