#pragma once

#include "../models/Task.hpp"
#include "../db/TaskDb.hpp"
#include "../db/ProjectDb.hpp"
#include "contracts/TaskContracts.hpp"
#include "handlers/TaskHandlers.hpp"
#include "../errors/HandlerError.hpp"
#include "../util/DtoHelpers.hpp"
#include "../util/AuthHelpers.hpp"

#include "oatpp/web/server/api/ApiController.hpp"
#include "oatpp/macro/codegen.hpp"

class TaskController : public oatpp::web::server::api::ApiController {
public:
  TaskController(const std::shared_ptr<oatpp::data::mapping::ObjectMapper>& om,
                 const std::shared_ptr<TaskDb>& taskDb,
                 const std::shared_ptr<ProjectDb>& projectDb)
    : oatpp::web::server::api::ApiController(om), m_taskDb(taskDb), m_projectDb(projectDb) {}

private:
  std::shared_ptr<TaskDb> m_taskDb;
  std::shared_ptr<ProjectDb> m_projectDb;

public:
#include OATPP_CODEGEN_BEGIN(ApiController)

  ENDPOINT("GET", "/api/v1/tasks", getTasks, QUERY(Int32, project, "project", 0), QUERY(Boolean, all, "all", false), REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      int userId = requireUserId(authorization);
      ListTasksHandler handler(m_taskDb, m_projectDb);
      int pid = project;
      bool allProjects = all;
      auto items = handler.execute(userId, pid, allProjects);
      return createDtoResponse(Status::CODE_200, items);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

  ENDPOINT("POST", "/api/v1/tasks", createTask, BODY_DTO(Object<CreateTaskRequest>, body), REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      int userId = requireUserId(authorization);
      CreateTaskHandler handler(m_taskDb, m_projectDb);
      auto task = handler.execute(userId, body);
      return createDtoResponse(Status::CODE_201, task);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

  ENDPOINT("PATCH", "/api/v1/tasks/{id}", updateTask, PATH(Int32, id), BODY_DTO(Object<UpdateTaskRequest>, body), REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      int userId = requireUserId(authorization);
      UpdateTaskHandler handler(m_taskDb, m_projectDb);
      auto task = handler.execute(id, userId, body);
      return createDtoResponse(Status::CODE_200, task);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

  ENDPOINT("DELETE", "/api/v1/tasks/{id}", deleteTask, PATH(Int32, id), REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      int userId = requireUserId(authorization);
      DeleteTaskHandler handler(m_taskDb, m_projectDb);
      handler.execute(id, userId);
      return createResponse(Status::CODE_204, "");
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

#include OATPP_CODEGEN_END(ApiController)
};