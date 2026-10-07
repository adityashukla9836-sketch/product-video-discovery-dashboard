require("dotenv").config();

const { searchMetaVideoAds } = require("./metaCollector");

async function main() {
    const query = "red shirt";

    console.log(`Searching Meta Ad Library for: ${query}`);

    const ads = await searchMetaVideoAds(query);

    console.log(`Video ads returned: ${ads.length}`);

    if (ads.length === 0) {
        console.log("No video ads returned.");
        return;
    }

    console.log("\nFirst normalized result:\n");
    console.log(JSON.stringify(ads[0], null, 2));
}

main().catch((error) => {
    console.error("Meta search error:");
    console.error(error);
});