require("dotenv").config();

const { collectVideos } = require("./videoCollector");

async function main() {
    const queries = [
        "button-up shirt",
        "red shirt",
        "oversized shirt"
    ];

    console.log("Starting combined video collection...\n");

    const result = await collectVideos(queries, {
        instagramTarget: 20,
        metaTarget: 20,
        instagramPages: 2,
        metaMaxResults: 40
    });

    console.log("\n========== RESULTS ==========");

    console.log(
        `Instagram videos: ${result.instagram.length}`
    );

    console.log(
        `Meta videos: ${result.meta.length}`
    );

    console.log("\n========== COUNTS ==========");

    console.log(result.counts);

    console.log("\n========== ERRORS ==========");

    console.log(result.sourceErrors);

    console.log("\n========== FIRST INSTAGRAM ==========");

    console.log(
        JSON.stringify(result.instagram[0], null, 2)
    );

    console.log("\n========== FIRST META ==========");

    console.log(
        JSON.stringify(result.meta[0], null, 2)
    );
}

main().catch((error) => {
    console.error("Combined collection failed:");
    console.error(error);
});