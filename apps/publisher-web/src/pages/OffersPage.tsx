import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { OfferDTO, PublicationDTO, formatMoney, toMinorUnits, toMajorUnits } from '@vuka/shared';
import { Tag, Plus, Edit2, AlertCircle, X, CheckCircle2 } from 'lucide-react';

export const OffersPage: React.FC = () => {
  const { authFetch } = useAuth();
  const [offers, setOffers] = useState<OfferDTO[]>([]);
  const [publications, setPublications] = useState<PublicationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Create
  const [showModal, setShowModal] = useState(false);
  const [pubId, setPubId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('SINGLE_EDITION');
  const [priceMajor, setPriceMajor] = useState('50');
  const [validityDays, setValidityDays] = useState('30');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal Edit Price
  const [editingOffer, setEditingOffer] = useState<OfferDTO | null>(null);
  const [editPriceMajor, setEditPriceMajor] = useState('');
  const [priceReason, setPriceReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [offRes, catRes] = await Promise.all([
        authFetch('/api/v1/offers'),
        authFetch('/api/v1/catalog/manage/publications')
      ]);

      if (offRes.ok) {
        const offData = await offRes.json();
        setOffers(offData.offers);
      }

      if (catRes.ok) {
        const catData = await catRes.json();
        setPublications(catData.catalog);
        if (catData.catalog.length > 0) {
          setPubId(catData.catalog[0].id);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const priceMinorUnits = toMinorUnits(parseFloat(priceMajor));
      const res = await authFetch('/api/v1/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicationId: pubId || null,
          title,
          type,
          priceMinorUnits,
          currency: 'MZN',
          validityDays: type === 'SUBSCRIPTION' ? parseInt(validityDays, 10) : null,
          description
        })
      });

      if (!res.ok) throw new Error('Falha ao registar oferta comercial.');
      setShowModal(false);
      setTitle('');
      setDescription('');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOffer) return;

    try {
      const priceMinorUnits = toMinorUnits(parseFloat(editPriceMajor));
      const res = await authFetch(`/api/v1/offers/${editingOffer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceMinorUnits,
          reason: priceReason || 'Atualização comercial de tabela de preços'
        })
      });

      if (!res.ok) throw new Error('Falha ao atualizar preço.');
      setEditingOffer(null);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Ofertas Comerciais</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Produtos da sua editora disponibilizados para venda no WhatsApp e aplicativo
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          <span>Criar Oferta</span>
        </button>
      </div>

      {error && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-danger)', marginBottom: '20px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>A carregar ofertas...</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Título da Oferta</th>
                  <th>Tipo</th>
                  <th>Publicação</th>
                  <th>Preço Congelado</th>
                  <th>Validade</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => (
                  <tr key={offer.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{offer.title}</div>
                      {offer.description && <div style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>{offer.description}</div>}
                    </td>
                    <td>
                      <span className="badge badge-purple" style={{ fontSize: '11px' }}>
                        {offer.type === 'SINGLE_EDITION' ? 'Edição Avulsa' : 'Assinatura'}
                      </span>
                    </td>
                    <td>{offer.publisherName || 'Geral'}</td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: '15px', color: '#60a5fa' }}>
                        {formatMoney(offer.priceMinorUnits, offer.currency)}
                      </span>
                    </td>
                    <td>
                      {offer.validityDays ? `${offer.validityDays} dias` : 'Vitalício (Edição)'}
                    </td>
                    <td>
                      <span className="badge badge-success"><CheckCircle2 size={12} /> Ativa</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingOffer(offer);
                          setEditPriceMajor(toMajorUnits(offer.priceMinorUnits).toString());
                          setPriceReason('');
                        }}
                      >
                        <Edit2 size={14} /> Alterar Preço
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Criar Oferta */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Nova Oferta Comercial</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateOffer}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Publicação Associada</label>
                  <select className="form-select" value={pubId} onChange={(e) => setPubId(e.target.value)} required>
                    {publications.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Tipo de Oferta</label>
                  <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="SINGLE_EDITION">Edição Avulsa (Acesso Permanente)</option>
                    <option value="SUBSCRIPTION">Assinatura por Período (Dias de Acesso)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Título Comercial da Oferta</label>
                  <input
                    type="text"
                    className="form-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="ex: Assinatura Mensal - 30 Dias"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Preço em Meticais (MZN)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-input"
                    value={priceMajor}
                    onChange={(e) => setPriceMajor(e.target.value)}
                    placeholder="100.00"
                    required
                  />
                </div>

                {type === 'SUBSCRIPTION' && (
                  <div className="form-group">
                    <label className="form-label">Duração da Assinatura (em dias)</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={validityDays}
                      onChange={(e) => setValidityDays(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Descrição das Vantagens</label>
                  <textarea className="form-textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Condições comerciais..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'A guardar...' : 'Criar Oferta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Alterar Preço com Auditoria */}
      {editingOffer && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Alterar Preço da Oferta</h2>
              <button onClick={() => setEditingOffer(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdatePrice}>
              <div className="modal-body">
                <p style={{ fontSize: '14px', marginBottom: '16px', color: 'var(--color-text-muted)' }}>
                  A alterar preço de: <strong>{editingOffer.title}</strong>
                </p>

                <div className="form-group">
                  <label className="form-label">Novo Preço em Meticais (MZN)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-input"
                    value={editPriceMajor}
                    onChange={(e) => setEditPriceMajor(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Motivo da Alteração de Preço (Obrigatório para Auditoria)</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={priceReason}
                    onChange={(e) => setPriceReason(e.target.value)}
                    placeholder="ex: Ajuste inflacionário autorizado pela administração da editora..."
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingOffer(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registar Novo Preço</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
