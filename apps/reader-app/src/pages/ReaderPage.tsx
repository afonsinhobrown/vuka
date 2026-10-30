import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReaderAuth } from '../context/ReaderAuthContext';
import { SecureReadAccessDTO } from '@vuka/shared';
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  RefreshCw,
  ShieldCheck,
  Lock,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

// pdf.js é carregado de forma diferida (só nesta página): a landing e a banca
// não pagam ~400 kB de biblioteca de PDF.
// Renderização feita por nós (canvas) em vez do visualizador nativo do browser:
// não há botão de descarregar, não há "guardar como", e cada página leva marca
// de água com o telefone do leitor.

export const ReaderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { authFetch, user } = useReaderAuth();
  const navigate = useNavigate();

  const [accessData, setAccessData] = useState<SecureReadAccessDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const [doc, setDoc] = useState<any>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (id) {
      loadAccess(id);
    }
  }, [id]);

  const loadAccess = async (editionId: string) => {
    try {
      setLoading(true);
      setError(null);
      setDoc(null);
      setPageNumber(1);

      // Token assinado de curta duração + verificação de entitlement no backend
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

  /* Carrega o PDF (bytes) para memória e prepara o documento */
  useEffect(() => {
    if (!accessData?.readUrl) return;

    let cancelled = false;

    const load = async () => {
      try {
        setRendering(true);
        setRenderError(null);

        const pdfjsLib = await import('pdfjs-dist');
        const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;

        const task = pdfjsLib.getDocument({
          url: accessData.readUrl,
          withCredentials: false,
          disableAutoFetch: false
        });
        const pdf = await task.promise;
        if (cancelled) return;

        setDoc(pdf);
        setPageCount(pdf.numPages);

        // Escala inicial: ajustar à largura disponível
        const firstPage = await pdf.getPage(1);
        const baseViewport = firstPage.getViewport({ scale: 1 });
        const available = (containerRef.current?.clientWidth || 900) - 24;
        setScale(Math.max(0.5, Math.min(3, available / baseViewport.width)));
      } catch (err: any) {
        console.error('Falha ao carregar o PDF:', err);
        setRenderError(
          'Não foi possível abrir a edição. Verifique a ligação e tente actualizar o link.'
        );
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [accessData]);

  /* Renderiza a página actual no canvas */
  useEffect(() => {
    if (!doc || !canvasRef.current) return;

    let cancelled = false;

    const render = async () => {
      try {
        setRendering(true);
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        await page.render({
          canvasContext: context,
          viewport,
          transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined
        }).promise;
      } catch (err) {
        console.error('Falha ao renderizar a página:', err);
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    render();

    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber, scale]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  };

  const goToPage = useCallback(
    (target: number) => {
      setPageNumber((current) => Math.min(Math.max(1, target), pageCount || 1));
    },
    [pageCount]
  );

  const watermark = user?.phone || user?.displayName || user?.email || 'VUKA';

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
        <div
          style={{
            maxWidth: '420px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-card)',
            padding: '32px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-danger)'
          }}
        >
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
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
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#f8fafc',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '320px'
              }}
            >
              {accessData.title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#34d399' }}>
              <ShieldCheck size={12} /> Leitura protegida • {pageNumber}/{pageCount || '-'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => goToPage(pageNumber - 1)}
            disabled={pageNumber <= 1}
            title="Página anterior"
            style={iconButtonStyle(pageNumber <= 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => goToPage(pageNumber + 1)}
            disabled={pageNumber >= pageCount}
            title="Página seguinte"
            style={iconButtonStyle(pageNumber >= pageCount)}
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setScale((value) => Math.max(0.5, Number((value - 0.2).toFixed(2))))}
            title="Reduzir"
            style={iconButtonStyle(false)}
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={() => setScale((value) => Math.min(3, Number((value + 0.2).toFixed(2))))}
            title="Ampliar"
            style={iconButtonStyle(false)}
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={() => loadAccess(id!)}
            title="Atualizar token de leitura"
            style={iconButtonStyle(false)}
          >
            <RefreshCw size={16} />
          </button>
          <button onClick={toggleFullscreen} title="Ecrã inteiro" style={iconButtonStyle(false)}>
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      {/* Página renderizada (sem visualizador nativo → sem download) */}
      <div
        ref={containerRef}
        onContextMenu={(event) => event.preventDefault()}
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '16px',
          userSelect: 'none',
          WebkitUserSelect: 'none'
        }}
      >
        {renderError ? (
          <div style={{ marginTop: '40px', textAlign: 'center', color: 'var(--color-danger)', fontSize: '14px' }}>
            {renderError}
          </div>
        ) : (
          <div style={{ position: 'relative', boxShadow: '0 12px 40px rgba(0,0,0,0.45)' }}>
            <canvas ref={canvasRef} style={{ display: 'block', backgroundColor: '#ffffff' }} />

            {/* Marca de água com o telefone do leitor */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}
            >
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  style={{
                    position: 'absolute',
                    transform: 'rotate(-28deg)',
                    fontSize: `${Math.max(16, 22 * scale)}px`,
                    fontWeight: 700,
                    color: 'rgba(15, 23, 42, 0.10)',
                    whiteSpace: 'nowrap',
                    top: `${18 + index * 30}%`,
                    letterSpacing: '2px'
                  }}
                >
                  VUKA · {watermark}
                </span>
              ))}
            </div>

            {rendering && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(9, 13, 22, 0.25)'
                }}
              >
                <RefreshCw size={22} color="#60a5fa" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navegação inferior */}
      {pageCount > 1 && (
        <footer
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            padding: '10px',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            fontSize: '12px',
            color: 'var(--color-text-muted)'
          }}
        >
          <button onClick={() => goToPage(pageNumber - 1)} disabled={pageNumber <= 1} style={iconButtonStyle(pageNumber <= 1)}>
            <ChevronLeft size={18} />
          </button>
          <span>
            Página <strong style={{ color: 'var(--color-text-main)' }}>{pageNumber}</strong> de {pageCount}
          </span>
          <button
            onClick={() => goToPage(pageNumber + 1)}
            disabled={pageNumber >= pageCount}
            style={iconButtonStyle(pageNumber >= pageCount)}
          >
            <ChevronRight size={18} />
          </button>
        </footer>
      )}
    </div>
  );
};

function iconButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'var(--color-surface-hover)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: disabled ? 'var(--color-text-dim)' : 'var(--color-text-main)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };
}
