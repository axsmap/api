const assert = require('assert');
const venueReviewSummary = require('./venue-review-summary');

const counter = (yes, no) => ({ yes, no });

const fullyAccessibleVenue = {
  hasPermanentRamp: counter(1, 0),
  hasPortableRamp: counter(0, 0),
  hasWideEntrance: counter(1, 0),
  hasAccessibleTableHeight: counter(1, 0),
  hasAccessibleElevator: counter(1, 0),
  hasInteriorRamp: counter(1, 0),
  hasSwingOutDoor: counter(1, 0),
  hasLargeStall: counter(1, 0),
  hasSupportAroundToilet: counter(1, 0),
  hasLoweredSinks: counter(1, 0),
  allowsGuideDog: counter(1, 0),
  hasParking: counter(1, 0),
  hasSecondEntry: counter(1, 0),
  hasWellLit: counter(1, 0),
  isQuiet: counter(1, 0),
  isSpacious: counter(1, 0),
  steps: {
    zero: 1,
    one: 0,
    two: 0,
    moreThanTwo: 0
  }
};

const mixedVenue = {
  ...fullyAccessibleVenue,
  steps: {
    zero: 0,
    one: 0,
    two: 1,
    moreThanTwo: 0
  },
  hasSwingOutDoor: counter(0, 1),
  hasLargeStall: counter(0, 1),
  hasSupportAroundToilet: counter(0, 1),
  hasLoweredSinks: counter(0, 1)
};

const replacedWithAccessibleVenue = {
  ...mixedVenue,
  steps: {
    zero: 1,
    one: 0,
    two: 0,
    moreThanTwo: 0
  },
  hasSwingOutDoor: counter(1, 0),
  hasLargeStall: counter(1, 0),
  hasSupportAroundToilet: counter(1, 0),
  hasLoweredSinks: counter(1, 0)
};

function scoreVenue(venue) {
  const entrance = venueReviewSummary.calculateRatingLevel('entrance', venue)
    .ratingLevel;
  const interior = venueReviewSummary.calculateRatingLevel('interior', venue)
    .ratingLevel;
  const restroom = venueReviewSummary.calculateRatingLevel('restroom', venue)
    .ratingLevel;

  return {
    entrance,
    interior,
    restroom,
    marker: venueReviewSummary.calculateMapMarkerScore(
      entrance,
      interior,
      restroom
    )
  };
}

assert.deepStrictEqual(scoreVenue(fullyAccessibleVenue), {
  entrance: 5,
  interior: 5,
  restroom: 5,
  marker: 5
});

assert.deepStrictEqual(scoreVenue(mixedVenue), {
  entrance: 1,
  interior: 5,
  restroom: 1,
  marker: 1
});

assert.deepStrictEqual(scoreVenue(replacedWithAccessibleVenue), {
  entrance: 5,
  interior: 5,
  restroom: 5,
  marker: 5
});

assert.strictEqual(
  venueReviewSummary.calculateRatingLevel('entrance', {
    ...fullyAccessibleVenue,
    steps: undefined
  }).ratingLevel,
  5
);

console.log('venue-review-summary tests passed');
