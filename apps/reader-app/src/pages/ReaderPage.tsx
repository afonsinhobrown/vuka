import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReaderAuth } from '../context/ReaderAuthContext';
import { SecureReadAccessDTO } from '@vuka/shared';
import { ArrowLeft, Maximize2, Minimize2, AlertCircle, RefreshCw, ShieldCheck, Lock } from 'lucide-react';

export const ReaderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { authFetch } = useReaderAuth();
  const navigate = useNavigate();

  const [accessData, setAccessData] = useState<SecureReadAccessDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (id) {
      loadAccess(id);
    }
  }, [id]);

  const loadAccess = async (editionId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Chamada autenticada para verificação de Entitlement e obtenção de Token Assinado
      const res = await authFetch(`/api/v1/editions/${editionId}/access`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Acesso não autorizado para esta edição.');
      }

      setAccessData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  };

  if (loading) {
    return (
      <div className="pdf-reader-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw size={32} color="#60a5fa" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '16px', color: 'var(--color-text-muted)', fontSize: '14px' }}>
          A verificar autorização e a carregar edição protegida...
        </p>
      </div>
    );
  }

  if (error || !accessData) {
    return (
      <div className="pdf-reader-container" style={{ alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{
          maxWidth: '420px',
          textAlign: 'center',
          backgroundColor: 'var(--color-surface-card)',
          padding: '32px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-danger)'
        }}>
          <Lock size={48} color="var(--color-danger)" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Acesso Restrito</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '24px' }}>
            {error || 'Não possui direito ativo para ler esta edição.'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button className="btn btn-primary" onClick={() => navigate('/store')}>
              Adquirir Edição na Banca VUKA
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/library')}>
              Voltar à Minha Biblioteca
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-reader-container">
      {/* Top Controls */}
      <header className="reader-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/library')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-main)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '8px'
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px' }}>
              {accessData.title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#34d399' }}>
              <ShieldCheck size={12} /> Acesso Autorizado • Token Temporário
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => loadAccess(id!)}
            title="Atualizar Token de Leitura"
            style={{
              background: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} /> Atualizar Link
          </button>

          <button
            onClick={toggleFullscreen}
            style={{
              background: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-main)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      {/* Embedded Secure PDF Reader */}
      <iframe
        src={`${accessData.readUrl}#toolbar=1&navpanes=0&scrollbar=1`}
        title={accessData.title}
        className="reader-canvas-frame"
      />
    </div>
  );
};
