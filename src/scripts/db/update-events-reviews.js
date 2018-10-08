const mongoose = require('mongoose');

require('dotenv').config();

const { eventSchema } = require('../../models/event');
const { reviewSchema } = require('../../models/review');

mongoose.Promise = global.Promise;

async function closeConnections(db) {
  try {
    await db.close();
  } catch (error) {
    console.log(error);
    process.exit(0);
  }

  process.exit(0);
}

const uri = process.env.MONGODB_URI;
const options = {
  useMongoClient: true,
  socketTimeoutMS: 0,
  keepAlive: 2000
};
const db = mongoose.createConnection(uri, options);

db.on('connected', async () => {
  console.log('Connection to DB established successfully');

  const Event = db.model('Event', eventSchema);
  const Review = db.model('Review', reviewSchema);

  let totalEvents;
  try {
    totalEvents = await Event.count();
  } catch (error) {
    console.log('Events failed to be count');
    console.log(error);
    await closeConnections(db);
  }

  console.log(`Total events: ${totalEvents}`);

  let i = 0;
  let page = 0;
  const pageLimit = 100;
  do {
    let events;
    try {
      events = await Event.find({})
        .skip(page * pageLimit)
        .limit(pageLimit);
    } catch (error) {
      console.log('Teams failed to be found');
      console.log(error);
      await closeConnections(db);
    }

    const updateEvents = [];
    for (let event of events) {
      let eventReviews;
      try {
        eventReviews = await Review.find({ event: event.id }).count();
      } catch (err) {
        console.log('Event reviews failed to be count');
        console.log(err);
        await closeConnections(db);
      }

      event.reviewsAmount = eventReviews;
      updateEvents.push(event.save());
    }

    try {
      await Promise.all(updateEvents);
    } catch (err) {
      console.log(
        `Events failed to be updated.\nData: ${JSON.stringify({
          page,
          i
        })}`
      );
      console.log(err);
      await closeConnections(db);
    }

    page = page + 1;
    i = i + events.length;
    console.log(i);
  } while (i < totalEvents);

  await closeConnections(db);
});

db.on('error', err => {
  console.log('Connection to DB failed ' + err);
  process.exit(0);
});

db.on('disconnected', () => {
  console.log('Connection from DB closed');
});
