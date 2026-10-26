import React, { useEffect, useState } from 'react';
import { useReaderAuth } from '../context/ReaderAuthContext';
import { useNavigate } from 'react-router-dom';
import { LibraryItemDTO } from '@vuka/shared';
import { BookOpen, Calendar, Clock, AlertCircle, ShoppingBag, Newspaper, ChevronRight } from 'lucide-react';

export const LibraryPage: React.FC = () => {
  const { authFetch, user, logout } = useReaderAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<LibraryItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/v1/me/library');
      if (!res.ok) throw new Error('Falha ao obter biblioteca do leitor.');
      const data = await res.json();
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reader-app-layout">
      {/* App Header */}
      <header className="app-header">
        <div className="brand-badge">
          <div className="vuka-circle">V</div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800 }}>Minha Biblioteca</h1>
            <p style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>{user?.displayName || user?.phone}</p>
          </div>
        </div>
        <button
          onClick={logout}
          style={{ background: 'none', border: 'none', color: 'var(--color-text-dim)', fontSize: '13px', cursor: 'pointer' }}
        >
          Sair
        </button>
      </header>

      {/* Main Content */}
      <main style={{ padding: '20px' }}>
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
            marginBottom: '20px',
            fontSize: '13px'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px' }}>A carregar a sua biblioteca...</p>
        ) : items.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: 'var(--color-surface-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            marginTop: '20px'
          }}>
            <Newspaper size={48} color="var(--color-text-dim)" style={{ marginBottom: '16px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>A sua biblioteca está vazia</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', maxWidth: '320px', margin: '8px auto 20px' }}>
              Adquira jornais e revistas pelo WhatsApp e eles aparecerão aqui automaticamente.
            </p>
            <button className="btn btn-whatsapp" onClick={() => navigate('/store')}>
              <ShoppingBag size={18} />
              <span>Ver Banca de Jornais</span>
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                {items.length} {items.length === 1 ? 'Edição Disponível' : 'Edições Disponíveis'}
              </span>
            </div>

            <div className="library-grid" style={{ padding: 0 }}>
              {items.map((item) => (
                <div
                  key={item.entitlementId}
                  className="edition-card"
                  onClick={() => navigate(`/read/${item.editionId}`)}
                >
                  <div className="edition-cover-wrapper">
                    {item.coverUrl ? (
                      <img src={item.coverUrl} alt={item.title} className="edition-cover-img" />
                    ) : (
                      <div style={{ padding: '20px', textAlign: 'center' }}>
                        <BookOpen size={36} color="#60a5fa" />
                        <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', marginTop: '8px' }}>VUKA Digital</div>
                      </div>
                    )}
                    {item.isExpired && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-danger)',
                        fontWeight: 700,
                        fontSize: '12px'
                      }}>
                        EXPIRADO
                      </div>
                    )}
                  </div>

                  <div className="edition-meta">
                    <div>
                      <div style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase' }}>
                        {item.publicationTitle}
                      </div>
                      <div className="edition-title">{item.title}</div>
                      <div className="edition-date" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} /> {item.editionDate}
                      </div>
                    </div>

                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="badge badge-success">
                        {item.endsAt ? 'Assinatura' : 'Vitalício'}
                      </span>
                      <ChevronRight size={16} color="var(--color-text-dim)" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <div className="nav-item active">
          <BookOpen size={20} />
          <span>Biblioteca</span>
        </div>
        <div className="nav-item" onClick={() => navigate('/store')} style={{ cursor: 'pointer' }}>
          <ShoppingBag size={20} />
          <span>Banca</span>
        </div>
      </nav>
    </div>
  );
};
