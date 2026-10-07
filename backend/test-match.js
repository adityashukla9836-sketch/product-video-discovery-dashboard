require("dotenv").config();

const { collectVideos } = require("./videoCollector");
const { matchVideos } = require("./videoMatcher");

async function main() {
    console.log("Collecting videos...");

    const result = await collectVideos(
        ["red shirt", "button-up shirt"],
        {
            instagramTarget: 3,
            metaTarget: 3,
            instagramPages: 1,
            metaMaxResults: 5
        }
    );

    const productImageUrl =
        "http://www.jackjones.in/cdn/shop/files/901900801_g0_64ebfe4f-be35-4414-8f8d-47719e189bf1.jpg?v=1750838837&width=2048";

    console.log("\n========== INSTAGRAM MATCHING ==========");

    const instagramMatches = await matchVideos(
        productImageUrl,
        result.instagram,
        {
            maxVideos: 3
        }
    );

    console.log("\nInstagram results:");
    console.log(JSON.stringify(instagramMatches, null, 2));

    console.log("\n========== META MATCHING ==========");

    const metaMatches = await matchVideos(
        productImageUrl,
        result.meta,
        {
            maxVideos: 3
        }
    );

    console.log("\nMeta results:");
    console.log(JSON.stringify(metaMatches, null, 2));
}

main().catch((error) => {
    console.error("\nTest failed:", error.message);
});