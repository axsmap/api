//const { ReviewLogic } = require('review-icon-logic-2.json');
const reviewLogic = require('./review-icon-logic-2.json');

function assignFromYesNo(venueField) {
  //test if properties exist and both are not set to 0
  if (
    venueField.hasOwnProperty('yes') &&
    venueField.hasOwnProperty('no') &&
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
  let moreThanTwo = stepField.hasOwnProperty('moreThanTwo')
    ? stepField.moreThanTwo
    : 0;
  let two = stepField.hasOwnProperty('two') ? stepField.two : 0;
  let one = stepField.hasOwnProperty('one') ? stepField.one : 0;
  let zero = stepField.hasOwnProperty('zero') ? stepField.zero : 0;

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
    return 3;
  }
}

module.exports = {
  calculateMapMarkerScore(entrance, interior, accessible) {
    //use three scores to calculate the map-marker score
    //@TBD: migrate to review-summary logic file
    if (entrance === 1 || interior === 1 || accessible === 1) {
      return 1;
    } else if (entrance === 3 || interior === 3 || accessible === 3) {
      return 3;
    } else if (entrance === 5 || interior === 5 || accessible === 5) {
      return 5;
    }

    return 0; //default
  },

  calculateRatingLevel(sectionName, venueRawData) {
    //console.log('in calculateRatingLevel', venueRawData);

    let reviewSummaryLogic = reviewLogic.reviewSummaryLogic;

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

    console.log('in calculateRatingLevel, raw data: ', venueRawData);
    console.log('in calculateRatingLevel, select venue data: ', venueData);

    let sectionLogic, ratingDefinition;
    if (reviewSummaryLogic.hasOwnProperty(sectionName)) {
      //valid values: entrance, restroom, interior
      sectionLogic = reviewSummaryLogic[sectionName];
    } else {
      console.log('Error: Logic not found for sectionLogic: ' + sectionName);
      return {
        errors: 'Logic not found for sectionLogic: ' + sectionName
      };
    }

    let ratingLevel, ratingGlyphs;
    const ratingLevels = ['alert', 'caution', 'accessible'];

    for (rl = 0; rl < ratingLevels.length; rl++) {
      if (
        sectionLogic.hasOwnProperty(ratingLevels[rl]) &&
        sectionLogic[ratingLevels[rl]].length > 0
      ) {
        //level loop
        for (idx = 0; idx < sectionLogic[ratingLevels[rl]].length; idx++) {
          ratingDefinition = sectionLogic[ratingLevels[rl]][idx];
          let ratingDefinitionMatch = false;

          if (
            ratingDefinition.hasOwnProperty('field') &&
            venueData.hasOwnProperty(ratingDefinition.field)
          ) {
            if (
              (ratingDefinition.hasOwnProperty('matchValue') &&
                venueData[ratingDefinition.field] ==
                  ratingDefinition.matchValue) ||
              (ratingDefinition.hasOwnProperty('notMatchValue') &&
                venueData[ratingDefinition.field] !==
                  ratingDefinition.notMatchValue)
            ) {
              ratingDefinitionMatch = true;
            }
          } else if (ratingDefinition.hasOwnProperty('fields')) {
            let fieldMatchCount = 0;
            for (field in ratingDefinition.fields) {
              if (
                (ratingDefinition.hasOwnProperty('matchValue') &&
                  venueData[field] == ratingDefinition.matchValue) ||
                (ratingDefinition.hasOwnProperty('notMatchValue') &&
                  venueData[field] !== ratingDefinition.notMatchValue)
              ) {
                fieldMatchCount++;
              }
            }

            if (fieldMatchCount === ratingDefinition.fields.length) {
              ratingDefinitionMatch = true;
            }
          }

          if (
            ratingDefinitionMatch === true &&
            ratingDefinition.hasOwnProperty('and')
          ) {
            console.log('Evaluate AND condition in ' + sectionName);
            if (
              ratingDefinition.and.hasOwnProperty('field') &&
              venueData.hasOwnProperty(ratingDefinition.and.field)
            ) {
              //evaluate 'and' condition depending on match or noMatch value
              if (ratingDefinition.and.hasOwnProperty('matchValue')) {
                ratingDefinitionMatch =
                  venueData[ratingDefinition.and.field] ==
                  ratingDefinition.and.matchValue;
              } else if (ratingDefinition.and.hasOwnProperty('notMatchValue')) {
                ratingDefinitionMatch =
                  venueData[ratingDefinition.and.field] !==
                  ratingDefinition.and.notMatchValue;
              }
            }
          }

          //not handling "fields" array in the "and" portion

          //set rating level
          if (ratingDefinitionMatch === true) {
            console.log('Found rule match for ' + sectionName);

            if (ratingLevels[rl] == 'alert') {
              ratingLevel = 1;
            } else if (ratingLevels[rl] == 'caution') {
              ratingLevel = 3;
            } else if (ratingLevels[rl] == 'accessible') {
              ratingLevel = 5;
            }

            ratingGlyphs = ratingDefinition.showGlyph;
            break; //breaks rating-definition loop for level
          }
        } //rating-definition loop

        if (ratingLevel !== undefined) {
          break;
        }
      } //if-condition test level exists in definition
    } //specific-level loop

    //set defaults
    if (ratingLevel === undefined) {
      console.log('ratingLevel not set: ', sectionLogic);
      ratingLevel = 0;
      ratingGlyphs =
        sectionLogic.hasOwnProperty('default') &&
        sectionLogic.default.length > 0 &&
        sectionLogic.default[0].hasOwnProperty('showGlyph')
          ? sectionLogic.default[0].showGlyph
          : '';
    }

    return {
      ratingLevel: ratingLevel,
      ratingGlyphs: ratingGlyphs
    };
  }
};
