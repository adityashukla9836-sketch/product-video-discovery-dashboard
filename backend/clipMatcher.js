let extractorPromise = null;

// Cache product embeddings so the same product image
// does not need to be processed again.
const embeddingCache = new Map();

async function getExtractor() {
    if (!extractorPromise) {
        const { pipeline } = await import("@huggingface/transformers");

        console.log("Loading CLIP model...");

        extractorPromise = pipeline(
            "image-feature-extraction",
            "Xenova/clip-vit-base-patch32"
        );
    }

    return extractorPromise;
}

async function getImageEmbedding(imageUrl) {
    if (embeddingCache.has(imageUrl)) {
        console.log("Using cached image embedding...");
        return embeddingCache.get(imageUrl);
    }

    const extractor = await getExtractor();

    const output = await extractor(imageUrl);

    const embedding = Array.from(output.data);

    embeddingCache.set(imageUrl, embedding);

    return embedding;
}

function cosineSimilarity(vectorA, vectorB) {
    if (vectorA.length !== vectorB.length) {
        throw new Error("Embedding dimensions do not match.");
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
        dotProduct += vectorA[i] * vectorB[i];
        magnitudeA += vectorA[i] * vectorA[i];
        magnitudeB += vectorB[i] * vectorB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
}

function convertSimilarityToScore(similarity) {
    return Math.round(
        Math.max(0, Math.min(100, similarity * 100))
    );
}

function getDecision(matchScore) {
   if (matchScore >= 75) {
    return "match";
}

if (matchScore >= 45) {
    return "possible";
}

    return "reject";
}

async function scoreImageSimilarity(
    productImageUrl,
    videoThumbnailUrl,
    productEmbedding = null
) {
    const targetEmbedding =
        productEmbedding ||
        await getImageEmbedding(productImageUrl);

    const videoEmbedding =
        await getImageEmbedding(videoThumbnailUrl);

    const similarity = cosineSimilarity(
        targetEmbedding,
        videoEmbedding
    );

    const matchScore =
        convertSimilarityToScore(similarity);

    return {
        similarity: Number(similarity.toFixed(4)),
        matchScore,
        decision: getDecision(matchScore)
    };
}

async function scoreMultipleVideos(
    productImageUrl,
    videos
) {
    const results = [];

    if (!videos || videos.length === 0) {
        return results;
    }

    // IMPORTANT:
    // Generate the product embedding only ONCE.
    console.log("Creating product embedding...");

    const productEmbedding =
        await getImageEmbedding(productImageUrl);

    for (let i = 0; i < videos.length; i++) {
        const video = videos[i];

        console.log(
            `Comparing video ${i + 1}/${videos.length}...`
        );

        if (!video.thumbnail) {
            results.push({
                ...video,
                similarity: null,
                matchScore: null,
                decision: "error",
                matchReason: "Video thumbnail unavailable"
            });

            continue;
        }

        try {
            const match = await scoreImageSimilarity(
                productImageUrl,
                video.thumbnail,
                productEmbedding
            );

            results.push({
                ...video,
                similarity: match.similarity,
                matchScore: match.matchScore,
                decision: match.decision,
                matchReason:
                    `Visual similarity score: ${match.matchScore}/100`
            });

        } catch (error) {
            results.push({
                ...video,
                similarity: null,
                matchScore: null,
                decision: "error",
                matchReason: error.message
            });
        }
    }

    return results;
}

module.exports = {
    getImageEmbedding,
    cosineSimilarity,
    scoreImageSimilarity,
    scoreMultipleVideos
};