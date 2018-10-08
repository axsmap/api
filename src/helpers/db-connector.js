const mongoose = require('mongoose');
const mongoUri = require('mongodb-uri');

mongoose.Promise = global.Promise;

const delayToReconnect = 1000;
let disconnecting;
let initialized = false;
const mongodbURI = process.env.MONGODB_URI;
const dbName = mongoUri.parse(mongodbURI).database;
const options = {
  connectTimeoutMS: 30000,
  keepAlive: 120,
  useMongoClient: true
};

function logging(db) {
  db.on('connected', () =>
    console.log(`Database connection to ${dbName} established`)
  );
  db.on('open', () => console.log(`Database connection to ${dbName} opened`));
  db.on('disconnected', () => {
    if (disconnecting !== true) {
      console.log(`Database connection to ${dbName} lost`);
    }
  });
  db.on('error', err => {
    console.log(`Database connection to ${dbName} error`);
    throw err;
  });
}

function open() {
  console.log(`Opening database connection to ${dbName}...`);
  mongoose.connect(
    mongodbURI,
    options
  );
}

function reconnection(db) {
  let timer;

  function reconnect() {
    timer = false;
    open(db);
  }

  function clear() {
    if (timer) {
      clearTimeout(timer);
    }
    timer = false;
  }

  function schedule() {
    if (disconnecting) {
      console.log(`Database connection to ${dbName} explicitly shut down`);
      return;
    }

    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(reconnect, delayToReconnect);
  }

  db.on('disconnected', schedule);
  db.on('connected', clear);
}

function connect(done) {
  const db = mongoose.connection;

  if (initialized === false) {
    initialized = true;
    logging(db);
    reconnection(db);
  }

  open();

  db.once('connected', done);
}

function disconnect(done) {
  const db = mongoose.connection;

  function disconnected() {
    disconnecting = false;
    if (done) {
      done();
    }
  }

  if (db.readyState !== 0) {
    disconnecting = true;
    db.once('disconnected', disconnected);
    db.close();
  }
}

connect.disconnect = disconnect;

module.exports = connect;
