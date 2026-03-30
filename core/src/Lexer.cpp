#include "Lexer.h"
#include <cctype>

const std::unordered_map<std::string, TokTip> Lexer::ANAHTAR_KELIMELER = {
    {"degisken",TokTip::DEGISKEN}, {"sabit",TokTip::SABIT}, {"eger",TokTip::EGER},
    {"degilse",TokTip::DEGILSE},   {"yoksa",TokTip::YOKSA},  {"dongu",TokTip::DONGU},
    {"icin",TokTip::ICIN},         {"sure",TokTip::SURE},    {"dondur",TokTip::DONDUR},
    {"kirkitla",TokTip::KIRKIT},   {"devam",TokTip::DEVAM},  {"fonksiyon",TokTip::FONKSIYON},
    {"sinif",TokTip::SINIF},       {"yeni",TokTip::YENI},    {"bu",TokTip::BU},
    {"miras",TokTip::MIRAS},       {"arayuz",TokTip::ARAYUZ},{"geridor",TokTip::GERI_DON},
    {"yazdir",TokTip::YAZDIR},     {"oku",TokTip::OKU},      {"dahilet",TokTip::DAHIL_ET},
    {"cikis",TokTip::CIKIS},       {"dogru",TokTip::DOGRU_LITERAL},
    {"yanlis",TokTip::YANLIS_LITERAL},{"tanimsiz",TokTip::TANIMSIZ_LITERAL},
    {"sayi",TokTip::SAYI_TIPI},    {"metin",TokTip::METIN_TIPI},
    {"bool",TokTip::BOOL_TIPI},    {"bos",TokTip::VOID_TIPI},
    {"liste",TokTip::LISTE_TIPI},  {"sozluk",TokTip::SOZLUK_TIPI},
    {"otomatik",TokTip::OTOMATIK},
};

Lexer::Lexer(const std::string& k) : kaynak(k), konum(0), satir(1), sutun(1) {}

char Lexer::mevcutKarakter() const { return konum < kaynak.size() ? kaynak[konum] : '\0'; }
char Lexer::sonrakiKarakter() const { return konum+1 < kaynak.size() ? kaynak[konum+1] : '\0'; }
char Lexer::ilerle() {
    char c = kaynak[konum++];
    if (c == '\n') { satir++; sutun = 1; } else sutun++;
    return c;
}
void Lexer::bosluklariAtla() {
    while (konum < kaynak.size() && std::isspace((unsigned char)mevcutKarakter())) ilerle();
}
void Lexer::yorumuAtla() {
    if (mevcutKarakter()=='/' && sonrakiKarakter()=='/') {
        while (konum < kaynak.size() && mevcutKarakter()!='\n') ilerle();
    } else if (mevcutKarakter()=='/' && sonrakiKarakter()=='*') {
        ilerle(); ilerle();
        while (konum < kaynak.size()) {
            if (mevcutKarakter()=='*' && sonrakiKarakter()=='/') { ilerle(); ilerle(); break; }
            ilerle();
        }
    }
}
Token Lexer::sayiOku() {
    int s=satir,c=sutun; std::string d; bool nokta=false;
    while (konum<kaynak.size() && (std::isdigit((unsigned char)mevcutKarakter()) ||
           (mevcutKarakter()=='.' && !nokta && std::isdigit((unsigned char)sonrakiKarakter())))) {
        if (mevcutKarakter()=='.') nokta=true; d+=ilerle();
    }
    return Token(TokTip::SAYI_LITERAL, d, s, c);
}
Token Lexer::metinOku() {
    int s=satir,c=sutun; ilerle(); std::string d;
    while (konum<kaynak.size() && mevcutKarakter()!='"') {
        if (mevcutKarakter()=='\\') {
            ilerle(); char e=ilerle();
            switch(e) { case 'n':d+='\n';break; case 't':d+='\t';break;
                         case '"':d+='"';break; case '\\':d+='\\';break;
                         default:d+='\\';d+=e; }
        } else d+=ilerle();
    }
    if (konum<kaynak.size()) ilerle();
    return Token(TokTip::METIN_LITERAL, d, s, c);
}
Token Lexer::tanimlayiciOku() {
    int s=satir,c=sutun; std::string d;
    while (konum<kaynak.size()) {
        unsigned char ch=(unsigned char)kaynak[konum];
        if (std::isalnum(ch)||ch=='_'||ch>=128) d+=ilerle(); else break;
    }
    auto it=ANAHTAR_KELIMELER.find(d);
    return it!=ANAHTAR_KELIMELER.end() ? Token(it->second,d,s,c) : Token(TokTip::IDENTIFIER,d,s,c);
}
Token Lexer::operatorOku() {
    int s=satir,c=sutun; char cur=mevcutKarakter(), nxt=sonrakiKarakter();
    auto mk=[&](TokTip t,int len)->Token{ std::string d; for(int i=0;i<len;i++)d+=ilerle(); return Token(t,d,s,c); };
    switch(cur){
    case '+': if(nxt=='+')return mk(TokTip::OP_ARTTIR,2); if(nxt=='=')return mk(TokTip::OP_TOPLA_ESIT,2); return mk(TokTip::OP_ARTI,1);
    case '-': if(nxt=='-')return mk(TokTip::OP_AZALT,2); if(nxt=='=')return mk(TokTip::OP_CIKAR_ESIT,2); if(nxt=='>')return mk(TokTip::OK,2); return mk(TokTip::OP_EKSI,1);
    case '*': if(nxt=='*')return mk(TokTip::OP_US,2); if(nxt=='=')return mk(TokTip::OP_CARP_ESIT,2); return mk(TokTip::OP_CARP,1);
    case '/': if(nxt=='=')return mk(TokTip::OP_BOL_ESIT,2); return mk(TokTip::OP_BOL,1);
    case '%': if(nxt=='=')return mk(TokTip::OP_MOD_ESIT,2); return mk(TokTip::OP_MOD,1);
    case '=': if(nxt=='=')return mk(TokTip::OP_ESIT_ESIT,2); return mk(TokTip::OP_ESIT,1);
    case '!': if(nxt=='=')return mk(TokTip::OP_ESIT_DEGIL,2); return mk(TokTip::OP_DEGIL,1);
    case '<': if(nxt=='=')return mk(TokTip::OP_KUCUK_ESIT,2); if(nxt=='<')return mk(TokTip::OP_SOLA,2); return mk(TokTip::OP_KUCUK,1);
    case '>': if(nxt=='=')return mk(TokTip::OP_BUYUK_ESIT,2); if(nxt=='>')return mk(TokTip::OP_SAGA,2); return mk(TokTip::OP_BUYUK,1);
    case '&': if(nxt=='&')return mk(TokTip::OP_VE,2); return mk(TokTip::OP_BIT_VE,1);
    case '|': if(nxt=='|')return mk(TokTip::OP_VEYA,2); return mk(TokTip::OP_BIT_VEYA,1);
    case '~': return mk(TokTip::OP_BIT_DEGIL,1); case '^': return mk(TokTip::OP_BIT_XOR,1);
    case '(': return mk(TokTip::SOL_PARAN,1); case ')': return mk(TokTip::SAG_PARAN,1);
    case '{': return mk(TokTip::SOL_SUSLU,1);  case '}': return mk(TokTip::SAG_SUSLU,1);
    case '[': return mk(TokTip::SOL_KOSELI,1); case ']': return mk(TokTip::SAG_KOSELI,1);
    case ';': return mk(TokTip::NOKTALI_VIRGUL,1); case ',': return mk(TokTip::VIRGUL,1);
    case '.': return mk(TokTip::NOKTA,1);
    case ':': if(nxt==':')return mk(TokTip::CIFT_NOKTA,2); return mk(TokTip::IKI_NOKTA,1);
    case '?': return mk(TokTip::SORU,1);
    default: { std::string d(1,ilerle()); return Token(TokTip::BILINMEYEN,d,s,c); }
    }
}
std::vector<Token> Lexer::tokenlestir() {
    std::vector<Token> tok;
    while (true) {
        bosluklariAtla();
        if (konum>=kaynak.size()) { tok.push_back(Token(TokTip::DOSYA_SONU,"",satir,sutun)); break; }
        char cur=mevcutKarakter();
        if (cur=='/' && (sonrakiKarakter()=='/'||sonrakiKarakter()=='*')) { yorumuAtla(); continue; }
        if (cur=='"') tok.push_back(metinOku());
        else if (std::isdigit((unsigned char)cur)) tok.push_back(sayiOku());
        else if (std::isalpha((unsigned char)cur)||cur=='_'||(unsigned char)cur>=128) tok.push_back(tanimlayiciOku());
        else tok.push_back(operatorOku());
    }
    return tok;
}
