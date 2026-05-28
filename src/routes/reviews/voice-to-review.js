const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
}).single('audio');

const emptyExtractedReview = {
  steps: null,
  has1Step: null,
  has2Step: null,
  hasPermanentRamp: null,
  hasWideEntrance: null,
  multipleFloors: null,
  hasAccessibleElevator: null,
  hasWashroom: null,
  hasLargeStall: null,
  hasSupportAroundToilet: null,
  comments: null
};

module.exports = (req, res) => {
  upload(req, res, err => {
    if (err) {
      return res.status(400).json({ audio: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ audio: 'Audio file is required' });
    }

    return res.json({
      success: true,
      transcription:
        'Audio received. Review and adjust the accessibility fields before submitting.',
      extractedReview: emptyExtractedReview,
      confidence: {
        overall: 0,
        fieldsExtracted: 0,
        totalFields: 9
      }
    });
  });
};
