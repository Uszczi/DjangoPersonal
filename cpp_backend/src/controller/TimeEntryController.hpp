#pragma once

#include "../models/TimeEntry.hpp"
#include "../db/TimeEntryDb.hpp"
#include "../db/TaskDb.hpp"
#include "../db/ProjectDb.hpp"
#include "contracts/TimeEntryContracts.hpp"
#include "handlers/TimeEntryHandlers.hpp"
#include "../errors/HandlerError.hpp"
#include "../util/DtoHelpers.hpp"
#include "../util/TimeHelpers.hpp"
#include "../util/AuthHelpers.hpp"

#include "oatpp/web/server/api/ApiController.hpp"
#include "oatpp/macro/codegen.hpp"

class TimeEntryController : public oatpp::web::server::api::ApiController {
public:
  TimeEntryController(const std::shared_ptr<oatpp::data::mapping::ObjectMapper>& om,
                     const std::shared_ptr<TimeEntryDb>& timeDb,
                     const std::shared_ptr<TaskDb>& taskDb,
                     const std::shared_ptr<ProjectDb>& projectDb)
    : oatpp::web::server::api::ApiController(om), m_timeDb(timeDb), m_taskDb(taskDb), m_projectDb(projectDb) {}

private:
  std::shared_ptr<TimeEntryDb> m_timeDb;
  std::shared_ptr<TaskDb> m_taskDb;
  std::shared_ptr<ProjectDb> m_projectDb;

public:
#include OATPP_CODEGEN_BEGIN(ApiController)

  ENDPOINT("GET", "/api/v1/time-entries", listTimeEntries,
           QUERY(Int32, task, "task", 0), QUERY(String, date, "date", ""), REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      int userId = requireUserId(authorization);
      ListTimeEntriesHandler handler(m_timeDb);
      int tid = task;
      std::string day = toString(date);
      auto items = handler.execute(userId, tid, day);
      return createDtoResponse(Status::CODE_200, items);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

  ENDPOINT("POST", "/api/v1/time-entries", createTimeEntry, BODY_DTO(Object<TimeEntryCreateRequest>, body), REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      int userId = requireUserId(authorization);
      CreateTimeEntryHandler handler(m_taskDb, m_timeDb, m_projectDb);
      auto entry = handler.execute(userId, body);
      return createDtoResponse(Status::CODE_201, entry);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

  ENDPOINT("PATCH", "/api/v1/time-entries/{id}", updateTimeEntry, PATH(Int32, id), BODY_DTO(Object<PatchedTimeEntryRequest>, body), REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      int userId = requireUserId(authorization);
      UpdateTimeEntryHandler handler(m_taskDb, m_timeDb, m_projectDb);
      auto entry = handler.execute(id, userId, body);
      return createDtoResponse(Status::CODE_200, entry);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

  ENDPOINT("DELETE", "/api/v1/time-entries/{id}", deleteTimeEntry, PATH(Int32, id), REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      int userId = requireUserId(authorization);
      DeleteTimeEntryHandler handler(m_timeDb);
      handler.execute(id, userId);
      return createResponse(Status::CODE_204, "");
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

#include OATPP_CODEGEN_END(ApiController)
};