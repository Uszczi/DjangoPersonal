cmake_minimum_required(VERSION 3.20)
set(CMAKE_SUPPRESS_DEVELOPER_WARNINGS ON CACHE BOOL "" FORCE)
set(CMAKE_WARN_DEPRECATED OFF CACHE BOOL "" FORCE)
project(django_personal VERSION 1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "" FORCE)
endif()
set(BUILD_TESTING OFF CACHE BOOL "" FORCE)
set(CMAKE_MESSAGE_LOG_LEVEL WARNING)

include(FetchContent)

# SQLite system library
find_package(SQLite3 REQUIRED QUIET)

# jwt-cpp (header-only)
set(JWT_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(JWT_BUILD_TESTS OFF CACHE BOOL "" FORCE)
FetchContent_Declare(
  jwt_cpp
  GIT_REPOSITORY https://github.com/Thalhammer/jwt-cpp.git
  GIT_TAG 1e9b1354e1b70fce293277d01abdd02b0082b1de
)
FetchContent_MakeAvailable(jwt_cpp)

# oatpp core
set(OATPP_BUILD_TESTS OFF CACHE BOOL "" FORCE)
FetchContent_Declare(
  oatpp
  GIT_REPOSITORY https://github.com/oatpp/oatpp.git
  GIT_TAG f83d648fd82dc222ef88aabbafb68efbd7d7bf50
)
FetchContent_MakeAvailable(oatpp)

# oatpp-sqlite
set(OATPP_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(OATPP_MODULES_LOCATION "CUSTOM" CACHE STRING "" FORCE)
set(OATPP_DIR_SRC "${oatpp_SOURCE_DIR}/src" CACHE PATH "" FORCE)
set(OATPP_DIR_LIB "${oatpp_BINARY_DIR}/src" CACHE PATH "" FORCE)
FetchContent_Declare(
  oatpp_sqlite
  GIT_REPOSITORY https://github.com/oatpp/oatpp-sqlite.git
  GIT_TAG b84df87f1119660f27ccc7aa1ae7fa9f240c5377
  PATCH_COMMAND sed -i "s/SQLite::SQLite3/SQLite3::SQLite3/g" src/CMakeLists.txt
)
FetchContent_MakeAvailable(oatpp_sqlite)

# oatpp-swagger
set(OATPP_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(OATPP_MODULES_LOCATION "CUSTOM" CACHE STRING "" FORCE)
set(OATPP_DIR_SRC "${oatpp_SOURCE_DIR}/src" CACHE PATH "" FORCE)
set(OATPP_DIR_LIB "${oatpp_BINARY_DIR}/src" CACHE PATH "" FORCE)
FetchContent_Declare(
  oatpp_swagger
  GIT_REPOSITORY https://github.com/oatpp/oatpp-swagger.git
  GIT_TAG 8cb460b546e84b06939a12897c85a6d863c1c53e
)
FetchContent_MakeAvailable(oatpp_swagger)

add_executable(django_personal src/App.cpp)

target_include_directories(django_personal PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/src
  ${jwt_cpp_SOURCE_DIR}/include
)

target_link_libraries(django_personal PRIVATE
  oatpp
  oatpp-sqlite
  oatpp-swagger
  crypto
)

# OATPP_BASE_DIR from oatpp-swagger config may not exist in FetchContent; set manually
target_compile_definitions(django_personal PRIVATE
  OATPP_SWAGGER_RES_PATH="${oatpp_swagger_SOURCE_DIR}/res"
)
