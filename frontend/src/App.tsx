import React, { useState, useEffect } from 'react';
import {
  Zap,
  Play,
  Activity,
  Film,
  CheckCircle2,
  Copy,
  LogOut,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Search,
  Check,
  AlertCircle,
  TrendingUp,
  Sparkles,
  Settings,
  X,
  Edit2,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  PenTool,
  Hash,
  Send,
  SlidersHorizontal
} from 'lucide-react';

const API_BASE = 'https://instagram-automation-api.bydaksh-dev.workers.dev';

export interface RuleButton {
  type: 'web_url' | 'quick_reply';
  title: string;
  url?: string;
  payload?: string;
}

interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  trigger_type: string;
  match_type: string;
  keywords: string[];
  action: string;
  public_comment_reply: string | null;
  direct_message: string | null;
  media_filter?: string;
  buttons?: RuleButton[];
  trigger_count: number;
}

interface LogItem {
  id: string;
  timestamp: string;
  type: string;
  sender_id: string | null;
  rule_name: string | null;
  message: string;
}

interface MediaItem {
  id: string;
  caption: string;
  media_type: string;
  permalink: string;
  timestamp: string;
  like_count: number;
  comments_count: number;
  score: number;
  archived: boolean;
}

interface SeoData {
  profileSEOScore: { bio: number; website: number; keywords: number; callToAction: number; total: number };
  currentBio: string;
  optimizedBio: string;
  recommendations: string[];
}

export default function App() {
  // Auth State
  const [token, setToken] = useState<string | null>(localStorage.getItem('insta_token'));
  const [user, setUser] = useState<string | null>(localStorage.getItem('insta_user'));
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // App Layout State (BrightBean Studio collapsible sidebar)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'rules' | 'media' | 'composer' | 'simulator' | 'logs' | 'analytics' | 'settings'>('rules');

  // Rules State
  const [rules, setRules] = useState<Rule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleSearch, setRuleSearch] = useState('');
  const [ruleScopeFilter, setRuleScopeFilter] = useState<'all' | 'reels' | 'global'>('all');
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    trigger_type: 'comment',
    match_type: 'contains',
    keywords: '',
    action: 'dm',
    public_comment_reply: '',
    direct_message: '',
    media_filter: 'all',
    buttons: [] as RuleButton[]
  });

  // Interactive Button Builder State
  const [newBtnType, setNewBtnType] = useState<'web_url' | 'quick_reply'>('web_url');
  const [newBtnTitle, setNewBtnTitle] = useState('');
  const [newBtnUrl, setNewBtnUrl] = useState('');

  // Media State
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaStats, setMediaStats] = useState({ total: 123, active: 6, archived: 117, zero: 19 });
  const [syncingMedia, setSyncingMedia] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'attached' | 'unattached' | 'top' | 'active' | 'archived'>('all');
  const [mediaSort, setMediaSort] = useState<'score' | 'date' | 'likes'>('score');

  // Simulator State
  const [simText, setSimText] = useState('syllabus details');
  const [simType, setSimType] = useState('comment');
  const [simMediaId, setSimMediaId] = useState('all');
  const [simResult, setSimResult] = useState<any>(null);
  const [simLoading, setSimLoading] = useState(false);

  // Composer State
  const [composeText, setComposeText] = useState('');
  const [composeHashtags, setComposeHashtags] = useState('#digitalmarketing #ellenabad #seo #socialmedia #careergrowth');

  // Analytics & SEO State
  const [seoData, setSeoData] = useState<SeoData | null>(null);
  const [editableBio, setEditableBio] = useState('');

  // Logs State
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // UI Toast & Clipboard
  const [toast, setToast] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const copyToClipboard = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('insta_token', data.token);
        localStorage.setItem('insta_user', data.user.username);
        setToken(data.token);
        setUser(data.user.username);
        showToast('Logged into BrightBean Studio');
      } else {
        setLoginError(data.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setLoginError('Connection error: ' + err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('insta_token');
    localStorage.removeItem('insta_user');
    setToken(null);
    setUser(null);
  };

  // Fetch Rules from Turso
  const fetchRules = async () => {
    setRulesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/rules`);
      const data = await res.json();
      if (data.success) setRules(data.rules || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRulesLoading(false);
    }
  };

  // Toggle Rule in Turso
  const toggleRule = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/rules/${id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setRules(rules.map(r => (r.id === id ? { ...r, enabled: data.enabled } : r)));
        showToast(`Rule ${data.enabled ? 'activated' : 'paused'}`);
      }
    } catch (err) {
      showToast('Failed to toggle rule');
    }
  };

  // Delete Rule in Turso
  const deleteRule = async (id: string) => {
    if (!window.confirm('Delete this automation flow?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/rules/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setRules(rules.filter(r => r.id !== id));
        showToast('Rule deleted from Turso');
      }
    } catch (err) {
      showToast('Failed to delete rule');
    }
  };

  // Save Rule in Turso
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: ruleForm.name,
      trigger_type: ruleForm.trigger_type,
      match_type: ruleForm.match_type,
      keywords: ruleForm.keywords.split(',').map(k => k.trim()).filter(Boolean),
      action: ruleForm.action,
      public_comment_reply: ruleForm.public_comment_reply || null,
      direct_message: ruleForm.direct_message || null,
      media_filter: ruleForm.media_filter || 'all',
      buttons: ruleForm.buttons || []
    };

    try {
      const url = editingRule ? `${API_BASE}/api/rules/${editingRule.id}` : `${API_BASE}/api/rules`;
      const method = editingRule ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(editingRule ? 'Automation updated' : 'Automation created in Turso');
        setShowRuleModal(false);
        setEditingRule(null);
        fetchRules();
      }
    } catch (err) {
      showToast('Failed to save rule');
    }
  };

  // Detach Reel from Rule (Make Global)
  const detachReelFromRule = async (rule: Rule) => {
    try {
      const res = await fetch(`${API_BASE}/api/rules/${rule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: rule.name,
          trigger_type: rule.trigger_type,
          match_type: rule.match_type,
          keywords: rule.keywords,
          action: rule.action,
          public_comment_reply: rule.public_comment_reply,
          direct_message: rule.direct_message,
          media_filter: 'all',
          buttons: rule.buttons || []
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Rule "${rule.name}" is now Global (applies to all reels)`);
        fetchRules();
      }
    } catch (err) {
      showToast('Failed to detach reel');
    }
  };

  // Button Builder Helpers for Rule Modal
  const handleAddButton = () => {
    if (!newBtnTitle.trim()) {
      showToast('Button title required');
      return;
    }
    if (newBtnType === 'web_url' && !newBtnUrl.trim()) {
      showToast('URL required for web button');
      return;
    }
    const currentBtns = ruleForm.buttons || [];
    if (newBtnType === 'web_url' && currentBtns.filter(b => b.type === 'web_url').length >= 3) {
      showToast('Max 3 URL buttons allowed by Meta');
      return;
    }

    const newBtn: RuleButton = {
      type: newBtnType,
      title: newBtnTitle.trim().substring(0, 20),
      url: newBtnType === 'web_url' ? newBtnUrl.trim() : undefined,
      payload: newBtnType === 'quick_reply' ? newBtnTitle.trim() : undefined
    };

    setRuleForm(prev => ({ ...prev, buttons: [...(prev.buttons || []), newBtn] }));
    setNewBtnTitle('');
    setNewBtnUrl('');
    showToast(`Added ${newBtnType === 'web_url' ? 'URL button' : 'Quick reply'}`);
  };

  const handleRemoveButton = (idx: number) => {
    setRuleForm(prev => ({
      ...prev,
      buttons: (prev.buttons || []).filter((_, i) => i !== idx)
    }));
  };

  const openNewRule = () => {
    setEditingRule(null);
    setRuleForm({
      name: '',
      trigger_type: 'comment',
      match_type: 'contains',
      keywords: 'course, fee, info, syllabus, admission, details, send, link',
      action: 'dm',
      public_comment_reply: 'Sent you complete details in your DM! Check your requests 📥',
      direct_message: 'Hey there! Thanks for reaching out. Here are the official details and syllabus link below:',
      media_filter: 'all',
      buttons: [
        { type: 'web_url', title: '🌐 View Syllabus', url: 'https://digiperform.com' },
        { type: 'web_url', title: '📞 WhatsApp Us', url: 'https://wa.me/919813848094' }
      ]
    });
    setNewBtnTitle('');
    setNewBtnUrl('');
    setShowRuleModal(true);
  };

  const openEditRule = (r: Rule) => {
    setEditingRule(r);
    setRuleForm({
      name: r.name,
      trigger_type: r.trigger_type,
      match_type: r.match_type,
      keywords: Array.isArray(r.keywords) ? r.keywords.join(', ') : '',
      action: r.action,
      public_comment_reply: r.public_comment_reply || '',
      direct_message: r.direct_message || '',
      media_filter: r.media_filter || 'all',
      buttons: Array.isArray(r.buttons) ? r.buttons : []
    });
    setNewBtnTitle('');
    setNewBtnUrl('');
    setShowRuleModal(true);
  };

  // Attach Rule Directly from Media
  const attachRuleToMedia = (m: MediaItem) => {
    const existing = rules.find(r => r.media_filter === m.id);
    if (existing) {
      openEditRule(existing);
      showToast(`Editing flow attached to this reel`);
      return;
    }

    const cleanSnippet = (m.caption || '').split('\n')[0].trim().substring(0, 32);
    setEditingRule(null);
    setRuleForm({
      name: `Reel Flow: ${cleanSnippet || m.id.substring(0, 8)}`,
      trigger_type: 'comment',
      match_type: 'contains',
      keywords: 'course, fee, info, syllabus, admission, details, send, link',
      action: 'dm',
      public_comment_reply: 'Sent you complete details in your DM! Check your requests 📥',
      direct_message: `Hey! Thanks for commenting on our reel "${cleanSnippet}". Here is the official brochure & details:`,
      media_filter: m.id,
      buttons: [
        { type: 'web_url', title: '🌐 View Syllabus', url: 'https://digiperform.com' },
        { type: 'web_url', title: '📞 WhatsApp Us', url: 'https://wa.me/919813848094' }
      ]
    });
    setNewBtnTitle('');
    setNewBtnUrl('');
    setShowRuleModal(true);
  };

  // Fetch Media Catalog from Turso
  const fetchMedia = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/media`);
      const data = await res.json();
      if (data.success) {
        setMedia(data.media || []);
        setMediaStats({
          total: data.total || 0,
          active: data.active || 0,
          archived: data.archived || 0,
          zero: data.zeroCount || 0
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Sync Live from Meta Graph API
  const handleSyncInstagram = async () => {
    setSyncingMedia(true);
    showToast('Syncing live posts & archived status directly from Meta...');
    try {
      const res = await fetch(`${API_BASE}/api/media/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Meta Sync Complete: ${data.active} active on profile, ${data.archived} archived!`);
        await fetchMedia();
      } else {
        showToast('Sync error: ' + data.error);
      }
    } catch (err: any) {
      showToast('Failed to sync with Meta: ' + err.message);
    } finally {
      setSyncingMedia(false);
    }
  };

  // Toggle Archive Media
  const toggleArchiveMedia = async (id: string, currentArchived: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/api/media/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ids: [id], archived: !currentArchived })
      });
      const data = await res.json();
      if (data.success) {
        setMedia(media.map(m => (m.id === id ? { ...m, archived: !currentArchived } : m)));
        setMediaStats(prev => ({
          ...prev,
          active: currentArchived ? prev.active + 1 : prev.active - 1,
          archived: currentArchived ? prev.archived - 1 : prev.archived + 1
        }));
        showToast(!currentArchived ? 'Marked as archived' : 'Unmarked as active');
      }
    } catch (err) {
      showToast('Failed to update media status');
    }
  };

  // Fetch SEO Data
  const fetchSeo = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/seo/analyze`);
      const data = await res.json();
      if (data.success) {
        setSeoData(data);
        setEditableBio(data.optimizedBio || '');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Run Simulator
  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simText.trim()) return;
    setSimLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/test/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: simText,
          triggerType: simType,
          mediaId: simMediaId !== 'all' ? simMediaId : null
        })
      });
      const data = await res.json();
      setSimResult(data);
    } catch (err) {
      showToast('Simulation error');
    } finally {
      setSimLoading(false);
    }
  };

  // Fetch Logs
  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/logs`);
      const data = await res.json();
      if (data.success) setLogs(data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Clear Logs
  const clearLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/logs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setLogs([]);
        showToast('Activity logs cleared');
      }
    } catch (err) {
      showToast('Failed to clear logs');
    }
  };

  useEffect(() => {
    if (token) {
      fetchRules();
      fetchMedia();
      fetchSeo();
      fetchLogs();
    }
  }, [token]);

  // ===========================================================================
  // LOGIN SCREEN
  // ===========================================================================
  if (!token) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 20%, #171f2e 0%, #090c12 70%)',
        padding: '1.5rem'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '380px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.65)'
        }}>
          {/* BrightBean Brand Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'var(--brand-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(249, 115, 22, 0.35)'
            }}>
              <Zap size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: '#fff' }}>
                BrightBean Studio
              </h1>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                @digiperformellenabad • Edge Engine
              </span>
            </div>
          </div>

          {loginError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              padding: '0.65rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              marginBottom: '1rem'
            }}>
              <AlertCircle size={15} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Username
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fff',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fff',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              style={{
                marginTop: '0.4rem',
                background: 'var(--brand-gradient)',
                color: '#fff',
                padding: '0.65rem',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)',
                opacity: loginLoading ? 0.7 : 1
              }}
            >
              {loginLoading ? 'Authenticating...' : 'Sign In to Studio'}
            </button>
          </form>

          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldCheck size={13} color="var(--accent-green)" />
            <span>Encrypted Turso libSQL Auth & Cloudflare Workers</span>
          </div>
        </div>
      </div>
    );
  }

  // Filtered Rules
  const filteredRules = rules.filter(r => {
    const matchesSearch =
      r.name.toLowerCase().includes(ruleSearch.toLowerCase()) ||
      (Array.isArray(r.keywords) ? r.keywords.join(' ') : String(r.keywords)).toLowerCase().includes(ruleSearch.toLowerCase());
    if (!matchesSearch) return false;

    if (ruleScopeFilter === 'reels') return r.media_filter && r.media_filter !== 'all';
    if (ruleScopeFilter === 'global') return !r.media_filter || r.media_filter === 'all';
    return true;
  });

  const reelRulesCount = rules.filter(r => r.media_filter && r.media_filter !== 'all').length;
  const globalRulesCount = rules.filter(r => !r.media_filter || r.media_filter === 'all').length;
  const mediaWithRulesCount = media.filter(m => rules.some(r => r.media_filter === m.id)).length;
  const mediaWithoutRulesCount = media.filter(m => !rules.some(r => r.media_filter === m.id)).length;

  // Filtered & Sorted Media
  const filteredMedia = (
    mediaFilter === 'top'
      ? [...media].sort((a, b) => b.score - a.score).slice(0, 10)
      : media.filter(m => {
          if (mediaFilter === 'attached') return rules.some(r => r.media_filter === m.id);
          if (mediaFilter === 'unattached') return !rules.some(r => r.media_filter === m.id);
          if (mediaFilter === 'active') return !m.archived;
          if (mediaFilter === 'archived') return m.archived;
          return true;
        })
  ).sort((a, b) => {
    if (mediaSort === 'score') return b.score - a.score;
    if (mediaSort === 'date') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (mediaSort === 'likes') return b.like_count - a.like_count;
    return 0;
  });

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-app)' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'rgba(20, 25, 38, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          color: '#fff',
          padding: '0.65rem 1rem',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 9999,
          fontSize: '0.8rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          backdropFilter: 'blur(8px)'
        }}>
          <CheckCircle2 size={16} color="var(--accent-green)" />
          <span>{toast}</span>
        </div>
      )}

      {/* =======================================================================
          BRIGHTBEAN STUDIO SIDEBAR (COLLAPSIBLE 240px ➔ 64px)
          ======================================================================= */}
      <aside style={{
        width: sidebarCollapsed ? '64px' : '240px',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        zIndex: 50
      }}>
        {/* Workspace Switcher Header */}
        <div style={{
          padding: '0.85rem 1rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--brand-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 10px rgba(249, 115, 22, 0.35)'
            }}>
              <Zap size={18} color="#fff" />
            </div>
            {!sidebarCollapsed && (
              <div style={{ overflow: 'hidden' }}>
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff', display: 'block', lineHeight: 1.2 }}>
                  BrightBean
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', display: 'block' }}>
                  @digiperformellenabad
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{ color: 'var(--text-muted)', padding: '0.2rem', borderRadius: '4px' }}
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto' }}>
          {[
            { id: 'rules', label: 'Automations', icon: Zap, count: rules.length },
            { id: 'media', label: 'Reels Library', icon: Film, count: `${mediaStats.active}` },
            { id: 'composer', label: 'Composer', icon: PenTool },
            { id: 'simulator', label: 'Live Test', icon: Play },
            { id: 'logs', label: 'Activity Stream', icon: Activity, count: logs.length },
            { id: 'analytics', label: 'Analytics & SEO', icon: TrendingUp },
            { id: 'settings', label: 'Meta Settings', icon: Settings }
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: sidebarCollapsed ? '0.65rem' : '0.55rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.8rem',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  border: '1px solid ' + (isActive ? 'var(--border-strong)' : 'transparent'),
                  transition: 'all 0.15s ease'
                }}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon size={16} color={isActive ? 'var(--accent-orange)' : 'var(--text-muted)'} />
                {!sidebarCollapsed && (
                  <>
                    <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                    {item.count !== undefined && (
                      <span style={{
                        fontSize: '0.65rem',
                        background: 'rgba(255,255,255,0.06)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '99px',
                        color: 'var(--text-muted)'
                      }}>
                        {item.count}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div style={{
          padding: '0.75rem',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'space-between'
        }}>
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent-green)' }} className="pulse-dot" />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Edge Live</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Log Out"
            style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem' }}
          >
            <LogOut size={15} />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* =======================================================================
          MAIN APP CONTENT WORKSPACE
          ======================================================================= */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Header Bar */}
        <header style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0.65rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, textTransform: 'capitalize' }}>
              {activeTab === 'rules' ? 'Automations & Flow Triggers' :
               activeTab === 'media' ? 'Reels & Media Library' :
               activeTab === 'composer' ? 'Composer & Cross-Channel Post' :
               activeTab === 'simulator' ? 'Interactive Webhook Simulator' :
               activeTab === 'logs' ? 'Activity & Execution Stream' :
               activeTab === 'analytics' ? 'Studio Analytics & Profile Audit' : 'Meta & Cloudflare Settings'}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Live Webhook Status */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '0.25rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.72rem',
              color: 'var(--accent-green)',
              fontWeight: 700
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-green)' }} className="pulse-dot" />
              <span>Cloudflare 24/7 Active</span>
            </div>

            <button
              onClick={() => copyToClipboard(`${API_BASE}/webhook`, 'header_webhook', 'Webhook URL')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                padding: '0.3rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.72rem',
                color: 'var(--text-secondary)'
              }}
            >
              {copiedKey === 'header_webhook' ? <Check size={13} color="var(--accent-green)" /> : <Copy size={13} />}
              <span>Webhook URL</span>
            </button>

            <a
              href="https://www.instagram.com/digiperformellenabad/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                background: 'var(--bg-surface-elevated)',
                padding: '0.3rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                textDecoration: 'none'
              }}
            >
              <span>@digiperformellenabad</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>

          {/* ===================================================================
              VIEW 1: AUTOMATIONS & FLOWS (BRIGHTBEAN STYLE)
              =================================================================== */}
          {activeTab === 'rules' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                {/* Scope Filters */}
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {[
                    { id: 'all', label: `All Automations (${rules.length})` },
                    { id: 'reels', label: `🎯 Reel-Specific (${reelRulesCount})` },
                    { id: 'global', label: `🌐 Account-Wide (${globalRulesCount})` }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setRuleScopeFilter(t.id as any)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        borderRadius: 'var(--radius-sm)',
                        background: ruleScopeFilter === t.id ? 'var(--bg-surface-elevated)' : 'transparent',
                        color: ruleScopeFilter === t.id ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid ' + (ruleScopeFilter === t.id ? 'var(--border-strong)' : 'transparent')
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ position: 'relative', width: '220px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '9px', top: '9px', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search keywords..."
                      value={ruleSearch}
                      onChange={e => setRuleSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem 0.45rem 1.95rem',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        color: '#fff',
                        fontSize: '0.76rem'
                      }}
                    />
                  </div>

                  <button
                    onClick={openNewRule}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      background: 'var(--brand-gradient)',
                      color: '#fff',
                      padding: '0.45rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)'
                    }}
                  >
                    <Plus size={14} />
                    <span>New Automation Flow</span>
                  </button>
                </div>
              </div>

              {/* Automation Flow Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {filteredRules.length > 0 ? (
                  filteredRules.map(r => {
                    const attachedReel = media.find(m => m.id === r.media_filter);
                    const isReelSpecific = Boolean(r.media_filter && r.media_filter !== 'all');

                    return (
                      <div
                        key={r.id}
                        className="interactive-card"
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          opacity: r.enabled ? 1 : 0.65
                        }}
                      >
                        {/* Card Header */}
                        <div style={{
                          padding: '0.85rem 1.15rem',
                          borderBottom: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(255, 255, 255, 0.015)',
                          flexWrap: 'wrap',
                          gap: '0.65rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff' }}>
                              {r.name}
                            </span>
                            <span style={{
                              fontSize: '0.66rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '0.12rem 0.45rem',
                              borderRadius: '4px',
                              background: r.trigger_type === 'comment' ? 'rgba(236,72,153,0.12)' : 'rgba(56,189,248,0.12)',
                              color: r.trigger_type === 'comment' ? '#f472b6' : '#38bdf8',
                              border: '1px solid ' + (r.trigger_type === 'comment' ? 'rgba(236,72,153,0.25)' : 'rgba(56,189,248,0.25)')
                            }}>
                              {r.trigger_type === 'comment' ? '🎬 Reel Comment' : '💬 Direct Message'}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              • {r.trigger_count || 0} triggered
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <button
                              onClick={() => openEditRule(r)}
                              style={{
                                padding: '0.3rem 0.65rem',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--bg-surface-elevated)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-subtle)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              <Edit2 size={12} />
                              <span>Edit Flow</span>
                            </button>
                            <button
                              onClick={() => toggleRule(r.id)}
                              style={{
                                padding: '0.3rem 0.7rem',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                borderRadius: '99px',
                                background: r.enabled ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                                color: r.enabled ? 'var(--accent-green)' : 'var(--text-muted)',
                                border: '1px solid ' + (r.enabled ? 'rgba(16,185,129,0.3)' : 'var(--border-subtle)')
                              }}
                            >
                              {r.enabled ? 'Active' : 'Paused'}
                            </button>
                            <button
                              onClick={() => deleteRule(r.id)}
                              style={{ color: 'var(--text-muted)', padding: '0.35rem', borderRadius: '6px' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Card Content & Scope */}
                        <div style={{ padding: '1rem 1.15rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {isReelSpecific ? (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'rgba(236,72,153,0.06)',
                              border: '1px solid rgba(236,72,153,0.22)',
                              padding: '0.55rem 0.85rem',
                              borderRadius: 'var(--radius-sm)',
                              flexWrap: 'wrap',
                              gap: '0.65rem'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <span style={{ fontSize: '1.1rem' }}>🎬</span>
                                <div>
                                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#fff', display: 'block' }}>
                                    Target Reel: {attachedReel ? attachedReel.caption.split('\n')[0].substring(0, 50) : `ID ${r.media_filter}`}
                                  </span>
                                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                    {attachedReel ? `❤️ ${attachedReel.like_count} likes • 💬 ${attachedReel.comments_count} comments` : `ID: ${r.media_filter}`}
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                {attachedReel?.permalink && (
                                  <a
                                    href={attachedReel.permalink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      color: '#38bdf8',
                                      background: 'rgba(56,189,248,0.1)',
                                      border: '1px solid rgba(56,189,248,0.25)',
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '4px',
                                      textDecoration: 'none'
                                    }}
                                  >
                                    View on IG ↗
                                  </a>
                                )}
                                <button
                                  onClick={() => openEditRule(r)}
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    color: '#f472b6',
                                    background: 'rgba(236,72,153,0.12)',
                                    border: '1px solid rgba(236,72,153,0.3)',
                                    padding: '0.2rem 0.55rem',
                                    borderRadius: '4px'
                                  }}
                                >
                                  Switch Reel
                                </button>
                                <button
                                  onClick={() => detachReelFromRule(r)}
                                  style={{
                                    fontSize: '0.7rem',
                                    color: 'var(--text-muted)',
                                    background: 'var(--bg-surface-elevated)',
                                    border: '1px solid var(--border-subtle)',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px'
                                  }}
                                >
                                  Make Global
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid var(--border-subtle)',
                              padding: '0.45rem 0.85rem',
                              borderRadius: 'var(--radius-sm)'
                            }}>
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                                🌐 <strong>Global Automation:</strong> Triggers across all public Reels & direct message inquiries
                              </span>
                              <button
                                onClick={() => openEditRule(r)}
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  color: '#38bdf8',
                                  background: 'rgba(56,189,248,0.12)',
                                  border: '1px solid rgba(56,189,248,0.25)',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '4px'
                                }}
                              >
                                + Attach to Specific Reel
                              </button>
                            </div>
                          )}

                          {/* Keywords */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {Array.isArray(r.keywords) && r.keywords.map((kw, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: '0.7rem',
                                  fontFamily: 'JetBrains Mono',
                                  background: 'var(--bg-surface-elevated)',
                                  border: '1px solid var(--border-subtle)',
                                  padding: '0.12rem 0.45rem',
                                  borderRadius: '4px',
                                  color: 'var(--text-primary)'
                                }}
                              >
                                {kw}
                              </span>
                            ))}
                          </div>

                          {/* Responses */}
                          <div style={{ display: 'grid', gridTemplateColumns: r.public_comment_reply ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
                            {r.public_comment_reply && (
                              <div style={{ background: 'rgba(236,72,153,0.05)', border: '1px solid rgba(236,72,153,0.18)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                                <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#f472b6', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                                  <MessageSquare size={12} />
                                  <span>Public Comment Reply</span>
                                </span>
                                <p style={{ fontSize: '0.74rem', color: '#fff', margin: 0 }}>"{r.public_comment_reply}"</p>
                              </div>
                            )}

                            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                              <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
                                Automated Direct Message
                              </span>
                              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-line' }}>
                                {r.direct_message || 'No direct message configured'}
                              </p>
                            </div>
                          </div>

                          {/* CTA Buttons */}
                          {r.buttons && r.buttons.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                              {r.buttons.map((b, i) => (
                                <span
                                  key={i}
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '0.2rem 0.55rem',
                                    borderRadius: '4px',
                                    background: 'rgba(56,189,248,0.12)',
                                    color: '#38bdf8',
                                    border: '1px solid rgba(56,189,248,0.25)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem'
                                  }}
                                >
                                  <span>🔗</span>
                                  <strong>{b.title}</strong>
                                  {b.url && <span style={{ opacity: 0.7, fontSize: '0.65rem' }}>({b.url})</span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>No automations found matching your filter.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================================================================
              VIEW 2: REELS LIBRARY
              =================================================================== */}
          {activeTab === 'media' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {[
                    { id: 'all', label: `All (${media.length})` },
                    { id: 'attached', label: `⚡ Has Flow (${mediaWithRulesCount})` },
                    { id: 'unattached', label: `Needs Flow (${mediaWithoutRulesCount})` },
                    { id: 'top', label: `🔥 Top 10` },
                    { id: 'active', label: `Active (${mediaStats.active})` },
                    { id: 'archived', label: `Archived (${mediaStats.archived})` }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setMediaFilter(tab.id as any)}
                      style={{
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        borderRadius: 'var(--radius-sm)',
                        background: mediaFilter === tab.id ? 'var(--brand-gradient)' : 'var(--bg-surface-elevated)',
                        color: mediaFilter === tab.id ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid ' + (mediaFilter === tab.id ? 'transparent' : 'var(--border-subtle)')
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={handleSyncInstagram}
                    disabled={syncingMedia}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: 'var(--brand-gradient)',
                      color: '#fff',
                      padding: '0.45rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.74rem',
                      fontWeight: 700
                    }}
                  >
                    <RefreshCw size={13} className={syncingMedia ? 'spin' : ''} />
                    <span>{syncingMedia ? 'Syncing...' : 'Sync Live Meta API'}</span>
                  </button>
                </div>
              </div>

              {/* Media Table */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.65rem 0.95rem' }}>Rank/Type</th>
                      <th style={{ padding: '0.65rem 0.95rem' }}>Caption</th>
                      <th style={{ padding: '0.65rem 0.95rem' }}>Posted</th>
                      <th style={{ padding: '0.65rem 0.95rem' }}>Engagement</th>
                      <th style={{ padding: '0.65rem 0.95rem' }}>Status</th>
                      <th style={{ padding: '0.65rem 0.95rem' }}>Attached Automation Flow</th>
                      <th style={{ padding: '0.65rem 0.95rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMedia.map((m, idx) => {
                      const attachedRules = rules.filter(r => r.media_filter === m.id);
                      return (
                        <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.65rem 0.95rem' }}>
                            <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '0.12rem 0.45rem', borderRadius: '4px', background: 'rgba(249,115,22,0.12)', color: 'var(--accent-orange)' }}>
                              #{idx + 1} Reel
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.95rem', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.caption || 'No caption'}
                          </td>
                          <td style={{ padding: '0.65rem 0.95rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                            {m.timestamp ? new Date(m.timestamp).toLocaleDateString() : 'N/A'}
                          </td>
                          <td style={{ padding: '0.65rem 0.95rem' }}>
                            <span style={{ color: '#f472b6', fontWeight: 700, marginRight: '0.5rem' }}>❤️ {m.like_count}</span>
                            <span style={{ color: '#38bdf8', fontWeight: 700 }}>💬 {m.comments_count}</span>
                          </td>
                          <td style={{ padding: '0.65rem 0.95rem' }}>
                            <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '99px', background: m.archived ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)', color: m.archived ? 'var(--accent-amber)' : 'var(--accent-green)' }}>
                              {m.archived ? '📦 Archived' : '✅ Active'}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.95rem' }}>
                            {attachedRules.length > 0 ? (
                              <button
                                onClick={() => openEditRule(attachedRules[0])}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  background: 'rgba(16,185,129,0.15)',
                                  border: '1px solid rgba(16,185,129,0.35)',
                                  color: 'var(--accent-green)',
                                  padding: '0.22rem 0.55rem',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700
                                }}
                              >
                                <CheckCircle2 size={12} />
                                <span>✓ {attachedRules[0].name.substring(0, 22)}</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => attachRuleToMedia(m)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  background: 'rgba(236,72,153,0.12)',
                                  border: '1px solid rgba(236,72,153,0.3)',
                                  color: '#f472b6',
                                  padding: '0.22rem 0.55rem',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700
                                }}
                              >
                                <Zap size={11} />
                                <span>⚡ Attach Flow</span>
                              </button>
                            )}
                          </td>
                          <td style={{ padding: '0.65rem 0.95rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              {m.permalink && (
                                <a href={m.permalink} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', padding: '0.2rem 0.45rem', fontSize: '0.7rem', textDecoration: 'none' }}>
                                  IG ↗
                                </a>
                              )}
                              <button
                                onClick={() => toggleArchiveMedia(m.id, m.archived)}
                                style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '0.2rem 0.45rem', borderRadius: '4px', background: 'var(--bg-surface-elevated)' }}
                              >
                                {m.archived ? 'Activate' : 'Archive'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================================================================
              VIEW 3: COMPOSER (BRIGHTBEAN STUDIO COMPOSER)
              =================================================================== */}
          {activeTab === 'composer' && (
            <div style={{ maxWidth: '780px', margin: '0 auto', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 1rem 0' }}>Composer & Social Publisher</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Post Caption
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Write an engaging caption for @digiperformellenabad..."
                    value={composeText}
                    onChange={e => setComposeText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#fff',
                      fontSize: '0.82rem',
                      lineHeight: 1.5
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Hashtags
                  </label>
                  <input
                    type="text"
                    value={composeHashtags}
                    onChange={e => setComposeHashtags(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#fff',
                      fontSize: '0.8rem'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button
                    onClick={() => {
                      copyToClipboard(`${composeText}\n\n${composeHashtags}`, 'caption', 'Full Post Caption');
                    }}
                    style={{
                      background: 'var(--brand-gradient)',
                      color: '#fff',
                      padding: '0.55rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <Copy size={13} />
                    <span>Copy Formatted Post</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================
              VIEW 4: LIVE SIMULATOR
              =================================================================== */}
          {activeTab === 'simulator' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 1rem 0' }}>Simulate Comment / DM</h3>
                <form onSubmit={handleSimulate} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      Channel Type
                    </label>
                    <select
                      value={simType}
                      onChange={e => setSimType(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.78rem' }}
                    >
                      <option value="comment">🎬 Reel Comment</option>
                      <option value="message">💬 Direct Message</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      Reel Target
                    </label>
                    <select
                      value={simMediaId}
                      onChange={e => setSimMediaId(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.78rem' }}
                    >
                      <option value="all">🌐 Any Reel / Global</option>
                      {media.map(m => (
                        <option key={m.id} value={m.id}>{m.caption.split('\n')[0].substring(0, 36) || m.id}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      Test Text
                    </label>
                    <input
                      type="text"
                      required
                      value={simText}
                      onChange={e => setSimText(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.8rem' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={simLoading}
                    style={{ background: 'var(--brand-gradient)', color: '#fff', padding: '0.6rem', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.78rem' }}
                  >
                    {simLoading ? 'Simulating...' : 'Run Simulation'}
                  </button>
                </form>
              </div>

              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 1rem 0' }}>Simulation Result</h3>
                {simResult ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', background: simResult.matched ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: simResult.matched ? 'var(--accent-green)' : '#f87171', fontWeight: 700, fontSize: '0.76rem' }}>
                      {simResult.matched ? `Matched: "${simResult.ruleName}"` : 'No rule matched'}
                    </div>
                    {simResult.publicReply && (
                      <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.65rem', borderRadius: 'var(--radius-sm)', fontSize: '0.74rem' }}>
                        <span style={{ color: '#f472b6', fontWeight: 700, display: 'block' }}>Public Comment Reply:</span>
                        "{simResult.publicReply}"
                      </div>
                    )}
                    {simResult.directMessage && (
                      <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.65rem', borderRadius: 'var(--radius-sm)', fontSize: '0.74rem' }}>
                        <span style={{ color: '#38bdf8', fontWeight: 700, display: 'block' }}>Direct Message:</span>
                        {simResult.directMessage}
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Run a test on the left to see rule response.</p>
                )}
              </div>
            </div>
          )}

          {/* ===================================================================
              VIEW 5: ACTIVITY LOGS
              =================================================================== */}
          {activeTab === 'logs' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Webhook Activity & Event Stream</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={fetchLogs} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)', fontSize: '0.74rem' }}>
                    Refresh
                  </button>
                  <button onClick={clearLogs} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)', fontSize: '0.74rem' }}>
                    Clear
                  </button>
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.76rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.65rem 0.95rem' }}>Timestamp</th>
                      <th style={{ padding: '0.65rem 0.95rem' }}>Type</th>
                      <th style={{ padding: '0.65rem 0.95rem' }}>Rule</th>
                      <th style={{ padding: '0.65rem 0.95rem' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.65rem 0.95rem', color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td style={{ padding: '0.65rem 0.95rem', color: '#38bdf8' }}>{log.type}</td>
                        <td style={{ padding: '0.65rem 0.95rem', fontWeight: 600 }}>{log.rule_name || '—'}</td>
                        <td style={{ padding: '0.65rem 0.95rem', color: 'var(--text-secondary)' }}>{log.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================================================================
              VIEW 6: ANALYTICS & SEO
              =================================================================== */}
          {activeTab === 'analytics' && seoData && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 1rem 0' }}>Instagram SEO Score: {seoData.profileSEOScore.total}/100</h3>
              <textarea
                rows={4}
                value={editableBio}
                onChange={e => setEditableBio(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.8rem' }}
              />
              <button
                onClick={() => copyToClipboard(editableBio, 'bio', 'Optimized Bio')}
                style={{ marginTop: '0.5rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-strong)', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.74rem' }}
              >
                Copy Optimized Bio
              </button>
            </div>
          )}

          {/* ===================================================================
              VIEW 7: SETTINGS
              =================================================================== */}
          {activeTab === 'settings' && (
            <div style={{ maxWidth: '780px', margin: '0 auto', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Meta Webhook & Cloudflare Settings</h3>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                  Permanent Webhook URL (Meta for Developers):
                </span>
                <code style={{ display: 'block', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#38bdf8', fontSize: '0.78rem' }}>
                  {API_BASE}/webhook
                </code>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                  Verify Token:
                </span>
                <code style={{ display: 'block', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#34d399', fontSize: '0.78rem' }}>
                  digiperform_auto_verify_2026
                </code>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =======================================================================
          FLOW BUILDER / EDIT RULE MODAL
          ======================================================================= */}
      {showRuleModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface-elevated)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
                {editingRule ? 'Edit Automation Flow' : 'Create Automation Flow'}
              </h3>
              <button onClick={() => setShowRuleModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveRule} style={{ overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Flow Name</label>
                <input
                  type="text"
                  required
                  value={ruleForm.name}
                  onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.78rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Target Reel Scope</label>
                <select
                  value={ruleForm.media_filter}
                  onChange={e => setRuleForm({ ...ruleForm, media_filter: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.78rem' }}
                >
                  <option value="all">🌐 All Reels & Posts (Global)</option>
                  {media.map(m => (
                    <option key={m.id} value={m.id}>🎬 {m.caption.split('\n')[0].substring(0, 42) || m.id} (❤️ {m.like_count})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Keywords (comma separated)</label>
                <input
                  type="text"
                  value={ruleForm.keywords}
                  onChange={e => setRuleForm({ ...ruleForm, keywords: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.78rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-pink)', marginBottom: '0.3rem' }}>Public Reel Comment Reply</label>
                <input
                  type="text"
                  value={ruleForm.public_comment_reply}
                  onChange={e => setRuleForm({ ...ruleForm, public_comment_reply: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'var(--bg-surface-elevated)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.78rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Automated Direct Message (DM)</label>
                <textarea
                  rows={3}
                  value={ruleForm.direct_message}
                  onChange={e => setRuleForm({ ...ruleForm, direct_message: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.78rem', lineHeight: 1.5 }}
                />
              </div>

              {/* Button builder */}
              <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#fff', display: 'block', marginBottom: '0.5rem' }}>CTA Buttons</span>
                {ruleForm.buttons && ruleForm.buttons.map((b, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface-elevated)', padding: '0.35rem 0.65rem', borderRadius: '4px', marginBottom: '0.35rem', fontSize: '0.72rem' }}>
                    <span>🔗 {b.title} {b.url && `(${b.url})`}</span>
                    <button type="button" onClick={() => handleRemoveButton(idx)} style={{ color: '#f87171' }}><Trash2 size={12} /></button>
                  </div>
                ))}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px', gap: '0.4rem', marginTop: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Title"
                    value={newBtnTitle}
                    onChange={e => setNewBtnTitle(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: '#fff', fontSize: '0.72rem' }}
                  />
                  <input
                    type="url"
                    placeholder="https://..."
                    value={newBtnUrl}
                    onChange={e => setNewBtnUrl(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: '#fff', fontSize: '0.72rem' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddButton}
                    style={{ background: 'var(--brand-gradient)', color: '#fff', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowRuleModal(false)} style={{ padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Cancel</button>
                <button type="submit" style={{ padding: '0.5rem 1.15rem', borderRadius: 'var(--radius-sm)', fontSize: '0.74rem', fontWeight: 700, color: '#fff', background: 'var(--brand-gradient)' }}>
                  {editingRule ? 'Save Changes' : 'Deploy Flow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
