# ProjectsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**projectsCreate**](ProjectsApi.md#projectscreate) | **POST** /api/v1/projects/ |  |
| [**projectsList**](ProjectsApi.md#projectslist) | **GET** /api/v1/projects/ |  |
| [**projectsPartialUpdate**](ProjectsApi.md#projectspartialupdate) | **PATCH** /api/v1/projects/{id}/ |  |
| [**projectsRetrieve**](ProjectsApi.md#projectsretrieve) | **GET** /api/v1/projects/{id}/ |  |
| [**projectsUpdate**](ProjectsApi.md#projectsupdate) | **PUT** /api/v1/projects/{id}/ |  |



## projectsCreate

> Project projectsCreate(projectRequest)



### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { ProjectsCreateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure HTTP basic authorization: basicAuth
    username: "YOUR USERNAME",
    password: "YOUR PASSWORD",
    // To configure API key authorization: cookieAuth
    apiKey: "YOUR API KEY",
  });
  const api = new ProjectsApi(config);

  const body = {
    // ProjectRequest
    projectRequest: ...,
  } satisfies ProjectsCreateRequest;

  try {
    const data = await api.projectsCreate(body);
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
| **projectRequest** | [ProjectRequest](ProjectRequest.md) |  | |

### Return type

[**Project**](Project.md)

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


## projectsList

> Array&lt;Project&gt; projectsList()



### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { ProjectsListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure HTTP basic authorization: basicAuth
    username: "YOUR USERNAME",
    password: "YOUR PASSWORD",
    // To configure API key authorization: cookieAuth
    apiKey: "YOUR API KEY",
  });
  const api = new ProjectsApi(config);

  try {
    const data = await api.projectsList();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**Array&lt;Project&gt;**](Project.md)

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


## projectsPartialUpdate

> Project projectsPartialUpdate(id, patchedProjectRequest)



### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { ProjectsPartialUpdateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure HTTP basic authorization: basicAuth
    username: "YOUR USERNAME",
    password: "YOUR PASSWORD",
    // To configure API key authorization: cookieAuth
    apiKey: "YOUR API KEY",
  });
  const api = new ProjectsApi(config);

  const body = {
    // number | A unique integer value identifying this project.
    id: 56,
    // PatchedProjectRequest (optional)
    patchedProjectRequest: ...,
  } satisfies ProjectsPartialUpdateRequest;

  try {
    const data = await api.projectsPartialUpdate(body);
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
| **id** | `number` | A unique integer value identifying this project. | [Defaults to `undefined`] |
| **patchedProjectRequest** | [PatchedProjectRequest](PatchedProjectRequest.md) |  | [Optional] |

### Return type

[**Project**](Project.md)

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


## projectsRetrieve

> Project projectsRetrieve(id)



### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { ProjectsRetrieveRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure HTTP basic authorization: basicAuth
    username: "YOUR USERNAME",
    password: "YOUR PASSWORD",
    // To configure API key authorization: cookieAuth
    apiKey: "YOUR API KEY",
  });
  const api = new ProjectsApi(config);

  const body = {
    // number | A unique integer value identifying this project.
    id: 56,
  } satisfies ProjectsRetrieveRequest;

  try {
    const data = await api.projectsRetrieve(body);
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
| **id** | `number` | A unique integer value identifying this project. | [Defaults to `undefined`] |

### Return type

[**Project**](Project.md)

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


## projectsUpdate

> Project projectsUpdate(id, projectRequest)



### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { ProjectsUpdateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure HTTP basic authorization: basicAuth
    username: "YOUR USERNAME",
    password: "YOUR PASSWORD",
    // To configure API key authorization: cookieAuth
    apiKey: "YOUR API KEY",
  });
  const api = new ProjectsApi(config);

  const body = {
    // number | A unique integer value identifying this project.
    id: 56,
    // ProjectRequest
    projectRequest: ...,
  } satisfies ProjectsUpdateRequest;

  try {
    const data = await api.projectsUpdate(body);
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
| **id** | `number` | A unique integer value identifying this project. | [Defaults to `undefined`] |
| **projectRequest** | [ProjectRequest](ProjectRequest.md) |  | |

### Return type

[**Project**](Project.md)

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

