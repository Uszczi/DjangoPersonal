
# Task


## Properties

Name | Type
------------ | -------------
`id` | number
`title` | string
`description` | string
`project` | number
`isCompleted` | boolean

## Example

```typescript
import type { Task } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "title": null,
  "description": null,
  "project": null,
  "isCompleted": null,
} satisfies Task

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Task
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


