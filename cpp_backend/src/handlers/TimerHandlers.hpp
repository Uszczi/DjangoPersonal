#pragma once

#include "../db/TimeEntryDb.hpp"
#include "../db/TaskDb.hpp"
#include "../db/ProjectDb.hpp"
#include "../models/TimeEntry.hpp"
#include "../models/Task.hpp"
#include "../models/Project.hpp"
#include "contracts/TimeEntryContracts.hpp"
#include "../errors/HandlerError.hpp"
#include "../util/DtoHelpers.hpp"
#include "../util/TimeHelpers.hpp"
#include "../validators/TimeEntryValidators.hpp"

#include <string>

static void normalizeTimeEntryPtr(const oatpp::Object<TimeEntry>& e) {
  if (!e) return;
  if (e->start) e->start = toIsoUtc(std::string(*e->start));
  if (e->end) e->end = toIsoUtc(std::string(*e->end));
}

class GetRunningEntryHandler {
public:
  explicit GetRunningEntryHandler(const std::shared_ptr<TimeEntryDb>& db) : m_db(db) {}
  oatpp::Object<TimeEntry> execute(int userId) {
    oatpp::Vector<oatpp::Object<TimeEntry>> items;
    if (userId > 0) {
      auto res = m_db->getRunningTimeEntryByUser(userId);
      items = res->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
    } else {
      auto res = m_db->getRunningTimeEntry();
      items = res->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
    }
    if (!items || items->empty()) return nullptr;
    auto e = items->front();
    normalizeTimeEntryPtr(e);
    return e;
  }
private:
  std::shared_ptr<TimeEntryDb> m_db;
};

class StartTimerHandler {
public:
  StartTimerHandler(const std::shared_ptr<TaskDb>& taskDb, const std::shared_ptr<TimeEntryDb>& timeDb, const std::shared_ptr<ProjectDb>& projectDb)
    : m_taskDb(taskDb), m_timeDb(timeDb), m_projectDb(projectDb) {}
  oatpp::Object<TimeEntry> execute(int userId, const oatpp::Object<TimerStartRequest>& body) {
    validateTimerStart(body);
    int taskId = toInt(body->task);

    auto tRes = m_taskDb->getTaskById(taskId);
    auto tItems = tRes->fetch<oatpp::Vector<oatpp::Object<Task>>>();
    if (!tItems || tItems->empty()) throw HandlerError(400, "Invalid task ID.");
    if (userId > 0 && tItems->front()->project_id) {
      auto projRes = m_projectDb->getProjectById(*tItems->front()->project_id);
      auto projItems = projRes->fetch<oatpp::Vector<oatpp::Object<Project>>>();
      if (!projItems || projItems->empty() || !projItems->front()->user_id || *projItems->front()->user_id != userId) {
        throw HandlerError(400, "Invalid task ID.");
      }
    }

    std::string now = nowUtcIso();

    // close running if any (user-scoped)
    oatpp::Vector<oatpp::Object<TimeEntry>> runningItems;
    if (userId > 0) {
      auto runningRes = m_timeDb->getRunningTimeEntryByUser(userId);
      runningItems = runningRes->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
    } else {
      auto runningRes = m_timeDb->getRunningTimeEntry();
      runningItems = runningRes->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
    }
    if (runningItems && !runningItems->empty()) {
      auto r = runningItems->front();
      if (r->id) m_timeDb->closeTimeEntry(now, *r->id);
    }

    auto res = m_timeDb->createTimeEntry(taskId, now, nullptr);
    if (!res->isSuccess()) throw HandlerError(400, "Failed to start timer.");

    // fetch created (running entry for this task? just last running)
    auto runRes = m_timeDb->getRunningTimeEntry();
    auto runItems = runRes->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
    if (!runItems || runItems->empty()) throw HandlerError(500, "Failed to load timer.");
    auto e = runItems->front();
    normalizeTimeEntryPtr(e);
    return e;
  }
private:
  std::shared_ptr<TaskDb> m_taskDb;
  std::shared_ptr<TimeEntryDb> m_timeDb;
  std::shared_ptr<ProjectDb> m_projectDb;
};

class StopTimerHandler {
public:
  explicit StopTimerHandler(const std::shared_ptr<TimeEntryDb>& db) : m_db(db) {}
  oatpp::Object<TimeEntry> execute(int userId) {
    oatpp::Vector<oatpp::Object<TimeEntry>> runItems;
    if (userId > 0) {
      auto runRes = m_db->getRunningTimeEntryByUser(userId);
      runItems = runRes->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
    } else {
      auto runRes = m_db->getRunningTimeEntry();
      runItems = runRes->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
    }
    if (!runItems || runItems->empty()) throw HandlerError(400, "No timer is running.");
    auto r = runItems->front();
    if (!r->id) throw HandlerError(500, "Invalid timer.");
    std::string now = nowUtcIso();
    m_db->closeTimeEntry(now, *r->id);

    auto updated = m_db->getTimeEntryById(*r->id);
    auto upItems = updated->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
    if (!upItems || upItems->empty()) throw HandlerError(500, "Failed to load timer.");
    auto e = upItems->front();
    normalizeTimeEntryPtr(e);
    return e;
  }
private:
  std::shared_ptr<TimeEntryDb> m_db;
};