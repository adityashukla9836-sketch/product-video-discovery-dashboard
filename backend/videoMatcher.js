const { scoreMultipleVideos } = require("./clipMatcher");

async function matchVideos(productImageUrl, videos) {
    const candidates = videos.filter(
        video => video.thumbnail
    );

    console.log(
        `\nTotal videos available for matching: ${candidates.length}`
    );

    if (candidates.length === 0) {
        return [];
    }

    try {
        const results = await scoreMultipleVideos(
            productImageUrl,
            candidates
        );

        results.forEach((video, index) => {
            console.log(
                `${index + 1}. ${video.platform} | ` +
                `Score: ${video.matchScore} | ` +
                `Decision: ${video.decision}`
            );
        });

        return results;

    } catch (error) {
        console.error(
            "Video matching failed:",
            error.message
        );

        return candidates.map(video => ({
            ...video,
            similarity: null,
            matchScore: null,
            decision: "error",
            matchReason: error.message
        }));
    }
}

module.exports = {
    matchVideos
};