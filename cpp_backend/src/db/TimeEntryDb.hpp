#pragma once

#include "../models/TimeEntry.hpp"

#include "oatpp/orm/DbClient.hpp"
#include "oatpp/macro/codegen.hpp"

#include OATPP_CODEGEN_BEGIN(DbClient)

class TimeEntryDb : public oatpp::orm::DbClient {
public:
  TimeEntryDb(const std::shared_ptr<oatpp::orm::Executor>& executor)
    : oatpp::orm::DbClient(executor) {}

  QUERY(getAllTimeEntries,
        "SELECT id, task_id, start, end FROM infra_timeentry ORDER BY start DESC, id DESC;");

  QUERY(getTimeEntriesByUser,
        "SELECT te.id, te.task_id, te.start, te.end "
        "FROM infra_timeentry te JOIN infra_task t ON te.task_id = t.id "
        "JOIN infra_project p ON t.project_id = p.id "
        "WHERE p.user_id = :user_id ORDER BY te.start DESC, te.id DESC;",
        PARAM(oatpp::Int32, user_id));

  QUERY(getTimeEntriesByUserAndDay,
        "SELECT te.id, te.task_id, te.start, te.end "
        "FROM infra_timeentry te JOIN infra_task t ON te.task_id = t.id "
        "JOIN infra_project p ON t.project_id = p.id "
        "WHERE p.user_id = :user_id AND substr(te.start,1,10) = :day ORDER BY te.start DESC, te.id DESC;",
        PARAM(oatpp::Int32, user_id),
        PARAM(oatpp::String, day));

  QUERY(getTimeEntriesByTask,
        "SELECT id, task_id, start, end FROM infra_timeentry WHERE task_id = :task_id ORDER BY start DESC, id DESC;",
        PARAM(oatpp::Int32, task_id));

  QUERY(getTimeEntriesByDay,
        "SELECT id, task_id, start, end FROM infra_timeentry WHERE substr(start,1,10) = :day ORDER BY start DESC, id DESC;",
        PARAM(oatpp::String, day));

  QUERY(getTimeEntriesByTaskAndDay,
        "SELECT id, task_id, start, end FROM infra_timeentry WHERE task_id = :task_id AND substr(start,1,10) = :day ORDER BY start DESC, id DESC;",
        PARAM(oatpp::Int32, task_id),
        PARAM(oatpp::String, day));

  QUERY(getTimeEntryById,
        "SELECT id, task_id, start, end FROM infra_timeentry WHERE id = :id;",
        PARAM(oatpp::Int32, id));

  QUERY(getRunningTimeEntry,
        "SELECT id, task_id, start, end FROM infra_timeentry WHERE end IS NULL ORDER BY id DESC LIMIT 1;");

  QUERY(getRunningTimeEntryByUser,
        "SELECT te.id, te.task_id, te.start, te.end "
        "FROM infra_timeentry te JOIN infra_task t ON te.task_id = t.id "
        "JOIN infra_project p ON t.project_id = p.id "
        "WHERE p.user_id = :user_id AND te.end IS NULL ORDER BY te.id DESC LIMIT 1;",
        PARAM(oatpp::Int32, user_id));

  QUERY(createTimeEntry,
        "INSERT INTO infra_timeentry (task_id, start, end) VALUES (:task_id, :start, :end);",
        PARAM(oatpp::Int32, task_id),
        PARAM(oatpp::String, start),
        PARAM(oatpp::String, end));

  QUERY(updateTimeEntry,
        "UPDATE infra_timeentry SET task_id = :task_id, start = :start, end = :end WHERE id = :id;",
        PARAM(oatpp::Int32, task_id),
        PARAM(oatpp::String, start),
        PARAM(oatpp::String, end),
        PARAM(oatpp::Int32, id));

  QUERY(deleteTimeEntry,
        "DELETE FROM infra_timeentry WHERE id = :id;",
        PARAM(oatpp::Int32, id));

  QUERY(closeTimeEntry,
        "UPDATE infra_timeentry SET end = :end WHERE id = :id;",
        PARAM(oatpp::String, end),
        PARAM(oatpp::Int32, id));
};

#include OATPP_CODEGEN_END(DbClient)