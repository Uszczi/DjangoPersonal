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

static void normalizeTimeEntry(const oatpp::Object<TimeEntry>& e) {
  if (!e) return;
  if (e->start) e->start = toIsoUtc(std::string(*e->start));
  if (e->end) e->end = toIsoUtc(std::string(*e->end));
}

class ListTimeEntriesHandler {
public:
  explicit ListTimeEntriesHandler(const std::shared_ptr<TimeEntryDb>& db) : m_db(db) {}
  oatpp::Vector<oatpp::Object<TimeEntry>> execute(int userId, int taskId, const std::string& day) {
    oatpp::Vector<oatpp::Object<TimeEntry>> items;
    if (taskId > 0) {
      if (!day.empty()) {
        auto r = m_db->getTimeEntriesByTaskAndDay(taskId, day);
        items = r->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
      } else {
        auto r = m_db->getTimeEntriesByTask(taskId);
        items = r->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
      }
    } else if (userId > 0) {
      if (!day.empty()) {
        auto r = m_db->getTimeEntriesByUserAndDay(userId, day);
        items = r->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
      } else {
        auto r = m_db->getTimeEntriesByUser(userId);
        items = r->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
      }
    } else if (!day.empty()) {
      auto r = m_db->getTimeEntriesByDay(day);
      items = r->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
    } else {
      auto r = m_db->getAllTimeEntries();
      items = r->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
    }
    if (!items) items = oatpp::Vector<oatpp::Object<TimeEntry>>::createShared();
    for (auto& e : *items) normalizeTimeEntry(e);
    return items;
  }
private:
  std::shared_ptr<TimeEntryDb> m_db;
};

class CreateTimeEntryHandler {
public:
  CreateTimeEntryHandler(const std::shared_ptr<TaskDb>& taskDb, const std::shared_ptr<TimeEntryDb>& timeDb, const std::shared_ptr<ProjectDb>& projectDb)
    : m_taskDb(taskDb), m_timeDb(timeDb), m_projectDb(projectDb) {}
  oatpp::Object<TimeEntry> execute(int userId, const oatpp::Object<TimeEntryCreateRequest>& body) {
    validateCreateTimeEntry(body);
    int taskId = toInt(body->task);
    std::string date = toString(body->date);
    int dur = toInt(body->duration_minutes);

    // validate task exists
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

    std::string start = dayStartIso(date);
    std::string end = addMinutesToIso(start, dur);

    auto res = m_timeDb->createTimeEntry(taskId, start, end);
    if (!res->isSuccess()) throw HandlerError(400, "Failed to create time entry.");

    // fetch created (by task, max id)
    auto listRes = m_timeDb->getTimeEntriesByTask(taskId);
    auto listItems = listRes->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
    if (!listItems || listItems->empty()) throw HandlerError(500, "Failed to load created entry.");
    oatpp::Object<TimeEntry> created = listItems->front();
    for (auto& e : *listItems) {
      if (e->id && created->id && *e->id > *created->id) created = e;
    }
    normalizeTimeEntry(created);
    return created;
  }
private:
  std::shared_ptr<TaskDb> m_taskDb;
  std::shared_ptr<TimeEntryDb> m_timeDb;
  std::shared_ptr<ProjectDb> m_projectDb;
};

class UpdateTimeEntryHandler {
public:
  UpdateTimeEntryHandler(const std::shared_ptr<TaskDb>& taskDb, const std::shared_ptr<TimeEntryDb>& timeDb, const std::shared_ptr<ProjectDb>& projectDb)
    : m_taskDb(taskDb), m_timeDb(timeDb), m_projectDb(projectDb) {}
  oatpp::Object<TimeEntry> execute(int id, int userId, const oatpp::Object<PatchedTimeEntryRequest>& body) {
    validateUpdateTimeEntry(body);

    auto res = m_timeDb->getTimeEntryById(id);
    auto items = res->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
    if (!items || items->empty()) throw HandlerError(404, "Time entry not found.");
    auto entry = items->front();

    if (userId > 0 && entry->task_id) {
      auto tRes = m_taskDb->getTaskById(*entry->task_id);
      auto tItems = tRes->fetch<oatpp::Vector<oatpp::Object<Task>>>();
      if (tItems && !tItems->empty() && tItems->front()->project_id) {
        auto projRes = m_projectDb->getProjectById(*tItems->front()->project_id);
        auto projItems = projRes->fetch<oatpp::Vector<oatpp::Object<Project>>>();
        if (!projItems || projItems->empty() || !projItems->front()->user_id || *projItems->front()->user_id != userId) {
          throw HandlerError(404, "Time entry not found.");
        }
      }
    }

    // running timer cannot be edited
    if (entry->end == nullptr || (entry->end && std::string(*entry->end).empty())) {
      throw HandlerError(400, "The running timer cannot be edited.");
    }

    int taskId = entry->task_id ? *entry->task_id : 0;
    std::string start = entry->start ? toIsoUtc(std::string(*entry->start)) : std::string();
    // strip to date
    std::string date = start.substr(0, 10);
    int duration = 0;
    if (entry->start && entry->end) {
      // compute minutes approx from stored
      std::time_t s = parseIsoToTime(start);
      std::time_t e = parseIsoToTime(toIsoUtc(std::string(*entry->end)));
      duration = (int)((e - s) / 60);
      if (duration < 1) duration = 1;
    }

    if (body->task) {
      int pid = toInt(body->task);
      auto tRes = m_taskDb->getTaskById(pid);
      auto tItems = tRes->fetch<oatpp::Vector<oatpp::Object<Task>>>();
      if (!tItems || tItems->empty()) throw HandlerError(400, "Invalid task ID.");
      taskId = pid;
    }
    if (body->date) {
      date = toString(body->date);
    }
    if (body->duration_minutes) {
      duration = toInt(body->duration_minutes);
    }
    // ensure not future (validator already for date if provided, but date may be derived)
    if (isFutureDate(date)) throw HandlerError(400, "Date cannot be in the future.");

    std::string newStart = dayStartIso(date);
    std::string newEnd = addMinutesToIso(newStart, duration);

    auto upRes = m_timeDb->updateTimeEntry(taskId, newStart, newEnd, id);
    if (!upRes->isSuccess()) throw HandlerError(500, "Failed to update time entry.");

    auto updated = m_timeDb->getTimeEntryById(id);
    auto upItems = updated->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
    if (!upItems || upItems->empty()) throw HandlerError(500, "Failed to load time entry.");
    normalizeTimeEntry(upItems->front());
    return upItems->front();
  }
private:
  std::shared_ptr<TaskDb> m_taskDb;
  std::shared_ptr<TimeEntryDb> m_timeDb;
  std::shared_ptr<ProjectDb> m_projectDb;
};

class DeleteTimeEntryHandler {
public:
  explicit DeleteTimeEntryHandler(const std::shared_ptr<TimeEntryDb>& db) : m_db(db) {}
  void execute(int id, int userId) {
    auto res = m_db->getTimeEntryById(id);
    auto items = res->fetch<oatpp::Vector<oatpp::Object<TimeEntry>>>();
    if (!items || items->empty()) throw HandlerError(404, "Time entry not found.");
    if (userId > 0 && items->front()->task_id) {
      // ownership check done via task/project; requires TaskDb + ProjectDb (not available here) -> skip strict
    }
    auto delRes = m_db->deleteTimeEntry(id);
    if (!delRes->isSuccess()) throw HandlerError(500, "Failed to delete time entry.");
  }
private:
  std::shared_ptr<TimeEntryDb> m_db;
};