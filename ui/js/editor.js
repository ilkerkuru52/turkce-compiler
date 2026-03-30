// editor.js — Monaco Editor Kurulumu (Tam Revizyon)
// Hata marker desteği, Monaco layout düzeltme, ilker-dark tema
'use strict';

const ILK_KEYWORDS = [
    'degisken','sabit','eger','degilse','yoksa','dongu','icin',
    'sure','dondur','kirkitla','devam','fonksiyon','sinif','yeni','bu','miras',
    'arayuz','geridor','yazdir','oku','dahilet','cikis','dogru','yanlis','tanimsiz'
];
const ILK_BUILTINS = [
    'uzunluk','str','sayi','tur','ekle','cikar','aralik',
    'max','min','kok','mutlak','yuvarlak','tavan','taban',
    'kucuk_harf','buyuk_harf','liste_olustur'
];

let _editor = null;
let bpDecs = [], dbgDecs = [], errorDecs = [];
let breakpoints = new Set();
let _debugVars = {}; // Debug sırasında gelen değişkenler (hover için)
let _userSymbols = []; // Kullanıcının tanımladığı değişken/fonksiyonlar

function monacoKur() {
    return new Promise(resolve => {
        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
        require(['vs/editor/editor.main'], () => {

            // Dil kaydı
            monaco.languages.register({ id: 'ilk', extensions: ['.ilk'] });

            // Syntax renklendirme
            monaco.languages.setMonarchTokensProvider('ilk', {
                keywords: ILK_KEYWORDS,
                builtins: ILK_BUILTINS,
                tokenizer: {
                    root: [
                        [/\/\/.*$/, 'comment'],
                        [/\/\*/, 'comment', '@comment'],
                        [/"/, 'string', '@string'],
                        [/\d+\.?\d*/, 'number'],
                        [/[a-zA-ZğüşıöçĞÜŞİÖÇ_]\w*/, {
                            cases: {
                                '@keywords': 'keyword',
                                '@builtins': 'type',
                                'dogru|yanlis|tanimsiz': 'constant',
                                '@default': 'identifier'
                            }
                        }],
                        [/[+\-*\/%&|^~<>=!]+/, 'operator'],
                        [/[{}()\[\]]/, 'delimiter.bracket'],
                        [/[;,.]/, 'delimiter'],
                    ],
                    comment: [
                        [/[^/*]+/, 'comment'],
                        [/\*\//, 'comment', '@pop'],
                        [/[/*]/, 'comment']
                    ],
                    string: [
                        [/[^\\"]+/, 'string'],
                        [/\\[ntr"\\]/, 'string.escape'],
                        [/"/, 'string', '@pop']
                    ]
                }
            });

            // Karanlık tema (varsayılan)
            monaco.editor.defineTheme('ilker-dark', {
                base: 'vs-dark', inherit: true,
                rules: [
                    { token: 'keyword',          foreground: 'c678dd', fontStyle: 'bold' },
                    { token: 'type',             foreground: '56b6c2' },
                    { token: 'constant',         foreground: 'd19a66', fontStyle: 'italic' },
                    { token: 'number',           foreground: 'd19a66' },
                    { token: 'string',           foreground: '98c379' },
                    { token: 'string.escape',    foreground: '56b6c2' },
                    { token: 'comment',          foreground: '5c6370', fontStyle: 'italic' },
                    { token: 'operator',         foreground: '61afef' },
                    { token: 'delimiter.bracket',foreground: 'e5c07b' },
                ],
                colors: {
                    'editor.background':              '#0f0f0f',
                    'editor.foreground':              '#e0e0e0',
                    'editorLineNumber.foreground':    '#4a4a4a',
                    'editorLineNumber.activeForeground': '#9a9a9a',
                    'editor.selectionBackground':     '#264f78',
                    'editor.lineHighlightBackground': '#1c1c1c',
                    'editorCursor.foreground':        '#d0d0d0',
                    'editor.findMatchBackground':     '#513a00',
                    'editorGutter.background':        '#0f0f0f',
                }
            });

            // Otomatik tamamlama
            monaco.languages.registerCompletionItemProvider('ilk', {
                provideCompletionItems: (model, pos) => {
                    const word  = model.getWordUntilPosition(pos);
                    const range = {
                        startLineNumber: pos.lineNumber, endLineNumber: pos.lineNumber,
                        startColumn: word.startColumn,   endColumn: word.endColumn
                    };
                    
                    // Kullanıcı sembollerini de ekle
                    const userSuggestions = _userSymbols.map(s => ({
                        label: s.label,
                        kind: s.type === 'fonksiyon' ? monaco.languages.CompletionItemKind.Function : monaco.languages.CompletionItemKind.Variable,
                        insertText: s.label,
                        range,
                        detail: 'Kullanıcı Tanımlı'
                    }));

                    return {
                        suggestions: [
                            ...ILK_KEYWORDS.map(k => ({
                                label: k,
                                kind: monaco.languages.CompletionItemKind.Keyword,
                                insertText: k, range
                            })),
                            ...ILK_BUILTINS.map(b => ({
                                label: b,
                                kind: monaco.languages.CompletionItemKind.Function,
                                insertText: b + '($1)',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                range
                            })),
                            ...userSuggestions,
                            {
                                label: 'eger-blok', kind: monaco.languages.CompletionItemKind.Snippet,
                                insertText: 'eger (${1:kosul}) {\n\t$2\n}',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                documentation: 'Eğer bloğu', range
                            },
                            {
                                label: 'dongu-blok', kind: monaco.languages.CompletionItemKind.Snippet,
                                insertText: 'dongu (degisken ${1:i} = 0; ${1:i} < ${2:10}; ${1:i}++) {\n\t$3\n}',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                documentation: 'Döngü bloğu', range
                            },
                            {
                                label: 'fonksiyon-blok', kind: monaco.languages.CompletionItemKind.Snippet,
                                insertText: 'fonksiyon ${1:ad}(${2:parametre}) {\n\t$3\n}',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                documentation: 'Fonksiyon tanımı', range
                            },
                            {
                                label: 'oku-yazdir', kind: monaco.languages.CompletionItemKind.Snippet,
                                insertText: 'degisken ${1:isim};\nyazdir "${2:Değer girin:}";\noku ${1:isim};\nyazdir ${1:isim};',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                documentation: 'Kullanıcıdan oku ve yazdır', range
                            },
                        ]
                    };
                }
            });

            // Hover (Debug sırasında değişken değerini göster)
            monaco.languages.registerHoverProvider('ilk', {
                provideHover: (model, pos) => {
                    const word = model.getWordAtPosition(pos);
                    if (!word || !_debugVars[word.word]) return null;
                    
                    const val = _debugVars[word.word];
                    const content = typeof val === 'object' ? 
                        `**${word.word}** (${val.tip})\n\nDeğer: \`${val.deger}\`` :
                        `**${word.word}**\n\nDeğer: \`${val}\``;

                    return {
                        range: new monaco.Range(pos.lineNumber, word.startColumn, pos.lineNumber, word.endColumn),
                        contents: [{ value: content }]
                    };
                }
            });

            // Quick Fix Provider (Öneri Sistemi)
            monaco.languages.registerCodeActionProvider('ilk', {
                provideCodeActions: (model, range, context) => {
                    const actions = [];
                    context.markers.forEach(m => {
                        // Basit kurallar: 'yazd' -> 'yazdir'
                        if (m.message.toLowerCase().includes('yazd')) {
                            actions.push({
                                title: "Düzelt: 'yazdir' olarak değiştir",
                                diagnostics: [m],
                                kind: "quickfix",
                                edit: {
                                    edits: [{
                                        resource: model.uri,
                                        edit: { range: m, text: "yazdir" }
                                    }]
                                },
                                isPreferred: true
                            });
                        }
                    });
                    return { actions, dispose: () => {} };
                }
            });
            // Editör oluştur
            _editor = monaco.editor.create(document.getElementById('monaco-container'), {
                value: window._baslangicKod || '// İlker Studio IDE\nyazdir "Merhaba!";',
                language: 'ilk',
                theme: 'ilker-dark',
                fontFamily: "'Cascadia Code', 'Fira Code', 'Courier New', monospace",
                fontSize: 14,
                lineHeight: 22,
                minimap: { enabled: true, scale: 1 },
                lineNumbers: 'on',
                glyphMargin: true,
                folding: true,
                matchBrackets: 'always',
                bracketPairColorization: { enabled: true },
                cursorBlinking: 'smooth',
                smoothScrolling: true,
                automaticLayout: true,
                tabSize: 4,
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                wordWrap: 'off',
                renderWhitespace: 'none',
                scrollBeyondLastLine: false,
                padding: { top: 12, bottom: 12 },
            });

            window._editor = _editor;

            // Breakpoint tıklama (sol kenar)
            _editor.onMouseDown(e => {
                const T = monaco.editor.MouseTargetType;
                if (e.target.type === T.GUTTER_GLYPH_MARGIN || e.target.type === T.GUTTER_LINE_NUMBERS) {
                    bpToggle(e.target.position.lineNumber);
                }
            });

            // Satır/kolon statusbar
            _editor.onDidChangeCursorPosition(e => {
                const el = document.getElementById('sb-satir');
                if (el) el.textContent = e.position.lineNumber + ':' + e.position.column;
            });

            // Değişiklik takibi
            _editor.onDidChangeModelContent(() => {
                const f = window.ST?.dosyalar[window.ST?.aktifIdx];
                if (f && !f.degisti) {
                    f.degisti = true;
                    if (typeof tabGuncelle === 'function') tabGuncelle();
                }
                // Sembolleri güncelle (throttle/debounce eklenebilir)
                sembolleriTara();
            });

            // Monaco kısayollar
            _editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => window.dosyaKaydet?.());
            _editor.addCommand(monaco.KeyCode.F5, () => window.kodCalistir?.(false));
            _editor.addCommand(monaco.KeyCode.F9, () => window.kodCalistir?.(true));
            _editor.addCommand(monaco.KeyCode.F10, () => window.debugAdim?.());
            _editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, () => window.yeniDosya?.());

            resolve(_editor);
        });
    });
}

// ===== BREAKPOINT =====
function bpToggle(satir) {
    breakpoints.has(satir) ? breakpoints.delete(satir) : breakpoints.add(satir);
    window.gonder?.({ tip: breakpoints.has(satir) ? 'BREAKPOINT_EKLE' : 'BREAKPOINT_CIKAR', satir });
    bpGuncelle();
}
function bpGuncelle() {
    if (!_editor) return;
    bpDecs = _editor.deltaDecorations(bpDecs, [...breakpoints].map(s => ({
        range: new monaco.Range(s, 1, s, 1),
        options: {
            isWholeLine: true,
            glyphMarginClassName: 'bp-glyph',
            className: 'bp-satir'
        }
    })));
}

// ===== DEBUG SATIR VURGUSU =====
function dbgGoster(satir) {
    if (!_editor) return;
    dbgDecs = _editor.deltaDecorations(dbgDecs, [{
        range: new monaco.Range(satir, 1, satir, 1),
        options: {
            isWholeLine: true,
            className: 'dbg-satir',
            glyphMarginClassName: 'dbg-ok'
        }
    }]);
    _editor.revealLineInCenter(satir);
}
function dbgKaldir() {
    if (_editor) dbgDecs = _editor.deltaDecorations(dbgDecs, []);
}

// ===== HATA MARKERLERİ (kırmızı dalgalı çizgi) =====
function hataMarkerEkle(satir, mesaj) {
    if (!_editor || !monaco) return;
    const model = _editor.getModel();
    if (!model) return;
    const satirIcerik = model.getLineContent(satir) || '';
    const sutunSonu   = satirIcerik.length + 1;
    const mevcutlar   = monaco.editor.getModelMarkers({ resource: model.uri });
    monaco.editor.setModelMarkers(model, 'ilker', [
        ...mevcutlar,
        {
            severity:  monaco.MarkerSeverity.Error,
            message:   mesaj,
            startLineNumber: satir,
            startColumn:     1,
            endLineNumber:   satir,
            endColumn:       sutunSonu > 1 ? sutunSonu : 2,
        }
    ]);
    // Aynı zamanda satırı renklendiren decoration
    errorDecs = _editor.deltaDecorations(errorDecs, [
        ...errorDecs.map(() => null).filter(Boolean),
        {
            range: new monaco.Range(satir, 1, satir, 1),
            options: { isWholeLine: true, className: 'err-satir', glyphMarginClassName: 'err-glyph' }
        }
    ].filter(Boolean));
}

function hataMarkerlariTemizle() {
    if (!_editor || !monaco) return;
    const model = _editor.getModel();
    if (model) monaco.editor.setModelMarkers(model, 'ilker', []);
    if (_editor) errorDecs = _editor.deltaDecorations(errorDecs, []);
}

// ===== SEMBOL TARAMA (Basit Regex tabanlı) =====
function sembolleriTara() {
    if (!_editor) return;
    const kod = _editor.getValue();
    const symbols = [];
    
    // Değişkenleri bul: degisken x = ... veya f(x, y)
    const varRegex = /\bdegisken\s+([a-zA-ZğüşıöçĞÜŞİÖÇ_]\w*)/g;
    let m;
    while ((m = varRegex.exec(kod)) !== null) {
        if (!symbols.some(s => s.label === m[1])) symbols.push({ label: m[1], type: 'degisken' });
    }
    
    // Fonksiyonları bul: fonksiyon ad(...)
    const funcRegex = /\bfonksiyon\s+([a-zA-ZğüşıöçĞÜŞİÖÇ_]\w*)/g;
    while ((m = funcRegex.exec(kod)) !== null) {
        if (!symbols.some(s => s.label === m[1])) symbols.push({ label: m[1], type: 'fonksiyon' });
    }
    
    _userSymbols = symbols;
}

// ===== YARDIMCILAR =====
function editorDegerAl() { return _editor?.getValue() || ''; }
function editorDegerAta(v) { _editor?.setValue(v); }

function editorEkle(v) {
    const sel = _editor.getSelection();
    _editor.executeEdits('', [{ range: sel, text: v, forceMoveMarkers: true }]);
}

// ===== DİFF MODAL =====
function farklariGoster(eski, yeni) {
    // Bu, app.js tarafından çağrılacak ve bir modal içinde DiffEditor açılacak
    const container = document.getElementById('diff-preview-container');
    if (!container) return;
    container.innerHTML = '';
    const diff = monaco.editor.createDiffEditor(container, {
        readOnly: true,
        automaticLayout: true,
        theme: window.ST?.aktifTema === 'karanlik' ? 'vs-dark' : 'vs'
    });
    diff.setModel({
        original: monaco.editor.createModel(eski, 'ilk'),
        modified: monaco.editor.createModel(yeni, 'ilk')
    });
}

function breakpointleriAl() { return [...breakpoints]; }
function layoutDuzelt() { _editor?.layout(); }
function setDebugVars(vars) { _debugVars = vars || {}; }

// ===== STİLLER =====
const _s = document.createElement('style');
_s.textContent = `
  .bp-glyph { background:#e06c75; border-radius:50%; width:10px!important; height:10px!important; margin:6px 3px; box-shadow:0 0 6px #e06c7580; }
  .bp-satir  { background:rgba(224,108,117,.06); border-left:2px solid #e06c75; }
  .dbg-satir { background:rgba(229,192,123,.14); border-left:3px solid #e5c07b; }
  .dbg-ok::before { content:"▶"; color:#e5c07b; font-size:13px; margin-left:2px; }
  .err-satir { background:rgba(248,81,73,.08); }
  .err-glyph::before { content:"●"; color:#f85149; font-size:11px; margin-left:2px; }
`;
document.head.appendChild(_s);

// ===== API =====
window.editorApi = {
    monacoKur,
    editorDegerAl,
    editorDegerAta,
    breakpointleriAl,
    dbgSatirlariGoster: dbgGoster,
    dbgSatirlariKaldir: dbgKaldir,
    hataMarkerEkle,
    hataMarkerlariTemizle,
    updateOptions: (opt) => _editor?.updateOptions(opt),
    setDebugVars,
    editorEkle,
    farklariGoster,
    layoutDuzelt,
};
window._editorApiReady = true;

// Eğer Monaco loader zaten hazırsa hemen başlat
if (window._monacoLoaderReady && window._baslatFn) {
    monacoKur().then(window._baslatFn);
}
