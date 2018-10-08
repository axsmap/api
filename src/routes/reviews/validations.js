const { isEmpty } = require('lodash');
const { isInt, isMongoId } = require('validator');

module.exports = {
  validateCreateEditReview(data) {
    const errors = {};

    if (
      typeof data.allowsGuideDog !== 'undefined' &&
      typeof data.allowsGuideDog !== 'boolean'
    ) {
      errors.allowsGuideDog = 'Should be a boolean';
    }

    if (typeof data.bathroomScore !== 'undefined') {
      if (typeof data.bathroomScore !== 'number') {
        errors.bathroomScore = 'Should be a number';
      } else if (data.bathroomScore < 1 || data.bathroomScore > 5) {
        errors.bathroomScore = 'Should be between 1 and 5';
      }
    }

    if (data.comments && typeof data.comments !== 'string') {
      errors.comments = 'Should be a string';
    }

    if (typeof data.entryScore === 'undefined') {
      errors.entryScore = 'Is required';
    } else if (typeof data.entryScore !== 'number') {
      errors.entryScore = 'Should be a number';
    } else if (data.entryScore < 1 || data.entryScore > 5) {
      errors.entryScore = 'Should be between 1 and 5';
    }

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
        errors.bathroomScore = 'Should be between 0 and 3';
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

    if (queryParams.bathroomScore) {
      const limits = queryParams.bathroomScore.split(',');

      if (limits.length !== 2) {
        errors.bathroomScore = 'Should be two integers split by a comma';
      } else if (
        !isInt(limits[0], { min: 1, max: 5 }) ||
        !isInt(limits[1], { min: 1, max: 5 })
      ) {
        errors.bathroomScore = 'Both should be integers between 1 and 5';
      }
    }

    if (queryParams.entryScore) {
      const limits = queryParams.entryScore.split(',');

      if (limits.length !== 2) {
        errors.bathroomScore = 'Should be two integers split by a comma';
      } else if (
        !isInt(limits[0], { min: 1, max: 5 }) ||
        !isInt(limits[1], { min: 1, max: 5 })
      ) {
        errors.bathroomScore = 'Both should be integers between 1 and 5';
      }
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

    return { errors, isValid: isEmpty(errors) };
  }
};
