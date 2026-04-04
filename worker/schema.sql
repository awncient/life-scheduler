-- Push購読情報
-- ユーザーの端末ごとに1レコード
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 通知スケジュール
-- ブロックの開始/終了の通知予定。タイトル等の個人情報は含まない
CREATE TABLE IF NOT EXISTS notification_schedules (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  block_id TEXT NOT NULL,
  date_str TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('start', 'end')),
  notify_at TEXT NOT NULL,
  sent INTEGER DEFAULT 0,
  FOREIGN KEY (subscription_id) REFERENCES push_subscriptions(id) ON DELETE CASCADE
);

-- 送信対象を効率的に検索するインデックス
CREATE INDEX IF NOT EXISTS idx_schedules_notify
  ON notification_schedules(notify_at, sent);

-- ブロック単位での一括削除/更新用インデックス
CREATE INDEX IF NOT EXISTS idx_schedules_block
  ON notification_schedules(subscription_id, block_id, date_str);
