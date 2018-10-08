const mongoose = require('mongoose');

require('dotenv').config();

const { venueSchema } = require('../../models/venue');

const oldVenueSchema = require('./old-schemas/venue');

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

    const OldVenue = oldDb.model('venues', oldVenueSchema);

    let totalOldVenues;
    try {
      totalOldVenues = await OldVenue.find({
        lngLat: { $exists: true },
        place_id: { $exists: true, $ne: '' },
        types: { $ne: [] }
      }).count();
    } catch (error) {
      console.log('Old venues failed to be count');
      console.log(error);
      await closeConnections(db, oldDb);
    }

    console.log(`Total old venues: ${totalOldVenues}`);

    console.time('createVenues');

    let page = 0;
    const pageLimit = 100;
    let i = 0;
    do {
      let oldVenues;
      try {
        oldVenues = await OldVenue.find({
          lngLat: { $exists: true },
          place_id: { $exists: true, $ne: '' },
          types: { $ne: [] }
        })
          .skip(page * pageLimit)
          .limit(pageLimit);
      } catch (error) {
        console.log('Old venues failed to be found');
        console.log(error);
        await closeConnections(db, oldDb);
      }

      const Venue = db.model('Venue', venueSchema);

      const createVenues = [];
      for (let oldVenue of oldVenues) {
        const addressOne = oldVenue.addr1;
        const addressTwo = oldVenue.addr2 ? ` ${oldVenue.addr2}` : '';
        const city = oldVenue.city ? `, ${oldVenue.city}` : '';
        const state = oldVenue.state ? `, ${oldVenue.state}` : '';
        const address = `${addressOne}${addressTwo}${city}${state}`;

        const bathroomScore =
          oldVenue.bathroom >= 1 ? oldVenue.bathroom : undefined;
        const entryScore = oldVenue.entry >= 1 ? oldVenue.entry : undefined;

        let longitude;
        if (oldVenue.lngLat[1] >= -180 && oldVenue.lngLat[1] <= 180) {
          longitude = oldVenue.lngLat[1];
        }
        let latitude;
        if (oldVenue.lngLat[0] >= -90 && oldVenue.lngLat[0] <= 90) {
          latitude = oldVenue.lngLat[0];
        } else {
          longitude = oldVenue.lngLat[0];
          latitude = oldVenue.lngLat[1];
        }

        const venueData = {
          _id: oldVenue.id,
          address: oldVenue.addr1 ? address : '',
          allowsGuideDog: { yes: oldVenue.guidedog },
          bathroomReviews: oldVenue.b_reviews,
          bathroomScore,
          createdAt: oldVenue.created_at,
          entryReviews: oldVenue.e_reviews,
          entryScore,
          hasParking: { yes: oldVenue.parking },
          hasRamp: { yes: oldVenue.ramp },
          hasSecondEntry: { yes: oldVenue.secondentrance },
          hasWellLit: { yes: oldVenue.welllit },
          isQuiet: { yes: oldVenue.quiet },
          isSpacious: { yes: oldVenue.spacious },
          location: { coordinates: [longitude, latitude] },
          name: oldVenue.name,
          placeId: oldVenue.place_id,
          reviews: oldVenue.reviewdata,
          steps: {
            zero: oldVenue.steps_0,
            one: oldVenue.steps_1,
            two: oldVenue.steps_2,
            moreThanTwo: oldVenue.steps_3
          },
          types: oldVenue.types,
          updatedAt: oldVenue.updated_at
        };

        createVenues.push(Venue.create(venueData));
      }

      try {
        await Promise.all(createVenues);
      } catch (error) {
        console.log(
          `Venues failed to be created.\nData: ${JSON.stringify({
            page,
            i
          })}`
        );
        console.log(error);
        await closeConnections(db, oldDb);
      }

      page = page + 1;
      i = i + oldVenues.length;
      console.log(i);
    } while (i < totalOldVenues);

    console.timeEnd('createVenues');

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
