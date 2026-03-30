const express   = require('express');
const WebSocket  = require('ws');
const http       = require('http');
const path       = require('path');
const fs         = require('fs');
const { spawn }  = require('child_process');

const uuid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const PORT     = 3000;
const ROOT     = path.join(__dirname, '..');
const UI_DIR   = path.join(ROOT, 'ui');
const BIN      = path.join(ROOT, 'bin', 'ilker_compiler.exe');
const TEMP_DIR = path.join(ROOT, 'temp');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(UI_DIR));

// ===== PROJE API =====
const PROJ_FILE = path.join(ROOT, 'projeler.json');
const projelerOku = () => { try { return JSON.parse(fs.readFileSync(PROJ_FILE, 'utf8')); } catch { return []; } };
const projelerYaz = (d) => fs.writeFileSync(PROJ_FILE, JSON.stringify(d, null, 2));

app.get('/api/projeler',    (_, res) => res.json(projelerOku()));
app.post('/api/projeler',   (req, res) => {
    const p = projelerOku();
    // Yeni projede 'dosyalar' dizisi olsun, ana dosya ilk eleman olsun
    const yeni = { 
        id: uuid(), 
        ad: req.body.ad,
        tarih: new Date().toISOString(),
        dosyalar: [
            { id: uuid(), isim: req.body.dosya || 'main.ilk', icerik: req.body.kod || '', tip: 'dosya', path: req.body.dosya || 'main.ilk' }
        ]
    };
    p.push(yeni);
    projelerYaz(p);
    res.json(yeni);
});
app.delete('/api/projeler/:id', (req, res) => {
    projelerYaz(projelerOku().filter(p => p.id !== req.params.id));
    res.json({ ok: true });
});

// Yeni Dosya/Klasör Yönetimi API
app.post('/api/projeler/:id/dosya', (req, res) => {
    const p = projelerOku();
    const proj = p.find(x => x.id === req.params.id);
    if (!proj) return res.status(404).json({ hata: 'Proje bulunamadı' });
    
    const yeni = { id: uuid(), ...req.body }; // { isim, tip, path, icerik }
    proj.dosyalar = proj.dosyalar || [];
    proj.dosyalar.push(yeni);
    projelerYaz(p);
    res.json(yeni);
});

app.put('/api/projeler/:id/dosya/:fileId', (req, res) => {
    const p = projelerOku();
    const proj = p.find(x => x.id === req.params.id);
    if (!proj) return res.status(404).json({ hata: 'Proje bulunamadı' });
    
    const d = proj.dosyalar?.find(x => x.id === req.params.fileId);
    if (!d) return res.status(404).json({ hata: 'Dosya bulunamadı' });
    
    Object.assign(d, req.body);
    projelerYaz(p);
    res.json(d);
});

app.delete('/api/projeler/:id/dosya/:fileId', (req, res) => {
    const p = projelerOku();
    const proj = p.find(x => x.id === req.params.id);
    if (!proj) return res.status(404).json({ hata: 'Proje bulunamadı' });
    
    proj.dosyalar = proj.dosyalar?.filter(x => x.id !== req.params.fileId);
    projelerYaz(p);
    res.json({ ok: true });
});

// ===== WEBSOCKET =====
const islemler = new Map(); // id -> child_process

wss.on('connection', (ws) => {
    const id = uuid();
    const gonder = (obj) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); };

    gonder({ tip: 'BAGLANDI', id, derleyiciVar: fs.existsSync(BIN) });

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        switch (msg.tip) {
        case 'CALISTIR':
        case 'DEBUG_BASLAT':
            baslat(ws, id, msg, gonder);
            break;

        case 'STDIN_GONDER': {
            // Kullanıcı terminal'den girdi gönderdi → process stdin'e yaz
            const proc = islemler.get(id);
            if (proc?.stdin && !proc.stdin.destroyed) {
                proc.stdin.write((msg.veri ?? '') + '\n');
            }
            break;
        }

        case 'DUR': {
            const p = islemler.get(id);
            if (p) { try { p.kill(); } catch {} islemler.delete(id); }
            gonder({ tip: 'DURDURULDU', mesaj: 'Program durduruldu.' });
            break;
        }

        case 'DEBUG_DEVAM':  debugKomutu(id, 'DEVAM');  break;
        case 'DEBUG_ADIMLA': debugKomutu(id, 'ADIMLA'); break;
        case 'DEBUG_VARS':   debugKomutu(id, 'VARS?');  break;
        case 'BREAKPOINT_EKLE':  debugKomutu(id, `ADD ${msg.satir}`); break;
        case 'BREAKPOINT_CIKAR': debugKomutu(id, `REM ${msg.satir}`); break;
        case 'PING': gonder({ tip: 'PONG' }); break;
        }
    });

    ws.on('close', () => {
        const p = islemler.get(id);
        if (p) { try { p.kill(); } catch {} islemler.delete(id); }
    });
});

// ===== PROGRAM ÇALIŞTIR =====
function baslat(ws, id, msg, gonder) {
    if (!fs.existsSync(BIN)) {
        gonder({ tip: 'HATA', mesaj: 'Derleyici bulunamadı! derle.bat dosyasını çalıştırın.', kod: 'DERLEYICI_YOK' });
        return;
    }

    const eskiProc = islemler.get(id);
    if (eskiProc) { try { eskiProc.kill(); } catch {} }

    const debugMod     = msg.tip === 'DEBUG_BASLAT';
    const geciciDosya  = path.join(TEMP_DIR, `kod_${id}.ilk`);

    try { fs.writeFileSync(geciciDosya, msg.kod, 'utf8'); }
    catch (e) { gonder({ tip: 'HATA', mesaj: 'Dosya yazılamadı: ' + e.message }); return; }

    gonder({ tip: 'BASLADI', mesaj: debugMod ? '🐛 Debug başlatıldı…' : '▶ Program çalışıyor…', debugMod });

    const proc = spawn(BIN, [debugMod ? '--debug' : '--calistir', geciciDosya], {
        cwd: ROOT,
        // stdin açık bırakıyoruz — kullanıcıdan girdi gelebilir
    });
    islemler.set(id, proc);

    // Debug breakpoint'leri
    if (debugMod && msg.breakpointler?.length) {
        setTimeout(() => {
            for (const bp of msg.breakpointler) {
                if (!proc.stdin.destroyed) proc.stdin.write(`ADD ${bp}\n`);
            }
        }, 200);
    }

    // ===== STDOUT =====
    let tampon = '';
    // stdin bekleme tespiti: process'in stdin'i beklerken stdout durur.
    // Bunu tespit etmek için: stdout'a belirli süre yeni veri gelmezse
    // ve process hâlâ çalışıyorsa INPUT_GEREKLI gönder.
    let stdinTimer = null;
    let stdinBekliyor = false;

    function stdinTimerSifirla() {
        if (stdinTimer) clearTimeout(stdinTimer);
        stdinBekliyor = false;
        stdinTimer = setTimeout(() => {
            // Hâlâ çalışıyor ama çıktı durdu → stdin bekliyor olabilir
            if (islemler.has(id) && !stdinBekliyor) {
                stdinBekliyor = true;
                gonder({ tip: 'INPUT_GEREKLI', prompt: '' });
            }
        }, 300); // 300ms sessizlik → stdin bekleme sinyali
    }

    proc.stdout.on('data', (chunk) => {
        stdinTimerSifirla(); // Yeni çıktı geldi, saat sıfırla
        stdinBekliyor = false;

        tampon += chunk.toString('utf8');
        let idx;
        while ((idx = tampon.indexOf('\n')) !== -1) {
            const satir = tampon.slice(0, idx).replace(/\r$/, '');
            tampon = tampon.slice(idx + 1);
            if (!satir) continue;

            // Debug protokolü
            if (satir.startsWith('DEBUG_MSG:')) {
                try {
                    const d = JSON.parse(satir.slice('DEBUG_MSG:'.length));
                    switch (d.tip) {
                    case 'HAZIR':        gonder({ tip: 'DEBUG_HAZIR', mesaj: d.mesaj }); break;
                    case 'DURAKLATILDI': gonder({ tip: 'DEBUG_DURAKLATILDI', satir: d.satir, degiskenler: d.degiskenler || {} }); break;
                    case 'BITTI':        gonder({ tip: 'DEBUG_BITTI', mesaj: d.mesaj }); break;
                    default:             gonder({ tip: 'DEBUG_' + d.tip, ...d });
                    }
                } catch { gonder({ tip: 'CIKTI', metin: satir }); }

            } else if (satir.startsWith('VARS:')) {
                try {
                    const vars = JSON.parse(satir.slice(5));
                    gonder({ tip: 'DEGISKENLER', degiskenler: vars });
                } catch { gonder({ tip: 'CIKTI', metin: satir }); }

            } else {
                // Normal çıktı → browser'a gönder
                gonder({ tip: 'CIKTI', metin: satir });
                stdinTimerSifirla(); // Her çıktıdan sonra yeniden bekle
            }
        }
    });

    // ===== STDERR → Satır bazlı hata parse =====
    proc.stderr.on('data', (chunk) => {
        const metin = chunk.toString('utf8').trim();
        if (!metin) return;

        for (const satir of metin.split('\n')) {
            const s = satir.replace(/\r$/, '').trim();
            if (!s) continue;

            // Browser'a ham hata metnini de göster
            gonder({ tip: 'HATA_CIKTI', metin: s });

            // Format 1: HATA [Satır X]: mesaj
            let m = s.match(/HATA\s*\[Sat[ıi]r\s*(\d+)\]:\s*(.+)/i);
            if (m) { gonder({ tip: 'DERLEME_HATASI', satir: parseInt(m[1]), mesaj: m[2].trim() }); continue; }

            // Format 2: Hata (satir X): mesaj (Runtime hataları için)
            m = s.match(/Hata\s*\(satir\s*(\d+)\):\s*(.+)/i);
            if (m) { gonder({ tip: 'DERLEME_HATASI', satir: parseInt(m[1]), mesaj: m[2].trim() }); continue; }

            // Format 3: [X:Y] Beklenmeyen token
            m = s.match(/\[(\d+):(\d+)\]\s*(.+)/);
            if (m) { gonder({ tip: 'DERLEME_HATASI', satir: parseInt(m[1]), mesaj: m[3].trim() }); continue; }

            // Format 5: HATA: mesaj (satır 1 kabul)
            m = s.match(/^HATA:\s*(.+)/i);
            if (m) { gonder({ tip: 'DERLEME_HATASI', satir: 1, mesaj: m[1].trim() }); continue; }

            // Format 6: Parser hatası "Beklenen: X, Bulunan: Y" (satır bilgisi stderr'den)
            m = s.match(/Beklenen:\s*.+,\s*Bulunan:/i);
            if (m) { gonder({ tip: 'DERLEME_HATASI', satir: 1, mesaj: s }); continue; }
        }
    });

    proc.on('close', (code) => {
        if (stdinTimer) clearTimeout(stdinTimer);
        islemler.delete(id);
        try { if (fs.existsSync(geciciDosya)) fs.unlinkSync(geciciDosya); } catch {}
        gonder({ tip: 'BITTI', mesaj: `Program bitti (çıkış kodu: ${code})`, cikisKodu: code });
    });

    proc.on('error', (e) => {
        gonder({ tip: 'HATA', mesaj: 'İşlem hatası: ' + e.message });
    });
}

function debugKomutu(id, komut) {
    const proc = islemler.get(id);
    if (proc?.stdin && !proc.stdin.destroyed) proc.stdin.write(komut + '\n');
}

server.listen(PORT, () => {
    console.log('\n╔══════════════════════════════╗');
    console.log('║   İlker Studio IDE v1.0      ║');
    console.log('╠══════════════════════════════╣');
    console.log(`║  http://localhost:${PORT}         ║`);
    console.log(`║  Derleyici: ${fs.existsSync(BIN) ? '✓ HAZIR       ║' : '✗ YOK (derle.bat) ║'}`);
    console.log('╚══════════════════════════════╝');
    console.log('  Ctrl+C ile durdur\n');
});
