const { toBoolean } = require('validator')

const logger = require('../../helpers/logger')
const User = require('../../models/user')

const { validateListUsers } = require('./validations')

module.exports = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ general: 'Forbidden action' })
  }

  const queryParams = req.query
  const { errors, isValid } = validateListUsers(queryParams)
  if (!isValid) {
    return res.status(400).json(errors)
  }

  const usersQuery = { isArchived: false }

  if (queryParams.keywords) {
    usersQuery.$text = { $search: queryParams.keywords }
  }

  if (queryParams.disabilities) {
    const disabilities = queryParams.disabilities.split(',')
    usersQuery.disability = { $in: disabilities }
  }

  if (queryParams.genders) {
    const genders = queryParams.genders.split(',')
    usersQuery.gender = { $in: genders }
  }

  if (queryParams.isAdmin) {
    const isAdmin = toBoolean(queryParams.isAdmin)
    usersQuery.isAdmin = { $eq: isAdmin }
  }

  if (queryParams.isBlocked) {
    const isBlocked = toBoolean(queryParams.isBlocked)
    usersQuery.isBlocked = { $eq: isBlocked }
  }

  if (queryParams.isSubscribed) {
    const isSubscribed = toBoolean(queryParams.isSubscribed)
    usersQuery.isSubscribed = { $eq: isSubscribed }
  }

  let sortField = 'email'
  if (queryParams.sortBy) {
    const sort = queryParams.sortBy
    const sortOptions = [
      'email',
      '-email',
      'firstName',
      '-firstName',
      'lastName',
      '-lastName',
      'username',
      '-username'
    ]

    if (sortOptions.includes(sort)) {
      sortField = sort
    } else {
      return res.status(400).json({ types: 'Invalid type of sort' })
    }
  }

  let page = queryParams.page || 1
  const pageLimit = 18

  if (page > 0) {
    page -= 1
  } else {
    return res
      .status(400)
      .json({ page: 'Should be equal to or greater than 1' })
  }

  let total
  let users
  try {
    ;[users, total] = await Promise.all([
      User.find(usersQuery)
        .select('-__v -createdAt -hashedPassword -updatedAt')
        .sort(sortField)
        .skip(page * pageLimit)
        .limit(pageLimit),
      User.find(usersQuery).count()
    ])
  } catch (err) {
    logger.error(
      `Users failed to be found or count at list-users.\nusersQuery: ${JSON.stringify(
        usersQuery
      )}`
    )
    return next(err)
  }

  let first = `${process.env.API_URL}/users?page=1`
  const lastPage = Math.ceil(total / pageLimit)
  let last = `${process.env.API_URL}/users?page=${lastPage}`
  if (lastPage > 0) {
    page += 1
    if (page > lastPage) {
      return res
        .status(400)
        .json({ page: `Should be equal to or less than ${lastPage}` })
    }
  } else {
    first = null
    last = null
    page = null
  }

  const dataResponse = {
    first,
    last,
    page,
    pageLimit,
    results: users,
    total
  }
  return res.status(200).json(dataResponse)
}
