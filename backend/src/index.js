import { getTursoClient, ensureTursoSchema, logActivity, checkAndMarkWebhookProcessed } from './turso.js';
import { replyToComment, sendInstagramDM, fetchInstagramMedia } from './instagram.js';
import { sha256, signJwt, requireAuth } from './auth.js';

// Standard CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400'
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

function matchRule(rules, text, triggerType = 'comment', mediaId = null) {
  if (!text) return null;
  const lowerText = text.toLowerCase().trim();

  // 1. Reel-specific rules first
  if (mediaId) {
    const reelRule = rules.find(r => {
      if (!r.enabled) return false;
      if (r.trigger_type !== 'both' && r.trigger_type !== triggerType) return false;
      if (r.media_filter !== mediaId) return false;

      let keywords = [];
      try {
        keywords = typeof r.keywords === 'string' ? JSON.parse(r.keywords) : (r.keywords || []);
      } catch (e) {
        keywords = [];
      }
      if (keywords.length === 0) return true; // Catch-all rule for this reel

      return keywords.some(k => {
        const kw = k.toLowerCase().trim();
        if (r.match_type === 'exact') return lowerText === kw;
        if (r.match_type === 'starts_with') return lowerText.startsWith(kw);
        return lowerText.includes(kw);
      });
    });

    if (reelRule) return reelRule;
  }

  // 2. Global rules (media_filter === 'all' or empty)
  const globalRule = rules.find(r => {
    if (!r.enabled) return false;
    if (r.trigger_type !== 'both' && r.trigger_type !== triggerType) return false;
    if (r.media_filter && r.media_filter !== 'all') return false;

    let keywords = [];
    try {
      keywords = typeof r.keywords === 'string' ? JSON.parse(r.keywords) : (r.keywords || []);
    } catch (e) {
      keywords = [];
    }
    if (keywords.length === 0) return false;

    return keywords.some(k => {
      const kw = k.toLowerCase().trim();
      if (r.match_type === 'exact') return lowerText === kw;
      if (r.match_type === 'starts_with') return lowerText.startsWith(kw);
      return lowerText.includes(kw);
    });
  });

  return globalRule || null;
}

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const db = getTursoClient(env);

    // Ensure database tables exist in Turso
    ctx.waitUntil(ensureTursoSchema(db));

    // -------------------------------------------------------------------------
    // 2. META WEBHOOK VERIFICATION (GET /webhook)
    // -------------------------------------------------------------------------
    if (request.method === 'GET' && pathname === '/webhook') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      const expectedToken = env.WEBHOOK_VERIFY_TOKEN || 'digiperform_auto_verify_2026';

      if (mode === 'subscribe' && token === expectedToken) {
        return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }
      return new Response('Verification failed', { status: 403 });
    }

    // -------------------------------------------------------------------------
    // 3. INBOUND META WEBHOOK HANDLER (POST /webhook)
    // -------------------------------------------------------------------------
    if (request.method === 'POST' && pathname === '/webhook') {
      try {
        const body = await request.json();

        // Respond 200 OK immediately to Meta to prevent timeout/retries
        const processingPromise = (async () => {
          if (!body.entry || !Array.isArray(body.entry)) return;

          // Fetch active rules from Turso
          const rulesResult = await db.execute('SELECT * FROM rules WHERE enabled = 1');
          const rules = rulesResult.rows.map(r => ({
            ...r,
            enabled: Boolean(r.enabled),
            keywords: typeof r.keywords === 'string' ? JSON.parse(r.keywords) : r.keywords,
            buttons: typeof r.buttons === 'string' ? JSON.parse(r.buttons) : (r.buttons || [])
          }));

          const token = env.INSTAGRAM_ACCESS_TOKEN;

          for (const entry of body.entry) {
            // A. Handle Comments (changes array)
            if (entry.changes && Array.isArray(entry.changes)) {
              for (const change of entry.changes) {
                if (change.field === 'comments') {
                  const comment = change.value;
                  const commentId = comment.id;
                  const commenterId = comment.from ? comment.from.id : null;
                  const mediaId = comment.media ? comment.media.id : null;
                  const text = comment.text || '';

                  // CRITICAL: Prevent Infinite Self-Reply Loops
                  // Ignore comments posted by our own bot account
                  if (
                    commenterId === env.ACCOUNT_ID ||
                    commenterId === '17841476577468368' ||
                    (comment.from && comment.from.username === env.ACCOUNT_USERNAME) ||
                    (comment.from && comment.from.username === 'digiperformellenabad')
                  ) {
                    console.log(`[Webhook] Ignoring self-comment: ${commentId}`);
                    continue;
                  }

                  // Idempotency check in Turso: prevent duplicate webhook deliveries
                  const isNew = await checkAndMarkWebhookProcessed(db, `comment_${commentId}`);
                  if (!isNew) {
                    console.log(`[Webhook] Duplicate comment event ignored: ${commentId}`);
                    continue;
                  }

                  const matchedRule = matchRule(rules, text, 'comment', mediaId);
                  if (matchedRule) {
                    // Public comment reply
                    if (matchedRule.public_comment_reply) {
                      await replyToComment({
                        commentId,
                        message: matchedRule.public_comment_reply,
                        token
                      });
                    }

                    // Automated Private Reply (Comment-to-DM)
                    if (matchedRule.direct_message) {
                      await sendInstagramDM({
                        commentId,
                        recipientId: commenterId,
                        directMessage: matchedRule.direct_message,
                        buttonsJson: matchedRule.buttons,
                        token
                      });
                    }

                    // Increment trigger count in Turso
                    await db.execute({
                      sql: 'UPDATE rules SET trigger_count = trigger_count + 1 WHERE id = ?',
                      args: [matchedRule.id]
                    });

                    // Log activity in Turso
                    await logActivity(
                      db,
                      'comment_reply_sent',
                      commenterId,
                      matchedRule.name,
                      `Handled comment: "${text.substring(0, 40)}" on Reel ${mediaId || 'unknown'}`
                    );
                  }
                }
              }
            }

            // B. Handle Direct Messages (messaging array)
            if (entry.messaging && Array.isArray(entry.messaging)) {
              for (const msg of entry.messaging) {
                const senderId = msg.sender ? msg.sender.id : null;
                const recipientId = msg.recipient ? msg.recipient.id : null;

                if (senderId === env.ACCOUNT_ID || senderId === '17841476577468368') {
                  continue;
                }

                if (msg.message && msg.message.text && !msg.message.is_echo) {
                  const text = msg.message.text;
                  const messageId = msg.message.mid;

                  const isNew = await checkAndMarkWebhookProcessed(db, `dm_${messageId}`);
                  if (!isNew) continue;

                  const matchedRule = matchRule(rules, text, 'message', null);
                  if (matchedRule && matchedRule.direct_message) {
                    await sendInstagramDM({
                      recipientId: senderId,
                      directMessage: matchedRule.direct_message,
                      buttonsJson: matchedRule.buttons,
                      token
                    });

                    await db.execute({
                      sql: 'UPDATE rules SET trigger_count = trigger_count + 1 WHERE id = ?',
                      args: [matchedRule.id]
                    });

                    await logActivity(
                      db,
                      'dm_reply_sent',
                      senderId,
                      matchedRule.name,
                      `Replied to DM: "${text.substring(0, 40)}"`
                    );
                  }
                }
              }
            }
          }
        })();

        ctx.waitUntil(processingPromise);
        return jsonResponse({ success: true, received: true });
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    // -------------------------------------------------------------------------
    // 4. AUTHENTICATION API
    // -------------------------------------------------------------------------
    if (request.method === 'POST' && pathname === '/api/auth/login') {
      try {
        const { username, password } = await request.json();
        if (!username || !password) {
          return jsonResponse({ success: false, error: 'Username and password required' }, 400);
        }

        const userResult = await db.execute({
          sql: 'SELECT * FROM users WHERE username = ?',
          args: [username.trim()]
        });

        // Initialize default admin user if database is empty
        if (userResult.rows.length === 0 && username === 'admin') {
          const salt = 'salt_sal_2026';
          const defaultHash = await sha256('admin123' + salt);
          await db.execute({
            sql: 'INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)',
            args: ['user_admin', 'admin', defaultHash, salt, new Date().toISOString()]
          });

          if (password === 'admin123') {
            const secret = env.JWT_SECRET || 'insta_jwt_secret_sal_2026_x89';
            const token = await signJwt({ sub: 'user_admin', username: 'admin' }, secret);
            return jsonResponse({ success: true, token, user: { id: 'user_admin', username: 'admin' } });
          }
        }

        if (userResult.rows.length === 0) {
          return jsonResponse({ success: false, error: 'Invalid credentials' }, 401);
        }

        const user = userResult.rows[0];
        const hash = await sha256(password + user.salt);

        if (hash !== user.password_hash) {
          return jsonResponse({ success: false, error: 'Invalid credentials' }, 401);
        }

        const secret = env.JWT_SECRET || 'insta_jwt_secret_sal_2026_x89';
        const token = await signJwt({ sub: user.id, username: user.username }, secret);

        return jsonResponse({ success: true, token, user: { id: user.id, username: user.username } });
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    if (request.method === 'GET' && pathname === '/api/auth/me') {
      const user = await requireAuth(request, env);
      if (!user) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
      return jsonResponse({ success: true, user });
    }

    // -------------------------------------------------------------------------
    // 5. AUTOMATION RULES API (TURSO LIBSQL)
    // -------------------------------------------------------------------------
    if (pathname === '/api/rules') {
      if (request.method === 'GET') {
        const result = await db.execute('SELECT * FROM rules ORDER BY created_at ASC');
        const rules = result.rows.map(r => ({
          ...r,
          enabled: Boolean(r.enabled),
          keywords: typeof r.keywords === 'string' ? JSON.parse(r.keywords) : r.keywords,
          buttons: typeof r.buttons === 'string' ? JSON.parse(r.buttons) : (r.buttons || [])
        }));
        return jsonResponse({ success: true, count: rules.length, rules });
      }

      if (request.method === 'POST') {
        const user = await requireAuth(request, env);
        if (!user) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);

        const body = await request.json();
        const id = 'rule_' + Date.now();
        await db.execute({
          sql: `INSERT INTO rules (id, name, enabled, trigger_type, match_type, keywords, action, public_comment_reply, direct_message, media_filter, buttons, trigger_count, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          args: [
            id,
            body.name || 'New Rule',
            body.enabled !== false ? 1 : 0,
            body.trigger_type || 'comment',
            body.match_type || 'contains',
            JSON.stringify(body.keywords || []),
            body.action || 'dm',
            body.public_comment_reply || null,
            body.direct_message || null,
            body.media_filter || 'all',
            JSON.stringify(body.buttons || []),
            new Date().toISOString(),
            new Date().toISOString()
          ]
        });

        await logActivity(db, 'rule_created', user.username, body.name, `Created rule "${body.name}"`);
        return jsonResponse({ success: true, id, message: 'Rule created' });
      }
    }

    // Single Rule Operations: /api/rules/:id
    if (pathname.startsWith('/api/rules/')) {
      const parts = pathname.split('/');
      const ruleId = parts[3];

      if (parts[4] === 'toggle' && request.method === 'POST') {
        const user = await requireAuth(request, env);
        if (!user) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);

        const cur = await db.execute({ sql: 'SELECT enabled FROM rules WHERE id = ?', args: [ruleId] });
        if (cur.rows.length === 0) return jsonResponse({ success: false, error: 'Rule not found' }, 404);

        const newStatus = cur.rows[0].enabled ? 0 : 1;
        await db.execute({ sql: 'UPDATE rules SET enabled = ?, updated_at = ? WHERE id = ?', args: [newStatus, new Date().toISOString(), ruleId] });
        return jsonResponse({ success: true, enabled: Boolean(newStatus) });
      }

      if (request.method === 'PUT') {
        const user = await requireAuth(request, env);
        if (!user) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);

        const body = await request.json();
        await db.execute({
          sql: `UPDATE rules SET name = ?, trigger_type = ?, match_type = ?, keywords = ?, action = ?, public_comment_reply = ?, direct_message = ?, media_filter = ?, buttons = ?, updated_at = ? WHERE id = ?`,
          args: [
            body.name,
            body.trigger_type || 'comment',
            body.match_type || 'contains',
            JSON.stringify(body.keywords || []),
            body.action || 'dm',
            body.public_comment_reply || null,
            body.direct_message || null,
            body.media_filter || 'all',
            JSON.stringify(body.buttons || []),
            new Date().toISOString(),
            ruleId
          ]
        });
        return jsonResponse({ success: true, message: 'Rule updated' });
      }

      if (request.method === 'DELETE') {
        const user = await requireAuth(request, env);
        if (!user) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);

        await db.execute({ sql: 'DELETE FROM rules WHERE id = ?', args: [ruleId] });
        return jsonResponse({ success: true, message: 'Rule deleted' });
      }
    }

    // -------------------------------------------------------------------------
    // 6. MEDIA CATALOG & REELS API (TURSO LIBSQL)
    // -------------------------------------------------------------------------
    if (pathname === '/api/media') {
      if (request.method === 'GET') {
        const result = await db.execute('SELECT * FROM media_catalog ORDER BY score DESC');
        const media = result.rows.map(m => ({
          id: m.id,
          caption: m.caption || '',
          media_type: m.media_type || 'VIDEO',
          permalink: m.permalink || '',
          timestamp: m.timestamp || '',
          like_count: Number(m.like_count) || 0,
          comments_count: Number(m.comments_count) || 0,
          score: Number(m.score) || 0,
          archived: Boolean(m.archived)
        }));

        const total = media.length;
        const active = media.filter(m => !m.archived).length;
        const archived = media.filter(m => m.archived).length;
        const zeroCount = media.filter(m => m.score === 0).length;

        return jsonResponse({ success: true, total, active, archived, zeroCount, media });
      }
    }

    if (request.method === 'POST' && pathname === '/api/media/sync') {
      const user = await requireAuth(request, env);
      if (!user) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);

      try {
        const token = env.INSTAGRAM_ACCESS_TOKEN;
        const liveMedia = await fetchInstagramMedia(token);

        // Fetch currently archived IDs so archive marks are preserved
        const currentResult = await db.execute('SELECT id, archived FROM media_catalog WHERE archived = 1');
        const archivedIds = new Set(currentResult.rows.map(r => r.id));

        for (const m of liveMedia) {
          const likes = Number(m.like_count) || 0;
          const comments = Number(m.comments_count) || 0;
          const score = likes * 2 + comments * 3;
          const isArchived = archivedIds.has(m.id) ? 1 : 0;

          await db.execute({
            sql: `INSERT INTO media_catalog (id, caption, media_type, permalink, timestamp, like_count, comments_count, score, archived, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    caption = excluded.caption,
                    permalink = excluded.permalink,
                    like_count = excluded.like_count,
                    comments_count = excluded.comments_count,
                    score = excluded.score,
                    updated_at = excluded.updated_at`,
            args: [
              m.id,
              m.caption || '',
              m.media_type || 'VIDEO',
              m.permalink || '',
              m.timestamp || '',
              likes,
              comments,
              score,
              isArchived,
              new Date().toISOString()
            ]
          });
        }

        const total = liveMedia.length;
        const archived = archivedIds.size;
        const active = total - archived;

        await logActivity(db, 'media_synced', user.username, null, `Synced ${total} reels from Meta Graph API`);
        return jsonResponse({ success: true, count: total, active, archived });
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    if (request.method === 'POST' && pathname === '/api/media/archive') {
      const user = await requireAuth(request, env);
      if (!user) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);

      const body = await request.json();
      const ids = body.ids || [];
      const archived = body.archived ? 1 : 0;

      for (const id of ids) {
        await db.execute({
          sql: 'UPDATE media_catalog SET archived = ?, updated_at = ? WHERE id = ?',
          args: [archived, new Date().toISOString(), id]
        });
      }

      await logActivity(db, 'archive_marked', user.username, null, `Updated archived status for ${ids.length} posts`);
      return jsonResponse({ success: true, count: ids.length });
    }

    // -------------------------------------------------------------------------
    // 7. SIMULATOR TEST RUNNER API
    // -------------------------------------------------------------------------
    if (request.method === 'POST' && pathname === '/api/test/simulate') {
      try {
        const body = await request.json();
        const text = body.text || '';
        const triggerType = body.triggerType || 'comment';
        const mediaId = body.mediaId || null;

        const rulesResult = await db.execute('SELECT * FROM rules WHERE enabled = 1');
        const rules = rulesResult.rows.map(r => ({
          ...r,
          enabled: Boolean(r.enabled),
          keywords: typeof r.keywords === 'string' ? JSON.parse(r.keywords) : r.keywords,
          buttons: typeof r.buttons === 'string' ? JSON.parse(r.buttons) : (r.buttons || [])
        }));

        const matched = matchRule(rules, text, triggerType, mediaId);
        if (!matched) {
          return jsonResponse({
            success: true,
            matched: false,
            message: 'No active automation flow matched this comment or message.'
          });
        }

        return jsonResponse({
          success: true,
          matched: true,
          ruleName: matched.name,
          triggerType: matched.trigger_type,
          publicReply: matched.public_comment_reply || null,
          directMessage: matched.direct_message || null,
          buttons: matched.buttons || []
        });
      } catch (err) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    // -------------------------------------------------------------------------
    // 8. ACTIVITY LOGS API (TURSO LIBSQL)
    // -------------------------------------------------------------------------
    if (pathname === '/api/logs') {
      if (request.method === 'GET') {
        const result = await db.execute('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100');
        return jsonResponse({ success: true, count: result.rows.length, logs: result.rows });
      }

      if (request.method === 'POST') {
        const user = await requireAuth(request, env);
        if (!user) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);

        await db.execute('DELETE FROM activity_logs');
        return jsonResponse({ success: true, message: 'Logs cleared' });
      }
    }

    // -------------------------------------------------------------------------
    // 9. SEO OPTIMIZATION AUDIT API
    // -------------------------------------------------------------------------
    if (request.method === 'GET' && pathname === '/api/seo/analyze') {
      return jsonResponse({
        success: true,
        profileSEOScore: { bio: 18, website: 22, keywords: 26, callToAction: 24, total: 90 },
        currentBio: 'Digital Marketing Training Institute in Ellenabad 🚀 | Learn AI Tools, Performance Marketing & SEO | 100% Practical Training',
        optimizedBio: `🎓 Digiperform Ellenabad | #1 Digital Marketing Institute\n🚀 Master 25+ AI Tools, Performance Ads & SEO\n💼 100% Practical Training & Internship Placement\n👇 Tap to Download Syllabus & Claim Scholarship:`,
        recommendations: [
          'Add location pin emoji and Ellenabad city keyword to primary bio header',
          'Use bulleted structure for clear readability',
          'Include direct CTA pointing to syllabus link'
        ]
      });
    }

    // Default 404
    return jsonResponse({ success: false, error: 'Route not found' }, 404);
  }
};
