import { useState, useRef, useCallback, useEffect, Fragment } from 'react';
import { Button, Layer } from '@carbon/react';
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

const palette = {
  layer: 'var(--cds-layer-01)',
  layerAlt: 'var(--cds-layer-02)',
  border: 'var(--cds-border-subtle)',
  borderStrong: 'var(--cds-border-strong)',
  text: 'var(--cds-text-primary)',
  textSubtle: 'var(--cds-text-secondary)',
  accent: 'var(--cds-interactive)',
  available: 'var(--cds-available)',
  maybe: 'var(--cds-maybe)',
  unavailable: 'var(--cds-unavailable)',
};

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
      return selectedSlots.has(key) ? palette.accent : palette.layer;
    } else {
      const avail = availability.get(key);
      if (avail === 'available') return palette.available;
      if (avail === 'maybe') return palette.maybe;
      if (avail === 'unavailable') return palette.unavailable;
      return palette.layer;
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
    <Layer level={1}>
      <div
        style={{
          overflowX: 'auto',
          userSelect: 'none',
          background: palette.layer,
          padding: '1rem',
          borderRadius: 0,
          border: `1px solid ${palette.border}`,
          boxShadow: 'none',
        }}
      >
      <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.95rem', color: palette.text }}>💡 Excelライクにドラッグ + ペイント塗り</div>
        <div style={{ fontSize: '0.85rem', color: palette.textSubtle }}>Shiftで範囲 / 見出しクリックで列・行まとめて</div>
        {lastClickedKey && (
          <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: palette.text, background: palette.layerAlt, padding: '0.35rem 0.6rem', borderRadius: '8px', border: `1px solid ${palette.border}` }}>
            {mode === 'select' ? '選択枠' : '設定枠'}: {mode === 'select' ? selectedSlots.size : availability.size} / 起点 {lastClickedKey}
          </div>
        )}
      </div>
      {mode === 'availability' && (
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: palette.text }}>ブラシ:</span>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {brushOptions.map((option) => (
              <Button
                key={option.value}
                kind={selectedBrush === option.value ? 'primary' : 'tertiary'}
                size="sm"
                onClick={() => setSelectedBrush(option.value)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: option.value === 'clear' ? palette.layer : option.color, borderRadius: 0 }}
              >
                <span style={{ fontSize: '1.1rem', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.08))' }}>{option.symbol}</span>
                <span>{option.label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `72px repeat(${days.length}, 72px)`,
          gap: '1px',
          background: palette.border,
          border: `1px solid ${palette.border}`,
          minWidth: 'fit-content',
          borderRadius: 0,
          overflow: 'hidden',
        }}
        onMouseLeave={() => setHoveredCell(null)}
      >
        {/* Header row */}
        <div
          style={{
            background: palette.layerAlt,
            padding: '10px',
            textAlign: 'center',
            fontWeight: 700,
            borderRight: `1px solid ${palette.border}`,
            color: palette.text,
            fontSize: '0.9rem',
          }}
        >
          時間
        </div>
        {dayHeaders.map((day, index) => (
          <div
            key={index}
            onMouseDown={() => handleDayHeaderClick(index)}
            onMouseEnter={() => setHoveredCell({ dayIndex: index, hour: -1, minute: -1 })}
            style={{
              background: palette.layerAlt,
              padding: '10px 6px',
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: palette.text,
              borderRight: index === dayHeaders.length - 1 ? 'none' : `1px solid ${palette.border}`,
              borderBottom: `1px solid ${palette.border}`,
              cursor: 'pointer',
              userSelect: 'none',
            }}
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
                    background: palette.layerAlt,
                    padding: '6px',
                    textAlign: 'right',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    color: palette.text,
                    borderRight: `1px solid ${palette.border}`,
                    borderBottom: `1px solid ${palette.border}`,
                    cursor: 'pointer',
                    userSelect: 'none',
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
                        height: '32px',
                        cursor: 'pointer',
                        transition: 'background 0.08s, box-shadow 0.12s, transform 0.08s',
                        boxShadow:
                          isHoverRow || isHoverCol
                            ? 'inset 0 0 0 2px rgba(15,98,254,0.28)'
                            : 'inset 0 0 0 1px rgba(0,0,0,0.03)',
                        borderRight: `1px solid ${palette.border}`,
                        borderBottom: `1px solid ${palette.border}`,
                        transform: isHoverRow || isHoverCol ? 'scale(1.01)' : 'none',
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
    </Layer>
  );
}
