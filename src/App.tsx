import { useEffect, useState } from 'react';
import CreateEvent from './components/CreateEvent';
import EditEvent from './components/EditEvent';
import ViewEvent from './components/ViewEvent';
import ParticipantResponse from './components/ParticipantResponse';
import { getHistoryItems, type HistoryItem } from './utils/history';

type Page = 'home' | 'create' | 'edit' | 'view' | 'respond';

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

function App() {
  const [page, setPage] = useState<Page>('home');
  const [eventId, setEventId] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    // 履歴を読み込み
    setHistory(getHistoryItems());
  }, []);

  useEffect(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token') || '';

    if (path.startsWith('/e/')) {
      setPage('edit');
      setEventId(path.replace('/e/', ''));
      setToken(tokenParam);
    } else if (path.startsWith('/v/')) {
      setPage('view');
      setEventId(path.replace('/v/', ''));
      setToken(tokenParam);
    } else if (path.startsWith('/r/')) {
      setPage('respond');
      setEventId(path.replace('/r/', ''));
      setToken(tokenParam);
    } else if (path === '/create') {
      setPage('create');
    } else {
      setPage('home');
    }
  }, []);

  const navigateToHome = () => {
    window.history.pushState({}, '', '/');
    setPage('home');
  };

  const navigateToCreate = () => {
    window.history.pushState({}, '', '/create');
    setPage('create');
  };

  if (page === 'create') {
    return <CreateEvent onBack={navigateToHome} />;
  }

  if (page === 'edit') {
    return <EditEvent eventId={eventId} token={token} onBack={navigateToHome} />;
  }

  if (page === 'view') {
    return <ViewEvent eventId={eventId} token={token} onBack={navigateToHome} />;
  }

  if (page === 'respond') {
    return <ParticipantResponse eventId={eventId} token={token} onBack={navigateToHome} />;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Glassine</h1>
      <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '2rem' }}>
        ログイン不要の日程調整ツール
      </p>
      <button
        onClick={navigateToCreate}
        style={{
          padding: '1rem 2rem',
          fontSize: '1.1rem',
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
        }}
      >
        新しいイベントを作成
      </button>

      {history.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: '#333' }}>
            最近のイベント
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {history.map((item, index) => (
              <div
                key={index}
                style={{
                  padding: '1rem',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.5rem',
                      background: item.type === 'created' ? '#007bff' : '#28a745',
                      color: 'white',
                      borderRadius: '4px',
                    }}
                  >
                    {item.type === 'created' ? '作成' : '回答'}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#666' }}>
                    {formatDate(item.type === 'created' ? item.createdAt : item.respondedAt)}
                  </span>
                </div>
                <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{item.title}</div>
                {item.type === 'responded' && (
                  <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                    {item.participantName} として回答
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {item.type === 'created' ? (
                    <>
                      <a
                        href={`/e/${item.eventId}?token=${item.editToken}`}
                        style={{
                          fontSize: '0.9rem',
                          color: '#007bff',
                          textDecoration: 'none',
                        }}
                      >
                        編集・管理
                      </a>
                      <span style={{ color: '#ccc' }}>|</span>
                      <a
                        href={`/v/${item.eventId}?token=${item.viewToken}`}
                        style={{
                          fontSize: '0.9rem',
                          color: '#007bff',
                          textDecoration: 'none',
                        }}
                      >
                        結果を見る
                      </a>
                    </>
                  ) : (
                    <a
                      href={`/v/${item.eventId}?token=${item.viewToken}`}
                      style={{
                        fontSize: '0.9rem',
                        color: '#007bff',
                        textDecoration: 'none',
                      }}
                    >
                      結果を見る
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
