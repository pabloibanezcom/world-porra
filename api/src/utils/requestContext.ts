import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  scenario?: string;
  tournamentNow?: string;
}

const requestContext = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return requestContext.run(context, callback);
}

export function getRequestContext(): RequestContext {
  return requestContext.getStore() ?? {};
}
