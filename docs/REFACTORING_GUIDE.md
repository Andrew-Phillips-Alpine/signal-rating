# Server.js Refactoring Guide

## Current State

**server.js** is 1,519 lines with all functionality in a single file:
- Express server setup
- Scoring calculations (calculateScores)
- Insights generation (generateInsights)
- PDF generation (Puppeteer)
- API endpoints
- File I/O operations

## Proposed Modular Structure

```
server/
├── index.js              # Main entry point (Express app setup)
├── config.js             # Configuration and constants
├── scoring.js            # calculateScores function
├── insights.js           # generateInsights + helper functions
├── pdf-generator.js      # PDF generation logic
├── routes/
│   ├── wizard.js         # POST /wizard_submit endpoint
│   └── pdf.js            # GET /download-pdf/:client_id endpoint
└── utils/
    ├── file-operations.js  # JSON read/write utilities
    └── formatters.js       # Metric formatting helpers
```

---

## Module Breakdown

### 1. **server/index.js** (Main Entry Point)

```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');
const wizardRoutes = require('./routes/wizard');
const pdfRoutes = require('./routes/pdf');
const { loadConfig } = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..')));

// Load configuration
loadConfig();

// Routes
app.use('/wizard_submit', wizardRoutes);
app.use('/download-pdf', pdfRoutes);

// Start server
app.listen(PORT, () => {
    console.log(`✓ Server running at http://localhost:${PORT}`);
});

module.exports = app;
```

---

### 2. **server/config.js** (Configuration Management)

```javascript
const fs = require('fs');
const path = require('path');

let wizardConfig;
let fixLibrary;

function loadConfig() {
    try {
        const configData = fs.readFileSync(
            path.join(__dirname, '../wizard_questions.json'),
            'utf8'
        );
        wizardConfig = JSON.parse(configData);
        console.log('✓ Loaded wizard_questions.json');
    } catch (error) {
        console.error('Error loading wizard_questions.json:', error);
        process.exit(1);
    }

    try {
        const fixData = fs.readFileSync(
            path.join(__dirname, '../fix_library.json'),
            'utf8'
        );
        fixLibrary = JSON.parse(fixData);
        console.log('✓ Loaded fix_library.json');
    } catch (error) {
        console.error('Error loading fix_library.json:', error);
        process.exit(1);
    }

    return { wizardConfig, fixLibrary };
}

function getWizardConfig() {
    return wizardConfig;
}

function getFixLibrary() {
    return fixLibrary;
}

module.exports = {
    loadConfig,
    getWizardConfig,
    getFixLibrary
};
```

---

### 3. **server/scoring.js** (Scoring Logic)

Extract the `calculateScores` function and all related metric calculations:

```javascript
const { getWizardConfig } = require('./config');
const { formatMetricValue } = require('./utils/formatters');

function calculateScores(answers) {
    const wizardConfig = getWizardConfig();
    const questions = wizardConfig.questions;

    // Extract ratings
    const pipelineRating = parseInt(answers.question_1_pipeline_health) || 3;
    const conversionRating = parseInt(answers.question_2_sales_conversion) || 3;
    const expansionRating = parseInt(answers.question_3_customer_success) || 3;
    const economicsRating = parseInt(answers.question_4_economics_and_efficiency) || 3;
    const topChallenge = answers.question_5_top_challenge || 'pipeline';

    // Get metric mappings
    const pipelineMetrics = questions.question_1_pipeline_health
        .maps_to_metrics[pipelineRating.toString()];
    const conversionMetrics = questions.question_2_sales_conversion
        .maps_to_metrics[conversionRating.toString()];
    const expansionMetrics = questions.question_3_customer_success
        .maps_to_metrics[expansionRating.toString()];
    const economicsMetrics = questions.question_4_economics_and_efficiency
        .maps_to_metrics[economicsRating.toString()];

    // Calculate loop scores
    const pipelineScore = calculatePipelineScore(pipelineMetrics);
    const conversionScore = calculateConversionScore(conversionMetrics);
    const expansionScore = calculateExpansionScore(expansionMetrics);
    const economicsScore = calculateEconomicsScore(economicsMetrics);

    // Calculate weights with challenge adjustment
    const weights = calculateWeights(topChallenge);

    // Calculate overall score
    const overallSSI = (
        pipelineScore * weights.pipeline +
        conversionScore * weights.conversion +
        expansionScore * weights.expansion +
        economicsScore * weights.economics
    );

    // Generate priority recommendations
    const priorityRecommendations = generatePriorityRecommendations({
        pipelineMetrics,
        conversionMetrics,
        expansionMetrics,
        economicsMetrics
    });

    return {
        overall_ssi: overallSSI,
        loop_scores: {
            Pipeline: pipelineScore,
            Conversion: conversionScore,
            Expansion: expansionScore
        },
        priority_recommendations: priorityRecommendations,
        detected_patterns: []
    };
}

function calculatePipelineScore(metrics) {
    return (
        (metrics.lead_velocity_rate / 0.12) * 0.25 +
        (metrics.mql_to_sql_conversion / 0.28) * 0.25 +
        (metrics.marketing_contribution_pipeline / 0.38) * 0.20 +
        (metrics.pipeline_coverage_ratio / 3.8) * 0.15 +
        (metrics.inbound_lead_volume_growth / 0.25) * 0.10 +
        (1 - (metrics.lead_response_time / 24)) * 0.05
    );
}

function calculateConversionScore(metrics) {
    return (
        (metrics.win_rate / 0.32) * 0.30 +
        (1 - (metrics.sales_cycle_length / 180)) * 0.20 +
        (metrics.sql_acceptance_rate / 0.90) * 0.15 +
        (metrics.demo_to_proposal_rate / 0.72) * 0.15 +
        (metrics.proposal_to_won_rate / 0.68) * 0.10 +
        (metrics.pipeline_conversion_rate / 0.42) * 0.10
    );
}

function calculateExpansionScore(metrics) {
    return (
        (metrics.nrr / 1.20) * 0.30 +
        (metrics.grr / 0.98) * 0.20 +
        (1 - metrics.churn_rate) * 0.20 +
        (metrics.expansion_revenue_growth / 0.28) * 0.15 +
        (metrics.nps / 58) * 0.10 +
        (1 - (metrics.time_to_first_value / 60)) * 0.05
    );
}

function calculateEconomicsScore(metrics) {
    return (
        (1 - (metrics.cac_payback_period / 26)) * 0.20 +
        (metrics.ltv_cac / 5.8) * 0.20 +
        (1 - (metrics.burn_multiple / 4.0)) * 0.15 +
        (1 - (metrics.sales_rep_ramp_time / 6.5)) * 0.10 +
        (metrics.quota_attainment / 0.88) * 0.15 +
        (metrics.magic_number / 1.25) * 0.10 +
        (metrics.rule_of_40 / 62) * 0.10
    );
}

function calculateWeights(topChallenge) {
    let weights = {
        pipeline: 0.30,
        conversion: 0.30,
        expansion: 0.25,
        economics: 0.15
    };

    const challengeWeightMap = {
        'pipeline': 'pipeline',
        'conversion': 'conversion',
        'retention': 'expansion'
    };

    if (challengeWeightMap[topChallenge]) {
        const focusArea = challengeWeightMap[topChallenge];
        weights[focusArea] *= 1.15;
        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
        Object.keys(weights).forEach(key => weights[key] /= totalWeight);
    }

    return weights;
}

function generatePriorityRecommendations(allMetrics) {
    const { pipelineMetrics, conversionMetrics, expansionMetrics, economicsMetrics } = allMetrics;

    const metrics = [
        { name: 'Lead Velocity Rate', score: pipelineMetrics.lead_velocity_rate / 0.12, loop: 'Pipeline', value: pipelineMetrics.lead_velocity_rate },
        { name: 'MQL to SQL Conversion', score: pipelineMetrics.mql_to_sql_conversion / 0.28, loop: 'Pipeline', value: pipelineMetrics.mql_to_sql_conversion },
        { name: 'Lead Response Time', score: 1 - (pipelineMetrics.lead_response_time / 24), loop: 'Pipeline', value: pipelineMetrics.lead_response_time },
        { name: 'Win Rate', score: conversionMetrics.win_rate / 0.32, loop: 'Conversion', value: conversionMetrics.win_rate },
        { name: 'Sales Cycle Length', score: 1 - (conversionMetrics.sales_cycle_length / 180), loop: 'Conversion', value: conversionMetrics.sales_cycle_length },
        { name: 'Net Revenue Retention', score: expansionMetrics.nrr / 1.20, loop: 'Expansion', value: expansionMetrics.nrr },
        { name: 'Churn Rate', score: 1 - expansionMetrics.churn_rate, loop: 'Expansion', value: expansionMetrics.churn_rate },
        { name: 'CAC Payback Period', score: 1 - (economicsMetrics.cac_payback_period / 26), loop: 'Economics', value: economicsMetrics.cac_payback_period },
        { name: 'LTV:CAC Ratio', score: economicsMetrics.ltv_cac / 5.8, loop: 'Economics', value: economicsMetrics.ltv_cac }
    ];

    return metrics
        .sort((a, b) => a.score - b.score)
        .slice(0, 5)
        .map(metric => ({
            name: metric.name,
            score: Math.round(metric.score * 100),
            loop: metric.loop,
            description: `Current value: ${formatMetricValue(metric.name, metric.value)}`
        }));
}

module.exports = {
    calculateScores
};
```

---

### 4. **server/insights.js** (Insights Generation)

Extract the `generateInsights` function:

```javascript
function generateInsights(clientName, overallScore, strongestLoop, weakestLoop) {
    let healthDescription = '';
    let tagline = '';
    let concernLevel = '';

    if (overallScore >= 80) {
        healthDescription = 'placing you in the top quartile of GTM infrastructure performance';
        tagline = 'Exceptional GTM Infrastructure — Continue scaling with confidence';
        concernLevel = 'optimization opportunity';
    } else if (overallScore >= 65) {
        healthDescription = 'indicating solid GTM foundations with clear optimization opportunities';
        tagline = 'Strong GTM Foundations — Focus on high-leverage improvements';
        concernLevel = 'moderate priority';
    } else if (overallScore >= 50) {
        healthDescription = 'revealing several areas requiring systematic improvement';
        tagline = 'Functional GTM Infrastructure — Address key gaps for growth';
        concernLevel = 'important priority';
    } else if (overallScore >= 35) {
        healthDescription = 'signaling fundamental GTM breakdowns limiting growth potential';
        tagline = 'GTM Infrastructure Needs Attention — Fix breakdowns to unlock growth';
        concernLevel = 'high priority';
    } else {
        healthDescription = 'indicating critical GTM infrastructure failures requiring immediate attention';
        tagline = 'Critical GTM Infrastructure Issues — Urgent systematic fixes needed';
        concernLevel = 'critical priority';
    }

    const mainInsight = `${clientName} currently has an overall ASR score of ${overallScore}, ${healthDescription}.`;
    const loopAnalysis = `The ${weakestLoop.name} loop (${weakestLoop.score}) represents the ${concernLevel} and should be the focus of immediate improvement efforts. In contrast, the ${strongestLoop.name} loop (${strongestLoop.score}) shows relative strength and can serve as a foundation for broader GTM improvements.`;
    const actionableOutcome = `By addressing the priority fixes identified in this report, ${clientName} can expect to see measurable improvements in pipeline velocity, conversion rates, and customer expansion within 90 days.`;

    return {
        mainInsight,
        loopAnalysis,
        actionableOutcome,
        tagline
    };
}

module.exports = {
    generateInsights
};
```

---

### 5. **server/pdf-generator.js** (PDF Generation)

Extract all PDF-related logic:

```javascript
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { generateInsights } = require('./insights');

async function generatePDF(clientData) {
    const { clientName, overallScore, loop_scores, priorityRecommendations } = clientData;

    // Generate insights
    const loopScoresArray = [
        { name: 'Pipeline', score: Math.round(loop_scores.Pipeline * 100) },
        { name: 'Conversion', score: Math.round(loop_scores.Conversion * 100) },
        { name: 'Expansion', score: Math.round(loop_scores.Expansion * 100) }
    ];
    loopScoresArray.sort((a, b) => b.score - a.score);
    const strongestLoop = loopScoresArray[0];
    const weakestLoop = loopScoresArray[2];

    const insights = generateInsights(clientName, overallScore, strongestLoop, weakestLoop);

    // Generate HTML
    const htmlContent = await generatePDFHTML(clientData, insights);

    // Launch Puppeteer and generate PDF
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const timestamp = Date.now();
    const filename = `alpine-gtm-report-${clientName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${timestamp}.pdf`;
    const pdfPath = path.join(__dirname, '../temp_pdfs', filename);

    await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
    });

    await browser.close();

    return { filename, pdfPath };
}

async function generatePDFHTML(clientData, insights) {
    // Full HTML template here (extracted from current server.js)
    // ...
    return htmlTemplate;
}

module.exports = {
    generatePDF
};
```

---

### 6. **server/routes/wizard.js** (Wizard Endpoint)

```javascript
const express = require('express');
const router = express.Router();
const { calculateScores } = require('../scoring');
const { saveSubmission } = require('../utils/file-operations');

router.post('/', async (req, res) => {
    try {
        const { answers, client_name, client_id } = req.body;

        console.log(`\n[${new Date().toISOString()}] New wizard submission`);
        console.log(`   Client: ${client_name || 'Anonymous'}`);
        console.log(`   Email: ${answers.user_email || answers.email || 'Not provided'}`);

        const results = calculateScores(answers);

        console.log(`   Overall ASR Score: ${(results.overall_ssi * 100).toFixed(1)}%`);

        // Save submission
        await saveSubmission({ answers, client_name, results });

        res.json({
            success: true,
            overall_ssi: results.overall_ssi,
            loop_scores: results.loop_scores,
            priority_recommendations: results.priority_recommendations,
            detected_patterns: results.detected_patterns
        });

    } catch (error) {
        console.error('Error processing wizard submission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process wizard submission'
        });
    }
});

module.exports = router;
```

---

### 7. **server/routes/pdf.js** (PDF Download Endpoint)

```javascript
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { generatePDF } = require('../pdf-generator');

router.get('/:client_id', async (req, res) => {
    try {
        const clientId = req.params.client_id;

        // Read submission data
        const submissionsData = await fs.readFile(
            path.join(__dirname, '../../submissions_data.json'),
            'utf8'
        );
        const submissions = JSON.parse(submissionsData);

        const clientData = submissions.find(s => s.client_id === clientId);

        if (!clientData) {
            return res.status(404).json({ error: 'Client data not found' });
        }

        const { filename, pdfPath } = await generatePDF(clientData);

        res.download(pdfPath, filename, (err) => {
            if (err) {
                console.error('Error sending PDF:', err);
            }
        });

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

module.exports = router;
```

---

## Migration Steps

1. **Create directory structure:**
   ```bash
   mkdir -p server/routes server/utils
   ```

2. **Create new module files** with code extracted from server.js

3. **Test each module independently** before integrating

4. **Update imports** - ensure all require() paths are correct

5. **Test full flow:**
   - Submit wizard
   - Generate PDF
   - Verify scoring matches old system

6. **Once verified, rename:**
   ```bash
   mv server.js server_old.js
   mv server/index.js server.js
   ```

7. **Final testing** with production-like data

---

## Benefits of Refactoring

✅ **Maintainability** - Easier to find and update specific functionality
✅ **Testability** - Each module can be unit tested independently
✅ **Scalability** - Can add new routes/features without cluttering main file
✅ **Debugging** - Errors are easier to trace to specific modules
✅ **Team Collaboration** - Multiple developers can work on different modules

---

## Notes

- Keep server_old.js as backup during migration
- Test PDF generation thoroughly - Puppeteer can be finicky
- Ensure all file paths are correctly resolved relative to new structure
- Consider adding unit tests for scoring.js (most critical module)
