/**
 * Meta Graph API Integration for Instagram Automation
 */

const GRAPH_BASE = 'https://graph.instagram.com/v21.0';

/**
 * Post a public comment reply under an Instagram comment
 */
export async function replyToComment({ commentId, message, token }) {
  if (!commentId || !message) return { skipped: true };
  const res = await fetch(`${GRAPH_BASE}/${commentId}/replies?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  return await res.json();
}

/**
 * Send an automated Direct Message:
 * - If commentId is provided: Uses Meta's Private Reply API (recipient: { comment_id }).
 *   Appends URL buttons inside text body because Private Replies strictly require text.
 * - If recipientId is provided: Uses Standard Inbox Messaging (recipient: { id }).
 */
export async function sendInstagramDM({ recipientId, commentId = null, directMessage, buttonsJson, token }) {
  let buttons = [];
  try {
    buttons = typeof buttonsJson === 'string' ? JSON.parse(buttonsJson) : (buttonsJson || []);
  } catch (e) {
    buttons = [];
  }

  const urlButtons = buttons.filter(b => b.type === 'web_url' && b.url && b.title);
  const quickReplies = buttons.filter(b => b.type === 'quick_reply' && b.title);

  // 1. Private Reply to a Comment (Bypasses 24h standard window)
  if (commentId) {
    let dmText = directMessage || 'Thanks for reaching out!';
    if (urlButtons.length > 0) {
      dmText += '\n\n' + urlButtons.map(b => `${b.title}: ${b.url}`).join('\n');
    }

    const res = await fetch(`${GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text: dmText }
      })
    });
    return await res.json();
  }

  // 2. Standard Inbox Direct Message (Inside 24h window)
  let messagePayload = { text: directMessage || 'Thanks for reaching out!' };

  if (urlButtons.length > 0) {
    messagePayload = {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: directMessage || 'Please select an option below:',
          buttons: urlButtons.slice(0, 3).map(b => ({
            type: 'web_url',
            url: b.url,
            title: b.title.substring(0, 20)
          }))
        }
      }
    };
  } else if (quickReplies.length > 0) {
    messagePayload = {
      text: directMessage,
      quick_replies: quickReplies.slice(0, 13).map(b => ({
        content_type: 'text',
        title: b.title.substring(0, 20),
        payload: b.payload || b.title
      }))
    };
  }

  const res = await fetch(`${GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: messagePayload
    })
  });
  return await res.json();
}

/**
 * Fetch Instagram Media Catalog from Meta Graph API
 */
export async function fetchInstagramMedia(token) {
  const fields = 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count';
  let url = `${GRAPH_BASE}/me/media?fields=${encodeURIComponent(fields)}&limit=100&access_token=${encodeURIComponent(token)}`;
  let allMedia = [];

  while (url && allMedia.length < 500) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.data && Array.isArray(data.data)) {
      allMedia = allMedia.concat(data.data);
    }
    url = data.paging && data.paging.next ? data.paging.next : null;
  }

  return allMedia;
}
