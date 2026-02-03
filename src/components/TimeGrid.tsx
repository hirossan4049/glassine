import { useState, useRef, useCallback, useEffect, Fragment } from 'react';
import type { TimeSlot, Availability } from '../types';

interface TimeGridProps {
  slots: TimeSlot[];
  selectedSlots: Set<string>;
  onSlotsChange: (slots: Set<string>) => void;
  mode?: 'select' | 'availability';
  availability?: Map<string, Availability>;
  onAvailabilityChange?: (availability: Map<string, Availability>) => void;
  days?: string[];
  startDate?: Date;
}

const DEFAULT_DAYS = ['月', '火', '水', '木', '金', '土', '日'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 9); // 9:00 - 23:00

function formatTime(hour: number, minute: number): string {
  return `${hour}:${minute.toString().padStart(2, '0')}`;
}

function slotKey(day: number, hour: number, minute: number): string {
  return `${day}-${hour}-${minute}`;
}

// Parse slot key back to components
function parseSlotKey(key: string): { day: number; hour: number; minute: number } {
  const [day, hour, minute] = key.split('-').map(Number);
  return { day, hour, minute };
}

// Get all slot keys in a rectangle between two cells
function getKeysInRange(
  startKey: string,
  endKey: string,
  days: string[],
  hours: number[]
): string[] {
  const start = parseSlotKey(startKey);
  const end = parseSlotKey(endKey);

  const minDay = Math.min(start.day, end.day);
  const maxDay = Math.max(start.day, end.day);

  // Convert hour:minute to slot index for comparison
  const startSlotIndex = start.hour * 2 + (start.minute === 30 ? 1 : 0);
  const endSlotIndex = end.hour * 2 + (end.minute === 30 ? 1 : 0);
  const minSlotIndex = Math.min(startSlotIndex, endSlotIndex);
  const maxSlotIndex = Math.max(startSlotIndex, endSlotIndex);

  const keys: string[] = [];

  for (let dayIndex = minDay; dayIndex <= maxDay && dayIndex < days.length; dayIndex++) {
    for (const hour of hours) {
      for (const minute of [0, 30]) {
        const slotIndex = hour * 2 + (minute === 30 ? 1 : 0);
        if (slotIndex >= minSlotIndex && slotIndex <= maxSlotIndex) {
          keys.push(slotKey(dayIndex, hour, minute));
        }
      }
    }
  }

  return keys;
}

// Get keys within the same day column (vertical drag)
function getVerticalKeys(startKey: string, endKey: string, hours: number[]): string[] {
  const start = parseSlotKey(startKey);
  const end = parseSlotKey(endKey);

  const startSlotIndex = start.hour * 2 + (start.minute === 30 ? 1 : 0);
  const endSlotIndex = end.hour * 2 + (end.minute === 30 ? 1 : 0);
  const minSlotIndex = Math.min(startSlotIndex, endSlotIndex);
  const maxSlotIndex = Math.max(startSlotIndex, endSlotIndex);

  const keys: string[] = [];
  for (const hour of hours) {
    for (const minute of [0, 30]) {
      const slotIndex = hour * 2 + (minute === 30 ? 1 : 0);
      if (slotIndex >= minSlotIndex && slotIndex <= maxSlotIndex) {
        keys.push(slotKey(start.day, hour, minute));
      }
    }
  }
  return keys;
}

export default function TimeGrid({
  slots: _slots,
  selectedSlots,
  onSlotsChange,
  mode = 'select',
  availability = new Map(),
  onAvailabilityChange,
  days = DEFAULT_DAYS,
  startDate,
}: TimeGridProps) {
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [selectedBrush, setSelectedBrush] = useState<Availability | 'clear'>('available');
  const [lastClickedKey, setLastClickedKey] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ dayIndex: number; hour: number; minute: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragActionRef = useRef<'add' | 'remove'>('add'); // current drag action in select mode
  const dragAxisRef = useRef<'vertical' | 'horizontal' | null>(null); // lock drag axis after first move

  const getDayKeys = useCallback(
    (dayIndex: number) => {
      const keys: string[] = [];
      for (const hour of HOURS) {
        for (const minute of [0, 30]) {
          keys.push(slotKey(dayIndex, hour, minute));
        }
      }
      return keys;
    },
    []
  );

  const getTimeRowKeys = useCallback(
    (hour: number, minute: number) => {
      const keys: string[] = [];
      days.forEach((_, dayIndex) => {
        keys.push(slotKey(dayIndex, hour, minute));
      });
      return keys;
    },
    [days]
  );

  const applyKeys = useCallback(
    (keys: string[], action?: 'add' | 'remove') => {
      if (mode === 'select') {
        const newSlots = new Set(selectedSlots);
        const op = action ?? 'add';
        if (op === 'add') {
          keys.forEach((k) => newSlots.add(k));
        } else {
          keys.forEach((k) => newSlots.delete(k));
        }
        onSlotsChange(newSlots);
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
    [availability, mode, onAvailabilityChange, onSlotsChange, selectedBrush, selectedSlots]
  );

  const handleCellMouseDown = useCallback((key: string, shiftKey: boolean) => {
    const actionForSelect: 'add' | 'remove' = selectedSlots.has(key) ? 'remove' : 'add';
    dragActionRef.current = actionForSelect;
    dragAxisRef.current = null;

    // Shift+click for range selection
    if (shiftKey && lastClickedKey) {
      const keysInRange = getKeysInRange(lastClickedKey, key, days, HOURS);
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
  }, [applyKeys, days, lastClickedKey, selectedSlots]);

  const handleCellMouseEnter = useCallback((key: string) => {
    if (!isMouseDown) return;
    if (!lastClickedKey) return;

    const start = parseSlotKey(lastClickedKey);
    const current = parseSlotKey(key);

    // Decide axis on first movement
    if (!dragAxisRef.current) {
      if (current.day !== start.day) {
        dragAxisRef.current = 'horizontal';
      } else if (current.hour !== start.hour || current.minute !== start.minute) {
        dragAxisRef.current = 'vertical';
      }
    }

    if (dragAxisRef.current === 'vertical') {
      const keysInColumn = getVerticalKeys(lastClickedKey, key, HOURS);
      applyKeys(keysInColumn, dragActionRef.current);
      return;
    }

    // default (horizontal or mixed): rectangle
    const keysInRange = getKeysInRange(lastClickedKey, key, days, HOURS);
    applyKeys(keysInRange, dragActionRef.current);
  }, [applyKeys, days, isMouseDown, lastClickedKey]);

  const handleMouseUp = useCallback(() => {
    setIsMouseDown(false);
    dragAxisRef.current = null;
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [handleMouseUp]);

  const getCellColor = (key: string): string => {
    if (mode === 'select') {
      return selectedSlots.has(key) ? '#007bff' : '#fff';
    } else {
      const avail = availability.get(key);
      if (avail === 'available') return '#28a745';
      if (avail === 'maybe') return '#ffc107';
      if (avail === 'unavailable') return '#dc3545';
      return '#fff';
    }
  };

  const brushOptions: { value: Availability | 'clear'; label: string; color: string; symbol: string }[] = [
    { value: 'available', label: '参加可能', color: '#28a745', symbol: '○' },
    { value: 'maybe', label: '参加可能かも', color: '#ffc107', symbol: '△' },
    { value: 'unavailable', label: '参加不可', color: '#dc3545', symbol: '×' },
    { value: 'clear', label: 'クリア', color: '#fff', symbol: '消' },
  ];

  // Generate day headers with dates if startDate is provided
  const dayHeaders = days.map((day, index) => {
    if (startDate) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + index);
      const month = date.getMonth() + 1;
      const dayOfMonth = date.getDate();
      return `${month}/${dayOfMonth}(${day})`;
    }
    return day;
  });

  const resolveBulkAction = (keys: string[]): 'add' | 'remove' => {
    const allSelected = keys.every((k) => selectedSlots.has(k));
    return allSelected ? 'remove' : 'add';
  };

  const handleDayHeaderClick = (dayIndex: number) => {
    const keys = getDayKeys(dayIndex);
    applyKeys(keys, resolveBulkAction(keys));
  };

  const handleTimeHeaderClick = (hour: number, minute: number) => {
    const keys = getTimeRowKeys(hour, minute);
    applyKeys(keys, resolveBulkAction(keys));
  };

  return (
    <div style={{ overflowX: 'auto', userSelect: 'none' }}>
      <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.9rem', color: '#555' }}>💡 ドラッグ塗り / Shift+クリックで範囲 / 見出しクリックで列・行まとめて塗り</div>
        {mode === 'select' && (
          <div style={{ fontSize: '0.85rem', color: '#555' }}>クリックでトグル / ドラッグで範囲</div>
        )}
        {lastClickedKey && (
          <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#444', background: '#f8f9fa', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #e9ecef' }}>
            選択中: {mode === 'select' ? selectedSlots.size : availability.size} / 起点 {lastClickedKey}
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

      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `60px repeat(${days.length}, 60px)`,
          gap: '1px',
          background: '#ddd',
          border: '1px solid #ddd',
          minWidth: 'fit-content',
        }}
        onMouseLeave={() => setHoveredCell(null)}
      >
        {/* Header row */}
        <div style={{ background: '#f0f0f0', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
          時間
        </div>
        {dayHeaders.map((day, index) => (
          <div
            key={index}
            onMouseDown={() => handleDayHeaderClick(index)}
            onMouseEnter={() => setHoveredCell({ dayIndex: index, hour: -1, minute: -1 })}
            style={{ background: '#f0f0f0', padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}
          >
            {day}
          </div>
        ))}

        {/* Time slots */}
        {HOURS.map((hour) =>
          [0, 30].map((minute) => {
            const timeLabel = minute === 0 ? formatTime(hour, 0) : '';
            return (
              <Fragment key={`${hour}-${minute}`}>
                <div
                  style={{
                    background: '#f0f0f0',
                    padding: '4px',
                    textAlign: 'right',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                  }}
                  onMouseDown={() => handleTimeHeaderClick(hour, minute)}
                  onMouseEnter={() => setHoveredCell({ dayIndex: -1, hour, minute })}
                >
                  {timeLabel}
                </div>
                {days.map((_, dayIndex) => {
                  const key = slotKey(dayIndex, hour, minute);
                  const isHoverRow = hoveredCell?.hour === hour && hoveredCell?.minute === minute;
                  const isHoverCol = hoveredCell?.dayIndex === dayIndex;
                  return (
                    <div
                      key={key}
                      onMouseDown={(e) => handleCellMouseDown(key, e.shiftKey)}
                      onMouseEnter={() => {
                        setHoveredCell({ dayIndex, hour, minute });
                        handleCellMouseEnter(key);
                      }}
                      onTouchStart={() => handleCellMouseDown(key, false)}
                      onTouchMove={(e) => {
                        const touch = e.touches[0];
                        const element = document.elementFromPoint(touch.clientX, touch.clientY);
                        const cellKey = element?.getAttribute('data-key');
                        if (cellKey) handleCellMouseEnter(cellKey);
                      }}
                      data-key={key}
                      style={{
                        background: getCellColor(key),
                        height: '30px',
                        cursor: 'pointer',
                        transition: 'background 0.08s, box-shadow 0.08s',
                        boxShadow:
                          isHoverRow || isHoverCol
                            ? 'inset 0 0 0 2px rgba(13,110,253,0.25)'
                            : 'none',
                      }}
                    />
                  );
                })}
              </Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}
