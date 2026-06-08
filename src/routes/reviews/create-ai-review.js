const axios = require('axios');

const SYSTEM_INSTRUCTION = `You write concise, natural accessibility review comments for AXS Map.
Use only the accessibility answers explicitly provided as true or false.
Ignore null, undefined, or unknown answers. Do not invent details.
Mention both available and unavailable features when they were answered.
Never mention parking, flashing lights, lighting, internal ramps, or second entrances.
Keep the comment friendly, factual, and under 70 words. Return only the comment text.`;

const ANSWER_FIELDS = [
  'steps',
  'has1Step',
  'has2Step',
  'hasPermanentRamp',
  'hasWideEntrance',
  'multipleFloors',
  'hasAccessibleElevator',
  'hasWashroom',
  'hasLargeStall',
  'hasSupportAroundToilet'
];

const buildAnswers = body =>
  ANSWER_FIELDS.filter(field => typeof body[field] === 'boolean')
    .map(field => `${field}: ${body[field]}`)
    .join('\n');

const extractComment = response => {
  const message =
    response &&
    response.data &&
    response.data.choices &&
    response.data.choices[0] &&
    response.data.choices[0].message;

  return message && typeof message.content === 'string'
    ? message.content.trim()
    : '';
};

const createAiReview = async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    console.error(
      '[reviews:create-ai-review] OPENAI_API_KEY is not configured'
    );
    return res.status(503).json({
      general: 'Comment generation is unavailable'
    });
  }

  try {
    const answers = buildAnswers(req.body || {});
    if (!answers) {
      return res.status(400).json({
        general: 'Accessibility answers are required'
      });
    }

    console.log('[reviews:create-ai-review] Generating comment', {
      userId: req.user && req.user.id,
      answerCount: answers.split('\n').length
    });

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: SYSTEM_INSTRUCTION
          },
          {
            role: 'user',
            content: `Accessibility answers:\n${answers}`
          }
        ],
        temperature: 0.2,
        max_tokens: 150
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );
    const comment = extractComment(response);

    if (!comment) {
      console.error(
        '[reviews:create-ai-review] OpenAI returned an empty comment'
      );
      return res.status(502).json({
        general: 'Comment generation returned no text'
      });
    }

    return res.status(200).json({
      general: 'Success',
      data: comment
    });
  } catch (error) {
    console.error('[reviews:create-ai-review] OpenAI request failed', {
      status: error.response && error.response.status,
      response:
        error.response &&
        error.response.data &&
        error.response.data.error &&
        error.response.data.error.message,
      code: error.code,
      message: error.message
    });
    return res.status(502).json({
      general: 'Comment generation failed'
    });
  }
};

createAiReview.buildAnswers = buildAnswers;
createAiReview.extractComment = extractComment;

module.exports = createAiReview;
