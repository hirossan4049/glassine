import { useEffect, useState } from 'react';
import CreateEvent from './components/CreateEvent';
import EditEvent from './components/EditEvent';
import ViewEvent from './components/ViewEvent';
import ParticipantResponse from './components/ParticipantResponse';

type Page = 'home' | 'create' | 'edit' | 'view' | 'respond';

function App() {
  const [page, setPage] = useState<Page>('home');
  const [eventId, setEventId] = useState<string>('');
  const [token, setToken] = useState<string>('');

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
    </div>
  );
}

export default App;
