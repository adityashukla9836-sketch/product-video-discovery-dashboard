const { chromium } = require("playwright");

async function main() {
    const browser = await chromium.launch({
        headless: false
    });

    const page = await browser.newPage();

    await page.goto("https://example.com");

    console.log("Page title:", await page.title());

    await browser.close();
}

main().catch((error) => {
    console.error("Error:", error);
});