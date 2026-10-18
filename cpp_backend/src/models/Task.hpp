#pragma once

#include "oatpp/Types.hpp"
#include "oatpp/macro/codegen.hpp"

#include OATPP_CODEGEN_BEGIN(DTO)

class Task : public oatpp::DTO {
  DTO_INIT(Task, DTO)

  DTO_FIELD(Int32, id);
  DTO_FIELD(String, title);
  DTO_FIELD(String, description);
  DTO_FIELD(Boolean, is_completed);
  DTO_FIELD(Int32, project_id);
};

#include OATPP_CODEGEN_END(DTO)