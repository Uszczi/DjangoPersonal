#pragma once

#include "oatpp/Types.hpp"

#include <string>

inline std::string toString(const oatpp::String& v) {
  return v ? std::string(*v) : std::string();
}

inline int toInt(const oatpp::Int32& v, int defaultValue = 0) {
  return v ? *v : defaultValue;
}

inline bool toBool(const oatpp::Boolean& v, bool defaultValue = false) {
  return v ? *v : defaultValue;
}