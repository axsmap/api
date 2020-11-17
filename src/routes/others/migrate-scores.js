const { Venue } = require('../../models/venue');
const { Review } = require('../../models/review');
const { User } = require('../../models/user');

module.exports = async (req, res, next) => {
  const saveChanges = req.query.save && req.query.save === 'true';
  console.log('IN MIGRATE SCORES, SAVING CHANGES: ' + saveChanges);

  let timeStart = new Date(); //process.hrtime();
  let timeBlockEnd;
  let timeTotal;

  let venuesTotalCount;
  try {
    venuesTotalCount = await Venue.countDocuments({
      _isScoreConverted: { $ne: true }
    });
  } catch (err) {
    console.log('Venues unconverted failed to be counted: ', err);
    return res.status(404).json(err);
  }

  if (venuesTotalCount == 0) {
    console.log('NO VENUES UNCONVERTED FOUND TO PROCESS');
  }

  const recordLimit = 100;
  let venuesProcessed = 0;
  let pages = 0;
  while (venuesProcessed < venuesTotalCount) {
    timeBlockStart = new Date();
    let venueChunk;
    try {
      venueChunk = await Venue.find({
        _isScoreConverted: { $ne: true }
      })
        //.skip(pages * recordLimit)
        .limit(recordLimit);
    } catch (error) {
      console.log(
        'Venue Chunk failed to be found at (page: ' +
          pages +
          '), (venuesProcessed: ' +
          venuesProcessed +
          '): ',
        error
      );
      return res.status(404).json(error);
    }

    if (venueChunk.length < 1) {
      console.log('UNEXPECTED AMOUNT OF VENUES UNCONVERTED FOUND');
    }

    for (venue of venueChunk) {
      for (review of venue.reviews) {
        //console.log("reviewID: ", review);

        let dbReview;
        try {
          dbReview = await Review.findById(review);
        } catch (error) {
          console.log(
            'Review failed to be found with ID: ' +
              review +
              ', for Venue Place ID: ' +
              venue.placeId
          );
          console.log(error);
          return res.status(404).json(error);
        }

        if (dbReview && dbReview._isScoreConverted !== true) {
          //console.log("review (before): ", dbReview);
          //console.log("venue (before): ", venue);
          //console.log("entry score: " + dbReview._entryScore + ", bathroomScore: " + dbReview._bathroomScore);

          if (dbReview._entryScore && dbReview._entryScore > 0) {
            switch (dbReview._entryScore) {
              case 5:
                dbReview.steps = 0;
                venue.steps.zero += 1;
                dbReview.hasPermanentRamp = true;
                venue.hasPermanentRamp.yes += 1;
                dbReview.hasWideEntrance = true;
                venue.hasWideEntrance.yes += 1;
                break;
              case 4:
                dbReview.hasWideEntrance = true;
                venue.hasWideEntrance.yes += 1;
              case 3:
                dbReview.hasPortableRamp = true;
                venue.hasPortableRamp.yes += 1;
                break;
              case 2:
                dbReview.steps = 1;
                venue.steps.one += 1;
                break;
              case 1:
                dbReview.steps = 2;
                venue.steps.two += 1;
                break;
            }
          }

          if (dbReview._bathroomScore && dbReview._bathroomScore > 0) {
            switch (dbReview._bathroomScore) {
              case 5:
              case 4:
                dbReview.hasLoweredSinks = true;
                venue.hasLoweredSinks.yes += 1;
                dbReview.hasSupportAroundToilet = true;
                venue.hasSupportAroundToilet.yes += 1;
              case 3:
                dbReview.hasSwingOutDoor = true;
                venue.hasSwingOutDoor.yes += 1;
                dbReview.hasLargeStall = true;
                venue.hasLargeStall.yes += 1;
                break;
              case 2:
              case 1:
                dbReview.hasLoweredSinks = false;
                venue.hasLoweredSinks.no += 1;
                dbReview.hasSupportAroundToilet = false;
                venue.hasSupportAroundToilet.no += 1;
                dbReview.hasSwingOutDoor = false;
                venue.hasSwingOutDoor.no += 1;
                dbReview.hasLargeStall = false;
                venue.hasLargeStall.no += 1;
                break;
            }
          }

          dbReview._isScoreConverted = true; //should be performed after venue save?
          //console.log("review (after): ", dbReview);
          //console.log("venue (after): ", venue);

          if (saveChanges) {
            dbReview.save();
          }

          //tally User review fields count
          let dbUser;
          try {
            dbUser = await User.findById(dbReview.user);
          } catch (error) {
            console.log(
              'User failed to be found with ID: ' +
                dbReview.user +
                ', for Review: ',
              dbReview
            );
            console.log(error);
            return res.status(404).json(error);
          }

          if (dbUser) {
            let reviewedFieldsCount =
              Object.keys(dbReview.toObject()).length - 10;
            dbUser.reviewFieldsAmount = dbUser.reviewFieldsAmount
              ? dbUser.reviewFieldsAmount + reviewedFieldsCount
              : reviewedFieldsCount;

            if (saveChanges) {
              dbUser.save();
            }
          }
        } //end review converstion logic
      } //end reviews for-loop

      venue._isScoreConverted = true;
      if (saveChanges) {
        venue.save();
      }
    } //end venuesChunk for-loop

    pages++;
    venuesProcessed += venueChunk.length;
    timeBlockEnd = new Date() - timeBlockStart;
    timeTotal = new Date() - timeStart;
    let percentComplete = venuesProcessed / venuesTotalCount;
    console.log(
      'Processed ' +
        (percentComplete * 100).toFixed(2) +
        '% (page: ' +
        pages +
        ' of ' +
        venuesTotalCount / 100 +
        '), (venuesProcessed: ' +
        venuesProcessed +
        ' of ' +
        venuesTotalCount +
        '), block processing time: ' +
        timeBlockEnd +
        'ms, total: ' +
        (new Date() - timeStart) / 1000 +
        's, remaining: ' +
        (timeTotal / percentComplete - timeTotal) / 1000 / 60 / 60 +
        'h'
    );
  } //end venues while-loop

  try {
    reviewsTotalCount = await Review.countDocuments({
      _isScoreConverted: { $ne: true }
    });
  } catch (err) {
    console.log('Reviews unconverted failed to be counted, error: ', err);
    return res.status(404).json(err);
  }
  console.log('THERE ARE ' + reviewsTotalCount + ' UNCONVERTED REVIEWS');

  if (reviewsTotalCount > 0) {
    let unconvertedReviews;

    try {
      unconvertedReviews = await Review.find({
        _isScoreConverted: { $ne: true }
      });
    } catch (err) {
      console.log('Reviews unconverted failed to be found, error: ', err);
      return res.status(404).json(err);
    }

    for (unconvertedReview of unconvertedReviews) {
      try {
        matchingVenue = await Venue.find({
          reviews: unconvertedReview.id
        });
      } catch (err) {
        console.log('Reviews unconverted failed to be found, error: ', err);
        return res.status(404).json(err);
      }

      console.log('Review ID: ' + unconvertedReview.id);
      console.log("Review's venue: " + matchingVenue.id);
    }
  }

  console.log('FINISHED PROCESSING ALL RECORDS');
  return res.status(200).json({ message: 'done' });
};

/*
 * db scripts
 *
 * db.reviews.updateMany({}, { $rename: { "entryScore": "_entryScore" } } );
 * db.reviews.updateMany({}, { $rename: { "bathroomScore": "_bathroomScore" } } );
 * db.venues.updateMany({}, { $rename: { "entryScore": "_entryScore" } } );
 * db.venues.updateMany({}, { $rename: { "bathroomScore": "_bathroomScore" } } );
 * db.venues.updateMany({}, { $rename: { "entryReviews": "_entryReviews" } } );
 * db.venues.updateMany({}, { $rename: { "bathroomReviews": "_bathroomReviews" } } );
 *
 */
