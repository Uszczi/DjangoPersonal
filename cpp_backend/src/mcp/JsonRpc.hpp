#pragma once

#include "oatpp/json/Serializer.hpp"
#include "oatpp/json/Deserializer.hpp"
#include "oatpp/data/mapping/Tree.hpp"
#include "oatpp/data/stream/BufferStream.hpp"
#include "oatpp/utils/parser/Caret.hpp"

#include <ctime>
#include <iomanip>
#include <random>
#include <sstream>
#include <string>

namespace mcp {

using Tree = oatpp::data::mapping::Tree;
using TreeMap = oatpp::data::mapping::TreeMap;

// JSON text -> Tree. Returns false on parse errors.
inline bool parseJsonToTree(const std::string& text, Tree& out) {
  oatpp::utils::parser::Caret caret(text.c_str(), (v_buff_size)text.size());
  oatpp::json::Deserializer::Config cfg;
  oatpp::json::Deserializer::State state;
  state.config = &cfg;
  state.tree = &out;
  state.caret = &caret;
  oatpp::json::Deserializer::deserialize(state);
  return state.errorStack.empty();
}

// Tree -> compact JSON text.
inline std::string treeToJson(const Tree& tree) {
  oatpp::json::Serializer::Config cfg;
  oatpp::json::Serializer::State state;
  state.config = &cfg;
  state.tree = &tree;
  oatpp::data::stream::BufferOutputStream stream;
  state.stream = &stream;
  oatpp::json::Serializer::serializeToStream(&stream, state);
  return std::string(stream.toString()->c_str());
}

// const-safe member lookup. Returns nullptr when tree is not a map or key is missing.
inline const Tree* findMember(const Tree& tree, const char* key) {
  if (!tree.isMap()) return nullptr;
  const auto& map = tree.getMap();
  for (v_uint64 i = 0; i < map.size(); i++) {
    auto pair = map[i];
    if (std::string(pair.first->c_str()) == key) return &pair.second.get();
  }
  return nullptr;
}

// Random UUID (version 4) used as Mcp-Session-Id.
inline std::string generateSessionId() {
  std::random_device rd;
  std::mt19937_64 gen(((v_uint64)rd() << 32) ^ (v_uint64)rd());
  std::uniform_int_distribution<int> dist(0, 15);
  std::string uuid;
  uuid.reserve(36);
  for (int i = 0; i < 36; i++) {
    if (i == 8 || i == 13 || i == 18 || i == 23) {
      uuid += '-';
    } else if (i == 14) {
      uuid += '4';
    } else if (i == 19) {
      uuid += "89ab"[dist(gen) % 4];
    } else {
      uuid += "0123456789abcdef"[dist(gen)];
    }
  }
  return uuid;
}

// Strict YYYY-MM-DD validation (parseable and round-trips).
inline bool isValidYmdDate(const std::string& s) {
  if (s.size() != 10 || s[4] != '-' || s[7] != '-') return false;
  std::tm tm{};
  std::istringstream ss(s);
  ss >> std::get_time(&tm, "%Y-%m-%d");
  if (ss.fail()) return false;
  char buf[16];
  std::strftime(buf, sizeof(buf), "%Y-%m-%d", &tm);
  return s == buf;
}

// {"jsonrpc":"2.0","id":<id>,"result":{"content":[{"type":"text","text":<text>}][,"isError":true]}}
// `id` may be nullptr (serialized as null); text is embedded as a JSON string.
inline std::string makeResultJson(const Tree* id, const std::string& text, bool isError) {
  Tree resp;
  resp.setMap(TreeMap());
  resp["jsonrpc"] = "2.0";
  if (id) resp["id"].setCopy(*id);
  else resp["id"].setNull();

  Tree content;
  content.setVector(0);
  Tree item;
  item.setMap(TreeMap());
  item["type"] = "text";
  item["text"] = oatpp::String(text);
  content.getVector().push_back(std::move(item));

  Tree result;
  result.setMap(TreeMap());
  result["content"] = std::move(content);
  if (isError) result["isError"] = true;
  resp["result"] = std::move(result);
  return treeToJson(resp);
}

// {"jsonrpc":"2.0","id":<id>,"error":{"code":<code>,"message":<message>}}
inline std::string makeErrorJson(const Tree* id, int code, const std::string& message) {
  Tree resp;
  resp.setMap(TreeMap());
  resp["jsonrpc"] = "2.0";
  if (id) resp["id"].setCopy(*id);
  else resp["id"].setNull();

  Tree error;
  error.setMap(TreeMap());
  error["code"] = code;
  error["message"] = message;
  resp["error"] = std::move(error);
  return treeToJson(resp);
}

} // namespace mcp
