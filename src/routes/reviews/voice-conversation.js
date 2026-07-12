const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
}).single('audio');

const REVIEW_QUESTIONS = [
  {
    id: 'steps_present',
    text: 'Is there steps? Please answer yes or no.'
  },
  {
    id: 'wheelchair_entrance',
    text: 'Is there a wide entry? Please answer yes or no.'
  },
  {
    id: 'multiple_floors',
    text: 'Are there multiple floors? Please answer yes or no.'
  },
  {
    id: 'elevator',
    text: 'Is there an elevator? Please answer yes or no.'
  },
  {
    id: 'bathroom',
    text: 'Does this place have a bathroom? Please answer yes or no.'
  },
  {
    id: 'wheelchair_stall',
    text:
      'Is there a bathroom stall that accommodates a wheelchair? Please answer yes or no.'
  },
  {
    id: 'grab_bar',
    text: 'Is there a grab bar? Please answer yes or no.'
  }
];

const FIELD_LABELS = {
  steps: 'entrance steps',
  hasWideEntrance: 'wide entry',
  multipleFloors: 'multiple floors',
  hasAccessibleElevator: 'elevator',
  hasWashroom: 'bathroom',
  hasLargeStall: 'bathroom stall that accommodates a wheelchair',
  hasSupportAroundToilet: 'grab bar'
};

const emptyExtractedReview = {
  steps: null,
  has1Step: null,
  has2Step: null,
  hasPermanentRamp: null,
  hasPortableRamp: null,
  hasWideEntrance: null,
  hasAccessibleTableHeight: null,
  multipleFloors: null,
  hasAccessibleElevator: null,
  hasInteriorRamp: null,
  hasSwingOutDoor: null,
  hasWashroom: null,
  hasLargeStall: null,
  hasSupportAroundToilet: null,
  hasLoweredSinks: null,
  hasParking: null,
  hasSecondEntry: null,
  hasWellLit: null,
  isQuiet: null,
  isSpacious: null,
  allowsGuideDog: null,
  comments: null
};

function parseState(rawState) {
  const fallback = {
    phase: 'collecting',
    askedQuestions: [],
    conversation: [],
    extractedReview: emptyExtractedReview
  };

  if (!rawState) return fallback;

  try {
    const state = JSON.parse(rawState);
    return {
      phase:
        state.phase === 'preview' || state.phase === 'approval'
          ? state.phase
          : 'collecting',
      askedQuestions: Array.isArray(state.askedQuestions)
        ? state.askedQuestions
        : [],
      conversation: Array.isArray(state.conversation) ? state.conversation : [],
      extractedReview: Object.assign(
        {},
        emptyExtractedReview,
        state.extractedReview || {}
      )
    };
  } catch (error) {
    return fallback;
  }
}

function parseYesNo(text) {
  const normalized = String(text || '').toLowerCase();
  if (
    /\b(no|nope|nah|not|none|there are no|there were no|does not|doesn't|do not|don't|without)\b/.test(
      normalized
    )
  ) {
    return false;
  }
  if (
    /\b(yes|yeah|yep|correct|it does|there is|there are|has|have|available)\b/.test(
      normalized
    )
  ) {
    return true;
  }
  return null;
}

function applyAnswer(extractedReview, questionId, answer) {
  const review = Object.assign({}, extractedReview);
  if (answer === null) return review;

  switch (questionId) {
    case 'steps_present':
      review.steps = answer ? 1 : 0;
      review.has1Step = false;
      review.has2Step = false;
      break;
    case 'wheelchair_entrance':
      review.hasWideEntrance = answer;
      break;
    case 'multiple_floors':
      review.multipleFloors = answer;
      if (!answer) {
        review.hasAccessibleElevator = false;
      }
      break;
    case 'elevator':
      review.hasAccessibleElevator = answer;
      break;
    case 'bathroom':
      review.hasWashroom = answer;
      if (!answer) {
        review.hasLargeStall = false;
        review.hasSupportAroundToilet = false;
      }
      break;
    case 'wheelchair_stall':
      review.hasLargeStall = answer;
      if (!answer) {
        review.hasSupportAroundToilet = false;
      }
      break;
    case 'grab_bar':
      review.hasSupportAroundToilet = answer;
      break;
    default:
      break;
  }

  return review;
}

function getNextQuestionForReview(extractedReview, askedQuestions) {
  return REVIEW_QUESTIONS.find(question => {
    if (askedQuestions.indexOf(question.id) !== -1) return false;
    if (
      question.id === 'elevator' &&
      extractedReview.multipleFloors === false
    ) {
      return false;
    }
    if (
      question.id === 'wheelchair_stall' &&
      extractedReview.hasWashroom === false
    ) {
      return false;
    }
    if (
      question.id === 'grab_bar' &&
      (extractedReview.hasWashroom === false ||
        extractedReview.hasLargeStall === false)
    ) {
      return false;
    }
    return true;
  });
}

function countExtractedFields(extractedReview) {
  return Object.keys(FIELD_LABELS).filter(
    field =>
      extractedReview[field] !== null &&
      typeof extractedReview[field] !== 'undefined'
  ).length;
}

function boolPhrase(value) {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return 'not sure';
}

function buildSummary(extractedReview) {
  const stepsText =
    extractedReview.steps === null
      ? 'not sure'
      : extractedReview.steps > 0
        ? 'yes'
        : 'no';

  return [
    `Steps: ${stepsText}.`,
    `Wide entry: ${boolPhrase(extractedReview.hasWideEntrance)}.`,
    `Multiple floors: ${boolPhrase(extractedReview.multipleFloors)}.`,
    `Elevator: ${boolPhrase(extractedReview.hasAccessibleElevator)}.`,
    `Bathroom: ${boolPhrase(extractedReview.hasWashroom)}.`,
    `Bathroom stall that accommodates a wheelchair: ${boolPhrase(
      extractedReview.hasLargeStall
    )}.`,
    `Grab bar: ${boolPhrase(extractedReview.hasSupportAroundToilet)}.`,
    extractedReview.comments ? `Notes: ${extractedReview.comments}` : ''
  ]
    .filter(Boolean)
    .join(' ');
}

async function transcribeAudio(file) {
  const form = new FormData();
  form.append('file', file.buffer, {
    filename: file.originalname || 'voice-review.wav',
    contentType: file.mimetype || 'audio/wav'
  });
  form.append('model', process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1');

  const response = await axios.post(
    'https://api.openai.com/v1/audio/transcriptions',
    form,
    {
      headers: Object.assign({}, form.getHeaders(), {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      }),
      maxContentLength: 20 * 1024 * 1024,
      timeout: 30000
    }
  );

  return response.data && response.data.text ? response.data.text.trim() : '';
}

async function generateComment({ placeName, conversation, extractedReview }) {
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Write one concise, natural AXS Map accessibility review comment from fixed yes/no answers. Mention every known answer, including whether there are steps, a wide entry, multiple floors, an elevator, a bathroom, a bathroom stall that accommodates a wheelchair, and a grab bar. Do not invent details. Return only the comment text, no markdown.'
        },
        {
          role: 'user',
          content: JSON.stringify({
            placeName,
            answers: extractedReview,
            transcript: conversation
          })
        }
      ],
      temperature: 0.2,
      max_tokens: 160
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );

  const comment =
    response.data &&
    response.data.choices &&
    response.data.choices[0] &&
    response.data.choices[0].message &&
    response.data.choices[0].message.content;

  return String(comment || '')
    .trim()
    .replace(/^"|"$/g, '')
    .slice(0, 500);
}

function buildResponse({
  done,
  phase,
  action = null,
  assistantMessage,
  transcription,
  conversation,
  askedQuestions,
  extractedReview
}) {
  const fieldsExtracted = countExtractedFields(extractedReview);
  return {
    success: true,
    done,
    phase,
    action,
    assistantMessage,
    summary: buildSummary(extractedReview),
    transcription,
    conversation,
    askedQuestions,
    extractedReview,
    confidence: {
      overall:
        Math.round((fieldsExtracted / Object.keys(FIELD_LABELS).length) * 100) /
        100,
      fieldsExtracted,
      totalFields: Object.keys(FIELD_LABELS).length
    }
  };
}

function openAiErrorResponse(error, res) {
  const upstreamStatus = error.response && error.response.status;
  const upstreamMessage =
    error.response &&
    error.response.data &&
    error.response.data.error &&
    error.response.data.error.message;

  if (upstreamStatus === 429) {
    return res.status(429).json({
      general:
        upstreamMessage ||
        'OpenAI quota exceeded. Please add billing credits or use an API key from a project with available quota.'
    });
  }

  if (upstreamStatus === 401 || upstreamStatus === 403) {
    return res.status(502).json({
      general:
        upstreamMessage ||
        'OpenAI rejected the configured API key for this voice review.'
    });
  }

  return res.status(502).json({
    general: upstreamMessage || 'Voice review failed'
  });
}

module.exports = (req, res) => {
  upload(req, res, async err => {
    if (err) {
      return res.status(400).json({ audio: err.message });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        general: 'Voice review is unavailable'
      });
    }

    const directTranscription =
      req.body && typeof req.body.transcription === 'string'
        ? req.body.transcription.trim()
        : '';

    if (!req.file && !directTranscription) {
      return res.status(400).json({ audio: 'Audio file is required' });
    }

    const state = parseState(req.body && req.body.state);

    try {
      const transcription =
        directTranscription || (await transcribeAudio(req.file));
      if (!transcription) {
        return res.status(400).json({
          audio: 'No speech was detected. Please try again.'
        });
      }

      if (state.phase === 'approval') {
        const approvalAnswer = parseYesNo(transcription);
        const userConversation = state.conversation.concat([
          { role: 'user', content: transcription }
        ]);

        if (approvalAnswer === true) {
          const assistantMessage = 'Great. I will submit this review now.';
          return res.json(
            buildResponse({
              done: true,
              phase: 'approval',
              action: 'submit',
              assistantMessage,
              transcription,
              conversation: userConversation.concat([
                { role: 'assistant', content: assistantMessage }
              ]),
              askedQuestions: state.askedQuestions,
              extractedReview: state.extractedReview
            })
          );
        }

        if (approvalAnswer === false) {
          const assistantMessage =
            'Okay. I opened the completed review so you can edit it or cancel.';
          return res.json(
            buildResponse({
              done: true,
              phase: 'preview',
              action: 'preview',
              assistantMessage,
              transcription,
              conversation: userConversation.concat([
                { role: 'assistant', content: assistantMessage }
              ]),
              askedQuestions: state.askedQuestions,
              extractedReview: state.extractedReview
            })
          );
        }

        const assistantMessage =
          'I did not understand. Would you like to submit this review? Please answer yes or no.';
        return res.json(
          buildResponse({
            done: true,
            phase: 'approval',
            action: null,
            assistantMessage,
            transcription,
            conversation: userConversation.concat([
              { role: 'assistant', content: assistantMessage }
            ]),
            askedQuestions: state.askedQuestions,
            extractedReview: state.extractedReview
          })
        );
      }

      const answeredQuestionId =
        state.askedQuestions[state.askedQuestions.length - 1];
      const yesNo = parseYesNo(transcription);
      if (yesNo === null) {
        const repeatQuestion =
          REVIEW_QUESTIONS.find(
            question => question.id === answeredQuestionId
          ) || REVIEW_QUESTIONS[0];
        return res.json(
          buildResponse({
            done: false,
            phase: 'collecting',
            action: null,
            assistantMessage: `I did not understand. ${repeatQuestion.text}`,
            transcription,
            conversation: state.conversation.concat([
              { role: 'user', content: transcription },
              {
                role: 'assistant',
                content: `I did not understand. ${repeatQuestion.text}`
              }
            ]),
            askedQuestions: state.askedQuestions,
            extractedReview: state.extractedReview
          })
        );
      }

      const extractedReview = applyAnswer(
        state.extractedReview,
        answeredQuestionId,
        yesNo
      );
      const userConversation = state.conversation.concat([
        { role: 'user', content: transcription }
      ]);
      const nextQuestion = getNextQuestionForReview(
        extractedReview,
        state.askedQuestions
      );

      if (nextQuestion) {
        const askedQuestions = Array.from(
          new Set(state.askedQuestions.concat([nextQuestion.id]))
        );
        return res.json(
          buildResponse({
            done: false,
            phase: 'collecting',
            action: null,
            assistantMessage: nextQuestion.text,
            transcription,
            conversation: userConversation.concat([
              { role: 'assistant', content: nextQuestion.text }
            ]),
            askedQuestions,
            extractedReview
          })
        );
      }

      const comments = await generateComment({
        placeName: req.body && req.body.placeName,
        conversation: userConversation,
        extractedReview
      });
      const reviewWithComment = Object.assign({}, extractedReview, {
        comments
      });
      const assistantMessage = `I finished the review. ${comments} Would you like to submit this review?`;

      return res.json(
        buildResponse({
          done: true,
          phase: 'approval',
          action: null,
          assistantMessage,
          transcription,
          conversation: userConversation.concat([
            { role: 'assistant', content: assistantMessage }
          ]),
          askedQuestions: state.askedQuestions,
          extractedReview: reviewWithComment
        })
      );
    } catch (error) {
      console.error('[reviews:voice-conversation] failed', {
        status: error.response && error.response.status,
        response:
          error.response &&
          error.response.data &&
          error.response.data.error &&
          error.response.data.error.message,
        code: error.code,
        message: error.message
      });

      return openAiErrorResponse(error, res);
    }
  });
};
