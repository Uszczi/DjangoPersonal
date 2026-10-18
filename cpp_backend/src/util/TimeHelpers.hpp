#pragma once

#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>
#include <string>

inline std::string nowUtcIso() {
  auto now = std::chrono::system_clock::now();
  auto t = std::chrono::system_clock::to_time_t(now);
  auto us = std::chrono::duration_cast<std::chrono::microseconds>(now.time_since_epoch()) % 1000000;
  std::tm tm{};
  gmtime_r(&t, &tm);
  std::ostringstream ss;
  ss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%S") << '.' << std::setfill('0') << std::setw(6) << us.count() << 'Z';
  return ss.str();
}

inline std::string todayUtcDate() {
  auto now = std::chrono::system_clock::now();
  auto t = std::chrono::system_clock::to_time_t(now);
  std::tm tm{};
  gmtime_r(&t, &tm);
  std::ostringstream ss;
  ss << std::put_time(&tm, "%Y-%m-%d");
  return ss.str();
}

inline std::string dayStartIso(const std::string& date) {
  return date + "T00:00:00.000000Z";
}

inline std::string toIsoUtc(const std::string& s) {
  std::string v = s;
  // replace space with T
  for (char& c : v) if (c == ' ') c = 'T';
  if (v.find('Z') == std::string::npos && v.find('+') == std::string::npos) {
    v += 'Z';
  }
  // ensure 6-digit microseconds? If missing, add .000000
  // find T
  // simple: if no '.' before Z, insert .000000
  size_t zpos = v.find('Z');
  if (zpos != std::string::npos) {
    size_t dot = v.rfind('.', zpos);
    if (dot == std::string::npos || dot < v.find('T')) {
      v.insert(zpos, ".000000");
    }
  }
  return v;
}

inline std::time_t parseIsoToTime(const std::string& iso) {
  std::string v = iso;
  for (char& c : v) if (c == 'T') c = ' ';
  if (!v.empty() && v.back() == 'Z') v.pop_back();
  // remove fractional seconds
  size_t dot = v.find('.');
  if (dot != std::string::npos) v = v.substr(0, dot);
  std::tm tm{};
  std::istringstream ss(v);
  ss >> std::get_time(&tm, "%Y-%m-%d %H:%M:%S");
  if (ss.fail()) return 0;
  return timegm(&tm);
}

inline std::string addMinutesToIso(const std::string& iso, int minutes) {
  std::time_t t = parseIsoToTime(iso);
  t += (std::time_t)minutes * 60;
  std::tm tm{};
  gmtime_r(&t, &tm);
  std::ostringstream ss;
  ss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%S");
  // preserve microseconds from original? Use .000000
  ss << ".000000Z";
  return ss.str();
}

inline bool isFutureDate(const std::string& date) {
  return date > todayUtcDate();
}