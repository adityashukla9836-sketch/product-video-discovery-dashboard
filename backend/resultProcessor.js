const DEFAULT_THRESHOLD = 60;

function filterAndRankVideos(videos, options = {}) {
    const threshold =
        options.threshold ?? DEFAULT_THRESHOLD;

    const target =
        options.target ?? 20;

    const scored = videos.filter(
        video =>
            typeof video.matchScore === "number"
    );

    const usable = scored.filter(
        video =>
            video.matchScore >= threshold &&
            video.decision !== "error"
    );

    const rejected = scored.filter(
        video =>
            video.matchScore < threshold ||
            video.decision === "error"
    );

    const ranked = [...usable].sort(
        (a, b) =>
            b.matchScore - a.matchScore
    );

    const finalResults =
        ranked.slice(0, target).map(video => ({
            ...video,
            matchReason:
                video.matchScore >= 75
                    ? "Strong visual similarity with the target product."
                    : "Possible visual similarity with the target product."
        }));

    return {
        results: finalResults,
        rejected,
        stats: {
            candidates: videos.length,
            scored: scored.length,
            usable: usable.length,
            rejected: rejected.length,
            target,
            returned: finalResults.length,
            threshold
        }
    };
}

function prepareUnscoredResults(videos, target = 20) {
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