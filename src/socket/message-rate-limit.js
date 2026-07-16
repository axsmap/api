const MESSAGE_RATE_LIMIT = 20;
const MESSAGE_RATE_WINDOW_MS = 10000;
const attemptsByUser = new Map();

function consumeMessageRateLimit(userId, now = Date.now()) {
  const windowStart = now - MESSAGE_RATE_WINDOW_MS;
  const recentAttempts = (attemptsByUser.get(userId) || []).filter(
    timestamp => timestamp > windowStart
  );

  if (recentAttempts.length >= MESSAGE_RATE_LIMIT) {
    attemptsByUser.set(userId, recentAttempts);
    return false;
  }

  recentAttempts.push(now);
  attemptsByUser.set(userId, recentAttempts);
  return true;
}

function resetMessageRateLimits() {
  attemptsByUser.clear();
}

module.exports = {
  MESSAGE_RATE_LIMIT,
  MESSAGE_RATE_WINDOW_MS,
  consumeMessageRateLimit,
  resetMessageRateLimits
};
