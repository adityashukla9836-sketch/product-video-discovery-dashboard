require("dotenv").config();

const { searchMetaVideoAds } = require("./metaCollector");

async function main() {
    const query = "shirt";

    console.log(`Testing Meta search: "${query}"`);

    const videos = await searchMetaVideoAds(query, {
        maxResults: 20
    });

    console.log("\nTotal Meta video results:", videos.length);

    videos.slice(0, 10).forEach((video, index) => {
        console.log(`\nVideo ${index + 1}`);
        console.log("ID:", video.videoId);
        console.log("Video URL:", video.videoUrl);
        console.log("Thumbnail:", video.thumbnail);
        console.log("Caption:", video.caption);
        console.log("Advertiser:", video.advertiser);
        console.log("Ads Library:", video.adLibraryUrl);
    });
}

main().catch(error => {
    console.error("\nMeta test failed:");
    console.error(error.message);
});