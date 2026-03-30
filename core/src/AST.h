#pragma once
#include <string>
#include <vector>
#include <memory>
#include <variant>

struct Ifade; struct Deyim;
using IfadePtr = std::shared_ptr<Ifade>;
using DeyimPtr = std::shared_ptr<Deyim>;

enum class IfadeTipi {
    SAYI_LITERAL, METIN_LITERAL, BOOL_LITERAL, NULL_LITERAL,
    TANIMLAYICI, TEKLI_OP, IKILI_OP, ATAMA,
    FONKSIYON_CAGRI, UYE_ERISIM, DIZIN_ERISIM,
    LISTE_OLUSTUR, SOZLUK_OLUSTUR, LAMBDA, KOSULLU
};

struct Ifade {
    IfadeTipi   tip;
    int         satir = 0;
    double      sayiDeger = 0.0;
    std::string metinDeger;
    bool        boolDeger = false;
    std::string isim, op;
    IfadePtr    sol, sag, hedef, kosul, dogruKol, yanlisFKol;
    std::vector<IfadePtr>  argümanlar, elemanlar;
    std::vector<std::string> parametreler;
    std::vector<DeyimPtr>  govde;
    std::vector<std::pair<std::string, IfadePtr>> sozlukCiftleri;
};

enum class DeyimTipi {
    DEGISKEN_TANIMI, SABIT_TANIMI, FONKSIYON_TANIMI, SINIF_TANIMI,
    EGER_DEYIMI, DONGU_DEYIMI, SURE_DEYIMI,
    GERI_DON_DEYIMI, KIRKITLA_DEYIMI, DEVAM_DEYIMI,
    YAZDIR_DEYIMI, OKU_DEYIMI, DAHIL_ET_DEYIMI,
    IFADE_DEYIMI, BLOK_DEYIMI, CIKIS_DEYIMI
};

struct Deyim {
    DeyimTipi   tip;
    int         satir = 0;
    std::string isim, tipAdi, mirasAdi, donusTipi;
    IfadePtr    deger, kosul, guncelleme, ifade;
    DeyimPtr    baslangic;
    std::vector<std::string> parametreler;
    std::vector<DeyimPtr>    govde, yoksaGovde;
    std::vector<std::pair<IfadePtr, std::vector<DeyimPtr>>> elifDallar;
};
