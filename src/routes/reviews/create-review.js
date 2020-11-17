const axios = require('axios');
const moment = require('moment');

const { Event } = require('../../models/event');
const { Photo } = require('../../models/photo');
const { Review } = require('../../models/review');
const { Team } = require('../../models/team');
const { Venue } = require('../../models/venue');

const { validateCreateEditReview } = require('./validations');
const venueReviewSummary = require('../../helpers/venue-review-summary.js');

module.exports = async (req, res, next) => {
  console.log('body: ', req.body);
  const { errors, isValid } = validateCreateEditReview(req.body);
  if (!isValid) return res.status(400).json(errors);

  const data = {
    //new expanded fields
    hasPermanentRamp: req.body.hasPermanentRamp,
    hasPortableRamp: req.body.hasPortableRamp,
    hasWideEntrance: req.body.hasWideEntrance,
    hasAccessibleTableHeight: req.body.hasAccessibleTableHeight,
    hasAccessibleElevator: req.body.hasAccessibleElevator,
    hasInteriorRamp: req.body.hasInteriorRamp,
    hasSwingOutDoor: req.body.hasSwingOutDoor,
    hasLargeStall: req.body.hasLargeStall,
    hasSupportAroundToilet: req.body.hasSupportAroundToilet,
    hasLoweredSinks: req.body.hasLoweredSinks,
    interiorScore: req.body.interiorScore,
    _isScoreConverted: true,

    //original fields
    allowsGuideDog: req.body.allowsGuideDog,
    //bathroomScore: req.body.bathroomScore,
    comments: req.body.comments,
    //entryScore: req.body.entryScore,
    event: req.body.event,
    hasParking: req.body.hasParking,
    hasSecondEntry: req.body.hasSecondEntry,
    hasWellLit: req.body.hasWellLit,
    isQuiet: req.body.isQuiet,
    isSpacious: req.body.isSpacious,
    steps: req.body.steps,
    team: req.body.team,
    user: req.user.id
  };

  let event;
  if (data.event) {
    try {
      event = await Event.findOne({ _id: data.event, isArchived: false });
    } catch (err) {
      console.log(`Event ${data.event} failed to be found at create-review`);
      return next(err);
    }

    if (!event) {
      return res.status(404).json({ event: 'Event not found' });
    }

    if (
      !event.participants.find(p => p.toString() === data.user) &&
      !event.managers.find(m => m.toString() === data.user)
    ) {
      return res
        .status(400)
        .json({ event: 'You are not a participant of this event' });
    }

    const startDate = moment(event.startDate).utc();
    const endDate = moment(event.endDate).utc();
    const today = moment()
      .startOf('day')
      .utc();
    if (startDate.isAfter(today)) {
      return res.status(400).json({ event: 'Event has not started yet' });
    } else if (endDate.isBefore(today)) {
      return res.status(400).json({ event: 'Event has already finished' });
    }
  }

  let team;
  if (data.team) {
    try {
      team = await Team.findOne({ _id: data.team, isArchived: false });
    } catch (err) {
      console.log(`Team ${data.team} failed to be found at create-review`);
      return next(err);
    }

    if (!team) {
      return res.status(404).json({ team: 'Team not found' });
    }

    if (
      !team.members.find(m => m.toString() === data.user) &&
      !team.managers.find(m => m.toString() === data.user)
    ) {
      return res
        .status(400)
        .json({ team: 'You are not a member of this team' });
    }
  }

  const placeId = req.body.place;
  let venue;
  try {
    venue = await Venue.findOne({ placeId });
  } catch (err) {
    console.log(
      `Venue with placeId ${placeId} failed to be found at create-review`
    );
    return next(err);
  }

  if (!venue) {
    let response;
    try {
      response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/details/json?placeid=${placeId}&key=${
          process.env.PLACES_API_KEY
        }`
      );
    } catch (err) {
      console.log(
        `Place ${placeId} failed to be found at create-review, after Google search`
      );
      return next(err);
    }

    const statusResponse = response.data.status;
    if (statusResponse !== 'OK') {
      return res.status(404).json({ general: 'Place not found' });
    }

    const placeData = response.data.result;
    const venueData = {
      address: placeData.formatted_address,
      location: {
        coordinates: [
          placeData.geometry.location.lng,
          placeData.geometry.location.lat
        ]
      },
      name: placeData.name,
      placeId,
      types: placeData.types
    };

    try {
      venue = await Venue.create(venueData);
    } catch (err) {
      console.log(
        `Venue failed to be created at create-review.\nData: ${JSON.stringify(
          venueData
        )}`
      );
      return next(err);
    }
  }
  data.venue = venue.id;

  let review;
  try {
    review = await Review.create(data);
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {};

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message;
      });

      return res.status(400).json(validationErrors);
    }

    console.log(
      `Review failed to be created at create-review.\nData: ${JSON.stringify(
        data
      )}`
    );
    return next(err);
  }

  // Sample review Obj
  /*
      _isScoreConverted: false,
      isBanned: false,
      voters: [],
      _id: 5e853db2587b2740c501f12e,
      hasAccessibleElevator: true,
      hasInteriorRamp: true,
      hasSwingOutDoor: false,
      hasLargeStall: false,
      user: 5e14e8584701fb22ade354e9,
      venue: 5e3da8d56d958200424ffdfe,
      complaints: [],
      createdAt: 2020-04-02T01:19:46.508Z,
      updatedAt: 2020-04-02T01:19:46.508Z,
      __v: 0
  */

  //subtracts out the 10 standard fields to determine
  var reviewedFieldsCount = Object.keys(review.toObject()).length - 10;
  req.user.reviewFieldsAmount =
    req.user.reviewFieldsAmount + reviewedFieldsCount;
  req.user.reviewsAmount = req.user.reviewsAmount + 1;
  req.user.updatedAt = moment.utc().toDate();

  try {
    await req.user.save();
  } catch (err) {
    console.log(
      `User ${
        req.user.id
      } failed to be updated at create-review, after updated review count`
    );
    return next(err);
  }

  if (event) {
    event.reviewsAmount = event.reviewsAmount + 1;
    event.updatedAt = moment.utc().toDate();
    try {
      await event.save();
    } catch (err) {
      console.log(
        `Event ${event.id} failed to be updated at create-review, after event`
      );
      return next(err);
    }
  }

  if (req.body.photo) {
    let photo;
    try {
      photo = await Photo.findOne({ url: req.body.photo });
    } catch (err) {
      console.log(
        `Photo ${req.body.photo} failed to be found at create-review`
      );
      return next(err);
    }

    if (!photo) {
      return res.status(404).json({ photo: 'Not found' });
    }

    venue.photos = [...venue.photos, photo.id];

    try {
      await venue.save();
    } catch (err) {
      console.log(
        `Venue ${venue.id} failed to be updated at create-review, after photos`
      );
      return next(err);
    }
  }

  if (team) {
    team.reviewsAmount = team.reviewsAmount + 1;
    team.updatedAt = moment.utc().toDate();
    try {
      await team.save();
    } catch (err) {
      console.log(
        `Team ${team.id} failed to be updated at create-review, after team`
      );
      return next(err);
    }
  }

  //
  //new expanded fields
  //
  if (typeof review.hasPermanentRamp !== 'undefined') {
    venue.hasPermanentRamp = {
      yes: review.hasPermanentRamp
        ? venue.hasPermanentRamp.yes + 1
        : venue.hasPermanentRamp.yes,
      no: review.hasPermanentRamp
        ? venue.hasPermanentRamp.no
        : venue.hasPermanentRamp.no + 1
    };
  }

  if (typeof review.hasPortableRamp !== 'undefined') {
    venue.hasPortableRamp = {
      yes: review.hasPortableRamp
        ? venue.hasPortableRamp.yes + 1
        : venue.hasPortableRamp.yes,
      no: review.hasPortableRamp
        ? venue.hasPortableRamp.no
        : venue.hasPortableRamp.no + 1
    };
  }

  if (typeof review.hasWideEntrance !== 'undefined') {
    venue.hasWideEntrance = {
      yes: review.hasWideEntrance
        ? venue.hasWideEntrance.yes + 1
        : venue.hasWideEntrance.yes,
      no: review.hasWideEntrance
        ? venue.hasWideEntrance.no
        : venue.hasWideEntrance.no + 1
    };
  }

  if (typeof review.hasAccessibleTableHeight !== 'undefined') {
    venue.hasAccessibleTableHeight = {
      yes: review.hasAccessibleTableHeight
        ? venue.hasAccessibleTableHeight.yes + 1
        : venue.hasAccessibleTableHeight.yes,
      no: review.hasAccessibleTableHeight
        ? venue.hasAccessibleTableHeight.no
        : venue.hasAccessibleTableHeight.no + 1
    };
  }

  if (typeof review.hasAccessibleElevator !== 'undefined') {
    venue.hasAccessibleElevator = {
      yes: review.hasAccessibleElevator
        ? venue.hasAccessibleElevator.yes + 1
        : venue.hasAccessibleElevator.yes,
      no: review.hasAccessibleElevator
        ? venue.hasAccessibleElevator.no
        : venue.hasAccessibleElevator.no + 1
    };
  }

  if (typeof review.hasInteriorRamp !== 'undefined') {
    venue.hasInteriorRamp = {
      yes: review.hasInteriorRamp
        ? venue.hasInteriorRamp.yes + 1
        : venue.hasInteriorRamp.yes,
      no: review.hasInteriorRamp
        ? venue.hasInteriorRamp.no
        : venue.hasInteriorRamp.no + 1
    };
  }

  if (typeof review.hasSwingOutDoor !== 'undefined') {
    venue.hasSwingOutDoor = {
      yes: review.hasSwingOutDoor
        ? venue.hasSwingOutDoor.yes + 1
        : venue.hasSwingOutDoor.yes,
      no: review.hasSwingOutDoor
        ? venue.hasSwingOutDoor.no
        : venue.hasSwingOutDoor.no + 1
    };
  }

  if (typeof review.hasLargeStall !== 'undefined') {
    venue.hasLargeStall = {
      yes: review.hasLargeStall
        ? venue.hasLargeStall.yes + 1
        : venue.hasLargeStall.yes,
      no: review.hasLargeStall
        ? venue.hasLargeStall.no
        : venue.hasLargeStall.no + 1
    };
  }

  if (typeof review.hasSupportAroundToilet !== 'undefined') {
    venue.hasSupportAroundToilet = {
      yes: review.hasSupportAroundToilet
        ? venue.hasSupportAroundToilet.yes + 1
        : venue.hasSupportAroundToilet.yes,
      no: review.hasSupportAroundToilet
        ? venue.hasSupportAroundToilet.no
        : venue.hasSupportAroundToilet.no + 1
    };
  }

  if (typeof review.hasLoweredSinks !== 'undefined') {
    venue.hasLoweredSinks = {
      yes: review.hasLoweredSinks
        ? venue.hasLoweredSinks.yes + 1
        : venue.hasLoweredSinks.yes,
      no: review.hasLoweredSinks
        ? venue.hasLoweredSinks.no
        : venue.hasLoweredSinks.no + 1
    };
  }

  //
  //original fields
  //
  if (typeof review.allowsGuideDog !== 'undefined') {
    venue.allowsGuideDog = {
      yes: review.allowsGuideDog
        ? venue.allowsGuideDog.yes + 1
        : venue.allowsGuideDog.yes,
      no: review.allowsGuideDog
        ? venue.allowsGuideDog.no
        : venue.allowsGuideDog.no + 1
    };
  }

  /*
  if (typeof review.bathroomScore !== 'undefined') {
    if (venue.bathroomReviews > 0) {
      venue.bathroomScore =
        (venue.bathroomScore * venue.bathroomReviews + review.bathroomScore) /
        (venue.bathroomReviews + 1);
      venue.bathroomReviews += 1;
    } else {
      venue.bathroomScore = review.bathroomScore;
      venue.bathroomReviews = 1;
    }
  }

  if (venue.entryReviews > 0) {
    venue.entryScore =
      (venue.entryScore * venue.entryReviews + review.entryScore) /
      (venue.entryReviews + 1);
    venue.entryReviews += 1;
  } else {
    venue.entryScore = review.entryScore;
    venue.entryReviews = 1;
  }
  */

  if (typeof review.hasParking !== 'undefined') {
    venue.hasParking = {
      yes: review.hasParking ? venue.hasParking.yes + 1 : venue.hasParking.yes,
      no: review.hasParking ? venue.hasParking.no : venue.hasParking.no + 1
    };
  }

  if (typeof review.hasSecondEntry !== 'undefined') {
    venue.hasSecondEntry = {
      yes: review.hasSecondEntry
        ? venue.hasSecondEntry.yes + 1
        : venue.hasSecondEntry.yes,
      no: review.hasSecondEntry
        ? venue.hasSecondEntry.no
        : venue.hasSecondEntry.no + 1
    };
  }

  if (typeof review.hasWellLit !== 'undefined') {
    venue.hasWellLit = {
      yes: review.hasWellLit ? venue.hasWellLit.yes + 1 : venue.hasWellLit.yes,
      no: review.hasWellLit ? venue.hasWellLit.no : venue.hasWellLit.no + 1
    };
  }

  if (typeof review.isQuiet !== 'undefined') {
    venue.isQuiet = {
      yes: review.isQuiet ? venue.isQuiet.yes + 1 : venue.isQuiet.yes,
      no: review.isQuiet ? venue.isQuiet.no : venue.isQuiet.no + 1
    };
  }

  if (typeof review.isSpacious !== 'undefined') {
    venue.isSpacious = {
      yes: review.isSpacious ? venue.isSpacious.yes + 1 : venue.isSpacious.yes,
      no: review.isSpacious ? venue.isSpacious.no : venue.isSpacious.no + 1
    };
  }

  venue.reviews = [...venue.reviews, review.id];

  if (typeof review.steps !== 'undefined') {
    venue.steps = {
      zero: review.steps === 0 ? venue.steps.zero + 1 : venue.steps.zero,
      one: review.steps === 1 ? venue.steps.one + 1 : venue.steps.one,
      two: review.steps === 2 ? venue.steps.two + 1 : venue.steps.two,
      moreThanTwo:
        review.steps === 3
          ? venue.steps.moreThanTwo + 1
          : venue.steps.moreThanTwo
    };
  }

  let scoring;
  //calculate entranceScore, glyphs
  scoring = venueReviewSummary.calculateRatingLevel('entrance', venue);
  //console.log('entrance score: ', scoring);
  venue.entranceScore = scoring.ratingLevel;
  venue.entranceGlyphs = scoring.ratingGlyphs;

  //calculate interiorScore, glyphs
  scoring = venueReviewSummary.calculateRatingLevel('interior', venue);
  //console.log('interior score: ', scoring);
  venue.interiorScore = scoring.ratingLevel;
  venue.interiorGlyphs = scoring.ratingGlyphs;

  //calculate restroomScore, glyphs
  scoring = venueReviewSummary.calculateRatingLevel('restroom', venue);
  //console.log('restroom score: ', scoring);
  venue.restroomScore = scoring.ratingLevel;
  venue.restroomGlyphs = scoring.ratingGlyphs;

  venue.mapMarkerScore = venueReviewSummary.calculateMapMarkerScore(
    venue.entranceScore,
    venue.interiorScore,
    venue.restroomScore
  );

  //console.log('venue: ', venue);

  try {
    await venue.save();
  } catch (err) {
    console.log(
      `Venue ${venue.id} failed to be updated at create-review, at final step`
    );
    return next(err);
  }

  const dataResponse = {
    //new expanded fields
    hasPermanentRamp: review.hasPermanentRamp,
    hasPortableRamp: req.body.hasPortableRamp,
    hasWideEntrance: review.hasWideEntrance,
    hasAccessibleTableHeight: review.hasAccessibleTableHeight,
    hasAccessibleElevator: review.hasAccessibleElevator,
    hasInteriorRamp: review.hasInteriorRamp,
    hasSwingOutDoor: review.hasSwingOutDoor,
    hasLargeStall: review.hasLargeStall,
    hasSupportAroundToilet: review.hasSupportAroundToilet,
    hasLoweredSinks: review.hasLoweredSinks,

    /*
    entranceScore: review.entranceScore,
    entranceGlyph: review.entryGlyph,
    interiorScore: review.interiorScore,
    interiorGlyph: review.interiorGlyph,
    restroomScore: review.restroomScore,
    restroomGlyph: review.restroomGlyph,
    */

    //original fields
    id: review.id,
    allowsGuideDog: review.allowsGuideDog,
    //bathroomScore: review.bathroomScore,
    comments: review.comments,
    //entryScore: review.entryScore,
    event: review.event,
    hasParking: review.hasParking,
    hasSecondEntry: review.hasSecondEntry,
    hasWellLit: review.hasWellLit,
    isQuiet: review.isQuiet,
    isSpacious: review.isSpacious,
    steps: review.steps,
    team: review.team,
    user: review.user,
    userReviewFieldsAmount: req.user.reviewFieldsAmount,
    userReviewsAmount: req.user.reviewsAmount,
    venue: review.venue
  };
  return res.status(201).json(dataResponse);
};
