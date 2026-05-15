/** Shared between textarea JsonEditor and Monaco request body editor. */

export const REST_KEYS = [
  'id', '_id', 'uuid', 'name', 'firstName', 'lastName', 'email', 'phone', 'username',
  'password', 'token', 'accessToken', 'refreshToken', 'apiKey', 'role', 'permissions',
  'status', 'isActive', 'isDeleted', 'enabled', 'type', 'category', 'tags',
  'createdAt', 'updatedAt', 'deletedAt', 'timestamp', 'page', 'limit', 'offset', 'total',
  'data', 'meta', 'message', 'error', 'code', 'success', 'result', 'results', 'items', 'count',
  'address', 'city', 'country', 'zipCode', 'price', 'amount', 'quantity', 'rating', 'score',
  'url', 'imageUrl', 'thumbnail', 'description', 'title', 'slug', 'content',
  'userId', 'projectId', 'parentId', 'avatar', 'weight',
];

export const VALUE_SNIPPETS = [
  { label: 'true', insert: 'true' },
  { label: 'false', insert: 'false' },
  { label: 'null', insert: 'null' },
  { label: '[]', insert: '[]' },
  { label: '{}', insert: '{}' },
];
