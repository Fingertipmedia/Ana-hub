-- Ana Hub Kanban Database Schema (SQLite)

PRAGMA foreign_keys = ON;

-- Boards: Wealth Analytica, BAV Futures, Prostate Cancer
CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,  -- e.g., 'wealth-analytica'
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cards
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  column TEXT NOT NULL CHECK(column IN ('ideas', 'todo', 'inprogress', 'completed')),
  agent TEXT,  -- which agent/model handled it
  tokens INTEGER,  -- current token consumption
  start_at DATETIME,  -- Europe/Madrid timezone stored as UTC
  end_at DATETIME,
  tags TEXT,  -- JSON array or comma-separated: 'company:wealth,priority:high'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

-- Card Attachments (docs referenced)
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,  -- local path or URL
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- Comments / Activity on cards
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  author TEXT NOT NULL,  -- 'ana' or user name
  content TEXT NOT NULL,
  source TEXT,  -- 'telegram', 'web', 'slack', etc.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- External activity log: Slack/Teams messages tied to cards
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER,
  platform TEXT NOT NULL,  -- 'slack' or 'teams'
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  text TEXT,
  occurred_at DATETIME NOT NULL,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE SET NULL
);

-- Sharing tokens: who can see which board (read-only)
CREATE TABLE IF NOT EXISTS board_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,  -- random string for share link
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_cards_board_id ON cards(board_id);
CREATE INDEX IF NOT EXISTS idx_cards_updated_at ON cards(updated_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_card_id ON activity_log(card_id);