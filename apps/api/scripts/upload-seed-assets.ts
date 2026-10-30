/**
 * Envia para o object storage (Cloudflare R2) os ficheiros de demonstração que o
 * `prisma/seed.ts` grava no disco local (`apps/api/storage/public|private`).
 *
 * O seed só escreve em disco — na Vercel isso não persiste, por isso as edições
 * e capas do seed apareciam na base de dados mas o PDF/cover não existia no R2
 * (a biblioteca abria e o leitor ficava em branco).
 *
 * Uso:
 *   npm --workspace=apps/api run storage:upload-seed
 *
 * Requer as variáveis OBJECT_STORAGE_* (ou R2_*). Sem elas, avisa e sai.
 */
import fs from 'fs';
import path from 'path';
import {
  createUploadUrl,
  createPresignedUrl,
  isRemoteStorageEnabled,
  objectKeyFor
} from '../src/lib/storage';

const STORAGE_DIR = process.env.STORAGE_DIR || './storage';

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

interface Candidate {
  folder: 'public' | 'private';
  name: string;
  filePath: string;
  sizeBytes: number;
  contentType: string;
}

function collect(): Candidate[] {
  const candidates: Candidate[] = [];

  for (const folder of ['public', 'private'] as const) {
    const dir = path.join(STORAGE_DIR, folder);
    if (!fs.existsSync(dir)) continue;

    for (const entry of fs.readdirSync(dir)) {
      if (entry === '.gitkeep' || entry.startsWith('.')) continue;

      const filePath = path.join(dir, entry);
      if (!fs.statSync(filePath).isFile()) continue;

      const extension = path.extname(entry).toLowerCase();
      const contentType = CONTENT_TYPES[extension];
      if (!contentType) {
        console.warn(`⚠️  Ignorado (tipo desconhecido): ${entry}`);
        continue;
      }

      candidates.push({
        folder,
        name: entry,
        filePath,
        sizeBytes: fs.statSync(filePath).size,
        contentType
      });
    }
  }

  return candidates;
}

async function main() {
  if (!isRemoteStorageEnabled()) {
    console.error(
      '✗ Object storage não configurado. Define OBJECT_STORAGE_ENDPOINT, _BUCKET, _ACCESS_KEY_ID, _SECRET_ACCESS_KEY.'
    );
    process.exit(1);
  }

  const candidates = collect();
  if (candidates.length === 0) {
    console.log('Nada para enviar (pasta de storage vazia).');
    return;
  }

  console.log(`A enviar ${candidates.length} ficheiro(s) de "${STORAGE_DIR}" para o R2...\n`);

  let uploaded = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const visibility = candidate.folder === 'public' ? 'PUBLIC' : 'PRIVATE';
    const presigned = createUploadUrl({
      storageKey: candidate.name,
      visibility,
      mimeType: candidate.contentType,
      expiresInSeconds: 900
    });

    if (!presigned) {
      console.error(`✗ ${candidate.folder}/${candidate.name}: não foi possível assinar o pedido.`);
      failed += 1;
      continue;
    }

    try {
      const body = fs.readFileSync(candidate.filePath);
      const response = await fetch(presigned.url, {
        method: 'PUT',
        headers: presigned.headers,
        body
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error(
          `✗ ${candidate.folder}/${candidate.name}: HTTP ${response.status} ${detail.slice(0, 160)}`
        );
        failed += 1;
        continue;
      }

      // Confirmação: HEAD assinado
      const head = createPresignedUrl({
        method: 'HEAD',
        objectKey: objectKeyFor(candidate.name, visibility),
        expiresInSeconds: 60
      });
      const check = head ? await fetch(head.url, { method: 'HEAD' }).catch(() => null) : null;

      const status = check && check.ok ? 'confirmado' : 'enviado (confirmação falhou)';
      console.log(
        `✓ ${candidate.folder}/${candidate.name} (${(candidate.sizeBytes / 1024).toFixed(0)} KB) — ${status}`
      );
      uploaded += 1;
    } catch (error: any) {
      console.error(`✗ ${candidate.folder}/${candidate.name}: ${error?.message || error}`);
      failed += 1;
    }
  }

  console.log(`\n${uploaded} enviado(s), ${failed} falha(s).`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
