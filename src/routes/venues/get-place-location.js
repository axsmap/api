const axios = require('axios');

module.exports = async (req, res, next) => {
  const placeId = req.params.placeId;
  const placesApiKey =
    process.env.PLACES_SERVER_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.PLACES_API_KEY;

  if (!placesApiKey) {
    return res.status(500).json({ general: 'Places API is not configured' });
  }

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      {
        params: {
          key: placesApiKey,
          place_id: placeId,
          fields: 'formatted_address,geometry'
        }
      }
    );

    if (response.data.status !== 'OK') {
      return res.status(404).json({
        general: response.data.error_message || 'Place not found',
        status: response.data.status
      });
    }

    return res.json(response.data);
  } catch (err) {
    return next(err);
  }
};
