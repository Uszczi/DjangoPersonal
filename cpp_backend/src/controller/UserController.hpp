#pragma once

#include "../models/User.hpp"
#include "../db/UserDb.hpp"
#include "../db/ProjectDb.hpp"
#include "contracts/AuthContracts.hpp"
#include "handlers/AuthHandlers.hpp"
#include "errors/HandlerError.hpp"
#include "../util/DtoHelpers.hpp"

#include "oatpp/web/server/api/ApiController.hpp"
#include "oatpp/macro/codegen.hpp"

class UserController : public oatpp::web::server::api::ApiController {
public:
  UserController(const std::shared_ptr<oatpp::data::mapping::ObjectMapper>& om,
                 const std::shared_ptr<UserDb>& db,
                 const std::shared_ptr<ProjectDb>& projectDb)
    : oatpp::web::server::api::ApiController(om), m_userDb(db), m_projectDb(projectDb) {}

private:
  std::shared_ptr<UserDb> m_userDb;
  std::shared_ptr<ProjectDb> m_projectDb;

public:
#include OATPP_CODEGEN_BEGIN(ApiController)

  ENDPOINT("POST", "/api/v1/auth/register", registerUser, BODY_DTO(Object<RegisterRequest>, body)) {
    try {
      RegisterUserHandler handler(m_userDb, m_projectDb);
      auto resp = handler.execute(body);
      return createDtoResponse(Status::CODE_201, resp);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

  ENDPOINT("POST", "/api/v1/auth/login", login, BODY_DTO(Object<LoginRequest>, body)) {
    try {
      LoginUserHandler handler(m_userDb);
      auto resp = handler.execute(body);
      return createDtoResponse(Status::CODE_200, resp);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

  ENDPOINT("POST", "/api/v1/auth/refresh", refresh, BODY_DTO(Object<RefreshRequest>, body)) {
    try {
      RefreshTokenHandler handler;
      auto resp = handler.execute(body);
      return createDtoResponse(Status::CODE_200, resp);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

  ENDPOINT("GET", "/api/v1/auth/me", me, REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      std::string token;
      if (authorization) {
        std::string h = std::string(*authorization);
        const std::string prefix = "Bearer ";
        if (h.rfind(prefix, 0) == 0) token = h.substr(prefix.size());
        else token = h;
      }
      GetMeHandler handler(m_userDb);
      auto resp = handler.execute(token);
      return createDtoResponse(Status::CODE_200, resp);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

#include OATPP_CODEGEN_END(ApiController)
};
