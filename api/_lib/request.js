export async function readJsonBody(request) {
  if (request.body && typeof request.body === 'object') {
    return request.body;
  }

  if (typeof request.body === 'string' && request.body.length > 0) {
    try {
      return JSON.parse(request.body);
    } catch {
      throw new Error('Invalid JSON body.');
    }
  }

  const chunks = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();

  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error('Invalid JSON body.');
  }
}

export function setNoStore(response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
}
