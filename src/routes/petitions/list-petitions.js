const logger = require('../../helpers/logger')
const { Petition } = require('../../models/petition')

module.exports = async (req, res, next) => {
  const queryParams = req.query

  const petitionsQuery = {
    $or: [{ sender: req.user.id }, { user: req.user.id }]
  }

  const sortBy = '-createdAt'

  let page = queryParams.page || 1
  const pageLimit = 12
  if (page > 0) {
    page -= 1
  } else {
    return res
      .status(400)
      .json({ page: 'Should be equal to or greater than 1' })
  }

  let petitions
  let total
  try {
    ;[petitions, total] = await Promise.all([
      Petition.find(petitionsQuery)
        .select('-__v -updatedAt')
        .sort(sortBy)
        .skip(page * pageLimit)
        .limit(pageLimit),
      Petition.find(petitionsQuery).count()
    ])
  } catch (err) {
    logger.error('Petitions failed to be found or count at list-petitions')
    return next(err)
  }

  let lastPage = Math.ceil(total / pageLimit)
  if (lastPage > 0) {
    page += 1
    if (page > lastPage) {
      return res
        .status(400)
        .json({ page: `Should be equal to or less than ${lastPage}` })
    }
  } else {
    page = null
    lastPage = null
  }

  return res.status(200).json({
    page,
    lastPage,
    pageLimit,
    total,
    sortBy,
    results: petitions
  })
}
