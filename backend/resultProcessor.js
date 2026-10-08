const DEFAULT_THRESHOLD = 45;

// --------------------------------------------------
// Near-duplicate strategy (change #3)
// --------------------------------------------------

/**
 * Remove near-duplicate videos from a ranked list.
 *
 * Two videos are considered near-duplicates when:
 *   1. They are from the same platform, AND
 *   2. Their matchScore values differ by ≤ NEAR_DUP_SCORE_WINDOW, AND
 *   3. Their captions share ≥ NEAR_DUP_CAPTION_SIMILARITY of tokens.
 *
 * Caption-token Jaccard similarity is a lightweight proxy that avoids
 * loading a full embedding model here. Videos with empty captions are
 * never considered caption-duplicates.
 *
 * The higher-scored video in each pair is always kept.
 */
const NEAR_DUP_SCORE_WINDOW     = 3;   // max score gap to check
const NEAR_DUP_CAPTION_JACCARD  = 0.80; // ≥80 % shared tokens → duplicate
const NEAR_DUP_THUMBNAIL_WINDOW = 2;   // matchScore window for thumbnail check

function tokenize(text) {
    if (!text || typeof text !== "string") return new Set();
    return new Set(
        text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter(t => t.length > 2)
    );
}

function jaccardSimilarity(setA, setB) {
    if (setA.size === 0 || setB.size === 0) return 0;
    const intersection = [...setA].filter(t => setB.has(t)).length;
    const union = new Set([...setA, ...setB]).size;
    return intersection / union;
}

function deduplicateNearDuplicates(rankedVideos) {
    const kept = [];

    for (const candidate of rankedVideos) {
        let isDuplicate = false;

        for (const accepted of kept) {
            // Only compare within the same platform
            if (candidate.platform !== accepted.platform) {
                continue;
            }

            // Scores must be close enough to bother checking
            const scoreDiff = Math.abs(
                (candidate.matchScore ?? 0) -
                (accepted.matchScore  ?? 0)
            );

            if (scoreDiff > NEAR_DUP_SCORE_WINDOW + NEAR_DUP_THUMBNAIL_WINDOW) {
                continue;
            }

            // Compare captions
            const tokensA = tokenize(accepted.caption);
            const tokensB = tokenize(candidate.caption);
            const jaccard = jaccardSimilarity(tokensA, tokensB);

            if (jaccard >= NEAR_DUP_CAPTION_JACCARD) {
                isDuplicate = true;
                console.log(
                    `[dedup] Dropped near-duplicate (Jaccard ${jaccard.toFixed(2)}, ` +
                    `score diff ${scoreDiff}): ${candidate.platform} ${candidate.videoId || candidate.videoUrl}`
                );
                break;
            }
        }

        if (!isDuplicate) {
            kept.push(candidate);
        }
    }

    return kept;
}


function getDecision(score) {
    if (score >= 75) {
        return "match";
    }

    if (score >= 45) {
        return "possible";
    }

    return "reject";
}

/**
 * Build a human-readable match reason that functions as evidence
 * for why this video was selected (change #2).
 *
 * @param {number} score      – 0-100 CLIP cosine similarity score
 * @param {object} [analysis] – Gemini product analysis (may be null)
 * @param {object} [video]    – the video object (may be null)
 */
function getReason(score, analysis = null, video = null) {
    const scoreStr = `(visual score: ${score}/100)`;

    // Build attribute list from Gemini analysis for richer evidence
    const attrs = [];

    if (analysis) {
        if (analysis.productType) attrs.push(analysis.productType);
        if (Array.isArray(analysis.colors) && analysis.colors.length) {
            attrs.push(analysis.colors.slice(0, 2).join("/") + " color");
        }
        if (Array.isArray(analysis.graphics) && analysis.graphics.length) {
            attrs.push(analysis.graphics[0] + " graphic");
        }
        if (Array.isArray(analysis.logos) && analysis.logos.length) {
            attrs.push(analysis.logos[0] + " logo");
        }
        if (analysis.material) attrs.push(analysis.material + " material");
    }

    const attrStr = attrs.length
        ? ` Matched attributes: ${attrs.join(", ")}.`
        : "";

    if (score >= 85) {
        return `Very strong visual match – product type, color, and details closely align ${scoreStr}.${attrStr}`;
    }

    if (score >= 70) {
        return `Strong visual match – key product characteristics visible in thumbnail ${scoreStr}.${attrStr}`;
    }

    if (score >= 55) {
        return `Moderate visual match – similar product category and color palette ${scoreStr}.${attrStr}`;
    }

    if (score >= 45) {
        return `Possible visual match – some shared visual features detected ${scoreStr}.${attrStr}`;
    }

    return `Low visual similarity with target product ${scoreStr}.`;
}

function filterAndRankVideos(videos, options = {}) {
    const threshold =
        options.threshold ?? DEFAULT_THRESHOLD;

    const target =
        options.target ?? 20;

    // Gemini analysis used for richer evidence (change #2)
    const analysis = options.analysis ?? null;

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
                matchReason: getReason(score, analysis, video)
            };
        })
        .sort(
            (a, b) =>
                b.matchScore - a.matchScore
        );

    // Apply near-duplicate removal before slicing (change #3)
    const deduplicated = deduplicateNearDuplicates(ranked);

    // Return the best unique candidates up to the requested target.
    const finalResults =
        deduplicated.slice(0, target);

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

        rejected: deduplicated.filter(
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

            nearDuplicatesRemoved:
                ranked.length - deduplicated.length,

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