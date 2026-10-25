/* =====================================================================
 * FitLab — Autenticação Social (Google / Apple) e Sincronização em Nuvem
 *
 * Suporta dois modos de sincronização multi-dispositivo:
 * 1) Conta Social (Google / Apple via Firebase Auth + Cloud Firestore):
 *    Autenticação OAuth 2.0 (Identity Toolkit REST) e banco em nuvem
 *    isolado por usuário (/users/{uid}/{colecao}/{docId}) protegido por
 *    Security Rules (firestore.rules). Tokens ficam cifrados no cofre
 *    IndexedDB (CryptoKey AES-GCM não-extraível).
 * 2) GitHub Gist Criptografado (E2EE):
 *    Arquivo num Gist secreto da conta GitHub do usuário, criptografado
 *    no aparelho (AES-GCM 256, chave derivada da senha com PBKDF2-SHA256,
 *    310.000 iterações).
 *
 * Mescla em 3 vias por registro (base = último estado sincronizado neste
 * aparelho): novidades dos dois lados somam, edição mais recente vence,
 * exclusões viram "lápides" (deletedAt) para não ressuscitar em outro
 * aparelho. Identificação única por contaUid impede colisão de perfis
 * homônimos entre contas distintas.
 * ===================================================================== */
(function () {
  'use strict';
  const A = window.App;
  const K = {
    on: 'fitlab.sync.ativo',
    modo: 'fitlab.sync.modo', // 'conta' | 'gist'
    token: 'fitlab.sync.token',
    senha: 'fitlab.sync.senha',
    gist: 'fitlab.sync.gist',
    base: 'fitlab.sync.base',
    disp: 'fitlab.sync.dispositivo',
    ult: 'fitlab.sync.ultimo',
    fbCfg: 'fitlab.sync.fbConfig'
  };
  const ARQ = 'fitlab-sync.json', DESC = 'FitLab – sincronização (criptografado)';
  const COLECOES = ['perfis', 'avaliacoes', 'medidas', 'alimentosCustom', 'exerciciosCustom', 'dietas', 'diario', 'programas', 'ciclos', 'sessoes', 'aerobicos', 'suplementos', 'tomadas'];
  const CONFIG_LOCAL = ['tema', '_mod', 'updatedAt'];
  const ITER = 310000;
  const EXPIRA_LAPIDE = 90 * 86400 * 1000; // 90 dias

  const ls = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, set: (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* armazenamento bloqueado */ } } };
  const ss = { get: (k) => { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }, set: (k, v) => { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch (e) { /* armazenamento bloqueado */ } } };
  const esc = A.h;

  /* ---------- utilidades ---------- */
  const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const CAMPOS_META = new Set(['_mod', '_unif', 'updatedAt', 'deletedAt', 'schemaVersion']);
  function estavel(v) { // JSON com chaves ordenadas, sem campos de controle
    if (Array.isArray(v)) return '[' + v.map(estavel).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).filter((k) => !CAMPOS_META.has(k)).sort().map((k) => JSON.stringify(k) + ':' + estavel(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  let cacheAtivo = false;
  let hashCache = new WeakMap();
  function hash(v) {
    if (cacheAtivo && v && typeof v === 'object' && !Array.isArray(v)) {
      const mod = Number(v.updatedAt || v._mod) || 0;
      const hit = hashCache.get(v);
      if (hit && hit.mod === mod) return hit.h;
      const s = estavel(v);
      let h1 = 0x811c9dc5, h2 = 0x01000193;
      for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
      const out = (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + s.length.toString(36);
      hashCache.set(v, { mod, h: out });
      return out;
    }
    const s = estavel(v);
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
    return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + s.length.toString(36);
  }
  const agora = () => Date.now();
  const modDe = (r) => Number((r && (r.updatedAt || r._mod)) || 0);
  const carimbarMod = (r, t, uidConta) => {
    if (r && typeof r === 'object') {
      r.updatedAt = t;
      r._mod = t;
      r.deletedAt = null;
      r.schemaVersion = A.SCHEMA_VERSION || 2;
      const u = uidConta || (contaCache && contaCache.uid) || (A.S && A.S.config && A.S.config.contaUid) || null;
      if (u && !r.contaUid) r.contaUid = u;
    }
    return r;
  };
  const dispositivo = () => { let d = ls.get(K.disp); if (!d) { const ua = navigator.userAgent; d = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? 'Tablet' : /Mobi|iPhone|Android/i.test(ua) ? 'Celular' : 'Computador'; ls.set(K.disp, d); } return d; };
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

  /* ---------- criptografia e cofre local (IndexedDB CryptoKey não-extraível + sessionStorage) ---------- */
  let chaveCache = null; // { salt, senha, key }
  let credCache = null;  // { token, senha, salt, key }
  let contaCache = null; // { uid, email, nome, provedor, idToken, refreshToken, expiraEm }

  const modoAtual = () => ls.get(K.modo) || 'conta';
  const contaAtiva = () => (contaCache && contaCache.uid ? contaCache : null);
  const ativo = () => !!(ls.get(K.on) || (contaCache && contaCache.uid) || (credCache && credCache.token) || ss.get(K.token));

  function abrirCofre() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      try {
        const req = indexedDB.open('fitlab.keystore', 1);
        req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains('auth')) db.createObjectStore('auth'); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }
  async function lerItemCofre(chaveCofre) {
    const db = await abrirCofre(); if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('auth', 'readonly');
        const r = tx.objectStore('auth').get(chaveCofre);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }
  async function gravarItemCofre(chaveCofre, val) {
    const db = await abrirCofre(); if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('auth', 'readwrite');
        if (val) tx.objectStore('auth').put(val, chaveCofre);
        else tx.objectStore('auth').delete(chaveCofre);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  }
  const lerCofre = () => lerItemCofre('cred');
  const gravarCofre = (val) => gravarItemCofre('cred', val);

  /* Cofre para sessão OAuth (Firebase Auth) com CryptoKey AES-GCM não-extraível */
  async function salvarContaCofre(conta) {
    if (!conta || !conta.uid) {
      contaCache = null;
      await gravarItemCofre('conta', null);
      return null;
    }
    contaCache = Object.assign({}, conta);
    if (A.S && A.S.config) A.S.config.contaUid = conta.uid;
    ls.set(K.modo, 'conta');
    ls.set(K.on, '1');
    try {
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const payload = JSON.stringify(contaCache);
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(payload));
      await gravarItemCofre('conta', { key, iv: b64(iv), ct: b64(ct) });
    } catch (e) { /* ambiente sem WebCrypto completo mantém apenas em memória */ }
    return contaCache;
  }
  async function carregarContaCofre() {
    if (contaCache && contaCache.uid) return contaCache;
    const rec = await lerItemCofre('conta');
    if (rec && rec.key && rec.iv && rec.ct) {
      try {
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, rec.key, unb64(rec.ct));
        const parsed = JSON.parse(new TextDecoder().decode(pt));
        if (parsed && parsed.uid) {
          contaCache = parsed;
          if (A.S && A.S.config) A.S.config.contaUid = parsed.uid;
          ls.set(K.on, '1');
          return contaCache;
        }
      } catch (e) { /* cofre inválido */ }
    }
    return null;
  }

  async function chave(senha, saltB64) {
    if (chaveCache && chaveCache.salt === saltB64 && chaveCache.senha === senha && senha) return chaveCache.key;
    if (credCache && credCache.key && credCache.salt === saltB64 && (!senha || !credCache.senha || credCache.senha === senha)) return credCache.key;
    if (!senha) { const err = new Error('Digite a senha na tela de Sincronização para desbloquear neste aparelho.'); err.senha = true; throw err; }
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(saltB64), iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    chaveCache = { salt: saltB64, senha, key };
    return key;
  }

  async function salvarCredenciais(token, senha, saltB64) {
    const cur = await carregarCredenciais();
    const tok = token || (cur && cur.token) || ss.get(K.token);
    const sen = senha || (cur && cur.senha) || ss.get(K.senha);
    const salt = saltB64 || (cur && cur.salt) || b64(crypto.getRandomValues(new Uint8Array(16)));
    if (tok) ss.set(K.token, tok);
    if (sen) ss.set(K.senha, sen);
    ls.set(K.token, ''); ls.set(K.senha, '');
    if (!tok) return null;
    let key = (cur && cur.key && cur.salt === salt && !senha) ? cur.key : null;
    if (!key && sen) key = await chave(sen, salt);
    if (key) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(tok));
      await gravarCofre({ key, salt, tokIv: b64(iv), tokCt: b64(ct) });
      credCache = { token: tok, senha: sen || '', salt, key };
      ls.set(K.on, '1');
    } else {
      credCache = { token: tok, senha: sen || '', salt, key: null };
      if (sen) ls.set(K.on, '1');
    }
    return credCache;
  }

  async function carregarCredenciais() {
    await carregarContaCofre();
    const legTok = ls.get(K.token), legSen = ls.get(K.senha);
    if (legTok || legSen) {
      ls.set(K.token, ''); ls.set(K.senha, '');
      if (legTok) ss.set(K.token, legTok);
      if (legSen) ss.set(K.senha, legSen);
      if (legTok && legSen) return salvarCredenciais(legTok, legSen);
    }
    if (credCache && credCache.token && (credCache.key || credCache.senha)) return credCache;
    const rec = await lerCofre();
    if (rec && rec.key && rec.tokCt && rec.tokIv) {
      try {
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.tokIv) }, rec.key, unb64(rec.tokCt));
        const tok = new TextDecoder().decode(pt);
        credCache = { token: tok, senha: ss.get(K.senha) || '', salt: rec.salt, key: rec.key };
        ls.set(K.on, '1');
        return credCache;
      } catch (e) { /* cofre inválido */ }
    }
    const sTok = ss.get(K.token), sSen = ss.get(K.senha);
    if (sTok) {
      credCache = { token: sTok, senha: sSen, salt: '', key: null };
      return credCache;
    }
    return null;
  }

  async function cifrar(obj, senha, saltB64) {
    saltB64 = saltB64 || (credCache && credCache.salt) || b64(crypto.getRandomValues(new Uint8Array(16)));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const k = await chave(senha, saltB64);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(obj)));
    if (credCache && credCache.token && (credCache.salt !== saltB64 || !credCache.key)) {
      credCache.salt = saltB64; credCache.key = k;
      await salvarCredenciais(credCache.token, senha || credCache.senha, saltB64);
    }
    return JSON.stringify({ app: 'fitlab', v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: saltB64, iv: b64(iv), dados: b64(ct) });
  }
  async function decifrar(texto, senha) {
    let env; try { env = JSON.parse(texto); } catch (e) { throw new Error('Arquivo de sincronização corrompido.'); }
    if (env.app !== 'fitlab' || !env.dados) throw new Error('O gist encontrado não é do FitLab.');
    try {
      const k = await chave(senha, env.salt);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, k, unb64(env.dados));
      if (credCache && credCache.token && (credCache.salt !== env.salt || !credCache.key)) {
        credCache.salt = env.salt; credCache.key = k;
        await salvarCredenciais(credCache.token, senha || credCache.senha, env.salt);
      }
      return { dados: JSON.parse(new TextDecoder().decode(pt)), salt: env.salt };
    } catch (e) { chaveCache = null; const err = new Error(e.senha ? e.message : 'Senha de sincronização incorreta para os dados salvos no GitHub.'); err.senha = true; throw err; }
  }

  /* ---------- Configuração Firebase Auth + Cloud Firestore ---------- */
  function lerFbConfig() {
    if (window.FIT_FIREBASE_CONFIG && window.FIT_FIREBASE_CONFIG.apiKey && window.FIT_FIREBASE_CONFIG.projectId) {
      return window.FIT_FIREBASE_CONFIG;
    }
    try {
      const c = JSON.parse(ls.get(K.fbCfg) || 'null');
      if (c && c.apiKey && c.projectId) return c;
    } catch (e) { /* */ }
    return { apiKey: '', projectId: '', authDomain: '' };
  }
  function extrairFbConfig(entrada, campos) {
    const out = Object.assign({ apiKey: '', projectId: '', authDomain: '' }, campos || {});
    if (entrada && typeof entrada === 'string') {
      const mKey = entrada.match(/apiKey\s*[:=]\s*['"]([^'"]+)['"]/);
      const mProj = entrada.match(/projectId\s*[:=]\s*['"]([^'"]+)['"]/);
      const mDom = entrada.match(/authDomain\s*[:=]\s*['"]([^'"]+)['"]/);
      if (mKey) out.apiKey = mKey[1].trim();
      if (mProj) out.projectId = mProj[1].trim();
      if (mDom) out.authDomain = mDom[1].trim();
    }
    if (out.projectId && !out.authDomain) out.authDomain = `${out.projectId}.firebaseapp.com`;
    return out;
  }
  function salvarFbConfig(cfg) {
    const limpo = {
      apiKey: String((cfg && cfg.apiKey) || '').trim(),
      projectId: String((cfg && cfg.projectId) || '').trim(),
      authDomain: String((cfg && cfg.authDomain) || '').trim()
    };
    if (limpo.projectId && !limpo.authDomain) limpo.authDomain = `${limpo.projectId}.firebaseapp.com`;
    ls.set(K.fbCfg, limpo.apiKey && limpo.projectId ? JSON.stringify(limpo) : '');
    return limpo;
  }

  function obterFirebaseAuth() {
    if (typeof window === 'undefined' || !window.firebase || !window.firebase.auth) return null;
    const cfg = lerFbConfig();
    if (!cfg.apiKey || !cfg.projectId) return null;
    try {
      if (!window.firebase.apps || !window.firebase.apps.length) {
        window.firebase.initializeApp(cfg);
      }
      return window.firebase.auth();
    } catch (e) {
      return null;
    }
  }

  async function vincularUsuarioFirebase(u) {
    if (!u || !u.uid) return null;
    const idToken = await u.getIdToken();
    const conta = {
      uid: u.uid,
      email: u.email || '',
      nome: u.displayName || (u.email ? u.email.split('@')[0] : 'Usuário'),
      foto: u.photoURL || '',
      provedor: 'google.com',
      idToken,
      refreshToken: u.refreshToken || '',
      expiraEm: Date.now() + 3500 * 1000
    };
    await salvarContaCofre(conta);
    vincularContaUid(A.S, conta.uid);
    return conta;
  }

  async function obterIdTokenValido() {
    const auth = obterFirebaseAuth();
    if (auth && auth.currentUser) {
      try {
        const tok = await auth.currentUser.getIdToken();
        if (contaCache) {
          contaCache.idToken = tok;
          contaCache.expiraEm = Date.now() + 3500 * 1000;
        } else {
          await vincularUsuarioFirebase(auth.currentUser);
        }
        return tok;
      } catch (e) { /* fallback para cofre */ }
    }
    const conta = await carregarContaCofre();
    if (!conta || !conta.uid) throw new Error('Sessão desconectada. Faça login com a sua conta do Google.');
    if (conta.idToken && conta.expiraEm && Date.now() < conta.expiraEm - 90000) return conta.idToken;
    if (!conta.refreshToken) return conta.idToken;
    const cfg = lerFbConfig();
    if (!cfg.apiKey) throw new Error('Configuração do Firebase ausente.');
    let r;
    try {
      r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(cfg.apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(conta.refreshToken)}`
      });
    } catch (e) { throw new Error('Sem conexão para validar sessão.'); }
    if (!r.ok) {
      if (r.status === 400 || r.status === 401 || r.status === 403) {
        throw new Error('Sessão expirada. Entre novamente com a sua conta do Google.');
      }
      throw new Error(`Erro ao renovar token (${r.status}).`);
    }
    const j = await r.json();
    conta.idToken = j.id_token;
    conta.refreshToken = j.refresh_token || conta.refreshToken;
    conta.uid = j.user_id || conta.uid;
    conta.expiraEm = Date.now() + (Number(j.expires_in) || 3600) * 1000;
    await salvarContaCofre(conta);
    return conta.idToken;
  }

  async function autenticarComIdp({ providerId, idToken, accessToken, code, postBody, requestUri }) {
    const cfg = lerFbConfig();
    if (!cfg.apiKey || !cfg.projectId) throw new Error('Configuração do Firebase ausente.');
    const reqUri = requestUri || (typeof location !== 'undefined' && /^https?:$/.test(location.protocol) ? location.origin + location.pathname : `https://${cfg.authDomain}`);
    let pb = postBody || '';
    if (!pb) {
      const parts = [];
      if (idToken) parts.push(`id_token=${encodeURIComponent(idToken)}`);
      if (accessToken) parts.push(`access_token=${encodeURIComponent(accessToken)}`);
      if (code) parts.push(`code=${encodeURIComponent(code)}`);
      parts.push(`providerId=${encodeURIComponent(providerId)}`);
      pb = parts.join('&');
    }
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(cfg.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postBody: pb, requestUri: reqUri, returnIdpCredential: true, returnSecureToken: true })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.localId) {
      const msg = (j.error && j.error.message) || `Falha na autenticação (${r.status})`;
      throw new Error('Não foi possível autenticar: ' + msg);
    }
    const conta = {
      uid: j.localId,
      email: j.email || '',
      nome: j.displayName || (j.email ? j.email.split('@')[0] : 'Usuário'),
      provedor: providerId,
      idToken: j.idToken,
      refreshToken: j.refreshToken,
      expiraEm: Date.now() + (Number(j.expiresIn) || 3600) * 1000
    };
    await salvarContaCofre(conta);
    vincularContaUid(A.S, conta.uid);
    return conta;
  }

  async function iniciarLoginSocial(providerId) {
    providerId = providerId || 'google.com';
    const auth = obterFirebaseAuth();
    if (auth) {
      const provider = new window.firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        const cred = await auth.signInWithPopup(provider);
        if (cred && cred.user) return await vincularUsuarioFirebase(cred.user);
        return null;
      } catch (e) {
        const code = (e && e.code) || '';
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
        if (code === 'auth/popup-blocked') {
          await auth.signInWithRedirect(provider);
          return null;
        }
        if (code === 'auth/unauthorized-domain') {
          const dom = (typeof location !== 'undefined' && location.hostname) || 'atual';
          throw new Error(`Domínio "${dom}" ainda não autorizado no Firebase. Adicione "${dom}" em Firebase Console → Authentication → Settings → Domínios autorizados.`);
        }
        if (code === 'auth/operation-not-supported-in-this-environment') {
          throw new Error('Para fazer login com o Google, abra o FitLab via servidor (http://localhost) ou link HTTPS publicado, e não via arquivo local (file://).');
        }
        throw new Error('Não foi possível entrar com o Google: ' + ((e && e.message) || code));
      }
    }
    throw new Error('SDK de autenticação do Google não carregado. Verifique sua conexão com a internet.');
  }

  /* ---------- Conversão Cloud Firestore REST Value <-> JS ---------- */
  function toFsValue(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return { nullValue: null };
      if (Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER) return { integerValue: String(v) };
      return { doubleValue: v };
    }
    if (typeof v === 'string') return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
    if (typeof v === 'object') return { mapValue: { fields: toFsFields(v) } };
    return { stringValue: String(v) };
  }
  function toFsFields(obj) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    Object.keys(obj).forEach((k) => {
      if (obj[k] !== undefined) out[k] = toFsValue(obj[k]);
    });
    return out;
  }
  function fromFsValue(val) {
    if (!val || typeof val !== 'object') return null;
    if ('nullValue' in val) return null;
    if ('booleanValue' in val) return Boolean(val.booleanValue);
    if ('integerValue' in val) return Number(val.integerValue);
    if ('doubleValue' in val) return Number(val.doubleValue);
    if ('stringValue' in val) return String(val.stringValue);
    if ('timestampValue' in val) return new Date(val.timestampValue).getTime();
    if ('arrayValue' in val) return ((val.arrayValue && val.arrayValue.values) || []).map(fromFsValue);
    if ('mapValue' in val) return fromFsFields((val.mapValue && val.mapValue.fields) || {});
    return null;
  }
  function fromFsFields(fields) {
    const out = {};
    if (!fields || typeof fields !== 'object') return out;
    Object.keys(fields).forEach((k) => { out[k] = fromFsValue(fields[k]); });
    return out;
  }
  function fromFsDoc(doc) {
    if (!doc || !doc.fields) return null;
    const obj = fromFsFields(doc.fields);
    if (!obj.id && doc.name) obj.id = doc.name.split('/').pop();
    return obj;
  }

  /* ---------- Chamadas Cloud Firestore REST ---------- */
  async function fsReq(caminho, opts) {
    opts = opts || {};
    const cfg = lerFbConfig();
    if (!cfg.projectId) throw new Error('Projeto Firebase (projectId) não configurado.');
    const token = await obterIdTokenValido();
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/(default)/documents`;
    let r;
    try {
      r = await fetch(baseUrl + caminho, {
        method: opts.method || 'GET',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        cache: 'no-store'
      });
    } catch (e) { throw new Error('Sem conexão com o Cloud Firestore.'); }
    if (r.status === 404 && opts.allow404) return null;
    if (r.status === 401 || r.status === 403) {
      const j = await r.json().catch(() => ({}));
      throw new Error('Permissão negada no Firestore (' + ((j.error && j.error.message) || r.status) + '). Verifique as Security Rules e sua sessão.');
    }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(`Erro do Firestore (${r.status}): ${(j.error && j.error.message) || ''}`);
    }
    return r.json();
  }

  async function listarColecaoFs(uid, col) {
    const docs = [];
    let pageToken = '';
    do {
      const qs = `?pageSize=300${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`;
      const res = await fsReq(`/users/${encodeURIComponent(uid)}/${encodeURIComponent(col)}${qs}`, { allow404: true });
      if (!res || !res.documents) break;
      res.documents.forEach((d) => { const item = fromFsDoc(d); if (item && item.id) docs.push(item); });
      pageToken = res.nextPageToken || '';
    } while (pageToken);
    return docs;
  }

  async function commitWritesFs(writes) {
    if (!writes || !writes.length) return;
    for (let i = 0; i < writes.length; i += 400) {
      const chunk = writes.slice(i, i + 400);
      await fsReq(':commit', { method: 'POST', body: { writes: chunk } });
    }
  }

  /* ---------- GitHub Gist ---------- */
  async function gh(caminho, opts) {
    opts = opts || {};
    const cred = await carregarCredenciais();
    const tok = (cred && cred.token) || ss.get(K.token);
    if (!tok) { const err = new Error('Informe o token e a senha na tela de Sincronização.'); err.senha = true; throw err; }
    let r;
    try {
      r = await fetch('https://api.github.com' + caminho, { method: opts.method || 'GET', headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store' });
    } catch (e) { throw new Error('Sem conexão com o GitHub.'); }
    if (r.status === 401) throw new Error('Token do GitHub inválido ou expirado.');
    if (r.status === 403 || r.status === 404) {
      const j = await r.json().catch(() => ({}));
      if (/rate limit/i.test(j.message || '')) throw new Error('Limite de uso da API do GitHub atingido. Tente mais tarde.');
      if (r.status === 404 && caminho.startsWith('/gists/')) { ls.set(K.gist, ''); throw new Error('O gist de sincronização não existe mais. Sincronize de novo para criar outro.'); }
      throw new Error('O token não tem permissão para Gists (leitura e escrita).');
    }
    if (r.status === 204) return null;
    if (!r.ok) throw new Error(`Erro do GitHub (${r.status}).`);
    return r.json();
  }
  async function acharGist() {
    const id = ls.get(K.gist);
    if (id) return id;
    for (let pag = 1; pag <= 5; pag++) {
      const lista = await gh(`/gists?per_page=100&page=${pag}`);
      const g = lista.find((x) => x.files && x.files[ARQ]);
      if (g) { ls.set(K.gist, g.id); return g.id; }
      if (lista.length < 100) break;
    }
    return '';
  }
  async function lerGist(id) {
    const g = await gh('/gists/' + id);
    const f = g.files && g.files[ARQ];
    if (!f) return null;
    if (f.truncated && f.raw_url) { const r = await fetch(f.raw_url, { cache: 'no-store' }); return r.text(); }
    return f.content;
  }

  /* ---------- Identificação por uid (contaUid) e unificação ---------- */
  function lerBase() { try { return JSON.parse(ls.get(K.base)) || null; } catch (e) { return null; } }
  function configSinc(cfg) { const o = {}; Object.keys(cfg || {}).forEach((k) => { if (!CONFIG_LOCAL.includes(k)) o[k] = cfg[k]; }); return o; }

  function vincularContaUid(st, uidConta) {
    if (!st || !uidConta) return;
    if (!st.config) st.config = A.vazio().config;
    st.config.contaUid = uidConta;
    COLECOES.forEach((col) => {
      (st[col] || []).forEach((r) => {
        if (r && typeof r === 'object' && (!r.contaUid || r.contaUid === uidConta)) r.contaUid = uidConta;
      });
    });
  }

  /* Chaves naturais: o mesmo registro criado em dois aparelhos com ids diferentes */
  const normOrig = (o) => A.normOrigem ? A.normOrigem(o) : o;
  const CHAVES = {
    avaliacoes: (r) => r.origem ? r.perfilId + '|' + normOrig(r.origem) : null,
    dietas: (r) => r.origem ? r.perfilId + '|' + normOrig(r.origem) : null,
    programas: (r) => r.origem ? r.perfilId + '|' + normOrig(r.origem) : null,
    diario: (r) => r.perfilId + '|' + r.data,
    tomadas: (r) => r.perfilId + '|' + r.data + '|' + r.suplementoId,
    suplementos: (r) => r.catalogoId ? r.perfilId + '|' + r.catalogoId : null
  };
  function trocarId(lista, antigo, novo, campo) { (lista || []).forEach((x) => { if (x[campo] === antigo) x[campo] = novo; }); }
  function mesmoDonoConta(a, b) {
    if (a && b && a.contaUid && b.contaUid && a.contaUid !== b.contaUid) return false;
    return true;
  }
  function unificar(local, remoto, uidConta) {
    const R = (col) => (remoto && remoto[col]) || [];
    const primeira = !lerBase();
    if (uidConta) vincularContaUid(local, uidConta);
    // 1) na primeira sincronização da mesma conta, perfis equivalentes (mesmo contaUid, nome, sexo, altura e nascimento) viram o mesmo perfil
    if (primeira) {
      (local.perfis || []).forEach((p) => {
        const par = R('perfis').find((x) => x.id !== p.id && mesmoDonoConta(p, x) && norm(x.nome) === norm(p.nome) && x.sexo === p.sexo && Number(x.altura) === Number(p.altura) && (x.nascimento || '') === (p.nascimento || ''));
        if (!par || (local.perfis || []).some((x) => x.id === par.id)) return;
        const antigo = p.id; p.id = par.id; p._unif = true;
        if (par.contaUid && !p.contaUid) p.contaUid = par.contaUid;
        COLECOES.forEach((col) => { if (col !== 'perfis') trocarId(local[col], antigo, par.id, 'perfilId'); });
        if (local.perfilAtivo === antigo) local.perfilAtivo = par.id;
      });
    }
    // 2) demais coleções por chave natural (depois do ajuste de perfilId, respeitando contaUid)
    Object.keys(CHAVES).forEach((col) => {
      const f = CHAVES[col];
      const mapa = new Map(); R(col).forEach((r) => { const k = f(r); if (k) mapa.set(k, r); });
      const idsLocais = new Set((local[col] || []).map((x) => x.id));
      (local[col] || []).forEach((r) => {
        const k = f(r); const parR = k && mapa.get(k);
        if (!parR || !mesmoDonoConta(r, parR)) return;
        const idR = parR.id;
        if (!idR || idR === r.id || idsLocais.has(idR)) return;
        const antigo = r.id; r.id = idR; r._unif = true;
        if (col === 'programas') { trocarId(local.sessoes, antigo, idR, 'programaId'); trocarId(local.ciclos, antigo, idR, 'programaId'); }
        if (col === 'suplementos') trocarId(local.tomadas, antigo, idR, 'suplementoId');
      });
    });
  }

  /* ---------- mescla ---------- */
  function mesclar(local, remoto, base, t) {
    const res = { colecoes: {}, apagados: {}, config: null, mudouLocal: false, mudouRemoto: false };
    const baseH = (base && base.h) || {};
    const primeira = !base;
    const uidConta = (contaCache && contaCache.uid) || (local.config && local.config.contaUid) || null;
    COLECOES.forEach((col) => {
      const L = new Map((local[col] || []).filter((r) => r && !r.deletedAt).map((r) => [r.id, r]));
      const R = new Map(((remoto && remoto.colecoes && remoto.colecoes[col]) || []).filter((r) => r && !r.deletedAt).map((r) => [r.id, r]));
      const B = baseH[col] || {};
      const lapLocal = Object.assign({}, (local === A.S && A.apagados && A.apagados[col]) || {}, (local.apagados && local.apagados[col]) || {});
      (local[col] || []).forEach((r) => { if (r && r.deletedAt) lapLocal[r.id] = r.deletedAt; });
      const lapides = Object.assign({}, (remoto && remoto.apagados && remoto.apagados[col]) || {});
      const out = [];
      const ids = new Set([...L.keys(), ...R.keys(), ...Object.keys(B), ...Object.keys(lapLocal)]);
      ids.forEach((id) => {
        const l = L.get(id), r = R.get(id);
        const localMudou = l && (!(id in B) || hash(l) !== B[id]);
        const localApagou = !l && ((id in B) || (id in lapLocal));
        if (l && localMudou && !(r && (primeira || l._unif))) carimbarMod(l, Math.max(modDe(l), t), uidConta);
        if (l) delete l._unif;
        if (localApagou) {
          const tDel = lapLocal[id] || t;
          const refBase = Math.max((base && base.t) || 0, lapLocal[id] || 0);
          if (r && modDe(r) > refBase) { carimbarMod(r, modDe(r), uidConta); out.push(r); res.mudouLocal = true; }
          else { lapides[id] = Math.max(lapides[id] || 0, tDel); if (r) res.mudouRemoto = true; }
          return;
        }
        const lap = lapides[id] || 0;
        let venc = null;
        if (l && r) venc = modDe(l) > modDe(r) ? l : modDe(l) === modDe(r) && hash(l) === hash(r) ? l : r;
        else venc = l || r;
        if (venc && lap && lap >= modDe(venc)) { if (l) res.mudouLocal = true; return; }
        if (venc && lap) delete lapides[id];
        carimbarMod(venc, modDe(venc), uidConta);
        out.push(venc);
        if (venc !== l && (!l || hash(l) !== hash(venc))) res.mudouLocal = true;
        if (venc !== r && (!r || hash(r) !== hash(venc) || modDe(r) !== modDe(venc))) res.mudouRemoto = true;
      });
      Object.keys(lapides).forEach((id) => { if (t - (lapides[id] || 0) > EXPIRA_LAPIDE) delete lapides[id]; });
      res.colecoes[col] = out;
      res.apagados[col] = lapides;
    });
    const cL = configSinc(local.config), cR = (remoto && remoto.config) || null;
    const cLmudou = !base || hash(cL) !== base.cfg;
    const cLmod = cLmudou ? (primeira && cR ? 0 : t) : modDe(local.config);
    if (!cR || cLmod >= modDe(cR)) { res.config = Object.assign({}, cL, { _mod: cLmod || t, updatedAt: cLmod || t }); if (!cR || hash(cR) !== hash(res.config)) res.mudouRemoto = true; }
    else { res.config = Object.assign({}, cR, { _mod: modDe(cR), updatedAt: modDe(cR) }); if (hash(cR) !== hash(cL)) res.mudouLocal = true; }
    if (uidConta) res.config.contaUid = uidConta;
    return res;
  }

  /* ---------- redesenho sem atrapalhar quem está digitando ---------- */
  let redesenhoPendente = false, redesenhoT = null;
  const ocupado = () => { const a = document.activeElement; return !!document.querySelector('#modal .modal-bg') || !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
  function redesenhar() {
    if (!ocupado()) { redesenhoPendente = false; A.render(); return; }
    redesenhoPendente = true; clearTimeout(redesenhoT);
    redesenhoT = setTimeout(function tenta() { if (!redesenhoPendente) return; if (ocupado()) { redesenhoT = setTimeout(tenta, 2000); return; } redesenhoPendente = false; A.render(); }, 2000);
  }
  window.addEventListener('hashchange', () => { redesenhoPendente = false; });

  /* ---------- sincronizar (Firestore por uid ou GitHub Gist E2EE) ---------- */
  let rodando = null, pendente = false, ultimoErro = '', erroSenha = false;
  function status(msg, tipo) {
    const b = document.getElementById('btnSync');
    if (b) { b.hidden = !ativo(); b.textContent = tipo === 'sync' ? '⟳' : tipo === 'erro' ? '⚠' : '☁'; b.title = msg || 'Sincronizar'; b.classList.toggle('sync-erro', tipo === 'erro'); b.classList.toggle('sync-roda', tipo === 'sync'); }
    const el = document.getElementById('syncStatus'); if (el) el.textContent = msg;
  }
  async function desativarLocal() {
    clearTimeout(timer); timer = null; pendente = false;
    try {
      const auth = obterFirebaseAuth();
      if (auth && auth.currentUser) await auth.signOut();
    } catch (e) { /* */ }
    [K.on, K.modo, K.token, K.senha, K.gist, K.base, K.ult].forEach((k) => { ls.set(k, ''); ss.set(k, ''); });
    chaveCache = null; credCache = null; contaCache = null; ultimoErro = ''; erroSenha = false;
    await gravarCofre(null);
    await gravarItemCofre('conta', null);
    status('', 'ok');
  }
  function limparBase() {
    ls.set(K.base, '');
    const t = agora();
    COLECOES.forEach((col) => { (A.S[col] || []).forEach((r) => carimbarMod(r, t)); });
    if (A.S.config) { A.S.config._mod = t; A.S.config.updatedAt = t; }
  }

  async function sincronizarFirestore(opts) {
    const conta = await carregarContaCofre();
    if (!conta || !conta.uid) throw new Error('Conecte sua conta Google ou Apple para sincronizar.');
    const cfg = lerFbConfig();
    if (!cfg.projectId) throw new Error('Projeto Firebase não configurado.');
    const uid = conta.uid;
    salvandoPorSync = true; A.saveNow(); salvandoPorSync = false;
    const st = A.S, t = agora();
    vincularContaUid(st, uid);

    const userDocRaw = opts.recomecar ? null : await fsReq(`/users/${encodeURIComponent(uid)}`, { allow404: true });
    const userDoc = userDocRaw ? fromFsDoc(userDocRaw) : null;
    let remoto = null;
    const docsRemotosMap = {};
    if (userDoc && !opts.recomecar) {
      const colArrays = await Promise.all(COLECOES.map((col) => listarColecaoFs(uid, col)));
      const colecoesRemotas = {};
      const apagadosRemotos = Object.assign({}, userDoc.apagados || {});
      COLECOES.forEach((col, idx) => {
        const lista = colArrays[idx] || [];
        docsRemotosMap[col] = new Map(lista.map((r) => [r.id, r]));
        colecoesRemotas[col] = lista.filter((r) => !r.deletedAt);
        if (!apagadosRemotos[col]) apagadosRemotos[col] = {};
        lista.forEach((r) => { if (r.deletedAt) apagadosRemotos[col][r.id] = r.deletedAt; });
      });
      remoto = { colecoes: colecoesRemotas, apagados: apagadosRemotos, config: userDoc.config || null };
    } else {
      COLECOES.forEach((col) => { docsRemotosMap[col] = new Map(); });
    }

    const base = opts.recomecar ? null : lerBase();
    if (remoto) unificar(st, remoto.colecoes || {}, uid);
    cacheAtivo = true;
    const m = mesclar(st, remoto, base && base.uid === uid ? base : null, t);

    if (m.mudouLocal || !remoto) {
      COLECOES.forEach((col) => { st[col] = m.colecoes[col]; });
      const locais = {}; CONFIG_LOCAL.forEach((k) => { if (st.config && k in st.config) locais[k] = st.config[k]; });
      st.config = Object.assign({}, A.vazio().config, m.config, locais, { contaUid: uid, _mod: m.config._mod, updatedAt: m.config.updatedAt || m.config._mod });
    } else {
      st.config.contaUid = uid;
      st.config._mod = m.config._mod;
      st.config.updatedAt = m.config.updatedAt || m.config._mod;
    }
    if (!st.perfis.some((p) => p.id === st.perfilAtivo)) st.perfilAtivo = (st.perfis[0] || {}).id || null;

    const h = {};
    const writes = [];
    const docPrefix = `projects/${cfg.projectId}/databases/(default)/documents/users/${uid}`;
    COLECOES.forEach((col) => {
      h[col] = {};
      const rMap = docsRemotosMap[col] || new Map();
      m.colecoes[col].forEach((r) => {
        r.contaUid = uid;
        r.updatedAt = Number(r.updatedAt || r._mod) || t;
        r._mod = r.updatedAt;
        r.schemaVersion = A.SCHEMA_VERSION || 2;
        r.deletedAt = null;
        h[col][r.id] = hash(r);
        const rAnt = rMap.get(r.id);
        if (!rAnt || rAnt.deletedAt || hash(rAnt) !== h[col][r.id] || modDe(rAnt) !== r.updatedAt) {
          writes.push({
            update: {
              name: `${docPrefix}/${col}/${r.id}`,
              fields: toFsFields(r)
            }
          });
        }
      });
      const lap = m.apagados[col] || {};
      Object.entries(lap).forEach(([id, ts]) => {
        const rAnt = rMap.get(id);
        if (rAnt && !rAnt.deletedAt) {
          writes.push({
            update: {
              name: `${docPrefix}/${col}/${id}`,
              fields: toFsFields({ id, contaUid: uid, schemaVersion: A.SCHEMA_VERSION || 2, updatedAt: ts, _mod: ts, deletedAt: ts })
            }
          });
        }
      });
    });
    const cfgHash = hash(configSinc(st.config));
    cacheAtivo = false;

    if (writes.length || m.mudouRemoto || !remoto) {
      writes.push({
        update: {
          name: docPrefix,
          fields: toFsFields({
            uid,
            schemaVersion: A.SCHEMA_VERSION || 2,
            updatedAt: t,
            atualizadoEm: new Date(t).toISOString(),
            por: dispositivo(),
            perfilAtivo: st.perfilAtivo || null,
            config: m.config,
            lgpd: (st.config && st.config.lgpd) || null,
            apagados: m.apagados
          })
        }
      });
      await commitWritesFs(writes);
    }

    ls.set(K.base, JSON.stringify({ uid, t, h, cfg: cfgHash }));
    ls.set(K.ult, new Date(t).toISOString());
    if (A.sincronizarApagados) A.sincronizarApagados(m.apagados);
    salvandoPorSync = true; A.saveNow({ preservarMod: true }); salvandoPorSync = false;
    return { ok: true, recebeu: m.mudouLocal, enviou: writes.length > 0 };
  }

  async function sincronizar(opts) {
    opts = opts || {};
    await carregarCredenciais();
    if (!ativo()) return { ok: false, msg: 'Sincronização não configurada' };
    if (rodando) { pendente = true; return rodando; }
    rodando = (async () => {
      status('Sincronizando…', 'sync');
      try {
        if (modoAtual() === 'conta' && contaAtiva()) {
          const rFs = await sincronizarFirestore(opts);
          ultimoErro = ''; erroSenha = false;
          const quando = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          status(`Sincronizado às ${quando}`, 'ok');
          if (rFs.recebeu && !opts.silencioso) A.toast('Dados atualizados da sua conta na nuvem');
          if (rFs.recebeu) redesenhar();
          return rFs;
        }
        const cred = await carregarCredenciais();
        salvandoPorSync = true; A.saveNow(); salvandoPorSync = false;
        const st = A.S, senha = (cred && cred.senha) || ss.get(K.senha) || '', t = agora();
        let id = await acharGist();
        let remoto = null, salt = null;
        if (id && !opts.recomecar) {
          const txt = await lerGist(id);
          if (txt) { const d = await decifrar(txt, senha); remoto = d.dados; salt = d.salt; }
        }
        const base = opts.recomecar ? null : lerBase();
        if (remoto) unificar(st, remoto.colecoes || {});
        cacheAtivo = true;
        const m = mesclar(st, remoto, base && base.gist === id ? base : null, t);
        if (m.mudouLocal || !remoto) {
          COLECOES.forEach((col) => { st[col] = m.colecoes[col]; });
          const locais = {}; CONFIG_LOCAL.forEach((k) => { if (st.config && k in st.config) locais[k] = st.config[k]; });
          st.config = Object.assign({}, A.vazio().config, m.config, locais, { _mod: m.config._mod, updatedAt: m.config.updatedAt || m.config._mod });
        } else { st.config._mod = m.config._mod; st.config.updatedAt = m.config.updatedAt || m.config._mod; }
        if (!st.perfis.some((p) => p.id === st.perfilAtivo)) st.perfilAtivo = (st.perfis[0] || {}).id || null;
        const h = {}; COLECOES.forEach((col) => { h[col] = {}; m.colecoes[col].forEach((r) => { h[col][r.id] = hash(r); }); });
        const cfgHash = hash(configSinc(st.config));
        cacheAtivo = false;
        const arquivo = { app: 'fitlab', v: 1, schemaVersion: A.SCHEMA_VERSION || 2, atualizadoEm: new Date(t).toISOString(), por: dispositivo(), colecoes: m.colecoes, apagados: m.apagados, config: m.config };
        if (!id) {
          const g = await gh('/gists', { method: 'POST', body: { description: DESC, public: false, files: { [ARQ]: { content: await cifrar(arquivo, senha) } } } });
          id = g.id; ls.set(K.gist, id);
        } else if (m.mudouRemoto || !remoto) {
          await gh('/gists/' + id, { method: 'PATCH', body: { files: { [ARQ]: { content: await cifrar(arquivo, senha, salt) } } } });
        }
        ls.set(K.base, JSON.stringify({ gist: id, t, h, cfg: cfgHash }));
        ls.set(K.ult, new Date(t).toISOString());
        if (A.sincronizarApagados) A.sincronizarApagados(m.apagados);
        salvandoPorSync = true; A.saveNow({ preservarMod: true }); salvandoPorSync = false;
        ultimoErro = ''; erroSenha = false;
        const quando = new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        status(`Sincronizado às ${quando}`, 'ok');
        if (m.mudouLocal && !opts.silencioso) A.toast('Dados atualizados de outro aparelho');
        if (m.mudouLocal) redesenhar();
        return { ok: true, recebeu: m.mudouLocal, enviou: m.mudouRemoto || !remoto };
      } catch (e) {
        ultimoErro = e.message || String(e); erroSenha = !!e.senha;
        status('Falha ao sincronizar: ' + ultimoErro, 'erro');
        if (!opts.silencioso) A.toast(ultimoErro, 3500);
        return { ok: false, msg: ultimoErro };
      } finally {
        cacheAtivo = false;
        rodando = null;
        if (pendente) { pendente = false; setTimeout(() => sincronizar({ silencioso: true }), 500); }
      }
    })();
    return rodando;
  }

  /* ---------- Direito ao Esquecimento (LGPD Art. 18) — Exclusão definitiva ---------- */
  async function excluirContaNuvem() {
    await carregarCredenciais();
    if (contaAtiva()) {
      const conta = contaAtiva();
      const cfg = lerFbConfig();
      const uid = conta.uid;
      if (cfg.projectId && cfg.apiKey) {
        const token = await obterIdTokenValido();
        const colArrays = await Promise.all(COLECOES.map((col) => listarColecaoFs(uid, col).catch(() => [])));
        const docPrefix = `projects/${cfg.projectId}/databases/(default)/documents/users/${uid}`;
        const deletes = [];
        COLECOES.forEach((col, idx) => {
          (colArrays[idx] || []).forEach((doc) => {
            if (doc && doc.id) deletes.push({ delete: `${docPrefix}/${col}/${doc.id}` });
          });
        });
        deletes.push({ delete: docPrefix });
        await commitWritesFs(deletes);
        await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(cfg.apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token })
        }).catch(() => {});
      }
      await desativarLocal();
      return { ok: true, modo: 'conta' };
    }
    if (ativo()) {
      try {
        const id = await acharGist();
        if (id) {
          await gh('/gists/' + id, { method: 'DELETE' }).catch(async () => {
            A.S = A.vazio();
            await sincronizar({ recomecar: true, silencioso: true });
          });
        }
      } catch (e) { /* segue para limpeza local */ }
      await desativarLocal();
      return { ok: true, modo: 'gist' };
    }
    await desativarLocal();
    return { ok: true, modo: 'local' };
  }

  /* ---------- gatilhos automáticos ---------- */
  let salvandoPorSync = false, timer = null;
  A.hooks.salvo.push(() => { if (salvandoPorSync || !ativo()) return; if (rodando) { pendente = true; return; } clearTimeout(timer); timer = setTimeout(() => { timer = null; sincronizar({ silencioso: true }); }, 4000); });
  A.hooks.boot.push(async () => {
    await carregarCredenciais();
    const auth = obterFirebaseAuth();
    if (auth) {
      try {
        const redir = await auth.getRedirectResult();
        if (redir && redir.user) await vincularUsuarioFirebase(redir.user);
      } catch (e) { /* */ }
      auth.onAuthStateChanged(async (u) => {
        if (u && (!contaCache || contaCache.uid !== u.uid)) {
          await vincularUsuarioFirebase(u);
          status('Sincronização ativa', 'ok');
          sincronizar({ silencioso: true });
        }
      });
    }
    status(ativo() ? 'Sincronização ativa' : '', 'ok');
    const b = document.getElementById('btnSync'); if (b) b.onclick = async () => { const r = await sincronizar(); if (r && r.ok) A.toast(r.recebeu ? 'Dados recebidos de outro aparelho' : 'Sincronizado'); };
    if (ativo()) setTimeout(() => sincronizar({ silencioso: true }), 800);
  });
  document.addEventListener('visibilitychange', () => {
    if (!ativo()) return;
    if (document.visibilityState === 'visible') sincronizar({ silencioso: true });
    else if (timer) { clearTimeout(timer); timer = null; sincronizar({ silencioso: true }); }
  });
  window.addEventListener('online', () => { if (ativo()) sincronizar({ silencioso: true }); });

  /* ---------- tela de configuração (#/sync) ---------- */
  A.route('sync', () => {
    A.setTitle('Sincronização');
    const ult = ls.get(K.ult), semPerfil = !A.perfil();
    const conta = contaAtiva();
    const consentiu = A.temConsentimentoLgpd ? A.temConsentimentoLgpd() : true;

    const exigirLgpd = () => {
      const chk = A.$('#syLgpd');
      if (chk && chk.checked) {
        if (A.registrarConsentimentoLgpd) A.registrarConsentimentoLgpd('local_e_nuvem');
        return true;
      }
      if (A.temConsentimentoLgpd && A.temConsentimentoLgpd()) return true;
      A.toast('Marque o consentimento LGPD para sincronizar seus dados na nuvem.');
      return false;
    };

    A.on('syGoogle', async () => {
      if (!exigirLgpd()) return;
      try {
        const res = await iniciarLoginSocial('google.com');
        if (res && res.uid) {
          A.toast(`Conectado como ${res.email || res.nome}! Sincronizando…`);
          const r = await sincronizar({ silencioso: true });
          if (r && r.ok && semPerfil && A.perfil()) { A.go('inicio'); return; }
          A.render();
        }
      } catch (e) {
        A.toast(e.message || String(e), 4500);
      }
    });

    A.on('syAgora', async () => {
      const r = await sincronizar();
      if (r && r.ok) A.toast(r.recebeu ? 'Dados atualizados da nuvem' : 'Sincronizado');
      A.render();
    });
    A.on('syOff', () => A.confirmar('Sair da sua conta neste aparelho? Seus dados continuam salvos na nuvem e neste aparelho.', async () => {
      await desativarLocal();
      A.toast('Conta desconectada neste aparelho');
      A.render();
    }, { ok: 'Sair da conta' }));
    A.on('syExcluirConta', () => A.confirmar('Excluir permanentemente seus dados na nuvem, sua conta conectada e todos os dados deste aparelho (Direito ao Esquecimento — LGPD)? Esta ação não pode ser desfeita.', async () => {
      A.toast('Excluindo dados na nuvem e neste aparelho…');
      await excluirContaNuvem();
      if (A.limparBanco) await A.limparBanco();
      else localStorage.removeItem(A.KEY);
      location.hash = '#/inicio';
      location.reload();
    }, { danger: true, title: 'Excluir conta e todos os dados (LGPD)', ok: 'Excluir tudo permanentemente' }));

    return `${semPerfil ? '<div class="row mb"><a class="btn sm ghost" href="#/inicio">‹ Voltar e criar perfil</a></div>' : ''}
      <div class="card accent stack" style="max-width:560px;margin:0 auto">
        <div>
          <h2>☁ Sincronização na Nuvem</h2>
          <p class="text-2">Seus perfis, dietas, treinos e registros ficam sincronizados automaticamente entre celular, tablet e computador com a sua conta do Google.</p>
        </div>
        ${conta ? `
          <div class="card soft">
            <div class="row between">
              <div>
                <b>${esc(conta.nome || 'Conta Google')}</b>
                ${conta.email ? `<div class="tiny muted">${esc(conta.email)}</div>` : ''}
              </div>
              <span class="badge ok">Conectado</span>
            </div>
            <div class="tiny muted mt-s" id="syncStatus">${ult ? 'Última sincronização: ' + esc(new Date(ult).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })) + ' às ' + esc(new Date(ult).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })) : 'Sincronização automática ativa'}${ultimoErro ? ' · ' + esc(ultimoErro) : ''}</div>
          </div>
          <div class="row">
            <button class="btn primary" data-act="syAgora">⟳ Sincronizar agora</button>
            <button class="btn ghost" data-act="syOff">Sair da conta</button>
            <button class="btn danger sm" data-act="syExcluirConta">🗑️ Excluir conta e dados (LGPD)</button>
          </div>
        ` : `
          <label class="check"><input type="checkbox" id="syLgpd" ${consentiu ? 'checked' : ''}> <span>Autorizo a sincronização em nuvem dos meus dados corporais, nutricionais e de treino (dados sensíveis de saúde — LGPD, Art. 11). <a href="#/lgpd">Privacidade e LGPD</a>.</span></label>
          <button class="btn primary block" data-act="syGoogle">🔵 Fazer login com a conta do Google</button>
        `}
      </div>`;
  });

  window.FitSync = {
    sincronizar, cifrar, decifrar, mesclar, unificar, hash, ativo, modoAtual, contaAtiva,
    vincularContaUid, autenticarComIdp, iniciarLoginSocial, salvarFbConfig, lerFbConfig,
    toFsFields, fromFsFields, fromFsDoc, excluirContaNuvem, desativarLocal, limparBase
  };
})();
