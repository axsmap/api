//const { ReviewLogic } = require('review-icon-logic-2.json');
const reviewLogic = require('./review-icon-logic-2.json');

function assignFromYesNo(venueField) {
  //test if properties exist and both are not set to 0
  if (
    venueField.yes &&
    venueField.no &&
    !(venueField.yes === 0 && venueField.no === 0)
  ) {
    if (venueField.yes >= venueField.no) {
      return 1; //assume yes if non-zeo even split in reviews
    } else {
      return 0; //sets to no
    }
  } else {
    return null; //unknown or empty
  }
}

function assignFromSteps(stepField) {
  var moreThanTwo = stepField.moreThanTwo ? stepField.moreThanTwo : 0;
  var two = stepField.two ? stepField.two : 0;
  var one = stepField.one ? stepField.one : 0;
  var zero = stepField.zero ? stepField.zero : 0;

  if (moreThanTwo === 0 && two === 0 && one === 0 && zero === 0) {
    return null;
  }

  if (zero >= one && zero >= two && zero >= moreThanTwo) {
    return 0;
  } else if (one >= zero && one >= two && one >= moreThanTwo) {
    return 1;
  } else if (two >= zero && two >= one && two >= moreThanTwo) {
    return 2;
  } else if (moreThanTwo >= zero && moreThanTwo >= one && moreThanTwo >= two) {
    return 0;
  }
}

module.exports = {
  calculateRatingLevel(sectionName, venueRawData) {
    console.log('in calculateRatingLevel', venueRawData);

    let reviewSummaryLogic = reviewLogic.reviewSummaryLogic;
    let sectionLogic, ratingDefinition;

    let venueData = {}; // = venueRawData;
    venueData.hasPermanentRamp = assignFromYesNo(venueRawData.hasPermanentRamp);
    venueData.hasPortableRamp = assignFromYesNo(venueRawData.hasPortableRamp);
    venueData.hasWideEntrance = assignFromYesNo(venueRawData.hasWideEntrance);
    venueData.hasAccessibleTableHeight = assignFromYesNo(
      venueRawData.hasAccessibleTableHeight
    );
    venueData.hasAccessibleElevator = assignFromYesNo(
      venueRawData.hasAccessibleElevator
    );
    venueData.hasInteriorRamp = assignFromYesNo(venueRawData.hasInteriorRamp);
    venueData.hasSwingOutDoor = assignFromYesNo(venueRawData.hasSwingOutDoor);
    venueData.hasLargeStall = assignFromYesNo(venueRawData.hasLargeStall);
    venueData.hasSupportAroundToilet = assignFromYesNo(
      venueRawData.hasSupportAroundToilet
    );
    venueData.hasLoweredSinks = assignFromYesNo(venueRawData.hasLoweredSinks);

    venueData.allowsGuideDog = assignFromYesNo(venueRawData.allowsGuideDog);
    venueData.hasParking = assignFromYesNo(venueRawData.hasParking);
    venueData.hasSecondEntry = assignFromYesNo(venueRawData.hasSecondEntry);
    venueData.hasWellLit = assignFromYesNo(venueRawData.hasWellLit);
    venueData.isQuiet = assignFromYesNo(venueRawData.isQuiet);
    venueData.isSpacious = assignFromYesNo(venueRawData.isSpacious);
    venueData.steps = assignFromSteps(venueRawData.steps);

    if (sectionName == 'entrance') {
      sectionLogic = reviewSummaryLogic.entrance;
    } else if (sectionName == 'restroom') {
      sectionLogic = reviewSummaryLogic.restroom;
    } else if (sectionName == 'interior') {
      console.log('interior: ', reviewSummaryLogic);
      sectionLogic = reviewSummaryLogic.interior;
    } else {
      return {
        errors: 'Logic not found for sectionLogic: ' + sectionName
      };
    }

    let ratingLevel,
      ratingGlyphs = null;

    if (sectionLogic.alert && sectionLogic.alert.length > 0) {
      for (idx = 0; idx < sectionLogic.alert.length; idx++) {
        ratingDefinition = sectionLogic.alert[idx];
        ratingDefinitionMatch = false;

        if (ratingDefinition.field && venueData[ratingDefinition.field]) {
          if (
            venueData[ratingDefinition.field] == ratingDefinition.matchValue ||
            (ratingDefinition.notMatchValue &&
              venueData[ratingDefinition.field] !==
                ratingDefinition.notMatchValue)
          ) {
            ratingDefinitionMatch = true;
          }
        } else if (ratingDefinition.fields) {
          let fieldMatchCount = 0;
          for (field in ratingDefinition.fields) {
            if (
              (ratingDefinition.matchValue &&
                venueData[field] == ratingDefinition.matchValue) ||
              (ratingDefinition.notMatchValue &&
                venueData[field] !== ratingDefinition.notMatchValue)
            ) {
              fieldMatchCount++;
            }
          }

          if (fieldMatchCount == ratingDefinition.fields.length) {
            ratingDefinitionMatch = true;
          }
        }

        if (ratingDefinitionMatch === true && ratingDefinition.and) {
          if (
            ratingDefinition.and.field &&
            venueData[ratingDefinition.and.field]
          ) {
            if (
              venueData[ratingDefinition.and.field] ==
                ratingDefinition.and.matchValue ||
              (ratingDefinition.and.notMatchValue &&
                venueData[ratingDefinition.and.field] !==
                  ratingDefinition.notMatchValue)
            ) {
              ratingDefinitionMatch = true;
            }
          }

          //not handling "fields" array in the "and" portion
        }

        if (ratingDefinitionMatch === true) {
          ratingLevel = 1;
          ratingGlyphs = ratingDefinition.showGlyphs;
          break;
        }
      }
    }

    if (
      !ratingLevel &&
      sectionLogic.caution &&
      sectionLogic.caution.length > 0
    ) {
      for (idx = 0; idx < sectionLogic.caution.length; idx++) {}
    }

    if (
      !ratingLevel &&
      sectionLogic.accessible &&
      sectionLogic.accessible.length > 0
    ) {
      for (idx = 0; idx < sectionLogic.accessible.length; idx++) {}
    }

    return {
      ratingLevel: 0,
      ratingGlyphs: ''
    };
  }
};
