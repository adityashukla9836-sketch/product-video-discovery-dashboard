const { GoogleGenAI } = require("@google/genai");

async function downloadImage(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `Failed to download image: ${response.status} ${response.statusText}`
        );
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    return {
        data: buffer.toString("base64"),
        mimeType: response.headers.get("content-type") || "image/jpeg"
    };
}

async function generateWithRetry(ai, contents, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            console.log(`Gemini attempt ${attempt}/${maxRetries + 1}...`);

            return await ai.models.generateContent({
                model: "gemini-3.8-flash",
                contents,
                config: {
                    responseMimeType: "application/json"
                }
            });

        } catch (error) {
            const errorText = error?.message || String(error);

            // Daily quota is exhausted. Retrying won't help.
            if (
                errorText.includes("GenerateRequestsPerDayPerProject-FreeTier") ||
                errorText.includes("quotaValue") ||
                errorText.includes("quota exceeded")
            ) {
                throw new Error(
                    "Gemini daily quota is exhausted. Please wait for the quota to reset."
                );
            }

            const isTemporaryError =
                errorText.includes("503") ||
                errorText.includes("UNAVAILABLE");

            if (!isTemporaryError || attempt > maxRetries) {
                throw error;
            }

            const waitTime = 2000 * Math.pow(2, attempt - 1);

            console.log(
                `Gemini temporarily unavailable. Retrying in ${waitTime / 1000} seconds...`
            );

            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

async function scoreVideoMatches(productImageUrl, videos) {
    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    });

    if (!videos || videos.length === 0) {
        return [];
    }

    // Download product image once
    const productImage = await downloadImage(productImageUrl);

    // Download all video thumbnails
    const thumbnailImages = [];

    for (const video of videos) {
        if (!video.thumbnail) {
            thumbnailImages.push(null);
            continue;
        }

        try {
            thumbnailImages.push(
                await downloadImage(video.thumbnail)
            );
        } catch (error) {
            console.error(
                `Failed to download thumbnail for ${video.platform} video:`,
                error.message
            );

            thumbnailImages.push(null);
        }
    }

    const validVideos = [];
    const parts = [];

    // Image A = target product
    parts.push({
        text: `IMAGE A is the target product image.`
    });

    parts.push({
        inlineData: {
            mimeType: productImage.mimeType,
            data: productImage.data
        }
    });

    // Add candidate images
    for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        const image = thumbnailImages[i];

        if (!image) {
            continue;
        }

        validVideos.push({
            video,
            originalIndex: i
        });

        parts.push({
            text: `IMAGE B${validVideos.length} is the thumbnail for candidate video ${validVideos.length}.`
        });

        parts.push({
            inlineData: {
                mimeType: image.mimeType,
                data: image.data
            }
        });
    }

    if (validVideos.length === 0) {
        return videos.map(video => ({
            ...video,
            matchScore: null,
            matchReason: "Video thumbnail unavailable",
            decision: "error"
        }));
    }

    const prompt = `
You are a visual product matching system.

IMAGE A is the target product.

The following images are candidate video thumbnails:
${validVideos
    .map((item, index) => `IMAGE B${index + 1}`)
    .join(", ")}

Compare each candidate thumbnail with IMAGE A.

Focus on:
- product type
- overall shape
- color
- pattern or graphics
- visible design details
- logo or branding
- material appearance
- whether the same or very similar product is visibly present

Do NOT treat a keyword or caption as visual proof.

Scoring:
90-100 = very strong visual match
70-89 = strong match
50-69 = possible match
30-49 = weak match
0-29 = poor match

Decision:
"match" for 70-100
"possible" for 50-69
"reject" for 0-49

Return ONLY valid JSON in this exact format:

[
  {
    "candidate": 1,
    "matchScore": 0,
    "matchReason": "reason",
    "decision": "match"
  }
]

Return one object for every candidate image.
The candidate number must match the candidate order.
`;

    parts.unshift({
        text: prompt
    });

    const response = await generateWithRetry(ai, [
        {
            role: "user",
            parts
        }
    ]);

    let responseText = response.text.trim();

    // Remove accidental markdown code fences
    responseText = responseText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    const matches = JSON.parse(responseText);

    if (!Array.isArray(matches)) {
        throw new Error("Gemini did not return an array.");
    }

    const resultMap = new Map();

    for (const match of matches) {
        const candidateNumber = Number(match.candidate);

        if (!Number.isInteger(candidateNumber)) {
            continue;
        }

        resultMap.set(candidateNumber, {
            matchScore: Math.max(
                0,
                Math.min(100, Number(match.matchScore) || 0)
            ),
            matchReason: String(
                match.matchReason || "No reason provided"
            ),
            decision: ["match", "possible", "reject"].includes(
                match.decision
            )
                ? match.decision
                : "reject"
        });
    }

    let validCounter = 0;

    return videos.map(video => {
        if (!video.thumbnail) {
            return {
                ...video,
                matchScore: null,
                matchReason: "Video thumbnail unavailable",
                decision: "error"
            };
        }

        validCounter++;

        const match = resultMap.get(validCounter);

        if (!match) {
            return {
                ...video,
                matchScore: null,
                matchReason: "Gemini did not return a result",
                decision: "error"
            };
        }

        return {
            ...video,
            ...match
        };
    });
}

// Keep the old single-video function for compatibility.
async function scoreVideoMatch(productImageUrl, videoThumbnailUrl) {
    const results = await scoreVideoMatches(productImageUrl, [
        {
            platform: "test",
            videoId: "test",
            videoUrl: "",
            thumbnail: videoThumbnailUrl
        }
    ]);

    return {
        matchScore: results[0].matchScore,
        matchReason: results[0].matchReason,
        decision: results[0].decision
    };
}

module.exports = {
    scoreVideoMatch,
    scoreVideoMatches
};