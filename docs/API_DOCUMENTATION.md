# Data Storage & API Access Documentation

## Overview

The Alpine Signal Rating wizard collects anonymized and normalized submission data for benchmarking and pattern analysis. This data is stored locally on the server and accessible via API for analysis by AI agents or other tools.

---

## Data Storage

### File Location
`submissions_data.json` (in the same directory as server.js)

### Data Structure

Each submission is stored as an object with the following structure:

```json
{
  "client_id": "wizard_1729699999999",
  "timestamp": "2025-10-29T12:34:56.789Z",
  "cohort": "Cohort_2",
  "sector": "b2b_saas",
  "employees": "51-200",
  "answers": {
    "pipeline_health": 3,
    "sales_conversion": 2,
    "customer_success": 4,
    "economics_efficiency": 3,
    "top_challenge": "conversion"
  },
  "scores": {
    "overall_ssi": 0.67,
    "pipeline": 0.72,
    "conversion": 0.58,
    "expansion": 0.71
  },
  "patterns": [
    {
      "pattern": "pipeline_conversion_gap",
      "description": "Strong pipeline but weak conversion - focus on sales enablement",
      "priority": "high"
    }
  ]
}
```

### Field Definitions

#### Identifiers & Metadata
- **client_id**: Unique identifier for the session (format: `wizard_{timestamp}`)
- **timestamp**: ISO 8601 timestamp of submission
- **cohort**: ARR range (Cohort_1, Cohort_2, Cohort_3, Cohort_4)
- **sector**: Industry sector (b2b_saas, b2c_saas, enterprise_software, marketplace, ecommerce, services, other)
- **employees**: Company size (1-50, 51-200, 201-500, 500+)

#### Raw Answers (1-5 Scale)
- **pipeline_health**: Overall pipeline and lead generation rating
- **sales_conversion**: Sales effectiveness rating
- **customer_success**: Retention and expansion rating
- **economics_efficiency**: Unit economics and operational efficiency rating
- **top_challenge**: Primary GTM challenge (pipeline, conversion, retention, efficiency, economics, structure)

#### Calculated Scores (0-1 Scale)
- **overall_ssi**: Overall Alpine Infrastructure Score
- **pipeline**: Pipeline loop score
- **conversion**: Conversion loop score
- **expansion**: Expansion/retention loop score

#### Detected Patterns
Array of pattern objects:
- **pattern**: Pattern identifier (e.g., "pipeline_conversion_gap", "leaky_bucket")
- **description**: Human-readable description
- **priority**: Severity level (high, critical, etc.)

---

## API Endpoints

### 1. Get All Submissions

**Endpoint:** `GET /api/submissions`

**Description:** Retrieve all submission data for analysis

**Example Request:**
```bash
curl http://localhost:3000/api/submissions
```

**Response:**
```json
{
  "submissions": [...array of submission objects...],
  "total": 42,
  "total_all": 42
}
```

---

### 2. Filter by Cohort

**Endpoint:** `GET /api/submissions?cohort=Cohort_2`

**Description:** Get submissions from a specific ARR cohort

**Example Request:**
```bash
curl http://localhost:3000/api/submissions?cohort=Cohort_2
```

**Response:**
```json
{
  "submissions": [...filtered submissions...],
  "total": 15,
  "total_all": 42
}
```

**Valid Cohort Values:**
- `Cohort_1`: <$5M ARR
- `Cohort_2`: $5M-$25M ARR
- `Cohort_3`: $25M-$75M ARR
- `Cohort_4`: $75M+ ARR

---

### 3. Filter by Sector

**Endpoint:** `GET /api/submissions?sector=b2b_saas`

**Description:** Get submissions from a specific industry sector

**Example Request:**
```bash
curl http://localhost:3000/api/submissions?sector=b2b_saas
```

**Valid Sector Values:**
- `b2b_saas`
- `b2c_saas`
- `enterprise_software`
- `marketplace`
- `ecommerce`
- `services`
- `other`

---

### 4. Filter by Date Range

**Endpoint:** `GET /api/submissions?start_date=2025-01-01&end_date=2025-12-31`

**Description:** Get submissions within a date range

**Example Request:**
```bash
curl "http://localhost:3000/api/submissions?start_date=2025-01-01&end_date=2025-12-31"
```

**Date Format:** ISO 8601 (YYYY-MM-DD)

---

### 5. Combined Filters

**Endpoint:** `GET /api/submissions?cohort=Cohort_2&sector=b2b_saas&start_date=2025-01-01`

**Description:** Combine multiple filters

**Example Request:**
```bash
curl "http://localhost:3000/api/submissions?cohort=Cohort_2&sector=b2b_saas&start_date=2025-01-01"
```

---

## Pattern Analysis Use Cases

### Example 1: Find Common Patterns by Cohort

```python
import requests

# Get all Cohort_2 submissions
response = requests.get('http://localhost:3000/api/submissions?cohort=Cohort_2')
data = response.json()

# Analyze patterns
patterns = {}
for submission in data['submissions']:
    for pattern in submission['patterns']:
        pattern_name = pattern['pattern']
        patterns[pattern_name] = patterns.get(pattern_name, 0) + 1

print(f"Most common patterns in Cohort_2:")
for pattern, count in sorted(patterns.items(), key=lambda x: x[1], reverse=True):
    print(f"  {pattern}: {count} occurrences")
```

### Example 2: Calculate Average Scores by Sector

```python
import requests
from statistics import mean

response = requests.get('http://localhost:3000/api/submissions')
data = response.json()

# Group by sector
sectors = {}
for submission in data['submissions']:
    sector = submission['sector']
    if sector not in sectors:
        sectors[sector] = []
    sectors[sector].append(submission['scores']['overall_ssi'])

# Calculate averages
print("Average AIS scores by sector:")
for sector, scores in sectors.items():
    avg = mean(scores)
    print(f"  {sector}: {avg:.2f} ({len(scores)} submissions)")
```

### Example 3: Identify Low Performers

```python
import requests

response = requests.get('http://localhost:3000/api/submissions')
data = response.json()

# Find submissions with overall_ssi < 0.5
low_performers = [
    s for s in data['submissions']
    if s['scores']['overall_ssi'] < 0.5
]

print(f"Found {len(low_performers)} low performers")

# Analyze their top challenges
challenges = {}
for submission in low_performers:
    challenge = submission['answers']['top_challenge']
    challenges[challenge] = challenges.get(challenge, 0) + 1

print("Most common challenges for low performers:")
for challenge, count in sorted(challenges.items(), key=lambda x: x[1], reverse=True):
    print(f"  {challenge}: {count}")
```

---

## Data Privacy & Security

### Anonymization

The stored data is anonymized:
- **No PII**: Email, company name, and user name are NOT stored
- **Session IDs only**: client_id is a timestamp-based identifier with no personal info
- **Aggregated analysis**: Designed for cohort-level pattern recognition

### Access Control

- **Local storage only**: Data file is stored on the server filesystem
- **No public access**: API endpoint requires server access
- **Production deployment**: Add authentication/authorization as needed

### GDPR Compliance

The anonymized data structure complies with GDPR requirements:
- No personally identifiable information
- No email addresses or names
- No company-specific identifiers
- Suitable for benchmarking and pattern analysis

---

## For AI Agents

### Recommended Analysis Tasks

1. **Pattern Detection**
   - Identify correlations between answer combinations and outcomes
   - Find common patterns within cohorts
   - Detect anomalies

2. **Benchmarking**
   - Calculate cohort-specific averages
   - Identify top/bottom performers
   - Generate percentile rankings

3. **Insights Generation**
   - "Companies in Cohort_2 with weak pipeline typically also struggle with..."
   - "B2B SaaS companies scoring 2 on conversion usually have..."
   - "The most common challenge for high performers is..."

4. **Predictive Analysis**
   - Predict overall_ssi based on individual question answers
   - Identify which questions are most predictive of success
   - Recommend focus areas based on patterns

### Sample AI Agent Prompt

```
You are an AI agent analyzing GTM infrastructure data from the Alpine Signal Rating assessment.

Your task: Analyze the submissions data to identify patterns and generate insights.

Data source: GET http://localhost:3000/api/submissions

Focus areas:
1. Common patterns by cohort (ARR range)
2. Sector-specific trends
3. Correlation between answer combinations and overall scores
4. Most frequent challenges by performance level

Output format: Markdown report with findings, statistics, and recommendations
```

---

## Production Deployment

### Security Considerations

When deploying to production (signal.thealpinesystem.com):

1. **Add Authentication**
   ```javascript
   app.use('/api/submissions', requireAuth);
   ```

2. **Rate Limiting**
   ```javascript
   const rateLimit = require('express-rate-limit');
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 100
   });
   app.use('/api/submissions', limiter);
   ```

3. **CORS Configuration**
   ```javascript
   app.use(cors({
     origin: ['https://signal.thealpinesystem.com'],
     credentials: true
   }));
   ```

4. **Database Migration** (Optional)
   - Consider moving from JSON file to PostgreSQL/MongoDB for better performance
   - Implement proper indexing on cohort, sector, timestamp

---

## Support & Questions

For implementation help or questions about the data structure:
- Check `server.js` for the submission storage logic
- Review `wizard_questions.json` for scoring mappings
- Examine `submissions_data.json` for sample data

---

**Last Updated:** October 29, 2025
**Version:** 1.0
