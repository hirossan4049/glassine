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
import { ArrowLeft, Checkmark, Launch } from '@carbon/react/icons';
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
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    loadEvent();
    loadAggregation();
  }, [eventId, token]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadEvent();
      loadAggregation();
    }, 30000);

    return () => clearInterval(interval);
  }, [eventId, token]);

  const loadEvent = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}?token=${token}`);
      const data = await response.json() as any;

      if (response.ok) {
        setEvent(data.event);
        setCanEdit(data.canEdit ?? false);
      } else {
        setError(data.error || 'イベントの読み込みに失敗しました');
      }
    } catch {
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
    } catch {
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
    } catch {
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

  const respondUrl = `${window.location.origin}/r/${eventId}?token=${event.viewToken}`;
  const confirmedIndices = event.confirmedSlots ? JSON.parse(event.confirmedSlots) as number[] : [];
  const confirmedSlot = confirmedIndices.length > 0 ? event.slots[confirmedIndices[0]] : undefined;

  const formatForGoogleCalendar = (date: Date, isAllDay: boolean) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    if (isAllDay) {
      return `${year}${month}${day}`;
    }
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  };

  const googleCalendarUrl = (() => {
    if (!confirmedSlot) return '';
    const isAllDay = event.mode === 'dateonly';
    const startDate = new Date(confirmedSlot.start);
    const endDate = new Date(confirmedSlot.end + (isAllDay ? 1000 * 60 * 60 * 24 : 0));
    const start = formatForGoogleCalendar(startDate, isAllDay);
    const end = formatForGoogleCalendar(endDate, isAllDay);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${start}/${end}`,
      ctz: event.timezone || 'Asia/Tokyo',
    });
    if (event.description) {
      params.set('details', event.description);
    }
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  })();

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
    ? canEdit
      ? [
          { key: 'datetime', header: '日時' },
          { key: 'available', header: '○' },
          { key: 'action', header: '' },
        ]
      : [
          { key: 'datetime', header: '日時' },
          { key: 'available', header: '○' },
        ]
    : canEdit
      ? [
          { key: 'datetime', header: '日時' },
          { key: 'available', header: '○' },
          { key: 'maybe', header: '△' },
          { key: 'unavailable', header: '×' },
          { key: 'score', header: 'スコア' },
          { key: 'action', header: '操作' },
        ]
      : [
          { key: 'datetime', header: '日時' },
          { key: 'available', header: '○' },
          { key: 'maybe', header: '△' },
          { key: 'unavailable', header: '×' },
        ];

  const topAggregation = aggregation.slice(0, 10);
  const maxScore = topAggregation.length > 0 ? Math.max(...topAggregation.map(a => a.score)) : 0;
  const minScore = topAggregation.length > 0 ? Math.min(...topAggregation.map(a => a.score)) : 0;
  const scoreRange = maxScore - minScore;

  const rows = topAggregation.map((agg) => {
    const confirmedIndices = event.confirmedSlots
      ? JSON.parse(event.confirmedSlots)
      : [];
    const isConfirmed = confirmedIndices.includes(agg.index);

    // スコアに基づく背景色の濃淡を計算 (0.1 ~ 0.4 の範囲)
    const normalizedScore = scoreRange > 0 ? (agg.score - minScore) / scoreRange : 1;
    const opacity = 0.1 + normalizedScore * 0.3;

    return {
      id: String(agg.index),
      datetime: formatSlotDisplay(agg.slot, event.mode),
      available: agg.availableCount,
      maybe: agg.maybeCount,
      unavailable: agg.unavailableCount,
      score: agg.score,
      isConfirmed,
      index: agg.index,
      backgroundColor: `rgba(36, 161, 72, ${opacity})`, // 緑色の濃淡
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

        {canEdit && (
          <div>
            <h2 className="cds--type-productive-heading-03" style={{ marginBottom: '1rem' }}>共有URL</h2>
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
                <Button
                  kind="ghost"
                  size="md"
                  renderIcon={Launch}
                  iconDescription="開く"
                  hasIconOnly
                  href={respondUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              </div>
            </div>
          </div>
        )}

        <div style={{overflowX: isMobile ? 'auto' : 'scroll' }}>
          <h2 className="cds--type-productive-heading-03" style={{ marginBottom: '0.5rem' }}>回答状況</h2>
          <p className="cds--type-body-01" style={{ marginBottom: '1rem' }}>
            回答者数: {event.responses?.length || 0}
          </p>
          <ResponseMatrix
            event={event}
            onEditResponse={handleEditResponse}
            onDeleteResponse={canEdit ? handleDeleteResponse : undefined}
          />
        </div>

        {aggregation.length > 0 && (
          <div>
            <h2 className="cds--type-productive-heading-03" style={{ marginBottom: '1rem' }}>
              おすすめ候補{event.mode === 'dateonly' ? '日程' : '日時'}
            </h2>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
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
                            style={{ backgroundColor: rowData?.backgroundColor }}
                          >
                            {row.cells.map((cell) => {
                              if (cell.info.header === 'action' && rowData) {
                                return (
                                  <TableCell key={cell.id}>
                                    <Button
                                      kind={rowData.isConfirmed ? 'ghost' : 'primary'}
                                      size="sm"
                                      renderIcon={Checkmark}
                                      onClick={() => handleConfirm([rowData.index])}
                                      disabled={confirming || rowData.isConfirmed}
                                      hasIconOnly={isMobile}
                                      iconDescription="確定"
                                      style={isMobile ? { minWidth: FORM.buttonMinWidth.mobile, padding: '0.5rem' } : undefined}
                                    >
                                      {isMobile ? '' : (rowData.isConfirmed ? '確定済み' : '確定')}
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
          </div>
        )}

        {googleCalendarUrl && (
          <div>
            <h2 className="cds--type-productive-heading-03" style={{ marginBottom: '0.5rem' }}>確定した予定</h2>
            <Stack gap={2}>
              <div>
                <p className="cds--type-body-01" style={{ marginBottom: '0.25rem' }}>
                  {confirmedSlot ? formatSlotDisplay(confirmedSlot, event.mode) : ''}
                </p>
                <Tag type="green" size="sm">確定済み</Tag>
              </div>
              <Button
                kind="primary"
                size="md"
                renderIcon={Checkmark}
                href={googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Calendarに追加
              </Button>
            </Stack>
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
