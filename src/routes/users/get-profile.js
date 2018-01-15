const logger = require('../../helpers/logger')
const { Team } = require('../../models/team')

module.exports = async (req, res, next) => {
  const getUserTeams = req.user.teams.map(t => Team.findOne({ _id: t }))
  let userTeams
  try {
    userTeams = await Promise.all(getUserTeams)
  } catch (err) {
    logger.error('Teams failed to be found at get-profile')
    return next(err)
  }

  const teams = []
  const managedTeams = []
  userTeams.map(t => {
    const teamManagers = t.managers.map(m => m.toString())
    if (teamManagers.includes(req.user.id.toString())) {
      managedTeams.push({
        id: t.id.toString(),
        avatar: t.avatar,
        name: t.name
      })
    } else {
      teams.push({
        id: t.id.toString(),
        avatar: t.avatar,
        name: t.name
      })
    }
  })

  const userData = Object.assign(
    {},
    {
      id: req.user.id.toString(),
      avatar: req.user.avatar,
      description: req.user.description,
      disabilities: req.user.disabilities,
      email: req.user.email,
      firstName: req.user.firstName,
      gender: req.user.gender,
      isSubscribed: req.user.isSubscribed,
      lastName: req.user.lastName,
      managedTeams,
      phone: req.user.phone,
      showDisabilities: req.user.showDisabilities,
      showEmail: req.user.showEmail,
      showPhone: req.user.showPhone,
      teams,
      username: req.user.username,
      zip: req.user.zip
    }
  )
  return res.status(200).json(userData)
}
