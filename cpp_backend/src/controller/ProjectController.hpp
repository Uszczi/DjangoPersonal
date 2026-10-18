#pragma once

#include "../models/Project.hpp"
#include "../db/ProjectDb.hpp"
#include "contracts/ProjectContracts.hpp"
#include "handlers/ProjectHandlers.hpp"
#include "errors/HandlerError.hpp"
#include "../util/DtoHelpers.hpp"
#include "../util/AuthHelpers.hpp"

#include "oatpp/web/server/api/ApiController.hpp"
#include "oatpp/macro/codegen.hpp"

class ProjectController : public oatpp::web::server::api::ApiController {
public:
  ProjectController(const std::shared_ptr<oatpp::data::mapping::ObjectMapper>& om,
                   const std::shared_ptr<ProjectDb>& db)
    : oatpp::web::server::api::ApiController(om), m_db(db) {}

private:
  std::shared_ptr<ProjectDb> m_db;

public:
#include OATPP_CODEGEN_BEGIN(ApiController)

  ENDPOINT("GET", "/api/v1/projects", getProjects, REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      int userId = requireUserId(authorization);
      ListProjectsHandler handler(m_db);
      auto items = handler.execute(userId);
      return createDtoResponse(Status::CODE_200, items);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

  ENDPOINT("GET", "/api/v1/projects/{id}", getProject, PATH(Int32, id), REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      int userId = requireUserId(authorization);
      GetProjectHandler handler(m_db);
      auto project = handler.execute(id, userId);
      return createDtoResponse(Status::CODE_200, project);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

  ENDPOINT("POST", "/api/v1/projects", createProject, BODY_DTO(Object<CreateProjectRequest>, body), REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      int userId = requireUserId(authorization);
      CreateProjectHandler handler(m_db);
      auto project = handler.execute(userId, body);
      return createDtoResponse(Status::CODE_201, project);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

  ENDPOINT("PUT", "/api/v1/projects/{id}", replaceProject, PATH(Int32, id), BODY_DTO(Object<UpdateProjectRequest>, body), REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      int userId = requireUserId(authorization);
      UpdateProjectHandler handler(m_db);
      auto project = handler.execute(id, userId, body, true);
      return createDtoResponse(Status::CODE_200, project);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

  ENDPOINT("PATCH", "/api/v1/projects/{id}", patchProject, PATH(Int32, id), BODY_DTO(Object<UpdateProjectRequest>, body), REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      int userId = requireUserId(authorization);
      UpdateProjectHandler handler(m_db);
      auto project = handler.execute(id, userId, body, false);
      return createDtoResponse(Status::CODE_200, project);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

  ENDPOINT("DELETE", "/api/v1/projects/{id}", deleteProject, PATH(Int32, id), REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      int userId = requireUserId(authorization);
      DeleteProjectHandler handler(m_db);
      handler.execute(id, userId);
      return createResponse(Status::CODE_204, "");
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

#include OATPP_CODEGEN_END(ApiController)
};