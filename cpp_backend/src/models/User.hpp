#pragma once

#include "oatpp/Types.hpp"
#include "oatpp/macro/codegen.hpp"

#include OATPP_CODEGEN_BEGIN(DTO)

class User : public oatpp::DTO {
  DTO_INIT(User, DTO)

  DTO_FIELD(Int32, id);
  DTO_FIELD(String, username);
  DTO_FIELD(Boolean, is_active);
  DTO_FIELD(String, password); // only populated by auth queries
};

#include OATPP_CODEGEN_END(DTO)
