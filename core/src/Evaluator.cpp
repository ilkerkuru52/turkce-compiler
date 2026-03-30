#include "Evaluator.h"
#include "Debugger.h"
#include <cmath>
#include <sstream>
#include <iostream>
#include <algorithm>
#include <fstream>

// ===== ÇIKTI =====
void Evaluator::yazdirCikti(const std::string& metin) {
    if (ciktiTopla) {
        ciktiBuffer += metin;
    } else {
        std::lock_guard<std::mutex> lock(Debugger::getCiktiMutex());
        std::cout << metin;
        std::cout.flush();
    }
}

// ===== YERLEŞİK FONKSİYONLAR =====
void Evaluator::yerlesiklerKur() {
    auto ekle = [&](const std::string& isim, std::function<IlkerDeger(std::vector<IlkerDeger>)> f) {
        IlkerDeger iv;
        iv.tip = IlkerDeger::Tip::FONKSIYON;
        iv.fonksiyon = std::make_shared<IlkerFonksiyon>();
        iv.fonksiyon->yerlesik = true;
        iv.fonksiyon->yerlesikFonk = f;
        global->tanimla(isim, iv);
    };

    ekle("uzunluk", [](std::vector<IlkerDeger> args) -> IlkerDeger {
        if (args.empty()) throw std::runtime_error("uzunluk: argüman gerekli");
        auto& a = args[0];
        if (a.tip == IlkerDeger::Tip::METIN) return IlkerDeger::sayiYap(a.metin.size());
        if (a.tip == IlkerDeger::Tip::LISTE && a.liste) return IlkerDeger::sayiYap(a.liste->size());
        throw std::runtime_error("uzunluk: metin veya liste bekleniyor");
    });
    ekle("str", [](std::vector<IlkerDeger> args) -> IlkerDeger {
        if (args.empty()) return IlkerDeger::metinYap("");
        return IlkerDeger::metinYap(args[0].metinGoster());
    });
    ekle("sayi", [](std::vector<IlkerDeger> args) -> IlkerDeger {
        if (args.empty()) return IlkerDeger::sayiYap(0);
        if (args[0].tip == IlkerDeger::Tip::SAYI) return args[0];
        if (args[0].tip == IlkerDeger::Tip::METIN) {
            try { return IlkerDeger::sayiYap(std::stod(args[0].metin)); }
            catch (...) { throw std::runtime_error("sayi(): dönüştürülemez değer: " + args[0].metin); }
        }
        throw std::runtime_error("sayi(): metin veya sayı bekleniyor");
    });
    ekle("tur", [](std::vector<IlkerDeger> args) -> IlkerDeger {
        if (args.empty()) return IlkerDeger::metinYap("tanimsiz");
        return IlkerDeger::metinYap(args[0].tipAdi());
    });
    ekle("ekle", [](std::vector<IlkerDeger> args) -> IlkerDeger {
        if (args.size() < 2 || args[0].tip != IlkerDeger::Tip::LISTE)
            throw std::runtime_error("ekle: liste ve eleman gerekli");
        args[0].liste->push_back(args[1]);
        return IlkerDeger::nullYap();
    });
    ekle("cikar", [](std::vector<IlkerDeger> args) -> IlkerDeger {
        if (args.empty() || args[0].tip != IlkerDeger::Tip::LISTE)
            throw std::runtime_error("cikar: liste gerekli");
        if (!args[0].liste->empty()) args[0].liste->pop_back();
        return IlkerDeger::nullYap();
    });
    ekle("kucuk_harf", [](std::vector<IlkerDeger> args) -> IlkerDeger {
        if (args.empty()) return IlkerDeger::metinYap("");
        std::string s = args[0].metin;
        std::transform(s.begin(), s.end(), s.begin(), ::tolower);
        return IlkerDeger::metinYap(s);
    });
    ekle("buyuk_harf", [](std::vector<IlkerDeger> args) -> IlkerDeger {
        if (args.empty()) return IlkerDeger::metinYap("");
        std::string s = args[0].metin;
        std::transform(s.begin(), s.end(), s.begin(), ::toupper);
        return IlkerDeger::metinYap(s);
    });
    ekle("kok", [](std::vector<IlkerDeger> args) -> IlkerDeger {
        if (args.empty()) throw std::runtime_error("kok: argüman gerekli");
        return IlkerDeger::sayiYap(std::sqrt(args[0].sayi));
    });
    ekle("mutlak", [](std::vector<IlkerDeger> args) -> IlkerDeger {
        if (args.empty()) throw std::runtime_error("mutlak: argüman gerekli");
        return IlkerDeger::sayiYap(std::abs(args[0].sayi));
    });
    ekle("max", [](std::vector<IlkerDeger> args) -> IlkerDeger {
        if (args.size() < 2) throw std::runtime_error("max: iki argüman gerekli");
        return args[0].sayi >= args[1].sayi ? args[0] : args[1];
    });
    ekle("min", [](std::vector<IlkerDeger> args) -> IlkerDeger {
        if (args.size() < 2) throw std::runtime_error("min: iki argüman gerekli");
        return args[0].sayi <= args[1].sayi ? args[0] : args[1];
    });
    ekle("yuvarlak", [](std::vector<IlkerDeger> args) -> IlkerDeger {
        if (args.empty()) throw std::runtime_error("yuvarlak: argüman gerekli");
        return IlkerDeger::sayiYap(std::round(args[0].sayi));
    });
    ekle("tavan", [](std::vector<IlkerDeger> args) -> IlkerDeger {
        if (args.empty()) throw std::runtime_error("tavan: argüman gerekli");
        return IlkerDeger::sayiYap(std::ceil(args[0].sayi));
    });
    ekle("taban", [](std::vector<IlkerDeger> args) -> IlkerDeger {
        if (args.empty()) throw std::runtime_error("taban: argüman gerekli");
        return IlkerDeger::sayiYap(std::floor(args[0].sayi));
    });
    ekle("liste_olustur", [](std::vector<IlkerDeger>) -> IlkerDeger {
        return IlkerDeger::listeYap(std::make_shared<std::vector<IlkerDeger>>());
    });
    ekle("aralik", [](std::vector<IlkerDeger> args) -> IlkerDeger {
        int baslangic = 0, bitis = 0, adim = 1;
        if (args.size() == 1) { bitis = (int)args[0].sayi; }
        else if (args.size() == 2) { baslangic = (int)args[0].sayi; bitis = (int)args[1].sayi; }
        else if (args.size() >= 3) { baslangic = (int)args[0].sayi; bitis = (int)args[1].sayi; adim = (int)args[2].sayi; }
        auto liste = std::make_shared<std::vector<IlkerDeger>>();
        for (int i = baslangic; i < bitis; i += adim) liste->push_back(IlkerDeger::sayiYap(i));
        return IlkerDeger::listeYap(liste);
    });
}

Evaluator::Evaluator() {
    global = std::make_shared<Ortam>();
    yerlesiklerKur();
}

void Evaluator::calistir(const std::vector<DeyimPtr>& program) {
    auto ortam = global;
    for (auto& d : program) {
        deyimCalistir(d, ortam);
    }
}

// ===== DEYİM ÇALIŞTIRICI =====
IlkerDeger Evaluator::deyimCalistir(const DeyimPtr& deyim, std::shared_ptr<Ortam>& ortam) {
    // Debugger hook
    if (debugModuAcik && debugger && deyim->satir > 0) {
        debugger->satirKontrol(deyim->satir, ortam);
    }

    switch (deyim->tip) {
    case DeyimTipi::DEGISKEN_TANIMI:
    case DeyimTipi::SABIT_TANIMI: {
        IlkerDeger deger = IlkerDeger::nullYap();
        if (deyim->deger) deger = ifadeDegerlendir(deyim->deger, ortam);
        ortam->tanimla(deyim->isim, deger);
        return IlkerDeger::nullYap();
    }
    case DeyimTipi::FONKSIYON_TANIMI: {
        IlkerDeger iv;
        iv.tip = IlkerDeger::Tip::FONKSIYON;
        iv.fonksiyon = std::make_shared<IlkerFonksiyon>();
        iv.fonksiyon->parametreler = deyim->parametreler;
        iv.fonksiyon->govde = deyim->govde;
        ortam->tanimla(deyim->isim, iv);
        return IlkerDeger::nullYap();
    }
    case DeyimTipi::SINIF_TANIMI: {
        // Basit sınıf desteği - fonksiyon olarak kaydet
        return IlkerDeger::nullYap();
    }
    case DeyimTipi::EGER_DEYIMI: {
        IlkerDeger kosul = ifadeDegerlendir(deyim->kosul, ortam);
        if (kosul.dogruMu()) {
            auto ic = std::make_shared<Ortam>(ortam);
            for (auto& d : deyim->govde) deyimCalistir(d, ic);
        } else {
            bool calistirildi = false;
            for (auto& [elifKosul, elifGovde] : deyim->elifDallar) {
                if (ifadeDegerlendir(elifKosul, ortam).dogruMu()) {
                    auto ic = std::make_shared<Ortam>(ortam);
                    for (auto& d : elifGovde) deyimCalistir(d, ic);
                    calistirildi = true;
                    break;
                }
            }
            if (!calistirildi && !deyim->yoksaGovde.empty()) {
                auto ic = std::make_shared<Ortam>(ortam);
                for (auto& d : deyim->yoksaGovde) deyimCalistir(d, ic);
            }
        }
        return IlkerDeger::nullYap();
    }
    case DeyimTipi::DONGU_DEYIMI: {
        auto ic = std::make_shared<Ortam>(ortam);
        if (deyim->baslangic) deyimCalistir(deyim->baslangic, ic);
        while (true) {
            if (deyim->kosul) {
                IlkerDeger k = ifadeDegerlendir(deyim->kosul, ic);
                if (!k.dogruMu()) break;
            }
            try {
                auto blk = std::make_shared<Ortam>(ic);
                for (auto& d : deyim->govde) deyimCalistir(d, blk);
            } catch (KirkitlaSinyali&) { break; }
              catch (DevamSinyali&) {}
            if (deyim->guncelleme) ifadeDegerlendir(deyim->guncelleme, ic);
        }
        return IlkerDeger::nullYap();
    }
    case DeyimTipi::SURE_DEYIMI: {
        while (true) {
            IlkerDeger k = ifadeDegerlendir(deyim->kosul, ortam);
            if (!k.dogruMu()) break;
            try {
                auto ic = std::make_shared<Ortam>(ortam);
                for (auto& d : deyim->govde) deyimCalistir(d, ic);
            } catch (KirkitlaSinyali&) { break; }
              catch (DevamSinyali&) {}
        }
        return IlkerDeger::nullYap();
    }
    case DeyimTipi::GERI_DON_DEYIMI: {
        IlkerDeger deger = IlkerDeger::nullYap();
        if (deyim->ifade) deger = ifadeDegerlendir(deyim->ifade, ortam);
        throw GeriDonSinyali{deger};
    }
    case DeyimTipi::KIRKITLA_DEYIMI:
        throw KirkitlaSinyali{};
    case DeyimTipi::DEVAM_DEYIMI:
        throw DevamSinyali{};
    case DeyimTipi::YAZDIR_DEYIMI: {
        IlkerDeger d = ifadeDegerlendir(deyim->ifade, ortam);
        yazdirCikti(d.metinGoster() + "\n");
        return IlkerDeger::nullYap();
    }
    case DeyimTipi::OKU_DEYIMI: {
        std::string girdi;
        std::getline(std::cin, girdi);
        ortam->tanimla(deyim->isim, IlkerDeger::metinYap(girdi));
        return IlkerDeger::nullYap();
    }
    case DeyimTipi::CIKIS_DEYIMI: {
        int kod = 0;
        if (deyim->ifade) {
            IlkerDeger d = ifadeDegerlendir(deyim->ifade, ortam);
            if (d.tip == IlkerDeger::Tip::SAYI) kod = (int)d.sayi;
        }
        throw CikisSinyali{kod};
    }
    case DeyimTipi::IFADE_DEYIMI:
        if (deyim->ifade) return ifadeDegerlendir(deyim->ifade, ortam);
        return IlkerDeger::nullYap();
    case DeyimTipi::BLOK_DEYIMI: {
        auto ic = std::make_shared<Ortam>(ortam);
        for (auto& d : deyim->govde) deyimCalistir(d, ic);
        return IlkerDeger::nullYap();
    }
    default:
        return IlkerDeger::nullYap();
    }
}

// ===== İFADE DEĞERLENDİRİCİ =====
IlkerDeger Evaluator::ifadeDegerlendir(const IfadePtr& ifade, std::shared_ptr<Ortam>& ortam) {
    switch (ifade->tip) {
    case IfadeTipi::SAYI_LITERAL:
        return IlkerDeger::sayiYap(ifade->sayiDeger);
    case IfadeTipi::METIN_LITERAL:
        return IlkerDeger::metinYap(ifade->metinDeger);
    case IfadeTipi::BOOL_LITERAL:
        return IlkerDeger::boolYap(ifade->boolDeger);
    case IfadeTipi::NULL_LITERAL:
        return IlkerDeger::nullYap();
    case IfadeTipi::TANIMLAYICI:
        try { return ortam->al(ifade->isim); }
        catch (const std::exception& e) { throw std::runtime_error("Hata (satir " + std::to_string(ifade->satir) + "): " + e.what()); }
    case IfadeTipi::TEKLI_OP: {
        if (ifade->op == "-") {
            auto v = ifadeDegerlendir(ifade->sol, ortam);
            if (v.tip != IlkerDeger::Tip::SAYI) throw std::runtime_error("Tekli eksi: sayı bekleniyor");
            return IlkerDeger::sayiYap(-v.sayi);
        }
        if (ifade->op == "!") {
            auto v = ifadeDegerlendir(ifade->sol, ortam);
            return IlkerDeger::boolYap(!v.dogruMu());
        }
        if (ifade->op == "++" || ifade->op == "--") {
            auto v = ifadeDegerlendir(ifade->sol, ortam);
            double yeni = v.sayi + (ifade->op == "++" ? 1 : -1);
            if (ifade->sol->tip == IfadeTipi::TANIMLAYICI) {
                ortam->ata(ifade->sol->isim, IlkerDeger::sayiYap(yeni));
            }
            return IlkerDeger::sayiYap(yeni);
        }
        if (ifade->op == "++_SONRA" || ifade->op == "--_SONRA") {
            auto v = ifadeDegerlendir(ifade->sol, ortam);
            double yeni = v.sayi + (ifade->op == "++_SONRA" ? 1 : -1);
            if (ifade->sol->tip == IfadeTipi::TANIMLAYICI) {
                ortam->ata(ifade->sol->isim, IlkerDeger::sayiYap(yeni));
            }
            return v; // return OLD value
        }
        throw std::runtime_error("Bilinmeyen tekli operatör: " + ifade->op);
    }
    case IfadeTipi::IKILI_OP: {
        auto sol = ifadeDegerlendir(ifade->sol, ortam);
        auto sag = ifadeDegerlendir(ifade->sag, ortam);
        return ikiliOpDegerlendir(ifade->op, sol, sag, ifade->satir);
    }
    case IfadeTipi::ATAMA: {
        IlkerDeger yeni = ifadeDegerlendir(ifade->sag, ortam);
        if (ifade->op != "=") {
            IlkerDeger eski = ifadeDegerlendir(ifade->sol, ortam);
            std::string op = ifade->op.substr(0, ifade->op.size() - 1);
            yeni = ikiliOpDegerlendir(op, eski, yeni, ifade->satir);
        }
        if (ifade->sol->tip == IfadeTipi::TANIMLAYICI) {
            if (!ortam->ata(ifade->sol->isim, yeni)) {
                ortam->tanimla(ifade->sol->isim, yeni);
            }
        } else if (ifade->sol->tip == IfadeTipi::UYE_ERISIM) {
            auto obj = ifadeDegerlendir(ifade->sol->sol, ortam);
            if (obj.tip == IlkerDeger::Tip::SOZLUK && obj.sozluk) {
                (*obj.sozluk)[ifade->sol->isim] = yeni;
            }
        } else if (ifade->sol->tip == IfadeTipi::DIZIN_ERISIM) {
            auto obj = ifadeDegerlendir(ifade->sol->sol, ortam);
            auto idx = ifadeDegerlendir(ifade->sol->sag, ortam);
            if (obj.tip == IlkerDeger::Tip::LISTE && obj.liste) {
                int i = (int)idx.sayi;
                if (i < 0) i += obj.liste->size();
                if (i >= 0 && i < (int)obj.liste->size()) (*obj.liste)[i] = yeni;
            }
        }
        return yeni;
    }
    case IfadeTipi::FONKSIYON_CAGRI: {
        auto fonk = ifadeDegerlendir(ifade->hedef, ortam);
        std::vector<IlkerDeger> args;
        for (auto& a : ifade->argümanlar) args.push_back(ifadeDegerlendir(a, ortam));
        return fonksiyonCagir(fonk, args, ifade->satir);
    }
    case IfadeTipi::UYE_ERISIM: {
        auto obj = ifadeDegerlendir(ifade->sol, ortam);
        if (obj.tip == IlkerDeger::Tip::SOZLUK && obj.sozluk) {
            auto it = obj.sozluk->find(ifade->isim);
            if (it != obj.sozluk->end()) return it->second;
            return IlkerDeger::nullYap();
        }
        if (obj.tip == IlkerDeger::Tip::METIN) {
            if (ifade->isim == "uzunluk") return IlkerDeger::sayiYap(obj.metin.size());
            if (ifade->isim == "ust") {
                auto s = obj.metin; std::transform(s.begin(),s.end(),s.begin(),::toupper);
                return IlkerDeger::metinYap(s);
            }
            if (ifade->isim == "alt") {
                auto s = obj.metin; std::transform(s.begin(),s.end(),s.begin(),::tolower);
                return IlkerDeger::metinYap(s);
            }
        }
        if (obj.tip == IlkerDeger::Tip::LISTE && obj.liste) {
            if (ifade->isim == "uzunluk") return IlkerDeger::sayiYap(obj.liste->size());
        }
        throw std::runtime_error("Bilinmeyen üye: " + ifade->isim);
    }
    case IfadeTipi::DIZIN_ERISIM: {
        auto obj = ifadeDegerlendir(ifade->sol, ortam);
        auto idx = ifadeDegerlendir(ifade->sag, ortam);
        if (obj.tip == IlkerDeger::Tip::LISTE && obj.liste) {
            int i = (int)idx.sayi;
            if (i < 0) i += obj.liste->size();
            if (i < 0 || i >= (int)obj.liste->size()) throw std::runtime_error("Liste dizin sınır dışı: " + std::to_string(i));
            return (*obj.liste)[i];
        }
        if (obj.tip == IlkerDeger::Tip::SOZLUK && obj.sozluk) {
            auto key = idx.metinGoster();
            auto it = obj.sozluk->find(key);
            if (it != obj.sozluk->end()) return it->second;
            return IlkerDeger::nullYap();
        }
        if (obj.tip == IlkerDeger::Tip::METIN) {
            int i = (int)idx.sayi;
            if (i < 0) i += obj.metin.size();
            if (i < 0 || i >= (int)obj.metin.size()) throw std::runtime_error("Metin dizin sınır dışı");
            return IlkerDeger::metinYap(std::string(1, obj.metin[i]));
        }
        throw std::runtime_error("Dizin erişimi: liste veya sözlük gerekli");
    }
    case IfadeTipi::LISTE_OLUSTUR: {
        auto liste = std::make_shared<std::vector<IlkerDeger>>();
        for (auto& e : ifade->elemanlar) liste->push_back(ifadeDegerlendir(e, ortam));
        return IlkerDeger::listeYap(liste);
    }
    case IfadeTipi::SOZLUK_OLUSTUR: {
        auto sozluk = std::make_shared<std::unordered_map<std::string, IlkerDeger>>();
        for (auto& [k, v] : ifade->sozlukCiftleri) (*sozluk)[k] = ifadeDegerlendir(v, ortam);
        return IlkerDeger::sozlukYap(sozluk);
    }
    case IfadeTipi::KOSULLU: {
        auto k = ifadeDegerlendir(ifade->kosul, ortam);
        if (k.dogruMu()) return ifadeDegerlendir(ifade->dogruKol, ortam);
        return ifadeDegerlendir(ifade->yanlisFKol, ortam);
    }
    default:
        return IlkerDeger::nullYap();
    }
}

IlkerDeger Evaluator::fonksiyonCagir(const IlkerDeger& fonk, std::vector<IlkerDeger> args, int satir) {
    if (fonk.tip != IlkerDeger::Tip::FONKSIYON || !fonk.fonksiyon)
        throw std::runtime_error("Çağrılabilir değil (Satır " + std::to_string(satir) + ")");
    if (fonk.fonksiyon->yerlesik) {
        return fonk.fonksiyon->yerlesikFonk(args);
    }
    auto ic = std::make_shared<Ortam>(global);
    auto& params = fonk.fonksiyon->parametreler;
    for (size_t i = 0; i < params.size(); i++) {
        ic->tanimla(params[i], i < args.size() ? args[i] : IlkerDeger::nullYap());
    }
    try {
        for (auto& d : fonk.fonksiyon->govde) deyimCalistir(d, ic);
    } catch (GeriDonSinyali& s) { return s.deger; }
    return IlkerDeger::nullYap();
}

IlkerDeger Evaluator::ikiliOpDegerlendir(const std::string& op, const IlkerDeger& sol, const IlkerDeger& sag, int satir) {
    // Metin birleştirme
    if (op == "+" && (sol.tip == IlkerDeger::Tip::METIN || sag.tip == IlkerDeger::Tip::METIN)) {
        return IlkerDeger::metinYap(sol.metinGoster() + sag.metinGoster());
    }
    // Liste birleştirme
    if (op == "+" && sol.tip == IlkerDeger::Tip::LISTE && sag.tip == IlkerDeger::Tip::LISTE) {
        auto yeni = std::make_shared<std::vector<IlkerDeger>>(*sol.liste);
        yeni->insert(yeni->end(), sag.liste->begin(), sag.liste->end());
        return IlkerDeger::listeYap(yeni);
    }
    // Sayısal işlemler
    if (op == "+" || op == "-" || op == "*" || op == "/" || op == "%" || op == "**") {
        if (sol.tip != IlkerDeger::Tip::SAYI || sag.tip != IlkerDeger::Tip::SAYI)
            throw std::runtime_error("Aritmetik: sayı bekleniyor (Satır " + std::to_string(satir) + ")");
        if (op == "+") return IlkerDeger::sayiYap(sol.sayi + sag.sayi);
        if (op == "-") return IlkerDeger::sayiYap(sol.sayi - sag.sayi);
        if (op == "*") return IlkerDeger::sayiYap(sol.sayi * sag.sayi);
        if (op == "/") {
            if (sag.sayi == 0) throw std::runtime_error("Sıfıra bölme hatası");
            return IlkerDeger::sayiYap(sol.sayi / sag.sayi);
        }
        if (op == "%") return IlkerDeger::sayiYap(fmod(sol.sayi, sag.sayi));
        if (op == "**") return IlkerDeger::sayiYap(pow(sol.sayi, sag.sayi));
    }
    // Karşılaştırma
    if (op == "==" ) return IlkerDeger::boolYap(sol.metinGoster() == sag.metinGoster());
    if (op == "!=" ) return IlkerDeger::boolYap(sol.metinGoster() != sag.metinGoster());
    if (op == "<" ) return IlkerDeger::boolYap(sol.sayi < sag.sayi);
    if (op == ">" ) return IlkerDeger::boolYap(sol.sayi > sag.sayi);
    if (op == "<=") return IlkerDeger::boolYap(sol.sayi <= sag.sayi);
    if (op == ">=") return IlkerDeger::boolYap(sol.sayi >= sag.sayi);
    // Mantıksal
    if (op == "&&") return IlkerDeger::boolYap(sol.dogruMu() && sag.dogruMu());
    if (op == "||") return IlkerDeger::boolYap(sol.dogruMu() || sag.dogruMu());
    throw std::runtime_error("Bilinmeyen operatör: " + op);
}
