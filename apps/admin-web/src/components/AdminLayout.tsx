import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  Tag,
  ShoppingBag,
  FileCheck2,
  MessageSquare,
  LogOut,
  ShieldCheck,
  Building
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <div className="vuka-logo-badge">V</div>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.3px' }}>VUKA Admin</h2>
            <p style={{ fontSize: '11px', color: 'var(--color-text-dim)', fontWeight: 600 }}>Banca Digital Multi-Editora</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          {isAdmin && (
            <NavLink to="/publishers" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Building2 size={18} />
              <span>Editoras</span>
            </NavLink>
          )}

          <NavLink to="/publications" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <BookOpen size={18} />
            <span>Publicações & Edições</span>
          </NavLink>

          <NavLink to="/offers" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Tag size={18} />
            <span>Ofertas Comerciais</span>
          </NavLink>

          <NavLink to="/orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <ShoppingBag size={18} />
            <span>Pedidos & Vendas</span>
          </NavLink>

          <NavLink to="/audit" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FileCheck2 size={18} />
            <span>Trilha de Auditoria</span>
          </NavLink>

          <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '12px 0' }} />

          <NavLink to="/whatsapp-simulator" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <MessageSquare size={18} />
            <span>Simulador WhatsApp</span>
          </NavLink>
        </nav>

        <div className="sidebar-user">
          <div style={{ overflow: 'hidden', marginRight: '8px' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user?.displayName || user?.email}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              {isAdmin ? (
                <span className="badge badge-purple" style={{ fontSize: '10px', padding: '2px 6px' }}>
                  <ShieldCheck size={10} /> Admin Geral
                </span>
              ) : (
                <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 6px' }}>
                  <Building size={10} /> Gestor Editora
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Terminar Sessão"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-dim)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="admin-content">
        <header className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Ambiente:</span>
            <span className="badge badge-success" style={{ fontSize: '11px' }}>
              🟢 Neon PostgreSQL Conectado
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a
              href="http://localhost:5173"
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '12px' }}
            >
              Abrir App do Leitor ↗
            </a>
          </div>
        </header>

        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
