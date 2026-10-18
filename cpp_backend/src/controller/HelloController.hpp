#pragma once

#include "oatpp/web/server/api/ApiController.hpp"
#include "oatpp/data/mapping/ObjectMapper.hpp"
#include "oatpp/macro/codegen.hpp"

#include OATPP_CODEGEN_BEGIN(ApiController)

class HelloController : public oatpp::web::server::api::ApiController {
public:
  HelloController(const std::shared_ptr<oatpp::data::mapping::ObjectMapper>& om)
    : oatpp::web::server::api::ApiController(om) {}

  ENDPOINT("GET", "/hello", hello) {
    return createResponse(oatpp::web::protocol::http::Status::CODE_200, "Hello, World!");
  }
};

#include OATPP_CODEGEN_END(ApiController)
