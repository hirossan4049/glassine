import { useState } from 'react';
import TimeGrid from './TimeGrid';
import CalendarGrid from './CalendarGrid';
import type { TimeSlot, EventMode } from '../types';

interface CreateEventProps {
  onBack: () => void;
}

export default function CreateEvent({ onBack }: CreateEventProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<EventMode>('datetime');
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('イベント名を入力してください');
      return;
    }

    const hasSelection = mode === 'dateonly'
      ? selectedDates.size > 0
      : selectedSlots.size > 0;

    if (!hasSelection) {
      setError('候補日時を選択してください');
      return;
    }

    setCreating(true);
    setError('');

    try {
      let slots: TimeSlot[];

      if (mode === 'dateonly') {
        // Convert selected dates to TimeSlot array
        slots = Array.from(selectedDates).map((dateStr) => {
          const [year, month, day] = dateStr.split('-').map(Number);
          const date = new Date(year, month - 1, day);
          date.setHours(0, 0, 0, 0);
          const start = date.getTime();
          const end = start + (24 * 60 * 60 * 1000) - 1; // 23:59:59.999
          return { start, end };
        });
      } else {
        // Convert selected slots to TimeSlot array (existing logic)
        slots = [];
        const now = new Date();
        const baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        selectedSlots.forEach((key) => {
          const [dayStr, hourStr, minuteStr] = key.split('-');
          const day = parseInt(dayStr);
          const hour = parseInt(hourStr);
          const minute = parseInt(minuteStr);

          // Calculate date for this day (0 = Monday of current/next week)
          const currentDay = now.getDay();
          const daysUntilMonday = currentDay === 0 ? 1 : 1 - currentDay;
          const monday = new Date(baseDate);
          monday.setDate(monday.getDate() + daysUntilMonday);

          const slotDate = new Date(monday);
          slotDate.setDate(slotDate.getDate() + day);
          slotDate.setHours(hour, minute, 0, 0);

          const start = slotDate.getTime();
          const end = start + 30 * 60 * 1000; // 30 minutes

          slots.push({ start, end });
        });
      }

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, slots, mode }),
      });

      const data = await response.json() as any;

      if (response.ok) {
        // Navigate to edit page
        window.location.href = data.editUrl;
      } else {
        setError(data.error || 'イベントの作成に失敗しました');
      }
    } catch (_err) {
      setError('ネットワークエラーが発生しました');
    } finally {
      setCreating(false);
    }
  };

  const selectionCount = mode === 'dateonly' ? selectedDates.size : selectedSlots.size;
  const selectionUnit = mode === 'dateonly' ? '日' : 'スロット';

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

      <h1 style={{ marginBottom: '1.5rem' }}>新しいイベントを作成</h1>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          イベント名 *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: 新年会の日程調整"
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          説明（任意）
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例: 場所や詳細情報など"
          rows={3}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            resize: 'vertical',
          }}
        />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          日程タイプ *
        </label>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setMode('dateonly')}
            style={{
              padding: '1rem 1.5rem',
              background: mode === 'dateonly' ? '#007bff' : '#f0f0f0',
              color: mode === 'dateonly' ? 'white' : 'black',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ fontWeight: 'bold' }}>日程のみ</div>
            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', opacity: 0.8 }}>
              日付だけを選択
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode('datetime')}
            style={{
              padding: '1rem 1.5rem',
              background: mode === 'datetime' ? '#007bff' : '#f0f0f0',
              color: mode === 'datetime' ? 'white' : 'black',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ fontWeight: 'bold' }}>時間込み</div>
            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', opacity: 0.8 }}>
              日時を選択
            </div>
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          候補{mode === 'dateonly' ? '日程' : '日時'}を選択 *
        </label>
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
          {mode === 'dateonly'
            ? 'カレンダー上をドラッグして候補日を選択してください'
            : 'グリッド上をドラッグして候補時間を選択してください'}
        </p>

        {mode === 'dateonly' ? (
          <CalendarGrid
            selectedDates={selectedDates}
            onDatesChange={setSelectedDates}
          />
        ) : (
          <TimeGrid
            slots={[]}
            selectedSlots={selectedSlots}
            onSlotsChange={setSelectedSlots}
          />
        )}

        <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
          選択中: {selectionCount} {selectionUnit}
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
        onClick={handleCreate}
        disabled={creating}
        style={{
          padding: '1rem 2rem',
          fontSize: '1.1rem',
          background: creating ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: creating ? 'not-allowed' : 'pointer',
        }}
      >
        {creating ? '作成中...' : 'イベントを作成'}
      </button>
    </div>
  );
}
