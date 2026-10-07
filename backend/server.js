const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { randomUUID } = require("crypto");
const { runSearch } = require("./searchService");

const {
    saveSearch,
    getSearch,
    getSearchHistory
} = require("./database");

const app = express();

app.use(cors());
app.use(express.json());

const searches = new Map();

const PORT = process.env.PORT || 3000;

// --------------------------------------------------
// Product URL validation
// --------------------------------------------------

function validateProductUrl(productUrl) {
    if (!productUrl) {
        return null;
    }

    let parsedUrl;

    try {
        parsedUrl = new URL(productUrl);
    } catch {
        return "Invalid product URL.";
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return "Only HTTP and HTTPS URLs are allowed.";
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    const blockedHosts = [
        "localhost",
        "127.0.0.1",
        "::1",
        "0.0.0.0"
    ];

    if (blockedHosts.includes(hostname)) {
        return "This URL is not allowed.";
    }

    return null;
}

// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get("/", (req, res) => {
    res.json({
        message: "Product Video Discovery API is running"
    });
});

// --------------------------------------------------
// Start search
// --------------------------------------------------

app.post("/api/search", async (req, res) => {
    try {
       const {
    productUrl,
    productName,
    showPreviouslySeen = false
} = req.body;

        if (productUrl) {
            const urlError = validateProductUrl(productUrl);

            if (urlError) {
                return res.status(400).json({
                    success: false,
                    error: urlError
                });
            }
        }

        const searchId = randomUUID();

        const search = {
            id: searchId,

            input: {
                productUrl: productUrl || null,
                productName: productName || null
            },

            status: "queued",

            progress: [],

            result: null,

            error: null,

            createdAt: new Date().toISOString(),

            startedAt: null,

            completedAt: null
        };

        // Keep active search in memory
        searches.set(searchId, search);

        // Also save it permanently in SQLite
        saveSearch(search);

        // Return immediately
        res.status(202).json({
            success: true,
            searchId,
            status: "queued",
            message: "Search started."
        });

        // --------------------------------------------------
        // Background search
        // --------------------------------------------------

        setImmediate(async () => {
            const currentSearch = searches.get(searchId);

            if (!currentSearch) {
                return;
            }

            currentSearch.status = "running";
            currentSearch.startedAt =
                new Date().toISOString();

            saveSearch(currentSearch);

            try {
                const result = await runSearch(
    {
        productUrl,
        productName,
        showPreviouslySeen,
        searchId
    },
                    progressUpdate => {
                        currentSearch.progress.push({
                            ...progressUpdate,
                            timestamp:
                                new Date().toISOString()
                        });

                        saveSearch(currentSearch);

                        console.log(
                            `[${searchId}] ${progressUpdate.message}`
                        );
                    }
                );

                currentSearch.result = result;

                currentSearch.status = "completed";

                currentSearch.completedAt =
                    new Date().toISOString();

                saveSearch(currentSearch);

            } catch (error) {
                console.error(
                    `[${searchId}] Search failed:`,
                    error
                );

                currentSearch.status = "failed";

                currentSearch.error = {
                    message:
                        error.message ||
                        "Search failed."
                };

                currentSearch.completedAt =
                    new Date().toISOString();

                saveSearch(currentSearch);
            }
        });

    } catch (error) {
        console.error(
            "POST /api/search error:",
            error
        );

        res.status(500).json({
            success: false,
            error: "Failed to start search."
        });
    }
});

// --------------------------------------------------
// Get search status/result
// --------------------------------------------------

app.get("/api/search/:id", (req, res) => {
    let search = searches.get(req.params.id);

    // If not in memory, get it from SQLite
    if (!search) {
        search = getSearch(req.params.id);
    }

    if (!search) {
        return res.status(404).json({
            success: false,
            error: "Search not found."
        });
    }

    res.json({
        success: true,
        search
    });
});

// --------------------------------------------------
// Search history
// --------------------------------------------------

app.get("/api/history", (req, res) => {
    const history = getSearchHistory();

    res.json({
        success: true,
        history
    });
});

// --------------------------------------------------
// Error handler
// --------------------------------------------------

app.use((err, req, res, next) => {
    console.error(
        "Unhandled error:",
        err
    );

    res.status(500).json({
        success: false,
        error: "Internal server error."
    });
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(PORT, () => {
    console.log(
        `Product Video Discovery API running on http://localhost:${PORT}`
    );
});