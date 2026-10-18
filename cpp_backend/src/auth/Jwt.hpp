#pragma once

#include <string>
#include <chrono>

#include "jwt-cpp/jwt.h"

inline const std::string JWT_SECRET = "dev-secret-change-me";
inline const std::string JWT_ISSUER = "djangopersonal";

inline std::string createAccessToken(int userId, const std::string& username) {
  return jwt::create()
      .set_issuer(JWT_ISSUER)
      .set_subject(std::to_string(userId))
      .set_payload_claim("username", jwt::claim(username))
      .set_payload_claim("token_type", jwt::claim(std::string("access")))
      .set_issued_at(std::chrono::system_clock::now())
      .set_expires_at(std::chrono::system_clock::now() + std::chrono::hours(24))
      .sign(jwt::algorithm::hs256{JWT_SECRET});
}

inline std::string createRefreshToken(int userId, const std::string& username) {
  return jwt::create()
      .set_issuer(JWT_ISSUER)
      .set_subject(std::to_string(userId))
      .set_payload_claim("username", jwt::claim(username))
      .set_payload_claim("token_type", jwt::claim(std::string("refresh")))
      .set_issued_at(std::chrono::system_clock::now())
      .set_expires_at(std::chrono::system_clock::now() + std::chrono::hours(24 * 14))
      .sign(jwt::algorithm::hs256{JWT_SECRET});
}

inline bool verifyAccessToken(const std::string& token, int& outUserId, std::string& outUsername) {
  try {
    auto decoded = jwt::decode(token);
    auto verifier = jwt::verify()
        .allow_algorithm(jwt::algorithm::hs256{JWT_SECRET})
        .with_issuer(JWT_ISSUER);
    verifier.verify(decoded);

    if (decoded.has_payload_claim("token_type")) {
      if (decoded.get_payload_claim("token_type").as_string() != "access") return false;
    }

    outUserId = std::stoi(decoded.get_subject());
    if (decoded.has_payload_claim("username")) {
      outUsername = decoded.get_payload_claim("username").as_string();
    }
    return true;
  } catch (...) {
    return false;
  }
}

inline bool verifyRefreshToken(const std::string& token, int& outUserId, std::string& outUsername) {
  try {
    auto decoded = jwt::decode(token);
    auto verifier = jwt::verify()
        .allow_algorithm(jwt::algorithm::hs256{JWT_SECRET})
        .with_issuer(JWT_ISSUER);
    verifier.verify(decoded);

    if (!decoded.has_payload_claim("token_type")) return false;
    if (decoded.get_payload_claim("token_type").as_string() != "refresh") return false;

    outUserId = std::stoi(decoded.get_subject());
    if (decoded.has_payload_claim("username")) {
      outUsername = decoded.get_payload_claim("username").as_string();
    }
    return true;
  } catch (...) {
    return false;
  }
}
