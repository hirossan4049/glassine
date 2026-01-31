import { useState, useEffect } from 'react';
import type { Event, SlotAggregation, EventSlot, EventMode } from '../types';

function formatSlotDisplay(slot: EventSlot, mode: EventMode): string {
  const date = new Date(slot.start);
  if (mode === 'dateonly') {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  } else {
    return date.toLocaleString('ja-JP');
  }
}

interface EditEventProps {
  eventId: string;
  token: string;
  onBack: () => void;
}

export default function EditEvent({ eventId, token, onBack }: EditEventProps) {
  const [event, setEvent] = useState<Event | null>(null);
  const [aggregation, setAggregation] = useState<SlotAggregation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    loadEvent();
    loadAggregation();
  }, [eventId, token]);

  const loadEvent = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}?token=${token}`);
      const data = await response.json() as any;

      if (response.ok) {
        setEvent(data.event);
      } else {
        setError(data.error || 'イベントの読み込みに失敗しました');
      }
    } catch (_err) {
      setError('ネットワークエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const loadAggregation = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/aggregation?token=${token}`);
      const data = await response.json() as any;

      if (response.ok) {
        setAggregation(data.aggregation);
      }
    } catch (_err) {
      console.error('Failed to load aggregation', _err);
    }
  };

  const handleConfirm = async (slotIndices: number[]) => {
    setConfirming(true);
    try {
      const response = await fetch(`/api/events/${eventId}/confirm?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedSlots: slotIndices }),
      });

      if (response.ok) {
        loadEvent();
      } else {
        const data = await response.json() as any;
        setError(data.error || '確定に失敗しました');
      }
    } catch (_err) {
      setError('ネットワークエラーが発生しました');
    } finally {
      setConfirming(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('URLをコピーしました');
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>読み込み中...</div>;
  }

  if (error || !event) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ color: 'red' }}>{error || 'イベントが見つかりません'}</p>
        <button onClick={onBack} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
          戻る
        </button>
      </div>
    );
  }

  const viewUrl = `${window.location.origin}/v/${eventId}?token=${event.viewToken}`;
  const respondUrl = `${window.location.origin}/r/${eventId}?token=${event.viewToken}`;

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <button
        onClick={onBack}
        style={{
          padding: '0.5rem 1rem',
          marginBottom: '1rem',
          background: '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
        }}
      >
        ← 戻る
      </button>

      <h1 style={{ marginBottom: '0.5rem' }}>{event.title}</h1>
      {event.description && <p style={{ color: '#666', marginBottom: '1rem' }}>{event.description}</p>}

      <div
        style={{
          display: 'inline-block',
          padding: '0.25rem 0.75rem',
          background: event.mode === 'dateonly' ? '#6c757d' : '#17a2b8',
          color: 'white',
          borderRadius: '4px',
          fontSize: '0.9rem',
          marginBottom: '1.5rem',
        }}
      >
        {event.mode === 'dateonly' ? '日程のみ' : '時間込み'}
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>共有URL</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            参加者用URL（回答）
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={respondUrl}
              readOnly
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
            <button
              onClick={() => copyToClipboard(respondUrl)}
              style={{
                padding: '0.5rem 1rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
              }}
            >
              コピー
            </button>
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            閲覧用URL
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={viewUrl}
              readOnly
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
            <button
              onClick={() => copyToClipboard(viewUrl)}
              style={{
                padding: '0.5rem 1rem',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
              }}
            >
              コピー
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>回答状況</h2>
        <p>回答者数: {event.responses?.length || 0}</p>
        {event.responses && event.responses.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {event.responses.map((response) => (
              <li key={response.id} style={{ padding: '0.5rem 0' }}>
                {response.participantName}
              </li>
            ))}
          </ul>
        )}
      </div>

      {aggregation.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>
            おすすめ候補{event.mode === 'dateonly' ? '日程' : '日時'}
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f0f0f0' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>
                    日時
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ddd' }}>
                    ○
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ddd' }}>
                    △
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ddd' }}>
                    ×
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ddd' }}>
                    スコア
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ddd' }}>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {aggregation.slice(0, 10).map((agg) => {
                  const confirmedIndices = event.confirmedSlots
                    ? JSON.parse(event.confirmedSlots)
                    : [];
                  const isConfirmed = confirmedIndices.includes(agg.index);

                  return (
                    <tr key={agg.index}>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {formatSlotDisplay(agg.slot, event.mode)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ddd' }}>
                        {agg.availableCount}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ddd' }}>
                        {agg.maybeCount}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ddd' }}>
                        {agg.unavailableCount}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ddd' }}>
                        {agg.score}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ddd' }}>
                        <button
                          onClick={() => handleConfirm([agg.index])}
                          disabled={confirming || isConfirmed}
                          style={{
                            padding: '0.25rem 0.75rem',
                            background: isConfirmed ? '#28a745' : '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            cursor: isConfirmed ? 'default' : 'pointer',
                          }}
                        >
                          {isConfirmed ? '確定済み' : '確定'}
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
}
