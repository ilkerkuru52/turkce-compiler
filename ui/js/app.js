// app.js — İlker Studio IDE (Tam Revizyon)
// OnlineGDB tarzı: gerçek stdin/stdout, satır hata işaretleme, drag-resize
'use strict';

const WS_URL = 'ws://localhost:3000';

// ===== ÖRNEKLER =====
const ORNEKLER = {
    'merhaba.ilk':
`yazdir "Merhaba Dünya!";
degisken x = 42;
yazdir "Cevap: " + str(x);`,

    'kullanici_girdisi.ilk':
`degisken isim;
degisken yas;
yazdir "Adınızı girin:";
oku isim;
yazdir "Yaşınızı girin:";
oku yas;
yazdir "Merhaba " + isim + "! " + yas + " yaşındasın.";`,

    'fibonacci.ilk':
`fonksiyon fib(n) {
    eger (n <= 1) { geridor n; }
    geridor fib(n-1) + fib(n-2);
}
dongu (degisken i=0; i<10; i++) {
    yazdir "F(" + str(i) + ") = " + str(fib(i));
}`,

    'asal_sayilar.ilk':
`fonksiyon asal_mi(n) {
    eger (n < 2) { geridor yanlis; }
    dongu (degisken i=2; i*i<=n; i++) {
        eger (n%i == 0) { geridor yanlis; }
    }
    geridor dogru;
}
dongu (degisken i=2; i<=30; i++) {
    eger (asal_mi(i)) { yazdir str(i) + " asal sayıdır"; }
}`,

    'listeler.ilk':
`degisken sayilar = [10, 20, 30, 40, 50];
dongu (degisken i=0; i<uzunluk(sayilar); i++) {
    yazdir str(i+1) + ". eleman: " + str(sayilar[i]);
}`,

    'hesap_makinesi.ilk':
`degisken a;
degisken b;
degisken islem;
yazdir "=== Hesap Makinesi ===";
yazdir "Birinci sayı:";
oku a;
yazdir "İkinci sayı:";
oku b;
degisken sa = sayi(a);
degisken sb = sayi(b);
yazdir "Toplam: " + str(sa + sb);
yazdir "Fark: " + str(sa - sb);
yazdir "Çarpım: " + str(sa * sb);
eger (sb != 0) {
    yazdir "Bölüm: " + str(sa / sb);
} yoksa {
    yazdir "Sıfıra bölme!";
}`,

    'bubble_sort.ilk':
`fonksiyon bubbleSort(dizi) {
    degisken n = uzunluk(dizi);
    dongu (degisken i = 0; i < n - 1; i++) {
        dongu (degisken j = 0; j < n - i - 1; j++) {
            eger (dizi[j] > dizi[j+1]) {
                degisken temp = dizi[j];
                dizi[j] = dizi[j+1];
                dizi[j+1] = temp;
            }
        }
    }
    geridor dizi;
}

degisken list = [64, 34, 25, 12, 22, 11, 90];
yazdir "Orijinal: " + str(list);
degisken sirali = bubbleSort(list);
yazdir "Sıralı:   " + str(sirali);`,

    'matematik_test.ilk':
`// Standart kütüphane testi
yazdir "PI: " + str(mutlak(-3.14));
yazdir "Karekök 16: " + str(kok(16));
yazdir "Yuvarlak 3.7: " + str(yuvarlak(3.7));
yazdir "Max(10, 20): " + str(max(10, 20));

degisken d = [1, 2, 3];
ekle(d, 4);
yazdir "Yeni Liste: " + str(d);
yazdir "Uzunluk: " + str(uzunluk(d));`,
};

const ST = {
    ws: null, bagli: false, calisiyor: false,
    debugAktif: false, debugDuraklatildi: false,
    dosyalar: [], aktifIdx: 0, projeler: [],
    aktifProjeId: null, // Mevcut aktif projenin ID'si
    treeData: [], // Ağaç yapısı için veri
    stdinBekliyor: false,
    girisMimarisi: [],
    hataListesi: [],
    aktifTema: 'karanlik',
    ayarlar: { fontSize: 14, tabSize: 4, minimap: true, wordWrap: 'off' }
};

// ===== BAŞLAT =====
window._baslatFn = async function () {
    wsBaslat();
    projeleriYukle();
    rezizeKur();
    terminalKisayolKur();
    ayarlariYukle();

    // DOM Hazır mı kontrolü
    if (!document.getElementById('ornekler-listesi')) {
        setTimeout(window._baslatFn, 100);
        return;
    }

    ornekleriYukle();
    const hosBonkod = `// İlker Studio IDE — Hoş Geldiniz!
// Türkçe .ilk programlama dili
// Çalıştırmak için: F5 veya ▶ Çalıştır butonuna basın

yazdir "Merhaba, Dünya!";

degisken isim;
yazdir "Adın nedir?";
oku isim;
yazdir "Hoş geldin, " + isim + "!";

degisken x = 10;
degisken y = 20;
yazdir "Toplam: " + str(x + y);
`;
    window._baslangicKod = hosBonkod;
    ST.dosyalar = [];
    yeniTab('merhaba.ilk', hosBonkod);
    if (window.editorApi) window.editorApi.editorDegerAta(hosBonkod);
    tabGuncelle();

    document.addEventListener('keydown', klavyeIsle);
};

function klavyeIsle(e) {
    if (e.key === 'F5' && !e.ctrlKey)   { e.preventDefault(); kodCalistir(false); }
    if (e.key === 'F9')                  { e.preventDefault(); kodCalistir(true); }
    if (e.key === 'F10')                 { e.preventDefault(); debugAdim(); }
    if (e.ctrlKey && e.key === 's')      { e.preventDefault(); dosyaKaydet(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'S') { e.preventDefault(); dosyaFarkliKaydet(); }
    if (e.ctrlKey && e.key === 'n')      { e.preventDefault(); yeniDosya(); }
    if (e.ctrlKey && e.key === 'o')      { e.preventDefault(); dosyaAc(); }
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
}

// ===== WEBSOCKET =====
function wsBaslat() {
    if (ST.ws && ST.ws.readyState <= 1) return;
    try {
        const dot = document.getElementById('conn-dot');
        const txt = document.getElementById('conn-text');
        if (dot) dot.className = 'connecting';
        if (txt) txt.textContent = 'Bağlanıyor…';

        ST.ws = new WebSocket(WS_URL);
        ST.ws.onopen  = () => { ST.bagli = true;  baglantiGoster(true); };
        ST.ws.onclose = () => { ST.bagli = false; baglantiGoster(false); setTimeout(wsBaslat, 3000); };
        ST.ws.onerror = () => { baglantiGoster(false); };
        ST.ws.onmessage = e => { try { mesajIsle(JSON.parse(e.data)); } catch {} };
    } catch { baglantiGoster(false); setTimeout(wsBaslat, 3000); }
}
window.addEventListener('DOMContentLoaded', wsBaslat);

window.gonder = function (obj) {
    if (ST.ws?.readyState === WebSocket.OPEN) { ST.ws.send(JSON.stringify(obj)); return true; }
    ciktiEkle('❌ Sunucuya bağlı değil. calistir.bat dosyasını çalıştırın.', 'hata');
    return false;
};

// ===== MESAJLAR =====
function mesajIsle(m) {
    switch (m.tip) {
    case 'BAGLANDI':
        baglantiGoster(true);
        ciktiEkle(
            '✅ Sunucu bağlandı — Derleyici: ' + (m.derleyiciVar ? '✓ HAZIR' : '⚠ YOK (derle.bat çalıştırın)'),
            m.derleyiciVar ? 'sistem' : 'hata'
        );
        break;

    case 'BASLADI':
        ST.calisiyor = true;
        ST.stdinBekliyor = false;
        hatalariTemizle();
        ciktiTemizle();
        terminalGizle();
        ciktiEkle(m.mesaj, 'bilgi');
        document.getElementById('cikti-live').style.display = 'inline';
        progressGoster(true);
        durumGuncelle();
        break;

    case 'CIKTI':
        ciktiEkle(m.metin, 'normal');
        break;

    case 'HATA_CIKTI':
        ciktiEkle(m.metin, 'hata');
        break;

    case 'DERLEME_HATASI':
        // Satır numaralı hata → Monaco marker + Sorunlar paneli
        sorunEkle(m.satir, m.mesaj, 'error');
        window.editorApi?.hataMarkerEkle(m.satir, m.mesaj);
        break;

    case 'INPUT_GEREKLI':
        // Compiler oku komutunu çalıştırıyor, stdin bekliyor
        ST.stdinBekliyor = true;
        terminalGoster(m.prompt || '');
        break;

    case 'BITTI':
        ST.calisiyor = false;
        ST.debugAktif = false;
        ST.debugDuraklatildi = false;
        ST.stdinBekliyor = false;
        window.editorApi?.dbgSatirlariKaldir();
        document.getElementById('cikti-live').style.display = 'none';
        progressGoster(false);
        terminalGizle();
        if (m.cikisKodu === 0) {
            ciktiEkle('─────────────────', 'sistem');
            ciktiEkle('✅ ' + m.mesaj, 'basari');
            // Eğer sorun yoksa sorunlar paneline "temiz" yaz
            if (ST.hataListesi.length === 0) sorunlarGoster();
        } else {
            ciktiEkle('─────────────────', 'sistem');
            ciktiEkle('❌ ' + m.mesaj, 'hata');
        }
        durumGuncelle();
        break;

    case 'DURDURULDU':
        ST.calisiyor = false;
        ST.stdinBekliyor = false;
        document.getElementById('cikti-live').style.display = 'none';
        progressGoster(false);
        terminalGizle();
        ciktiEkle('⛔ ' + m.mesaj, 'sistem');
        durumGuncelle();
        break;

    case 'HATA':
        ciktiEkle('❌ ' + m.mesaj, 'hata');
        if (m.kod === 'DERLEYICI_YOK') {
            ciktiEkle('  → derle.bat dosyasını çalıştırın (MinGW/g++ gerekli)', 'sistem');
        }
        progressGoster(false);
        ST.calisiyor = false;
        durumGuncelle();
        break;

    case 'DEBUG_HAZIR':
        ST.debugAktif = true;
        ST.calisiyor = true; // Debug başladığında çalışıyor kabul et
        ciktiEkle('🐛 ' + m.mesaj, 'debug');
        durumGuncelle();
        break;

    case 'DEBUG_DURAKLATILDI':
        ST.debugDuraklatildi = true;
        window.editorApi?.dbgSatirlariGoster(m.satir);
        window.editorApi?.setDebugVars(m.degiskenler || {});
        degiskenlerGuncelle(m.degiskenler || {});
        ciktiEkle('⏸ Satır ' + m.satir + '\'de duraklatıldı', 'debug');
        bottomTab('degiskenler');
        durumGuncelle();
        break;

    case 'DEBUG_BITTI':
        ST.debugAktif = false;
        ST.debugDuraklatildi = false;
        window.editorApi?.dbgSatirlariKaldir();
        window.editorApi?.setDebugVars({});
        ciktiEkle('🏁 ' + m.mesaj, 'debug');
        durumGuncelle();
        break;

    case 'DEGISKENLER':
        degiskenlerGuncelle(m.degiskenler || {});
        break;
    }
}

// ===== ÇALIŞTIR =====
window.kodCalistir = function (debugModu) {
    if (ST.calisiyor) { ciktiEkle('⚠️ Program zaten çalışıyor!', 'sistem'); return; }
    const kod = window.editorApi?.editorDegerAl() || '';
    if (!kod.trim()) { ciktiEkle('⚠️ Editörde kod yok.', 'sistem'); return; }
    window.gonder({
        tip: debugModu ? 'DEBUG_BASLAT' : 'CALISTIR',
        kod,
        breakpointler: window.editorApi?.breakpointleriAl() || []
    });
};
window.programiDurdur = () => window.gonder({ tip: 'DUR' });
window.debugDevam = function () {
    window.gonder({ tip: 'DEBUG_DEVAM' });
    ST.debugDuraklatildi = false;
    window.editorApi?.dbgSatirlariKaldir();
    durumGuncelle();
};
window.debugAdim = function () {
    window.gonder({ tip: 'DEBUG_ADIMLA' });
    ST.debugDuraklatildi = false;
    window.editorApi?.dbgSatirlariKaldir();
    window.editorApi?.setDebugVars({});
};

// ===== İNTERAKTİF TERMİNAL =====
function terminalGoster(prompt) {
    const area = document.getElementById('terminal-input-area');
    const inp  = document.getElementById('terminal-input');
    if (area) {
        area.classList.add('visible');
        if (prompt) {
            ciktiEkle(prompt, 'bilgi'); // Kullanıcıya ne girilmesi gerektiğini göster
        }
    }
    if (inp) {
        inp.value = '';
        setTimeout(() => inp.focus(), 50);
    }
}
function terminalGizle() {
    document.getElementById('terminal-input-area')?.classList.remove('visible');
    const inp = document.getElementById('terminal-input');
    if (inp) inp.value = '';
}
window.terminalGonder = function () {
    const inp = document.getElementById('terminal-input');
    if (!inp) return;
    const deger = inp.value;
    // Girilen değeri çıktıya da ekle (echo)
    ciktiEkle('» ' + deger, 'sistem');
    window.gonder({ tip: 'STDIN_GONDER', veri: deger });
    inp.value = '';
    inp.focus();
    // Gönderildikten sonra input alanını kapat (compiler tekrar isteyene kadar)
    terminalGizle();
    ST.stdinBekliyor = false;
};
function terminalKisayolKur() {
    const inp = document.getElementById('terminal-input');
    if (!inp) return;
    inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); window.terminalGonder(); }
    });
}

// Server'dan INPUT_GEREKLI geldiğinde — ancak mevcut compiler bunu göndermiyorsa
// stdout'tan "INPUT:" prefix'i ile de algılıyoruz (sunucu tarafı ile uyumlu):
// Bu özellik server/index.js güncellenmesiyle aktif olacak.

// ===== SEKMELER =====
function yeniTab(isim, icerik) {
    ST.dosyalar.push({ isim, icerik: icerik ?? '// ' + isim + '\nyazdir "Merhaba!";', degisti: false });
    ST.aktifIdx = ST.dosyalar.length - 1;
}
function tabGuncelle() {
    const tabs = document.getElementById('tabs');
    if (tabs) tabs.innerHTML = ST.dosyalar.map((f, i) =>
        '<div class="tab ' + (i === ST.aktifIdx ? 'active' : '') + '" onclick="tabSec(' + i + ')">' +
        '<span class="tab-name">📄 ' + esc(f.isim) + '</span>' +
        (f.degisti ? '<span class="tab-mod">●</span>' : '') +
        '<span class="tab-close" onclick="tabKapat(event,' + i + ')">✕</span></div>'
    ).join('');

    const acik = document.getElementById('acik-dosyalar');
    if (acik) acik.innerHTML = ST.dosyalar.map((f, i) =>
        '<div class="file-item ' + (i === ST.aktifIdx ? 'active' : '') + '" onclick="tabSec(' + i + ')">📄 ' + esc(f.isim) + '</div>'
    ).join('');
}
window.tabSec = function (idx) {
    if (ST.dosyalar[ST.aktifIdx]) ST.dosyalar[ST.aktifIdx].icerik = window.editorApi?.editorDegerAl() || ST.dosyalar[ST.aktifIdx].icerik;
    ST.aktifIdx = idx;
    window.editorApi?.editorDegerAta(ST.dosyalar[idx].icerik);
    tabGuncelle();
};
window.tabKapat = function (e, idx) {
    e.stopPropagation();
    if (ST.dosyalar[idx]?.degisti && !confirm('"' + ST.dosyalar[idx].isim + '" kaydedilmedi. Kapat?')) return;
    ST.dosyalar.splice(idx, 1);
    if (!ST.dosyalar.length) yeniTab('yeni.ilk', '// Yeni dosya\nyazdir "Merhaba!";');
    ST.aktifIdx = Math.min(idx, ST.dosyalar.length - 1);
    window.editorApi?.editorDegerAta(ST.dosyalar[ST.aktifIdx].icerik);
    tabGuncelle();
};

// ===== DOSYA =====
window.yeniDosya = function () {
    document.getElementById('inp-dosya-ad').value = 'yeni.ilk';
    document.getElementById('modal-dosya').classList.add('open');
    setTimeout(() => document.getElementById('inp-dosya-ad').select(), 50);
};
window.dosyaOlustur = function () {
    let isim = document.getElementById('inp-dosya-ad').value.trim() || 'yeni';
    if (!isim.endsWith('.ilk')) isim += '.ilk';
    if (ST.dosyalar[ST.aktifIdx]) ST.dosyalar[ST.aktifIdx].icerik = window.editorApi?.editorDegerAl() || ST.dosyalar[ST.aktifIdx].icerik;
    const kod = '// ' + isim + '\nyazdir "Merhaba!";\n';
    yeniTab(isim, kod);
    window.editorApi?.editorDegerAta(kod);
    tabGuncelle();
    modalKapat('modal-dosya');
    ciktiEkle('📄 "' + isim + '" oluşturuldu.', 'sistem');
};
// ===== NATIVE FILE SYSTEM (Chrome/Edge/Opera Support) =====
async function nativeDosyaAc() {
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'İlker Dosyası', accept: { 'text/plain': ['.ilk', '.txt'] } }],
            multiple: false
        });
        const file = await handle.getFile();
        const icerik = await file.text();
        
        if (ST.dosyalar[ST.aktifIdx]) ST.dosyalar[ST.aktifIdx].icerik = window.editorApi?.editorDegerAl() || ST.dosyalar[ST.aktifIdx].icerik;
        
        yeniTab(file.name, icerik);
        ST.dosyalar[ST.aktifIdx].handle = handle;
        window.editorApi?.editorDegerAta(icerik);
        tabGuncelle();
        ciktiEkle('📂 "' + file.name + '" açıldı (yerel erişim).', 'sistem');
    } catch (e) {
        if (e.name !== 'AbortError') console.error(e);
    }
}

async function nativeFarkliKaydet() {
    try {
        const f = ST.dosyalar[ST.aktifIdx];
        if (!f) return;
        const kod = window.editorApi?.editorDegerAl() || f.icerik;
        
        const handle = await window.showSaveFilePicker({
            suggestedName: f.isim,
            types: [{ description: 'İlker Dosyası', accept: { 'text/plain': ['.ilk'] } }]
        });
        
        const writable = await handle.createWritable();
        await writable.write(kod);
        await writable.close();
        
        const file = await handle.getFile();
        f.isim = file.name;
        f.icerik = kod;
        f.degisti = false;
        f.handle = handle;
        
        tabGuncelle();
        ciktiEkle('💾 "' + f.isim + '" kaydedildi (yerel erişim).', 'sistem');
    } catch (e) {
        if (e.name !== 'AbortError') console.error(e);
    }
}

window.dosyaKaydet = async function () {
    const f = ST.dosyalar[ST.aktifIdx];
    if (!f) return;
    const kod = window.editorApi?.editorDegerAl() || f.icerik;

    // Eğer proje dosyasıysa sunucuya kaydet
    if (ST.aktifProjeId && f.id && !f.handle) {
        try {
            const res = await fetch(`/api/projeler/${ST.aktifProjeId}/dosya/${f.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ icerik: kod })
            });
            if (res.ok) {
                f.icerik = kod;
                f.degisti = false;
                tabGuncelle();
                ciktiEkle('💾 Proje dosyası sunucuya kaydedildi: ' + f.isim, 'basari');
                return;
            }
        } catch (e) {
            console.error('Sunucuya kayıt hatası:', e);
        }
    }

    // Eğer bir handle varsa doğrudan üzerine kaydet (Yerel dosya)
    if (f.handle && window.showSaveFilePicker) {
        try {
            const writable = await f.handle.createWritable();
            await writable.write(kod);
            await writable.close();
            f.icerik = kod;
            f.degisti = false;
            tabGuncelle();
            ciktiEkle('💾 "' + f.isim + '" güncellendi.', 'sistem');
            return;
        } catch (e) {
            console.warn('Doğrudan kayıt yapılamadı, farklı kaydet deneniyor...', e);
        }
    }

    // Handle yoksa veya hata aldıysa API desteğine göre davran
    if (window.showSaveFilePicker) {
        await nativeFarkliKaydet();
    } else {
        // Eski fallback yöntemi
        f.icerik = kod;
        f.degisti = false;
        _indir(f.isim, f.icerik);
        tabGuncelle();
        ciktiEkle('💾 "' + f.isim + '" indirildi.', 'sistem');
    }
};

window.dosyaAc = function () {
    if (window.showOpenFilePicker) {
        nativeDosyaAc();
    } else {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = '.ilk,.txt';
        inp.onchange = e => {
            const f = e.target.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = ev => {
                if (ST.dosyalar[ST.aktifIdx]) ST.dosyalar[ST.aktifIdx].icerik = window.editorApi?.editorDegerAl() || ST.dosyalar[ST.aktifIdx].icerik;
                yeniTab(f.name, ev.target.result);
                window.editorApi?.editorDegerAta(ev.target.result);
                tabGuncelle();
                ciktiEkle('📂 "' + f.name + '" açıldı.', 'sistem');
            };
            r.readAsText(f, 'UTF-8');
        };
        inp.click();
    }
};

window.dosyaFarkliKaydet = function () {
    if (window.showSaveFilePicker) {
        nativeFarkliKaydet();
    } else {
        const f = ST.dosyalar[ST.aktifIdx]; if (!f) return;
        const inp = document.getElementById('inp-farkli-kaydet');
        if (inp) inp.value = f.isim.replace(/\.ilk$/, '');
        document.getElementById('modal-farkli-kaydet').classList.add('open');
        setTimeout(() => inp?.select(), 50);
    }
};

function _indir(isim, icerik) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([icerik], { type: 'text/plain;charset=utf-8' }));
    a.download = isim;
    a.click();
    URL.revokeObjectURL(a.href);
}

// ===== PROJE =====
window.yeniProjeModal = function () {
    document.getElementById('inp-proje-ad').value = '';
    document.getElementById('inp-proje-dosya').value = 'main.ilk';
    document.getElementById('modal-proje').classList.add('open');
    setTimeout(() => document.getElementById('inp-proje-ad').focus(), 50);
};
window.projeAcModal = () => { sidebarTab('proje'); projeleriYukle(); };
window.projeOlustur = async function () {
    const ad = document.getElementById('inp-proje-ad').value.trim();
    if (!ad) { alert('Proje adı boş olamaz!'); return; }
    let dosya = document.getElementById('inp-proje-dosya').value.trim() || 'main.ilk';
    if (!dosya.endsWith('.ilk')) dosya += '.ilk';
    const kod = '// Proje: ' + ad + '\n// Dosya: ' + dosya + '\n\nyazdir "Merhaba, ' + ad + '!";\n';
    try { await fetch('/api/projeler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ad, dosya, kod }) }); } catch {}
    if (ST.dosyalar[ST.aktifIdx]) ST.dosyalar[ST.aktifIdx].icerik = window.editorApi?.editorDegerAl() || ST.dosyalar[ST.aktifIdx].icerik;
    yeniTab(dosya, kod);
    window.editorApi?.editorDegerAta(kod);
    tabGuncelle();
    projeleriYukle();
    modalKapat('modal-proje');
    ciktiEkle('📁 "' + ad + '" projesi oluşturuldu.', 'basari');
};
async function projeleriYukle() {
    try { ST.projeler = await (await fetch('/api/projeler')).json(); } catch { ST.projeler = []; }
    const el = document.getElementById('proje-listesi'); if (!el) return;
    if (!ST.projeler.length) {
        el.innerHTML = '<div style="color:var(--fg2);font-size:12px;padding:12px;text-align:center">Henüz proje yok</div>';
        return;
    }
    el.innerHTML = ST.projeler.map(p =>
        '<div class="project-item" onclick="projeAc(\'' + esc(p.ad) + '\', \'' + esc(p.dosya) + '\', \'\', \'' + p.id + '\')">' +
        '<div><div class="project-name">📁 ' + esc(p.ad) + '</div><div class="project-date">' + esc(p.dosya) + '</div></div>' +
        '<span class="project-del" onclick="event.stopPropagation();projeSil(\'' + p.id + '\')">🗑</span></div>'
    ).join('');
}
window.projeAc = async function (ad, dosya, kod, id) {
    ST.aktifProjeId = id;
    if (ST.dosyalar[ST.aktifIdx]) ST.dosyalar[ST.aktifIdx].icerik = window.editorApi?.editorDegerAl() || ST.dosyalar[ST.aktifIdx].icerik;
    
    // Projenin tüm dosyalarını explorer'a çek
    await agacYenile();
    
    // Ana dosyayı aç
    const proj = ST.projeler.find(p => p.id === id);
    const anaDosya = proj?.dosyalar?.find(d => d.isim === dosya) || proj?.dosyalar?.[0];
    
    if (anaDosya) {
        const varMi = ST.dosyalar.findIndex(d => d.id === anaDosya.id);
        if (varMi > -1) tabSec(varMi);
        else {
            ST.dosyalar.push({ ...anaDosya, degisti: false });
            tabSec(ST.dosyalar.length - 1);
        }
    }
};
window.projeSil = async function (id) {
    if (!confirm('Bu projeyi sil?')) return;
    try { await fetch('/api/projeler/' + id, { method: 'DELETE' }); } catch {}
    projeleriYukle();
};



function ornekleriYukle() {
    const el = document.getElementById('ornekler-listesi'); 
    if (!el) return;
    el.innerHTML = Object.keys(ORNEKLER).map(k =>
        '<div class="file-item" onclick="ornekAc(\'' + k + '\')">📄 ' + k + '</div>'
    ).join('');
}
window.ornekAc = function (isim) {
    if (ST.dosyalar[ST.aktifIdx]) ST.dosyalar[ST.aktifIdx].icerik = window.editorApi?.editorDegerAl() || ST.dosyalar[ST.aktifIdx].icerik;
    yeniTab(isim, ORNEKLER[isim]);
    window.editorApi?.editorDegerAta(ORNEKLER[isim]);
    tabGuncelle();
};

// ===== UI DURUM =====
function durumGuncelle() {
    const D = id => document.getElementById(id);
    const isRunning = ST.calisiyor;
    const isDebug   = ST.debugDuraklatildi;

    if (D('btn-run')) D('btn-run').disabled = isRunning;
    if (D('btn-debug')) D('btn-debug').disabled = isRunning;
    if (D('btn-dur')) D('btn-dur').disabled = !isRunning;
    if (D('btn-dbg-devam')) D('btn-dbg-devam').disabled = !isDebug;
    if (D('btn-dbg-adim')) D('btn-dbg-adim').disabled = !isDebug;

    const msg = isDebug ? '⏸ Duraklatıldı' : isRunning ? (ST.debugAktif ? '🐛 Debug…' : '▶ Çalışıyor…') : 'Hazır';
    if (D('durum-yazi')) D('durum-yazi').textContent = msg;
    if (D('sb-durum'))   D('sb-durum').textContent = msg;
}
function baglantiGoster(bagli) {
    const dot = document.getElementById('conn-dot');
    const txt = document.getElementById('conn-text');
    if (dot) dot.className = bagli ? '' : 'disconnected';
    if (txt) txt.textContent = bagli ? 'Bağlı ✓' : 'Bağlantı yok';
}
function progressGoster(aktif) {
    const el = document.getElementById('sb-progress');
    if (el) el.style.display = aktif ? 'block' : 'none';
}

// ===== ÇIKTI PANELİ =====
function ciktiEkle(metin, tip) {
    const el = document.getElementById('cikti-scroll'); if (!el) return;
    const d = document.createElement('div');
    d.className = 'out-' + (tip || 'normal');
    // Satırları tek tek parse et (çok satırlı çıktı için)
    d.textContent = metin;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
    if (tip === 'normal' || tip === 'hata') bottomTab('cikti');
}
window.ciktiTemizle = function () {
    const el = document.getElementById('cikti-scroll');
    if (el) el.innerHTML = '';
};

// ===== SORUNLAR PANELİ =====
function sorunEkle(satir, mesaj, seviye) {
    ST.hataListesi.push({ satir, mesaj, seviye });
    sorunlarGoster();
    bottomTab('sorunlar');
}
function hatalariTemizle() {
    ST.hataListesi = [];
    window.editorApi?.hataMarkerlariTemizle();
    sorunlarGoster();
}
function sorunlarGoster() {
    const el = document.getElementById('sorunlar-scroll'); if (!el) return;
    const badge = document.getElementById('sorun-sayi');
    const hataAdet = ST.hataListesi.filter(s => s.seviye === 'error').length;
    if (badge) { badge.textContent = hataAdet; badge.style.display = hataAdet ? 'inline' : 'none'; }

    if (!ST.hataListesi.length) {
        el.innerHTML = '<div class="problem-empty">✅ Sorun yok — kod temiz!</div>';
        return;
    }
    el.innerHTML = ST.hataListesi.map(s =>
        '<div class="problem-item ' + (s.seviye === 'error' ? 'problem-error' : 'problem-warn') + '" onclick="satiraGit(' + s.satir + ')">' +
        '<span class="problem-icon">' + (s.seviye === 'error' ? '❌' : '⚠️') + '</span>' +
        '<div class="problem-msg">' + esc(s.mesaj) +
        '<div class="problem-loc">Satır ' + s.satir + ' — tıklayarak satıra gidin</div></div></div>'
    ).join('');
}
window.satiraGit = function (satir) {
    if (window._editor) {
        const s = parseInt(satir);
        if (isNaN(s) || s < 1) return;
        window._editor.revealLineInCenter(s);
        window._editor.setPosition({ lineNumber: s, column: 1 });
        window._editor.focus();
    }
};

// ===== DEĞİŞKENLER PANELİ =====
window.degiskenlerGuncelle = function (vars) {
    const el = document.getElementById('degiskenler-scroll');
    if (!el) return;
    const keys = Object.keys(vars || {});
    if (!keys.length) {
        el.innerHTML = '<div class="vars-empty">Değişken yok (debug modunda adım attıkça görünür).</div>';
        return;
    }
    el.innerHTML =
        '<table class="vars-table"><thead><tr><th>Tip</th><th>İsim</th><th>Değer</th></tr></thead><tbody>' +
        keys.map(k => {
            const v = vars[k];
            // Eğer v bir objeyse (tip ve deger içeriyorsa) onu kullan, değilse ham değeri kullan
            const tip = (typeof v === 'object' && v !== null) ? (v.tip || 'bilinmiyor') : typeof v;
            const deger = (typeof v === 'object' && v !== null) ? (v.deger ?? '-') : v;
            return '<tr>' +
                '<td class="var-tip">' + esc(tip) + '</td>' +
                '<td class="var-name">' + esc(k) + '</td>' +
                '<td class="var-value">' + esc(String(deger)) + '</td>' +
                '</tr>';
        }).join('') +
        '</tbody></table>';
};

// ===== PANEL SEÇİCİ =====
window.bottomTab = function (hangi) {
    ['cikti', 'sorunlar', 'degiskenler'].forEach(n => {
        document.getElementById('btab-' + n)?.classList.toggle('active', n === hangi);
        document.getElementById('bp-' + n)?.classList.toggle('active', n === hangi);
    });
};

// ===== AYARLAR =====
window.ayarlarModal = () => {
    document.getElementById('set-font-size').value = ST.ayarlar.fontSize;
    document.getElementById('set-tab-size').value  = ST.ayarlar.tabSize;
    document.getElementById('set-minimap').checked = ST.ayarlar.minimap;
    document.getElementById('set-wordwrap').checked = ST.ayarlar.wordWrap === 'on';
    document.getElementById('modal-ayarlar').classList.add('open');
};
window.ayarlariUygula = () => {
    ST.ayarlar.fontSize = parseInt(document.getElementById('set-font-size').value);
    ST.ayarlar.tabSize  = parseInt(document.getElementById('set-tab-size').value);
    ST.ayarlar.minimap  = document.getElementById('set-minimap').checked;
    ST.ayarlar.wordWrap = document.getElementById('set-wordwrap').checked ? 'on' : 'off';
    
    window.editorApi?.updateOptions({
        fontSize: ST.ayarlar.fontSize,
        tabSize: ST.ayarlar.tabSize,
        minimap: { enabled: ST.ayarlar.minimap },
        wordWrap: ST.ayarlar.wordWrap
    });
    localStorage.setItem('ilker-ayarlar', JSON.stringify(ST.ayarlar));
};
function ayarlariYukle() {
    try {
        const h = localStorage.getItem('ilker-ayarlar');
        if (h) {
            ST.ayarlar = { ...ST.ayarlar, ...JSON.parse(h) };
            setTimeout(window.ayarlariUygula, 500); // editör hazır olunca
        }
    } catch {}
}

// ===== GEZGİN (TREE VIEW) =====
window.agacYenile = async function() {
    await projeleriYukle();
    if (!ST.aktifProjeId && ST.projeler.length) ST.aktifProjeId = ST.projeler[0].id;
    const proj = ST.projeler.find(p => p.id === ST.aktifProjeId);
    if (!proj) return;
    
    const treeEl = document.getElementById('explorer-tree');
    if (!treeEl) return;
    
    // Basit bir ağaç render (Dosyaları klasör yollarına göre grupla)
    treeEl.innerHTML = '';
    const root = buildTreeStructure(proj.dosyalar || []);
    renderTreeNode(treeEl, root, proj.id);
};

function buildTreeStructure(files) {
    const root = { name: 'Root', type: 'folder', children: {} };
    files.forEach(f => {
        const path = f.path || f.isim;
        const parts = path.split('/');
        let curr = root;
        parts.forEach((p, i) => {
            if (i === parts.length - 1) {
                curr.children[p] = { ...f, type: 'file' };
            } else {
                if (!curr.children[p]) curr.children[p] = { name: p, type: 'folder', children: {} };
                curr = curr.children[p];
            }
        });
    });
    return root;
}

function renderTreeNode(parent, node, projId) {
    const keys = Object.keys(node.children || {}).sort((a,b) => {
        const na = node.children[a], nb = node.children[b];
        if (na.type !== nb.type) return na.type === 'folder' ? -1 : 1;
        return a.localeCompare(b);
    });
    
    keys.forEach(k => {
        const item = node.children[k];
        const el = document.createElement('div');
        el.className = 'tree-item ' + (item.type === 'folder' ? 'tree-folder' : 'tree-file');
        el.innerHTML = `<span class="tree-toggle">${item.type==='folder'?'▸':''}</span> ${item.type==='folder'?'📁':'📄'} ${k}`;
        
        // Sağ tık menüsü için (Basit prompt-based)
        el.oncontextmenu = (e) => {
            e.preventDefault();
            const action = prompt(`[${k}] için işlem seçin:\n1: Yeniden Adlandır\n2: Sil`, "1");
            if (action === "1") agacYenidenAdlandir(item.id, k);
            else if (action === "2") agacSil(item.id, k);
        };

        if (item.type === 'file') {
            el.onclick = () => {
                const varMi = ST.dosyalar.findIndex(d => d.id === item.id);
                if (varMi > -1) tabSec(varMi);
                else {
                    ST.dosyalar.push({ ...item, degisti: false });
                    tabSec(ST.dosyalar.length - 1);
                }
            };
        } else {
            const childCont = document.createElement('div');
            childCont.className = 'tree-children';
            childCont.style.display = 'none';
            el.onclick = () => {
                const isOpen = childCont.style.display !== 'none';
                childCont.style.display = isOpen ? 'none' : 'block';
                el.querySelector('.tree-toggle').classList.toggle('open', !isOpen);
            };
            parent.appendChild(el);
            parent.appendChild(childCont);
            renderTreeNode(childCont, item, projId);
            return;
        }
        parent.appendChild(el);
    });
}

window.agacYenidenAdlandir = async function(fileId, eskiIsim) {
    const yeni = prompt('Yeni isim:', eskiIsim);
    if (!yeni || yeni === eskiIsim) return;
    const res = await fetch(`/api/projeler/${ST.aktifProjeId}/dosya/${fileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isim: yeni, path: yeni }) // Basit path mantığı
    });
    if (res.ok) agacYenile();
};

window.agacSil = async function(fileId, isim) {
    if (!confirm(`"${isim}" dosyasını silmek istediğinize emin misiniz?`)) return;
    const res = await fetch(`/api/projeler/${ST.aktifProjeId}/dosya/${fileId}`, { method: 'DELETE' });
    if (res.ok) {
        ST.dosyalar = ST.dosyalar.filter(d => d.id !== fileId);
        if (ST.aktifIdx >= ST.dosyalar.length) ST.aktifIdx = Math.max(0, ST.dosyalar.length - 1);
        agacYenile();
        tabGuncelle();
    }
};

window.agacYeniDosya = async function() {
    if (!ST.aktifProjeId) return alert('Önce bir proje açın veya oluşturun.');
    const isim = prompt('Dosya adı (.ilk):', 'yeni.ilk');
    if (!isim) return;
    const res = await fetch(`/api/projeler/${ST.aktifProjeId}/dosya`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isim, tip: 'dosya', path: isim, icerik: '// ' + isim + '\n' })
    });
    if (res.ok) agacYenile();
};

window.agacYeniKlasor = async function() {
    if (!ST.aktifProjeId) return alert('Önce bir proje açın veya oluşturun.');
    const isim = prompt('Klasör adı:', 'yeni_klasor');
    if (!isim) return;
    alert('Şimdilik dosyaları "klasor/dosya.ilk" şeklinde isimlendirerek klasör yapısı oluşturabilirsiniz.');
};

// ===== KÜRESEL ARAMA =====
window.globalAra = function() {
    const q = document.getElementById('search-input').value.trim().toLowerCase();
    const resEl = document.getElementById('search-results');
    if (!q || !resEl) return;
    
    resEl.innerHTML = '<div style="padding:10px;font-size:11px;color:var(--fg2)">Aranıyor...</div>';
    
    const proj = ST.projeler.find(p => p.id === ST.aktifProjeId);
    if (!proj) { resEl.innerHTML = '<div style="padding:10px;font-size:11px">Önce bir proje seçin.</div>'; return; }
    
    const sonuclar = [];
    proj.dosyalar.forEach(f => {
        if (!f.icerik) return;
        const satirlar = f.icerik.split('\n');
        satirlar.forEach((s, idx) => {
            if (s.toLowerCase().includes(q)) {
                sonuclar.push({ f, idx: idx + 1, s: s.trim() });
            }
        });
    });
    
    if (!sonuclar.length) { resEl.innerHTML = '<div style="padding:10px;font-size:11px">Sonuç bulunamadı.</div>'; return; }
    
    resEl.innerHTML = sonuclar.map(r => `
        <div class="problem-item" onclick="dosyaVeSatiraGit('${r.f.id}', ${r.idx})" style="padding:5px 10px;border-bottom:1px solid var(--border)">
           <div style="font-weight:600;font-size:11px;color:var(--accent3)">${r.f.isim} (Satır ${r.idx})</div>
           <div style="font-size:11px;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(r.s)}</div>
        </div>
    `).join('');
};

window.dosyaVeSatiraGit = function(fileId, satir) {
    const idx = ST.dosyalar.findIndex(d => d.id === fileId);
    if (idx > -1) {
        tabSec(idx);
        setTimeout(() => window.satiraGit(satir), 100);
    } else {
        const proj = ST.projeler.find(p => p.id === ST.aktifProjeId);
        const f = proj?.dosyalar?.find(d => d.id === fileId);
        if (f) {
            ST.dosyalar.push({ ...f, degisti: false });
            tabSec(ST.dosyalar.length - 1);
            setTimeout(() => window.satiraGit(satir), 100);
        }
    }
};

window.degisiklikleriGoster = function() {
    const f = ST.dosyalar[ST.aktifIdx];
    if (!f) return;
    const guncel = window.editorApi?.editorDegerAl() || f.icerik;
    
    document.getElementById('modal-diff').classList.add('open');
    setTimeout(() => {
        window.editorApi?.farklariGoster(f.icerik, guncel);
    }, 100);
};

window.yardimEkle = (kod) => {
    window.editorApi?.editorEkle(kod);
};

window.sidebarTab = function (hangi) {
    ['dosya', 'ara', 'yardim', 'proje'].forEach(s => {
        document.getElementById('stab-' + s)?.classList.toggle('active', s === hangi);
        document.getElementById('sp-' + s)?.classList.toggle('active', s === hangi);
    });
};
window.toggleSidebar = () => {
    const e = document.getElementById('sidebar');
    if (e) e.style.display = e.style.display === 'none' ? '' : 'none';
};
window.toggleBottom = () => {
    const e = document.getElementById('bottom');
    if (e) e.style.display = e.style.display === 'none' ? '' : 'none';
};
window.modalKapat = id => { document.getElementById(id)?.classList.remove('open'); };
window.showAbout = () => alert('İlker Studio IDE v1.1\n\nGelişmiş Dosya Gezgini ve Ayarlar eklendi.\nTürkçe .ilk dili desteği devam ediyor.');
window.editorCmd = (cmd) => {
    if (!window._editor) return;
    switch (cmd) {
        case 'undo': window._editor.trigger('keyboard', 'undo', null); break;
        case 'redo': window._editor.trigger('keyboard', 'redo', null); break;
        case 'find': window._editor.trigger('keyboard', 'actions.find', null); break;
    }
};

// ===== TEMA =====
const TEMALAR = ['karanlik', 'acik', 'mavi', 'mor'];
let _temaIdx = 0;
window.temaAyarla = function (tema) {
    document.body.removeAttribute('data-tema');
    if (tema !== 'karanlik') document.body.setAttribute('data-tema', tema);
    ST.aktifTema = tema;
    _temaIdx = TEMALAR.indexOf(tema);
    if (_temaIdx < 0) _temaIdx = 0;
    const btn = document.getElementById('btn-tema');
    const ikonlar = { karanlik: '🌙', acik: '☀️', mavi: '🌊', mor: '🔮' };
    if (btn) btn.textContent = ikonlar[tema] || '🌙';
    // Monaco tema da güncelle
    if (window.monaco) {
        window.monaco.editor.setTheme(tema === 'acik' ? 'vs' : 'ilker-dark');
    }
    try { localStorage.setItem('ilker-tema', tema); } catch {}
};
window.temaToggle = function () {
    _temaIdx = (_temaIdx + 1) % TEMALAR.length;
    window.temaAyarla(TEMALAR[_temaIdx]);
};
// Kayıtlı temayı yükle
try {
    const kayitli = localStorage.getItem('ilker-tema');
    if (kayitli) window.temaAyarla(kayitli);
} catch {}

// ===== TAM EKRAN =====
window.tamEkran = function () {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen?.();
    }
};
document.addEventListener('keydown', e => {
    if (e.key === 'F11') { e.preventDefault(); window.tamEkran(); }
});

// ===== DRAG RESIZE =====
function rezizeKur() {
    // Sidebar yatay resize
    const sidebarEl  = document.getElementById('sidebar');
    const sidebarRes = document.getElementById('sidebar-resize');
    if (sidebarEl && sidebarRes) {
        let dragging = false, startX = 0, startW = 0;
        sidebarRes.addEventListener('mousedown', e => {
            dragging = true; startX = e.clientX; startW = sidebarEl.offsetWidth;
            sidebarRes.classList.add('dragging');
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            const newW = Math.max(120, Math.min(500, startW + (e.clientX - startX)));
            sidebarEl.style.width = newW + 'px';
        });
        document.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            sidebarRes.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.editorApi?.layoutDuzelt?.();
        });
    }

    // Alt panel dikey resize
    const bottomEl  = document.getElementById('bottom');
    const bottomRes = document.getElementById('bottom-resize');
    if (bottomEl && bottomRes) {
        let dragging = false, startY = 0, startH = 0;
        bottomRes.addEventListener('mousedown', e => {
            dragging = true; startY = e.clientY; startH = bottomEl.offsetHeight;
            bottomRes.classList.add('dragging');
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            const delta = startY - e.clientY;
            const newH = Math.max(80, Math.min(window.innerHeight * 0.7, startH + delta));
            bottomEl.style.height = newH + 'px';
        });
        document.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            bottomRes.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.editorApi?.layoutDuzelt?.();
        });
    }
}

// ===== YARDIMCILAR =====
function editorDegerAl() { return _editor?.getValue() || ''; }
function editorDegerAta(v) { _editor?.setValue(v); }

function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


// ===== YENİ ÖZELLİKLER =====

window.kodFormatla = function () {
    const editor = window._editor;
    if (!editor) return;
    let kod = editor.getValue();
    let satirlar = kod.split('\n');
    let girinti = 0;
    let formatli = satirlar.map(s => {
        let temiz = s.trim();
        if (temiz.startsWith('}')) girinti = Math.max(0, girinti - 1);
        let sonuc = '    '.repeat(girinti) + temiz;
        if (temiz.endsWith('{')) girinti++;
        return sonuc;
    }).join('\n');
    editor.setValue(formatli);
    ciktiEkle('✨ Kod güzelleştirildi.', 'sistem');
};

window.kodPaylas = function () {
    const kod = window._editor?.getValue() || '';
    if (!kod) return;
    // Base64-UTF8 desteği
    const b64 = btoa(unescape(encodeURIComponent(kod)));
    const url = window.location.origin + window.location.pathname + '?kod=' + b64;
    
    const urlEl = document.getElementById('share-url');
    if (urlEl) {
        urlEl.textContent = url;
        document.getElementById('modal-share')?.classList.add('open');
    } else {
        // Fallback: clipboard'a kopyala
        navigator.clipboard.writeText(url);
        ciktiEkle('🔗 Paylaşım bağlantısı panoya kopyalandı.', 'bilgi');
    }
};

window.kopyalaShare = function () {
    const url = document.getElementById('share-url').textContent;
    navigator.clipboard.writeText(url);
    const btn = document.querySelector('#modal-share .small-btn');
    if (btn) {
        const esk = btn.textContent;
        btn.textContent = 'Kopyalandı!';
        setTimeout(() => btn.textContent = esk, 2000);
    }
};

window.toggleAI = function () {
    const p = document.getElementById('ai-panel');
    if (!p) return;
    p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
    if (p.style.display === 'flex') document.getElementById('ai-input').focus();
};

window.aiSor = function () {
    try {
        const inp = document.getElementById('ai-input');
        const msg = inp?.value.trim();
        if (!msg) return;
        
        const box = document.getElementById('ai-messages');
        if (!box) { console.error('AI messages box not found'); return; }

        const uMsg = document.createElement('div');
        uMsg.className = 'ai-user-msg'; // Stil için class ekledim
        uMsg.style.margin = '8px 0';
        uMsg.innerHTML = `<strong>Siz:</strong> ${esc(msg)}`;
        box.appendChild(uMsg);
        
        inp.value = '';
        box.scrollTop = box.scrollHeight;

        // Simüle AI Cevabı
        setTimeout(() => {
            const rMsg = document.createElement('div');
            rMsg.className = 'ai-bot-msg';
            rMsg.style.margin = '8px 0';
            rMsg.style.color = 'var(--accent3)';
            
            let cevap = "Harika bir soru! .ilk dilinde bunu yapmak için şu yapıyı kullanabilirsiniz...";
            const lower = msg.toLowerCase();
            
            if (lower.includes('merhaba') || lower.includes('selam')) {
                cevap = "Merhaba! Ben İlker Studio'nun AI asistanıyım. Size .ilk diliyle kod yazma, hata ayıklama veya örnekler konusunda yardımcı olabilirim.";
            } else if (lower.includes('nasılsın') || lower.includes('naber')) {
                cevap = "Harikayım! Yeni bir .ilk projesi geliştirmeye ne dersin? Senin için kod yazmak benim en sevdiğim iş.";
            } else if (lower.includes('toplama') || lower.includes('matematik') || lower.includes('hesap')) {
                cevap = "Matematiksel işlemler çok basit! Örn: `degisken sonuc = 10 + 20; yazdir sonuc;` şeklinde toplama yapabilirsin. Çıkarma (-), Çarpma (*) ve Bölme (/) de destekleniyor.";
            } else if (lower.includes('dongu') || lower.includes('tekrar')) {
                cevap = "Döngüler için `dongu` yapısını kullanıyoruz. Örn: `dongu(degisken i=0; i<10; i++) { yazdir i; }` 10 defa yazdırır.";
            } else if (lower.includes('degisken') || lower.includes('tanımla')) {
                cevap = "Bir değişken tanımlamak için `degisken` anahtar kelimesini kullan. Örn: `degisken isim = \"İlker\";` Sabitler için `sabit` kullanabilirsin.";
            } else if (lower.includes('hata')) {
                cevap = "Eğer kodunda kırmızı bir çizgi varsa, farenle üzerine gelip detayı görebilirsin. Ayrıca 'Sorunlar' paneli sana tam satır numarasını verecektir.";
            } else if (lower.includes('debug') || lower.includes('hata ayıkla')) {
                cevap = "Debug modunda (F9 veya 🐛 butonu) kodunu satır satır çalıştırabilirsin. Bir satıra breakpoint koymak için sol taraftaki boşluğa tıklaman yeterli.";
            } else if (lower.includes('kim yaptı') || lower.includes('yapımcı')) {
                cevap = "Ben İlker Studio ekibi tarafından geliştirilmiş bir asistanım. Amacım senin kodlama deneyimini kolaylaştırmak!";
            }
            
            rMsg.innerHTML = `<strong>İlker AI:</strong> ${cevap}`;
            box.appendChild(rMsg);
            box.scrollTop = box.scrollHeight;
        }, 600);
    } catch (e) {
        console.error('AI Sor Hatası:', e);
    }
};

// URL'den kod yükleme (Paylaşılan kodlar için)
window.addEventListener('load', () => {
    try {
        const params = new URLSearchParams(window.location.search);
        const kodB64 = params.get('kod');
        if (kodB64) {
            const kod = decodeURIComponent(escape(atob(kodB64)));
            // Editörün yüklenmesini bekle
            const interval = setInterval(() => {
                if (window._editor) {
                    window._editor.setValue(kod);
                    clearInterval(interval);
                    ciktiEkle('🔗 Paylaşılan kod yüklendi.', 'bilgi');
                }
            }, 500);
        }
    } catch(e) {
        console.error('URL kod yükleme hatası:', e);
    }
});

window.degisiklikleriGoster = function () {
    const f = ST.dosyalar[ST.aktifIdx];
    if (!f) return;
    const guncel = window.editorApi?.editorDegerAl() || '';
    const eski = f.icerik;
    
    // Basit bir diff gösterimi (Monaco diff editor varsa onu kullan, yoksa ham metin)
    if (window.editorApi?.diffGoster) {
        window.editorApi.diffGoster(eski, guncel);
        document.getElementById('modal-diff')?.classList.add('open');
    } else {
        ciktiEkle('🔍 Değişiklikler kontrol ediliyor...', 'sistem');
        if (eski === guncel) ciktiEkle('✓ Değişiklik yok.', 'basari');
        else ciktiEkle('⚠ Dosya değişmiş.', 'bilgi');
    }
};

window.projeListesiModal = function () {
    sidebarTab('proje');
    projeleriYukle();
    ciktiEkle('📁 Proje listesi açıldı.', 'sistem');
};

window.tamEkran = function () {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen?.();
    }
};

window.modalKapat = function (id) {
    document.getElementById(id)?.classList.remove('open');
};

window.farkliKaydetOnayla = function () {
    let ad = document.getElementById('inp-farkli-kaydet').value.trim();
    if (!ad) return;
    if (!ad.endsWith('.ilk')) ad += '.ilk';
    const f = ST.dosyalar[ST.aktifIdx];
    if (f) {
        f.isim = ad;
        f.degisti = false;
        f.icerik = window.editorApi?.editorDegerAl() || '';
        _indir(f.isim, f.icerik);
        tabGuncelle();
        modalKapat('modal-farkli-kaydet');
    }
};

// app.js sonu

