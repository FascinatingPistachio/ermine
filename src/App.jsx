import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Hash,
  LogOut,
  MessageSquare,
  Plus,
  Reply,
  Send,
  Settings,
  ShieldCheck,
  Smile,
  User,
  Users,
  X,
} from 'lucide-react';

const getRuntimeConfig = () => {
  const runtime = typeof window !== 'undefined' ? window.__ERMINE_CONFIG__ || {} : {};
  const env = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};

  return {
    apiUrl: runtime.apiUrl || env.VITE_STOAT_API_URL || 'https://api.stoat.chat',
    wsUrl: runtime.wsUrl || env.VITE_STOAT_WS_URL || 'wss://stoat.chat/events',
    cdnUrl: runtime.cdnUrl || env.VITE_STOAT_CDN_URL || 'https://autumn.revolt.chat',
  };
};

const { apiUrl: DEFAULT_API_URL, wsUrl: DEFAULT_WS_URL, cdnUrl: DEFAULT_CDN_URL } = getRuntimeConfig();

const inputBase =
  'w-full rounded-md border border-[#202225] bg-[#111214] px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-[#5865f2] focus:outline-none focus:ring-1 focus:ring-[#5865f2]';

const toTime = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getAvatarUrl = (user, cdnUrl) => {
  if (!user?.avatar?._id) return null;
  return `${cdnUrl}/avatars/${user.avatar._id}?max_side=256`;
};

const getIconUrl = (server, cdnUrl) => {
  if (!server?.icon?._id) return null;
  return `${cdnUrl}/icons/${server.icon._id}`;
};

const EMOJI_SHORTCODES = {
  smile: '😄',
  grin: '😁',
  joy: '😂',
  rofl: '🤣',
  wink: '😉',
  heart: '❤️',
  thumbs_up: '👍',
  thumbs_down: '👎',
  fire: '🔥',
  sob: '😭',
  thinking: '🤔',
  tada: '🎉',
  eyes: '👀',
};

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '😭', '🎉', '😮', '👀', '🤔'];
const MEMBER_RENDER_LIMIT = 250;
const MEMBER_HYDRATE_CHUNK = 400;

const toReactionEntries = (reactions) => {
  if (!reactions || typeof reactions !== 'object') return [];
  return Object.entries(reactions)
    .map(([emoji, userIds]) => ({ emoji, userIds: Array.isArray(userIds) ? userIds : [] }))
    .filter((entry) => entry.userIds.length > 0);
};

const renderMessageContent = (content, users, channels, onUserClick) => {
  if (!content) return null;

  const parts = content.split(/(<@!?[A-Za-z0-9]+>|<#[A-Za-z0-9]+>|:[a-z0-9_+-]+:)/gi);

  return parts.map((part, index) => {
    if (!part) return null;

    const userMention = part.match(/^<@!?([A-Za-z0-9]+)>$/);
    if (userMention) {
      const userId = userMention[1];
      const user = users[userId];
      return (
        <button
          className="mx-0.5 inline rounded bg-[#5865f2]/25 px-1 text-[#bdc3ff] hover:bg-[#5865f2]/35"
          key={`${part}-${index}`}
          onClick={() => onUserClick(user || { _id: userId, username: 'Unknown user' }, userId)}
          type="button"
        >
          @{user?.username || 'unknown'}
        </button>
      );
    }

    const channelMention = part.match(/^<#([A-Za-z0-9]+)>$/);
    if (channelMention) {
      const channelId = channelMention[1];
      return (
        <span className="mx-0.5 inline rounded bg-[#3f4249] px-1 text-gray-100" key={`${part}-${index}`}>
          #{channels[channelId]?.name || 'unknown-channel'}
        </span>
      );
    }

    const emoji = part.match(/^:([a-z0-9_+-]+):$/i);
    if (emoji) {
      return EMOJI_SHORTCODES[emoji[1].toLowerCase()] || part;
    }

    return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
  });
};

const Avatar = ({ user, cdnUrl, size = 'md' }) => {
  const sizeMap = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  };

  const initials = (user?.username || '?').slice(0, 2).toUpperCase();
  const src = getAvatarUrl(user, cdnUrl);

  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#313338] font-semibold text-gray-200 ${sizeMap[size]}`}>
      {src ? <img alt={user?.username || 'User avatar'} className="block h-full w-full object-cover object-center" src={src} /> : initials}
    </div>
  );
};

const withoutClearedFields = (base, clear = []) => {
  if (!clear?.length) return base;
  const next = { ...base };
  clear.forEach((field) => {
    const key = field?.[0]?.toLowerCase() + field?.slice(1);
    if (key) delete next[key];
  });
  return next;
};

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
    <div className="w-full max-w-md overflow-hidden rounded-xl border border-[#202225] bg-[#2b2d31] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#202225] px-4 py-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <button className="rounded p-1 text-gray-400 hover:bg-[#3a3d42] hover:text-white" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </div>
  </div>
);


class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Ermine crashed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-screen place-items-center bg-[#1e1f22] p-6 text-gray-100">
          <div className="w-full max-w-lg rounded-2xl border border-[#202225] bg-[#2b2d31] p-8 text-center shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#949ba4]">Well, this is awkward</p>
            <h1 className="mt-3 text-2xl font-bold text-white">Looks like Ermine crashed.</h1>
            <p className="mt-2 text-sm text-gray-300">Try reloading the app. If it keeps happening, relog and reconnect to stoat.chat.</p>
            <button
              className="mt-6 rounded-md bg-[#5865f2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4956d8]"
              onClick={() => window.location.reload()}
              type="button"
            >
              Reload Ermine
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const Message = ({ message, users, channels, me, onUserClick, cdnUrl, onToggleReaction, onReply, replyTarget }) => {
  const authorId = typeof message.author === 'string' ? message.author : message.author?._id;
  const author = users[authorId] || (typeof message.author === 'object' ? message.author : null) || { username: 'Unknown user' };
  const mine = me === authorId;
  const messageReactions = toReactionEntries(message.reactions);
  const replyPreview = message.replyMessage;

  return (
    <article className="group flex gap-3 rounded px-4 py-2 hover:bg-[#2e3035]">
      <button className="mt-0.5" onClick={() => onUserClick(author, authorId)} type="button">
        <Avatar cdnUrl={cdnUrl} user={author} />
      </button>
      <div className="min-w-0 flex-1">
        {replyPreview ? (
          <button
            className="mb-1 flex max-w-full items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
            onClick={() => onUserClick(replyPreview.authorUser || { username: 'Unknown user' }, replyPreview.authorId)}
            type="button"
          >
            <Reply size={12} />
            <span className="truncate">Replying to {replyPreview.authorUser?.username || 'Unknown user'}: {replyPreview.content || 'Attachment / embed'}</span>
          </button>
        ) : null}
        <div className="flex items-baseline gap-2">
          <button className="text-sm font-semibold text-white hover:underline" onClick={() => onUserClick(author, authorId)} type="button">
            {author.username}
          </button>
          {mine && <span className="rounded bg-[#5865f2]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#bdc3ff]">YOU</span>}
          <time className="text-[11px] text-gray-500">{toTime(message.createdAt)}</time>
        </div>
        {message.content ? (
          <p className="whitespace-pre-wrap break-words text-sm text-gray-200">{renderMessageContent(message.content, users, channels, onUserClick)}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {messageReactions.map(({ emoji, userIds }) => {
            const reacted = userIds.includes(me);
            return (
              <button
                className={`rounded-full border px-2 py-0.5 text-xs ${reacted ? 'border-[#5865f2] bg-[#5865f2]/20 text-[#d7ddff]' : 'border-[#4c4f56] bg-[#2b2d31] text-gray-200 hover:bg-[#35373c]'}`}
                key={emoji}
                onClick={() => onToggleReaction(message, emoji, reacted)}
                type="button"
              >
                {emoji} {userIds.length}
              </button>
            );
          })}
          <button className="rounded-full border border-[#4c4f56] px-2 py-0.5 text-xs text-gray-300 hover:bg-[#35373c]" onClick={() => onReply(message)} type="button">
            <Reply size={12} className="inline" /> Reply
          </button>
          <button className="rounded-full border border-[#4c4f56] px-2 py-0.5 text-xs text-gray-300 hover:bg-[#35373c]" onClick={() => onToggleReaction(message, '👍', message.reactions?.['👍']?.includes(me))} type="button">
            + React
          </button>
          {replyTarget === message._id ? <span className="text-[11px] text-[#bdc3ff]">Reply target</span> : null}
        </div>
      </div>
    </article>
  );
};

function AppShell() {
  const [view, setView] = useState('loading');
  const [status, setStatus] = useState('disconnected');
  const [config, setConfig] = useState({ apiUrl: DEFAULT_API_URL, wsUrl: DEFAULT_WS_URL, cdnUrl: DEFAULT_CDN_URL });
  const [auth, setAuth] = useState({ token: null, userId: null });

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
  const [peekUser, setPeekUser] = useState(null);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [loginMode, setLoginMode] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const wsRef = useRef(null);
  const messagesBottomRef = useRef(null);
  const subscriptionRef = useRef({});
  const preloadedChannelRef = useRef({});
  const preloadedMembersRef = useRef({});
  const pendingUserFetchRef = useRef(new Set());
  const membersLoadIdRef = useRef(0);

  const serverList = useMemo(() => Object.values(servers), [servers]);

  const channelList = useMemo(() => {
    if (selectedServerId === '@me') return [];
    return Object.values(channels).filter((ch) => ch.server === selectedServerId);
  }, [channels, selectedServerId]);

  const currentMessages = useMemo(() => messages[selectedChannelId] || [], [messages, selectedChannelId]);
  const currentMessageMap = useMemo(() => Object.fromEntries(currentMessages.map((message) => [message._id, message])), [currentMessages]);

  const allCurrentMembers = useMemo(() => {
    if (selectedServerId === '@me') return [];
    return Object.values(members)
      .filter((member) => member._id.server === selectedServerId)
      .map((member) => ({ ...member, user: users[member._id.user] }))
      .filter((member) => Boolean(member.user));
  }, [members, selectedServerId, users]);

  const currentMembers = useMemo(
    () => allCurrentMembers.slice(0, MEMBER_RENDER_LIMIT).sort((a, b) => (a.nickname || a.user.username).localeCompare(b.nickname || b.user.username)),
    [allCurrentMembers],
  );

  const hiddenMembersCount = Math.max(0, allCurrentMembers.length - currentMembers.length);

  const openUserProfile = (user, fallbackId = null) => {
    const stableId = user?._id || fallbackId || 'unknown-user';
    setPeekUser({
      ...user,
      _id: stableId,
      username: user?.username || 'Unknown user',
      discriminator: user?.discriminator || '0000',
    });
  };

  const friends = useMemo(
    () => Object.values(users).filter((u) => u.relationship === 'Friend' || u.relationship === 1),
    [users],
  );

  const upsertUsers = (list = []) => {
    if (!list.length) return;
    setUsers((prev) => {
      const next = { ...prev };
      list.forEach((user) => {
        if (user?._id) next[user._id] = user;
      });
      return next;
    });
  };

  const upsertUsersFromMessages = (messageList = []) => {
    const embeddedUsers = [];

    messageList.forEach((entry) => {
      const author = entry?.author;
      if (author && typeof author === 'object' && author._id) embeddedUsers.push(author);
      if (entry?.user?._id) embeddedUsers.push(entry.user);
    });

    upsertUsers(embeddedUsers);
  };

  const fetchMissingUsers = async (messageList = []) => {
    const unresolved = new Set();

    messageList.forEach((entry) => {
      const authorId = typeof entry?.author === 'string' ? entry.author : entry?.author?._id;
      if (!authorId || users[authorId] || pendingUserFetchRef.current.has(authorId)) return;
      unresolved.add(authorId);
    });

    if (!unresolved.size) return;

    unresolved.forEach((id) => pendingUserFetchRef.current.add(id));

    await Promise.all(
      [...unresolved].map(async (userId) => {
        try {
          const res = await fetch(`${config.apiUrl}/users/${userId}`, {
            headers: { 'x-session-token': auth.token },
          });
          if (!res.ok) return;
          const data = await res.json();
          if (data?._id) upsertUsers([data]);
        } catch {
          // no-op
        } finally {
          pendingUserFetchRef.current.delete(userId);
        }
      }),
    );
  };

  const discoverConfig = async (apiUrl) => {
    try {
      const res = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      setConfig((prev) => ({
        ...prev,
        apiUrl,
        wsUrl: data.ws || prev.wsUrl,
        cdnUrl: data.features?.autumn?.url || prev.cdnUrl,
      }));
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('stoat_token');
    const savedUserId = localStorage.getItem('stoat_user_id');
    const savedApi = localStorage.getItem('stoat_api_url');

    const api = savedApi || DEFAULT_API_URL;
    setConfig((prev) => ({ ...prev, apiUrl: api }));
    discoverConfig(api);

    if (savedToken && savedUserId) {
      setAuth({ token: savedToken, userId: savedUserId });
      setView('app');
    } else {
      setView('login');
    }
  }, []);

  const applyEvent = (packet) => {
    if (!packet?.type) return;

    switch (packet.type) {
      case 'Ready':
        setUsers((prev) => {
          const next = { ...prev };
          packet.users?.forEach((u) => {
            next[u._id] = u;
          });
          return next;
        });
        setServers((prev) => {
          const next = { ...prev };
          packet.servers?.forEach((s) => {
            next[s._id] = s;
          });
          return next;
        });
        setChannels((prev) => {
          const next = { ...prev };
          packet.channels?.forEach((c) => {
            next[c._id] = c;
          });
          return next;
        });
        setMembers((prev) => {
          const next = { ...prev };
          packet.members?.forEach((m) => {
            next[`${m._id.server}:${m._id.user}`] = m;
          });
          return next;
        });
        setStatus('ready');
        break;
      case 'Bulk':
        packet.v?.forEach(applyEvent);
        break;
      case 'Authenticated':
        setStatus('authenticated');
        break;
      case 'Error':
        setStatus(`error:${packet.error || 'unknown'}`);
        break;
      case 'Logout':
        logout();
        break;
      case 'Message':
        upsertUsersFromMessages([packet]);
        void fetchMissingUsers([packet]);
        setMessages((prev) => {
          const list = prev[packet.channel] || [];
          if (list.find((m) => m._id === packet._id)) return prev;
          const nextMessages = [...list, packet].slice(-200);
          return { ...prev, [packet.channel]: enrichReplies(nextMessages) };
        });
        break;
      case 'MessageUpdate':
        setMessages((prev) => ({
          ...prev,
          [packet.channel]: enrichReplies((prev[packet.channel] || []).map((m) => (m._id === packet.id ? { ...m, ...packet.data } : m))),
        }));
        break;
      case 'MessageDelete':
        setMessages((prev) => ({
          ...prev,
          [packet.channel]: (prev[packet.channel] || []).filter((m) => m._id !== packet.id),
        }));
        break;
      case 'ChannelCreate':
        setChannels((prev) => ({ ...prev, [packet._id]: packet }));
        break;
      case 'ChannelUpdate':
        setChannels((prev) => ({
          ...prev,
          [packet.id]: withoutClearedFields({ ...prev[packet.id], ...packet.data }, packet.clear),
        }));
        break;
      case 'ChannelDelete':
        setChannels((prev) => {
          const next = { ...prev };
          delete next[packet.id];
          return next;
        });
        break;
      case 'ServerCreate':
        setServers((prev) => ({ ...prev, [packet._id]: packet }));
        break;
      case 'ServerUpdate':
        setServers((prev) => ({
          ...prev,
          [packet.id]: withoutClearedFields({ ...prev[packet.id], ...packet.data }, packet.clear),
        }));
        break;
      case 'ServerDelete':
        setServers((prev) => {
          const next = { ...prev };
          delete next[packet.id];
          return next;
        });
        break;
      case 'ServerMemberUpdate': {
        const key = `${packet.id.server}:${packet.id.user}`;
        setMembers((prev) => ({
          ...prev,
          [key]: withoutClearedFields({ ...prev[key], _id: packet.id, ...packet.data }, packet.clear),
        }));
        break;
      }
      case 'ServerMemberJoin':
        setMembers((prev) => ({ ...prev, [`${packet.id}:${packet.user}`]: { ...packet.member, _id: { server: packet.id, user: packet.user } } }));
        break;
      case 'ServerMemberLeave':
        setMembers((prev) => {
          const next = { ...prev };
          delete next[`${packet.id}:${packet.user}`];
          return next;
        });
        break;
      case 'UserUpdate':
        setUsers((prev) => ({
          ...prev,
          [packet.id]: withoutClearedFields({ ...prev[packet.id], ...packet.data }, packet.clear),
        }));
        break;
      default:
    }
  };

  useEffect(() => {
    if (!auth.token || view !== 'app') return undefined;

    let wsUrl = config.wsUrl;
    try {
      const parsed = new URL(wsUrl.startsWith('ws') ? wsUrl : `wss://${wsUrl}`);
      parsed.searchParams.set('version', '1');
      parsed.searchParams.set('format', 'json');
      wsUrl = parsed.toString();
    } catch {
      wsUrl = `${DEFAULT_WS_URL}?version=1&format=json`;
    }

    setStatus('connecting');
    if (wsRef.current) wsRef.current.close();

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => socket.send(JSON.stringify({ type: 'Authenticate', token: auth.token }));
    socket.onerror = () => setStatus('error');
    socket.onclose = () => setStatus((prev) => (prev === 'error' ? prev : 'disconnected'));

    socket.onmessage = (event) => applyEvent(JSON.parse(event.data));

    const heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'Ping', data: Date.now() }));
    }, 20000);

    return () => {
      clearInterval(heartbeat);
      socket.close();
    };
  }, [auth.token, config.wsUrl, view]);

  useEffect(() => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || selectedServerId === '@me') return undefined;

    const sendSubscribe = () => {
      if (document.visibilityState !== 'visible') return;
      if (!window.document.hasFocus()) return;

      const lastSent = subscriptionRef.current[selectedServerId] || 0;
      const tenMinutes = 10 * 60 * 1000;
      if (Date.now() - lastSent < tenMinutes) return;

      socket.send(JSON.stringify({ type: 'Subscribe', server_id: selectedServerId }));
      subscriptionRef.current[selectedServerId] = Date.now();
    };

    sendSubscribe();
    window.addEventListener('focus', sendSubscribe);
    document.addEventListener('visibilitychange', sendSubscribe);
    const interval = setInterval(sendSubscribe, 60 * 1000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', sendSubscribe);
      document.removeEventListener('visibilitychange', sendSubscribe);
    };
  }, [selectedServerId, status]);

  useEffect(() => {
    messagesBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  const fetchMembers = async (serverId) => {
    if (serverId === '@me') return;

    const loadId = Date.now();
    membersLoadIdRef.current = loadId;
    setIsMembersLoading(true);

    try {
      const res = await fetch(`${config.apiUrl}/servers/${serverId}/members`, {
        headers: { 'x-session-token': auth.token },
      });
      if (!res.ok) return;
      const data = await res.json();

      upsertUsers(data.users || []);
      const payloadMembers = data.members || [];

      for (let index = 0; index < payloadMembers.length; index += MEMBER_HYDRATE_CHUNK) {
        if (membersLoadIdRef.current !== loadId) break;
        const chunk = payloadMembers.slice(index, index + MEMBER_HYDRATE_CHUNK);

        setMembers((prev) => {
          const next = { ...prev };
          chunk.forEach((member) => {
            next[`${member._id.server}:${member._id.user}`] = member;
          });
          return next;
        });

        if (index + MEMBER_HYDRATE_CHUNK < payloadMembers.length) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    } catch {
      // no-op
    } finally {
      if (membersLoadIdRef.current === loadId) {
        setIsMembersLoading(false);
      }
    }
  };

  const enrichReplies = (nextMessages) => {
    const messageById = Object.fromEntries(nextMessages.map((entry) => [entry._id, entry]));

    return nextMessages.map((message) => {
      const replyId = Array.isArray(message.replies) ? message.replies[0] : null;
      const replyMessage = replyId ? messageById[replyId] : null;
      if (!replyMessage) return message;
      const replyAuthorId = typeof replyMessage.author === 'string' ? replyMessage.author : replyMessage.author?._id;

      return {
        ...message,
        replyMessage: {
          _id: replyMessage._id,
          content: replyMessage.content,
          authorId: replyAuthorId,
          authorUser: users[replyAuthorId] || (typeof replyMessage.author === 'object' ? replyMessage.author : null),
        },
      };
    });
  };

  const fetchMessages = async (channelId) => {
    if (!channelId || channelId === 'friends') return;

    try {
      const res = await fetch(`${config.apiUrl}/channels/${channelId}/messages?limit=100`, {
        headers: { 'x-session-token': auth.token },
      });
      if (!res.ok) return;
      const data = await res.json();

      const payloadMessages = Array.isArray(data) ? data : data.messages || [];
      const payloadUsers = Array.isArray(data) ? [] : data.users || [];

      if (payloadUsers.length) {
        upsertUsers(payloadUsers);
      }

      upsertUsersFromMessages(payloadMessages);
      const orderedMessages = payloadMessages.reverse().slice(-200);
      setMessages((prev) => ({ ...prev, [channelId]: enrichReplies(orderedMessages) }));
      void fetchMissingUsers(orderedMessages);
      preloadedChannelRef.current[channelId] = true;
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    if (status !== 'ready' || !auth.token) return;

    if (document.visibilityState !== 'visible') return;

    const maxWarmChannels = Math.min(8, Math.max(3, Math.floor((navigator.hardwareConcurrency || 4) / 2)));
    const channelsToWarm = Object.values(channels)
      .filter((channel) => channel?.channel_type === 'TextChannel' || !channel?.channel_type)
      .slice(0, maxWarmChannels);

    channelsToWarm.forEach((channel, index) => {
      if (!channel?._id || preloadedChannelRef.current[channel._id]) return;
      setTimeout(() => {
        fetchMessages(channel._id);
      }, index * 350);
    });

  }, [status, auth.token, channels]);

  const handleServerSelect = (serverId) => {
    setSelectedServerId(serverId);

    if (serverId === '@me') {
      setSelectedChannelId('friends');
      setReplyingTo(null);
      setShowEmojiPicker(false);
      return;
    }

    const firstChannel = Object.values(channels).find((ch) => ch.server === serverId);
    setSelectedChannelId(firstChannel?._id || null);
    if (firstChannel?._id) fetchMessages(firstChannel._id);
    if (!preloadedMembersRef.current[serverId]) {
      preloadedMembersRef.current[serverId] = true;
      void fetchMembers(serverId);
    }
  };

  const handleChannelSelect = (channelId) => {
    setSelectedChannelId(channelId);
    setReplyingTo(null);
    setShowEmojiPicker(false);
    fetchMessages(channelId);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      await discoverConfig(config.apiUrl);

      let token = manualToken.trim();
      let userId = null;

      if (loginMode === 'credentials') {
        const payload = { email, password, friendly_name: 'Ermine Web Client' };
        if (mfaCode.trim()) payload.mfa_response = { totp_code: mfaCode.trim() };

        const res = await fetch(`${config.apiUrl}/auth/session/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(res.status === 401 ? 'Invalid credentials or MFA code.' : 'Login failed.');

        const data = await res.json();
        token = data.token || data.session_token;
        userId = data.user_id;
      } else {
        const meRes = await fetch(`${config.apiUrl}/users/@me`, {
          headers: { 'x-session-token': token },
        });
        if (!meRes.ok) throw new Error('Token is invalid.');
        const meData = await meRes.json();
        userId = meData._id;
      }

      if (!token || !userId) throw new Error('Session creation failed.');

      localStorage.setItem('stoat_token', token);
      localStorage.setItem('stoat_user_id', userId);
      localStorage.setItem('stoat_api_url', config.apiUrl);

      setAuth({ token, userId });
      setView('app');
    } catch (error) {
      setLoginError(error.message || 'Unknown login error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('stoat_token');
    localStorage.removeItem('stoat_user_id');
    setAuth({ token: null, userId: null });
    setMessages({});
    setServers({});
    setChannels({});
    setUsers({});
    setMembers({});
    preloadedChannelRef.current = {};
    preloadedMembersRef.current = {};
    pendingUserFetchRef.current = new Set();
    membersLoadIdRef.current = 0;
    setIsMembersLoading(false);
    setView('login');
    setStatus('disconnected');
  };

  const sendMessage = async () => {
    const content = inputText.trim();
    if (!content || !selectedChannelId || selectedChannelId === 'friends') return;

    setInputText('');

    try {
      await fetch(`${config.apiUrl}/channels/${selectedChannelId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': auth.token,
        },
        body: JSON.stringify({
          content,
          nonce: crypto.randomUUID(),
          replies: replyingTo ? [replyingTo._id] : undefined,
        }),
      });
      setReplyingTo(null);
      setShowEmojiPicker(false);
    } catch {
      setInputText(content);
    }
  };


  const toggleReaction = async (message, emoji, reacted) => {
    if (!message?._id || !selectedChannelId || selectedChannelId === 'friends') return;
    const encodedEmoji = encodeURIComponent(emoji);

    setMessages((prev) => {
      const nextList = (prev[selectedChannelId] || []).map((entry) => {
        if (entry._id !== message._id) return entry;
        const existing = entry.reactions?.[emoji] || [];
        const nextUserIds = reacted ? existing.filter((id) => id !== auth.userId) : [...new Set([...existing, auth.userId])];

        return {
          ...entry,
          reactions: {
            ...(entry.reactions || {}),
            [emoji]: nextUserIds,
          },
        };
      });

      return { ...prev, [selectedChannelId]: nextList };
    });

    try {
      await fetch(`${config.apiUrl}/channels/${selectedChannelId}/messages/${message._id}/reactions/${encodedEmoji}`, {
        method: reacted ? 'DELETE' : 'PUT',
        headers: { 'x-session-token': auth.token },
      });
    } catch {
      // no-op, websocket sync should self-heal
    }
  };

  const addEmojiToComposer = (emoji) => {
    setInputText((prev) => `${prev}${emoji}`);
    setShowEmojiPicker(false);
  };

  const createServer = async () => {
    if (!createServerName.trim()) return;

    try {
      const res = await fetch(`${config.apiUrl}/servers/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': auth.token,
        },
        body: JSON.stringify({ name: createServerName.trim() }),
      });

      if (res.ok) {
        setCreateServerName('');
        setActiveModal(null);
      }
    } catch {
      // no-op
    }
  };

  const activeReply = replyingTo ? currentMessageMap[replyingTo._id] || replyingTo : null;

  const currentChannelName =
    selectedChannelId === 'friends' ? 'friends' : channels[selectedChannelId]?.name || 'select-a-channel';

  if (view === 'loading') {
    return (
      <div className="grid h-screen place-items-center bg-[#1e1f22] text-[#5865f2]">
        <Activity className="animate-spin" size={42} />
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-[#1e1f22] px-4 py-10 text-gray-100">
        <div className="mx-auto max-w-md rounded-2xl border border-[#202225] bg-[#2b2d31] p-8 shadow-2xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#5865f2] to-[#8ea1ff] text-2xl font-extrabold text-white">E</div>
            <h1 className="text-2xl font-bold text-white">Ermine</h1>
            <p className="text-sm text-gray-400">Branded stoat.chat client with a Discord-inspired layout.</p>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-[#1e1f22] p-1 text-xs font-semibold uppercase tracking-wide">
            <button
              className={`rounded py-2 ${loginMode === 'credentials' ? 'bg-[#5865f2] text-white' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setLoginMode('credentials')}
              type="button"
            >
              Credentials
            </button>
            <button
              className={`rounded py-2 ${loginMode === 'token' ? 'bg-[#5865f2] text-white' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setLoginMode('token')}
              type="button"
            >
              Token
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleLogin}>
            {loginMode === 'credentials' ? (
              <>
                <input className={inputBase} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" value={email} />
                <input className={inputBase} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" value={password} />
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <span className="mb-1 flex items-center gap-1"><ShieldCheck size={12} /> MFA</span>
                  <input className={inputBase} onChange={(e) => setMfaCode(e.target.value)} placeholder="Optional 2FA code" type="text" value={mfaCode} />
                </label>
              </>
            ) : (
              <textarea
                className={`${inputBase} h-24 resize-none`}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Paste session token"
                value={manualToken}
              />
            )}

            {loginError ? (
              <div className="flex items-start gap-2 rounded-md border border-red-800 bg-red-900/30 p-2 text-sm text-red-200">
                <AlertCircle className="mt-0.5" size={15} />
                <span>{loginError}</span>
              </div>
            ) : null}

            <button className="w-full rounded-md bg-[#5865f2] py-2.5 text-sm font-semibold text-white hover:bg-[#4956d8]" disabled={isLoggingIn} type="submit">
              {isLoggingIn ? 'Signing in…' : 'Log in to Ermine'}
            </button>
          </form>

          <div className="mt-5 border-t border-[#202225] pt-4">
            <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200" onClick={() => setShowAdvanced((prev) => !prev)} type="button">
              <Settings size={12} /> Advanced connection settings
            </button>
            {showAdvanced ? (
              <div className="mt-2 space-y-2 rounded-md bg-[#1e1f22] p-2">
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
    <div className="flex h-screen overflow-hidden bg-[#1e1f22] text-gray-100">
      {activeModal === 'create-server' ? (
        <Modal onClose={() => setActiveModal(null)} title="Create a server">
          <input className={inputBase} onChange={(e) => setCreateServerName(e.target.value)} placeholder="Server name" value={createServerName} />
          <button className="w-full rounded-md bg-[#3ba55d] py-2 text-sm font-semibold text-white hover:bg-[#328a4f]" onClick={createServer}>
            Create server
          </button>
        </Modal>
      ) : null}

      {peekUser ? (
        <Modal onClose={() => setPeekUser(null)} title="Member profile">
          <div className="flex items-center gap-3 rounded-lg bg-[#1e1f22] p-3">
            <Avatar cdnUrl={config.cdnUrl} size="lg" user={peekUser} />
            <div>
              <div className="text-base font-semibold text-white">{peekUser?.username || 'Unknown user'}</div>
              <div className="text-xs text-gray-400">#{peekUser?.discriminator || '0000'}</div>
            </div>
          </div>
          <p className="text-xs text-gray-400">Ermine profile popout for stoat.chat members.</p>
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
              {icon ? <img alt={server.name} className="h-full w-full object-cover" src={icon} /> : <span className="text-sm font-bold">{server.name.slice(0, 2).toUpperCase()}</span>}
            </button>
          );
        })}

        <button className="grid h-12 w-12 place-items-center rounded-full bg-[#313338] text-[#3ba55d] transition hover:rounded-2xl hover:bg-[#3ba55d] hover:text-white" onClick={() => setActiveModal('create-server')}>
          <Plus size={20} />
        </button>
      </aside>

      <aside className="hidden w-60 flex-col bg-[#2b2d31] md:flex">
        <div className="border-b border-[#202225] px-4 py-3">
          <div className="truncate text-sm font-bold text-white">{selectedServerId === '@me' ? 'Ermine Home' : servers[selectedServerId]?.name || 'Server'}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {selectedServerId === '@me' ? (
            <button className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${selectedChannelId === 'friends' ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373c] hover:text-white'}`} onClick={() => handleChannelSelect('friends')}>
              <Users size={16} /> Friends
            </button>
          ) : (
            channelList.map((channel) => (
              <button className={`mb-0.5 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${selectedChannelId === channel._id ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373c] hover:text-white'}`} key={channel._id} onClick={() => handleChannelSelect(channel._id)}>
                <Hash size={16} />
                <span className="truncate">{channel.name || 'channel'}</span>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-[#202225] p-2">
          <div className="flex items-center justify-between rounded bg-[#232428] p-2">
            <div className="flex items-center gap-2">
              <Avatar cdnUrl={config.cdnUrl} size="sm" user={users[auth.userId]} />
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-white">{users[auth.userId]?.username || 'Connected'}</div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">{status}</div>
              </div>
            </div>
            <button className="rounded p-1 text-gray-400 hover:bg-[#35373c] hover:text-white" onClick={logout} title="Logout">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-[#313338]">
        <header className="flex items-center justify-between border-b border-[#202225] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Hash size={17} className="text-gray-400" />
            <span>{currentChannelName}</span>
          </div>
          <div className="text-xs text-gray-400">Ermine for stoat.chat</div>
        </header>

        <section className="flex-1 overflow-y-auto py-2">
          {selectedChannelId === 'friends' ? (
            <div className="space-y-2 p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Friends ({friends.length})</h2>
              {friends.length === 0 ? <p className="text-sm text-gray-400">No friends available yet.</p> : null}
              {friends.map((friend) => (
                <button className="flex w-full items-center gap-3 rounded bg-[#2b2d31] p-3 text-left hover:bg-[#35373c]" key={friend._id} onClick={() => openUserProfile(friend, friend._id)}>
                  <Avatar cdnUrl={config.cdnUrl} user={friend} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{friend.username}</div>
                    <div className="text-xs text-gray-400">Direct message</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            currentMessages.map((message) => (
              <Message
                cdnUrl={config.cdnUrl}
                channels={channels}
                key={message._id}
                me={auth.userId}
                message={message}
                onReply={setReplyingTo}
                onToggleReaction={toggleReaction}
                onUserClick={openUserProfile}
                replyTarget={replyingTo?._id}
                users={users}
              />
            ))
          )}
          <div ref={messagesBottomRef} />
        </section>

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
          <div className="flex items-center gap-2 rounded-lg bg-[#383a40] p-2">
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
                <div className="absolute bottom-12 left-0 z-20 grid w-44 grid-cols-3 gap-1 rounded-lg border border-[#4c4f56] bg-[#232428] p-2 shadow-2xl">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button className="rounded p-1.5 text-lg hover:bg-[#3a3d42]" key={emoji} onClick={() => addEmojiToComposer(emoji)} type="button">
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <input
              className="flex-1 bg-transparent px-2 py-1 text-sm text-gray-100 placeholder:text-gray-400 focus:outline-none"
              disabled={selectedChannelId === 'friends'}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={selectedChannelId === 'friends' ? 'Select a text channel to chat.' : `Message #${currentChannelName}`}
              value={inputText}
            />
            <button className="rounded p-2 text-gray-300 hover:bg-[#4b4d55] hover:text-white" onClick={sendMessage} type="button">
              <Send size={16} />
            </button>
          </div>
        </footer>
      </main>

      <aside className="hidden w-60 flex-col border-l border-[#202225] bg-[#2b2d31] lg:flex">
        <div className="border-b border-[#202225] px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-400">
          Members — {allCurrentMembers.length}{isMembersLoading ? ' (loading...)' : ''}
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {hiddenMembersCount > 0 ? <p className="px-2 py-1 text-[11px] text-gray-500">Showing first {currentMembers.length} members for responsiveness.</p> : null}
          {currentMembers.map((member) => (
            <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-[#35373c]" key={member._id.user} onClick={() => openUserProfile(member.user, member._id.user)}>
              <Avatar cdnUrl={config.cdnUrl} size="sm" user={member.user} />
              <div className="min-w-0">
                <div className="truncate text-sm text-gray-200">{member.nickname || member.user.username}</div>
                <div className="flex items-center gap-1 text-[11px] text-gray-500">
                  <User size={11} /> {member.user.status?.presence || 'Offline'}
                </div>
              </div>
            </button>
          ))}
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

