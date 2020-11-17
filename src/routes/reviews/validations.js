const { isEmpty } = require('lodash');
const { isInt, isMongoId } = require('validator');

module.exports = {
  validateCreateEditReview(data) {
    const errors = {};

    //
    // new expanded fields
    //
    if (
      typeof data.hasPermanentRamp !== 'undefined' &&
      typeof data.hasPermanentRamp !== 'boolean'
    ) {
      errors.hasPermanentRamp = 'Should be a boolean';
    }

    if (
      typeof data.hasPortableRamp !== 'undefined' &&
      typeof data.hasPortableRamp !== 'boolean'
    ) {
      errors.hasPortableRamp = 'Should be a boolean';
    }

    if (
      typeof data.hasWideEntrance !== 'undefined' &&
      typeof data.hasWideEntrance !== 'boolean'
    ) {
      errors.hasWideEntrance = 'Should be a boolean';
    }

    if (
      typeof data.hasAccessibleTableHeight !== 'undefined' &&
      typeof data.hasAccessibleTableHeight !== 'boolean'
    ) {
      errors.hasAccessibleTableHeight = 'Should be a boolean';
    }

    if (
      typeof data.hasAccessibleElevator !== 'undefined' &&
      typeof data.hasAccessibleElevator !== 'boolean'
    ) {
      errors.hasAccessibleElevator = 'Should be a boolean';
    }

    if (
      typeof data.hasInteriorRamp !== 'undefined' &&
      typeof data.hasInteriorRamp !== 'boolean'
    ) {
      errors.hasInteriorRamp = 'Should be a boolean';
    }

    if (
      typeof data.hasSwingOutDoor !== 'undefined' &&
      typeof data.hasSwingOutDoor !== 'boolean'
    ) {
      errors.hasSwingOutDoor = 'Should be a boolean';
    }

    if (
      typeof data.hasLargeStall !== 'undefined' &&
      typeof data.hasLargeStall !== 'boolean'
    ) {
      errors.hasLargeStall = 'Should be a boolean';
    }

    if (
      typeof data.hasSupportAroundToilet !== 'undefined' &&
      typeof data.hasSupportAroundToilet !== 'boolean'
    ) {
      errors.hasSupportAroundToilet = 'Should be a boolean';
    }

    if (
      typeof data.hasLoweredSinks !== 'undefined' &&
      typeof data.hasLoweredSinks !== 'boolean'
    ) {
      errors.hasLoweredSinks = 'Should be a boolean';
    }

    /*
     *interiorScore
    if (typeof data.interiorScore !== 'undefined') {
      if (typeof data.interiorScore !== 'number') {
        errors.interiorScore = 'Should be a number';
      } else if (data.interiorScore < 1 || data.interiorScore > 7) {
        //Remove required interiorScore
        //errors.interiorScore = 'Should be between 1 and 7';
      }
    }
     */

    //
    //original fields
    //
    if (
      typeof data.allowsGuideDog !== 'undefined' &&
      typeof data.allowsGuideDog !== 'boolean'
    ) {
      errors.allowsGuideDog = 'Should be a boolean';
    }

    /*
     * bathroomScore
    if (typeof data.bathroomScore !== 'undefined') {
      if (typeof data.bathroomScore !== 'number') {
        errors.bathroomScore = 'Should be a number';
      } else if (data.bathroomScore < 1 || data.bathroomScore > 4) {
        //Remove required entryScore
        //errors.bathroomScore = 'Should be between 1 and 4';
      }
    }
     */

    if (data.comments && typeof data.comments !== 'string') {
      errors.comments = 'Should be a string';
    }

    /*
     * entryScore
    if (typeof data.entryScore === 'undefined') {
      //Remove required entryScore
      //errors.entryScore = 'Is required';
    } else if (typeof data.entryScore !== 'number') {
      errors.entryScore = 'Should be a number';
    } else if (data.entryScore < 1 || data.entryScore > 9) {
      //Remove required entryScore
      //errors.entryScore = 'Should be between 1 and 9';
    }
     */

    if (data.event) {
      if (typeof data.event !== 'string') {
        errors.event = 'Should be a string';
      } else if (!isMongoId(data.event)) {
        errors.event = 'Should be a valid id';
      }
    }

    if (
      typeof data.hasParking !== 'undefined' &&
      typeof data.hasParking !== 'boolean'
    ) {
      errors.hasParking = 'Should be a boolean';
    }

    if (
      typeof data.hasSecondEntry !== 'undefined' &&
      typeof data.hasSecondEntry !== 'boolean'
    ) {
      errors.hasSecondEntry = 'Should be a boolean';
    }

    if (
      typeof data.hasWellLit !== 'undefined' &&
      typeof data.hasWellLit !== 'boolean'
    ) {
      errors.hasWellLit = 'Should be a boolean';
    }

    if (
      typeof data.isQuiet !== 'undefined' &&
      typeof data.isQuiet !== 'boolean'
    ) {
      errors.isQuiet = 'Should be a boolean';
    }

    if (
      typeof data.isSpacious !== 'undefined' &&
      typeof data.isSpacious !== 'boolean'
    ) {
      errors.isSpacious = 'Should be a boolean';
    }

    if (typeof data.photo !== 'undefined' && typeof data.photo !== 'string') {
      errors.photo = 'Should be a string';
    }

    if (!data.place) {
      errors.place = 'Is required';
    } else if (typeof data.place !== 'string') {
      errors.place = 'Should be a string';
    }

    if (typeof data.steps !== 'undefined') {
      if (typeof data.steps !== 'number') {
        errors.steps = 'Should be a number';
      } else if (data.steps < 0 || data.steps > 3) {
        errors.steps = 'Should be between 0 and 3';
      }
    }

    if (data.team) {
      if (typeof data.team !== 'string') {
        errors.team = 'Should be a string';
      } else if (!isMongoId(data.team)) {
        errors.team = 'Should be a valid id';
      }
    }

    return { errors, isValid: isEmpty(errors) };
  },
  validateListReviews(queryParams) {
    const errors = {};

    //Remove bathroomScore validation
    if (queryParams.bathroomScore) {
      /*
      const limits = queryParams.bathroomScore.split(',');

      if (limits.length !== 2) {
        errors.bathroomScore = 'Should be two integers split by a comma';
      } else if (
        !isInt(limits[0], { min: 1, max: 4 }) ||
        !isInt(limits[1], { min: 1, max: 4 })
      ) {
        errors.bathroomScore = 'Both should be integers between 1 and 4';
      }
      */
    }

    //Remove entryScore validation
    if (queryParams.entryScore) {
      /*
      const limits = queryParams.entryScore.split(',');

      if (limits.length !== 2) {
        errors.entryScore = 'Should be two integers split by a comma';
      } else if (
        !isInt(limits[0], { min: 1, max: 9 }) ||
        !isInt(limits[1], { min: 1, max: 9 })
      ) {
        errors.entryScore = 'Both should be integers between 1 and 9';
      }
      */
    }

    if (queryParams.event && !isMongoId(queryParams.event)) {
      errors.event = 'Should be a valid Id';
    }

    if (
      queryParams.guideDog &&
      !isInt(queryParams.guideDog, { min: 0, max: 1 })
    ) {
      errors.guideDog = 'Should be an integer between 0 and 1';
    }

    if (
      queryParams.parking &&
      !isInt(queryParams.parking, { min: 0, max: 1 })
    ) {
      errors.parking = 'Should be an integer between 0 and 1';
    }

    if (queryParams.quiet && !isInt(queryParams.quiet, { min: 0, max: 1 })) {
      errors.quiet = 'Should be an integer between 0 and 1';
    }

    if (queryParams.ramp && !isInt(queryParams.ramp, { min: 0, max: 1 })) {
      errors.ramp = 'Should be an integer between 0 and 1';
    }

    if (
      queryParams.secondEntry &&
      !isInt(queryParams.secondEntry, { min: 0, max: 1 })
    ) {
      errors.secondEntry = 'Should be an integer between 0 and 1';
    }

    if (
      queryParams.spacious &&
      !isInt(queryParams.spacious, { min: 0, max: 1 })
    ) {
      errors.spacious = 'Should be an integer between 0 and 1';
    }

    if (queryParams.steps && !isInt(queryParams.steps, { min: 0, max: 3 })) {
      errors.steps = 'Should be an integer between 0 and 3';
    }

    if (queryParams.team && !isMongoId(queryParams.team)) {
      errors.team = 'Should be a valid Id';
    }

    if (queryParams.user && !isMongoId(queryParams.user)) {
      errors.user = 'Should be a valid Id';
    }

    if (queryParams.venue && !isMongoId(queryParams.venue)) {
      errors.venue = 'Should be a valid Id';
    }

    if (
      queryParams.wellLit &&
      !isInt(queryParams.wellLit, { min: 0, max: 1 })
    ) {
      errors.wellLit = 'Should be an integer between 0 and 1';
    }

    //
    // new expanded fields
    //
    if (
      queryParams.hasPermanentRamp &&
      !isInt(queryParams.hasPermanentRamp, { min: 0, max: 1 })
    ) {
      errors.hasPermanentRamp = 'Should be an integer between 0 and 1';
    }

    if (
      queryParams.hasPortableRamp &&
      !isInt(queryParams.hasPortableRamp, { min: 0, max: 1 })
    ) {
      errors.hasPortableRamp = 'Should be an integer between 0 and 1';
    }

    if (
      queryParams.hasWideEntrance &&
      !isInt(queryParams.hasWideEntrance, { min: 0, max: 1 })
    ) {
      errors.hasWideEntrance = 'Should be an integer between 0 and 1';
    }

    if (
      queryParams.hasAccessibleTableHeight &&
      !isInt(queryParams.hasAccessibleTableHeight, { min: 0, max: 1 })
    ) {
      errors.hasAccessibleTableHeight = 'Should be an integer between 0 and 1';
    }

    if (
      queryParams.hasAccessibleElevator &&
      !isInt(queryParams.hasAccessibleElevator, { min: 0, max: 1 })
    ) {
      errors.hasAccessibleElevator = 'Should be an integer between 0 and 1';
    }

    if (
      queryParams.hasInteriorRamp &&
      !isInt(queryParams.hasInteriorRamp, { min: 0, max: 1 })
    ) {
      errors.hasInteriorRamp = 'Should be an integer between 0 and 1';
    }

    if (
      queryParams.hasSwingOutDoor &&
      !isInt(queryParams.hasSwingOutDoor, { min: 0, max: 1 })
    ) {
      errors.hasSwingOutDoor = 'Should be an integer between 0 and 1';
    }

    if (
      queryParams.hasLargeStall &&
      !isInt(queryParams.hasLargeStall, { min: 0, max: 1 })
    ) {
      errors.hasLargeStall = 'Should be an integer between 0 and 1';
    }

    if (
      queryParams.hasSupportAroundToilet &&
      !isInt(queryParams.hasSupportAroundToilet, { min: 0, max: 1 })
    ) {
      errors.hasSupportAroundToilet = 'Should be an integer between 0 and 1';
    }

    if (
      queryParams.hasLoweredSinks &&
      !isInt(queryParams.hasLoweredSinks, { min: 0, max: 1 })
    ) {
      errors.hasLoweredSinks = 'Should be an integer between 0 and 1';
    }

    return { errors, isValid: isEmpty(errors) };
  }
};
