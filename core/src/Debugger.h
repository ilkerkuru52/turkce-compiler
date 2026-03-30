#pragma once
#include "Evaluator.h"
#include <set>
#include <mutex>
#include <condition_variable>
#include <string>
#include <unordered_map>
#include <iostream>
#include <sstream>
#include <iomanip>
#include <memory>

enum class DebugDurum { CALISIYOR, DURAKLATILDI, BITTI };
enum class DebugKomut { DEVAM, ADIMLA, ADIM_ICERIDE, VARS, BREAKPOINTS, EKLE, CIKAR };

struct DebugSatirBilgi {
    int satir;
    std::unordered_map<std::string, std::string> degiskenler;
};

class Debugger {
public:
    std::set<int> breakpointler;
    DebugDurum durum = DebugDurum::CALISIYOR;
    bool adimModu = true;
    
    std::mutex mx;
    std::condition_variable cv;
    
    // Callback for output
    std::function<void(const std::string&)> mesajGonder;
    
    // Output mutex to prevent mixing with normal stdout
    static std::mutex& getCiktiMutex() {
        static std::mutex m;
        return m;
    }
    
    Debugger() = default;
    
    void breakpointEkle(int satir) { breakpointler.insert(satir); }
    void breakpointCikar(int satir) { breakpointler.erase(satir); }
    
    // Called by Evaluator on each statement
    void satirKontrol(int satir, std::shared_ptr<Ortam>& ortam) {
        bool durdur = adimModu || (breakpointler.count(satir) > 0);
        if (!durdur) return;
        
        {
            std::unique_lock<std::mutex> lock(mx);
            gecerliOrtam = ortam;
        }

        durum = DebugDurum::DURAKLATILDI;
        adimModu = false;
        
        // Build vars JSON
        std::string varsJson = degiskenlerJson(satir, ortam);
        if (mesajGonder) {
            std::lock_guard<std::mutex> lock(getCiktiMutex());
            mesajGonder("{\"tip\":\"DURAKLATILDI\",\"satir\":" + std::to_string(satir) + ",\"degiskenler\":" + varsJson + "}");
        }
        
        // Wait for command
        bekle(ortam);
        
        {
            std::unique_lock<std::mutex> lock(mx);
            gecerliOrtam = nullptr;
        }
    }
    
    // Process an incoming debug command string
    void komutIsleme(const std::string& komut) {
        std::unique_lock<std::mutex> lock(mx);
        if (komut == "ADIMLA" || komut == "STEP") {
            adimModu = true;
            durum = DebugDurum::CALISIYOR;
            cv.notify_all();
        } else if (komut == "DEVAM" || komut == "CONT") {
            adimModu = false;
            durum = DebugDurum::CALISIYOR;
            cv.notify_all();
        } else if (komut.substr(0, 5) == "VARS?") {
            if (mesajGonder && gecerliOrtam) {
                mesajGonder("{\"tip\":\"VARS\",\"degiskenler\":" + degiskenlerJson(0, gecerliOrtam) + "}");
            }
        } else if (komut.substr(0, 4) == "ADD ") {
            try { breakpointEkle(std::stoi(komut.substr(4))); } catch (...) {}
        } else if (komut.substr(0, 4) == "REM ") {
            try { breakpointCikar(std::stoi(komut.substr(4))); } catch (...) {}
        }
    }

private:
    std::shared_ptr<Ortam> gecerliOrtam;

    void bekle(std::shared_ptr<Ortam>& ortam) {
        std::unique_lock<std::mutex> lock(mx);
        cv.wait(lock, [this]{ return durum == DebugDurum::CALISIYOR; });
    }
    
    std::string jsonEscape(const std::string& s) {
        std::ostringstream o;
        for (auto c : s) {
            if (c == '"') o << "\\\"";
            else if (c == '\\') o << "\\\\";
            else if (c == '\b') o << "\\b";
            else if (c == '\f') o << "\\f";
            else if (c == '\n') o << "\\n";
            else if (c == '\r') o << "\\r";
            else if (c == '\t') o << "\\t";
            else if (unsigned(c) < 32) o << "\\u" << std::hex << std::setw(4) << std::setfill('0') << int(c);
            else o << c;
        }
        return o.str();
    }

    std::string degiskenlerJson(int satir, std::shared_ptr<Ortam>& ortam) {
        if (!ortam) return "{}";
        auto tum = ortam->tumDegiskenler();
        std::ostringstream json;
        json << "{";
        bool ilk = true;
        for (auto& [k, v] : tum) {
            if (k.substr(0,2) == "__") continue; // skip internals
            if (!ilk) json << ",";
            json << "\"" << jsonEscape(k) << "\":{\"tip\":\"" << v.tipAdi() << "\",\"deger\":\"" << jsonEscape(v.metinGoster()) << "\"}";
            ilk = false;
        }
        json << "}";
        return json.str();
    }
};
