const mongoose = require('mongoose');
const randomstring = require('randomstring');
const slugify = require('speakingurl');

require('dotenv').config();

const { cleanSpaces } = require('../../helpers');
const { reviewSchema } = require('../../models/review');
const { userSchema } = require('../../models/user');

const oldUserSchema = require('./old-schemas/user');

mongoose.Promise = global.Promise;

async function closeConnections(db, oldDb) {
  try {
    await oldDb.close();
  } catch (error) {
    console.log(error);
    process.exit(0);
  }

  try {
    await db.close();
  } catch (error) {
    console.log(error);
    process.exit(0);
  }

  process.exit(0);
}

const uri = process.env.MONGODB_URI;
const options = {
  useMongoClient: true,
  socketTimeoutMS: 0,
  keepAlive: 2000
};
const db = mongoose.createConnection(uri, options);

db.on('connected', async () => {
  console.log('Connection to DB established successfully');

  const oldUri = process.env.OLD_DB_URI;
  const oldDb = mongoose.createConnection(oldUri, options);

  oldDb.on('connected', async () => {
    console.log('Connection to old DB established successfully');

    const OldUser = oldDb.model('users', oldUserSchema);

    let totalOldUsers;
    try {
      totalOldUsers = await OldUser.count();
    } catch (error) {
      console.log('Old users failed to be count');
      console.log(error);
      await closeConnections(db, oldDb);
    }

    console.log(`Total old users: ${totalOldUsers}`);

    const User = db.model('User', userSchema);

    console.time('createUsers');

    let page = 0;
    const pageLimit = 100;
    let i = 0;
    do {
      let oldUsers;
      try {
        oldUsers = await OldUser.find({})
          .skip(page * pageLimit)
          .limit(pageLimit);
      } catch (error) {
        console.log('Old users failed to be found');
        console.log(error);
        await closeConnections(db, oldDb);
      }

      const createUsers = [];
      for (let oldUser of oldUsers) {
        if (oldUser.isactive) {
          const userData = {
            _id: oldUser.id,
            createdAt: oldUser.createdAt,
            description: oldUser.description
              ? cleanSpaces(oldUser.description)
              : '',
            email: oldUser.email,
            events: oldUser.events,
            facebookId: oldUser.facebookAuth,
            firstName:
              oldUser.name.first && cleanSpaces(oldUser.name.first)
                ? cleanSpaces(oldUser.name.first)
                : 'first',
            hashedPassword: oldUser.hash,
            isSubscribed: oldUser.newsletter,
            lastName:
              oldUser.name.last && cleanSpaces(oldUser.name.last)
                ? cleanSpaces(oldUser.name.last)
                : 'last',
            phone: oldUser.phone ? cleanSpaces(oldUser.phone) : '',
            showEmail: oldUser.showEmail,
            showPhone: oldUser.showPhone,
            teams: oldUser.teams,
            updatedAt: oldUser.updatedAt,
            username: `${slugify(oldUser.name.first)}-${slugify(
              oldUser.name.last
            )}-${randomstring.generate({
              length: 5,
              capitalization: 'lowercase'
            })}`
          };

          switch (oldUser.disabilitytype.toLowerCase()) {
            case 'audio':
              userData.disabilities = ['audio'];
              break;

            case 'other':
              userData.disabilities = ['other'];
              break;

            case 'private':
              userData.disabilities = ['private'];
              break;

            case 'visual':
              userData.disabilities = ['vision'];
              break;

            case 'wheelchair':
              userData.disabilities = ['physical'];
              break;

            default:
              userData.disabilities = ['none'];
          }

          switch (oldUser.gender.toLowerCase()) {
            case 'female':
              userData.gender = 'female';
              break;

            case 'male':
              userData.gender = 'male';
              break;

            case 'other':
              userData.gender = 'other';
              break;

            case 'transgender':
              userData.gender = 'transgender';
              break;

            default:
              userData.gender = 'private';
          }

          if (oldUser.zip && oldUser.zip.length <= 32) {
            userData.zip = oldUser.zip;
          }

          createUsers.push(User.create(userData));
        }
      }

      try {
        await Promise.all(createUsers);
      } catch (error) {
        console.log(
          `Users failed to be created.\nData: ${JSON.stringify({
            page,
            i
          })}`
        );
        console.log(error);
        await closeConnections(db, oldDb);
      }

      page = page + 1;
      i = i + oldUsers.length;
      console.log(i);
    } while (i < totalOldUsers);

    console.timeEnd('createUsers');

    const Review = db.model('Review', reviewSchema);

    let totalUsers;
    try {
      totalUsers = await User.count();
    } catch (error) {
      console.log('Users failed to be count');
      console.log(error);
      await closeConnections(db, oldDb);
    }

    console.log(`Total users: ${totalUsers}`);

    console.time('updateReviewsAmount');

    i = 0;
    page = 0;
    do {
      let users;
      try {
        users = await User.find({})
          .skip(page * pageLimit)
          .limit(pageLimit);
      } catch (error) {
        console.log('Users failed to be found');
        console.log(error);
        await closeConnections(db, oldDb);
      }

      const updateUsers = [];
      for (let user of users) {
        let userReviews;
        try {
          userReviews = await Review.find({ user: user.id }).count();
        } catch (err) {
          console.log('User reviews failed to be count');
          console.log(err);
          await closeConnections(db, oldDb);
        }

        user.reviewsAmount = userReviews;
        updateUsers.push(user.save());
      }

      try {
        await Promise.all(updateUsers);
      } catch (err) {
        console.log(
          `Users failed to be updated.\nData: ${JSON.stringify({
            page,
            i
          })}`
        );
        console.log(err);
        await closeConnections(db, oldDb);
      }

      page = page + 1;
      i = i + users.length;
      console.log(i);
    } while (i < totalUsers);

    console.timeEnd('updateReviewsAmount');

    await closeConnections(db, oldDb);
  });

  oldDb.on('error', err => {
    console.log('Connection to old DB failed ' + err);
    process.exit(0);
  });

  oldDb.on('disconnected', () => {
    console.log('Connection from old DB closed');
  });
});

db.on('error', err => {
  console.log('Connection to DB failed ' + err);
  process.exit(0);
});

db.on('disconnected', () => {
  console.log('Connection from DB closed');
});
