const { GoogleGenAI } = require("@google/genai");

async function downloadImage(imageUrl) {
    const response = await fetch(imageUrl);

    if (!response.ok) {
        throw new Error(
            `Failed to download product image: ${response.status} ${response.statusText}`
        );
    }

    const buffer = Buffer.from(
        await response.arrayBuffer()
    );

    return {
        data: buffer.toString("base64"),
        mimeType:
            response.headers.get("content-type") ||
            "image/jpeg"
    };
}

function isDailyQuotaError(errorText) {
    return (
        errorText.includes("GenerateRequestsPerDay") ||
        errorText.includes("quotaValue") ||
        errorText.includes("quota exceeded")
    );
}

function isTemporaryError(errorText) {
    return (
        errorText.includes("503") ||
        errorText.includes("UNAVAILABLE") ||
        errorText.includes("500") ||
        errorText.includes("INTERNAL")
    );
}

async function generateWithRetry(ai, contents) {
    const maxRetries = 3;

    for (
        let attempt = 1;
        attempt <= maxRetries + 1;
        attempt++
    ) {
        try {
            console.log(
                `Gemini attempt ${attempt}/${maxRetries + 1}...`
            );

            return await ai.models.generateContent({
                model:
                    process.env.GEMINI_MODEL ||
                    "gemini-3.8-flash",

                contents,

                config: {
                    responseMimeType:
                        "application/json"
                }
            });

        } catch (error) {
            const errorText =
                error?.message ||
                String(error);

            // Daily quota cannot be fixed by retrying.
            if (isDailyQuotaError(errorText)) {
                throw new Error(
                    "Gemini daily quota is exhausted. Please wait for the quota reset."
                );
            }

            if (
                !isTemporaryError(errorText) ||
                attempt === maxRetries + 1
            ) {
                throw error;
            }

            const waitTime =
                2000 *
                Math.pow(2, attempt - 1);

            console.log(
                `Gemini temporarily unavailable. Retrying in ${waitTime / 1000} seconds...`
            );

            await new Promise(resolve =>
                setTimeout(
                    resolve,
                    waitTime
                )
            );
        }
    }
}

async function analyzeProductImage(imageUrl) {
    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    });

    const image =
        await downloadImage(imageUrl);

    const prompt = `
Analyze the product image carefully.

Return ONLY valid JSON with exactly these fields:

{
  "productType": "",
  "colors": [],
  "graphics": [],
  "logos": [],
  "text": [],
  "material": "",
  "shape": ""
}

Identify:

- product type
- visible colors
- prints, graphics or patterns
- logos or branding
- visible text
- apparent material
- shape, fit or construction

Use empty arrays when nothing is visible.
Use an empty string when a property cannot be determined.
Do not invent details.
`;

    const response =
        await generateWithRetry(
            ai,
            [
                {
                    role: "user",

                    parts: [
                        {
                            text: prompt
                        },

                        {
                            inlineData: {
                                mimeType:
                                    image.mimeType,
                                data:
                                    image.data
                            }
                        }
                    ]
                }
            ]
        );

    let responseText =
        response.text.trim();

    responseText = responseText
        .replace(
            /^```json\s*/i,
            ""
        )
        .replace(
            /^```\s*/i,
            ""
        )
        .replace(
            /\s*```$/i,
            ""
        )
        .trim();

    const result =
        JSON.parse(responseText);

    return result;
}

module.exports = {
    analyzeProductImage
};