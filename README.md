# Product Video Discovery Dashboard

AI-powered full-stack dashboard for discovering short-form product videos from Instagram Reels and Meta Ads Library.

The system accepts a product name/keyword or product URL, collects candidate videos, removes duplicates and previously seen videos, performs visual similarity matching, ranks results, and presents the results in a React dashboard.

## 1. Project Objective

The goal is to help users discover short-form videos that visually match a target product instead of relying only on keyword similarity.

The implementation follows the take-home assignment requirements:

* 20 Instagram Reels
* 20 Meta Ads Library video results
* Product URL extraction
* AI product-image analysis
* Search query generation
* Visual product matching
* 0–100 visual match score
* Duplicate removal
* Previously-seen video tracking
* Search history
* Progress state
* Error and empty states
* Responsive React dashboard

## 2. Technology Stack

### Frontend

* React
* Vite
* JavaScript
* CSS

### Backend

* Node.js
* Express
* JavaScript
* Playwright

### Data Store

* SQLite

SQLite stores:

* Search history
* Search status/progress
* Previously seen videos
* Video identifiers and metadata

### AI / Vision

* Google Gemini
* CLIP (`Xenova/clip-vit-base-patch32`)
* Hugging Face Transformers.js

Gemini is used for product understanding and query generation.

CLIP is used for scalable image-to-image visual similarity scoring.

### Video Sources

* Instagram Reels through Apify
* Meta Ads Library video ads through Apify

## 3. Architecture

```text
React Dashboard
       |
       v
POST /api/search
       |
       v
Background Search Job
       |
       +------------------------+
       |                        |
       v                        v
Product URL Extraction      Product Name
       |
       v
Playwright
       |
       v
Product title + description + image
       |
       v
Gemini Product Analysis
       |
       v
Search Queries / Hashtags
       |
       +---------------------------+
       |                           |
       v                           v
Instagram Collection         Meta Collection
       |                           |
       +-------------+-------------+
                     |
                     v
              Candidate Videos
                     |
                     v
              SQLite History Check
                     |
                     v
                CLIP Matching
                     |
                     v
             Visual Match Score
                  0–100
                     |
                     v
              Filter + Rank
                     |
                     v
             Final Results
                20 + 20
                     |
                     v
              React Dashboard
```

## 4. Product URL Input

For a product URL, the backend opens the page using Playwright and attempts to extract:

* Product title
* Product description
* Main product image

The extractor first checks structured product information such as JSON-LD and then uses Open Graph and page-level fallbacks.

Example:

```text
https://www.jackjones.in/products/901900801-red-regular-fit-shirt
```

## 5. Product Image Analysis

Gemini analyzes the product image and extracts attributes including:

* Product type
* Colors
* Graphics or patterns
* Logos
* Visible text
* Material appearance
* Shape / fit

These attributes are then used to generate better search queries.

Example:

```text
dusty rose button-up shirt
button-up shirt textured weave pattern
dusty rose textured weave pattern button-up shirt
button-up shirt woven fabric
```

This improves candidate discovery beyond using only the original product title.

## 6. Video Collection

The backend collects candidate videos from Instagram and Meta in parallel per search query.

Multiple search queries can be used.

The collector:

* Removes duplicate videos
* Requires a usable video URL
* Requires a usable thumbnail
* Handles source failures independently
* Collects additional candidates when required
* Keeps source errors separate from successful results

### Instagram

Instagram Reel metadata can include:

* Reel ID
* Reel URL
* Video URL
* Thumbnail
* Caption
* Creator
* Views
* Likes
* Comments
* Search query

### Meta

Meta video-ad metadata can include:

* Ad ID
* Video URL
* Thumbnail
* Ad copy
* Advertiser
* Ads Library URL
* Publisher platforms
* Start/end date
* CTA URL
* CTA text
* Search query

## 7. Visual Matching

The system uses CLIP image embeddings for visual similarity.

The target product image is embedded once and reused.

Each candidate video thumbnail is embedded and compared with the product embedding using cosine similarity.

```text
Product image
     |
     v
CLIP embedding
     |
     +-------------------+
     |        |          |
     v        v          v
Video 1   Video 2    Video 3
embedding embedding  embedding
     |        |          |
     +--------+----------+
              |
              v
       Cosine similarity
              |
              v
        Score 0–100
```

Current decision thresholds:

```text
75–100  → match
45–74   → possible
0–44    → reject
```

The score is used for ranking and filtering. It is a similarity score, not a statistical probability of exact identity.

## 8. Candidate Expansion

The system does not assume that the first 20 collected videos are automatically the best 20.

The process can expand the search using additional query variations such as:

* `for men`
* `fashion`
* `outfit`
* `styling`
* `try on`
* `look`
* `clothing`

The system can run up to three collection/matching rounds.

If fewer than 20 usable results remain, additional candidates are collected where possible.

If a source genuinely returns fewer usable results, the system reports the shortfall instead of fabricating results.

## 9. Deduplication and Previously Seen Videos

Each video receives a unique key based primarily on:

```text
platform + videoId
```

If a platform video ID is unavailable, the video URL is used as the fallback identifier.

SQLite stores previously discovered videos.

During a new search:

```text
Candidate video
      |
      v
Already seen?
   /       \
 YES       NO
  |         |
Hide      Keep
```

The dashboard also supports:

```text
Show previously seen videos
```

## 10. Search History

SQLite stores:

* Search ID
* Product URL/name
* Search status
* Progress history
* Result data
* Error information
* Created time
* Start time
* Completion time

The API exposes search history through:

```text
GET /api/history
```

## 11. API Endpoints

### Health

```http
GET /
```

### Start Search

```http
POST /api/search
```

Example URL search body:

```json
{
  "productUrl": "https://example.com/product"
}
```

Example name search body:

```json
{
  "productName": "red shirt"
}
```

Optional:

```json
{
  "showPreviouslySeen": true
}
```

### Get Search Status / Result

```http
GET /api/search/:id
```

The response includes:

* Search status
* Progress messages
* Product information
* Generated queries
* Instagram results
* Meta results
* Match information
* Counts
* Shortfall information
* Source errors

### Search History

```http
GET /api/history
```

## 12. Background Processing

`POST /api/search` returns immediately with a search ID.

The actual search runs in the background.

Example:

```text
POST /api/search
      |
      v
202 Accepted
      |
      v
Search ID
      |
      v
Background processing
      |
      v
GET /api/search/:id
```

The React dashboard polls the search-status endpoint and displays progress.

## 13. Error Handling

The system handles:

* Invalid product URLs
* Unsupported URL protocols
* Blocked local/loopback URLs
* Product extraction failures
* Missing product images
* Source-specific collection errors
* Missing thumbnails
* Visual matching failures
* Empty results
* Shortfall after additional collection attempts

Temporary AI service errors can be retried.

Daily API quota exhaustion is treated differently from temporary service failures and is surfaced as an error rather than retried indefinitely.

## 14. Rate Limits and Source Limitations

Instagram and Meta collection uses third-party Apify actors rather than direct first-party social APIs.

Possible limitations include:

* Rate limiting
* Temporary source unavailability
* Login/access restrictions
* Search-result variation
* Missing thumbnails or media
* Provider-side changes
* Fewer than the requested number of usable results

The system continues with successful sources when possible and records source errors separately.

## 15. Environment Variables

Create a local:

```text
backend/.env
```

using:

```env
GEMINI_API_KEY=
APIFY_API_TOKEN=
PORT=3000
```

A safe template is provided as:

```text
backend/.env.example
```

Real secrets are not committed to Git.

## 16. Installation

### Backend

```bash
cd backend
npm install
```

Install Playwright Chromium if required:

```bash
npx playwright install chromium
```

### Frontend

```bash
cd frontend
npm install
```

## 17. Running the Project

### Start backend

```bash
cd backend
node server.js
```

Backend:

```text
http://localhost:3000
```

### Start frontend

In another terminal:

```bash
cd frontend
npm run dev
```

Frontend:

```text
http://localhost:5173
```

## 18. Project Structure

```text
product-video-dashboard-our-build/
│
├── backend/
│   ├── server.js
│   ├── database.js
│   ├── searchService.js
│   ├── videoCollector.js
│   ├── videoMatcher.js
│   ├── clipMatcher.js
│   ├── resultProcessor.js
│   ├── instagramCollector.js
│   ├── metaCollector.js
│   ├── productExtractor.js
│   ├── geminiAnalyzer.js
│   ├── queryGenerator.js
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
└── README.md
```

## 19. Dashboard Features

The React dashboard provides:

* Product URL input
* Product name input
* Search button
* Previously-seen toggle
* Search progress
* Product information panel
* Instagram / Meta tabs
* Result counts
* Match-score filtering
* Sorting
* Video thumbnails
* Captions/ad copy
* Match information
* Open-video links
* Search history
* Empty states
* Error states
* Responsive layout

## 20. Testing

The backend contains focused test scripts for:

* Browser/product extraction
* Instagram collection
* Meta collection
* Combined video collection
* Gemini product analysis
* Visual matching
* CLIP matching

Before final submission, the application should be tested using five different products and the results should be captured as submission evidence.

Recommended evidence for each product:

```text
Product URL
Extracted title
Extracted image
Generated queries
Instagram result count
Meta result count
Visual matching output
Shortfall/errors, if any
```

## 21. Known Limitations

### Product-name-only searches

When only a product name is supplied and no product image is available, the system can collect videos but cannot perform true image-to-image visual matching for that search.

For the complete image-analysis and visual-matching workflow, use a product URL that exposes a product image.

### Social-platform availability

Instagram and Meta result availability depends on the data returned by the external collection provider at search time.

### Visual score calibration

The CLIP score is a similarity score derived from cosine similarity and is not a calibrated probability of exact product identity. The threshold should be refined further using evaluation data from the five-product test set.

## 22. Security

* API keys are stored in environment variables.
* `.env` files are excluded from Git.
* Database files are excluded from Git.
* `node_modules` is excluded from Git.
* Local/loopback URLs are blocked by backend validation.
* No real API secrets are included in the repository.

## 23. Submission Checklist

Before submission:

* [ ] Backend runs successfully
* [ ] Frontend runs successfully
* [ ] Product URL extraction works
* [ ] Product image analysis works
* [ ] Query generation works
* [ ] Instagram collection works
* [ ] Meta collection works
* [ ] CLIP visual matching works
* [ ] Duplicate handling works
* [ ] Previously-seen handling works
* [ ] Search history works
* [ ] Progress states work
* [ ] Error states work
* [ ] Five-product test evidence is captured
* [ ] `.env.example` contains no real secrets
* [ ] `.env` is ignored by Git
* [ ] Database is ignored by Git
* [ ] README is included
* [ ] Demo video is prepared
* [ ] Git repository contains no real credentials

## 24. Assignment Alignment

This implementation is designed around the required areas of the take-home assignment:

* Video sourcing
* Image analysis
* Visual matching
* Uniqueness and deduplication
* Backend/API design
* React dashboard
* Documentation and demo evidence

Optional capabilities such as TikTok sourcing, export, and Docker were not prioritized ahead of the required functionality.
