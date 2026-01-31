import { useState, useRef, useCallback, useEffect } from 'react';
import type { Availability } from '../types';

interface CalendarGridProps {
  selectedDates: Set<string>;
  onDatesChange: (dates: Set<string>) => void;
  mode?: 'select' | 'availability';
  availability?: Map<string, Availability>;
  onAvailabilityChange?: (availability: Map<string, Availability>) => void;
  allowedDates?: Set<string>;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];

  // Add padding for days before the first day of the month
  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push(null);
  }

  // Add all days of the month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  return days;
}

function isPastDate(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  return compareDate < today;
}

export default function CalendarGrid({
  selectedDates,
  onDatesChange,
  mode = 'select',
  availability = new Map(),
  onAvailabilityChange,
  allowedDates,
}: CalendarGridProps) {
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [paintMode, setPaintMode] = useState<'add' | 'remove'>('add');
  const [availabilityPaintMode, setAvailabilityPaintMode] = useState<Availability>('available');
  const [baseDate, setBaseDate] = useState(() => new Date());
  const gridRef = useRef<HTMLDivElement>(null);

  const handleCellMouseDown = useCallback((key: string, date: Date) => {
    if (isPastDate(date)) return;
    if (allowedDates && !allowedDates.has(key)) return;

    setIsMouseDown(true);

    if (mode === 'select') {
      const newDates = new Set(selectedDates);
      if (newDates.has(key)) {
        newDates.delete(key);
        setPaintMode('remove');
      } else {
        newDates.add(key);
        setPaintMode('add');
      }
      onDatesChange(newDates);
    } else if (mode === 'availability' && onAvailabilityChange) {
      const currentAvailability = availability.get(key);
      const newAvailability = new Map(availability);

      if (currentAvailability === 'available') {
        newAvailability.set(key, 'maybe');
        setAvailabilityPaintMode('maybe');
      } else if (currentAvailability === 'maybe') {
        newAvailability.set(key, 'unavailable');
        setAvailabilityPaintMode('unavailable');
      } else if (currentAvailability === 'unavailable') {
        newAvailability.delete(key);
        setAvailabilityPaintMode('available');
      } else {
        newAvailability.set(key, 'available');
        setAvailabilityPaintMode('available');
      }

      onAvailabilityChange(newAvailability);
    }
  }, [selectedDates, onDatesChange, mode, availability, onAvailabilityChange, allowedDates]);

  const handleCellMouseEnter = useCallback((key: string, date: Date) => {
    if (!isMouseDown) return;
    if (isPastDate(date)) return;
    if (allowedDates && !allowedDates.has(key)) return;

    if (mode === 'select') {
      const newDates = new Set(selectedDates);
      if (paintMode === 'add') {
        newDates.add(key);
      } else {
        newDates.delete(key);
      }
      onDatesChange(newDates);
    } else if (mode === 'availability' && onAvailabilityChange) {
      const newAvailability = new Map(availability);
      newAvailability.set(key, availabilityPaintMode);
      onAvailabilityChange(newAvailability);
    }
  }, [isMouseDown, paintMode, selectedDates, onDatesChange, mode, availabilityPaintMode, availability, onAvailabilityChange, allowedDates]);

  const handleMouseUp = useCallback(() => {
    setIsMouseDown(false);
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [handleMouseUp]);

  const getCellColor = (key: string, date: Date): string => {
    if (isPastDate(date)) return '#e9e9e9';
    if (allowedDates && !allowedDates.has(key)) return '#f5f5f5';

    if (mode === 'select') {
      return selectedDates.has(key) ? '#007bff' : '#fff';
    } else {
      const avail = availability.get(key);
      if (avail === 'available') return '#28a745';
      if (avail === 'maybe') return '#ffc107';
      if (avail === 'unavailable') return '#dc3545';
      return '#fff';
    }
  };

  const getTextColor = (key: string, date: Date): string => {
    if (isPastDate(date)) return '#999';
    if (mode === 'select' && selectedDates.has(key)) return '#fff';
    return '#333';
  };

  const navigateMonth = (delta: number) => {
    setBaseDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  const renderMonth = (year: number, month: number) => {
    const days = getMonthDays(year, month);
    const monthName = new Date(year, month).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
    });

    return (
      <div style={{ flex: 1, minWidth: '280px' }}>
        <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
          {monthName}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '2px',
            background: '#ddd',
            border: '1px solid #ddd',
          }}
        >
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              style={{
                background: '#f0f0f0',
                padding: '8px 4px',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                color: i === 0 ? '#dc3545' : i === 6 ? '#007bff' : '#333',
              }}
            >
              {day}
            </div>
          ))}
          {days.map((date, i) => {
            if (!date) {
              return <div key={`empty-${i}`} style={{ background: '#f9f9f9', height: '44px' }} />;
            }

            const key = dateKey(date);
            const dayOfWeek = date.getDay();
            const isToday = dateKey(new Date()) === key;

            return (
              <div
                key={key}
                data-key={key}
                onMouseDown={() => handleCellMouseDown(key, date)}
                onMouseEnter={() => handleCellMouseEnter(key, date)}
                onTouchStart={() => handleCellMouseDown(key, date)}
                onTouchMove={(e) => {
                  const touch = e.touches[0];
                  const element = document.elementFromPoint(touch.clientX, touch.clientY);
                  const cellKey = element?.getAttribute('data-key');
                  if (cellKey) {
                    const [y, m, d] = cellKey.split('-').map(Number);
                    handleCellMouseEnter(cellKey, new Date(y, m - 1, d));
                  }
                }}
                style={{
                  background: getCellColor(key, date),
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isPastDate(date) || (allowedDates && !allowedDates.has(key)) ? 'not-allowed' : 'pointer',
                  color: getTextColor(key, date),
                  fontWeight: isToday ? 'bold' : 'normal',
                  border: isToday ? '2px solid #333' : 'none',
                  boxSizing: 'border-box',
                  fontSize: '0.95rem',
                }}
              >
                <span style={{ color: dayOfWeek === 0 ? (selectedDates.has(key) ? '#fff' : '#dc3545') : dayOfWeek === 6 ? (selectedDates.has(key) ? '#fff' : '#007bff') : undefined }}>
                  {date.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const month1 = { year: baseDate.getFullYear(), month: baseDate.getMonth() };
  const month2Date = new Date(baseDate);
  month2Date.setMonth(month2Date.getMonth() + 1);
  const month2 = { year: month2Date.getFullYear(), month: month2Date.getMonth() };

  return (
    <div style={{ userSelect: 'none' }} ref={gridRef}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button
          onClick={() => navigateMonth(-1)}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #ddd',
            background: '#fff',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          &lt; 前月
        </button>
        <button
          onClick={() => navigateMonth(1)}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #ddd',
            background: '#fff',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          翌月 &gt;
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {renderMonth(month1.year, month1.month)}
        {renderMonth(month2.year, month2.month)}
      </div>

      {mode === 'availability' && (
        <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '20px', height: '20px', background: '#28a745' }} />
              <span>○ 参加可能</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '20px', height: '20px', background: '#ffc107' }} />
              <span>△ 参加可能かも</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '20px', height: '20px', background: '#dc3545' }} />
              <span>× 参加不可</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
