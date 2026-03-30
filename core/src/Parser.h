#pragma once
#include "Token.h"
#include "AST.h"
#include <vector>
#include <stdexcept>

class ParserHatasi : public std::runtime_error {
public:
    int satir;
    ParserHatasi(const std::string& m, int s) : std::runtime_error(m), satir(s) {}
};

class Parser {
public:
    explicit Parser(std::vector<Token> tokenler);
    std::vector<DeyimPtr> ayristir();
private:
    std::vector<Token> tokenler;
    size_t konum;
    Token& mevcut(); Token& sonraki(); Token& ilerle();
    bool bittiMi() const; bool kontrol(TokTip t) const; bool kontrol(TokTip t, int ofset) const;
    Token& bekle(TokTip t, const std::string& msg); bool eslestir(TokTip t);
    DeyimPtr deyimAyristir(); DeyimPtr degiskenTanimi(); DeyimPtr sabitTanimi();
    DeyimPtr fonksiyonTanimi(); DeyimPtr sinifTanimi(); DeyimPtr egerDeyimi();
    DeyimPtr donguDeyimi(); DeyimPtr sureDeyimi(); DeyimPtr geriDonDeyimi();
    DeyimPtr yazdirDeyimi(); DeyimPtr okuDeyimi(); DeyimPtr dahilEtDeyimi();
    DeyimPtr cikisDeyimi(); DeyimPtr kirkitlaDeyimi(); DeyimPtr devamDeyimi();
    DeyimPtr ifadeDeyimi(); std::vector<DeyimPtr> blokAyristir();
    IfadePtr ifadeAyristir(); IfadePtr atama(); IfadePtr ucluKosul();
    IfadePtr mantikselVeya(); IfadePtr mantikselVe(); IfadePtr esitlikKarsilastir();
    IfadePtr buyuklukKarsilastir(); IfadePtr bitseller(); IfadePtr toplama();
    IfadePtr carpma(); IfadePtr us(); IfadePtr tekliOp(); IfadePtr cagriVeUye();
    IfadePtr birincil(); IfadePtr listeOlustur(); IfadePtr sozlukOlustur();
    std::vector<std::string> paramList(); std::vector<IfadePtr> argList();
};
