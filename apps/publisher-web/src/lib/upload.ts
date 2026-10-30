/**
 * Upload de ficheiros (PDF das edições, capas) para object storage.
 *
 * A Vercel limita o body das Functions a 4,5 MB, por isso o ficheiro vai
 * directo do browser para o Cloudflare R2 através de um URL assinado:
 *   1) POST /api/v1/catalog/upload/presign   → URL de PUT assinado
 *   2) PUT do ficheiro para o R2             → sem passar pela API
 *   3) POST /api/v1/catalog/upload/complete  → regista o asset na BD
 *
 * Se o storage remoto não estiver configurado (dev local), cai para o upload
 * multipart clássico em /api/v1/catalog/upload.
 */

export type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

export interface UploadedAsset {
  id: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  visibility: string;
  originalName?: string | null;
}

interface PresignResponse {
  storage: 'r2' | 'local';
  visibility?: 'PUBLIC' | 'PRIVATE';
  storageKey?: string;
  objectKey?: string;
  uploadUrl?: string;
  method?: string;
  headers?: Record<string, string>;
  expiresInSeconds?: number;
  maxSizeBytes?: number;
}

const MAX_SIZE_BYTES = 50 * 1024 * 1024;

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  return data?.error?.message || fallback;
}

export async function uploadAsset(
  authFetch: AuthFetch,
  file: File,
  options: { visibility?: 'PUBLIC' | 'PRIVATE' } = {}
): Promise<UploadedAsset> {
  const visibility = options.visibility ?? 'PRIVATE';
  const mimeType =
    file.type ||
    (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');

  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(`O ficheiro tem ${(file.size / 1024 / 1024).toFixed(1)} MB. O máximo é 50 MB.`);
  }

  // 1. Pedir URL assinado
  const presignRes = await authFetch('/api/v1/catalog/upload/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, mimeType, visibility })
  });

  let presign: PresignResponse | null = null;
  if (presignRes.ok) {
    presign = await presignRes.json().catch(() => null);
  } else if (presignRes.status !== 404) {
    throw new Error(await readErrorMessage(presignRes, 'Falha ao preparar o envio do ficheiro.'));
  }

  // 2a. Upload directo para o R2
  if (presign?.storage === 'r2' && presign.uploadUrl) {
    const putRes = await fetch(presign.uploadUrl, {
      method: presign.method || 'PUT',
      headers: presign.headers || { 'Content-Type': mimeType },
      body: file
    });

    if (!putRes.ok) {
      throw new Error(
        `O armazenamento recusou o ficheiro (${putRes.status}). ` +
          'Verifique se o bucket R2 tem CORS a permitir PUT deste domínio.'
      );
    }

    const completeRes = await authFetch('/api/v1/catalog/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storageKey: presign.storageKey,
        originalName: file.name,
        mimeType,
        sizeBytes: file.size,
        visibility
      })
    });

    if (!completeRes.ok) {
      throw new Error(await readErrorMessage(completeRes, 'Falha ao registar o ficheiro enviado.'));
    }

    const { asset } = await completeRes.json();
    return asset as UploadedAsset;
  }

  // 2b. Fallback local (dev sem R2 configurado)
  const formData = new FormData();
  formData.append('file', file);
  formData.append('isPublic', visibility === 'PUBLIC' ? 'true' : 'false');

  const uploadRes = await authFetch('/api/v1/catalog/upload', {
    method: 'POST',
    body: formData
  });

  if (!uploadRes.ok) {
    throw new Error(await readErrorMessage(uploadRes, 'Falha no upload do ficheiro.'));
  }

  const { asset } = await uploadRes.json();
  return asset as UploadedAsset;
}
