// const aws = require('aws-sdk')
const jimp = require('jimp')
const { trim } = require('lodash')
const mongoose = require('mongoose')
const randomstring = require('randomstring')
const slugify = require('speakingurl')

require('dotenv').config()

const logger = require('../helpers/logger')
const { userSchema } = require('../models/user')

const oldUserSchema = require('./old-schemas/user')

mongoose.Promise = global.Promise

async function closeConnections(db, oldDb) {
  try {
    await oldDb.close()
  } catch (error) {
    logger.error(error)
    process.exit(0)
  }

  try {
    await db.close()
  } catch (error) {
    logger.error(error)
    process.exit(0)
  }

  process.exit(0)
}

const uri = process.env.MONGODB_URI
const options = {
  useMongoClient: true,
  socketTimeoutMS: 0,
  keepAlive: 2000
}
const db = mongoose.createConnection(uri, options)

db.on('connected', async () => {
  logger.info('Connection to DB established successfully')

  const oldUri = process.env.OLD_DB_URI
  const oldDb = mongoose.createConnection(oldUri, options)

  oldDb.on('connected', async () => {
    logger.info('Connection to old DB established successfully')

    const OldUser = oldDb.model('users', oldUserSchema)

    let totalOldUsers
    try {
      totalOldUsers = await OldUser.count()
    } catch (error) {
      logger.info('Old users failed to be count')
      logger.error(error)
      await closeConnections(db, oldDb)
    }

    logger.info(`Total old users: ${totalOldUsers}`)

    let page = 0
    const pageLimit = 100
    let i = 0
    do {
      let oldUsers
      try {
        oldUsers = await OldUser.find({})
          .skip(page * pageLimit)
          .limit(pageLimit)
      } catch (error) {
        logger.info('Old users failed to be found')
        logger.error(error)
        await closeConnections(db, oldDb)
      }

      const User = db.model('User', userSchema)

      const createUsers = []
      const getUsersImages = []
      const usersToUpdate = []
      for (let oldUser of oldUsers) {
        if (oldUser.isactive) {
          const userData = {
            _id: oldUser.id,
            createdAt: oldUser.createdAt,
            description: trim(oldUser.description),
            email: oldUser.email,
            events: oldUser.events,
            facebookId: oldUser.facebookAuth,
            firstName: trim(oldUser.name.first) || 'first',
            hashedPassword: oldUser.hash,
            isSubscribed: oldUser.newsletter,
            lastName: trim(oldUser.name.last) || 'last',
            phone: trim(oldUser.phone),
            showEmail: oldUser.showEmail,
            showPhone: oldUser.showPhone,
            teams: oldUser.teams,
            updatedAt: oldUser.updatedAt,
            username: `${slugify(trim(oldUser.name.first))}-${slugify(
              trim(oldUser.name.last)
            )}-${randomstring.generate({
              length: 5,
              capitalization: 'lowercase'
            })}`,
            zip: oldUser.zip.length <= 32 ? oldUser.zip : ''
          }

          switch (oldUser.disabilitytype.toLowerCase()) {
            case 'audio':
              userData.disabilities = ['audio']
              break

            case 'other':
              userData.disabilities = ['other']
              break

            case 'private':
              userData.disabilities = ['private']
              break

            case 'visual':
              userData.disabilities = ['vision']
              break

            case 'wheelchair':
              userData.disabilities = ['physical']
              break

            default:
              userData.disabilities = ['none']
          }

          switch (oldUser.gender.toLowerCase()) {
            case 'female':
              userData.gender = 'female'
              break

            case 'male':
              userData.gender = 'male'
              break

            case 'other':
              userData.gender = 'other'
              break

            case 'transgender':
              userData.gender = 'transgender'
              break

            default:
              userData.gender = 'private'
          }

          createUsers.push(User.create(userData))

          if (
            oldUser.image &&
            !oldUser.image.includes('/images/icon_guy.png')
          ) {
            getUsersImages.push(jimp.read(encodeURI(oldUser.image)))
            usersToUpdate.push(oldUser.id)
          }
        }
      }

      try {
        await Promise.all(createUsers)
      } catch (error) {
        logger.info(
          `Old users failed to be created.\nData: ${JSON.stringify({
            page,
            i
          })}`
        )
        logger.error(error)
        await closeConnections(db, oldDb)
      }

      // if (getUsersImages.length > 0) {
      //   let usersImages
      //   try {
      //     usersImages = await Promise.all(getUsersImages)
      //   } catch (error) {
      //     logger.info(
      //       `Old users images failed to be found.\nData: ${JSON.stringify({
      //         page,
      //         i
      //       })}`
      //     )
      //     logger.error(error)
      //     await closeConnections(db, oldDb)
      //   }

      //   const getBase64Images = []
      //   for (let userImage of usersImages) {
      //     getBase64Images.push(
      //       userImage.scaleToFit(400, 400).quality(60).getBase64(jimp.AUTO)
      //     )
      //   }

      //   try {
      //     usersImages = await Promise.all(getBase64Images)
      //   } catch (error) {
      //     logger.info(
      //       `Users images failed to be converted.\nData: ${JSON.stringify({
      //         page,
      //         i
      //       })}`
      //     )
      //     logger.error(error)
      //     await closeConnections(db, oldDb)
      //   }

      //   const s3 = new aws.S3()
      //   const uploadUsersImages = []
      //   const updateUsersImages = []
      //   for (let i = 0; i < usersImages.length; i++) {
      //     let fileName = `${Date.now()}${randomstring.generate({
      //       length: 5,
      //       capitalization: 'lowercase'
      //     })}}}`
      //     uploadUsersImages.push(
      //       s3.putObject({
      //         ACL: 'public-read',
      //         Body: usersImages[i],
      //         Bucket: process.env.AWS_S3_BUCKET,
      //         ContentType: usersImages[i].getMIME(),
      //         Key: `users/avatars/${fileName}`
      //       })
      //     )

      //     let avatar = `https://s3-sa-east-1.amazonaws.com/${process.env
      //       .AWS_S3_BUCKET}/users/avatars/${fileName}`
      //     updateUsersImages.push(
      //       User.update({ _id: usersToUpdate[i] }, { $set: { avatar } })
      //     )
      //   }

      //   try {
      //     await Promise.all([...uploadUsersImages, ...updateUsersImages])
      //   } catch (error) {
      //     logger.info(
      //       `Users images failed to be uploaded or updated.\nData: ${JSON.stringify(
      //         {
      //           page,
      //           i
      //         }
      //       )}`
      //     )
      //     logger.error(error)
      //     await closeConnections(db, oldDb)
      //   }
      // }

      page = page + 1
      i = i + oldUsers.length
      logger.info(i)
    } while (i < totalOldUsers)

    await closeConnections(db, oldDb)
  })

  oldDb.on('error', err => {
    logger.error('Connection to old DB failed ' + err)
    process.exit(0)
  })

  oldDb.on('disconnected', () => {
    logger.info('Connection from old DB closed')
  })
})

db.on('error', err => {
  logger.error('Connection to DB failed ' + err)
  process.exit(0)
})

db.on('disconnected', () => {
  logger.info('Connection from DB closed')
})

process.on('SIGINT', () => db.close())
