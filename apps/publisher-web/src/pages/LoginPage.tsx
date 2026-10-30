import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Newspaper, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { UserRole } from '@vuka/shared';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('gestor@noticias.co.mz');
  const [password, setPassword] = useState('editora123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Falha ao autenticar.');
      }

      const role = data.user?.role;
      if (role !== UserRole.PUBLISHER_ADMIN && role !== UserRole.PUBLISHER_EDITOR) {
        throw new Error('Esta conta não é de gestor de editora. Utilize o painel administrativo VUKA.');
      }

      if (!data.user?.publisherId) {
        throw new Error('A conta não está associada a nenhuma editora.');
      }

      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setDemoAccount = (email: string, pass: string) => {
    setIdentifier(email);
    setPassword(pass);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(ellipse at top, #0f2e2a, #0b0f19)'
    }}>
      <div style={{ maxWidth: '440px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #10b981, #0d9488)',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
            marginBottom: '16px'
          }}>
            <Newspaper size={30} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>VUKA Editora</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '6px' }}>
            Portal do criador do jornal: publicações, edições e vendas
          </p>
        </div>

        <div className="card" style={{ padding: '32px' }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              backgroundColor: 'var(--color-danger-bg)',
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

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email do Gestor</label>
              <input
                type="text"
                className="form-input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="ex: gestor@noticias.co.mz"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Palavra-passe</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
              disabled={loading}
            >
              {loading ? 'A autenticar...' : (
                <>
                  <span>Entrar no Portal da Editora</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
            <p style={{ fontSize: '12px', color: 'var(--color-text-dim)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '10px' }}>
              Editoras de Teste:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDemoAccount('gestor@noticias.co.mz', 'editora123')}
                style={{ justifyContent: 'flex-start', fontSize: '12px' }}
              >
                <CheckCircle2 size={14} color="#10b981" />
                <span>Sociedade do Notícias (gestor@noticias.co.mz)</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDemoAccount('gestor@mediacoop.co.mz', 'editora123')}
                style={{ justifyContent: 'flex-start', fontSize: '12px' }}
              >
                <CheckCircle2 size={14} color="#10b981" />
                <span>Mediacoop / Savana (gestor@mediacoop.co.mz)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
