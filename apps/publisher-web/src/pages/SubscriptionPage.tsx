import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BadgeCheck, AlertCircle, CalendarClock, FileText, Newspaper, ShoppingBag } from 'lucide-react';

interface SubscriptionPlan {
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
  plan: SubscriptionPlan;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
  startedAt: string | null;
  renewsAt: string | null;
  overdue: boolean;
  graceDays: number;
  inGrace: boolean;
  blocked: boolean;
  usage: { publications: number; articlesThisMonth: number; salesThisMonth: number };
  remaining: {
    publications: number | null;
    articlesThisMonth: number | null;
    salesThisMonth: number | null;
  };
}

interface Invoice {
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
  value ? new Date(value).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

const UsageBar: React.FC<{
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number | null;
}> = ({ icon, label, used, limit }) => {
  const unlimited = limit === null;
  const percent = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const danger = !unlimited && percent >= 100;
  const warning = !unlimited && percent >= 80 && percent < 100;

  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
          {icon} {label}
        </span>
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          <strong style={{ color: danger ? 'var(--color-danger)' : 'var(--color-text-main)' }}>{used}</strong>
          {' / '}
          {unlimited ? 'ilimitado' : limit}
        </span>
      </div>
      <div style={{ height: '8px', borderRadius: '999px', backgroundColor: 'var(--color-bg)', overflow: 'hidden' }}>
        <div
          style={{
            width: unlimited ? '100%' : `${percent}%`,
            height: '100%',
            borderRadius: '999px',
            backgroundColor: unlimited
              ? 'var(--color-surface-hover)'
              : danger
                ? 'var(--color-danger)'
                : warning
                  ? '#f59e0b'
                  : '#10b981',
            transition: 'width 0.3s ease'
          }}
        />
      </div>
    </div>
  );
};

export const SubscriptionPage: React.FC = () => {
  const { authFetch } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionOverview | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [subRes, plansRes, invoicesRes] = await Promise.all([
          authFetch('/api/v1/publishers/me/subscription'),
          fetch('/api/v1/publishers/plans'),
          authFetch('/api/v1/publishers/me/invoices')
        ]);

        if (!subRes.ok) {
          const data = await subRes.json().catch(() => null);
          throw new Error(data?.error?.message || 'Falha ao carregar a subscrição.');
        }

        const subData = await subRes.json();
        setSubscription(subData.subscription);

        if (plansRes.ok) {
          const plansData = await plansRes.json();
          setPlans(plansData.plans || []);
        }

        if (invoicesRes.ok) {
          const invoicesData = await invoicesRes.json();
          setInvoices(invoicesData.invoices || []);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <p style={{ color: 'var(--color-text-muted)' }}>A carregar subscrição...</p>;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Subscrição</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Plano do jornal, consumo do mês e limites de publicação e venda
        </p>
      </div>

      {error && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-danger)', marginBottom: '20px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {subscription && (
        <>
          {/* Avisos de estado */}
          {subscription.blocked && (
            <div
              className="card"
              style={{ borderColor: 'var(--color-danger)', marginBottom: '20px', display: 'flex', gap: '10px' }}
            >
              <AlertCircle size={20} color="var(--color-danger)" style={{ flexShrink: 0 }} />
              <div>
                <strong>Subscrição bloqueada.</strong> Publicação de títulos/artigos e novas vendas estão
                suspensas. Regulariza a mensalidade com a equipa VUKA para reactivar.
              </div>
            </div>
          )}

          {!subscription.blocked && subscription.inGrace && (
            <div
              className="card"
              style={{ borderColor: '#f59e0b', marginBottom: '20px', display: 'flex', gap: '10px' }}
            >
              <AlertCircle size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
              <div>
                <strong>Renovação em atraso ({subscription.graceDays} dias de carência).</strong> Ainda pode
                publicar e vender, mas após a carência a conta fica bloqueada.
              </div>
            </div>
          )}

          {/* Plano actual */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <BadgeCheck size={20} color="#10b981" />
                  <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Plano {subscription.plan.name}</h2>
                  <span className={`badge ${subscription.status === 'ACTIVE' && !subscription.overdue ? 'badge-success' : 'badge-danger'}`}>
                    {subscription.overdue ? 'Renovação em atraso' : subscription.status === 'ACTIVE' ? 'Ativo' : subscription.status}
                  </span>
                </div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '6px' }}>
                  {subscription.plan.tagline} · {money(subscription.plan.priceMinorUnits)} / mês
                </p>
              </div>

              <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                  <CalendarClock size={14} /> Próxima renovação: <strong>{formatDate(subscription.renewsAt)}</strong>
                </div>
                <div style={{ marginTop: '4px' }}>
                  Membro desde: {formatDate(subscription.startedAt)}
                </div>
              </div>
            </div>
          </div>

          {/* Consumo */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '18px' }}>Consumo deste mês</h2>
            <UsageBar
              icon={<Newspaper size={16} color="#60a5fa" />}
              label="Títulos publicados"
              used={subscription.usage.publications}
              limit={subscription.plan.maxPublications}
            />
            <UsageBar
              icon={<FileText size={16} color="#a78bfa" />}
              label="Artigos publicados este mês"
              used={subscription.usage.articlesThisMonth}
              limit={subscription.plan.maxArticlesPerMonth}
            />
            <UsageBar
              icon={<ShoppingBag size={16} color="#10b981" />}
              label="Vendas concluídas este mês"
              used={subscription.usage.salesThisMonth}
              limit={subscription.plan.maxSalesPerMonth}
            />
            <p style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '8px' }}>
              Ao atingir um limite, a publicação (ou a venda) é bloqueada até renovar o plano ou fazer upgrade.
            </p>
          </div>

          {/* Planos */}
          <div className="card">
            <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>Planos disponíveis</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '18px' }}>
              Para mudar de plano, contacte a equipa VUKA — a alteração é aplicada no painel administrativo.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              {plans.map((plan) => {
                const isCurrent = plan.code === subscription.plan.code;
                return (
                  <div
                    key={plan.code}
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isCurrent ? '#10b981' : 'var(--color-border)'}`,
                      backgroundColor: isCurrent ? 'rgba(16, 185, 129, 0.06)' : 'var(--color-surface)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 800 }}>{plan.name}</h3>
                      {isCurrent && <span className="badge badge-success">Actual</span>}
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, margin: '8px 0 2px' }}>
                      {money(plan.priceMinorUnits)}
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}> / mês</span>
                    </div>
                    <ul style={{ margin: '10px 0 0', paddingLeft: '18px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      {plan.highlights.map((item) => (
                        <li key={item} style={{ marginBottom: '4px' }}>{item}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Facturas */}
          <div className="card" style={{ marginTop: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>Mensalidades</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '16px' }}>
              Cada factura cobre um mês. As pendentes podem ser pagas por M-Pesa/e-Mola no link respectivo.
            </p>

            {invoices.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--color-text-dim)' }}>
                Ainda não existem mensalidades emitidas.
              </p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Factura</th>
                      <th>Plano</th>
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
                          <code style={{ fontSize: '12px' }}>{invoice.reference}</code>
                        </td>
                        <td style={{ fontSize: '13px' }}>{invoice.planName}</td>
                        <td style={{ fontSize: '13px', fontWeight: 600 }}>{money(invoice.amountMinorUnits)}</td>
                        <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
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
                            {invoice.status === 'PAID'
                              ? 'Paga'
                              : invoice.status === 'PENDING'
                                ? 'Pendente'
                                : invoice.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {invoice.status === 'PENDING' && invoice.checkoutUrl ? (
                            <a
                              href={invoice.checkoutUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-primary btn-sm"
                            >
                              Pagar
                            </a>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
                              {invoice.status === 'PAID' ? `Paga em ${formatDate(invoice.paidAt)}` : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
