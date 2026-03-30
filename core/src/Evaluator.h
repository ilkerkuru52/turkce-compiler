#pragma once
#include "AST.h"
#include <unordered_map>
#include <string>
#include <functional>
#include <variant>
#include <memory>
#include <vector>
#include <stdexcept>
#include <iostream>

// İlker değer tipi: sayi, metin, bool, null, liste, sozluk, fonksiyon
class IlkerFonksiyon;
class IlkerNesne;

struct IlkerDeger {
    enum class Tip { SAYI, METIN, BOOL, NULL_TIP, LISTE, SOZLUK, FONKSIYON } tip = Tip::NULL_TIP;
    double sayi = 0.0;
    std::string metin;
    bool bool_deger = false;
    std::shared_ptr<std::vector<IlkerDeger>> liste;
    std::shared_ptr<std::unordered_map<std::string, IlkerDeger>> sozluk;
    std::shared_ptr<IlkerFonksiyon> fonksiyon;

    static IlkerDeger sayiYap(double v) { IlkerDeger d; d.tip = Tip::SAYI; d.sayi = v; return d; }
    static IlkerDeger metinYap(std::string s) { IlkerDeger d; d.tip = Tip::METIN; d.metin = std::move(s); return d; }
    static IlkerDeger boolYap(bool b) { IlkerDeger d; d.tip = Tip::BOOL; d.bool_deger = b; return d; }
    static IlkerDeger nullYap() { return IlkerDeger(); }
    static IlkerDeger listeYap(std::shared_ptr<std::vector<IlkerDeger>> l) {
        IlkerDeger d; d.tip = Tip::LISTE; d.liste = l; return d;
    }
    static IlkerDeger sozlukYap(std::shared_ptr<std::unordered_map<std::string, IlkerDeger>> s) {
        IlkerDeger d; d.tip = Tip::SOZLUK; d.sozluk = s; return d;
    }

    bool dogruMu() const {
        switch (tip) {
            case Tip::BOOL: return bool_deger;
            case Tip::SAYI: return sayi != 0.0;
            case Tip::METIN: return !metin.empty();
            case Tip::NULL_TIP: return false;
            case Tip::LISTE: return liste && !liste->empty();
            default: return true;
        }
    }
    
    std::string metinGoster() const {
        switch (tip) {
            case Tip::SAYI: {
                if (sayi == (long long)sayi) return std::to_string((long long)sayi);
                return std::to_string(sayi);
            }
            case Tip::METIN: return metin;
            case Tip::BOOL: return bool_deger ? "dogru" : "yanlis";
            case Tip::NULL_TIP: return "tanimsiz";
            case Tip::LISTE: {
                std::string s = "[";
                if (liste) for (size_t i = 0; i < liste->size(); i++) {
                    if (i > 0) s += ", ";
                    s += (*liste)[i].metinGoster();
                }
                return s + "]";
            }
            case Tip::SOZLUK: return "{...sozluk...}";
            case Tip::FONKSIYON: return "<fonksiyon>";
            default: return "?";
        }
    }
    
    std::string tipAdi() const {
        switch (tip) {
            case Tip::SAYI: return "sayi";
            case Tip::METIN: return "metin";
            case Tip::BOOL: return "bool";
            case Tip::NULL_TIP: return "tanimsiz";
            case Tip::LISTE: return "liste";
            case Tip::SOZLUK: return "sozluk";
            case Tip::FONKSIYON: return "fonksiyon";
        }
        return "?";
    }
};

struct IlkerFonksiyon {
    std::vector<std::string> parametreler;
    std::vector<DeyimPtr> govde;
    std::shared_ptr<void> kapatma; // environment
    bool yerlesik = false;
    std::function<IlkerDeger(std::vector<IlkerDeger>)> yerlesikFonk;
};

// Control flow signals (exceptions)
struct GeriDonSinyali { IlkerDeger deger; };
struct KirkitlaSinyali {};
struct DevamSinyali {};
struct CikisSinyali { int kod; };

class Ortam {
public:
    std::shared_ptr<Ortam> ust;
    std::unordered_map<std::string, IlkerDeger> degiskenler;

    explicit Ortam(std::shared_ptr<Ortam> ust = nullptr) : ust(std::move(ust)) {}

    IlkerDeger al(const std::string& isim) const {
        auto it = degiskenler.find(isim);
        if (it != degiskenler.end()) return it->second;
        if (ust) return ust->al(isim);
        throw std::runtime_error("Hata: Tanımsız değişken: '" + isim + "'");
    }

    void tanimla(const std::string& isim, IlkerDeger deger) {
        degiskenler[isim] = std::move(deger);
    }

    bool ata(const std::string& isim, IlkerDeger deger) {
        auto it = degiskenler.find(isim);
        if (it != degiskenler.end()) { it->second = std::move(deger); return true; }
        if (ust) return ust->ata(isim, std::move(deger));
        return false;
    }

    std::unordered_map<std::string, IlkerDeger> tumDegiskenler() const {
        std::unordered_map<std::string, IlkerDeger> tum;
        if (ust) tum = ust->tumDegiskenler();
        for (auto& [k, v] : degiskenler) tum[k] = v;
        return tum;
    }
};

class Debugger;

class Evaluator {
public:
    std::shared_ptr<Ortam> global;
    Debugger* debugger = nullptr;
    bool debugModuAcik = false;
    std::string ciktiBuffer;
    bool ciktiTopla = false; // true = collect, false = direct stdout

    Evaluator();
    
    void calistir(const std::vector<DeyimPtr>& program);
    IlkerDeger deyimCalistir(const DeyimPtr& deyim, std::shared_ptr<Ortam>& ortam);
    IlkerDeger ifadeDegerlendir(const IfadePtr& ifade, std::shared_ptr<Ortam>& ortam);
    
private:
    void yerlesiklerKur();
    IlkerDeger fonksiyonCagir(const IlkerDeger& fonk, std::vector<IlkerDeger> argümanlar, int satir);
    IlkerDeger ikiliOpDegerlendir(const std::string& op, const IlkerDeger& sol, const IlkerDeger& sag, int satir);
    void yazdirCikti(const std::string& metin);
};
