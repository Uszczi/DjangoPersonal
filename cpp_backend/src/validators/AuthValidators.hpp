#pragma once

#include "contracts/AuthContracts.hpp"
#include "../errors/HandlerError.hpp"
#include "../util/DtoHelpers.hpp"

#include <string>

inline void validateRegister(const oatpp::Object<RegisterRequest>& body) {
  std::string username = toString(body->username);
  std::string password = toString(body->password);
  std::string passwordConfirm = toString(body->password_confirm);
  if (username.empty() || password.empty()) throw HandlerError(400, "Username and password are required.");
  if (password != passwordConfirm) throw HandlerError(400, "Passwords do not match.");
}

inline void validateLogin(const oatpp::Object<LoginRequest>& body) {
  std::string username = toString(body->username);
  std::string password = toString(body->password);
  if (username.empty() || password.empty()) throw HandlerError(400, "Username and password are required.");
}