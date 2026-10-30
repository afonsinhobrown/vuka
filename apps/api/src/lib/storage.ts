import crypto from 'crypto';

/**
 * Cloudflare R2 (S3-compatible) — geração de URLs assinadas com AWS Signature V4.
 *
 * Implementado com `node:crypto` de propósito: o backend não passa a depender de
 * `@aws-sdk/*` e continua a compilar/instalar sem rede. A assinatura é validada
 * contra o vector de teste oficial da AWS (ver scratch/sigv4-check.mjs).
 *
 * Se as variáveis R2_* não existirem, o sistema cai para disco local (STORAGE_DIR),
 * o que mantém `npm run dev` a funcionar sem conta Cloudflare.
 */

export type StorageProvider = 'r2' | 'local';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  host: string;
  region: string;
  service: string;
  /** Prefixo de todas as chaves (para partilhar um bucket com outras apps). */
  prefix: string;
}

const REGION = 'auto';
const SERVICE = 's3';
const ALGORITHM = 'AWS4-HMAC-SHA256';
const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

export const UPLOAD_URL_TTL_SECONDS = 900; // 15 min para o browser enviar o PDF
export const DOWNLOAD_URL_TTL_SECONDS = 300; // 5 min, alinhado com o token HMAC do leitor
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
] as const;

/** Lê a configuração do ambiente em cada chamada (facilita testes e reload). */
export function getR2Config(): R2Config | null {
  const env = (primary: string, fallback: string) =>
    (process.env[primary] || process.env[fallback] || '').trim();

  const accessKeyId = env('OBJECT_STORAGE_ACCESS_KEY_ID', 'R2_ACCESS_KEY_ID');
  const secretAccessKey = env('OBJECT_STORAGE_SECRET_ACCESS_KEY', 'R2_SECRET_ACCESS_KEY');
  const bucket = env('OBJECT_STORAGE_BUCKET', 'R2_BUCKET');
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const explicitEndpoint = env('OBJECT_STORAGE_ENDPOINT', 'R2_ENDPOINT');

  if (!accessKeyId || !secretAccessKey || !bucket) return null;

  const host = explicitEndpoint
    ? explicitEndpoint.replace(/^https?:\/\//, '').replace(/\/+$/, '')
    : accountId
      ? `${accountId}.r2.cloudflarestorage.com`
      : '';

  if (!host) return null;

  const rawPrefix = (process.env.OBJECT_STORAGE_PREFIX ?? process.env.R2_PREFIX ?? 'vuka').trim();
  const prefix = rawPrefix ? `${rawPrefix.replace(/^\/+|\/+$/g, '')}/` : '';

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    host,
    region: env('OBJECT_STORAGE_REGION', 'R2_REGION') || REGION,
    service: SERVICE,
    prefix
  };
}

export function isRemoteStorageEnabled(): boolean {
  return getR2Config() !== null;
}

export function getStorageProvider(): StorageProvider {
  return isRemoteStorageEnabled() ? 'r2' : 'local';
}

/* ------------------------------------------------------------------ */
/* Codificação / assinatura                                            */
/* ------------------------------------------------------------------ */

/** RFC 3986 (o que a AWS exige: escapa !'()* e mantém ~ não escapado). */
export function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeObjectPath(objectKey: string): string {
  return objectKey
    .split('/')
    .map((segment) => uriEncode(segment))
    .join('/');
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmac(key: crypto.BinaryLike, value: string): Buffer {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest();
}

/** Chave de assinatura: HMAC em cascata (data → região → serviço → aws4_request). */
export function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string
): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

/** Formato de data da AWS: 20261030T085436Z */
export function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

/**
 * Assina um pedido presigned (query string auth) e devolve a assinatura hex.
 * Separado para poder ser verificado isoladamente contra o vector oficial da AWS.
 */
export function signCanonicalRequest(params: {
  canonicalRequest: string;
  amzDate: string;
  dateStamp: string;
  region: string;
  service: string;
  secretAccessKey: string;
}): string {
  const credentialScope = `${params.dateStamp}/${params.region}/${params.service}/aws4_request`;
  const stringToSign = [
    ALGORITHM,
    params.amzDate,
    credentialScope,
    sha256Hex(params.canonicalRequest)
  ].join('\n');

  const signingKey = deriveSigningKey(
    params.secretAccessKey,
    params.dateStamp,
    params.region,
    params.service
  );

  return hmac(signingKey, stringToSign).toString('hex');
}

export interface PresignedUrl {
  url: string;
  method: 'GET' | 'PUT' | 'HEAD';
  headers: Record<string, string>;
  expiresInSeconds: number;
  objectKey: string;
}

/**
 * Constrói um URL presigned (path-style: https://<host>/<bucket>/<key>).
 */
export function createPresignedUrl(params: {
  method: 'GET' | 'PUT' | 'HEAD';
  objectKey: string;
  expiresInSeconds?: number;
  /** Cabeçalhos a assinar (sem `host`, que é adicionado automaticamente). */
  headersToSign?: Record<string, string>;
  /** Query params extra (ex.: response-content-disposition). */
  extraQuery?: Record<string, string>;
  now?: Date;
}): PresignedUrl | null {
  const config = getR2Config();
  if (!config) return null;

  const expiresInSeconds = Math.min(
    Math.max(params.expiresInSeconds ?? DOWNLOAD_URL_TTL_SECONDS, 1),
    604800
  );
  const now = params.now ?? new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${config.region}/${config.service}/aws4_request`;

  // Path-style por omissão (https://host/bucket/key): funciona em R2 e em MinIO.
  // R2_PATH_STYLE=false usa virtual-hosted style (https://bucket.host/key).
  const pathStyle = (process.env.R2_PATH_STYLE || 'true').toLowerCase() !== 'false';
  const requestHost = pathStyle ? config.host : `${config.bucket}.${config.host}`;
  const canonicalUri = pathStyle
    ? `/${config.bucket}/${encodeObjectPath(params.objectKey)}`
    : `/${encodeObjectPath(params.objectKey)}`;

  const headersToSign: Record<string, string> = {
    ...(params.headersToSign || {}),
    host: requestHost
  };
  const sortedHeaderNames = Object.keys(headersToSign)
    .map((name) => name.toLowerCase())
    .sort();
  const normalisedHeaders: Record<string, string> = {};
  for (const [name, value] of Object.entries(headersToSign)) {
    normalisedHeaders[name.toLowerCase()] = String(value).trim().replace(/\s+/g, ' ');
  }
  const canonicalHeaders = sortedHeaderNames
    .map((name) => `${name}:${normalisedHeaders[name]}\n`)
    .join('');
  const signedHeaders = sortedHeaderNames.join(';');

  const query: Record<string, string> = {
    'X-Amz-Algorithm': ALGORITHM,
    'X-Amz-Credential': `${config.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresInSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
    ...(params.extraQuery || {})
  };

  const canonicalQuery = Object.keys(query)
    .sort()
    .map((key) => `${uriEncode(key)}=${uriEncode(query[key])}`)
    .join('&');

  const canonicalRequest = [
    params.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    UNSIGNED_PAYLOAD
  ].join('\n');

  const signature = signCanonicalRequest({
    canonicalRequest,
    amzDate,
    dateStamp,
    region: config.region,
    service: config.service,
    secretAccessKey: config.secretAccessKey
  });

  const url = `https://${requestHost}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;

  const responseHeaders: Record<string, string> = {};
  for (const [name, value] of Object.entries(headersToSign)) {
    if (name.toLowerCase() !== 'host') responseHeaders[name] = value;
  }

  return {
    url,
    method: params.method,
    headers: responseHeaders,
    expiresInSeconds,
    objectKey: params.objectKey
  };
}

/* ------------------------------------------------------------------ */
/* Chaves de objecto                                                   */
/* ------------------------------------------------------------------ */

export function visibilityFolder(visibility: string): 'public' | 'private' {
  return visibility === 'PUBLIC' ? 'public' : 'private';
}

/**
 * Mantém o mesmo layout do disco local: `<visibilidade>/<storageKey>`,
 * com um prefixo opcional (ex.: `vuka/`) quando o bucket é partilhado.
 * Assim, assets antigos (disco) e novos (R2) partilham a mesma `storageKey`.
 */
export function objectKeyFor(storageKey: string, visibility: string): string {
  const prefix = getR2Config()?.prefix ?? '';
  return `${prefix}${visibilityFolder(visibility)}/${storageKey}`;
}

const STORAGE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/;

export function isValidStorageKey(storageKey: string): boolean {
  return STORAGE_KEY_PATTERN.test(storageKey) && !storageKey.includes('..');
}

/** Gera uma storageKey opaca (`uuid.ext`), sem depender do nome original. */
export function buildStorageKey(originalName: string): string {
  const extension = (originalName.match(/\.([A-Za-z0-9]{1,5})$/)?.[1] || '').toLowerCase();
  const id = crypto.randomUUID();
  return extension ? `${id}.${extension}` : id;
}

export function isAllowedUploadMimeType(mimeType: string): boolean {
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(
    (mimeType || '').toLowerCase().split(';')[0].trim()
  );
}

/* ------------------------------------------------------------------ */
/* Fábricas de alto nível                                              */
/* ------------------------------------------------------------------ */

export function createUploadUrl(params: {
  storageKey: string;
  visibility: string;
  mimeType: string;
  expiresInSeconds?: number;
}): PresignedUrl | null {
  const mimeType = (params.mimeType || 'application/octet-stream').split(';')[0].trim();
  return createPresignedUrl({
    method: 'PUT',
    objectKey: objectKeyFor(params.storageKey, params.visibility),
    expiresInSeconds: params.expiresInSeconds ?? UPLOAD_URL_TTL_SECONDS,
    headersToSign: { 'content-type': mimeType }
  });
}

/**
 * Cabeçalhos HTTP só aceitam ASCII: nomes como "Edição Nº 450.pdf" fariam o
 * R2/Node falhar. Transliteramos (mapa + NFD) e limpamos o resto.
 */
const TRANSLITERATION: Record<string, string> = {
  'º': 'o',
  'ª': 'a',
  '°': 'o',
  '—': '-',
  '–': '-',
  '−': '-',
  '’': "'",
  '‘': "'",
  '”': '"',
  '“': '"',
  '…': '...'
};

export function sanitizeFilename(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .replace(/[ºª°—–−’‘“”…]/g, (char) => TRANSLITERATION[char] ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/["\\;]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export function createDownloadUrl(params: {
  storageKey: string;
  visibility: string;
  filename?: string | null;
  inline?: boolean;
  expiresInSeconds?: number;
}): PresignedUrl | null {
  const safeName = sanitizeFilename(params.filename);
  const disposition = safeName
    ? `${params.inline === false ? 'attachment' : 'inline'}; filename="${safeName}"`
    : undefined;

  return createPresignedUrl({
    method: 'GET',
    objectKey: objectKeyFor(params.storageKey, params.visibility),
    expiresInSeconds: params.expiresInSeconds ?? DOWNLOAD_URL_TTL_SECONDS,
    extraQuery: disposition
      ? { 'response-content-disposition': disposition }
      : undefined
  });
}

/**
 * Confirma, do lado do servidor, que o browser conseguiu mesmo enviar o ficheiro.
 * Evita registar assets "fantasma" quando o PUT falha (CORS, assinatura, rede).
 */
export async function remoteObjectExists(params: {
  storageKey: string;
  visibility: string;
}): Promise<boolean> {
  const presigned = createPresignedUrl({
    method: 'HEAD',
    objectKey: objectKeyFor(params.storageKey, params.visibility),
    expiresInSeconds: 60
  });

  if (!presigned) return true; // storage local: nada a verificar aqui

  try {
    const response = await fetch(presigned.url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}
