const { isEmpty } = require('lodash');

const { isNumber } = require('../../helpers');
const { placesTypes } = require('../../helpers/constants');

module.exports = {
  validateListVenues(queryParams) {
    const errors = {};

    if (!queryParams.location) {
      errors.location = 'Is required';
    } else {
      const location = queryParams.location.split(',');

      if (location.length !== 2) {
        errors.location = 'Should have two coordinates';
      } else if (!location[0]) {
        errors.location = 'Latitude is required';
      } else if (!isNumber(location[0])) {
        errors.location = 'Latitude should be a number';
      } else if (
        parseFloat(location[0]) < -90 ||
        parseFloat(location[0]) > 90
      ) {
        errors.location = 'Latitude value out of bounds';
      } else if (!location[1]) {
        errors.location = 'Longitude is required';
      } else if (!isNumber(location[1])) {
        errors.location = 'Longitude should be a number';
      } else if (
        parseFloat(location[1]) < -180 ||
        parseFloat(location[1]) > 180
      ) {
        errors.location = 'Longitude value out of bounds';
      }
    }

    if (queryParams.bathroomScore) {
      if (!isNumber(queryParams.bathroomScore)) {
        errors.bathroomScore = 'Should be a number';
      } else if (
        parseFloat(queryParams.bathroomScore) < 1 ||
        parseFloat(queryParams.bathroomScore) > 5
      ) {
        errors.bathroomScore = 'Should be between 1 and 5';
      }
    }

    if (queryParams.entryScore) {
      if (!isNumber(queryParams.entryScore)) {
        errors.entryScore = 'Should be a number';
      } else if (
        parseFloat(queryParams.entryScore) < 1 ||
        parseFloat(queryParams.entryScore) > 5
      ) {
        errors.entryScore = 'Should be between 1 and 5';
      }
    }

    if (queryParams.allowsGuideDog) {
      if (!isNumber(queryParams.allowsGuideDog)) {
        errors.allowsGuideDog = 'Should be a number';
      } else if (
        parseFloat(queryParams.allowsGuideDog) !== 0 &&
        parseFloat(queryParams.allowsGuideDog) !== 1
      ) {
        errors.allowsGuideDog = 'Should be 0 or 1';
      }
    }

    if (queryParams.hasParking) {
      if (!isNumber(queryParams.hasParking)) {
        errors.hasParking = 'Should be a number';
      } else if (
        parseFloat(queryParams.hasParking) !== 0 &&
        parseFloat(queryParams.hasParking) !== 1
      ) {
        errors.hasParking = 'Should be 0 or 1';
      }
    }

    if (queryParams.hasRamp) {
      if (!isNumber(queryParams.hasRamp)) {
        errors.hasRamp = 'Should be a number';
      } else if (
        parseFloat(queryParams.hasRamp) !== 0 &&
        parseFloat(queryParams.hasRamp) !== 1
      ) {
        errors.hasRamp = 'Should be 0 or 1';
      }
    }

    if (queryParams.hasSecondEntry) {
      if (!isNumber(queryParams.hasSecondEntry)) {
        errors.hasSecondEntry = 'Should be a number';
      } else if (
        parseFloat(queryParams.hasSecondEntry) !== 0 &&
        parseFloat(queryParams.hasSecondEntry) !== 1
      ) {
        errors.hasSecondEntry = 'Should be 0 or 1';
      }
    }

    if (queryParams.hasWellLit) {
      if (!isNumber(queryParams.hasWellLit)) {
        errors.hasWellLit = 'Should be a number';
      } else if (
        parseFloat(queryParams.hasWellLit) !== 0 &&
        parseFloat(queryParams.hasWellLit) !== 1
      ) {
        errors.hasWellLit = 'Should be 0 or 1';
      }
    }

    if (queryParams.isQuiet) {
      if (!isNumber(queryParams.isQuiet)) {
        errors.isQuiet = 'Should be a number';
      } else if (
        parseFloat(queryParams.isQuiet) !== 0 &&
        parseFloat(queryParams.isQuiet) !== 1
      ) {
        errors.isQuiet = 'Should be 0 or 1';
      }
    }

    if (queryParams.isSpacious) {
      if (!isNumber(queryParams.isSpacious)) {
        errors.isSpacious = 'Should be a number';
      } else if (
        parseFloat(queryParams.isSpacious) !== 0 &&
        parseFloat(queryParams.isSpacious) !== 1
      ) {
        errors.isSpacious = 'Should be 0 or 1';
      }
    }

    if (queryParams.steps) {
      if (!isNumber(queryParams.steps)) {
        errors.steps = 'Should be a number';
      } else if (
        parseFloat(queryParams.steps) < 0 ||
        parseFloat(queryParams.steps) > 3
      ) {
        errors.steps = 'Should be between 0 and 3';
      }
    }

    if (queryParams.type && !placesTypes.includes(queryParams.type)) {
      errors.type = 'Should be a valid type';
    }

    return { errors, isValid: isEmpty(errors) };
  }
};
