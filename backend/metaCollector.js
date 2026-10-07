const { ApifyClient } = require("apify-client");

async function searchMetaVideoAds(query, options = {}) {
    const client = new ApifyClient({
        token: process.env.APIFY_API_TOKEN
    });

    const maxResults = options.maxResults || 40;
    const country = options.country || process.env.META_COUNTRY || "US";

    const input = {
        searchTerms: [query],
        countries: ["IN", "US"],
        adStatus: "all",
        mediaTypes: ["video"],
        maxResults
    };

    console.log(`Meta search: "${query}"`);

    const run = await client
        .actor("coregent/facebook-ads-library-scraper")
        .call(input);

    const { items } = await client
        .dataset(run.defaultDatasetId)
        .listItems();

    const results = [];

    for (const item of items) {
        const media = item.creative?.media || [];

        const videos = media.filter(
            (mediaItem) =>
                mediaItem.type === "video" &&
                mediaItem.url
        );

        for (const video of videos) {
            results.push({
                platform: "meta",
                videoId: item.adArchiveId || null,
                videoUrl: video.url,
                thumbnail: video.thumbnailUrl || null,
                caption: item.creative?.body || "",
                advertiser: item.advertiser?.name || null,
                adLibraryUrl: item.adLibraryUrl || null,
                publisherPlatforms:
                    item.delivery?.publisherPlatforms || [],
                startDate: item.delivery?.startDate || null,
                endDate: item.delivery?.endDate || null,
                ctaUrl: item.creative?.linkUrl || null,
                ctaText: item.creative?.ctaText || null,
                searchQuery: query
            });
        }
    }

    return results;
}

module.exports = {
    searchMetaVideoAds
};