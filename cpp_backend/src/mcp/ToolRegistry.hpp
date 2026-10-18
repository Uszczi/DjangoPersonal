#pragma once

#include "JsonRpc.hpp"
#include "../contracts/AuthContracts.hpp"
#include "../contracts/ProjectContracts.hpp"
#include "../contracts/TaskContracts.hpp"
#include "../contracts/TimeEntryContracts.hpp"
#include "../db/ProjectDb.hpp"
#include "../db/TaskDb.hpp"
#include "../db/TimeEntryDb.hpp"
#include "../db/UserDb.hpp"
#include "../errors/HandlerError.hpp"
#include "../handlers/AuthHandlers.hpp"
#include "../handlers/ProjectHandlers.hpp"
#include "../handlers/TaskHandlers.hpp"
#include "../handlers/TimeEntryHandlers.hpp"
#include "../handlers/TimerHandlers.hpp"
#include "../util/AuthHelpers.hpp"
#include "../util/TimeHelpers.hpp"

#include "oatpp/data/mapping/ObjectMapper.hpp"

#include <functional>
#include <string>
#include <vector>

namespace mcp {

enum class ArgType { String, Integer, Boolean };

struct ToolArg {
  const char* name;
  ArgType type;
  bool required;
};

struct Tool {
  const char* name;
  const char* description;
  const char* inputSchema; // raw JSON Schema text
  std::vector<ToolArg> args;
  bool requiresAuth;
  // Returns the text payload for the tool result (usually serialized JSON).
  // Throws HandlerError on business/auth failures.
  std::function<std::string(const Tree& arguments, const oatpp::String& authorization)> run;
};

inline std::string treeString(const Tree& args, const char* name, const std::string& def = "") {
  const Tree* v = findMember(args, name);
  if (!v || v->isNull() || !v->isString()) return def;
  return std::string(v->getString()->c_str());
}

inline int treeInt(const Tree& args, const char* name, int def = 0) {
  const Tree* v = findMember(args, name);
  if (!v || v->isNull() || !v->isIntPrimitive()) return def;
  return (int)v->getInteger();
}

inline bool treeBool(const Tree& args, const char* name, bool def = false) {
  const Tree* v = findMember(args, name);
  if (!v || v->isNull() || v->getType() != Tree::Type::BOOL) return def;
  return v->getPrimitive<bool>();
}

inline std::string requireYmdDate(const Tree& args, const char* name) {
  std::string date = treeString(args, name);
  if (!isValidYmdDate(date)) throw HandlerError(400, "Invalid isoformat string: '" + date + "'");
  return date;
}

class ToolRegistry {
public:
  ToolRegistry(const std::shared_ptr<UserDb>& userDb,
               const std::shared_ptr<ProjectDb>& projectDb,
               const std::shared_ptr<TaskDb>& taskDb,
               const std::shared_ptr<TimeEntryDb>& timeEntryDb,
               const std::shared_ptr<oatpp::data::mapping::ObjectMapper>& om)
    : m_userDb(userDb), m_projectDb(projectDb), m_taskDb(taskDb), m_timeEntryDb(timeEntryDb), m_om(om) {
    buildTools();
  }

  const std::vector<Tool>& tools() const { return m_tools; }

  const Tool* find(const std::string& name) const {
    for (const auto& t : m_tools) {
      if (name == t.name) return &t;
    }
    return nullptr;
  }

private:
  std::shared_ptr<UserDb> m_userDb;
  std::shared_ptr<ProjectDb> m_projectDb;
  std::shared_ptr<TaskDb> m_taskDb;
  std::shared_ptr<TimeEntryDb> m_timeEntryDb;
  std::shared_ptr<oatpp::data::mapping::ObjectMapper> m_om;
  std::vector<Tool> m_tools;

  std::string writeDto(const oatpp::Void& dto) {
    auto s = m_om->writeToString(dto);
    return s ? std::string(s->c_str()) : std::string("null");
  }

  std::string timerJson(const oatpp::Object<TimeEntry>& entry) {
    auto resp = TimerResponse::createShared();
    resp->entry = entry;
    resp->server_now = nowUtcIso();
    return writeDto(resp);
  }

  void buildTools() {
    const std::shared_ptr<UserDb>& userDb = m_userDb;
    const std::shared_ptr<ProjectDb>& projectDb = m_projectDb;
    const std::shared_ptr<TaskDb>& taskDb = m_taskDb;
    const std::shared_ptr<TimeEntryDb>& timeEntryDb = m_timeEntryDb;
    const std::shared_ptr<oatpp::data::mapping::ObjectMapper>& om = m_om;

    // ------------------------------------------------------------------
    // Projects
    // ------------------------------------------------------------------
    m_tools.push_back(Tool{
      "list_projects",
      "List all projects for the authenticated user (inbox first).",
      R"({"type":"object","properties":{}})",
      {},
      true,
      [projectDb, om](const Tree& args, const oatpp::String& authorization) -> std::string {
        (void)args;
        int userId = requireUserId(authorization);
        ListProjectsHandler handler(projectDb);
        return om->writeToString(handler.execute(userId))->c_str();
      }
    });

    m_tools.push_back(Tool{
      "get_project",
      "Fetch a single project by id.",
      R"({"type":"object","properties":{"project_id":{"type":"integer","description":"Project id."}},"required":["project_id"]})",
      {{"project_id", ArgType::Integer, true}},
      true,
      [projectDb, om](const Tree& args, const oatpp::String& authorization) -> std::string {
        int userId = requireUserId(authorization);
        GetProjectHandler handler(projectDb);
        return om->writeToString(handler.execute(treeInt(args, "project_id"), userId))->c_str();
      }
    });

    m_tools.push_back(Tool{
      "create_project",
      "Create a project.",
      R"({"type":"object","properties":{"name":{"type":"string","description":"Project name."},"description":{"type":"string","description":"Project description.","default":""}},"required":["name"]})",
      {{"name", ArgType::String, true}, {"description", ArgType::String, false}},
      true,
      [projectDb, om](const Tree& args, const oatpp::String& authorization) -> std::string {
        int userId = requireUserId(authorization);
        auto body = CreateProjectRequest::createShared();
        body->name = oatpp::String(treeString(args, "name"));
        body->description = oatpp::String(treeString(args, "description", ""));
        CreateProjectHandler handler(projectDb);
        return om->writeToString(handler.execute(userId, body))->c_str();
      }
    });

    m_tools.push_back(Tool{
      "update_project",
      "Update a project (partial).",
      R"({"type":"object","properties":{"project_id":{"type":"integer","description":"Project id."},"name":{"type":"string","description":"New name (unchanged when omitted)."},"description":{"type":"string","description":"New description (unchanged when omitted)."}},"required":["project_id"]})",
      {{"project_id", ArgType::Integer, true}, {"name", ArgType::String, false}, {"description", ArgType::String, false}},
      true,
      [projectDb, om](const Tree& args, const oatpp::String& authorization) -> std::string {
        int userId = requireUserId(authorization);
        auto body = UpdateProjectRequest::createShared();
        const Tree* name = findMember(args, "name");
        if (name && name->isString()) body->name = name->getString();
        const Tree* description = findMember(args, "description");
        if (description && description->isString()) body->description = description->getString();
        UpdateProjectHandler handler(projectDb);
        return om->writeToString(handler.execute(treeInt(args, "project_id"), userId, body, false))->c_str();
      }
    });

    m_tools.push_back(Tool{
      "delete_project",
      "Delete a project, moving its tasks to the inbox.",
      R"({"type":"object","properties":{"project_id":{"type":"integer","description":"Project id."}},"required":["project_id"]})",
      {{"project_id", ArgType::Integer, true}},
      true,
      [projectDb](const Tree& args, const oatpp::String& authorization) -> std::string {
        int userId = requireUserId(authorization);
        DeleteProjectHandler handler(projectDb);
        handler.execute(treeInt(args, "project_id"), userId);
        return "deleted";
      }
    });

    // ------------------------------------------------------------------
    // Tasks
    // ------------------------------------------------------------------
    m_tools.push_back(Tool{
      "list_tasks",
      "List tasks. Scope to a project, the inbox (default), or all projects.",
      R"({"type":"object","properties":{"project_id":{"type":"integer","description":"Project id (inbox when omitted).","default":null},"all_projects":{"type":"boolean","description":"List tasks across all projects.","default":false}}})",
      {{"project_id", ArgType::Integer, false}, {"all_projects", ArgType::Boolean, false}},
      true,
      [taskDb, projectDb, om](const Tree& args, const oatpp::String& authorization) -> std::string {
        int userId = requireUserId(authorization);
        ListTasksHandler handler(taskDb, projectDb);
        return om->writeToString(handler.execute(userId, treeInt(args, "project_id"), treeBool(args, "all_projects")))->c_str();
      }
    });

    m_tools.push_back(Tool{
      "create_task",
      "Create a task (defaults to the inbox project).",
      R"({"type":"object","properties":{"title":{"type":"string","description":"Task title."},"description":{"type":"string","description":"Task description.","default":""},"project_id":{"type":"integer","description":"Project id (inbox when omitted).","default":null}},"required":["title"]})",
      {{"title", ArgType::String, true}, {"description", ArgType::String, false}, {"project_id", ArgType::Integer, false}},
      true,
      [taskDb, projectDb, om](const Tree& args, const oatpp::String& authorization) -> std::string {
        int userId = requireUserId(authorization);
        auto body = CreateTaskRequest::createShared();
        body->title = oatpp::String(treeString(args, "title"));
        body->description = oatpp::String(treeString(args, "description", ""));
        const Tree* projectId = findMember(args, "project_id");
        if (projectId && projectId->isIntPrimitive()) body->project_id = (v_int32)projectId->getInteger();
        CreateTaskHandler handler(taskDb, projectDb);
        return om->writeToString(handler.execute(userId, body))->c_str();
      }
    });

    m_tools.push_back(Tool{
      "update_task",
      "Update a task (partial).",
      R"({"type":"object","properties":{"task_id":{"type":"integer","description":"Task id."},"title":{"type":"string","description":"New title (unchanged when omitted)."},"description":{"type":"string","description":"New description (unchanged when omitted)."},"project_id":{"type":"integer","description":"Move to this project (unchanged when omitted).","default":null},"is_completed":{"type":"boolean","description":"New completion state (unchanged when omitted).","default":null}},"required":["task_id"]})",
      {{"task_id", ArgType::Integer, true}, {"title", ArgType::String, false}, {"description", ArgType::String, false}, {"project_id", ArgType::Integer, false}, {"is_completed", ArgType::Boolean, false}},
      true,
      [taskDb, projectDb, om](const Tree& args, const oatpp::String& authorization) -> std::string {
        int userId = requireUserId(authorization);
        auto body = UpdateTaskRequest::createShared();
        const Tree* title = findMember(args, "title");
        if (title && title->isString()) body->title = title->getString();
        const Tree* description = findMember(args, "description");
        if (description && description->isString()) body->description = description->getString();
        const Tree* projectId = findMember(args, "project_id");
        if (projectId && projectId->isIntPrimitive()) body->project_id = (v_int32)projectId->getInteger();
        const Tree* isCompleted = findMember(args, "is_completed");
        if (isCompleted && isCompleted->getType() == Tree::Type::BOOL) body->is_completed = isCompleted->getPrimitive<bool>();
        UpdateTaskHandler handler(taskDb, projectDb);
        return om->writeToString(handler.execute(treeInt(args, "task_id"), userId, body))->c_str();
      }
    });

    m_tools.push_back(Tool{
      "delete_task",
      "Delete a task (refused if time has been recorded).",
      R"({"type":"object","properties":{"task_id":{"type":"integer","description":"Task id."}},"required":["task_id"]})",
      {{"task_id", ArgType::Integer, true}},
      true,
      [taskDb, projectDb](const Tree& args, const oatpp::String& authorization) -> std::string {
        int userId = requireUserId(authorization);
        DeleteTaskHandler handler(taskDb, projectDb);
        handler.execute(treeInt(args, "task_id"), userId);
        return "deleted";
      }
    });

    // ------------------------------------------------------------------
    // Time entries
    // ------------------------------------------------------------------
    m_tools.push_back(Tool{
      "list_time_entries",
      "List time entries, optionally filtered by task or date (YYYY-MM-DD).",
      R"({"type":"object","properties":{"task_id":{"type":"integer","description":"Filter by task id.","default":null},"date":{"type":"string","description":"Filter by date (YYYY-MM-DD).","default":null}}})",
      {{"task_id", ArgType::Integer, false}, {"date", ArgType::String, false}},
      true,
      [timeEntryDb, om](const Tree& args, const oatpp::String& authorization) -> std::string {
        int userId = requireUserId(authorization);
        std::string day;
        const Tree* date = findMember(args, "date");
        if (date && date->isString() && !date->getString()->empty()) day = requireYmdDate(args, "date");
        ListTimeEntriesHandler handler(timeEntryDb);
        return om->writeToString(handler.execute(userId, treeInt(args, "task_id"), day))->c_str();
      }
    });

    m_tools.push_back(Tool{
      "create_time_entry",
      "Create a time entry.",
      R"({"type":"object","properties":{"task_id":{"type":"integer","description":"Task id."},"date":{"type":"string","description":"Entry date (YYYY-MM-DD)."},"duration_minutes":{"type":"integer","description":"Duration in minutes (1-1440)."}},"required":["task_id","date","duration_minutes"]})",
      {{"task_id", ArgType::Integer, true}, {"date", ArgType::String, true}, {"duration_minutes", ArgType::Integer, true}},
      true,
      [taskDb, timeEntryDb, projectDb, om](const Tree& args, const oatpp::String& authorization) -> std::string {
        int userId = requireUserId(authorization);
        auto body = TimeEntryCreateRequest::createShared();
        body->task = treeInt(args, "task_id");
        body->date = oatpp::String(requireYmdDate(args, "date"));
        body->duration_minutes = treeInt(args, "duration_minutes");
        CreateTimeEntryHandler handler(taskDb, timeEntryDb, projectDb);
        return om->writeToString(handler.execute(userId, body))->c_str();
      }
    });

    m_tools.push_back(Tool{
      "update_time_entry",
      "Update a time entry (partial).",
      R"({"type":"object","properties":{"entry_id":{"type":"integer","description":"Time entry id."},"task_id":{"type":"integer","description":"Move to this task (unchanged when omitted).","default":null},"date":{"type":"string","description":"New date (YYYY-MM-DD, unchanged when omitted).","default":null},"duration_minutes":{"type":"integer","description":"New duration in minutes (unchanged when omitted).","default":null}},"required":["entry_id"]})",
      {{"entry_id", ArgType::Integer, true}, {"task_id", ArgType::Integer, false}, {"date", ArgType::String, false}, {"duration_minutes", ArgType::Integer, false}},
      true,
      [taskDb, timeEntryDb, projectDb, om](const Tree& args, const oatpp::String& authorization) -> std::string {
        int userId = requireUserId(authorization);
        auto body = PatchedTimeEntryRequest::createShared();
        const Tree* taskId = findMember(args, "task_id");
        if (taskId && taskId->isIntPrimitive()) body->task = (v_int32)taskId->getInteger();
        const Tree* date = findMember(args, "date");
        if (date && date->isString() && !date->getString()->empty()) body->date = oatpp::String(requireYmdDate(args, "date"));
        const Tree* duration = findMember(args, "duration_minutes");
        if (duration && duration->isIntPrimitive()) body->duration_minutes = (v_int32)duration->getInteger();
        UpdateTimeEntryHandler handler(taskDb, timeEntryDb, projectDb);
        return om->writeToString(handler.execute(treeInt(args, "entry_id"), userId, body))->c_str();
      }
    });

    m_tools.push_back(Tool{
      "delete_time_entry",
      "Delete a time entry.",
      R"({"type":"object","properties":{"entry_id":{"type":"integer","description":"Time entry id."}},"required":["entry_id"]})",
      {{"entry_id", ArgType::Integer, true}},
      true,
      [timeEntryDb](const Tree& args, const oatpp::String& authorization) -> std::string {
        int userId = requireUserId(authorization);
        DeleteTimeEntryHandler handler(timeEntryDb);
        handler.execute(treeInt(args, "entry_id"), userId);
        return "deleted";
      }
    });

    // ------------------------------------------------------------------
    // Timer
    // ------------------------------------------------------------------
    m_tools.push_back(Tool{
      "start_timer",
      "Start a timer for a task.",
      R"({"type":"object","properties":{"task_id":{"type":"integer","description":"Task id."}},"required":["task_id"]})",
      {{"task_id", ArgType::Integer, true}},
      true,
      [taskDb, timeEntryDb, projectDb, this](const Tree& args, const oatpp::String& authorization) -> std::string {
        int userId = requireUserId(authorization);
        auto body = TimerStartRequest::createShared();
        body->task = treeInt(args, "task_id");
        StartTimerHandler handler(taskDb, timeEntryDb, projectDb);
        return timerJson(handler.execute(userId, body));
      }
    });

    m_tools.push_back(Tool{
      "get_timer",
      "Get the currently running timer (if any).",
      R"({"type":"object","properties":{}})",
      {},
      true,
      [timeEntryDb, this](const Tree& args, const oatpp::String& authorization) -> std::string {
        (void)args;
        int userId = requireUserId(authorization);
        GetRunningEntryHandler handler(timeEntryDb);
        return timerJson(handler.execute(userId));
      }
    });

    m_tools.push_back(Tool{
      "stop_timer",
      "Stop the running timer.",
      R"({"type":"object","properties":{}})",
      {},
      true,
      [timeEntryDb, this](const Tree& args, const oatpp::String& authorization) -> std::string {
        (void)args;
        int userId = requireUserId(authorization);
        StopTimerHandler handler(timeEntryDb);
        return timerJson(handler.execute(userId));
      }
    });

    // ------------------------------------------------------------------
    // Accounts (public, no auth)
    // ------------------------------------------------------------------
    m_tools.push_back(Tool{
      "register_user",
      "Register a new user and return token pair.",
      R"({"type":"object","properties":{"username":{"type":"string"},"password":{"type":"string"},"password_confirm":{"type":"string"}},"required":["username","password","password_confirm"]})",
      {{"username", ArgType::String, true}, {"password", ArgType::String, true}, {"password_confirm", ArgType::String, true}},
      false,
      [userDb, projectDb, om](const Tree& args, const oatpp::String& authorization) -> std::string {
        (void)authorization;
        auto body = RegisterRequest::createShared();
        body->username = oatpp::String(treeString(args, "username"));
        body->password = oatpp::String(treeString(args, "password"));
        body->password_confirm = oatpp::String(treeString(args, "password_confirm"));
        RegisterUserHandler handler(userDb, projectDb);
        return om->writeToString(handler.execute(body))->c_str();
      }
    });

    m_tools.push_back(Tool{
      "login_user",
      "Authenticate and return token pair.",
      R"({"type":"object","properties":{"username":{"type":"string"},"password":{"type":"string"}},"required":["username","password"]})",
      {{"username", ArgType::String, true}, {"password", ArgType::String, true}},
      false,
      [userDb, om](const Tree& args, const oatpp::String& authorization) -> std::string {
        (void)authorization;
        auto body = LoginRequest::createShared();
        body->username = oatpp::String(treeString(args, "username"));
        body->password = oatpp::String(treeString(args, "password"));
        LoginUserHandler handler(userDb);
        return om->writeToString(handler.execute(body))->c_str();
      }
    });

    m_tools.push_back(Tool{
      "refresh_access_token",
      "Exchange a refresh token for a new access token.",
      R"({"type":"object","properties":{"refresh":{"type":"string","description":"Refresh token."}},"required":["refresh"]})",
      {{"refresh", ArgType::String, true}},
      false,
      [om](const Tree& args, const oatpp::String& authorization) -> std::string {
        (void)authorization;
        auto body = RefreshRequest::createShared();
        body->refresh = oatpp::String(treeString(args, "refresh"));
        RefreshTokenHandler handler;
        return om->writeToString(handler.execute(body))->c_str();
      }
    });
  }
};

} // namespace mcp
