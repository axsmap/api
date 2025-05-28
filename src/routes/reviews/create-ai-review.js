const OPENAI = require("openai");
const sytemInstruction = `You are an assistant that writes a concise, natural, and helpful accessibility review summary for a location based on the answers given. The answers are boolean or null values representing accessibility features of the location. Use the information below to generate a short review that a person might write as a review comment. Mention only the positive and negative aspects explicitly answered true or false. Ignore any null or unknown fields.
the comment shouldn't be greater than 70 words.

Use these guidelines to form your comment:
- If "hasWideEntrance" is false, but "hasSecondEntry" is true, mention that the main entrance was not wide enough, but there was a second entrance that was accessible.
- If "hasWashroom" is true, mention that the location has accessible restrooms that were comfortable to use.
- If "hasPermanentRamp" is true, mention the presence of a permanent ramp.
- If "multipleFloors" is true and "hasAccessibleElevator" is true, mention that accessible elevators are available to access multiple floors.
- Mention parking accessibility if "hasParking" or "hasWheelchairParking" is true.
- Include other features if answered true or false, focusing on accessibility and ease of use.

Answer in a friendly and informative tone, as if a person is giving a brief review summary.`;

module.exports = async (req, res,) => {
  try {
    const openai = new OPENAI({
      apiKey:process.env.OPENAI_API_KEY,
    });
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: sytemInstruction,
        },
        {
          role: "user",
          content: `
            Here are the answers:
            steps: ${req?.body?.steps}
            has1Step: ${req?.body?.has1Step}
            has2Step: ${req?.body?.has2Step}
            hasWideEntrance: ${req?.body?.hasWideEntrance}
            hasParking: ${req?.body?.hasParking}
            hasSecondEntry: ${req?.body?.hasSecondEntry}
            hasPermanentRamp: ${req?.body?.hasPermanentRamp}
            multipleFloors: ${req.body?.multipleFloors}
            hasAccessibleElevator: ${req.body?.hasAccessibleElevator}
            hasWellLit: ${req.body?.hasWellLit}
            brightLightTitle: ${req.body?.brightLightTitle}
            hasPortableRamp: ${req.body?.hasPortableRamp}
            hasSupportAroundToilet: ${req?.body?.hasSupportAroundToilet}
            hasWashroom: ${req?.body?.hasWashroom}
            hasWheelchairParking: ${req?.body?.hasWheelchairParking}`,
        },
      ],
      temperature: 0,
      max_tokens: 1000,
      top_p: 1,
    });
    return res
      .status(200)
      .json({ general: "Success", data: response.choices[0].message.content });
  } catch (error) {
    throw String(error);
  }
};
