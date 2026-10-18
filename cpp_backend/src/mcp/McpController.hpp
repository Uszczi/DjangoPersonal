#pragma once

#include "../db/ProjectDb.hpp"
#include "../db/TaskDb.hpp"
#include "../db/TimeEntryDb.hpp"
#include "../db/UserDb.hpp"
#include "../errors/HandlerError.hpp"
#include "JsonRpc.hpp"
#include "ToolRegistry.hpp"

#include "oatpp/web/server/api/ApiController.hpp"
#include "oatpp/macro/codegen.hpp"

class McpController : public oatpp::web::server::api::ApiController {
public:
  McpController(const std::shared_ptr<oatpp::data::mapping::ObjectMapper>& om,
                const std::shared_ptr<UserDb>& userDb,
                const std::shared_ptr<ProjectDb>& projectDb,
                const std::shared_ptr<TaskDb>& taskDb,
                const std::shared_ptr<TimeEntryDb>& timeEntryDb)
    : oatpp::web::server::api::ApiController(om)
    , m_registry(std::make_shared<mcp::ToolRegistry>(userDb, projectDb, taskDb, timeEntryDb, om)) {}

private:
  std::shared_ptr<mcp::ToolRegistry> m_registry;
  std::string m_sessionId = mcp::generateSessionId();

  std::shared_ptr<OutgoingResponse> mcpResponse(const Status& status, const std::string& body) {
    auto response = createResponse(status, body.c_str());
    response->putHeader("Content-Type", "application/json");
    response->putHeader("Mcp-Session-Id", m_sessionId.c_str());
    return response;
  }

  std::shared_ptr<OutgoingResponse> mcpAccepted() {
    auto response = createResponse(Status::CODE_202, "");
    response->putHeader("Mcp-Session-Id", m_sessionId.c_str());
    return response;
  }

  bool argTypeMatches(const mcp::ToolArg& spec, const mcp::Tree& value) {
    switch (spec.type) {
      case mcp::ArgType::String: return value.isString();
      case mcp::ArgType::Integer: return value.isIntPrimitive();
      case mcp::ArgType::Boolean: return value.getType() == mcp::Tree::Type::BOOL;
    }
    return false;
  }

  std::string validateArgs(const mcp::Tool& tool, const mcp::Tree& arguments) {
    for (const auto& spec : tool.args) {
      const mcp::Tree* value = mcp::findMember(arguments, spec.name);
      if (!value || value->isNull()) {
        if (spec.required) return std::string("Missing required argument: ") + spec.name;
        continue;
      }
      if (!argTypeMatches(spec, *value)) {
        const char* expected = spec.type == mcp::ArgType::String ? "string"
          : spec.type == mcp::ArgType::Integer ? "integer" : "boolean";
        return std::string("Invalid type for argument '") + spec.name + "': expected " + expected;
      }
    }
    return "";
  }

public:
#include OATPP_CODEGEN_BEGIN(ApiController)

  ENDPOINT("POST", "/mcp", mcp, REQUEST(std::shared_ptr<oatpp::web::protocol::http::incoming::Request>, request)) {
    auto body = request->readBodyToString();
    std::string bodyStr = body ? std::string(body->c_str()) : std::string();

    mcp::Tree root;
    if (!mcp::parseJsonToTree(bodyStr, root) || !root.isMap()) {
      return mcpResponse(Status::CODE_400, mcp::makeErrorJson(nullptr, -32700, "Parse error"));
    }

    const mcp::Tree* id = mcp::findMember(root, "id");
    const mcp::Tree* methodNode = mcp::findMember(root, "method");
    std::string method = (methodNode && methodNode->isString()) ? std::string(methodNode->getString()->c_str()) : "";

    // JSON-RPC notifications (no id): acknowledge, do not respond.
    if (!id) return mcpAccepted();

    if (method.empty()) {
      return mcpResponse(Status::CODE_400, mcp::makeErrorJson(id, -32600, "Invalid Request"));
    }

    if (method == "initialize") {
      mcp::Tree result;
      result.setMap(mcp::TreeMap());
      result["protocolVersion"] = "2025-03-26";
      mcp::Tree capabilities;
      capabilities.setMap(mcp::TreeMap());
      capabilities["tools"].setMap(mcp::TreeMap());
      result["capabilities"] = std::move(capabilities);
      mcp::Tree serverInfo;
      serverInfo.setMap(mcp::TreeMap());
      serverInfo["name"] = "djangopersonal-mcp";
      serverInfo["version"] = "1.0.0";
      result["serverInfo"] = std::move(serverInfo);

      mcp::Tree resp;
      resp.setMap(mcp::TreeMap());
      resp["jsonrpc"] = "2.0";
      resp["id"].setCopy(*id);
      resp["result"] = std::move(result);
      return mcpResponse(Status::CODE_200, mcp::treeToJson(resp));
    }

    if (method == "ping") {
      mcp::Tree result;
      result.setMap(mcp::TreeMap());
      mcp::Tree resp;
      resp.setMap(mcp::TreeMap());
      resp["jsonrpc"] = "2.0";
      resp["id"].setCopy(*id);
      resp["result"] = std::move(result);
      return mcpResponse(Status::CODE_200, mcp::treeToJson(resp));
    }

    if (method == "tools/list") {
      mcp::Tree tools;
      tools.setVector(0);
      for (const auto& tool : m_registry->tools()) {
        mcp::Tree item;
        item.setMap(mcp::TreeMap());
        item["name"] = tool.name;
        item["description"] = tool.description;
        mcp::Tree schema;
        mcp::parseJsonToTree(tool.inputSchema, schema);
        item["inputSchema"] = std::move(schema);
        tools.getVector().push_back(std::move(item));
      }
      mcp::Tree result;
      result.setMap(mcp::TreeMap());
      result["tools"] = std::move(tools);

      mcp::Tree resp;
      resp.setMap(mcp::TreeMap());
      resp["jsonrpc"] = "2.0";
      resp["id"].setCopy(*id);
      resp["result"] = std::move(result);
      return mcpResponse(Status::CODE_200, mcp::treeToJson(resp));
    }

    if (method == "tools/call") {
      const mcp::Tree* params = mcp::findMember(root, "params");
      const mcp::Tree* nameNode = params ? mcp::findMember(*params, "name") : nullptr;
      if (!nameNode || !nameNode->isString()) {
        return mcpResponse(Status::CODE_400, mcp::makeErrorJson(id, -32602, "Missing tool name"));
      }
      std::string toolName(nameNode->getString()->c_str());
      const mcp::Tool* tool = m_registry->find(toolName);
      if (!tool) {
        return mcpResponse(Status::CODE_400, mcp::makeErrorJson(id, -32602, "Unknown tool: " + toolName));
      }

      const mcp::Tree* arguments = (params ? mcp::findMember(*params, "arguments") : nullptr);
      if (arguments && !arguments->isMap()) {
        return mcpResponse(Status::CODE_400, mcp::makeErrorJson(id, -32602, "Invalid params: 'arguments' must be an object"));
      }
      mcp::Tree emptyArgs;
      emptyArgs.setMap(mcp::TreeMap());
      const mcp::Tree& args = arguments ? *arguments : emptyArgs;

      std::string validationError = validateArgs(*tool, args);
      if (!validationError.empty()) {
        return mcpResponse(Status::CODE_400, mcp::makeErrorJson(id, -32602, validationError));
      }

      auto authorization = request->getHeader("Authorization");
      std::string text;
      bool isError = false;
      try {
        text = tool->run(args, authorization);
      } catch (const HandlerError& e) {
        text = e.message;
        isError = true;
      }
      return mcpResponse(Status::CODE_200, mcp::makeResultJson(id, text, isError));
    }

    return mcpResponse(Status::CODE_400, mcp::makeErrorJson(id, -32601, "Method not found"));
  }

#include OATPP_CODEGEN_END(ApiController)
};
