#pragma once
#include "Token.h"
#include <vector>
#include <unordered_map>

class Lexer {
public:
    explicit Lexer(const std::string& kaynak);
    std::vector<Token> tokenlestir();
private:
    std::string kaynak;
    size_t konum; int satir, sutun;
    static const std::unordered_map<std::string, TokTip> ANAHTAR_KELIMELER;
    char mevcutKarakter() const;
    char sonrakiKarakter() const;
    char ilerle();
    void bosluklariAtla();
    void yorumuAtla();
    Token sayiOku();
    Token metinOku();
    Token tanimlayiciOku();
    Token operatorOku();
};
