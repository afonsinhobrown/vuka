import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PublisherDTO } from '@vuka/shared';
import { Building2, Plus, Phone, Mail, BookOpen, AlertCircle, X } from 'lucide-react';

export const PublishersPage: React.FC = () => {
  const { authFetch } = useAuth();
  const [publishers, setPublishers] = useState<PublisherDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPublishers();
  }, []);

  const loadPublishers = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/v1/publishers');
      if (!res.ok) throw new Error('Falha ao obter editoras.');
      const data = await res.json();
      setPublishers(data.publishers);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePublisher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch('/api/v1/publishers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, contactEmail, contactPhone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Falha ao criar editora.');

      setShowModal(false);
      setName('');
      setSlug('');
      setContactEmail('');
      setContactPhone('');
      await loadPublishers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Gestão de Editoras</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Empresas jornalísticas e editoras parceiras registadas na VUKA
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          <span>Registar Nova Editora</span>
        </button>
      </div>

      {error && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-danger)', marginBottom: '20px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>A carregar editoras...</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome da Editora</th>
                  <th>Identificador (Slug)</th>
                  <th>Contactos</th>
                  <th>Publicações Ativas</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {publishers.map((pub) => (
                  <tr key={pub.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--color-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                          <Building2 size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{pub.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>ID: {pub.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: '12px', padding: '2px 6px', background: 'var(--color-bg)', borderRadius: '4px' }}>{pub.slug}</code>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px' }}>
                        {pub.contactEmail && <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={12} color="var(--color-text-dim)" /> {pub.contactEmail}</div>}
                        {pub.contactPhone && <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}><Phone size={12} color="var(--color-text-dim)" /> {pub.contactPhone}</div>}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-purple">
                        <BookOpen size={12} /> {pub.publicationsCount || 0} títulos
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-success">Ativa</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Nova Editora */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Registar Editora Parceira</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreatePublisher}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nome da Empresa / Editora</label>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!slug) {
                        setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                      }
                    }}
                    placeholder="ex: Sociedade do Notícias, S.A."
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Slug / Identificador único no sistema</label>
                  <input
                    type="text"
                    className="form-input"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="ex: noticias-sa"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Comercial</label>
                  <input
                    type="email"
                    className="form-input"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="comercial@editora.co.mz"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Telefone de Contacto</label>
                  <input
                    type="text"
                    className="form-input"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+258 21 000 000"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'A guardar...' : 'Criar Editora'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
