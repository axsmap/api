//const { ReviewLogic } = require('review-icon-logic-2.json');
const reviewLogic = require('./review-icon-logic-2.json');

function assignFromYesNo(venueField) {
  //field may not exist for old data
  //test if properties exist and both are not set to 0
  // At this point, venueField is a JS object, not subject to
  //  Mongoose hasOwnProperty test issues
  if (
    venueField &&
    'yes' in venueField &&
    'no' in venueField &&
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
  let moreThanTwo = 'moreThanTwo' in stepField ? stepField.moreThanTwo : 0;
  let two = 'two' in stepField ? stepField.two : 0;
  let one = 'one' in stepField ? stepField.one : 0;
  let zero = 'zero' in stepField ? stepField.zero : 0;

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

    //console.log('in calculateRatingLevel, raw data: ', venueRawData);
    //console.log('in calculateRatingLevel, select venue data: ', venueData);

    let sectionLogic, ratingDefinition;
    if (sectionName in reviewSummaryLogic) {
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

    for (let rl = 0; rl < ratingLevels.length; rl++) {
      if (
        ratingLevels[rl] in sectionLogic &&
        sectionLogic[ratingLevels[rl]].length > 0
      ) {
        //level loop
        for (let idx = 0; idx < sectionLogic[ratingLevels[rl]].length; idx++) {
          ratingDefinition = sectionLogic[ratingLevels[rl]][idx];
          let ratingDefinitionMatch = false;

          if (
            'field' in ratingDefinition &&
            ratingDefinition.field in venueData
          ) {
            if (
              ('matchValue' in ratingDefinition &&
                venueData[ratingDefinition.field] ===
                  ratingDefinition.matchValue) ||
              ('notMatchValue' in ratingDefinition &&
                venueData[ratingDefinition.field] !==
                  ratingDefinition.notMatchValue)
            ) {
              ratingDefinitionMatch = true;
            }
          } else if ('fields' in ratingDefinition) {
            let fieldMatchCount = 0;
            for (let field of ratingDefinition.fields) {
              if (
                ('matchValue' in ratingDefinition &&
                  venueData[field] === ratingDefinition.matchValue) ||
                ('notMatchValue' in ratingDefinition &&
                  venueData[field] !== ratingDefinition.notMatchValue)
              ) {
                fieldMatchCount++;
              }
            }

            if (fieldMatchCount === ratingDefinition.fields.length) {
              ratingDefinitionMatch = true;
            }
          }

          if (ratingDefinitionMatch === true && 'and' in ratingDefinition) {
            //console.log('Evaluate AND condition in ' + sectionName);
            if (
              'field' in ratingDefinition.and &&
              ratingDefinition.and.field in venueData
            ) {
              //evaluate 'and' condition depending on match or noMatch value
              if ('matchValue' in ratingDefinition.and) {
                ratingDefinitionMatch =
                  venueData[ratingDefinition.and.field] ==
                  ratingDefinition.and.matchValue;
              } else if ('notMatchValue' in ratingDefinition.and) {
                ratingDefinitionMatch =
                  venueData[ratingDefinition.and.field] !==
                  ratingDefinition.and.notMatchValue;
              }
            }
          }

          //not handling "fields" array in the "and" portion

          //set rating level
          if (ratingDefinitionMatch === true) {
            //console.log('Found rule match for ' + sectionName);

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
      //console.log('ratingLevel not set: ', sectionLogic);
      ratingLevel = 0;
      ratingGlyphs =
        'default' in sectionLogic &&
        sectionLogic.default.length > 0 &&
        'showGlyph' in sectionLogic.default[0]
          ? sectionLogic.default[0].showGlyph
          : '';
    }

    return {
      ratingLevel: ratingLevel,
      ratingGlyphs: ratingGlyphs
    };
  }
};
