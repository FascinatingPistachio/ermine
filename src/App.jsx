import React, {
  useEffect, useMemo, useRef, useState,
  useCallback, memo, Component,
} from 'react';
import {
  AlertCircle, Bell, BellOff, BookOpen, ChevronDown, ChevronRight,
  Circle, EyeOff, Hash, Link, LogOut, Menu, MessageSquare, Moon,
  MinusCircle, Plus, Paperclip, Pin, Reply, Send, Settings,
  ShieldCheck, Smile, User, Users, UserPlus, UserCheck, UserX,
  X, Trash2, Edit2, Save, Search, Loader, Copy, Check,
} from 'lucide-react';

// ─── ULID ─────────────────────────────────────────────────────────────────────
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DEC = {};
for (let i = 0; i < ENCODING.length; i++) DEC[ENCODING[i]] = i;
const ulidToMillis = (id) => {
  if (typeof id !== 'string' || id.length !== 26) return Date.now();
  let t = 0;
  for (let i = 0; i < 10; i++) t = t * 32 + (DEC[id[i].toUpperCase()] || 0);
  return t;
};
const ulidToDate = (id) => new Date(ulidToMillis(id));

// ─── Low-spec guard ───────────────────────────────────────────────────────────
const isLowSpec =
  typeof navigator !== 'undefined' &&
  (/Nintendo WiiU|Nintendo 3DS|PlayStation/i.test(navigator.userAgent) ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches));

// ─── Twemoji ──────────────────────────────────────────────────────────────────
const TW = 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/';
const toCP = (s) => {
  const r = []; let c = 0, p = 0, i = 0;
  while (i < s.length) {
    c = s.charCodeAt(i++);
    if (p) { r.push((0x10000 + ((p - 0xd800) << 10) + (c - 0xdc00)).toString(16)); p = 0; }
    else if (0xd800 <= c && c <= 0xdbff) p = c;
    else r.push(c.toString(16));
  }
  return r.join('-');
};
const renderTwemoji = (text, cls = 'inline-block w-5 h-5 align-bottom') => {
  if (!text) return null;
  return text.split(/([\uD800-\uDBFF][\uDC00-\uDFFF])/g).map((p, i) =>
    /[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(p)
      ? <img key={i} src={`${TW}${toCP(p)}.png`} alt={p} className={cls} draggable={false} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      : p
  );
};

// ─── Config ───────────────────────────────────────────────────────────────────
const getRuntimeConfig = () => {
  const r = typeof window !== 'undefined' ? window.__ERMINE_CONFIG__ || {} : {};
  const bApi = typeof __ERMINE_API_URL__ !== 'undefined' ? __ERMINE_API_URL__ : '';
  const bWs  = typeof __ERMINE_WS_URL__  !== 'undefined' ? __ERMINE_WS_URL__  : '';
  const bCdn = typeof __ERMINE_CDN_URL__ !== 'undefined' ? __ERMINE_CDN_URL__ : '';
  return {
    apiUrl: r.apiUrl || bApi || 'https://api.stoat.chat',
    wsUrl:  r.wsUrl  || bWs  || 'wss://stoat.chat/events',
    cdnUrl: r.cdnUrl || bCdn || 'https://cdn.stoatusercontent.com',
  };
};
const { apiUrl: DEF_API, wsUrl: DEF_WS, cdnUrl: DEF_CDN } = getRuntimeConfig();

const inputBase = 'w-full rounded-md border border-[#242A35] bg-[#141821] px-3 py-2 text-sm text-[#E6EDF3] placeholder:text-[#8892A6] focus:border-[#8AB4F8] focus:outline-none focus:ring-1 focus:ring-[#8AB4F8]';

const TK  = 'ermine_session_token';
const UK  = 'ermine_user_id';
const AK  = 'ermine_api_url';

const getCookie = (n) => { if (typeof document === 'undefined') return null; const v = document.cookie.split('; ').find((e) => e.startsWith(`${n}=`)); return v ? decodeURIComponent(v.slice(n.length + 1)) : null; };
const setCookie = (n, v, a = 2592000) => { if (typeof document !== 'undefined') document.cookie = `${n}=${encodeURIComponent(v)}; Max-Age=${a}; Path=/; SameSite=Lax; Secure`; };
const clearCookie = (n) => { if (typeof document !== 'undefined') document.cookie = `${n}=; Max-Age=0; Path=/; SameSite=Lax; Secure`; };

// ─── Status options ───────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'Online',    label: 'Online',        icon: Circle,      iconClass: 'text-[#3ba55d]' },
  { value: 'Idle',      label: 'Idle',           icon: Moon,        iconClass: 'text-[#f0b232]' },
  { value: 'Busy',      label: 'Do Not Disturb', icon: MinusCircle, iconClass: 'text-[#ed4245]' },
  { value: 'Focus',     label: 'Focus',          icon: Circle,      iconClass: 'text-[#4f7dff]' },
  { value: 'Invisible', label: 'Invisible',      icon: EyeOff,      iconClass: 'text-gray-400'  },
];

// ─── Time helpers ─────────────────────────────────────────────────────────────
const smartTime = (v) => {
  const d = typeof v === 'string' && v.length === 26 ? ulidToDate(v) : new Date(v);
  if (isNaN(d)) return '';
  const now = new Date(), yest = new Date(); yest.setDate(now.getDate() - 1);
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString())  return `Today at ${t}`;
  if (d.toDateString() === yest.toDateString()) return `Yesterday at ${t}`;
  return `${d.toLocaleDateString()} at ${t}`;
};
const dayKey = (m) => {
  const d = m.createdAt ? new Date(m.createdAt) : ulidToDate(m._id);
  return isNaN(d) ? '' : d.toDateString();
};
const daySepLabel = (m) => {
  const d = m.createdAt ? new Date(m.createdAt) : ulidToDate(m._id);
  if (isNaN(d)) return '';
  const now = new Date(), yest = new Date(); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString())  return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};
const dateLabel = (v) => { if (!v) return 'Unknown'; const d = new Date(v); return isNaN(d) ? 'Unknown' : d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }); };

// ─── Asset helpers ────────────────────────────────────────────────────────────
const avatarUrl = (u, cdn) => u?.avatar?._id ? `${cdn}/avatars/${u.avatar._id}` : null;
const iconUrl   = (s, cdn) => s?.icon?._id   ? `${cdn}/icons/${s.icon._id}` : null;
const bannerUrl = (u, cdn) => { const b = u?.profile?.background || u?.banner; const id = typeof b === 'string' ? b : b?._id; return id ? `${cdn}/backgrounds/${id}/original` : null; };
const joinedAt  = (e) => e?.joined_at || e?.joinedAt || e?.created_at || e?.createdAt || null;

// ─── Avatar component ─────────────────────────────────────────────────────────
const Avatar = ({ user, cdn, size = 'md', hover = false, always = false }) => {
  const sz = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' }[size];
  const init = (user?.username || '?').slice(0, 2).toUpperCase();
  const [h, setH] = useState(false);
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [user?.avatar?._id]);
  const anim = (always || (hover && h)) && !isLowSpec && !err;
  const src = user?.avatar?._id
    ? `${cdn}/avatars/${user.avatar._id}${anim ? '/original' : ''}`
    : null;
  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#313338] font-semibold text-gray-200 ${sz}`}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      {src ? <img alt={user?.username || ''} className="block h-full w-full object-cover" src={src} onError={() => { if (anim) setErr(true); }} /> : init}
    </div>
  );
};

// ─── Error boundary ───────────────────────────────────────────────────────────
class AppErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { err: false }; }
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e) { console.error('Ermine crash:', e); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center bg-[#0F1115] p-6 text-[#E6EDF3]">
        <div className="w-full max-w-lg rounded-2xl border border-[#242A35] bg-[#171A21] p-8 text-center shadow-2xl">
          <h1 className="text-2xl font-bold text-white">Connection interrupted.</h1>
          <p className="mt-2 text-sm text-[#A6B0C3]">A reload is required to recover.</p>
          <button className="mt-6 rounded-md bg-[#8AB4F8] px-4 py-2 text-sm font-semibold text-[#0F1115] hover:bg-[#6FA6E8]" onClick={() => window.location.reload()}>Reload Ermine</button>
        </div>
      </div>
    );
  }
}

// ─── Modal ────────────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children, wide = false }) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto"
    onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
    <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} m-auto rounded-xl border border-[#242A35] bg-[#171A21] shadow-2xl flex max-h-[90vh] flex-col animate-[ermineModalIn_140ms_ease-out]`}>
      <div className="flex shrink-0 items-center justify-between border-b border-[#202225] px-4 py-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <button className="rounded p-1 text-gray-400 hover:bg-[#3a3d42] hover:text-white" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="p-4 overflow-y-auto space-y-3 flex-1">{children}</div>
    </div>
  </div>
);

// ─── Date separator ───────────────────────────────────────────────────────────
const DateSep = ({ msg }) => (
  <div className="flex items-center gap-3 px-4 py-3 select-none pointer-events-none">
    <div className="flex-1 h-px bg-[#3f4249]" />
    <span className="text-xs font-semibold text-gray-400">{daySepLabel(msg)}</span>
    <div className="flex-1 h-px bg-[#3f4249]" />
  </div>
);

// ─── Optimised member list ─────────────────────────────────────────────────────
// Uses IntersectionObserver for true culling + variable item heights
const HEADER_H = 36;
const MEMBER_H = 44;

const MemberVirtualList = memo(({ items, renderItem, className }) => {
  const outerRef = useRef(null);
  const [vpTop, setVpTop] = useState(0);
  const [vpH, setVpH]     = useState(600);
  const rafRef = useRef();

  // Pre-compute cumulative offsets for variable heights
  const { offsets, total } = useMemo(() => {
    let acc = 0;
    const offs = items.map((item) => {
      const top = acc;
      acc += item.type === 'header' ? HEADER_H : MEMBER_H;
      return top;
    });
    return { offsets: offs, total: acc };
  }, [items]);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setVpH(el.clientHeight));
    ro.observe(el);
    setVpH(el.clientHeight);
    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => { setVpTop(el.scrollTop); rafRef.current = null; });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', onScroll); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const OVERSCAN = 6;
  const first = useMemo(() => {
    // Binary search for first visible index
    let lo = 0, hi = items.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const bot = offsets[mid] + (items[mid].type === 'header' ? HEADER_H : MEMBER_H);
      if (bot < vpTop) lo = mid + 1; else hi = mid;
    }
    return Math.max(0, lo - OVERSCAN);
  }, [offsets, vpTop, items]);

  const last = useMemo(() => {
    const cutoff = vpTop + vpH;
    let lo = first, hi = items.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offsets[mid] > cutoff) hi = mid - 1; else lo = mid;
    }
    return Math.min(items.length - 1, lo + OVERSCAN);
  }, [offsets, vpTop, vpH, first, items]);

  const visible = items.slice(first, last + 1);

  return (
    <div ref={outerRef} className={className} style={{ overflowY: 'auto', position: 'relative' }}>
      <div style={{ height: total, position: 'relative' }}>
        {visible.map((item, i) => {
          const idx = first + i;
          const h = item.type === 'header' ? HEADER_H : MEMBER_H;
          return (
            <div key={item.key || idx} style={{ position: 'absolute', top: offsets[idx], left: 0, right: 0, height: h }}>
              {renderItem(item)}
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ─── Link / markdown helpers ──────────────────────────────────────────────────
const LinkAnchor = ({ href, children, openLink, cls = 'text-[#8ea1ff] underline hover:text-[#bdc3ff]' }) => (
  <a className={cls} href={href} onClick={(e) => { e.preventDefault(); openLink?.(href); }} rel="noreferrer" target="_blank">{children}</a>
);

const renderLinks = (text, key, openLink) =>
  (text || '').split(/(https?:\/\/[^\s]+)/gi).map((p, i) =>
    /^https?:\/\//i.test(p) ? <LinkAnchor key={`${key}-${i}`} href={p} openLink={openLink}>{p}</LinkAnchor> : <React.Fragment key={`${key}-${i}`}>{p}</React.Fragment>
  );

const renderMd = (text, key, openLink) => {
  if (!text) return null;
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g).map((tok, i) => {
    if (/^`[^`]+`$/.test(tok)) return <code key={`${key}-${i}`} className="rounded bg-[#232428] px-1 py-0.5 text-xs font-mono text-[#f2f3f5]">{tok.slice(1,-1)}</code>;
    if (/^\*\*[^*]+\*\*$/.test(tok)) return <strong key={`${key}-${i}`}>{tok.slice(2,-2)}</strong>;
    if (/^\*[^*]+\*$/.test(tok))     return <em key={`${key}-${i}`}>{tok.slice(1,-1)}</em>;
    if (/^__[^_]+__$/.test(tok))     return <span key={`${key}-${i}`} className="underline">{tok.slice(2,-2)}</span>;
    if (/^~~[^~]+~~$/.test(tok))     return <span key={`${key}-${i}`} className="line-through">{tok.slice(2,-2)}</span>;
    const ml = tok.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i);
    if (ml) return <LinkAnchor key={`${key}-${i}`} href={ml[2]} openLink={openLink}>{ml[1]}</LinkAnchor>;
    return <React.Fragment key={`${key}-${i}`}>{renderLinks(tok, `${key}-pl-${i}`, openLink)}</React.Fragment>;
  });
};

// ─── Emoji data ───────────────────────────────────────────────────────────────
const SC = { smile:'😄',grin:'😁',joy:'😂',rofl:'🤣',wink:'😉',heart:'❤️',thumbs_up:'👍',thumbs_down:'👎',fire:'🔥',sob:'😭',thinking:'🤔',tada:'🎉',eyes:'👀',rocket:'🚀',star:'⭐',check:'✅',x:'❌',wave:'👋',clap:'👏',100:'💯' };
const STD_EMOJI = ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫣','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👻','👽','👾','🤖','👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','💪','👀','👄','🫦','💋','🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🐢','🐍','🦎','🐙','🦑','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐘','🦍','🐇','🦔','🌸','🌺','🌻','🌹','🍀','🌿','🍁','🍂','🌊','🌙','⭐','🌟','☀️','⛅','🌈','❄️','⚡','🔥','💧','🌍','🍎','🍊','🍋','🍇','🍓','🍕','🍔','🍟','🌮','🍜','🍣','🍦','🎂','🍰','🍫','☕','🧃','🍺','🥂','⚽','🏀','🎮','🎲','🎯','🏆','🥇','🎵','🎶','🎤','🎸','🎺','📱','💻','⌨️','🖥️','📷','🔑','💡','🔔','📢','📌','📎','✏️','📝','📚','💰','💎','🚀','✈️','🚗','🏠','🏰','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','✅','❌','⭕','💯','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤'];

const MEMBER_CHUNK = 400;

// ─── Emoji token helpers ──────────────────────────────────────────────────────
const isCE  = (v) => /^:[A-Z0-9]{26}:$/i.test(v || '');
const getCEId = (t) => t?.slice(1, -1);
const resolveCE = (token, byId) => {
  const eff = /^[A-Z0-9]{26}$/i.test(token) ? `:${token}:` : token;
  if (!isCE(eff)) return null;
  const id = getCEId(eff);
  return byId?.[id] || { id, name: id, unresolved: true };
};
const renderEmojiVis = (token, ce, cdn) => {
  const id = ce?.id || (/^[A-Z0-9]{26}$/i.test(token) ? token : isCE(token) ? getCEId(token) : null);
  if (id) return <img alt={ce?.name || token} className="inline h-5 w-5 align-text-bottom object-contain" src={`${cdn}/emojis/${id}`} />;
  return renderTwemoji(token);
};

// ─── Attachment helpers ───────────────────────────────────────────────────────
const isImg = (fn = '', ct = '') => ct.startsWith('image/') || ['png','jpg','jpeg','webp','gif','bmp','avif','svg'].includes(fn.split('.').pop()?.toLowerCase());
const attachData = (a, cdn, idx = 0) => {
  const id  = typeof a === 'string' ? a : a?._id || a?.id;
  const fn  = a?.filename || a?.name || `attachment-${idx + 1}`;
  const ct  = a?.content_type || a?.contentType || a?.metadata?.type || '';
  return { id, fn, url: id ? `${cdn}/attachments/${id}` : null, img: isImg(fn, ct) };
};
const isImgUrl = (u) => u && /\.(png|jpe?g|webp|gif|bmp|avif|svg)(\?.*)?$/i.test(u.split('?')[0]);
const extractUrls = (v = '') => v.match(/https?:\/\/[^\s]+/gi) || [];

// ─── Message content renderer ─────────────────────────────────────────────────
const renderContent = (content, users, channels, onUser, ceById, cdn, openLink) => {
  if (!content) return null;
  return content.split(/(<@!?[A-Za-z0-9]+>|<#[A-Za-z0-9]+>|:[A-Z0-9]{26}:)/g).map((p, i) => {
    const um = p.match(/^<@!?([A-Za-z0-9]+)>$/);
    if (um) { const u = users[um[1]]; return <button key={i} className="mx-0.5 inline rounded bg-[#5865f2]/25 px-1 text-[#bdc3ff] hover:bg-[#5865f2]/35" onClick={() => onUser(u || { _id: um[1], username: 'Unknown' }, um[1])}>@{u?.username || um[1]}</button>; }
    const cm = p.match(/^<#([A-Za-z0-9]+)>$/);
    if (cm) return <span key={i} className="mx-0.5 inline rounded bg-[#3f4249] px-1 text-gray-100">#{channels[cm[1]]?.name || 'unknown'}</span>;
    if (isCE(p)) { const ce = resolveCE(p, ceById); return <span key={i} className="mx-0.5 inline-flex items-center" title={ce?.name}>{renderEmojiVis(p, ce, cdn)}</span>; }
    const sc = p.match(/^:([a-z0-9_+-]+):$/i);
    if (sc && SC[sc[1].toLowerCase()]) return renderTwemoji(SC[sc[1].toLowerCase()]);
    return <React.Fragment key={i}>{renderMd(p, `m${i}`, openLink)}</React.Fragment>;
  });
};

// ─── System message renderer ──────────────────────────────────────────────────
const renderSystem = (msg, users) => {
  const sys = msg.system;
  if (!sys) return null;
  const byId = (id) => users[id]?.username || id?.slice(0, 8) || 'Unknown';
  switch (sys.type) {
    case 'text':          return <span className="italic">{sys.content}</span>;
    case 'user_added':    return <span className="italic text-green-400">👋 {byId(sys.by)} added {byId(sys.id)} to the group.</span>;
    case 'user_remove':   return <span className="italic text-red-400">👋 {byId(sys.by)} removed {byId(sys.id)} from the group.</span>;
    case 'user_joined':   return <span className="italic text-green-400">👋 {byId(sys.id)} joined.</span>;
    case 'user_left':     return <span className="italic text-gray-400">👋 {byId(sys.id)} left.</span>;
    case 'user_kicked':   return <span className="italic text-red-400">👢 {byId(sys.id)} was kicked by {byId(sys.by)}.</span>;
    case 'user_banned':   return <span className="italic text-red-400">🔨 {byId(sys.id)} was banned by {byId(sys.by)}.</span>;
    case 'channel_renamed': return <span className="italic text-blue-400">✏️ {byId(sys.by)} renamed the channel to <strong>{sys.name}</strong>.</span>;
    case 'channel_description_changed': return <span className="italic text-blue-400">📝 {byId(sys.by)} updated the channel description.</span>;
    case 'channel_icon_changed': return <span className="italic text-blue-400">🖼️ {byId(sys.by)} changed the channel icon.</span>;
    case 'channel_ownership_changed': return <span className="italic text-yellow-400">👑 Channel ownership transferred by {byId(sys.by)} to {byId(sys.to)}.</span>;
    default: return <span className="italic text-gray-500">[system event: {sys.type}]</span>;
  }
};

// ─── URL Embed component ──────────────────────────────────────────────────────
const UrlEmbed = memo(({ embed, cdn, openLink }) => {
  if (!embed) return null;
  const { type, url, title, description, image, icon_url, colour, site_name } = embed;
  if (type === 'Image') return (
    <button className="block mt-1.5 overflow-hidden rounded-lg border border-[#2f3237] hover:border-[#4a4d55] transition-colors max-w-xs" onClick={() => openLink(embed.url)} type="button">
      <img alt="Embed image" className="max-h-64 max-w-full object-contain" src={embed.url} loading="lazy" />
    </button>
  );
  if (type === 'Website' || type === 'Text') {
    const imgSrc = image?.url || null;
    return (
      <div className="mt-1.5 rounded-lg border-l-4 bg-[#1e2024] p-3 max-w-sm" style={{ borderColor: colour || '#3a3d42' }}>
        {site_name && <p className="text-xs text-gray-400 mb-1">{site_name}</p>}
        {title && <a className="text-sm font-semibold text-[#8ea1ff] hover:underline block" href={url} onClick={(e) => { e.preventDefault(); openLink(url); }} rel="noreferrer" target="_blank">{title}</a>}
        {description && <p className="text-xs text-gray-300 mt-1 line-clamp-3">{description}</p>}
        {imgSrc && <img alt="Embed preview" className="mt-2 max-h-40 w-full rounded object-cover" src={imgSrc} loading="lazy" />}
      </div>
    );
  }
  return null;
});

// ─── State helpers ────────────────────────────────────────────────────────────
const clearFields = (base, clear = []) => { if (!clear?.length) return base; const n = { ...base }; clear.forEach((f) => { const k = f?.[0]?.toLowerCase() + f?.slice(1); if (k) delete n[k]; }); return n; };
const uniq = (list) => { const s = new Set(); return list.filter((m) => { if (!m?._id || s.has(m._id)) return false; s.add(m._id); return true; }); };

// ─── Member list helpers ──────────────────────────────────────────────────────
const sortRoles  = (rm) => !rm ? [] : Object.entries(rm).map(([id, r]) => ({ id, ...r })).sort((a, b) => (b.rank || 0) - (a.rank || 0));
const highRole   = (m, sr) => { if (!m.roles?.length) return null; for (const r of sr) if (m.roles.includes(r.id)) return r; return null; };
const hoistRole  = (m, sr) => { if (!m.roles?.length) return null; for (const r of sr) if (m.roles.includes(r.id) && r.hoist) return r; return null; };

const organizeMembers = (mems, rolesMap, users) => {
  const sr = sortRoles(rolesMap);
  const gs = {};
  sr.filter((r) => r.hoist).forEach((r) => { gs[r.id] = { id: r.id, name: r.name, color: r.colour, rank: r.rank, members: [] }; });
  gs['Online']  = { id: 'Online',  name: 'Online',  color: null, rank: -1,  members: [] };
  gs['Offline'] = { id: 'Offline', name: 'Offline', color: null, rank: -2, members: [] };
  mems.forEach((m) => {
    const u = users[m._id.user]; if (!u) return;
    const hr = hoistRole(m, sr), xr = highRole(m, sr);
    const off = !u.status || u.status.presence === 'Invisible' || u.status.presence === 'Offline';
    const em = { ...m, user: u, color: xr?.colour || null };
    if (hr && !off) { if (!gs[hr.id]) gs[hr.id] = { id: hr.id, name: hr.name, color: hr.colour, rank: hr.rank, members: [] }; gs[hr.id].members.push(em); }
    else gs[off ? 'Offline' : 'Online'].members.push(em);
  });
  const flat = [];
  Object.values(gs).filter((g) => g.members.length).sort((a, b) => b.rank - a.rank).forEach((g) => {
    flat.push({ type: 'header', key: `h-${g.id}`, name: g.name, count: g.members.length });
    [...g.members].sort((a, b) => (a.nickname || a.user?.username || '').localeCompare(b.nickname || b.user?.username || '')).forEach((m) => flat.push({ type: 'member', key: m._id.user, data: m }));
  });
  return flat;
};

// ─── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const MAP = { ready: ['Connected', '#3ba55d', false], authenticated: ['Auth…', '#f0b232', true], connecting: ['Connecting…', '#f0b232', true], disconnected: ['Disconnected', '#ed4245', false], error: ['Error', '#ed4245', false] };
  const k = status.startsWith('error:') ? 'error' : status;
  const [label, color, pulse] = MAP[k] || [status, '#888', false];
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-gray-400 select-none">
      <span className={`h-1.5 w-1.5 rounded-full ${pulse ? 'animate-pulse' : ''}`} style={{ background: color }} />
      {label}
    </span>
  );
};

// ─── Typing indicator ─────────────────────────────────────────────────────────
const TypingIndicator = ({ userIds, users }) => {
  const names = useMemo(() => userIds.slice(0, 3).map((id) => users[id]?.username || 'Someone'), [userIds, users]);
  if (!names.length) return null;
  const label = names.length === 1 ? `${names[0]} is typing` : names.length === 2 ? `${names[0]} and ${names[1]} are typing` : `${names[0]}, ${names[1]} and ${names.length - 2} more are typing`;
  return (
    <div className="flex items-center gap-2 px-4 py-1 text-xs text-gray-400 select-none">
      <span className="flex items-center gap-0.5 h-4">{[0,1,2].map((i) => <span key={i} className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
      <span><strong className="text-gray-300">{label}</strong>…</span>
    </div>
  );
};

// ─── Reactions helpers ────────────────────────────────────────────────────────
const toReactions = (r) => !r || typeof r !== 'object' ? [] : Object.entries(r).map(([e, ids]) => ({ emoji: e, ids: Array.isArray(ids) ? ids : [] })).filter((x) => x.ids.length);
const replyId = (m) => { const r = Array.isArray(m?.replies) ? m.replies[0] : null; return typeof r === 'string' ? r : r?.id || r?._id || null; };

// ─── Message ──────────────────────────────────────────────────────────────────
const Message = memo(({
  message, users, channels, me, onUser, cdn, onReact, onReply,
  replyTarget, jumpTo, regRef, ceById, reactOpts, openLink,
  onEdit, onDelete, replyMap,
}) => {
  // Masquerade support: bots can override display name/avatar/colour
  const masq    = message.masquerade;
  const authorId = typeof message.author === 'string' ? message.author : message.author?._id;
  const baseUser = users[authorId] || (typeof message.author === 'object' ? message.author : null) || { _id: authorId, username: 'Unknown' };
  const displayUser = masq
    ? { ...baseUser, username: masq.name || baseUser.username, avatar: masq.avatar ? { _id: masq.avatar } : baseUser.avatar }
    : baseUser;
  const displayColor = masq?.colour || message.author?.color || null;
  const mine = me === authorId;

  const rid = replyId(message);
  const replyMsg  = rid ? (replyMap[rid] || (message.replyMessage?._id === rid ? message.replyMessage : null)) : null;
  const replyAuthorId = replyMsg ? (typeof replyMsg.author === 'string' ? replyMsg.author : replyMsg.author?._id) : message.replyMessage?.authorId;
  const replyUser = replyAuthorId ? users[replyAuthorId] : message.replyMessage?.authorUser;

  const reactions = toReactions(message.reactions);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hovered, setHovered]       = useState(false);
  const [editing, setEditing]       = useState(false);
  const [editVal, setEditVal]       = useState('');
  const [emojiQ, setEmojiQ]         = useState('');
  const pickerRef = useRef(null);
  const editRef   = useRef(null);

  useEffect(() => {
    const el = editRef.current; if (!el || !editing) return;
    el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [editVal, editing]);

  useEffect(() => {
    if (!pickerOpen) { setEmojiQ(''); return; }
    const h = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [pickerOpen]);

  // Embedded link image detection
  const embeddedUrls = useMemo(() => extractUrls(message.content || ''), [message.content]);
  const [resolvedImgs, setResolved] = useState([]);
  useEffect(() => {
    if (!embeddedUrls.length) { setResolved([]); return; }
    let cancel = false;
    Promise.all(embeddedUrls.map(async (u) => {
      if (/^https?:\/\/media\.tenor\.com\//i.test(u)) {
        try { const r = await fetch(`https://tenor.com/oembed?url=${encodeURIComponent(u)}`); if (!r.ok) return { u, src: u }; const d = await r.json(); return { u, src: d?.url || d?.thumbnail_url || u }; }
        catch { return { u, src: u }; }
      }
      if (isImgUrl(u)) return { u, src: u };
      return null;
    })).then((r) => { if (!cancel) setResolved(r.filter(Boolean)); });
    return () => { cancel = true; };
  }, [embeddedUrls]);

  const filtered = useMemo(() => {
    if (!emojiQ) return null;
    const q = emojiQ.toLowerCase();
    return reactOpts.filter((o) => o.custom && o.label.toLowerCase().includes(q));
  }, [emojiQ, reactOpts]);

  const ts = message.createdAt ? smartTime(message.createdAt) : smartTime(message._id);

  // System message
  if (message.system) return (
    <div className="group px-4 py-1 text-xs text-gray-400 flex items-center gap-2 hover:bg-[#2e3035]" ref={(n) => regRef(message._id, n)}>
      <div className="h-px flex-1 bg-[#3f4249]" />
      <span>{renderSystem(message, users)}</span>
      <div className="h-px flex-1 bg-[#3f4249]" />
    </div>
  );

  return (
    <article
      className={`group relative flex gap-3 px-4 py-0.5 transition-colors duration-75 hover:bg-[#2e3035] ${replyTarget === message._id ? 'bg-[#3a3f66]/20' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      ref={(n) => regRef(message._id, n)}
    >
      <button className="mt-0.5 shrink-0" onClick={() => onUser(displayUser, authorId)} type="button">
        <Avatar user={displayUser} cdn={cdn} always={hovered} />
      </button>
      <div className="min-w-0 flex-1 py-1">
        {rid && (
          <button className="mb-1 flex max-w-full items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors" onClick={() => jumpTo(rid)} type="button">
            <Reply size={11} />
            <span className="truncate">{replyUser?.username || 'Unknown'}: {replyMsg?.content || 'Attachment/embed'}</span>
          </button>
        )}

        <div className="flex items-baseline gap-2">
          <button className="text-sm font-semibold hover:underline" onClick={() => onUser(displayUser, authorId)} style={{ color: displayColor || '#fff' }} type="button">{displayUser.username}</button>
          {masq && <span className="rounded bg-[#f0b232]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#f0b232]">BOT</span>}
          {mine && !masq && <span className="rounded bg-[#5865f2]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#bdc3ff]">YOU</span>}
          <time className="text-[11px] text-gray-500">{ts}</time>
          {message.edited && <span className="text-[10px] text-gray-500">(edited)</span>}
        </div>

        {editing ? (
          <div className="mt-1 rounded bg-[#383a40] p-2">
            <textarea ref={editRef} className="composer-textarea w-full bg-transparent text-gray-200 text-sm focus:outline-none mb-1 resize-none" rows={1} value={editVal} autoFocus
              onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (editVal.trim() !== message.content) onEdit(message._id, editVal); setEditing(false); } if (e.key === 'Escape') setEditing(false); }} />
            <div className="text-[11px] text-gray-400 flex gap-2"><span className="flex-1">esc cancel · enter save</span><button onClick={() => setEditing(false)} className="text-[#ed4245] hover:underline">cancel</button><button onClick={() => { if (editVal.trim() !== message.content) onEdit(message._id, editVal); setEditing(false); }} className="text-[#5865f2] hover:underline">save</button></div>
          </div>
        ) : message.content ? (
          <p className="whitespace-pre-wrap break-words text-sm text-gray-200">{renderContent(message.content, users, channels, onUser, ceById, cdn, openLink)}</p>
        ) : null}

        {/* API embeds */}
        {Array.isArray(message.embeds) && message.embeds.map((em, i) => <UrlEmbed key={i} embed={em} cdn={cdn} openLink={openLink} />)}

        {/* Inline image resolution from plain-text URLs */}
        {resolvedImgs.length > 0 && !message.embeds?.length && (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {resolvedImgs.map((img, i) => (
              <button key={i} className="block overflow-hidden rounded-lg border border-[#2f3237] hover:border-[#4a4d55] transition-colors" onClick={() => openLink(img.u)} type="button">
                <img alt="" className="max-h-64 max-w-full object-contain" src={img.src} loading="lazy" />
              </button>
            ))}
          </div>
        )}

        {/* Attachments */}
        {Array.isArray(message.attachments) && message.attachments.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {message.attachments.map((a, i) => {
              const { id, fn, url, img } = attachData(a, cdn, i); if (!id || !url) return null;
              return img
                ? <a key={id} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded border border-[#3a3d42] hover:border-[#5c606a] transition-colors"><img alt={fn} className="max-h-64 max-w-full object-contain" src={url} /></a>
                : <a key={id} href={url} target="_blank" rel="noreferrer" className="rounded bg-[#232428] px-2 py-1 text-xs text-[#bdc3ff] hover:bg-[#2f3136] flex items-center gap-1">📎 {fn}</a>;
            })}
          </div>
        )}

        {/* Reactions */}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {reactions.map(({ emoji, ids }) => {
            const reacted = ids.includes(me);
            const ce = resolveCE(emoji, ceById);
            return (
              <button key={emoji} className={`reaction-btn rounded-full border px-2 py-0.5 text-xs flex items-center gap-1 ${reacted ? 'border-[#5865f2] bg-[#5865f2]/20 text-[#d7ddff]' : 'border-[#4c4f56] bg-[#2b2d31] text-gray-200 hover:bg-[#35373c]'}`}
                onClick={() => onReact(message, emoji, reacted)} title={ce?.name || emoji} type="button">
                {renderEmojiVis(emoji, ce, cdn)} {ids.length}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hover action bar */}
      <div className={`absolute right-4 -top-3 z-10 transition-opacity duration-100 ${hovered || pickerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center bg-[#313338] border border-[#2f3237] rounded-md shadow-md">
          <button className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#404249] rounded-l-md" onClick={() => onReply(message)} title="Reply"><Reply size={14} /></button>
          <button className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#404249]" onClick={() => setPickerOpen((p) => !p)} title="React"><span className="text-sm leading-none">😊</span></button>
          {mine && <>
            <button className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#404249]" onClick={() => { setEditVal(message.content || ''); setEditing(true); setPickerOpen(false); }} title="Edit"><Edit2 size={14} /></button>
            <button className="p-1.5 text-red-400 hover:text-red-200 hover:bg-[#404249] rounded-r-md" onClick={() => onDelete(message._id)} title="Delete"><Trash2 size={14} /></button>
          </>}
        </div>
      </div>

      {/* Reaction picker */}
      {pickerOpen && (
        <div ref={pickerRef} className="absolute right-0 bottom-8 z-30 w-72 max-h-72 rounded-lg border border-[#4c4f56] bg-[#232428] shadow-2xl overflow-hidden flex flex-col">
          <div className="p-2 border-b border-[#2f3237] shrink-0">
            <input className="w-full rounded bg-[#1e1f22] px-2 py-1 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#5865f2]" placeholder="Search custom emojis…" value={emojiQ} onChange={(e) => setEmojiQ(e.target.value)} />
          </div>
          <div className="overflow-y-auto p-2">
            {emojiQ ? (
              filtered?.length ? (
                <div className="grid grid-cols-8 gap-1">{filtered.map((o) => <button key={o.value} className="grid h-8 place-items-center rounded hover:bg-[#3a3d42]" onClick={() => { onReact(message, o.value, message.reactions?.[o.value]?.includes(me)); setPickerOpen(false); }} title={o.title} type="button">{renderEmojiVis(o.value, o.custom, cdn)}</button>)}</div>
              ) : <p className="text-center py-4 text-xs text-gray-500">No match for "{emojiQ}"</p>
            ) : (
              <>
                <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 sticky top-0 bg-[#232428]">Standard</p>
                <div className="grid grid-cols-8 gap-1 mb-2">{STD_EMOJI.map((e) => <button key={e} className="grid h-8 place-items-center rounded hover:bg-[#3a3d42]" onClick={() => { onReact(message, e, message.reactions?.[e]?.includes(me)); setPickerOpen(false); }} type="button">{renderTwemoji(e, 'w-5 h-5')}</button>)}</div>
                {reactOpts.some((o) => o.custom) && <>
                  <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 sticky top-0 bg-[#232428]">Custom</p>
                  <div className="grid grid-cols-8 gap-1">{reactOpts.filter((o) => o.custom).map((o) => <button key={o.value} className="grid h-8 place-items-center rounded hover:bg-[#3a3d42]" onClick={() => { onReact(message, o.value, message.reactions?.[o.value]?.includes(me)); setPickerOpen(false); }} title={o.title} type="button">{renderEmojiVis(o.value, o.custom, cdn)}</button>)}</div>
                </>}
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
});

// ─── AppShell ─────────────────────────────────────────────────────────────────
function AppShell() {
  // ── Core state ──
  const [view,    setView]   = useState('loading');
  const [status,  setStatus] = useState('disconnected');
  const [config,  setConfig] = useState({ apiUrl: DEF_API, wsUrl: DEF_WS, cdnUrl: DEF_CDN });
  const [auth,    setAuth]   = useState({ token: null, userId: null });

  // ── Data ──
  const [servers,  setServers]  = useState({});
  const [channels, setChannels] = useState({});
  const [users,    setUsers]    = useState({});
  const [members,  setMembers]  = useState({});
  const [messages, setMessages] = useState({});

  // ── Navigation ──
  const [selServer,  setSelServer]  = useState('@me');
  const [selChannel, setSelChannel] = useState('friends');

  // ── UI state ──
  const [inputText,       setInputText]       = useState('');
  const [showAdvanced,    setShowAdvanced]     = useState(false);
  const [activeModal,     setActiveModal]     = useState(null);
  const [peekUser,        setPeekUser]        = useState(null);
  const [replyingTo,      setReplyingTo]      = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiSearch,     setEmojiSearch]     = useState('');
  const [pendingFiles,    setPendingFiles]    = useState([]);
  const [isUploading,     setIsUploading]     = useState(false);
  const [voiceNotice,     setVoiceNotice]     = useState('');
  const [showGoLatest,    setShowGoLatest]    = useState(false);
  const [isLoadingOlder,  setIsLoadingOlder]  = useState(false);
  const [linkPromptUrl,   setLinkPromptUrl]   = useState(null);
  const [isMembLoading,   setIsMembLoading]   = useState(false);
  const [showMobileSide,  setShowMobileSide]  = useState(false);
  const [isAccHovered,    setIsAccHovered]    = useState(false);
  const [pinnedMessages,  setPinnedMessages]  = useState([]);
  const [collapsedCats,   setCollapsedCats]   = useState({});

  // ── Typing ──
  const [typingInChannel, setTypingInChannel] = useState({}); // channelId → Set<userId>

  // ── Unread ──
  const [unreadChannels,  setUnreadChannels]  = useState(new Set()); // Set<channelId>

  // ── Status modal ──
  const [statusDraft, setStatusDraft] = useState({ presence: 'Online', text: '' });
  const [savingStatus, setSavingStatus] = useState(false);

  // ── Server settings modal ──
  const [editServerName,    setEditServerName]    = useState('');
  const [isUpdatingServer,  setIsUpdatingServer]  = useState(false);

  // ── Create server modal ──
  const [createServerName, setCreateServerName] = useState('');

  // ── Invite modal ──
  const [inviteCode,     setInviteCode]     = useState('');
  const [inviteCreated,  setInviteCreated]  = useState('');
  const [inviteError,    setInviteError]    = useState('');
  const [joinLoading,    setJoinLoading]    = useState(false);
  const [copiedInvite,   setCopiedInvite]   = useState(false);

  // ── Login ──
  const [loginMode,     setLoginMode]     = useState('credentials');
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [mfaCode,       setMfaCode]       = useState('');
  const [manualToken,   setManualToken]   = useState('');
  const [loginError,    setLoginError]    = useState('');
  const [isLoggingIn,   setIsLoggingIn]   = useState(false);
  const [privacyConsent,setPrivacyConsent]= useState(false);
  const [wsReconnect,   setWsReconnect]   = useState(0);

  // ── Refs ──
  const wsRef              = useRef(null);
  const botRef             = useRef(null);   // messages bottom
  const scrollRef          = useRef(null);   // messages container
  const subRef             = useRef({});
  const preloadChRef       = useRef({});
  const preloadMembRef     = useRef({});
  const pendingUsersRef    = useRef(new Set());
  const membLoadIdRef      = useRef(0);
  const canFetchUsersRef   = useRef(true);
  const loggedFetchErrRef  = useRef(false);
  const wsReconTimRef      = useRef(null);
  const msgRefs            = useRef({});
  const replyCacheRef      = useRef({});
  const fileInputRef       = useRef(null);
  const autoFollowRef      = useRef(true);
  const isPgScrollRef      = useRef(false);
  const pickerRef          = useRef(null);
  const composerRef        = useRef(null);
  const applyEventRef      = useRef(null);
  const isLoadOlderRef     = useRef(false);
  const typingTimersRef    = useRef({});       // channelId:userId → timeout
  const sendTypingTimRef   = useRef(null);
  const lastTypingRef      = useRef(0);
  const curMsgsRef         = useRef([]);
  const fetchMsgsRef       = useRef(null);
  const selChannelRef      = useRef(selChannel);
  selChannelRef.current = selChannel;

  // ── Composer resize ──
  useEffect(() => {
    const el = composerRef.current; if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [inputText]);

  // ── Emoji picker outside-click ──
  useEffect(() => {
    if (!showEmojiPicker) { setEmojiSearch(''); return; }
    const h = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowEmojiPicker(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [showEmojiPicker]);

  // ── Helpers ──
  const sameOrigin = useMemo(() => { try { return new URL(config.apiUrl).origin === window.location.origin; } catch { return false; } }, [config.apiUrl]);

  const upsertUsers = useCallback((list = []) => {
    if (!list.length) return;
    setUsers((p) => { const n = { ...p }; list.forEach((u) => { if (u?._id) n[u._id] = u; }); return n; });
  }, []);

  const upsertUsersFromMsgs = useCallback((msgs = []) => {
    const em = [];
    msgs.forEach((m) => {
      if (m?.author && typeof m.author === 'object' && m.author._id) em.push(m.author);
      if (m?.user?._id) em.push(m.user);
    });
    upsertUsers(em);
  }, [upsertUsers]);

  const renderMemberItem = useCallback((item) => {
    if (item.type === 'header') return (
      <div className="flex items-center px-4 text-xs font-bold uppercase tracking-wide text-gray-400 h-full">
        {item.name} — {item.count}
      </div>
    );
    const m = item.data;
    const mu = m.user || { _id: m?._id?.user, username: 'Loading…' };
    return (
      <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-[#35373c] h-full" onClick={() => setPeekUser({ ...mu, _id: mu._id || m._id.user })}>
        <Avatar user={mu} cdn={config.cdnUrl} size="sm" hover />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium" style={{ color: m.color || '#f2f3f5' }}>{m.nickname || mu.username}</div>
          {mu._loading
            ? <div className="mt-0.5 h-1.5 w-16 rounded-full bg-[#242A35] overflow-hidden"><div className="h-full w-1/2 animate-pulse rounded-full bg-[#8AB4F8]" /></div>
            : <div className="flex items-center gap-1 text-[11px] text-gray-500"><span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${mu.status?.presence === 'Online' ? 'bg-[#3ba55d]' : mu.status?.presence === 'Busy' ? 'bg-[#ed4245]' : mu.status?.presence === 'Idle' ? 'bg-[#f0b232]' : 'bg-gray-500'}`} />{mu.status?.text || mu.status?.presence || 'Offline'}</div>
          }
        </div>
      </button>
    );
  }, [config.cdnUrl]);

  // ── Fetch helpers ──
  const fetchMembers = useCallback(async (serverId) => {
    if (serverId === '@me') return;
    const lid = Date.now(); membLoadIdRef.current = lid; setIsMembLoading(true);
    try {
      const res = await fetch(`${config.apiUrl}/servers/${serverId}/members`, { headers: { 'x-session-token': auth.token } });
      if (!res.ok) return;
      const data = await res.json();
      upsertUsers(data.users || []);
      const pm = data.members || [];
      for (let i = 0; i < pm.length; i += MEMBER_CHUNK) {
        if (membLoadIdRef.current !== lid) break;
        const chunk = pm.slice(i, i + MEMBER_CHUNK);
        setMembers((p) => { const n = { ...p }; chunk.forEach((m) => { n[`${m._id.server}:${m._id.user}`] = m; }); return n; });
        if (i + MEMBER_CHUNK < pm.length) await new Promise((r) => setTimeout(r, 0));
      }
    } catch {} finally { if (membLoadIdRef.current === lid) setIsMembLoading(false); }
  }, [auth.token, config.apiUrl, upsertUsers]);

  const fetchMissingUsers = useCallback(async (msgs = []) => {
    if (!canFetchUsersRef.current || !sameOrigin) return;
    const need = new Set();
    msgs.forEach((m) => {
      const aid = typeof m?.author === 'string' ? m.author : m?.author?._id;
      if (aid && aid !== '00000000000000000000000000' && !users[aid] && !pendingUsersRef.current.has(aid)) need.add(aid);
    });
    if (!need.size) return;
    const ids = [...need].slice(0, 8);
    ids.forEach((id) => pendingUsersRef.current.add(id));
    await Promise.all(ids.map(async (uid) => {
      try {
        const r = await fetch(`${config.apiUrl}/users/${uid}`, { headers: { 'x-session-token': auth.token } });
        if (!r.ok) { if ([401,403,405].includes(r.status)) canFetchUsersRef.current = false; return; }
        const d = await r.json(); if (d?._id) upsertUsers([d]);
      } catch (err) {
        const msg = err?.message || '';
        if (msg.includes('Failed to fetch') || msg.includes('CORS')) canFetchUsersRef.current = false;
        if (!loggedFetchErrRef.current) { loggedFetchErrRef.current = true; console.warn('Background user fetch disabled.'); }
      } finally { pendingUsersRef.current.delete(uid); }
    }));
  }, [auth.token, config.apiUrl, sameOrigin, upsertUsers, users]);

  const fetchReplyMsg = useCallback(async (channelId, rid) => {
    if (!channelId || !rid || replyCacheRef.current[rid]) return;
    try {
      const r = await fetch(`${config.apiUrl}/channels/${channelId}/messages/${rid}`, { headers: { 'x-session-token': auth.token } });
      if (!r.ok) return; const d = await r.json(); if (!d?._id) return;
      replyCacheRef.current[rid] = d;
      upsertUsersFromMsgs([d]);
      setMessages((p) => ({ ...p, [channelId]: [...(p[channelId] || [])] }));
    } catch {}
  }, [auth.token, config.apiUrl, upsertUsersFromMsgs]);

  const fetchMessages = useCallback(async (chId, beforeId = null) => {
    if (!chId || chId === 'friends') return;
    try {
      const url = `${config.apiUrl}/channels/${chId}/messages?limit=100${beforeId ? `&before=${beforeId}` : ''}`;
      const r = await fetch(url, { headers: { 'x-session-token': auth.token } });
      if (!r.ok) return;
      const data = await r.json();
      const msgs  = Array.isArray(data) ? data : data.messages || [];
      const usrs  = Array.isArray(data) ? [] : data.users || [];
      if (usrs.length) upsertUsers(usrs);
      upsertUsersFromMsgs(msgs);
      const ordered = msgs.reverse();
      setMessages((p) => ({
        ...p,
        [chId]: beforeId ? uniq([...ordered, ...(p[chId] || [])]) : uniq(ordered),
      }));
      void fetchMissingUsers(ordered);
      if (!beforeId) preloadChRef.current[chId] = true;
    } catch {}
  }, [auth.token, config.apiUrl, upsertUsers, upsertUsersFromMsgs, fetchMissingUsers]);
  fetchMsgsRef.current = fetchMessages;

  // ── ACK a channel as read ──
  const ackChannel = useCallback(async (chId, msgId) => {
    if (!chId || !msgId || !auth.token) return;
    setUnreadChannels((p) => { const n = new Set(p); n.delete(chId); return n; });
    try { await fetch(`${config.apiUrl}/channels/${chId}/ack/${msgId}`, { method: 'PUT', headers: { 'x-session-token': auth.token } }); } catch {}
  }, [auth.token, config.apiUrl]);

  // ── Fetch pinned messages ──
  const fetchPins = useCallback(async (chId) => {
    if (!chId || chId === 'friends' || !auth.token) return;
    try {
      const r = await fetch(`${config.apiUrl}/channels/${chId}/pins`, { headers: { 'x-session-token': auth.token } });
      if (!r.ok) return;
      const data = await r.json();
      const msgs = Array.isArray(data) ? data : data.messages || [];
      upsertUsersFromMsgs(msgs);
      setPinnedMessages(msgs);
    } catch {}
  }, [auth.token, config.apiUrl, upsertUsersFromMsgs]);

  // ── Derived state ──
  const serverList   = useMemo(() => Object.values(servers), [servers]);
  const dmChannels   = useMemo(() => Object.values(channels).filter((c) => c?.channel_type === 'DirectMessage' || c?.channel_type === 'Group' || c?.channel_type === 'SavedMessages'), [channels]);
  const curMsgs      = useMemo(() => uniq(messages[selChannel] || []), [messages, selChannel]);
  const curMsgMap    = useMemo(() => Object.fromEntries(curMsgs.map((m) => [m._id, m])), [curMsgs]);
  const replyMsgMap  = useMemo(() => ({ ...curMsgMap, ...replyCacheRef.current }), [curMsgMap]);
  const activeReply  = useMemo(() => replyingTo ? curMsgMap[replyingTo._id] || replyingTo : null, [replyingTo, curMsgMap]);
  curMsgsRef.current = curMsgs;

  const curChName = useMemo(() => {
    if (selChannel === 'friends') return 'Direct';
    const ch = channels[selChannel];
    if (ch?.name) return ch.name;
    if (ch?.channel_type === 'DirectMessage') {
      const rid = (ch.recipients || []).find((id) => id !== auth.userId);
      return users[rid]?.username || 'DM';
    }
    return 'channel';
  }, [selChannel, channels, auth.userId, users]);

  const curChTopic = useMemo(() => channels[selChannel]?.description || channels[selChannel]?.topic || null, [channels, selChannel]);

  const allMembers = useMemo(() => selServer === '@me' ? [] : Object.values(members).filter((m) => m._id.server === selServer), [members, selServer]);
  const selServerObj = servers[selServer];
  const isOwner = selServerObj?.owner === auth.userId;

  const memberListItems = useMemo(() =>
    selServer === '@me' || !selServerObj ? [] : organizeMembers(allMembers, selServerObj.roles || {}, users),
    [allMembers, selServerObj, users, selServer]
  );

  // Friends: users with relationship Friend (1)
  const friends = useMemo(() => Object.values(users).filter((u) => u.relationship === 'Friend' || u.relationship === 1), [users]);

  // ── Custom emoji ──
  const allCE = useMemo(() => {
    const all = [];
    Object.values(servers).forEach((s) => {
      const src = s.emojis || s.emoji || [];
      const entries = Array.isArray(src) ? src : Object.entries(src).map(([id, v]) => ({ id, ...v }));
      entries.forEach((e) => { if (e.id || e._id) all.push({ id: e.id || e._id, name: e.name, serverName: s.name, isPrivate: s.discoverable === false }); });
    });
    return all;
  }, [servers]);

  const ceById = useMemo(() => {
    const m = {};
    Object.values(servers).forEach((s) => {
      const src = s?.emojis || s?.emoji || [];
      const entries = Array.isArray(src) ? src.map((e) => ({ id: e?._id || e?.id, name: e?.name })) : Object.entries(src || {}).map(([id, e]) => ({ id, name: e?.name }));
      entries.forEach((e) => { if (e?.id) m[e.id] = { id: e.id, name: e.name || e.id, serverName: s?.name }; });
    });
    return m;
  }, [servers]);

  const reactOpts = useMemo(() => [
    ...STD_EMOJI.map((e) => ({ value: e, label: e, title: e, custom: null })),
    ...allCE.map((e) => ({ value: `:${e.id}:`, label: e.name, title: `${e.name} · ${e.serverName}`, custom: { id: e.id, name: e.name } })),
  ], [allCE]);

  const filteredCE = useMemo(() => {
    if (!emojiSearch) return allCE;
    const q = emojiSearch.toLowerCase();
    return allCE.filter((e) => e.name.toLowerCase().includes(q));
  }, [allCE, emojiSearch]);

  // ── Typing users in current channel ──
  const curTypingIds = useMemo(() => {
    const s = typingInChannel[selChannel];
    return s ? [...s].filter((id) => id !== auth.userId) : [];
  }, [typingInChannel, selChannel, auth.userId]);

  // ── Peek user state ──
  const peekMember   = useMemo(() => !peekUser?._id || selServer === '@me' ? null : members[`${selServer}:${peekUser._id}`], [members, peekUser, selServer]);
  const peekRoles    = useMemo(() => !peekMember || !selServerObj?.roles ? [] : (peekMember.roles || []).map((id) => selServerObj.roles?.[id]).filter(Boolean), [peekMember, selServerObj]);
  const peekBadges   = useMemo(() => {
    if (!peekUser?.badges) return [];
    if (Array.isArray(peekUser.badges)) return peekUser.badges;
    if (typeof peekUser.badges === 'number') {
      const F = { 1: 'Developer', 2: 'Translator', 4: 'Supporter', 8: 'Founder', 16: 'Platform Moderation', 32: 'Active Supporter', 64: 'Paw' };
      return Object.entries(F).filter(([b]) => (peekUser.badges & Number(b)) === Number(b)).map(([, l]) => l);
    }
    if (typeof peekUser.badges === 'object') return Object.entries(peekUser.badges).filter(([, v]) => Boolean(v)).map(([k]) => k);
    return [];
  }, [peekUser]);
  const peekBio      = peekUser?.profile?.content || peekUser?.profile?.bio || peekUser?.bio || null;
  const peekJoined   = joinedAt(peekUser);
  const peekSrvJoined = joinedAt(peekMember);
  const peekBanner   = bannerUrl(peekUser, config.cdnUrl);

  // ── Category-grouped channel list ──
  const categorisedChannels = useMemo(() => {
    if (selServer === '@me') return [];
    const serverChannels = Object.values(channels).filter((c) => c.server === selServer);
    const cats = selServerObj?.categories || [];

    // Build a set of all categorised channel IDs
    const cated = new Set(cats.flatMap((cat) => cat.channels || []));

    // Channels not in any category
    const uncategorised = serverChannels.filter((c) => !cated.has(c._id));

    const result = [];

    // Uncategorised first (like Discord)
    uncategorised.forEach((c) => result.push({ type: 'channel', channel: c }));

    // Then each category
    cats.forEach((cat) => {
      if (!cat.channels?.length) return;
      const catChannels = cat.channels.map((id) => channels[id]).filter(Boolean);
      if (!catChannels.length) return;
      result.push({ type: 'category', id: cat.id, title: cat.title, channels: catChannels });
      if (!collapsedCats[cat.id]) {
        catChannels.forEach((c) => result.push({ type: 'channel', channel: c }));
      }
    });

    return result;
  }, [selServer, channels, selServerObj, collapsedCats]);

  // ── Config discovery ──
  const discoverConfig = async (apiUrl) => {
    try {
      const r = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
      if (!r.ok) return;
      const d = await r.json();
      setConfig((p) => ({ ...p, apiUrl, wsUrl: d.ws || p.wsUrl, cdnUrl: d.features?.autumn?.url || p.cdnUrl }));
    } catch {}
  };

  // ── Restore session ──
  useEffect(() => {
    const tk = getCookie(TK) || localStorage.getItem('stoat_token');
    const uk = getCookie(UK) || localStorage.getItem('stoat_user_id');
    const ak = getCookie(AK) || localStorage.getItem('stoat_api_url');
    const api = ak || DEF_API;
    setConfig((p) => ({ ...p, apiUrl: api }));
    discoverConfig(api);
    if (tk && uk) { setAuth({ token: tk, userId: uk }); setView('app'); }
    else setView('login');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Typing: send begin/end ──
  const sendTypingBegin = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !selChannel || selChannel === 'friends') return;
    const now = Date.now();
    if (now - lastTypingRef.current < 2500) return;
    lastTypingRef.current = now;
    ws.send(JSON.stringify({ type: 'BeginTyping', channel: selChannel }));
  }, [selChannel]);

  const sendTypingEnd = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !selChannel) return;
    ws.send(JSON.stringify({ type: 'EndTyping', channel: selChannel }));
    lastTypingRef.current = 0;
  }, [selChannel]);

  // ── WS event handler (uses ref to avoid stale closures) ──
  const applyEvent = (packet) => {
    if (!packet?.type) return;
    switch (packet.type) {
      case 'Ready':
        setUsers((p) => { const n = { ...p }; packet.users?.forEach((u) => { n[u._id] = u; }); return n; });
        setServers((p) => { const n = { ...p }; packet.servers?.forEach((s) => { n[s._id] = s; }); return n; });
        setChannels((p) => { const n = { ...p }; packet.channels?.forEach((c) => { n[c._id] = c; }); return n; });
        setMembers((p) => { const n = { ...p }; packet.members?.forEach((m) => { n[`${m._id.server}:${m._id.user}`] = m; }); return n; });
        // Seed initial unread from channel last_message_id (simple heuristic)
        setStatus('ready');
        break;
      case 'Bulk': packet.v?.forEach((e) => applyEventRef.current?.(e)); break;
      case 'Authenticated': setStatus('authenticated'); break;
      case 'Error': setStatus(`error:${packet.error || 'unknown'}`); break;
      case 'Logout': logout(); break;
      // Messages
      case 'Message':
        upsertUsersFromMsgs([packet]);
        void fetchMissingUsers([packet]);
        setMessages((p) => {
          const list = p[packet.channel] || [];
          if (list.some((m) => m._id === packet._id)) return p;
          return { ...p, [packet.channel]: uniq([...list, packet].slice(-200)) };
        });
        // Mark as unread if not currently viewing
        if (packet.channel !== selChannelRef.current || document.hidden) {
          setUnreadChannels((p) => { const n = new Set(p); n.add(packet.channel); return n; });
        }
        break;
      case 'MessageUpdate':
        setMessages((p) => ({ ...p, [packet.channel]: uniq((p[packet.channel] || []).map((m) => m._id === packet.id ? { ...m, ...packet.data, edited: new Date().toISOString() } : m)) }));
        break;
      case 'MessageDelete':
        setMessages((p) => ({ ...p, [packet.channel]: (p[packet.channel] || []).filter((m) => m._id !== packet.id) }));
        break;
      case 'MessageReact':
        setMessages((p) => ({
          ...p,
          [packet.channel_id]: uniq((p[packet.channel_id] || []).map((m) => {
            if (m._id !== packet.id) return m;
            const existing = m.reactions?.[packet.emoji_id] || [];
            return { ...m, reactions: { ...(m.reactions || {}), [packet.emoji_id]: [...new Set([...existing, packet.user_id])] } };
          })),
        }));
        break;
      case 'MessageUnreact':
        setMessages((p) => ({
          ...p,
          [packet.channel_id]: uniq((p[packet.channel_id] || []).map((m) => {
            if (m._id !== packet.id) return m;
            const existing = (m.reactions?.[packet.emoji_id] || []).filter((uid) => uid !== packet.user_id);
            const newRx = { ...(m.reactions || {}), [packet.emoji_id]: existing };
            if (!existing.length) delete newRx[packet.emoji_id];
            return { ...m, reactions: newRx };
          })),
        }));
        break;
      case 'MessageRemoveReaction':
        setMessages((p) => ({
          ...p,
          [packet.channel_id]: uniq((p[packet.channel_id] || []).map((m) => {
            if (m._id !== packet.id) return m;
            const newRx = { ...(m.reactions || {}) }; delete newRx[packet.emoji_id];
            return { ...m, reactions: newRx };
          })),
        }));
        break;
      // Channels
      case 'ChannelCreate': setChannels((p) => ({ ...p, [packet._id]: packet })); break;
      case 'ChannelUpdate': setChannels((p) => ({ ...p, [packet.id]: clearFields({ ...p[packet.id], ...packet.data }, packet.clear) })); break;
      case 'ChannelDelete':
        setChannels((p) => { const n = { ...p }; delete n[packet.id]; return n; });
        if (selChannelRef.current === packet.id) setSelChannel('friends');
        break;
      case 'ChannelAck':
        if (packet.user === auth.userId) setUnreadChannels((p) => { const n = new Set(p); n.delete(packet.id); return n; });
        break;
      // Typing
      case 'ChannelStartTyping':
        if (packet.user !== auth.userId) {
          setTypingInChannel((p) => { const s = new Set(p[packet.id] || []); s.add(packet.user); return { ...p, [packet.id]: s }; });
          // Auto-clear after 5 s if no stop event
          const timerKey = `${packet.id}:${packet.user}`;
          clearTimeout(typingTimersRef.current[timerKey]);
          typingTimersRef.current[timerKey] = setTimeout(() => {
            setTypingInChannel((prev) => { const s = new Set(prev[packet.id] || []); s.delete(packet.user); return { ...prev, [packet.id]: s }; });
          }, 5000);
        }
        break;
      case 'ChannelStopTyping':
        setTypingInChannel((p) => { const s = new Set(p[packet.id] || []); s.delete(packet.user); return { ...p, [packet.id]: s }; });
        clearTimeout(typingTimersRef.current[`${packet.id}:${packet.user}`]);
        break;
      // Servers
      case 'ServerCreate': setServers((p) => ({ ...p, [packet._id || packet.id]: packet })); break;
      case 'ServerUpdate': setServers((p) => ({ ...p, [packet.id]: clearFields({ ...p[packet.id], ...packet.data }, packet.clear) })); break;
      case 'ServerDelete':
        setServers((p) => { const n = { ...p }; delete n[packet.id]; return n; });
        if (selServer === packet.id) { setSelServer('@me'); setSelChannel('friends'); }
        break;
      case 'ServerMemberUpdate': {
        const k = `${packet.id.server}:${packet.id.user}`;
        setMembers((p) => ({ ...p, [k]: clearFields({ ...p[k], _id: packet.id, ...packet.data }, packet.clear) }));
        break;
      }
      case 'ServerMemberJoin': setMembers((p) => ({ ...p, [`${packet.id}:${packet.user}`]: { ...packet.member, _id: { server: packet.id, user: packet.user } } })); break;
      case 'ServerMemberLeave': setMembers((p) => { const n = { ...p }; delete n[`${packet.id}:${packet.user}`]; return n; }); break;
      case 'UserUpdate': setUsers((p) => ({ ...p, [packet.id]: clearFields({ ...p[packet.id], ...packet.data }, packet.clear) })); break;
      case 'UserRelationship': setUsers((p) => ({ ...p, [packet.user._id]: packet.user })); break;
      default: break;
    }
  };
  applyEventRef.current = applyEvent;

  // ── WebSocket ──
  useEffect(() => {
    if (!auth.token || view !== 'app') return;
    let wsUrl = config.wsUrl;
    try { const u = new URL(wsUrl.startsWith('ws') ? wsUrl : `wss://${wsUrl}`); u.searchParams.set('version', '1'); u.searchParams.set('format', 'json'); u.searchParams.set('token', auth.token); wsUrl = u.toString(); }
    catch { wsUrl = `${DEF_WS}?version=1&format=json&token=${encodeURIComponent(auth.token)}`; }
    setStatus('connecting');
    if (wsRef.current) wsRef.current.close();
    if (wsReconTimRef.current) { clearTimeout(wsReconTimRef.current); wsReconTimRef.current = null; }
    let dead = false;
    const ws = new WebSocket(wsUrl); wsRef.current = ws;
    ws.onerror = () => setStatus('error');
    ws.onclose = () => {
      setStatus((p) => (p === 'error' ? p : 'disconnected'));
      if (dead || view !== 'app') return;
      wsReconTimRef.current = setTimeout(() => setWsReconnect((v) => v + 1), 2500);
    };
    ws.onmessage = (e) => applyEventRef.current?.(JSON.parse(e.data));
    const hb = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'Ping', data: Date.now() })); }, 20000);
    return () => { dead = true; clearInterval(hb); if (wsReconTimRef.current) { clearTimeout(wsReconTimRef.current); wsReconTimRef.current = null; } ws.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token, config.wsUrl, view, wsReconnect]);

  // ── Server subscription ──
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || selServer === '@me') return;
    const send = () => {
      if (document.visibilityState !== 'visible') return;
      const last = subRef.current[selServer] || 0; if (Date.now() - last < 10 * 60 * 1000) return;
      ws.send(JSON.stringify({ type: 'Subscribe', server_id: selServer }));
      subRef.current[selServer] = Date.now();
    };
    send();
    window.addEventListener('focus', send); document.addEventListener('visibilitychange', send);
    const iv = setInterval(send, 60000);
    return () => { clearInterval(iv); window.removeEventListener('focus', send); document.removeEventListener('visibilitychange', send); };
  }, [selServer, status]);

  // ── Scroll: auto-follow + load-older ──
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    autoFollowRef.current = true;
    const onScroll = () => {
      if (isPgScrollRef.current) return;
      const nearBot = el.scrollHeight - el.scrollTop - el.clientHeight <= 72;
      autoFollowRef.current = nearBot;
      setShowGoLatest(!nearBot);
      if (el.scrollTop < 150 && !isLoadOlderRef.current) {
        const msgs = curMsgsRef.current; const oldest = msgs[0];
        if (oldest && !oldest._id.startsWith('pending-') && msgs.length >= 50) {
          const prevH = el.scrollHeight, prevT = el.scrollTop;
          isLoadOlderRef.current = true; setIsLoadingOlder(true);
          fetchMsgsRef.current(selChannelRef.current, oldest._id).finally(() => {
            isLoadOlderRef.current = false; setIsLoadingOlder(false);
            requestAnimationFrame(() => { el.scrollTop = prevT + (el.scrollHeight - prevH); });
          });
        }
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [selChannel]);

  useEffect(() => {
    const el = scrollRef.current;
    if (autoFollowRef.current || (el && el.scrollHeight - el.scrollTop - el.clientHeight <= 72)) {
      isPgScrollRef.current = true;
      botRef.current?.scrollIntoView({ behavior: 'auto' });
      requestAnimationFrame(() => { isPgScrollRef.current = false; });
      autoFollowRef.current = true; setShowGoLatest(false);
    } else setShowGoLatest(true);
  }, [curMsgs]);

  // ── Fetch missing reply messages ──
  useEffect(() => {
    if (!selChannel || selChannel === 'friends') return;
    const missing = [...new Set(curMsgs.map(replyId).filter((id) => id && !replyCacheRef.current[id] && !curMsgMap[id]))].slice(0, 10);
    missing.forEach((id) => { void fetchReplyMsg(selChannel, id); });
  }, [curMsgs, curMsgMap, selChannel, fetchReplyMsg]);

  // ── Voice notice auto-clear ──
  useEffect(() => { if (!voiceNotice) return; const t = setTimeout(() => setVoiceNotice(''), 3500); return () => clearTimeout(t); }, [voiceNotice]);

  // ── Channel warm-up ──
  useEffect(() => {
    if (status !== 'ready' || !auth.token) return;
    const max = Math.min(8, Math.max(3, Math.floor((navigator.hardwareConcurrency || 4) / 2)));
    Object.values(channels).filter((c) => c?.channel_type === 'TextChannel' || !c?.channel_type).slice(0, max).forEach((c, i) => {
      if (!c?._id || preloadChRef.current[c._id]) return;
      setTimeout(() => fetchMessages(c._id), i * 350);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, auth.token]);

  // ── Navigation handlers ──
  const selectServer = (id) => {
    setSelServer(id); setShowMobileSide(false);
    if (id === '@me') { setSelChannel('friends'); setReplyingTo(null); setShowEmojiPicker(false); return; }
    const first = Object.values(channels).find((c) => c.server === id && c.channel_type !== 'VoiceChannel') || Object.values(channels).find((c) => c.server === id);
    setSelChannel(first?._id || null);
    if (first?._id) fetchMessages(first._id);
    if (!preloadMembRef.current[id]) { preloadMembRef.current[id] = true; void fetchMembers(id); }
  };

  const selectChannel = (chId) => {
    const ch = channels[chId];
    if (ch?.channel_type === 'VoiceChannel') { setVoiceNotice("Voice channels aren't supported yet."); return; }
    setVoiceNotice(''); setSelChannel(chId); setReplyingTo(null); setShowEmojiPicker(false); setShowMobileSide(false);
    fetchMessages(chId);
    sendTypingEnd();
    // ACK
    const msgs = messages[chId] || [];
    const last = msgs[msgs.length - 1];
    if (last?._id && !last._id.startsWith('pending-')) ackChannel(chId, last._id);
  };

  const openDm = async (userId) => {
    if (!userId || !auth.token) return;
    const existing = Object.values(channels).find((c) => c.channel_type === 'DirectMessage' && (c.recipients || []).includes(userId));
    if (existing?._id) { setSelServer('@me'); selectChannel(existing._id); return; }
    try {
      const r = await fetch(`${config.apiUrl}/users/${userId}/dm`, { method: 'GET', headers: { 'x-session-token': auth.token } });
      if (!r.ok) return;
      const ch = await r.json(); if (!ch?._id) return;
      setChannels((p) => ({ ...p, [ch._id]: ch }));
      setSelServer('@me'); setSelChannel(ch._id); fetchMessages(ch._id);
    } catch {}
  };

  const jumpTo = (msgId) => {
    if (!msgId) return;
    const el = msgRefs.current[msgId]; if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('msg-highlight');
    setTimeout(() => el.classList.remove('msg-highlight'), 1200);
  };
  const regRef = (id, node) => { if (!id) return; if (node) msgRefs.current[id] = node; else delete msgRefs.current[id]; };
  const goLatest = () => { isPgScrollRef.current = true; autoFollowRef.current = true; botRef.current?.scrollIntoView({ behavior: 'smooth' }); requestAnimationFrame(() => { isPgScrollRef.current = false; }); setShowGoLatest(false); };
  const openLink = (url) => setLinkPromptUrl(url);
  const confirmLink = () => { if (!linkPromptUrl) return; window.open(linkPromptUrl, '_blank', 'noopener,noreferrer'); setLinkPromptUrl(null); };

  // ── Status ──
  const openStatusEditor = () => {
    const u = users[auth.userId];
    setStatusDraft({ presence: u?.status?.presence || 'Online', text: u?.status?.text || '' });
    setActiveModal('set-status');
  };
  const saveStatus = async () => {
    setSavingStatus(true);
    setUsers((p) => ({ ...p, [auth.userId]: { ...p[auth.userId], status: { presence: statusDraft.presence, text: statusDraft.text || undefined } } }));
    try { await fetch(`${config.apiUrl}/users/@me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-session-token': auth.token }, body: JSON.stringify({ status: { presence: statusDraft.presence, text: statusDraft.text || undefined } }) }); }
    catch {} finally { setSavingStatus(false); setActiveModal(null); }
  };

  // ── Login ──
  const handleLogin = async (e) => {
    e.preventDefault(); setLoginError('');
    if (!privacyConsent) { setLoginError('Please accept the privacy policy.'); return; }
    setIsLoggingIn(true);
    try {
      await discoverConfig(config.apiUrl);
      let token = manualToken.trim(), userId = null;
      if (loginMode === 'credentials') {
        const payload = { email, password, friendly_name: 'Ermine Web Client' };
        if (mfaCode.trim()) payload.mfa_response = { totp_code: mfaCode.trim() };
        const r = await fetch(`${config.apiUrl}/auth/session/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!r.ok) throw new Error(r.status === 401 ? 'Invalid credentials or MFA code.' : 'Login failed.');
        const d = await r.json(); token = d.token || d.session_token; userId = d.user_id;
      } else {
        const r = await fetch(`${config.apiUrl}/users/@me`, { headers: { 'x-session-token': token } });
        if (!r.ok) throw new Error('Invalid token.');
        const d = await r.json(); userId = d._id;
      }
      if (!token || !userId) throw new Error('Session creation failed.');
      setCookie(TK, token); setCookie(UK, userId); setCookie(AK, config.apiUrl);
      setAuth({ token, userId }); setView('app');
    } catch (err) { setLoginError(err.message || 'Unknown error'); }
    finally { setIsLoggingIn(false); }
  };

  const logout = () => {
    [TK,UK,AK].forEach(clearCookie);
    ['stoat_token','stoat_user_id','stoat_api_url'].forEach((k) => localStorage.removeItem(k));
    setAuth({ token: null, userId: null });
    setMessages({}); setServers({}); setChannels({}); setUsers({}); setMembers({});
    preloadChRef.current = {}; preloadMembRef.current = {}; pendingUsersRef.current = new Set();
    membLoadIdRef.current = 0; canFetchUsersRef.current = true; loggedFetchErrRef.current = false;
    setIsMembLoading(false); setWsReconnect(0); setUnreadChannels(new Set()); setTypingInChannel({});
    if (wsReconTimRef.current) { clearTimeout(wsReconTimRef.current); wsReconTimRef.current = null; }
    setView('login'); setStatus('disconnected');
  };

  // ── Messaging ──
  const sendMessage = async () => {
    const content = inputText.trim(); const hasFiles = pendingFiles.length > 0;
    if ((!content && !hasFiles) || !selChannel || selChannel === 'friends') return;
    setInputText(''); setIsUploading(hasFiles); sendTypingEnd();
    const nonce = crypto.randomUUID(); const pid = `pending-${nonce}`;
    const me = users[auth.userId] || { _id: auth.userId, username: 'You' };
    const opt = { _id: pid, channel: selChannel, author: auth.userId, user: me, content, createdAt: new Date().toISOString(), reactions: {}, replies: replyingTo ? [{ id: replyingTo._id, mention: false }] : undefined, attachments: pendingFiles.map((f, i) => ({ _id: `pa-${i}-${f.name}`, filename: f.name })) };
    setMessages((p) => { const l = p[selChannel] || []; return { ...p, [selChannel]: uniq([...l, opt]).slice(-200) }; });
    try {
      const aids = hasFiles ? await uploadFiles(pendingFiles) : [];
      const payload = { content, nonce, replies: replyingTo ? [{ id: replyingTo._id, mention: false }] : undefined, attachments: aids.length ? aids : undefined };
      const r = await fetch(`${config.apiUrl}/channels/${selChannel}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session-token': auth.token }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('Send failed');
      const posted = await r.json();
      if (posted?._id) {
        upsertUsersFromMsgs([posted]);
        setMessages((p) => {
          const l = (p[selChannel] || []).filter((m) => m._id !== pid);
          const dd = l.some((m) => m._id === posted._id) ? l.map((m) => m._id === posted._id ? posted : m) : [...l, posted];
          return { ...p, [selChannel]: uniq(dd.sort((a, b) => a._id > b._id ? 1 : -1)) };
        });
      }
      setPendingFiles([]); setReplyingTo(null); setShowEmojiPicker(false);
    } catch {
      setMessages((p) => ({ ...p, [selChannel]: (p[selChannel] || []).filter((m) => m._id !== pid) }));
      setInputText(content);
    } finally { setIsUploading(false); }
  };

  const editMessage = async (msgId, content) => {
    try { await fetch(`${config.apiUrl}/channels/${selChannel}/messages/${msgId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-session-token': auth.token }, body: JSON.stringify({ content }) }); }
    catch (err) { console.error(err); }
  };

  const deleteMessage = async (msgId) => {
    if (!confirm('Delete this message?')) return;
    try { await fetch(`${config.apiUrl}/channels/${selChannel}/messages/${msgId}`, { method: 'DELETE', headers: { 'x-session-token': auth.token } }); }
    catch (err) { console.error(err); }
  };

  const toggleReaction = async (msg, emoji, reacted) => {
    if (!msg?._id || !selChannel || selChannel === 'friends') return;
    const enc = encodeURIComponent(emoji);
    setMessages((p) => ({
      ...p,
      [selChannel]: (p[selChannel] || []).map((m) => {
        if (m._id !== msg._id) return m;
        const ex = m.reactions?.[emoji] || [];
        const nxt = reacted ? ex.filter((id) => id !== auth.userId) : [...new Set([...ex, auth.userId])];
        return { ...m, reactions: { ...(m.reactions || {}), [emoji]: nxt } };
      }),
    }));
    try { await fetch(`${config.apiUrl}/channels/${selChannel}/messages/${msg._id}/reactions/${enc}`, { method: reacted ? 'DELETE' : 'PUT', headers: { 'x-session-token': auth.token } }); }
    catch {}
  };

  const uploadFiles = async (files = []) => {
    const ids = [];
    for (const f of files) {
      const body = new FormData(); body.append('file', f);
      const r = await fetch(`${config.cdnUrl}/attachments`, { method: 'POST', body, headers: { 'X-Session-Token': auth.token } });
      if (!r.ok) throw new Error('Upload failed');
      const d = await r.json(); if (d?.id) ids.push(d.id);
    }
    return ids;
  };

  // ── Invite ──
  const createInvite = async () => {
    setInviteCreated(''); setInviteError('');
    try {
      const r = await fetch(`${config.apiUrl}/channels/${selChannel}/invites`, { method: 'POST', headers: { 'x-session-token': auth.token } });
      if (!r.ok) throw new Error('Failed to create invite');
      const d = await r.json(); setInviteCreated(d._id || d.code || d.id || '');
    } catch (err) { setInviteError(err.message); }
  };

  const joinByInvite = async () => {
    if (!inviteCode.trim()) return; setJoinLoading(true); setInviteError('');
    try {
      const r = await fetch(`${config.apiUrl}/invites/${inviteCode.trim()}`, { method: 'POST', headers: { 'x-session-token': auth.token } });
      if (!r.ok) throw new Error('Invalid or expired invite code');
      setActiveModal(null); setInviteCode('');
    } catch (err) { setInviteError(err.message); }
    finally { setJoinLoading(false); }
  };

  // ── Server CRUD ──
  const createServer = async () => {
    if (!createServerName.trim()) return;
    try { const r = await fetch(`${config.apiUrl}/servers/create`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session-token': auth.token }, body: JSON.stringify({ name: createServerName.trim() }) }); if (r.ok) { setCreateServerName(''); setActiveModal(null); } }
    catch {}
  };
  const updateServer = async () => {
    if (!selServer || selServer === '@me' || !editServerName.trim()) return;
    setIsUpdatingServer(true);
    try { const r = await fetch(`${config.apiUrl}/servers/${selServer}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-session-token': auth.token }, body: JSON.stringify({ name: editServerName.trim() }) }); if (r.ok) setActiveModal(null); }
    catch {} finally { setIsUpdatingServer(false); }
  };
  const deleteServer = async () => {
    if (!selServer || selServer === '@me') return;
    if (!confirm(`Delete "${selServerObj?.name}"? This cannot be undone.`)) return;
    setIsUpdatingServer(true);
    try { await fetch(`${config.apiUrl}/servers/${selServer}`, { method: 'DELETE', headers: { 'x-session-token': auth.token } }); setActiveModal(null); }
    catch {} finally { setIsUpdatingServer(false); }
  };

  // ── Friend requests ──
  const sendFriendRequest = async (username) => {
    if (!username?.trim()) return;
    try { const r = await fetch(`${config.apiUrl}/users/${username}/friend`, { method: 'PUT', headers: { 'x-session-token': auth.token } }); if (!r.ok) throw new Error('Failed'); const d = await r.json(); if (d?._id) upsertUsers([d]); }
    catch (err) { alert(err.message); }
  };
  const removeFriend = async (userId) => {
    try { const r = await fetch(`${config.apiUrl}/users/${userId}/friend`, { method: 'DELETE', headers: { 'x-session-token': auth.token } }); if (!r.ok) throw new Error('Failed'); const d = await r.json(); if (d?._id) upsertUsers([d]); }
    catch {}
  };

  // ── Composer helpers ──
  const addEmoji = (e) => { setInputText((p) => `${p}${e}`); setShowEmojiPicker(false); };
  const addCE    = (id) => { setInputText((p) => `${p}:${id}:`); setShowEmojiPicker(false); };
  const onFilePick = (e) => { const f = Array.from(e.target.files || []); if (f.length) setPendingFiles((p) => [...p, ...f]); e.target.value = ''; };

  // ── Channel type icon ──
  const chIcon = (ch) => {
    if (!ch) return <Hash size={16} />;
    switch (ch.channel_type) {
      case 'DirectMessage': return <MessageSquare size={16} />;
      case 'VoiceChannel':  return <Users size={16} />;
      case 'SavedMessages': return <BookOpen size={16} />;
      case 'Group':         return <Users size={16} />;
      default:              return <Hash size={16} />;
    }
  };

  // ── DM label helper ──
  const dmLabel = (ch) => {
    if (ch.channel_type === 'SavedMessages') return 'Saved Notes';
    if (ch.channel_type === 'Group') return ch.name || 'Group';
    const rid = (ch.recipients || []).find((id) => id !== auth.userId);
    return users[rid]?.username || ch.name || 'DM';
  };

  // ── Loading / Login screens ──
  if (view === 'loading') return <div className="grid h-screen place-items-center bg-[#0F1115] text-[#8AB4F8]"><Loader className="animate-spin" size={36} /></div>;

  if (view === 'login') return (
    <div className="min-h-screen bg-[#0F1115] px-4 py-10 text-[#E6EDF3]">
      <div className="relative mx-auto max-w-md rounded-2xl border border-[#242A35] bg-[#171A21] p-8 shadow-2xl">
        <span className="absolute right-4 top-4 rounded-full border border-[#242A35] bg-[#141821] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#B6D8F6]">Experimental</span>
        <div className="mb-6 text-center">
          {/* Logo: uses public/assets — served by Vite correctly */}
          <div className="mx-auto mb-3 h-16 w-16 overflow-hidden rounded-2xl border border-[#242A35] bg-[#141821] flex items-center justify-center">
            <img alt="Ermine" className="h-full w-full object-cover" src="/assets/android-chrome-192x192.png"
              onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex'; }}
            />
            {/* Fallback inline SVG logo */}
            <svg style={{ display: 'none' }} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
              <path d="M12 10h24v6H18v6h12v6H18v6h18v6H12V10z" fill="#E6EDF3"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Ermine</h1>
          <p className="text-sm text-[#A6B0C3]">A refined client for stoat.chat.</p>
        </div>
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-[#141821] p-1 text-xs font-semibold uppercase tracking-wide">
          <button className={`rounded py-2 transition-colors ${loginMode === 'credentials' ? 'bg-[#8AB4F8] text-[#0F1115]' : 'text-gray-400 hover:text-white'}`} onClick={() => setLoginMode('credentials')} type="button">Credentials</button>
          <button className={`rounded py-2 transition-colors ${loginMode === 'token' ? 'bg-[#8AB4F8] text-[#0F1115]' : 'text-gray-400 hover:text-white'}`} onClick={() => setLoginMode('token')} type="button">Token</button>
        </div>
        <form className="space-y-4" onSubmit={handleLogin}>
          {loginMode === 'credentials' ? (
            <>
              <input className={inputBase} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" value={email} />
              <input className={inputBase} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" value={password} />
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
                <span className="mb-1 flex items-center gap-1"><ShieldCheck size={12} /> MFA (optional)</span>
                <input className={inputBase} onChange={(e) => setMfaCode(e.target.value)} placeholder="2FA code" type="text" value={mfaCode} />
              </label>
            </>
          ) : (
            <textarea className={`${inputBase} h-24 resize-none`} onChange={(e) => setManualToken(e.target.value)} placeholder="Paste session token" value={manualToken} />
          )}
          <label className="flex items-start gap-2 rounded-md border border-[#242A35] bg-[#141821] p-2 text-xs text-[#A6B0C3] cursor-pointer">
            <input checked={privacyConsent} className="mt-0.5" onChange={(e) => setPrivacyConsent(e.target.checked)} type="checkbox" />
            <span>I agree to the <a className="text-[#B6D8F6] underline" href="/privacy-policy.html" rel="noreferrer" target="_blank">privacy policy</a>. Ermine does not store content outside configured stoat.chat endpoints.</span>
          </label>
          {loginError && <div className="flex items-start gap-2 rounded-md border border-red-800 bg-red-900/30 p-2 text-sm text-red-200"><AlertCircle className="mt-0.5 shrink-0" size={14} />{loginError}</div>}
          <button className="w-full rounded-md bg-[#8AB4F8] py-2.5 text-sm font-semibold text-[#0F1115] hover:bg-[#6FA6E8] disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity" disabled={isLoggingIn} type="submit">
            {isLoggingIn ? <><Loader className="animate-spin" size={14} /> Signing in…</> : 'Sign in to Ermine'}
          </button>
        </form>
        <div className="mt-5 border-t border-[#202225] pt-4">
          <button className="flex items-center gap-1 text-xs text-[#A6B0C3] hover:text-white transition-colors" onClick={() => setShowAdvanced((p) => !p)} type="button"><Settings size={12} /> Advanced configuration</button>
          {showAdvanced && (
            <div className="mt-2 space-y-2 rounded-md bg-[#141821] p-2">
              <input className={inputBase} onChange={(e) => setConfig((p) => ({ ...p, apiUrl: e.target.value }))} placeholder="API URL" value={config.apiUrl} />
              <input className={inputBase} onChange={(e) => setConfig((p) => ({ ...p, wsUrl:  e.target.value }))} placeholder="WS URL"  value={config.wsUrl} />
              <input className={inputBase} onChange={(e) => setConfig((p) => ({ ...p, cdnUrl: e.target.value }))} placeholder="CDN URL" value={config.cdnUrl} />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── App ──────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-[#0F1115] text-[#E6EDF3]">

      {/* ════ MODALS ════ */}

      {activeModal === 'create-server' && (
        <Modal onClose={() => setActiveModal(null)} title="Create a Space">
          <input className={inputBase} onChange={(e) => setCreateServerName(e.target.value)} placeholder="Space name" value={createServerName} autoFocus />
          <button className="w-full rounded-md bg-[#3ba55d] py-2 text-sm font-semibold text-white hover:bg-[#328a4f] transition-colors" onClick={createServer}>Create Space</button>
        </Modal>
      )}

      {activeModal === 'join-server' && (
        <Modal onClose={() => { setActiveModal(null); setInviteCode(''); setInviteError(''); }} title="Join a Space">
          <p className="text-xs text-gray-400">Enter an invite code to join a space.</p>
          <input className={inputBase} placeholder="Invite code (e.g. abc123)" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && joinByInvite()} autoFocus />
          {inviteError && <p className="text-xs text-red-400">{inviteError}</p>}
          <button className="w-full rounded-md bg-[#5865f2] py-2 text-sm font-semibold text-white hover:bg-[#4956d8] disabled:opacity-60 transition-colors flex items-center justify-center gap-2" disabled={joinLoading || !inviteCode.trim()} onClick={joinByInvite}>
            {joinLoading ? <><Loader className="animate-spin" size={14} /> Joining…</> : 'Join Space'}
          </button>
        </Modal>
      )}

      {activeModal === 'create-invite' && (
        <Modal onClose={() => { setActiveModal(null); setInviteCreated(''); setInviteError(''); }} title="Invite to Space">
          <p className="text-xs text-gray-400">Create an invite link for <strong className="text-white">{selServerObj?.name}</strong> via <strong className="text-white">#{curChName}</strong>.</p>
          {!inviteCreated ? (
            <button className="w-full rounded-md bg-[#5865f2] py-2 text-sm font-semibold text-white hover:bg-[#4956d8] transition-colors flex items-center justify-center gap-2" onClick={createInvite}>
              <Link size={14} /> Create Invite
            </button>
          ) : (
            <div>
              <p className="text-xs text-gray-400 mb-1">Share this code:</p>
              <div className="flex gap-2">
                <code className="flex-1 rounded bg-[#141821] px-3 py-2 text-sm text-[#8AB4F8] select-all">{inviteCreated}</code>
                <button className="rounded bg-[#5865f2] px-3 py-2 text-white hover:bg-[#4956d8] transition-colors" onClick={() => { navigator.clipboard.writeText(inviteCreated); setCopiedInvite(true); setTimeout(() => setCopiedInvite(false), 2000); }}>
                  {copiedInvite ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          )}
          {inviteError && <p className="text-xs text-red-400">{inviteError}</p>}
        </Modal>
      )}

      {activeModal === 'pinned' && (
        <Modal onClose={() => setActiveModal(null)} title={`Pinned — #${curChName}`} wide>
          {pinnedMessages.length === 0
            ? <p className="text-sm text-gray-400 text-center py-4">No pinned messages in this channel.</p>
            : pinnedMessages.map((m) => (
                <div key={m._id} className="rounded-lg bg-[#1e2024] p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar user={users[typeof m.author === 'string' ? m.author : m.author?._id]} cdn={config.cdnUrl} size="sm" />
                    <span className="text-sm font-semibold text-white">{users[typeof m.author === 'string' ? m.author : m.author?._id]?.username || 'Unknown'}</span>
                    <span className="text-xs text-gray-400">{smartTime(m.createdAt || m._id)}</span>
                    <button className="ml-auto text-xs text-gray-400 hover:text-white" onClick={() => { setActiveModal(null); jumpTo(m._id); }}>Jump</button>
                  </div>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              ))
          }
        </Modal>
      )}

      {activeModal === 'server-settings' && selServerObj && (
        <Modal onClose={() => setActiveModal(null)} title="Space Settings">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Space Name</label>
          <div className="flex gap-2">
            <input className={inputBase} onChange={(e) => setEditServerName(e.target.value)} value={editServerName} placeholder="Space name" />
            <button onClick={updateServer} disabled={isUpdatingServer || !editServerName.trim()} className="rounded bg-[#5865f2] px-3 text-white hover:bg-[#4956d8] disabled:opacity-50 transition-colors"><Save size={18} /></button>
          </div>
          <div className="border-t border-[#202225] pt-3">
            <h4 className="text-xs font-bold text-red-400 uppercase tracking-wide mb-2">Danger Zone</h4>
            <div className="flex items-center justify-between rounded border border-red-900/50 bg-red-900/10 p-3">
              <div><div className="text-sm font-semibold text-white">Delete Space</div><div className="text-xs text-gray-400">Permanently removes this space.</div></div>
              <button onClick={deleteServer} disabled={isUpdatingServer} className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        </Modal>
      )}

      {activeModal === 'set-status' && (
        <Modal onClose={() => setActiveModal(null)} title="Set Status">
          <div className="grid gap-2">
            {STATUS_OPTIONS.map((o) => (
              <button key={o.value} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${statusDraft.presence === o.value ? 'border-[#5865f2] bg-[#2c3163]/40' : 'border-[#2f3237] bg-[#1f2024] hover:border-[#3f4451]'}`} onClick={() => setStatusDraft((p) => ({ ...p, presence: o.value }))} type="button">
                <span className={`p-1.5 ${o.iconClass}`}><o.icon size={14} /></span>
                <span className="text-sm">{o.label}</span>
              </button>
            ))}
          </div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Custom status
            <input className={`${inputBase} mt-1`} maxLength={128} onChange={(e) => setStatusDraft((p) => ({ ...p, text: e.target.value }))} placeholder="What's up?" value={statusDraft.text} />
          </label>
          <button className="w-full rounded-md bg-[#5865f2] py-2 text-sm font-semibold text-white hover:bg-[#4956d8] transition-colors" disabled={savingStatus} onClick={saveStatus}>{savingStatus ? 'Saving…' : 'Save status'}</button>
        </Modal>
      )}

      {activeModal === 'user-settings' && (
        <Modal onClose={() => setActiveModal(null)} title="Preferences">
          <div className="flex flex-col items-stretch">
            <div className="h-24 rounded-lg overflow-hidden relative">
              {bannerUrl(users[auth.userId], config.cdnUrl)
                ? <img src={bannerUrl(users[auth.userId], config.cdnUrl)} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-r from-[#3b3f6b] to-[#5865f2]" />
              }
              <div className="absolute -bottom-7 left-4 p-1 bg-[#1e1f22] rounded-full"><Avatar user={users[auth.userId]} cdn={config.cdnUrl} size="lg" /></div>
            </div>
            <div className="pt-10 px-1">
              <div className="text-xl font-bold text-white">{users[auth.userId]?.username || 'User'}</div>
              <div className="text-xs text-gray-400">#{users[auth.userId]?.discriminator || '0000'}</div>
            </div>
          </div>
          <div className="border-t border-[#2f3237] pt-3 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">About Ermine</div>
            <div className="flex items-start gap-3 bg-[#2b2d31] p-3 rounded-lg">
              <div className="p-2 bg-gray-700 rounded-lg"><AlertCircle size={18} className="text-white" /></div>
              <div>
                <div className="text-sm font-bold text-white">Version 0.2.0</div>
                <div className="text-xs text-gray-400 mt-0.5">Mode: {isLowSpec ? 'Lite' : 'Standard'}</div>
                <a href="https://ko-fi.com/stoatchat" target="_blank" rel="noopener noreferrer" className="text-xs text-[#5865f2] hover:underline mt-1 inline-block">Support Stoat on Ko-fi →</a>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {linkPromptUrl && (
        <Modal onClose={() => setLinkPromptUrl(null)} title="Open link?">
          <div className="rounded bg-[#1e1f22] p-3">
            <p className="text-xs text-gray-500 mb-1">Do you trust this link?</p>
            <p className="break-all text-sm text-[#bdc3ff]">{linkPromptUrl}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded-md bg-[#3a3d42] py-2 text-sm font-semibold text-gray-200 hover:bg-[#4a4d55] transition-colors" onClick={() => setLinkPromptUrl(null)}>Cancel</button>
            <button className="rounded-md bg-[#5865f2] py-2 text-sm font-semibold text-white hover:bg-[#4956d8] transition-colors" onClick={confirmLink}>Open link</button>
          </div>
        </Modal>
      )}

      {peekUser && (
        <Modal onClose={() => setPeekUser(null)} title="Profile">
          <div className="overflow-hidden rounded-lg bg-[#1e1f22]">
            {peekBanner ? <img alt="" className="h-24 w-full object-cover" src={peekBanner} /> : <div className="h-20 bg-gradient-to-r from-[#3b3f6b] to-[#5865f2]" />}
            <div className="flex items-center gap-3 p-3">
              <Avatar user={peekUser} cdn={config.cdnUrl} size="lg" always />
              <div className="min-w-0">
                <div className="text-base font-semibold text-white">{peekUser.username}</div>
                <div className="text-xs text-gray-400">#{peekUser.discriminator || '0000'}</div>
                {users[peekUser._id]?.status?.text && <div className="text-xs text-gray-300 mt-0.5 truncate">{users[peekUser._id].status.text}</div>}
              </div>
              {peekUser._id !== auth.userId && (
                <div className="ml-auto flex gap-1.5">
                  <button className="rounded bg-[#5865f2] px-2 py-1 text-xs font-semibold text-white hover:bg-[#4956d8] transition-colors" onClick={() => { openDm(peekUser._id); setPeekUser(null); }}><MessageSquare size={13} /></button>
                  {friends.some((f) => f._id === peekUser._id)
                    ? <button className="rounded bg-[#ed4245]/20 px-2 py-1 text-xs text-red-300 hover:bg-[#ed4245]/30 transition-colors" onClick={() => removeFriend(peekUser._id)} title="Remove friend"><UserX size={13} /></button>
                    : <button className="rounded bg-[#3ba55d]/20 px-2 py-1 text-xs text-green-300 hover:bg-[#3ba55d]/30 transition-colors" onClick={() => sendFriendRequest(peekUser.username)} title="Send friend request"><UserPlus size={13} /></button>
                  }
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-md bg-[#1e1f22] p-3 text-xs text-gray-300">
            <div><span className="font-semibold text-gray-100 block mb-0.5">Joined platform</span>{dateLabel(peekJoined)}</div>
            <div><span className="font-semibold text-gray-100 block mb-0.5">Joined space</span>{selServer === '@me' ? 'N/A' : dateLabel(peekSrvJoined)}</div>
          </div>
          {peekBio && <div className="rounded-md bg-[#1e1f22] p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">About me</p><p className="text-sm text-gray-200">{peekBio}</p></div>}
          {peekBadges.length > 0 && <div className="rounded-md bg-[#1e1f22] p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Badges</p><div className="flex flex-wrap gap-1">{peekBadges.map((b) => <span key={b} className="rounded bg-[#5865f2]/20 px-2 py-0.5 text-xs text-[#d7ddff]">{b}</span>)}</div></div>}
          {peekRoles.length > 0 && <div className="rounded-md bg-[#1e1f22] p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Roles</p><div className="flex flex-wrap gap-1">{peekRoles.map((r) => <span key={r.id || r.name} className="rounded px-2 py-0.5 text-xs text-gray-200 border-l-2" style={{ background: '#2b2d31', borderColor: r.colour || '#4c4f56' }}>{r.name}</span>)}</div></div>}
        </Modal>
      )}

      {/* ════ SERVER RAIL ════ */}
      <aside className="flex w-[72px] flex-col items-center gap-2 overflow-y-auto bg-[#111214] py-3 shrink-0">
        <button className={`grid h-12 w-12 place-items-center transition-all duration-150 ${selServer === '@me' ? 'rounded-2xl bg-[#5865f2]' : 'rounded-full bg-[#313338] hover:rounded-2xl hover:bg-[#5865f2]'}`} onClick={() => selectServer('@me')} title="Direct messages"><MessageSquare size={20} /></button>
        <div className="h-px w-8 bg-[#202225]" />
        {serverList.map((s) => {
          const ic = iconUrl(s, config.cdnUrl); const active = selServer === s._id;
          return (
            <div key={s._id} className="relative">
              <button className={`grid h-12 w-12 place-items-center overflow-hidden transition-all duration-150 ${active ? 'rounded-2xl bg-[#5865f2]' : 'rounded-full bg-[#313338] hover:rounded-2xl hover:bg-[#5865f2]'}`} onClick={() => selectServer(s._id)} title={s.name}>
                {ic ? <img alt={s.name} className="h-full w-full object-contain p-1" src={ic} /> : <span className="text-sm font-bold">{s.name.slice(0,2).toUpperCase()}</span>}
              </button>
              {/* Unread indicator */}
              {Object.values(channels).some((c) => c.server === s._id && unreadChannels.has(c._id)) && !active && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white unread-dot pointer-events-none" />
              )}
            </div>
          );
        })}
        <button className="grid h-12 w-12 place-items-center rounded-full bg-[#313338] text-[#3ba55d] transition-all duration-150 hover:rounded-2xl hover:bg-[#3ba55d] hover:text-white" onClick={() => setActiveModal('create-server')} title="Create a space"><Plus size={20} /></button>
        <button className="grid h-12 w-12 place-items-center rounded-full bg-[#313338] text-blue-400 transition-all duration-150 hover:rounded-2xl hover:bg-blue-600 hover:text-white" onClick={() => setActiveModal('join-server')} title="Join a space"><Link size={18} /></button>
      </aside>

      {/* ════ CHANNEL SIDEBAR ════ */}
      <aside className={`${showMobileSide ? 'flex' : 'hidden'} md:flex w-60 flex-col bg-[#2b2d31] shrink-0 z-30 md:z-auto absolute md:relative h-full`}>
        {/* Server header */}
        <div className="border-b border-[#202225] px-4 py-3 flex justify-between items-center shrink-0">
          <div className="truncate text-sm font-bold text-white">{selServer === '@me' ? 'Live' : selServerObj?.name || 'Space'}</div>
          <div className="flex items-center gap-1">
            {isOwner && selServer !== '@me' && <>
              <button onClick={() => setActiveModal('create-invite')} className="text-gray-400 hover:text-white transition-colors p-0.5" title="Create invite"><Link size={14} /></button>
              <button onClick={() => { setEditServerName(selServerObj.name); setActiveModal('server-settings'); }} className="text-gray-400 hover:text-white transition-colors p-0.5" title="Space Settings"><Settings size={14} /></button>
            </>}
          </div>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto p-2">
          {selServer === '@me' ? (
            <>
              <button className={`mb-0.5 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${selChannel === 'friends' ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373c] hover:text-white'}`} onClick={() => { setSelChannel('friends'); setShowMobileSide(false); }}>
                <Users size={16} /> <span>Direct</span>
              </button>
              {dmChannels.map((ch) => {
                const label = dmLabel(ch);
                const icon  = chIcon(ch);
                const rid   = ch.channel_type === 'DirectMessage' ? (ch.recipients || []).find((id) => id !== auth.userId) : null;
                const unread = unreadChannels.has(ch._id);
                return (
                  <button key={ch._id} className={`mb-0.5 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${selChannel === ch._id ? 'bg-[#404249] text-white' : `text-gray-400 hover:bg-[#35373c] hover:text-white ${unread ? 'text-white' : ''}`}`} onClick={() => selectChannel(ch._id)}>
                    {rid ? <Avatar user={users[rid]} cdn={config.cdnUrl} size="sm" /> : <span className="text-gray-400">{icon}</span>}
                    <span className="truncate flex-1">{label}</span>
                    {unread && <span className="unread-dot w-2 h-2 rounded-full bg-white shrink-0" />}
                  </button>
                );
              })}
            </>
          ) : (
            categorisedChannels.map((item, i) => {
              if (item.type === 'category') {
                const collapsed = collapsedCats[item.id];
                return (
                  <button key={item.id} className="flex w-full items-center gap-1 px-1 py-1 text-left" onClick={() => setCollapsedCats((p) => ({ ...p, [item.id]: !p[item.id] }))}>
                    {collapsed ? <ChevronRight size={12} className="text-gray-500 shrink-0" /> : <ChevronDown size={12} className="text-gray-500 shrink-0" />}
                    <span className="text-xs font-bold uppercase tracking-wide text-gray-400 truncate">{item.title}</span>
                  </button>
                );
              }
              // type === 'channel'
              const ch = item.channel; const isVoice = ch.channel_type === 'VoiceChannel'; const unread = unreadChannels.has(ch._id);
              return (
                <button key={ch._id} className={`mb-0.5 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${isVoice ? 'cursor-not-allowed text-gray-500' : selChannel === ch._id ? 'bg-[#404249] text-white' : `text-gray-400 hover:bg-[#35373c] hover:text-white ${unread ? 'text-white font-semibold' : ''}`}`}
                  onClick={() => selectChannel(ch._id)} title={ch.name}>
                  <span className={isVoice ? 'text-gray-600' : 'text-gray-400'}>{chIcon(ch)}</span>
                  <span className="truncate flex-1">{ch.name || 'channel'}</span>
                  {unread && <span className="unread-dot w-2 h-2 rounded-full bg-white shrink-0" />}
                  {ch.nsfw && <span className="text-[9px] text-red-400 font-bold">NSFW</span>}
                </button>
              );
            })
          )}
        </div>

        {/* Account footer */}
        <div className="border-t border-[#202225] p-2 shrink-0">
          <div className="flex items-center justify-between rounded bg-[#232428] p-2" onMouseEnter={() => setIsAccHovered(true)} onMouseLeave={() => setIsAccHovered(false)}>
            <button className="flex min-w-0 items-center gap-2 rounded p-1 text-left hover:bg-[#2d3036] flex-1" onClick={openStatusEditor} type="button">
              <Avatar user={users[auth.userId]} cdn={config.cdnUrl} size="sm" always={isAccHovered} />
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-white">{users[auth.userId]?.username || 'Connected'}</div>
                <div className="truncate text-[10px] text-gray-400">{users[auth.userId]?.status?.text || status}</div>
              </div>
            </button>
            <div className="flex items-center gap-0.5 shrink-0">
              <button className="rounded p-1 text-gray-400 hover:text-white transition-colors" onClick={() => setActiveModal('user-settings')} title="Preferences"><Settings size={13} /></button>
              <button className="rounded p-1 text-gray-400 hover:text-white transition-colors" onClick={logout} title="Logout"><LogOut size={13} /></button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {showMobileSide && <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setShowMobileSide(false)} />}

      {/* ════ MAIN ════ */}
      <main className="relative flex min-w-0 flex-1 flex-col bg-[#313338]">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#202225] px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button className="md:hidden text-gray-400 hover:text-white transition-colors mr-1" onClick={() => setShowMobileSide((p) => !p)}><Menu size={20} /></button>
            <span className="text-gray-400 shrink-0">{chIcon(channels[selChannel])}</span>
            <span className="text-sm font-semibold text-white truncate">{curChName}</span>
            {curChTopic && <span className="hidden lg:block text-xs text-gray-400 border-l border-[#3f4249] pl-2 ml-1 truncate max-w-xs">{curChTopic}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selChannel !== 'friends' && (
              <>
                <button className="text-gray-400 hover:text-white transition-colors p-1" onClick={() => { fetchPins(selChannel); setActiveModal('pinned'); }} title="Pinned messages"><Pin size={16} /></button>
                {isOwner && selServer !== '@me' && selChannel !== 'friends' && (
                  <button className="text-gray-400 hover:text-white transition-colors p-1" onClick={() => setActiveModal('create-invite')} title="Create invite"><Link size={16} /></button>
                )}
              </>
            )}
            <StatusBadge status={status} />
          </div>
        </header>

        {voiceNotice && <div className="mx-4 mt-2 rounded-md border border-[#665200] bg-[#5c4a00]/25 px-3 py-2 text-xs text-yellow-200">{voiceNotice}</div>}

        {/* Message area */}
        <section className="flex-1 overflow-y-auto py-2" ref={scrollRef}>
          {isLoadingOlder && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-gray-400">
              <Loader className="animate-spin" size={13} /> Loading older messages…
            </div>
          )}

          {selChannel === 'friends' ? (
            <div className="space-y-1.5 p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Direct ({friends.length})</h2>
              {friends.length === 0 && <p className="text-sm text-gray-400">No direct contacts yet.</p>}
              {friends.map((f) => (
                <button key={f._id} className="flex w-full items-center gap-3 rounded-lg bg-[#2b2d31] p-3 text-left hover:bg-[#35373c] transition-colors" onClick={() => openDm(f._id)}>
                  <Avatar user={f} cdn={config.cdnUrl} hover />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{f.username}</div>
                    <div className="text-xs text-gray-400 truncate">{f.status?.text || f.status?.presence || 'Offline'}</div>
                  </div>
                  {unreadChannels.has(Object.values(channels).find((c) => c.channel_type === 'DirectMessage' && (c.recipients || []).includes(f._id))?._id || '') && <span className="ml-auto unread-dot w-2 h-2 rounded-full bg-white shrink-0" />}
                </button>
              ))}
            </div>
          ) : curMsgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-400">
              <Hash size={40} className="mb-3 opacity-25" />
              <p className="text-sm font-semibold">No messages yet</p>
              <p className="text-xs mt-1 opacity-60">Be the first to say something!</p>
            </div>
          ) : (
            curMsgs.map((msg, idx) => {
              const prev = idx > 0 ? curMsgs[idx - 1] : null;
              return (
                <React.Fragment key={msg._id}>
                  {(idx === 0 || (prev && dayKey(prev) !== dayKey(msg))) && <DateSep msg={msg} />}
                  <Message
                    message={msg} users={users} channels={channels} me={auth.userId}
                    onUser={(u, id) => setPeekUser({ ...u, _id: id || u._id })}
                    cdn={config.cdnUrl} onReact={toggleReaction} onReply={setReplyingTo}
                    replyTarget={replyingTo?._id} jumpTo={jumpTo} regRef={regRef}
                    ceById={ceById} reactOpts={reactOpts} openLink={openLink}
                    onEdit={editMessage} onDelete={deleteMessage} replyMap={replyMsgMap}
                  />
                </React.Fragment>
              );
            })
          )}
          <div ref={botRef} />
        </section>

        {/* Typing indicator */}
        <TypingIndicator userIds={curTypingIds} users={users} />

        {showGoLatest && (
          <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2">
            <button className="pointer-events-auto rounded-full bg-[#5865f2] px-3 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-[#4956d8] transition-colors" onClick={goLatest}>↓ Latest</button>
          </div>
        )}

        {/* ── Composer ── */}
        <footer className="border-t border-[#202225] px-4 pt-2 pb-4 shrink-0">
          {activeReply && (
            <div className="mb-2 flex items-center gap-2 rounded bg-[#2b2d31] px-3 py-1.5 text-xs text-gray-300">
              <Reply size={11} className="shrink-0 text-gray-400" />
              <span className="truncate flex-1">Replying to <strong>{users[typeof activeReply.author === 'string' ? activeReply.author : activeReply.author?._id]?.username || '…'}</strong>: {activeReply.content || 'attachment'}</span>
              <button className="shrink-0 text-gray-400 hover:text-white transition-colors" onClick={() => setReplyingTo(null)}><X size={12} /></button>
            </div>
          )}

          {pendingFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {pendingFiles.map((f, i) => (
                <button key={`${f.name}-${i}`} className="flex items-center gap-1.5 rounded bg-[#2b2d31] px-2 py-1 text-xs text-gray-200 hover:bg-[#35373c] transition-colors" onClick={() => setPendingFiles((p) => p.filter((_, x) => x !== i))}>
                  {isImg(f.name, f.type) ? '🖼️' : '📎'} {f.name} <X size={11} className="ml-0.5 opacity-60" />
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 rounded-lg bg-[#383a40] px-2 py-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = Array.from(e.dataTransfer?.files || []); if (f.length) setPendingFiles((p) => [...p, ...f]); }}>
            <button className="p-2 text-gray-300 hover:text-white transition-colors mb-0.5 shrink-0" disabled={selChannel === 'friends' || isUploading} onClick={() => fileInputRef.current?.click()} title="Attach file"><Paperclip size={16} /></button>
            <input className="hidden" multiple onChange={onFilePick} ref={fileInputRef} type="file" />

            <div className="relative shrink-0">
              <button className="p-2 text-gray-300 hover:text-white transition-colors mb-0.5" disabled={selChannel === 'friends'} onClick={() => setShowEmojiPicker((p) => !p)}>
                <span className="text-base leading-none select-none">😊</span>
              </button>
              {showEmojiPicker && selChannel !== 'friends' && (
                <div ref={pickerRef} className="absolute bottom-12 left-0 z-20 w-72 rounded-lg border border-[#4c4f56] bg-[#232428] shadow-2xl max-h-72 overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-[#2f3237] shrink-0">
                    <input className="w-full rounded bg-[#1e1f22] px-2 py-1 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#5865f2]" placeholder="Search custom emojis…" value={emojiSearch} onChange={(e) => setEmojiSearch(e.target.value)} />
                  </div>
                  <div className="overflow-y-auto p-2">
                    {emojiSearch ? (
                      filteredCE.length
                        ? <div className="grid grid-cols-8 gap-1">{filteredCE.map((e) => <button key={e.id} className="grid h-8 place-items-center rounded hover:bg-[#3a3d42]" onClick={() => addCE(e.id)} title={`${e.name} · ${e.serverName}`}>{renderEmojiVis(`:${e.id}:`, { id: e.id, name: e.name }, config.cdnUrl)}</button>)}</div>
                        : <p className="text-center py-4 text-xs text-gray-500">No match</p>
                    ) : (
                      <>
                        <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 sticky top-0 bg-[#232428]">Standard</p>
                        <div className="grid grid-cols-8 gap-1 mb-2">{STD_EMOJI.map((e) => <button key={e} className="rounded p-0.5 text-lg hover:bg-[#3a3d42]" onClick={() => addEmoji(e)}>{renderTwemoji(e, 'w-6 h-6 inline-block')}</button>)}</div>
                        {allCE.length > 0 && <>
                          <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 sticky top-0 bg-[#232428]">Space Emojis</p>
                          <div className="grid grid-cols-8 gap-1">{allCE.map((e) => <button key={e.id} className="grid h-8 place-items-center rounded hover:bg-[#3a3d42]" onClick={() => addCE(e.id)} title={`${e.name} · ${e.serverName}`}>{renderEmojiVis(`:${e.id}:`, { id: e.id, name: e.name }, config.cdnUrl)}</button>)}</div>
                        </>}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <textarea
              ref={composerRef}
              className="composer-textarea flex-1 bg-transparent px-2 py-1.5 text-sm text-gray-100 placeholder:text-gray-400 focus:outline-none resize-none"
              rows={1}
              disabled={selChannel === 'friends'}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                sendTypingBegin();
                clearTimeout(sendTypingTimRef.current);
                sendTypingTimRef.current = setTimeout(sendTypingEnd, 4000);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); clearTimeout(sendTypingTimRef.current); sendMessage(); }
                if (e.key === 'Escape') { setReplyingTo(null); setInputText(''); sendTypingEnd(); }
              }}
              placeholder={selChannel === 'friends' ? 'Select a channel to chat.' : `Message #${curChName}`}
            />

            <button className="p-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-0.5 shrink-0"
              disabled={isUploading || (!inputText.trim() && !pendingFiles.length) || selChannel === 'friends'}
              onClick={() => { clearTimeout(sendTypingTimRef.current); sendMessage(); }}>
              {isUploading ? <Loader className="animate-spin" size={16} /> : <Send size={16} />}
            </button>
          </div>
          <p className="mt-1 text-right text-[10px] text-gray-500">Shift+Enter for newline · Esc cancel reply</p>
        </footer>
      </main>

      {/* ════ MEMBERS SIDEBAR ════ */}
      <aside className="hidden w-56 flex-col border-l border-[#202225] bg-[#2b2d31] lg:flex shrink-0">
        <div className="border-b border-[#202225] px-4 py-3 shrink-0">
          <div className="text-xs font-bold uppercase tracking-wide text-gray-400">Members — {allMembers.length}</div>
          {isMembLoading && <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#242A35]"><div className="h-full w-1/3 animate-pulse rounded-full bg-[#8AB4F8]" /></div>}
        </div>
        <div className="min-h-0 flex-1">
          {selServer === '@me'
            ? <p className="p-4 text-xs text-gray-400">Member list available in spaces.</p>
            : <MemberVirtualList items={memberListItems} className="h-full w-full" renderItem={renderMemberItem} />
          }
        </div>
      </aside>
    </div>
  );
}

export default function App() {
  return <AppErrorBoundary><AppShell /></AppErrorBoundary>;
}
