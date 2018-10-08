const fs = require('fs');
const https = require('https');

const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const ip = require('ip');
const morgan = require('morgan');
const raven = require('raven');

// Fill process.env with environment variables
require('dotenv').config();

const connectToDB = require('./helpers/db-connector');
const routes = require('./routes');

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

  // App Initialization
  if (process.env.NODE_ENV === 'production') {
    console.log(`Listening on http://${ip.address()}:8000`);
    app.listen(8000);
  } else {
    https
      .createServer(
        {
          key: fs.readFileSync('./certificates/server.key'),
          cert: fs.readFileSync('./certificates/server.crt')
        },
        app
      )
      .listen(8000, () =>
        console.log(`Listening on https://${ip.address()}:8000`)
      );
  }
}

connectToDB(connectedToDB);
