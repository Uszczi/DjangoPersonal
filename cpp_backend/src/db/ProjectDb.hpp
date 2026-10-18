#pragma once

#include "../models/Project.hpp"

#include "oatpp/orm/DbClient.hpp"
#include "oatpp/macro/codegen.hpp"

#include OATPP_CODEGEN_BEGIN(DbClient)

class ProjectDb : public oatpp::orm::DbClient {
public:
  ProjectDb(const std::shared_ptr<oatpp::orm::Executor>& executor)
    : oatpp::orm::DbClient(executor) {}

  QUERY(getAllProjects,
        "SELECT id, name, normalized_name, description, is_inbox, user_id "
        "FROM infra_project ORDER BY is_inbox DESC, normalized_name ASC;");

  QUERY(getProjectById,
        "SELECT id, name, normalized_name, description, is_inbox, user_id "
        "FROM infra_project WHERE id = :id;",
        PARAM(oatpp::Int32, id));

  QUERY(getProjectByUserAndName,
        "SELECT id, name, normalized_name, description, is_inbox, user_id "
        "FROM infra_project WHERE user_id = :user_id AND normalized_name = :normalized_name;",
        PARAM(oatpp::Int32, user_id),
        PARAM(oatpp::String, normalized_name));

  QUERY(getProjectsByUser,
        "SELECT id, name, normalized_name, description, is_inbox, user_id "
        "FROM infra_project WHERE user_id = :user_id ORDER BY is_inbox DESC, normalized_name ASC;",
        PARAM(oatpp::Int32, user_id));

  QUERY(getInboxByUser,
        "SELECT id, name, normalized_name, description, is_inbox, user_id "
        "FROM infra_project WHERE user_id = :user_id AND is_inbox = 1;",
        PARAM(oatpp::Int32, user_id));

  QUERY(createProject,
        "INSERT INTO infra_project (user_id, name, normalized_name, description, is_inbox) "
        "VALUES (:user_id, :name, :normalized_name, :description, 0);",
        PARAM(oatpp::Int32, user_id),
        PARAM(oatpp::String, name),
        PARAM(oatpp::String, normalized_name),
        PARAM(oatpp::String, description));

  QUERY(updateProject,
        "UPDATE infra_project SET name = :name, normalized_name = :normalized_name, "
        "description = :description WHERE id = :id;",
        PARAM(oatpp::String, name),
        PARAM(oatpp::String, normalized_name),
        PARAM(oatpp::String, description),
        PARAM(oatpp::Int32, id));

  QUERY(deleteTasksByProject,
        "DELETE FROM infra_task WHERE project_id = :project_id;",
        PARAM(oatpp::Int32, project_id));

  QUERY(deleteProject,
        "DELETE FROM infra_project WHERE id = :id;",
        PARAM(oatpp::Int32, id));

  QUERY(createInboxProject,
        "INSERT INTO infra_project (user_id, name, normalized_name, description, is_inbox) "
        "VALUES (:user_id, 'Inbox', 'inbox', '', 1);",
        PARAM(oatpp::Int32, user_id));
};

#include OATPP_CODEGEN_END(DbClient)
