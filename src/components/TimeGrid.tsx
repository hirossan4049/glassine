import { useState, useRef, useCallback, useEffect, Fragment } from 'react';
import type { TimeSlot, Availability } from '../types';

interface TimeGridProps {
  slots: TimeSlot[]; // Reserved for future use to restrict selectable cells
  selectedSlots: Set<string>;
  onSlotsChange: (slots: Set<string>) => void;
  mode?: 'select' | 'availability';
  availability?: Map<string, Availability>;
  onAvailabilityChange?: (availability: Map<string, Availability>) => void;
}

const DAYS = ['月', '火', '水', '木', '金', '土', '日'];
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
  onAvailabilityChange
}: TimeGridProps) {
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [paintMode, setPaintMode] = useState<'add' | 'remove'>('add');
  const [availabilityPaintMode, setAvailabilityPaintMode] = useState<Availability>('available');
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
      const currentAvailability = availability.get(key);
      const newAvailability = new Map(availability);
      
      // Cycle through: available -> maybe -> unavailable -> (remove)
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
  }, [selectedSlots, onSlotsChange, mode, availability, onAvailabilityChange]);

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
      if (availabilityPaintMode === 'available' || availabilityPaintMode === 'maybe' || availabilityPaintMode === 'unavailable') {
        newAvailability.set(key, availabilityPaintMode);
      } else {
        newAvailability.delete(key);
      }
      onAvailabilityChange(newAvailability);
    }
  }, [isMouseDown, paintMode, selectedSlots, onSlotsChange, mode, availabilityPaintMode, availability, onAvailabilityChange]);

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

  return (
    <div style={{ overflowX: 'auto', userSelect: 'none' }}>
      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `60px repeat(${DAYS.length}, 60px)`,
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
        {DAYS.map((day) => (
          <div
            key={day}
            style={{ background: '#f0f0f0', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}
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
                {DAYS.map((_, dayIndex) => {
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
