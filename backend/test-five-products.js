require("dotenv").config();

const fs = require("fs");
const path = require("path");

const { extractProduct } = require("./productExtractor");
const { analyzeProductImage } = require("./geminiAnalyzer");

const products = [
    {
        name: "Red Regular Fit Shirt",
        url: "https://www.jackjones.in/products/901900801-red-regular-fit-shirt"
    },
    {
        name: "Black Solid Shirt",
        url: "https://www.jackjones.in/products/12143999-black"
    },
    {
        name: "Solid Jeans",
        url: "https://www.jackjones.in/products/12126224-black"
    },
    {
        name: "Black Colourblocked Hooded Jacket",
        url: "https://www.jackjones.in/products/160210501-black"
    },
    {
        name: "Check Shirt",
        url: "https://www.jackjones.in/products/12125661-burnthenna"
    }
];

async function main() {
    const results = [];

    console.log("======================================");
    console.log("5-PRODUCT IMAGE ANALYSIS TEST");
    console.log("======================================\n");

    for (let i = 0; i < products.length; i++) {
        const item = products[i];

        console.log(
            `\n[${i + 1}/5] ${item.name}`
        );

        try {
            console.log("Extracting product...");

            const product =
                await extractProduct(item.url);

            if (!product.image) {
                throw new Error(
                    "Product image was not extracted."
                );
            }

            console.log("Analyzing product image...");

            const analysis =
                await analyzeProductImage(
                    product.image
                );

            const result = {
                testNumber: i + 1,
                inputName: item.name,
                inputUrl: item.url,
                extractedTitle: product.title,
                extractedDescription:
                    product.description,
                productImage: product.image,
                analysis,
                status: "success"
            };

            results.push(result);

            console.log("✓ Success");
            console.log(
                JSON.stringify(analysis, null, 2)
            );

        } catch (error) {
            console.error(
                `✗ Failed: ${error.message}`
            );

            results.push({
                testNumber: i + 1,
                inputName: item.name,
                inputUrl: item.url,
                status: "failed",
                error: error.message
            });
        }
    }

    const outputDirectory =
        path.join(
            __dirname,
            "test-results"
        );

    fs.mkdirSync(
        outputDirectory,
        { recursive: true }
    );

    const outputPath =
        path.join(
            outputDirectory,
            "five-products-analysis.json"
        );

    fs.writeFileSync(
        outputPath,
        JSON.stringify(
            {
                generatedAt:
                    new Date().toISOString(),
                totalProducts:
                    products.length,
                successfulTests:
                    results.filter(
                        item =>
                            item.status === "success"
                    ).length,
                failedTests:
                    results.filter(
                        item =>
                            item.status === "failed"
                    ).length,
                results
            },
            null,
            2
        )
    );

    console.log("\n======================================");
    console.log("TEST COMPLETE");
    console.log("======================================");

    console.log(
        `Successful: ${
            results.filter(
                item =>
                    item.status === "success"
            ).length
        }/${products.length}`
    );

    console.log(
        `Evidence saved to: ${outputPath}`
    );
}

main().catch(error => {
    console.error(
        "\nTest failed:",
        error.message
    );
});