const { searchInstagramReels } = require("./instagramCollector");
const { searchMetaVideoAds } = require("./metaCollector");

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
                searchInstagramReels(query, {
                    maxPages: instagramPages
                }),

                searchMetaVideoAds(query, {
                    maxResults: metaMaxResults
                })
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