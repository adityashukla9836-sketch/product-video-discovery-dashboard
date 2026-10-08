const { searchInstagramReels } = require("./instagramCollector");
const { searchMetaVideoAds } = require("./metaCollector");

// --------------------------------------------------
// Timeout / retry helpers (change #5)
// --------------------------------------------------

/**
 * Wraps a promise with a hard timeout.
 * @param {Promise} promise
 * @param {number}  ms
 * @param {string}  label  – used in the timeout error message
 */
function withTimeout(promise, ms, label = "operation") {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(
                new Error(
                    `${label} timed out after ${ms / 1000}s`
                )
            );
        }, ms);

        promise.then(
            result => {
                clearTimeout(timer);
                resolve(result);
            },
            err => {
                clearTimeout(timer);
                reject(err);
            }
        );
    });
}

/**
 * Retries an async factory function on failure.
 * @param {() => Promise}  fn
 * @param {number}         maxAttempts
 * @param {number}         baseDelayMs
 */
async function withRetry(fn, maxAttempts = 2, baseDelayMs = 1500) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
                const delay = baseDelayMs * Math.pow(2, attempt - 1);
                console.warn(
                    `Attempt ${attempt}/${maxAttempts} failed (${error.message}). ` +
                    `Retrying in ${delay / 1000}s...`
                );
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    throw lastError;
}

// Timeout limits for each source (ms)
const INSTAGRAM_TIMEOUT_MS = 120_000; // 2 min – Apify actors can be slow
const META_TIMEOUT_MS      = 120_000;


function uniqueVideos(videos) {
    const seen = new Set();
    const result = [];

    for (const video of videos) {
        const key =
            video.videoId
                ? `${video.platform}:${video.videoId}`
                : `${video.platform}:${video.videoUrl}`;

        if (!seen.has(key)) {
            seen.add(key);
            result.push(video);
        }
    }

    return result;
}

function usableVideos(videos) {
    return videos.filter(video =>
        video.videoUrl &&
        video.thumbnail
    );
}

async function collectVideos(queries, options = {}) {
    const instagramTarget = options.instagramTarget || 20;
    const metaTarget = options.metaTarget || 20;

    const instagramPages = options.instagramPages || 2;
    const metaMaxResults = options.metaMaxResults || 40;

    const cleanQueries = [
        ...new Set(
            queries
                .map(query => String(query).trim())
                .filter(Boolean)
        )
    ];

    const instagramResults = [];
    const metaResults = [];
    const sourceErrors = [];

    console.log("Queries to search:");
    console.log(cleanQueries);

    for (const query of cleanQueries) {
        console.log(`\n========== SEARCHING: ${query} ==========`);

        const [instagramResult, metaResult] =
            await Promise.allSettled([
                // Instagram – timeout + 1 retry (change #5)
                withRetry(
                    () => withTimeout(
                        searchInstagramReels(query, {
                            maxPages: instagramPages
                        }),
                        INSTAGRAM_TIMEOUT_MS,
                        `Instagram search "${query}"`
                    ),
                    2
                ),

                // Meta – timeout + 1 retry (change #5)
                withRetry(
                    () => withTimeout(
                        searchMetaVideoAds(query, {
                            maxResults: metaMaxResults
                        }),
                        META_TIMEOUT_MS,
                        `Meta search "${query}"`
                    ),
                    2
                )
            ]);

        if (instagramResult.status === "fulfilled") {
            instagramResults.push(...instagramResult.value);
        } else {
            sourceErrors.push({
                platform: "instagram",
                query,
                error: instagramResult.reason?.message || "Unknown error"
            });

            console.error(
                "Instagram error:",
                instagramResult.reason?.message
            );
        }

        if (metaResult.status === "fulfilled") {
            metaResults.push(...metaResult.value);
        } else {
            sourceErrors.push({
                platform: "meta",
                query,
                error: metaResult.reason?.message || "Unknown error"
            });

            console.error(
                "Meta error:",
                metaResult.reason?.message
            );
        }

        const uniqueInstagram = uniqueVideos(
            instagramResults
        );

        const uniqueMeta = uniqueVideos(
            metaResults
        );

        const usableInstagram = usableVideos(
            uniqueInstagram
        );

        const usableMeta = usableVideos(
            uniqueMeta
        );

        console.log(
            `Instagram usable: ${usableInstagram.length}/${instagramTarget}`
        );

        console.log(
            `Meta usable: ${usableMeta.length}/${metaTarget}`
        );

        if (
            usableInstagram.length >= instagramTarget &&
            usableMeta.length >= metaTarget
        ) {
            break;
        }
    }

    const finalInstagram = usableVideos(
        uniqueVideos(instagramResults)
    ).slice(0, instagramTarget);

    const finalMeta = usableVideos(
        uniqueVideos(metaResults)
    ).slice(0, metaTarget);

    return {
        instagram: finalInstagram,
        meta: finalMeta,

        counts: {
            instagram: finalInstagram.length,
            meta: finalMeta.length
        },

        targets: {
            instagram: instagramTarget,
            meta: metaTarget
        },

        sourceErrors
    };
}

module.exports = {
    collectVideos,
    uniqueVideos,
    usableVideos
};