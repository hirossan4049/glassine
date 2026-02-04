import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button, Layer } from '@carbon/react';
import type { Availability } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';
import { CALENDAR_GRID,  } from '../constants/layout';

interface CalendarGridProps {
  selectedDates: Set<string>;
  onDatesChange: (dates: Set<string>) => void;
  mode?: 'select' | 'availability';
  availability?: Map<string, Availability>;
  onAvailabilityChange?: (availability: Map<string, Availability>) => void;
  allowedDates?: Set<string>;
}

// Drag state for preview rendering (no state updates during drag)
interface DragState {
  anchorKey: string;
  currentKey: string;
  action: 'add' | 'remove';
  baseDates: Set<string>;
  baseAvailability: Map<string, Availability>;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const palette = {
  layer: 'var(--cds-layer-01, #ffffff)',
  layerAlt: 'var(--cds-layer-02, #f4f4f4)',
  border: 'var(--cds-border-subtle-00, #e0e0e0)',
  borderStrong: 'var(--cds-border-strong-01, #8d8d8d)',
  text: 'var(--cds-text-primary, #161616)',
  textSubtle: 'var(--cds-text-secondary, #525252)',
  accent: 'var(--cds-link-primary, #0f62fe)',
  accentPressed: 'var(--cds-link-primary-hover, #0043ce)',
  available: 'var(--glassine-available, #24a148)',
  maybe: 'var(--glassine-maybe, #f1c21b)',
  unavailable: 'var(--glassine-unavailable, #da1e28)',
};

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

// Create a Set of keys in the range for fast lookup
function getDateKeysInRangeSet(startKey: string, endKey: string, allowedDates?: Set<string>): Set<string> {
  return new Set(getDateKeysInRange(startKey, endKey, allowedDates));
}

export default function CalendarGrid({
  selectedDates,
  onDatesChange,
  mode = 'select',
  availability = new Map(),
  onAvailabilityChange,
  allowedDates,
}: CalendarGridProps) {
  const isMobile = useIsMobile();
  const [selectedBrush, setSelectedBrush] = useState<Availability | 'clear'>('available');
  const [baseDate, setBaseDate] = useState(() => new Date());
  const [lastClickedKey, setLastClickedKey] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Drag state as ref (no re-render during drag, only preview)
  const dragRef = useRef<DragState | null>(null);
  // Force re-render for preview during drag
  const [dragPreviewKey, setDragPreviewKey] = useState(0);

  const rafRef = useRef<number | null>(null);
  const pendingCurrentKeyRef = useRef<string | null>(null);

  // Apply keys for bulk operations (weekday header clicks)
  const applyKeys = useCallback(
    (keys: string[], action: 'add' | 'remove') => {
      if (mode === 'select') {
        const newDates = new Set(selectedDates);
        if (action === 'add') {
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

  // Start drag
  const handlePointerDown = useCallback((key: string, date: Date, shiftKey: boolean, e: React.PointerEvent) => {
    if (isPastDate(date)) return;
    if (allowedDates && !allowedDates.has(key)) return;

    // Shift+click for range selection (immediate apply, no drag)
    if (shiftKey && lastClickedKey) {
      const keysInRange = getDateKeysInRange(lastClickedKey, key, allowedDates);
      const action: 'add' | 'remove' = selectedDates.has(lastClickedKey) ? 'add' : 'remove';
      applyKeys(keysInRange, action);
      setLastClickedKey(key);
      return;
    }

    // Determine action based on anchor cell state
    const action: 'add' | 'remove' = selectedDates.has(key) ? 'remove' : 'add';

    // Initialize drag state
    dragRef.current = {
      anchorKey: key,
      currentKey: key,
      action,
      baseDates: new Set(selectedDates),
      baseAvailability: new Map(availability),
    };

    setLastClickedKey(key);
    setDragPreviewKey((k) => k + 1);

    // Capture pointer for smooth drag even outside grid
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [allowedDates, applyKeys, availability, lastClickedKey, selectedDates]);

  // Update drag preview with RAF throttling
  const updateDragPreview = useCallback((key: string) => {
    pendingCurrentKeyRef.current = key;

    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (dragRef.current && pendingCurrentKeyRef.current) {
        dragRef.current.currentKey = pendingCurrentKeyRef.current;
        setDragPreviewKey((k) => k + 1);
      }
    });
  }, []);

  // Handle pointer move (drag)
  const handlePointerMove = useCallback((key: string, date: Date) => {
    if (!dragRef.current) return;
    if (isPastDate(date)) return;
    if (allowedDates && !allowedDates.has(key)) return;
    if (dragRef.current.currentKey === key) return;
    updateDragPreview(key);
  }, [allowedDates, updateDragPreview]);

  // Finalize drag and apply changes
  const handlePointerUp = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const drag = dragRef.current;
    if (!drag) return;

    const keysInRange = getDateKeysInRange(drag.anchorKey, drag.currentKey, allowedDates);

    if (mode === 'select') {
      let newDates: Set<string>;
      if (drag.action === 'add') {
        // baseDates ∪ range
        newDates = new Set(drag.baseDates);
        keysInRange.forEach((k) => newDates.add(k));
      } else {
        // baseDates \ range
        newDates = new Set(drag.baseDates);
        keysInRange.forEach((k) => newDates.delete(k));
      }
      onDatesChange(newDates);
    } else if (mode === 'availability' && onAvailabilityChange) {
      const newAvailability = new Map(drag.baseAvailability);
      keysInRange.forEach((k) => {
        if (selectedBrush === 'clear') {
          newAvailability.delete(k);
        } else {
          newAvailability.set(k, selectedBrush);
        }
      });
      onAvailabilityChange(newAvailability);
    }

    dragRef.current = null;
    setDragPreviewKey((k) => k + 1);
  }, [allowedDates, mode, onAvailabilityChange, onDatesChange, selectedBrush]);

  // Global pointer up handler for edge cases
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (dragRef.current) {
        handlePointerUp();
      }
    };
    document.addEventListener('pointerup', handleGlobalPointerUp);
    document.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      document.removeEventListener('pointerup', handleGlobalPointerUp);
      document.removeEventListener('pointercancel', handleGlobalPointerUp);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handlePointerUp]);

  // Get cell color considering drag preview
  const getCellColor = useCallback((key: string, date: Date): string => {
    if (isPastDate(date)) return palette.layerAlt;
    if (allowedDates && !allowedDates.has(key)) return palette.layer;

    const drag = dragRef.current;

    if (mode === 'select') {
      if (drag) {
        const inRange = getDateKeysInRangeSet(drag.anchorKey, drag.currentKey, allowedDates).has(key);
        if (drag.action === 'add') {
          // Preview: baseDates ∪ range
          return (drag.baseDates.has(key) || inRange) ? palette.accent : palette.layer;
        } else {
          // Preview: baseDates \ range
          return (drag.baseDates.has(key) && !inRange) ? palette.accent : palette.layer;
        }
      }
      return selectedDates.has(key) ? palette.accent : palette.layer;
    } else {
      // Availability mode
      if (drag) {
        const inRange = getDateKeysInRangeSet(drag.anchorKey, drag.currentKey, allowedDates).has(key);
        if (inRange) {
          if (selectedBrush === 'clear') return palette.layer;
          if (selectedBrush === 'available') return palette.available;
          if (selectedBrush === 'maybe') return palette.maybe;
          if (selectedBrush === 'unavailable') return palette.unavailable;
        }
        // Not in range: show base state
        const avail = drag.baseAvailability.get(key);
        if (avail === 'available') return palette.available;
        if (avail === 'maybe') return palette.maybe;
        if (avail === 'unavailable') return palette.unavailable;
        return palette.layer;
      }
      const avail = availability.get(key);
      if (avail === 'available') return palette.available;
      if (avail === 'maybe') return palette.maybe;
      if (avail === 'unavailable') return palette.unavailable;
      return palette.layer;
    }
  }, [allowedDates, availability, mode, selectedBrush, selectedDates, dragPreviewKey]);

  const getTextColor = (key: string, date: Date): string => {
    if (isPastDate(date)) return palette.textSubtle;
    if (mode === 'select' && selectedDates.has(key)) return '#fff';
    if (mode === 'availability') {
      const avail = availability.get(key);
      if (avail === 'available' || avail === 'unavailable') return '#fff';
    }
    return palette.text;
  };

  const navigateMonth = (delta: number) => {
    setBaseDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  // Find cell key from pointer coordinates
  const getCellKeyFromPoint = useCallback((x: number, y: number): { key: string; date: Date } | null => {
    const element = document.elementFromPoint(x, y);
    const cellKey = element?.getAttribute('data-key');
    if (!cellKey) return null;
    const [y2, m, d] = cellKey.split('-').map(Number);
    return { key: cellKey, date: new Date(y2, m - 1, d) };
  }, []);

  const renderMonth = (year: number, month: number, days: (Date | null)[]) => {
    const monthName = new Date(year, month).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
    });

    return (
      <div
        style={{
          flex: 1,
          minWidth: isMobile ? CALENDAR_GRID.monthMinWidth.mobile : CALENDAR_GRID.monthMinWidth.desktop,
          maxWidth: isMobile ? CALENDAR_GRID.monthMinWidth.mobile : undefined,
          background: palette.layerAlt,
          borderRadius: 0,
          padding: isMobile ? '0.5rem' : '0.75rem',
          border: `1px solid ${palette.border}`,
          boxShadow: 'none',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            fontWeight: 700,
            marginBottom: '0.5rem',
            fontSize: '1.05rem',
            color: palette.text,
            letterSpacing: '0.01em',
          }}
        >
          {monthName}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '1px',
            background: palette.border,
            border: `1px solid ${palette.border}`,
            borderRadius: '8px',
            overflow: 'hidden',
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            const result = getCellKeyFromPoint(e.clientX, e.clientY);
            if (result) handlePointerMove(result.key, result.date);
          }}
          onPointerUp={handlePointerUp}
        >
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              style={{
                background: palette.layer,
                padding: '10px 4px',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
                color: i === 0 ? palette.unavailable : i === 6 ? palette.accent : palette.text,
                borderBottom: `1px solid ${palette.border}`,
                borderRadius: 0,
              }}
            >
              {day}
            </div>
          ))}
          {days.map((date, i) => {
            if (!date) {
              return <div key={`empty-${i}`} style={{ background: palette.layerAlt, height: '44px' }} />;
            }

            const key = dateKey(date);
            const dayOfWeek = date.getDay();
            const isToday = dateKey(new Date()) === key;

            return (
              <div
                key={key}
                data-key={key}
                onPointerDown={(e) => handlePointerDown(key, date, e.shiftKey, e)}
                onPointerEnter={() => handlePointerMove(key, date)}
                style={{
                  background: getCellColor(key, date),
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isPastDate(date) || (allowedDates && !allowedDates.has(key)) ? 'not-allowed' : 'pointer',
                  color: getTextColor(key, date),
                  fontWeight: isToday ? 800 : 600,
                  boxSizing: 'border-box',
                  fontSize: '0.95rem',
                  transition: 'background 120ms ease',
                  outline: isToday ? `2px solid ${palette.accent}` : 'none',
                  outlineOffset: '-2px',
                  position: 'relative',
                  touchAction: 'none',
                }}
              >
                <span
                  style={{
                    color:
                      dayOfWeek === 0
                        ? selectedDates.has(key) || availability.get(key)
                          ? '#fff'
                          : palette.unavailable
                        : dayOfWeek === 6
                        ? selectedDates.has(key) || availability.get(key)
                          ? '#fff'
                          : palette.accent
                        : undefined,
                  }}
                >
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

  const brushOptions: { value: Availability | 'clear'; label: string; symbol: string; symbolColor: string }[] = [
    { value: 'available', label: '参加可能', symbol: '○', symbolColor: 'var(--glassine-available)' },
    { value: 'maybe', label: '参加可能かも', symbol: '△', symbolColor: 'var(--glassine-maybe)' },
    { value: 'unavailable', label: '参加不可', symbol: '×', symbolColor: 'var(--glassine-unavailable)' },
    { value: 'clear', label: 'クリア', symbol: '−', symbolColor: 'var(--cds-text-secondary)' },
  ];

  return (
    <Layer level={1}>
      <div
        ref={gridRef}
        style={{
          userSelect: 'none',
          background: palette.layer,
          borderRadius: 0,
          padding: '1rem',
          border: `1px solid ${palette.border}`,
          boxShadow: 'none',
          overflowX: isMobile ? 'hidden' : 'scroll',
          WebkitOverflowScrolling: isMobile ? undefined : 'touch',
        }}
      >

      {mode === 'availability' && (
        <div style={{ margin: isMobile ? '0.75rem 0 0.5rem' : '1rem 0 0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: palette.text, fontSize: isMobile ? '0.85rem' : undefined }}>ブラシ:</span>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {brushOptions.map((option) => (
              <Button
                key={option.value}
                kind={selectedBrush === option.value ? 'primary' : 'tertiary'}
                size="sm"
                onClick={() => setSelectedBrush(option.value)}
                style={{ minWidth: isMobile ? '44px' : undefined, padding: isMobile ? '0.5rem' : undefined }}
              >
                <span style={{ fontSize: isMobile ? '1.2rem' : '1.1rem', color: selectedBrush === option.value ? 'inherit' : option.symbolColor, marginRight: isMobile ? 0 : '0.25rem' }}>{option.symbol}</span>
                {!isMobile && option.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: isMobile ? '0.75rem 0' : '1rem 0', gap: '0.5rem' }}>
        <Button kind="tertiary" size={isMobile ? 'sm' : 'md'} onClick={() => navigateMonth(-1)}>
          ← {isMobile ? '' : '前月'}
        </Button>
        {!isMobile && (
          <div
            style={{
              padding: '0.35rem 0.75rem',
              background: palette.layerAlt,
              borderRadius: 0,
              border: `1px solid ${palette.border}`,
              color: palette.textSubtle,
              fontSize: '0.9rem',
            }}
          >
            ペイントツール感覚で日付を塗ってください
          </div>
        )}
        <Button kind="tertiary" size={isMobile ? 'sm' : 'md'} onClick={() => navigateMonth(1)}>
          {isMobile ? '' : '翌月'} →
        </Button>
      </div>

      {!isMobile && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: palette.textSubtle }}>曜日列まとめ塗り:</span>
          {WEEKDAYS.map((day, idx) => {
            const keys = collectWeekdayKeys(idx);
            const disabled = keys.length === 0;
            return (
              <Button
                key={day}
                kind="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => applyKeys(keys, resolveBulkAction(keys))}
              >
                {day}
              </Button>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: isMobile ? '0.75rem' : '1.25rem', flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
        {renderMonth(month1.year, month1.month, month1Days)}
        {!isMobile && renderMonth(month2.year, month2.month, month2Days)}
      </div>
      </div>
    </Layer>
  );
}
