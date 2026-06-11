const axios = require('axios');

module.exports = async (req, res, next) => {
  const input = req.query.input && req.query.input.trim();
  if (!input) {
    return res.status(400).json({ general: 'Input is required' });
  }

  const placesApiKey =
    process.env.PLACES_SERVER_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.PLACES_API_KEY;

  if (!placesApiKey) {
    return res.status(500).json({ general: 'Places API is not configured' });
  }

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json',
      {
        params: {
          key: placesApiKey,
          input,
          types: 'geocode'
        }
      }
    );

    if (
      response.data.status !== 'OK' &&
      response.data.status !== 'ZERO_RESULTS'
    ) {
      return res.status(502).json({
        general: response.data.error_message || 'Place search failed',
        status: response.data.status
      });
    }

    return res.json(response.data);
  } catch (err) {
    return next(err);
  }
};
