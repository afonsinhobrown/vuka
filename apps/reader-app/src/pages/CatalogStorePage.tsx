import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReaderAuth } from '../context/ReaderAuthContext';
import { formatMoney } from '../shared/currency';
import {
  BookOpen,
  ShoppingBag,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Smartphone,
  X,
  Loader2,
  ExternalLink
} from 'lucide-react';

export const CatalogStorePage: React.FC = () => {
  const { user } = useReaderAuth();
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Web Checkout Modal State
  const [selectedOffer, setSelectedOffer] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'emola' | 'credit_card'>('mpesa');
  const [buyerPhone, setBuyerPhone] = useState(user?.phone || '');
  const [processing, setProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any | null>(null);
  const [paidSuccess, setPaidSuccess] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    if (user?.phone && !buyerPhone) {
      setBuyerPhone(user.phone);
    }
  }, [user]);

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

  // 1. Iniciar compra direta na Web via PaySuite
  const handlePay = async () => {
    if (!selectedOffer) return;
    if ((paymentMethod === 'mpesa' || paymentMethod === 'emola') && !buyerPhone.trim()) {
      alert('Por favor insira o seu número de telemóvel para receber o pedido de pagamento.');
      return;
    }

    setProcessing(true);
    try {
      // 1.1 Cria o pedido no canal WEB
      const orderRes = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: selectedOffer.id,
          buyerContact: buyerPhone,
          channel: 'web'
        })
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error?.message || 'Erro ao criar pedido.');
      }

      const order = orderData.order;

      // 1.2 Dispara o pagamento no PaySuite
      const payRes = await fetch('/api/v1/payments/paysuite/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          method: paymentMethod,
          phoneNumber: buyerPhone,
          returnUrl: `${window.location.origin}/library`
        })
      });

      const payData = await payRes.json();
      if (!payRes.ok) {
        throw new Error(payData.error?.message || 'Falha ao iniciar pagamento com PaySuite.');
      }

      setPaymentResult({
        ...payData.payment,
        orderReference: order.publicReference,
        orderId: order.id
      });

      // Se for Cartão e tiver link de checkout, pode redirecionar ou abrir
      if (payData.payment.checkoutUrl && paymentMethod === 'credit_card') {
        window.open(payData.payment.checkoutUrl, '_blank');
      }

      // Inicia polling para verificar se o pagamento foi concluído
      startStatusPolling(order.publicReference);
    } catch (err: any) {
      alert(err.message || 'Erro durante o processo de pagamento.');
    } finally {
      setProcessing(false);
    }
  };

  // Polling para detetar aprovação automática via Webhook do PaySuite
  const startStatusPolling = (orderReference: string) => {
    setCheckingStatus(true);
    let attempts = 0;
    const maxAttempts = 30; // 30 tentativas * 3s = 90 segundos

    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/v1/orders/ref/${orderReference}`);
        if (res.ok) {
          const data = await res.json();
          if (data.order?.status === 'PAID') {
            clearInterval(interval);
            setCheckingStatus(false);
            setPaidSuccess(true);
            return;
          }
        }
      } catch (e) {
        // ignora erros de polling momentâneos
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setCheckingStatus(false);
      }
    }, 3000);
  };

  const handleSimulateInstantConfirm = async () => {
    if (!paymentResult?.orderReference) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/v1/whatsapp/simulate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderReference: paymentResult.orderReference })
      });
      if (res.ok) {
        setPaidSuccess(true);
      } else {
        alert('Falha ao confirmar transação de teste.');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const resetModal = () => {
    setSelectedOffer(null);
    setPaymentResult(null);
    setPaidSuccess(false);
    setCheckingStatus(false);
  };

  return (
    <div className="reader-app-layout">
      {/* App Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/library')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-main)',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800 }}>Banca Digital VUKA</h1>
            <p style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
              Compre e leia edições diretamente no navegador
            </p>
          </div>
        </div>

        {/* Entrada para os jornais/editoras */}
        <a
          href="/editora"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            textDecoration: 'none',
            border: '1px solid var(--color-border)',
            borderRadius: '999px',
            padding: '6px 12px',
            whiteSpace: 'nowrap'
          }}
        >
          É um jornal? Publique aqui →
        </a>
      </header>

      <main style={{ padding: '20px' }}>
        {/* Banner informativo da Web */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(16, 185, 129, 0.15))',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              flexShrink: 0
            }}
          >
            <Smartphone size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 700 }}>Pagamento Instantâneo via PaySuite</h2>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Pague com <strong>M-Pesa</strong>, <strong>e-Mola</strong> ou <strong>Cartão</strong> diretamente na Web.
            </p>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px' }}>
            A carregar a banca...
          </p>
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
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800 }}>{pub.title}</h3>
                  <p style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 600 }}>{pub.publisherName}</p>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '18px' }}>
                  {pub.description}
                </p>

                {/* Available Offers for this Publication */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '12px'
                  }}
                >
                  {pub.offers?.map((offer: any) => (
                    <div
                      key={offer.id}
                      style={{
                        padding: '16px',
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-text-dim)',
                            textTransform: 'uppercase',
                            fontWeight: 700
                          }}
                        >
                          {offer.type === 'SINGLE_EDITION' ? 'Edição Avulsa' : 'Assinatura'}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '15px', marginTop: '2px', marginBottom: '6px' }}>
                          {offer.title}
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 900, color: '#10b981', marginBottom: '14px' }}>
                          {formatMoney(offer.priceMinorUnits, offer.currency)}
                        </div>
                      </div>

                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', fontSize: '13px', padding: '10px' }}
                        onClick={() => setSelectedOffer(offer)}
                      >
                        <CreditCard size={16} />
                        <span>Comprar Agora</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Checkout Web Direto (PaySuite) */}
      {selectedOffer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(6px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              maxWidth: '440px',
              width: '100%',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} color="#10b981" />
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Pagamento na Web</h3>
              </div>
              <button
                onClick={resetModal}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              {!paymentResult ? (
                <div>
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Item a pagar
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px' }}>
                      {selectedOffer.title}
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
                      {formatMoney(selectedOffer.priceMinorUnits, selectedOffer.currency)}
                    </div>
                  </div>

                  {/* Seleção de Método de Pagamento */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-dim)', marginBottom: '8px', textTransform: 'uppercase' }}>
                      Escolha o Método
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('mpesa')}
                        style={{
                          padding: '10px 8px',
                          borderRadius: 'var(--radius-md)',
                          border: `2px solid ${paymentMethod === 'mpesa' ? '#ef4444' : 'var(--color-border)'}`,
                          backgroundColor: paymentMethod === 'mpesa' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                          color: 'var(--color-text-main)',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '13px'
                        }}
                      >
                        🔴 M-Pesa
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('emola')}
                        style={{
                          padding: '10px 8px',
                          borderRadius: 'var(--radius-md)',
                          border: `2px solid ${paymentMethod === 'emola' ? '#eab308' : 'var(--color-border)'}`,
                          backgroundColor: paymentMethod === 'emola' ? 'rgba(234, 179, 8, 0.1)' : 'transparent',
                          color: 'var(--color-text-main)',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '13px'
                        }}
                      >
                        🟡 e-Mola
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('credit_card')}
                        style={{
                          padding: '10px 8px',
                          borderRadius: 'var(--radius-md)',
                          border: `2px solid ${paymentMethod === 'credit_card' ? '#3b82f6' : 'var(--color-border)'}`,
                          backgroundColor: paymentMethod === 'credit_card' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                          color: 'var(--color-text-main)',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '13px'
                        }}
                      >
                        💳 Cartão
                      </button>
                    </div>
                  </div>

                  {/* Número de Telefone para M-Pesa ou E-Mola */}
                  {(paymentMethod === 'mpesa' || paymentMethod === 'emola') && (
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                        Número de Telemóvel ({paymentMethod === 'mpesa' ? 'Vodacom' : 'Movitel'})
                      </label>
                      <input
                        type="tel"
                        className="form-input"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                        placeholder="Ex: 841234567"
                        style={{ fontSize: '15px', letterSpacing: '0.5px' }}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--color-text-dim)', marginTop: '4px', display: 'block' }}>
                        Receberá um alerta no ecrã do seu telemóvel para digitar o seu PIN.
                      </span>
                    </div>
                  )}

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '14px', fontSize: '14px', fontWeight: 700 }}
                    onClick={handlePay}
                    disabled={processing}
                  >
                    {processing ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <Loader2 size={18} className="animate-spin" /> A comunicar com PaySuite...
                      </span>
                    ) : (
                      `Pagar ${formatMoney(selectedOffer.priceMinorUnits, selectedOffer.currency)} via PaySuite`
                    )}
                  </button>
                </div>
              ) : !paidSuccess ? (
                <div>
                  <div
                    style={{
                      padding: '18px',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid #10b981',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '20px',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Pedido Iniciado no PaySuite
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: '#f8fafc', letterSpacing: '1px', margin: '8px 0' }}>
                      {paymentResult.orderReference}
                    </div>
                    <div style={{ fontSize: '14px', color: '#10b981', fontWeight: 700 }}>
                      Valor: {paymentResult.amount} MZN
                    </div>
                  </div>

                  {checkingStatus ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                      <Loader2 size={20} color="#60a5fa" className="animate-spin" />
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                        A aguardar que digite o PIN no seu telemóvel...
                      </span>
                    </div>
                  ) : null}

                  {paymentResult.checkoutUrl && (
                    <a
                      href={paymentResult.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ width: '100%', padding: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <span>Abrir Tela de Pagamento PaySuite</span>
                      <ExternalLink size={16} />
                    </a>
                  )}

                  {/* Botão de simulação/teste em ambiente de desenvolvimento */}
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '12px', fontSize: '13px' }}
                    onClick={handleSimulateInstantConfirm}
                    disabled={processing}
                  >
                    {processing ? 'A confirmar...' : '⚡ Confirmar Pagamento Imediatamente (Modo Teste)'}
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <CheckCircle2 size={56} color="#10b981" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Pagamento Confirmado!</h3>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: '8px 0 24px' }}>
                    A transação foi aprovada pelo PaySuite. A sua edição já está disponível para leitura.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '14px', fontWeight: 700 }}
                    onClick={() => {
                      resetModal();
                      navigate('/library');
                    }}
                  >
                    Abrir Minha Edição na Biblioteca
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
