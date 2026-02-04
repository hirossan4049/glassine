import { useState, useEffect } from 'react';
import {
  Button,
  TextInput,
  Tag,
  InlineNotification,
  InlineLoading,
  Stack,
  FormLabel,
  CopyButton,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@carbon/react';
import { ArrowLeft, Checkmark } from '@carbon/react/icons';
import type { Event, SlotAggregation, EventSlot, EventMode, ParticipantResponse } from '../types';
import ResponseMatrix from './ResponseMatrix';
import ResponseEditor from './ResponseEditor';
import { useIsMobile } from '../hooks/useMediaQuery';
import { FORM } from '../constants/layout';

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

interface EditEventProps {
  eventId: string;
  token: string;
  onBack: () => void;
}

export default function EditEvent({ eventId, token, onBack }: EditEventProps) {
  const isMobile = useIsMobile();
  const [event, setEvent] = useState<Event | null>(null);
  const [aggregation, setAggregation] = useState<SlotAggregation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [editingResponse, setEditingResponse] = useState<ParticipantResponse | null>(null);

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
    } catch (_err) {
      console.error('Failed to load aggregation', _err);
    }
  };

  const handleConfirm = async (slotIndices: number[]) => {
    setConfirming(true);
    try {
      const response = await fetch(`/api/events/${eventId}/confirm?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedSlots: slotIndices }),
      });

      if (response.ok) {
        loadEvent();
      } else {
        const data = await response.json() as any;
        setError(data.error || '確定に失敗しました');
      }
    } catch (_err) {
      setError('ネットワークエラーが発生しました');
    } finally {
      setConfirming(false);
    }
  };

  const handleDeleteResponse = async (responseId: number) => {
    try {
      const response = await fetch(`/api/events/${eventId}/responses/${responseId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadEvent();
        loadAggregation();
      } else {
        const data = await response.json() as any;
        setError(data.error || '削除に失敗しました');
      }
    } catch (_err) {
      setError('ネットワークエラーが発生しました');
    }
  };

  const handleEditResponse = (response: ParticipantResponse) => {
    setEditingResponse(response);
  };

  const handleResponseUpdated = () => {
    setEditingResponse(null);
    loadEvent();
    loadAggregation();
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

  const viewUrl = `${window.location.origin}/v/${eventId}?token=${event.viewToken}`;
  const respondUrl = `${window.location.origin}/r/${eventId}?token=${event.viewToken}`;

  if (editingResponse) {
    return (
      <ResponseEditor
        event={event}
        response={editingResponse}
        onSave={handleResponseUpdated}
        onCancel={() => setEditingResponse(null)}
      />
    );
  }

  const headers = isMobile
    ? [
        { key: 'datetime', header: '日時' },
        { key: 'available', header: '○' },
        { key: 'action', header: '' },
      ]
    : [
        { key: 'datetime', header: '日時' },
        { key: 'available', header: '○' },
        { key: 'maybe', header: '△' },
        { key: 'unavailable', header: '×' },
        { key: 'score', header: 'スコア' },
        { key: 'action', header: '操作' },
      ];

  const rows = aggregation.slice(0, 10).map((agg) => {
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
      score: agg.score,
      isConfirmed,
      index: agg.index,
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
          <h2 className="cds--type-productive-heading-03" style={{ marginBottom: '1rem' }}>共有URL</h2>
          <Stack gap={4}>
            <div>
              <FormLabel>参加者用URL（回答）</FormLabel>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                <TextInput
                  id="respond-url"
                  labelText=""
                  hideLabel
                  value={respondUrl}
                  readOnly
                  style={{ flex: 1, minWidth: isMobile ? '100%' : 'auto' }}
                />
                <CopyButton
                  onClick={() => navigator.clipboard.writeText(respondUrl)}
                  feedback="コピーしました"
                />
              </div>
            </div>
            <div>
              <FormLabel>閲覧用URL</FormLabel>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                <TextInput
                  id="view-url"
                  labelText=""
                  hideLabel
                  value={viewUrl}
                  readOnly
                  style={{ flex: 1, minWidth: isMobile ? '100%' : 'auto' }}
                />
                <CopyButton
                  onClick={() => navigator.clipboard.writeText(viewUrl)}
                  feedback="コピーしました"
                />
              </div>
            </div>
          </Stack>
        </div>

        <div>
          <h2 className="cds--type-productive-heading-03" style={{ marginBottom: '0.5rem' }}>回答状況</h2>
          <p className="cds--type-body-01" style={{ marginBottom: '1rem' }}>
            回答者数: {event.responses?.length || 0}
          </p>
          <ResponseMatrix
            event={event}
            onEditResponse={handleEditResponse}
            onDeleteResponse={handleDeleteResponse}
          />
        </div>

        {aggregation.length > 0 && (
          <div>
            <h2 className="cds--type-productive-heading-03" style={{ marginBottom: '1rem' }}>
              おすすめ候補{event.mode === 'dateonly' ? '日程' : '日時'}
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
                        <TableRow {...getRowProps({ row })} key={row.id}>
                          {row.cells.map((cell) => {
                            if (cell.info.header === 'action' && rowData) {
                              return (
                                <TableCell key={cell.id}>
                                  <Button
                                    kind={rowData.isConfirmed ? 'ghost' : 'primary'}
                                    size="sm"
                                    renderIcon={rowData.isConfirmed ? Checkmark : undefined}
                                    onClick={() => handleConfirm([rowData.index])}
                                    disabled={confirming || rowData.isConfirmed}
                                    hasIconOnly={isMobile && !rowData.isConfirmed}
                                    iconDescription={isMobile ? '確定' : undefined}
                                    style={isMobile ? { minWidth: FORM.buttonMinWidth.mobile, padding: '0.5rem' } : undefined}
                                  >
                                    {isMobile ? (rowData.isConfirmed ? '✓' : '') : (rowData.isConfirmed ? '確定済み' : '確定')}
                                  </Button>
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

        {error && (
          <InlineNotification
            kind="error"
            title="エラー"
            subtitle={error}
            onCloseButtonClick={() => setError('')}
          />
        )}
      </Stack>
    </div>
  );
}
