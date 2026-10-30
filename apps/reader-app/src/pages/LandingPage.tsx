import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Newspaper,
  ShieldCheck,
  Smartphone,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface Plan {
  code: string;
  name: string;
  tagline: string;
  priceMinorUnits: number;
  maxPublications: number;
  maxArticlesPerMonth: number | null;
  maxSalesPerMonth: number | null;
  highlights: string[];
}

interface Publication {
  id: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  publisherName?: string | null;
}

const money = (minor: number) =>
  `${(minor / 100).toLocaleString('pt-MZ', { minimumFractionDigits: 0 })} MT`;

const FEATURES = [
  {
    icon: <Smartphone size={20} color="#3b82f6" />,
    title: 'Compra via WhatsApp',
    text: 'M-Pesa ou e-Mola no telemóvel. A edição entra logo na biblioteca do leitor.'
  },
  {
    icon: <FileText size={20} color="#a78bfa" />,
    title: 'PDF protegido',
    text: 'Ficheiros entregues por link assinado de 5 minutos. Sem cópias públicas.'
  },
  {
    icon: <ShieldCheck size={20} color="#10b981" />,
    title: 'Direito verificado',
    text: 'O backend decide quem lê o quê. Assinatura activa, acesso automático.'
  },
  {
    icon: <Sparkles size={20} color="#f59e0b" />,
    title: 'Multi-editora',
    text: 'Cada jornal gere os seus títulos, preços e vendas, isolado dos restantes.'
  }
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [plansRes, catalogRes] = await Promise.all([
          fetch('/api/v1/publishers/plans'),
          fetch('/api/v1/catalog')
        ]);

        if (plansRes.ok) {
          const data = await plansRes.json();
          setPlans(data.plans || []);
        }

        if (catalogRes.ok) {
          const data = await catalogRes.json();
          setPublications((data.catalog || []).slice(0, 4));
        }
      } catch {
        // landing page continua a funcionar sem dados
      }
    };

    load();
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 15% 0%, #16213b 0%, #090d16 55%)',
        color: 'var(--color-text-main)',
        paddingBottom: '48px'
      }}
    >
      {/* Header */}
      <header
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '22px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(37, 99, 235, 0.35)'
            }}
          >
            <span style={{ fontWeight: 800, fontSize: '20px' }}>V</span>
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px' }}>VUKA</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>Banca digital multi-editora</div>
          </div>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/store')}>
            <BookOpen size={15} />
            <span>Banca</span>
          </button>
          <a className="btn btn-secondary btn-sm" href="/editora">
            <Building2 size={15} />
            <span>Portal da editora</span>
          </a>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>
            <span>Entrar</span>
          </button>
        </nav>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px 8px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            padding: '6px 12px',
            borderRadius: '999px',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)'
          }}
        >
          <Sparkles size={13} color="#f59e0b" /> Jornais e revistas de Moçambique, no telemóvel
        </div>

        <h1
          style={{
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-1.5px',
            margin: '18px 0 14px',
            maxWidth: '760px'
          }}
        >
          Leia o jornal. <span style={{ color: '#3b82f6' }}>Publique o seu.</span>
        </h1>

        <p style={{ fontSize: '17px', color: 'var(--color-text-muted)', maxWidth: '640px', lineHeight: 1.6 }}>
          A VUKA liga leitores e jornais: compra por M-Pesa ou e-Mola no WhatsApp, leitura protegida no
          navegador, e uma plataforma onde cada editora gere as suas edições, preços e vendas.
        </p>

        <div style={{ display: 'flex', gap: '12px', marginTop: '28px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" style={{ padding: '13px 20px' }} onClick={() => navigate('/store')}>
            <span>Explorar a banca</span>
            <ArrowRight size={17} />
          </button>
          <a className="btn btn-secondary" style={{ padding: '13px 20px' }} href="/editora/registar">
            <Newspaper size={17} />
            <span>Publicar o meu jornal</span>
          </a>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '22px',
            marginTop: '20px',
            fontSize: '12px',
            color: 'var(--color-text-dim)',
            flexWrap: 'wrap'
          }}
        >
          <span>✓ Sem app para instalar</span>
          <span>✓ M-Pesa · e-Mola · cartão</span>
          <span>✓ Cada jornal com a sua conta</span>
        </div>
      </section>

      {/* Para quem */}
      <section style={{ maxWidth: '1100px', margin: '48px auto 0', padding: '0 24px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Escolha o seu caminho
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
            marginTop: '16px'
          }}
        >
          {/* Leitor */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <BookOpen size={24} color="#3b82f6" />
            <h3 style={{ fontSize: '19px', fontWeight: 800 }}>Sou leitor</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', flex: 1 }}>
              Compre edições avulsas ou assinaturas, e leia na hora. Tudo o que comprou fica na sua
              biblioteca.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/store')}>
                <span>Ver jornais</span>
                <ArrowRight size={14} />
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/login')}>
                <span>Minha biblioteca</span>
              </button>
            </div>
          </div>

          {/* Editora */}
          <div
            className="card"
            style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderColor: 'rgba(16, 185, 129, 0.45)' }}
          >
            <Newspaper size={24} color="#10b981" />
            <h3 style={{ fontSize: '19px', fontWeight: 800 }}>Sou jornal / editora</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', flex: 1 }}>
              Crie a conta do seu jornal, carregue edições em PDF, defina preços e acompanhe as vendas.
              Precisa de um código de convite.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a className="btn btn-primary btn-sm" href="/editora/registar">
                <span>Criar conta</span>
                <ArrowRight size={14} />
              </a>
              <a className="btn btn-secondary btn-sm" href="/editora/login">
                <span>Já tenho conta</span>
              </a>
            </div>
          </div>

          {/* Administração */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <ShieldCheck size={24} color="#a78bfa" />
            <h3 style={{ fontSize: '19px', fontWeight: 800 }}>Equipa VUKA</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', flex: 1 }}>
              Aprovação de jornais, convites, planos de subscrição, pagamentos e auditoria da plataforma.
            </p>
            <div>
              <a className="btn btn-secondary btn-sm" href="/admin">
                <span>Painel administrativo</span>
                <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Jornais na plataforma */}
      {publications.length > 0 && (
        <section style={{ maxWidth: '1100px', margin: '48px auto 0', padding: '0 24px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Jornais na VUKA
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
              marginTop: '16px'
            }}
          >
            {publications.map((pub) => (
              <button
                key={pub.id}
                onClick={() => navigate('/store')}
                className="card"
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  padding: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div
                  style={{
                    height: '120px',
                    backgroundColor: 'var(--color-surface-hover)',
                    backgroundImage: pub.coverUrl ? `url(${pub.coverUrl})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{pub.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '2px' }}>
                    {pub.publisherName || 'Editora parceira'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Como funciona */}
      <section style={{ maxWidth: '1100px', margin: '48px auto 0', padding: '0 24px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Como funciona
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
            marginTop: '16px'
          }}
        >
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card">
              {feature.icon}
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginTop: '10px' }}>{feature.title}</h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
                {feature.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Planos */}
      {plans.length > 0 && (
        <section style={{ maxWidth: '1100px', margin: '48px auto 0', padding: '0 24px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Planos para jornais
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
            Mensalidade com limite de títulos, artigos e vendas. O jornal começa no Basic.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '14px',
              marginTop: '16px'
            }}
          >
            {plans.map((plan) => (
              <div key={plan.code} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '17px', fontWeight: 800 }}>{plan.name}</h3>
                  <CreditCard size={16} color="var(--color-text-dim)" />
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, margin: '8px 0 2px' }}>
                  {money(plan.priceMinorUnits)}
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}> / mês</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>{plan.tagline}</p>
                <ul style={{ margin: '10px 0 0', paddingLeft: '18px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  {plan.highlights.map((item) => (
                    <li key={item} style={{ marginBottom: '4px', listStyle: 'none', marginLeft: '-18px', display: 'flex', gap: '6px' }}>
                      <CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer
        style={{
          maxWidth: '1100px',
          margin: '56px auto 0',
          padding: '24px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          fontSize: '12px',
          color: 'var(--color-text-dim)'
        }}
      >
        <span>© {new Date().getFullYear()} VUKA — Plataforma multi-editora de publicações digitais</span>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <a href="/store" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Banca</a>
          <a href="/editora" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Editora</a>
          <a href="/admin" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Administração</a>
        </div>
      </footer>
    </div>
  );
};
