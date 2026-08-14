import { genericError, isInvalidRoomPath, parseRoomPath, validContentLength, validJsonContentType, readJsonBody } from './support';
import type { OnlineCloudflareEnv } from './types';
import { emitWorkerRequestFactV1, isCanonicalVersionIdentifier } from './facts';

export { OnlineRoomDurableObject } from './runtime';

export default {
  async fetch(request: Request, env: OnlineCloudflareEnv): Promise<Response> {
    let roomId: string | null = null;
    let action = 'unknown';
    let response: Response | undefined;
    try {
      const pathname = new URL(request.url).pathname;
      const route = parseRoomPath(pathname);
      if (route === null) {
        response = genericError(isInvalidRoomPath(pathname) ? 400 : 404);
      } else {
        roomId = route.roomId;
        action = route.action;
        const methodAllowed = route.action === 'room'
          ? request.method === 'GET' || request.method === 'PUT'
          : route.action === 'commands'
            ? request.method === 'POST'
            : route.action === 'capabilities'
              ? request.method === 'POST'
              : request.method === 'GET';
        if (!methodAllowed) response = genericError(405);
        else if (env.ONLINE_ROOMS === undefined) response = genericError(500);
        else if (route.action !== 'websocket' && (request.method === 'PUT' || request.method === 'POST') && (!validJsonContentType(request) || !validContentLength(request))) response = genericError(400);
        else {
          if (route.action !== 'websocket' && (request.method === 'PUT' || request.method === 'POST')) {
            try {
              const body = await readJsonBody(request.clone());
              if (body === null) response = genericError(400);
            } catch {
              response = genericError(400);
            }
          }
          if (response === undefined) response = await env.ONLINE_ROOMS.getByName(route.roomId).fetch(request);
        }
      }
    } catch {
      response = genericError(500);
    } finally {
      const methodClass = request.method === 'GET' || request.method === 'PUT' || request.method === 'POST' ? request.method : 'OTHER';
      const status = response?.status ?? 500;
      const versionIdentifier = isCanonicalVersionIdentifier(env.CF_VERSION_METADATA?.id) ? env.CF_VERSION_METADATA.id : null;
      emitWorkerRequestFactV1(action, methodClass, status, status < 400 ? 'ok' : 'error', versionIdentifier, roomId);
    }
    return response ?? genericError(500);
  },
} satisfies { fetch(request: Request, env: OnlineCloudflareEnv): Promise<Response> };

export type OnlineCloudflareWorkerHandler = typeof import('./worker').default;
