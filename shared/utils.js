export function nowISO(){ return new Date().toISOString(); }

export async function sha256Hex(text){
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  const bytes = new Uint8Array(digest);
  return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("");
}
export function b64ToBytes(b64){
  const bin = atob(b64); const out = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function bytesToB64(bytes){
  let s=""; bytes.forEach(b=>s+=String.fromCharCode(b)); return btoa(s);
}
export async function derivePasswordHash(password, saltB64){
  const salt = saltB64 ? b64ToBytes(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name:"PBKDF2", salt, iterations:150000, hash:"SHA-256" }, key, 256);
  const bytes = new Uint8Array(bits);
  const hashHex = Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("");
  return { saltB64: bytesToB64(salt), hashHex };
}

export async function storageGet(keys){ return await chrome.storage.local.get(keys); }
export async function storageSet(obj){ return await chrome.storage.local.set(obj); }

export function normalizeDomain(input){
  let v = (input||"").trim().toLowerCase();
  v = v.replace(/^https?:\/\//, "");
  v = v.replace(/\/.*$/, "");
  v = v.replace(/^\*\./, "");
  return v;
}
export function isLikelyDomain(v){ return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v); }
export function normalizeKeyword(input){ return (input||"").trim().toLowerCase(); }
export function isKeywordAllowed(kw){ return kw.length >= 3; }

export function safeUrlForDisplay(url){
  try{ 
    const u = new URL(url);
    // Ofuscar o pathname para não mostrar URL completa
    // Ex: /video47789917/durma_na_sua_casa → /vid***/dur***asa
    const parts = u.pathname.split('/').filter(Boolean);
    const obfuscated = parts.map(part => {
      if(part.length <= 6) return '***';
      const first3 = part.slice(0, 3);
      const last3 = part.slice(-3);
      return `${first3}***${last3}`;
    }).join('/');
    return u.hostname + (obfuscated ? '/' + obfuscated : '');
  }catch(e){ 
    // Fallback para strings que não são URLs válidas
    const s = String(url||"");
    if(s.length <= 10) return '***';
    return s.slice(0,3) + '***' + s.slice(-3);
  }
}
