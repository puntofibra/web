/* FuturMovil · web */
(() => {
'use strict';
const API = 'https://script.google.com/macros/s/AKfycbyvmIoIMhLIIdVKYKLLr7vpea1k6iZMJoVTLVGvuYFVNrtYf2mEOzkpz5Hb1Ab-jiHHgw/exec'; // URL /exec de Apps Script (se rellena al implementar)
const WA_NUM = '34633200100';
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

/* ---------- WhatsApp ---------- */
$$('[data-wa]').forEach(a => a.href = `https://wa.me/${WA_NUM}?text=${encodeURIComponent(a.dataset.wa)}`);
setTimeout(() => { const f = $('.wa-float'); f.classList.add('tip'); setTimeout(() => f.classList.remove('tip'), 3500); }, 6000);

/* ---------- Intro ---------- */
addEventListener('load', () => setTimeout(() => $('#intro').classList.add('done'), reduce ? 0 : 1300));
setTimeout(() => $('#intro').classList.add('done'), 4000);

/* ---------- Header ---------- */
const top = $('.top');
const onScroll = () => top.classList.toggle('scrolled', scrollY > 30);
addEventListener('scroll', onScroll, { passive: true }); onScroll();
const navLinks = $$('.nav a');
const secObs = new IntersectionObserver(es => es.forEach(en => {
  if (en.isIntersecting) navLinks.forEach(a => a.classList.toggle('act', a.getAttribute('href') === '#' + en.target.id));
}), { rootMargin: '-45% 0px -50% 0px' });
$$('section[id]').forEach(s => secObs.observe(s));

/* ---------- Reveal + whoosh ---------- */
let lastWhoosh = 0;
const rev = new IntersectionObserver(es => es.forEach(en => {
  if (!en.isIntersecting) return;
  const el = en.target;
  const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
  el.style.transitionDelay = (sibs.indexOf(el) * 0.08) + 's';
  el.classList.add('in'); rev.unobserve(el);
  if (el.classList.contains('sec-head') && performance.now() - lastWhoosh > 900) { lastWhoosh = performance.now(); SFX.play('whoosh'); }
}), { threshold: .14, rootMargin: '0px 0px -40px 0px' });
$$('.reveal').forEach(el => rev.observe(el));

/* ---------- Typed ---------- */
const words = ['fibra óptica', 'líneas móviles', 'todo el fútbol', 'cine y series', 'apps para iPhone', 'apps Android', 'webs a medida'];
const typed = $('#typed');
let wi = 0, ci = words[0].length, del = true;
const tick = () => {
  const w = words[wi];
  if (del) { ci--; if (ci <= 0) { del = false; wi = (wi + 1) % words.length; } }
  else { ci++; if (ci >= words[wi].length) { del = true; typed.textContent = words[wi]; return setTimeout(tick, 1900); } }
  typed.textContent = words[wi].slice(0, Math.max(ci, 0)) || '​';
  setTimeout(tick, del ? 38 : 75);
};
setTimeout(tick, 2600);

/* ---------- Contadores ---------- */
const cntObs = new IntersectionObserver(es => es.forEach(en => {
  if (!en.isIntersecting) return;
  const el = en.target, to = +el.dataset.count, suf = el.dataset.suffix || '', t0 = performance.now();
  const step = now => { const p = Math.min((now - t0) / 1400, 1), v = Math.round(to * (1 - Math.pow(1 - p, 3))); el.textContent = v + suf; if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step); cntObs.unobserve(el);
}), { threshold: .6 });
$$('[data-count]').forEach(el => cntObs.observe(el));

/* ---------- Tilt 3D + brillo ---------- */
if (!isTouch && !reduce) {
  $$('.tilt').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.transform = `perspective(900px) rotateX(${(.5 - y) * 10}deg) rotateY(${(x - .5) * 12}deg) translateZ(0)`;
      el.style.setProperty('--mx', x * 100 + '%'); el.style.setProperty('--my', y * 100 + '%');
    });
    el.addEventListener('pointerleave', () => { el.style.transition = 'transform .6s'; el.style.transform = ''; setTimeout(() => el.style.transition = '', 600); });
  });
  $$('.magnetic').forEach(el => {
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.transform = `translate(${(e.clientX - r.left - r.width/2) * .18}px,${(e.clientY - r.top - r.height/2) * .25}px)`; });
    el.addEventListener('pointerleave', () => el.style.transform = '');
  });
  const glow = $('.cursor-glow');
  addEventListener('pointermove', e => glow.style.transform = `translate(${e.clientX}px,${e.clientY}px)`, { passive: true });
}

/* ---------- Código que se escribe solo ---------- */
const codeEl = $('#codeType');
const code = [
  ['c','// Tu app, a tu medida\n'],
  ['k','const '],['','app = '],['f','crearApp'],['','({\n'],
  ['','  cliente: '],['s','"Tu negocio"'],[',',',\n'],
  ['','  plataformas: ['],['s','"iOS"'],['',', '],['s','"Android"'],['',', '],['s','"Web"'],['','],\n'],
  ['','  precio: '],['s','"competitivo"'],['',',\n'],
  ['','  soporte: '],['k','true'],['','\n});\n'],
  ['f','app'],['','.'],['f','lanzar'],['','(); '],['c','// 🚀']
];
let codeStarted = false, codeVisible = false;
const typeCode = async () => {
  if (codeStarted) return; codeStarted = true;
  for (;;) {
    codeEl.innerHTML = '';
    for (const [cls, txt] of code) {
      const span = document.createElement('span'); if (cls && cls !== ',') span.className = cls; codeEl.appendChild(span);
      for (const ch of txt) { span.textContent += ch; if (codeVisible && !document.hidden && ch.trim() && Math.random() < .35) SFX.play('type'); await new Promise(r => setTimeout(r, reduce ? 0 : 28 + Math.random() * 40)); }
    }
    await new Promise(r => setTimeout(r, 4000));
  }
};
// el sonido de tecleo solo suena mientras la animación se ve en pantalla
new IntersectionObserver(es => { codeVisible = es[0].isIntersecting; if (codeVisible) typeCode(); }, { threshold: .3 }).observe(codeEl);
// contador del móvil
const ps = $('#psCount'), psPlus = $('#psPlus'); let psv = 1250;
ps.textContent = psv.toLocaleString('es-ES');
setInterval(() => {
  const n = [10, 10, 25, 50][Math.floor(Math.random() * 4)];
  psv = psv > 99000 ? 1250 : psv + n; ps.textContent = psv.toLocaleString('es-ES');
  psPlus.textContent = '+' + n; psPlus.classList.remove('go'); void psPlus.offsetWidth; psPlus.classList.add('go');
}, 1600);

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

/* ---------- PWA: instalar ---------- */
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
const ua = navigator.userAgent;
const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isSafari = isIOS && !/crios|fxios|edgios|opios|gsa\//i.test(ua);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const installBtn = $('#installBtn');
// El evento de instalación se captura en <head> (puede llegar antes de que cargue este script)
let deferred = window.__bip || null;
const showInstall = () => { deferred = window.__bip || deferred; if (deferred && !standalone) installBtn.hidden = false; };
showInstall();
addEventListener('bip-ready', showInstall);
addEventListener('appinstalled', () => { installBtn.hidden = true; toast('¡App instalada! 🎉'); SFX.play('success'); });
// En móvil el botón sale siempre (Chrome a veces no avisa tras desinstalar); en PC solo si el navegador lo permite
const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua) || isIOS;
if (isMobile && !standalone) installBtn.hidden = false;
const openModal = m => { m.hidden = false; };
const closeModal = m => { m.hidden = true; };
$$('.modal').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('.modal-x')) closeModal(m); });
});
const waitBip = ms => new Promise(res => {
  if (window.__bip) return res(window.__bip);
  const f = () => res(window.__bip); addEventListener('bip-ready', f, { once: true });
  setTimeout(() => { removeEventListener('bip-ready', f); res(window.__bip || null); }, ms);
});
installBtn.addEventListener('click', async () => {
  // En Android el aviso de Chrome puede llegar tarde: lo esperamos un momento antes de explicar a mano
  if (!deferred && !isIOS) { toast('Preparando la instalación…'); deferred = await waitBip(3000); }
  if (deferred) {
    let ok = false;
    try { deferred.prompt(); const r = await deferred.userChoice; ok = r && r.outcome === 'accepted'; } catch (e) {}
    deferred = null; window.__bip = null;
    if (ok || !isMobile) installBtn.hidden = true;
    return;
  }
  if (isIOS) { $('#iosNotSafari').hidden = isSafari; openModal($('#iosModal')); return; }
  if (/android/i.test(ua)) {
    // Chrome aún no ha dado permiso (pasa tras borrar datos o desinstalar): avisamos cuando lo dé
    waitingBip = true;
    toast('Chrome está preparando la instalación. Mira la web unos segundos y vuelve a pulsar «Instalar».', 6000);
    return;
  }
  toast('Usa el menú del navegador → «Instalar aplicación»');
});
let waitingBip = false;
addEventListener('bip-ready', () => {
  if (!waitingBip) return; waitingBip = false;
  toast('¡Listo! Pulsa «Instalar» para instalar la app', 5000);
  installBtn.classList.add('install-ready'); setTimeout(() => installBtn.classList.remove('install-ready'), 6000);
});
// En iPhone, mostrar las instrucciones una vez automáticamente
if (isIOS && !standalone && store.get('fm_ios_tip') !== '1') {
  setTimeout(() => { store.set('fm_ios_tip', '1'); $('#iosNotSafari').hidden = isSafari; openModal($('#iosModal')); }, 9000);
}

/* ---------- Compartir ---------- */
$('#shareBtn').addEventListener('click', async () => {
  const data = { title: 'FuturMovil', text: 'Fibra, móvil, TV con fútbol y apps a medida 👉', url: location.href.split('#')[0] };
  if (navigator.share) { try { await navigator.share(data); } catch (e) {} return; }
  try { await navigator.clipboard.writeText(data.url); toast('Enlace copiado ✅'); } catch (e) { prompt('Copia el enlace:', data.url); }
});

/* ---------- Toast ---------- */
let tt;
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), ms); }

/* ---------- Formulario → Sheet ---------- */
const jsonp = (url, params) => new Promise((res, rej) => {
  const cb = 'cb' + Date.now() + Math.floor(Math.random() * 1e4);
  const s = document.createElement('script');
  const to = setTimeout(() => { cleanup(); rej(new Error('timeout')); }, 15000);
  const cleanup = () => { clearTimeout(to); delete window[cb]; s.remove(); };
  window[cb] = d => { cleanup(); res(d); };
  s.onerror = () => { cleanup(); rej(new Error('net')); };
  s.src = url + '?' + new URLSearchParams({ ...params, callback: cb });
  document.body.appendChild(s);
});
const form = $('#leadForm'), msg = $('#formMsg');
form.addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(form);
  const data = {
    action: 'lead',
    nombre: (fd.get('nombre') || '').trim(),
    telefono: (fd.get('telefono') || '').trim(),
    interes: fd.getAll('interes').join(', '),
    mensaje: (fd.get('mensaje') || '').trim(),
    origen: standalone ? 'app' : (isTouch ? 'móvil' : 'pc')
  };
  if (data.nombre.length < 2 || data.telefono.replace(/\D/g, '').length < 9) {
    msg.textContent = 'Pon tu nombre y un teléfono válido.'; msg.className = 'form-msg err'; SFX.play('error'); return;
  }
  const btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.firstElementChild.textContent = 'Enviando…';
  msg.textContent = ''; msg.className = 'form-msg';
  try {
    if (!API) throw new Error('noapi');
    const r = await jsonp(API, data);
    if (!r || !r.ok) throw new Error(r && r.error || 'err');
    form.reset(); SFX.play('success'); openModal($('#success'));
  } catch (err) {
    // Si falla el envío, se abre WhatsApp con los datos para no perder el contacto
    const txt = `Hola Manu, soy ${data.nombre} (${data.telefono}). Me interesa: ${data.interes || '—'}. ${data.mensaje}`;
    msg.innerHTML = `No se pudo enviar. <a href="https://wa.me/${WA_NUM}?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener" style="color:var(--g);text-decoration:underline">Envíalo por WhatsApp</a>`;
    msg.className = 'form-msg err'; SFX.play('error');
  } finally { btn.disabled = false; btn.firstElementChild.textContent = 'Enviar'; }
});

$('#year').textContent = new Date().getFullYear();

/* ---------- Contador de visitas (1 por dispositivo y día) ---------- */
(async () => {
  if (!API) return;
  let id;
  try {
    id = localStorage.getItem('fm_dev');
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); localStorage.setItem('fm_dev', id); }
  } catch (e) { id = 'anon-' + Math.random().toString(36).slice(2); }
  try {
    const r = await jsonp(API, { action: 'visita', id });
    if (r && r.ok) {
      $('#visHoy').textContent = r.hoy.toLocaleString('es-ES');
      $('#visTxt').textContent = r.hoy === 1 ? 'visita hoy' : 'visitas hoy';
      $('#visitas').hidden = false;
    }
  } catch (e) {}
})();
})();
