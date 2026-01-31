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
  const [paintMode, setPaintMode] = useState<'add' | 'remove'>('add');
  const [selectedBrush, setSelectedBrush] = useState<Availability | 'clear'>('available');
  const gridRef = useRef<HTMLDivElement>(null);

  const handleCellMouseDown = useCallback((key: string) => {
    setIsMouseDown(true);

    if (mode === 'select') {
      const newSlots = new Set(selectedSlots);
      if (newSlots.has(key)) {
        newSlots.delete(key);
        setPaintMode('remove');
      } else {
        newSlots.add(key);
        setPaintMode('add');
      }
      onSlotsChange(newSlots);
    } else if (mode === 'availability' && onAvailabilityChange) {
      const newAvailability = new Map(availability);
      if (selectedBrush === 'clear') {
        newAvailability.delete(key);
      } else {
        newAvailability.set(key, selectedBrush);
      }
      onAvailabilityChange(newAvailability);
    }
  }, [selectedSlots, onSlotsChange, mode, availability, onAvailabilityChange, selectedBrush]);

  const handleCellMouseEnter = useCallback((key: string) => {
    if (!isMouseDown) return;

    if (mode === 'select') {
      const newSlots = new Set(selectedSlots);
      if (paintMode === 'add') {
        newSlots.add(key);
      } else {
        newSlots.delete(key);
      }
      onSlotsChange(newSlots);
    } else if (mode === 'availability' && onAvailabilityChange) {
      const newAvailability = new Map(availability);
      if (selectedBrush === 'clear') {
        newAvailability.delete(key);
      } else {
        newAvailability.set(key, selectedBrush);
      }
      onAvailabilityChange(newAvailability);
    }
  }, [isMouseDown, paintMode, selectedSlots, onSlotsChange, mode, selectedBrush, availability, onAvailabilityChange]);

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

  return (
    <div style={{ overflowX: 'auto', userSelect: 'none' }}>
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
      >
        {/* Header row */}
        <div style={{ background: '#f0f0f0', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
          時間
        </div>
        {dayHeaders.map((day, index) => (
          <div
            key={index}
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
                >
                  {timeLabel}
                </div>
                {days.map((_, dayIndex) => {
                  const key = slotKey(dayIndex, hour, minute);
                  return (
                    <div
                      key={key}
                      onMouseDown={() => handleCellMouseDown(key)}
                      onMouseEnter={() => handleCellMouseEnter(key)}
                      onTouchStart={() => handleCellMouseDown(key)}
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
                        transition: 'background 0.1s',
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
