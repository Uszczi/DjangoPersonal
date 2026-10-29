import { ResponseError } from './generated/api'

export async function apiErrorMessage(error: unknown) {
  if (error instanceof ResponseError && error.response) {
    const payload: unknown = await error.response.clone().json().catch(() => undefined)
    if (typeof payload === 'object' && payload !== null) {
      const firstMessage = Object.values(payload)
        .flat()
        .find((value) => typeof value === 'string')
      if (typeof firstMessage === 'string') return firstMessage
    }
    return 'Nie udało się zapisać. Sprawdź dane i spróbuj ponownie.'
  }

  return error instanceof Error
    ? error.message
    : 'Nie udało się zapisać. Spróbuj ponownie.'
}

/** Whether the server answered 404: the thing asked for is gone or never existed. */
export function isNotFound(error: unknown) {
  return error instanceof ResponseError && error.response?.status === 404
}
