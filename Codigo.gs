/** FuturMovil · web — backend (Sheet vinculado "web") */
const ADMIN_EMAIL = 'futurmovil.com@gmail.com';
const HOJA = 'Contactos';
const CABECERA = ['Fecha', 'Nombre', 'Teléfono', 'Interés', 'Mensaje', 'Origen', 'Estado'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    if (p.action === 'lead') out = guardarLead_(p);
    else out = { ok: true, msg: 'FuturMovil API' };
  } catch (err) {
    out = { ok: false, error: String(err.message || err) };
  }
  const json = JSON.stringify(out);
  if (p.callback && /^[\w$]+$/.test(p.callback)) {
    return ContentService.createTextOutput(p.callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function hoja_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HOJA);
  if (!sh) {
    sh = ss.insertSheet(HOJA);
    sh.getRange(1, 1, 1, CABECERA.length).setValues([CABECERA]).setFontWeight('bold').setBackground('#0b1a10').setFontColor('#7dff5a');
    sh.setFrozenRows(1);
    sh.setColumnWidths(1, CABECERA.length, 160);
    sh.setColumnWidth(5, 360);
  }
  return sh;
}

function limpio_(v, max) {
  v = String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(v) ? "'" + v : v; // evita fórmulas inyectadas
}

function guardarLead_(p) {
  const nombre = limpio_(p.nombre, 80);
  const tel = limpio_(p.telefono, 20);
  if (nombre.length < 2 || tel.replace(/\D/g, '').length < 9) throw new Error('Datos incompletos');
  // anti-spam: mismo teléfono como máximo 1 vez cada 2 minutos
  const cache = CacheService.getScriptCache(), key = 'lead_' + tel.replace(/\D/g, '');
  if (cache.get(key)) return { ok: true, dup: true };
  cache.put(key, '1', 120);

  const fila = [new Date(), nombre, tel, limpio_(p.interes, 100), limpio_(p.mensaje, 600), limpio_(p.origen, 20), 'Nuevo'];
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { hoja_().appendRow(fila); } finally { lock.releaseLock(); }

  try {
    const wa = 'https://wa.me/34' + tel.replace(/\D/g, '').slice(-9);
    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: '📩 Nuevo contacto web: ' + nombre + ' (' + (fila[3] || 'sin interés marcado') + ')',
      htmlBody: '<h2 style="font-family:sans-serif">Nuevo contacto desde la web</h2>' +
        '<p style="font-family:sans-serif"><b>Nombre:</b> ' + esc_(nombre) + '<br><b>Teléfono:</b> ' + esc_(tel) +
        '<br><b>Interés:</b> ' + esc_(fila[3]) + '<br><b>Mensaje:</b> ' + esc_(fila[4]) + '<br><b>Origen:</b> ' + esc_(fila[5]) + '</p>' +
        '<p><a href="' + wa + '" style="background:#25d366;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-family:sans-serif">Responder por WhatsApp</a></p>'
    });
  } catch (err) { /* si falla el correo, el contacto ya está guardado */ }
  return { ok: true };
}

function esc_(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/** Ejecútala una vez desde el editor para autorizar y crear la hoja */
function configurar() {
  hoja_();
  MailApp.getRemainingDailyQuota();
}
