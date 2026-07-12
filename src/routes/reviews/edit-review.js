const moment = require('moment');
const { pick } = require('lodash');

const { Event } = require('../../models/event');
const { Review } = require('../../models/review');
const { Team } = require('../../models/team');
const { Venue } = require('../../models/venue');
const venueReviewSummary = require('../../helpers/venue-review-summary.js');

const { validateCreateEditReview } = require('./validations');

const booleanFields = [
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

const stepKeys = ['zero', 'one', 'two', 'moreThanTwo'];

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

const ensureCounter = value => ({
  yes: value && typeof value.yes === 'number' ? value.yes : 0,
  no: value && typeof value.no === 'number' ? value.no : 0
});

const ensureSteps = steps => ({
  zero: steps && typeof steps.zero === 'number' ? steps.zero : 0,
  one: steps && typeof steps.one === 'number' ? steps.one : 0,
  two: steps && typeof steps.two === 'number' ? steps.two : 0,
  moreThanTwo:
    steps && typeof steps.moreThanTwo === 'number' ? steps.moreThanTwo : 0
});

const decrement = value => Math.max(0, value - 1);

const applyBooleanCounterChange = (venue, field, previousValue, nextValue) => {
  if (previousValue === nextValue) return;

  const counter = ensureCounter(venue[field]);

  if (typeof previousValue === 'boolean') {
    const previousKey = previousValue ? 'yes' : 'no';
    counter[previousKey] = decrement(counter[previousKey]);
  }

  if (typeof nextValue === 'boolean') {
    const nextKey = nextValue ? 'yes' : 'no';
    counter[nextKey] += 1;
  }

  venue[field] = counter;
};

const applyStepsCounterChange = (venue, previousValue, nextValue) => {
  if (previousValue === nextValue) return;

  const steps = ensureSteps(venue.steps);

  if (typeof previousValue === 'number' && stepKeys[previousValue]) {
    steps[stepKeys[previousValue]] = decrement(steps[stepKeys[previousValue]]);
  }

  if (typeof nextValue === 'number' && stepKeys[nextValue]) {
    steps[stepKeys[nextValue]] += 1;
  }

  venue.steps = steps;
};

const recalculateVenueScores = venue => {
  let scoring = venueReviewSummary.calculateRatingLevel('entrance', venue);
  venue.entranceScore = scoring.ratingLevel;
  venue.entranceGlyphs = scoring.ratingGlyphs;
  scoring = venueReviewSummary.calculateRatingLevel('interior', venue);
  venue.interiorScore = scoring.ratingLevel;
  venue.interiorGlyphs = scoring.ratingGlyphs;
  scoring = venueReviewSummary.calculateRatingLevel('restroom', venue);
  venue.restroomScore = scoring.ratingLevel;
  venue.restroomGlyphs = scoring.ratingGlyphs;
  venue.mapMarkerScore = venueReviewSummary.calculateMapMarkerScore(
    venue.entranceScore,
    venue.interiorScore,
    venue.restroomScore
  );
};

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' });
  }

  const reviewId = req.params.reviewId;

  let review;
  try {
    review = await Review.findOne({ _id: reviewId }).select(
      '-__v -createdAt -updatedAt'
    );
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Review not found' });
    }

    console.log(`Review ${reviewId} failed to be found at edit-review`);
    return next(err);
  }

  if (!review) {
    return res.status(404).json({ general: 'Review not found' });
  }

  if (review.user.toString() !== req.user.id) {
    return res
      .status(423)
      .json({ general: 'You cannot edit someone else review' });
  }

  let venue;
  try {
    venue = await Venue.findOne({
      _id: review.venue.toString(),
      isArchived: false
    });
  } catch (err) {
    console.log(
      `Venue ${review.venue.toString()} failed to be found at edit-review`
    );
    return next(err);
  }

  if (!venue) {
    return res.status(404).json({ general: 'Review venue not found' });
  }

  const data = pick(req.body, [
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
    'comments',
    'event',
    'hasParking',
    'hasSecondEntry',
    'hasWellLit',
    'isQuiet',
    'isSpacious',
    'steps',
    'team'
  ]);
  const { errors, isValid } = validateCreateEditReview(data, {
    requirePlace: false
  });

  if (!isValid) {
    return res.status(400).json(errors);
  }

  if (hasOwn(data, 'comments')) {
    review.comments = data.comments;
  }

  if (data.event) {
    let event;
    try {
      event = await Event.findOne({ _id: data.event });
    } catch (err) {
      console.log(`Event ${data.event} failed to be found at edit-review`);
      return next(err);
    }

    if (!event) {
      return res.status(404).json({ event: 'Event not found' });
    }

    if (!event.participants.find(p => p.toString() === req.user.id)) {
      return res
        .status(400)
        .json({ event: 'You are not a participant of this event' });
    }

    const startDate = moment(event.startDate).utc();
    const endDate = moment(event.endDate).utc();
    const today = moment.utc();
    if (startDate.isAfter(today)) {
      return res.status(400).json({ event: 'Event has not started yet' });
    } else if (endDate.isBefore(today)) {
      return res.status(400).json({ event: 'Event has already finished' });
    }

    review.event = data.event;
  }

  booleanFields.forEach(field => {
    if (!hasOwn(data, field)) return;

    applyBooleanCounterChange(venue, field, review[field], data[field]);
    review[field] = data[field];
  });

  if (hasOwn(data, 'steps')) {
    applyStepsCounterChange(venue, review.steps, data.steps);
    review.steps = data.steps;
  }

  if (data.team) {
    let team;
    try {
      team = await Team.findOne({ _id: data.team, isArchived: false });
    } catch (err) {
      console.log(`Team ${data.team} failed to be found at edit-review`);
      return next(err);
    }

    if (!team) {
      return res.status(404).json({ team: 'Team not found' });
    }

    if (!team.members.find(m => m.toString() === req.user.id)) {
      return res
        .status(400)
        .json({ team: 'You are not a member of this team' });
    }

    review.team = data.team;
  }

  review.updatedAt = moment.utc().toDate();
  venue.updatedAt = review.updatedAt;
  recalculateVenueScores(venue);

  try {
    await review.save();
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {};

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message;
      });

      return res.status(400).json(validationErrors);
    }

    console.log(`Review ${review.id} failed to be updated at edit-review`);
    return next(err);
  }

  try {
    await venue.save();
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {};

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message;
      });

      return res.status(400).json(validationErrors);
    }

    console.log(`Venue ${venue.id} failed to be updated at edit-review`);
    return next(err);
  }

  return res.status(200).json(review);
};
