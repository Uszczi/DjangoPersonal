#pragma once

#include "../auth/Jwt.hpp"
#include "../errors/HandlerError.hpp"
#include "oatpp/Types.hpp"

#include <string>

inline int requireUserId(const oatpp::String& authorization) {
  std::string token;
  if (authorization) {
    std::string h = std::string(*authorization);
    const std::string prefix = "Bearer ";
    if (h.rfind(prefix, 0) == 0) token = h.substr(prefix.size());
    else token = h;
  }
  int userId = 0;
  std::string username;
  if (token.empty() || !verifyAccessToken(token, userId, username)) {
    throw HandlerError(401, "Invalid or expired token.");
  }
  return userId;
}