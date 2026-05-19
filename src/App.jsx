// Ermine 0.6.0 — stoat.chat refined client
import React, { useCallback, useEffect, useMemo, useRef, useState, memo, Component } from 'react';
import { AlertCircle, BookOpen, Check, ChevronDown, ChevronRight, Copy, Edit2, Hash, Info, Link, Loader, LogOut, Menu, MessageSquare, Paperclip, Pin, Plus, Reply, Save, Search, Send, Settings, Trash2, Users, UserPlus, UserX, X } from 'lucide-react';

// ─── ULID generator (stoat uses ulid for message nonces, from Draft.ts) ─────
const ULID_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function genUlid() {
  const t = Date.now();
  let s = '';
  let tmp = t;
  for (let i = 9; i >= 0; i--) { s = ULID_CHARS[tmp % 32] + s; tmp = Math.floor(tmp / 32); }
  for (let i = 0; i < 16; i++) s += ULID_CHARS[Math.floor(Math.random() * 32)];
  return s;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = { rail:'#1e1f22',sidebar:'#2b2d31',chat:'#313338',input:'#383a40',elevated:'#232428',hover:'#35373c',active:'#404249',brand:'#5865f2',brandH:'#4752c4',green:'#3ABF7E',yellow:'#F39F00',red:'#F84848',blue:'#4799F0',grey:'#A5A5A5',t1:'#f2f3f5',t2:'#b5bac1',t3:'#80848e' };
const inp = `w-full rounded bg-[#1e1f22] border border-transparent px-3 py-2 text-sm text-[#f2f3f5] placeholder:text-[#80848e] focus:border-[#5865f2] focus:outline-none transition-colors`;
const PRES = { Online:'#3ABF7E', Idle:'#F39F00', Busy:'#F84848', Focus:'#4799F0', Invisible:'#A5A5A5' };
const pc = (p) => PRES[p] ?? '#A5A5A5';

// ─── Config / Cookies ─────────────────────────────────────────────────────────
const IM = typeof import.meta !== 'undefined' ? import.meta.env : {};
const DEF = { api: IM?.VITE_STOAT_API_URL||'https://api.stoat.chat', ws: IM?.VITE_STOAT_WS_URL||'wss://stoat.chat/events', cdn: IM?.VITE_STOAT_CDN_URL||'https://cdn.stoatusercontent.com' };
const SEC = typeof window !== 'undefined' && window.location.protocol === 'https:';
const gc=(n)=>{const v=document.cookie.split('; ').find(e=>e.startsWith(n+'='));return v?decodeURIComponent(v.slice(n.length+1)):null;};
const sc=(n,v,a=2592000)=>{document.cookie=`${n}=${encodeURIComponent(v)}; Max-Age=${a}; Path=/; SameSite=Lax${SEC?'; Secure':''}`;};
const dc=(n)=>{document.cookie=`${n}=; Max-Age=0; Path=/; SameSite=Lax${SEC?'; Secure':''}`;};

// ─── ULID / time ─────────────────────────────────────────────────────────────
const DEC32 = Object.fromEntries('0123456789ABCDEFGHJKMNPQRSTVWXYZ'.split('').map((c,i)=>[c,i]));
const uMs=(id)=>{if(!id||id.length!==26)return 0;let t=0;for(let i=0;i<10;i++)t=t*32+(DEC32[id[i].toUpperCase()]??0);return t;};
const uDate=(id)=>new Date(uMs(id));
const fmtT=(v)=>{try{const d=typeof v==='string'&&v.length===26?uDate(v):new Date(v);if(isNaN(d))return'';const t=d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});const now=new Date(),yes=new Date(now);yes.setDate(yes.getDate()-1);return d.toDateString()===now.toDateString()?`Today at ${t}`:d.toDateString()===yes.toDateString()?`Yesterday at ${t}`:`${d.toLocaleDateString()} ${t}`;}catch{return'';}};
const fmtS=(v)=>{try{const d=typeof v==='string'&&v.length===26?uDate(v):new Date(v);return isNaN(d)?'':d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}catch{return'';}};
const dayK=(m)=>{try{const d=m.createdAt?new Date(m.createdAt):uDate(m._id);return isNaN(d)?'':d.toDateString();}catch{return'';}};
const dayLbl=(m)=>{try{const d=m.createdAt?new Date(m.createdAt):uDate(m._id);if(isNaN(d))return'';const now=new Date(),yes=new Date(now);yes.setDate(yes.getDate()-1);return d.toDateString()===now.toDateString()?'Today':d.toDateString()===yes.toDateString()?'Yesterday':d.toLocaleDateString([],{weekday:'long',year:'numeric',month:'long',day:'numeric'});}catch{return'';}};
const dateLbl=(v)=>{if(!v)return'Unknown';try{const d=new Date(v);return isNaN(d)?'Unknown':d.toLocaleDateString([],{year:'numeric',month:'short',day:'numeric'});}catch{return'Unknown';}};

// ─── Asset / data helpers ─────────────────────────────────────────────────────
// Static by default — /original only on hover, like Discord Nitro
const avatStaticUrl=(u,cdn)=>u?.avatar?._id?`${cdn}/avatars/${u.avatar._id}`:null;
const avatAnimUrl =(u,cdn)=>u?.avatar?._id?`${cdn}/avatars/${u.avatar._id}/original`:null;
const iconUrl=(s,cdn)=>s?.icon?._id?`${cdn}/icons/${s.icon._id}`:null;
const bannerUrl=(u,cdn)=>{const b=u?.profile?.background||u?.banner;if(!b)return null;const id=typeof b==='string'?b:typeof b==='object'?(b._id||b.id||null):null;return id&&typeof id==='string'?`${cdn}/backgrounds/${id}/original`:null;};
const joinedAt=(e)=>e?.joined_at||e?.joinedAt||e?.created_at||e?.createdAt||null;
const uidHue=(id='')=>{let h=0;for(let i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))&0xffff;return h%360;};
const IMG_EXT=new Set(['png','jpg','jpeg','webp','gif','bmp','avif','svg','gifv']);
const isImg=(fn='',ct='')=>ct.startsWith('image/')||IMG_EXT.has(fn.split('.').pop()?.toLowerCase()||'');
const attData=(a,cdn,i=0)=>{const id=typeof a==='string'?a:a?._id||a?.id;const fn=a?.filename||a?.name||`file-${i+1}`;const ct=a?.content_type||a?.contentType||a?.metadata?.type||'';return{id,fn,url:id?`${cdn}/attachments/${id}`:null,img:isImg(fn,ct),size:a?.metadata?.size||a?.size||0};};
const hSize=(b)=>b<1024?`${b}B`:b<1048576?`${(b/1024).toFixed(1)}KB`:`${(b/1048576).toFixed(1)}MB`;
const uniq=(list)=>{const s=new Set();return list.filter(m=>{if(!m?._id||s.has(m._id))return false;s.add(m._id);return true;});};
const clrF=(base,clear=[])=>{if(!clear?.length)return base;const n={...base};clear.forEach(f=>{const k=f?.[0]?.toLowerCase()+f?.slice(1);if(k)delete n[k];});return n;};

// ─── Twemoji ─────────────────────────────────────────────────────────────────
// stoat uses its own emoji CDN (from UnicodeEmoji.tsx in stoat source)
const STOAT_EMOJI='https://static.stoat.chat/emoji/fluent-3d/';
const toCP=(s)=>{const r=[];let c=0,p=0,i=0;while(i<s.length){c=s.charCodeAt(i++);if(p){r.push((0x10000+((p-0xd800)<<10)+(c-0xdc00)).toString(16));p=0;}else if(0xd800<=c&&c<=0xdbff)p=c;else r.push(c.toString(16));}return r.join('-');}
const stoatEmojiUrl=(char)=>`${STOAT_EMOJI}${toCP(char)}.svg?v=1`;
const TwImg=memo(({char,cls='inline-block w-5 h-5 align-bottom'})=><img src={stoatEmojiUrl(char)} alt={char} className={cls} draggable={false} onError={e=>{e.currentTarget.style.display='none';}}/>);
TwImg.displayName='TwImg';
const twR=(text,cls='inline-block w-5 h-5 align-bottom')=>text?text.split(/([\uD800-\uDBFF][\uDC00-\uDFFF])/g).map((p,i)=>/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(p)?<TwImg key={i} char={p} cls={cls}/>:p):null;

// ─── Lazy image ────────────────────────────────────────────────────────────────
const LazyImg=memo(({src,alt,className,onClick,style})=>{
  const ref=useRef(null);const[vis,setVis]=useState(false);
  useEffect(()=>{if(!ref.current)return;const obs=new IntersectionObserver(([e])=>{if(e.isIntersecting){setVis(true);obs.disconnect();}},{rootMargin:'300px'});obs.observe(ref.current);return()=>obs.disconnect();},[]);
  return <img ref={ref} src={vis?src:undefined} alt={alt||''} className={`lazy-img ${className||''} ${vis?'loaded':''}`} style={style} onClick={onClick} loading="lazy" decoding="async"/>;
});
LazyImg.displayName='LazyImg';

// ─── Avatar ───────────────────────────────────────────────────────────────────
const AVSZ={sm:'h-8 w-8 text-xs',md:'h-10 w-10 text-sm',lg:'h-12 w-12 text-base'};
const Avatar=memo(({user,cdn,size='md',always=false})=>{
  const[err,setErr]=useState(false);
  const[hov,setHov]=useState(false);
  const hue=uidHue(user?._id||'');
  useEffect(()=>setErr(false),[user?.avatar?._id]);
  // always=true: modals/profile views show animated immediately
  // otherwise: static PNG until hovered, then swap to /original GIF
  const hasAnim=!err&&user?.avatar?._id;
  const src=hasAnim?(always||hov?avatAnimUrl(user,cdn):avatStaticUrl(user,cdn)):null;
  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-white select-none ${AVSZ[size]}`}
      style={{background:src?'transparent':`hsl(${hue} 40% 28%)`}}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
    >
      {src
        ? <img src={src} alt={user?.username||''} className="h-full w-full object-cover" loading="lazy" decoding="async" onError={()=>setErr(true)}/>
        : <span>{(user?.username||'?').slice(0,2).toUpperCase()}</span>
      }
    </div>
  );
});
Avatar.displayName='Avatar';

// ─── Error boundary ───────────────────────────────────────────────────────────
class AppBoundary extends Component {
  constructor(p){super(p);this.state={err:false,msg:''};}
  static getDerivedStateFromError(e){return{err:true,msg:e?.message||'Unknown error'};}
  componentDidCatch(e){console.error('Ermine crash:',e);}
  render(){if(!this.state.err)return this.props.children;return(<div className="grid min-h-screen place-items-center bg-[#1e1f22] p-6 text-white"><div className="max-w-md text-center space-y-4"><img src="/assets/ermine-logo.png" className="w-20 h-20 mx-auto rounded-2xl opacity-80" alt="Ermine"/><h1 className="text-xl font-bold">Ermine crashed</h1><p className="text-sm text-[#80848e] font-mono break-all">{this.state.msg}</p><button className="rounded-lg bg-[#5865f2] px-4 py-2 text-sm font-bold hover:bg-[#4752c4]" onClick={()=>window.location.reload()}>Reload</button></div></div>);}
}

// ─── Modal ────────────────────────────────────────────────────────────────────
const Modal=memo(({title,onClose,children,wide=false,noPad=false})=>{
  const ref=useRef(null);
  useEffect(()=>{ref.current?.focus();const p=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=p;};},[]);
  return(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={ref} tabIndex={-1} className={`w-full ${wide?'max-w-2xl':'max-w-lg'} rounded-xl border border-[#1e1f22] bg-[#232428] shadow-2xl flex flex-col max-h-[90vh] focus:outline-none`} style={{animation:'modalIn 150ms cubic-bezier(.4,0,.2,1)'}} onKeyDown={e=>{if(e.key==='Escape')onClose();}}><div className="flex shrink-0 items-center justify-between border-b border-[#1e1f22] px-4 py-3"><h3 className="text-sm font-bold text-white">{title}</h3><button className="rounded p-1 text-[#80848e] hover:bg-[#35373c] hover:text-white" onClick={onClose}><X size={16}/></button></div><div className={`overflow-y-auto flex-1 ${noPad?'':'p-4 space-y-3'}`}>{children}</div></div></div>);
});
Modal.displayName='Modal';

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast=memo(({t,onDismiss})=><div className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-xl border pointer-events-auto ${t.type==='error'?'bg-[#5c1616] border-[#f23f43]/30':t.type==='success'?'bg-[#1a3a2a] border-[#3ABF7E]/30':'bg-[#2b2d31] border-[#35373c]'}`} style={{animation:'toastIn 200ms ease'}}>{t.type==='error'?<AlertCircle size={14} className="text-[#F84848] shrink-0"/>:t.type==='success'?<Check size={14} className="text-[#3ABF7E] shrink-0"/>:<Info size={14} className="text-[#5865f2] shrink-0"/>}<span className="flex-1 max-w-xs">{t.msg}</span><button className="opacity-50 hover:opacity-100 shrink-0" onClick={()=>onDismiss(t.id)}><X size={12}/></button></div>);
Toast.displayName='Toast';

// ─── Status badge / Typing / DateSep ─────────────────────────────────────────
const ST_MAP={ready:['Connected','#3ABF7E',false],authenticated:['Auth\u2026','#F39F00',true],connecting:['Connecting\u2026','#F39F00',true],disconnected:['Offline','#F84848',false],error:['Error','#F84848',false]};
const StatusBadge=({status})=>{const k=status.startsWith('error:')?'error':status;const[lbl,col,pulse]=ST_MAP[k]||[status,'#A5A5A5',false];return <span className="flex items-center gap-1.5 text-[11px] text-[#80848e] select-none"><span className={`w-2 h-2 rounded-full ${pulse?'animate-pulse':''}`} style={{background:col}}/>{lbl}</span>;};
const TypingIndicator=memo(({userIds,users})=>{const names=userIds.slice(0,3).map(id=>users[id]?.username||'Someone');if(!names.length)return <div className="h-5 shrink-0"/>;const lbl=names.length===1?`${names[0]} is typing`:names.length===2?`${names[0]} and ${names[1]} are typing`:`${names[0]}, ${names[1]} and ${userIds.length-2} more are typing`;return <div className="flex items-center gap-2 px-4 h-5 text-xs text-[#80848e] select-none shrink-0"><span className="flex gap-0.5 items-end pb-0.5">{[0,1,2].map(i=><span key={i} className="typing-dot w-1.5 h-1.5 rounded-full bg-[#80848e] inline-block"/>)}</span><strong className="text-[#b5bac1]">{lbl}</strong>&hellip;</div>;});
TypingIndicator.displayName='TypingIndicator';
const DateSep=({msg})=><div className="flex items-center gap-3 px-4 py-3 pointer-events-none select-none"><div className="flex-1 h-px bg-[#3f4249]"/><span className="text-xs font-semibold text-[#80848e]">{dayLbl(msg)}</span><div className="flex-1 h-px bg-[#3f4249]"/></div>;

// ─── Spoiler ──────────────────────────────────────────────────────────────────
const Spoiler=({text})=>{const[r,setR]=useState(false);return <span className={`spoiler rounded px-0.5 ${r?'revealed':''}`} onClick={()=>!r&&setR(true)}>{text}</span>;};

// ─── Markdown renderer ────────────────────────────────────────────────────────
const SC_MAP={smile:'😄',grin:'😁',joy:'😂',rofl:'🤣',wink:'😉',heart:'❤️',thumbsup:'👍',thumbsdown:'👎',fire:'🔥',sob:'😭',thinking:'🤔',tada:'🎉',eyes:'👀',rocket:'🚀',star:'⭐',check:'✅',wave:'👋',clap:'👏','100':'💯',skull:'💀',sparkles:'✨',muscle:'💪',cry:'😢',pensive:'😔',yum:'😋',sunglasses:'😎',angry:'😠',scream:'😱',ok_hand:'👌',raised_hands:'🙌',pray:'🙏'};

function renderInline(text,key,openLink){
  if(!text)return null;
  return text.split(/(`[^`]+`|\*\*[\s\S]+?\*\*|\*[^*\n]+\*|__[^_]+__|~~[^~]+~~|\|\|[\s\S]+?\|\||\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map((tok,i)=>{
    if(!tok)return null;
    if(/^`[^`]+`$/.test(tok))return <code key={`${key}-${i}`} className="rounded bg-[#1e1f22] px-1 py-0.5 text-[13px] font-mono text-[#f2f3f5]">{tok.slice(1,-1)}</code>;
    if(/^\*\*[\s\S]+?\*\*$/.test(tok))return <strong key={`${key}-${i}`}>{tok.slice(2,-2)}</strong>;
    if(/^\*[^*\n]+\*$/.test(tok))return <em key={`${key}-${i}`}>{tok.slice(1,-1)}</em>;
    if(/^__[^_]+__$/.test(tok))return <span key={`${key}-${i}`} className="underline">{tok.slice(2,-2)}</span>;
    if(/^~~[^~]+~~$/.test(tok))return <span key={`${key}-${i}`} className="line-through">{tok.slice(2,-2)}</span>;
    if(/^\|\|[\s\S]+?\|\|$/.test(tok))return <Spoiler key={`${key}-${i}`} text={tok.slice(2,-2)}/>;
    const ml=tok.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if(ml)return <a key={`${key}-${i}`} className="text-[#8ea1ff] underline hover:text-[#bdc3ff] cursor-pointer" href={ml[2]} onClick={e=>{e.preventDefault();openLink(ml[2]);}} rel="noreferrer" target="_blank">{ml[1]}</a>;
    return tok.split(/(https?:\/\/[^\s]+)/g).map((p,j)=>/^https?:\/\//.test(p)?<a key={`${key}-${i}-${j}`} className="text-[#8ea1ff] underline hover:text-[#bdc3ff] cursor-pointer" href={p} onClick={e=>{e.preventDefault();openLink(p);}} rel="noreferrer" target="_blank">{p}</a>:<React.Fragment key={`${key}-${i}-${j}`}>{p}</React.Fragment>);
  });
}
function renderMd(text,key,openLink){
  if(!text)return null;
  const parts=text.split(/(```[\s\S]*?```)/g);
  if(parts.length>1)return parts.map((part,pi)=>{
    if(part.startsWith('```')&&part.endsWith('```')){const inner=part.slice(3,-3);const nl=inner.indexOf('\n');const lang=nl>-1?inner.slice(0,nl).trim():'';const code=nl>-1?inner.slice(nl+1):inner;return <pre key={`${key}-cb${pi}`} className="my-2 overflow-x-auto rounded-md bg-[#1a1b1e] border border-[#2f3237] p-3 text-xs font-mono text-[#f2f3f5] whitespace-pre">{lang&&<div className="mb-2 text-[10px] text-[#80848e] uppercase tracking-wider">{lang}</div>}{code}</pre>;}
    return <React.Fragment key={`${key}-cp${pi}`}>{renderInline(part,`${key}-ci${pi}`,openLink)}</React.Fragment>;
  });
  return renderInline(text,key,openLink);
}

// ─── Custom emoji ─────────────────────────────────────────────────────────────
const CE_RE=/^:[A-Z0-9]{26}:$/i;
const isCE=(v)=>CE_RE.test(v||'');
const getCEId=(t)=>t?.slice(1,-1);
const renderCE=(token,ceById,cdn,cls='inline h-5 w-5 align-text-bottom object-contain')=>{const id=isCE(token)?getCEId(token):/^[A-Z0-9]{26}$/i.test(token)?token:null;if(id)return <img alt={ceById?.[id]?.name||id} className={cls} src={`${cdn}/emojis/${id}`} style={{display:'inline'}}/>;return twR(token);};

// ─── Message content renderer ─────────────────────────────────────────────────
function renderContent(content,users,channels,onUser,ceById,cdn,openLink){
  if(!content)return null;
  return content.split(/(<@!?[A-Za-z0-9]+>|<#[A-Za-z0-9]+>|:[A-Z0-9]{26}:|:([a-z0-9_+\-]+):)/gi).map((p,i)=>{
    if(!p)return null;
    const um=p.match(/^<@!?([A-Za-z0-9]+)>$/);if(um){const u=users[um[1]];return <button key={i} className="mx-0.5 inline rounded bg-[#5865f2]/25 px-1 text-[#bdc3ff] hover:bg-[#5865f2]/40" onClick={()=>onUser(u||{_id:um[1],username:um[1].slice(0,8)})} type="button">@{u?.username||um[1]}</button>;}
    const cm=p.match(/^<#([A-Za-z0-9]+)>$/);if(cm)return <span key={i} className="mx-0.5 rounded bg-[#35373c] px-1 text-[#f2f3f5]">#{channels[cm[1]]?.name||'unknown'}</span>;
    if(isCE(p))return <span key={i} className="inline-flex items-center mx-0.5" title={ceById?.[getCEId(p)]?.name}>{renderCE(p,ceById,cdn)}</span>;
    const sc=p.match(/^:([a-z0-9_+\-]+):$/i);if(sc&&SC_MAP[sc[1].toLowerCase()])return <TwImg key={i} char={SC_MAP[sc[1].toLowerCase()]}/>;
    return <React.Fragment key={i}>{renderMd(p,`m${i}`,openLink)}</React.Fragment>;
  });
}

// ─── System messages ──────────────────────────────────────────────────────────
const renderSys=(msg,users)=>{const sys=msg.system;if(!sys)return null;const n=(id)=>users[id]?.username||id?.slice(0,8)||'?';switch(sys.type){case 'text':return <span className="italic">{sys.content}</span>;case 'user_added':return <span className="italic text-[#3ABF7E]">👋 {n(sys.by)} added {n(sys.id)}</span>;case 'user_remove':return <span className="italic text-[#F84848]">👋 {n(sys.by)} removed {n(sys.id)}</span>;case 'user_joined':return <span className="italic text-[#3ABF7E]">👋 {n(sys.id)} joined</span>;case 'user_left':return <span className="italic text-[#80848e]">👋 {n(sys.id)} left</span>;case 'user_kicked':return <span className="italic text-[#F84848]">👢 {n(sys.id)} kicked by {n(sys.by)}</span>;case 'user_banned':return <span className="italic text-[#F84848]">🔨 {n(sys.id)} banned by {n(sys.by)}</span>;case 'channel_renamed':return <span className="italic text-[#4799F0]">✏️ {n(sys.by)} renamed to <strong>{sys.name}</strong></span>;case 'channel_ownership_changed':return <span className="italic text-[#F39F00]">👑 Ownership to {n(sys.to)}</span>;default:return <span className="italic text-[#80848e]">[{sys.type}]</span>;}};

// ─── URL Embed ────────────────────────────────────────────────────────────────
const UrlEmbed=memo(({embed,openLink})=>{if(!embed)return null;const{type,url,title,description,image,colour,site_name}=embed;if(type==='Image')return <button className="block mt-2 cursor-zoom-in" onClick={()=>openLink('lightbox:'+embed.url)} type="button"><LazyImg src={embed.url} alt="" className="max-h-64 max-w-xs rounded-md object-contain border border-[#2f3237]"/></button>;if(type==='Website'||type==='Text')return(<div className="mt-2 rounded rounded-l-none border-l-4 bg-[#2b2d31] p-3 max-w-sm" style={{borderColor:colour||'#4f4f4f'}}>{site_name&&<p className="text-[11px] text-[#80848e] mb-1">{site_name}</p>}{title&&<a className="text-[13px] font-semibold text-[#8ea1ff] hover:underline block" href={url} onClick={e=>{e.preventDefault();openLink(url);}} rel="noreferrer" target="_blank">{title}</a>}{description&&<p className="text-[12px] text-[#b5bac1] mt-1 line-clamp-3">{description}</p>}{image?.url&&<LazyImg src={image.url} alt="" className="mt-2 max-h-40 w-full rounded object-cover"/>}</div>);return null;});
UrlEmbed.displayName='UrlEmbed';

// ─── Grouping / reactions ─────────────────────────────────────────────────────
const isGrouped=(msg,prev)=>{if(!prev||msg.system||prev.system)return false;const a1=typeof msg.author==='string'?msg.author:msg.author?._id;const a2=typeof prev.author==='string'?prev.author:prev.author?._id;if(a1!==a2)return false;if((msg.masquerade?.name??null)!==(prev.masquerade?.name??null))return false;const t1=msg.createdAt?new Date(msg.createdAt).getTime():uMs(msg._id);const t2=prev.createdAt?new Date(prev.createdAt).getTime():uMs(prev._id);return t1-t2<420000;};
const toRxn=(r)=>!r||typeof r!=='object'?[]:Object.entries(r).map(([e,ids])=>({emoji:e,ids:Array.isArray(ids)?ids:[]})).filter(x=>x.ids.length);
const replyId=(m)=>{const r=Array.isArray(m?.replies)?m.replies[0]:null;return typeof r==='string'?r:r?.id||r?._id||null;};

// ─── Emoji data ───────────────────────────────────────────────────────────────
const EMOJI_CATS = [
  {n:'😀 Smileys', e:['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🤫','🤔','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👻','👽','👾','🤖']},
  {n:'👋 People',  e:['👋','🤚','🖐','✋','🖖','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🫶','🙌','👐','🤲','🤝','🙏','💅','💪','🦾','🦵','🦶','👂','🦻','👃','👀','👅','💋','🩸','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🙇','🤦','🤷']},
  {n:'🐶 Animals', e:['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🐢','🐍','🦎','🐙','🦑','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐈','🐓','🦃','🦜']},
  {n:'🌸 Nature',  e:['🌸','🌺','🌻','🌹','🥀','🌷','🌱','🌿','🍀','🎋','🍃','🍂','🍁','🍄','🌾','☘️','🌵','🎄','🌴','🌳','🌲','🌊','🌈','⭐','🌟','💫','✨','⚡','🌙','☀️','🌤','⛅','☁️','🌦','🌧','⛈','🌩','🌨','❄️','☃️','⛄','💧','💦','🔥','🌋']},
  {n:'🍔 Food',    e:['🍎','🍊','🍋','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🫒','🥑','🍆','🥦','🥬','🥒','🌽','🥕','🥔','🍞','🥐','🧀','🥚','🍳','🥞','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🌮','🌯','🥙','🍜','🍝','🍛','🍲','🥘','🍣','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','☕','🍵','🧃','🥤','🧋','🍺','🍻','🥂','🍷','🍸','🍹','🍾']},
  {n:'⚽ Sports',  e:['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥊','🥋','🎽','⛸','🎿','🏋️','🧘','🏄','🏊','🚴','🏆','🥇','🥈','🥉','🏅','🎖','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🎻','🎲','🎯','🎳','🎮','🎰','🧩']},
  {n:'✈️ Travel',  e:['🚗','🚕','🚙','🏎','🚓','🚑','🚒','🚐','🛻','🚚','🏍','🛵','🚲','🛴','✈️','🛩','🚁','🚀','🛸','⛵','🚤','🛥','🚢','⚓','🌍','🌎','🌏','🏔','⛰','🌋','🏕','🏖','🏜','🏝','🏠','🏡','🏢','🏪','🏫','🏬','🏰','🗼','🗽','⛪','🕌','🛕']},
  {n:'❤️ Symbols', e:['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','☮️','✅','❌','⭕','💯','💢','♨️','🚫','❗','❕','❓','❔','‼️','⁉️','⚠️','♻️','✔️','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🔇','🔈','🔉','🔊','📢','📣','🔔','🔕','🎵','🎶','💤','💬','💭','🗯','👁️‍🗨️','🔗','📌','📍','✏️','📝']},
];
const STD_EMOJI = EMOJI_CATS.flatMap(c=>c.e);

// ─── Emoji + GIF Picker ───────────────────────────────────────────────────────
// stoat uses gifbox.me (from GifPicker.tsx + env.ts in stoat source)
const GIFBOX_URL = 'https://api.gifbox.me';

const EmojiGifPicker = memo(({ ceById, allCE, cdn, onEmoji, onCE, onGif, token }) => {
  const [tab, setTab]     = useState('emoji');
  const [eCat, setECat]   = useState(0);
  const [q, setQ]         = useState('');
  const [gifQ, setGifQ]   = useState('');
  const [gifs, setGifs]   = useState([]);
  const [trending, setTr] = useState([]);
  const [gifLoad, setGL]  = useState(false);
  const debRef = useRef(null);

  useEffect(()=>{
    if(!token)return;
    setGL(true);
    fetch(`${GIFBOX_URL}/trending?locale=en_US&limit=24`,{headers:{'x-session-token':token}})
      .then(r=>r.json()).then(d=>{setTr(d.results||[]);setGL(false);}).catch(()=>setGL(false));
  },[token]);

  const searchGifs = useCallback((v)=>{
    clearTimeout(debRef.current);
    if(!v.trim()){setGifs([]);return;}
    setGL(true);
    debRef.current = setTimeout(()=>{
      const endpoint = v==='trending'
        ? `${GIFBOX_URL}/trending?locale=en_US`
        : `${GIFBOX_URL}/search?locale=en_US&query=${encodeURIComponent(v)}`;
      fetch(endpoint,{headers:{'x-session-token':token}})
        .then(r=>r.json()).then(d=>{setGifs(d.results||[]);setGL(false);}).catch(()=>setGL(false));
    },400);
  },[token]);

  const filtE = useMemo(()=>{if(!q)return EMOJI_CATS[eCat]?.e||[];const ql=q.toLowerCase();return STD_EMOJI.filter(e=>e.includes(ql));},[q,eCat]);
  const filtCE = useMemo(()=>{if(!q)return allCE;const ql=q.toLowerCase();return allCE.filter(e=>e.name.toLowerCase().includes(ql)||e.serverName?.toLowerCase().includes(ql));},[q,allCE]);
  const displayGifs = gifQ.trim() ? gifs : trending;

  const grouped = useMemo(()=>{
    const g={};
    filtCE.forEach(e=>{ (g[e.serverName||'?']??=[],g[e.serverName||'?']=[...(g[e.serverName||'?']||[]),e]); });
    return Object.entries(g);
  },[filtCE]);

  return (
    <div className="flex flex-col w-80 h-96 rounded-xl border border-[#1e1f22] bg-[#232428] shadow-2xl overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-[#1e1f22] px-2 pt-2 gap-0.5 shrink-0">
        {[['emoji','😊','Emoji'],['gif','🎬','GIF'],['custom','✨','Custom']].map(([id,ic,lb])=>(
          <button key={id} className={`flex items-center gap-1 px-3 py-1.5 rounded-t-lg text-[12px] font-semibold transition-colors ${tab===id?'bg-[#313338] text-[#f2f3f5]':'text-[#80848e] hover:text-[#b5bac1]'}`} onClick={()=>setTab(id)}>
            {ic} {lb}
          </button>
        ))}
      </div>
      {/* Search */}
      <div className="px-2 py-1.5 shrink-0">
        <div className="flex items-center gap-2 rounded-lg bg-[#1e1f22] px-2 py-1.5">
          <Search size={11} className="text-[#80848e] shrink-0"/>
          <input className="flex-1 bg-transparent text-[13px] text-[#f2f3f5] placeholder:text-[#80848e] focus:outline-none" placeholder={tab==='gif'?'Search GIFs on GIPHY…':'Search emojis…'} value={tab==='gif'?gifQ:q} onChange={e=>{if(tab==='gif'){setGifQ(e.target.value);searchGifs(e.target.value);}else setQ(e.target.value);}} autoFocus/>
          {(tab==='gif'?gifQ:q)&&<button onClick={()=>tab==='gif'?setGifQ(''):setQ('')}><X size={10} className="text-[#80848e] hover:text-white"/></button>}
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab==='emoji'&&(
          <>
            {!q&&<div className="flex gap-0.5 px-2 pb-1 overflow-x-auto shrink-0">{EMOJI_CATS.map((c,i)=><button key={i} className={`shrink-0 px-2 py-0.5 rounded text-[11px] whitespace-nowrap transition-colors ${eCat===i?'bg-[#5865f2] text-white':'text-[#80848e] hover:text-[#b5bac1]'}`} onClick={()=>setECat(i)}>{c.n.split(' ')[0]}</button>)}</div>}
            {!q&&<p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#80848e]">{EMOJI_CATS[eCat]?.n}</p>}
            <div className="grid grid-cols-8 gap-0.5 px-2 pb-2">
              {filtE.map(e=><button key={e} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[#35373c]" onClick={()=>onEmoji(e)}>{twR(e,'w-5 h-5')}</button>)}
            </div>
            {q&&filtE.length===0&&<p className="text-center py-4 text-xs text-[#80848e]">No emoji matching "{q}"</p>}
          </>
        )}
        {tab==='gif'&&(
          <div className="p-2">
            {gifLoad&&<div className="flex justify-center py-8"><Loader className="animate-spin text-[#80848e]" size={20}/></div>}
            {!gifLoad&&displayGifs.length===0&&<p className="text-center py-6 text-xs text-[#80848e]">{gifQ?'No GIFs found':'Loading trending GIFs…'}</p>}
            {!gifLoad&&displayGifs.length>0&&(
              <>
                {!gifQ&&<p className="text-[10px] font-bold uppercase tracking-widest text-[#80848e] mb-2 px-1">Trending</p>}
                <div className="columns-2 gap-1.5">
                  {displayGifs.map((gif,gi)=>{
                    // gifbox format: { url, media_formats: { webm, tinywebm } }
                    const thumb=gif.media_formats?.tinywebm?.url||gif.url;
                    const full=gif.url||thumb;
                    if(!thumb)return null;
                    return(
                      <button key={gif.id||gi} className="w-full mb-1.5 rounded-lg overflow-hidden hover:opacity-80 transition-opacity" onClick={()=>onGif(full)} type="button">
                        <video src={thumb} className="w-full object-cover" autoPlay loop muted playsInline style={{pointerEvents:'none'}}/>
                      </button>
                    );
                  })}
                </div>
                <p className="text-center text-[9px] text-[#4f5660] mt-2 pb-1">Powered by Gifbox</p>
              </>
            )}
          </div>
        )}
        {tab==='custom'&&(
          <div className="p-2">
            {filtCE.length===0&&<div className="text-center py-8"><span className="text-4xl block mb-2">✨</span><p className="text-xs text-[#80848e]">{q?'No match':'Join spaces to unlock custom emojis.'}</p></div>}
            {grouped.map(([sName,emojis])=>(
              <div key={sName} className="mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#80848e] px-1 mb-1">{sName}</p>
                <div className="grid grid-cols-8 gap-0.5">{emojis.map(e=><button key={e.id} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[#35373c]" onClick={()=>onCE(e.id)} title={e.name}>{renderCE(`:${e.id}:`,{},cdn,'h-5 w-5')}</button>)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
EmojiGifPicker.displayName='EmojiGifPicker';

// ─── Message component ────────────────────────────────────────────────────────
function Message({message,users,channels,me,onUser,cdn,onReact,onReply,replyTarget,jumpTo,regRef,ceById,reactOpts,openLink,onEdit,onDelete,replyMap,grouped}){
  const masq=message.masquerade;
  const authorId=typeof message.author==='string'?message.author:message.author?._id;
  const base=users[authorId]||(typeof message.author==='object'?message.author:null)||{_id:authorId,username:'Unknown'};
  const dispU=masq?{...base,username:masq.name||base.username,avatar:masq.avatar?{_id:masq.avatar}:base.avatar}:base;
  const dispCol=masq?.colour||null;
  const mine=me===authorId;
  const rid=replyId(message);
  const replyMsg=rid?(replyMap[rid]||(message.replyMessage?._id===rid?message.replyMessage:null)):null;
  const replyAId=replyMsg?(typeof replyMsg.author==='string'?replyMsg.author:replyMsg.author?._id):message.replyMessage?.authorId;
  const replyU=replyAId?users[replyAId]:message.replyMessage?.authorUser;

  const [pickerOpen,setPicker]=useState(false);
  const [hov,setHov]=useState(false);
  const [editing,setEditing]=useState(false);
  const [editVal,setEditVal]=useState('');
  const [emojiQ,setEmojiQ]=useState('');
  const pickerRef=useRef(null);
  const editRef=useRef(null);

  useEffect(()=>{const el=editRef.current;if(!el||!editing)return;el.style.height='auto';el.style.height=Math.min(el.scrollHeight,200)+'px';},[editVal,editing]);
  useEffect(()=>{if(!pickerOpen){setEmojiQ('');return;}const h=e=>{if(pickerRef.current&&!pickerRef.current.contains(e.target))setPicker(false);};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[pickerOpen]);

  const ts=fmtT(message.createdAt||message._id);
  const tsS=fmtS(message.createdAt||message._id);
  const reactions=toRxn(message.reactions);

  const content=useMemo(()=>{
    if(!message.content)return null;
    const tr=message.content.trim();
    const big=/^(\s*(?::[A-Z0-9]{26}:|[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\S\r\n])+\s*)$/i.test(tr)&&tr.length<80;
    return <p className={`whitespace-pre-wrap break-words leading-[1.375] ${big?'text-4xl':'text-[15px] text-[#dcddde]'}`}>{renderContent(message.content,users,channels,onUser,ceById,cdn,openLink)}</p>;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[message.content,message.edited,cdn]);

  if(message.system)return <div className="group px-4 py-1 text-xs text-[#80848e] flex items-center gap-2 hover:bg-[#2e3035]" ref={n=>regRef(message._id,n)}><div className="flex-1 h-px bg-[#3f4249]"/><span>{renderSys(message,users)}</span><div className="flex-1 h-px bg-[#3f4249]"/></div>;

  return (
    <article className={`group relative flex gap-3 px-4 ${grouped?'py-0.5':'pt-3 pb-0.5'} hover:bg-[#2e3035]/60 ${replyTarget===message._id?'bg-[#5865f2]/10':''}`}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} ref={n=>regRef(message._id,n)}>
      <div className="w-10 shrink-0 flex justify-center items-start mt-0.5">
        {grouped
          ? <time className={`mt-1 text-[10px] text-[#4f5660] select-none transition-opacity ${hov||pickerOpen?'opacity-100':'opacity-0'}`}>{tsS}</time>
          : <button onClick={()=>onUser(dispU,authorId)} type="button" className="mt-0.5"><Avatar user={dispU} cdn={cdn}/></button>}
      </div>
      <div className="min-w-0 flex-1 pb-0.5">
        {rid&&<button className="mb-1 flex max-w-full items-center gap-1.5 text-[12px] text-[#80848e] hover:text-[#b5bac1]" onClick={()=>jumpTo(rid)} type="button"><Reply size={11}/><span className="truncate">{replyU?.username||'Unknown'}: {replyMsg?.content||'[attachment]'}</span></button>}
        {!grouped&&<div className="flex items-baseline gap-2 mb-0.5">
          <button className="text-[15px] font-semibold leading-none hover:underline" onClick={()=>onUser(dispU,authorId)} style={{color:dispCol||'#f2f3f5'}} type="button">{dispU.username}</button>
          {masq&&<span className="rounded bg-[#F39F00]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#F39F00]">BOT</span>}
          {mine&&!masq&&<span className="rounded bg-[#5865f2]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#bdc3ff]">YOU</span>}
          <time className="text-[11px] text-[#80848e]" title={ts}>{ts}</time>
          {message.edited&&<span className="text-[10px] text-[#4f5660]">(edited)</span>}
        </div>}
        {editing
          ? <div className="mt-1 rounded-md bg-[#383a40] p-2">
              <textarea ref={editRef} className="composer-ta mb-1" rows={1} value={editVal} autoFocus onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(editVal.trim()!==message.content)onEdit(message._id,editVal.trim());setEditing(false);}if(e.key==='Escape')setEditing(false);}}/>
              <div className="flex gap-2 text-[11px] text-[#80848e]"><span className="flex-1">esc cancel · enter save</span><button onClick={()=>setEditing(false)} className="text-[#F84848] hover:underline">cancel</button><button onClick={()=>{if(editVal.trim()!==message.content)onEdit(message._id,editVal.trim());setEditing(false);}} className="text-[#5865f2] hover:underline">save</button></div>
            </div>
          : content
        }
        {Array.isArray(message.embeds)&&message.embeds.map((em,i)=><UrlEmbed key={i} embed={em} openLink={openLink}/>)}
        {Array.isArray(message.attachments)&&message.attachments.length>0&&(
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((a,i)=>{const{id,fn,url,img,size}=attData(a,cdn,i);if(!id||!url)return null;return img?<button key={id} type="button" className="cursor-zoom-in rounded-md overflow-hidden border border-[#2f3237] hover:border-[#5865f2]/40" onClick={()=>openLink('lightbox:'+url)}><LazyImg src={url} alt={fn} className="max-h-64 max-w-sm object-contain block"/></button>:<a key={id} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg bg-[#2b2d31] border border-[#35373c] px-3 py-2 text-sm text-[#b5bac1] hover:bg-[#35373c]"><span>📎</span><span className="truncate max-w-[180px]">{fn}</span>{size>0&&<span className="text-xs text-[#80848e] shrink-0">{hSize(size)}</span>}</a>;})}
          </div>
        )}
        {reactions.length>0&&<div className="mt-1.5 flex flex-wrap gap-1">{reactions.map(({emoji,ids})=>{const reacted=ids.includes(me);return <button key={emoji} className={`rxn-btn flex items-center gap-1 rounded-lg border h-7 px-2 text-xs ${reacted?'border-[#5865f2]/60 bg-[#5865f2]/15 text-[#c4c9ff]':'border-[#35373c] bg-[#2b2d31] text-[#b5bac1] hover:border-[#5865f2]/30 hover:bg-[#35373c]'}`} onClick={()=>onReact(message,emoji,reacted)} type="button">{renderCE(emoji,ceById,cdn,'inline h-4 w-4 align-middle object-contain')} {ids.length}</button>;})}</div>}
      </div>
      {/* Hover toolbar */}
      <div className={`absolute right-3 -top-4 z-20 transition-all duration-75 ${hov||pickerOpen?'opacity-100':'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center bg-[#232428] border border-[#1e1f22] rounded-lg shadow-xl overflow-hidden">
          <button className="px-2.5 py-1.5 text-[#b5bac1] hover:text-[#f2f3f5] hover:bg-[#35373c] flex items-center gap-1 transition-colors" onClick={()=>onReply(message)}><Reply size={14}/><span className="text-[11px] hidden sm:inline">Reply</span></button>
          <button className="px-2.5 py-1.5 text-[#b5bac1] hover:text-[#f2f3f5] hover:bg-[#35373c] border-l border-[#1e1f22] transition-colors text-base leading-none" onClick={()=>setPicker(p=>!p)}>😊</button>
          {mine&&<><button className="px-2.5 py-1.5 text-[#b5bac1] hover:text-[#f2f3f5] hover:bg-[#35373c] border-l border-[#1e1f22] transition-colors" onClick={()=>{setEditVal(message.content||'');setEditing(true);setPicker(false);}}><Edit2 size={14}/></button><button className="px-2.5 py-1.5 text-[#b5bac1] hover:text-[#F84848] hover:bg-[#35373c] border-l border-[#1e1f22] transition-colors" onClick={()=>onDelete(message)}><Trash2 size={14}/></button></>}
        </div>
      </div>
      {/* Inline reaction picker */}
      {pickerOpen&&(
        <div ref={pickerRef} className="absolute right-0 bottom-full mb-1 z-30 w-72 max-h-72 rounded-xl border border-[#1e1f22] bg-[#232428] shadow-2xl overflow-hidden flex flex-col">
          <div className="p-2 border-b border-[#1e1f22] shrink-0"><input className="w-full rounded-lg bg-[#1e1f22] px-2 py-1.5 text-xs text-[#f2f3f5] placeholder:text-[#80848e] focus:outline-none" placeholder="Search emojis…" value={emojiQ} onChange={e=>setEmojiQ(e.target.value)} autoFocus/></div>
          <div className="overflow-y-auto p-2 flex-1">
            {emojiQ?(()=>{const q=emojiQ.toLowerCase();const ce=reactOpts.filter(o=>o.custom&&o.label.toLowerCase().includes(q));return ce.length?<div className="grid grid-cols-8 gap-0.5">{ce.map(o=><button key={o.value} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[#35373c]" onClick={()=>{onReact(message,o.value,message.reactions?.[o.value]?.includes(me));setPicker(false);}} title={o.title}>{renderCE(o.value,{},cdn,'h-5 w-5')}</button>)}</div>:<p className="text-center py-4 text-xs text-[#80848e]">No match for "{emojiQ}"</p>;})():(
              <>
                <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#80848e]">Standard</p>
                <div className="grid grid-cols-8 gap-0.5 mb-2">{STD_EMOJI.slice(0,64).map(e=><button key={e} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[#35373c]" onClick={()=>{onReact(message,e,message.reactions?.[e]?.includes(me));setPicker(false);}}>{twR(e,'w-5 h-5')}</button>)}</div>
                {reactOpts.some(o=>o.custom)&&<><p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#80848e]">Custom</p><div className="grid grid-cols-8 gap-0.5">{reactOpts.filter(o=>o.custom).map(o=><button key={o.value} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[#35373c]" onClick={()=>{onReact(message,o.value,message.reactions?.[o.value]?.includes(me));setPicker(false);}} title={o.title}>{renderCE(o.value,{},cdn,'h-5 w-5')}</button>)}</div></>}
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
const MemoMsg = memo(Message, (p,n)=>
  p.message._id===n.message._id&&p.message.content===n.message.content&&
  p.message.edited===n.message.edited&&p.message.reactions===n.message.reactions&&
  p.message.attachments===n.message.attachments&&p.grouped===n.grouped&&
  p.replyTarget===n.replyTarget&&p.me===n.me&&p.cdn===n.cdn
);
MemoMsg.displayName='MemoMsg';

// ─── Member list ──────────────────────────────────────────────────────────────
const sortRoles=(rm)=>rm?Object.entries(rm).map(([id,r])=>({id,...r})).sort((a,b)=>(b.rank??0)-(a.rank??0)):[];
const highRole=(m,sr)=>{if(!m.roles?.length)return null;for(const r of sr)if(m.roles.includes(r.id))return r;return null;};
const hoistRole=(m,sr)=>{if(!m.roles?.length)return null;for(const r of sr)if(m.roles.includes(r.id)&&r.hoist)return r;return null;};

const organizeMembers=(mems,rolesMap)=>{
  const sr=sortRoles(rolesMap);
  const gs={};
  sr.filter(r=>r.hoist).forEach(r=>{gs[r.id]={id:r.id,name:r.name,color:r.colour,rank:r.rank,members:[]};});
  gs['Online']={id:'Online',name:'Online',color:null,rank:-1,members:[]};
  gs['Offline']={id:'Offline',name:'Offline',color:null,rank:-2,members:[]};
  mems.forEach(m=>{
    const u=m._user||{_id:m._id?.user,username:m._id?.user?.slice(0,8)||'?'};
    const hr=hoistRole(m,sr),xr=highRole(m,sr);
    const pres=u.status?.presence;
    const off=!pres||pres==='Invisible'||pres==='Offline';
    const em={...m,user:u,color:xr?.colour||null};
    if(hr&&!off){if(!gs[hr.id])gs[hr.id]={id:hr.id,name:hr.name,color:hr.colour,rank:hr.rank,members:[]};gs[hr.id].members.push(em);}
    else gs[off?'Offline':'Online'].members.push(em);
  });
  const flat=[];
  Object.values(gs).filter(g=>g.members.length).sort((a,b)=>b.rank-a.rank).forEach(g=>{
    flat.push({type:'header',key:`h-${g.id}`,name:g.name,count:g.members.length});
    [...g.members].sort((a,b)=>(a.nickname??a.user?.display_name??a.user?.username??'').localeCompare(b.nickname??b.user?.display_name??b.user?.username??'')).forEach(m=>flat.push({type:'member',key:m._id.user,data:m}));
  });
  return flat;
};

// ─── Virtual list (stable, no thrash) ────────────────────────────────────────
const IH={header:44,member:44};
const VirtualList=memo(({items,renderItem,className})=>{
  const outerRef=useRef(null);
  const [sTop,setSTop]=useState(0);
  const [vpH,setVpH]=useState(600);
  const raf=useRef();
  const{offsets,total}=useMemo(()=>{let a=0;const offs=items.map(item=>{const t=a;a+=IH[item.type]||44;return t;});return{offsets:offs,total:a};},[items]);
  useEffect(()=>{
    const el=outerRef.current;if(!el)return;
    const ro=new ResizeObserver(()=>setVpH(el.clientHeight));ro.observe(el);setVpH(el.clientHeight);
    const fn=()=>{if(raf.current)return;raf.current=requestAnimationFrame(()=>{setSTop(el.scrollTop);raf.current=null;});};
    el.addEventListener('scroll',fn,{passive:true});
    return()=>{ro.disconnect();el.removeEventListener('scroll',fn);};
  },[]);
  const OV=8;
  let first=0,last=items.length-1;
  for(let i=0;i<items.length;i++){if((offsets[i]||0)+(IH[items[i]?.type]||44)>=sTop){first=Math.max(0,i-OV);break;}}
  for(let i=first;i<items.length;i++){if((offsets[i]||0)>sTop+vpH){last=Math.min(items.length-1,i+OV);break;}}
  return(
    <div ref={outerRef} className={className} style={{overflowY:'auto',position:'relative'}}>
      <div style={{height:total,position:'relative'}}>
        {items.slice(first,last+1).map((item,i)=>{const idx=first+i;return <div key={item.key||idx} style={{position:'absolute',top:offsets[idx]||0,left:0,right:0,height:IH[item.type]||44}}>{renderItem(item)}</div>;})}
      </div>
    </div>
  );
});
VirtualList.displayName='VirtualList';

// ─── Friends helpers ──────────────────────────────────────────────────────────
const EmptyF=({msg})=><div className="flex flex-col items-center justify-center py-16 gap-3 text-center"><span className="text-5xl">🦦</span><p className="text-[#80848e] text-sm">{msg}</p></div>;
const FriendRow=memo(({f,cdn,channels,auth,unreadChannels,openDm,removeFriend,setPeekUser,getPC})=>{
  const dm=useMemo(()=>Object.values(channels).find(c=>c.channel_type==='DirectMessage'&&(c.recipients||[]).includes(f._id)),[channels,f._id]);
  const hasUnread=unreadChannels.has(dm?._id||'');
  const[hov,setHov]=useState(false);
  return(
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[#35373c] transition-colors cursor-pointer group" onClick={()=>openDm(f._id)} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      <div className="relative shrink-0"><Avatar user={f} cdn={cdn}/><span className="absolute -bottom-px -right-px w-3.5 h-3.5 rounded-full border-2 border-[#313338]" style={{background:getPC(f.status?.presence)}}/></div>
      <div className="min-w-0 flex-1"><div className="text-[14px] font-semibold text-[#f2f3f5] truncate">{f.display_name||f.username}</div><div className="text-[12px] text-[#80848e] truncate">{f.status?.text||f.status?.presence||'Offline'}</div></div>
      {hasUnread&&<span className="w-2.5 h-2.5 rounded-full bg-[#f2f3f5] shrink-0"/>}
      <div className={`flex gap-1 transition-opacity ${hov?'opacity-100':'opacity-0'}`} onClick={e=>e.stopPropagation()}>
        <button className="p-1.5 rounded-full bg-[#1e1f22] hover:bg-[#5865f2] text-[#80848e] hover:text-white transition-colors" onClick={()=>setPeekUser(f)}><Info size={14}/></button>
        <button className="p-1.5 rounded-full bg-[#1e1f22] hover:bg-[#F84848] text-[#80848e] hover:text-white transition-colors" onClick={()=>removeFriend(f._id)}><UserX size={14}/></button>
      </div>
    </div>
  );
});
FriendRow.displayName='FriendRow';

// ─── User Settings Panel ──────────────────────────────────────────────────────
const UserSettingsPanel=({user,cdn,apiUrl,token,onUpdate,addToast,isLowSpec,openStatus,fetchProfile})=>{
  const[tab,setTab]=useState('profile');
  const[dn,setDn]=useState(user?.display_name||user?.username||'');
  const[bio,setBio]=useState(user?.profile?.content||'');
  const[ownBannerUrl,setOwnBannerUrl]=useState(null);
  useEffect(()=>{
    if(!fetchProfile||!user?._id)return;
    fetchProfile(user._id).then(p=>{
      if(p?.content&&!bio)setBio(p.content);
      if(p?.bannerUrl)setOwnBannerUrl(p.bannerUrl);
    });
  },[user?._id]);// eslint-disable-line
  const[saving,setSaving]=useState(false);
  const[pwCur,setPwCur]=useState('');const[pwNew,setPwNew]=useState('');const[pwConf,setPwConf]=useState('');const[pwS,setPwS]=useState(false);
  const avatRef=useRef(null);
  useEffect(()=>{setDn(user?.display_name||user?.username||'');setBio(user?.profile?.content||'');},[user]);
  const saveProfile=async()=>{
    setSaving(true);
    try{
      const body={};
      if(dn.trim()&&dn.trim()!==user?.username)body.display_name=dn.trim();
      else if(!dn.trim())body.remove=['DisplayName'];
      body.profile={content:bio.trim()||''};
      const r=await fetch(`${apiUrl}/users/@me`,{method:'PATCH',headers:{'Content-Type':'application/json','x-session-token':token},body:JSON.stringify(body)});
      if(!r.ok)throw new Error((await r.json().catch(()=>({}))).description||'Save failed');
      onUpdate(await r.json());addToast('Profile saved!','success');
    }catch(e){addToast(e.message,'error');}
    finally{setSaving(false);}
  };
  const changePw=async()=>{if(!pwNew||pwNew!==pwConf){addToast('Passwords do not match','error');return;}setPwS(true);try{const r=await fetch(`${apiUrl}/auth/account/change/password`,{method:'PATCH',headers:{'Content-Type':'application/json','x-session-token':token},body:JSON.stringify({current_password:pwCur,new_password:pwNew})});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).description||'Failed');addToast('Password changed!','success');setPwCur('');setPwNew('');setPwConf('');}catch(e){addToast(e.message,'error');}finally{setPwS(false);};};
  const uploadAvatar=async(file)=>{if(!file)return;try{const body=new FormData();body.append('file',file);const ur=await fetch(`${cdn}/avatars`,{method:'POST',body,headers:{'x-session-token':token}});if(!ur.ok)throw new Error('Upload failed');const{id}=await ur.json();const r=await fetch(`${apiUrl}/users/@me`,{method:'PATCH',headers:{'Content-Type':'application/json','x-session-token':token},body:JSON.stringify({avatar:id})});if(!r.ok)throw new Error('Failed');onUpdate(await r.json());addToast('Avatar updated!','success');}catch(e){addToast(e.message,'error');};};
  return(
    <div className="flex min-h-[380px]">
      <nav className="w-36 shrink-0 border-r border-[#1e1f22] p-2 space-y-0.5">{[['profile','Profile'],['account','Account'],['about','About']].map(([id,lbl])=><button key={id} className={`w-full rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors ${tab===id?'bg-[#404249] text-[#f2f3f5]':'text-[#80848e] hover:bg-[#35373c] hover:text-[#b5bac1]'}`} onClick={()=>setTab(id)}>{lbl}</button>)}</nav>
      <div className="flex-1 min-w-0 p-4 overflow-y-auto">
        {tab==='profile'&&<div className="space-y-4">
          <div className="relative"><div className="h-20 rounded-lg overflow-hidden">{(ownBannerUrl||bannerUrl(user,cdn))?<img src={ownBannerUrl||bannerUrl(user,cdn)} alt="" className="w-full h-full object-cover"/>:<div className="w-full h-full bg-gradient-to-br from-[#3b3f6b] to-[#5865f2]"/>}</div><div className="absolute -bottom-5 left-3"><div className="relative group cursor-pointer" onClick={()=>avatRef.current?.click()}><Avatar user={user} cdn={cdn} size="lg"/><div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 grid place-items-center text-white text-xs font-bold">Edit</div></div></div><input ref={avatRef} type="file" accept="image/*" className="hidden" onChange={e=>uploadAvatar(e.target.files?.[0])}/></div>
          <div className="pt-7"><div className="text-base font-bold text-white">{user?.username}</div><div className="text-xs text-[#80848e]">#{user?.discriminator||'0000'}</div></div>
          <div><label className="block text-xs font-bold uppercase tracking-widest text-[#80848e] mb-1">Display Name</label><input className={inp} value={dn} onChange={e=>setDn(e.target.value)} placeholder="Display name" maxLength={32}/></div>
          <div><label className="block text-xs font-bold uppercase tracking-widest text-[#80848e] mb-1">About Me</label><textarea className={`${inp} h-20 resize-none`} value={bio} onChange={e=>setBio(e.target.value)} placeholder="Tell people about yourself…" maxLength={2000}/></div>
          <button className="rounded-md bg-[#5865f2] px-4 py-2 text-sm font-bold text-white hover:bg-[#4752c4] disabled:opacity-60 transition-colors" disabled={saving} onClick={saveProfile}>{saving?'Saving…':'Save Changes'}</button>
        </div>}
        {tab==='account'&&<div className="space-y-5">
          <div><div className="text-xs font-bold uppercase tracking-widest text-[#80848e] mb-2">Status</div><button className="rounded-md bg-[#35373c] px-4 py-2 text-sm text-[#b5bac1] hover:bg-[#404249] transition-colors" onClick={openStatus}>Set Status…</button></div>
          <div className="border-t border-[#1e1f22] pt-4"><div className="text-xs font-bold uppercase tracking-widest text-[#80848e] mb-3">Change Password</div><div className="space-y-2">{[['Current',pwCur,setPwCur,'current-password'],['New',pwNew,setPwNew,'new-password'],['Confirm',pwConf,setPwConf,'new-password']].map(([l,v,s,ac])=><div key={l}><label className="text-xs text-[#80848e] block mb-0.5">{l}</label><input className={inp} type="password" value={v} onChange={e=>s(e.target.value)} autoComplete={ac}/></div>)}</div><button className="mt-3 rounded-md bg-[#5865f2] px-4 py-2 text-sm font-bold text-white hover:bg-[#4752c4] disabled:opacity-60 transition-colors" disabled={pwS||!pwCur||!pwNew} onClick={changePw}>{pwS?'Saving…':'Change Password'}</button></div>
        </div>}
        {tab==='about'&&<div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-[#2b2d31] p-3"><img src="/assets/ermine-logo.png" alt="Ermine" className="w-10 h-10 rounded-xl shrink-0"/><div><div className="text-sm font-bold text-white">Ermine v0.6.0</div><div className="text-xs text-[#80848e] mt-0.5">A refined client for stoat.chat</div><div className="text-xs text-[#80848e]">Mode: {isLowSpec?'Lite':'Standard'}</div><a href="https://ko-fi.com/stoatchat" target="_blank" rel="noopener noreferrer" className="text-xs text-[#5865f2] hover:underline mt-1 inline-block">Support Stoat →</a></div></div>
          <div className="text-xs text-[#80848e] rounded-lg bg-[#1e1f22] p-3 leading-relaxed"><p>Ermine is an experimental client for stoat.chat. Credentials stored only in browser cookies, never outside configured endpoints.</p></div>
        </div>}
      </div>
    </div>
  );
};

// ─── AppShell ─────────────────────────────────────────────────────────────────
function AppShell() {
  const [view,setView]=useState('loading');
  const [status,setStatus]=useState('disconnected');
  const [cfg,setCfg]=useState({api:DEF.api,ws:DEF.ws,cdn:DEF.cdn});
  const [auth,setAuth]=useState({token:null,uid:null});
  const [servers,setServers]=useState({});
  const [channels,setChannels]=useState({});
  const [users,setUsers]=useState({});
  const [members,setMembers]=useState({});
  const [messages,setMessages]=useState({});
  const [selServer,setSelServer]=useState('@me');
  const [selChannel,setSelChannel]=useState('friends');
  const [inputText,setInputText]=useState('');
  const [activeModal,setActiveModal]=useState(null);
  const [peekUser,setPeekUser]=useState(null);
  const [replyingTo,setReplyingTo]=useState(null);
  const [showPicker,setShowPicker]=useState(false);
  const [pendingFiles,setPendingFiles]=useState([]);
  const [isUploading,setIsUploading]=useState(false);
  const [voiceNotice,setVoiceNotice]=useState('');
  const [showGoLatest,setShowGoLatest]=useState(false);
  const [isLoadingOlder,setIsLoadingOlder]=useState(false);
  const [lightboxUrl,setLightboxUrl]=useState(null);
  const [linkUrl,setLinkUrl]=useState(null);
  const [showMobile,setShowMobile]=useState(false);
  const [isAccHov,setIsAccHov]=useState(false);
  const [pinnedMsgs,setPinnedMsgs]=useState([]);
  const [collapsedCats,setCollapsedCats]=useState({});
  const [chSearch,setChSearch]=useState('');
  const [friendSearch,setFriendSearch]=useState('');
  const [friendTab,setFriendTab]=useState('online');
  const [addFriendInput,setAddFriendInput]=useState('');
  const [addFriendLoading,setAFLoading]=useState(false);
  const [showAddFriend,setShowAddFriend]=useState(false);
  const [peekProfile,setPeekProfile]=useState(null); // fetched profile for peekUser
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [delSrvPending,setDelSrvPending]=useState(false);
  const [unread,setUnread]=useState(new Set());
  const [typing,setTyping]=useState({});
  const [statusDraft,setStatusDraft]=useState({presence:'Online',text:''});
  const [savingSt,setSavingSt]=useState(false);
  const [editSrvName,setEditSrvName]=useState('');
  const [updatingSrv,setUpdatingSrv]=useState(false);
  const [createSrvName,setCreateSrvName]=useState('');
  const [inviteCode,setInviteCode]=useState('');
  const [inviteCreated,setInviteCreated]=useState('');
  const [inviteErr,setInviteErr]=useState('');
  const [joinLoading,setJoinLoading]=useState(false);
  const [copiedInvite,setCopiedInvite]=useState(false);
  const [toasts,setToasts]=useState([]);
  const [showAdv,setShowAdv]=useState(false);
  const [loginMode,setLoginMode]=useState('credentials');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [mfaCode,setMfaCode]=useState('');
  const [manualTok,setManualTok]=useState('');
  const [loginErr,setLoginErr]=useState('');
  const [loggingIn,setLoggingIn]=useState(false);
  const [consent,setConsent]=useState(false);
  const [wsRetry,setWsRetry]=useState(0);
  const [isMembLoad,setIsMembLoad]=useState(false);

  const profileCacheRef=useRef({}); // uid -> {content, background, bannerUrl, fetching}

  // Fetch user profile (GET /users/{id}/profile) — stoat UserCard.tsx pattern
  const fetchProfile=useCallback(async(uid)=>{
    if(!uid||!auth.token)return null;
    if(profileCacheRef.current[uid])return profileCacheRef.current[uid];
    profileCacheRef.current[uid]={fetching:true};
    try{
      const r=await fetch(`${cfg.api}/users/${uid}/profile`,{headers:{'x-session-token':auth.token}});
      if(!r.ok)return null;
      const d=await r.json();
      // stoat profile API: d.background is an autumn file object { _id, content_type... } or a string ID
      const bgRaw = d.background;
      const bgId = typeof bgRaw === 'string' ? bgRaw : bgRaw?._id || null;
      const bannerUrl = bgId ? `${cfg.cdn}/backgrounds/${bgId}/original` : null;
      const result={content:d.content||null,bannerUrl,background:bgId||null};
      profileCacheRef.current[uid]=result;
      return result;
    }catch{return null;}
  },[auth.token,cfg.api,cfg.cdn]);

  const wsRef=useRef(null);const botRef=useRef(null);const scrollRef=useRef(null);
  const subRef=useRef({});const preChRef=useRef({});const preMbRef=useRef({});
  const pendUsersRef=useRef(new Set());const membLoadId=useRef(0);const canFetchU=useRef(true);
  const wsReconTim=useRef(null);const msgRefs=useRef({});const replyCacheRef=useRef({});
  const fileInputRef=useRef(null);const autoFollow=useRef(true);const isPgScroll=useRef(false);
  const pickerRef=useRef(null);const composerRef=useRef(null);const applyEvRef=useRef(null);
  const isLoadOlderR=useRef(false);const typTimers=useRef({});const sendTypTim=useRef(null);
  const lastTypRef=useRef(0);const curMsgsRef=useRef([]);const fetchMsgsRef=useRef(null);
  const selChRef=useRef(selChannel);const usersRef=useRef(users);const logoutRef=useRef(null);
  selChRef.current=selChannel;usersRef.current=users;

  const isLowSpec=useMemo(()=>typeof navigator!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,[]);

  const addToast=useCallback((msg,type='info',ms=4500)=>{const id=`t${Date.now()}${Math.random().toString(36).slice(2)}`;setToasts(p=>[...p.slice(-4),{id,msg,type}]);setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),ms);},[]);
  const dismissToast=useCallback(id=>setToasts(p=>p.filter(t=>t.id!==id)),[]);

  useEffect(()=>{const el=composerRef.current;if(!el)return;el.style.height='auto';el.style.height=Math.min(el.scrollHeight,200)+'px';},[inputText]);
  useEffect(()=>{if(!showPicker)return;const h=e=>{if(pickerRef.current&&!pickerRef.current.contains(e.target))setShowPicker(false);};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[showPicker]);

  const upsertUsers=useCallback((list=[])=>{if(!list.length)return;setUsers(p=>{const n={...p};list.forEach(u=>{if(u?._id)n[u._id]=u;});return n;});},[]);
  const upsertFromMsgs=useCallback((msgs=[])=>{const u=[];msgs.forEach(m=>{if(m?.author&&typeof m.author==='object'&&m.author._id)u.push(m.author);if(m?.user?._id)u.push(m.user);});upsertUsers(u);},[upsertUsers]);

  const fetchMissingUsers=useCallback(async(msgs=[])=>{
    if(!canFetchU.current)return;
    const need=new Set();msgs.forEach(m=>{const aid=typeof m?.author==='string'?m.author:m?.author?._id;if(aid&&aid!=='00000000000000000000000000'&&!usersRef.current[aid]&&!pendUsersRef.current.has(aid))need.add(aid);});
    if(!need.size)return;const ids=[...need].slice(0,8);ids.forEach(id=>pendUsersRef.current.add(id));
    await Promise.all(ids.map(async uid=>{try{const r=await fetch(`${cfg.api}/users/${uid}`,{headers:{'x-session-token':auth.token}});if(!r.ok){if([401,403,405].includes(r.status))canFetchU.current=false;return;}const d=await r.json();if(d?._id)upsertUsers([d]);}catch(e){if(/Failed to fetch|CORS/.test(e?.message||''))canFetchU.current=false;}finally{pendUsersRef.current.delete(uid);}}));
  },[auth.token,cfg.api,upsertUsers]);

  const fetchMembers=useCallback(async(serverId)=>{
    if(serverId==='@me')return;const lid=Date.now();membLoadId.current=lid;setIsMembLoad(true);
    try{const res=await fetch(`${cfg.api}/servers/${serverId}/members`,{headers:{'x-session-token':auth.token}});if(!res.ok)return;const data=await res.json();const ul=data.users||[];const um={};ul.forEach(u=>{if(u?._id)um[u._id]=u;});const pm=(data.members||[]).map(m=>({...m,_user:um[m._id.user]??null}));if(membLoadId.current===lid){upsertUsers(ul);setMembers(p=>{const n={...p};pm.forEach(m=>{n[`${m._id.server}:${m._id.user}`]=m;});return n;});}}
    catch{}finally{if(membLoadId.current===lid)setIsMembLoad(false);}
  },[auth.token,cfg.api,upsertUsers]);

  const fetchMessages=useCallback(async(chId,beforeId=null)=>{
    if(!chId||chId==='friends')return;
    try{const url=`${cfg.api}/channels/${chId}/messages?limit=100${beforeId?`&before=${beforeId}`:''}`;const r=await fetch(url,{headers:{'x-session-token':auth.token}});if(!r.ok)return;const data=await r.json();const msgs=Array.isArray(data)?data:data.messages||[];const usrs=Array.isArray(data)?[]:data.users||[];if(usrs.length)upsertUsers(usrs);upsertFromMsgs(msgs);const ordered=msgs.slice().reverse();setMessages(p=>({...p,[chId]:beforeId?uniq([...ordered,...(p[chId]||[])]):uniq(ordered)}));void fetchMissingUsers(ordered);if(!beforeId)preChRef.current[chId]=true;}
    catch{}
  },[auth.token,cfg.api,upsertUsers,upsertFromMsgs,fetchMissingUsers]);
  fetchMsgsRef.current=fetchMessages;

  const fetchReply=useCallback(async(chId,rid)=>{
    if(!chId||!rid||replyCacheRef.current[rid])return;
    try{const r=await fetch(`${cfg.api}/channels/${chId}/messages/${rid}`,{headers:{'x-session-token':auth.token}});if(!r.ok)return;const d=await r.json();if(!d?._id)return;replyCacheRef.current[rid]=d;upsertFromMsgs([d]);setMessages(p=>({...p,[chId]:[...(p[chId]||[])]}));}catch{}
  },[auth.token,cfg.api,upsertFromMsgs]);

  const ackChannel=useCallback(async(chId,msgId)=>{
    if(!chId||!msgId||!auth.token)return;setUnread(p=>{const n=new Set(p);n.delete(chId);return n;});
    try{await fetch(`${cfg.api}/channels/${chId}/ack/${msgId}`,{method:'PUT',headers:{'x-session-token':auth.token}});}catch{}
  },[auth.token,cfg.api]);

  const fetchPins=useCallback(async(chId)=>{
    if(!chId||chId==='friends'||!auth.token)return;
    try{const r=await fetch(`${cfg.api}/channels/${chId}/pins`,{headers:{'x-session-token':auth.token}});if(!r.ok)return;const data=await r.json();const msgs=Array.isArray(data)?data:data.messages||[];upsertFromMsgs(msgs);setPinnedMsgs(msgs);}catch{}
  },[auth.token,cfg.api,upsertFromMsgs]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const serverList=useMemo(()=>Object.values(servers),[servers]);
  const dmChannels=useMemo(()=>Object.values(channels).filter(c=>c?.channel_type==='DirectMessage'||c?.channel_type==='Group'||c?.channel_type==='SavedMessages'),[channels]);
  const curMsgs=useMemo(()=>messages[selChannel]||[]   ,[messages,selChannel]);
  const curMsgMap=useMemo(()=>Object.fromEntries(curMsgs.map(m=>[m._id,m])),[curMsgs]);
  const replyMap=useMemo(()=>({...curMsgMap,...replyCacheRef.current}),[curMsgMap]);
  const activeReply=useMemo(()=>replyingTo?curMsgMap[replyingTo._id]||replyingTo:null,[replyingTo,curMsgMap]);
  curMsgsRef.current=curMsgs;

  const curChName=useMemo(()=>{if(selChannel==='friends')return'Friends';const ch=channels[selChannel];if(ch?.name)return ch.name;if(ch?.channel_type==='DirectMessage'){const rid=(ch.recipients||[]).find(id=>id!==auth.uid);return users[rid]?.username||'DM';}return'channel';},[selChannel,channels,auth.uid,users]);
  const curChTopic=useMemo(()=>channels[selChannel]?.description||channels[selChannel]?.topic||null,[channels,selChannel]);
  const allMembers=useMemo(()=>selServer==='@me'?[]:Object.values(members).filter(m=>m._id.server===selServer),[members,selServer]);
  const selSrvObj=servers[selServer];
  const isOwner=selSrvObj?.owner===auth.uid;
  // KEY: no `users` dep — stable member list
  const memberItems=useMemo(()=>selServer==='@me'||!selSrvObj?[]:organizeMembers(allMembers,selSrvObj.roles||{}),[allMembers,selSrvObj,selServer]);

  const friends=useMemo(()=>Object.values(users).filter(u=>u.relationship==='Friend'),[users]);
  const incoming=useMemo(()=>Object.values(users).filter(u=>u.relationship==='Incoming'),[users]);
  const outgoing=useMemo(()=>Object.values(users).filter(u=>u.relationship==='Outgoing'),[users]);
  const blocked=useMemo(()=>Object.values(users).filter(u=>u.relationship==='Blocked'),[users]);

  const allCE=useMemo(()=>{const all=[];Object.values(servers).forEach(s=>{const src=s.emojis||s.emoji||[];(Array.isArray(src)?src:Object.entries(src).map(([id,v])=>({id,...v}))).forEach(e=>{if(e.id||e._id)all.push({id:e.id||e._id,name:e.name,serverName:s.name});});});return all;},[servers]);
  const ceById=useMemo(()=>{const m={};allCE.forEach(e=>{if(e?.id)m[e.id]={id:e.id,name:e.name||e.id,serverName:e.serverName};});return m;},[allCE]);
  const reactOpts=useMemo(()=>[...STD_EMOJI.map(e=>({value:e,label:e,title:e,custom:null})),...allCE.map(e=>({value:`:${e.id}:`,label:e.name,title:`${e.name} · ${e.serverName}`,custom:{id:e.id,name:e.name}}))]  ,[allCE]);

  const curTypingIds=useMemo(()=>{const s=typing[selChannel];return s?[...s].filter(id=>id!==auth.uid):[];},[typing,selChannel,auth.uid]);

  // Fetch full profile when user peek opens
  useEffect(()=>{
    if(!peekUser?._id)return;
    setPeekProfile(null);
    fetchProfile(peekUser._id).then(p=>setPeekProfile(p||null));
  },[peekUser?._id]); // eslint-disable-line

  const peekMember=useMemo(()=>!peekUser?._id||selServer==='@me'?null:members[`${selServer}:${peekUser._id}`],[members,peekUser,selServer]);
  const peekRoles=useMemo(()=>!peekMember||!selSrvObj?.roles?[]:(peekMember.roles||[]).map(id=>selSrvObj.roles?.[id]).filter(Boolean),[peekMember,selSrvObj]);
  const peekBadges=useMemo(()=>{if(!peekUser?.badges)return[];if(Array.isArray(peekUser.badges))return peekUser.badges;if(typeof peekUser.badges==='number'){const F={1:'Developer',2:'Translator',4:'Supporter',8:'Founder',16:'Moderation',32:'Active Supporter',64:'Paw'};return Object.entries(F).filter(([b])=>(peekUser.badges&Number(b))===Number(b)).map(([,l])=>l);}return[];},[peekUser]);
  const peekBio=peekUser?.profile?.content||peekUser?.profile?.bio||peekUser?.bio||null;

  const catChannels=useMemo(()=>{
    if(selServer==='@me')return[];
    const srvChs=Object.values(channels).filter(c=>c.server===selServer);
    const cats=selSrvObj?.categories||[];const cated=new Set(cats.flatMap(cat=>cat.channels||[]));
    const uncat=srvChs.filter(c=>!cated.has(c._id));const result=[];
    uncat.forEach(c=>result.push({type:'channel',channel:c}));
    cats.forEach(cat=>{if(!cat.channels?.length)return;const cc=cat.channels.map(id=>channels[id]).filter(Boolean);if(!cc.length)return;result.push({type:'category',id:cat.id,title:cat.title});if(!collapsedCats[cat.id])cc.forEach(c=>result.push({type:'channel',channel:c}));});
    return result;
  },[selServer,channels,selSrvObj,collapsedCats]);

  const filtCats=useMemo(()=>{if(!chSearch.trim())return catChannels;const q=chSearch.toLowerCase();return catChannels.filter(i=>i.type==='channel'&&(i.channel.name||'').toLowerCase().includes(q));},[catChannels,chSearch]);
  const dmLabel=(ch)=>{if(ch.channel_type==='SavedMessages')return'Saved Notes';if(ch.channel_type==='Group')return ch.name||'Group';const rid=(ch.recipients||[]).find(id=>id!==auth.uid);return users[rid]?.username||ch.name||'DM';};
  const filtDMs=useMemo(()=>{if(!chSearch.trim())return dmChannels;const q=chSearch.toLowerCase();return dmChannels.filter(ch=>dmLabel(ch).toLowerCase().includes(q));},[dmChannels,chSearch,auth.uid,users]);

  // ── WS ─────────────────────────────────────────────────────────────────────
  const discoverCfg=async(apiUrl)=>{try{const r=await fetch(apiUrl,{headers:{Accept:'application/json'}});if(!r.ok)return;const d=await r.json();setCfg(p=>({...p,ws:d.ws||p.ws,cdn:d.features?.autumn?.url||p.cdn}));}catch{}};

  useEffect(()=>{const tk=gc('ermine_token')||localStorage.getItem('stoat_token');const uk=gc('ermine_uid')||localStorage.getItem('stoat_user_id');const ak=gc('ermine_api')||localStorage.getItem('stoat_api_url');const api=ak||DEF.api;setCfg(p=>({...p,api}));discoverCfg(api);if(tk&&uk){setAuth({token:tk,uid:uk});setView('app');}else setView('login');},[]);// eslint-disable-line

  const sendTypingBegin=useCallback(()=>{const ws=wsRef.current;if(!ws||ws.readyState!==WebSocket.OPEN||!selChannel||selChannel==='friends')return;const now=Date.now();if(now-lastTypRef.current<2500)return;lastTypRef.current=now;ws.send(JSON.stringify({type:'BeginTyping',channel:selChannel}));},[selChannel]);
  const sendTypingEnd=useCallback(()=>{const ws=wsRef.current;if(!ws||ws.readyState!==WebSocket.OPEN||!selChannel)return;ws.send(JSON.stringify({type:'EndTyping',channel:selChannel}));lastTypRef.current=0;},[selChannel]);

  const applyEvent=(packet)=>{
    if(!packet?.type)return;
    switch(packet.type){
      case 'Ready':
        setUsers(p=>{const n={...p};packet.users?.forEach(u=>{n[u._id]=u;});return n;});
        setServers(p=>{const n={...p};packet.servers?.forEach(s=>{n[s._id]=s;});return n;});
        setChannels(p=>{const n={...p};packet.channels?.forEach(c=>{n[c._id]=c;});return n;});
        setMembers(p=>{const n={...p};packet.members?.forEach(m=>{n[`${m._id.server}:${m._id.user}`]=m;});return n;});
        fetch(`${cfg.api}/sync/unreads`,{headers:{'x-session-token':auth.token}}).then(r=>r.ok?r.json():[]).then(list=>{if(!Array.isArray(list))return;const ids=new Set(list.map(u=>u.channel?._id||u.channel).filter(Boolean));if(ids.size)setUnread(p=>{const n=new Set(p);ids.forEach(id=>n.add(id));return n;});}).catch(()=>{});
        setStatus('ready');break;
      case 'Bulk':packet.v?.forEach(e=>applyEvRef.current?.(e));break;
      case 'Authenticated':setStatus('authenticated');break;
      case 'Error':setStatus(`error:${packet.error||'unknown'}`);break;
      case 'Logout':logoutRef.current?.();break;
      case 'Message':
        upsertFromMsgs([packet]);void fetchMissingUsers([packet]);
        setMessages(p=>{const list=p[packet.channel]||[];if(list.some(m=>m._id===packet._id))return p;return{...p,[packet.channel]:uniq([...list,packet].slice(-200))};});
        if(packet.channel!==selChRef.current||document.hidden)setUnread(p=>{const n=new Set(p);n.add(packet.channel);return n;});break;
      case 'MessageUpdate':setMessages(p=>({...p,[packet.channel]:uniq((p[packet.channel]||[]).map(m=>m._id===packet.id?{...m,...packet.data,edited:new Date().toISOString()}:m))}));break;
      case 'MessageDelete':setMessages(p=>({...p,[packet.channel]:(p[packet.channel]||[]).filter(m=>m._id!==packet.id)}));break;
      case 'MessageReact':setMessages(p=>({...p,[packet.channel_id]:uniq((p[packet.channel_id]||[]).map(m=>{if(m._id!==packet.id)return m;const ex=m.reactions?.[packet.emoji_id]||[];return{...m,reactions:{...(m.reactions||{}),[packet.emoji_id]:[...new Set([...ex,packet.user_id])]}};}))}));break;
      case 'MessageUnreact':setMessages(p=>({...p,[packet.channel_id]:uniq((p[packet.channel_id]||[]).map(m=>{if(m._id!==packet.id)return m;const ex=(m.reactions?.[packet.emoji_id]||[]).filter(u=>u!==packet.user_id);const nr={...(m.reactions||{}),[packet.emoji_id]:ex};if(!ex.length)delete nr[packet.emoji_id];return{...m,reactions:nr};}))}));break;
      case 'MessageRemoveReaction':setMessages(p=>({...p,[packet.channel_id]:uniq((p[packet.channel_id]||[]).map(m=>{if(m._id!==packet.id)return m;const nr={...(m.reactions||{})};delete nr[packet.emoji_id];return{...m,reactions:nr};}))}));break;
      case 'ChannelCreate':setChannels(p=>({...p,[packet._id]:packet}));break;
      case 'ChannelUpdate':setChannels(p=>({...p,[packet.id]:clrF({...p[packet.id],...packet.data},packet.clear)}));break;
      case 'ChannelDelete':setChannels(p=>{const n={...p};delete n[packet.id];return n;});if(selChRef.current===packet.id)setSelChannel('friends');break;
      case 'ChannelAck':if(packet.user===auth.uid)setUnread(p=>{const n=new Set(p);n.delete(packet.id);return n;});break;
      case 'ChannelStartTyping':
        if(packet.user!==auth.uid){setTyping(p=>{const s=new Set(p[packet.id]||[]);s.add(packet.user);return{...p,[packet.id]:s};});const tk=`${packet.id}:${packet.user}`;clearTimeout(typTimers.current[tk]);typTimers.current[tk]=setTimeout(()=>setTyping(p=>{const s=new Set(p[packet.id]||[]);s.delete(packet.user);return{...p,[packet.id]:s};}),5000);}break;
      case 'ChannelStopTyping':setTyping(p=>{const s=new Set(p[packet.id]||[]);s.delete(packet.user);return{...p,[packet.id]:s};});clearTimeout(typTimers.current[`${packet.id}:${packet.user}`]);break;
      case 'ServerCreate':setServers(p=>({...p,[packet._id||packet.id]:packet}));break;
      case 'ServerUpdate':setServers(p=>({...p,[packet.id]:clrF({...p[packet.id],...packet.data},packet.clear)}));break;
      case 'ServerDelete':setServers(p=>{const n={...p};delete n[packet.id];return n;});if(selServer===packet.id){setSelServer('@me');setSelChannel('friends');}break;
      case 'ServerMemberUpdate':{const k=`${packet.id.server}:${packet.id.user}`;setMembers(p=>{const ex=p[k]||{};const up=clrF({...ex,_id:packet.id,...packet.data},packet.clear);if(!up._user&&ex._user)up._user=ex._user;return{...p,[k]:up};});break;}
      case 'ServerMemberJoin':setMembers(p=>({...p,[`${packet.id}:${packet.user}`]:{...packet.member,_id:{server:packet.id,user:packet.user}}}));break;
      case 'ServerMemberLeave':setMembers(p=>{const n={...p};delete n[`${packet.id}:${packet.user}`];return n;});break;
      case 'UserUpdate':{const up=clrF({...usersRef.current[packet.id],...packet.data},packet.clear);setUsers(p=>({...p,[packet.id]:up}));setMembers(p=>{const keys=Object.keys(p).filter(k=>k.endsWith(':'+packet.id));if(!keys.length)return p;const n={...p};keys.forEach(k=>{if(n[k]._user)n[k]={...n[k],_user:up};});return n;});break;}
      case 'UserRelationship':setUsers(p=>({...p,[packet.user._id]:packet.user}));break;
      default:break;
    }
  };
  applyEvRef.current=applyEvent;

  useEffect(()=>{
    if(!auth.token||view!=='app')return;
    let wsUrl=cfg.ws;
    try{const u=new URL(wsUrl.startsWith('ws')?wsUrl:`wss://${wsUrl}`);u.searchParams.set('version','1');u.searchParams.set('format','json');u.searchParams.set('token',auth.token);wsUrl=u.toString();}
    catch{wsUrl=`${DEF.ws}?version=1&format=json&token=${encodeURIComponent(auth.token)}`;}
    setStatus('connecting');if(wsRef.current)wsRef.current.close();if(wsReconTim.current){clearTimeout(wsReconTim.current);wsReconTim.current=null;}
    let dead=false;const ws=new WebSocket(wsUrl);wsRef.current=ws;
    ws.onerror=()=>setStatus('error');
    ws.onclose=()=>{setStatus(p=>p==='error'?p:'disconnected');if(dead||view!=='app')return;wsReconTim.current=setTimeout(()=>setWsRetry(v=>v+1),2500);};
    ws.onmessage=e=>{try{applyEvRef.current?.(JSON.parse(e.data));}catch{}};
    const hb=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'Ping',data:Date.now()}));},20000);
    return()=>{dead=true;clearInterval(hb);if(wsReconTim.current){clearTimeout(wsReconTim.current);wsReconTim.current=null;}ws.close();};
  },[auth.token,cfg.ws,view,wsRetry]);// eslint-disable-line

  useEffect(()=>{
    const ws=wsRef.current;if(!ws||ws.readyState!==WebSocket.OPEN||selServer==='@me')return;
    const send=()=>{if(document.visibilityState!=='visible')return;const last=subRef.current[selServer]||0;if(Date.now()-last<600000)return;ws.send(JSON.stringify({type:'Subscribe',server_id:selServer}));subRef.current[selServer]=Date.now();};
    send();window.addEventListener('focus',send);document.addEventListener('visibilitychange',send);const iv=setInterval(send,60000);
    return()=>{clearInterval(iv);window.removeEventListener('focus',send);document.removeEventListener('visibilitychange',send);};
  },[selServer,status]);

  useEffect(()=>{
    const el=scrollRef.current;if(!el)return;autoFollow.current=true;
    const fn=()=>{if(isPgScroll.current)return;const nb=el.scrollHeight-el.scrollTop-el.clientHeight<=80;autoFollow.current=nb;setShowGoLatest(!nb);if(el.scrollTop<150&&!isLoadOlderR.current){const msgs=curMsgsRef.current;const oldest=msgs[0];if(oldest&&!oldest._id.startsWith('pending-')&&msgs.length>=50){const ph=el.scrollHeight,pt=el.scrollTop;isLoadOlderR.current=true;setIsLoadingOlder(true);fetchMsgsRef.current(selChRef.current,oldest._id).finally(()=>{isLoadOlderR.current=false;setIsLoadingOlder(false);requestAnimationFrame(()=>{el.scrollTop=pt+(el.scrollHeight-ph);});});}}};
    el.addEventListener('scroll',fn,{passive:true});return()=>el.removeEventListener('scroll',fn);
  },[selChannel]);

  useEffect(()=>{const el=scrollRef.current;if(autoFollow.current||(el&&el.scrollHeight-el.scrollTop-el.clientHeight<=80)){isPgScroll.current=true;botRef.current?.scrollIntoView({behavior:'auto'});requestAnimationFrame(()=>{isPgScroll.current=false;});autoFollow.current=true;setShowGoLatest(false);}else setShowGoLatest(true);},[curMsgs]);

  useEffect(()=>{if(!selChannel||selChannel==='friends')return;const missing=[...new Set(curMsgs.map(replyId).filter(id=>id&&!replyCacheRef.current[id]&&!curMsgMap[id]))].slice(0,10);missing.forEach(id=>void fetchReply(selChannel,id));},[curMsgs,curMsgMap,selChannel,fetchReply]);
  useEffect(()=>{if(!voiceNotice)return;const t=setTimeout(()=>setVoiceNotice(''),3500);return()=>clearTimeout(t);},[voiceNotice]);
  useEffect(()=>{if(status!=='ready'||!auth.token)return;const max=Math.min(8,Math.max(3,Math.floor((navigator.hardwareConcurrency||4)/2)));Object.values(channels).filter(c=>c?.channel_type==='TextChannel'||!c?.channel_type).slice(0,max).forEach((c,i)=>{if(!c?._id||preChRef.current[c._id])return;setTimeout(()=>fetchMessages(c._id),i*350);});},[status,auth.token]);// eslint-disable-line

  // ── Navigation ─────────────────────────────────────────────────────────────
  const selectServer=useCallback((id)=>{setSelServer(id);setShowMobile(false);setChSearch('');if(id==='@me'){setSelChannel('friends');setReplyingTo(null);setShowPicker(false);return;}const first=Object.values(channels).find(c=>c.server===id&&c.channel_type!=='VoiceChannel')||Object.values(channels).find(c=>c.server===id);setSelChannel(first?._id||null);if(first?._id)fetchMessages(first._id);if(!preMbRef.current[id]){preMbRef.current[id]=true;void fetchMembers(id);}},[channels,fetchMessages,fetchMembers]);
  const selectChannel=useCallback((chId)=>{const ch=channels[chId];if(ch?.channel_type==='VoiceChannel'){setVoiceNotice("Voice channels aren't supported yet.");return;}setVoiceNotice('');setSelChannel(chId);setReplyingTo(null);setShowPicker(false);setShowMobile(false);fetchMessages(chId);sendTypingEnd();const msgs=messages[chId]||[];const last=msgs[msgs.length-1];if(last?._id&&!last._id.startsWith('pending-'))ackChannel(chId,last._id);},[channels,fetchMessages,sendTypingEnd,messages,ackChannel]);
  const openDm=async(userId)=>{if(!userId||!auth.token)return;const ex=Object.values(channels).find(c=>c.channel_type==='DirectMessage'&&(c.recipients||[]).includes(userId));if(ex?._id){setSelServer('@me');selectChannel(ex._id);return;}try{const r=await fetch(`${cfg.api}/users/${userId}/dm`,{method:'GET',headers:{'x-session-token':auth.token}});if(!r.ok)return;const ch=await r.json();if(!ch?._id)return;setChannels(p=>({...p,[ch._id]:ch}));setSelServer('@me');setSelChannel(ch._id);fetchMessages(ch._id);}catch{}};
  const jumpTo=(msgId)=>{const el=msgRefs.current[msgId];if(!el)return;el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('msg-highlight');setTimeout(()=>el.classList.remove('msg-highlight'),1400);};
  const regRef=useCallback((id,node)=>{if(!id)return;if(node)msgRefs.current[id]=node;else delete msgRefs.current[id];},[]);
  const goLatest=()=>{isPgScroll.current=true;autoFollow.current=true;botRef.current?.scrollIntoView({behavior:'smooth'});requestAnimationFrame(()=>{isPgScroll.current=false;});setShowGoLatest(false);};
  const openLink=useCallback((url)=>{if(url.startsWith('lightbox:')){setLightboxUrl(url.slice(9));return;}setLinkUrl(url);},[]);
  const openStatusEditor=()=>{const u=users[auth.uid];setStatusDraft({presence:u?.status?.presence||'Online',text:u?.status?.text||''});setActiveModal('set-status');};
  const saveStatus=async()=>{
    setSavingSt(true);
    // stoat source (UserMenu.tsx): user.edit({ status: { presence } })
    // and user.edit({ remove: ["StatusText"] }) to clear
    const body={status:{presence:statusDraft.presence}};
    if(statusDraft.text?.trim())body.status.text=statusDraft.text.trim();
    else body.remove=['StatusText'];
    // Optimistic update
    const newStatus={presence:statusDraft.presence};
    if(statusDraft.text?.trim())newStatus.text=statusDraft.text.trim();
    setUsers(p=>({...p,[auth.uid]:{...p[auth.uid],status:newStatus}}));
    try{
      const r=await fetch(`${cfg.api}/users/@me`,{method:'PATCH',headers:{'Content-Type':'application/json','x-session-token':auth.token},body:JSON.stringify(body)});
      if(!r.ok)throw new Error((await r.json().catch(()=>({}))).description||'Failed');
      const updated=await r.json();if(updated?._id)upsertUsers([updated]);
      addToast('Status updated!','success');
    }catch(e){addToast(e.message||'Failed to update status','error');}
    finally{setSavingSt(false);setActiveModal(null);}
  };

  const handleLogin=async(e)=>{e.preventDefault();setLoginErr('');if(!consent){setLoginErr('Please accept the privacy policy.');return;}setLoggingIn(true);try{await discoverCfg(cfg.api);let token=manualTok.trim(),uid=null;if(loginMode==='credentials'){const payload={email,password,friendly_name:'Ermine'};if(mfaCode.trim())payload.mfa_response={totp_code:mfaCode.trim()};const r=await fetch(`${cfg.api}/auth/session/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw new Error(r.status===401?'Invalid credentials or MFA.':'Login failed.');const d=await r.json();token=d.token||d.session_token;uid=d.user_id;}else{const r=await fetch(`${cfg.api}/users/@me`,{headers:{'x-session-token':token}});if(!r.ok)throw new Error('Invalid token.');const d=await r.json();uid=d._id;}if(!token||!uid)throw new Error('Session creation failed.');sc('ermine_token',token);sc('ermine_uid',uid);sc('ermine_api',cfg.api);setAuth({token,uid});setView('app');}catch(err){setLoginErr(err.message||'Unknown error');}finally{setLoggingIn(false);};};

  const logout=useCallback(()=>{['ermine_token','ermine_uid','ermine_api'].forEach(dc);['stoat_token','stoat_user_id','stoat_api_url'].forEach(k=>localStorage.removeItem(k));setAuth({token:null,uid:null});setMessages({});setServers({});setChannels({});setUsers({});setMembers({});preChRef.current={};preMbRef.current={};pendUsersRef.current=new Set();membLoadId.current=0;canFetchU.current=true;setIsMembLoad(false);setWsRetry(0);setUnread(new Set());setTyping({});if(wsReconTim.current){clearTimeout(wsReconTim.current);wsReconTim.current=null;}setView('login');setStatus('disconnected');},[]);
  logoutRef.current=logout;

  // ── Messaging ─────────────────────────────────────────────────────────────
  const uploadFiles=async(files=[])=>{const ids=[];for(const f of files){const body=new FormData();body.append('file',f);const r=await fetch(`${cfg.cdn}/attachments`,{method:'POST',body,headers:{'x-session-token':auth.token}});if(!r.ok)throw new Error(`Upload failed: ${f.name}`);const d=await r.json();if(d?.id)ids.push(d.id);}return ids;};

  const sendMessage=async()=>{const content=inputText.trim();const hasFiles=pendingFiles.length>0;if((!content&&!hasFiles)||!selChannel||selChannel==='friends')return;const capFiles=[...pendingFiles];const capReply=replyingTo;setInputText('');setPendingFiles([]);setReplyingTo(null);setShowPicker(false);setIsUploading(hasFiles);sendTypingEnd();const nonce=genUlid();const pid=`pending-${nonce}`;const me=users[auth.uid]||{_id:auth.uid,username:'You'};const opt={_id:pid,channel:selChannel,author:auth.uid,user:me,content,createdAt:new Date().toISOString(),reactions:{},replies:capReply?[{id:capReply._id,mention:false}]:undefined};setMessages(p=>{const l=p[selChannel]||[];return{...p,[selChannel]:uniq([...l,opt].slice(-200))};});try{const aids=hasFiles?await uploadFiles(capFiles):[];// stoat source: omit attachments entirely when empty (not send [])
const payload={content,nonce,replies:capReply?[{id:capReply._id,mention:false}]:undefined};
if(aids.length)payload.attachments=aids;const r=await fetch(`${cfg.api}/channels/${selChannel}/messages`,{method:'POST',headers:{'Content-Type':'application/json','x-session-token':auth.token},body:JSON.stringify(payload)});if(!r.ok)throw new Error('Send failed');const posted=await r.json();if(posted?._id){upsertFromMsgs([posted]);setMessages(p=>{const l=(p[selChannel]||[]).filter(m=>m._id!==pid);const dd=l.some(m=>m._id===posted._id)?l.map(m=>m._id===posted._id?posted:m):[...l,posted];return{...p,[selChannel]:uniq(dd.sort((a,b)=>a._id>b._id?1:-1))};});}}catch(err){setMessages(p=>({...p,[selChannel]:(p[selChannel]||[]).filter(m=>m._id!==pid)}));setInputText(content);addToast(err.message||'Failed to send','error');}finally{setIsUploading(false);};};

  const sendGif=async(url)=>{if(!selChannel||selChannel==='friends')return;setShowPicker(false);const nonce=genUlid();const pid=`pending-${nonce}`;const me=users[auth.uid]||{_id:auth.uid,username:'You'};setMessages(p=>{const l=p[selChannel]||[];return{...p,[selChannel]:uniq([...l,{_id:pid,channel:selChannel,author:auth.uid,user:me,content:url,createdAt:new Date().toISOString(),reactions:{}}].slice(-200))};});try{const r=await fetch(`${cfg.api}/channels/${selChannel}/messages`,{method:'POST',headers:{'Content-Type':'application/json','x-session-token':auth.token},body:JSON.stringify({content:url,nonce})});if(!r.ok)throw new Error('Send failed');const posted=await r.json();if(posted?._id)setMessages(p=>{const l=(p[selChannel]||[]).filter(m=>m._id!==pid);return{...p,[selChannel]:uniq([...l,posted].sort((a,b)=>a._id>b._id?1:-1))};});}catch{setMessages(p=>({...p,[selChannel]:(p[selChannel]||[]).filter(m=>m._id!==pid)}));}};

  const editMessage=async(msgId,content)=>{try{await fetch(`${cfg.api}/channels/${selChannel}/messages/${msgId}`,{method:'PATCH',headers:{'Content-Type':'application/json','x-session-token':auth.token},body:JSON.stringify({content})});}catch{addToast('Failed to edit','error');};};
  const requestDelete=useCallback((msg)=>setDeleteTarget(msg),[]);
  const confirmDelete=async()=>{if(!deleteTarget)return;const mid=deleteTarget._id;setDeleteTarget(null);setMessages(p=>({...p,[selChannel]:(p[selChannel]||[]).filter(m=>m._id!==mid)}));try{await fetch(`${cfg.api}/channels/${selChannel}/messages/${mid}`,{method:'DELETE',headers:{'x-session-token':auth.token}});}catch{addToast('Failed to delete','error');};};
  const toggleReaction=async(msg,emoji,reacted)=>{if(!msg?._id||!selChannel||selChannel==='friends')return;const enc=encodeURIComponent(emoji);setMessages(p=>({...p,[selChannel]:(p[selChannel]||[]).map(m=>{if(m._id!==msg._id)return m;const ex=m.reactions?.[emoji]||[];const nxt=reacted?ex.filter(id=>id!==auth.uid):[...new Set([...ex,auth.uid])];return{...m,reactions:{...(m.reactions||{}),[emoji]:nxt}};})}));try{await fetch(`${cfg.api}/channels/${selChannel}/messages/${msg._id}/reactions/${enc}`,{method:reacted?'DELETE':'PUT',headers:{'x-session-token':auth.token}});}catch{}};

  const createInvite=async()=>{setInviteCreated('');setInviteErr('');try{const r=await fetch(`${cfg.api}/channels/${selChannel}/invites`,{method:'POST',headers:{'x-session-token':auth.token}});if(!r.ok)throw new Error('Failed');const d=await r.json();setInviteCreated(d._id||d.code||d.id||'');}catch(err){setInviteErr(err.message);}};
  const joinByInvite=async()=>{if(!inviteCode.trim())return;setJoinLoading(true);setInviteErr('');try{const r=await fetch(`${cfg.api}/invites/${inviteCode.trim()}`,{method:'POST',headers:{'x-session-token':auth.token}});if(!r.ok)throw new Error('Invalid invite');setActiveModal(null);setInviteCode('');addToast('Joined!','success');}catch(err){setInviteErr(err.message);}finally{setJoinLoading(false);}};
  const createServer=async()=>{if(!createSrvName.trim())return;try{const r=await fetch(`${cfg.api}/servers/create`,{method:'POST',headers:{'Content-Type':'application/json','x-session-token':auth.token},body:JSON.stringify({name:createSrvName.trim()})});if(r.ok){setCreateSrvName('');setActiveModal(null);}else throw new Error('Failed');}catch(err){addToast(err.message,'error');};};
  const updateServer=async()=>{if(!selServer||selServer==='@me'||!editSrvName.trim())return;setUpdatingSrv(true);try{const r=await fetch(`${cfg.api}/servers/${selServer}`,{method:'PATCH',headers:{'Content-Type':'application/json','x-session-token':auth.token},body:JSON.stringify({name:editSrvName.trim()})});if(r.ok)setActiveModal(null);}catch{addToast('Failed','error');}finally{setUpdatingSrv(false);}};
  const confirmDelServer=async()=>{setDelSrvPending(false);setUpdatingSrv(true);try{await fetch(`${cfg.api}/servers/${selServer}`,{method:'DELETE',headers:{'x-session-token':auth.token}});setActiveModal(null);}catch{addToast('Failed to delete','error');}finally{setUpdatingSrv(false);}};

  const sendFriendReq=async(username)=>{if(!username?.trim())return;try{const r=await fetch(`${cfg.api}/users/${username}/friend`,{method:'PUT',headers:{'x-session-token':auth.token}});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).description||'User not found');const d=await r.json();if(d?._id)upsertUsers([d]);addToast('Friend request sent!','success');}catch(err){addToast(err.message,'error');}};
  const removeFriend=async(uid)=>{try{const r=await fetch(`${cfg.api}/users/${uid}/friend`,{method:'DELETE',headers:{'x-session-token':auth.token}});if(r.ok){const d=await r.json();if(d?._id)upsertUsers([d]);}}catch{}};
  const acceptFriend=async(uid)=>{try{const r=await fetch(`${cfg.api}/users/${uid}/friend`,{method:'PUT',headers:{'x-session-token':auth.token}});if(!r.ok)throw new Error('Failed');const d=await r.json();if(d?._id)upsertUsers([d]);addToast('Accepted!','success');}catch(err){addToast(err.message,'error');}};
  const declineFriend=async(uid)=>{try{const r=await fetch(`${cfg.api}/users/${uid}/friend`,{method:'DELETE',headers:{'x-session-token':auth.token}});if(r.ok){const d=await r.json();if(d?._id)upsertUsers([d]);}}catch{}};
  const blockUser=async(uid)=>{try{const r=await fetch(`${cfg.api}/users/${uid}/block`,{method:'PUT',headers:{'x-session-token':auth.token}});if(r.ok){const d=await r.json();if(d?._id)upsertUsers([d]);addToast('User blocked.','info');}}catch{}};
  const unblockUser=async(uid)=>{try{const r=await fetch(`${cfg.api}/users/${uid}/block`,{method:'DELETE',headers:{'x-session-token':auth.token}});if(r.ok){const d=await r.json();if(d?._id)upsertUsers([d]);}}catch{}};
  const handleAddFriend=async()=>{if(!addFriendInput.trim())return;setAFLoading(true);await sendFriendReq(addFriendInput.trim());setAddFriendInput('');setAFLoading(false);};

  const addEmoji=(e)=>{setInputText(p=>p+e);setShowPicker(false);composerRef.current?.focus();};
  const addCE=(id)=>{setInputText(p=>`${p}:${id}:`);setShowPicker(false);composerRef.current?.focus();};
  const onFilePick=(e)=>{const f=Array.from(e.target.files||[]);if(f.length)setPendingFiles(p=>[...p,...f]);e.target.value='';};
  const onPaste=(e)=>{const imgs=Array.from(e.clipboardData?.items||[]).filter(it=>it.kind==='file'&&it.type.startsWith('image/'));if(imgs.length){e.preventDefault();setPendingFiles(p=>[...p,...imgs.map(it=>it.getAsFile()).filter(Boolean)]);}};

  const chIcon=(ch)=>{if(!ch)return <Hash size={16}/>;switch(ch.channel_type){case 'DirectMessage':return <MessageSquare size={16}/>;case 'VoiceChannel':return <Users size={16} className="text-[#80848e]"/>;case 'SavedMessages':return <BookOpen size={16}/>;case 'Group':return <Users size={16}/>;default:return <Hash size={16}/>;}}

  // Member item renderer (live presence dot reads from usersRef, no re-render of list)
  const PresenceDot=useCallback(({uid})=><span className="absolute -bottom-px -right-px w-3 h-3 rounded-full border-2 border-[#2b2d31]" style={{background:pc(usersRef.current[uid]?.status?.presence)}}/> ,[]);
  const renderMemberItem=useCallback((item)=>{
    if(item.type==='header')return <div className="flex items-end px-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-[#80848e] h-full">{item.name} — {item.count}</div>;
    const m=item.data;const mu=m.user||{_id:m?._id?.user,username:'…'};const uid=mu._id||m._id?.user;
    return <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[#35373c] h-full transition-colors" onClick={()=>setPeekUser({...(usersRef.current[uid]||mu),_id:uid})}>
      <div className="relative shrink-0"><Avatar user={mu} cdn={cfg.cdn} size="sm"/><PresenceDot uid={uid}/></div>
      <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium leading-tight" style={{color:m.color||'#f2f3f5'}}>{m.nickname||mu.display_name||mu.username||'…'}</div>{mu.status?.text&&<div className="text-[11px] text-[#80848e] truncate leading-tight mt-0.5">{mu.status.text}</div>}</div>
    </button>;
  },[cfg.cdn,PresenceDot]);

  // ── Loading / Login ────────────────────────────────────────────────────────
  if(view==='loading')return <div className="grid h-screen place-items-center bg-[#1e1f22]"><div className="flex flex-col items-center gap-3"><img src="/assets/ermine-logo.png" className="w-20 h-20 rounded-2xl animate-pulse" alt="Ermine"/><span className="text-[#80848e] text-sm">Loading Ermine…</span></div></div>;

  if(view==='login')return(
    <div className="min-h-screen bg-[#1e1f22] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#35373c] bg-[#232428] p-8 shadow-2xl">
        <div className="mb-6 text-center"><img src="/assets/ermine-logo.png" alt="Ermine" className="w-20 h-20 mx-auto rounded-2xl mb-3 shadow-lg"/><h1 className="text-2xl font-bold text-white">Ermine</h1><p className="text-sm text-[#80848e]">A refined client for stoat.chat</p></div>
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-[#1e1f22] p-1">{['credentials','token'].map(m=><button key={m} className={`rounded py-2 text-xs font-bold uppercase tracking-wide transition-colors ${loginMode===m?'bg-[#5865f2] text-white':'text-[#80848e] hover:text-[#b5bac1]'}`} onClick={()=>setLoginMode(m)}>{m==='credentials'?'Credentials':'Token'}</button>)}</div>
        <form className="space-y-3" onSubmit={handleLogin}>
          {loginMode==='credentials'?<><input className={inp} type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/><input className={inp} type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/><input className={inp} type="text" placeholder="2FA code (optional)" value={mfaCode} onChange={e=>setMfaCode(e.target.value)} autoComplete="one-time-code"/></>:<textarea className={`${inp} h-24 resize-none`} placeholder="Paste session token" value={manualTok} onChange={e=>setManualTok(e.target.value)}/>}
          <label className="flex items-start gap-2 rounded-lg border border-[#35373c] bg-[#1e1f22] p-2.5 text-xs text-[#80848e] cursor-pointer hover:border-[#5865f2]/40 transition-colors"><input checked={consent} type="checkbox" className="mt-0.5 shrink-0 accent-[#5865f2]" onChange={e=>setConsent(e.target.checked)}/><span>I agree to the <a className="text-[#5865f2] hover:underline" href="/privacy-policy.html" rel="noreferrer" target="_blank">privacy policy</a>. Ermine doesn't store data outside configured endpoints.</span></label>
          {loginErr&&<div className="flex items-start gap-2 rounded-lg border border-[#F84848]/30 bg-[#F84848]/10 p-2.5 text-sm text-[#F84848]"><AlertCircle size={14} className="mt-0.5 shrink-0"/>{loginErr}</div>}
          <button className="w-full rounded-lg bg-[#5865f2] py-2.5 text-sm font-bold text-white hover:bg-[#4752c4] disabled:opacity-60 flex items-center justify-center gap-2 transition-colors" disabled={loggingIn} type="submit">{loggingIn?<><Loader className="animate-spin" size={14}/> Signing in…</>:'Sign in to Ermine'}</button>
        </form>
        <div className="mt-4 border-t border-[#35373c] pt-3"><button className="flex items-center gap-1 text-xs text-[#80848e] hover:text-[#b5bac1]" onClick={()=>setShowAdv(p=>!p)}><Settings size={12}/> Advanced</button>{showAdv&&<div className="mt-2 space-y-1.5 rounded-lg bg-[#1e1f22] p-2">{[['API URL',cfg.api,'api'],['WS URL',cfg.ws,'ws'],['CDN URL',cfg.cdn,'cdn']].map(([l,v,k])=><div key={k}><label className="text-[11px] text-[#80848e]">{l}</label><input className={`${inp} mt-0.5 text-xs`} value={v} onChange={e=>setCfg(p=>({...p,[k]:e.target.value}))}/></div>)}</div>}</div>
      </div>
    </div>
  );

  // ── App layout ─────────────────────────────────────────────────────────────
  const M=(activeModal==='set-status');
  return (
    <div className="flex h-screen overflow-hidden bg-[#1e1f22] text-[#f2f3f5]">
      {/* ── Modals ── */}
      {deleteTarget&&<Modal onClose={()=>setDeleteTarget(null)} title="Delete Message"><div className="rounded-lg bg-[#1e1f22] border border-[#35373c] p-3"><p className="text-xs text-[#80848e] mb-1">From <strong className="text-white">{users[typeof deleteTarget.author==='string'?deleteTarget.author:deleteTarget.author?._id]?.username||'Unknown'}</strong></p><p className="text-sm text-[#b5bac1] truncate">{deleteTarget.content||'[attachment]'}</p></div><p className="text-sm text-[#80848e]">This cannot be undone.</p><div className="flex gap-2 justify-end"><button className="rounded-md px-3 py-1.5 text-sm text-[#80848e] hover:text-white hover:bg-[#35373c]" onClick={()=>setDeleteTarget(null)}>Cancel</button><button className="rounded-md bg-[#F84848] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#d03030]" onClick={confirmDelete}>Delete</button></div></Modal>}
      {delSrvPending&&selSrvObj&&<Modal onClose={()=>setDelSrvPending(false)} title="Delete Space"><p className="text-sm text-[#b5bac1]">Permanently delete <strong className="text-white">{selSrvObj.name}</strong>? Cannot be undone.</p><div className="flex gap-2 justify-end"><button className="rounded-md px-3 py-1.5 text-sm text-[#80848e] hover:text-white hover:bg-[#35373c]" onClick={()=>setDelSrvPending(false)}>Cancel</button><button className="rounded-md bg-[#F84848] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#d03030] disabled:opacity-60" disabled={updatingSrv} onClick={confirmDelServer}>Delete Space</button></div></Modal>}
      {lightboxUrl&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 cursor-zoom-out" onClick={()=>setLightboxUrl(null)}><div className="relative p-4" onClick={e=>e.stopPropagation()}><img src={lightboxUrl} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" style={{cursor:'default'}}/><button className="absolute -top-2 -right-2 rounded-full bg-[#232428] border border-[#35373c] p-1.5 text-[#b5bac1] hover:text-white" onClick={()=>setLightboxUrl(null)}><X size={14}/></button><a href={lightboxUrl} target="_blank" rel="noreferrer" className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs text-[#80848e] hover:text-[#b5bac1]" onClick={e=>e.stopPropagation()}>Open original ↗</a></div></div>}
      {linkUrl&&<Modal onClose={()=>setLinkUrl(null)} title="Open link?"><div className="rounded-lg bg-[#1e1f22] p-3"><p className="text-xs text-[#80848e] mb-1">Do you trust this link?</p><p className="break-all text-sm text-[#8ea1ff]">{linkUrl}</p></div><div className="grid grid-cols-2 gap-2"><button className="rounded-md bg-[#35373c] py-2 text-sm text-[#b5bac1] hover:bg-[#404249]" onClick={()=>setLinkUrl(null)}>Cancel</button><button className="rounded-md bg-[#5865f2] py-2 text-sm font-bold text-white hover:bg-[#4752c4]" onClick={()=>{window.open(linkUrl,'_blank','noopener,noreferrer');setLinkUrl(null);}}>Open</button></div></Modal>}
      {activeModal==='create-server'&&<Modal onClose={()=>setActiveModal(null)} title="Create a Space"><input className={inp} placeholder="Space name" value={createSrvName} onChange={e=>setCreateSrvName(e.target.value)} autoFocus onKeyDown={e=>e.key==='Enter'&&createServer()}/><button className="w-full rounded-md bg-[#3ABF7E] py-2 text-sm font-bold text-white hover:bg-[#2da066] disabled:opacity-60" disabled={!createSrvName.trim()} onClick={createServer}>Create Space</button></Modal>}
      {activeModal==='join-server'&&<Modal onClose={()=>{setActiveModal(null);setInviteCode('');setInviteErr('');}} title="Join with Invite"><input className={inp} placeholder="Invite code" value={inviteCode} onChange={e=>setInviteCode(e.target.value)} onKeyDown={e=>e.key==='Enter'&&joinByInvite()} autoFocus/>{inviteErr&&<p className="text-xs text-[#F84848]">{inviteErr}</p>}<button className="w-full rounded-md bg-[#5865f2] py-2 text-sm font-bold text-white hover:bg-[#4752c4] disabled:opacity-60 flex items-center justify-center gap-2" disabled={joinLoading||!inviteCode.trim()} onClick={joinByInvite}>{joinLoading?<><Loader className="animate-spin" size={14}/>Joining…</>:'Join Space'}</button></Modal>}
      {activeModal==='create-invite'&&<Modal onClose={()=>{setActiveModal(null);setInviteCreated('');setInviteErr('');}} title="Invite to Space">{!inviteCreated?<button className="w-full rounded-md bg-[#5865f2] py-2 text-sm font-bold text-white hover:bg-[#4752c4] flex items-center justify-center gap-2" onClick={createInvite}><Link size={14}/> Create Invite</button>:<div><p className="text-xs text-[#80848e] mb-1.5">Share this code:</p><div className="flex gap-2"><code className="flex-1 rounded-md bg-[#1e1f22] px-3 py-2 text-sm text-[#5865f2] select-all font-mono border border-[#35373c]">{inviteCreated}</code><button className="rounded-md bg-[#5865f2] px-3 py-2 text-white hover:bg-[#4752c4]" onClick={()=>{navigator.clipboard.writeText(inviteCreated);setCopiedInvite(true);setTimeout(()=>setCopiedInvite(false),2000);}}>{copiedInvite?<Check size={16}/>:<Copy size={16}/>}</button></div></div>}{inviteErr&&<p className="text-xs text-[#F84848]">{inviteErr}</p>}</Modal>}
      {activeModal==='pinned'&&<Modal onClose={()=>setActiveModal(null)} title={`Pinned — #${curChName}`} wide>{pinnedMsgs.length===0?<p className="text-sm text-[#80848e] text-center py-6">No pinned messages.</p>:pinnedMsgs.map(m=>{const aId=typeof m.author==='string'?m.author:m.author?._id;return <div key={m._id} className="rounded-lg bg-[#1e1f22] border border-[#35373c] p-3 hover:border-[#5865f2]/30"><div className="flex items-center gap-2 mb-1.5"><Avatar user={users[aId]} cdn={cfg.cdn} size="sm"/><span className="text-sm font-semibold text-white">{users[aId]?.username||'Unknown'}</span><span className="text-xs text-[#80848e] ml-auto">{fmtT(m.createdAt||m._id)}</span><button className="text-xs text-[#5865f2] hover:underline ml-2" onClick={()=>{setActiveModal(null);jumpTo(m._id);}}>Jump</button></div><p className="text-sm text-[#b5bac1] whitespace-pre-wrap break-words">{m.content}</p></div>;})}</Modal>}
      {activeModal==='server-settings'&&selSrvObj&&<Modal onClose={()=>setActiveModal(null)} title="Space Settings"><label className="text-xs font-bold uppercase tracking-widest text-[#80848e] block mb-1">Name</label><div className="flex gap-2"><input className={inp} value={editSrvName} onChange={e=>setEditSrvName(e.target.value)}/><button className="rounded-md bg-[#5865f2] px-3 text-white hover:bg-[#4752c4] disabled:opacity-50" disabled={updatingSrv||!editSrvName.trim()} onClick={updateServer}><Save size={18}/></button></div>{isOwner&&<div className="border-t border-[#35373c] pt-3 mt-3"><p className="text-xs font-bold uppercase tracking-widest text-[#F84848] mb-2">Danger Zone</p><div className="flex items-center justify-between rounded-lg border border-[#F84848]/20 bg-[#F84848]/5 p-3"><div><div className="text-sm font-semibold text-white">Delete Space</div><div className="text-xs text-[#80848e]">Permanently removes this space.</div></div><button className="rounded-md bg-[#F84848] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#d03030] disabled:opacity-60" disabled={updatingSrv} onClick={()=>setDelSrvPending(true)}>Delete</button></div></div>}</Modal>}
      {activeModal==='set-status'&&<Modal onClose={()=>setActiveModal(null)} title="Set Status"><div className="grid gap-1.5">{[['Online','Online','#3ABF7E'],['Idle','Idle','#F39F00'],['Busy','Do Not Disturb','#F84848'],['Focus','Focus','#4799F0'],['Invisible','Invisible','#A5A5A5']].map(([val,lbl,col])=><button key={val} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${statusDraft.presence===val?'border-[#5865f2] bg-[#5865f2]/10':'border-[#35373c] bg-[#1e1f22] hover:border-[#5865f2]/30'}`} onClick={()=>setStatusDraft(p=>({...p,presence:val}))}><span className="w-3 h-3 rounded-full shrink-0" style={{background:col}}/><span className="text-sm text-[#f2f3f5]">{lbl}</span>{statusDraft.presence===val&&<Check size={14} className="ml-auto text-[#5865f2]"/>}</button>)}</div><input className={`${inp} mt-1`} maxLength={128} placeholder="Custom status…" value={statusDraft.text} onChange={e=>setStatusDraft(p=>({...p,text:e.target.value}))}/><button className="w-full rounded-md bg-[#5865f2] py-2 text-sm font-bold text-white hover:bg-[#4752c4] disabled:opacity-60" disabled={savingSt} onClick={saveStatus}>{savingSt?'Saving…':'Save Status'}</button></Modal>}
      {activeModal==='user-settings'&&<Modal onClose={()=>setActiveModal(null)} title="My Account" wide noPad><UserSettingsPanel user={users[auth.uid]} cdn={cfg.cdn} apiUrl={cfg.api} token={auth.token} onUpdate={u=>upsertUsers([u])} addToast={addToast} isLowSpec={isLowSpec} openStatus={()=>{setActiveModal(null);setTimeout(openStatusEditor,100);}} fetchProfile={fetchProfile}/></Modal>}
      {peekUser&&<Modal onClose={()=>setPeekUser(null)} title="Profile">
        <div className="overflow-hidden rounded-xl bg-[#1e1f22]">{(peekProfile?.bannerUrl||bannerUrl(peekUser,cfg.cdn))?<img alt="" className="h-32 w-full object-cover" src={peekProfile?.bannerUrl||bannerUrl(peekUser,cfg.cdn)}/>:<div className="h-20 bg-gradient-to-br from-[#3b3f6b] to-[#5865f2]"/>}<div className="flex items-center gap-3 p-3"><Avatar user={peekUser} cdn={cfg.cdn} size="lg" always/><div className="min-w-0"><div className="text-base font-bold text-white">{peekUser.display_name||peekUser.username}</div><div className="text-xs text-[#80848e]">@{peekUser.username}#{peekUser.discriminator||'0000'}</div>{users[peekUser._id]?.status?.text&&<div className="text-xs text-[#b5bac1] mt-0.5">{users[peekUser._id].status.text}</div>}</div>{peekUser._id!==auth.uid&&<div className="ml-auto flex gap-1.5"><button className="rounded-lg bg-[#5865f2] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#4752c4]" onClick={()=>{openDm(peekUser._id);setPeekUser(null);}}>Message</button>{friends.some(f=>f._id===peekUser._id)?<button className="rounded-lg bg-[#35373c] px-3 py-1.5 text-xs text-[#F84848] hover:bg-[#F84848] hover:text-white" onClick={()=>removeFriend(peekUser._id)}>Remove</button>:<button className="rounded-lg bg-[#35373c] px-3 py-1.5 text-xs text-[#3ABF7E] hover:bg-[#3ABF7E] hover:text-white" onClick={()=>sendFriendReq(peekUser.username)}><UserPlus size={13}/></button>}</div>}</div></div>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#1e1f22] p-3 text-xs text-[#b5bac1]"><div><span className="font-semibold text-[#f2f3f5] block mb-0.5">Joined platform</span>{dateLbl(joinedAt(peekUser))}</div><div><span className="font-semibold text-[#f2f3f5] block mb-0.5">Joined space</span>{selServer==='@me'?'—':dateLbl(joinedAt(peekMember))}</div></div>
        {(peekProfile?.content||peekBio)&&<div className="rounded-lg bg-[#1e1f22] p-3"><p className="text-[11px] font-bold uppercase tracking-widest text-[#80848e] mb-1">About me</p><p className="text-sm text-[#b5bac1] whitespace-pre-wrap">{peekProfile?.content||peekBio}</p></div>}
        {peekBadges.length>0&&<div className="rounded-lg bg-[#1e1f22] p-3"><p className="text-[11px] font-bold uppercase tracking-widest text-[#80848e] mb-1">Badges</p><div className="flex flex-wrap gap-1">{peekBadges.map(b=><span key={b} className="rounded-md bg-[#5865f2]/20 px-2 py-0.5 text-xs text-[#c4c9ff]">{b}</span>)}</div></div>}
        {peekRoles.length>0&&<div className="rounded-lg bg-[#1e1f22] p-3"><p className="text-[11px] font-bold uppercase tracking-widest text-[#80848e] mb-1">Roles</p><div className="flex flex-wrap gap-1">{peekRoles.map(r=><span key={r.id||r.name} className="rounded-md border-l-2 px-2 py-0.5 text-xs text-[#b5bac1]" style={{background:'#2b2d31',borderColor:r.colour||'#4c4f56'}}>{r.name}</span>)}</div></div>}
      </Modal>}

      {/* ── Server rail ── */}
      <aside className="flex w-[72px] flex-col items-center gap-2 overflow-y-auto bg-[#1e1f22] py-3 shrink-0">
        <div className={`srv-wrap ${selServer==='@me'?'srv-active':''}`}><span className="srv-pill"/><button className={`srv-icon ${selServer==='@me'?'bg-[#5865f2] text-white':'bg-[#313338] text-[#80848e] hover:text-white'}`} onClick={()=>selectServer('@me')} title="Direct Messages"><MessageSquare size={20}/></button></div>
        <div className="w-8 h-px bg-[#35373c] mx-auto shrink-0"/>
        {serverList.map(s=>{const ic=iconUrl(s,cfg.cdn);const active=selServer===s._id;const hasUnread=!active&&Object.values(channels).some(c=>c.server===s._id&&unread.has(c._id));return <div key={s._id} className={`srv-wrap ${active?'srv-active':''}`} title={s.name}><span className="srv-pill" style={{height:active?40:hasUnread?6:0}}/><button className={`srv-icon ${active?'bg-[#5865f2]':'bg-[#313338] text-[#80848e] hover:text-white'} text-white`} onClick={()=>selectServer(s._id)}>{ic?<img alt={s.name} className="h-full w-full object-cover" src={ic} onError={e=>{e.currentTarget.style.display='none';}}/>:<span className="text-sm font-bold select-none">{s.name.slice(0,2).toUpperCase()}</span>}</button></div>;})}
        <button className="srv-icon bg-[#313338] text-[#3ABF7E] hover:bg-[#3ABF7E] hover:text-white transition-colors mx-auto" onClick={()=>setActiveModal('create-server')} title="Add Server"><Plus size={20}/></button>
        <button className="srv-icon bg-[#313338] text-[#5865f2] hover:bg-[#5865f2] hover:text-white transition-colors mx-auto" onClick={()=>setActiveModal('join-server')} title="Join with Invite"><Link size={18}/></button>
      </aside>

      {/* ── Channel sidebar ── */}
      <aside className={`${showMobile?'flex':'hidden'} md:flex w-60 flex-col bg-[#2b2d31] shrink-0 z-30 md:z-auto absolute md:relative h-full`}>
        <div className="px-4 py-3 flex justify-between items-center shrink-0 shadow-md bg-[#2b2d31] border-b border-black/20"><div className="truncate text-sm font-bold text-[#f2f3f5]">{selServer==='@me'?'Direct Messages':selSrvObj?.name||'Space'}</div><div className="flex items-center gap-0.5">{isOwner&&selServer!=='@me'&&<><button onClick={()=>setActiveModal('create-invite')} className="p-1 rounded text-[#80848e] hover:text-[#b5bac1] hover:bg-[#35373c]"><Link size={14}/></button><button onClick={()=>{setEditSrvName(selSrvObj.name);setActiveModal('server-settings');}} className="p-1 rounded text-[#80848e] hover:text-[#b5bac1] hover:bg-[#35373c]"><Settings size={14}/></button></>}</div></div>
        <div className="px-2 pt-2 pb-1 shrink-0"><div className="flex items-center gap-1.5 rounded-md bg-[#1e1f22] px-2 py-1.5 border border-transparent focus-within:border-[#5865f2]/40"><Search size={12} className="text-[#80848e] shrink-0"/><input className="flex-1 bg-transparent text-xs text-[#f2f3f5] placeholder:text-[#80848e] focus:outline-none" placeholder={selServer==='@me'?'Find a DM…':'Find channel…'} value={chSearch} onChange={e=>setChSearch(e.target.value)}/>{chSearch&&<button onClick={()=>setChSearch('')}><X size={10} className="text-[#80848e] hover:text-white"/></button>}</div></div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {selServer==='@me'?<>
            <button className={`ch-item relative mb-0.5 w-full gap-2 px-2 py-1.5 text-sm ${selChannel==='friends'?'ch-active':'text-[#80848e]'}`} onClick={()=>{setSelChannel('friends');setShowMobile(false);}}><Users size={16} className="shrink-0"/><span>Friends</span>{incoming.length>0&&<span className="ml-auto text-xs bg-[#F84848] text-white rounded-full min-w-[16px] h-4 flex items-center justify-center font-bold px-1">{incoming.length}</span>}</button>
            {filtDMs.map(ch=>{const label=dmLabel(ch);const rid=ch.channel_type==='DirectMessage'?(ch.recipients||[]).find(id=>id!==auth.uid):null;const hasUnread=unread.has(ch._id);return <button key={ch._id} className={`ch-item relative mb-0.5 w-full gap-2 px-2 py-1.5 text-sm ${selChannel===ch._id?'ch-active':hasUnread?'ch-unread text-[#80848e]':'text-[#80848e]'}`} onClick={()=>selectChannel(ch._id)}>{rid?<div className="relative shrink-0"><Avatar user={users[rid]} cdn={cfg.cdn} size="sm"/><span className="absolute -bottom-px -right-px w-2.5 h-2.5 rounded-full border-2 border-[#2b2d31]" style={{background:pc(users[rid]?.status?.presence)}}/></div>:<span className="text-[#80848e] shrink-0">{chIcon(ch)}</span>}<span className="truncate flex-1 text-sm">{label}</span>{hasUnread&&<span className="w-2 h-2 rounded-full bg-[#f2f3f5] shrink-0"/>}</button>;})}
          </>:(
            filtCats.map((item,i)=>{
              if(item.type==='category'){const col=collapsedCats[item.id];return <button key={item.id} className="flex w-full items-center gap-1 px-2 pt-4 pb-1 text-left group" onClick={()=>setCollapsedCats(p=>({...p,[item.id]:!p[item.id]}))}>{col?<ChevronRight size={12} className="text-[#80848e] group-hover:text-[#b5bac1]"/>:<ChevronDown size={12} className="text-[#80848e] group-hover:text-[#b5bac1]"/>}<span className="text-[11px] font-bold uppercase tracking-widest text-[#80848e] group-hover:text-[#b5bac1] truncate">{item.title}</span></button>;}
              const ch=item.channel;const isVoice=ch.channel_type==='VoiceChannel';const hasUnread=unread.has(ch._id);
              return <button key={ch._id} className={`ch-item relative mb-px w-full gap-1.5 px-2 py-1.5 text-sm ${isVoice?'opacity-40 cursor-not-allowed text-[#80848e]':selChannel===ch._id?'ch-active':hasUnread?'ch-unread text-[#80848e]':'text-[#80848e]'}`} onClick={()=>!isVoice&&selectChannel(ch._id)} disabled={isVoice} title={ch.name}><span className="shrink-0 w-4 h-4 flex items-center justify-center text-[#80848e]">{chIcon(ch)}</span><span className="truncate flex-1 text-sm">{ch.name||'channel'}</span>{ch.nsfw&&<span className="text-[9px] font-bold text-[#F84848] bg-[#F84848]/10 px-1 rounded">NSFW</span>}</button>;
            })
          )}
        </div>
        <div className="h-[52px] bg-[#232428] border-t border-black/30 px-2 flex items-center gap-1 shrink-0">
          <button className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-[#35373c] flex-1" onClick={openStatusEditor} onMouseEnter={()=>setIsAccHov(true)} onMouseLeave={()=>setIsAccHov(false)}>
            <div className="relative shrink-0"><Avatar user={users[auth.uid]} cdn={cfg.cdn} size="sm" always={isAccHov}/><span className="absolute -bottom-px -right-px w-3 h-3 rounded-full border-2 border-[#232428]" style={{background:pc(users[auth.uid]?.status?.presence)}}/></div>
            <div className="min-w-0"><div className="truncate text-[13px] font-semibold text-[#f2f3f5] leading-none mb-0.5">{users[auth.uid]?.username||'…'}</div><div className="truncate text-[11px] text-[#80848e] leading-none">{users[auth.uid]?.status?.text||users[auth.uid]?.status?.presence||'Online'}</div></div>
          </button>
          <button className="p-1.5 rounded text-[#80848e] hover:text-[#f2f3f5] hover:bg-[#35373c]" onClick={()=>setActiveModal('user-settings')}><Settings size={16}/></button>
          <button className="p-1.5 rounded text-[#80848e] hover:text-[#F84848] hover:bg-[#35373c]" onClick={logout}><LogOut size={16}/></button>
        </div>
      </aside>
      {showMobile&&<div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={()=>setShowMobile(false)}/>}

      {/* ── Main area ── */}
      <main className="relative flex min-w-0 flex-1 flex-col bg-[#313338]">
        <header className="flex h-12 items-center justify-between border-b border-black/20 px-4 bg-[#313338] shadow-sm shrink-0 z-10">
          <div className="flex items-center gap-2 min-w-0"><button className="md:hidden text-[#80848e] hover:text-[#b5bac1] mr-1" onClick={()=>setShowMobile(p=>!p)}><Menu size={20}/></button><span className="text-[#80848e] shrink-0">{chIcon(channels[selChannel])}</span><span className="text-[15px] font-bold text-[#f2f3f5] truncate">{curChName}</span>{curChTopic&&<span className="hidden lg:block text-[13px] text-[#80848e] border-l border-[#35373c] pl-3 ml-1 truncate max-w-xs">{curChTopic}</span>}</div>
          <div className="flex items-center gap-1 shrink-0">{selChannel!=='friends'&&<><button className="p-1.5 rounded text-[#80848e] hover:text-[#f2f3f5] hover:bg-[#35373c]" onClick={()=>{fetchPins(selChannel);setActiveModal('pinned');}} title="Pinned"><Pin size={18}/></button>{isOwner&&selServer!=='@me'&&<button className="p-1.5 rounded text-[#80848e] hover:text-[#f2f3f5] hover:bg-[#35373c]" onClick={()=>setActiveModal('create-invite')} title="Create Invite"><Link size={18}/></button>}</>}<div className="ml-2"><StatusBadge status={status}/></div></div>
        </header>
        {voiceNotice&&<div className="mx-4 mt-2 flex items-center gap-2 rounded-lg bg-[#F39F00]/10 border border-[#F39F00]/20 px-3 py-2 text-[13px] text-[#F39F00] shrink-0"><Info size={14} className="shrink-0"/>{voiceNotice}</div>}

        <section className="flex-1 overflow-y-auto py-2 min-h-0" ref={scrollRef}>
          {isLoadingOlder&&<div className="flex items-center justify-center gap-2 py-3 text-xs text-[#80848e]"><Loader className="animate-spin" size={12}/>Loading older messages…</div>}

          {selChannel==='friends'?(
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-1 border-b border-[#1e1f22] px-4 h-12 bg-[#313338] shrink-0"><Users size={18} className="text-[#80848e]"/><span className="text-[15px] font-bold text-[#f2f3f5] mr-3">Friends</span>{[['online','Online'],['all','All'],['pending',`Pending${incoming.length?` · ${incoming.length}`:''}`,],['blocked','Blocked']].map(([id,lbl])=><button key={id} className={`px-3 py-1 rounded text-[13px] font-medium transition-colors ${friendTab===id?'bg-[#404249] text-[#f2f3f5]':'text-[#80848e] hover:bg-[#35373c] hover:text-[#b5bac1]'}`} onClick={()=>setFriendTab(id)}>{lbl}</button>)}<div className="ml-auto"><button className="flex items-center gap-1.5 rounded-md bg-[#3ABF7E] px-3 py-1.5 text-[13px] font-bold text-white hover:bg-[#2da066]" onClick={()=>setShowAddFriend(p=>!p)}><UserPlus size={14}/> Add Friend</button></div></div>
              {showAddFriend&&<div className="px-4 py-3 border-b border-[#1e1f22] bg-[#2b2d31] shrink-0"><p className="text-[11px] font-bold uppercase tracking-widest text-[#80848e] mb-2">Add a Friend</p><div className="flex gap-2"><input className="flex-1 rounded-lg bg-[#1e1f22] border border-[#35373c] focus:border-[#5865f2] px-3 py-2 text-[15px] text-[#f2f3f5] placeholder:text-[#4f5660] focus:outline-none" placeholder="Enter a username" value={addFriendInput} onChange={e=>setAddFriendInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAddFriend()} autoFocus/><button className="rounded-lg bg-[#5865f2] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#4752c4] disabled:opacity-60" disabled={addFriendLoading||!addFriendInput.trim()} onClick={handleAddFriend}>{addFriendLoading?'Sending…':'Send'}</button></div></div>}
              <div className="flex-1 overflow-y-auto px-4 pt-3">
                <div className="flex items-center gap-2 rounded-lg bg-[#1e1f22] px-3 py-2 mb-3 border border-transparent focus-within:border-[#5865f2]/40"><Search size={13} className="text-[#80848e] shrink-0"/><input className="flex-1 bg-transparent text-[14px] text-[#f2f3f5] placeholder:text-[#80848e] focus:outline-none" placeholder="Search" value={friendSearch} onChange={e=>setFriendSearch(e.target.value)}/></div>
                {(()=>{const fq=friendSearch.toLowerCase();const fn=u=>!fq||(u.username||'').toLowerCase().includes(fq)||(u.display_name||'').toLowerCase().includes(fq);
                  if(friendTab==='online'){const list=friends.filter(f=>f.status?.presence&&f.status.presence!=='Invisible'&&fn(f));return list.length?list.map(f=><FriendRow key={f._id} f={f} cdn={cfg.cdn} channels={channels} auth={auth} unreadChannels={unread} openDm={openDm} removeFriend={removeFriend} setPeekUser={setPeekUser} getPC={pc}/>):<EmptyF msg="No online friends right now."/>;}
                  if(friendTab==='all'){const list=friends.filter(fn);return list.length?list.map(f=><FriendRow key={f._id} f={f} cdn={cfg.cdn} channels={channels} auth={auth} unreadChannels={unread} openDm={openDm} removeFriend={removeFriend} setPeekUser={setPeekUser} getPC={pc}/>):<EmptyF msg="No friends yet. Add someone!"  />;}
                  if(friendTab==='pending'){const inc=incoming.filter(fn);const out=outgoing.filter(fn);return <div className="space-y-1">{inc.length>0&&<p className="text-[11px] font-bold uppercase tracking-widest text-[#80848e] mb-2">Incoming — {inc.length}</p>}{inc.map(f=><div key={f._id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[#35373c]"><Avatar user={f} cdn={cfg.cdn}/><div className="min-w-0 flex-1"><div className="text-[14px] font-semibold text-[#f2f3f5]">{f.display_name||f.username}</div><div className="text-[12px] text-[#80848e]">Incoming Friend Request</div></div><button className="p-2 rounded-full bg-[#1e1f22] hover:bg-[#3ABF7E] text-[#80848e] hover:text-white" onClick={()=>acceptFriend(f._id)}><Check size={16}/></button><button className="p-2 rounded-full bg-[#1e1f22] hover:bg-[#F84848] text-[#80848e] hover:text-white" onClick={()=>declineFriend(f._id)}><X size={16}/></button></div>)}{out.length>0&&<p className="text-[11px] font-bold uppercase tracking-widest text-[#80848e] mt-4 mb-2">Outgoing — {out.length}</p>}{out.map(f=><div key={f._id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[#35373c]"><Avatar user={f} cdn={cfg.cdn}/><div className="min-w-0 flex-1"><div className="text-[14px] font-semibold text-[#f2f3f5]">{f.display_name||f.username}</div><div className="text-[12px] text-[#80848e]">Outgoing Friend Request</div></div><button className="p-2 rounded-full bg-[#1e1f22] hover:bg-[#F84848] text-[#80848e] hover:text-white" onClick={()=>declineFriend(f._id)}><X size={16}/></button></div>)}{inc.length===0&&out.length===0&&<EmptyF msg="No pending requests."/>}</div>;}
                  if(friendTab==='blocked'){const list=blocked.filter(fn);return list.length?list.map(f=><div key={f._id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[#35373c]"><Avatar user={f} cdn={cfg.cdn}/><div className="min-w-0 flex-1"><div className="text-[14px] font-semibold text-[#f2f3f5]">{f.display_name||f.username}</div><div className="text-[12px] text-[#80848e]">Blocked</div></div><button className="px-3 py-1.5 rounded-md bg-[#35373c] text-[13px] text-[#b5bac1] hover:bg-[#F84848] hover:text-white" onClick={()=>unblockUser(f._id)}>Unblock</button></div>):<EmptyF msg="No blocked users."  />;}
                })()}
              </div>
            </div>
          ):curMsgs.length===0?(
            <div className="flex flex-col items-center justify-center h-full text-center p-8"><div className="mb-4 p-4 rounded-full bg-[#2b2d31]"><Hash size={32} className="text-[#80848e]"/></div><p className="text-2xl font-bold text-[#f2f3f5] mb-1">Welcome to #{curChName}!</p><p className="text-[#80848e] text-sm">This is the beginning of #{curChName}.</p></div>
          ):(
            curMsgs.map((msg,idx)=>{const prev=idx>0?curMsgs[idx-1]:null;const newDay=idx===0||(prev&&dayK(prev)!==dayK(msg));return <React.Fragment key={msg._id}>{newDay&&<DateSep msg={msg}/>}<MemoMsg message={msg} users={users} channels={channels} me={auth.uid} onUser={(u,id)=>setPeekUser({...u,_id:id||u._id})} cdn={cfg.cdn} onReact={toggleReaction} onReply={setReplyingTo} replyTarget={replyingTo?._id} jumpTo={jumpTo} regRef={regRef} ceById={ceById} reactOpts={reactOpts} openLink={openLink} onEdit={editMessage} onDelete={requestDelete} replyMap={replyMap} grouped={!newDay&&isGrouped(msg,prev)}/></React.Fragment>;})
          )}
          <div ref={botRef}/>
        </section>

        <TypingIndicator userIds={curTypingIds} users={users}/>
        {showGoLatest&&<div className="pointer-events-none absolute bottom-28 left-1/2 z-20 -translate-x-1/2"><button className="pointer-events-auto rounded-full bg-[#5865f2] px-3 py-1.5 text-xs font-bold text-white shadow-lg hover:bg-[#4752c4]" onClick={goLatest}>↓ New messages</button></div>}

        {/* Composer */}
        <footer className="px-4 pb-4 pt-2 shrink-0">
          {activeReply&&<div className="mb-2 flex items-center gap-2 rounded-t-lg bg-[#383a40] px-3 py-1.5 text-xs text-[#80848e] border border-b-0 border-[#1e1f22]"><Reply size={11} className="shrink-0"/><span className="truncate flex-1">Replying to <strong className="text-[#f2f3f5]">{users[typeof activeReply.author==='string'?activeReply.author:activeReply.author?._id]?.username||'…'}</strong>: {activeReply.content||'[attachment]'}</span><button className="shrink-0 hover:text-[#f2f3f5]" onClick={()=>setReplyingTo(null)}><X size={12}/></button></div>}
          {pendingFiles.length>0&&<div className="mb-2 flex flex-wrap gap-2">{pendingFiles.map((f,i)=>{const ii=isImg(f.name,f.type);const th=ii?URL.createObjectURL(f):null;return <div key={`${f.name}${i}`} className="relative group rounded-lg overflow-hidden border border-[#35373c] bg-[#2b2d31]">{th?<img src={th} alt={f.name} className="h-16 w-24 object-cover" onLoad={()=>URL.revokeObjectURL(th)}/>:<div className="flex items-center gap-1.5 px-3 py-3 text-xs text-[#b5bac1]"><span>📎</span><span className="max-w-[80px] truncate">{f.name}</span></div>}<button className="absolute inset-0 grid place-items-center bg-black/60 opacity-0 group-hover:opacity-100" onClick={()=>setPendingFiles(p=>p.filter((_,x)=>x!==i))}><X size={16} className="text-white"/></button></div>;})} </div>}
          <div className="relative">
            <div className="flex items-end gap-0.5 rounded-lg bg-[#383a40] px-2 py-2" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=Array.from(e.dataTransfer?.files||[]);if(f.length)setPendingFiles(p=>[...p,...f]);}}>
              <button className="p-2 shrink-0 text-[#80848e] hover:text-[#b5bac1] disabled:opacity-30" disabled={selChannel==='friends'||isUploading} onClick={()=>fileInputRef.current?.click()}><Paperclip size={20}/></button>
              <input className="hidden" multiple onChange={onFilePick} ref={fileInputRef} type="file"/>
              <div className="relative shrink-0">
                <button className="p-2 text-[#80848e] hover:text-[#b5bac1] disabled:opacity-30 text-xl leading-none" disabled={selChannel==='friends'} onClick={()=>setShowPicker(p=>!p)}>😊</button>
                {showPicker&&selChannel!=='friends'&&<div ref={pickerRef} className="absolute bottom-full mb-2 left-0 z-20"><EmojiGifPicker ceById={ceById} allCE={allCE} cdn={cfg.cdn} onEmoji={addEmoji} onCE={addCE} onGif={sendGif} token={auth.token}/></div>}
              </div>
              <textarea ref={composerRef} className={`composer-ta flex-1 px-2 py-1.5 ${selChannel==='friends'?'opacity-50 cursor-not-allowed':''}`} rows={1} disabled={selChannel==='friends'} value={inputText}
                onPaste={onPaste}
                onChange={e=>{setInputText(e.target.value);sendTypingBegin();clearTimeout(sendTypTim.current);sendTypTim.current=setTimeout(sendTypingEnd,4000);}}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();clearTimeout(sendTypTim.current);sendMessage();}if(e.key==='Escape'){setReplyingTo(null);if(!inputText)sendTypingEnd();}}}
                placeholder={selChannel==='friends'?'Select a channel to chat':`Message #${curChName}`}/>
              <button className="p-2 shrink-0 text-[#80848e] hover:text-[#b5bac1] disabled:opacity-30" disabled={isUploading||(!inputText.trim()&&!pendingFiles.length)||selChannel==='friends'} onClick={()=>{clearTimeout(sendTypTim.current);sendMessage();}}>
                {isUploading?<Loader className="animate-spin text-[#5865f2]" size={20}/>:<Send size={20}/>}
              </button>
            </div>
            <p className="mt-1 px-1 text-[11px] text-[#4f5660]"><strong className="text-[#80848e]">Enter</strong> to send · <strong className="text-[#80848e]">Shift+Enter</strong> for newline</p>
          </div>
        </footer>
      </main>

      {/* ── Members sidebar ── */}
      <aside className="hidden w-60 flex-col bg-[#2b2d31] lg:flex shrink-0">
        <div className="px-3 pt-3 pb-0 shrink-0">{isMembLoad?<div className="flex items-center gap-2 text-[11px] text-[#80848e] mb-2"><Loader className="animate-spin" size={10}/>Loading members…</div>:selServer!=='@me'&&allMembers.length>0&&<div className="flex items-center gap-1.5 text-[11px] text-[#80848e] mb-2"><span className="w-2 h-2 rounded-full bg-[#3ABF7E] shrink-0"/>{allMembers.filter(m=>{const u=usersRef.current[m._id?.user];return u?.status?.presence&&u.status.presence!=='Invisible';}).length} online</div>}</div>
        <div className="flex-1 min-h-0">{selServer==='@me'?<div className="p-4 text-center"><span className="text-4xl block mb-2">🦦</span><p className="text-[12px] text-[#80848e]">Member list in spaces.</p></div>:memberItems.length===0&&!isMembLoad?<p className="p-4 text-[12px] text-[#80848e]">No members loaded.</p>:<VirtualList items={memberItems} className="h-full w-full px-2 py-1" renderItem={renderMemberItem}/>}</div>
      </aside>

      {/* ── Toasts ── */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none" aria-live="polite">
        {toasts.map(t=><Toast key={t.id} t={t} onDismiss={dismissToast}/>)}
      </div>
    </div>
  );
}

export default function App(){return <AppBoundary><AppShell/></AppBoundary>;}
