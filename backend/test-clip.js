require("dotenv").config();

const { collectVideos } = require("./videoCollector");
const { matchVideos } = require("./videoMatcher");

async function main() {
    console.log("Collecting Instagram + Meta videos...");

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

    console.log("\n========== INSTAGRAM ==========");

    const instagramVideos = result.instagram.slice(0, 3);

    const instagramResults = await matchVideos(
        productImageUrl,
        instagramVideos
    );

    instagramResults.forEach((video, index) => {
        console.log(
            `${index + 1}. Score: ${video.matchScore} | ${video.decision} | ${video.videoUrl}`
        );
    });

    console.log("\n========== META ==========");

    const metaVideos = result.meta.slice(0, 3);

    const metaResults = await matchVideos(
        productImageUrl,
        metaVideos
    );

    metaResults.forEach((video, index) => {
        console.log(
            `${index + 1}. Score: ${video.matchScore} | ${video.decision} | ${video.videoUrl}`
        );
    });
}

main().catch((error) => {
    console.error("\nTest failed:");
    console.error(error);
});