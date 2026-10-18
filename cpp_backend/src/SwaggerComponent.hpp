#include "oatpp-swagger/Model.hpp"
#include "oatpp-swagger/Resources.hpp"
#include "oatpp/macro/component.hpp"

class SwaggerComponent {
public:
  OATPP_CREATE_COMPONENT(std::shared_ptr<oatpp::swagger::DocumentInfo>, swaggerDocumentInfo)([] {

    oatpp::swagger::DocumentInfo::Builder builder;

    builder
    .setTitle("")
    .setDescription("")
    .setVersion("1.0")
    .setContactName("")
    .setContactUrl("")

    .setLicenseName("")
    .setLicenseUrl("")

    .addServer("http://localhost:8000", "server on localhost");

    return builder.build();

  }());


  OATPP_CREATE_COMPONENT(std::shared_ptr<oatpp::swagger::Resources>, swaggerResources)([] {
    // Make sure to specify correct full path to oatpp-swagger/res folder !!!
    return oatpp::swagger::Resources::loadResources(OATPP_SWAGGER_RES_PATH);
  }());

};
