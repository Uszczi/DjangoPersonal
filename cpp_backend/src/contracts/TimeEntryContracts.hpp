#pragma once

#include "../models/TimeEntry.hpp"

#include "oatpp/Types.hpp"
#include "oatpp/macro/codegen.hpp"

#include OATPP_CODEGEN_BEGIN(DTO)

class TimeEntryCreateRequest : public oatpp::DTO {
  DTO_INIT(TimeEntryCreateRequest, DTO)
  DTO_FIELD(Int32, task);
  DTO_FIELD(String, date);
  DTO_FIELD(Int32, duration_minutes);
};

class PatchedTimeEntryRequest : public oatpp::DTO {
  DTO_INIT(PatchedTimeEntryRequest, DTO)
  DTO_FIELD(Int32, task);
  DTO_FIELD(String, date);
  DTO_FIELD(Int32, duration_minutes);
};

class TimerStartRequest : public oatpp::DTO {
  DTO_INIT(TimerStartRequest, DTO)
  DTO_FIELD(Int32, task);
};

#include OATPP_CODEGEN_BEGIN(DTO)

class TimerResponse : public oatpp::DTO {
  DTO_INIT(TimerResponse, DTO)
  DTO_FIELD(oatpp::Object<TimeEntry>, entry);
  DTO_FIELD(String, server_now);
};

#include OATPP_CODEGEN_END(DTO)