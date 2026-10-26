import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuditEventDTO } from '@vuka/shared';
import { FileCheck2, User, Clock, AlertCircle } from 'lucide-react';

export const AuditPage: React.FC = () => {
  const { authFetch } = useAuth();
  const [events, setEvents] = useState<AuditEventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/v1/admin/reports/audit?limit=100');
      if (!res.ok) throw new Error('Falha ao obter eventos de auditoria.');
      const data = await res.json();
      setEvents(data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'PRICE_CHANGE':
        return <span className="badge badge-warning">Alteração de Preço</span>;
      case 'MANUAL_PAYMENT_OVERRIDE':
        return <span className="badge badge-danger">Ajuste Manual</span>;
      case 'PUBLISH':
        return <span className="badge badge-success">Publicação</span>;
      case 'WITHDRAW':
        return <span className="badge badge-danger">Retirada</span>;
      case 'GRANT_ENTITLEMENT':
        return <span className="badge badge-success">Concessão Acesso</span>;
      default:
        return <span className="badge badge-purple">{action}</span>;
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Trilha de Auditoria Imutável</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Registo de operações sensíveis, alterações de preço, publicações e concessões manuais (RF-15 e RB-07)
        </p>
      </div>

      {error && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-danger)', marginBottom: '20px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>A carregar registos de auditoria...</p>
      ) : events.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-dim)' }}>
          Nenhum evento de auditoria registado até ao momento.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data e Hora</th>
                  <th>Ação Registada</th>
                  <th>Operador / Ator</th>
                  <th>Entidade Alvo</th>
                  <th>Justificação / Motivo</th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt) => (
                  <tr key={evt.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-dim)' }}>
                        <Clock size={13} />
                        <span>{new Date(evt.createdAt).toLocaleString('pt-MZ')}</span>
                      </div>
                    </td>
                    <td>{getActionBadge(evt.action)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <User size={14} color="#60a5fa" />
                        <span>{evt.actorName || (evt as any).actor?.displayName || 'Sistema / API'}</span>
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: '12px', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px' }}>
                        {evt.entityType}:{evt.entityId.slice(0, 8)}...
                      </code>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-main)' }}>
                        {evt.reason || 'Sem justificação'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
