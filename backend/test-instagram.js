require("dotenv").config();

const { searchInstagramReels } = require("./instagramCollector");

async function main() {
    const query = "travel";

    console.log(`Searching Instagram for: ${query}`);

    const reels = await searchInstagramReels(query);

    console.log(`Reels returned: ${reels.length}`);

    console.log("\nFirst result:");
    console.log(JSON.stringify(reels[0], null, 2));
}

main().catch((error) => {
    console.error("Instagram search error:");
    console.error(error);
});