#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <thread>
#include "Lexer.h"
#include "Parser.h"
#include "Evaluator.h"
#include "Debugger.h"

static Evaluator* g_evaluator = nullptr;
static Debugger*  g_debugger  = nullptr;

std::string dosyaOku(const std::string& yol) {
    std::ifstream f(yol);
    if (!f.is_open()) throw std::runtime_error("Dosya acilamadi: " + yol);
    std::ostringstream ss; ss << f.rdbuf(); return ss.str();
}

int calistir(const std::string& kaynak, bool debugModu) {
    try {
        Lexer       lexer(kaynak);
        auto        tokenler = lexer.tokenlestir();
        Parser      parser(std::move(tokenler));
        auto        program  = parser.ayristir();
        Evaluator   evaluator;
        g_evaluator = &evaluator;

        if (debugModu) {
            Debugger debugger;
            g_debugger               = &debugger;
            evaluator.debugger       = &debugger;
            evaluator.debugModuAcik  = true;
            debugger.mesajGonder = [](const std::string& msg) {
                std::cout << "DEBUG_MSG:" << msg << std::endl;
                std::cout.flush();
            };
            std::shared_ptr<Ortam> ortamRef;
            std::thread stdinT([&]() {
                std::string satir;
                while (std::getline(std::cin, satir)) {
                    if (satir.empty()) continue;
                    debugger.komutIsleme(satir);
                    if (satir == "CIKIS" || satir == "QUIT") break;
                }
            });
            stdinT.detach();
            std::cout << "DEBUG_MSG:{\"tip\":\"HAZIR\",\"mesaj\":\"Debug modu baslatildi\"}" << std::endl;
            evaluator.calistir(program);
            std::cout << "DEBUG_MSG:{\"tip\":\"BITTI\",\"mesaj\":\"Program tamamlandi\"}" << std::endl;
        } else {
            evaluator.calistir(program);
        }
        return 0;
    } catch (ParserHatasi& e) {
        std::cerr << "HATA [Satir " << e.satir << "]: " << e.what() << std::endl;
        return 1;
    } catch (CikisSinyali& c) { return c.kod; }
      catch (std::exception& e) { std::cerr << "HATA: " << e.what() << std::endl; return 1; }
}

void tokenlerGoster(const std::string& kaynak) {
    Lexer lexer(kaynak);
    auto  tokenler = lexer.tokenlestir();
    std::cout << "=== TOKEN LISTESI ===\n";
    for (auto& t : tokenler) {
        if (t.tip == TokTip::DOSYA_SONU) break;
        std::cout << "[Satir " << t.satir << ":" << t.sutun << "] "
                  << tokenTipAdi(t.tip) << " -> \"" << t.deger << "\"\n";
    }
}

void yardimGoster() {
    std::cout << "== ILKER STUDIO Derleyici ==\n"
              << "Kullanim:\n"
              << "  --calistir <dosya.ilk>   : Calıstır\n"
              << "  --debug    <dosya.ilk>   : Debug modu\n"
              << "  --tokenler <dosya.ilk>   : Token listesi\n"
              << "  --yardim                 : Bu mesaj\n";
}

int main(int argc, char* argv[]) {
    // UTF-8 konsol (Windows)
    system("chcp 65001 > nul 2>&1");

    if (argc < 2) { yardimGoster(); return 0; }

    std::string mod = argv[1];
    if (mod == "--yardim" || mod == "-y") { yardimGoster(); return 0; }
    if (argc < 3) { std::cerr << "Dosya yolu gerekli.\n"; return 1; }

    std::string kaynak;
    try { kaynak = dosyaOku(argv[2]); }
    catch (std::exception& e) { std::cerr << e.what() << "\n"; return 1; }

    if      (mod == "--calistir" || mod == "-c") return calistir(kaynak, false);
    else if (mod == "--debug"    || mod == "-d") return calistir(kaynak, true);
    else if (mod == "--tokenler" || mod == "-t") { tokenlerGoster(kaynak); return 0; }
    else return calistir(kaynak, false);
}
