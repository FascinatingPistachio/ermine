import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Hash, Settings, MessageSquare, Users, Image as ImageIcon, FileText, AlertCircle, ShieldCheck, Menu, X, Bookmark, Plus, UserPlus, Activity, Edit2, Trash2, Reply, CornerUpLeft } from 'lucide-react';

/**
 * STOAT / REVOLT CLIENT - CODEGEM EDITION (v6.0)
 * Features:
 * - Nitro-Style Avatars (Animate on Hover)
 * - Message Actions: Reply, Edit, Delete
 * - User Profile Popouts
 * - Markdown rendering (Basic)
 * - Persistent Login & Auto-Discovery
 * - Friend & Server Management
 */

// --- Default Configuration ---
const DEFAULT_API_URL = "https://api.stoat.chat";
const DEFAULT_WS_URL = "wss://stoat.chat/events"; 
const DEFAULT_CDN_URL = "https://autumn.revolt.chat"; 

// --- Utility Functions ---

const generateAvatarUrl = (user, cdnUrl, animate = false) => {
  if (!user?.avatar?._id) return null;
  // If we want a static image, we request a resized version (usually forces first frame for GIFs)
  // If we want animation, we request the raw ID
  const base = `${cdnUrl}/avatars/${user.avatar._id}`;
  if (!animate) return `${base}?max_side=256`; 
  return base;
};

const generateIconUrl = (server, cdnUrl) => {
  if (server?.icon?._id) return `${cdnUrl}/icons/${server.icon._id}`;
  return null;
};

const generateAttachmentUrl = (attachment, cdnUrl) => {
  return `${cdnUrl}/attachments/${attachment._id}`;
};

const formatMessageTime = (createdAt) => {
  if (!createdAt) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// --- Components ---

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
    <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
        <h3 className="font-bold text-white text-lg">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20}/></button>
      </div>
      <div className="p-4 overflow-y-auto custom-scrollbar">
        {children}
      </div>
    </div>
  </div>
);

const UserPopover = ({ user, cdnUrl, onClose }) => {
  if (!user) return null;
  const bannerUrl = user.banner ? `${cdnUrl}/banners/${user.banner._id}` : null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-800 w-80 rounded-xl overflow-hidden shadow-2xl border border-gray-700 transform transition-all scale-100" onClick={e => e.stopPropagation()}>
        <div className="h-24 bg-rose-900 relative">
          {bannerUrl && <img src={bannerUrl} className="w-full h-full object-cover opacity-80" alt="banner" />}
          <div className="absolute -bottom-10 left-4 p-1 bg-gray-800 rounded-full">
            <Avatar user={user} cdnUrl={cdnUrl} size="xl" showStatus animateOnHover={true} />
          </div>
        </div>
        <div className="pt-12 pb-4 px-4">
           <h2 className="text-xl font-bold text-white flex items-center gap-2">
             {user.username}
             <span className="text-gray-500 text-sm font-normal">#{user.discriminator || '0000'}</span>
           </h2>
           
           <div className="mt-4 space-y-2">
             {user.status?.status_text && (
               <div className="bg-gray-900/50 p-2 rounded text-sm text-gray-300 italic border border-gray-700/50">
                 "{user.status.status_text}"
               </div>
             )}
             
             <div className="border-t border-gray-700 pt-2 mt-2">
               <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Badges</h4>
               <div className="flex gap-1 flex-wrap">
                 {user.badges && (user.badges & 1) ? <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] rounded border border-blue-500/30">Developer</span> : null}
                 <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-[10px] rounded border border-gray-600">Early Bird</span>
               </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = "button" }) => {
  const baseStyle = "px-4 py-2 rounded-md font-medium transition-all duration-200 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-rose-600 hover:bg-rose-700 text-white disabled:bg-rose-800 disabled:opacity-50",
    secondary: "bg-gray-700 hover:bg-gray-600 text-gray-100",
    ghost: "bg-transparent hover:bg-gray-800 text-gray-300 hover:text-white",
    danger: "bg-red-900/20 text-red-200 hover:bg-red-900/40 border border-red-900/50",
    icon: "p-2 hover:bg-gray-600 text-gray-400 hover:text-gray-100 rounded-full",
  };
  return (
    <button type={type} onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`} disabled={disabled}>
      {children}
    </button>
  );
};

const Input = ({ type = "text", placeholder, value, onChange, className = "", onKeyDown }) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    onKeyDown={onKeyDown}
    className={`w-full bg-gray-900 border border-gray-700 text-gray-100 px-4 py-2 rounded-md focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors ${className}`}
  />
);

const Avatar = ({ user, cdnUrl, size = "md", showStatus = false, animateOnHover = true }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  
  const sizeClasses = { sm: "w-8 h-8", md: "w-10 h-10", lg: "w-12 h-12", xl: "w-24 h-24" };
  const initials = user?.username ? user.username.substring(0, 2).toUpperCase() : "??";
  
  // Decide which URL to show
  // If animateOnHover is true: Show static normally, animated on hover
  // If animateOnHover is false: Show static always
  const shouldAnimate = animateOnHover && isHovered;
  const imageUrl = !imgError ? generateAvatarUrl(user, cdnUrl, shouldAnimate) : null;
  
  const statusColor = {
    Online: "bg-green-500",
    Idle: "bg-yellow-500",
    Busy: "bg-red-500",
    Invisible: "bg-gray-500",
    Offline: "bg-gray-500"
  }[user?.status?.presence || "Offline"];

  return (
    <div 
      className={`relative inline-block`} 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`${sizeClasses[size]} rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0 select-none border border-gray-600`}>
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={user.username} 
            className="w-full h-full object-cover" 
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="font-bold text-gray-300 text-xs">{initials}</span>
        )}
      </div>
      {showStatus && (
        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-800 ${statusColor}`} />
      )}
    </div>
  );
};

const Message = ({ msg, users, cdnUrl, currentUserId, onReply, onEdit, onDelete, onUserClick }) => {
  const user = users[msg.author] || { username: 'Unknown', _id: msg.author };
  const isMe = msg.author === currentUserId;
  const [isHovered, setIsHovered] = useState(false);

  const renderContent = () => {
    let content = msg.content || "";
    
    // Basic Markdown Parsing
    // Code Blocks
    const codeBlockRegex = /```([\s\S]*?)```/g;
    const parts = content.split(codeBlockRegex);
    
    return parts.map((part, idx) => {
        if (idx % 2 === 1) {
            // This is code
            return (
                <pre key={idx} className="bg-gray-900 p-2 rounded text-xs font-mono text-green-400 overflow-x-auto my-1 border border-gray-700">
                    <code>{part}</code>
                </pre>
            );
        }
        
        // Text formatting
        const textParts = part.split(/(<@[A-Za-z0-9]+>|\*\*.*?\*\*|https?:\/\/[^\s]+)/g);
        
        return (
            <span key={idx}>
                {textParts.map((t, i) => {
                    if (t.startsWith('<@')) {
                        const uid = t.replace(/[<@>]/g, '');
                        const u = users[uid];
                        return <span key={i} className="bg-rose-500/20 text-rose-300 px-1 rounded font-medium cursor-pointer hover:underline" onClick={() => onUserClick(u || { _id: uid })}>{u ? `@${u.username}` : t}</span>
                    }
                    if (t.startsWith('**') && t.endsWith('**')) {
                        return <strong key={i} className="text-gray-100">{t.slice(2, -2)}</strong>
                    }
                    if (t.match(/^https?:\/\//)) {
                        return <a key={i} href={t} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{t}</a>
                    }
                    return t;
                })}
            </span>
        );
    });
  };

  const renderAttachments = () => {
    if (!msg.attachments) return null;
    return (
       <div className="flex flex-wrap gap-2 mt-1">
          {msg.attachments.map(att => {
             const url = generateAttachmentUrl(att, cdnUrl);
             if (att.metadata?.type === 'Image') {
                return <img key={att._id} src={url} alt={att.filename} loading="lazy" decoding="async" className="max-w-[300px] max-h-[300px] rounded-md border border-gray-700 bg-gray-900" />
             }
             return <a key={att._id} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-gray-800 p-2 rounded border border-gray-700 text-blue-400 text-sm"><FileText size={16}/> {att.filename}</a>
          })}
       </div>
    );
  };

  return (
    <div 
      className={`group flex gap-3 py-1 px-2 hover:bg-gray-800/50 rounded -mx-2 transition-colors relative`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
       <div className="mt-0.5 cursor-pointer" onClick={() => onUserClick(user)}>
          <Avatar user={user} cdnUrl={cdnUrl} size="md" animateOnHover={true} />
       </div>
       <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
             <span className="font-bold text-gray-200 text-sm hover:underline cursor-pointer" onClick={() => onUserClick(user)}>{user.username}</span>
             <span className="text-[10px] text-gray-500">{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
          <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
             {renderContent()}
          </div>
          {renderAttachments()}
       </div>

       {/* Hover Actions */}
       {isHovered && (
         <div className="absolute -top-2 right-4 bg-gray-900 border border-gray-700 rounded shadow-lg flex items-center p-0.5 z-10">
            <button onClick={() => onReply(msg)} className="p-1.5 hover:bg-gray-700 text-gray-400 hover:text-white rounded" title="Reply"><Reply size={14}/></button>
            {isMe && (
               <>
                 <button onClick={() => onEdit(msg)} className="p-1.5 hover:bg-gray-700 text-gray-400 hover:text-white rounded" title="Edit"><Edit2 size={14}/></button>
                 <button onClick={() => onDelete(msg._id)} className="p-1.5 hover:bg-gray-700 text-gray-400 hover:text-red-400 rounded" title="Delete"><Trash2 size={14}/></button>
               </>
            )}
         </div>
       )}
    </div>
  );
};

// --- Main Application ---

export default function App() {
  // Config & Auth
  const [view, setView] = useState('loading'); 
  const [config, setConfig] = useState({ apiUrl: DEFAULT_API_URL, wsUrl: DEFAULT_WS_URL, cdnUrl: DEFAULT_CDN_URL });
  const [auth, setAuth] = useState({ token: null, userId: null });
  
  // Data State
  const [status, setStatus] = useState('disconnected');
  const [servers, setServers] = useState({});
  const [channels, setChannels] = useState({});
  const [users, setUsers] = useState({});
  const [members, setMembers] = useState({}); 
  const [messages, setMessages] = useState({});
  
  // UI State
  const [selectedServerId, setSelectedServerId] = useState('@me');
  const [selectedChannelId, setSelectedChannelId] = useState('friends');
  const [inputText, setInputText] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false); 
  const [showMembers, setShowMembers] = useState(true);
  
  // Interaction State
  const [replyingTo, setReplyingTo] = useState(null); // Message Object
  const [editingId, setEditingId] = useState(null); // Message ID
  const [popoverUser, setPopoverUser] = useState(null); // User Object
  
  // Modals
  const [activeModal, setActiveModal] = useState(null);
  const [newServerName, setNewServerName] = useState('');

  // Login Form
  const [loginMethod, setLoginMethod] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const ws = useRef(null);
  const messagesEndRef = useRef(null);
  
  // --- Initialization ---

  useEffect(() => {
    const savedToken = localStorage.getItem('stoat_token');
    const savedUserId = localStorage.getItem('stoat_user_id');
    const savedApi = localStorage.getItem('stoat_api_url');
    
    if (savedApi) {
      setConfig(prev => ({ ...prev, apiUrl: savedApi }));
      discoverConfig(savedApi);
    } else {
      discoverConfig(DEFAULT_API_URL);
    }

    if (savedToken && savedUserId) {
      setAuth({ token: savedToken, userId: savedUserId });
      setView('app');
    } else {
      setView('login');
    }
  }, []);

  const discoverConfig = async (url) => {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        setConfig(prev => ({
          ...prev,
          apiUrl: url,
          wsUrl: data.ws || prev.wsUrl,
          cdnUrl: data.features?.autumn?.url || prev.cdnUrl
        }));
      }
    } catch (e) { console.warn("Discovery failed", e); }
  };

  // --- Helpers ---

  const fetchMembers = async (serverId) => {
    if (serverId === '@me') return;
    try {
      const res = await fetch(`${config.apiUrl}/servers/${serverId}/members`, {
        headers: { 'x-session-token': auth.token }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.users) {
           setUsers(prev => {
             const next = { ...prev };
             data.users.forEach(u => next[u._id] = u);
             return next;
           });
        }
        if (data.members) {
           setMembers(prev => {
             const next = { ...prev };
             data.members.forEach(m => {
               const key = `${m._id.server}:${m._id.user}`;
               next[key] = m;
             });
             return next;
           });
        }
      }
    } catch (e) { console.error("Failed to fetch members", e); }
  };

  // --- WebSocket Logic ---

  useEffect(() => {
    if (!auth.token || view !== 'app') return;

    let connectionUrlStr = config.wsUrl;
    try {
      if (!connectionUrlStr.startsWith('ws')) connectionUrlStr = `wss://${connectionUrlStr}`;
      const urlObj = new URL(connectionUrlStr);
      urlObj.searchParams.set('version', '1');
      urlObj.searchParams.set('format', 'json');
      connectionUrlStr = urlObj.toString();
    } catch (e) {
      if (!connectionUrlStr.includes('?')) connectionUrlStr += "?version=1&format=json";
    }

    console.log("💎 Connecting WS...", connectionUrlStr);
    setStatus('connecting');
    if (ws.current) ws.current.close();

    const socket = new WebSocket(connectionUrlStr);
    ws.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "Authenticate", token: auth.token }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWsMessage(data);
      } catch (e) { console.error(e); }
    };

    socket.onclose = () => {
      setStatus(prev => (prev === 'error' ? prev : 'disconnected'));
    };
    socket.onerror = () => setStatus('error');

    const pingInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "Ping", data: 0 }));
    }, 20000); 

    return () => {
      clearInterval(pingInterval);
      if (ws.current) ws.current.close();
    };
  }, [auth.token, view, config.wsUrl]);

  const handleWsMessage = (packet) => {
    switch (packet.type) {
      case 'Authenticated': break;
      case 'Ready':
        setUsers(prev => {
           const next = { ...prev };
           packet.users?.forEach(u => next[u._id] = u);
           return next;
        });
        setServers(prev => {
           const next = { ...prev };
           packet.servers?.forEach(s => next[s._id] = s);
           return next;
        });
        setChannels(prev => {
           const next = { ...prev };
           packet.channels?.forEach(c => next[c._id] = c);
           return next;
        });
        setMembers(prev => {
           const next = { ...prev };
           packet.members?.forEach(m => {
             const key = `${m._id.server}:${m._id.user}`;
             next[key] = m;
           });
           return next;
        });
        setStatus('ready');
        break;
      case 'Message':
        setMessages(prev => {
          const list = prev[packet.channel] || [];
          if (list.find(m => m._id === packet._id)) return prev;
          return { ...prev, [packet.channel]: [...list, packet] };
        });
        break;
      case 'MessageUpdate':
         // Handle edits
         setMessages(prev => {
            const list = prev[packet.channelId] || [];
            return {
               ...prev,
               [packet.channelId]: list.map(m => m._id === packet.id ? { ...m, ...packet.data } : m)
            };
         });
         break;
      case 'MessageDelete':
         // Handle delete
         setMessages(prev => {
            const list = prev[packet.channelId] || [];
            return {
               ...prev,
               [packet.channelId]: list.filter(m => m._id !== packet.id)
            };
         });
         break;
      case 'UserUpdate':
         setUsers(prev => ({
            ...prev,
            [packet.id]: { ...prev[packet.id], ...packet.data }
         }));
         break;
      default: break;
    }
  };

  // --- Actions ---

  const handleServerSelect = (serverId) => {
    setSelectedServerId(serverId);
    if (serverId !== '@me') {
       fetchMembers(serverId);
       const serverChans = Object.values(channels).filter(c => c.server === serverId);
       if (serverChans.length > 0) {
         setSelectedChannelId(serverChans[0]._id);
         fetchMessages(serverChans[0]._id);
       } else {
         setSelectedChannelId(null);
       }
    } else {
       setSelectedChannelId('friends');
    }
    setShowMobileMenu(false);
  };

  const createServer = async () => {
    if(!newServerName.trim()) return;
    try {
      const res = await fetch(`${config.apiUrl}/servers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': auth.token },
        body: JSON.stringify({ name: newServerName })
      });
      if(res.ok) {
        setActiveModal(null);
        setNewServerName('');
      }
    } catch(e) { console.error(e); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    await discoverConfig(config.apiUrl);

    try {
      let token = manualToken;
      let uid = null;

      if (loginMethod === 'credentials') {
        const payload = { email, password, friendly_name: "Stoat Web Client" };
        if (mfaCode) payload.mfa_response = { totp_code: mfaCode };
        
        const res = await fetch(`${config.apiUrl}/auth/session/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(res.status === 401 ? "Check creds/2FA" : "Login failed");
        const data = await res.json();
        token = data.token || data.session_token;
        uid = data.user_id;
      } else {
         const meRes = await fetch(`${config.apiUrl}/users/@me`, {
           headers: { 'x-session-token': token, 'Content-Type': 'application/json' }
        });
        if (!meRes.ok) throw new Error("Invalid token");
        const meData = await meRes.json();
        uid = meData._id;
      }

      if (token && uid) {
        localStorage.setItem('stoat_token', token);
        localStorage.setItem('stoat_user_id', uid);
        localStorage.setItem('stoat_api_url', config.apiUrl);
        setAuth({ token, userId: uid });
        setView('app');
      }
    } catch (err) { setLoginError(err.message); } finally { setIsLoggingIn(false); }
  };

  const logout = () => {
    localStorage.removeItem('stoat_token');
    localStorage.removeItem('stoat_user_id');
    setAuth({ token: null, userId: null });
    setView('login');
    setStatus('disconnected');
    setMessages({});
    setChannels({});
    setServers({});
    setUsers({});
    setActiveModal(null);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !selectedChannelId) return;
    const content = inputText;
    const activeEditId = editingId;
    const activeReply = replyingTo;
    
    // Clear Input immediately for UX
    setInputText('');
    setReplyingTo(null);
    setEditingId(null);

    try {
      if (activeEditId) {
         // Edit Mode
         await fetch(`${config.apiUrl}/channels/${selectedChannelId}/messages/${activeEditId}`, {
           method: 'PATCH',
           headers: { 'Content-Type': 'application/json', 'x-session-token': auth.token },
           body: JSON.stringify({ content })
         });
      } else {
         // Send Mode
         const payload = { 
            content, 
            nonce: Math.random().toString(36).substring(7),
            replies: activeReply ? [{ id: activeReply._id, mention: true }] : undefined
         };
         
         await fetch(`${config.apiUrl}/channels/${selectedChannelId}/messages`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', 'x-session-token': auth.token },
           body: JSON.stringify(payload)
         });
      }
    } catch (err) {
      console.error(err);
      setInputText(content);
      setReplyingTo(activeReply);
      setEditingId(activeEditId);
    }
  };

  const deleteMessage = async (msgId) => {
     if (!confirm("Delete this message?")) return;
     try {
       await fetch(`${config.apiUrl}/channels/${selectedChannelId}/messages/${msgId}`, {
           method: 'DELETE',
           headers: { 'x-session-token': auth.token },
       });
     } catch(e) { console.error(e); }
  };

  const fetchMessages = async (channelId) => {
    if(channelId === 'friends') return;
    try {
      const res = await fetch(`${config.apiUrl}/channels/${channelId}/messages?limit=50`, {
        headers: { 'x-session-token': auth.token }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => ({
          ...prev,
          [channelId]: Array.isArray(data) ? data.reverse() : []
        }));
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedChannelId, replyingTo]);

  // --- Render Helpers ---

  const serverList = useMemo(() => Object.values(servers), [servers]);
  
  const currentMembers = useMemo(() => {
    if (selectedServerId === '@me') return [];
    return Object.values(members)
      .filter(m => m._id.server === selectedServerId)
      .map(m => ({ ...m, user: users[m._id.user] }))
      .filter(m => m.user)
      .sort((a, b) => (a.user.username > b.user.username ? 1 : -1));
  }, [members, users, selectedServerId]);

  const friends = useMemo(() => {
     return Object.values(users).filter(u => u.relationship === 'Friend' || u.relationship === 1);
  }, [users]);

  // --- Views ---

  const renderModals = () => (
    <>
      {activeModal === 'create-server' && (
        <Modal title="Create a Server" onClose={() => setActiveModal(null)}>
           <div className="space-y-4">
              <p className="text-gray-400 text-sm">Give your new home a name.</p>
              <Input placeholder="My Awesome Server" value={newServerName} onChange={e => setNewServerName(e.target.value)} />
              <Button onClick={createServer} className="w-full">Create</Button>
           </div>
        </Modal>
      )}
      {activeModal === 'settings' && (
        <Modal title="My Account" onClose={() => setActiveModal(null)}>
           <div className="space-y-6 flex flex-col items-center">
              <Avatar user={users[auth.userId]} cdnUrl={config.cdnUrl} size="xl" showStatus animateOnHover={true} />
              <div className="text-center">
                 <h2 className="text-xl font-bold text-white">{users[auth.userId]?.username}</h2>
                 <p className="text-xs text-gray-500 font-mono">ID: {auth.userId}</p>
              </div>
              <div className="w-full bg-gray-900/50 p-3 rounded text-sm text-gray-400">
                 <p>Status: <span className="text-green-400">Online</span></p>
                 <p>Email: {email || "Hidden"}</p>
              </div>
              <Button variant="danger" onClick={logout} className="w-full">Log Out</Button>
           </div>
        </Modal>
      )}
      {popoverUser && (
         <UserPopover user={popoverUser} cdnUrl={config.cdnUrl} onClose={() => setPopoverUser(null)} />
      )}
    </>
  );

  const renderFriendsView = () => (
    <div className="flex-1 flex flex-col bg-gray-700 h-full overflow-hidden">
       <div className="h-12 flex items-center px-4 border-b border-gray-600 bg-gray-800 shadow-sm shrink-0">
          <button onClick={() => setShowMobileMenu(true)} className="md:hidden text-gray-400 mr-2"><Menu/></button>
          <Users size={20} className="text-gray-400 mr-2" />
          <span className="font-bold text-gray-100">Friends</span>
       </div>
       <div className="p-4 overflow-y-auto">
          {friends.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
               <UserPlus size={48} className="mx-auto mb-4 opacity-50"/>
               <p>No friends found yet.</p>
               <p className="text-xs mt-2">Add people via their username in the mobile app!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
               {friends.map(friend => (
                 <div key={friend._id} className="bg-gray-800 p-3 rounded flex items-center gap-3 border border-gray-600 cursor-pointer hover:bg-gray-750" onClick={() => setPopoverUser(friend)}>
                    <Avatar user={friend} cdnUrl={config.cdnUrl} size="md" showStatus />
                    <div className="flex flex-col">
                       <span className="font-bold text-gray-200">{friend.username}</span>
                       <span className="text-xs text-gray-400">{friend.status?.presence || 'Offline'}</span>
                    </div>
                 </div>
               ))}
            </div>
          )}
       </div>
    </div>
  );

  const renderChannelList = () => {
    const isDM = selectedServerId === '@me';
    let items = [];
    let title = isDM ? "Direct Messages" : servers[selectedServerId]?.name || "Server";

    if (isDM) {
      items = Object.values(channels).filter(c => 
        c.channel_type === 'DirectMessage' || c.channel_type === 'Group' || c.channel_type === 'SavedMessages'
      );
    } else {
      items = Object.values(channels).filter(c => c.server === selectedServerId);
    }

    return (
      <div className={`${showMobileMenu ? 'block absolute z-40 inset-0 bg-gray-800' : 'hidden'} md:flex w-64 bg-gray-800 flex-col h-full border-r border-gray-700 flex-shrink-0`}>
        <div className="h-12 flex items-center px-4 shadow-sm border-b border-gray-700 justify-between">
          <span className="font-bold text-gray-100 truncate">{title}</span>
          <button onClick={() => setShowMobileMenu(false)} className="md:hidden text-gray-400"><X/></button>
        </div>
        <div className="p-2 gap-1 flex flex-col overflow-y-auto flex-1">
          {isDM && (
             <button
               onClick={() => { setSelectedChannelId('friends'); setShowMobileMenu(false); }}
               className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${selectedChannelId === 'friends' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'}`}
             >
               <Users size={18}/>
               <span className="font-medium text-sm">Friends</span>
             </button>
          )}
          
          {items.map(c => {
             let label = c.name;
             let icon = <Hash size={18} />;
             let avatarUser = null;

             if (c.channel_type === 'SavedMessages') {
                label = "Saved Notes";
                icon = <Bookmark size={18} />;
             } else if (isDM && !label && c.recipients) {
               const otherId = c.recipients.find(id => id !== auth.userId);
               avatarUser = users[otherId];
               label = avatarUser?.username || "Unknown User";
               icon = null;
             }

             return (
              <button
                key={c._id}
                onClick={() => { setSelectedChannelId(c._id); fetchMessages(c._id); setShowMobileMenu(false); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${selectedChannelId === c._id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'}`}
              >
                {avatarUser ? <Avatar user={avatarUser} cdnUrl={config.cdnUrl} size="sm" showStatus animateOnHover={false} /> : icon}
                <span className="truncate text-sm font-medium">{label}</span>
              </button>
             );
          })}
        </div>
        <div className="h-14 bg-gray-900/50 flex items-center px-3 justify-between shrink-0">
          <div className="flex items-center gap-2 overflow-hidden cursor-pointer" onClick={() => setActiveModal('settings')}>
             <Avatar user={users[auth.userId]} cdnUrl={config.cdnUrl} size="sm" showStatus />
             <div className="flex flex-col min-w-0">
               <span className="text-xs font-bold text-white truncate">{users[auth.userId]?.username || '...'}</span>
               <span className="text-[10px] text-gray-400">Online</span>
             </div>
          </div>
          <button onClick={() => setActiveModal('settings')} className="p-2 hover:bg-gray-700 rounded-md text-gray-400 hover:text-white">
            <Settings size={16} />
          </button>
        </div>
      </div>
    );
  };

  const renderChat = () => {
    if (selectedChannelId === 'friends') return renderFriendsView();

    if (!selectedChannelId) return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-700 text-gray-400">
        <MessageSquare size={48} className="mb-4 text-gray-600"/>
        <p>Select a channel to chat.</p>
      </div>
    );

    const channel = channels[selectedChannelId];
    const msgs = messages[selectedChannelId] || [];

    return (
      <div className="flex-1 flex flex-col bg-gray-700 h-full overflow-hidden min-w-0">
        <div className="h-12 flex items-center px-4 border-b border-gray-600 bg-gray-800 shadow-sm shrink-0 justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
             <button onClick={() => setShowMobileMenu(true)} className="md:hidden text-gray-400"><Menu/></button>
             <Hash size={20} className="text-gray-400" />
             <span className="font-bold text-gray-100 truncate">{channel?.name || users[channel?.recipients?.find(id => id !== auth.userId)]?.username || "Chat"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowMembers(!showMembers)} className={`p-2 rounded hover:bg-gray-700 transition-colors ${showMembers ? 'text-rose-400' : 'text-gray-400'}`}>
              <Users size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-900 scrollbar-track-transparent">
          {msgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
              <span className="text-sm">Start the conversation!</span>
            </div>
          ) : (
            msgs.map((msg, idx) => (
              <Message 
                 key={msg._id || idx} 
                 msg={msg} 
                 users={users} 
                 cdnUrl={config.cdnUrl} 
                 currentUserId={auth.userId}
                 onReply={(m) => { setReplyingTo(m); }}
                 onEdit={(m) => { setEditingId(m._id); setInputText(m.content); }}
                 onDelete={(id) => deleteMessage(id)}
                 onUserClick={setPopoverUser}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 bg-gray-700 shrink-0">
          {replyingTo && (
             <div className="flex items-center justify-between text-xs text-gray-400 bg-gray-800/50 p-2 rounded-t border-t border-x border-gray-600">
                <span className="flex items-center gap-1"><CornerUpLeft size={12}/> Replying to <span className="font-bold text-rose-400">@{users[replyingTo.author]?.username}</span></span>
                <button onClick={() => setReplyingTo(null)}><X size={12}/></button>
             </div>
          )}
          {editingId && (
             <div className="flex items-center justify-between text-xs text-gray-400 bg-gray-800/50 p-2 rounded-t border-t border-x border-gray-600">
                <span className="flex items-center gap-1"><Edit2 size={12}/> Editing Message</span>
                <button onClick={() => { setEditingId(null); setInputText(''); }}><X size={12}/></button>
             </div>
          )}
          <div className={`bg-gray-600/50 rounded-lg p-2 flex items-center gap-2 border border-transparent focus-within:border-rose-500/50 transition-colors relative ${replyingTo || editingId ? 'rounded-t-none' : ''}`}>
            <button className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-600 rounded-full transition-colors"><ImageIcon size={18} /></button>
            <input
              type="text"
              className="flex-1 bg-transparent border-none focus:ring-0 text-gray-100 placeholder-gray-400"
              placeholder={`Message...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { 
                  if (e.key === 'Enter') sendMessage(); 
                  if (e.key === 'Escape') { setReplyingTo(null); setEditingId(null); setInputText(''); }
              }}
            />
            <button onClick={sendMessage} disabled={!inputText.trim()} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Send size={20} /></button>
          </div>
          {(replyingTo || editingId) && <div className="text-[10px] text-gray-500 mt-1 pl-2">Esc to cancel</div>}
        </div>
      </div>
    );
  };

  const renderMemberList = () => {
    if (selectedServerId === '@me' || !showMembers) return null;
    return (
      <div className="hidden lg:flex w-60 bg-gray-800 flex-col h-full border-l border-gray-700 flex-shrink-0">
        <div className="h-12 flex items-center px-4 shadow-sm border-b border-gray-700">
           <span className="font-bold text-gray-400 text-xs uppercase tracking-wider">Members — {currentMembers.length}</span>
        </div>
        <div className="p-3 gap-2 flex flex-col overflow-y-auto flex-1">
          {currentMembers.map(m => (
            <div key={m._id.user} onClick={() => setPopoverUser(m.user)} className="flex items-center gap-3 opacity-90 hover:opacity-100 hover:bg-gray-700/50 p-1.5 rounded cursor-pointer group">
               <Avatar user={m.user} cdnUrl={config.cdnUrl} size="sm" showStatus />
               <div className="flex flex-col min-w-0">
                 <span className={`text-sm font-medium truncate ${m.user.status?.presence === 'Online' ? 'text-gray-200' : 'text-gray-400'}`}>
                   {m.nickname || m.user.username}
                 </span>
               </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (view === 'loading') return <div className="h-screen bg-gray-900 flex items-center justify-center text-rose-500"><Activity className="animate-spin" size={48} /></div>;

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 my-8">
          <div className="text-center mb-8">
             <div className="w-16 h-16 bg-rose-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-rose-900/50 transform rotate-3"><span className="text-3xl font-bold">S</span></div>
             <h1 className="text-2xl font-bold text-white">Stoat</h1>
          </div>
          <div className="flex mb-6 bg-gray-900 p-1 rounded-lg">
             <button onClick={() => setLoginMethod('credentials')} className={`flex-1 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${loginMethod === 'credentials' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>Credentials</button>
             <button onClick={() => setLoginMethod('token')} className={`flex-1 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${loginMethod === 'token' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>Token</button>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            {loginMethod === 'credentials' ? (
              <>
                <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email</label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
                <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-2"><ShieldCheck size={12}/> 2FA</label><Input type="text" value={mfaCode} onChange={e => setMfaCode(e.target.value)} className="text-center tracking-widest" placeholder="000 000" /></div>
              </>
            ) : (
              <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Session Token</label><textarea value={manualToken} onChange={e => setManualToken(e.target.value)} className="w-full bg-gray-900 border border-gray-700 text-gray-100 p-3 rounded text-xs h-24" /></div>
            )}
            {loginError && <div className="bg-red-900/30 border border-red-800 p-3 rounded text-sm text-red-200 flex items-center gap-2"><AlertCircle size={16}/>{loginError}</div>}
            <Button className="w-full py-3" disabled={isLoggingIn} type="submit">{isLoggingIn ? "Loading..." : "Log In"}</Button>
          </form>
          <div className="mt-6 border-t border-gray-700 pt-4">
             <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-gray-500 w-full flex justify-center items-center gap-1"><Settings size={12}/> Connection Settings</button>
             {showAdvanced && (
               <div className="mt-3 space-y-2 bg-black/20 p-3 rounded">
                 <Input value={config.apiUrl} onChange={e => setConfig({...config, apiUrl: e.target.value})} placeholder="API URL" className="text-xs py-1" />
                 <Input value={config.wsUrl} onChange={e => setConfig({...config, wsUrl: e.target.value})} placeholder="WS URL" className="text-xs py-1" />
                 <Input value={config.cdnUrl} onChange={e => setConfig({...config, cdnUrl: e.target.value})} placeholder="CDN URL (Autumn)" className="text-xs py-1" />
               </div>
             )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-800 text-gray-100 flex overflow-hidden font-sans">
      <div className="w-18 bg-gray-900 flex flex-col items-center py-4 gap-2 border-r border-gray-800 h-full overflow-y-auto no-scrollbar flex-shrink-0">
        <button onClick={() => handleServerSelect('@me')} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${selectedServerId === '@me' ? 'bg-rose-600 rounded-2xl' : 'bg-gray-700 hover:bg-rose-600 hover:rounded-2xl'}`}><MessageSquare size={24} className="text-white" /></button>
        <div className="w-8 h-0.5 bg-gray-800 rounded-full my-1" />
        {serverList.map(server => {
          const iconUrl = generateIconUrl(server, config.cdnUrl);
          return (
            <button key={server._id} onClick={() => handleServerSelect(server._id)} className={`group relative w-12 h-12 rounded-full flex items-center justify-center transition-all ${selectedServerId === server._id ? 'rounded-2xl ring-2 ring-rose-500' : 'bg-gray-700 hover:rounded-2xl hover:bg-rose-600'}`}>
               <div className="absolute left-14 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">{server.name}</div>
               {iconUrl ? <div className="w-full h-full overflow-hidden rounded-[inherit]"><img src={iconUrl} alt={server.name} className="w-full h-full object-cover" /></div> : <span className="text-white font-medium text-sm">{server.name.substring(0,2)}</span>}
            </button>
          );
        })}
        <button onClick={() => setActiveModal('create-server')} className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-800 hover:bg-green-600 text-green-500 hover:text-white transition-all"><Plus size={24} /></button>
      </div>
      {renderChannelList()}
      {renderChat()}
      {renderMemberList()}
      {renderModals()}
      {(status === 'disconnected' || status === 'error') && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
           <div className="bg-gray-800 p-6 rounded-lg text-center border border-gray-700 shadow-2xl">
              <div className="animate-spin w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full mx-auto mb-4" />
              <h3 className="font-bold text-lg">Reconnecting...</h3>
              <p className="text-gray-400 text-sm mb-4">Connection status: {status}</p>
              <div className="flex gap-2">
                 <Button variant="secondary" onClick={() => window.location.reload()}>Reload</Button>
                 <Button variant="danger" onClick={logout}>Logout</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
