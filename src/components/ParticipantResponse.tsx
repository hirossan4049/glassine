import { useState, useEffect, useMemo } from 'react';
import {
  Button,
  TextInput,
  Tag,
  InlineNotification,
  InlineLoading,
  Stack,
  FormLabel,
} from '@carbon/react';
import { ArrowLeft } from '@carbon/react/icons';
import TimeGrid from './TimeGrid';
import CalendarGrid from './CalendarGrid';
import type { Event, Availability } from '../types';
import { addRespondedEvent } from '../utils/history';
import { FORM } from '../constants/layout';

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
        slots = Array.from(dateAvailability.entries()).map(([dateStr, avail]) => {
          const [year, month, day] = dateStr.split('-').map(Number);
          const date = new Date(year, month - 1, day);
          date.setHours(0, 0, 0, 0);
          const start = date.getTime();
          const end = start + (24 * 60 * 60 * 1000) - 1;
          return { start, end, availability: avail };
        });
      } else {
        slots = [];
        for (const [key, avail] of availability.entries()) {
          const [dayIndexStr, hourStr, minuteStr] = key.split('-');
          const dayIndex = parseInt(dayIndexStr);
          const hour = parseInt(hourStr);
          const minute = parseInt(minuteStr);

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
        if (event) {
          addRespondedEvent({
            eventId,
            title: event.title,
            participantName: name.trim(),
            viewToken: token,
          });
        }
        // 回答状況ページに遷移
        window.location.href = `/e/${eventId}?token=${token}`;
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
    return (
      <div className="glassine-page">
        <InlineLoading description="読み込み中..." />
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="glassine-page">
        <Stack gap={4}>
          <InlineNotification
            kind="error"
            title="エラー"
            subtitle={error}
            hideCloseButton
          />
          <Button kind="secondary" onClick={onBack}>
            戻る
          </Button>
        </Stack>
      </div>
    );
  }

  const isDateOnly = event?.mode === 'dateonly';
  const currentAvailability = isDateOnly ? dateAvailability : availability;
  const inputUnit = isDateOnly ? '日' : 'スロット';

  const allowedDates = isDateOnly
    ? new Set(
        (event?.slots || []).map((slot) => {
          const date = new Date(slot.start);
          return dateKey(date);
        })
      )
    : undefined;

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

        <div>
          <h1 className="cds--type-productive-heading-04">{event?.title}</h1>
          {event?.description && (
            <p className="cds--type-body-01" style={{ color: 'var(--cds-text-secondary)', marginTop: '0.5rem' }}>
              {event.description}
            </p>
          )}
          <Tag
            type={isDateOnly ? 'gray' : 'teal'}
            size="sm"
            style={{ marginTop: '0.5rem' }}
          >
            {isDateOnly ? '日程のみ' : '時間込み'}
          </Tag>
        </div>

        <TextInput
          id="participant-name"
          labelText="お名前"
          placeholder="例: 山田太郎"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ maxWidth: FORM.nameInputMaxWidth }}
        />

        <div>
          <FormLabel>可否を入力</FormLabel>
          <p className="cds--type-helper-text-01" style={{ marginBottom: '1rem' }}>
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

          <p className="cds--type-helper-text-01" style={{ marginTop: '0.5rem' }}>
            入力済み: {currentAvailability.size} {inputUnit}
          </p>
        </div>

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
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? '送信中...' : '回答を送信'}
        </Button>
      </Stack>
    </div>
  );
}
