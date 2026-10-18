#pragma once

#include "contracts/TaskContracts.hpp"
#include "../errors/HandlerError.hpp"
#include "../util/DtoHelpers.hpp"
#include "../util/StringUtils.hpp"

#include <string>

inline void validateCreateTask(const oatpp::Object<CreateTaskRequest>& body) {
  std::string title = trimStr(toString(body->title));
  if (title.empty()) throw HandlerError(400, "Title is required.");
}

inline void validateUpdateTask(const oatpp::Object<UpdateTaskRequest>& body) {
  if (body->title) {
    std::string t = trimStr(toString(body->title));
    if (t.empty()) throw HandlerError(400, "Title may not be blank.");
  }
}