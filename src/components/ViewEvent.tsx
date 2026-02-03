import { useState, useEffect } from 'react';
import {
  Button,
  Tag,
  InlineNotification,
  InlineLoading,
  Stack,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@carbon/react';
import { ArrowLeft, Checkmark } from '@carbon/react/icons';
import type { Event, SlotAggregation, EventSlot, EventMode } from '../types';
import ResponseMatrix from './ResponseMatrix';

function formatSlotDisplay(slot: EventSlot, mode: EventMode): string {
  const date = new Date(slot.start);
  if (mode === 'dateonly') {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  } else {
    return date.toLocaleString('ja-JP');
  }
}

interface ViewEventProps {
  eventId: string;
  token: string;
  onBack: () => void;
}

export default function ViewEvent({ eventId, token, onBack }: ViewEventProps) {
  const [event, setEvent] = useState<Event | null>(null);
  const [aggregation, setAggregation] = useState<SlotAggregation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadEvent();
    loadAggregation();
  }, [eventId, token]);

  const loadEvent = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}?token=${token}`);
      const data = await response.json() as any;

      if (response.ok) {
        setEvent(data.event);
      } else {
        setError(data.error || 'イベントの読み込みに失敗しました');
      }
    } catch (_err) {
      setError('ネットワークエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const loadAggregation = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/aggregation?token=${token}`);
      const data = await response.json() as any;

      if (response.ok) {
        setAggregation(data.aggregation);
      }
    } catch (err) {
      console.error('Failed to load aggregation', err);
    }
  };

  if (loading) {
    return (
      <div className="glassine-page">
        <InlineLoading description="読み込み中..." />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="glassine-page">
        <Stack gap={4}>
          <InlineNotification
            kind="error"
            title="エラー"
            subtitle={error || 'イベントが見つかりません'}
            hideCloseButton
          />
          <Button kind="secondary" onClick={onBack}>
            戻る
          </Button>
        </Stack>
      </div>
    );
  }

  const headers = [
    { key: 'datetime', header: '日時' },
    { key: 'available', header: '○' },
    { key: 'maybe', header: '△' },
    { key: 'unavailable', header: '×' },
  ];

  const rows = aggregation.map((agg) => {
    const confirmedIndices = event.confirmedSlots
      ? JSON.parse(event.confirmedSlots)
      : [];
    const isConfirmed = confirmedIndices.includes(agg.index);

    return {
      id: String(agg.index),
      datetime: formatSlotDisplay(agg.slot, event.mode),
      available: agg.availableCount,
      maybe: agg.maybeCount,
      unavailable: agg.unavailableCount,
      isConfirmed,
    };
  });

  return (
    <div className="glassine-page">
      <Stack gap={6}>
        <Button
          kind="ghost"
          size="sm"
          renderIcon={ArrowLeft}
          onClick={onBack}
        >
          戻る
        </Button>

        <div>
          <h1 className="cds--type-productive-heading-04">{event.title}</h1>
          {event.description && (
            <p className="cds--type-body-01" style={{ color: 'var(--cds-text-secondary)', marginTop: '0.5rem' }}>
              {event.description}
            </p>
          )}
          <Tag
            type={event.mode === 'dateonly' ? 'gray' : 'teal'}
            size="sm"
            style={{ marginTop: '0.5rem' }}
          >
            {event.mode === 'dateonly' ? '日程のみ' : '時間込み'}
          </Tag>
        </div>

        <div>
          <h2 className="cds--type-productive-heading-03" style={{ marginBottom: '0.5rem' }}>回答状況</h2>
          <p className="cds--type-body-01" style={{ marginBottom: '1rem' }}>
            回答者数: {event.responses?.length || 0}
          </p>
          <ResponseMatrix event={event} />
        </div>

        {aggregation.length > 0 && (
          <div>
            <h2 className="cds--type-productive-heading-03" style={{ marginBottom: '1rem' }}>
              候補{event.mode === 'dateonly' ? '日程' : '日時'}一覧
            </h2>
            <DataTable rows={rows} headers={headers}>
              {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps }) => (
                <Table {...getTableProps()}>
                  <TableHead>
                    <TableRow>
                      {tableHeaders.map((header) => (
                        <TableHeader {...getHeaderProps({ header })} key={header.key}>
                          {header.header}
                        </TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableRows.map((row) => {
                      const rowData = rows.find(r => r.id === row.id);
                      return (
                        <TableRow
                          {...getRowProps({ row })}
                          key={row.id}
                          style={rowData?.isConfirmed ? { background: 'var(--cds-support-success, #24a148)', color: 'white' } : undefined}
                        >
                          {row.cells.map((cell) => {
                            if (cell.info.header === 'datetime' && rowData?.isConfirmed) {
                              return (
                                <TableCell key={cell.id}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {cell.value}
                                    <Checkmark />
                                    確定
                                  </span>
                                </TableCell>
                              );
                            }
                            return <TableCell key={cell.id}>{cell.value}</TableCell>;
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </DataTable>
          </div>
        )}
      </Stack>
    </div>
  );
}
