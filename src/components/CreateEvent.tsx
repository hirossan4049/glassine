import { useState, useMemo } from 'react';
import TimeGrid from './TimeGrid';
import CalendarGrid from './CalendarGrid';
import type { TimeSlot, EventMode } from '../types';

interface CreateEventProps {
  onBack: () => void;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export default function CreateEvent({ onBack }: CreateEventProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<EventMode>('datetime');
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Sort selected dates for TimeGrid
  const sortedDates = useMemo(() => {
    return Array.from(selectedDates).sort();
  }, [selectedDates]);

  // Generate day labels for TimeGrid based on selected dates
  const dayLabels = useMemo(() => {
    return sortedDates.map((dateStr) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const weekday = WEEKDAYS[date.getDay()];
      return `${month}/${day}(${weekday})`;
    });
  }, [sortedDates]);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('イベント名を入力してください');
      return;
    }

    if (mode === 'dateonly') {
      if (selectedDates.size === 0) {
        setError('候補日程を選択してください');
        return;
      }
    } else {
      if (selectedDates.size === 0) {
        setError('候補日を選択してください');
        return;
      }
      if (selectedSlots.size === 0) {
        setError('候補時間を選択してください');
        return;
      }
    }

    setCreating(true);
    setError('');

    try {
      let slots: TimeSlot[];

      if (mode === 'dateonly') {
        slots = Array.from(selectedDates).map((dateStr) => {
          const [year, month, day] = dateStr.split('-').map(Number);
          const date = new Date(year, month - 1, day);
          date.setHours(0, 0, 0, 0);
          const start = date.getTime();
          const end = start + (24 * 60 * 60 * 1000) - 1;
          return { start, end };
        });
      } else {
        // For datetime mode, combine selected dates with selected time slots
        slots = [];
        selectedSlots.forEach((key) => {
          const [dayIndexStr, hourStr, minuteStr] = key.split('-');
          const dayIndex = parseInt(dayIndexStr);
          const hour = parseInt(hourStr);
          const minute = parseInt(minuteStr);

          // Get the actual date from sortedDates
          const dateStr = sortedDates[dayIndex];
          if (!dateStr) return;

          const [year, month, day] = dateStr.split('-').map(Number);
          const slotDate = new Date(year, month - 1, day);
          slotDate.setHours(hour, minute, 0, 0);

          const start = slotDate.getTime();
          const end = start + 30 * 60 * 1000;

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
            onClick={() => {
              setMode('dateonly');
              setSelectedSlots(new Set());
            }}
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
            onClick={() => {
              setMode('datetime');
            }}
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
              日付と時間を選択
            </div>
          </button>
        </div>
      </div>

      {/* Step 1: Select dates on calendar (both modes) */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          {mode === 'dateonly' ? '候補日程を選択 *' : 'Step 1: 候補日を選択 *'}
        </label>
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
          カレンダー上をドラッグして候補日を選択してください
        </p>
        <CalendarGrid
          selectedDates={selectedDates}
          onDatesChange={(dates) => {
            setSelectedDates(dates);
            // Clear time slots if dates changed in datetime mode
            if (mode === 'datetime') {
              setSelectedSlots(new Set());
            }
          }}
        />
        <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
          選択中: {selectedDates.size} 日
        </p>
      </div>

      {/* Step 2: Select time slots (datetime mode only) */}
      {mode === 'datetime' && selectedDates.size > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Step 2: 候補時間を選択 *
          </label>
          <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
            グリッド上をドラッグして候補時間を選択してください
          </p>
          <TimeGrid
            slots={[]}
            selectedSlots={selectedSlots}
            onSlotsChange={setSelectedSlots}
            days={dayLabels}
          />
          <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
            選択中: {selectedSlots.size} スロット
          </p>
        </div>
      )}

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
