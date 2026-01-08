const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const ip = require("ip");
const morgan = require("morgan");
const raven = require("raven");

// Fill process.env with environment variables
require("dotenv").config();
//console.log(process.env)

const port = process.env.PORT || 8000;
const connectToDB = require("./helpers/db-connector");
const routes = require("./routes");
const {
  initializeNotificationScheduler,
} = require("./services/notification-cron");

function connectedToDB() {
  const app = express();

  raven
    .config(process.env.SENTRY_URL, {
      captureUnhandledRejections: true,
    })
    .install();

  // Middlewares
  app.use(raven.requestHandler());
  app.use(cors());
  app.use(morgan("dev"));
  app.use(bodyParser.json());
  app.use(helmet());

  // Routes
  app.set("strict routing", true);
  app.get("/", (req, res) => {
    console.log("calling / route");
    res.send("server is up");
  });
  app.use("/", routes);

  // Error handling
  app.use(raven.errorHandler());
  app.use((req, res) => res.status(404).json({ general: "Not found" }));
  app.use((err, req, res) => {
    if (err instanceof SyntaxError) {
      return res.status(400).json({ general: "Invalid JSON format" });
    }

    console.error(err.stack);
    return res.status(500).json({ general: "Something went wrong" });
  });

  process.on("uncaughtException", (err) => {
    console.error(err);
    raven.captureException(err);
  });
  process.on("unhandledRejection", (err) => {
    console.error(err);
    raven.captureException(err);
  });
  app.listen(port, () => {
    console.log(`Listening on http://${ip.address()}:${port}`);

    // Initialize notification scheduler
    initializeNotificationScheduler();
  });
  // App Initialization
  // if (process.env.NODE_ENV === "production") {
  //   app.listen(port, () => {
  //     console.log(`Listening on http://${ip.address()}:${port}`);
  //   });
  // } else {
  //   https
  //     .createServer(
  //       {
  //         key: fs.readFileSync("./certificates/server.key"),
  //         cert: fs.readFileSync("./certificates/server.crt"),
  //       },
  //       app
  //     )
  //     .listen(port, () =>
  //       console.log(`Listening on https://${ip.address()}:${port}`)
  //     );
  // }
}

connectToDB(connectedToDB);
