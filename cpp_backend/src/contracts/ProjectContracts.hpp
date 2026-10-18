#pragma once

#include "oatpp/Types.hpp"
#include "oatpp/macro/codegen.hpp"

#include OATPP_CODEGEN_BEGIN(DTO)

class CreateProjectRequest : public oatpp::DTO {
  DTO_INIT(CreateProjectRequest, DTO)
  DTO_FIELD(String, name);
  DTO_FIELD(String, description);
};

class UpdateProjectRequest : public oatpp::DTO {
  DTO_INIT(UpdateProjectRequest, DTO)
  DTO_FIELD(String, name);
  DTO_FIELD(String, description);
  DTO_FIELD(Int32, position);
};

#include OATPP_CODEGEN_END(DTO)