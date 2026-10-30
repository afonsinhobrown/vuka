import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  CreditCard,
  Database,
  Loader2,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';

type SandboxSource = 'settings' | 'env';

interface SandboxState {
  enabled: boolean;
  source: SandboxSource;
  amountMinorUnits: number;
}

interface PaymentConfigStatus {
  provider: string;
  configured: boolean;
  apiUrl: string;
  tokenPresent: boolean;
  webhookSecretPresent: boolean;
  baseUrl: string;
  webhookUrl: string;
  baseUrlLooksLikeLocalhost: boolean;
  missing: string[];
}

const money = (minorUnits: number) =>
  `${(minorUnits / 100).toFixed(2).replace('.', ',')} MT`;

const StatusPill: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <span className={`badge ${ok ? 'badge-success' : 'badge-danger'}`}>
    {ok ? 'OK' : 'Em falta'} · {label}
  </span>
);

export const SettingsPage: React.FC = () => {
  const { authFetch, isAdmin } = useAuth();
  const [sandbox, setSandbox] = useState<SandboxState | null>(null);
  const [payments, setPayments] = useState<PaymentConfigStatus | null>(null);
  const [storageProvider, setStorageProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [sandboxRes, configRes, storageRes] = await Promise.all([
        authFetch('/api/v1/payments/sandbox'),
        authFetch('/api/v1/payments/config-status'),
        authFetch('/api/v1/content/storage-status')
      ]);

      if (sandboxRes.ok) {
        const data = await sandboxRes.json();
        setSandbox(data.sandbox || null);
      }

      if (configRes.ok) {
        const data = await configRes.json();
        setPayments(data.payments || null);
      }

      if (storageRes.ok) {
        const data = await storageRes.json();
        setStorageProvider(data.provider || null);
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar as configurações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSandbox = async () => {
    if (!sandbox) return;

    const next = !sandbox.enabled;
    const confirmation = next
      ? 'Ligar o modo sandbox? Todos os pagamentos passam a ser cobrados com o valor fixo de teste.'
      : 'Desligar o modo sandbox? A partir de agora as cobranças são a VALER (valor real do catálogo).';
    if (!confirm(confirmation)) return;

    try {
      setSaving(true);
      const res = await authFetch('/api/v1/payments/sandbox', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next })
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || 'Falha ao alterar o modo sandbox.');

      setSandbox(data.sandbox);
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Configurações da Plataforma</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Modo de testes dos pagamentos e estado da infraestrutura
        </p>
      </div>

      {error && (
        <div className="card" style={{ color: 'var(--color-danger)', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Loader2 size={16} /> A carregar configurações...
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* ---------- Sandbox ---------- */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px' }}>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard size={18} /> Modo sandbox dos pagamentos (PaySuite)
                </h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '6px', maxWidth: '620px' }}>
                  Em sandbox a PaySuite cobra sempre o <strong>valor fixo de {sandbox ? money(sandbox.amountMinorUnits) : '10,00 MT'}</strong>,
                  independentemente do preço do jornal. O webhook chega com esse valor e o pedido é confirmado
                  mesmo que o jornal custe 100 MT. Desliga antes de começar a cobrar a sério.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
                  <span className={`badge ${sandbox?.enabled ? 'badge-warning' : 'badge-success'}`}>
                    {sandbox?.enabled ? 'SANDBOX LIGADO' : 'PRODUÇÃO (cobranças reais)'}
                  </span>
                  {sandbox && (
                    <span style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
                      definido em: {sandbox.source === 'settings' ? 'painel (base de dados)' : 'variável de ambiente'}
                    </span>
                  )}
                </div>
              </div>

              <button
                className={`btn ${sandbox?.enabled ? 'btn-secondary' : 'btn-primary'}`}
                onClick={toggleSandbox}
                disabled={saving || !isAdmin || !sandbox}
                title={isAdmin ? '' : 'Apenas administradores podem alterar'}
                style={{ minWidth: '190px', justifyContent: 'center' }}
              >
                {saving
                  ? 'A guardar...'
                  : sandbox?.enabled
                    ? 'Desligar sandbox'
                    : 'Ligar sandbox'}
              </button>
            </div>

            {sandbox?.enabled && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-warning, #b45309)',
                  display: 'flex',
                  gap: '10px',
                  fontSize: '13px',
                  color: 'var(--color-text-main)'
                }}
              >
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>
                  Estás em modo de testes: qualquer pedido é confirmado com {sandbox ? money(sandbox.amountMinorUnits) : '10,00 MT'}.
                  Não uses este modo com leitores reais.
                </span>
              </div>
            )}
          </div>

          {/* ---------- PaySuite ---------- */}
          <div className="card">
            <h2 style={{ fontSize: '17px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {payments?.configured ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
              Credenciais PaySuite
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '6px' }}>
              Definidas nas variáveis de ambiente da Vercel (nunca no repositório).
            </p>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
              <StatusPill ok={Boolean(payments?.tokenPresent)} label="API token" />
              <StatusPill ok={Boolean(payments?.webhookSecretPresent)} label="webhook secret" />
              <StatusPill ok={Boolean(payments?.baseUrl) && !payments?.baseUrlLooksLikeLocalhost} label="BASE_URL público" />
            </div>

            {payments && (
              <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--color-text-muted)', display: 'grid', gap: '6px' }}>
                <div><strong>API:</strong> {payments.apiUrl}</div>
                <div><strong>BASE_URL:</strong> {payments.baseUrl || '—'}</div>
                <div><strong>Webhook:</strong> {payments.webhookUrl}</div>
              </div>
            )}

            {payments && payments.missing.length > 0 && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-danger)',
                  fontSize: '13px'
                }}
              >
                <strong>Falta configurar:</strong> {payments.missing.join(', ')}
              </div>
            )}
          </div>

          {/* ---------- Storage ---------- */}
          <div className="card">
            <h2 style={{ fontSize: '17px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} /> Armazenamento de PDFs
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '6px' }}>
              Com <code>r2</code>, os PDFs vão directo do browser para o Cloudflare R2 por URL assinado.
              Com <code>local</code> (só desenvolvimento), vão para o disco — não funciona na Vercel.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <span className={`badge ${storageProvider === 'r2' ? 'badge-success' : 'badge-warning'}`}>
                {storageProvider ? storageProvider.toUpperCase() : 'DESCONHECIDO'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
