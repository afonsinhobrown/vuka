import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PublisherDTO } from '@vuka/shared';
import {
  Building2,
  Phone,
  Mail,
  BookOpen,
  AlertCircle,
  Power,
  KeyRound,
  Copy,
  Trash2,
  Plus,
  BadgeCheck,
  X
} from 'lucide-react';

/**
 * Fiscalização das editoras/jornais + gestão dos códigos de convite.
 *
 * Os jornais criam a própria conta em `/editora/registar`, mas só com um código
 * de convite emitido aqui. O administrador não cria jornais.
 */

interface PublisherInvite {
  id: string;
  code: string;
  note: string | null;
  usedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  status: 'AVAILABLE' | 'USED' | 'EXPIRED';
  publisherId: string | null;
}

interface PlanInfo {
  code: 'BASIC' | 'STANDARD' | 'PREMIUM';
  name: string;
  tagline: string;
  priceMinorUnits: number;
  maxPublications: number;
  maxArticlesPerMonth: number | null;
  maxSalesPerMonth: number | null;
  highlights: string[];
}

interface SubscriptionOverview {
  publisherId: string;
  publisherName: string;
  plan: PlanInfo;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
  startedAt: string | null;
  renewsAt: string | null;
  overdue: boolean;
  graceDays: number;
  inGrace: boolean;
  blocked: boolean;
  usage: { publications: number; articlesThisMonth: number; salesThisMonth: number };
}

interface PublisherInvoiceRow {
  id: string;
  reference: string;
  planName: string;
  amountMinorUnits: number;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  periodStart: string;
  periodEnd: string;
  checkoutUrl: string | null;
  paidAt: string | null;
}

const money = (minor: number) => `${(minor / 100).toLocaleString('pt-MZ', { minimumFractionDigits: 0 })} MT`;

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export const PublishersPage: React.FC = () => {
  const { authFetch } = useAuth();
  const [publishers, setPublishers] = useState<PublisherDTO[]>([]);
  const [invites, setInvites] = useState<PublisherInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [inviteNote, setInviteNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);

  // Modal de plano/subscrição
  const [planTarget, setPlanTarget] = useState<PublisherDTO | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionOverview | null>(null);
  const [planCode, setPlanCode] = useState<'BASIC' | 'STANDARD' | 'PREMIUM'>('BASIC');
  const [planStatus, setPlanStatus] = useState<'ACTIVE' | 'PAST_DUE' | 'CANCELLED'>('ACTIVE');
  const [renewsAt, setRenewsAt] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [invoices, setInvoices] = useState<PublisherInvoiceRow[]>([]);
  const [invoiceBusy, setInvoiceBusy] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [publishersRes, invitesRes] = await Promise.all([
        authFetch('/api/v1/publishers'),
        authFetch('/api/v1/publishers/invites')
      ]);

      if (publishersRes.ok) {
        const data = await publishersRes.json();
        setPublishers(data.publishers || []);
      } else {
        throw new Error('Falha ao obter editoras.');
      }

      if (invitesRes.ok) {
        const data = await invitesRes.json();
        setInvites(data.invites || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGenerating(true);
      setError(null);
      const res = await authFetch('/api/v1/publishers/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: inviteNote || undefined })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || 'Falha ao gerar convite.');

      setLastCode(data.invite.code);
      setInviteNote('');
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const revokeInvite = async (invite: PublisherInvite) => {
    if (!confirm(`Anular o convite ${invite.code}?`)) return;
    try {
      setBusyId(invite.id);
      const res = await authFetch(`/api/v1/publishers/invites/${invite.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || 'Falha ao anular o convite.');
      }
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const openPlan = async (publisher: PublisherDTO) => {
    try {
      setPlanTarget(publisher);
      setSubscription(null);

      const [subRes, plansRes] = await Promise.all([
        authFetch(`/api/v1/publishers/${publisher.id}/subscription`),
        plans.length === 0 ? fetch('/api/v1/publishers/plans') : Promise.resolve(null)
      ]);

      if (plansRes && plansRes.ok) {
        const data = await plansRes.json();
        setPlans(data.plans || []);
      }

      if (!subRes.ok) {
        const data = await subRes.json().catch(() => null);
        throw new Error(data?.error?.message || 'Falha ao obter a subscrição.');
      }

      const data = await subRes.json();
      const sub: SubscriptionOverview = data.subscription;
      setSubscription(sub);
      setPlanCode(sub.plan.code);
      setPlanStatus(sub.status);
      setRenewsAt(sub.renewsAt ? sub.renewsAt.slice(0, 10) : '');

      const invoicesRes = await authFetch(`/api/v1/publishers/${publisher.id}/invoices`);
      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json();
        setInvoices(invoicesData.invoices || []);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const refreshSubscription = async (publisherId: string) => {
    const subRes = await authFetch(`/api/v1/publishers/${publisherId}/subscription`);
    if (subRes.ok) {
      const data = await subRes.json();
      setSubscription(data.subscription);
      setRenewsAt(data.subscription.renewsAt ? data.subscription.renewsAt.slice(0, 10) : '');
      setPlanStatus(data.subscription.status);
    }

    const invoicesRes = await authFetch(`/api/v1/publishers/${publisherId}/invoices`);
    if (invoicesRes.ok) {
      const data = await invoicesRes.json();
      setInvoices(data.invoices || []);
    }
  };

  const chargeNow = async () => {
    if (!planTarget) return;
    try {
      setInvoiceBusy(true);
      setError(null);
      const res = await authFetch(`/api/v1/publishers/${planTarget.id}/invoices`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || 'Falha ao criar a factura.');

      await refreshSubscription(planTarget.id);
      if (!data?.invoice?.checkoutUrl) {
        alert(
          `Factura ${data?.invoice?.reference || ''} criada, mas sem link de pagamento da PaySuite. ` +
            'Verifica as credenciais ou marca como paga manualmente.'
        );
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInvoiceBusy(false);
    }
  };

  const markInvoicePaid = async (invoice: PublisherInvoiceRow) => {
    if (!planTarget) return;
    if (!confirm(`Marcar a factura ${invoice.reference} como paga? A subscrição será renovada até ${formatDate(invoice.periodEnd)}.`)) {
      return;
    }
    try {
      setInvoiceBusy(true);
      setError(null);
      const res = await authFetch(`/api/v1/publishers/invoices/${invoice.id}/mark-paid`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || 'Falha ao marcar a factura como paga.');
      await refreshSubscription(planTarget.id);
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInvoiceBusy(false);
    }
  };

  const savePlan = async () => {
    if (!planTarget) return;
    try {
      setSavingPlan(true);
      setError(null);
      const res = await authFetch(`/api/v1/publishers/${planTarget.id}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planCode,
          status: planStatus,
          renewsAt: renewsAt ? new Date(`${renewsAt}T12:00:00`).toISOString() : null
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || 'Falha ao alterar o plano.');

      setPlanTarget(null);
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPlan(false);
    }
  };

  const toggleStatus = async (publisher: PublisherDTO) => {
    const isActive = publisher.status === 'ACTIVE';
    const nextStatus = isActive ? 'SUSPENDED' : 'ACTIVE';
    const confirmation = isActive
      ? `Suspender "${publisher.name}"? Os gestores deixam de conseguir publicar e vender.`
      : `Reativar "${publisher.name}"?`;
    if (!confirm(confirmation)) return;

    try {
      setBusyId(publisher.id);
      setError(null);
      const res = await authFetch(`/api/v1/publishers/${publisher.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || 'Falha ao alterar o estado da editora.');
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Editoras / Jornais</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Cada jornal cria a sua conta em{' '}
          <a href="/editora/registar" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>
            /editora/registar
          </a>{' '}
          com um código de convite. Aqui emites os códigos e fiscalizas as contas.
        </p>
      </div>

      {error && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-danger)', marginBottom: '20px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* ---------- Convites ---------- */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <KeyRound size={18} /> Códigos de convite
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '6px' }}>
          Cada código autoriza a criação de <strong>um</strong> jornal e fica marcado como usado.
        </p>

        <form onSubmit={generateInvite} style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            value={inviteNote}
            onChange={(e) => setInviteNote(e.target.value)}
            placeholder="Nota (opcional): ex. Jornal de Maputo"
            style={{ flex: '1 1 260px' }}
          />
          <button type="submit" className="btn btn-primary" disabled={generating}>
            <Plus size={16} />
            <span>{generating ? 'A gerar...' : 'Gerar convite'}</span>
          </button>
        </form>

        {lastCode && (
          <div
            style={{
              marginTop: '14px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                Convite criado — envia ao jornal
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, letterSpacing: '1px' }}>
                {lastCode}
              </div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigator.clipboard?.writeText(lastCode)}
              type="button"
            >
              <Copy size={14} />
              <span>Copiar</span>
            </button>
          </div>
        )}

        {invites.length > 0 && (
          <div style={{ marginTop: '18px' }}>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nota</th>
                    <th>Criado</th>
                    <th>Expira</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => (
                    <tr key={invite.id}>
                      <td>
                        <code style={{ fontSize: '12px' }}>{invite.code}</code>
                      </td>
                      <td style={{ fontSize: '13px' }}>{invite.note || '—'}</td>
                      <td style={{ fontSize: '13px' }}>{formatDate(invite.createdAt)}</td>
                      <td style={{ fontSize: '13px' }}>{formatDate(invite.expiresAt)}</td>
                      <td>
                        <span
                          className={`badge ${
                            invite.status === 'AVAILABLE'
                              ? 'badge-success'
                              : invite.status === 'USED'
                                ? 'badge-purple'
                                : 'badge-danger'
                          }`}
                        >
                          {invite.status === 'AVAILABLE' ? 'Disponível' : invite.status === 'USED' ? 'Usado' : 'Expirado'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {invite.status !== 'USED' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => revokeInvite(invite)}
                            disabled={busyId === invite.id}
                            style={{ color: 'var(--color-danger)' }}
                          >
                            <Trash2 size={14} />
                            <span>Anular</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ---------- Editoras ---------- */}
      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>A carregar editoras...</p>
      ) : publishers.length === 0 ? (
        <div className="card" style={{ color: 'var(--color-text-dim)', textAlign: 'center', padding: '40px 20px' }}>
          Ainda não existe nenhuma editora registada. Gera um convite e envia-o ao jornal.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome do Jornal / Editora</th>
                  <th>Identificador</th>
                  <th>Contactos</th>
                  <th>Publicações</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {publishers.map((pub) => {
                  const isActive = pub.status === 'ACTIVE';
                  return (
                    <tr key={pub.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--color-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                            <Building2 size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{pub.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>ID: {pub.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <code style={{ fontSize: '12px', padding: '2px 6px', background: 'var(--color-bg)', borderRadius: '4px' }}>{pub.slug}</code>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px' }}>
                          {pub.contactEmail && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Mail size={12} color="var(--color-text-dim)" /> {pub.contactEmail}
                            </div>
                          )}
                          {pub.contactPhone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <Phone size={12} color="var(--color-text-dim)" /> {pub.contactPhone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-purple">
                          <BookOpen size={12} /> {pub.publicationsCount || 0} títulos
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}>
                          {isActive ? 'Ativa' : 'Suspensa'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openPlan(pub)}
                          >
                            <BadgeCheck size={14} />
                            <span>Plano</span>
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => toggleStatus(pub)}
                            disabled={busyId === pub.id}
                            style={isActive ? { color: 'var(--color-danger)' } : undefined}
                          >
                            <Power size={14} />
                            <span>{busyId === pub.id ? 'A guardar...' : isActive ? 'Suspender' : 'Reativar'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- Modal de plano / subscrição ---------- */}
      {planTarget && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Subscrição — {planTarget.name}</h2>
                <p style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '2px' }}>
                  {subscription
                    ? `Em uso: ${subscription.usage.publications} título(s) · ${subscription.usage.articlesThisMonth} artigo(s) · ${subscription.usage.salesThisMonth} venda(s) este mês`
                    : 'A carregar...'}
                </p>
              </div>
              <button
                onClick={() => setPlanTarget(null)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <label className="form-label">Plano</label>
              <div style={{ display: 'grid', gap: '10px', marginTop: '8px' }}>
                {plans.map((plan) => {
                  const selected = plan.code === planCode;
                  return (
                    <button
                      key={plan.code}
                      type="button"
                      onClick={() => setPlanCode(plan.code)}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        backgroundColor: selected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '15px' }}>{plan.name}</strong>
                        <span style={{ fontSize: '14px', fontWeight: 700 }}>{money(plan.priceMinorUnits)}/mês</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        {plan.highlights.join(' · ')}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '18px' }}>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select
                    className="form-input"
                    value={planStatus}
                    onChange={(e) => setPlanStatus(e.target.value as any)}
                  >
                    <option value="ACTIVE">Ativo</option>
                    <option value="PAST_DUE">Pagamento em atraso</option>
                    <option value="CANCELLED">Cancelado</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Renova em</label>
                  <input
                    type="date"
                    className="form-input"
                    value={renewsAt}
                    onChange={(e) => setRenewsAt(e.target.value)}
                  />
                </div>
              </div>

              {/* Mensalidades */}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Mensalidades</h3>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
                      Criar factura gera também a cobrança na PaySuite (link M-Pesa/e-Mola).
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={chargeNow}
                    disabled={invoiceBusy}
                  >
                    <Plus size={14} />
                    <span>{invoiceBusy ? 'A processar...' : 'Cobrar agora'}</span>
                  </button>
                </div>

                {invoices.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '10px' }}>
                    Sem facturas emitidas.
                  </p>
                ) : (
                  <div className="table-container" style={{ marginTop: '12px' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Factura</th>
                          <th>Valor</th>
                          <th>Período</th>
                          <th>Estado</th>
                          <th style={{ textAlign: 'right' }}>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((invoice) => (
                          <tr key={invoice.id}>
                            <td>
                              <code style={{ fontSize: '11px' }}>{invoice.reference}</code>
                            </td>
                            <td style={{ fontSize: '12px', fontWeight: 600 }}>{money(invoice.amountMinorUnits)}</td>
                            <td style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              {formatDate(invoice.periodStart)} → {formatDate(invoice.periodEnd)}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  invoice.status === 'PAID'
                                    ? 'badge-success'
                                    : invoice.status === 'PENDING'
                                      ? 'badge-warning'
                                      : 'badge-danger'
                                }`}
                              >
                                {invoice.status === 'PAID' ? 'Paga' : invoice.status === 'PENDING' ? 'Pendente' : invoice.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                {invoice.status === 'PENDING' && invoice.checkoutUrl && (
                                  <a
                                    href={invoice.checkoutUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-secondary btn-sm"
                                  >
                                    Link
                                  </a>
                                )}
                                {invoice.status === 'PENDING' && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => markInvoicePaid(invoice)}
                                    disabled={invoiceBusy}
                                  >
                                    Marcar paga
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setPlanTarget(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={savePlan} disabled={savingPlan}>
                {savingPlan ? 'A guardar...' : 'Guardar plano'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
