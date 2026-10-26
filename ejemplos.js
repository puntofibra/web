/* FuturMovil · ejemplos */
(() => {
'use strict';
const API = 'https://script.google.com/macros/s/AKfycbyvmIoIMhLIIdVKYKLLr7vpea1k6iZMJoVTLVGvuYFVNrtYf2mEOzkpz5Hb1Ab-jiHHgw/exec'; // URL /exec de Apps Script (se rellena al implementar)
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const isTouch = matchMedia('(hover:none)').matches;
const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
const store = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(k,v); } catch(e){} }
};

/* ---------- SONIDO (Web Audio, sin archivos) ---------- */
const SFX = (() => {
  let ctx = null, master = null, on = store.get('fm_sound') !== '0', lastHover = 0;
  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = .55;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const tone = (f, t0, dur, {type='sine', vol=.2, f2=null, attack=.005, q=0}={}) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    let node = o;
    if (q) { const fl = ctx.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value = q; o.connect(fl); node = fl; }
    node.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + .05);
  };
  const noise = (t0, dur, from, to, vol=.12) => {
    const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(from, t0); bp.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + dur * .4); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    s.connect(bp); bp.connect(g); g.connect(master); s.start(t0);
  };
  const play = (name) => {
    if (!on || !ensure() || ctx.state !== 'running') return; // hasta el primer toque el navegador no deja sonar
    const t = ctx.currentTime + .01;
    switch (name) {
      case 'on':
        [523.25, 783.99, 1046.5].forEach((f,i) => tone(f, t + i*.07, .5, {vol:.14}));
        tone(2093, t + .21, .6, {vol:.04}); break;
      case 'hover': {
        const now = performance.now(); if (now - lastHover < 70) return; lastHover = now;
        tone(2600, t, .05, {vol:.025, type:'sine'}); break; }
      case 'click':
        tone(880, t, .12, {type:'triangle', vol:.13, f2:440});
        tone(1760, t, .06, {vol:.04}); break;
      case 'whoosh': noise(t, .55, 300, 3200, .05); break;
      case 'pop': tone(420, t, .16, {vol:.2, f2:900, type:'sine'}); tone(1300, t + .05, .12, {vol:.06}); break;
      case 'success':
        [659.25, 783.99, 987.77, 1318.5].forEach((f,i) => tone(f, t + i*.09, .45, {vol:.13, type:'triangle'}));
        noise(t, .8, 2000, 8000, .03); break;
      case 'error': tone(220, t, .25, {type:'sawtooth', vol:.08, q:900}); tone(180, t + .12, .3, {type:'sawtooth', vol:.08, q:900}); break;
      case 'type': tone(1500 + Math.random()*400, t, .025, {vol:.015, type:'square', q:3000}); break;
    }
  };
  const set = (v) => {
    on = v; store.set('fm_sound', v ? '1' : '0');
    const b = $('#soundBtn');
    b.classList.toggle('on', on);
    b.setAttribute('aria-label', on ? 'Silenciar' : 'Activar sonido');
    if (on) { const c = ensure(); if (c) c.resume().then(() => play('on')).catch(() => {}); }
  };
  return { play, set, get on(){ return on; }, ensure };
})();

$('#soundBtn').classList.toggle('on', SFX.on);
$('#soundBtn').addEventListener('click', () => SFX.set(!SFX.on));
// Si el sonido estaba activado de antes, el navegador exige un gesto para arrancar el audio
// Sonido encendido por defecto: el navegador solo deja arrancar el audio tras el primer toque/clic/tecla
let unlocked = false;
const unlock = (e) => {
  if (unlocked) return; unlocked = true;
  ['pointerdown','touchstart','keydown'].forEach(ev => removeEventListener(ev, unlock, true));
  if (SFX.on) { const c = SFX.ensure(); if (c) c.resume().then(() => { if (!(e && e.target.closest && e.target.closest('#soundBtn'))) SFX.play('on'); }).catch(() => {}); }
};
['pointerdown','touchstart','keydown'].forEach(ev => addEventListener(ev, unlock, true));

document.addEventListener('click', e => {
  const el = e.target.closest('a,button,label');
  if (!el || el.id === 'soundBtn') return;
  SFX.play(el.matches('[data-wa], .wa-float') ? 'pop' : 'click');
});
if (!isTouch) {
  document.addEventListener('pointerover', e => {
    const el = e.target.closest('a,button,[data-sfx-hover],.plat');
    if (el && !el.contains(e.relatedTarget)) SFX.play('hover');
  });
}

/* ---------- Fondo: fibras de luz ---------- */
(() => {
  const cv = $('#bg'), c = cv.getContext('2d');
  let W, H, dpr, pts = [], fibers = [], mouse = { x: -999, y: -999 };
  const cols = ['125,255,90', '61,220,132', '46,139,255', '255,122,26'];
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(70, W * H / 22000));
    pts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25, r: Math.random() * 1.6 + .4 }));
    fibers = Array.from({ length: W < 700 ? 5 : 8 }, (_, i) => ({ col: cols[i % 4], amp: 40 + Math.random() * 90, y: H * (.15 + Math.random() * .7), sp: .0004 + Math.random() * .0006, ph: Math.random() * 6, w: .6 + Math.random() * 1.2, pulse: Math.random() }));
  };
  resize(); addEventListener('resize', resize);
  if (!isTouch) addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  let sy = 0; addEventListener('scroll', () => sy = scrollY, { passive: true });
  const draw = (t) => {
    c.clearRect(0, 0, W, H);
    // fondo con degradado sutil
    const g = c.createRadialGradient(W * .8, H * .1, 0, W * .8, H * .1, Math.max(W, H));
    g.addColorStop(0, 'rgba(30,70,40,.35)'); g.addColorStop(.5, 'rgba(5,8,10,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // fibras ópticas
    c.globalCompositeOperation = 'lighter';
    fibers.forEach(f => {
      const off = -sy * .05;
      c.beginPath();
      for (let x = -20; x <= W + 20; x += 16) {
        const y = f.y + off + Math.sin(x * .004 + t * f.sp + f.ph) * f.amp + Math.sin(x * .011 + t * f.sp * 1.7) * f.amp * .25;
        x < 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.strokeStyle = `rgba(${f.col},.07)`; c.lineWidth = f.w * 6; c.stroke();
      c.strokeStyle = `rgba(${f.col},.22)`; c.lineWidth = f.w; c.stroke();
      // pulso de luz viajando
      f.pulse = (f.pulse + .0016 + f.sp) % 1.2;
      const px = f.pulse * (W + 200) - 100;
      const py = f.y + off + Math.sin(px * .004 + t * f.sp + f.ph) * f.amp + Math.sin(px * .011 + t * f.sp * 1.7) * f.amp * .25;
      const rg = c.createRadialGradient(px, py, 0, px, py, 26);
      rg.addColorStop(0, `rgba(${f.col},.9)`); rg.addColorStop(1, `rgba(${f.col},0)`);
      c.fillStyle = rg; c.beginPath(); c.arc(px, py, 26, 0, 7); c.fill();
    });
    // partículas + red
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < 120) { p.x += dx / d * .8; p.y += dy / d * .8; }
      c.fillStyle = 'rgba(180,255,170,.55)'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill();
    });
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 120) { c.strokeStyle = `rgba(125,255,90,${(1 - d / 120) * .12})`; c.lineWidth = .6; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
    }
    c.globalCompositeOperation = 'source-over';
    if (!reduce) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
})();


/* ---------- Utilidades ---------- */
const WA_NUM = '34633200100';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let tt;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600); }
const jsonp = (params) => new Promise((res, rej) => {
  const cb = 'cb' + Date.now() + Math.floor(Math.random() * 1e4);
  const s = document.createElement('script');
  const to = setTimeout(() => { cleanup(); rej(new Error('La conexión tarda demasiado')); }, 20000);
  const cleanup = () => { clearTimeout(to); delete window[cb]; s.remove(); };
  window[cb] = d => { cleanup(); res(d); };
  s.onerror = () => { cleanup(); rej(new Error('Sin conexión')); };
  s.src = API + '?' + new URLSearchParams({ ...params, callback: cb, cnt: Date.now() });
  document.body.appendChild(s);
});
const icoHtml = (v, cls = '') => /^data:image\//.test(v || '') ? `<img src="${esc(v)}" alt="" class="ej-img ${cls}">` : esc(v || '✨');
async function callPost(action, data = {}) {
  let r;
  try {
    const res = await fetch(API, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, tok: S.token || '', ...data }) });
    r = await res.json();
  } catch (e) { throw new Error('Sin conexión'); }
  if (!r || !r.ok) { if (r && r.sesion === false) salirAdmin(true); throw new Error((r && r.error) || 'Error'); }
  return r;
}
const S = { token: store.get('ej_tok'), lista: [], admin: [] };
async function call(action, data = {}, admin = false) {
  const p = { action, ...data };
  if (admin) p.tok = S.token || '';
  const r = await jsonp(p);
  if (!r || !r.ok) {
    if (r && r.sesion === false) { salirAdmin(true); }
    throw new Error((r && r.error) || 'Error');
  }
  return r;
}
$$('[data-wa]').forEach(a => a.href = `https://wa.me/${WA_NUM}?text=${encodeURIComponent(a.dataset.wa)}`);
$('#year').textContent = new Date().getFullYear();

/* ---------- Reveal ---------- */
const rev = new IntersectionObserver(es => es.forEach(en => {
  if (!en.isIntersecting) return;
  const el = en.target;
  const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
  el.style.transitionDelay = (sibs.indexOf(el) * 0.07) + 's';
  el.classList.add('in'); rev.unobserve(el);
}), { threshold: .1 });
const observeReveal = () => $$('.reveal:not(.in)').forEach(el => rev.observe(el));
observeReveal();
setTimeout(() => SFX.play('whoosh'), 400);

/* ---------- Tilt ---------- */
function bindTilt(root) {
  if (isTouch || reduce) return;
  $$('.tilt', root).forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.transform = `perspective(900px) rotateX(${(.5 - y) * 8}deg) rotateY(${(x - .5) * 10}deg)`;
      el.style.setProperty('--mx', x * 100 + '%'); el.style.setProperty('--my', y * 100 + '%');
    });
    el.addEventListener('pointerleave', () => { el.style.transition = 'transform .6s'; el.style.transform = ''; setTimeout(() => el.style.transition = '', 600); });
  });
}
if (!isTouch && !reduce) {
  const glow = $('.cursor-glow');
  addEventListener('pointermove', e => glow.style.transform = `translate(${e.clientX}px,${e.clientY}px)`, { passive: true });
  $$('.magnetic').forEach(el => {
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.transform = `translate(${(e.clientX - r.left - r.width/2) * .18}px,${(e.clientY - r.top - r.height/2) * .25}px)`; });
    el.addEventListener('pointerleave', () => el.style.transform = '');
  });
}

/* ---------- Listado público ---------- */
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
function pintaLista() {
  const g = $('#ejGrid');
  $('#ejEmpty').hidden = S.lista.length > 0;
  g.innerHTML = S.lista.map((x, i) => `
    <article class="card ej-card tilt reveal" data-sfx-hover data-id="${esc(x.id)}" tabindex="0" role="button" aria-label="Ver ${esc(x.titulo)}">
      <div class="ej-ico">${icoHtml(x.icono)}</div>
      <h3>${esc(x.titulo)}</h3>
      <p>${esc(x.desc).replace(/\n/g, '<br>')}</p>
      <div class="ej-foot">
        <span></span>
        <span class="ej-go">Ver ejemplo
          <svg viewBox="0 0 24 24"><path d="M5 12h14m-6-6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </div>
    </article>`).join('');
  bindTilt(g); observeReveal();
}
async function cargaLista() {
  try {
    const r = await call('ejemplos');
    S.lista = r.lista || [];
    pintaLista();
    abrirDesdeHash();
  } catch (e) {
    $('#ejGrid').innerHTML = '';
    $('#ejEmpty').hidden = false;
    $('#ejEmpty').textContent = 'No se han podido cargar los ejemplos. Prueba otra vez en un momento.';
  }
}
$('#ejGrid').addEventListener('click', e => { const c = e.target.closest('.ej-card'); if (c) verEjemplo(c.dataset.id); });
$('#ejGrid').addEventListener('keydown', e => { const c = e.target.closest('.ej-card'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); verEjemplo(c.dataset.id); } });

/* ---------- Visor encapsulado ---------- */
const viewer = $('#viewer'), frame = $('#vFrame');
let abierto = null;
function verEjemplo(id, desdeHash) {
  const x = S.lista.find(e => e.id === id);
  if (!x) return;
  if (!x.encapsulado) { window.open(x.url, '_blank', 'noopener'); return; }
  abierto = id;
  $('#vTitle').innerHTML = (x.icono ? icoHtml(x.icono, 'ej-img-sm') + ' ' : '') + esc(x.titulo);
  $('#vOpen').href = x.url;
  $('#vLoad').classList.remove('done');
  frame.src = x.url;
  viewer.hidden = false;
  document.body.classList.add('ej-lock');
  SFX.play('whoosh');
  if (!desdeHash) history.pushState({ ej: id }, '', '#ver=' + encodeURIComponent(id));
}
frame.addEventListener('load', () => { if (frame.src !== 'about:blank') $('#vLoad').classList.add('done'); });
function cerrarVisor() {
  if (viewer.hidden) return;
  viewer.hidden = true; abierto = null;
  frame.src = 'about:blank';
  document.body.classList.remove('ej-lock');
}
$('#vBack').addEventListener('click', () => { if (history.state && history.state.ej) history.back(); else { cerrarVisor(); history.replaceState(null, '', location.pathname); } });
addEventListener('popstate', () => { if (location.hash.startsWith('#ver=')) abrirDesdeHash(); else cerrarVisor(); });
function abrirDesdeHash() {
  const m = location.hash.match(/^#ver=(.+)$/);
  if (m && abierto !== decodeURIComponent(m[1])) verEjemplo(decodeURIComponent(m[1]), true);
}

/* ---------- Compartir ---------- */
$('#shareBtn').addEventListener('click', async () => {
  const data = { title: 'Ejemplos · FuturMovil', text: 'Mira las webs y apps que hace FuturMovil 👉', url: location.href.split('#')[0] };
  if (navigator.share) { try { await navigator.share(data); } catch (e) {} return; }
  try { await navigator.clipboard.writeText(data.url); toast('Enlace copiado ✅'); } catch (e) { prompt('Copia el enlace:', data.url); }
});

/* ---------- Modal ---------- */
const modalEl = $('#modal');
function modal(html) { $('#modalBody').innerHTML = html; modalEl.hidden = false; return $('#modalBody'); }
function closeModal() { modalEl.hidden = true; $('#modalBody').innerHTML = ''; }
modalEl.addEventListener('click', e => { if (e.target === modalEl || e.target.closest('.modal-x')) closeModal(); });

/* ---------- Login admin ---------- */
$('#adminBtn').addEventListener('click', () => { if (S.token) abrirAdmin(); else loginModal(); });
function loginModal() {
  const m = modal(`<h3>🔒 Acceso administrador</h3>
    <form id="lgForm" class="lead-form ej-login">
      <label><span>Código de Google Authenticator</span>
        <input id="lgCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" class="ej-code"></label>
      <button class="btn btn-primary" type="submit"><span>Entrar</span></button>
      <p class="form-msg" id="lgMsg" role="status"></p>
    </form>
    <div class="ej-or"><span>o</span></div>
    <button class="btn btn-ghost ej-full" id="lgKey" type="button">🔑 Entrar con mi llave NFC</button>`);
  const inp = m.querySelector('#lgCode'); setTimeout(() => inp.focus(), 50);
  inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 6); if (inp.value.length === 6) m.querySelector('#lgForm').requestSubmit(); });
  m.querySelector('#lgForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = m.querySelector('#lgMsg'); msg.className = 'form-msg'; msg.textContent = 'Comprobando…';
    try { const r = await call('adminTotp', { cod: inp.value }); entrar(r.token); }
    catch (er) { msg.textContent = er.message; msg.className = 'form-msg err'; SFX.play('error'); inp.select(); }
  });
  m.querySelector('#lgKey').addEventListener('click', llaveModal);
}
function entrar(token) {
  S.token = token; store.set('ej_tok', token);
  closeModal(); SFX.play('success'); toast('Hola, Manu 👋'); abrirAdmin();
}

/* ---------- Llave NFC (Central de Llaves) ---------- */
function llaveModal() {
  const m = modal(`<h3>🔑 Entrar con llave NFC</h3><p class="ej-mut">¿Dónde vas a acercar la llave?</p>
    <div class="ej-stack">
      <button class="btn btn-primary" id="lvAqui" type="button"><span>📱 En este móvil</span></button>
      <button class="btn btn-ghost" id="lvQr" type="button">🔳 En otro móvil (escanear QR)</button>
    </div>
    <p class="ej-mut" id="lvMsg"></p>`);
  let ses = null, err = null;
  const pide = call('llaveSesion').then(d => { ses = d; }).catch(e => { err = e; });
  const listo = async () => { await pide; if (err) throw err; return ses; };
  m.querySelector('#lvAqui').onclick = async () => {
    const w = window.open(ses ? ses.url : 'about:blank', '_blank');
    try { const s = await listo(); try { if (w && w.location.href === 'about:blank') w.location.href = s.url; } catch (e) {} llaveEsperar(s, 'aqui'); }
    catch (e) { if (w) w.close(); const x = $('#lvMsg'); if (x) x.textContent = e.message; }
  };
  m.querySelector('#lvQr').onclick = async () => {
    try { llaveEsperar(await listo(), 'qr'); }
    catch (e) { const x = $('#lvMsg'); if (x) x.textContent = e.message; }
  };
}
function llaveEsperar(s, modo) {
  const pie = '<p id="lvSt" class="ej-mut">⏳ Esperando la llave…</p>';
  if (modo === 'qr') {
    const m = modal(`<h3>Escanea con el móvil de la llave</h3><div class="ej-qr" id="lvqr"></div>
      <p class="ej-mut">Abre el enlace en un Android con NFC, acerca la llave por detrás y esta pantalla entrará sola.</p>` + pie);
    new QRCode(m.querySelector('#lvqr'), { text: s.url, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
  } else {
    modal(`<h3>Acerca tu llave</h3>
      <p class="ej-mut">Se ha abierto el lector NFC en otra pestaña. Acerca la llave por detrás del móvil; cuando suene, vuelve aquí y entrarás solo.</p>
      <a class="btn btn-ghost ej-full" href="${esc(s.url)}" target="_blank" rel="noopener">Abrir el lector NFC</a>` + pie);
  }
  const tick = async () => {
    const st = $('#lvSt'); if (!st || modalEl.hidden) return;
    try {
      const r = await call('llaveEstado', { codigo: s.codigo });
      const st2 = $('#lvSt'); if (!st2) return;
      if (r.estado === 'ok') { entrar(r.token); return; }
      if (r.estado === 'denegado') { st2.innerHTML = '❌ ' + esc(r.motivo || 'Llave no autorizada') + '<br><button class="ej-link" id="lvRe">Probar otra vez</button>'; $('#lvRe').onclick = llaveModal; SFX.play('error'); return; }
      if (r.estado === 'caducado') { st2.innerHTML = '⌛ El código ha caducado.<br><button class="ej-link" id="lvRe">Generar otro</button>'; $('#lvRe').onclick = llaveModal; return; }
    } catch (e) {}
    setTimeout(tick, 1500);
  };
  setTimeout(tick, 1500);
}

/* ---------- Panel admin ---------- */
const panel = $('#adminPanel'), form = $('#ejForm');
async function abrirAdmin() {
  panel.hidden = false; document.body.classList.add('ej-lock');
  await cargaAdmin();
}
function salirAdmin(caducada) {
  if (S.token && !caducada) call('logout', {}, true).catch(() => {});
  S.token = null; store.set('ej_tok', '');
  panel.hidden = true; document.body.classList.remove('ej-lock');
  if (caducada) toast('La sesión ha caducado, entra otra vez');
}
$('#aOut').addEventListener('click', () => { salirAdmin(); cargaLista(); });
async function cargaAdmin() {
  $('#aList').innerHTML = '<p class="ej-mut">Cargando…</p>';
  try { const r = await call('ejAdmin', {}, true); S.admin = r.lista || []; pintaAdmin(); }
  catch (e) { $('#aList').innerHTML = '<p class="ej-mut">' + esc(e.message) + '</p>'; }
}
function pintaAdmin() {
  const l = $('#aList');
  if (!S.admin.length) { l.innerHTML = '<p class="ej-mut">Aún no hay ejemplos. Añade el primero arriba.</p>'; return; }
  l.innerHTML = S.admin.map((x, i) => `
    <div class="ej-arow${x.activo ? '' : ' off'}" data-id="${esc(x.id)}">
      <div class="ej-aico">${icoHtml(x.icono)}</div>
      <div class="ej-ainfo"><b>${esc(x.titulo)}</b>${x.activo ? '' : ' <em>oculto</em>'}${x.encapsulado ? '' : ' <em>pestaña nueva</em>'}<small>${esc(x.url)}</small></div>
      <div class="ej-abtns">
        <button data-a="up" title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button data-a="down" title="Bajar" ${i === S.admin.length - 1 ? 'disabled' : ''}>↓</button>
        <button data-a="ver" title="Probar">👁</button>
        <button data-a="edit" title="Editar">✏️</button>
        <button data-a="del" title="Borrar">🗑</button>
      </div>
    </div>`).join('');
}
$('#aList').addEventListener('click', async e => {
  const b = e.target.closest('button[data-a]'); if (!b) return;
  const id = b.closest('.ej-arow').dataset.id, x = S.admin.find(r => r.id === id), a = b.dataset.a;
  if (a === 'edit') {
    form.id.value = x.id; form.titulo.value = x.titulo; form.url.value = x.url; form.desc.value = x.desc; form.icono.value = x.icono; pintaIcoForm();
    form.encapsulado.checked = x.encapsulado; form.activo.checked = x.activo;
    $('#fSave').firstElementChild.textContent = 'Guardar cambios'; $('#fCancel').hidden = false;
    panel.scrollTo({ top: 0, behavior: 'smooth' }); form.titulo.focus(); return;
  }
  if (a === 'ver') { window.open(x.url, '_blank', 'noopener'); return; }
  if (a === 'del' && !confirm('¿Borrar «' + x.titulo + '»?')) return;
  b.disabled = true;
  try {
    if (a === 'del') { await call('ejBorrar', { id }, true); toast('Borrado'); }
    else await call('ejMover', { id, dir: a }, true);
    await cargaAdmin();
  } catch (er) { toast(er.message); b.disabled = false; }
});
function resetForm() { form.reset(); form.id.value = ''; form.icono.value = ''; pintaIcoForm(); $('#fSave').firstElementChild.textContent = 'Añadir ejemplo'; $('#fCancel').hidden = true; }
$('#fCancel').addEventListener('click', resetForm);

/* ---------- Icono: elegir imagen ---------- */
function pintaIcoForm() {
  const v = form.icono.value;
  $('#icoPrev').innerHTML = v ? icoHtml(v) : '<span class="ej-ico-plus">＋<small>Imagen</small></span>';
  $('#icoQuitar').hidden = !v;
}
$('#icoPick').addEventListener('click', () => $('#icoFile').click());
$('#icoQuitar').addEventListener('click', () => { form.icono.value = ''; pintaIcoForm(); });
$('#icoFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  if (!/^image\//.test(f.type)) { toast('Elige una imagen'); return; }
  try { form.icono.value = await iconoDe(f); pintaIcoForm(); SFX.play('pop'); }
  catch (er) { toast('No se ha podido leer la imagen'); }
});
function iconoDe(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N;
      const c = cv.getContext('2d'), s = Math.min(img.width, img.height);
      c.imageSmoothingQuality = 'high';
      c.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, N, N); // recorte cuadrado al centro
      let d = cv.toDataURL('image/webp', .86);
      if (!/^data:image\/webp/.test(d) || d.length > 45000) {
        d = cv.toDataURL('image/png');
        if (d.length > 45000) { // sin webp y PNG muy pesado: JPG sobre fondo oscuro
          const c2 = document.createElement('canvas'); c2.width = c2.height = N; const x = c2.getContext('2d');
          x.fillStyle = '#0b1114'; x.fillRect(0, 0, N, N); x.drawImage(cv, 0, 0);
          d = c2.toDataURL('image/jpeg', .85);
        }
      }
      res(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    img.src = url;
  });
}
pintaIcoForm();
form.addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('#fMsg'), btn = $('#fSave'); msg.className = 'form-msg'; msg.textContent = '';
  let url = form.url.value.trim(); if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  btn.disabled = true;
  try {
    await callPost('ejGuardar', { id: form.id.value, titulo: form.titulo.value, url, desc: form.desc.value, icono: form.icono.value,
      encapsulado: form.encapsulado.checked ? '1' : '0', activo: form.activo.checked ? '1' : '0' }, true);
    SFX.play('success'); toast(form.id.value ? 'Cambios guardados ✅' : 'Ejemplo añadido ✅');
    resetForm(); await cargaAdmin(); cargaLista();
  } catch (er) { msg.textContent = er.message; msg.className = 'form-msg err'; SFX.play('error'); }
  finally { btn.disabled = false; }
});

/* ---------- Google Authenticator ---------- */
$('#aSec').addEventListener('click', secModal);
async function secModal() {
  const m = modal('<h3>🔐 Google Authenticator</h3><p class="ej-mut">Cargando…</p>');
  try {
    const st = await call('totpStatus', {}, true);
    m.innerHTML = '<h3>🔐 Google Authenticator</h3>' + (st.activo
      ? '<p class="ej-mut">✅ <b>Activado.</b> Para entrar pon el código de 6 cifras de Google Authenticator.</p><div class="ej-stack"><button class="btn btn-ghost" id="tRe">Volver a vincular</button><button class="btn btn-ghost" id="tOff">Desactivar</button></div>'
      : '<p class="ej-mut">Vincúlalo para poder entrar con el código de 6 cifras, sin llave.</p><div class="ej-stack"><button class="btn btn-primary" id="tOn"><span>Configurar</span></button></div>');
    const b = m.querySelector('#tOn') || m.querySelector('#tRe'); if (b) b.onclick = totpSetup;
    const off = m.querySelector('#tOff');
    if (off) off.onclick = async () => { if (!confirm('¿Desactivar el acceso con Google Authenticator?')) return; try { await call('totpDisable', {}, true); toast('Desactivado'); } catch (e) { toast(e.message); } secModal(); };
  } catch (e) { m.innerHTML = '<h3>🔐 Google Authenticator</h3><p class="ej-mut">' + esc(e.message) + '</p>'; }
}
async function totpSetup() {
  let d; try { d = await call('totpStart', {}, true); } catch (e) { toast(e.message); return; }
  const m = modal(`<h3>Vincular Google Authenticator</h3>
    <p class="ej-mut">1. En Google Authenticator pulsa <b>+</b> → <b>Escanear un código QR</b>:</p>
    <div class="ej-qr" id="tqr"></div>
    <p class="ej-mut" style="font-size:12px">¿Estás en este mismo móvil? <a href="${esc(d.uri)}" class="ej-link">Abrir en Authenticator</a> o elige «Introducir clave de configuración» y pega: <b class="ej-secret">${esc(d.secret)}</b></p>
    <form id="tcf" class="lead-form ej-login">
      <label><span>2. Escribe el código de 6 cifras que te sale</span><input id="tcd" inputmode="numeric" maxlength="6" placeholder="000000" class="ej-code"></label>
      <button class="btn btn-primary" type="submit"><span>Activar</span></button>
      <p class="form-msg" id="tMsg"></p>
    </form>`);
  new QRCode(m.querySelector('#tqr'), { text: d.uri, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
  m.querySelector('#tcf').addEventListener('submit', async e => {
    e.preventDefault();
    try { await call('totpConfirm', { cod: m.querySelector('#tcd').value.trim() }, true); closeModal(); SFX.play('success'); toast('Google Authenticator activado 🔐'); }
    catch (er) { const x = m.querySelector('#tMsg'); x.textContent = er.message; x.className = 'form-msg err'; SFX.play('error'); }
  });
}

/* ---------- Arranque ---------- */
cargaLista();
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!modalEl.hidden) closeModal(); else if (!viewer.hidden) $('#vBack').click(); } });
})();
