import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PublisherDTO } from '@vuka/shared';
import {
  Building2,
  Phone,
  Mail,
  BookOpen,
  AlertCircle,
  Power,
  KeyRound,
  Copy,
  Trash2,
  Plus
} from 'lucide-react';

/**
 * Fiscalização das editoras/jornais + gestão dos códigos de convite.
 *
 * Os jornais criam a própria conta em `/editora/registar`, mas só com um código
 * de convite emitido aqui. O administrador não cria jornais.
 */

interface PublisherInvite {
  id: string;
  code: string;
  note: string | null;
  usedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  status: 'AVAILABLE' | 'USED' | 'EXPIRED';
  publisherId: string | null;
}

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export const PublishersPage: React.FC = () => {
  const { authFetch } = useAuth();
  const [publishers, setPublishers] = useState<PublisherDTO[]>([]);
  const [invites, setInvites] = useState<PublisherInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [inviteNote, setInviteNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [publishersRes, invitesRes] = await Promise.all([
        authFetch('/api/v1/publishers'),
        authFetch('/api/v1/publishers/invites')
      ]);

      if (publishersRes.ok) {
        const data = await publishersRes.json();
        setPublishers(data.publishers || []);
      } else {
        throw new Error('Falha ao obter editoras.');
      }

      if (invitesRes.ok) {
        const data = await invitesRes.json();
        setInvites(data.invites || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGenerating(true);
      setError(null);
      const res = await authFetch('/api/v1/publishers/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: inviteNote || undefined })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || 'Falha ao gerar convite.');

      setLastCode(data.invite.code);
      setInviteNote('');
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const revokeInvite = async (invite: PublisherInvite) => {
    if (!confirm(`Anular o convite ${invite.code}?`)) return;
    try {
      setBusyId(invite.id);
      const res = await authFetch(`/api/v1/publishers/invites/${invite.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || 'Falha ao anular o convite.');
      }
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = async (publisher: PublisherDTO) => {
    const isActive = publisher.status === 'ACTIVE';
    const nextStatus = isActive ? 'SUSPENDED' : 'ACTIVE';
    const confirmation = isActive
      ? `Suspender "${publisher.name}"? Os gestores deixam de conseguir publicar e vender.`
      : `Reativar "${publisher.name}"?`;
    if (!confirm(confirmation)) return;

    try {
      setBusyId(publisher.id);
      setError(null);
      const res = await authFetch(`/api/v1/publishers/${publisher.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || 'Falha ao alterar o estado da editora.');
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Editoras / Jornais</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Cada jornal cria a sua conta em{' '}
          <a href="/editora/registar" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>
            /editora/registar
          </a>{' '}
          com um código de convite. Aqui emites os códigos e fiscalizas as contas.
        </p>
      </div>

      {error && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-danger)', marginBottom: '20px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* ---------- Convites ---------- */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <KeyRound size={18} /> Códigos de convite
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '6px' }}>
          Cada código autoriza a criação de <strong>um</strong> jornal e fica marcado como usado.
        </p>

        <form onSubmit={generateInvite} style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            value={inviteNote}
            onChange={(e) => setInviteNote(e.target.value)}
            placeholder="Nota (opcional): ex. Jornal de Maputo"
            style={{ flex: '1 1 260px' }}
          />
          <button type="submit" className="btn btn-primary" disabled={generating}>
            <Plus size={16} />
            <span>{generating ? 'A gerar...' : 'Gerar convite'}</span>
          </button>
        </form>

        {lastCode && (
          <div
            style={{
              marginTop: '14px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
                Convite criado — envia ao jornal
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, letterSpacing: '1px' }}>
                {lastCode}
              </div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigator.clipboard?.writeText(lastCode)}
              type="button"
            >
              <Copy size={14} />
              <span>Copiar</span>
            </button>
          </div>
        )}

        {invites.length > 0 && (
          <div style={{ marginTop: '18px' }}>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nota</th>
                    <th>Criado</th>
                    <th>Expira</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => (
                    <tr key={invite.id}>
                      <td>
                        <code style={{ fontSize: '12px' }}>{invite.code}</code>
                      </td>
                      <td style={{ fontSize: '13px' }}>{invite.note || '—'}</td>
                      <td style={{ fontSize: '13px' }}>{formatDate(invite.createdAt)}</td>
                      <td style={{ fontSize: '13px' }}>{formatDate(invite.expiresAt)}</td>
                      <td>
                        <span
                          className={`badge ${
                            invite.status === 'AVAILABLE'
                              ? 'badge-success'
                              : invite.status === 'USED'
                                ? 'badge-purple'
                                : 'badge-danger'
                          }`}
                        >
                          {invite.status === 'AVAILABLE' ? 'Disponível' : invite.status === 'USED' ? 'Usado' : 'Expirado'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {invite.status !== 'USED' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => revokeInvite(invite)}
                            disabled={busyId === invite.id}
                            style={{ color: 'var(--color-danger)' }}
                          >
                            <Trash2 size={14} />
                            <span>Anular</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ---------- Editoras ---------- */}
      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>A carregar editoras...</p>
      ) : publishers.length === 0 ? (
        <div className="card" style={{ color: 'var(--color-text-dim)', textAlign: 'center', padding: '40px 20px' }}>
          Ainda não existe nenhuma editora registada. Gera um convite e envia-o ao jornal.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome do Jornal / Editora</th>
                  <th>Identificador</th>
                  <th>Contactos</th>
                  <th>Publicações</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {publishers.map((pub) => {
                  const isActive = pub.status === 'ACTIVE';
                  return (
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
                          {pub.contactEmail && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Mail size={12} color="var(--color-text-dim)" /> {pub.contactEmail}
                            </div>
                          )}
                          {pub.contactPhone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <Phone size={12} color="var(--color-text-dim)" /> {pub.contactPhone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-purple">
                          <BookOpen size={12} /> {pub.publicationsCount || 0} títulos
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}>
                          {isActive ? 'Ativa' : 'Suspensa'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleStatus(pub)}
                          disabled={busyId === pub.id}
                          style={isActive ? { color: 'var(--color-danger)' } : undefined}
                        >
                          <Power size={14} />
                          <span>{busyId === pub.id ? 'A guardar...' : isActive ? 'Suspender' : 'Reativar'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
