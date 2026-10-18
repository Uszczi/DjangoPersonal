#pragma once

#include <algorithm>
#include <cctype>
#include <string>

inline std::string trimStr(const std::string& s) {
  size_t start = s.find_first_not_of(" \t\n\r\f\v");
  if (start == std::string::npos) return "";
  size_t end = s.find_last_not_of(" \t\n\r\f\v");
  return s.substr(start, end - start + 1);
}

inline std::string normalizeNameStr(const std::string& s) {
  std::string t = trimStr(s);
  std::string out;
  out.reserve(t.size());
  for (char c : t) out += (char)std::tolower((unsigned char)c);
  return out;
}