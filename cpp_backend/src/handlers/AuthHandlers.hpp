#pragma once

#include "../db/UserDb.hpp"
#include "../db/ProjectDb.hpp"
#include "../auth/Password.hpp"
#include "../auth/Jwt.hpp"
#include "../contracts/AuthContracts.hpp"
#include "../errors/HandlerError.hpp"
#include "../util/DtoHelpers.hpp"
#include "../validators/AuthValidators.hpp"

#include "../models/User.hpp"

#include <string>


class ListUsersHandler {
public:
  explicit ListUsersHandler(const std::shared_ptr<UserDb>& db) : m_db(db) {}
  oatpp::Vector<oatpp::Object<User>> execute() {
    auto result = m_db->getAllUsers();
    auto items = result->fetch<oatpp::Vector<oatpp::Object<User>>>();
    if (!items) items = oatpp::Vector<oatpp::Object<User>>::createShared();
    return items;
  }
private:
  std::shared_ptr<UserDb> m_db;
};

class RegisterUserHandler {
public:
  RegisterUserHandler(const std::shared_ptr<UserDb>& userDb, const std::shared_ptr<ProjectDb>& projectDb)
    : m_userDb(userDb), m_projectDb(projectDb) {}
  oatpp::Object<LoginResponse> execute(const oatpp::Object<RegisterRequest>& body) {
    validateRegister(body);
    std::string username = std::string(*body->username);
    std::string password = std::string(*body->password);
    std::string passwordConfirm = std::string(*body->password_confirm);

    std::string hashed = createDjangoPassword(password);
    if (hashed.empty()) throw HandlerError(500, "Failed to hash password");

    auto createResult = m_userDb->createUser(hashed, username);
    if (!createResult->isSuccess()) throw HandlerError(400, "A user with this username already exists.");

    auto result = m_userDb->getUserByUsername(username);
    auto items = result->fetch<oatpp::Vector<oatpp::Object<User>>>();
    if (!items || items->empty()) throw HandlerError(500, "Failed to load user");
    auto user = items->front();

    m_projectDb->createInboxProject(user->id);

    auto resp = LoginResponse::createShared();
    resp->access = createAccessToken(user->id, std::string(*user->username));
    resp->refresh = createRefreshToken(user->id, std::string(*user->username));
    resp->user_id = user->id;
    resp->username = user->username;
    return resp;
  }
private:
  std::shared_ptr<UserDb> m_userDb;
  std::shared_ptr<ProjectDb> m_projectDb;
};

class LoginUserHandler {
public:
  explicit LoginUserHandler(const std::shared_ptr<UserDb>& db) : m_db(db) {}
  oatpp::Object<LoginResponse> execute(const oatpp::Object<LoginRequest>& body) {
    validateLogin(body);
    std::string username = std::string(*body->username);
    std::string password = std::string(*body->password);
    auto result = m_db->getUserByUsername(username);
    auto items = result->fetch<oatpp::Vector<oatpp::Object<User>>>();
    if (!items || items->empty()) throw HandlerError(401, "Invalid credentials");
    auto user = items->front();
    if (!user->password || !verifyDjangoPassword(password, std::string(*user->password))) {
      throw HandlerError(401, "Invalid credentials");
    }

    auto resp = LoginResponse::createShared();
    resp->access = createAccessToken(user->id, std::string(*user->username));
    resp->refresh = createRefreshToken(user->id, std::string(*user->username));
    resp->user_id = user->id;
    resp->username = user->username;
    return resp;
  }
private:
  std::shared_ptr<UserDb> m_db;
};

class RefreshTokenHandler {
public:
  oatpp::Object<RefreshResponse> execute(const oatpp::Object<RefreshRequest>& body) {
    std::string refreshToken = toString(body->refresh);
    int userId = 0;
    std::string username;
    if (!verifyRefreshToken(refreshToken, userId, username)) throw HandlerError(401, "Invalid or expired refresh token.");
    auto resp = RefreshResponse::createShared();
    resp->access = createAccessToken(userId, username);
    return resp;
  }
};

class GetMeHandler {
public:
  explicit GetMeHandler(const std::shared_ptr<UserDb>& db) : m_db(db) {}
  oatpp::Object<UserResponse> execute(const std::string& token) {
    if (token.empty()) throw HandlerError(401, "Invalid or expired token.");
    int userId = 0;
    std::string username;
    if (!verifyAccessToken(token, userId, username)) throw HandlerError(401, "Invalid or expired token.");

    auto result = m_db->getUserById(userId);
    auto items = result->fetch<oatpp::Vector<oatpp::Object<User>>>();
    if (!items || items->empty()) throw HandlerError(401, "User not found.");

    auto resp = UserResponse::createShared();
    resp->id = items->front()->id;
    resp->username = items->front()->username;
    return resp;
  }
private:
  std::shared_ptr<UserDb> m_db;
};
