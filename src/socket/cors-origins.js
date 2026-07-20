const DEFAULT_CHAT_ORIGINS = [
  'http://localhost:3000',
  'https://axsmap.com',
  'https://www.axsmap.com',
  'https://prod-next-app.d1hq3xdk40wf8p.amplifyapp.com'
];

function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(origin => origin && origin !== '*');
}

function getChatAllowedOrigins(environment = process.env) {
  return Array.from(
    new Set([
      ...parseOrigins(environment.WEB_APP_URL),
      ...parseOrigins(environment.WEB_APP_URLS),
      ...DEFAULT_CHAT_ORIGINS
    ])
  );
}

module.exports = {
  DEFAULT_CHAT_ORIGINS,
  getChatAllowedOrigins,
  parseOrigins
};
