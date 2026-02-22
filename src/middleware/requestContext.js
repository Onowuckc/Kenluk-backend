import crypto from 'crypto';

const createRequestId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const requestContext = (req, res, next) => {
  const incomingId = req.headers['x-request-id'];
  const requestId =
    typeof incomingId === 'string' && incomingId.trim().length > 0
      ? incomingId.trim()
      : createRequestId();

  req.requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
};

export default requestContext;
