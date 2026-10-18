#pragma once

#include <exception>
#include <string>

#include "oatpp/web/protocol/http/outgoing/Response.hpp"
#include "oatpp/web/protocol/http/Http.hpp"

inline oatpp::web::protocol::http::Status toHttpStatus(int code) {
  using S = oatpp::web::protocol::http::Status;
  switch (code) {
    case 200: return S::CODE_200;
    case 201: return S::CODE_201;
    case 204: return S::CODE_204;
    case 400: return S::CODE_400;
    case 401: return S::CODE_401;
    case 403: return S::CODE_403;
    case 404: return S::CODE_404;
    case 500: return S::CODE_500;
    default: return S::CODE_400;
  }
}

struct HandlerError : std::exception {
  int status;
  std::string message;

  HandlerError(int status, const std::string& message)
    : status(status), message(message) {}

  const char* what() const noexcept override { return message.c_str(); }
};