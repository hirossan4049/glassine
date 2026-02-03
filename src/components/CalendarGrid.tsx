import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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

  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push(null);
  }

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

// Get all date keys between two dates (inclusive)
function getDateKeysInRange(startKey: string, endKey: string, allowedDates?: Set<string>): string[] {
  const [startYear, startMonth, startDay] = startKey.split('-').map(Number);
  const [endYear, endMonth, endDay] = endKey.split('-').map(Number);

  const startDate = new Date(startYear, startMonth - 1, startDay);
  const endDate = new Date(endYear, endMonth - 1, endDay);

  // Ensure start is before end
  const minDate = startDate < endDate ? startDate : endDate;
  const maxDate = startDate < endDate ? endDate : startDate;

  const keys: string[] = [];
  const current = new Date(minDate);

  while (current <= maxDate) {
    if (!isPastDate(current)) {
      const key = dateKey(current);
      if (!allowedDates || allowedDates.has(key)) {
        keys.push(key);
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return keys;
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
  const [selectedBrush, setSelectedBrush] = useState<Availability | 'clear'>('available');
  const [baseDate, setBaseDate] = useState(() => new Date());
  const [lastClickedKey, setLastClickedKey] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragActionRef = useRef<'add' | 'remove'>('add');

  const applyKeys = useCallback(
    (keys: string[], action?: 'add' | 'remove') => {
      if (mode === 'select') {
        const newDates = new Set(selectedDates);
        const op = action ?? 'add';
        if (op === 'add') {
          keys.forEach((k) => newDates.add(k));
        } else {
          keys.forEach((k) => newDates.delete(k));
        }
        onDatesChange(newDates);
      } else if (mode === 'availability' && onAvailabilityChange) {
        const newAvailability = new Map(availability);
        keys.forEach((k) => {
          if (selectedBrush === 'clear') {
            newAvailability.delete(k);
          } else {
            newAvailability.set(k, selectedBrush);
          }
        });
        onAvailabilityChange(newAvailability);
      }
    },
    [availability, mode, onAvailabilityChange, onDatesChange, selectedBrush, selectedDates]
  );

  const handleCellMouseDown = useCallback((key: string, date: Date, shiftKey: boolean) => {
    if (isPastDate(date)) return;
    if (allowedDates && !allowedDates.has(key)) return;

    const actionForSelect: 'add' | 'remove' = selectedDates.has(key) ? 'remove' : 'add';
    dragActionRef.current = actionForSelect;

    // Shift+click for range selection
    if (shiftKey && lastClickedKey) {
      const keysInRange = getDateKeysInRange(lastClickedKey, key, allowedDates);
      setLastClickedKey(key);

      applyKeys(keysInRange, actionForSelect);
      return;
    }

    setIsMouseDown(true);
    setLastClickedKey(key);

    if (mode === 'select') {
      applyKeys([key], actionForSelect);
    } else if (mode === 'availability' && onAvailabilityChange) {
      applyKeys([key]);
    }
  }, [allowedDates, applyKeys, lastClickedKey, selectedDates]);

  const handleCellMouseEnter = useCallback((key: string, date: Date) => {
    if (!isMouseDown) return;
    if (isPastDate(date)) return;
    if (allowedDates && !allowedDates.has(key)) return;

    if (lastClickedKey) {
      // Excel風: ドラッグ中は起点と現在セルで囲まれた範囲をまとめて塗る
      const keysInRange = getDateKeysInRange(lastClickedKey, key, allowedDates);
      applyKeys(keysInRange, dragActionRef.current);
    } else {
      applyKeys([key], dragActionRef.current);
    }
  }, [allowedDates, applyKeys, isMouseDown, lastClickedKey]);

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
    if (mode === 'availability') {
      const avail = availability.get(key);
      if (avail === 'available' || avail === 'unavailable') return '#fff';
    }
    return '#333';
  };

  const navigateMonth = (delta: number) => {
    setBaseDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  const renderMonth = (year: number, month: number, days: (Date | null)[]) => {
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
                onMouseDown={(e) => handleCellMouseDown(key, date, e.shiftKey)}
                onMouseEnter={() => handleCellMouseEnter(key, date)}
                onTouchStart={() => handleCellMouseDown(key, date, false)}
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
                <span style={{ color: dayOfWeek === 0 ? (selectedDates.has(key) || availability.get(key) ? '#fff' : '#dc3545') : dayOfWeek === 6 ? (selectedDates.has(key) || availability.get(key) ? '#fff' : '#007bff') : undefined }}>
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
  const month1Days = getMonthDays(month1.year, month1.month);
  const month2Days = getMonthDays(month2.year, month2.month);

  const monthData = useMemo(
    () => [
      { year: month1.year, month: month1.month, days: month1Days },
      { year: month2.year, month: month2.month, days: month2Days },
    ],
    [month1.year, month1.month, month1Days, month2.year, month2.month, month2Days]
  );

  const collectWeekdayKeys = useCallback(
    (weekday: number) => {
      const keys: string[] = [];
      monthData.forEach(({ days }) => {
        days.forEach((date) => {
          if (!date) return;
          if (date.getDay() !== weekday) return;
          if (isPastDate(date)) return;
          const key = dateKey(date);
          if (allowedDates && !allowedDates.has(key)) return;
          keys.push(key);
        });
      });
      return keys;
    },
    [allowedDates, monthData]
  );

  const resolveBulkAction = useCallback(
    (keys: string[]) => {
      const allSelected = keys.every((k) => selectedDates.has(k));
      return allSelected ? 'remove' : 'add';
    },
    [selectedDates]
  );

  const brushOptions: { value: Availability | 'clear'; label: string; color: string; symbol: string }[] = [
    { value: 'available', label: '参加可能', color: '#28a745', symbol: '○' },
    { value: 'maybe', label: '参加可能かも', color: '#ffc107', symbol: '△' },
    { value: 'unavailable', label: '参加不可', color: '#dc3545', symbol: '×' },
    { value: 'clear', label: 'クリア', color: '#fff', symbol: '消' },
  ];

  return (
    <div style={{ userSelect: 'none' }} ref={gridRef}>
      <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.9rem', color: '#555' }}>💡 ドラッグ塗り / Shift+クリックで範囲 / 曜日ヘッダーで列まとめて塗り</div>
        {mode === 'select' && (
          <div style={{ fontSize: '0.85rem', color: '#555' }}>クリックでトグル / ドラッグで範囲</div>
        )}
        {lastClickedKey && (
          <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#444', background: '#f8f9fa', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #e9ecef' }}>
            選択中: {mode === 'select' ? selectedDates.size : availability.size} / 起点 {lastClickedKey}
          </div>
        )}
      </div>
      {mode === 'availability' && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>ブラシを選択:</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {brushOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedBrush(option.value)}
                style={{
                  padding: '0.5rem 1rem',
                  background: option.color,
                  color: option.value === 'clear' || option.value === 'maybe' ? '#333' : '#fff',
                  border: selectedBrush === option.value ? '3px solid #333' : '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: selectedBrush === option.value ? 'bold' : 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>{option.symbol}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85rem', color: '#555' }}>曜日列をまとめて塗る:</span>
        {WEEKDAYS.map((day, idx) => {
          const keys = collectWeekdayKeys(idx);
          const disabled = keys.length === 0;
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => applyKeys(keys, resolveBulkAction(keys))}
              style={{
                padding: '0.35rem 0.7rem',
                minWidth: '44px',
                background: '#fff',
                color: disabled ? '#aaa' : '#0d6efd',
                border: '1px solid #d0d7de',
                borderRadius: '4px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                boxShadow: disabled ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {renderMonth(month1.year, month1.month, month1Days)}
        {renderMonth(month2.year, month2.month, month2Days)}
      </div>
    </div>
  );
}
