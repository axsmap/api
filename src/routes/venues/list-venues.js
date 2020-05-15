const axios = require('axios');
const { find, isEmpty } = require('lodash');
const slugify = require('speakingurl');

const { isNumber } = require('../../helpers');
const { Venue } = require('../../models/venue');

const { validateListVenues } = require('./validations');
const venueReviewSummary = require('../../helpers/venue-review-summary.js');

module.exports = async (req, res, next) => {
  const queryParams = req.query;

  const { errors, isValid } = validateListVenues(queryParams);
  if (!isValid) return res.status(400).json(errors);

  let coordinates = queryParams.location.split(',');

  //Legacy function from two-bar search, geocodes from string address
  if (queryParams.address && !queryParams.page) {
    console.log('in address conditional, ', queryParams);
    queryParams.name = queryParams.address;
    const geocodeParams = `?key=${process.env.PLACES_API_KEY}&address=${slugify(
      queryParams.address
    )}`;

    let geocodeResponse;
    try {
      geocodeResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json${geocodeParams}`
      );
    } catch (err) {
      console.log(
        `Geocode failed to be found at list-venues.\nQuery Params: ${JSON.stringify(
          queryParams
        )}`
      );
      return next(err);
    }

    const statusCode = geocodeResponse.data.status;
    if (statusCode === 'ZERO_RESULTS') {
      return res.status(404).json({ keywords: 'Address not found' });
    } else if (statusCode === 'OVER_QUERY_LIMIT') {
      return next(new Error('Over query limit with Google Places API'));
    } else if (statusCode === 'REQUEST_DENIED') {
      return next(new Error('Request denied with Google Places API'));
    } else if (statusCode === 'INVALID_REQUEST') {
      return next(new Error('Invalid request with Google Places API'));
    } else if (statusCode === 'UNKNOWN_ERROR') {
      return next(new Error('Unknown error with Google Places API'));
    }

    coordinates = [
      geocodeResponse.data.results[0].geometry.location.lat,
      geocodeResponse.data.results[0].geometry.location.lng
    ];
  } //end address geocode

  let venuesFilters = {};

  /*
   * Legacy filter string building function,
   *  has a critical defect condition where if 
   *  no > yes but yes is at least 1, then there
   *  would be a false match.
   */
  if (queryParams.entranceScore) {
    venuesFilters.entranceScore = parseFloat(queryParams.entranceScore);
    //{ $gte: parseFloat(queryParams.entranceScore) };
  }

  if (queryParams.interiorScore) {
    venuesFilters.interiorScore = parseFloat(queryParams.interiorScore);
    //{ $gte: parseFloat(queryParams.interiorScore) };
  }

  if (queryParams.restroomScore) {
    venuesFilters.restroomScore = parseFloat(queryParams.restroomScore);
    //{ $gte: parseFloat(queryParams.restroomScore) };
  }

  if (queryParams.allowsGuideDog) {
    venuesFilters.allowsGuideDog = parseFloat(queryParams.allowsGuideDog);
    /*
    const allowsGuideDog = parseFloat(queryParams.allowsGuideDog) === 1;
    if (allowsGuideDog) {
      venuesFilters['allowsGuideDog.yes'] = { $gte: 1 };
    } else {
      venuesFilters['allowsGuideDog.no'] = { $gte: 1 };
    }*/
  }

  if (queryParams.hasParking) {
    venuesFilters.hasParking = queryParams.hasParking;
    /*
    const hasParking = parseFloat(queryParams.hasParking) === 1;
    if (hasParking) {
      venuesFilters['hasParking.yes'] = { $gte: 1 };
    } else {
      venuesFilters['hasParking.no'] = { $gte: 1 };
    }*/
  }

  /*
   * Not used
   *
  if (queryParams.hasRamp) {
    const hasRamp = parseFloat(queryParams.hasRamp) === 1;
    if (hasRamp) {
      venuesFilters['hasRamp.yes'] = { $gte: 1 };
    } else {
      venuesFilters['hasRamp.no'] = { $gte: 1 };
    }
  }

  if (queryParams.hasSecondEntry) {
    const hasSecondEntry = parseFloat(queryParams.hasSecondEntry) === 1;
    if (hasSecondEntry) {
      venuesFilters['hasSecondEntry.yes'] = { $gte: 1 };
    } else {
      venuesFilters['hasSecondEntry.no'] = { $gte: 1 };
    }
  }

  if (queryParams.hasWellLit) {
    const hasWellLit = parseFloat(queryParams.hasWellLit) === 1;
    if (hasWellLit) {
      venuesFilters['hasWellLit.yes'] = { $gte: 1 };
    } else {
      venuesFilters['hasWellLit.no'] = { $gte: 1 };
    }
  }

  if (queryParams.isQuiet) {
    const isQuiet = parseFloat(queryParams.isQuiet) === 1;
    if (isQuiet) {
      venuesFilters['isQuiet.yes'] = { $gte: 1 };
    } else {
      venuesFilters['isQuiet.no'] = { $gte: 1 };
    }
  }

  if (queryParams.isSpacious) {
    const isSpacious = parseFloat(queryParams.isSpacious) === 1;
    if (isSpacious) {
      venuesFilters['isSpacious.yes'] = { $gte: 1 };
    } else {
      venuesFilters['isSpacious.no'] = { $gte: 1 };
    }
  }

  if (queryParams.steps) {
    if (parseFloat(queryParams.steps) === 0) {
      venuesFilters['steps.zero'] = { $gte: 1 };
    } else if (parseFloat(queryParams.steps) === 1) {
      venuesFilters['steps.one'] = { $gte: 1 };
    } else if (parseFloat(queryParams.steps) === 2) {
      venuesFilters['steps.two'] = { $gte: 1 };
    } else if (parseFloat(queryParams.steps) === 3) {
      venuesFilters['steps.moreThanTwo'] = { $gte: 1 };
    }
  }
  *
  */

  let dataResponse;

  /*
   * Legacy filtering function that searches solely on
   *  AXS Venue data and provides it's own pagination of 20
   *  UPDATED 05/2020 TO SUPPORT FILTER ONLY SELF SEARCH
   */
  if (!isEmpty(venuesFilters) && isEmpty(queryParams.name)) {
    /*
    if (queryParams.name) {
      //performs literal name match against AXS Venue name
      venuesFilters.name = { $regex: queryParams.name, $options: 'i' };
    }
    */

    //reformat venuefilters for Mongo
    if (queryParams.allowsGuideDog) {
      if (venuesFilters.allowsGuideDog === 1) {
        venuesFilters['allowsGuideDog.yes'] = { $gte: 1 };
      } else {
        venuesFilters['allowsGuideDog.no'] = { $gte: 1 };
      }
    }

    if (queryParams.hasParking) {
      if (venuesFilters.hasParking === 1) {
        venuesFilters['hasParking.yes'] = { $gte: 1 };
      } else {
        venuesFilters['hasParking.no'] = { $gte: 1 };
      }
    }
    //reformatted venuefilters for Mono

    venuesFilters.location = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [coordinates[1], coordinates[0]]
        },
        $maxDistance: 50000
      }
    };

    if (queryParams.type) {
      venuesFilters.types = queryParams.type;
    }

    venuesFilters.isArchived = false;

    let page = 1;
    if (isNumber(queryParams.page)) {
      page = queryParams.page;
    }

    const pageLimit = 20;

    if (page > 0) {
      page -= 1;
    } else {
      return res
        .status(400)
        .json({ page: 'Should be equal to or greater than 1' });
    }

    let total;
    let venues;
    try {
      [venues, total] = await Promise.all([
        Venue.find(
          venuesFilters,
          'address allowsGuideDog hasParking hasSecondEntry hasWellLit isQuiet isSpacious location name photos placeId steps types'
        )
          .skip(page * pageLimit)
          .limit(pageLimit),
        Venue.find(venuesFilters).count()
      ]);
    } catch (err) {
      console.log(
        `Venues failed to be found or count at list-venues.\nvenuesQuery: ${JSON.stringify(
          venuesFilters
        )}`
      );
      return next(err);
    }

    venues = venues.map(venue =>
      Object.assign({}, venue.toObject(), {
        id: venue._id,
        _id: undefined,
        location: venue.coordinates
      })
    );

    //+ADDED
    //Perform ratings logic on all returned venues
    venues = venues.filter(venue => {
      //console.log('In scoring assignment');
      let scoring;
      //calculate entranceScore, glyphs
      scoring = venueReviewSummary.calculateRatingLevel('entrance', venue);
      venue.entranceScore = scoring.ratingLevel;
      venue.entranceGlyphs = scoring.ratingGlyphs;

      //calculate interiorScore, glyphs
      scoring = venueReviewSummary.calculateRatingLevel('interior', venue);
      venue.interiorScore = scoring.ratingLevel;
      venue.interiorGlyphs = scoring.ratingGlyphs;

      //calculate restroomScore, glyphs
      scoring = venueReviewSummary.calculateRatingLevel('restroom', venue);
      venue.restroomScore = scoring.ratingLevel;
      venue.restroomGlyphs = scoring.ratingGlyphs;

      venue.mapMarkerScore = venueReviewSummary.calculateMapMarkerScore(
        venue.entranceScore,
        venue.interiorScore,
        venue.restroomScore
      );

      let passesValidation = true;
      if (venuesFilters.hasOwnProperty('entranceScore')) {
        if (
          !venue.entranceScore ||
          venue.entranceScore < venuesFilters.entranceScore
        ) {
          passesValidation = false;
        }
      }

      if (passesValidation && venuesFilters.hasOwnProperty('interiorScore')) {
        if (
          !venue.interiorScore ||
          venue.interiorScore < venuesFilters.interiorScore
        ) {
          passesValidation = false;
        }
      }

      if (passesValidation && venuesFilters.hasOwnProperty('restroomScore')) {
        if (
          !venue.restroomScore ||
          venue.restroomScore < venuesFilters.restroomScore
        ) {
          passesValidation = false;
        }
      }

      if (passesValidation) {
        return venue;
      }
    });

    const lastPage = Math.ceil(total / pageLimit);
    let nextPage;
    if (lastPage > 0) {
      page += 1;
      if (page > lastPage || page > 3) {
        return res.status(400).json({
          page: `Should be equal to or less than ${lastPage > 3 ? 3 : lastPage}`
        });
      }
    }

    dataResponse = {
      nextPage,
      results: venues
    };
  } else {
    /*
    * End legacy filter
    */

    /*
     *  Perform Google search every time to interpret single search bar text
     */
    let nearbyParams = `?key=${process.env.PLACES_API_KEY}`;
    let searchType = queryParams.name ? 'textsearch' : 'nearbysearch';

    if (!queryParams.page) {
      nearbyParams = `${nearbyParams}&location=${coordinates[0]},${
        coordinates[1]
        //}&rankby=distance`;
      }`;

      if (queryParams.name) {
        //nearbyParams = `${nearbyParams}&keyword=${queryParams.name}`;
        nearbyParams = `${nearbyParams}&query=${queryParams.name}&radius=5000`;
      } else {
        //empty search, such as on load
        nearbyParams = `${nearbyParams}&rankby=distance`;
      }

      if (queryParams.type) {
        nearbyParams = `${nearbyParams}&type=${queryParams.type}`;
      } else {
        nearbyParams = `${nearbyParams}&type=establishment`;
      }
    } else {
      nearbyParams = `${nearbyParams}&pagetoken=${queryParams.page}`;
    }

    if (queryParams.rankby) {
      nearbyParams = `${nearbyParams}&rankby=${queryParams.rankby}`;
    }
    if (queryParams.opennow) {
      nearbyParams = `${nearbyParams}&opennow=${queryParams.opennow}`;
    }
    if (queryParams.minprice) {
      nearbyParams = `${nearbyParams}&minprice=${queryParams.minprice}`;
    }
    if (queryParams.maxprice) {
      nearbyParams = `${nearbyParams}&maxprice=${queryParams.maxprice}`;
    }

    let placesResponse;
    try {
      console.log(
        'performing google search: ' +
          `https://maps.googleapis.com/maps/api/place/${searchType}/json${nearbyParams}`
      );
      placesResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/place/${searchType}/json${nearbyParams}`
      );
    } catch (err) {
      console.log(
        `Places failed to be found at list-venues.\nQuery Params: ${JSON.stringify(
          queryParams
        )}`
      );
      return next(err);
    }

    const statusCode = placesResponse.data.status;
    if (statusCode === 'OVER_QUERY_LIMIT') {
      return next(new Error('Over query limit with Google Places API'));
    } else if (statusCode === 'REQUEST_DENIED') {
      return next(new Error('Request denied with Google Places API'));
    } else if (statusCode === 'INVALID_REQUEST') {
      return next(new Error('Invalid request with Google Places API'));
    } else if (statusCode === 'UNKNOWN_ERROR') {
      return next(new Error('Unknown error with Google Places API'));
    }
    //do we need to check for 0?

    if (placesResponse.data.results.length == 1) {
      if (placesResponse.data.results[0].types[0] == 'locality') {
        console.log(
          'Found a city only: ',
          placesResponse.data.results[0].geometry.location
        );
        //TODO: redo search with new coordinates and no query/name or change/add "places in " to the first part of the string
      }
    }

    //Format Google Places results and get array of IDs
    let places = [];
    const placesIds = [];
    placesResponse.data.results.forEach(place => {
      let photo = '';
      if (place.photos) {
        photo = `https://maps.googleapis.com/maps/api/place/photo?key=${
          process.env.PLACES_API_KEY
        }&maxwidth=300&photoreference=${place.photos[0].photo_reference}`;
      }

      places.push({
        //address: place.vicinity,
        address: place.formatted_address,
        location: {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
        },
        name: place.name,
        photo,
        placeId: place.place_id,
        types: place.types
      });
      placesIds.push(place.place_id);
    });

    //Use array of Google Place IDs to find AXS Venues
    let venues;
    try {
      venues = await Venue.find({ placeId: { $in: placesIds } });
    } catch (err) {
      console.log(
        `Venues failed to be found at list-venues.\nPlaces ids: [${placesIds}]`
      );
      return next(err);
    }

    //Perform ratings logic on all returned venues
    venues.forEach(venue => {
      //console.log('In scoring assignment');
      let scoring;
      //calculate entranceScore, glyphs
      scoring = venueReviewSummary.calculateRatingLevel('entrance', venue);
      venue.entranceScore = scoring.ratingLevel;
      venue.entranceGlyphs = scoring.ratingGlyphs;

      //calculate interiorScore, glyphs
      scoring = venueReviewSummary.calculateRatingLevel('interior', venue);
      venue.interiorScore = scoring.ratingLevel;
      venue.interiorGlyphs = scoring.ratingGlyphs;

      //calculate restroomScore, glyphs
      scoring = venueReviewSummary.calculateRatingLevel('restroom', venue);
      venue.restroomScore = scoring.ratingLevel;
      venue.restroomGlyphs = scoring.ratingGlyphs;

      venue.mapMarkerScore = venueReviewSummary.calculateMapMarkerScore(
        venue.entranceScore,
        venue.interiorScore,
        venue.restroomScore
      );
    });

    //Filter out, remove, Google Places that are not AXS Venues
    //  Can't use hasOwnProperty() on mongoose model objects  //
    if (!isEmpty(venuesFilters)) {
      places = places.filter(place => {
        const venue = find(venues, venue => venue.placeId === place.placeId);
        if (venue) {
          //console.log('In verification of filters');
          let passesValidation = true;
          if (
            passesValidation &&
            venuesFilters.hasOwnProperty('allowsGuideDog')
          ) {
            if (
              !venue.allowsGuideDog ||
              venue.allowsGuideDog.yes < venue.allowsGuideDog.no ||
              venue.allowsGuideDog.yes == 0
            ) {
              passesValidation = false;
            }
          }

          if (passesValidation && venuesFilters.hasOwnProperty('hasParking')) {
            if (
              !venue.hasParking ||
              venue.hasParking.yes < venue.hasParking.no ||
              venue.hasParking.yes == 0
            ) {
              passesValidation = false;
            }
          }

          if (
            passesValidation &&
            venuesFilters.hasOwnProperty('entranceScore')
          ) {
            if (
              !venue.entranceScore ||
              venue.entranceScore < venuesFilters.entranceScore
            ) {
              passesValidation = false;
            }
          }

          if (
            passesValidation &&
            venuesFilters.hasOwnProperty('interiorScore')
          ) {
            if (
              !venue.interiorScore ||
              venue.interiorScore < venuesFilters.interiorScore
            ) {
              passesValidation = false;
            }
          }

          if (
            passesValidation &&
            venuesFilters.hasOwnProperty('restroomScore')
          ) {
            if (
              !venue.restroomScore ||
              venue.restroomScore < venuesFilters.restroomScore
            ) {
              passesValidation = false;
            }
          }

          if (passesValidation) {
            return venue;
          }
        }
      });
    } //end filtering Google results

    //
    places = places.map(place => {
      const venue = find(venues, venue => venue.placeId === place.placeId);
      if (venue) {
        return Object.assign({}, place, {
          //new expanded fields
          hasPermanentRamp: venue.hasPermanentRamp,
          hasPortableRamp: venue.hasPortableRamp,
          hasWideEntrance: venue.hasWideEntrance,
          hasAccessibleTableHeight: venue.hasAccessibleTableHeight,
          hasAccessibleElevator: venue.hasAccessibleElevator,
          hasInteriorRamp: venue.hasInteriorRamp,
          hasSwingInDoor: venue.hasSwingInDoor,
          hasSwingOutDoor: venue.hasSwingOutDoor,
          hasLargeStall: venue.hasLargeStall,
          hasSupportAroundToilet: venue.hasSupportAroundToilet,
          hasLoweredSinks: venue.hasLoweredSinks,

          entranceScore: venue.entranceScore,
          entranceGlyphs: venue.entranceGlyphs,
          interiorScore: venue.interiorScore,
          interiorGlyphs: venue.interiorGlyphs,
          restroomScore: venue.restroomScore,
          restroomGlyphs: venue.restroomGlyphs,
          mapMarkerScore: venue.mapMarkerScore,

          //original fields
          allowsGuideDog: venue.allowsGuideDog,
          //_bathroomScore: venue.bathroomScore,
          //_entryScore: venue.entryScore,
          hasParking: venue.hasParking,
          hasSecondEntry: venue.hasSecondEntry,
          hasWellLit: venue.hasWellLit,
          isQuiet: venue.isQuiet,
          isSpacious: venue.isSpacious,
          steps: venue.steps
        });
      }

      //venue not found
      return Object.assign({}, place, {
        //new expanded fields
        hasPermanentRamp: { yes: 0, no: 0 },
        hasPortableRamp: { yes: 0, no: 0 },
        hasWideEntrance: { yes: 0, no: 0 },
        hasAccessibleTableHeight: { yes: 0, no: 0 },
        hasAccessibleElevator: { yes: 0, no: 0 },
        hasInteriorRamp: { yes: 0, no: 0 },
        hasSwingInDoor: { yes: 0, no: 0 },
        hasSwingOutDoor: { yes: 0, no: 0 },
        hasLargeStall: { yes: 0, no: 0 },
        hasSupportAroundToilet: { yes: 0, no: 0 },
        hasLoweredSinks: { yes: 0, no: 0 },
        interiorScore: 0,
        interiorGlyphs: 'interior',
        restroomScore: 0,
        restroomGlyphs: 'restroom',
        entranceScore: 0,
        entranceGlyphs: 'entrylg',
        mapMarkerScore: 0,

        //original fields
        allowsGuideDog: { yes: 0, no: 0 },
        //_bathroomReviews: 0,
        //_bathroomScore: null,
        //_entryReviews: 0,
        //_entryScore: null,
        hasParking: { yes: 0, no: 0 },
        hasSecondEntry: { yes: 0, no: 0 },
        hasWellLit: { yes: 0, no: 0 },
        isQuiet: { yes: 0, no: 0 },
        isSpacious: { yes: 0, no: 0 },
        steps: {
          zero: 0,
          one: 0,
          two: 0,
          moreThanTwo: 0
        }
      });
    });

    dataResponse = {
      nextPage: placesResponse.data.next_page_token,
      results: places
    };
  } //ends legacy filter logic, false conditional

  return res.status(200).json(dataResponse);
};
