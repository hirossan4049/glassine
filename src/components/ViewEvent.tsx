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

interface ViewEventProps {
  eventId: string;
  token: string;
  onBack: () => void;
}

export default function ViewEvent({ eventId, token, onBack }: ViewEventProps) {
  const [event, setEvent] = useState<Event | null>(null);
  const [aggregation, setAggregation] = useState<SlotAggregation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    } catch (err) {
      console.error('Failed to load aggregation', err);
    }
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
        <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>回答状況</h2>
        <p>回答者数: {event.responses?.length || 0}</p>
      </div>

      {aggregation.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>
            候補{event.mode === 'dateonly' ? '日程' : '日時'}一覧
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
                </tr>
              </thead>
              <tbody>
                {aggregation.map((agg) => {
                  const confirmedIndices = event.confirmedSlots
                    ? JSON.parse(event.confirmedSlots)
                    : [];
                  const isConfirmed = confirmedIndices.includes(agg.index);

                  return (
                    <tr key={agg.index} style={{ background: isConfirmed ? '#d4edda' : 'white' }}>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {formatSlotDisplay(agg.slot, event.mode)}
                        {isConfirmed && <span style={{ marginLeft: '0.5rem', color: '#28a745', fontWeight: 'bold' }}>✓ 確定</span>}
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
