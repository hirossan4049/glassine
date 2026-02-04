import { useState, useRef, useCallback, useEffect, Fragment, useMemo } from 'react';
import { Button, Layer } from '@carbon/react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { TimeSlot, Availability } from '../types';
import { useIsMobile, useWindowWidth, useWindowHeight } from '../hooks/useMediaQuery';
import { TIME_GRID, STATUS_DISPLAY } from '../constants/layout';

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

// Drag state for preview rendering (no state updates during drag)
interface DragState {
  anchorKey: string;
  currentKey: string;
  action: 'add' | 'remove';
  baseSlots: Set<string>;
  baseAvailability: Map<string, Availability>;
}

const DEFAULT_DAYS = ['月', '火', '水', '木', '金', '土', '日'];
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0:00 - 23:00

const palette = {
  layer: 'var(--cds-layer-01, #ffffff)',
  layerAlt: 'var(--cds-layer-02, #f4f4f4)',
  border: 'var(--cds-border-subtle-00, #e0e0e0)',
  borderStrong: 'var(--cds-border-strong-01, #8d8d8d)',
  text: 'var(--cds-text-primary, #161616)',
  textSubtle: 'var(--cds-text-secondary, #525252)',
  accent: 'var(--cds-link-primary, #0f62fe)',
  available: 'var(--glassine-available, #24a148)',
  maybe: 'var(--glassine-maybe, #f1c21b)',
  unavailable: 'var(--glassine-unavailable, #da1e28)',
};

function formatTime(hour: number, minute: number): string {
  return `${hour}:${minute.toString().padStart(2, '0')}`;
}

function slotKey(day: number, hour: number, minute: number): string {
  return `${day}-${hour}-${minute}`;
}

// Convert hour:minute to slot index (30-minute units)
function toSlotIndex(hour: number, minute: number): number {
  return hour * 2 + (minute === 30 ? 1 : 0);
}

// Convert slot index back to hour:minute
function fromSlotIndex(slotIndex: number): { hour: number; minute: number } {
  return { hour: Math.floor(slotIndex / 2), minute: (slotIndex % 2) * 30 };
}

// Parse slot key to { day, hour, minute, slotIndex }
function parseSlotKey(key: string): { day: number; hour: number; minute: number; slotIndex: number } {
  const [day, hour, minute] = key.split('-').map(Number);
  return { day, hour, minute, slotIndex: toSlotIndex(hour, minute) };
}

// Get all slot keys in a rectangle between anchor and current cells
function getKeysInRect(anchorKey: string, currentKey: string, daysCount: number): string[] {
  const anchor = parseSlotKey(anchorKey);
  const current = parseSlotKey(currentKey);

  const minDay = Math.min(anchor.day, current.day);
  const maxDay = Math.min(Math.max(anchor.day, current.day), daysCount - 1);
  const minSlotIndex = Math.min(anchor.slotIndex, current.slotIndex);
  const maxSlotIndex = Math.max(anchor.slotIndex, current.slotIndex);

  const keys: string[] = [];
  for (let dayIndex = minDay; dayIndex <= maxDay; dayIndex++) {
    for (let si = minSlotIndex; si <= maxSlotIndex; si++) {
      const { hour, minute } = fromSlotIndex(si);
      if (hour >= HOURS[0] && hour <= HOURS[HOURS.length - 1]) {
        keys.push(slotKey(dayIndex, hour, minute));
      }
    }
  }
  return keys;
}

// Create a Set of keys in the rect for fast lookup
function getKeysInRectSet(anchorKey: string, currentKey: string, daysCount: number): Set<string> {
  return new Set(getKeysInRect(anchorKey, currentKey, daysCount));
}

// Navigation constants for mobile
const CELL_WIDTH_PX = 48;
const CELL_HEIGHT_PX = 40;
const NAV_BUTTONS_WIDTH = 80; // 2 × 40px
const CONTAINER_PADDING = 16; // 0.5rem × 2
const NAV_GAP = 4; // 2px × 2
const TIME_CELL_WIDTH_PX = 56;
// Vertical layout overhead (header, footer, padding, nav buttons, grid header, etc.)
const VERTICAL_OVERHEAD_PX = 300;

export default function TimeGrid({
  slots,
  selectedSlots,
  onSlotsChange,
  mode = 'select',
  availability = new Map(),
  onAvailabilityChange,
  days = DEFAULT_DAYS,
  startDate,
}: TimeGridProps) {
  const isMobile = useIsMobile();
  const windowWidth = useWindowWidth();
  const windowHeight = useWindowHeight();
  const [selectedBrush, setSelectedBrush] = useState<Availability | 'clear'>('available');
  const [lastClickedKey, setLastClickedKey] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ dayIndex: number; hour: number; minute: number } | null>(null);

  // Calculate allowed slot keys from slots prop (for availability mode)
  const allowedSlotKeys = useMemo(() => {
    if (mode !== 'availability' || slots.length === 0) return null;

    // Extract unique dates from slots and sort them
    const dateMap = new Map<string, number>();
    const sortedDates: string[] = [];
    for (const slot of slots) {
      const date = new Date(slot.start);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      if (!dateMap.has(key)) {
        dateMap.set(key, sortedDates.length);
        sortedDates.push(key);
      }
    }

    // Build set of allowed keys
    const allowed = new Set<string>();
    for (const slot of slots) {
      const date = new Date(slot.start);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const dayIndex = dateMap.get(dateKey)!;
      const hour = date.getHours();
      const minute = date.getMinutes();
      allowed.add(slotKey(dayIndex, hour, minute));
    }
    return allowed;
  }, [slots, mode]);

  // Navigation state for mobile
  const [dayOffset, setDayOffset] = useState(0);
  const [timeOffset, setTimeOffset] = useState(0);

  // Calculate visible days based on screen width
  const visibleDaysMobile = Math.max(
    2,
    Math.floor((windowWidth - NAV_BUTTONS_WIDTH - CONTAINER_PADDING - NAV_GAP - TIME_CELL_WIDTH_PX) / CELL_WIDTH_PX)
  );

  // Calculate visible hours based on screen height
  // Each hour = 2 cells (30min intervals), each cell = CELL_HEIGHT_PX
  const availableHeight = windowHeight - VERTICAL_OVERHEAD_PX;
  const visibleSlots = Math.floor(availableHeight / CELL_HEIGHT_PX);
  const visibleHoursMobile = Math.max(3, Math.min(8, Math.floor(visibleSlots / 2)));

  // Calculate visible range
  const maxDayOffset = Math.max(0, days.length - visibleDaysMobile);
  const maxTimeOffset = Math.max(0, HOURS.length - visibleHoursMobile);

  const visibleDayIndices = isMobile
    ? Array.from({ length: Math.min(visibleDaysMobile, days.length) }, (_, i) => i + dayOffset)
    : Array.from({ length: days.length }, (_, i) => i);
  const visibleHourIndices = isMobile
    ? HOURS.slice(timeOffset, timeOffset + visibleHoursMobile)
    : HOURS;

  const canNavigate = {
    up: timeOffset > 0,
    down: timeOffset < maxTimeOffset,
    left: dayOffset > 0,
    right: dayOffset < maxDayOffset,
  };

  const handleNavigate = (direction: 'up' | 'down' | 'left' | 'right') => {
    switch (direction) {
      case 'up':
        setTimeOffset((prev) => Math.max(0, prev - 1));
        break;
      case 'down':
        setTimeOffset((prev) => Math.min(maxTimeOffset, prev + 1));
        break;
      case 'left':
        setDayOffset((prev) => Math.max(0, prev - 1));
        break;
      case 'right':
        setDayOffset((prev) => Math.min(maxDayOffset, prev + 1));
        break;
    }
  };

  // Drag state as ref (no re-render during drag, only preview)
  const dragRef = useRef<DragState | null>(null);
  // Force re-render for preview during drag
  const [dragPreviewKey, setDragPreviewKey] = useState(0);

  const gridRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const pendingCurrentKeyRef = useRef<string | null>(null);

  // Responsive cell width - scales with viewport on mobile
  const cellWidth = isMobile ? TIME_GRID.cellWidth.mobile : TIME_GRID.cellWidth.desktop;
  const timeCellWidth = isMobile ? TIME_GRID.timeCellWidth.mobile : TIME_GRID.timeCellWidth.desktop;

  const getDayKeys = useCallback((dayIndex: number) => {
    const keys: string[] = [];
    for (const hour of HOURS) {
      for (const minute of [0, 30]) {
        keys.push(slotKey(dayIndex, hour, minute));
      }
    }
    return keys;
  }, []);

  const getTimeRowKeys = useCallback((hour: number, minute: number) => {
    const keys: string[] = [];
    days.forEach((_, dayIndex) => {
      keys.push(slotKey(dayIndex, hour, minute));
    });
    return keys;
  }, [days]);

  // Apply keys for bulk operations (header clicks)
  const applyKeys = useCallback(
    (keys: string[], action: 'add' | 'remove') => {
      if (mode === 'select') {
        const newSlots = new Set(selectedSlots);
        if (action === 'add') {
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

  // Start drag
  const handlePointerDown = useCallback((key: string, shiftKey: boolean, e: React.PointerEvent) => {
    // Shift+click for range selection (immediate apply, no drag)
    if (shiftKey && lastClickedKey) {
      let keysInRange = getKeysInRect(lastClickedKey, key, days.length);
      // Filter out disabled keys in availability mode
      if (allowedSlotKeys) {
        keysInRange = keysInRange.filter((k) => allowedSlotKeys.has(k));
      }
      const action: 'add' | 'remove' = selectedSlots.has(lastClickedKey) ? 'add' : 'remove';
      applyKeys(keysInRange, action);
      setLastClickedKey(key);
      return;
    }

    // Determine action based on anchor cell state
    const action: 'add' | 'remove' = selectedSlots.has(key) ? 'remove' : 'add';

    // Initialize drag state
    dragRef.current = {
      anchorKey: key,
      currentKey: key,
      action,
      baseSlots: new Set(selectedSlots),
      baseAvailability: new Map(availability),
    };

    setLastClickedKey(key);
    setDragPreviewKey((k) => k + 1);

    // Capture pointer for smooth drag even outside grid
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [allowedSlotKeys, applyKeys, availability, days.length, lastClickedKey, selectedSlots]);

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
  const handlePointerMove = useCallback((key: string) => {
    if (!dragRef.current) return;
    if (dragRef.current.currentKey === key) return;
    updateDragPreview(key);
  }, [updateDragPreview]);

  // Finalize drag and apply changes
  const handlePointerUp = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const drag = dragRef.current;
    if (!drag) return;

    let keysInRange = getKeysInRect(drag.anchorKey, drag.currentKey, days.length);
    // Filter out disabled keys in availability mode
    if (allowedSlotKeys) {
      keysInRange = keysInRange.filter((k) => allowedSlotKeys.has(k));
    }

    if (mode === 'select') {
      let newSlots: Set<string>;
      if (drag.action === 'add') {
        // baseSlots ∪ range
        newSlots = new Set(drag.baseSlots);
        keysInRange.forEach((k) => newSlots.add(k));
      } else {
        // baseSlots \ range
        newSlots = new Set(drag.baseSlots);
        keysInRange.forEach((k) => newSlots.delete(k));
      }
      onSlotsChange(newSlots);
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
  }, [allowedSlotKeys, days.length, mode, onAvailabilityChange, onSlotsChange, selectedBrush]);

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
  const getCellColor = useCallback((key: string): string => {
    const drag = dragRef.current;

    if (mode === 'select') {
      if (drag) {
        const inRange = getKeysInRectSet(drag.anchorKey, drag.currentKey, days.length).has(key);
        if (drag.action === 'add') {
          // Preview: baseSlots ∪ range
          return (drag.baseSlots.has(key) || inRange) ? palette.accent : palette.layer;
        } else {
          // Preview: baseSlots \ range
          return (drag.baseSlots.has(key) && !inRange) ? palette.accent : palette.layer;
        }
      }
      return selectedSlots.has(key) ? palette.accent : palette.layer;
    } else {
      // Availability mode
      if (drag) {
        const inRange = getKeysInRectSet(drag.anchorKey, drag.currentKey, days.length).has(key);
        // Don't show preview for disabled keys
        const isAllowed = !allowedSlotKeys || allowedSlotKeys.has(key);
        if (inRange && isAllowed) {
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
  }, [allowedSlotKeys, availability, days.length, mode, selectedBrush, selectedSlots, dragPreviewKey]);

  const brushOptions: { value: Availability | 'clear'; label: string; symbol: string; symbolColor: string }[] = [
    { value: 'available', label: '参加可能', symbol: '○', symbolColor: 'var(--glassine-available)' },
    { value: 'maybe', label: '参加可能かも', symbol: '△', symbolColor: 'var(--glassine-maybe)' },
    { value: 'unavailable', label: '参加不可', symbol: '×', symbolColor: 'var(--glassine-unavailable)' },
    { value: 'clear', label: 'クリア', symbol: '−', symbolColor: 'var(--cds-text-secondary)' },
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

  // Find cell key from pointer coordinates
  const getCellKeyFromPoint = useCallback((x: number, y: number): string | null => {
    const element = document.elementFromPoint(x, y);
    return element?.getAttribute('data-key') ?? null;
  }, []);

  return (
    <Layer level={1}>
      <div
        style={{
          overflowX: 'auto',
          overflowY: isMobile ? 'hidden' : 'auto',
          maxWidth: '100%',
          userSelect: 'none',
          background: palette.layer,
          padding: isMobile ? '0.5rem' : '1rem',
          borderRadius: 0,
          border: isMobile ? 'none' : `1px solid ${palette.border}`,
          boxShadow: 'none',
          touchAction: isMobile ? 'pan-x' : 'pan-x pan-y',
        }}
      >
      {!isMobile && (
      <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.95rem', color: palette.text }}>
          Excelライクにドラッグ + ペイント塗り
        </div>
        <div style={{ fontSize: '0.85rem', color: palette.textSubtle }}>Shiftで範囲 / 見出しクリックで列・行まとめて</div>
        <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: palette.text, background: palette.layerAlt, padding: '0.35rem 0.6rem', borderRadius: '8px', border: `1px solid ${palette.border}`, visibility: lastClickedKey ? 'visible' : 'hidden', width: STATUS_DISPLAY.width.desktop, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {`${mode === 'select' ? '選択枠' : '設定枠'}: ${mode === 'select' ? selectedSlots.size : availability.size} / 起点 ${lastClickedKey}`}
        </div>
      </div>
      )}
      {mode === 'availability' && (
        <div style={{ marginBottom: isMobile ? '0.25rem' : '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: palette.text, fontSize: isMobile ? '0.85rem' : undefined }}>ブラシ:</span>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {brushOptions.map((option) => (
              <Button
                key={option.value}
                kind={selectedBrush === option.value ? 'primary' : 'tertiary'}
                size="sm"
                onClick={() => setSelectedBrush(option.value)}
                style={{ minWidth: isMobile ? '40px' : undefined, padding: isMobile ? '0.25rem 0.5rem' : undefined }}
              >
                <span style={{ fontSize: isMobile ? '1.1rem' : '1.1rem', color: selectedBrush === option.value ? 'inherit' : option.symbolColor, marginRight: isMobile ? 0 : '0.25rem' }}>{option.symbol}</span>
                {!isMobile && option.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation: Up button (mobile only) */}
      {isMobile && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2px' }}>
          <Button
            kind="tertiary"
            size="sm"
            onClick={() => handleNavigate('up')}
            disabled={!canNavigate.up}
            style={{ minWidth: '40px', padding: '0.25rem' }}
          >
            <ChevronUp size={18} />
          </Button>
        </div>
      )}

      {/* Left/Right buttons + Grid container (mobile only wraps with buttons) */}
      <div style={{ display: isMobile ? 'flex' : 'block', alignItems: 'center', gap: '2px' }}>
        {isMobile && (
          <Button
            kind="tertiary"
            size="sm"
            onClick={() => handleNavigate('left')}
            disabled={!canNavigate.left}
            style={{ minWidth: '40px', padding: '0.25rem', flexShrink: 0 }}
          >
            <ChevronLeft size={18} />
          </Button>
        )}

      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile
            ? `${timeCellWidth} repeat(${visibleDayIndices.length}, ${cellWidth})`
            : `72px repeat(${days.length}, 72px)`,
            gap: '1px',
            background: palette.border,
            border: `1px solid ${palette.border}`,
            width: 'fit-content',
            borderRadius: 0,
            overflow: 'hidden',
            flex: isMobile ? 1 : undefined,
          }}
          onPointerLeave={() => setHoveredCell(null)}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            const key = getCellKeyFromPoint(e.clientX, e.clientY);
            if (key) handlePointerMove(key);
          }}
          onPointerUp={handlePointerUp}
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
          {visibleDayIndices.map((dayIndex, visualIndex) => (
            <div
              key={dayIndex}
              onPointerDown={() => handleDayHeaderClick(dayIndex)}
              onPointerEnter={() => setHoveredCell({ dayIndex, hour: -1, minute: -1 })}
              style={{
                background: palette.layerAlt,
                padding: '10px 6px',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
                color: palette.text,
                borderRight: visualIndex === visibleDayIndices.length - 1 ? 'none' : `1px solid ${palette.border}`,
                borderBottom: `1px solid ${palette.border}`,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              {dayHeaders[dayIndex]}
            </div>
          ))}

          {/* Time slots */}
          {visibleHourIndices.map((hour) =>
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
                    onPointerDown={() => handleTimeHeaderClick(hour, minute)}
                    onPointerEnter={() => setHoveredCell({ dayIndex: -1, hour, minute })}
                  >
                    {timeLabel}
                  </div>
                  {visibleDayIndices.map((dayIndex) => {
                    const key = slotKey(dayIndex, hour, minute);
                    const isHoverRow = hoveredCell?.hour === hour && hoveredCell?.minute === minute;
                    const isHoverCol = hoveredCell?.dayIndex === dayIndex;
                    const isDisabled = allowedSlotKeys !== null && !allowedSlotKeys.has(key);
                    return (
                      <div
                        key={key}
                        data-key={isDisabled ? undefined : key}
                        onPointerDown={isDisabled ? undefined : (e) => handlePointerDown(key, e.shiftKey, e)}
                        onPointerEnter={isDisabled ? undefined : () => {
                          setHoveredCell({ dayIndex, hour, minute });
                          handlePointerMove(key);
                        }}
                        style={{
                          background: isDisabled ? 'var(--cds-layer-02, #f4f4f4)' : getCellColor(key),
                          height: isMobile ? '40px' : '32px',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          transition: 'background 0.08s, box-shadow 0.12s, transform 0.08s',
                          boxShadow:
                            isDisabled
                              ? 'none'
                              : isHoverRow || isHoverCol
                                ? 'inset 0 0 0 2px rgba(15,98,254,0.28)'
                                : 'inset 0 0 0 1px rgba(0,0,0,0.03)',
                          borderRight: `1px solid ${palette.border}`,
                          borderBottom: `1px solid ${palette.border}`,
                          transform: isHoverRow || isHoverCol && !isDisabled ? 'scale(1.01)' : 'none',
                          opacity: isDisabled ? 0.4 : 1,
                        }}
                      />
                    );
                  })}
                </Fragment>
              );
            })
          )}
        </div>

        {isMobile && (
          <Button
            kind="tertiary"
            size="sm"
            onClick={() => handleNavigate('right')}
            disabled={!canNavigate.right}
            style={{ minWidth: '40px', padding: '0.25rem', flexShrink: 0 }}
          >
            <ChevronRight size={18} />
          </Button>
        )}
      </div>

      {/* Navigation: Down button (mobile only) */}
      {isMobile && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2px' }}>
          <Button
            kind="tertiary"
            size="sm"
            onClick={() => handleNavigate('down')}
            disabled={!canNavigate.down}
            style={{ minWidth: '40px', padding: '0.25rem' }}
          >
            <ChevronDown size={18} />
          </Button>
        </div>
      )}
      </div>
    </Layer>
  );
}
