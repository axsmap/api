const axios = require('axios');
const mongoose = require('mongoose');
const { isMongoId } = require('validator');

const { Event } = require('../../models/event');
const { validateListEvents } = require('./validations');

module.exports = async (req, res, next) => {
  const queryParams = req.query;

  const { errors, isValid } = validateListEvents(queryParams);
  if (!isValid) return res.status(400).json(errors);

  const eventsQuery = {};

  if (queryParams.keywords) {
    eventsQuery.$text = { $search: queryParams.keywords };
  }

  eventsQuery.isArchived = false;

  let sortBy = queryParams.sortBy || '-startDate';

  let events;
  try {
    [events] = await Promise.all([
      Event.aggregate()
        .match(eventsQuery)
        .project({
          _id: 0,
          id: '$_id',
          address: 1,
          name: 1,
          startDate: 1,
          endDate: 1,
          location: 1,
          isOpen: 1
        })
        .sort(sortBy)
    ]);

    //manipluate data here (address = key // dictionary value[ append query info ]) > do in a for loop (check for 0's)
    var pinDict = [];

    for (var i in events) {
      var event = events[i];
      var location = event.location;
      var address = event.address;

      //check for 0 coordinates
      if (location.coordinates[0] != 0 || !location.coordinates.length) {
        //the empty array error check does not work

        //check if item is already in the dictionary and add if no there
        if (pinDict.filter(e => e.address == address) == 0) {
          pinDict.push({
            address: address,
            location: location
          });
        }
      }
    }
    console.log(pinDict);
  } catch (err) {
    console.log('Events failed to be found or count at highlight-events');
    return next(err);
  }

  return res.status(200).json({
    results: events
  });
};
