#pragma once

#include "oatpp/Types.hpp"
#include "oatpp/macro/codegen.hpp"

#include OATPP_CODEGEN_BEGIN(DTO)

class TimeEntry : public oatpp::DTO {
  DTO_INIT(TimeEntry, DTO)

  DTO_FIELD(Int32, id);
  DTO_FIELD(Int32, task_id);
  DTO_FIELD(String, start);
  DTO_FIELD(String, end);
};

#include OATPP_CODEGEN_END(DTO)