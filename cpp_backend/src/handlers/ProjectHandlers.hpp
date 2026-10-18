#pragma once

#include "../db/ProjectDb.hpp"
#include "../models/Project.hpp"
#include "contracts/ProjectContracts.hpp"
#include "../errors/HandlerError.hpp"
#include "../util/DtoHelpers.hpp"
#include "../util/StringUtils.hpp"
#include "../validators/ProjectValidators.hpp"

#include <string>

class ListProjectsHandler {
public:
  explicit ListProjectsHandler(const std::shared_ptr<ProjectDb>& db) : m_db(db) {}
  oatpp::Vector<oatpp::Object<Project>> execute(int userId) {
    if (userId > 0) {
      auto result = m_db->getProjectsByUser(userId);
      auto items = result->fetch<oatpp::Vector<oatpp::Object<Project>>>();
      if (!items) items = oatpp::Vector<oatpp::Object<Project>>::createShared();
      return items;
    }
    auto result = m_db->getAllProjects();
    auto items = result->fetch<oatpp::Vector<oatpp::Object<Project>>>();
    if (!items) items = oatpp::Vector<oatpp::Object<Project>>::createShared();
    return items;
  }
private:
  std::shared_ptr<ProjectDb> m_db;
};

class GetProjectHandler {
public:
  explicit GetProjectHandler(const std::shared_ptr<ProjectDb>& db) : m_db(db) {}
  oatpp::Object<Project> execute(int id, int userId) {
    auto result = m_db->getProjectById(id);
    auto items = result->fetch<oatpp::Vector<oatpp::Object<Project>>>();
    if (!items || items->empty()) throw HandlerError(404, "Project not found.");
    auto p = items->front();
    if (userId > 0 && p->user_id && *p->user_id != userId) throw HandlerError(404, "Project not found.");
    return p;
  }
private:
  std::shared_ptr<ProjectDb> m_db;
};

class CreateProjectHandler {
public:
  explicit CreateProjectHandler(const std::shared_ptr<ProjectDb>& db) : m_db(db) {}
  oatpp::Object<Project> execute(int userId, const oatpp::Object<CreateProjectRequest>& body) {
    validateCreateProject(body);
    std::string name = trimStr(std::string(*body->name));
    std::string description = toString(body->description);

    std::string normalized = normalizeNameStr(name);
    if (normalized == "inbox") throw HandlerError(400, "Inbox is a reserved project name.");

    auto existing = m_db->getProjectsByUser(userId);
    auto items = existing->fetch<oatpp::Vector<oatpp::Object<Project>>>();
    if (items) {
      for (auto& p : *items) {
        if (p->normalized_name && std::string(*p->normalized_name) == normalized) {
          throw HandlerError(400, "A project with this name already exists.");
        }
      }
    }

    auto res = m_db->createProject(userId, name, normalized, description);
    if (!res->isSuccess()) throw HandlerError(400, "Failed to create project.");

    auto found = m_db->getProjectByUserAndName(userId, normalized);
    auto foundItems = found->fetch<oatpp::Vector<oatpp::Object<Project>>>();
    if (!foundItems || foundItems->empty()) throw HandlerError(500, "Failed to load created project.");
    return foundItems->front();
  }
private:
  std::shared_ptr<ProjectDb> m_db;
};

class UpdateProjectHandler {
public:
  explicit UpdateProjectHandler(const std::shared_ptr<ProjectDb>& db) : m_db(db) {}
  oatpp::Object<Project> execute(int id, int userId,
                                const oatpp::Object<UpdateProjectRequest>& body,
                                bool replace) {
    auto project = m_db->getProjectById(id);
    auto items = project->fetch<oatpp::Vector<oatpp::Object<Project>>>();
    if (!items || items->empty()) throw HandlerError(404, "Project not found.");
    auto proj = items->front();

    if (userId > 0 && proj->user_id && *proj->user_id != userId) throw HandlerError(404, "Project not found.");

    bool isInbox = proj->is_inbox ? *proj->is_inbox : false;
    int ownerId = proj->user_id ? *proj->user_id : 0;
    std::string currentName = proj->name ? std::string(*proj->name) : std::string();
    std::string currentNormalized = proj->normalized_name ? std::string(*proj->normalized_name) : std::string();
    std::string currentDescription = proj->description ? std::string(*proj->description) : std::string();

    std::string newName = currentName;
    std::string newNormalized = currentNormalized;
    std::string newDescription = currentDescription;

    validateUpdateProject(body, replace);
    if (body->name) {
      std::string n = trimStr(std::string(*body->name));
      std::string norm = normalizeNameStr(n);
      if (isInbox) {
        if (norm != "inbox") throw HandlerError(400, "Inbox cannot be renamed.");
      } else {
        if (norm == "inbox") throw HandlerError(400, "Inbox is a reserved project name.");
        auto existing = m_db->getProjectsByUser(userId);
        auto exItems = existing->fetch<oatpp::Vector<oatpp::Object<Project>>>();
        if (exItems) {
          for (auto& p : *exItems) {
            if (p->id && *p->id == id) continue;
            if (p->normalized_name && std::string(*p->normalized_name) == norm) {
              throw HandlerError(400, "A project with this name already exists.");
            }
          }
        }
      }
      newName = n;
      newNormalized = norm;
    }

    if (body->description) {
      newDescription = std::string(*body->description);
    } else if (replace) {
      newDescription = "";
    }

    auto res = m_db->updateProject(newName, newNormalized, newDescription, id);
    if (!res->isSuccess()) throw HandlerError(500, "Failed to update project.");

    auto updated = m_db->getProjectById(id);
    auto upItems = updated->fetch<oatpp::Vector<oatpp::Object<Project>>>();
    if (!upItems || upItems->empty()) throw HandlerError(500, "Failed to load project.");
    return upItems->front();
  }
private:
  std::shared_ptr<ProjectDb> m_db;
};

class DeleteProjectHandler {
public:
  explicit DeleteProjectHandler(const std::shared_ptr<ProjectDb>& db) : m_db(db) {}
  void execute(int id, int userId) {
    auto result = m_db->getProjectById(id);
    auto items = result->fetch<oatpp::Vector<oatpp::Object<Project>>>();
    if (!items || items->empty()) throw HandlerError(404, "Project not found.");
    auto project = items->front();
    if (userId > 0 && project->user_id && *project->user_id != userId) throw HandlerError(404, "Project not found.");
    if (project->is_inbox ? *project->is_inbox : false) {
      throw HandlerError(400, "Inbox cannot be deleted.");
    }
    m_db->deleteTasksByProject(id);
    auto delRes = m_db->deleteProject(id);
    if (!delRes->isSuccess()) throw HandlerError(500, "Failed to delete project.");
  }
private:
  std::shared_ptr<ProjectDb> m_db;
};
