const { extractProduct } = require("./productExtractor");
const { analyzeProductImage } = require("./geminiAnalyzer");
const { generateSearchQueries } = require("./queryGenerator");
const { collectVideos } = require("./videoCollector");
const { matchVideos } = require("./videoMatcher");

const {
    videoAlreadySeen,
    saveVideo
} = require("./database");

const {
    filterAndRankVideos,
    prepareUnscoredResults
} = require("./resultProcessor");

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function uniqueStrings(values) {
    return [
        ...new Set(
            values
                .map(value => String(value).trim())
                .filter(Boolean)
        )
    ];
}

function getVideoKey(video) {
    return video.videoId
        ? `${video.platform}:${video.videoId}`
        : `${video.platform}:${video.videoUrl}`;
}

function mergeUniqueVideos(existing, additional) {
    const map = new Map();

    for (const video of existing) {
        map.set(getVideoKey(video), video);
    }

    for (const video of additional) {
        const key = getVideoKey(video);

        if (!map.has(key)) {
            map.set(key, video);
        }
    }

    return Array.from(map.values());
}

function markAndFilterSeenVideos(videos, showPreviouslySeen) {
    const results = [];

    for (const video of videos) {
        const videoKey = getVideoKey(video);

        const previouslySeen =
            videoAlreadySeen(videoKey);

        if (previouslySeen && !showPreviouslySeen) {
            continue;
        }

        results.push({
            ...video,
            previouslySeen
        });
    }

    return results;
}

function expandQueries(queries, productTitle) {
    const expanded = [];

    for (const query of queries) {
        expanded.push(query);

        expanded.push(`${query} for men`);
        expanded.push(`${query} fashion`);
        expanded.push(`${query} outfit`);
        expanded.push(`${query} styling`);
    }

    if (productTitle) {
        expanded.push(`${productTitle} men's fashion`);
        expanded.push(`${productTitle} outfit`);
        expanded.push(`${productTitle} styling`);
    }

    return uniqueStrings(expanded);
}

async function saveFinalVideos(videos, searchId) {
    for (const video of videos) {
        try {
            saveVideo(video, searchId);
        } catch (error) {
            console.error(
                "Could not save video:",
                error.message
            );
        }
    }
}

// --------------------------------------------------
// Main search
// --------------------------------------------------

async function runSearch(input, onProgress = () => {}) {
    const {
        productUrl,
        productName,
        showPreviouslySeen = false,
        searchId
    } = input;

    if (!productUrl && !productName) {
        throw new Error(
            "Please provide a product name or product URL."
        );
    }

    let product = null;
    let analysis = null;
    let queries = [];

    // --------------------------------------------------
    // 1. PRODUCT EXTRACTION
    // --------------------------------------------------

    if (productUrl) {
        onProgress({
            step: "extracting_product",
            message:
                "Opening product page and extracting product details..."
        });

        product = await extractProduct(productUrl);

        if (!product.title) {
            throw new Error(
                "Could not extract a product title."
            );
        }

        if (!product.image) {
            throw new Error(
                "Could not extract a product image."
            );
        }

        onProgress({
            step: "product_extracted",
            message:
                "Product information extracted successfully.",
            product: {
                title: product.title,
                image: product.image
            }
        });
    }

    const searchTerm =
        product?.title ||
        productName;

    // --------------------------------------------------
    // 2. PRODUCT IMAGE ANALYSIS
    // --------------------------------------------------

    if (product?.image) {
        onProgress({
            step: "analyzing_product",
            message:
                "Analyzing product image with AI..."
        });

        analysis =
            await analyzeProductImage(
                product.image
            );

        onProgress({
            step: "product_analyzed",
            message:
                "Product image analysis completed.",
            analysis
        });
    }

    // --------------------------------------------------
    // 3. QUERY GENERATION
    // --------------------------------------------------

    onProgress({
        step: "generating_queries",
        message:
            "Generating better search queries..."
    });

    if (analysis) {
        const generated =
            await generateSearchQueries(
                analysis
            );

        queries = uniqueStrings([
            searchTerm,
            ...(generated.queries || [])
        ]);
    } else {
        queries = [searchTerm];
    }

    onProgress({
        step: "queries_generated",
        message:
            "Search queries generated.",
        queries
    });

    // --------------------------------------------------
    // 4. MULTI-ROUND COLLECTION + MATCHING
    // --------------------------------------------------

    let allInstagramMatches = [];
    let allMetaMatches = [];

    let allInstagramCollected = [];
    let allMetaCollected = [];

    let sourceErrors = [];

    const MAX_ROUNDS = 3;

    for (let round = 1; round <= MAX_ROUNDS; round++) {

        let roundQueries;

        if (round === 1) {
            roundQueries = queries;
        } else {
            roundQueries = expandQueries(
                queries,
                product?.title
            );

            // Remove queries already attempted
           
            if (round === 3) {
                roundQueries = uniqueStrings([
                    ...roundQueries,

                    ...queries.map(
                        query => `${query} try on`
                    ),

                    ...queries.map(
                        query => `${query} look`
                    ),

                    ...queries.map(
                        query => `${query} clothing`
                    )
                ]);
            }

            // Prevent unnecessary huge query lists
            roundQueries =
                uniqueStrings(roundQueries);
        }

        onProgress({
            step: "collecting_videos",
            message:
                round === 1
                    ? "Collecting Instagram and Meta video candidates..."
                    : `Fetching additional video candidates (round ${round})...`
        });

        const collected =
            await collectVideos(
                roundQueries,
                {
                    instagramTarget: 30,
                    metaTarget: 30,

                    instagramPages: 2,
                    metaMaxResults: 30
                }
            );

        sourceErrors.push(
            ...(collected.sourceErrors || [])
        );

        // Merge candidates from all rounds
        allInstagramCollected =
            mergeUniqueVideos(
                allInstagramCollected,
                collected.instagram
            );

        allMetaCollected =
            mergeUniqueVideos(
                allMetaCollected,
                collected.meta
            );

        onProgress({
            step: "videos_collected",
            message:
                `Video collection round ${round} completed.`,
            counts: {
                instagram:
                    allInstagramCollected.length,
                meta:
                    allMetaCollected.length
            }
        });

        // --------------------------------------------------
        // HISTORY FILTER
        // --------------------------------------------------

        onProgress({
            step: "checking_history",
            message:
                "Checking previously seen videos..."
        });

        const instagramCandidates =
            markAndFilterSeenVideos(
                allInstagramCollected,
                showPreviouslySeen
            );

        const metaCandidates =
            markAndFilterSeenVideos(
                allMetaCollected,
                showPreviouslySeen
            );

        onProgress({
            step: "history_checked",
            message:
                `History check completed for round ${round}.`,
            counts: {
                instagram:
                    instagramCandidates.length,
                meta:
                    metaCandidates.length
            }
        });

        // --------------------------------------------------
        // VISUAL MATCHING
        // --------------------------------------------------

        if (product?.image) {

            onProgress({
                step: "matching_videos",
                message:
                    `Visual matching round ${round}...`
            });

            // Only match videos we have not already scored
            const scoredInstagramKeys =
                new Set(
                    allInstagramMatches.map(
                        getVideoKey
                    )
                );

            const scoredMetaKeys =
                new Set(
                    allMetaMatches.map(
                        getVideoKey
                    )
                );

            const newInstagram =
                instagramCandidates.filter(
                    video =>
                        !scoredInstagramKeys.has(
                            getVideoKey(video)
                        )
                );

            const newMeta =
                metaCandidates.filter(
                    video =>
                        !scoredMetaKeys.has(
                            getVideoKey(video)
                        )
                );

            if (newInstagram.length > 0) {
                const matches =
                    await matchVideos(
                        product.image,
                        newInstagram
                    );

                allInstagramMatches =
                    mergeUniqueVideos(
                        allInstagramMatches,
                        matches
                    );
            }

            if (newMeta.length > 0) {
                const matches =
                    await matchVideos(
                        product.image,
                        newMeta
                    );

                allMetaMatches =
                    mergeUniqueVideos(
                        allMetaMatches,
                        matches
                    );
            }

        } else {

            allInstagramMatches =
                prepareUnscoredResults(
                    instagramCandidates,
                    30
                );

            allMetaMatches =
                prepareUnscoredResults(
                    metaCandidates,
                    30
                );
        }

        // --------------------------------------------------
        // FILTER + RANK
        // --------------------------------------------------

        const instagramResult =
            product?.image
                ? filterAndRankVideos(
                    allInstagramMatches,
                    {
                        threshold: 60,
                        target: 20
                    }
                )
                : {
                    results: allInstagramMatches.slice(0, 20),
                    stats: {
                        candidates:
                            allInstagramMatches.length,
                        scored: 0,
                        usable: 0,
                        rejected: 0,
                        target: 20,
                        returned:
                            Math.min(
                                20,
                                allInstagramMatches.length
                            ),
                        threshold: null
                    }
                };

        const metaResult =
            product?.image
                ? filterAndRankVideos(
                    allMetaMatches,
                    {
                        threshold: 60,
                        target: 20
                    }
                )
                : {
                    results: allMetaMatches.slice(0, 20),
                    stats: {
                        candidates:
                            allMetaMatches.length,
                        scored: 0,
                        usable: 0,
                        rejected: 0,
                        target: 20,
                        returned:
                            Math.min(
                                20,
                                allMetaMatches.length
                            ),
                        threshold: null
                    }
                };

        onProgress({
            step: "ranking_results",
            message:
                `Round ${round}: ${instagramResult.results.length} usable Instagram, ${metaResult.results.length} usable Meta videos.`,
            counts: {
                instagram:
                    instagramResult.results.length,
                meta:
                    metaResult.results.length
            }
        });

        // --------------------------------------------------
        // STOP WHEN BOTH TARGETS ARE REACHED
        // --------------------------------------------------

        if (
            instagramResult.results.length >= 20 &&
            metaResult.results.length >= 20
        ) {
            allInstagramMatches =
                instagramResult.results;

            allMetaMatches =
                metaResult.results;

            break;
        }

        // Keep ranked results for final shortfall case
        if (round === MAX_ROUNDS) {
            allInstagramMatches =
                instagramResult.results;

            allMetaMatches =
                metaResult.results;
        }
    }

    // --------------------------------------------------
    // FINAL RANKING
    // --------------------------------------------------

    const finalInstagram =
        product?.image
            ? filterAndRankVideos(
                allInstagramMatches,
                {
                    threshold: 60,
                    target: 20
                }
            ).results
            : allInstagramMatches.slice(0, 20);

    const finalMeta =
        product?.image
            ? filterAndRankVideos(
                allMetaMatches,
                {
                    threshold: 60,
                    target: 20
                }
            ).results
            : allMetaMatches.slice(0, 20);

    // --------------------------------------------------
    // SAVE HISTORY
    // --------------------------------------------------

    await saveFinalVideos(
        finalInstagram,
        searchId
    );

    await saveFinalVideos(
        finalMeta,
        searchId
    );

    const finalCounts = {
        instagram: finalInstagram.length,
        meta: finalMeta.length
    };

    // --------------------------------------------------
    // SHORTFALL
    // --------------------------------------------------

    const shortfall = {
        instagram:
            Math.max(
                0,
                20 - finalInstagram.length
            ),

        meta:
            Math.max(
                0,
                20 - finalMeta.length
            )
    };

    onProgress({
        step: "completed",
        message:
            "Search completed.",
        counts: finalCounts
    });

    return {
        product,
        analysis,
        queries,

        instagram: finalInstagram,
        meta: finalMeta,

        counts: finalCounts,

        targets: {
            instagram: 20,
            meta: 20
        },

        matching: {
            threshold: product?.image
                ? 60
                : null
        },

        shortfall,

        showPreviouslySeen,

        sourceErrors
    };
}

module.exports = {
    runSearch
};