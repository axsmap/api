const { Venue } = require('../../models/venue');
const { Review } = require('../../models/review');

module.exports = async (req, res, next) => {
  console.log('In migrate scores');

  let venuesTotalCount;
  try {
    venuesTotalCount = await Venue.countDocuments({
      _isScoreConverted: { $ne: true }
    });
  } catch (err) {
    console.log('Venues failed to be counted: ', err);
    return res.status(404).json(err);
  }

  const recordLimit = 100;
  let venuesProcessed = 0;
  let pages = 0;
  while (venuesProcessed < venuesTotalCount) {
    let venueChunk;
    try {
      venueChunk = await Venue.find({
        _isScoreConverted: { $ne: true }
      })
        .skip(pages * recordLimit)
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

          //dbReview.save();

          //tally User review fields count
          let dbUser;
          try {
            dbUser = await User.findById(review.user);
          } catch (error) {
            console.log(
              'User failed to be found with ID: ' +
                review.user +
                ', for Review: ',
              review
            );
            console.log(error);
            return res.status(404).json(error);
          }

          if (dbUser) {
            var reviewedFieldsCount =
              Object.keys(dbReview.toObject()).length - 10;
            dbUser.reviewFieldsAmount = dbUser.reviewFieldsAmount
              ? dbUser.reviewFieldsAmount + reviewedFieldsCount
              : reviewedFieldsCount;

            //dbUser.save();
          }
        } //end review converstion logic
      } //end reviews for-loop

      venue._isScoreConverted = true;
      //venue.save();
    } //end venuesChunk for-loop

    pages++;
    venuesProcessed += venueChunk.length;
    console.log(
      'Processed ' +
        ((venuesProcessed / venuesTotalCount) * 100).toFixed(2) +
        '% (page: ' +
        pages +
        '), (venuesProcessed: ' +
        venuesProcessed +
        '): '
    );
  } //end venues while-loop

  return res.status(404).json('done');

  try {
    //await venue.save();
  } catch (err) {
    console.log(`Venue ${venue.id} failed to be updated at delete-venue`);
    return next(err);
  }

  return res.status(200).json({ message: 'Success' });
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
