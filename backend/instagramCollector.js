const { ApifyClient } = require("apify-client");

async function searchInstagramReels(query, options = {}) {
    const client = new ApifyClient({
        token: process.env.APIFY_API_TOKEN
    });

    const maxPages = options.maxPages || 2;

    const run = await client
        .actor("parsebird/instagram-reels-search-scraper")
        .call({
            query,
            maxPages,
            expandRelatedSearches: true,
            includeDetails: true
        });

    const { items } = await client
        .dataset(run.defaultDatasetId)
        .listItems();

    return items
        .filter((item) => item.is_video)
        .map((item) => ({
            platform: "instagram",
            videoId: item.id,
            videoUrl: item.url,
            mediaUrl: item.video_url || null,
            thumbnail: item.thumbnail_url || null,
            caption: item.caption?.text || "",
            creator: item.user?.username || null,
            views: item.ig_play_count || 0,
            likes: item.like_count || 0,
            comments: item.comment_count || 0,
            searchQuery: item.matched_keyword || query
        }));
}

module.exports = {
    searchInstagramReels
};