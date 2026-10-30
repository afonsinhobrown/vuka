import React, { useState } from 'react';
import { useReaderAuth } from '../context/ReaderAuthContext';
import { useNavigate } from 'react-router-dom';
import { Newspaper, Smartphone, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

export const ReaderLoginPage: React.FC = () => {
  const { login } = useReaderAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('258841234567');
  const [password, setPassword] = useState('leitor123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: phone, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Falha ao autenticar.');

      login(data.token, data.user);
      navigate('/library');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loginDemoAccount = async () => {
    setPhone('258841234567');
    setPassword('leitor123');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: '258841234567', password: 'leitor123' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Erro');
      login(data.token, data.user);
      navigate('/library');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(circle at top, #161e31, #090d16)'
    }}>
      <div style={{ maxWidth: '400px', width: '100%', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)'
          }}>
            <Newspaper size={32} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>VUKA</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '15px', marginTop: '4px' }}>
            A Sua Biblioteca Digital de Jornais e Revistas
          </p>
        </div>

        <div style={{
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px'
        }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--color-danger)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-danger)',
              fontSize: '13px',
              marginBottom: '20px'
            }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                Número de Telefone (WhatsApp)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="258841234567"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text-main)',
                    fontSize: '15px',
                    outline: 'none'
                  }}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                Código ou Palavra-passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-main)',
                  fontSize: '15px',
                  outline: 'none'
                }}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '15px' }}
              disabled={loading}
            >
              <span>{loading ? 'A entrar...' : 'Entrar na Minha Biblioteca'}</span>
              <ArrowRight size={18} />
            </button>
          </form>

          <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--color-border)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loginDemoAccount}
              style={{ width: '100%', fontSize: '13px' }}
            >
              <ShieldCheck size={16} color="#34d399" />
              <span>Acesso Imediato com Leitor Piloto</span>
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => navigate('/store')}
            style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            Ver Catálogo de Jornais Disponíveis ↗
          </button>
          <a
            href="/admin"
            style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}
          >
            Acesso ao Painel Administrativo ↗
          </a>
          <a
            href="/editora"
            style={{ background: 'none', border: 'none', color: '#34d399', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}
          >
            É um jornal? Entrar no Portal da Editora ↗
          </a>
        </div>
      </div>
    </div>
  );
};
