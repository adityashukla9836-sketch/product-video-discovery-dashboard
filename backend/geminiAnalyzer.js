const { GoogleGenAI } = require("@google/genai");

async function analyzeProductImage(imageUrl) {
    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    });

    // Download the product image
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
        throw new Error(
            `Could not download image. Status: ${imageResponse.status}`
        );
    }

    const imageBuffer = Buffer.from(
        await imageResponse.arrayBuffer()
    );

    const mimeType =
        imageResponse.headers.get("content-type") || "image/jpeg";

    const base64Image = imageBuffer.toString("base64");

    const prompt = `
Analyze the product shown in this image.

Identify:
- product type
- colors
- prints or graphics
- logos
- visible text
- material, only if reasonably inferable
- shape or fit

Return ONLY valid JSON.

Do not invent information that cannot reasonably be seen.

Use exactly this JSON structure:

{
  "productType": "",
  "colors": [],
  "graphics": [],
  "logos": [],
  "text": [],
  "material": "",
  "shape": ""
}
`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",

        contents: [
            {
                role: "user",
                parts: [
                    {
                        text: prompt
                    },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Image
                        }
                    }
                ]
            }
        ],

        config: {
            responseMimeType: "application/json"
        }
    });

    let resultText = response.text.trim();

    // Remove Markdown code fences if Gemini returns them
    if (resultText.startsWith("```")) {
        resultText = resultText
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();
    }

    return JSON.parse(resultText);
}

module.exports = {
    analyzeProductImage
};