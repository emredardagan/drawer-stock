-- products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  "imageUrl" TEXT,
  quantity INTEGER DEFAULT 0
);

-- users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  department TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  token TEXT
);

-- consumptions table
CREATE TABLE IF NOT EXISTS consumptions (
  id TEXT PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  nickname TEXT NOT NULL,
  department TEXT,
  at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- wishlist_items table
CREATE TABLE IF NOT EXISTS wishlist_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "addedBy" TEXT NOT NULL,
  "addedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- wishlist_votes table
CREATE TABLE IF NOT EXISTS wishlist_votes (
  "itemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  PRIMARY KEY ("itemId", "userId")
);

-- reservations table
CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL
);
