#pragma once

#include "contracts/TimeEntryContracts.hpp"
#include "../errors/HandlerError.hpp"
#include "../util/DtoHelpers.hpp"
#include "../util/TimeHelpers.hpp"

inline void validateCreateTimeEntry(const oatpp::Object<TimeEntryCreateRequest>& body) {
  if (toInt(body->task) <= 0) throw HandlerError(400, "task is required.");
  std::string date = toString(body->date);
  if (date.empty()) throw HandlerError(400, "date is required.");
  if (isFutureDate(date)) throw HandlerError(400, "Date cannot be in the future.");
  int dur = toInt(body->duration_minutes);
  if (dur < 1 || dur > 24 * 60) throw HandlerError(400, "duration_minutes must be between 1 and 1440.");
}

inline void validateUpdateTimeEntry(const oatpp::Object<PatchedTimeEntryRequest>& body) {
  if (body->task && toInt(body->task) <= 0) throw HandlerError(400, "Invalid task.");
  if (body->date) {
    std::string date = toString(body->date);
    if (isFutureDate(date)) throw HandlerError(400, "Date cannot be in the future.");
  }
  if (body->duration_minutes) {
    int dur = toInt(body->duration_minutes);
    if (dur < 1 || dur > 24 * 60) throw HandlerError(400, "duration_minutes must be between 1 and 1440.");
  }
}

inline void validateTimerStart(const oatpp::Object<TimerStartRequest>& body) {
  if (toInt(body->task) <= 0) throw HandlerError(400, "task is required.");
}