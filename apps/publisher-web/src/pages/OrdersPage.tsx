import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { OrderDTO, formatMoney } from '@vuka/shared';
import { ShoppingBag, CheckCircle, Clock, XCircle, AlertTriangle, Play, ShieldAlert, X } from 'lucide-react';

export const OrdersPage: React.FC = () => {
  const { authFetch } = useAuth();
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Modal Manual Override
  const [overrideOrder, setOverrideOrder] = useState<OrderDTO | null>(null);
  const [newStatus, setNewStatus] = useState('PAID');
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [filterStatus]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const url = filterStatus ? `/api/v1/orders?status=${filterStatus}` : '/api/v1/orders';
      const res = await authFetch(url);
      if (!res.ok) throw new Error('Falha ao obter lista de pedidos.');
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePayment = async (orderRef: string) => {
    try {
      const res = await authFetch('/api/v1/whatsapp/simulate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderReference: orderRef })
      });
      if (!res.ok) throw new Error('Falha ao simular pagamento.');
      alert(`✅ Pagamento simulado com sucesso para ${orderRef}! O direito de acesso foi concedido.`);
      await loadOrders();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleManualOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideOrder) return;

    setProcessing(true);
    try {
      const res = await authFetch('/api/v1/payments/manual-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: overrideOrder.id,
          newStatus,
          reason
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Falha na reconciliação manual.');
      }

      setOverrideOrder(null);
      await loadOrders();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Pedidos & Transações</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Compras da sua editora em tempo real e estados de pagamento
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <select
            className="form-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="">Todos os Estados</option>
            <option value="PENDING_PAYMENT">Pendente</option>
            <option value="PAID">Pago (Concluído)</option>
            <option value="FAILED">Falhado</option>
            <option value="EXPIRED">Expirado</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>A carregar pedidos...</p>
      ) : orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-dim)' }}>
          Nenhum pedido encontrado. Inicie uma compra no simulador de WhatsApp para gerar pedidos!
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Referência</th>
                  <th>Contacto do Comprador</th>
                  <th>Oferta / Produto</th>
                  <th>Valor Congelado</th>
                  <th>Data do Pedido</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <code style={{ fontWeight: 700, fontSize: '13px', color: '#60a5fa' }}>{order.publicReference}</code>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{order.buyerContact}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>Canal: WhatsApp</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{order.offerTitle}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>
                        {formatMoney(order.totalMinorUnits, order.currency)}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
                        {new Date(order.createdAt).toLocaleString('pt-MZ')}
                      </div>
                    </td>
                    <td>
                      {order.status === 'PAID' && <span className="badge badge-success"><CheckCircle size={12} /> Pago</span>}
                      {order.status === 'PENDING_PAYMENT' && <span className="badge badge-warning"><Clock size={12} /> Pendente</span>}
                      {order.status === 'FAILED' && <span className="badge badge-danger"><XCircle size={12} /> Falhado</span>}
                      {order.status === 'EXPIRED' && <span className="badge badge-danger"><AlertTriangle size={12} /> Expirado</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        {order.status === 'PENDING_PAYMENT' && (
                          <button
                            className="btn btn-primary btn-sm"
                            title="Simula a confirmação via webhook de pagamento"
                            onClick={() => handleSimulatePayment(order.publicReference)}
                          >
                            <Play size={12} /> Simular Pagamento
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Correção Manual com Auditoria Obrigatória (RB-07, CA-09) */}
      {overrideOrder && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Correção Manual de Pagamento (Auditada)</h2>
              <button onClick={() => setOverrideOrder(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleManualOverride}>
              <div className="modal-body">
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                  Pedido: <strong>{overrideOrder.publicReference}</strong> ({overrideOrder.buyerContact})
                </p>

                <div className="form-group">
                  <label className="form-label">Novo Estado do Pedido</label>
                  <select className="form-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                    <option value="PAID">PAID (Confirmar pagamento e conceder acesso)</option>
                    <option value="REFUNDED">REFUNDED (Reembolsado - revoga acesso)</option>
                    <option value="FAILED">FAILED (Transação falhada)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Justificação Obrigatória (Registo de Auditoria)</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="ex: Comprovativo validado diretamente com o extrato bancário M-Pesa pelo operador..."
                    required
                  />
                  <small style={{ color: 'var(--color-warning)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                    Esta ação fica permanentemente gravada na tabela de auditoria com a sua identidade e timestamp.
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setOverrideOrder(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={processing}>
                  {processing ? 'A processar...' : 'Confirmar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
