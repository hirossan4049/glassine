import type { Event, EventSlot, ParticipantResponse, Availability, EventMode } from '../types';

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
  if (availability === 'available') return '#28a745';
  if (availability === 'maybe') return '#ffc107';
  if (availability === 'unavailable') return '#dc3545';
  return '#999';
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
  const responses = event.responses || [];
  const slots = event.slots || [];

  if (responses.length === 0) {
    return (
      <div style={{ padding: '1rem', background: '#f9f9f9', borderRadius: '8px', textAlign: 'center' }}>
        まだ回答がありません
      </div>
    );
  }

  // Group slots by date for datetime mode
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

  // Calculate totals for each slot
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

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 'max-content' }}>
        <thead>
          {/* Date row (for datetime mode with multiple times per date) */}
          {!isDateOnly && (
            <tr>
              <th
                style={{
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  background: '#f0f0f0',
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  minWidth: '120px',
                }}
              >
                参加者
              </th>
              {Array.from(slotsByDate.entries()).map(([dateKey, dateSlots]) => {
                const header = formatSlotHeader(dateSlots[0], event.mode);
                return (
                  <th
                    key={dateKey}
                    colSpan={dateSlots.length}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      background: '#e8e8e8',
                      textAlign: 'center',
                      fontWeight: 'bold',
                    }}
                  >
                    {header.date}
                  </th>
                );
              })}
            </tr>
          )}
          {/* Time row (or single header for dateonly) */}
          <tr>
            {isDateOnly && (
              <th
                style={{
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  background: '#f0f0f0',
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  minWidth: '120px',
                }}
              >
                参加者
              </th>
            )}
            {!isDateOnly && (
              <th
                style={{
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  background: '#f0f0f0',
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                }}
              />
            )}
            {slots.map((slot, i) => {
              const header = formatSlotHeader(slot, event.mode);
              return (
                <th
                  key={i}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    background: '#f0f0f0',
                    textAlign: 'center',
                    fontSize: '0.85rem',
                    minWidth: isDateOnly ? '80px' : '50px',
                  }}
                >
                  {isDateOnly ? header.date : header.time}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {/* Totals row */}
          <tr style={{ background: '#f9f9f9' }}>
            <td
              style={{
                padding: '0.5rem',
                border: '1px solid #ddd',
                fontWeight: 'bold',
                position: 'sticky',
                left: 0,
                background: '#f9f9f9',
                zIndex: 1,
              }}
            >
              集計
            </td>
            {slotTotals.map((total, i) => (
              <td
                key={i}
                style={{
                  padding: '0.25rem',
                  border: '1px solid #ddd',
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  lineHeight: 1.2,
                }}
              >
                <div style={{ color: '#28a745' }}>○{total.available}</div>
                <div style={{ color: '#ffc107' }}>△{total.maybe}</div>
                <div style={{ color: '#dc3545' }}>×{total.unavailable}</div>
              </td>
            ))}
          </tr>
          {/* Participant rows */}
          {responses.map((response) => (
            <tr key={response.id}>
              <td
                style={{
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  position: 'sticky',
                  left: 0,
                  background: 'white',
                  zIndex: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold' }}>{response.participantName}</span>
                  {onEditResponse && (
                    <button
                      onClick={() => onEditResponse(response)}
                      style={{
                        padding: '0.15rem 0.4rem',
                        fontSize: '0.75rem',
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      編集
                    </button>
                  )}
                  {onDeleteResponse && response.id && (
                    <button
                      onClick={() => {
                        if (confirm(`${response.participantName}さんの回答を削除しますか？`)) {
                          onDeleteResponse(response.id!);
                        }
                      }}
                      style={{
                        padding: '0.15rem 0.4rem',
                        fontSize: '0.75rem',
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      削除
                    </button>
                  )}
                </div>
              </td>
              {slots.map((slot, i) => {
                const availability = findResponseAvailability(response, slot);
                return (
                  <td
                    key={i}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      textAlign: 'center',
                      fontSize: '1.2rem',
                      color: getAvailabilityColor(availability),
                      fontWeight: 'bold',
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
