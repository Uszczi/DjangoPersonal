#pragma once

#include "oatpp/Types.hpp"
#include "oatpp/macro/codegen.hpp"

#include OATPP_CODEGEN_BEGIN(DTO)

class Project : public oatpp::DTO {
  DTO_INIT(Project, DTO)

  DTO_FIELD(Int32, id);
  DTO_FIELD(String, name);
  DTO_FIELD(String, normalized_name);
  DTO_FIELD(String, description);
  DTO_FIELD(Boolean, is_inbox);
  DTO_FIELD(Int32, user_id);
};

#include OATPP_CODEGEN_END(DTO)
