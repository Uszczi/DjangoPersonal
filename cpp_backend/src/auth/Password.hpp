#pragma once

#include <string>
#include <vector>
#include <random>

#include <openssl/evp.h>
#include <openssl/crypto.h>

#include "oatpp/encoding/Base64.hpp"

inline std::vector<std::string> split(const std::string& s, char delim) {
  std::vector<std::string> parts;
  std::string cur;
  for (char c : s) {
    if (c == delim) { parts.push_back(cur); cur.clear(); }
    else cur += c;
  }
  parts.push_back(cur);
  return parts;
}

inline bool verifyDjangoPassword(const std::string& password, const std::string& encoded) {
  auto parts = split(encoded, '$');
  if (parts.size() != 4) return false;
  if (parts[0] != "pbkdf2_sha256") return false;

  int iterations = 0;
  try { iterations = std::stoi(parts[1]); } catch (...) { return false; }
  if (iterations <= 0) return false;

  const std::string& salt = parts[2];
  const std::string& expectedB64 = parts[3];

  auto decoded = oatpp::encoding::Base64::decode(expectedB64.c_str(), (v_buff_size)expectedB64.size());
  if (decoded->size() != 32) return false;

  unsigned char derived[32];
  if (PKCS5_PBKDF2_HMAC(password.c_str(), (int)password.size(),
                         reinterpret_cast<const unsigned char*>(salt.data()), (int)salt.size(),
                         iterations, EVP_sha256(), 32, derived) != 1) {
    return false;
  }

  return CRYPTO_memcmp(derived, decoded->data(), 32) == 0;
}

inline std::string generateSalt(size_t length = 12) {
  static const char chars[] = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  std::random_device rd;
  std::mt19937 gen(rd());
  std::uniform_int_distribution<> dis(0, 61);
  std::string salt;
  salt.reserve(length);
  for (size_t i = 0; i < length; ++i) {
    salt += chars[dis(gen)];
  }
  return salt;
}

inline std::string createDjangoPassword(const std::string& password) {
  std::string salt = generateSalt();
  int iterations = 1500000;

  unsigned char derived[32];
  if (PKCS5_PBKDF2_HMAC(password.c_str(), (int)password.size(),
                         reinterpret_cast<const unsigned char*>(salt.data()), (int)salt.size(),
                         iterations, EVP_sha256(), 32, derived) != 1) {
    return "";
  }

  auto b64 = oatpp::encoding::Base64::encode(derived, 32);
  std::string b64str = b64 ? std::string(*b64) : std::string();
  // trim trailing whitespace/newlines just in case
  while (!b64str.empty() && (b64str.back() == '\n' || b64str.back() == '\r' || b64str.back() == ' ')) {
    b64str.pop_back();
  }

  return "pbkdf2_sha256$" + std::to_string(iterations) + "$" + salt + "$" + b64str;
}
