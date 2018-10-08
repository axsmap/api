const mongoose = require('mongoose');

require('dotenv').config();

const { eventSchema } = require('../../models/event');

const oldEventsSchema = require('./old-schemas/event');

mongoose.Promise = global.Promise;

async function closeConnections(db, oldDb) {
  try {
    await oldDb.close();
  } catch (error) {
    console.log(error);
    process.exit(0);
  }

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

  const oldUri = process.env.OLD_DB_URI;
  const oldDb = mongoose.createConnection(oldUri, options);

  oldDb.on('connected', async () => {
    console.log('Connection to old DB established successfully');

    const oldEvent = oldDb.model('events', oldEventsSchema);

    let totalOldEvents;
    try {
      totalOldEvents = await oldEvent.count({ name: { $ne: '' } });
    } catch (error) {
      console.log('Old events failed to be count');
      console.log(error);
      await closeConnections(db, oldDb);
    }

    console.log(`Total old events: ${totalOldEvents}`);

    console.time('createEvents');

    let page = 0;
    const pageLimit = 100;
    let i = 0;
    do {
      let oldEvents;
      try {
        oldEvents = await oldEvent
          .find({ name: { $ne: '' } })
          .skip(page * pageLimit)
          .limit(pageLimit);
      } catch (error) {
        console.log('Old events failed to be found');
        console.log(error);
        await closeConnections(db, oldDb);
      }

      const Event = db.model('Event', eventSchema);

      const createEvents = [];
      for (let oldEventItem of oldEvents) {
        let participants = oldEventItem.members.map(member => member.user);
        participants = participants.filter(
          p => p.toString() !== oldEventItem.creator.toString()
        );

        const eventData = {
          _id: oldEventItem.id,
          createdAt: oldEventItem.created_at,
          description: oldEventItem.description.substring(0, 300),
          endDate: oldEventItem.event_end,
          managers: [oldEventItem.creator],
          name: oldEventItem.name,
          participants,
          participantsGoal: oldEventItem.participant_goal
            ? oldEventItem.participant_goal > 1000
              ? 1000
              : oldEventItem.participant_goal
            : 1,
          poster: oldEventItem.image,
          reviewsGoal: oldEventItem.mapping_goal
            ? oldEventItem.mapping_goal > 10000
              ? 10000
              : oldEventItem.mapping_goal
            : 1,
          startDate: oldEventItem.event_start,
          teams: oldEventItem.teams,
          updatedAt: oldEventItem.updated_at,
          venue: oldEventItem.location
        };

        createEvents.push(Event.create(eventData));
      }

      try {
        await Promise.all(createEvents);
      } catch (error) {
        console.log(
          `Events failed to be created.\nData: ${JSON.stringify({
            page,
            i
          })}`
        );
        console.log(error);
        await closeConnections(db, oldDb);
      }

      page = page + 1;
      i = i + oldEvents.length;
      console.log(i);
    } while (i < totalOldEvents);

    console.timeEnd('createEvents');

    await closeConnections(db, oldDb);
  });

  oldDb.on('error', err => {
    console.log('Connection to old DB failed ' + err);
    process.exit(0);
  });

  oldDb.on('disconnected', () => {
    console.log('Connection from old DB closed');
  });
});

db.on('error', err => {
  console.log('Connection to DB failed ' + err);
  process.exit(0);
});

db.on('disconnected', () => {
  console.log('Connection from DB closed');
});
