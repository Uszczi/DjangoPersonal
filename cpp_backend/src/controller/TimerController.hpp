#pragma once

#include "../models/TimeEntry.hpp"
#include "../db/TimeEntryDb.hpp"
#include "../db/TaskDb.hpp"
#include "../db/ProjectDb.hpp"
#include "contracts/TimeEntryContracts.hpp"
#include "handlers/TimerHandlers.hpp"
#include "../errors/HandlerError.hpp"
#include "../util/DtoHelpers.hpp"
#include "../util/TimeHelpers.hpp"
#include "../util/AuthHelpers.hpp"

#include "oatpp/web/server/api/ApiController.hpp"
#include "oatpp/macro/codegen.hpp"

class TimerController : public oatpp::web::server::api::ApiController {
public:
  TimerController(const std::shared_ptr<oatpp::data::mapping::ObjectMapper>& om,
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

  ENDPOINT("GET", "/api/v1/timer", getTimer, REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      int userId = requireUserId(authorization);
      GetRunningEntryHandler handler(m_timeDb);
      auto entry = handler.execute(userId);
      auto resp = TimerResponse::createShared();
      resp->entry = entry;
      resp->server_now = nowUtcIso();
      return createDtoResponse(Status::CODE_200, resp);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

  ENDPOINT("POST", "/api/v1/timer/start", startTimer, BODY_DTO(Object<TimerStartRequest>, body), REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      int userId = requireUserId(authorization);
      StartTimerHandler handler(m_taskDb, m_timeDb, m_projectDb);
      auto entry = handler.execute(userId, body);
      auto resp = TimerResponse::createShared();
      resp->entry = entry;
      resp->server_now = nowUtcIso();
      return createDtoResponse(Status::CODE_200, resp);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

  ENDPOINT("POST", "/api/v1/timer/stop", stopTimer, REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    try {
      auto authorization = request->getHeader("Authorization");
      int userId = requireUserId(authorization);
      StopTimerHandler handler(m_timeDb);
      auto entry = handler.execute(userId);
      auto resp = TimerResponse::createShared();
      resp->entry = entry;
      resp->server_now = nowUtcIso();
      return createDtoResponse(Status::CODE_200, resp);
    } catch (const HandlerError& e) {
      return createResponse(toHttpStatus(e.status), e.message);
    }
  }

#include OATPP_CODEGEN_END(ApiController)
};