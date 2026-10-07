function clean(value) {
    if (!value) {
        return "";
    }

    return String(value).trim();
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function generateSearchQueries(analysis) {
    const productType = clean(analysis.productType);

    const colors = (analysis.colors || [])
        .map(clean)
        .filter(Boolean);

    const graphics = (analysis.graphics || [])
        .map(clean)
        .filter(Boolean);

    const shape = clean(analysis.shape);
    const material = clean(analysis.material);

    const mainColor = colors[0] || "";
    const mainGraphic = graphics[0] || "";

    const queries = unique([
        `${mainColor} ${productType}`.trim(),
        `${productType} ${mainGraphic}`.trim(),
        `${mainColor} ${productType} ${shape}`.trim(),
        `${productType} ${material}`.trim(),
        `${mainColor} ${mainGraphic} ${productType}`.trim(),
        `${productType} ${shape}`.trim()
    ]);

    const hashtags = unique([
        productType,
        ...colors,
        ...graphics,
        `${mainColor}${productType}`,
        `${productType}${shape}`
    ])
        .map((value) =>
            value
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "")
        )
        .filter(Boolean)
        .map((value) => `#${value}`);

    return {
        queries,
        hashtags
    };
}

module.exports = {
    generateSearchQueries
};