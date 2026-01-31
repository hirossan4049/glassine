import { useState, useEffect, useMemo } from 'react';
import TimeGrid from './TimeGrid';
import CalendarGrid from './CalendarGrid';
import type { Event, Availability } from '../types';
import { addRespondedEvent } from '../utils/history';

interface ParticipantResponseProps {
  eventId: string;
  token: string;
  onBack: () => void;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ParticipantResponse({ eventId, token, onBack }: ParticipantResponseProps) {
  const [event, setEvent] = useState<Event | null>(null);
  const [name, setName] = useState('');
  const [availability, setAvailability] = useState<Map<string, Availability>>(new Map());
  const [dateAvailability, setDateAvailability] = useState<Map<string, Availability>>(new Map());
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

  // Extract unique dates from event slots for datetime mode
  const { sortedDates, dayLabels } = useMemo(() => {
    if (!event || event.mode === 'dateonly') {
      return { sortedDates: [], dayLabels: [] };
    }

    const datesSet = new Set<string>();

    for (const slot of event.slots) {
      const date = new Date(slot.start);
      const key = dateKey(date);
      datesSet.add(key);
    }

    const sorted = Array.from(datesSet).sort();
    const labels = sorted.map((dateStr) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const weekday = WEEKDAYS[date.getDay()];
      return `${month}/${day}(${weekday})`;
    });

    return { sortedDates: sorted, dayLabels: labels };
  }, [event]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('名前を入力してください');
      return;
    }

    const isDateOnly = event?.mode === 'dateonly';
    const currentAvailability = isDateOnly ? dateAvailability : availability;

    if (currentAvailability.size === 0) {
      setError('可否を入力してください');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let slots;

      if (isDateOnly) {
        // Convert date availability to slots array
        slots = Array.from(dateAvailability.entries()).map(([dateStr, avail]) => {
          const [year, month, day] = dateStr.split('-').map(Number);
          const date = new Date(year, month - 1, day);
          date.setHours(0, 0, 0, 0);
          const start = date.getTime();
          const end = start + (24 * 60 * 60 * 1000) - 1;
          return { start, end, availability: avail };
        });
      } else {
        // For datetime mode, convert grid key (dayIndex-hour-minute) to actual slot timestamps
        slots = [];
        for (const [key, avail] of availability.entries()) {
          const [dayIndexStr, hourStr, minuteStr] = key.split('-');
          const dayIndex = parseInt(dayIndexStr);
          const hour = parseInt(hourStr);
          const minute = parseInt(minuteStr);

          // Get the actual date from sortedDates
          const dateStr = sortedDates[dayIndex];
          if (!dateStr) continue;

          const [year, month, day] = dateStr.split('-').map(Number);
          const slotDate = new Date(year, month - 1, day);
          slotDate.setHours(hour, minute, 0, 0);

          const start = slotDate.getTime();
          const end = start + 30 * 60 * 1000;

          slots.push({ start, end, availability: avail });
        }
      }

      const response = await fetch(`/api/events/${eventId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantName: name, slots }),
      });

      const data = await response.json() as any;

      if (response.ok) {
        // 履歴に保存
        if (event) {
          addRespondedEvent({
            eventId,
            title: event.title,
            participantName: name.trim(),
            viewToken: token,
          });
        }
        setSuccess(true);
        setName('');
        setAvailability(new Map());
        setDateAvailability(new Map());
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
        <h1 style={{ color: '#28a745', marginBottom: '1rem' }}>回答を送信しました</h1>
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

  const isDateOnly = event?.mode === 'dateonly';
  const currentAvailability = isDateOnly ? dateAvailability : availability;
  const inputUnit = isDateOnly ? '日' : 'スロット';

  // Generate allowed dates from event slots for date-only mode
  const allowedDates = isDateOnly
    ? new Set(
        (event?.slots || []).map((slot) => {
          const date = new Date(slot.start);
          return dateKey(date);
        })
      )
    : undefined;

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
      {event?.description && <p style={{ color: '#666', marginBottom: '1rem' }}>{event.description}</p>}

      <div
        style={{
          display: 'inline-block',
          padding: '0.25rem 0.75rem',
          background: isDateOnly ? '#6c757d' : '#17a2b8',
          color: 'white',
          borderRadius: '4px',
          fontSize: '0.9rem',
          marginBottom: '1.5rem',
        }}
      >
        {isDateOnly ? '日程のみ' : '時間込み'}
      </div>

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
          ブラシを選択してから、{isDateOnly ? 'カレンダー' : 'グリッド'}上をクリック/ドラッグして可否を入力してください
        </p>

        {isDateOnly ? (
          <CalendarGrid
            selectedDates={new Set()}
            onDatesChange={() => {}}
            mode="availability"
            availability={dateAvailability}
            onAvailabilityChange={setDateAvailability}
            allowedDates={allowedDates}
          />
        ) : (
          <TimeGrid
            slots={event?.slots || []}
            selectedSlots={new Set()}
            onSlotsChange={() => {}}
            mode="availability"
            availability={availability}
            onAvailabilityChange={setAvailability}
            days={dayLabels}
          />
        )}

        <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
          入力済み: {currentAvailability.size} {inputUnit}
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
