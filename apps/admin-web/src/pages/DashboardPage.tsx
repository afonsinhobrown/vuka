import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { SalesReportDTO, formatMoney } from '@vuka/shared';
import { DollarSign, ShoppingCart, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { authFetch, isAdmin } = useAuth();
  const [report, setReport] = useState<SalesReportDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/v1/admin/reports/sales');
      if (!res.ok) throw new Error('Falha ao carregar métricas de vendas.');
      const data = await res.json();
      setReport(data.report);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--color-text-muted)', padding: '40px', textAlign: 'center' }}>A carregar métricas...</div>;
  }

  if (error || !report) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-danger)' }}>
        <AlertCircle size={20} />
        <span>{error || 'Não foi possível obter dados do relatório.'}</span>
      </div>
    );
  }

  const conversionRate = report.totalOrders > 0
    ? Math.round((report.paidOrders / report.totalOrders) * 100)
    : 0;

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Visão Geral de Vendas</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '4px' }}>
          {isAdmin ? 'Métricas globais consolidadas da plataforma VUKA' : 'Desempenho de vendas da sua editora'}
        </p>
      </div>

      {/* Stat Grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div>
            <div className="stat-label">Receita Total Confirmada</div>
            <div className="stat-val" style={{ color: '#60a5fa' }}>
              {formatMoney(report.totalRevenueMinorUnits, report.currency)}
            </div>
          </div>
          <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
            <DollarSign size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Pedidos Concluídos (Pagos)</div>
            <div className="stat-val" style={{ color: '#34d399' }}>
              {report.paidOrders}
            </div>
          </div>
          <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <CheckCircle size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Total de Intenções de Compra</div>
            <div className="stat-val">
              {report.totalOrders}
            </div>
          </div>
          <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}>
            <ShoppingCart size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Taxa de Conversão</div>
            <div className="stat-val" style={{ color: '#a78bfa' }}>
              {conversionRate}%
            </div>
          </div>
          <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' }}>
            <TrendingUp size={24} />
          </div>
        </div>
      </div>

      {/* Two columns: By Publication & By Publisher */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* By Publication */}
        <div className="card">
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Vendas por Publicação</h2>
          {report.byPublication.length === 0 ? (
            <p style={{ color: 'var(--color-text-dim)', fontSize: '14px' }}>Nenhuma venda registada até ao momento.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {report.byPublication.map((pub) => (
                <div key={pub.publicationId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{pub.publicationTitle}</div>
                    <div style={{ color: 'var(--color-text-dim)', fontSize: '12px', marginTop: '2px' }}>
                      {pub.ordersCount} {pub.ordersCount === 1 ? 'edição vendida' : 'edições vendidas'}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#60a5fa' }}>
                    {formatMoney(pub.revenueMinorUnits, report.currency)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Publisher (Only for admin or multiple) */}
        {isAdmin && (
          <div className="card">
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Vendas por Editora</h2>
            {report.byPublisher.length === 0 ? (
              <p style={{ color: 'var(--color-text-dim)', fontSize: '14px' }}>Nenhuma venda registada.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {report.byPublisher.map((pub) => (
                  <div key={pub.publisherId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{pub.publisherName}</div>
                      <div style={{ color: 'var(--color-text-dim)', fontSize: '12px', marginTop: '2px' }}>
                        {pub.ordersCount} pedidos pagos
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#34d399' }}>
                      {formatMoney(pub.revenueMinorUnits, report.currency)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
