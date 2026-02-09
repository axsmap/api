/**
 * Minnesota Mapping Stats Report for 2025
 * Generates comprehensive stats for funder report
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Minnesota bounding box (approximate)
const MN_BOUNDS = {
  latMin: 43.5,
  latMax: 49.5,
  lonMin: -97.5,
  lonMax: -89.0
};

const YEAR_START = new Date('2025-01-01T00:00:00.000Z');
const YEAR_END = new Date('2026-01-01T00:00:00.000Z');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://prodAPI:jY8kCd0fRCQlzdBp@cluster0.46u4o.mongodb.net/axs-map?retryWrites=true&w=majority&appName=Cluster0';

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!\n');

  const db = mongoose.connection.db;
  const venues = db.collection('venues');
  const reviews = db.collection('reviews');
  const events = db.collection('events');
  const users = db.collection('users');

  const mnFilter = {
    isArchived: false,
    'location.coordinates.1': { $gte: MN_BOUNDS.latMin, $lte: MN_BOUNDS.latMax },
    'location.coordinates.0': { $gte: MN_BOUNDS.lonMin, $lte: MN_BOUNDS.lonMax }
  };

  const results = {};

  // ============================================
  // 1. VENUE STATS
  // ============================================
  console.log('=== VENUE STATS ===');
  
  // Total MN venues (all time)
  const totalMNVenues = await venues.countDocuments(mnFilter);
  console.log(`Total MN Venues (all time): ${totalMNVenues}`);
  results.totalMNVenues = totalMNVenues;

  // New venues added in 2025
  const newVenues2025 = await venues.countDocuments({
    ...mnFilter,
    createdAt: { $gte: YEAR_START, $lt: YEAR_END }
  });
  console.log(`New MN Venues in 2025: ${newVenues2025}`);
  results.newVenues2025 = newVenues2025;

  // Monthly breakdown of new venues
  const venuesByMonth = await venues.aggregate([
    { $match: { ...mnFilter, createdAt: { $gte: YEAR_START, $lt: YEAR_END } } },
    { $group: {
      _id: { month: { $month: '$createdAt' } },
      count: { $sum: 1 }
    }},
    { $sort: { '_id.month': 1 } }
  ]).toArray();
  
  console.log('\nNew Venues by Month (2025):');
  const venueMonthlyData = [];
  for (let m = 1; m <= 12; m++) {
    const found = venuesByMonth.find(v => v._id.month === m);
    const count = found ? found.count : 0;
    const monthName = new Date(2025, m - 1, 1).toLocaleString('en-US', { month: 'long' });
    console.log(`  ${monthName}: ${count}`);
    venueMonthlyData.push({ month: monthName, count });
  }
  results.venuesByMonth = venueMonthlyData;

  // ============================================
  // 2. REVIEW STATS
  // ============================================
  console.log('\n=== REVIEW STATS ===');

  // Get all MN venue IDs first
  const mnVenueIds = await venues.find(mnFilter, { projection: { _id: 1 } }).toArray();
  const mnVenueIdSet = mnVenueIds.map(v => v._id);

  // Total reviews for MN venues (all time)
  const totalMNReviews = await reviews.countDocuments({
    venue: { $in: mnVenueIdSet }
  });
  console.log(`Total Reviews for MN Venues (all time): ${totalMNReviews}`);
  results.totalMNReviews = totalMNReviews;

  // Reviews created in 2025 for MN venues
  const reviews2025 = await reviews.countDocuments({
    venue: { $in: mnVenueIdSet },
    createdAt: { $gte: YEAR_START, $lt: YEAR_END }
  });
  console.log(`Reviews for MN Venues in 2025: ${reviews2025}`);
  results.reviews2025 = reviews2025;

  // Monthly breakdown of reviews
  const reviewsByMonth = await reviews.aggregate([
    { $match: { 
      venue: { $in: mnVenueIdSet },
      createdAt: { $gte: YEAR_START, $lt: YEAR_END }
    }},
    { $group: {
      _id: { month: { $month: '$createdAt' } },
      count: { $sum: 1 }
    }},
    { $sort: { '_id.month': 1 } }
  ]).toArray();

  console.log('\nReviews by Month (2025):');
  const reviewMonthlyData = [];
  for (let m = 1; m <= 12; m++) {
    const found = reviewsByMonth.find(r => r._id.month === m);
    const count = found ? found.count : 0;
    const monthName = new Date(2025, m - 1, 1).toLocaleString('en-US', { month: 'long' });
    console.log(`  ${monthName}: ${count}`);
    reviewMonthlyData.push({ month: monthName, count });
  }
  results.reviewsByMonth = reviewMonthlyData;

  // ============================================
  // 3. MAPATHON/EVENT STATS
  // ============================================
  console.log('\n=== MAPATHON/EVENT STATS ===');

  // Events with MN in address or within MN bounds
  const mnEventFilter = {
    isArchived: false,
    $or: [
      { address: { $regex: /,?\s*MN(,|\s|$)/i } },
      { address: { $regex: /minnesota/i } },
      {
        'location.coordinates.1': { $gte: MN_BOUNDS.latMin, $lte: MN_BOUNDS.latMax },
        'location.coordinates.0': { $gte: MN_BOUNDS.lonMin, $lte: MN_BOUNDS.lonMax }
      }
    ]
  };

  // Total MN events (all time)
  const totalMNEvents = await events.countDocuments(mnEventFilter);
  console.log(`Total MN Mapathons/Events (all time): ${totalMNEvents}`);
  results.totalMNEvents = totalMNEvents;

  // Events created in 2025
  const events2025 = await events.countDocuments({
    ...mnEventFilter,
    createdAt: { $gte: YEAR_START, $lt: YEAR_END }
  });
  console.log(`New MN Mapathons/Events in 2025: ${events2025}`);
  results.events2025 = events2025;

  // Events that occurred in 2025 (by startDate)
  const eventsOccurred2025 = await events.countDocuments({
    ...mnEventFilter,
    startDate: { $gte: YEAR_START, $lt: YEAR_END }
  });
  console.log(`MN Mapathons/Events held in 2025: ${eventsOccurred2025}`);
  results.eventsOccurred2025 = eventsOccurred2025;

  // Monthly breakdown of events held
  const eventsByMonth = await events.aggregate([
    { $match: { ...mnEventFilter, startDate: { $gte: YEAR_START, $lt: YEAR_END } } },
    { $group: {
      _id: { month: { $month: '$startDate' } },
      count: { $sum: 1 }
    }},
    { $sort: { '_id.month': 1 } }
  ]).toArray();

  console.log('\nMapathons/Events held by Month (2025):');
  const eventMonthlyData = [];
  for (let m = 1; m <= 12; m++) {
    const found = eventsByMonth.find(e => e._id.month === m);
    const count = found ? found.count : 0;
    const monthName = new Date(2025, m - 1, 1).toLocaleString('en-US', { month: 'long' });
    console.log(`  ${monthName}: ${count}`);
    eventMonthlyData.push({ month: monthName, count });
  }
  results.eventsByMonth = eventMonthlyData;

  // List of MN events in 2025
  const mnEventsList = await events.find({
    ...mnEventFilter,
    startDate: { $gte: YEAR_START, $lt: YEAR_END }
  }, {
    projection: { name: 1, address: 1, startDate: 1, endDate: 1, participants: 1 }
  }).sort({ startDate: 1 }).toArray();

  console.log('\nMN Mapathons/Events in 2025:');
  const eventsListData = [];
  for (const e of mnEventsList) {
    const participantCount = e.participants ? e.participants.length : 0;
    console.log(`  - ${e.name || 'Unnamed'} (${e.startDate?.toISOString().split('T')[0] || 'No date'}) - ${participantCount} participants`);
    eventsListData.push({
      name: e.name || 'Unnamed',
      address: e.address || '',
      startDate: e.startDate?.toISOString().split('T')[0] || '',
      endDate: e.endDate?.toISOString().split('T')[0] || '',
      participants: participantCount
    });
  }
  results.eventsList = eventsListData;

  // ============================================
  // 4. USER/MAPPER STATS
  // ============================================
  console.log('\n=== USER/MAPPER STATS ===');

  // Unique users who reviewed MN venues in 2025
  const uniqueReviewers2025 = await reviews.aggregate([
    { $match: { 
      venue: { $in: mnVenueIdSet },
      createdAt: { $gte: YEAR_START, $lt: YEAR_END }
    }},
    { $group: { _id: '$user' } },
    { $count: 'uniqueUsers' }
  ]).toArray();
  
  const uniqueUserCount = uniqueReviewers2025[0]?.uniqueUsers || 0;
  console.log(`Unique Mappers who reviewed MN venues in 2025: ${uniqueUserCount}`);
  results.uniqueMappers2025 = uniqueUserCount;

  // New users created in 2025 (global, not MN-specific since users don't have location)
  const newUsers2025 = await users.countDocuments({
    isArchived: false,
    createdAt: { $gte: YEAR_START, $lt: YEAR_END }
  });
  console.log(`New Users (global) in 2025: ${newUsers2025}`);
  results.newUsersGlobal2025 = newUsers2025;

  // ============================================
  // 5. TOP VENUES BY REVIEWS IN 2025
  // ============================================
  console.log('\n=== TOP 20 MN VENUES BY REVIEWS IN 2025 ===');

  const topVenues = await reviews.aggregate([
    { $match: { 
      venue: { $in: mnVenueIdSet },
      createdAt: { $gte: YEAR_START, $lt: YEAR_END }
    }},
    { $group: { _id: '$venue', reviewCount: { $sum: 1 } } },
    { $sort: { reviewCount: -1 } },
    { $limit: 20 },
    { $lookup: {
      from: 'venues',
      localField: '_id',
      foreignField: '_id',
      as: 'venueInfo'
    }},
    { $unwind: '$venueInfo' },
    { $project: {
      _id: 0,
      venueId: '$_id',
      name: '$venueInfo.name',
      address: '$venueInfo.address',
      reviewCount: 1
    }}
  ]).toArray();

  const topVenuesData = [];
  for (const v of topVenues) {
    console.log(`  ${v.reviewCount} reviews - ${v.name} (${v.address})`);
    topVenuesData.push({
      name: v.name,
      address: v.address,
      reviewCount: v.reviewCount
    });
  }
  results.topVenues2025 = topVenuesData;

  // ============================================
  // 6. SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(50));
  console.log('MINNESOTA MAPPING STATS SUMMARY - 2025');
  console.log('='.repeat(50));
  console.log(`Total MN Venues (all time):        ${totalMNVenues}`);
  console.log(`New MN Venues in 2025:             ${newVenues2025}`);
  console.log(`Total MN Reviews (all time):       ${totalMNReviews}`);
  console.log(`Reviews in 2025:                   ${reviews2025}`);
  console.log(`Total MN Mapathons (all time):     ${totalMNEvents}`);
  console.log(`Mapathons held in 2025:            ${eventsOccurred2025}`);
  console.log(`Unique Mappers in 2025:            ${uniqueUserCount}`);
  console.log(`New Users (global) in 2025:        ${newUsers2025}`);
  console.log('='.repeat(50));

  // ============================================
  // EXPORT TO CSV
  // ============================================
  const outputDir = path.join(__dirname, '../../reports');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Summary CSV
  const summaryCSV = `Metric,Value
Total MN Venues (all time),${totalMNVenues}
New MN Venues in 2025,${newVenues2025}
Total MN Reviews (all time),${totalMNReviews}
Reviews for MN Venues in 2025,${reviews2025}
Total MN Mapathons (all time),${totalMNEvents}
Mapathons held in 2025,${eventsOccurred2025}
Unique Mappers in 2025,${uniqueUserCount}
New Users (global) in 2025,${newUsers2025}
`;
  fs.writeFileSync(path.join(outputDir, 'mn_summary_2025.csv'), summaryCSV);

  // Monthly breakdown CSV
  let monthlyCSV = 'Month,New Venues,Reviews,Mapathons\n';
  for (let m = 0; m < 12; m++) {
    const monthName = venueMonthlyData[m].month;
    monthlyCSV += `${monthName},${venueMonthlyData[m].count},${reviewMonthlyData[m].count},${eventMonthlyData[m].count}\n`;
  }
  fs.writeFileSync(path.join(outputDir, 'mn_monthly_breakdown_2025.csv'), monthlyCSV);

  // Events list CSV
  let eventsCSV = 'Name,Address,Start Date,End Date,Participants\n';
  for (const e of eventsListData) {
    eventsCSV += `"${e.name.replace(/"/g, '""')}","${e.address.replace(/"/g, '""')}",${e.startDate},${e.endDate},${e.participants}\n`;
  }
  fs.writeFileSync(path.join(outputDir, 'mn_events_2025.csv'), eventsCSV);

  // Top venues CSV
  let topVenuesCSV = 'Rank,Name,Address,Reviews in 2025\n';
  topVenuesData.forEach((v, i) => {
    topVenuesCSV += `${i + 1},"${(v.name || '').replace(/"/g, '""')}","${(v.address || '').replace(/"/g, '""')}",${v.reviewCount}\n`;
  });
  fs.writeFileSync(path.join(outputDir, 'mn_top_venues_2025.csv'), topVenuesCSV);

  console.log(`\nCSV files exported to: ${outputDir}`);
  console.log('  - mn_summary_2025.csv');
  console.log('  - mn_monthly_breakdown_2025.csv');
  console.log('  - mn_events_2025.csv');
  console.log('  - mn_top_venues_2025.csv');

  await mongoose.disconnect();
  console.log('\nDone!');
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
