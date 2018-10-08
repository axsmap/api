const aws = require('aws-sdk');
const jimp = require('jimp');
const mongoose = require('mongoose');
const randomstring = require('randomstring');

require('dotenv').config();

const { reviewSchema } = require('../../models/review');
const { teamSchema } = require('../../models/team');

const oldTeamSchema = require('./old-schemas/team');

mongoose.Promise = global.Promise;

const s3 = new aws.S3();

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

    const OldTeam = oldDb.model('teams', oldTeamSchema);

    let totalOldTeams;
    try {
      totalOldTeams = await OldTeam.count();
    } catch (error) {
      console.log('Old teams failed to be count');
      console.log(error);
      await closeConnections(db, oldDb);
    }

    console.log(`Total old teams: ${totalOldTeams}`);

    const Team = db.model('Team', teamSchema);

    console.time('createTeams');

    let i = 0;
    let page = 0;
    const pageLimit = 100;
    do {
      let oldTeams;
      try {
        oldTeams = await OldTeam.find({})
          .skip(page * pageLimit)
          .limit(pageLimit);
      } catch (error) {
        console.log('Old teams failed to be found');
        console.log(error);
        await closeConnections(db, oldDb);
      }

      const createTeams = [];
      const uploadTeamsAvatars = [];
      for (let oldTeam of oldTeams) {
        if (oldTeam.name) {
          const members = oldTeam.members.filter(
            m => m.toString() !== oldTeam.creator.toString()
          );
          const teamData = {
            _id: oldTeam.id,
            createdAt: oldTeam.created_at,
            events: oldTeam.events,
            managers: [oldTeam.creator],
            members: members,
            name:
              oldTeam.name.length > 35
                ? oldTeam.name.substring(0, 35)
                : oldTeam.name,
            updatedAt: oldTeam.updated_at
          };

          if (oldTeam.description) {
            teamData.description =
              oldTeam.description.length <= 300
                ? oldTeam.description
                : oldTeam.description.substring(0, 300);
          }

          if (oldTeam.image && !oldTeam.image.includes('icon_team.png')) {
            let avatarImage;
            try {
              avatarImage = await jimp.read(encodeURI(oldTeam.image));
            } catch (err) {
              console.log('Old team avatar image failed to be read');
              console.log(err);
              await closeConnections(db, oldDb);
            }

            if (avatarImage) {
              const avatarExtension = avatarImage.getExtension();
              const avatarFileName = `${Date.now()}${randomstring.generate({
                length: 5,
                capitalization: 'lowercase'
              })}.${avatarExtension}`;

              if (
                avatarExtension === 'png' ||
                avatarExtension === 'jpeg' ||
                avatarExtension === 'jpg' ||
                avatarExtension === 'bmp'
              ) {
                teamData.avatar = `https://s3.amazonaws.com/${
                  process.env.AWS_S3_BUCKET
                }/teams/avatars/${avatarFileName}`;
                avatarImage
                  .cover(400, 400)
                  .quality(85)
                  .getBuffer(
                    avatarImage.getMIME(),
                    async (err, avatarBuffer) => {
                      if (err) {
                        console.log('Old team avatar buffer failed to be read');
                        console.log(err);
                        await closeConnections(db, oldDb);
                      }

                      uploadTeamsAvatars.push(
                        s3
                          .putObject({
                            ACL: 'public-read',
                            Body: avatarBuffer,
                            Bucket: process.env.AWS_S3_BUCKET,
                            ContentType: avatarImage.getMIME(),
                            Key: `teams/avatars/${avatarFileName}`
                          })
                          .promise()
                      );
                    }
                  );
              }
            }
          }

          createTeams.push(Team.create(teamData));
        }
      }

      try {
        await Promise.all([...createTeams, ...uploadTeamsAvatars]);
      } catch (error) {
        console.log(
          `Teams failed to be created.\nData: ${JSON.stringify({
            page,
            i
          })}`
        );
        console.log(error);
        await closeConnections(db, oldDb);
      }

      page = page + 1;
      i = i + oldTeams.length;
      console.log(i);
    } while (i < totalOldTeams);

    console.timeEnd('createTeams');

    const Review = db.model('Review', reviewSchema);

    let totalTeams;
    try {
      totalTeams = await Team.count();
    } catch (error) {
      console.log('Teams failed to be count');
      console.log(error);
      await closeConnections(db, oldDb);
    }

    console.log(`Total teams: ${totalTeams}`);

    i = 0;
    page = 0;
    do {
      let teams;
      try {
        teams = await Team.find({})
          .skip(page * pageLimit)
          .limit(pageLimit);
      } catch (error) {
        console.log('Teams failed to be found');
        console.log(error);
        await closeConnections(db, oldDb);
      }

      const updateTeams = [];
      for (let team of teams) {
        let teamReviews;
        try {
          teamReviews = await Review.find({ team: team.id }).count();
        } catch (err) {
          console.log('Team reviews failed to be count');
          console.log(err);
          await closeConnections(db, oldDb);
        }

        team.reviewsAmount = teamReviews;
        updateTeams.push(team.save());
      }

      try {
        await Promise.all(updateTeams);
      } catch (err) {
        console.log(
          `Teams failed to be updated.\nData: ${JSON.stringify({
            page,
            i
          })}`
        );
        console.log(err);
        await closeConnections(db, oldDb);
      }

      page = page + 1;
      i = i + teams.length;
      console.log(i);
    } while (i < totalTeams);

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
