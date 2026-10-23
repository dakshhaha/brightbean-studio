import { createClient } from '@libsql/client/web';

/**
 * Initialize Turso libSQL Client for Cloudflare Workers
 * Replaces Cloudflare D1 (env.DB) with distributed Turso libSQL over HTTP.
 */
export function getTursoClient(env) {
  const url = env.TURSO_URL || 'libsql://sal-instagram-dakshisoffline.aws-ap-south-1.turso.io';
  const authToken = env.TURSO_AUTH_TOKEN;

  if (!authToken) {
    throw new Error('TURSO_AUTH_TOKEN environment variable is missing.');
  }

  return createClient({
    url,
    authToken
  });
}

/**
 * Initialize / verify all required Turso tables
 */
export async function ensureTursoSchema(db) {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password_hash TEXT,
      salt TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      trigger_type TEXT DEFAULT 'comment',
      match_type TEXT DEFAULT 'contains',
      keywords TEXT,
      action TEXT DEFAULT 'dm',
      public_comment_reply TEXT,
      direct_message TEXT,
      media_filter TEXT DEFAULT 'all',
      buttons TEXT,
      trigger_count INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      sender_id TEXT,
      rule_name TEXT,
      message TEXT,
      details TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS media_catalog (
      id TEXT PRIMARY KEY,
      caption TEXT,
      media_type TEXT,
      permalink TEXT,
      timestamp TEXT,
      like_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      score INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS processed_webhooks (
      event_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    )`
  ]);
}

/**
 * Log activity to Turso activity_logs
 */
export async function logActivity(db, type, senderId, ruleName, message, details = {}) {
  const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();
  try {
    await db.execute({
      sql: `INSERT INTO activity_logs (id, timestamp, type, sender_id, rule_name, message, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, timestamp, type, senderId || null, ruleName || null, message, JSON.stringify(details)]
    });
  } catch (err) {
    console.error('Failed to log activity in Turso:', err.message);
  }
}

/**
 * Deduplicate webhook events to prevent duplicate / loop processing.
 * Returns true if event is NEW (and marks it processed).
 * Returns false if event was ALREADY processed.
 */
export async function checkAndMarkWebhookProcessed(db, eventId) {
  if (!eventId) return true;
  try {
    await db.execute({
      sql: `INSERT INTO processed_webhooks (event_id, created_at) VALUES (?, ?)`,
      args: [eventId, new Date().toISOString()]
    });
    return true; // Successfully inserted -> this is a new event
  } catch (err) {
    // If unique constraint failed, it was already processed
    return false;
  }
}
