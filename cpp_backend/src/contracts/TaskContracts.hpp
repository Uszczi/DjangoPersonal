#pragma once

#include "oatpp/Types.hpp"
#include "oatpp/macro/codegen.hpp"

#include OATPP_CODEGEN_BEGIN(DTO)

class CreateTaskRequest : public oatpp::DTO {
  DTO_INIT(CreateTaskRequest, DTO)
  DTO_FIELD(Int32, project_id);
  DTO_FIELD(String, title);
  DTO_FIELD(String, description);
};

class UpdateTaskRequest : public oatpp::DTO {
  DTO_INIT(UpdateTaskRequest, DTO)
  DTO_FIELD(String, title);
  DTO_FIELD(String, description);
  DTO_FIELD(Boolean, is_completed);
  DTO_FIELD(Int32, project_id);
  DTO_FIELD(Int32, position);
};

class CountResult : public oatpp::DTO {
  DTO_INIT(CountResult, DTO)
  DTO_FIELD(Int64, c);
};

#include OATPP_CODEGEN_END(DTO)