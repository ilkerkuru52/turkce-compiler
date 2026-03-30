#pragma once
#include <string>

// Token tip enum - ASCII isimler (windows.h cakismasini onlemek icin)
enum class TokTip {
    SAYI_LITERAL, METIN_LITERAL, DOGRU_LITERAL, YANLIS_LITERAL, TANIMSIZ_LITERAL,
    IDENTIFIER,
    // Türkçe anahtar kelimeler
    DEGISKEN, SABIT, EGER, DEGILSE, YOKSA, DONGU, ICIN, SURE,
    DONDUR, KIRKIT, DEVAM, FONKSIYON, SINIF, YENI, BU, MIRAS,
    ARAYUZ, GERI_DON, YAZDIR, OKU, DAHIL_ET, CIKIS,
    // Operatörler (ASCII isim)
    OP_ARTI, OP_EKSI, OP_CARP, OP_BOL, OP_MOD, OP_US,
    OP_ESIT, OP_ESIT_ESIT, OP_ESIT_DEGIL,
    OP_KUCUK, OP_BUYUK, OP_KUCUK_ESIT, OP_BUYUK_ESIT,
    OP_VE, OP_VEYA, OP_DEGIL,
    OP_BIT_VE, OP_BIT_VEYA, OP_BIT_DEGIL, OP_BIT_XOR,
    OP_SOLA, OP_SAGA,
    OP_ARTTIR, OP_AZALT,
    OP_TOPLA_ESIT, OP_CIKAR_ESIT, OP_CARP_ESIT, OP_BOL_ESIT, OP_MOD_ESIT,
    // Ayraçlar
    SOL_PARAN, SAG_PARAN, SOL_SUSLU, SAG_SUSLU, SOL_KOSELI, SAG_KOSELI,
    NOKTALI_VIRGUL, VIRGUL, NOKTA, IKI_NOKTA, OK, CIFT_NOKTA, SORU,
    // Tipler
    SAYI_TIPI, METIN_TIPI, BOOL_TIPI, VOID_TIPI, LISTE_TIPI, SOZLUK_TIPI, OTOMATIK,
    // Özel
    DOSYA_SONU, BILINMEYEN
};

struct Token {
    TokTip      tip;
    std::string deger;
    int         satir;
    int         sutun;
    Token(TokTip t, std::string d, int s, int c)
        : tip(t), deger(std::move(d)), satir(s), sutun(c) {}
    std::string tipAdi() const;
};

inline std::string tokenTipAdi(TokTip t) {
    switch (t) {
        case TokTip::SAYI_LITERAL:  return "SAYI";
        case TokTip::METIN_LITERAL: return "METIN";
        case TokTip::IDENTIFIER:    return "TANIM";
        case TokTip::YAZDIR:        return "yazdir";
        case TokTip::EGER:          return "eger";
        case TokTip::DEGILSE:       return "degilse";
        case TokTip::DONGU:         return "dongu";
        case TokTip::FONKSIYON:     return "fonksiyon";
        case TokTip::DEGISKEN:      return "degisken";
        case TokTip::DOSYA_SONU:    return "DOSYA_SONU";
        default:                    return "?";
    }
}
inline std::string Token::tipAdi() const { return tokenTipAdi(tip); }
