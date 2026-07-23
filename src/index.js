const fs = require('fs');
const http = require('http');
const https = require('https');

const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const ip = require('ip');
const morgan = require('morgan');
const raven = require('raven');
const { Server: SocketIOServer } = require('socket.io');

// Fill process.env with environment variables
require('dotenv').config();
//console.log(process.env)

const port = process.env.PORT || 8000;

const connectToDB = require('./helpers/db-connector');
const routes = require('./routes');
const configureSocketServer = require('./socket');
const { getDb } = require('./routes/events/leaderboard-helpers');
const {
  ensureLeaderboardIndexes
} = require('./services/leaderboard-milestones');
const {
  startLeaderboardSync
} = require('./services/salesforce-leaderboard-sync');

function connectedToDB() {
  const app = express();

  raven
    .config(process.env.SENTRY_URL, {
      captureUnhandledRejections: true
    })
    .install();

  // Middlewares
  app.use(raven.requestHandler());
  app.use(cors());
  app.use(morgan('dev'));
  app.use(bodyParser.json());
  app.use(helmet());

  app.use(
    '/badges',
    express.static(`${__dirname}/../public/badges`, {
      fallthrough: false,
      maxAge: '1h'
    })
  );

  // Routes
  app.set('strict routing', true);
  app.use('/', routes);

  // Error handling
  app.use(raven.errorHandler());
  app.use((req, res, _next) => res.status(404).json({ general: 'Not found' }));
  app.use((err, req, res, _next) => {
    if (err instanceof SyntaxError) {
      return res.status(400).json({ general: 'Invalid JSON format' });
    }

    console.error(err.stack);
    return res.status(500).json({ general: 'Something went wrong' });
  });

  process.on('uncaughtException', err => {
    console.error(err);
    raven.captureException(err);
  });
  process.on('unhandledRejection', err => {
    console.error(err);
    raven.captureException(err);
  });

  const isProduction = process.env.NODE_ENV === 'production';
  const server = isProduction
    ? http.createServer(app)
    : https.createServer(
        {
          key: fs.readFileSync('./certificates/server.key'),
          cert: fs.readFileSync('./certificates/server.crt')
        },
        app
      );

  const allowedOrigins = [
    process.env.WEB_APP_URL,
    'http://localhost:3000',
    'https://axsmap.com',
    'https://www.axsmap.com'
  ].filter(Boolean);

  const io = new SocketIOServer(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    },
    maxHttpBufferSize: 10000
  });

  configureSocketServer(io);
  app.set('io', io);

  const protocol = isProduction ? 'http' : 'https';
  server.listen(port, () => {
    console.log(`Listening on ${protocol}://${ip.address()}:${port}`);
    console.log('Socket.IO is attached to the API server');
    getDb()
      .then(async db => {
        await ensureLeaderboardIndexes(db);
        startLeaderboardSync(db);
      })
      .catch(error => {
        console.error('[salesforce:leaderboard-sync:start]', error.message);
      });
  });
}

connectToDB(connectedToDB);
