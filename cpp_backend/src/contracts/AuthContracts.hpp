#pragma once

#include "oatpp/Types.hpp"
#include "oatpp/macro/codegen.hpp"

#include OATPP_CODEGEN_BEGIN(DTO)

class LoginRequest : public oatpp::DTO {
  DTO_INIT(LoginRequest, DTO)
  DTO_FIELD(String, username);
  DTO_FIELD(String, password);
};

class RegisterRequest : public oatpp::DTO {
  DTO_INIT(RegisterRequest, DTO)
  DTO_FIELD(String, username);
  DTO_FIELD(String, password);
  DTO_FIELD(String, password_confirm);
};

class RefreshRequest : public oatpp::DTO {
  DTO_INIT(RefreshRequest, DTO)
  DTO_FIELD(String, refresh);
};

class LoginResponse : public oatpp::DTO {
  DTO_INIT(LoginResponse, DTO)
  DTO_FIELD(String, access);
  DTO_FIELD(String, refresh);
  DTO_FIELD(Int32, user_id);
  DTO_FIELD(String, username);
};

class RefreshResponse : public oatpp::DTO {
  DTO_INIT(RefreshResponse, DTO)
  DTO_FIELD(String, access);
};

class UserResponse : public oatpp::DTO {
  DTO_INIT(UserResponse, DTO)
  DTO_FIELD(Int32, id);
  DTO_FIELD(String, username);
};

#include OATPP_CODEGEN_END(DTO)