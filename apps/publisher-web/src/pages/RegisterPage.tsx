import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Newspaper, ArrowRight, AlertCircle, ArrowLeft } from 'lucide-react';

/**
 * Auto-registo de um jornal: cria a editora e a conta do gestor sem passar
 * pelo administrador da plataforma.
 */
export const RegisterPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [publisherName, setPublisherName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [slugPreview, setSlugPreview] = useState('');

  const handlePublisherName = (value: string) => {
    setPublisherName(value);
    setSlugPreview(
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('A palavra-passe deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As palavras-passe não coincidem.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/v1/publishers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publisherName,
          adminName,
          adminEmail,
          adminPhone,
          password,
          inviteCode
        })
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Não foi possível criar a conta do jornal.');
      }

      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'radial-gradient(ellipse at top, #0f2e2a, #0b0f19)'
      }}
    >
      <div style={{ maxWidth: '520px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #10b981, #0d9488)',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
              marginBottom: '16px'
            }}
          >
            <Newspaper size={30} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.5px' }}>Criar conta do jornal</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '6px' }}>
            Publique edições, defina preços e acompanhe as suas vendas
          </p>
        </div>

        <div className="card" style={{ padding: '32px' }}>
          {error && (
            <div
              style={{
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
              }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Código de convite</label>
              <input
                type="text"
                className="form-input"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="VUKA-XXXX-XXXX"
                style={{ letterSpacing: '1px', fontFamily: 'monospace' }}
                required
              />
              <small style={{ color: 'var(--color-text-dim)', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                Fornecido pela equipa VUKA. Cada código só pode ser usado uma vez.
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Nome do jornal / publicação</label>
              <input
                type="text"
                className="form-input"
                value={publisherName}
                onChange={(e) => handlePublisherName(e.target.value)}
                placeholder="ex: Jornal de Maputo"
                required
              />
              {slugPreview && (
                <small style={{ color: 'var(--color-text-dim)', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                  Identificador público: <code>{slugPreview}</code>
                </small>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Nome do responsável</label>
              <input
                type="text"
                className="form-input"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="ex: Ana Macuácua"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email de acesso</label>
              <input
                type="email"
                className="form-input"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="ex: direcao@jornal.co.mz"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Telefone (opcional)</label>
              <input
                type="text"
                className="form-input"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="ex: 258841234567"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Palavra-passe</label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="mínimo 8 caracteres"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="repetir"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '8px' }}
              disabled={loading}
            >
              {loading ? (
                'A criar conta...'
              ) : (
                <>
                  <span>Criar conta do meu jornal</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--color-border)' }}>
            <Link
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: 'var(--color-text-muted)',
                textDecoration: 'none'
              }}
            >
              <ArrowLeft size={14} /> Já tenho conta — entrar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
