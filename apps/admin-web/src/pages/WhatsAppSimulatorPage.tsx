import React, { useState } from 'react';
import { Send, Smartphone, CheckCheck, RefreshCw, CreditCard, Sparkles } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  orderRef?: string;
}

export const WhatsAppSimulatorPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bot',
      text: 'Olá! Bem-vindo à VUKA. Digite *MENU* para ver as publicações disponíveis.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('menu');
  const [phone, setPhone] = useState('258841234567');
  const [sending, setSending] = useState(false);
  const [lastOrderRef, setLastOrderRef] = useState<string | null>(null);

  const sendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setSending(true);

    try {
      const res = await fetch('/api/v1/whatsapp/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: phone, text })
      });

      const data = await res.json();

      if (data.orderReference) {
        setLastOrderRef(data.orderReference);
      }

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: data.reply || 'Erro ao processar mensagem.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        orderRef: data.orderReference
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const simulatePayment = async (orderRef: string) => {
    try {
      const res = await fetch('/api/v1/whatsapp/simulate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderReference: orderRef })
      });

      const data = await res.json();

      const notifyMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        sender: 'bot',
        text: data.messageToUser,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, notifyMsg]);
      setLastOrderRef(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Simulador Interativo do Canal WhatsApp</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Teste em tempo real o fluxo conversacional de compra, criação de pedido, congelamento de preço e notificação pós-pagamento
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '32px', alignItems: 'start' }}>
        {/* Info & Guides */}
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="#f59e0b" /> Como funciona o fluxo do WhatsApp:
            </h2>
            <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li>
                <strong style={{ color: 'var(--color-text-main)' }}>Passo 1 (Menu):</strong> O leitor envia <code>MENU</code> ou <code>OLA</code> e o sistema apresenta as publicações ativas.
              </li>
              <li>
                <strong style={{ color: 'var(--color-text-main)' }}>Passo 2 (Escolha do Jornal):</strong> O leitor responde com o número (ex: <code>1</code> para Jornal Notícias, <code>2</code> para Savana).
              </li>
              <li>
                <strong style={{ color: 'var(--color-text-main)' }}>Passo 3 (Seleção da Oferta):</strong> O leitor escolhe edição avulsa ou assinatura. O pedido é gerado na BD com código <code>VUKA-XXXXXX</code> e preço congelado em Meticais.
              </li>
              <li>
                <strong style={{ color: 'var(--color-text-main)' }}>Passo 4 (Confirmação & Acesso):</strong> Ao pagar (ou clicar em <em>Simular Pagamento</em>), o webhook idempotente é acionado e a edição aparece imediatamente na App do Leitor!
              </li>
            </ol>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>Configuração do Leitor Simulado</h3>
            <div className="form-group">
              <label className="form-label">Número de Telefone de Teste</label>
              <input
                type="text"
                className="form-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="258841234567"
              />
              <small style={{ color: 'var(--color-text-dim)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Cada número mantém a sua própria sessão conversacional no adaptador.
              </small>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setMessages([]);
                  sendMessage('menu');
                }}
              >
                <RefreshCw size={14} /> Reiniciar Conversa
              </button>
            </div>
          </div>
        </div>

        {/* WhatsApp Phone Mockup */}
        <div style={{
          width: '420px',
          height: '620px',
          backgroundColor: '#0b141a',
          borderRadius: '32px',
          border: '10px solid #1f2937',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Phone Header */}
          <div style={{
            backgroundColor: '#202c33',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '1px solid #2a3942'
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: '#00a884',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '16px'
            }}>
              V
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#e9edef' }}>VUKA Banca Digital</div>
              <div style={{ fontSize: '11px', color: '#8696a0' }}>Online • Conta Comercial Oficial</div>
            </div>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 0)',
            backgroundSize: '16px 16px'
          }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  backgroundColor: msg.sender === 'user' ? '#005c4b' : '#202c33',
                  color: '#e9edef',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  borderTopRightRadius: msg.sender === 'user' ? '0' : '10px',
                  borderTopLeftRadius: msg.sender === 'bot' ? '0' : '10px',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}
              >
                <div>{msg.text}</div>
                <div style={{
                  fontSize: '10px',
                  color: '#8696a0',
                  textAlign: 'right',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '4px'
                }}>
                  <span>{msg.time}</span>
                  {msg.sender === 'user' && <CheckCheck size={13} color="#53bdeb" />}
                </div>

                {msg.orderRef && (
                  <button
                    onClick={() => simulatePayment(msg.orderRef!)}
                    style={{
                      marginTop: '8px',
                      width: '100%',
                      padding: '8px',
                      backgroundColor: '#00a884',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <CreditCard size={14} /> Pagar Agora (Simular M-Pesa)
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Phone Input Bar */}
          <div style={{
            backgroundColor: '#202c33',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderTop: '1px solid #2a3942'
          }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Escreva uma mensagem..."
              style={{
                flex: 1,
                backgroundColor: '#2a3942',
                border: 'none',
                borderRadius: '20px',
                padding: '10px 16px',
                color: '#e9edef',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={sending}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#00a884',
                border: 'none',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
