#pragma once

#include "../models/User.hpp"

#include "oatpp/orm/DbClient.hpp"
#include "oatpp/macro/codegen.hpp"

#include OATPP_CODEGEN_BEGIN(DbClient)

class UserDb : public oatpp::orm::DbClient {
public:
  UserDb(const std::shared_ptr<oatpp::orm::Executor>& executor)
    : oatpp::orm::DbClient(executor) {}

  QUERY(getAllUsers,
        "SELECT id, username, is_active FROM infra_user ORDER BY id ASC;");

  QUERY(getUserByUsername,
        "SELECT id, username, is_active, password FROM infra_user WHERE username = :username;",
        PARAM(oatpp::String, username));

  QUERY(getUserById,
        "SELECT id, username, is_active FROM infra_user WHERE id = :id;",
        PARAM(oatpp::Int32, id));

  QUERY(createUser,
        "INSERT INTO infra_user (password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined) "
        "VALUES (:password, NULL, 0, :username, '', '', '', 0, 1, datetime('now'));",
        PARAM(oatpp::String, password),
        PARAM(oatpp::String, username));
};

#include OATPP_CODEGEN_END(DbClient)