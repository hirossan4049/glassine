import { useEffect, useState } from 'react';
import { Button, ClickableTile, Tag, Link, Stack } from '@carbon/react';
import { Add } from '@carbon/react/icons';
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
    <div className="glassine-home">
      <Stack gap={6}>
        <div>
          <h1 className="cds--type-productive-heading-05">Glassine</h1>
          <p className="cds--type-body-01" style={{ color: 'var(--cds-text-secondary)', marginTop: '0.5rem' }}>
            ログイン不要の日程調整ツール
          </p>
        </div>

        <Button
          kind="primary"
          size="lg"
          renderIcon={Add}
          onClick={navigateToCreate}
        >
          新しいイベントを作成
        </Button>

        {history.length > 0 && (
          <div>
            <h2 className="cds--type-productive-heading-03" style={{ marginBottom: '1rem' }}>
              最近のイベント
            </h2>
            <Stack gap={4}>
              {history.map((item, index) => (
                <ClickableTile
                  key={index}
                  href={item.type === 'created'
                    ? `/e/${item.eventId}?token=${item.editToken}`
                    : `/v/${item.eventId}?token=${item.viewToken}`
                  }
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Tag
                      type={item.type === 'created' ? 'blue' : 'green'}
                      size="sm"
                    >
                      {item.type === 'created' ? '作成' : '回答'}
                    </Tag>
                    <span className="cds--type-helper-text-01">
                      {formatDate(item.type === 'created' ? item.createdAt : item.respondedAt)}
                    </span>
                  </div>
                  <p className="cds--type-body-compact-01" style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                    {item.title}
                  </p>
                  {item.type === 'responded' && (
                    <p className="cds--type-helper-text-01" style={{ marginBottom: '0.5rem' }}>
                      {item.participantName} として回答
                    </p>
                  )}
                  {item.type === 'created' && (
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <Link href={`/e/${item.eventId}?token=${item.editToken}`} size="sm">
                        編集・管理
                      </Link>
                      <Link href={`/v/${item.eventId}?token=${item.viewToken}`} size="sm">
                        結果を見る
                      </Link>
                    </div>
                  )}
                </ClickableTile>
              ))}
            </Stack>
          </div>
        )}
      </Stack>
    </div>
  );
}

export default App;
