// 履歴管理ユーティリティ（localStorage使用）

const HISTORY_KEY = 'glassine_history';
const MAX_HISTORY_ITEMS = 20;

export interface CreatedEventHistory {
  type: 'created';
  eventId: string;
  title: string;
  editToken: string;
  viewToken: string;
  createdAt: number;
}

export interface RespondedEventHistory {
  type: 'responded';
  eventId: string;
  title: string;
  participantName: string;
  viewToken: string;
  respondedAt: number;
}

export type HistoryItem = CreatedEventHistory | RespondedEventHistory;

function getHistory(): HistoryItem[] {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: HistoryItem[]): void {
  try {
    // 最新の履歴を上限まで保持
    const trimmed = history.slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable
  }
}

export function addCreatedEvent(params: {
  eventId: string;
  title: string;
  editToken: string;
  viewToken: string;
}): void {
  const history = getHistory();

  // 同じイベントがあれば削除（重複防止）
  const filtered = history.filter(
    (item) => !(item.type === 'created' && item.eventId === params.eventId)
  );

  // 新しい履歴を先頭に追加
  filtered.unshift({
    type: 'created',
    eventId: params.eventId,
    title: params.title,
    editToken: params.editToken,
    viewToken: params.viewToken,
    createdAt: Date.now(),
  });

  saveHistory(filtered);
}

export function addRespondedEvent(params: {
  eventId: string;
  title: string;
  participantName: string;
  viewToken: string;
}): void {
  const history = getHistory();

  // 同じイベントに同じ名前で回答した履歴があれば削除
  const filtered = history.filter(
    (item) =>
      !(
        item.type === 'responded' &&
        item.eventId === params.eventId &&
        item.participantName === params.participantName
      )
  );

  // 新しい履歴を先頭に追加
  filtered.unshift({
    type: 'responded',
    eventId: params.eventId,
    title: params.title,
    participantName: params.participantName,
    viewToken: params.viewToken,
    respondedAt: Date.now(),
  });

  saveHistory(filtered);
}

export function getHistoryItems(): HistoryItem[] {
  return getHistory();
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // localStorage unavailable
  }
}
