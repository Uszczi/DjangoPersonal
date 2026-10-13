# TasksApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**tasksCreate**](TasksApi.md#taskscreate) | **POST** /api/v1/tasks/ |  |
| [**tasksList**](TasksApi.md#taskslist) | **GET** /api/v1/tasks/ |  |
| [**tasksPartialUpdate**](TasksApi.md#taskspartialupdate) | **PATCH** /api/v1/tasks/{id}/ |  |



## tasksCreate

> Task tasksCreate(taskCreateRequest)



### Example

```ts
import {
  Configuration,
  TasksApi,
} from '';
import type { TasksCreateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure HTTP basic authorization: basicAuth
    username: "YOUR USERNAME",
    password: "YOUR PASSWORD",
    // To configure API key authorization: cookieAuth
    apiKey: "YOUR API KEY",
  });
  const api = new TasksApi(config);

  const body = {
    // TaskCreateRequest
    taskCreateRequest: ...,
  } satisfies TasksCreateRequest;

  try {
    const data = await api.tasksCreate(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **taskCreateRequest** | [TaskCreateRequest](TaskCreateRequest.md) |  | |

### Return type

[**Task**](Task.md)

### Authorization

[basicAuth](../README.md#basicAuth), [cookieAuth](../README.md#cookieAuth)

### HTTP request headers

- **Content-Type**: `application/json`, `application/x-www-form-urlencoded`, `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## tasksList

> Array&lt;Task&gt; tasksList(project)



### Example

```ts
import {
  Configuration,
  TasksApi,
} from '';
import type { TasksListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure HTTP basic authorization: basicAuth
    username: "YOUR USERNAME",
    password: "YOUR PASSWORD",
    // To configure API key authorization: cookieAuth
    apiKey: "YOUR API KEY",
  });
  const api = new TasksApi(config);

  const body = {
    // number | Project ID. Defaults to Inbox when omitted. (optional)
    project: 56,
  } satisfies TasksListRequest;

  try {
    const data = await api.tasksList(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **project** | `number` | Project ID. Defaults to Inbox when omitted. | [Optional] [Defaults to `undefined`] |

### Return type

[**Array&lt;Task&gt;**](Task.md)

### Authorization

[basicAuth](../README.md#basicAuth), [cookieAuth](../README.md#cookieAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## tasksPartialUpdate

> Task tasksPartialUpdate(id, patchedTaskUpdateRequest)



### Example

```ts
import {
  Configuration,
  TasksApi,
} from '';
import type { TasksPartialUpdateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure HTTP basic authorization: basicAuth
    username: "YOUR USERNAME",
    password: "YOUR PASSWORD",
    // To configure API key authorization: cookieAuth
    apiKey: "YOUR API KEY",
  });
  const api = new TasksApi(config);

  const body = {
    // number | A unique integer value identifying this task.
    id: 56,
    // PatchedTaskUpdateRequest (optional)
    patchedTaskUpdateRequest: ...,
  } satisfies TasksPartialUpdateRequest;

  try {
    const data = await api.tasksPartialUpdate(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `number` | A unique integer value identifying this task. | [Defaults to `undefined`] |
| **patchedTaskUpdateRequest** | [PatchedTaskUpdateRequest](PatchedTaskUpdateRequest.md) |  | [Optional] |

### Return type

[**Task**](Task.md)

### Authorization

[basicAuth](../README.md#basicAuth), [cookieAuth](../README.md#cookieAuth)

### HTTP request headers

- **Content-Type**: `application/json`, `application/x-www-form-urlencoded`, `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

