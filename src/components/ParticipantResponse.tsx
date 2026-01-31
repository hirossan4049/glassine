import { useState, useEffect } from 'react';
import TimeGrid from './TimeGrid';
import type { Event, Availability } from '../types';

interface ParticipantResponseProps {
  eventId: string;
  token: string;
  onBack: () => void;
}

export default function ParticipantResponse({ eventId, token, onBack }: ParticipantResponseProps) {
  const [event, setEvent] = useState<Event | null>(null);
  const [name, setName] = useState('');
  const [availability, setAvailability] = useState<Map<string, Availability>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadEvent();
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

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('名前を入力してください');
      return;
    }

    if (availability.size === 0) {
      setError('可否を入力してください');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Convert availability map to slots array
      const slots = Array.from(availability.entries()).map(([key, avail]) => {
        const [dayStr, hourStr, minuteStr] = key.split('-');
        const day = parseInt(dayStr);
        const hour = parseInt(hourStr);
        const minute = parseInt(minuteStr);

        // Calculate timestamp similar to CreateEvent
        const now = new Date();
        const baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const currentDay = now.getDay();
        const daysUntilMonday = currentDay === 0 ? 1 : 1 - currentDay;
        const monday = new Date(baseDate);
        monday.setDate(monday.getDate() + daysUntilMonday);

        const slotDate = new Date(monday);
        slotDate.setDate(slotDate.getDate() + day);
        slotDate.setHours(hour, minute, 0, 0);

        const start = slotDate.getTime();
        const end = start + 30 * 60 * 1000;

        return { start, end, availability: avail };
      });

      const response = await fetch(`/api/events/${eventId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantName: name, slots }),
      });

      const data = await response.json() as any;

      if (response.ok) {
        setSuccess(true);
        setName('');
        setAvailability(new Map());
      } else {
        setError(data.error || '回答の送信に失敗しました');
      }
    } catch (_err) {
      setError('ネットワークエラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>読み込み中...</div>;
  }

  if (error && !event) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ color: 'red' }}>{error}</p>
        <button onClick={onBack} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
          戻る
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ color: '#28a745', marginBottom: '1rem' }}>✓ 回答を送信しました</h1>
        <p style={{ marginBottom: '1.5rem' }}>ご協力ありがとうございました。</p>
        <button
          onClick={() => setSuccess(false)}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            marginRight: '1rem',
          }}
        >
          もう一度回答する
        </button>
        <button
          onClick={onBack}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          トップに戻る
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

      <h1 style={{ marginBottom: '0.5rem' }}>{event?.title}</h1>
      {event?.description && <p style={{ color: '#666', marginBottom: '1.5rem' }}>{event.description}</p>}

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          お名前 *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 山田太郎"
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '0.75rem',
            fontSize: '1rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          可否を入力 *
        </label>
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
          グリッド上をクリック/ドラッグして可否を入力してください
        </p>
        <TimeGrid
          slots={event?.slots || []}
          selectedSlots={new Set()}
          onSlotsChange={() => {}}
          mode="availability"
          availability={availability}
          onAvailabilityChange={setAvailability}
        />
        <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
          入力済み: {availability.size} スロット
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            background: '#f8d7da',
            color: '#721c24',
            borderRadius: '4px',
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          padding: '1rem 2rem',
          fontSize: '1.1rem',
          background: submitting ? '#ccc' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: submitting ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? '送信中...' : '回答を送信'}
      </button>
    </div>
  );
}
