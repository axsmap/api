require('dotenv').config();

const { MongoClient, ObjectId } = require('mongodb');
const venueReviewSummary = require('../../helpers/venue-review-summary');

const BOOLEAN_FIELDS = [
  'hasPermanentRamp',
  'hasPortableRamp',
  'hasWideEntrance',
  'hasAccessibleTableHeight',
  'hasAccessibleElevator',
  'hasInteriorRamp',
  'hasSwingOutDoor',
  'hasLargeStall',
  'hasSupportAroundToilet',
  'hasLoweredSinks',
  'allowsGuideDog',
  'hasParking',
  'hasSecondEntry',
  'hasWellLit',
  'isQuiet',
  'isSpacious'
];

const createCounters = () =>
  BOOLEAN_FIELDS.reduce((counters, field) => {
    counters[field] = { yes: 0, no: 0 };
    return counters;
  }, {});

const createSteps = () => ({
  zero: 0,
  one: 0,
  two: 0,
  moreThanTwo: 0
});

const getDbName = uri => new URL(uri).pathname.replace(/^\//, '').trim();

async function recalculateVenue(db, venue, options = {}) {
  const reviews = await db
    .collection('reviews')
    .find({ venue: venue._id, isBanned: { $ne: true } })
    .toArray();

  const counters = createCounters();
  const steps = createSteps();

  reviews.forEach(review => {
    BOOLEAN_FIELDS.forEach(field => {
      if (typeof review[field] !== 'boolean') {
        return;
      }

      if (review[field]) {
        counters[field].yes += 1;
      } else {
        counters[field].no += 1;
      }
    });

    if (review.steps === 0) {
      steps.zero += 1;
    } else if (review.steps === 1) {
      steps.one += 1;
    } else if (review.steps === 2) {
      steps.two += 1;
    } else if (review.steps === 3) {
      steps.moreThanTwo += 1;
    }
  });

  const aggregate = {
    ...counters,
    steps
  };
  let scoring = venueReviewSummary.calculateRatingLevel('entrance', aggregate);
  aggregate.entranceScore = scoring.ratingLevel;
  aggregate.entranceGlyphs = scoring.ratingGlyphs;

  scoring = venueReviewSummary.calculateRatingLevel('interior', aggregate);
  aggregate.interiorScore = scoring.ratingLevel;
  aggregate.interiorGlyphs = scoring.ratingGlyphs;

  scoring = venueReviewSummary.calculateRatingLevel('restroom', aggregate);
  aggregate.restroomScore = scoring.ratingLevel;
  aggregate.restroomGlyphs = scoring.ratingGlyphs;

  aggregate.mapMarkerScore = venueReviewSummary.calculateMapMarkerScore(
    aggregate.entranceScore,
    aggregate.interiorScore,
    aggregate.restroomScore
  );
  aggregate.updatedAt = new Date();

  if (!options.dryRun) {
    await db.collection('venues').updateOne(
      { _id: venue._id },
      {
        $set: aggregate
      }
    );
  }

  return {
    dryRun: Boolean(options.dryRun),
    id: venue._id.toString(),
    name: venue.name,
    placeId: venue.placeId,
    reviews: reviews.length,
    entranceScore: aggregate.entranceScore,
    interiorScore: aggregate.interiorScore,
    restroomScore: aggregate.restroomScore,
    mapMarkerScore: aggregate.mapMarkerScore
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const args = process.argv.slice(2).filter(arg => arg !== '--dry-run');
  const placeId = args[0];
  const venueId = args[1];

  if (!placeId && !venueId) {
    throw new Error(
      'Usage: node src/scripts/db/recalculate-venue-accessibility.js <placeId> [venueId]'
    );
  }

  const client = await MongoClient.connect(
    process.env.MONGODB_URI,
    {
      maxPoolSize: 2
    }
  );
  const db = client.db(decodeURIComponent(getDbName(process.env.MONGODB_URI)));

  const query = venueId ? { _id: new ObjectId(venueId) } : { placeId };
  const venue = await db.collection('venues').findOne(query);

  if (!venue) {
    throw new Error('Venue not found');
  }

  const result = await recalculateVenue(db, venue, { dryRun });
  console.log(JSON.stringify(result, null, 2));
  await client.close();
}

if (require.main === module) {
  main().catch(err => {
    console.error(err.stack || err);
    process.exit(1);
  });
}

module.exports = {
  recalculateVenue
};
