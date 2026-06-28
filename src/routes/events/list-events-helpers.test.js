const assert = require("node:assert/strict");
const test = require("node:test");

const { buildEventsQuery } = require("./list-events-helpers");

const currentDate = new Date("2026-06-27T00:00:00.000Z");

test("public active mapathon list does not filter invite-only events", () => {
  const query = buildEventsQuery({ status: "active" }, null, currentDate);

  assert.deepEqual(query.status, { $ne: "draft" });
  assert.deepEqual(query.startDate, { $lte: currentDate });
  assert.deepEqual(query.endDate, { $gte: currentDate });
  assert.equal(Object.hasOwn(query, "isInviteOnly"), false);
  assert.equal(Object.hasOwn(query, "isOpen"), false);
});

test("public all mapathon list does not filter invite-only events", () => {
  const query = buildEventsQuery({ status: "all" }, null, currentDate);

  assert.deepEqual(query.status, { $ne: "draft" });
  assert.equal(Object.hasOwn(query, "isInviteOnly"), false);
  assert.equal(Object.hasOwn(query, "isOpen"), false);
});

test("unauthenticated draft mapathon list returns no query", () => {
  assert.equal(buildEventsQuery({ status: "draft" }, null, currentDate), null);
});
