#pragma once

#include "contracts/ProjectContracts.hpp"
#include "../errors/HandlerError.hpp"
#include "../util/DtoHelpers.hpp"
#include "../util/StringUtils.hpp"

#include <string>

inline void validateCreateProject(const oatpp::Object<CreateProjectRequest>& body) {
  std::string name = trimStr(toString(body->name));
  if (name.empty()) throw HandlerError(400, "Name is required.");
}

inline void validateUpdateProject(const oatpp::Object<UpdateProjectRequest>& body, bool replace) {
  if (body->name) {
    std::string n = trimStr(toString(body->name));
    if (n.empty()) throw HandlerError(400, "Name may not be blank.");
  } else if (replace) {
    throw HandlerError(400, "Name is required.");
  }
}