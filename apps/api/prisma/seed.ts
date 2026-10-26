import { PrismaClient, UserRole, UserStatus, PublisherStatus, PublicationStatus, EditionStatus, OfferType, OfferStatus, OrderStatus, PaymentStatus, PaymentProvider, EntitlementStatus, AssetVisibility } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const STORAGE_DIR = process.env.STORAGE_DIR || './storage';

// Helper to create a valid minimal PDF buffer
function createSamplePdfBuffer(title: string, editionInfo: string): Buffer {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 200 >>
stream
BT
/F1 28 Tf
50 720 Td
(${title}) Tj
/F1 16 Tf
0 -40 Td
(${editionInfo}) Tj
0 -30 Td
(VUKA Digital - Plataforma de Leitura Autorizada) Tj
0 -40 Td
(Maputo, Mocambique - Edicao Oficial Digital) Tj
0 -30 Td
(Esta publicacao esta protegida por controlo de acesso server-side.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000495 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
570
%%EOF`;

  return Buffer.from(content, 'utf-8');
}

// Helper to create sample SVG cover buffer
function createSampleCoverBuffer(title: string, color: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
    <rect width="400" height="600" fill="${color}"/>
    <rect x="20" y="20" width="360" height="560" fill="none" stroke="#ffffff" stroke-width="2"/>
    <text x="200" y="100" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle">${title}</text>
    <text x="200" y="150" font-family="Arial, sans-serif" font-size="16" fill="#f0f0f0" text-anchor="middle">EDICAO DIGITAL VUKA</text>
    <rect x="50" y="220" width="300" height="200" fill="#ffffff" opacity="0.2"/>
    <text x="200" y="320" font-family="Arial, sans-serif" font-size="20" fill="#ffffff" text-anchor="middle">NOTICIAS DE HOJE</text>
    <text x="200" y="520" font-family="Arial, sans-serif" font-size="14" fill="#ffffff" text-anchor="middle">Exclusivo via WhatsApp • Leitura na App</text>
  </svg>`;
  return Buffer.from(svg, 'utf-8');
}

async function main() {
  console.log('🌱 A iniciar o povoamento da base de dados VUKA...');

  // Ensure directories exist
  const publicDir = path.join(STORAGE_DIR, 'public');
  const privateDir = path.join(STORAGE_DIR, 'private');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(privateDir, { recursive: true });

  // 1. Administrador Geral VUKA
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@vuka.co.mz' },
    update: {},
    create: {
      displayName: 'Administrador VUKA',
      email: 'admin@vuka.co.mz',
      phone: '258840000001',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE
    }
  });
  console.log(`👤 Admin criado: ${admin.email} (Senha: admin123)`);

  // 2. Editora 1: Sociedade do Notícias, S.A.
  const publisherNoticias = await prisma.publisher.upsert({
    where: { slug: 'noticias-sa' },
    update: {},
    create: {
      name: 'Sociedade do Notícias, S.A.',
      slug: 'noticias-sa',
      contactEmail: 'comercial@noticias.co.mz',
      contactPhone: '+258 21 311 000',
      status: PublisherStatus.ACTIVE
    }
  });

  const editorNoticiasHash = await bcrypt.hash('editora123', 10);
  const editorNoticias = await prisma.user.upsert({
    where: { email: 'gestor@noticias.co.mz' },
    update: {},
    create: {
      displayName: 'Gestor Editorial Notícias',
      email: 'gestor@noticias.co.mz',
      phone: '258840000002',
      passwordHash: editorNoticiasHash,
      role: UserRole.PUBLISHER_ADMIN,
      status: UserStatus.ACTIVE
    }
  });

  await prisma.publisherMember.upsert({
    where: {
      publisherId_userId: {
        publisherId: publisherNoticias.id,
        userId: editorNoticias.id
      }
    },
    update: {},
    create: {
      publisherId: publisherNoticias.id,
      userId: editorNoticias.id,
      role: UserRole.PUBLISHER_ADMIN
    }
  });
  console.log(`🏢 Editora criada: ${publisherNoticias.name} (Gestor: gestor@noticias.co.mz / editora123)`);

  // 3. Editora 2: Mediacoop, SA
  const publisherMediacoop = await prisma.publisher.upsert({
    where: { slug: 'mediacoop' },
    update: {},
    create: {
      name: 'Mediacoop, Sociedade Jornalística',
      slug: 'mediacoop',
      contactEmail: 'administracao@mediacoop.co.mz',
      contactPhone: '+258 21 301 700',
      status: PublisherStatus.ACTIVE
    }
  });

  const editorMediacoopHash = await bcrypt.hash('editora123', 10);
  const editorMediacoop = await prisma.user.upsert({
    where: { email: 'gestor@mediacoop.co.mz' },
    update: {},
    create: {
      displayName: 'Gestor Savana / Mediacoop',
      email: 'gestor@mediacoop.co.mz',
      phone: '258840000003',
      passwordHash: editorMediacoopHash,
      role: UserRole.PUBLISHER_ADMIN,
      status: UserStatus.ACTIVE
    }
  });

  await prisma.publisherMember.upsert({
    where: {
      publisherId_userId: {
        publisherId: publisherMediacoop.id,
        userId: editorMediacoop.id
      }
    },
    update: {},
    create: {
      publisherId: publisherMediacoop.id,
      userId: editorMediacoop.id,
      role: UserRole.PUBLISHER_ADMIN
    }
  });
  console.log(`🏢 Editora criada: ${publisherMediacoop.name}`);

  // 4. Criação dos Ficheiros Físicos de Teste (PDFs e Capas)
  const noticiasPdfName = 'noticias_hoje.pdf';
  const savanaPdfName = 'savana_semana.pdf';
  const domingoPdfName = 'domingo_semana.pdf';

  fs.writeFileSync(path.join(privateDir, noticiasPdfName), createSamplePdfBuffer('JORNAL NOTICIAS', 'Edicao No 32.140'));
  fs.writeFileSync(path.join(privateDir, savanaPdfName), createSamplePdfBuffer('SEMANARIO SAVANA', 'Edicao No 1.580'));
  fs.writeFileSync(path.join(privateDir, domingoPdfName), createSamplePdfBuffer('JORNAL DOMINGO', 'Edicao de Fim de Semana'));

  const coverNoticiasName = 'cover_noticias.svg';
  const coverSavanaName = 'cover_savana.svg';
  const coverDomingoName = 'cover_domingo.svg';

  fs.writeFileSync(path.join(publicDir, coverNoticiasName), createSampleCoverBuffer('NOTICIAS', '#0d47a1'));
  fs.writeFileSync(path.join(publicDir, coverSavanaName), createSampleCoverBuffer('SAVANA', '#1b5e20'));
  fs.writeFileSync(path.join(publicDir, coverDomingoName), createSampleCoverBuffer('DOMINGO', '#b71c1c'));

  // 5. Registar Assets
  const assetCoverNoticias = await prisma.asset.create({
    data: {
      originalName: coverNoticiasName,
      storageKey: coverNoticiasName,
      mimeType: 'image/svg+xml',
      sizeBytes: 1024,
      visibility: AssetVisibility.PUBLIC
    }
  });

  const assetCoverSavana = await prisma.asset.create({
    data: {
      originalName: coverSavanaName,
      storageKey: coverSavanaName,
      mimeType: 'image/svg+xml',
      sizeBytes: 1024,
      visibility: AssetVisibility.PUBLIC
    }
  });

  const assetPdfNoticias = await prisma.asset.create({
    data: {
      originalName: 'Jornal_Noticias_32140.pdf',
      storageKey: noticiasPdfName,
      mimeType: 'application/pdf',
      sizeBytes: 8192,
      visibility: AssetVisibility.PRIVATE
    }
  });

  const assetPdfSavana = await prisma.asset.create({
    data: {
      originalName: 'Semanario_Savana_1580.pdf',
      storageKey: savanaPdfName,
      mimeType: 'application/pdf',
      sizeBytes: 8192,
      visibility: AssetVisibility.PRIVATE
    }
  });

  // 6. Criar Publicações
  const pubNoticias = await prisma.publication.upsert({
    where: {
      publisherId_slug: {
        publisherId: publisherNoticias.id,
        slug: 'jornal-noticias'
      }
    },
    update: {},
    create: {
      publisherId: publisherNoticias.id,
      title: 'Jornal Notícias',
      slug: 'jornal-noticias',
      description: 'O maior diário nacional de Moçambique, cobrindo política, economia, sociedade e desporto desde 1926.',
      coverAssetId: assetCoverNoticias.id,
      status: PublicationStatus.ACTIVE
    }
  });

  const pubSavana = await prisma.publication.upsert({
    where: {
      publisherId_slug: {
        publisherId: publisherMediacoop.id,
        slug: 'semanario-savana'
      }
    },
    update: {},
    create: {
      publisherId: publisherMediacoop.id,
      title: 'Semanário Savana',
      slug: 'semanario-savana',
      description: 'Jornalismo independente e de investigação profunda sobre Moçambique e a região austral.',
      coverAssetId: assetCoverSavana.id,
      status: PublicationStatus.ACTIVE
    }
  });

  // 7. Criar Edições
  const editionNoticias = await prisma.edition.create({
    data: {
      publicationId: pubNoticias.id,
      title: 'Notícias - Edição de Hoje (Nº 32.140)',
      editionDate: new Date(),
      contentAssetId: assetPdfNoticias.id,
      coverAssetId: assetCoverNoticias.id,
      status: EditionStatus.PUBLISHED,
      publishedAt: new Date()
    }
  });

  const editionSavana = await prisma.edition.create({
    data: {
      publicationId: pubSavana.id,
      title: 'Savana - Edição da Semana (Nº 1.580)',
      editionDate: new Date(),
      contentAssetId: assetPdfSavana.id,
      coverAssetId: assetCoverSavana.id,
      status: EditionStatus.PUBLISHED,
      publishedAt: new Date()
    }
  });

  // 8. Criar Ofertas Comerciais
  const offerNoticiasAvulsa = await prisma.offer.create({
    data: {
      publisherId: publisherNoticias.id,
      publicationId: pubNoticias.id,
      editionId: editionNoticias.id,
      type: OfferType.SINGLE_EDITION,
      title: 'Jornal Notícias - Edição Avulsa',
      description: 'Acesso permanente à edição do dia',
      priceMinorUnits: 5000, // 50.00 MZN
      currency: 'MZN',
      status: OfferStatus.ACTIVE
    }
  });

  const offerNoticiasMensal = await prisma.offer.create({
    data: {
      publisherId: publisherNoticias.id,
      publicationId: pubNoticias.id,
      type: OfferType.SUBSCRIPTION,
      title: 'Jornal Notícias - Assinatura Mensal (30 dias)',
      description: 'Acesso ilimitado a todas as edições diárias durante 30 dias',
      priceMinorUnits: 120000, // 1.200,00 MZN
      currency: 'MZN',
      validityDays: 30,
      status: OfferStatus.ACTIVE
    }
  });

  const offerSavanaAvulsa = await prisma.offer.create({
    data: {
      publisherId: publisherMediacoop.id,
      publicationId: pubSavana.id,
      editionId: editionSavana.id,
      type: OfferType.SINGLE_EDITION,
      title: 'Semanário Savana - Edição Semanal',
      description: 'Acesso permanente à edição semanal do Savana',
      priceMinorUnits: 6000, // 60.00 MZN
      currency: 'MZN',
      status: OfferStatus.ACTIVE
    }
  });

  // 9. Leitor de Teste com Compra e Direito Concedido
  const readerPasswordHash = await bcrypt.hash('leitor123', 10);
  const reader = await prisma.user.upsert({
    where: { phone: '258841234567' },
    update: {},
    create: {
      displayName: 'Afonso Brown',
      phone: '258841234567',
      email: 'afonso@vuka.co.mz',
      passwordHash: readerPasswordHash,
      role: UserRole.READER,
      status: UserStatus.ACTIVE
    }
  });

  // Criar Pedido Pago de Exemplo para o Leitor
  const orderRef = 'VUKA-DEMO01';
  const orderDemo = await prisma.order.upsert({
    where: { publicReference: orderRef },
    update: {},
    create: {
      publicReference: orderRef,
      userId: reader.id,
      offerId: offerNoticiasAvulsa.id,
      buyerContact: reader.phone!,
      buyerName: reader.displayName,
      channel: 'whatsapp',
      status: OrderStatus.PAID,
      currency: 'MZN',
      totalMinorUnits: 5000,
      offerSnapshot: {
        title: offerNoticiasAvulsa.title,
        priceMinorUnits: 5000,
        currency: 'MZN',
        publication: pubNoticias.title
      },
      expiresAt: new Date(Date.now() + 86400000),
      paidAt: new Date()
    }
  });

  // Conceder Entitlement ativo
  await prisma.entitlement.create({
    data: {
      userId: reader.id,
      orderId: orderDemo.id,
      editionId: editionNoticias.id,
      publicationId: pubNoticias.id,
      status: EntitlementStatus.ACTIVE,
      startsAt: new Date(),
      endsAt: null, // Vitalício
      origin: 'SEED_DEMO'
    }
  });

  console.log(`✅ Povoamento concluído com sucesso!`);
  console.log(`📱 Leitor de Teste: ${reader.phone} (Senha: leitor123) - Já possui acesso ao Jornal Notícias!`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
