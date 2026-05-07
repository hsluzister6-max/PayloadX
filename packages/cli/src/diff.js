import crypto from 'crypto';

export function hashRoute(route) {
  const data = `${route.method}:${route.path}:${route.requestSchema}:${route.responseSchema}:${route.middleware.join(',')}:${route.handler}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function diffRoutes(dbRoutes, scannedRoutes) {
  const newRoutes = [];
  const updatedRoutes = [];
  const dbRouteMap = new Map(dbRoutes.map(r => [r.id, r]));

  for (const route of scannedRoutes) {
    const id = `${route.method}:${route.path}`;
    const hash = hashRoute(route);
    const dbRoute = dbRouteMap.get(id);

    const formattedRoute = {
      id,
      method: route.method,
      path: route.path,
      request_schema: route.requestSchema,
      response_schema: route.responseSchema,
      middleware: route.middleware.join(','),
      handler: route.handler,
      hash
    };

    if (!dbRoute) {
      newRoutes.push(formattedRoute);
    } else if (dbRoute.hash !== hash) {
      updatedRoutes.push(formattedRoute);
    }
    
    dbRouteMap.delete(id);
  }

  const deletedRoutes = Array.from(dbRouteMap.values());

  return { newRoutes, updatedRoutes, deletedRoutes };
}
