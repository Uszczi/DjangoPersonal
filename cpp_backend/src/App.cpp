#include "oatpp/Environment.hpp"
#include "oatpp/json/ObjectMapper.hpp"

#include "controller/ProjectController.hpp"
#include "controller/UserController.hpp"
#include "controller/TaskController.hpp"
#include "controller/TimeEntryController.hpp"
#include "controller/TimerController.hpp"
#include "mcp/McpController.hpp"
#include "db/ProjectDb.hpp"
#include "db/UserDb.hpp"
#include "db/TaskDb.hpp"
#include "db/TimeEntryDb.hpp"
#include "SwaggerComponent.hpp"

#include "oatpp-swagger/Controller.hpp"
#include "oatpp-swagger/ControllerPaths.hpp"

#include "oatpp-sqlite/orm.hpp"

#include "oatpp/network/Server.hpp"
#include "oatpp/network/tcp/server/ConnectionProvider.hpp"
#include "oatpp/web/server/HttpConnectionHandler.hpp"

#include <iostream>

void run() {
  SwaggerComponent swaggerComponent;

  auto router = oatpp::web::server::HttpRouter::createShared();
  auto om = std::make_shared<oatpp::json::ObjectMapper>();

  // SQLite connection to Django-generated database
  auto connectionProvider = std::make_shared<oatpp::sqlite::ConnectionProvider>("../backend/db.sqlite3");
  auto executor = std::make_shared<oatpp::sqlite::Executor>(connectionProvider);
  auto projectDb = std::make_shared<ProjectDb>(executor);
  auto userDb = std::make_shared<UserDb>(executor);
  auto taskDb = std::make_shared<TaskDb>(executor);
  auto timeEntryDb = std::make_shared<TimeEntryDb>(executor);

  auto controller = std::make_shared<ProjectController>(om, projectDb);
  router->addController(controller);

  auto userController = std::make_shared<UserController>(om, userDb, projectDb);
  router->addController(userController);

  auto taskController = std::make_shared<TaskController>(om, taskDb, projectDb);
  router->addController(taskController);

  auto timeEntryController = std::make_shared<TimeEntryController>(om, timeEntryDb, taskDb, projectDb);
  router->addController(timeEntryController);

  auto timerController = std::make_shared<TimerController>(om, timeEntryDb, taskDb, projectDb);
  router->addController(timerController);

  auto mcpController = std::make_shared<McpController>(om, userDb, projectDb, taskDb, timeEntryDb);
  router->addController(mcpController);

  OATPP_CREATE_COMPONENT(std::shared_ptr<oatpp::swagger::ControllerPaths>, swaggerPaths)([] {
    auto paths = std::make_shared<oatpp::swagger::ControllerPaths>();
    paths->apiJson = "api-docs/oas-3.0.0.json";
    paths->ui = "/swagger/ui";
    paths->initializer = "/swagger/swagger-initializer.js";
    paths->uiResources = "/swagger/{filename}";
    return paths;
  }());

  oatpp::web::server::api::Endpoints swaggerEndpoints;
  swaggerEndpoints.append(controller->getEndpoints());
  swaggerEndpoints.append(userController->getEndpoints());
  swaggerEndpoints.append(taskController->getEndpoints());
  swaggerEndpoints.append(timeEntryController->getEndpoints());
  swaggerEndpoints.append(timerController->getEndpoints());

  auto swaggerController = oatpp::swagger::Controller::createShared(swaggerEndpoints);
  router->addController(swaggerController);

  auto serverConnectionProvider =
      oatpp::network::tcp::server::ConnectionProvider::createShared(
          {"0.0.0.0", 8080, oatpp::network::Address::IP_4});
  auto connectionHandler =
      oatpp::web::server::HttpConnectionHandler::createShared(router);

  router->logRouterMappings();
  oatpp::network::Server server(serverConnectionProvider, connectionHandler);
  std::cout << "Server running on http://localhost:8080\n";
  std::cout << "Swagger UI: http://localhost:8080/swagger/ui\n";
  server.run();
}

int main() {
  oatpp::Environment::init();

  run();

  std::cout << "\nEnvironment:\n";
  std::cout << "objectsCount = " << oatpp::Environment::getObjectsCount() << "\n";
  std::cout << "objectsCreated = " << oatpp::Environment::getObjectsCreated() << "\n\n";

  oatpp::Environment::destroy();
  return 0;
}
