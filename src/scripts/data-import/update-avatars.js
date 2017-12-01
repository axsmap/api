const aws = require('aws-sdk')
const jimp = require('jimp')
const mongoose = require('mongoose')
const randomstring = require('randomstring')

require('dotenv').config()

const logger = require('../../helpers/logger')
const { userSchema } = require('../../models/user')

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

      const getUsersImages = []
      const usersToUpdate = []
      for (let oldUser of oldUsers) {
        if (oldUser.isactive) {
          if (oldUser.image && !oldUser.image.includes('icon_guy.png')) {
            getUsersImages.push(jimp.read(encodeURI(oldUser.image)))
            usersToUpdate.push(oldUser.id)
          }
        }
      }

      if (getUsersImages.length > 0) {
        let usersImages
        try {
          usersImages = await Promise.all(getUsersImages)
        } catch (error) {
          logger.info(
            `Old users images failed to be found.\nData: ${JSON.stringify({
              page,
              i
            })}`
          )
          logger.error(error)
          await closeConnections(db, oldDb)
        }

        const usersAvatars = []
        for (let i = 0; i < usersImages.length; i++) {
          usersImages[i].scaleToFit(400, 400).quality(60)
          usersImages[i].getBuffer(
            usersImages[i].getMIME(),
            (error, bufferImage) => {
              if (error) {
                logger.error(error)
              }

              const extension = usersImages[i].getExtension()
              if (
                extension === 'png' ||
                extension === 'jpeg' ||
                extension === 'jpg' ||
                extension === 'bmp'
              ) {
                usersAvatars.push({
                  body: bufferImage,
                  extension: extension,
                  mime: usersImages[i].getMIME(),
                  userId: usersToUpdate[i]
                })
              }
            }
          )
        }

        const s3 = new aws.S3()
        const uploadUsersAvatars = []
        const updateUsersAvatars = []
        for (let userAvatar of usersAvatars) {
          let fileName = `${Date.now()}${randomstring.generate({
            length: 5,
            capitalization: 'lowercase'
          })}.${userAvatar.extension}`

          uploadUsersAvatars.push(
            s3
              .putObject({
                ACL: 'public-read',
                Body: userAvatar.body,
                Bucket: process.env.AWS_S3_BUCKET,
                ContentType: userAvatar.mime,
                Key: `users/avatars/${fileName}`
              })
              .promise()
          )

          let avatar = `https://s3.amazonaws.com/${process.env
            .AWS_S3_BUCKET}/users/avatars/${fileName}`

          updateUsersAvatars.push(
            User.update({ _id: userAvatar.userId }, { $set: { avatar } })
          )
        }

        try {
          await Promise.all([...uploadUsersAvatars, ...updateUsersAvatars])
        } catch (error) {
          logger.info(
            `Users images failed to be uploaded or updated.\nData: ${JSON.stringify(
              {
                page,
                i
              }
            )}`
          )
          logger.error(error)
          await closeConnections(db, oldDb)
        }
      }

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
