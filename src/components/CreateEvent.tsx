import { useState, useMemo } from 'react';
import {
  Button,
  TextInput,
  TextArea,
  InlineNotification,
  SelectableTile,
  Stack,
  FormLabel,
} from '@carbon/react';
import { ArrowLeft } from '@carbon/react/icons';
import TimeGrid from './TimeGrid';
import CalendarGrid from './CalendarGrid';
import type { TimeSlot, EventMode } from '../types';
import { addCreatedEvent } from '../utils/history';
import { FORM } from '../constants/layout';

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

  const sortedDates = useMemo(() => {
    return Array.from(selectedDates).sort();
  }, [selectedDates]);

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
        slots = [];
        selectedSlots.forEach((key) => {
          const [dayIndexStr, hourStr, minuteStr] = key.split('-');
          const dayIndex = parseInt(dayIndexStr);
          const hour = parseInt(hourStr);
          const minute = parseInt(minuteStr);

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
        addCreatedEvent({
          eventId: data.eventId,
          title: title.trim(),
          editToken: data.editToken,
          viewToken: data.viewToken,
        });
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
    <div className="glassine-page">
      <Stack gap={6}>
        <Button
          kind="ghost"
          size="sm"
          renderIcon={ArrowLeft}
          onClick={onBack}
        >
          戻る
        </Button>

        <h1 className="cds--type-productive-heading-04">新しいイベントを作成</h1>

        <TextInput
          id="event-title"
          labelText="イベント名"
          placeholder="例: 新年会の日程調整"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <TextArea
          id="event-description"
          labelText="説明（任意）"
          placeholder="例: 場所や詳細情報など"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div>
          <FormLabel>日程タイプ</FormLabel>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <SelectableTile
              id="mode-dateonly"
              selected={mode === 'dateonly'}
              onClick={() => {
                setMode('dateonly');
                setSelectedSlots(new Set());
              }}
              style={{ flex: '1', minWidth: FORM.tileMinWidth }}
            >
              <p className="cds--type-body-compact-01" style={{ fontWeight: 600 }}>日程のみ</p>
              <p className="cds--type-helper-text-01">日付だけを選択</p>
            </SelectableTile>
            <SelectableTile
              id="mode-datetime"
              selected={mode === 'datetime'}
              onClick={() => setMode('datetime')}
              style={{ flex: '1', minWidth: FORM.tileMinWidth }}
            >
              <p className="cds--type-body-compact-01" style={{ fontWeight: 600 }}>時間込み</p>
              <p className="cds--type-helper-text-01">日付と時間を選択</p>
            </SelectableTile>
          </div>
        </div>

        <div>
          <FormLabel>
            {mode === 'dateonly' ? '候補日程を選択' : 'Step 1: 候補日を選択'}
          </FormLabel>
          <p className="cds--type-helper-text-01" style={{ marginBottom: '1rem' }}>
            カレンダー上をドラッグして候補日を選択してください
          </p>
          <CalendarGrid
            selectedDates={selectedDates}
            onDatesChange={(dates) => {
              setSelectedDates(dates);
              if (mode === 'datetime') {
                setSelectedSlots(new Set());
              }
            }}
          />
          <p className="cds--type-helper-text-01" style={{ marginTop: '0.5rem' }}>
            選択中: {selectedDates.size} 日
          </p>
        </div>

        {mode === 'datetime' && selectedDates.size > 0 && (
          <div>
            <FormLabel>Step 2: 候補時間を選択</FormLabel>
            <p className="cds--type-helper-text-01" style={{ marginBottom: '1rem' }}>
              グリッド上をドラッグして候補時間を選択してください
            </p>
            <TimeGrid
              slots={[]}
              selectedSlots={selectedSlots}
              onSlotsChange={setSelectedSlots}
              days={dayLabels}
            />
            <p className="cds--type-helper-text-01" style={{ marginTop: '0.5rem' }}>
              選択中: {selectedSlots.size} スロット
            </p>
          </div>
        )}

        {error && (
          <InlineNotification
            kind="error"
            title="エラー"
            subtitle={error}
            hideCloseButton
          />
        )}

        <Button
          kind="primary"
          size="lg"
          onClick={handleCreate}
          disabled={creating}
        >
          {creating ? '作成中...' : 'イベントを作成'}
        </Button>
      </Stack>
    </div>
  );
}
