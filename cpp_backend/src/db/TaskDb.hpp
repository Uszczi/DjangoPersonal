#pragma once

#include "../models/Task.hpp"

#include "oatpp/orm/DbClient.hpp"
#include "oatpp/macro/codegen.hpp"

#include OATPP_CODEGEN_BEGIN(DbClient)

class TaskDb : public oatpp::orm::DbClient {
public:
  TaskDb(const std::shared_ptr<oatpp::orm::Executor>& executor)
    : oatpp::orm::DbClient(executor) {}

  QUERY(getAllTasks,
        "SELECT id, title, description, is_completed, project_id FROM infra_task ORDER BY is_completed ASC, id ASC;");

  QUERY(getTasksByProject,
        "SELECT id, title, description, is_completed, project_id FROM infra_task WHERE project_id = :project_id ORDER BY is_completed ASC, id ASC;",
        PARAM(oatpp::Int32, project_id));

  QUERY(getTasksByUser,
        "SELECT t.id, t.title, t.description, t.is_completed, t.project_id "
        "FROM infra_task t JOIN infra_project p ON t.project_id = p.id "
        "WHERE p.user_id = :user_id ORDER BY t.is_completed ASC, t.id ASC;",
        PARAM(oatpp::Int32, user_id));

  QUERY(getTaskById,
        "SELECT id, title, description, is_completed, project_id FROM infra_task WHERE id = :id;",
        PARAM(oatpp::Int32, id));

  QUERY(createTask,
        "INSERT INTO infra_task (title, description, is_completed, project_id) VALUES (:title, :description, 0, :project_id);",
        PARAM(oatpp::String, title),
        PARAM(oatpp::String, description),
        PARAM(oatpp::Int32, project_id));

  QUERY(updateTask,
        "UPDATE infra_task SET title = :title, description = :description, is_completed = :is_completed, project_id = :project_id WHERE id = :id;",
        PARAM(oatpp::String, title),
        PARAM(oatpp::String, description),
        PARAM(oatpp::Boolean, is_completed),
        PARAM(oatpp::Int32, project_id),
        PARAM(oatpp::Int32, id));

  QUERY(deleteTask,
        "DELETE FROM infra_task WHERE id = :id;",
        PARAM(oatpp::Int32, id));

  QUERY(countTimeEntriesByTask,
        "SELECT COUNT(*) AS c FROM infra_timeentry WHERE task_id = :task_id;",
        PARAM(oatpp::Int32, task_id));
};

#include OATPP_CODEGEN_END(DbClient)