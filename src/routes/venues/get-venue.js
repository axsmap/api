const axios = require('axios');
const { isEqual } = require('lodash');

const { Venue } = require('../../models/venue');
const venueReviewSummary = require('../../helpers/venue-review-summary.js');

module.exports = async (req, res, next) => {
  const placeId = req.params.placeId;

  let response;
  try {
    response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/details/json?placeid=${placeId}&key=${
        process.env.PLACES_API_KEY
      }`
    );
  } catch (err) {
    console.log(`Place ${placeId} failed to be found at get-venue.`);
    return next(err);
  }

  const statusResponse = response.data.status;
  if (statusResponse !== 'OK') {
    return res.status(404).json({ general: 'Place not found' });
  }

  const placeData = response.data.result;
  const dataResponse = {};

  const useStreetviewCover = true;
  dataResponse.address = placeData.formatted_address;
  if (useStreetviewCover) {
    dataResponse.coverPhoto = `https://maps.googleapis.com/maps/api/streetview?key=${
      process.env.PLACES_API_KEY
    }&size=800x400&fov=120&location=${dataResponse.address}`;
  } else if (placeData.photos && placeData.photos.length > 0) {
    dataResponse.coverPhoto = `https://maps.googleapis.com/maps/api/place/photo?key=${
      process.env.PLACES_API_KEY
    }&maxwidth=500&photoreference=${placeData.photos[0].photo_reference}`;
  }
  dataResponse.formattedPhone = placeData.formatted_phone_number;
  dataResponse.googleRating = placeData.rating;
  dataResponse.googleUrl = placeData.url;
  dataResponse.internationalPhone = placeData.international_phone_number;
  dataResponse.location = {
    lat: placeData.geometry.location.lat,
    lng: placeData.geometry.location.lng
  };
  dataResponse.name = placeData.name;
  dataResponse.placeId = placeId;
  dataResponse.types = placeData.types;
  dataResponse.website = placeData.website;

  dataResponse.allowsGuideDog = { yes: 0, no: 0 };
  //dataResponse.bathroomReviews = 0;
  //dataResponse.bathroomScore = null;
  //dataResponse.entryReviews = 0;
  //dataResponse.entryScore = null;
  dataResponse.hasParking = { yes: 0, no: 0 };
  dataResponse.hasSecondEntry = { yes: 0, no: 0 };
  dataResponse.hasWellLit = { yes: 0, no: 0 };
  dataResponse.isQuiet = { yes: 0, no: 0 };
  dataResponse.isSpacious = { yes: 0, no: 0 };
  dataResponse.steps = {
    zero: 0,
    one: 0,
    two: 0,
    moreThanTwo: 0
  };

  //new expanded fields
  dataResponse.hasPermanentRamp = { yes: 0, no: 0 };
  dataResponse.hasPortableRamp = { yes: 0, no: 0 };
  dataResponse.hasWideEntrance = { yes: 0, no: 0 };
  dataResponse.hasAccessibleTableHeight = { yes: 0, no: 0 };
  dataResponse.hasAccessibleElevator = { yes: 0, no: 0 };
  dataResponse.hasInteriorRamp = { yes: 0, no: 0 };
  dataResponse.hasSwingOutDoor = { yes: 0, no: 0 };
  dataResponse.hasLargeStall = { yes: 0, no: 0 };
  dataResponse.hasSupportAroundToilet = { yes: 0, no: 0 };
  dataResponse.hasLoweredSinks = { yes: 0, no: 0 };

  dataResponse.entranceScore = 0;
  dataResponse.entranceGlyphs = '';
  dataResponse.interiorScore = 0;
  dataResponse.interiorGlyphs = '';
  dataResponse.restroomScore = 0;
  dataResponse.restroomGlyphs = '';
  dataResponse.mapMarkerScore = 0;

  let venue;
  let venueToSave;
  try {
    [venue, venueToSave] = await Promise.all([
      Venue.aggregate([
        {
          $match: { placeId, isArchived: false }
        },
        {
          $lookup: {
            from: 'reviews',
            let: { reviews: '$reviews' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ['$_id', '$$reviews']
                  }
                }
              },
              {
                $lookup: {
                  from: 'users',
                  let: { user: '$user' },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $eq: ['$_id', '$$user']
                        }
                      }
                    },
                    {
                      $project: {
                        _id: 0,
                        id: '$_id',
                        avatar: 1,
                        firstName: 1,
                        lastName: 1
                      }
                    }
                  ],
                  as: 'user'
                }
              },
              {
                $project: {
                  _id: 0,
                  id: '$_id',
                  //bathroomScore: 1,
                  comments: 1,
                  createdAt: 1,
                  //entryScore: 1,
                  user: 1,
                  voters: 1
                }
              }
            ],
            as: 'reviews'
          }
        },
        {
          $lookup: {
            from: 'photos',
            let: { photos: { $ifNull: ['$photos', []] } },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ['$_id', '$$photos']
                  }
                }
              },
              {
                $project: {
                  _id: 0,
                  id: '$_id',
                  url: 1
                }
              }
            ],
            as: 'photos'
          }
        },
        {
          $project: {
            _id: 0,
            id: '$_id',
            address: 1,
            description: 1,
            allowsGuideDog: 1,
            //bathroomReviews: 1,
            //bathroomScore: 1,
            //entryReviews: 1,
            //entryScore: 1,
            hasParking: 1,
            hasSecondEntry: 1,
            hasWellLit: 1,
            isQuiet: 1,
            isSpacious: 1,
            location: 1,
            name: 1,
            photos: 1,
            placeId: 1,
            steps: 1,
            types: 1,
            reviews: 1,
            hasPermanentRamp: 1,
            hasPortableRamp: 1,
            hasWideEntrance: 1,
            hasAccessibleTableHeight: 1,
            hasAccessibleElevator: 1,
            hasInteriorRamp: 1,
            hasSwingOutDoor: 1,
            hasLargeStall: 1,
            hasSupportAroundToilet: 1,
            hasLoweredSinks: 1
          }
        }
      ]),
      Venue.findOne({ placeId, isArchived: false })
    ]);
  } catch (err) {
    console.log(
      `Venue with placeId ${placeId} failed to be found at get-venue`
    );
    return next(err);
  }

  if (venue && venue[0]) {
    let venueHasUpdates = false;
    if (venueToSave.address !== dataResponse.address) {
      venueToSave.address = dataResponse.address;
      venueHasUpdates = true;
    }
    if (
      venueToSave.location.coordinates[0] !== dataResponse.location.lng ||
      venueToSave.location.coordinates[1] !== dataResponse.location.lat
    ) {
      venueToSave.location.coordinates = [
        dataResponse.location.lng,
        dataResponse.location.lat
      ];
      venueHasUpdates = true;
    }
    if (venueToSave.name !== dataResponse.name) {
      venueToSave.name = dataResponse.name;
      venueHasUpdates = true;
    }
    if (!isEqual(venueToSave.types, dataResponse.types)) {
      venueToSave.types = dataResponse.types;
      venueHasUpdates = true;
    }

    if (venueHasUpdates) {
      try {
        await venueToSave.save();
      } catch (err) {
        console.log(
          `Venue with id ${venueToSave.id} failed to be updated at get-venue.`
        );
        return next(err);
      }
    }

    //TEMP:
    let scoring;
    //calculate entranceScore, glyphs
    console.log('venue0: ', venue[0]);
    scoring = venueReviewSummary.calculateRatingLevel('entrance', venue[0]);
    console.log('entrance score: ', scoring);
    dataResponse.entranceScore = scoring.ratingLevel;
    dataResponse.entranceGlyphs = scoring.ratingGlyphs;

    //calculate interiorScore, glyphs
    scoring = venueReviewSummary.calculateRatingLevel('interior', venue[0]);
    console.log('interior score: ', scoring);
    dataResponse.interiorScore = scoring.ratingLevel;
    dataResponse.interiorGlyphs = scoring.ratingGlyphs;

    //calculate restroomScore, glyphs
    scoring = venueReviewSummary.calculateRatingLevel('restroom', venue[0]);
    console.log('restroom score: ', scoring);
    dataResponse.restroomScore = scoring.ratingLevel;
    dataResponse.restroomGlyphs = scoring.ratingGlyphs;

    dataResponse.mapMarkerScore = venueReviewSummary.calculateMapMarkerScore(
      dataResponse.entranceScore,
      dataResponse.interiorScore,
      dataResponse.restroomScore
    );

    dataResponse.id = venue[0]._id;

    dataResponse.allowsGuideDog = venue[0].allowsGuideDog;
    //dataResponse.bathroomReviews = venue[0].bathroomReviews;
    //dataResponse.bathroomScore = venue[0].bathroomScore;
    //dataResponse.entryReviews = venue[0].entryReviews;
    //dataResponse.entryScore = venue[0].entryScore;
    dataResponse.hasParking = venue[0].hasParking;
    dataResponse.hasSecondEntry = venue[0].hasSecondEntry;
    dataResponse.hasWellLit = venue[0].hasWellLit;
    dataResponse.isQuiet = venue[0].isQuiet;
    dataResponse.isSpacious = venue[0].isSpacious;
    dataResponse.photos = venue[0].photos;
    dataResponse.steps = venue[0].steps;
    //new expanded fields
    dataResponse.hasPermanentRamp = venue[0].hasPermanentRamp;
    dataResponse.hasPortableRamp = venue[0].hasPortableRamp;
    dataResponse.hasWideEntrance = venue[0].hasWideEntrance;
    dataResponse.hasAccessibleTableHeight = venue[0].hasAccessibleTableHeight;
    dataResponse.hasAccessibleElevator = venue[0].hasAccessibleElevator;
    dataResponse.hasInteriorRamp = venue[0].hasInteriorRamp;
    dataResponse.hasSwingOutDoor = venue[0].hasSwingOutDoor;
    dataResponse.hasLargeStall = venue[0].hasLargeStall;
    dataResponse.hasSupportAroundToilet = venue[0].hasSupportAroundToilet;
    dataResponse.hasLoweredSinks = venue[0].hasLoweredSinks;

    dataResponse.reviews = venue[0].reviews;
  }

  return res.status(200).json(dataResponse);
};
