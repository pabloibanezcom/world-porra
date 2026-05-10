export function getApiErrorMessage(error: unknown, fallback: string): string {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;

  if (responseData && typeof responseData === 'object' && 'error' in responseData) {
    const apiError = (responseData as { error?: unknown }).error;
    if (typeof apiError === 'string' && apiError.trim()) {
      return apiError.trim();
    }
  }

  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData.trim();
  }

  const message = (error as { message?: unknown })?.message;
  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }

  return fallback;
}
