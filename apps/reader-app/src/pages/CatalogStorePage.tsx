import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReaderAuth } from '../context/ReaderAuthContext';
import { formatMoney } from '@vuka/shared';
import { BookOpen, ShoppingBag, MessageCircle, ArrowLeft, CheckCircle2, CreditCard, Sparkles, X } from 'lucide-react';

export const CatalogStorePage: React.FC = () => {
  const { user } = useReaderAuth();
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // WhatsApp Checkout Modal
  const [selectedOffer, setSelectedOffer] = useState<any | null>(null);
  const [buyerPhone, setBuyerPhone] = useState(user?.phone || '258841234567');
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paidSuccess, setPaidSuccess] = useState(false);

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/catalog');
      const data = await res.json();
      setCatalog(data.catalog || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartOrder = async () => {
    if (!selectedOffer) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: selectedOffer.id,
          buyerContact: buyerPhone,
          channel: 'whatsapp'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Erro ao criar pedido.');
      setCreatedOrder(data.order);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!createdOrder) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/v1/whatsapp/simulate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderReference: createdOrder.publicReference })
      });

      if (!res.ok) throw new Error('Falha ao confirmar pagamento.');
      setPaidSuccess(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const resetModal = () => {
    setSelectedOffer(null);
    setCreatedOrder(null);
    setPaidSuccess(false);
  };

  return (
    <div className="reader-app-layout">
      {/* App Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/library')}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-main)', cursor: 'pointer', padding: '4px' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800 }}>Banca Digital VUKA</h1>
            <p style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>Jornais e Revistas em Moçambique</p>
          </div>
        </div>
      </header>

      <main style={{ padding: '20px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.2), rgba(124, 58, 237, 0.2))',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            backgroundColor: '#00a884',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            flexShrink: 0
          }}>
            <MessageCircle size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Venda Direta via WhatsApp</h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Escolha uma edição abaixo para comprar e receber o acesso imediato via M-Pesa ou E-Mola.
            </p>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px' }}>A carregar a banca...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {catalog.map((pub) => (
              <div
                key={pub.id}
                style={{
                  backgroundColor: 'var(--color-surface-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800 }}>{pub.title}</h3>
                    <p style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 600 }}>{pub.publisherName}</p>
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '18px' }}>
                  {pub.description}
                </p>

                {/* Available Offers for this Publication */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  {pub.offers?.map((offer: any) => (
                    <div
                      key={offer.id}
                      style={{
                        padding: '14px',
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                          {offer.type === 'SINGLE_EDITION' ? 'Edição Avulsa' : 'Assinatura'}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '15px', marginTop: '2px', marginBottom: '6px' }}>
                          {offer.title}
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#34d399', marginBottom: '14px' }}>
                          {formatMoney(offer.priceMinorUnits, offer.currency)}
                        </div>
                      </div>

                      <button
                        className="btn btn-whatsapp"
                        style={{ width: '100%', fontSize: '13px', padding: '10px' }}
                        onClick={() => setSelectedOffer(offer)}
                      >
                        <MessageCircle size={16} />
                        <span>Comprar no WhatsApp</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Checkout WhatsApp */}
      {selectedOffer && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(6px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            maxWidth: '440px',
            width: '100%',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              backgroundColor: '#1f2a40',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageCircle size={18} color="#00a884" />
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Compra via WhatsApp</h3>
              </div>
              <button onClick={resetModal} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              {!createdOrder ? (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Oferta Selecionada</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px' }}>{selectedOffer.title}</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
                      {formatMoney(selectedOffer.priceMinorUnits, selectedOffer.currency)}
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                      Seu Número de WhatsApp (Moçambique)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      placeholder="258841234567"
                    />
                  </div>

                  <button
                    className="btn btn-whatsapp"
                    style={{ width: '100%', padding: '14px' }}
                    onClick={handleStartOrder}
                    disabled={processing}
                  >
                    <span>{processing ? 'A gerar pedido...' : 'Gerar Pedido e Referência'}</span>
                  </button>
                </div>
              ) : !paidSuccess ? (
                <div>
                  <div style={{
                    padding: '16px',
                    backgroundColor: 'rgba(0, 168, 132, 0.1)',
                    border: '1px solid #00a884',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '20px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '12px', color: '#00a884', fontWeight: 700 }}>REFERÊNCIA DE PAGAMENTO GERADA</div>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: '#f8fafc', letterSpacing: '1px', margin: '6px 0' }}>
                      {createdOrder.publicReference}
                    </div>
                    <div style={{ fontSize: '15px', color: '#34d399', fontWeight: 700 }}>
                      Valor: {formatMoney(createdOrder.totalMinorUnits, createdOrder.currency)}
                    </div>
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.4', marginBottom: '20px' }}>
                    No seu telefone M-Pesa ou E-Mola, transfira o valor indicando a referência acima.
                  </p>

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '14px' }}
                    onClick={handleSimulatePayment}
                    disabled={processing}
                  >
                    <CreditCard size={18} />
                    <span>{processing ? 'A validar transação...' : 'Simular Pagamento Confirmado'}</span>
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <CheckCircle2 size={54} color="#34d399" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Acesso Concedido!</h3>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: '8px 0 24px' }}>
                    O pagamento foi reconciliado e a sua nova edição já se encontra disponível na biblioteca.
                  </p>
                  <button
                    className="btn btn-whatsapp"
                    style={{ width: '100%', padding: '14px' }}
                    onClick={() => {
                      resetModal();
                      navigate('/library');
                    }}
                  >
                    Abrir na Minha Biblioteca
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <div className="nav-item" onClick={() => navigate('/library')} style={{ cursor: 'pointer' }}>
          <BookOpen size={20} />
          <span>Biblioteca</span>
        </div>
        <div className="nav-item active">
          <ShoppingBag size={20} />
          <span>Banca</span>
        </div>
      </nav>
    </div>
  );
};
