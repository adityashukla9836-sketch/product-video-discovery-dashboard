const DEFAULT_THRESHOLD = 45;

function getDecision(score) {
    if (score >= 75) {
        return "match";
    }

    if (score >= 45) {
        return "possible";
    }

    return "reject";
}

function getReason(score) {
    if (score >= 75) {
        return "Strong visual similarity with the target product.";
    }

    if (score >= 45) {
        return "Possible visual similarity with the target product.";
    }

    return "Low visual similarity with the target product.";
}

function filterAndRankVideos(videos, options = {}) {
    const threshold =
        options.threshold ?? DEFAULT_THRESHOLD;

    const target =
        options.target ?? 20;

    const scored = videos.filter(
        video =>
            typeof video.matchScore === "number" &&
            Number.isFinite(video.matchScore)
    );

    // Keep all scored candidates available for ranking.
    // Quality is represented separately by decision.
    const ranked = [...scored]
        .map(video => {
            const score = Number(video.matchScore);

            return {
                ...video,
                decision: getDecision(score),
                matchReason: getReason(score)
            };
        })
        .sort(
            (a, b) =>
                b.matchScore - a.matchScore
        );

    // Return the best candidates up to the requested target.
    const finalResults =
        ranked.slice(0, target);

    const aboveThreshold =
        scored.filter(
            video =>
                video.matchScore >= threshold
        ).length;

    const matches =
        scored.filter(
            video =>
                video.matchScore >= 75
        ).length;

    const possible =
        scored.filter(
            video =>
                video.matchScore >= 45 &&
                video.matchScore < 75
        ).length;

    const rejected =
        scored.filter(
            video =>
                video.matchScore < 45
        ).length;

    return {
        results: finalResults,

        rejected: ranked.filter(
            video =>
                video.matchScore < 45
        ),

        stats: {
            candidates: videos.length,
            scored: scored.length,

            aboveThreshold,

            matches,
            possible,
            rejected,

            target,

            returned:
                finalResults.length,

            shortfall:
                Math.max(
                    0,
                    target - finalResults.length
                ),

            threshold
        }
    };
}

function prepareUnscoredResults(
    videos,
    target = 20
) {
    return videos
        .slice(0, target)
        .map(video => ({
            ...video,
            matchScore: null,
            decision: "not_scored",
            matchReason:
                "Product image unavailable for visual matching."
        }));
}

module.exports = {
    filterAndRankVideos,
    prepareUnscoredResults
};