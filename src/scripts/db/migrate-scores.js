db.reviews.updateMany({}, { $rename: { entryScore: '_entryScore' } });
db.reviews.updateMany({}, { $rename: { bathroomScore: '_bathroomScore' } });
db.venues.updateMany({}, { $rename: { entryScore: '_entryScore' } });
db.venues.updateMany({}, { $rename: { bathroomScore: '_bathroomScore' } });
db.venues.updateMany({}, { $rename: { entryReviews: '_entryReviews' } });
db.venues.updateMany({}, { $rename: { bathroomReviews: '_bathroomReviews' } });
