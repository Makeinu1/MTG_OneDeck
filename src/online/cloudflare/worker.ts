import { genericError, isInvalidRoomPath, parseRoomPath, validContentLength, validJsonContentType, readJsonBody } from './support';
import type { OnlineCloudflareEnv } from './types';

export { OnlineRoomDurableObject } from './runtime';

export default {
  async fetch(request: Request, env: OnlineCloudflareEnv): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    const route = parseRoomPath(pathname);
    if (route === null) {
      return genericError(isInvalidRoomPath(pathname) ? 400 : 404);
    }
    const methodAllowed = route.action === 'room' ? request.method === 'GET' || request.method === 'PUT' : route.action === 'commands' ? request.method === 'POST' : request.method === 'GET';
    if (!methodAllowed) return genericError(405);
    if (env.ONLINE_ROOMS === undefined) return genericError(500);
    if (route.action !== 'websocket' && (request.method === 'PUT' || request.method === 'POST')) {
      if (!validJsonContentType(request) || !validContentLength(request)) return genericError(400);
      try {
        const body = await readJsonBody(request.clone());
        if (body === null) return genericError(400);
      } catch {
        return genericError(400);
      }
    }
    return env.ONLINE_ROOMS.getByName(route.roomId).fetch(request);
  },
} satisfies { fetch(request: Request, env: OnlineCloudflareEnv): Promise<Response> };

export type OnlineCloudflareWorkerHandler = typeof import('./worker').default;
