import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PublicationDTO, EditionDTO } from '@vuka/shared';
import { BookOpen, Plus, Upload, Calendar, FileText, CheckCircle2, AlertOctagon, X, AlertCircle } from 'lucide-react';

type ManagedPublication = PublicationDTO & { editions: EditionDTO[] };

export const PublicationsPage: React.FC = () => {
  const { authFetch } = useAuth();
  const [publications, setPublications] = useState<ManagedPublication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Publication
  const [showPubModal, setShowPubModal] = useState(false);
  const [newPubTitle, setNewPubTitle] = useState('');
  const [newPubSlug, setNewPubSlug] = useState('');
  const [newPubDesc, setNewPubDesc] = useState('');

  // Modal Edition
  const [showEditionModal, setShowEditionModal] = useState(false);
  const [newEditionTitle, setNewEditionTitle] = useState('');
  const [newEditionDate, setNewEditionDate] = useState(new Date().toISOString().split('T')[0]);
  const [editionFile, setEditionFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const selectedPublication = publications.find((p) => p.id === selectedId) || null;
  const editions = selectedPublication?.editions || [];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/v1/catalog/manage/publications');
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || 'Falha ao carregar publicações da editora.');
      }
      const data = await res.json();
      const catalog: ManagedPublication[] = data.catalog || [];
      setPublications(catalog);
      setSelectedId((current) => {
        if (current && catalog.some((p) => p.id === current)) return current;
        return catalog[0]?.id || null;
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePublication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/v1/catalog/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newPubTitle,
          slug: newPubSlug,
          description: newPubDesc
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || 'Falha ao criar publicação.');

      setShowPubModal(false);
      setNewPubTitle('');
      setNewPubSlug('');
      setNewPubDesc('');
      if (data?.publication?.id) setSelectedId(data.publication.id);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateEdition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPublication || !editionFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', editionFile);
      formData.append('isPublic', 'false');

      const uploadRes = await authFetch('/api/v1/catalog/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.ok) throw new Error('Falha no upload do ficheiro PDF.');
      const uploadData = await uploadRes.json();
      const contentAssetId = uploadData.asset.id;

      const editionRes = await authFetch('/api/v1/catalog/editions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicationId: selectedPublication.id,
          title: newEditionTitle,
          editionDate: newEditionDate,
          contentAssetId
        })
      });

      const editionData = await editionRes.json().catch(() => null);
      if (!editionRes.ok) throw new Error(editionData?.error?.message || 'Falha ao registar edição.');

      setShowEditionModal(false);
      setNewEditionTitle('');
      setEditionFile(null);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePublishEdition = async (id: string) => {
    if (!confirm('Deseja publicar esta edição? Ela ficará disponível no catálogo e para venda imediata.')) return;
    try {
      const res = await authFetch(`/api/v1/catalog/editions/${id}/publish`, { method: 'POST' });
      if (!res.ok) throw new Error('Falha ao publicar edição.');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleWithdrawEdition = async (id: string) => {
    const reason = prompt('Indique o motivo para a retirada da edição:');
    if (!reason) return;
    try {
      const res = await authFetch(`/api/v1/catalog/editions/${id}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (!res.ok) throw new Error('Falha ao retirar edição.');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Publicações & Edições Digitais</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Crie o seu jornal, carregue edições em PDF e controle o ciclo de vida editorial
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowPubModal(true)}>
          <Plus size={18} />
          <span>Nova Publicação</span>
        </button>
      </div>

      {error && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-danger)', marginBottom: '20px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>A carregar publicações...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
          <div className="card" style={{ padding: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px', color: 'var(--color-text-muted)' }}>
              OS SEUS TÍTULOS
            </h2>
            {publications.length === 0 ? (
              <p style={{ color: 'var(--color-text-dim)', fontSize: '13px' }}>
                Ainda não criou nenhuma publicação. Comece por criar o seu jornal.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {publications.map((pub) => {
                  const isSelected = selectedId === pub.id;
                  return (
                    <div
                      key={pub.id}
                      onClick={() => setSelectedId(pub.id)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                        border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '15px', color: isSelected ? '#60a5fa' : 'var(--color-text-main)' }}>
                        {pub.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '2px' }}>
                        {pub.editions.length} {pub.editions.length === 1 ? 'edição' : 'edições'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            {selectedPublication ? (
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 800 }}>{selectedPublication.title}</h2>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '2px' }}>
                      {selectedPublication.description || 'Gestão de edições digitais e ficheiros protegidos'}
                    </p>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowEditionModal(true)}>
                    <Upload size={16} />
                    <span>Carregar Nova Edição (PDF)</span>
                  </button>
                </div>

                {editions.length === 0 ? (
                  <p style={{ color: 'var(--color-text-dim)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>
                    Ainda não existem edições registadas para esta publicação.
                  </p>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Título da Edição</th>
                          <th>Data</th>
                          <th>Estado</th>
                          <th>Ficheiro Privado</th>
                          <th style={{ textAlign: 'right' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editions.map((edition) => (
                          <tr key={edition.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{edition.title}</div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>ID: {edition.id.slice(0, 8)}...</div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                                <Calendar size={14} color="var(--color-text-dim)" />
                                <span>{edition.editionDate}</span>
                              </div>
                            </td>
                            <td>
                              {edition.status === 'PUBLISHED' && <span className="badge badge-success"><CheckCircle2 size={12} /> Publicado</span>}
                              {edition.status === 'DRAFT' && <span className="badge badge-warning">Rascunho</span>}
                              {edition.status === 'WITHDRAWN' && <span className="badge badge-danger"><AlertOctagon size={12} /> Retirado</span>}
                            </td>
                            <td>
                              <span style={{ fontSize: '12px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <FileText size={14} /> PDF Protegido
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                {edition.status === 'DRAFT' && (
                                  <button className="btn btn-primary btn-sm" onClick={() => handlePublishEdition(edition.id)}>
                                    Publicar
                                  </button>
                                )}
                                {edition.status === 'PUBLISHED' && (
                                  <button className="btn btn-secondary btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleWithdrawEdition(edition.id)}>
                                    Retirar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-dim)' }}>
                Crie ou selecione uma publicação à esquerda para gerir as suas edições.
              </div>
            )}
          </div>
        </div>
      )}

      {showPubModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Criar Nova Publicação</h2>
              <button onClick={() => setShowPubModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreatePublication}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nome da Publicação (Jornal / Revista)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newPubTitle}
                    onChange={(e) => {
                      setNewPubTitle(e.target.value);
                      if (!newPubSlug) {
                        setNewPubSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                      }
                    }}
                    placeholder="ex: Semanário Embondeiro"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Slug</label>
                  <input type="text" className="form-input" value={newPubSlug} onChange={(e) => setNewPubSlug(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Descrição</label>
                  <textarea className="form-textarea" rows={3} value={newPubDesc} onChange={(e) => setNewPubDesc(e.target.value)} placeholder="Breve apresentação da linha editorial..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPubModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Criar Publicação</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditionModal && selectedPublication && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Carregar Nova Edição</h2>
              <button onClick={() => setShowEditionModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateEdition}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Título da Edição</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newEditionTitle}
                    onChange={(e) => setNewEditionTitle(e.target.value)}
                    placeholder="ex: Edição Nº 450 - Quarta-feira"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Data da Edição</label>
                  <input type="date" className="form-input" value={newEditionDate} onChange={(e) => setNewEditionDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Ficheiro PDF da Edição (Armazenamento Privado)</label>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="form-input"
                    onChange={(e) => setEditionFile(e.target.files?.[0] || null)}
                    required
                  />
                  <small style={{ color: 'var(--color-text-dim)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    O ficheiro será guardado em armazenamento privado. O leitor só acede com direito verificado.
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditionModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'A enviar e proteger ficheiro...' : 'Salvar Edição'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
