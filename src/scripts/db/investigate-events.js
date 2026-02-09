/**
 * Investigation script for Mapathons page issue
 * Answers all questions from the frontend team
 * 
 * Run from ~/api directory: node scripts/investigate-events.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Use absolute path from cwd (run from ~/api)
const { Event } = require(process.cwd() + "/src/models/event");

async function investigate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB\n");

    const now = new Date();
    console.log("=".repeat(60));
    console.log("MAPATHONS PAGE INVESTIGATION REPORT");
    console.log("Generated:", now.toISOString());
    console.log("=".repeat(60));

    // Q11: Total events count
    console.log("\n=== Q11: TOTAL EVENTS COUNT ===");
    const totalEvents = await Event.countDocuments({});
    const nonArchivedEvents = await Event.countDocuments({ isArchived: false });
    const archivedEvents = await Event.countDocuments({ isArchived: true });
    console.log(`Total events: ${totalEvents}`);
    console.log(`Non-archived (isArchived: false): ${nonArchivedEvents}`);
    console.log(`Archived (isArchived: true): ${archivedEvents}`);

    // Q2: Active events (started but not ended)
    console.log("\n=== Q2: ACTIVE EVENTS (startDate <= today AND endDate >= today) ===");
    const activeQuery = {
      isArchived: false,
      startDate: { $lte: now },
      endDate: { $gte: now }
    };
    const activeCount = await Event.countDocuments(activeQuery);
    console.log(`Active events count: ${activeCount}`);
    
    if (activeCount > 0) {
      const activeEvents = await Event.find(activeQuery).select("name startDate endDate isOpen").lean();
      console.log("Active events:");
      activeEvents.forEach(e => {
        console.log(`  - "${e.name}" (${e.startDate?.toISOString()} to ${e.endDate?.toISOString()}) isOpen: ${e.isOpen}`);
      });
    }

    // Q7: Upcoming events
    console.log("\n=== Q7: UPCOMING EVENTS (startDate > today) ===");
    const upcomingQuery = {
      isArchived: false,
      startDate: { $gt: now }
    };
    const upcomingCount = await Event.countDocuments(upcomingQuery);
    console.log(`Upcoming events count: ${upcomingCount}`);
    
    if (upcomingCount > 0) {
      const upcomingEvents = await Event.find(upcomingQuery).select("name startDate endDate").lean();
      console.log("Upcoming events:");
      upcomingEvents.forEach(e => {
        console.log(`  - "${e.name}" (starts: ${e.startDate?.toISOString()})`);
      });
    }

    // Inactive/past events
    console.log("\n=== INACTIVE EVENTS (endDate < today) ===");
    const inactiveQuery = {
      isArchived: false,
      endDate: { $lt: now }
    };
    const inactiveCount = await Event.countDocuments(inactiveQuery);
    console.log(`Inactive/past events count: ${inactiveCount}`);

    // Q13: Test pattern filter
    console.log("\n=== Q13: EVENTS MATCHING TEST PATTERN ===");
    const testPattern = /t[\W_0-9]*e[\W_0-9]*s[\W_0-9]*t/i;
    const testCount = await Event.countDocuments({ name: testPattern });
    console.log(`Events with 'test' in name: ${testCount}`);
    
    if (testCount > 0) {
      const testEvents = await Event.find({ name: testPattern }).select("name").lean();
      console.log("Test events:");
      testEvents.forEach(e => console.log(`  - "${e.name}"`));
    }

    // Q10: Sample event document
    console.log("\n=== Q10: SAMPLE EVENT DOCUMENT ===");
    const sampleEvent = await Event.findOne({ isArchived: false }).lean();
    if (sampleEvent) {
      console.log(JSON.stringify(sampleEvent, null, 2));
    } else {
      console.log("No non-archived events found");
    }

    // Q8: isArchived usage
    console.log("\n=== Q8: isArchived ANALYSIS ===");
    const archivedSample = await Event.find({ isArchived: true }).select("name startDate endDate").limit(5).lean();
    if (archivedSample.length > 0) {
      console.log("Sample archived events:");
      archivedSample.forEach(e => {
        console.log(`  - "${e.name}" (${e.startDate?.toISOString()} to ${e.endDate?.toISOString()})`);
      });
    } else {
      console.log("No archived events found");
    }

    // Date range analysis
    console.log("\n=== DATE RANGE ANALYSIS ===");
    const eventsWithDates = await Event.find({ 
      isArchived: false,
      startDate: { $exists: true },
      endDate: { $exists: true }
    }).select("name startDate endDate").sort({ endDate: -1 }).limit(10).lean();
    
    console.log("Most recent 10 events by end date:");
    eventsWithDates.forEach(e => {
      const status = e.endDate < now ? "ENDED" : (e.startDate <= now ? "ACTIVE" : "UPCOMING");
      console.log(`  [${status}] "${e.name}" (${e.startDate?.toISOString().split('T')[0]} to ${e.endDate?.toISOString().split('T')[0]})`);
    });

    // Events with null/missing dates
    console.log("\n=== EVENTS WITH MISSING DATES ===");
    const missingStartDate = await Event.countDocuments({ startDate: { $exists: false } });
    const missingEndDate = await Event.countDocuments({ endDate: { $exists: false } });
    const nullStartDate = await Event.countDocuments({ startDate: null });
    const nullEndDate = await Event.countDocuments({ endDate: null });
    console.log(`Events missing startDate: ${missingStartDate}`);
    console.log(`Events missing endDate: ${missingEndDate}`);
    console.log(`Events with null startDate: ${nullStartDate}`);
    console.log(`Events with null endDate: ${nullEndDate}`);

    console.log("\n" + "=".repeat(60));
    console.log("SUMMARY");
    console.log("=".repeat(60));
    console.log(`Current server time: ${now.toISOString()}`);
    console.log(`Total events: ${totalEvents}`);
    console.log(`Active (showing in /events): ${activeCount}`);
    console.log(`Upcoming (showing in /events/upComing): ${upcomingCount}`);
    console.log(`Inactive/Past: ${inactiveCount}`);
    console.log(`Filtered by 'test' pattern: ${testCount}`);
    
    if (activeCount === 0 && upcomingCount === 0) {
      console.log("\n⚠️  WARNING: No active or upcoming events found!");
      console.log("This explains why the Mapathons page is empty.");
      console.log("\nPossible causes:");
      console.log("1. All events have ended (endDate < today)");
      console.log("2. Events were created with incorrect dates");
      console.log("3. Timezone mismatch between server and database");
    }

    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

investigate();
