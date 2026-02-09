/**
 * Script to check mapMarkerScore data integrity
 * 
 * Run with: node -r dotenv/config src/scripts/db/check-mapmarker-scores.js
 * 
 * This script checks if venues have correct mapMarkerScore values
 * based on their entrance, interior, and restroom review data.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { Venue } = require('../../models/venue');
const venueReviewSummary = require('../../helpers/venue-review-summary');

async function checkMapMarkerScores() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find venues that have been reviewed (have some review data)
    const venues = await Venue.find({
      isArchived: false,
      $or: [
        { 'hasPermanentRamp.yes': { $gt: 0 } },
        { 'hasPermanentRamp.no': { $gt: 0 } },
        { 'hasWideEntrance.yes': { $gt: 0 } },
        { 'hasWideEntrance.no': { $gt: 0 } },
        { 'steps.zero': { $gt: 0 } },
        { 'steps.one': { $gt: 0 } },
        { 'steps.two': { $gt: 0 } },
        { 'steps.moreThanTwo': { $gt: 0 } },
      ]
    }).limit(50);

    console.log(`\nFound ${venues.length} reviewed venues to check\n`);
    console.log('='.repeat(100));

    let mismatchCount = 0;
    let accessibleCount = 0;

    for (const venue of venues) {
      // Calculate scores dynamically (as the API does)
      const entranceScoring = venueReviewSummary.calculateRatingLevel('entrance', venue);
      const interiorScoring = venueReviewSummary.calculateRatingLevel('interior', venue);
      const restroomScoring = venueReviewSummary.calculateRatingLevel('restroom', venue);
      
      const calculatedMapMarkerScore = venueReviewSummary.calculateMapMarkerScore(
        entranceScoring.ratingLevel,
        interiorScoring.ratingLevel,
        restroomScoring.ratingLevel
      );

      const storedMapMarkerScore = venue.mapMarkerScore || 0;

      // Check if all scores are 5 (accessible)
      if (entranceScoring.ratingLevel === 5 && 
          interiorScoring.ratingLevel === 5 && 
          restroomScoring.ratingLevel === 5) {
        accessibleCount++;
        console.log(`\n✅ FULLY ACCESSIBLE VENUE: ${venue.name || venue.placeId}`);
        console.log(`   Entrance: ${entranceScoring.ratingLevel}, Interior: ${interiorScoring.ratingLevel}, Restroom: ${restroomScoring.ratingLevel}`);
        console.log(`   Calculated mapMarkerScore: ${calculatedMapMarkerScore} (should be 5 = GREEN)`);
        console.log(`   Stored mapMarkerScore: ${storedMapMarkerScore}`);
      }

      // Check for mismatches between stored and calculated
      if (storedMapMarkerScore !== calculatedMapMarkerScore) {
        mismatchCount++;
        console.log(`\n⚠️  MISMATCH: ${venue.name || venue.placeId}`);
        console.log(`   Entrance: ${entranceScoring.ratingLevel}, Interior: ${interiorScoring.ratingLevel}, Restroom: ${restroomScoring.ratingLevel}`);
        console.log(`   Stored: ${storedMapMarkerScore}, Calculated: ${calculatedMapMarkerScore}`);
      }
    }

    console.log('\n' + '='.repeat(100));
    console.log(`\nSUMMARY:`);
    console.log(`- Total venues checked: ${venues.length}`);
    console.log(`- Fully accessible venues (all scores = 5): ${accessibleCount}`);
    console.log(`- Stored vs Calculated mismatches: ${mismatchCount}`);
    console.log(`\nNOTE: The API calculates mapMarkerScore DYNAMICALLY on each request.`);
    console.log(`The stored value in the database is NOT used for API responses.`);
    console.log(`If the API returns correct mapMarkerScore values, the issue is in the FRONTEND.`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

checkMapMarkerScores();
