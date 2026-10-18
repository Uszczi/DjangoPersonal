#pragma once

#include "../db/TaskDb.hpp"
#include "../db/ProjectDb.hpp"
#include "../models/Task.hpp"
#include "../models/Project.hpp"
#include "contracts/TaskContracts.hpp"
#include "../errors/HandlerError.hpp"
#include "../util/DtoHelpers.hpp"
#include "../util/StringUtils.hpp"
#include "../validators/TaskValidators.hpp"

#include <string>

class ListTasksHandler {
public:
  ListTasksHandler(const std::shared_ptr<TaskDb>& db, const std::shared_ptr<ProjectDb>& pdb) : m_db(db), m_projectDb(pdb) {}
  oatpp::Vector<oatpp::Object<Task>> execute(int userId, int projectId, bool allProjects) {
    if (allProjects) {
      if (userId > 0) {
        auto result = m_db->getTasksByUser(userId);
        auto items = result->fetch<oatpp::Vector<oatpp::Object<Task>>>();
        if (!items) items = oatpp::Vector<oatpp::Object<Task>>::createShared();
        return items;
      }
      auto result = m_db->getAllTasks();
      auto items = result->fetch<oatpp::Vector<oatpp::Object<Task>>>();
      if (!items) items = oatpp::Vector<oatpp::Object<Task>>::createShared();
      return items;
    }
    if (projectId > 0) {
      auto result = m_db->getTasksByProject(projectId);
      auto items = result->fetch<oatpp::Vector<oatpp::Object<Task>>>();
      if (!items) items = oatpp::Vector<oatpp::Object<Task>>::createShared();
      return items;
    }
    // default: inbox of user
    if (userId > 0) {
      auto inboxRes = m_projectDb->getInboxByUser(userId);
      auto inboxItems = inboxRes->fetch<oatpp::Vector<oatpp::Object<Project>>>();
      if (inboxItems && !inboxItems->empty() && inboxItems->front()->id) {
        int inboxId = *inboxItems->front()->id;
        auto result = m_db->getTasksByProject(inboxId);
        auto items = result->fetch<oatpp::Vector<oatpp::Object<Task>>>();
        if (!items) items = oatpp::Vector<oatpp::Object<Task>>::createShared();
        return items;
      }
    }
    auto result = m_db->getAllTasks();
    auto items = result->fetch<oatpp::Vector<oatpp::Object<Task>>>();
    if (!items) items = oatpp::Vector<oatpp::Object<Task>>::createShared();
    return items;
  }
private:
  std::shared_ptr<TaskDb> m_db;
  std::shared_ptr<ProjectDb> m_projectDb;
};

class CreateTaskHandler {
public:
  CreateTaskHandler(const std::shared_ptr<TaskDb>& taskDb, const std::shared_ptr<ProjectDb>& projectDb)
    : m_taskDb(taskDb), m_projectDb(projectDb) {}
  oatpp::Object<Task> execute(int userId, const oatpp::Object<CreateTaskRequest>& body) {
    validateCreateTask(body);
    int projectId = toInt(body->project_id);
    std::string title = trimStr(std::string(*body->title));
    std::string description = toString(body->description);

    int resolvedProjectId = projectId;
    if (resolvedProjectId <= 0) {
      if (userId <= 0) throw HandlerError(400, "project_id or user_id is required.");
      auto inboxRes = m_projectDb->getInboxByUser(userId);
      auto inboxItems = inboxRes->fetch<oatpp::Vector<oatpp::Object<Project>>>();
      if (!inboxItems || inboxItems->empty()) throw HandlerError(500, "Inbox not found.");
      resolvedProjectId = inboxItems->front()->id ? *inboxItems->front()->id : 0;
      if (resolvedProjectId <= 0) throw HandlerError(500, "Inbox not found.");
    } else {
      // validate project exists and owned
      auto projRes = m_projectDb->getProjectById(resolvedProjectId);
      auto projItems = projRes->fetch<oatpp::Vector<oatpp::Object<Project>>>();
      if (!projItems || projItems->empty()) throw HandlerError(400, "Invalid project ID.");
      if (userId > 0 && projItems->front()->user_id && *projItems->front()->user_id != userId) throw HandlerError(400, "Invalid project ID.");
    }

    auto res = m_taskDb->createTask(title, description, resolvedProjectId);
    if (!res->isSuccess()) throw HandlerError(400, "Failed to create task.");

    // fetch created task: by project, last inserted? Use getAllTasks? Simpler: fetch tasks by project and pick last id.
    auto listRes = m_taskDb->getTasksByProject(resolvedProjectId);
    auto listItems = listRes->fetch<oatpp::Vector<oatpp::Object<Task>>>();
    if (!listItems || listItems->empty()) throw HandlerError(500, "Failed to load created task.");
    // find max id
    oatpp::Object<Task> created = listItems->front();
    for (auto& t : *listItems) {
      if (t->id && created->id && *t->id > *created->id) created = t;
    }
    return created;
  }
private:
  std::shared_ptr<TaskDb> m_taskDb;
  std::shared_ptr<ProjectDb> m_projectDb;
};

class UpdateTaskHandler {
public:
  UpdateTaskHandler(const std::shared_ptr<TaskDb>& taskDb, const std::shared_ptr<ProjectDb>& projectDb)
    : m_taskDb(taskDb), m_projectDb(projectDb) {}
  oatpp::Object<Task> execute(int id, int userId, const oatpp::Object<UpdateTaskRequest>& body) {
    auto res = m_taskDb->getTaskById(id);
    auto items = res->fetch<oatpp::Vector<oatpp::Object<Task>>>();
    if (!items || items->empty()) throw HandlerError(404, "Task not found.");
    auto task = items->front();

    // ownership check via project
    if (userId > 0 && task->project_id) {
      auto projRes = m_projectDb->getProjectById(*task->project_id);
      auto projItems = projRes->fetch<oatpp::Vector<oatpp::Object<Project>>>();
      if (!projItems || projItems->empty() || !projItems->front()->user_id || *projItems->front()->user_id != userId) {
        throw HandlerError(404, "Task not found.");
      }
    }

    std::string title = task->title ? std::string(*task->title) : std::string();
    std::string description = task->description ? std::string(*task->description) : std::string();
    bool isCompleted = task->is_completed ? *task->is_completed : false;
    int projectId = task->project_id ? *task->project_id : 0;

    validateUpdateTask(body);
    if (body->title) {
      std::string t = trimStr(std::string(*body->title));
      title = t;
    }
    if (body->description) {
      description = std::string(*body->description);
    }
    if (body->is_completed) {
      isCompleted = *body->is_completed;
    }
    if (body->project_id) {
      int pid = *body->project_id;
      if (pid > 0) {
        auto projRes = m_projectDb->getProjectById(pid);
        auto projItems = projRes->fetch<oatpp::Vector<oatpp::Object<Project>>>();
        if (!projItems || projItems->empty()) throw HandlerError(400, "Invalid project ID.");
        projectId = pid;
      }
    }

    auto upRes = m_taskDb->updateTask(title, description, isCompleted, projectId, id);
    if (!upRes->isSuccess()) throw HandlerError(500, "Failed to update task.");

    auto updated = m_taskDb->getTaskById(id);
    auto upItems = updated->fetch<oatpp::Vector<oatpp::Object<Task>>>();
    if (!upItems || upItems->empty()) throw HandlerError(500, "Failed to load task.");
    return upItems->front();
  }
private:
  std::shared_ptr<TaskDb> m_taskDb;
  std::shared_ptr<ProjectDb> m_projectDb;
};

class DeleteTaskHandler {
public:
  DeleteTaskHandler(const std::shared_ptr<TaskDb>& db, const std::shared_ptr<ProjectDb>& pdb) : m_db(db), m_projectDb(pdb) {}
  void execute(int id, int userId) {
    auto res = m_db->getTaskById(id);
    auto items = res->fetch<oatpp::Vector<oatpp::Object<Task>>>();
    if (!items || items->empty()) throw HandlerError(404, "Task not found.");
    auto task = items->front();
    if (userId > 0 && task->project_id) {
      auto projRes = m_projectDb->getProjectById(*task->project_id);
      auto projItems = projRes->fetch<oatpp::Vector<oatpp::Object<Project>>>();
      if (!projItems || projItems->empty() || !projItems->front()->user_id || *projItems->front()->user_id != userId) {
        throw HandlerError(404, "Task not found.");
      }
    }

    auto countRes = m_db->countTimeEntriesByTask(id);
    auto countItems = countRes->fetch<oatpp::Vector<oatpp::Object<CountResult>>>();
    int cnt = 0;
    if (countItems && !countItems->empty() && countItems->front()->c) {
      cnt = (int)*countItems->front()->c;
    }
    if (cnt > 0) throw HandlerError(400, "A task with recorded time entries cannot be deleted.");

    auto delRes = m_db->deleteTask(id);
    if (!delRes->isSuccess()) throw HandlerError(500, "Failed to delete task.");
  }
private:
  std::shared_ptr<TaskDb> m_db;
  std::shared_ptr<ProjectDb> m_projectDb;
};