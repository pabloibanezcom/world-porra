export function getApiErrorMessage(error: unknown, fallback: string): string {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;

  if (responseData && typeof responseData === 'object' && 'error' in responseData) {
    const apiError = (responseData as { error?: unknown }).error;
    if (typeof apiError === 'string' && apiError.trim()) {
      return apiError.trim();
    }
  }

  if (typeof responseData === 'string' && responseData.trim()) {
    const htmlRouteMiss = responseData.match(/<pre>Cannot\s+([A-Z]+)\s+([^<]+)<\/pre>/i);
    if (htmlRouteMiss) {
      return `API route unavailable: ${htmlRouteMiss[1].toUpperCase()} ${htmlRouteMiss[2]}`;
    }

    if (/<\/?[a-z][\s\S]*>/i.test(responseData)) {
      return fallback;
    }

    return responseData.trim();
  }

  const message = (error as { message?: unknown })?.message;
  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }

  return fallback;
}
