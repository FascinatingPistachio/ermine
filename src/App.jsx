import React, { useEffect, useMemo, useRef, useState, useCallback, memo, Component } from 'react';
import {
  AlertCircle,
  Circle,
  EyeOff,
  Hash,
  LogOut,
  MessageSquare,
  Moon,
  MinusCircle,
  Plus,
  Paperclip,
  Reply,
  Send,
  Settings,
  ShieldCheck,
  Smile,
  User,
  Users,
  X,
  Trash2,
  Edit2,
  Save,
  MoreVertical,
  Search,
  Image as ImageIcon
} from 'lucide-react';

// --- ULID Decoder for Timestamps ---
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const DECODE_LOOKUP = {};
for (let i = 0; i < ENCODING.length; i++) DECODE_LOOKUP[ENCODING[i]] = i;

const ulidToMillis = (id) => {
  if (typeof id !== 'string' || id.length !== 26) return Date.now();
  const timePart = id.substring(0, 10).toUpperCase();
  let time = 0;
  for (let i = 0; i < 10; i++) {
    time = time * 32 + (DECODE_LOOKUP[timePart[i]] || 0);
  }
  return time;
};

// --- Low Spec Detection (Wii U / Old Browsers) ---
const isLowSpec = typeof navigator !== 'undefined' && (
  /Nintendo WiiU/i.test(navigator.userAgent) || 
  /Nintendo 3DS/i.test(navigator.userAgent) ||
  /PlayStation/i.test(navigator.userAgent) ||
  (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
);

// --- Twemoji Utilities ---
const TWEMOJI_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/';

const toCodePoint = (unicodeSurrogates, sep) => {
  const r = [];
  let c = 0;
  let p = 0;
  let i = 0;
  while (i < unicodeSurrogates.length) {
    c = unicodeSurrogates.charCodeAt(i++);
    if (p) {
      r.push((0x10000 + ((p - 0xd800) << 10) + (c - 0xdc00)).toString(16));
      p = 0;
    } else if (0xd800 <= c && c <= 0xdbff) {
      p = c;
    } else {
      r.push(c.toString(16));
    }
  }
  return r.join(sep || '-');
};

const renderTwemoji = (text, className = "inline-block w-5 h-5 align-bottom") => {
  if (!text) return null;
  const parts = text.split(/([\uD800-\uDBFF][\uDC00-\uDFFF])/g);
  return parts.map((part, index) => {
    if (/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(part)) {
      const codePoint = toCodePoint(part);
      return (
        <img 
          key={index}
          src={`${TWEMOJI_BASE}${codePoint}.png`} 
          alt={part} 
          className={className}
          draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      );
    }
    return part;
  });
};

// --- Config & Helpers ---
const getRuntimeConfig = () => {
  const runtime = typeof window !== 'undefined' ? window.__ERMINE_CONFIG__ || {} : {};
  return {
    apiUrl: runtime.apiUrl || 'https://api.stoat.chat',
    wsUrl: runtime.wsUrl || 'wss://stoat.chat/events',
    cdnUrl: runtime.cdnUrl || 'https://cdn.stoatusercontent.com',
  };
};

const { apiUrl: DEFAULT_API_URL, wsUrl: DEFAULT_WS_URL, cdnUrl: DEFAULT_CDN_URL } = getRuntimeConfig();

const inputBase =
  'w-full rounded-md border border-[#242A35] bg-[#141821] px-3 py-2 text-sm text-[#E6EDF3] placeholder:text-[#8892A6] focus:border-[#8AB4F8] focus:outline-none focus:ring-1 focus:ring-[#8AB4F8]';

const TOKEN_COOKIE_NAME = 'ermine_session_token';
const USER_COOKIE_NAME = 'ermine_user_id';
const API_COOKIE_NAME = 'ermine_api_url';

const getCookie = (name) => {
  if (typeof document === 'undefined') return null;
  const value = document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : null;
};

const setCookie = (name, value, maxAgeSeconds = 60 * 60 * 24 * 30) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax; Secure`;
};

const clearCookie = (name) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
};

const STATUS_OPTIONS = [
  { value: 'Online', label: 'Online', icon: Circle, iconClass: 'text-[#3ba55d]' }, // Swapped Activity for Circle
  { value: 'Idle', label: 'Idle', icon: Moon, iconClass: 'text-[#f0b232]' },
  { value: 'Busy', label: 'Do Not Disturb', icon: MinusCircle, iconClass: 'text-[#ed4245]' },
  { value: 'Focus', label: 'Focus', icon: Circle, iconClass: 'text-[#4f7dff]' },
  { value: 'Invisible', label: 'Invisible', icon: EyeOff, iconClass: 'text-gray-400' },
];

const formatSmartTime = (valueOrId) => {
  let date;
  if (typeof valueOrId === 'string' && valueOrId.length === 26) {
    date = new Date(ulidToMillis(valueOrId));
  } else {
    date = new Date(valueOrId);
  }
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return `Today at ${timeStr}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${timeStr}`;
  return `${date.toLocaleDateString()} at ${timeStr}`;
};

const getAvatarUrl = (user, cdnUrl) => user?.avatar?._id ? `${cdnUrl}/avatars/${user.avatar._id}` : null;
const getIconUrl = (server, cdnUrl) => server?.icon?._id ? `${cdnUrl}/icons/${server.icon._id}` : null;
const getBannerUrl = (user, cdnUrl) => {
  const banner = user?.profile?.background || user?.banner;
  const bannerId = typeof banner === 'string' ? banner : banner?._id;
  return bannerId ? `${cdnUrl}/backgrounds/${bannerId}/original` : null;
};
const getJoinedAt = (entry) => entry?.joined_at || entry?.joinedAt || entry?.created_at || entry?.createdAt || null;
const toDateLabel = (value) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
};

// --- Shared Components ---

const Avatar = ({ user, cdnUrl, size = 'md', animateOnHover = false, alwaysAnimate = false }) => {
  const sizeMap = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' };
  const initials = (user?.username || '?').slice(0, 2).toUpperCase();
  const [isHovered, setIsHovered] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Reset error state if avatar changes
  useEffect(() => { setHasError(false); }, [user?.avatar?._id]);

  const effectiveAnimate = (alwaysAnimate || (animateOnHover && isHovered)) && !isLowSpec && !hasError;
  const src = (() => {
    if (!user?.avatar?._id) return null;
    return effectiveAnimate ? `${cdnUrl}/avatars/${user.avatar._id}/original` : `${cdnUrl}/avatars/${user.avatar._id}`;
  })();

  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#313338] font-semibold text-gray-200 ${sizeMap[size]}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {src ? (
        <img 
          alt={user?.username || 'User avatar'} 
          className="block h-full w-full object-cover object-center" 
          src={src} 
          onError={() => { if(effectiveAnimate) setHasError(true); }}
        />
      ) : initials}
    </div>
  );
};

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) { console.error('Ermine crashed:', error); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-screen place-items-center bg-[#0F1115] p-6 text-[#E6EDF3]">
          <div className="w-full max-w-lg rounded-2xl border border-[#242A35] bg-[#171A21] p-8 text-center shadow-2xl">
            <h1 className="mt-3 text-2xl font-bold text-white">Connection interrupted.</h1>
            <p className="mt-2 text-sm text-[#A6B0C3]">Attempting recovery requires a reload.</p>
            <button className="mt-6 rounded-md bg-[#8AB4F8] px-4 py-2 text-sm font-semibold text-[#0F1115] hover:bg-[#6FA6E8]" onClick={() => window.location.reload()} type="button">Reload Ermine</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
    <div className="w-full max-w-lg m-auto rounded-xl border border-[#242A35] bg-[#171A21] shadow-2xl flex max-h-[85vh] flex-col animate-[ermineModalIn_140ms_ease-out]">
      <div className="flex shrink-0 items-center justify-between border-b border-[#202225] px-4 py-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <button className="rounded p-1 text-gray-400 hover:bg-[#3a3d42] hover:text-white" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="p-4 overflow-y-auto custom-scrollbar">{children}</div>
    </div>
  </div>
);

const VirtualList = ({ items, renderItem, itemHeight, className }) => {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const requestRef = useRef();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleResize = () => setViewportHeight(container.clientHeight);
    const handleScroll = () => {
      if (requestRef.current) return;
      requestRef.current = requestAnimationFrame(() => {
        setScrollTop(container.scrollTop);
        requestRef.current = null;
      });
    };
    setViewportHeight(container.clientHeight);
    window.addEventListener('resize', handleResize);
    container.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('scroll', handleScroll);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 5);
  const endIndex = Math.min(items.length, Math.ceil((scrollTop + viewportHeight) / itemHeight) + 5);
  const visibleItems = items.slice(startIndex, endIndex).map((item, index) => ({ item, index: startIndex + index, offsetTop: (startIndex + index) * itemHeight }));

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative', overflowY: 'auto' }}>
      <div style={{ height: totalHeight, width: '100%' }}>
        {visibleItems.map(({ item, index, offsetTop }) => (
          <div key={item.key || index} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: itemHeight, transform: `translateY(${offsetTop}px)` }}>
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Logic Helpers ---
const LinkAnchor = ({ href, children, onRequestOpenLink, className = 'text-[#8ea1ff] underline hover:text-[#bdc3ff]' }) => (
  <a className={className} href={href} onClick={(e) => { e.preventDefault(); if (onRequestOpenLink) onRequestOpenLink(href); }} rel="noreferrer" target="_blank">{children}</a>
);

const renderLinksInText = (value, keyPrefix = 'link', onRequestOpenLink = null) => {
  if (!value) return null;
  return value.split(/(https?:\/\/[^\s]+)/gi).map((part, index) => {
    if (/^https?:\/\//i.test(part)) return <LinkAnchor href={part} key={`${keyPrefix}-${index}`} onRequestOpenLink={onRequestOpenLink}>{part}</LinkAnchor>;
    return <React.Fragment key={`${keyPrefix}-${index}`}>{part}</React.Fragment>;
  });
};

const renderMarkdownInline = (text, keyPrefix = 'md', onRequestOpenLink = null) => {
  if (!text) return null;
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|~~[^~]+~~|\[[^\]]+\]\([^\)]+\))/g);
  return tokens.map((token, index) => {
    if (/^`[^`]+`$/.test(token)) return <code key={`${keyPrefix}-${index}`} className="rounded bg-[#232428] px-1 py-0.5 text-xs text-[#f2f3f5]">{token.slice(1, -1)}</code>;
    if (/^\*\*[^*]+\*\*$/.test(token)) return <strong key={`${keyPrefix}-${index}`}>{token.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(token)) return <em key={`${keyPrefix}-${index}`}>{token.slice(1, -1)}</em>;
    if (/^__[^_]+__$/.test(token)) return <span key={`${keyPrefix}-${index}`} className="underline">{token.slice(2, -2)}</span>;
    if (/^~~[^~]+~~$/.test(token)) return <span key={`${keyPrefix}-${index}`} className="line-through">{token.slice(2, -2)}</span>;
    const markdownLink = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i);
    if (markdownLink) return <LinkAnchor href={markdownLink[2]} key={`${keyPrefix}-${index}`} onRequestOpenLink={onRequestOpenLink}>{markdownLink[1]}</LinkAnchor>;
    return <React.Fragment key={`${keyPrefix}-${index}`}>{renderLinksInText(token, `${keyPrefix}-plain-${index}`, onRequestOpenLink)}</React.Fragment>;
  });
};

const EMOJI_SHORTCODES = { smile: '😄', grin: '😁', joy: '😂', rofl: '🤣', wink: '😉', heart: '❤️', thumbs_up: '👍', thumbs_down: '👎', fire: '🔥', sob: '😭', thinking: '🤔', tada: '🎉', eyes: '👀' };
const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '😭', '🎉', '😮', '👀', '🤔'];
const EXTENDED_EMOJIS = [...QUICK_EMOJIS, '😄', '😁', '🤣', '😉', '🙏', '👏', '✨', '🎯', '💯', '🤝', '😅', '😎', '🥳', '✅', '❌', '🎵', '📌', '🚀', '🫡', '🤌'];
const STANDARD_EMOJIS = [
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫣','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','😵‍💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾',
  '👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁','👅','👄','🫦','💋','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵',
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐽','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷','🕸','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🦭','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿','🦔'
];
const MEMBER_RENDER_LIMIT = 250;
const MEMBER_HYDRATE_CHUNK = 400;

const toReactionEntries = (reactions) => {
  if (!reactions || typeof reactions !== 'object') return [];
  return Object.entries(reactions).map(([emoji, userIds]) => ({ emoji, userIds: Array.isArray(userIds) ? userIds : [] })).filter(e => e.userIds.length > 0);
};

const getReplyIdFromMessage = (message) => {
  const firstReply = Array.isArray(message?.replies) ? message.replies[0] : null;
  return typeof firstReply === 'string' ? firstReply : firstReply?.id || firstReply?._id || null;
};

const isCustomEmojiToken = (value) => /^:[A-Z0-9]{26}:$/i.test(value || '');
const getCustomEmojiId = (token) => token?.slice(1, -1);
const resolveCustomEmojiMeta = (token, customEmojiById) => {
  const effectiveToken = /^[A-Z0-9]{26}$/i.test(token) ? `:${token}:` : token;
  if (!isCustomEmojiToken(effectiveToken)) return null;
  const emojiId = getCustomEmojiId(effectiveToken);
  return customEmojiById?.[emojiId] || { id: emojiId, name: emojiId, serverName: null, isPrivate: false, unresolved: true };
};

const renderEmojiVisual = (token, customEmoji, cdnUrl) => {
  const rawId = /^[A-Z0-9]{26}$/i.test(token) ? token : (isCustomEmojiToken(token) ? getCustomEmojiId(token) : null);
  const emojiId = customEmoji?.id || rawId;
  if (emojiId) return <img alt={customEmoji?.name || token} className="inline h-5 w-5 align-text-bottom object-contain" src={`${cdnUrl}/emojis/${emojiId}`} />;
  if (Object.values(EMOJI_SHORTCODES).includes(token) || STANDARD_EMOJIS.includes(token) || !token.startsWith(':')) return renderTwemoji(token);
  return token;
};

const isImageLike = (filename = '', contentType = '') => {
    if (typeof contentType === 'string' && contentType.startsWith('image/')) return true;
    const ext = filename?.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'svg'].includes(ext);
};

const getAttachmentData = (attachment, cdnUrl, index = 0) => {
  const attachmentId = typeof attachment === 'string' ? attachment : attachment?._id || attachment?.id;
  const filename = attachment?.filename || attachment?.name || `attachment-${index + 1}`;
  const contentType = attachment?.content_type || attachment?.contentType || attachment?.metadata?.type || '';
  const url = attachmentId ? `${cdnUrl}/attachments/${attachmentId}` : null;
  const image = isImageLike(filename, contentType);
  return { attachmentId, filename, url, image };
};

const extractUrls = (value = '') => (value.match(/https?:\/\/[^\s]+/gi) || []);
const isEmbeddableGifLink = (url) => url && (/^https?:\/\/media\.tenor\.com\//i.test(url) || /\.(gif)(\?.*)?$/i.test(url));

const isEmbeddableImageLink = (url) => {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(cleanUrl);
};


const renderMessageContent = (content, users, channels, onUserClick, customEmojiById, cdnUrl, onRequestOpenLink) => {
  if (!content) return null;
  const parts = content.split(/(<@!?[A-Za-z0-9]+>|<#[A-Za-z0-9]+>|:[A-Z0-9]{26}:)/g);
  return parts.map((part, index) => {
    const userMention = part.match(/^<@!?([A-Za-z0-9]+)>$/);
    if (userMention) {
      const userId = userMention[1];
      const user = users[userId];
      return <button className="mx-0.5 inline rounded bg-[#5865f2]/25 px-1 text-[#bdc3ff] hover:bg-[#5865f2]/35" key={`${part}-${index}`} onClick={() => onUserClick(user || { _id: userId, username: 'Unknown user' }, userId)}>@{user?.username || 'unknown'}</button>;
    }
    const channelMention = part.match(/^<#([A-Za-z0-9]+)>$/);
    if (channelMention) return <span className="mx-0.5 inline rounded bg-[#3f4249] px-1 text-gray-100" key={`${part}-${index}`}>#{channels[channelMention[1]]?.name || 'unknown-channel'}</span>;
    
    // Check for Custom Emoji Token :ID:
    if (isCustomEmojiToken(part)) {
        const customEmoji = resolveCustomEmojiMeta(part, customEmojiById);
        return <span className="mx-0.5 inline-flex items-center" key={`${part}-${index}`} title={`${customEmoji?.name || part}`}>{renderEmojiVisual(part, customEmoji, cdnUrl)}</span>;
    }
    
    // Check for Shortcodes
    const shortcodeMatch = part.match(/^:([a-z0-9_+-]+):$/i);
    if (shortcodeMatch) {
       const mapped = EMOJI_SHORTCODES[shortcodeMatch[1].toLowerCase()];
       if (mapped) return renderTwemoji(mapped);
    }
    
    const textElement = renderMarkdownInline(part, `md-${index}`, onRequestOpenLink);
    return typeof textElement === 'string' ? <React.Fragment key={`${part}-${index}`}>{renderTwemoji(textElement)}</React.Fragment> : <React.Fragment key={`${part}-${index}`}>{textElement}</React.Fragment>;
  });
};

const withoutClearedFields = (base, clear = []) => {
  if (!clear?.length) return base;
  const next = { ...base };
  clear.forEach((field) => { const key = field?.[0]?.toLowerCase() + field?.slice(1); if (key) delete next[key]; });
  return next;
};

const uniqueMessages = (list) => {
  const seen = new Set();
  return list.filter((item) => { if (!item?._id || seen.has(item._id)) return false; seen.add(item._id); return true; });
};

const sortRoles = (rolesMap) => !rolesMap ? [] : Object.entries(rolesMap).map(([id, role]) => ({ id, ...role })).sort((a, b) => (b.rank || 0) - (a.rank || 0));
const getMemberHighestRole = (member, sortedRoles) => {
  if (!member.roles?.length) return null;
  for (const role of sortedRoles) { if (member.roles.includes(role.id)) return role; }
  return null;
};
const getMemberHoistedRole = (member, sortedRoles) => {
  if (!member.roles?.length) return null;
  for (const role of sortedRoles) { if (member.roles.includes(role.id) && role.hoist) return role; }
  return null;
};
const organizeMembers = (members, rolesMap, users) => {
  const sortedRoles = sortRoles(rolesMap);
  const groups = {};
  const onlineKey = 'Online';
  const offlineKey = 'Offline';
  sortedRoles.filter(r => r.hoist).forEach(role => { groups[role.id] = { id: role.id, name: role.name, color: role.colour, rank: role.rank, members: [] }; });
  groups[onlineKey] = { id: onlineKey, name: 'Online', color: null, rank: -1, members: [] };
  groups[offlineKey] = { id: offlineKey, name: 'Offline', color: null, rank: -2, members: [] };

  members.forEach(member => {
    const user = users[member._id.user];
    if (!user) return;
    const hoistedRole = getMemberHoistedRole(member, sortedRoles);
    const highestRole = getMemberHighestRole(member, sortedRoles);
    const isOffline = !user.status || user.status.presence === 'Invisible' || user.status.presence === 'Offline';
    const enrichedMember = { ...member, user, color: highestRole?.colour || null };
    if (hoistedRole && !isOffline) {
      if (!groups[hoistedRole.id]) groups[hoistedRole.id] = { id: hoistedRole.id, name: hoistedRole.name, color: hoistedRole.colour, rank: hoistedRole.rank, members: [] };
      groups[hoistedRole.id].members.push(enrichedMember);
    } else {
      groups[isOffline ? offlineKey : onlineKey].members.push(enrichedMember);
    }
  });

  const flatList = [];
  const sortedGroups = Object.values(groups).filter(g => g.members.length > 0).sort((a, b) => b.rank - a.rank);
  sortedGroups.forEach(group => {
    flatList.push({ type: 'header', key: `header-${group.id}`, name: group.name, count: group.members.length, color: group.color });
    const sortedMembers = group.members.sort((a, b) => {
       const nameA = a.nickname || a.user?.username || '';
       const nameB = b.nickname || b.user?.username || '';
       return nameA.localeCompare(nameB);
    });
    sortedMembers.forEach(m => flatList.push({ type: 'member', key: m._id.user, data: m }));
  });
  return flatList;
};

// --- Message Component ---
const Message = memo(({ 
  message, users, channels, me, onUserClick, cdnUrl, 
  onToggleReaction, onReply, replyTarget, onJumpToMessage, 
  registerMessageRef, customEmojiById, reactionOptions, onRequestOpenLink,
  onEditMessage, onDeleteMessage, replyMessageMap
}) => {
  const authorId = typeof message.author === 'string' ? message.author : message.author?._id;
  const author = users[authorId] || (typeof message.author === 'object' ? message.author : null) || { username: 'Unknown user' };
  const mine = me === authorId;
  const messageReactions = toReactionEntries(message.reactions);
  
  const replyId = getReplyIdFromMessage(message);
  const fullReplyMessage = replyId ? (replyMessageMap[replyId] || (message.replyMessage?._id === replyId ? message.replyMessage : null)) : null;
  const replyAuthorId = fullReplyMessage ? (typeof fullReplyMessage.author === 'string' ? fullReplyMessage.author : fullReplyMessage.author?._id) : message.replyMessage?.authorId;
  const replyUser = replyAuthorId ? users[replyAuthorId] : message.replyMessage?.authorUser;
  
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isMessageHovered, setIsMessageHovered] = useState(false);
  
  const embeddedLinks = useMemo(() => extractUrls(message.content || ''), [message.content]);
  const [resolvedImages, setResolvedImages] = useState([]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  
  const pickerRef = useRef(null);

  useEffect(() => {
     if (!showReactionPicker) return;
     const handleClickOutside = (event) => {
        if (pickerRef.current && !pickerRef.current.contains(event.target)) setShowReactionPicker(false);
     };
     document.addEventListener('mousedown', handleClickOutside);
     return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showReactionPicker]);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const results = await Promise.all(embeddedLinks.map(async (url) => {
         if (/^https?:\/\/media\.tenor\.com\//i.test(url)) {
             try {
               const response = await fetch(`https://tenor.com/oembed?url=${encodeURIComponent(url)}`);
               if (!response.ok) return { url, type: 'image', src: url }; 
               const data = await response.json();
               return { url, type: 'image', src: data?.url || data?.thumbnail_url || url };
             } catch { return { url, type: 'image', src: url }; }
         }
         if (isEmbeddableImageLink(url)) {
             return { url, type: 'image', src: url };
         }
         return null;
      }));
      const validResults = results.filter(Boolean);
      if (!cancelled) setResolvedImages(validResults);
    };
    if(embeddedLinks.length > 0) resolve(); else setResolvedImages([]);
    return () => { cancelled = true; };
  }, [embeddedLinks]);

  const contentWithoutLinks = useMemo(() => {
    let next = message.content || '';
    return next.trim();
  }, [message.content]);
  
  const startEditing = () => { setEditContent(message.content || ''); setIsEditing(true); setShowReactionPicker(false); };
  const saveEdit = () => { if (editContent.trim() !== message.content) onEditMessage(message._id, editContent); setIsEditing(false); };
  const cancelEdit = () => { setIsEditing(false); setEditContent(''); };

  const timestampDisplay = message.createdAt 
    ? formatSmartTime(message.createdAt) 
    : formatSmartTime(message._id);

  return (
    <article 
      className={`group relative flex gap-3 px-4 py-0.5 hover:bg-[#2e3035] ${replyTarget === message._id ? 'bg-[#3a3f66]/20' : ''}`} 
      onMouseEnter={() => setIsMessageHovered(true)} 
      onMouseLeave={() => setIsMessageHovered(false)} 
      ref={(node) => registerMessageRef(message._id, node)}
    >
      <button className="mt-0.5" onClick={() => onUserClick(author, authorId)} type="button">
        <Avatar alwaysAnimate={isMessageHovered} cdnUrl={cdnUrl} user={author} />
      </button>
      <div className="min-w-0 flex-1 py-1">
        {replyId ? (
          <button
            className="mb-1 flex max-w-full items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
            onClick={() => onJumpToMessage(replyId)}
            type="button"
          >
            <Reply size={12} />
            <span className="truncate">Replying to {replyUser?.username || 'Unknown user'}: {fullReplyMessage?.content || message.replyMessage?.content || 'Attachment / embed'}</span>
          </button>
        ) : null}
        
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <button className="text-sm font-semibold text-white hover:underline" onClick={() => onUserClick(author, authorId)} type="button" style={{ color: message.author?.color }}>{author.username}</button>
            {mine && <span className="rounded bg-[#5865f2]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#bdc3ff]">YOU</span>}
            <time className="text-[11px] text-gray-500">{timestampDisplay}</time>
            {message.edited && <span className="text-[10px] text-gray-500">(edited)</span>}
          </div>
        </div>

        {isEditing ? (
          <div className="mt-1 bg-[#383a40] p-2 rounded">
            <input className="w-full bg-transparent text-gray-200 text-sm focus:outline-none mb-2" value={editContent} onChange={(e) => setEditContent(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) saveEdit(); if (e.key === 'Escape') cancelEdit(); }} />
            <div className="text-xs text-gray-400 flex gap-2"><span className="flex-1">escape to cancel • enter to save</span><button onClick={cancelEdit} className="hover:underline text-[#ed4245]">cancel</button><button onClick={saveEdit} className="hover:underline text-[#5865f2]">save</button></div>
          </div>
        ) : (
          <>
             {contentWithoutLinks ? <p className="whitespace-pre-wrap break-words text-sm text-gray-200">{renderMessageContent(contentWithoutLinks, users, channels, onUserClick, customEmojiById, cdnUrl, onRequestOpenLink)}</p> : null}
          </>
        )}

        {resolvedImages.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {resolvedImages.map((img, idx) => (
              <button className="block overflow-hidden rounded-lg border border-[#2f3237]" key={`${img.url}-${idx}`} onClick={() => onRequestOpenLink(img.url)} title={img.url} type="button">
                <img alt="Embed" className="max-h-64 max-w-full object-contain" src={img.src} loading="lazy" />
              </button>
            ))}
          </div>
        )}
        
        {Array.isArray(message.attachments) && message.attachments.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {message.attachments.map((attachment, index) => {
              const { attachmentId, filename, url, image } = getAttachmentData(attachment, cdnUrl, index);
              if (!attachmentId || !url) return null;
              if (image) return <a className="block overflow-hidden rounded border border-[#3a3d42]" href={url} key={attachmentId} rel="noreferrer" target="_blank" title={filename}><img alt={filename} className="max-h-64 max-w-full object-contain" src={url} /></a>;
              return <a className="rounded bg-[#232428] px-2 py-1 text-xs text-[#bdc3ff] hover:bg-[#2f3136]" href={url} key={attachmentId} rel="noreferrer" target="_blank">📎 {filename}</a>;
            })}
          </div>
        )}
        
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {messageReactions.map(({ emoji, userIds }) => {
            const reacted = userIds.includes(me);
            const customEmoji = resolveCustomEmojiMeta(emoji, customEmojiById);
            return (
              <button className={`rounded-full border px-2 py-0.5 text-xs flex items-center gap-1 ${reacted ? 'border-[#5865f2] bg-[#5865f2]/20 text-[#d7ddff]' : 'border-[#4c4f56] bg-[#2b2d31] text-gray-200 hover:bg-[#35373c]'}`} key={emoji} onClick={() => onToggleReaction(message, emoji, reacted)} title={`${customEmoji?.name || emoji}`} type="button">
                {renderEmojiVisual(emoji, customEmoji, cdnUrl)} {userIds.length}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`absolute right-4 -top-2 z-10 ${isMessageHovered || showReactionPicker ? 'opacity-100' : 'opacity-0'} transition-opacity duration-100`}>
         <div className="flex items-center bg-[#313338] border border-[#2f3237] rounded shadow-sm">
            <button className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#404249] rounded-l" onClick={() => onReply(message)} title="Reply"><Reply size={14} /></button>
            <button className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#404249]" onClick={() => setShowReactionPicker(!showReactionPicker)} title="Add Reaction"><Smile size={14} /></button>
            {mine && (
              <>
                <button className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#404249]" onClick={startEditing} title="Edit"><Edit2 size={14} /></button>
                <button className="p-1.5 text-red-400 hover:text-red-200 hover:bg-[#404249] rounded-r" onClick={() => onDeleteMessage(message._id)} title="Delete"><Trash2 size={14} /></button>
              </>
            )}
         </div>
      </div>

      {showReactionPicker && (
        <div ref={pickerRef} onMouseLeave={() => setShowReactionPicker(false)} className="absolute right-0 bottom-8 z-30 w-72 max-h-64 rounded-lg border border-[#4c4f56] bg-[#232428] p-2 shadow-2xl overflow-y-auto">
          <p className="mb-2 px-1 text-[10px] uppercase tracking-wide text-gray-500 font-bold sticky top-0 bg-[#232428] z-10">Standard</p>
          <div className="grid grid-cols-8 gap-1 mb-2">
            {STANDARD_EMOJIS.map((emoji) => (
               <button
                className="grid h-8 place-items-center rounded hover:bg-[#3a3d42]"
                key={emoji}
                onClick={() => {
                  onToggleReaction(message, emoji, message.reactions?.[emoji]?.includes(me));
                  setShowReactionPicker(false);
                }}
                type="button"
              >
                {renderTwemoji(emoji, "w-5 h-5")}
              </button>
            ))}
          </div>
           {reactionOptions.some(o => o.custom) && (
              <>
                <p className="mb-2 px-1 text-[10px] uppercase tracking-wide text-gray-500 font-bold sticky top-0 bg-[#232428] z-10">Custom</p>
                <div className="grid grid-cols-8 gap-1">
                  {reactionOptions.filter(o => o.custom).map((option) => (
                    <button
                      className="grid h-8 place-items-center rounded hover:bg-[#3a3d42]"
                      key={option.value}
                      onClick={() => {
                        onToggleReaction(message, option.value, message.reactions?.[option.value]?.includes(me));
                        setShowReactionPicker(false);
                      }}
                      title={option.title}
                      type="button"
                    >
                      {renderEmojiVisual(option.value, option.custom, cdnUrl)}
                    </button>
                  ))}
                </div>
              </>
           )}
        </div>
      )}
    </article>
  );
});

// --- AppShell ---
function AppShell() {
  const [view, setView] = useState('loading');
  const [status, setStatus] = useState('disconnected');
  const [config, setConfig] = useState({ apiUrl: DEFAULT_API_URL, wsUrl: DEFAULT_WS_URL, cdnUrl: DEFAULT_CDN_URL });
  const [auth, setAuth] = useState({ token: null, userId: null });
  const [peekUser, setPeekUser] = useState(null);
  
  // Define openUserProfile callback first since it is used in other helpers
  const openUserProfile = useCallback((user, fallbackId = null) => {
    const stableId = user?._id || fallbackId || 'unknown-user';
    setPeekUser({ ...user, _id: stableId, username: user?.username || 'Unknown user', discriminator: user?.discriminator || '0000' });
  }, []);

  const [servers, setServers] = useState({});
  const [channels, setChannels] = useState({});
  const [users, setUsers] = useState({});
  const [members, setMembers] = useState({});
  const [messages, setMessages] = useState({});
  const [selectedServerId, setSelectedServerId] = useState('@me');
  const [selectedChannelId, setSelectedChannelId] = useState('friends');
  const [inputText, setInputText] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [createServerName, setCreateServerName] = useState('');
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');
  const [showGoLatest, setShowGoLatest] = useState(false);
  const [linkPromptUrl, setLinkPromptUrl] = useState(null);
  const [statusDraft, setStatusDraft] = useState({ presence: 'Online', text: '' });
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isAccountHovered, setIsAccountHovered] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [editServerName, setEditServerName] = useState('');
  const [isUpdatingServer, setIsUpdatingServer] = useState(false);
  const [loginMode, setLoginMode] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [wsReconnectAttempt, setWsReconnectAttempt] = useState(0);

  const wsRef = useRef(null);
  const messagesBottomRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const subscriptionRef = useRef({});
  const preloadedChannelRef = useRef({});
  const preloadedMembersRef = useRef({});
  const pendingUserFetchRef = useRef(new Set());
  const membersLoadIdRef = useRef(0);
  const canFetchMissingUsersRef = useRef(true);
  const loggedMissingUserFetchErrorRef = useRef(false);
  const wsReconnectTimeoutRef = useRef(null);
  const messageRefs = useRef({});
  const replyMessageCacheRef = useRef({});
  const fileInputRef = useRef(null);
  const autoFollowRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  
  const pickerRef = useRef(null);

  useEffect(() => {
     if (!showEmojiPicker) return;
     const handleClickOutside = (event) => {
        if (pickerRef.current && !pickerRef.current.contains(event.target)) setShowEmojiPicker(false);
     };
     document.addEventListener('mousedown', handleClickOutside);
     return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // --- Helper Functions in Scope ---
  const isSameOriginApi = useMemo(() => { try { return new URL(config.apiUrl).origin === window.location.origin; } catch { return false; } }, [config.apiUrl]);

  const upsertUsers = useCallback((list = []) => {
     if (!list.length) return;
     setUsers((prev) => {
        const next = { ...prev };
        list.forEach((user) => { if (user?._id) next[user._id] = user; });
        return next;
     });
  }, []);

  // --- Render Item Helper ---
  // Defined here so it can access config.cdnUrl and openUserProfile from closure
  const renderMemberItem = useCallback((item) => {
    if (item.type === 'header') return <div className="pt-4 pb-1 px-4 text-xs font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1">{item.name} — {item.count}</div>;
    const member = item.data;
    return (
      <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-[#35373c]" onClick={() => openUserProfile(member.user, member._id.user)}>
        <Avatar animateOnHover cdnUrl={config.cdnUrl} size="sm" user={member.user} />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium" style={{ color: member.color || '#f2f3f5' }}>{member.nickname || member.user.username}</div>
          <div className="flex items-center gap-1 text-[11px] text-gray-500"><User size={11} /> {member.user.status?.presence || 'Offline'}</div>
        </div>
      </button>
    );
  }, [config.cdnUrl, openUserProfile]);

  const upsertUsersFromMessages = useCallback((messageList = []) => {
     const embeddedUsers = [];
     messageList.forEach((entry) => {
        if (entry?.author && typeof entry.author === 'object' && entry.author._id) embeddedUsers.push(entry.author);
        if (entry?.user?._id) embeddedUsers.push(entry.user);
     });
     upsertUsers(embeddedUsers);
  }, [upsertUsers]);

  const fetchMembers = useCallback(async (serverId) => {
    if (serverId === '@me') return;
    const loadId = Date.now();
    membersLoadIdRef.current = loadId;
    setIsMembersLoading(true);
    try {
      const res = await fetch(`${config.apiUrl}/servers/${serverId}/members`, { headers: { 'x-session-token': auth.token } });
      if (!res.ok) return;
      const data = await res.json();
      upsertUsers(data.users || []);
      const payloadMembers = data.members || [];
      for (let index = 0; index < payloadMembers.length; index += MEMBER_HYDRATE_CHUNK) {
        if (membersLoadIdRef.current !== loadId) break;
        const chunk = payloadMembers.slice(index, index + MEMBER_HYDRATE_CHUNK);
        setMembers((prev) => {
           const next = { ...prev };
           chunk.forEach((member) => { next[`${member._id.server}:${member._id.user}`] = member; });
           return next;
        });
        if (index + MEMBER_HYDRATE_CHUNK < payloadMembers.length) await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } catch {} finally {
      if (membersLoadIdRef.current === loadId) setIsMembersLoading(false);
    }
  }, [auth.token, config.apiUrl, upsertUsers]);

  const fetchMissingUsers = useCallback(async (messageList = []) => {
    if (!canFetchMissingUsersRef.current || !isSameOriginApi) return;
    const unresolved = new Set();
    messageList.forEach((entry) => {
      const authorId = typeof entry?.author === 'string' ? entry.author : entry?.author?._id;
      if (authorId && authorId !== '00000000000000000000000000' && !users[authorId] && !pendingUserFetchRef.current.has(authorId)) unresolved.add(authorId);
      const replyId = getReplyIdFromMessage(entry);
      if (replyId) {
         const cachedReply = replyMessageCacheRef.current[replyId];
         const replyAuthorId = cachedReply ? (typeof cachedReply.author === 'string' ? cachedReply.author : cachedReply.author?._id) : entry.replyMessage?.authorId;
         if (replyAuthorId && replyAuthorId !== '00000000000000000000000000' && !users[replyAuthorId] && !pendingUserFetchRef.current.has(replyAuthorId)) unresolved.add(replyAuthorId);
      }
    });
    if (!unresolved.size) return;
    const MAX_BACKGROUND_USER_FETCHES = 6;
    const limitedIds = [...unresolved].slice(0, MAX_BACKGROUND_USER_FETCHES);
    limitedIds.forEach((id) => pendingUserFetchRef.current.add(id));
    await Promise.all(
      limitedIds.map(async (userId) => {
        try {
          const res = await fetch(`${config.apiUrl}/users/${userId}`, { headers: { 'x-session-token': auth.token } });
          if (!res.ok) { if (res.status === 401 || res.status === 403 || res.status === 405) canFetchMissingUsersRef.current = false; return; }
          const data = await res.json();
          if (data?._id) upsertUsers([data]);
        } catch (error) {
          const message = (error && error.message) || '';
          if (message.includes('Failed to fetch') || message.includes('CORS')) canFetchMissingUsersRef.current = false;
          if (!loggedMissingUserFetchErrorRef.current) { loggedMissingUserFetchErrorRef.current = true; console.warn('Disabling background user lookup due to network/CORS restrictions.'); }
        } finally { pendingUserFetchRef.current.delete(userId); }
      }),
    );
  }, [auth.token, config.apiUrl, isSameOriginApi, upsertUsers, users]);

  const fetchReplyMessage = useCallback(async (channelId, replyId) => {
    if (!channelId || !replyId || replyMessageCacheRef.current[replyId]) return;
    try {
      const res = await fetch(`${config.apiUrl}/channels/${channelId}/messages/${replyId}`, { headers: { 'x-session-token': auth.token } });
      if (!res.ok) return;
      const data = await res.json();
      if (!data?._id) return;
      replyMessageCacheRef.current[replyId] = data;
      upsertUsersFromMessages([data]);
      setMessages((prev) => ({ ...prev, [channelId]: [...(prev[channelId] || [])] }));
    } catch {}
  }, [auth.token, config.apiUrl, upsertUsersFromMessages]);

  const fetchMessages = useCallback(async (channelId, beforeId = null) => {
    if (!channelId || channelId === 'friends') return;
    try {
      const url = `${config.apiUrl}/channels/${channelId}/messages?limit=100${beforeId ? `&before=${beforeId}` : ''}`;
      const res = await fetch(url, { headers: { 'x-session-token': auth.token } });
      if (!res.ok) return;
      const data = await res.json();
      const payloadMessages = Array.isArray(data) ? data : data.messages || [];
      const payloadUsers = Array.isArray(data) ? [] : data.users || [];
      if (payloadUsers.length) upsertUsers(payloadUsers);
      upsertUsersFromMessages(payloadMessages);
      
      const orderedMessages = payloadMessages.reverse();
      
      setMessages((prev) => {
          const existing = prev[channelId] || [];
          if (beforeId) {
             // Merging older messages
             return { ...prev, [channelId]: uniqueMessages([...orderedMessages, ...existing]) };
          } else {
             // Initial load or new load
             return { ...prev, [channelId]: uniqueMessages(orderedMessages) };
          }
      });
      
      void fetchMissingUsers(orderedMessages);
      if (!beforeId) preloadedChannelRef.current[channelId] = true;
    } catch {}
  }, [auth.token, config.apiUrl, upsertUsers, upsertUsersFromMessages, fetchMissingUsers]);


  // --- Derived State ---
  const serverList = useMemo(() => Object.values(servers), [servers]);
  const channelList = useMemo(() => selectedServerId === '@me' ? [] : Object.values(channels).filter((ch) => ch.server === selectedServerId), [channels, selectedServerId]);
  const directMessageChannels = useMemo(() => Object.values(channels).filter((channel) => channel?.channel_type === 'DirectMessage'), [channels]);
  const currentMessages = useMemo(() => uniqueMessages(messages[selectedChannelId] || []), [messages, selectedChannelId]);
  const currentMessageMap = useMemo(() => Object.fromEntries(currentMessages.map((message) => [message._id, message])), [currentMessages]);
  const globalReplyMessageMap = useMemo(() => ({ ...currentMessageMap, ...replyMessageCacheRef.current }), [currentMessageMap]);
  const activeReply = useMemo(() => replyingTo ? currentMessageMap[replyingTo._id] || replyingTo : null, [replyingTo, currentMessageMap]);

  const currentChannelName = useMemo(() => {
    if (selectedChannelId === 'friends') return 'friends';
    const channel = channels[selectedChannelId];
    if (channel?.name) return channel.name;
    if (channel?.channel_type === 'DirectMessage') {
      const recipientId = (channel.recipients || []).find((id) => id !== auth.userId);
      return users[recipientId]?.username || 'direct-message';
    }
    return 'select-a-channel';
  }, [selectedChannelId, channels, auth.userId, users]);

  const allCurrentMembers = useMemo(() => selectedServerId === '@me' ? [] : Object.values(members).filter((member) => member._id.server === selectedServerId), [members, selectedServerId]);
  const friends = useMemo(() => Object.values(users).filter((u) => u.relationship === 'Friend' || u.relationship === 1), [users]);
  const selectedServer = servers[selectedServerId];
  const isServerOwner = selectedServer?.owner === auth.userId;
  const memberListItems = useMemo(() => selectedServerId === '@me' || !selectedServer ? [] : organizeMembers(allCurrentMembers, selectedServer.roles || {}, users), [allCurrentMembers, selectedServer, users, selectedServerId]);

  const customEmojis = useMemo(() => {
    if (!selectedServer || selectedServerId === '@me') return [];
    const source = selectedServer.emojis || selectedServer.emoji || [];
    if (Array.isArray(source)) return source.map((entry) => ({ id: entry?._id || entry?.id, name: entry?.name || entry?._id || 'emoji' }));
    return Object.entries(source).map(([id, value]) => ({ id, name: value?.name || id }));
  }, [selectedServer, selectedServerId]);

  const allCustomEmojis = useMemo(() => {
    const all = [];
    Object.values(servers).forEach(server => {
      const source = server.emojis || server.emoji || [];
      const entries = Array.isArray(source) ? source : Object.entries(source).map(([id, val]) => ({ id, ...val }));
      entries.forEach(emoji => { if(emoji.id || emoji._id) all.push({ id: emoji.id || emoji._id, name: emoji.name, serverName: server.name, animated: emoji.animated, isPrivate: server.discoverable === false }); });
    });
    return all;
  }, [servers]);

  const customEmojiById = useMemo(() => {
    const index = {};
    Object.values(servers).forEach((server) => {
      const source = server?.emojis || server?.emoji || [];
      const entries = Array.isArray(source) ? source.map((emoji) => ({ id: emoji?._id || emoji?.id, name: emoji?.name })) : Object.entries(source || {}).map(([id, emoji]) => ({ id, name: emoji?.name }));
      entries.forEach((emoji) => { if (emoji?.id) index[emoji.id] = { id: emoji.id, name: emoji.name || emoji.id, serverName: server?.name, isPrivate: server?.discoverable === false }; });
    });
    return index;
  }, [servers]);

  const reactionOptions = useMemo(() => {
    const base = STANDARD_EMOJIS.map((emoji) => ({ value: emoji, label: emoji, title: emoji, custom: null }));
    const serverSet = allCustomEmojis.map((emoji) => {
      const source = emoji.isPrivate ? 'Private' : emoji.serverName;
      return { value: `:${emoji.id}:`, label: emoji.name, title: `${emoji.name} · ${source}`, custom: { id: emoji.id, name: emoji.name } };
    });
    return [...base, ...serverSet];
  }, [allCustomEmojis]);

  const peekMember = useMemo(() => !peekUser?._id || selectedServerId === '@me' ? null : members[`${selectedServerId}:${peekUser._id}`], [members, peekUser, selectedServerId]);
  const peekRoles = useMemo(() => !peekMember || !selectedServer?.roles ? [] : (peekMember.roles || []).map((roleId) => selectedServer.roles?.[roleId]).filter(Boolean), [peekMember, selectedServer]);
  const peekBadges = useMemo(() => {
    if (!peekUser?.badges) return [];
    if (Array.isArray(peekUser.badges)) return peekUser.badges;
    if (typeof peekUser.badges === 'number') {
      const flagMap = { 1: 'Developer', 2: 'Translator', 4: 'Supporter', 8: 'Founder', 16: 'Platform Moderation', 32: 'Active Supporter', 64: 'Paw' };
      return Object.entries(flagMap).filter(([bit]) => (peekUser.badges & Number(bit)) === Number(bit)).map(([, label]) => label);
    }
    if (typeof peekUser.badges === 'object') return Object.entries(peekUser.badges).filter(([, enabled]) => Boolean(enabled)).map(([badge]) => badge);
    return [];
  }, [peekUser]);
  const peekAboutMe = useMemo(() => peekUser?.profile?.content || peekUser?.profile?.bio || peekUser?.bio || null, [peekUser]);
  const peekPlatformJoined = useMemo(() => getJoinedAt(peekUser), [peekUser]);
  const peekServerJoined = useMemo(() => getJoinedAt(peekMember), [peekMember]);
  const peekBannerUrl = useMemo(() => getBannerUrl(peekUser, config.cdnUrl), [peekUser, config.cdnUrl]);


  const discoverConfig = async (apiUrl) => {
    try {
      const res = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      setConfig((prev) => ({ ...prev, apiUrl, wsUrl: data.ws || prev.wsUrl, cdnUrl: data.features?.autumn?.url || prev.cdnUrl }));
    } catch {}
  };

  useEffect(() => { const savedToken = getCookie(TOKEN_COOKIE_NAME) || localStorage.getItem('stoat_token'); const savedUserId = getCookie(USER_COOKIE_NAME) || localStorage.getItem('stoat_user_id'); const savedApi = getCookie(API_COOKIE_NAME) || localStorage.getItem('stoat_api_url'); const api = savedApi || DEFAULT_API_URL; setConfig((prev) => ({ ...prev, apiUrl: api })); discoverConfig(api); if (savedToken && savedUserId) { setAuth({ token: savedToken, userId: savedUserId }); setView('app'); } else { setView('login'); } }, []);

  const applyEvent = (packet) => {
    if (!packet?.type) return;
    switch (packet.type) {
      case 'Ready': setUsers((prev) => { const next = { ...prev }; packet.users?.forEach((u) => { next[u._id] = u; }); return next; }); setServers((prev) => { const next = { ...prev }; packet.servers?.forEach((s) => { next[s._id] = s; }); return next; }); setChannels((prev) => { const next = { ...prev }; packet.channels?.forEach((c) => { next[c._id] = c; }); return next; }); setMembers((prev) => { const next = { ...prev }; packet.members?.forEach((m) => { next[`${m._id.server}:${m._id.user}`] = m; }); return next; }); setStatus('ready'); break;
      case 'Bulk': packet.v?.forEach(applyEvent); break;
      case 'Authenticated': setStatus('authenticated'); break;
      case 'Error': setStatus(`error:${packet.error || 'unknown'}`); break;
      case 'Logout': logout(); break;
      case 'Message': upsertUsersFromMessages([packet]); void fetchMissingUsers([packet]); setMessages((prev) => { const list = prev[packet.channel] || []; if (list.some((m) => m._id === packet._id)) return prev; const nextMessages = [...list, packet].slice(-200); return { ...prev, [packet.channel]: uniqueMessages(nextMessages) }; }); break;
      case 'MessageUpdate': setMessages((prev) => ({ ...prev, [packet.channel]: uniqueMessages((prev[packet.channel] || []).map((m) => (m._id === packet.id ? { ...m, ...packet.data, edited: new Date().toISOString() } : m))) })); break;
      case 'MessageDelete': setMessages((prev) => ({ ...prev, [packet.channel]: (prev[packet.channel] || []).filter((m) => m._id !== packet.id) })); break;
      case 'ChannelCreate': setChannels((prev) => ({ ...prev, [packet._id]: packet })); break;
      case 'ChannelUpdate': setChannels((prev) => ({ ...prev, [packet.id]: withoutClearedFields({ ...prev[packet.id], ...packet.data }, packet.clear) })); break;
      case 'ChannelDelete': setChannels((prev) => { const next = { ...prev }; delete next[packet.id]; return next; }); break;
      case 'ServerCreate': setServers((prev) => ({ ...prev, [packet._id]: packet })); break;
      case 'ServerUpdate': setServers((prev) => ({ ...prev, [packet.id]: withoutClearedFields({ ...prev[packet.id], ...packet.data }, packet.clear) })); break;
      case 'ServerDelete': setServers((prev) => { const next = { ...prev }; delete next[packet.id]; return next; }); if (selectedServerId === packet.id) handleServerSelect('@me'); break;
      case 'ServerMemberUpdate': { const key = `${packet.id.server}:${packet.id.user}`; setMembers((prev) => ({ ...prev, [key]: withoutClearedFields({ ...prev[key], _id: packet.id, ...packet.data }, packet.clear) })); break; }
      case 'ServerMemberJoin': setMembers((prev) => ({ ...prev, [`${packet.id}:${packet.user}`]: { ...packet.member, _id: { server: packet.id, user: packet.user } } })); break;
      case 'ServerMemberLeave': setMembers((prev) => { const next = { ...prev }; delete next[`${packet.id}:${packet.user}`]; return next; }); break;
      case 'UserUpdate': setUsers((prev) => ({ ...prev, [packet.id]: withoutClearedFields({ ...prev[packet.id], ...packet.data }, packet.clear) })); break;
      default:
    }
  };

  useEffect(() => {
    if (!auth.token || view !== 'app') return;
    let wsUrl = config.wsUrl;
    try { const parsed = new URL(wsUrl.startsWith('ws') ? wsUrl : `wss://${wsUrl}`); parsed.searchParams.set('version', '1'); parsed.searchParams.set('format', 'json'); parsed.searchParams.set('token', auth.token); wsUrl = parsed.toString(); } catch { wsUrl = `${DEFAULT_WS_URL}?version=1&format=json&token=${encodeURIComponent(auth.token)}`; }
    setStatus('connecting');
    if (wsRef.current) wsRef.current.close();
    if (wsReconnectTimeoutRef.current) { clearTimeout(wsReconnectTimeoutRef.current); wsReconnectTimeoutRef.current = null; }
    let isUnmounting = false;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;
    socket.onerror = () => setStatus('error');
    socket.onclose = () => { setStatus((prev) => (prev === 'error' ? prev : 'disconnected')); if (isUnmounting || view !== 'app') return; wsReconnectTimeoutRef.current = setTimeout(() => { setWsReconnectAttempt((value) => value + 1); }, 2500); };
    socket.onmessage = (event) => applyEvent(JSON.parse(event.data));
    const heartbeat = setInterval(() => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'Ping', data: Date.now() })); }, 20000);
    return () => { isUnmounting = true; clearInterval(heartbeat); if (wsReconnectTimeoutRef.current) { clearTimeout(wsReconnectTimeoutRef.current); wsReconnectTimeoutRef.current = null; } socket.close(); };
  }, [auth.token, config.wsUrl, view, wsReconnectAttempt]);

  useEffect(() => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || selectedServerId === '@me') return;
    const sendSubscribe = () => { if (document.visibilityState !== 'visible' || !window.document.hasFocus()) return; const lastSent = subscriptionRef.current[selectedServerId] || 0; if (Date.now() - lastSent < 10 * 60 * 1000) return; socket.send(JSON.stringify({ type: 'Subscribe', server_id: selectedServerId })); subscriptionRef.current[selectedServerId] = Date.now(); };
    sendSubscribe();
    window.addEventListener('focus', sendSubscribe); document.addEventListener('visibilitychange', sendSubscribe); const interval = setInterval(sendSubscribe, 60 * 1000);
    return () => { clearInterval(interval); window.removeEventListener('focus', sendSubscribe); document.removeEventListener('visibilitychange', sendSubscribe); };
  }, [selectedServerId, status]);

  const isNearBottom = () => { const container = messagesContainerRef.current; if (!container) return true; return container.scrollHeight - container.scrollTop - container.clientHeight <= 72; };

  useEffect(() => { const container = messagesContainerRef.current; if (!container) return; autoFollowRef.current = true; const handleScroll = () => { if (isProgrammaticScrollRef.current) return; const nearBottom = isNearBottom(); autoFollowRef.current = nearBottom; setShowGoLatest((prev) => (prev === !nearBottom ? prev : !nearBottom)); }; container.addEventListener('scroll', handleScroll); return () => container.removeEventListener('scroll', handleScroll); }, [selectedChannelId]);
  useEffect(() => { if (autoFollowRef.current || isNearBottom()) { isProgrammaticScrollRef.current = true; messagesBottomRef.current?.scrollIntoView({ behavior: 'auto' }); requestAnimationFrame(() => { isProgrammaticScrollRef.current = false; }); autoFollowRef.current = true; setShowGoLatest(false); return; } setShowGoLatest(true); }, [currentMessages]);
  useEffect(() => { if (!selectedChannelId || selectedChannelId === 'friends') return; const missingReplyIds = currentMessages.map((message) => getReplyIdFromMessage(message)).filter((replyId) => replyId && !replyMessageCacheRef.current[replyId] && !currentMessageMap[replyId]); [...new Set(missingReplyIds)].slice(0, 10).forEach((replyId) => { void fetchReplyMessage(selectedChannelId, replyId); }); }, [currentMessages, currentMessageMap, selectedChannelId]);
  useEffect(() => { if (!voiceNotice) return; const timeout = setTimeout(() => setVoiceNotice(''), 3500); return () => clearTimeout(timeout); }, [voiceNotice]);
  useEffect(() => { if (status !== 'ready' || !auth.token) return; if (document.visibilityState !== 'visible') return; const maxWarmChannels = Math.min(8, Math.max(3, Math.floor((navigator.hardwareConcurrency || 4) / 2))); const channelsToWarm = Object.values(channels).filter((channel) => channel?.channel_type === 'TextChannel' || !channel?.channel_type).slice(0, maxWarmChannels); channelsToWarm.forEach((channel, index) => { if (!channel?._id || preloadedChannelRef.current[channel._id]) return; setTimeout(() => { fetchMessages(channel._id); }, index * 350); }); }, [status, auth.token, channels, fetchMessages]);


  const handleServerSelect = (serverId) => { setSelectedServerId(serverId); if (serverId === '@me') { setSelectedChannelId('friends'); setReplyingTo(null); setShowEmojiPicker(false); return; } const firstChannel = Object.values(channels).find((ch) => ch.server === serverId && ch.channel_type !== 'VoiceChannel') || Object.values(channels).find((ch) => ch.server === serverId); setSelectedChannelId(firstChannel?._id || null); if (firstChannel?._id) fetchMessages(firstChannel._id); if (!preloadedMembersRef.current[serverId]) { preloadedMembersRef.current[serverId] = true; void fetchMembers(serverId); } };
  const handleChannelSelect = (channelId) => { const channel = channels[channelId]; if (channel?.channel_type === 'VoiceChannel') { setVoiceNotice("Ermine currently doesn't support voice channels."); return; } setVoiceNotice(''); setSelectedChannelId(channelId); setReplyingTo(null); setShowEmojiPicker(false); fetchMessages(channelId); };
  const openDmWithUser = async (userId) => { if (!userId || !auth.token) return; const existing = directMessageChannels.find((channel) => Array.isArray(channel?.recipients) && channel.recipients.includes(userId)); if (existing?._id) { setSelectedServerId('@me'); handleChannelSelect(existing._id); return; } try { const res = await fetch(`${config.apiUrl}/users/${userId}/dm`, { method: 'GET', headers: { 'x-session-token': auth.token } }); if (!res.ok) return; const channel = await res.json(); if (!channel?._id) return; setChannels((prev) => ({ ...prev, [channel._id]: channel })); setSelectedServerId('@me'); setSelectedChannelId(channel._id); fetchMessages(channel._id); } catch {} };
  const jumpToMessage = (messageId) => { if (!messageId) return; const target = messageRefs.current[messageId]; if (!target) return; target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.classList.add('ring-2', 'ring-[#5865f2]', 'bg-[#3a3f66]/40'); setTimeout(() => { target.classList.remove('ring-2', 'ring-[#5865f2]', 'bg-[#3a3f66]/40'); }, 1200); };
  const registerMessageRef = (messageId, node) => { if (!messageId) return; if (node) { messageRefs.current[messageId] = node; } else { delete messageRefs.current[messageId]; } };
  const goToLatest = () => { isProgrammaticScrollRef.current = true; autoFollowRef.current = true; messagesBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); requestAnimationFrame(() => { isProgrammaticScrollRef.current = false; }); setShowGoLatest(false); };
  const requestOpenLink = (url) => { setLinkPromptUrl(url); };
  const confirmOpenLink = () => { if (!linkPromptUrl) return; window.open(linkPromptUrl, '_blank', 'noopener,noreferrer'); setLinkPromptUrl(null); };
  const openStatusEditor = () => { const currentPresence = users[auth.userId]?.status?.presence || 'Online'; const currentText = users[auth.userId]?.status?.text || ''; setStatusDraft({ presence: currentPresence, text: currentText }); setActiveModal('set-status'); };
  const saveStatus = async () => { setIsSavingStatus(true); setUsers((prev) => ({ ...prev, [auth.userId]: { ...(prev[auth.userId] || {}), status: { presence: statusDraft.presence, text: statusDraft.text || undefined } } })); try { await fetch(`${config.apiUrl}/users/@me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-session-token': auth.token }, body: JSON.stringify({ status: { presence: statusDraft.presence, text: statusDraft.text || undefined } }) }); } catch {} finally { setIsSavingStatus(false); setActiveModal(null); } };
  const handleLogin = async (event) => { event.preventDefault(); setLoginError(''); if (!privacyConsent) { setLoginError('Please accept the privacy policy before signing in.'); return; } setIsLoggingIn(true); try { await discoverConfig(config.apiUrl); let token = manualToken.trim(); let userId = null; if (loginMode === 'credentials') { const payload = { email, password, friendly_name: 'Ermine Web Client' }; if (mfaCode.trim()) payload.mfa_response = { totp_code: mfaCode.trim() }; const res = await fetch(`${config.apiUrl}/auth/session/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (!res.ok) throw new Error(res.status === 401 ? 'Invalid credentials or MFA code.' : 'Login failed.'); const data = await res.json(); token = data.token || data.session_token; userId = data.user_id; } else { const meRes = await fetch(`${config.apiUrl}/users/@me`, { headers: { 'x-session-token': token } }); if (!meRes.ok) throw new Error('Token is invalid.'); const meData = await meRes.json(); userId = meData._id; } if (!token || !userId) throw new Error('Session creation failed.'); setCookie(TOKEN_COOKIE_NAME, token); setCookie(USER_COOKIE_NAME, userId); setCookie(API_COOKIE_NAME, config.apiUrl); setAuth({ token, userId }); setView('app'); } catch (error) { setLoginError(error.message || 'Unknown login error'); } finally { setIsLoggingIn(false); } };
  const logout = () => { clearCookie(TOKEN_COOKIE_NAME); clearCookie(USER_COOKIE_NAME); clearCookie(API_COOKIE_NAME); localStorage.removeItem('stoat_token'); localStorage.removeItem('stoat_user_id'); localStorage.removeItem('stoat_api_url'); setAuth({ token: null, userId: null }); setMessages({}); setServers({}); setChannels({}); setUsers({}); setMembers({}); preloadedChannelRef.current = {}; preloadedMembersRef.current = {}; pendingUserFetchRef.current = new Set(); membersLoadIdRef.current = 0; canFetchMissingUsersRef.current = true; loggedMissingUserFetchErrorRef.current = false; setIsMembersLoading(false); setWsReconnectAttempt(0); if (wsReconnectTimeoutRef.current) { clearTimeout(wsReconnectTimeoutRef.current); wsReconnectTimeoutRef.current = null; } setView('login'); setStatus('disconnected'); };
  const sendMessage = async () => { const content = inputText.trim(); const hasContent = Boolean(content); const hasFiles = pendingFiles.length > 0; if ((!hasContent && !hasFiles) || !selectedChannelId || selectedChannelId === 'friends') return; setInputText(''); setIsUploadingFiles(hasFiles); const nonce = crypto.randomUUID(); const pendingId = `pending-${nonce}`; const meUser = users[auth.userId] || { _id: auth.userId, username: 'You' }; const optimisticMessage = { _id: pendingId, channel: selectedChannelId, author: auth.userId, user: meUser, content, createdAt: new Date().toISOString(), reactions: {}, replies: replyingTo ? [{ id: replyingTo._id, mention: false }] : undefined, attachments: pendingFiles.map((file, index) => ({ _id: `pending-attachment-${index}-${file.name}`, filename: file.name })) }; setMessages((prev) => { const list = prev[selectedChannelId] || []; return { ...prev, [selectedChannelId]: uniqueMessages([...list, optimisticMessage]).slice(-200) }; }); try { const attachmentIds = hasFiles ? await uploadFiles(pendingFiles) : []; const payload = { content, nonce, replies: replyingTo ? [{ id: replyingTo._id, mention: false }] : undefined, attachments: attachmentIds.length ? attachmentIds : undefined }; const res = await fetch(`${config.apiUrl}/channels/${selectedChannelId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session-token': auth.token }, body: JSON.stringify(payload) }); if (!res.ok) throw new Error('Failed to send message'); const postedMessage = await res.json(); if (postedMessage?._id) { upsertUsersFromMessages([postedMessage]); setMessages((prev) => { const list = prev[selectedChannelId] || []; let nextList = list.filter((entry) => entry._id !== pendingId); if (!nextList.some(m => m._id === postedMessage._id)) { nextList.push(postedMessage); } else { nextList = nextList.map(m => m._id === postedMessage._id ? postedMessage : m); } nextList.sort((a, b) => (a._id > b._id ? 1 : -1)); return { ...prev, [selectedChannelId]: uniqueMessages(nextList) }; }); } setPendingFiles([]); setReplyingTo(null); setShowEmojiPicker(false); } catch { setMessages((prev) => ({ ...prev, [selectedChannelId]: (prev[selectedChannelId] || []).filter((entry) => entry._id !== pendingId) })); setInputText(content); } finally { setIsUploadingFiles(false); } };
  const editMessage = async (messageId, newContent) => { try { const res = await fetch(`${config.apiUrl}/channels/${selectedChannelId}/messages/${messageId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-session-token': auth.token }, body: JSON.stringify({ content: newContent }) }); if (!res.ok) throw new Error('Failed to edit'); } catch (err) { console.error(err); } };
  const deleteMessage = async (messageId) => { if (!confirm('Are you sure you want to delete this message?')) return; try { const res = await fetch(`${config.apiUrl}/channels/${selectedChannelId}/messages/${messageId}`, { method: 'DELETE', headers: { 'x-session-token': auth.token } }); if (!res.ok) throw new Error('Failed to delete'); } catch (err) { console.error(err); } };
  const toggleReaction = async (message, emoji, reacted) => { if (!message?._id || !selectedChannelId || selectedChannelId === 'friends') return; const encodedEmoji = encodeURIComponent(emoji); setMessages((prev) => { const nextList = (prev[selectedChannelId] || []).map((entry) => { if (entry._id !== message._id) return entry; const existing = entry.reactions?.[emoji] || []; const nextUserIds = reacted ? existing.filter((id) => id !== auth.userId) : [...new Set([...existing, auth.userId])]; return { ...entry, reactions: { ...(entry.reactions || {}), [emoji]: nextUserIds } }; }); return { ...prev, [selectedChannelId]: nextList }; }); try { await fetch(`${config.apiUrl}/channels/${selectedChannelId}/messages/${message._id}/reactions/${encodedEmoji}`, { method: reacted ? 'DELETE' : 'PUT', headers: { 'x-session-token': auth.token } }); } catch {} };
  const addEmojiToComposer = (emoji) => { setInputText((prev) => `${prev}${emoji}`); setShowEmojiPicker(false); };
  const addCustomEmojiToComposer = (emojiId) => { setInputText((prev) => `${prev}:${emojiId}:`); setShowEmojiPicker(false); };
  const handleFilePick = (event) => { const files = Array.from(event.target.files || []); if (!files.length) return; setPendingFiles((prev) => [...prev, ...files]); event.target.value = ''; };
  const handleComposerDrop = (event) => { event.preventDefault(); const files = Array.from(event.dataTransfer?.files || []); if (!files.length) return; setPendingFiles((prev) => [...prev, ...files]); };
  const handleComposerDragOver = (event) => { event.preventDefault(); };
  const removePendingFile = (index) => { setPendingFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index)); };
  const uploadFiles = async (files = []) => { const ids = []; for (const file of files) { const body = new FormData(); body.append('file', file); const res = await fetch(`${config.cdnUrl}/attachments`, { method: 'POST', body, headers: { 'X-Session-Token': auth.token } }); if (!res.ok) { throw new Error('Failed to upload file'); } const data = await res.json(); if (data?.id) ids.push(data.id); } return ids; };
  const createServer = async () => { if (!createServerName.trim()) return; try { const res = await fetch(`${config.apiUrl}/servers/create`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session-token': auth.token }, body: JSON.stringify({ name: createServerName.trim() }) }); if (res.ok) { setCreateServerName(''); setActiveModal(null); } } catch {} };
  const updateServer = async () => { if (!selectedServerId || selectedServerId === '@me' || !editServerName.trim()) return; setIsUpdatingServer(true); try { const res = await fetch(`${config.apiUrl}/servers/${selectedServerId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-session-token': auth.token }, body: JSON.stringify({ name: editServerName.trim() }) }); if (res.ok) { setActiveModal(null); } } catch {} finally { setIsUpdatingServer(false); } };
  const deleteServer = async () => { if (!selectedServerId || selectedServerId === '@me') return; if (!confirm(`Are you absolutely sure you want to delete ${selectedServer?.name}? This cannot be undone.`)) return; setIsUpdatingServer(true); try { await fetch(`${config.apiUrl}/servers/${selectedServerId}`, { method: 'DELETE', headers: { 'x-session-token': auth.token } }); setActiveModal(null); } catch {} finally { setIsUpdatingServer(false); } };
  const openServerSettings = () => { if (selectedServer) { setEditServerName(selectedServer.name); setActiveModal('server-settings'); } };

  if (view === 'loading') return <div className="grid h-screen place-items-center bg-[#0F1115] text-[#8AB4F8]"><Hash className="animate-spin" size={42} /></div>;

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-[#0F1115] px-4 py-10 text-[#E6EDF3]">
        <div className="relative mx-auto max-w-md rounded-2xl border border-[#242A35] bg-[#171A21] p-8 shadow-2xl">
          <div className="absolute right-4 top-4">
            <span className="rounded-full border border-[#242A35] bg-[#141821] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#B6D8F6]" title="This client is under active development. Some features may be incomplete.">Experimental Build</span>
          </div>
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 h-16 w-16 overflow-hidden rounded-2xl border border-[#242A35] bg-[#141821]">
              <img
                alt="Ermine logo"
                className="h-full w-full object-cover"
                src="/assets/android-chrome-192x192.png"
              />
            </div>
            <h1 className="text-2xl font-bold text-white">Ermine</h1>
            <p className="text-sm text-[#A6B0C3]">A refined client for stoat.chat.</p>
            <p className="mt-1 text-xs text-[#8892A6]">Clean layout. Familiar flow. Experimental build.</p>
          </div>
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-[#141821] p-1 text-xs font-semibold uppercase tracking-wide">
            <button className={`rounded py-2 ${loginMode === 'credentials' ? 'bg-[#8AB4F8] text-[#0F1115]' : 'text-gray-400 hover:text-white'}`} onClick={() => setLoginMode('credentials')} type="button">Credentials</button>
            <button className={`rounded py-2 ${loginMode === 'token' ? 'bg-[#8AB4F8] text-[#0F1115]' : 'text-gray-400 hover:text-white'}`} onClick={() => setLoginMode('token')} type="button">Token</button>
          </div>
          <form className="space-y-4" onSubmit={handleLogin}>
            {loginMode === 'credentials' ? (
              <>
                <input className={inputBase} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" value={email} />
                <input className={inputBase} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" value={password} />
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400"><span className="mb-1 flex items-center gap-1"><ShieldCheck size={12} /> MFA</span><input className={inputBase} onChange={(e) => setMfaCode(e.target.value)} placeholder="Optional 2FA code" type="text" value={mfaCode} /></label>
              </>
            ) : (
              <textarea className={`${inputBase} h-24 resize-none`} onChange={(e) => setManualToken(e.target.value)} placeholder="Paste session token" value={manualToken} />
            )}
            <label className="flex items-start gap-2 rounded-md border border-[#242A35] bg-[#141821] p-2 text-xs text-[#A6B0C3]">
              <input checked={privacyConsent} className="mt-0.5" onChange={(e) => setPrivacyConsent(e.target.checked)} type="checkbox" />
              <span>I agree to the <a className="text-[#B6D8F6] underline hover:text-[#E6F0FF]" href="/privacy-policy.html" rel="noreferrer" target="_blank">privacy policy</a>. Ermine does not store user content outside configured stoat.chat endpoints.</span>
            </label>
            {loginError ? <div className="flex items-start gap-2 rounded-md border border-red-800 bg-red-900/30 p-2 text-sm text-red-200"><AlertCircle className="mt-0.5" size={15} /><span>{loginError}</span></div> : null}
            <button className="w-full rounded-md bg-[#8AB4F8] py-2.5 text-sm font-semibold text-[#0F1115] hover:bg-[#6FA6E8]" disabled={isLoggingIn} type="submit">{isLoggingIn ? 'Signing in…' : 'Log in to Ermine'}</button>
          </form>
          <div className="mt-5 border-t border-[#202225] pt-4">
            <button className="flex items-center gap-1 text-xs text-[#A6B0C3] hover:text-[#E6EDF3]" onClick={() => setShowAdvanced((prev) => !prev)} type="button"><Settings size={12} /> Advanced connection configuration</button>
            {showAdvanced ? (
              <div className="mt-2 space-y-2 rounded-md bg-[#141821] p-2">
                <input className={inputBase} onChange={(e) => setConfig((prev) => ({ ...prev, apiUrl: e.target.value }))} placeholder="API URL" value={config.apiUrl} />
                <input className={inputBase} onChange={(e) => setConfig((prev) => ({ ...prev, wsUrl: e.target.value }))} placeholder="WS URL" value={config.wsUrl} />
                <input className={inputBase} onChange={(e) => setConfig((prev) => ({ ...prev, cdnUrl: e.target.value }))} placeholder="CDN URL" value={config.cdnUrl} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0F1115] text-[#E6EDF3]">
      {activeModal === 'create-server' ? (
        <Modal onClose={() => setActiveModal(null)} title="Create a Space">
          <input className={inputBase} onChange={(e) => setCreateServerName(e.target.value)} placeholder="Space name" value={createServerName} />
          <button className="w-full rounded-md bg-[#3ba55d] py-2 text-sm font-semibold text-white hover:bg-[#328a4f]" onClick={createServer}>Create Space</button>
        </Modal>
      ) : null}
      
      {activeModal === 'server-settings' && selectedServer ? (
        <Modal onClose={() => setActiveModal(null)} title="Space Settings">
          <div className="space-y-4">
             <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Space Name</label>
                <div className="flex gap-2">
                   <input className={inputBase} onChange={(e) => setEditServerName(e.target.value)} value={editServerName} placeholder="Enter space name" />
                   <button onClick={updateServer} disabled={isUpdatingServer || !editServerName.trim()} className="rounded bg-[#5865f2] px-3 text-white hover:bg-[#4956d8] disabled:opacity-50"><Save size={18} /></button>
                </div>
             </div>
             <div className="border-t border-[#202225] pt-4 mt-4">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wide mb-2">Danger Zone</h4>
                <div className="flex items-center justify-between rounded border border-red-900/50 p-3 bg-red-900/10">
                   <div><div className="font-semibold text-white">Delete Space</div><div className="text-xs text-gray-400">Permanently remove this space and all its contents.</div></div>
                   <button onClick={deleteServer} disabled={isUpdatingServer} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-semibold transition-colors">Delete Space</button>
                </div>
             </div>
          </div>
        </Modal>
      ) : null}
      
      {activeModal === 'discovery' ? (
        <Modal onClose={() => setActiveModal(null)} title="Space Discovery">
           <div className="p-4 text-center">
              <Search size={48} className="mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Explore Communities</h3>
              <p className="text-sm text-gray-400">
                 Server discovery is coming soon to Ermine! Stay tuned to find new communities.
              </p>
           </div>
        </Modal>
      ) : null}

      {activeModal === 'set-status' ? (
        <Modal onClose={() => setActiveModal(null)} title="Set your status">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Presence</p>
            <div className="grid grid-cols-1 gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${statusDraft.presence === option.value ? 'border-[#5865f2] bg-[#2c3163]/45' : 'border-[#2f3237] bg-[#1f2024] hover:border-[#3f4451] hover:bg-[#282a31]'}`} key={option.value} onClick={() => setStatusDraft((prev) => ({ ...prev, presence: option.value }))} type="button">
                  <span className={`rounded-full ${option.value === 'Focus' ? 'border-2 border-[#4f7dff] bg-[#4f7dff]/10 p-[6px] text-[#4f7dff]' : 'p-1.5'} ${option.iconClass}`}><option.icon size={15} /></span>
                  <span className="text-sm text-gray-100">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Custom status<input className={`${inputBase} mt-1`} maxLength={128} onChange={(event) => setStatusDraft((prev) => ({ ...prev, text: event.target.value }))} placeholder="What's up?" value={statusDraft.text} /></label>
          <button className="w-full rounded-md bg-[#5865f2] py-2 text-sm font-semibold text-white hover:bg-[#4956d8]" disabled={isSavingStatus} onClick={saveStatus} type="button">{isSavingStatus ? 'Saving…' : 'Save status'}</button>
        </Modal>
      ) : null}

      {activeModal === 'user-settings' ? (
        <Modal onClose={() => setActiveModal(null)} title="Preferences">
           <div className="space-y-6">
              <div className="flex flex-col items-center">
                 <div className="w-full h-24 rounded-t-lg bg-gray-700 overflow-hidden relative">
                    {getBannerUrl(users[auth.userId], config.cdnUrl) ? (
                       <img src={getBannerUrl(users[auth.userId], config.cdnUrl)} alt="Banner" className="w-full h-full object-cover rounded-t-lg" />
                    ) : (
                       <div className="w-full h-full bg-gradient-to-r from-[#3b3f6b] to-[#5865f2]" />
                    )}
                    <div className="absolute -bottom-8 left-4 p-1 bg-[#1e1f22] rounded-full">
                       <Avatar user={users[auth.userId]} cdnUrl={config.cdnUrl} size="lg" />
                    </div>
                 </div>
                 <div className="w-full px-4 pt-10">
                    <h2 className="text-xl font-bold text-white">{users[auth.userId]?.username || 'User'}</h2>
                    <p className="text-xs text-gray-400">#{users[auth.userId]?.discriminator || '0000'}</p>
                 </div>
              </div>

              <div className="border-t border-[#2f3237] pt-4 px-4">
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">About Ermine</h3>
                 <div className="flex items-start gap-3 bg-[#2b2d31] p-3 rounded-lg mb-3">
                    <div className="p-2 bg-[#5865f2] rounded-lg">
                       <Smile size={20} className="text-white" />
                    </div>
                    <div>
                       <h4 className="text-sm font-bold text-white">Support Stoat Chat</h4>
                       <p className="text-xs text-gray-400 mt-1">Ermine is a passionate project built for the Stoat community. Consider donating to keep the lights on!</p>
                       <a href="https://ko-fi.com/stoatchat" target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-xs font-semibold text-[#5865f2] hover:underline">Donate on Ko-fi &rarr;</a>
                    </div>
                 </div>
                 
                 <div className="flex items-start gap-3 bg-[#2b2d31] p-3 rounded-lg">
                     <div className="p-2 bg-gray-700 rounded-lg">
                       <AlertCircle size={20} className="text-white" />
                    </div>
                    <div>
                       <h4 className="text-sm font-bold text-white">Client Info</h4>
                       <p className="text-xs text-gray-400 mt-1">
                          Version: 1.2.0 (Wii U Compatible)<br/>
                          Mode: {isLowSpec ? 'Lite (Performance Mode)' : 'Standard'}
                       </p>
                    </div>
                 </div>
              </div>
           </div>
        </Modal>
      ) : null}

      {linkPromptUrl ? (
        <Modal onClose={() => setLinkPromptUrl(null)} title="Ermine link check">
          <div className="rounded-md bg-[#1e1f22] p-3 text-sm text-gray-200">
            <p className="text-xs uppercase tracking-wide text-gray-500">Do you trust this link?</p>
            <p className="mt-2 break-all text-[#bdc3ff]">{linkPromptUrl}</p>
            <p className="mt-2 text-xs text-gray-400">Only open links from contacts and spaces you trust.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded-md bg-[#3a3d42] py-2 text-sm font-semibold text-gray-200 hover:bg-[#4a4d55]" onClick={() => setLinkPromptUrl(null)} type="button">Cancel</button>
            <button className="rounded-md bg-[#5865f2] py-2 text-sm font-semibold text-white hover:bg-[#4956d8]" onClick={confirmOpenLink} type="button">Open link</button>
          </div>
        </Modal>
      ) : null}

      {peekUser ? (
        <Modal onClose={() => setPeekUser(null)} title="Member profile">
          <div className="overflow-hidden rounded-lg bg-[#1e1f22]">
            {peekBannerUrl ? <img alt="Profile banner" className="h-24 w-full object-cover" src={peekBannerUrl} /> : <div className="h-20 w-full bg-gradient-to-r from-[#3b3f6b] to-[#5865f2]" />}
            <div className="flex items-center gap-3 p-3">
              <Avatar alwaysAnimate cdnUrl={config.cdnUrl} size="lg" user={peekUser} />
              <div>
                <div className="text-base font-semibold text-white">{peekUser?.username || 'Unknown user'}</div>
                <div className="text-xs text-gray-400">#{peekUser?.discriminator || '0000'}</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 rounded-md bg-[#1e1f22] p-3 text-xs text-gray-300">
            <p><span className="font-semibold text-gray-100">Joined platform:</span> {toDateLabel(peekPlatformJoined)}</p>
            <p><span className="font-semibold text-gray-100">Joined space:</span> {selectedServerId === '@me' ? 'N/A' : toDateLabel(peekServerJoined)}</p>
          </div>
          <div className="space-y-1 rounded-md bg-[#1e1f22] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">About me</p>
            <p className="text-sm text-gray-200">{peekAboutMe || 'This user has not set an About Me yet.'}</p>
          </div>
          <div className="space-y-1 rounded-md bg-[#1e1f22] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Badges</p>
            {peekBadges.length ? <div className="flex flex-wrap gap-1.5">{peekBadges.map((badge) => <span className="rounded bg-[#5865f2]/20 px-2 py-1 text-xs text-[#d7ddff]" key={badge}>{badge}</span>)}</div> : <p className="text-xs text-gray-400">No badges</p>}
          </div>
          <div className="space-y-1 rounded-md bg-[#1e1f22] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Roles</p>
            {peekRoles.length ? <div className="flex flex-wrap gap-1.5">{peekRoles.map((role) => <span className="rounded bg-[#3a3d42] px-2 py-1 text-xs text-gray-200" key={role.name}>{role.name}</span>)}</div> : <p className="text-xs text-gray-400">No space roles</p>}
          </div>
        </Modal>
      ) : null}

      <aside className="flex w-[72px] flex-col items-center gap-2 overflow-y-auto bg-[#111214] py-3">
        <button className={`grid h-12 w-12 place-items-center transition ${selectedServerId === '@me' ? 'rounded-2xl bg-[#5865f2]' : 'rounded-full bg-[#313338] hover:rounded-2xl hover:bg-[#5865f2]'}`} onClick={() => handleServerSelect('@me')}>
          <MessageSquare size={20} />
        </button>
        <div className="h-px w-8 bg-[#202225]" />

        {serverList.map((server) => {
          const icon = getIconUrl(server, config.cdnUrl);
          const active = selectedServerId === server._id;

          return (
            <button className={`grid h-12 w-12 place-items-center overflow-hidden transition ${active ? 'rounded-2xl bg-[#5865f2]' : 'rounded-full bg-[#313338] hover:rounded-2xl hover:bg-[#5865f2]'}`} key={server._id} onClick={() => handleServerSelect(server._id)} title={server.name}>
              {icon ? <img alt={server.name} className="h-full w-full object-contain p-1" src={icon} /> : <span className="text-sm font-bold">{server.name.slice(0, 2).toUpperCase()}</span>}
            </button>
          );
        })}

        <button className="grid h-12 w-12 place-items-center rounded-full bg-[#313338] text-[#3ba55d] transition hover:rounded-2xl hover:bg-[#3ba55d] hover:text-white" onClick={() => setActiveModal('create-server')}>
          <Plus size={20} />
        </button>
        <button className="grid h-12 w-12 place-items-center rounded-full bg-[#313338] text-green-500 transition hover:rounded-2xl hover:bg-green-600 hover:text-white" onClick={() => setActiveModal('discovery')} title="Space Discovery">
           <Search size={20} />
        </button>
      </aside>

      <aside className="hidden w-60 flex-col bg-[#2b2d31] md:flex">
        <div className="border-b border-[#202225] px-4 py-3 flex justify-between items-center">
          <div className="truncate text-sm font-bold text-white">{selectedServerId === '@me' ? 'Live' : servers[selectedServerId]?.name || 'Space'}</div>
          {isServerOwner && selectedServerId !== '@me' && (
             <button 
               onClick={openServerSettings} 
               className="text-gray-400 hover:text-white transition-colors" 
               title="Space Settings"
             >
                <Settings size={16} />
             </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {selectedServerId === '@me' ? (
            <>
              <button className={`mb-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${selectedChannelId === 'friends' ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373c] hover:text-white'}`} onClick={() => handleChannelSelect('friends')}>
                <Users size={16} /> <span>Direct</span>
              </button>
              {directMessageChannels.map((channel) => {
                const recipientId = (channel.recipients || []).find((id) => id !== auth.userId);
                const recipient = users[recipientId];
                const label = recipient?.username || channel.name || 'Direct Message';
                return (
                  <button className={`mb-0.5 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${selectedChannelId === channel._id ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373c] hover:text-white'}`} key={channel._id} onClick={() => handleChannelSelect(channel._id)}>
                    <MessageSquare size={16} />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </>
          ) : (
            channelList.map((channel) => {
              const isVoice = channel?.channel_type === 'VoiceChannel';
              return (
                <button
                  className={`mb-0.5 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${isVoice ? 'cursor-not-allowed text-gray-500 hover:bg-[#2f3237]' : selectedChannelId === channel._id ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373c] hover:text-white'}`}
                  key={channel._id}
                  onClick={() => handleChannelSelect(channel._id)}
                  title={isVoice ? "Ermine currently doesn't support voice channels." : channel.name}
                >
                  {isVoice ? <Users size={16} /> : <Hash size={16} />}
                  <span className="truncate">{channel.name || 'channel'}</span>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-[#202225] p-2">
          <div className="flex items-center justify-between rounded bg-[#232428] p-2" onMouseEnter={() => setIsAccountHovered(true)} onMouseLeave={() => setIsAccountHovered(false)}>
            <button className="flex min-w-0 items-center gap-2 rounded p-1 text-left hover:bg-[#2d3036]" onClick={openStatusEditor} type="button">
              <Avatar alwaysAnimate={isAccountHovered} cdnUrl={config.cdnUrl} size="sm" user={users[auth.userId]} />
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-white">{users[auth.userId]?.username || 'Connected'}</div>
                <div className="truncate text-[10px] uppercase tracking-wide text-gray-400">{users[auth.userId]?.status?.text || status}</div>
              </div>
            </button>
            <div className="flex items-center gap-1">
              <button className="rounded p-1 text-gray-400 hover:bg-[#35373c] hover:text-white" onClick={() => setActiveModal('user-settings')} title="Preferences" type="button">
                <Settings size={14} />
              </button>
              <button className="rounded p-1 text-gray-400 hover:bg-[#35373c] hover:text-white" onClick={logout} title="Logout" type="button">
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col bg-[#313338]">
        <header className="flex items-center justify-between border-b border-[#202225] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            {channels[selectedChannelId]?.channel_type === 'DirectMessage' ? <MessageSquare size={17} className="text-gray-400" /> : <Hash size={17} className="text-gray-400" />}
            <span>{currentChannelName}</span>
          </div>
          <div className="text-xs text-gray-400">Stoat.chat, distilled.</div>
        </header>

        {voiceNotice ? (
          <div className="mx-4 mt-3 rounded-md border border-[#665200] bg-[#5c4a00]/25 px-3 py-2 text-xs text-yellow-200">
            {voiceNotice}
          </div>
        ) : null}

        <section className="flex-1 overflow-y-auto py-2" ref={messagesContainerRef}>
          {selectedChannelId === 'friends' ? (
            <div className="space-y-2 p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Direct ({friends.length})</h2>
              {friends.length === 0 ? <p className="text-sm text-gray-400">No direct contacts available yet.</p> : null}
              {friends.map((friend) => (
                <button className="flex w-full items-center gap-3 rounded bg-[#2b2d31] p-3 text-left hover:bg-[#35373c]" key={friend._id} onClick={() => openDmWithUser(friend._id)}>
                  <Avatar animateOnHover cdnUrl={config.cdnUrl} user={friend} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{friend.username}</div>
                    <div className="text-xs text-gray-400">Direct</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            currentMessages.map((message) => (
              <Message
                key={message._id}
                message={message}
                users={users}
                channels={channels}
                me={auth.userId}
                onUserClick={openUserProfile}
                cdnUrl={config.cdnUrl}
                onToggleReaction={toggleReaction}
                onReply={setReplyingTo}
                replyTarget={replyingTo?._id}
                onJumpToMessage={jumpToMessage}
                registerMessageRef={registerMessageRef}
                customEmojiById={customEmojiById}
                reactionOptions={reactionOptions}
                onRequestOpenLink={requestOpenLink}
                onEditMessage={editMessage}
                onDeleteMessage={deleteMessage}
                replyMessageMap={globalReplyMessageMap}
              />
            ))
          )}
          <div ref={messagesBottomRef} />
        </section>

        {showGoLatest ? (
          <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2">
            <button className="pointer-events-auto rounded-full bg-[#5865f2] px-3 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-[#4956d8]" onClick={goToLatest} type="button">
              Go to latest
            </button>
          </div>
        ) : null}

        <footer className="border-t border-[#202225] p-4">
          {activeReply ? (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-[#2b2d31] px-3 py-2 text-xs text-gray-300">
              <span className="truncate">
                Replying to {users[typeof activeReply.author === 'string' ? activeReply.author : activeReply.author?._id]?.username || 'Unknown user'}: {activeReply.content || 'Attachment / embed'}
              </span>
              <button className="rounded p-1 text-gray-400 hover:bg-[#3a3d42] hover:text-white" onClick={() => setReplyingTo(null)} type="button">
                <X size={13} />
              </button>
            </div>
          ) : null}
          {pendingFiles.length ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {pendingFiles.map((file, index) => {
                const previewImage = isImageLike(file.name, file.type);
                return (
                  <button className="flex items-center gap-2 rounded bg-[#2b2d31] px-2 py-1 text-xs text-gray-200 hover:bg-[#35373c]" key={`${file.name}-${index}`} onClick={() => removePendingFile(index)} type="button">
                    <span>{previewImage ? '🖼️' : '📎'}</span>
                    <span>{file.name} <span className="text-gray-400">(remove)</span></span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="flex items-center gap-2 rounded-lg bg-[#383a40] p-2" onDragOver={handleComposerDragOver} onDrop={handleComposerDrop}>
            <button
              className="rounded p-2 text-gray-300 hover:bg-[#4b4d55] hover:text-white"
              disabled={selectedChannelId === 'friends' || isUploadingFiles}
              onClick={() => fileInputRef.current?.click()}
              title="Upload files"
              type="button"
            >
              <Paperclip size={16} />
            </button>
            <input className="hidden" multiple onChange={handleFilePick} ref={fileInputRef} type="file" />
            <div className="relative">
              <button
                className="rounded p-2 text-gray-300 hover:bg-[#4b4d55] hover:text-white"
                disabled={selectedChannelId === 'friends'}
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                type="button"
              >
                <Smile size={16} />
              </button>
              {showEmojiPicker && selectedChannelId !== 'friends' ? (
                <div ref={pickerRef} onMouseLeave={() => setShowEmojiPicker(false)} className="absolute bottom-12 left-0 z-20 w-72 rounded-lg border border-[#4c4f56] bg-[#232428] p-2 shadow-2xl max-h-64 overflow-y-auto">
                  <p className="mb-2 px-1 text-[10px] uppercase tracking-wide text-gray-500 font-bold sticky top-0 bg-[#232428] z-10">Standard</p>
                  <div className="grid grid-cols-8 gap-1 mb-2">{STANDARD_EMOJIS.map((emoji) => <button className="rounded p-1 text-lg hover:bg-[#3a3d42]" key={emoji} onClick={() => addEmojiToComposer(emoji)} type="button">{renderTwemoji(emoji, "w-6 h-6 inline-block")}</button>)}</div>
                  {allCustomEmojis.length > 0 ? <><p className="mb-2 px-1 text-[10px] uppercase tracking-wide text-gray-500 font-bold sticky top-0 bg-[#232428] z-10">Space Emojis</p><div className="grid grid-cols-8 gap-1">{allCustomEmojis.map((emoji) => <button className="grid h-8 place-items-center rounded hover:bg-[#3a3d42]" key={emoji.id} onClick={() => addCustomEmojiToComposer(emoji.id)} title={`${emoji.name} from ${emoji.serverName}`} type="button">{renderEmojiVisual(`:${emoji.id}:`, { id: emoji.id, name: emoji.name }, config.cdnUrl)}</button>)}</div></> : null}
                </div>
              ) : null}
            </div>
            <input
              className="flex-1 bg-transparent px-2 py-1 text-sm text-gray-100 placeholder:text-gray-400 focus:outline-none"
              disabled={selectedChannelId === 'friends'}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={selectedChannelId === 'friends' ? 'Select a text channel to chat.' : `Enter message in #${currentChannelName}`}
              value={inputText}
            />
            <button className="rounded p-2 text-gray-300 hover:bg-[#4b4d55] hover:text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={isUploadingFiles} onClick={sendMessage} type="button">
              <Send size={16} />
            </button>
          </div>
        </footer>
      </main>

      <aside className="hidden w-60 flex-col border-l border-[#202225] bg-[#2b2d31] lg:flex">
        <div className="border-b border-[#202225] px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-400">Members — {allCurrentMembers.length}{isMembersLoading ? ' (loading...)' : ''}</div>
        <div className="min-h-0 flex-1 relative">
          <VirtualList items={memberListItems} itemHeight={40} className="h-full w-full" renderItem={renderMemberItem} />
        </div>
      </aside>
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppShell />
    </AppErrorBoundary>
  );
}
