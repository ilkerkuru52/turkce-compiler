#include "Parser.h"
Parser::Parser(std::vector<Token> t) : tokenler(std::move(t)), konum(0) {}
Token& Parser::mevcut() { return tokenler[konum]; }
Token& Parser::sonraki() { return tokenler[std::min(konum+1, tokenler.size()-1)]; }
Token& Parser::ilerle() { Token& t=tokenler[konum]; if(konum<tokenler.size()-1)konum++; return t; }
bool Parser::bittiMi() const { return tokenler[konum].tip==TokTip::DOSYA_SONU; }
bool Parser::kontrol(TokTip t) const { return tokenler[konum].tip==t; }
bool Parser::kontrol(TokTip t, int o) const { size_t i=konum+o; return i<tokenler.size()&&tokenler[i].tip==t; }
bool Parser::eslestir(TokTip t) { if(kontrol(t)){ilerle();return true;} return false; }
Token& Parser::bekle(TokTip t, const std::string& m) {
    if(!kontrol(t)) throw ParserHatasi("Beklenen: "+m+", Bulunan: '"+mevcut().deger+"'", mevcut().satir);
    return ilerle();
}
std::vector<DeyimPtr> Parser::ayristir() {
    std::vector<DeyimPtr> p; while(!bittiMi()) p.push_back(deyimAyristir()); return p;
}
std::vector<DeyimPtr> Parser::blokAyristir() {
    bekle(TokTip::SOL_SUSLU,"{"); std::vector<DeyimPtr> d;
    while(!bittiMi()&&!kontrol(TokTip::SAG_SUSLU)) d.push_back(deyimAyristir());
    bekle(TokTip::SAG_SUSLU,"}"); return d;
}
DeyimPtr Parser::deyimAyristir() {
    switch(mevcut().tip) {
    case TokTip::DEGISKEN: return degiskenTanimi();
    case TokTip::SABIT:    return sabitTanimi();
    case TokTip::FONKSIYON:return fonksiyonTanimi();
    case TokTip::SINIF:    return sinifTanimi();
    case TokTip::EGER:     return egerDeyimi();
    case TokTip::DONGU: case TokTip::ICIN: return donguDeyimi();
    case TokTip::SURE:     return sureDeyimi();
    case TokTip::GERI_DON: return geriDonDeyimi();
    case TokTip::YAZDIR:   return yazdirDeyimi();
    case TokTip::OKU:      return okuDeyimi();
    case TokTip::DAHIL_ET: return dahilEtDeyimi();
    case TokTip::CIKIS:    return cikisDeyimi();
    case TokTip::KIRKIT:   return kirkitlaDeyimi();
    case TokTip::DEVAM:    return devamDeyimi();
    case TokTip::SOL_SUSLU:{ auto b=std::make_shared<Deyim>(); b->tip=DeyimTipi::BLOK_DEYIMI; b->satir=mevcut().satir; b->govde=blokAyristir(); return b; }
    default: return ifadeDeyimi();
    }
}
DeyimPtr Parser::degiskenTanimi() {
    auto d=std::make_shared<Deyim>(); d->tip=DeyimTipi::DEGISKEN_TANIMI; d->satir=mevcut().satir;
    ilerle(); d->isim=bekle(TokTip::IDENTIFIER,"degisken adi").deger;
    if(eslestir(TokTip::OP_ESIT)) d->deger=ifadeAyristir();
    eslestir(TokTip::NOKTALI_VIRGUL); return d;
}
DeyimPtr Parser::sabitTanimi() {
    auto d=std::make_shared<Deyim>(); d->tip=DeyimTipi::SABIT_TANIMI; d->satir=mevcut().satir;
    ilerle(); d->isim=bekle(TokTip::IDENTIFIER,"sabit adi").deger;
    bekle(TokTip::OP_ESIT,"="); d->deger=ifadeAyristir();
    eslestir(TokTip::NOKTALI_VIRGUL); return d;
}
DeyimPtr Parser::fonksiyonTanimi() {
    auto d=std::make_shared<Deyim>(); d->tip=DeyimTipi::FONKSIYON_TANIMI; d->satir=mevcut().satir;
    ilerle(); d->isim=bekle(TokTip::IDENTIFIER,"fonksiyon adi").deger;
    bekle(TokTip::SOL_PARAN,"("); d->parametreler=paramList(); bekle(TokTip::SAG_PARAN,")");
    d->govde=blokAyristir(); return d;
}
DeyimPtr Parser::sinifTanimi() {
    auto d=std::make_shared<Deyim>(); d->tip=DeyimTipi::SINIF_TANIMI; d->satir=mevcut().satir;
    ilerle(); d->isim=bekle(TokTip::IDENTIFIER,"sinif adi").deger;
    if(eslestir(TokTip::MIRAS)) d->mirasAdi=bekle(TokTip::IDENTIFIER,"ust sinif").deger;
    d->govde=blokAyristir(); return d;
}
DeyimPtr Parser::egerDeyimi() {
    auto d=std::make_shared<Deyim>(); d->tip=DeyimTipi::EGER_DEYIMI; d->satir=mevcut().satir;
    ilerle(); bekle(TokTip::SOL_PARAN,"("); d->kosul=ifadeAyristir(); bekle(TokTip::SAG_PARAN,")");
    d->govde=blokAyristir();
    while(kontrol(TokTip::DEGILSE)||kontrol(TokTip::YOKSA)) {
        if(kontrol(TokTip::DEGILSE)){
            ilerle();
            if(kontrol(TokTip::EGER)){
                ilerle(); bekle(TokTip::SOL_PARAN,"("); auto k=ifadeAyristir(); bekle(TokTip::SAG_PARAN,")");
                auto g=blokAyristir(); d->elifDallar.push_back({k,g});
            } else { d->yoksaGovde=blokAyristir(); break; }
        } else { ilerle(); d->yoksaGovde=blokAyristir(); break; }
    }
    return d;
}
DeyimPtr Parser::donguDeyimi() {
    auto d=std::make_shared<Deyim>(); d->tip=DeyimTipi::DONGU_DEYIMI; d->satir=mevcut().satir;
    ilerle(); bekle(TokTip::SOL_PARAN,"(");
    if(!kontrol(TokTip::NOKTALI_VIRGUL)) { if(kontrol(TokTip::DEGISKEN)) d->baslangic=degiskenTanimi(); else d->baslangic=ifadeDeyimi(); } else eslestir(TokTip::NOKTALI_VIRGUL);
    if(!kontrol(TokTip::NOKTALI_VIRGUL)) d->kosul=ifadeAyristir(); eslestir(TokTip::NOKTALI_VIRGUL);
    if(!kontrol(TokTip::SAG_PARAN)) d->guncelleme=ifadeAyristir();
    bekle(TokTip::SAG_PARAN,")"); d->govde=blokAyristir(); return d;
}
DeyimPtr Parser::sureDeyimi() {
    auto d=std::make_shared<Deyim>(); d->tip=DeyimTipi::SURE_DEYIMI; d->satir=mevcut().satir;
    ilerle(); bekle(TokTip::SOL_PARAN,"("); d->kosul=ifadeAyristir(); bekle(TokTip::SAG_PARAN,")");
    d->govde=blokAyristir(); return d;
}
DeyimPtr Parser::geriDonDeyimi() {
    auto d=std::make_shared<Deyim>(); d->tip=DeyimTipi::GERI_DON_DEYIMI; d->satir=mevcut().satir;
    ilerle(); if(!kontrol(TokTip::NOKTALI_VIRGUL)) d->ifade=ifadeAyristir();
    eslestir(TokTip::NOKTALI_VIRGUL); return d;
}
DeyimPtr Parser::yazdirDeyimi() {
    auto d=std::make_shared<Deyim>(); d->tip=DeyimTipi::YAZDIR_DEYIMI; d->satir=mevcut().satir;
    ilerle(); d->ifade=ifadeAyristir(); eslestir(TokTip::NOKTALI_VIRGUL); return d;
}
DeyimPtr Parser::okuDeyimi() {
    auto d=std::make_shared<Deyim>(); d->tip=DeyimTipi::OKU_DEYIMI; d->satir=mevcut().satir;
    ilerle(); d->isim=bekle(TokTip::IDENTIFIER,"degisken adi").deger;
    eslestir(TokTip::NOKTALI_VIRGUL); return d;
}
DeyimPtr Parser::dahilEtDeyimi() {
    auto d=std::make_shared<Deyim>(); d->tip=DeyimTipi::DAHIL_ET_DEYIMI; d->satir=mevcut().satir;
    ilerle(); d->isim=bekle(TokTip::METIN_LITERAL,"dosya adi").deger;
    eslestir(TokTip::NOKTALI_VIRGUL); return d;
}
DeyimPtr Parser::cikisDeyimi() {
    auto d=std::make_shared<Deyim>(); d->tip=DeyimTipi::CIKIS_DEYIMI; d->satir=mevcut().satir;
    ilerle(); if(!kontrol(TokTip::NOKTALI_VIRGUL)) d->ifade=ifadeAyristir();
    eslestir(TokTip::NOKTALI_VIRGUL); return d;
}
DeyimPtr Parser::kirkitlaDeyimi() { auto d=std::make_shared<Deyim>(); d->tip=DeyimTipi::KIRKITLA_DEYIMI; d->satir=mevcut().satir; ilerle(); eslestir(TokTip::NOKTALI_VIRGUL); return d; }
DeyimPtr Parser::devamDeyimi() { auto d=std::make_shared<Deyim>(); d->tip=DeyimTipi::DEVAM_DEYIMI; d->satir=mevcut().satir; ilerle(); eslestir(TokTip::NOKTALI_VIRGUL); return d; }
DeyimPtr Parser::ifadeDeyimi() { auto d=std::make_shared<Deyim>(); d->tip=DeyimTipi::IFADE_DEYIMI; d->satir=mevcut().satir; d->ifade=ifadeAyristir(); eslestir(TokTip::NOKTALI_VIRGUL); return d; }
IfadePtr Parser::ifadeAyristir() { return atama(); }
IfadePtr Parser::atama() {
    auto s=ucluKosul();
    if(kontrol(TokTip::OP_ESIT)||kontrol(TokTip::OP_TOPLA_ESIT)||kontrol(TokTip::OP_CIKAR_ESIT)||kontrol(TokTip::OP_CARP_ESIT)||kontrol(TokTip::OP_BOL_ESIT)||kontrol(TokTip::OP_MOD_ESIT)){
        std::string op=ilerle().deger; auto sg=atama();
        auto d=std::make_shared<Ifade>(); d->tip=IfadeTipi::ATAMA; d->op=op; d->sol=s; d->sag=sg; d->satir=s?s->satir:0; return d;
    }
    return s;
}
IfadePtr Parser::ucluKosul() {
    auto k=mantikselVeya();
    if(eslestir(TokTip::SORU)){
        auto dt=ifadeAyristir(); bekle(TokTip::IKI_NOKTA,":"); auto yf=ifadeAyristir();
        auto d=std::make_shared<Ifade>(); d->tip=IfadeTipi::KOSULLU; d->kosul=k; d->dogruKol=dt; d->yanlisFKol=yf; return d;
    }
    return k;
}
IfadePtr Parser::mantikselVeya() { auto s=mantikselVe(); while(kontrol(TokTip::OP_VEYA)){std::string o=ilerle().deger;auto sg=mantikselVe();auto d=std::make_shared<Ifade>();d->tip=IfadeTipi::IKILI_OP;d->op=o;d->sol=s;d->sag=sg;s=d;} return s; }
IfadePtr Parser::mantikselVe() { auto s=esitlikKarsilastir(); while(kontrol(TokTip::OP_VE)){std::string o=ilerle().deger;auto sg=esitlikKarsilastir();auto d=std::make_shared<Ifade>();d->tip=IfadeTipi::IKILI_OP;d->op=o;d->sol=s;d->sag=sg;s=d;} return s; }
IfadePtr Parser::esitlikKarsilastir() { auto s=buyuklukKarsilastir(); while(kontrol(TokTip::OP_ESIT_ESIT)||kontrol(TokTip::OP_ESIT_DEGIL)){std::string o=ilerle().deger;auto sg=buyuklukKarsilastir();auto d=std::make_shared<Ifade>();d->tip=IfadeTipi::IKILI_OP;d->op=o;d->sol=s;d->sag=sg;s=d;} return s; }
IfadePtr Parser::buyuklukKarsilastir() { auto s=bitseller(); while(kontrol(TokTip::OP_KUCUK)||kontrol(TokTip::OP_BUYUK)||kontrol(TokTip::OP_KUCUK_ESIT)||kontrol(TokTip::OP_BUYUK_ESIT)){std::string o=ilerle().deger;auto sg=bitseller();auto d=std::make_shared<Ifade>();d->tip=IfadeTipi::IKILI_OP;d->op=o;d->sol=s;d->sag=sg;s=d;} return s; }
IfadePtr Parser::bitseller(){ return toplama(); }
IfadePtr Parser::toplama() { auto s=carpma(); while(kontrol(TokTip::OP_ARTI)||kontrol(TokTip::OP_EKSI)){std::string o=ilerle().deger;auto sg=carpma();auto d=std::make_shared<Ifade>();d->tip=IfadeTipi::IKILI_OP;d->op=o;d->sol=s;d->sag=sg;s=d;} return s; }
IfadePtr Parser::carpma() { auto s=us(); while(kontrol(TokTip::OP_CARP)||kontrol(TokTip::OP_BOL)||kontrol(TokTip::OP_MOD)){std::string o=ilerle().deger;auto sg=us();auto d=std::make_shared<Ifade>();d->tip=IfadeTipi::IKILI_OP;d->op=o;d->sol=s;d->sag=sg;s=d;} return s; }
IfadePtr Parser::us() { auto s=tekliOp(); if(kontrol(TokTip::OP_US)){std::string o=ilerle().deger;auto sg=us();auto d=std::make_shared<Ifade>();d->tip=IfadeTipi::IKILI_OP;d->op=o;d->sol=s;d->sag=sg;return d;} return s; }
IfadePtr Parser::tekliOp() {
    if(kontrol(TokTip::OP_EKSI)||kontrol(TokTip::OP_DEGIL)||kontrol(TokTip::OP_ARTTIR)||kontrol(TokTip::OP_AZALT)){
        int s=mevcut().satir; std::string o=ilerle().deger; auto op=tekliOp();
        auto d=std::make_shared<Ifade>(); d->tip=IfadeTipi::TEKLI_OP; d->op=o; d->sol=op; d->satir=s; return d;
    }
    return cagriVeUye();
}
IfadePtr Parser::cagriVeUye() {
    auto s=birincil();
    while(true){
        if(eslestir(TokTip::SOL_PARAN)){auto a=argList();bekle(TokTip::SAG_PARAN,")");auto d=std::make_shared<Ifade>();d->tip=IfadeTipi::FONKSIYON_CAGRI;d->hedef=s;d->argümanlar=a;d->satir=s?s->satir:0;s=d;}
        else if(eslestir(TokTip::NOKTA)){auto a=bekle(TokTip::IDENTIFIER,"alan").deger;auto d=std::make_shared<Ifade>();d->tip=IfadeTipi::UYE_ERISIM;d->sol=s;d->isim=a;s=d;}
        else if(eslestir(TokTip::SOL_KOSELI)){auto i=ifadeAyristir();bekle(TokTip::SAG_KOSELI,"]");auto d=std::make_shared<Ifade>();d->tip=IfadeTipi::DIZIN_ERISIM;d->sol=s;d->sag=i;s=d;}
        else if(kontrol(TokTip::OP_ARTTIR)||kontrol(TokTip::OP_AZALT)){std::string o=ilerle().deger+"_SONRA";auto d=std::make_shared<Ifade>();d->tip=IfadeTipi::TEKLI_OP;d->op=o;d->sol=s;s=d;}
        else break;
    }
    return s;
}
IfadePtr Parser::birincil() {
    int s=mevcut().satir;
    if(kontrol(TokTip::SAYI_LITERAL)){auto t=ilerle();auto d=std::make_shared<Ifade>();d->tip=IfadeTipi::SAYI_LITERAL;d->sayiDeger=std::stod(t.deger);d->satir=s;return d;}
    if(kontrol(TokTip::METIN_LITERAL)){auto t=ilerle();auto d=std::make_shared<Ifade>();d->tip=IfadeTipi::METIN_LITERAL;d->metinDeger=t.deger;d->satir=s;return d;}
    if(kontrol(TokTip::DOGRU_LITERAL)){ilerle();auto d=std::make_shared<Ifade>();d->tip=IfadeTipi::BOOL_LITERAL;d->boolDeger=true;d->satir=s;return d;}
    if(kontrol(TokTip::YANLIS_LITERAL)){ilerle();auto d=std::make_shared<Ifade>();d->tip=IfadeTipi::BOOL_LITERAL;d->boolDeger=false;d->satir=s;return d;}
    if(kontrol(TokTip::TANIMSIZ_LITERAL)){ilerle();auto d=std::make_shared<Ifade>();d->tip=IfadeTipi::NULL_LITERAL;d->satir=s;return d;}
    if(kontrol(TokTip::IDENTIFIER)){auto t=ilerle();auto d=std::make_shared<Ifade>();d->tip=IfadeTipi::TANIMLAYICI;d->isim=t.deger;d->satir=s;return d;}
    if(kontrol(TokTip::SOL_KOSELI)) return listeOlustur();
    if(kontrol(TokTip::SOL_SUSLU))  return sozlukOlustur();
    if(eslestir(TokTip::SOL_PARAN)){auto e=ifadeAyristir();bekle(TokTip::SAG_PARAN,")");return e;}
    throw ParserHatasi("Beklenmeyen token: '"+mevcut().deger+"'", s);
}
IfadePtr Parser::listeOlustur() {
    int s=mevcut().satir; bekle(TokTip::SOL_KOSELI,"[");
    auto d=std::make_shared<Ifade>(); d->tip=IfadeTipi::LISTE_OLUSTUR; d->satir=s;
    while(!bittiMi()&&!kontrol(TokTip::SAG_KOSELI)){d->elemanlar.push_back(ifadeAyristir());if(!eslestir(TokTip::VIRGUL))break;}
    bekle(TokTip::SAG_KOSELI,"]"); return d;
}
IfadePtr Parser::sozlukOlustur() {
    int s=mevcut().satir; bekle(TokTip::SOL_SUSLU,"{");
    auto d=std::make_shared<Ifade>(); d->tip=IfadeTipi::SOZLUK_OLUSTUR; d->satir=s;
    while(!bittiMi()&&!kontrol(TokTip::SAG_SUSLU)){std::string k=bekle(TokTip::METIN_LITERAL,"anahtar").deger;bekle(TokTip::IKI_NOKTA,":");auto v=ifadeAyristir();d->sozlukCiftleri.push_back({k,v});if(!eslestir(TokTip::VIRGUL))break;}
    bekle(TokTip::SAG_SUSLU,"}"); return d;
}
std::vector<std::string> Parser::paramList() {
    std::vector<std::string> p; if(kontrol(TokTip::SAG_PARAN))return p;
    p.push_back(bekle(TokTip::IDENTIFIER,"parametre adi").deger);
    while(eslestir(TokTip::VIRGUL))p.push_back(bekle(TokTip::IDENTIFIER,"parametre adi").deger);
    return p;
}
std::vector<IfadePtr> Parser::argList() {
    std::vector<IfadePtr> a; if(kontrol(TokTip::SAG_PARAN))return a;
    a.push_back(ifadeAyristir());
    while(eslestir(TokTip::VIRGUL))a.push_back(ifadeAyristir());
    return a;
}
