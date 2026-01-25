const OPENAI = require("openai");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(os.tmpdir(), "axsmap-voice-reviews");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `voice-review-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    "audio/webm",
    "audio/mp3",
    "audio/mpeg",
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/m4a",
    "audio/mp4",
    "audio/ogg",
    "audio/flac",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid audio format: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
  },
}).single("audio");

// System prompt for extracting structured review data from transcription
const EXTRACTION_SYSTEM_PROMPT = `You are an accessibility review assistant for AXS Map.
Your task is to extract structured accessibility information from a user's spoken description of a venue.

IMPORTANT RULES:
1. Only set a field to true/false if the user EXPLICITLY mentions it
2. Set fields to null if not mentioned or unclear
3. Be conservative - if uncertain, use null
4. The "comments" field should contain a cleaned version of the transcription
5. For "steps", use: 0 = no steps, 1 = one step, 2 = two steps, 3 = more than two steps

FIELD MAPPINGS (listen for these keywords):

ENTRANCE:
- "ramp" or "wheelchair ramp" → hasPermanentRamp: true
- "portable ramp" or "removable ramp" → hasPortableRamp: true
- "wide door/entrance" or "spacious entrance" → hasWideEntrance: true
- "narrow entrance/door" → hasWideEntrance: false
- "second entrance" or "side door" or "back entrance" → hasSecondEntry: true
- "no steps" or "step-free" or "level entrance" → steps: 0
- "one step" or "single step" → steps: 1, has1Step: true
- "two steps" or "couple steps" → steps: 2, has2Step: true
- "three steps" or "more than two" or "several steps" → steps: 3

INTERIOR:
- "elevator" or "lift" → hasAccessibleElevator: true
- "no elevator" → hasAccessibleElevator: false
- "multiple floors" or "upstairs" or "second floor" → multipleFloors: true
- "single floor" or "one level" → multipleFloors: false
- "well lit" or "bright" or "good lighting" → hasWellLit: true
- "dark" or "dim" or "poorly lit" → hasWellLit: false
- "flashing lights" or "strobe" → brightLightTitle: true

BATHROOM:
- "bathroom accessible" or "accessible restroom" → hasWashroom: true
- "no accessible bathroom" → hasWashroom: false
- "grab bars" or "support bars" or "handles by toilet" → hasSupportAroundToilet: true
- "lowered sinks" or "accessible sinks" → hasLoweredSinks: true

PARKING:
- "parking" or "parking lot" → hasParking: true
- "no parking" → hasParking: false
- "wheelchair parking" or "handicap parking" or "accessible parking" → hasWheelchairParking: true

OUTPUT FORMAT:
Return ONLY a valid JSON object with these exact fields:
{
  "steps": number or null (0, 1, 2, or 3),
  "has1Step": boolean or null,
  "has2Step": boolean or null,
  "hasPermanentRamp": boolean or null,
  "hasPortableRamp": boolean or null,
  "hasWideEntrance": boolean or null,
  "hasSecondEntry": boolean or null,
  "hasParking": boolean or null,
  "hasWheelchairParking": boolean or null,
  "multipleFloors": boolean or null,
  "hasAccessibleElevator": boolean or null,
  "hasWellLit": boolean or null,
  "brightLightTitle": boolean or null,
  "hasWashroom": boolean or null,
  "hasSupportAroundToilet": boolean or null,
  "hasLoweredSinks": boolean or null,
  "comments": "cleaned transcription text"
}`;

/**
 * Voice-to-Review endpoint
 * Accepts audio file, transcribes it using Whisper, and extracts structured review data using GPT-4
 */
const voiceToReview = async (req, res) => {
  // Handle file upload
  upload(req, res, async (uploadErr) => {
    if (uploadErr) {
      if (uploadErr.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Audio file too large (max 25MB)" });
      }
      return res.status(400).json({ error: uploadErr.message || "File upload failed" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const audioFilePath = req.file.path;

    try {
      // Validate placeId
      const placeId = req.body.placeId;
      if (!placeId) {
        fs.unlinkSync(audioFilePath); // Clean up
        return res.status(400).json({ error: "Place ID is required" });
      }

      console.log(`[Voice-to-Review] Processing audio for place: ${placeId}`);
      console.log(`[Voice-to-Review] Audio file: ${audioFilePath}, size: ${req.file.size} bytes`);

      const openai = new OPENAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Step 1: Transcribe audio using Whisper
      console.log("[Voice-to-Review] Starting transcription...");
      let transcription;
      try {
        const audioFile = fs.createReadStream(audioFilePath);
        const transcriptionResponse = await openai.audio.transcriptions.create({
          file: audioFile,
          model: "whisper-1",
          language: "en", // Can be made dynamic for multi-language support
          response_format: "text",
        });
        transcription = transcriptionResponse;
        console.log(`[Voice-to-Review] Transcription complete: "${transcription.substring(0, 100)}..."`);
      } catch (transcriptionError) {
        console.error("[Voice-to-Review] Transcription failed:", transcriptionError.message);
        fs.unlinkSync(audioFilePath);
        return res.status(500).json({ error: "Transcription failed. Please try again." });
      }

      // Check if transcription is too short
      if (!transcription || transcription.trim().length < 10) {
        fs.unlinkSync(audioFilePath);
        return res.status(400).json({ 
          error: "Recording was too short or unclear. Please describe the accessibility features.",
          transcription: transcription || ""
        });
      }

      // Step 2: Extract structured review data using GPT-4
      console.log("[Voice-to-Review] Extracting review data...");
      let extractedReview;
      try {
        const extractionResponse = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: EXTRACTION_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: `Extract accessibility review data from this transcription:\n\n"${transcription}"`,
            },
          ],
          temperature: 0,
          max_tokens: 1000,
        });

        const responseContent = extractionResponse.choices[0].message.content;
        
        // Parse JSON response
        try {
          // Handle potential markdown code blocks
          let jsonStr = responseContent;
          if (jsonStr.includes("```json")) {
            jsonStr = jsonStr.split("```json")[1].split("```")[0];
          } else if (jsonStr.includes("```")) {
            jsonStr = jsonStr.split("```")[1].split("```")[0];
          }
          extractedReview = JSON.parse(jsonStr.trim());
        } catch (parseError) {
          console.error("[Voice-to-Review] JSON parse error:", parseError.message);
          console.error("[Voice-to-Review] Raw response:", responseContent);
          // Return partial result with just the transcription
          extractedReview = {
            steps: null,
            has1Step: null,
            has2Step: null,
            hasPermanentRamp: null,
            hasPortableRamp: null,
            hasWideEntrance: null,
            hasSecondEntry: null,
            hasParking: null,
            hasWheelchairParking: null,
            multipleFloors: null,
            hasAccessibleElevator: null,
            hasWellLit: null,
            brightLightTitle: null,
            hasWashroom: null,
            hasSupportAroundToilet: null,
            hasLoweredSinks: null,
            comments: transcription,
          };
        }

        console.log("[Voice-to-Review] Extraction complete");
      } catch (extractionError) {
        console.error("[Voice-to-Review] Extraction failed:", extractionError.message);
        // Return just the transcription if extraction fails
        extractedReview = {
          comments: transcription,
        };
      }

      // Clean up audio file
      fs.unlinkSync(audioFilePath);

      // Calculate confidence based on how many fields were extracted
      const allFields = [
        "steps", "has1Step", "has2Step", "hasPermanentRamp", "hasPortableRamp",
        "hasWideEntrance", "hasSecondEntry", "hasParking", "hasWheelchairParking",
        "multipleFloors", "hasAccessibleElevator", "hasWellLit", "brightLightTitle",
        "hasWashroom", "hasSupportAroundToilet", "hasLoweredSinks"
      ];
      
      const extractedFields = allFields.filter(
        field => extractedReview[field] !== null && extractedReview[field] !== undefined
      );

      const confidence = {
        overall: Math.round((extractedFields.length / allFields.length) * 100) / 100,
        fieldsExtracted: extractedFields.length,
        totalFields: allFields.length,
      };

      console.log(`[Voice-to-Review] Success - ${extractedFields.length} fields extracted`);

      return res.status(200).json({
        success: true,
        transcription,
        extractedReview,
        confidence,
      });

    } catch (error) {
      console.error("[Voice-to-Review] Unexpected error:", error);
      
      // Clean up audio file if it exists
      if (fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath);
      }

      return res.status(500).json({ 
        error: "Failed to process voice review. Please try again." 
      });
    }
  });
};

module.exports = voiceToReview;
