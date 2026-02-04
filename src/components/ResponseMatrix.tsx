import { Button, Tile } from '@carbon/react';
import { Edit, TrashCan } from '@carbon/react/icons';
import type { Event, EventSlot, ParticipantResponse, Availability, EventMode } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';
import { RESPONSE_MATRIX } from '../constants/layout';

interface ResponseMatrixProps {
  event: Event;
  onEditResponse?: (response: ParticipantResponse) => void;
  onDeleteResponse?: (responseId: number) => void;
}

function formatSlotHeader(slot: EventSlot, mode: EventMode): { date: string; time?: string } {
  const d = new Date(slot.start);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[d.getDay()];
  const date = `${d.getMonth() + 1}/${d.getDate()}(${weekday})`;

  if (mode === 'dateonly') {
    return { date };
  } else {
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return { date, time: `${hours}:${minutes}` };
  }
}

function getAvailabilitySymbol(availability: Availability | undefined): string {
  if (availability === 'available') return '○';
  if (availability === 'maybe') return '△';
  if (availability === 'unavailable') return '×';
  return '-';
}

function getAvailabilityColor(availability: Availability | undefined): string {
  if (availability === 'available') return 'var(--glassine-available)';
  if (availability === 'maybe') return 'var(--glassine-maybe)';
  if (availability === 'unavailable') return 'var(--glassine-unavailable)';
  return 'var(--cds-text-helper)';
}

function findResponseAvailability(
  response: ParticipantResponse,
  slot: EventSlot
): Availability | undefined {
  const found = response.slots.find(
    (s) => s.start === slot.start && s.end === slot.end
  );
  return found?.availability;
}

export default function ResponseMatrix({ event, onEditResponse, onDeleteResponse }: ResponseMatrixProps) {
  const isMobile = useIsMobile();
  const responses = event.responses || [];
  const slots = event.slots || [];

  if (responses.length === 0) {
    return (
      <Tile style={{ textAlign: 'center' }}>
        まだ回答がありません
      </Tile>
    );
  }

  const slotsByDate = new Map<string, EventSlot[]>();
  for (const slot of slots) {
    const d = new Date(slot.start);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (!slotsByDate.has(key)) {
      slotsByDate.set(key, []);
    }
    slotsByDate.get(key)!.push(slot);
  }

  const isDateOnly = event.mode === 'dateonly';

  const slotTotals = slots.map((slot) => {
    let available = 0;
    let maybe = 0;
    let unavailable = 0;
    for (const response of responses) {
      const avail = findResponseAvailability(response, slot);
      if (avail === 'available') available++;
      else if (avail === 'maybe') maybe++;
      else if (avail === 'unavailable') unavailable++;
    }
    return { available, maybe, unavailable };
  });

  const stickyWidth = isMobile ? RESPONSE_MATRIX.stickyWidth.mobile : RESPONSE_MATRIX.stickyWidth.desktop;
  const cellPadding = isMobile ? '0.35rem' : '0.5rem';
  const cellMinWidth = isMobile
    ? (isDateOnly ? RESPONSE_MATRIX.cellMinWidth.dateOnly.mobile : RESPONSE_MATRIX.cellMinWidth.datetime.mobile)
    : (isDateOnly ? RESPONSE_MATRIX.cellMinWidth.dateOnly.desktop : RESPONSE_MATRIX.cellMinWidth.datetime.desktop);

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 'max-content', fontSize: isMobile ? '0.85rem' : undefined }}>
        <thead>
          {!isDateOnly && (
            <tr>
              <th
                style={{
                  padding: cellPadding,
                  border: '1px solid var(--cds-border-subtle)',
                  background: 'var(--cds-layer-02)',
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  minWidth: stickyWidth,
                }}
              >
                {isMobile ? '' : '参加者'}
              </th>
              {Array.from(slotsByDate.entries()).map(([dateKey, dateSlots]) => {
                const header = formatSlotHeader(dateSlots[0], event.mode);
                return (
                  <th
                    key={dateKey}
                    colSpan={dateSlots.length}
                    style={{
                      padding: cellPadding,
                      border: '1px solid var(--cds-border-subtle)',
                      background: 'var(--cds-layer-03)',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontSize: isMobile ? '0.8rem' : undefined,
                    }}
                  >
                    {header.date}
                  </th>
                );
              })}
            </tr>
          )}
          <tr>
            {isDateOnly && (
              <th
                style={{
                  padding: cellPadding,
                  border: '1px solid var(--cds-border-subtle)',
                  background: 'var(--cds-layer-02)',
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  minWidth: stickyWidth,
                }}
              >
                {isMobile ? '' : '参加者'}
              </th>
            )}
            {!isDateOnly && (
              <th
                style={{
                  padding: cellPadding,
                  border: '1px solid var(--cds-border-subtle)',
                  background: 'var(--cds-layer-02)',
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  minWidth: stickyWidth,
                }}
              />
            )}
            {slots.map((slot, i) => {
              const header = formatSlotHeader(slot, event.mode);
              return (
                <th
                  key={i}
                  style={{
                    padding: cellPadding,
                    border: '1px solid var(--cds-border-subtle)',
                    background: 'var(--cds-layer-02)',
                    textAlign: 'center',
                    fontSize: isMobile ? '0.75rem' : '0.85rem',
                    minWidth: cellMinWidth,
                  }}
                >
                  {isDateOnly ? header.date : header.time}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr style={{ background: 'var(--cds-layer-01)' }}>
            <td
              style={{
                padding: cellPadding,
                border: '1px solid var(--cds-border-subtle)',
                fontWeight: 'bold',
                position: 'sticky',
                left: 0,
                background: 'var(--cds-layer-01)',
                zIndex: 1,
                minWidth: stickyWidth,
                fontSize: isMobile ? '0.75rem' : undefined,
              }}
            >
              集計
            </td>
            {slotTotals.map((total, i) => (
              <td
                key={i}
                style={{
                  padding: isMobile ? '0.2rem' : '0.25rem',
                  border: '1px solid var(--cds-border-subtle)',
                  textAlign: 'center',
                  fontSize: isMobile ? '0.65rem' : '0.75rem',
                  lineHeight: 1.2,
                  background: 'var(--cds-layer-01)',
                }}
              >
                {isMobile ? (
                  <div style={{ color: 'var(--glassine-available)' }}>{total.available}</div>
                ) : (
                  <>
                    <div style={{ color: 'var(--glassine-available)' }}>○{total.available}</div>
                    <div style={{ color: 'var(--glassine-maybe)' }}>△{total.maybe}</div>
                    <div style={{ color: 'var(--glassine-unavailable)' }}>×{total.unavailable}</div>
                  </>
                )}
              </td>
            ))}
          </tr>
          {responses.map((response) => (
            <tr key={response.id} style={{ background: 'var(--cds-layer-01)' }}>
              <td
                style={{
                  padding: cellPadding,
                  border: '1px solid var(--cds-border-subtle)',
                  position: 'sticky',
                  left: 0,
                  background: 'var(--cds-layer-01)',
                  zIndex: 1,
                  whiteSpace: 'nowrap',
                  minWidth: stickyWidth,
                  maxWidth: isMobile ? '100px' : undefined,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.25rem' : '0.5rem' }}>
                  <span style={{ fontWeight: 'bold', fontSize: isMobile ? '0.8rem' : undefined, overflow: 'hidden', textOverflow: 'ellipsis' }}>{response.participantName}</span>
                  {onEditResponse && (
                    <Button
                      kind="ghost"
                      size="sm"
                      hasIconOnly
                      renderIcon={Edit}
                      iconDescription="編集"
                      onClick={() => onEditResponse(response)}
                      style={isMobile ? { minHeight: '28px', padding: '0.25rem' } : undefined}
                    />
                  )}
                  {onDeleteResponse && response.id && !isMobile && (
                    <Button
                      kind="danger--ghost"
                      size="sm"
                      hasIconOnly
                      renderIcon={TrashCan}
                      iconDescription="削除"
                      onClick={() => {
                        if (confirm(`${response.participantName}さんの回答を削除しますか？`)) {
                          onDeleteResponse(response.id!);
                        }
                      }}
                    />
                  )}
                </div>
              </td>
              {slots.map((slot, i) => {
                const availability = findResponseAvailability(response, slot);
                return (
                  <td
                    key={i}
                    style={{
                      padding: cellPadding,
                      border: '1px solid var(--cds-border-subtle)',
                      textAlign: 'center',
                      fontSize: isMobile ? '1rem' : '1.2rem',
                      color: getAvailabilityColor(availability),
                      fontWeight: 'bold',
                      background: 'var(--cds-layer-01)',
                    }}
                  >
                    {getAvailabilitySymbol(availability)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
