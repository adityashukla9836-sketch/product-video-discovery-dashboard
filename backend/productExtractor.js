const { chromium } = require("playwright");

async function extractProduct(url) {
    const browser = await chromium.launch({
        headless: true
    });

    try {
        const page = await browser.newPage();

        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        const product = await page.evaluate(() => {
            const getMeta = (selector) => {
                const element = document.querySelector(selector);
                return element ? element.getAttribute("content") : null;
            };

            // Try JSON-LD product data first
            const jsonLdScripts = Array.from(
                document.querySelectorAll('script[type="application/ld+json"]')
            );

            let jsonLdProduct = null;

            for (const script of jsonLdScripts) {
                try {
                    const data = JSON.parse(script.textContent);

                    const items = Array.isArray(data) ? data : [data];

                    const found = items.find((item) => {
                        if (!item) return false;

                        if (item["@type"] === "Product") {
                            return true;
                        }

                        if (
                            Array.isArray(item["@graph"]) &&
                            item["@graph"].some(
                                (entry) => entry["@type"] === "Product"
                            )
                        ) {
                            return true;
                        }

                        return false;
                    });

                    if (found) {
                        jsonLdProduct = found["@type"] === "Product"
                            ? found
                            : found["@graph"].find(
                                  (entry) => entry["@type"] === "Product"
                              );

                        break;
                    }
                } catch (error) {
                    // Ignore invalid JSON-LD
                }
            }

            const title =
                jsonLdProduct?.name ||
                getMeta('meta[property="og:title"]') ||
                document.querySelector("h1")?.innerText ||
                document.title ||
                null;

            const description =
                jsonLdProduct?.description ||
                getMeta('meta[property="og:description"]') ||
                getMeta('meta[name="description"]') ||
                null;

            const image =
                (typeof jsonLdProduct?.image === "string"
                    ? jsonLdProduct.image
                    : Array.isArray(jsonLdProduct?.image)
                    ? jsonLdProduct.image[0]
                    : null) ||
                getMeta('meta[property="og:image"]') ||
                document.querySelector("img")?.src ||
                null;

            return {
                title,
                description,
                image
            };
        });

        return {
            url,
            ...product
        };
    } finally {
        await browser.close();
    }
}

module.exports = {
    extractProduct
};