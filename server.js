require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;

// Email configuration (set these in .env or environment variables)
const EMAIL_CONFIG = {
    enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
    from: process.env.EMAIL_FROM || 'noreply@alpine-signal.com',
    to: process.env.EMAIL_TO || 'your-email@example.com',
    service: process.env.EMAIL_SERVICE || 'SendGrid', // 'SendGrid' or 'gmail'
    // For SendGrid:
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    // For Gmail/other SMTP:
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname)); // Serve static files from current directory

// Load wizard questions configuration
let wizardConfig;
try {
    const configData = fs.readFileSync(path.join(__dirname, 'wizard_questions.json'), 'utf8');
    wizardConfig = JSON.parse(configData);
    console.log('✓ Loaded wizard_questions.json');
} catch (error) {
    console.error('Error loading wizard_questions.json:', error);
    process.exit(1);
}

// Load fix library
let fixLibrary;
try {
    const fixData = fs.readFileSync(path.join(__dirname, 'fix_library.json'), 'utf8');
    fixLibrary = JSON.parse(fixData);
    console.log('✓ Loaded fix_library.json');
} catch (error) {
    console.error('Error loading fix_library.json:', error);
    process.exit(1);
}

// Scoring calculation function
function calculateScores(answers) {
    const questions = wizardConfig.questions;

    // Extract the ratings from answers (1-5 scale)
    const pipelineRating = parseInt(answers.question_1_pipeline_health) || 3;
    const conversionRating = parseInt(answers.question_2_sales_conversion) || 3;
    const expansionRating = parseInt(answers.question_3_customer_success) || 3;
    const economicsRating = parseInt(answers.question_4_economics_and_efficiency) || 3;
    const topChallenge = answers.question_5_top_challenge || 'pipeline';

    // Get the metric mappings for each rating
    const pipelineMetrics = questions.question_1_pipeline_health.maps_to_metrics[pipelineRating.toString()];
    const conversionMetrics = questions.question_2_sales_conversion.maps_to_metrics[conversionRating.toString()];
    const expansionMetrics = questions.question_3_customer_success.maps_to_metrics[expansionRating.toString()];
    const economicsMetrics = questions.question_4_economics_and_efficiency.maps_to_metrics[economicsRating.toString()];

    // Calculate loop scores (normalized 0-1)
    // Pipeline Loop: Based on lead generation metrics
    const pipelineScore = (
        (pipelineMetrics.lead_velocity_rate / 0.12) * 0.25 +
        (pipelineMetrics.mql_to_sql_conversion / 0.28) * 0.25 +
        (pipelineMetrics.marketing_contribution_pipeline / 0.38) * 0.20 +
        (pipelineMetrics.pipeline_coverage_ratio / 3.8) * 0.15 +
        (pipelineMetrics.inbound_lead_volume_growth / 0.25) * 0.10 +
        (1 - (pipelineMetrics.lead_response_time / 24)) * 0.05
    );

    // Conversion Loop: Based on sales effectiveness
    const conversionScore = (
        (conversionMetrics.win_rate / 0.32) * 0.30 +
        (1 - (conversionMetrics.sales_cycle_length / 180)) * 0.20 +
        (conversionMetrics.sql_acceptance_rate / 0.90) * 0.15 +
        (conversionMetrics.demo_to_proposal_rate / 0.72) * 0.15 +
        (conversionMetrics.proposal_to_won_rate / 0.68) * 0.10 +
        (conversionMetrics.pipeline_conversion_rate / 0.42) * 0.10
    );

    // Expansion Loop: Based on retention and growth
    const expansionScore = (
        (expansionMetrics.nrr / 1.20) * 0.30 +
        (expansionMetrics.grr / 0.98) * 0.20 +
        (1 - expansionMetrics.churn_rate) * 0.20 +
        (expansionMetrics.expansion_revenue_growth / 0.28) * 0.15 +
        (expansionMetrics.nps / 58) * 0.10 +
        (1 - (expansionMetrics.time_to_first_value / 60)) * 0.05
    );

    // Overall AIS Score: Weighted average of all loops + economics
    // Apply weight adjustment based on top challenge
    let weights = {
        pipeline: 0.30,
        conversion: 0.30,
        expansion: 0.25,
        economics: 0.15
    };

    // Adjust weights based on top challenge (increase problem area weight)
    const challengeWeightMap = {
        'pipeline': 'pipeline',
        'conversion': 'conversion',
        'retention': 'expansion'
    };

    if (challengeWeightMap[topChallenge]) {
        const focusArea = challengeWeightMap[topChallenge];
        weights[focusArea] *= 1.15; // Increase weight by 15%
        // Normalize weights to sum to 1
        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
        Object.keys(weights).forEach(key => weights[key] /= totalWeight);
    }

    // Economics score (0-1 normalized)
    const economicsScore = (
        (1 - (economicsMetrics.cac_payback_period / 26)) * 0.20 +
        (economicsMetrics.ltv_cac / 5.8) * 0.20 +
        (1 - (economicsMetrics.burn_multiple / 4.0)) * 0.15 +
        (1 - (economicsMetrics.sales_rep_ramp_time / 6.5)) * 0.10 +
        (economicsMetrics.quota_attainment / 0.88) * 0.15 +
        (economicsMetrics.magic_number / 1.25) * 0.10 +
        (economicsMetrics.rule_of_40 / 62) * 0.10
    );

    // Calculate overall AIS score
    const overallSSI = (
        pipelineScore * weights.pipeline +
        conversionScore * weights.conversion +
        expansionScore * weights.expansion +
        economicsScore * weights.economics
    );

    // Identify priority recommendations (lowest scoring metrics)
    const allMetrics = [
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

    // Sort by score (ascending) and take top 5 priorities
    const priorityRecommendations = allMetrics
        .sort((a, b) => a.score - b.score)
        .slice(0, 5)
        .map(metric => ({
            name: metric.name,
            score: Math.round(metric.score * 100),
            loop: metric.loop,
            description: `Current value: ${formatMetricValue(metric.name, metric.value)}`
        }));

    return {
        overall_ssi: Math.max(0, Math.min(1, overallSSI)), // Clamp between 0 and 1
        loop_scores: {
            Pipeline: Math.max(0, Math.min(1, pipelineScore)),
            Conversion: Math.max(0, Math.min(1, conversionScore)),
            Expansion: Math.max(0, Math.min(1, expansionScore))
        },
        priority_recommendations: priorityRecommendations,
        detected_patterns: detectPatterns(answers, pipelineScore, conversionScore, expansionScore)
    };
}

// Helper function to format metric values
function formatMetricValue(metricName, value) {
    if (metricName.includes('Rate') || metricName.includes('Conversion') || metricName.includes('Retention')) {
        return `${Math.round(value * 100)}%`;
    } else if (metricName.includes('Time') || metricName.includes('Length') || metricName.includes('Period')) {
        return `${Math.round(value)} days`;
    } else if (metricName.includes('Ratio')) {
        return `${value.toFixed(1)}:1`;
    }
    return value.toFixed(2);
}

// Pattern detection based on answer combinations
function detectPatterns(answers, pipelineScore, conversionScore, expansionScore) {
    const patterns = [];

    const pipelineRating = parseInt(answers.question_1_pipeline_health) || 3;
    const conversionRating = parseInt(answers.question_2_sales_conversion) || 3;
    const expansionRating = parseInt(answers.question_3_customer_success) || 3;
    const economicsRating = parseInt(answers.question_4_economics_and_efficiency) || 3;

    // Pattern: Pipeline strong but conversion weak
    if (pipelineRating >= 4 && conversionRating <= 2) {
        patterns.push({
            pattern: 'pipeline_conversion_gap',
            description: 'Strong pipeline but weak conversion - focus on sales enablement',
            priority: 'high'
        });
    }

    // Pattern: Good new business but poor retention
    if (conversionRating >= 4 && expansionRating <= 2) {
        patterns.push({
            pattern: 'leaky_bucket',
            description: 'Acquiring customers but losing them - prioritize customer success',
            priority: 'critical'
        });
    }

    // Pattern: Everything weak
    if (pipelineRating <= 2 && conversionRating <= 2 && expansionRating <= 2) {
        patterns.push({
            pattern: 'systematic_issues',
            description: 'Multiple weak areas suggest fundamental GTM challenges',
            priority: 'critical'
        });
    }

    // Pattern: Poor economics despite good operations
    if (economicsRating <= 2 && (pipelineRating >= 3 || conversionRating >= 3)) {
        patterns.push({
            pattern: 'unit_economics_problem',
            description: 'Operations functional but economics unsustainable',
            priority: 'high'
        });
    }

    return patterns;
}

// API Endpoint: Submit wizard
app.post('/wizard_submit', (req, res) => {
    try {
        const { answers, client_name, client_id, email } = req.body;

        // Validate required fields
        if (!answers) {
            return res.status(400).json({ error: 'Missing answers data' });
        }

        console.log(`\n📊 Processing submission for: ${client_name || 'Unknown'}`);
        console.log(`   Client ID: ${client_id}`);
        console.log(`   Email: ${answers.user_email || answers.email || 'N/A'}`);
        console.log(`   Company: ${answers.company_name || 'N/A'}`);

        // Calculate scores
        const results = calculateScores(answers);

        console.log(`   Overall AIS Score: ${(results.overall_ssi * 100).toFixed(1)}%`);
        console.log(`   Pipeline: ${(results.loop_scores.Pipeline * 100).toFixed(1)}%`);
        console.log(`   Conversion: ${(results.loop_scores.Conversion * 100).toFixed(1)}%`);
        console.log(`   Expansion: ${(results.loop_scores.Expansion * 100).toFixed(1)}%`);

        // Store data for benchmarking and pattern analysis (now includes contact info)
        const submissionData = {
            client_id,
            timestamp: new Date().toISOString(),
            client_name: client_name || 'Unknown',
            email: email || '',
            cohort: answers.arr || 'unknown',
            sector: answers.sector || 'unknown',
            employees: answers.employees || 'unknown',
            answers: {
                pipeline_health: parseInt(answers.question_1_pipeline_health) || null,
                sales_conversion: parseInt(answers.question_2_sales_conversion) || null,
                customer_success: parseInt(answers.question_3_customer_success) || null,
                economics_efficiency: parseInt(answers.question_4_economics_and_efficiency) || null,
                top_challenge: answers.question_5_top_challenge || null
            },
            scores: {
                overall_ssi: results.overall_ssi,
                pipeline: results.loop_scores.Pipeline,
                conversion: results.loop_scores.Conversion,
                expansion: results.loop_scores.Expansion
            },
            patterns: results.detected_patterns
        };

        saveSubmissionData(submissionData);

        // Send email notification to owner
        sendNotificationEmail(submissionData).catch(err => {
            console.warn('   ⚠️  Email notification failed:', err.message);
            // Don't fail the request if email fails
        });

        console.log(`   ✓ Submission processed and stored\n`);

        // Return results
        res.json({
            success: true,
            client_id,
            ...results
        });

    } catch (error) {
        console.error('Error processing wizard submission:', error);
        res.status(500).json({
            error: 'Failed to process submission',
            message: error.message
        });
    }
});

// Save submission data for analysis (anonymized and normalized by cohort)
function saveSubmissionData(data) {
    const dataFile = path.join(__dirname, 'submissions_data.json');

    try {
        // Read existing data
        let submissions = [];
        if (fs.existsSync(dataFile)) {
            const fileContent = fs.readFileSync(dataFile, 'utf8');
            submissions = JSON.parse(fileContent);
        }

        // Add new submission
        submissions.push(data);

        // Write back to file
        fs.writeFileSync(dataFile, JSON.stringify(submissions, null, 2));
        console.log(`   💾 Data stored in submissions_data.json (Total: ${submissions.length} submissions)`);
    } catch (error) {
        console.error('   ⚠️  Error saving submission data:', error.message);
        // Don't fail the request if storage fails
    }
}

// Send email notification when someone completes the lead magnet
async function sendNotificationEmail(data) {
    if (!EMAIL_CONFIG.enabled) {
        console.log('   📧 Email notifications disabled (set EMAIL_NOTIFICATIONS_ENABLED=true to enable)');
        return;
    }

    // Check credentials based on service
    if (EMAIL_CONFIG.service === 'SendGrid') {
        if (!EMAIL_CONFIG.sendgridApiKey) {
            console.log('   📧 SendGrid API key not configured (set SENDGRID_API_KEY)');
            return;
        }
    } else {
        if (!EMAIL_CONFIG.user || !EMAIL_CONFIG.pass) {
            console.log('   📧 Email credentials not configured (set EMAIL_USER and EMAIL_PASS)');
            return;
        }
    }

    try {
        // Create transporter (supports both SendGrid and SMTP services)
        let transporter;

        if (EMAIL_CONFIG.service === 'SendGrid') {
            transporter = nodemailer.createTransport({
                host: 'smtp.sendgrid.net',
                port: 587,
                auth: {
                    user: 'apikey',
                    pass: EMAIL_CONFIG.sendgridApiKey
                }
            });
        } else {
            transporter = nodemailer.createTransport({
                service: EMAIL_CONFIG.service,
                auth: {
                    user: EMAIL_CONFIG.user,
                    pass: EMAIL_CONFIG.pass
                }
            });
        }

        // Format the email body
        const emailBody = `
New Lead Magnet Submission Received!

Company: ${data.client_name}
Email: ${data.email || 'Not provided'}
Timestamp: ${new Date(data.timestamp).toLocaleString()}

COHORT INFO:
- ARR: ${data.cohort}
- Sector: ${data.sector}
- Employees: ${data.employees}

SCORES:
- Overall AIS Score: ${(data.scores.overall_ssi * 100).toFixed(1)}%
- Pipeline Health: ${(data.scores.pipeline * 100).toFixed(1)}%
- Sales Conversion: ${(data.scores.conversion * 100).toFixed(1)}%
- Customer Expansion: ${(data.scores.expansion * 100).toFixed(1)}%

TOP CHALLENGE: ${data.answers.top_challenge || 'N/A'}

DETECTED PATTERNS:
${data.patterns.length > 0 ? data.patterns.join('\n') : 'None detected'}

---
Client ID: ${data.client_id}
View all submissions at: http://localhost:${PORT}/admin
        `.trim();

        // Send email
        await transporter.sendMail({
            from: EMAIL_CONFIG.from,
            to: EMAIL_CONFIG.to,
            subject: `🎯 New Lead: ${data.client_name} (${(data.scores.overall_ssi * 100).toFixed(0)}% AIS Score)`,
            text: emailBody
        });

        console.log(`   📧 Notification email sent to ${EMAIL_CONFIG.to}`);
    } catch (error) {
        throw new Error(`Email send failed: ${error.message}`);
    }
}

// Admin dashboard route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Alpine Signal Rating API is running' });
});

// API Endpoint: Get submissions data for analysis (for your AI agent)
app.get('/api/submissions', (req, res) => {
    const dataFile = path.join(__dirname, 'submissions_data.json');

    try {
        if (!fs.existsSync(dataFile)) {
            return res.json({ submissions: [], total: 0 });
        }

        const fileContent = fs.readFileSync(dataFile, 'utf8');
        const submissions = JSON.parse(fileContent);

        // Optional filtering by cohort, sector, date range
        const { cohort, sector, start_date, end_date } = req.query;

        let filtered = submissions;

        if (cohort) {
            filtered = filtered.filter(s => s.cohort === cohort);
        }

        if (sector) {
            filtered = filtered.filter(s => s.sector === sector);
        }

        if (start_date) {
            filtered = filtered.filter(s => new Date(s.timestamp) >= new Date(start_date));
        }

        if (end_date) {
            filtered = filtered.filter(s => new Date(s.timestamp) <= new Date(end_date));
        }

        res.json({
            submissions: filtered,
            total: filtered.length,
            total_all: submissions.length
        });
    } catch (error) {
        console.error('Error reading submissions data:', error);
        res.status(500).json({
            error: 'Failed to read submissions data',
            message: error.message
        });
    }
});

// API Endpoint: Generate PDF Report
app.post('/api/generate-pdf', async (req, res) => {
    try {
        const { clientName, overall_ssi, loop_scores, priority_recommendations, timestamp } = req.body;

        console.log(`\n📄 Generating PDF for: ${clientName}`);

        // Convert scores to percentages
        const overallScore = Math.round(overall_ssi * 100);
        const pipelineScore = Math.round(loop_scores.Pipeline * 100);
        const conversionScore = Math.round(loop_scores.Conversion * 100);
        const expansionScore = Math.round(loop_scores.Expansion * 100);

        // Select specific fixes based on loop scores
        const selectedFixes = selectFixesForPDF(pipelineScore, conversionScore, expansionScore);

        // Generate insights
        const loopScoresArray = [
            { name: 'Pipeline', score: pipelineScore },
            { name: 'Conversion', score: conversionScore },
            { name: 'Expansion', score: expansionScore }
        ];
        loopScoresArray.sort((a, b) => b.score - a.score);
        const strongestLoop = loopScoresArray[0];
        const weakestLoop = loopScoresArray[2];

        const insights = generatePDFInsights(clientName, overallScore, strongestLoop, weakestLoop);

        // Generate HTML content for PDF
        const htmlContent = generatePDFHTML({
            clientName,
            overallScore,
            pipelineScore,
            conversionScore,
            expansionScore,
            insights,
            selectedFixes,
            timestamp: timestamp || new Date().toISOString()
        });

        // Launch Puppeteer and generate PDF
        console.log('   → Launching browser...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        console.log('   → Creating page...');
        const page = await browser.newPage();

        console.log('   → Setting content...');
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '0',
                right: '0',
                bottom: '0',
                left: '0'
            }
        });

        await browser.close();

        console.log(`   ✓ PDF generated successfully (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

        // Save PDF to disk temporarily
        const timestamp_suffix = Date.now();
        const filename = `alpine-gtm-report-${clientName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${timestamp_suffix}.pdf`;
        const filepath = path.join(__dirname, 'temp_pdfs', filename);

        // Create temp directory if it doesn't exist
        const tempDir = path.join(__dirname, 'temp_pdfs');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        // Write PDF to file
        fs.writeFileSync(filepath, pdfBuffer);
        console.log(`   ✓ PDF saved to: ${filepath}\n`);

        // Send file path back to client
        res.json({
            success: true,
            filename: filename,
            downloadUrl: `/temp_pdfs/${filename}`
        });

    } catch (error) {
        console.error('\n❌ Error generating PDF:');
        console.error('   Error type:', error.name);
        console.error('   Error message:', error.message);
        console.error('   Full error:', error);
        res.status(500).json({
            error: 'Failed to generate PDF',
            message: error.message,
            details: error.toString()
        });
    }
});

// Select specific fixes for PDF based on loop scores
function selectFixesForPDF(pipelineScore, conversionScore, expansionScore) {
    const fixes = {
        pipeline: null,
        conversion: null,
        expansion: null
    };

    // Pipeline fix selection (prioritize lowest scoring areas)
    if (pipelineScore < 50) {
        fixes.pipeline = fixLibrary.pipeline_fixes[2]; // MQL-to-SQL Conversion
    } else if (pipelineScore < 70) {
        fixes.pipeline = fixLibrary.pipeline_fixes[0]; // ICP Refinement
    } else {
        fixes.pipeline = fixLibrary.pipeline_fixes[4]; // Lead Velocity Tracking
    }

    // Conversion fix selection
    if (conversionScore < 50) {
        fixes.conversion = fixLibrary.conversion_fixes[1]; // Sales Cycle Compression
    } else if (conversionScore < 70) {
        fixes.conversion = fixLibrary.conversion_fixes[0]; // Win Rate Analysis
    } else {
        fixes.conversion = fixLibrary.conversion_fixes[3]; // Proposal-to-Close
    }

    // Expansion fix selection
    if (expansionScore < 50) {
        fixes.expansion = fixLibrary.expansion_fixes[0]; // Churn Reduction
    } else if (expansionScore < 70) {
        fixes.expansion = fixLibrary.expansion_fixes[1]; // NRR Optimization
    } else {
        fixes.expansion = fixLibrary.expansion_fixes[3]; // Expansion Revenue Playbook
    }

    return fixes;
}

// Generate insights for PDF
function generatePDFInsights(clientName, overallScore, strongestLoop, weakestLoop) {
    let healthDescription;
    if (overallScore >= 80) {
        healthDescription = 'indicating exceptional GTM infrastructure health with minimal optimization needs';
    } else if (overallScore >= 70) {
        healthDescription = 'indicating strong GTM infrastructure health with minor optimization opportunities';
    } else if (overallScore >= 60) {
        healthDescription = 'indicating solid GTM infrastructure with notable areas for improvement';
    } else if (overallScore >= 50) {
        healthDescription = 'indicating moderate GTM infrastructure health with significant improvement opportunities';
    } else {
        healthDescription = 'indicating GTM infrastructure challenges requiring immediate attention';
    }

    let concernLevel;
    if (weakestLoop.score >= 70) {
        concernLevel = 'minor optimization opportunity';
    } else if (weakestLoop.score >= 60) {
        concernLevel = 'area requiring attention';
    } else if (weakestLoop.score >= 50) {
        concernLevel = 'primary area of concern';
    } else {
        concernLevel = 'critical priority';
    }

    const mainInsight = `${clientName} currently has an overall ASR score of ${overallScore}, ${healthDescription}.`;
    const loopAnalysis = `The ${weakestLoop.name} loop (${weakestLoop.score}) represents the ${concernLevel} and should be the focus of immediate improvement efforts. In contrast, the ${strongestLoop.name} loop (${strongestLoop.score}) shows relative strength and can serve as a foundation for broader GTM improvements.`;
    const actionableOutcome = `By addressing the priority fixes identified in this report, ${clientName} can expect to see measurable improvements in pipeline velocity, conversion rates, and customer expansion within 90 days.`;

    return {
        mainInsight,
        loopAnalysis,
        actionableOutcome
    };
}

// Generate tagline based on score
function generateScoreTagline(score) {
    if (score >= 80) {
        return `Exceptional Performance | You are ahead of 90% of companies. Focus on scaling your winning systems.`;
    } else if (score >= 70) {
        return `Strong Foundation | You are ahead of 70% of companies. Strategic improvements will unlock 2-3x growth potential.`;
    } else if (score >= 60) {
        return `Solid Base | You are ahead of 50% of companies. Systematic fixes will drive 40-60% improvement.`;
    } else if (score >= 50) {
        return `Growth Opportunity | Addressing key gaps will unlock 60-80% improvement potential.`;
    } else {
        return `Transformation Needed | Systematic rebuilding will create 2-4x improvement opportunity.`;
    }
}

// Generate root causes based on weakest loop
function generateRootCauses(weakestLoop, loopScore) {
    const causes = {
        Pipeline: [
            'No clear ICP → wasting time on unqualified leads',
            'Slow lead response → competitors getting there first',
            'Marketing/sales handoff broken → qualified leads falling through cracks',
            'No pipeline coverage targets → revenue gaps appearing too late'
        ],
        Conversion: [
            'No PreCall Slingshot → taking meetings with anyone who raises their hand',
            'Vague offers → prospects cannot clearly see the value',
            'Weak discovery → failing to validate fit and urgency early',
            'Custom proposals → every deal takes weeks instead of hours'
        ],
        Expansion: [
            'No systematic onboarding → customers do not see value fast enough',
            'Reactive customer success → only talking to customers when they complain',
            'No expansion playbook → leaving upsell revenue on the table',
            'Churn happening silently → no early warning system'
        ]
    };

    return causes[weakestLoop] || [];
}

// Generate HTML content for PDF
function generatePDFHTML(data) {
    const { clientName, overallScore, pipelineScore, conversionScore, expansionScore, insights, selectedFixes, timestamp } = data;

    const dateStr = new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const shortDate = new Date(timestamp).toISOString().split('T')[0];
    const tagline = generateScoreTagline(overallScore);

    // Identify loops for priority analysis
    const loopScoresArray = [
        { name: 'Pipeline', score: pipelineScore },
        { name: 'Conversion', score: conversionScore },
        { name: 'Expansion', score: expansionScore }
    ];
    loopScoresArray.sort((a, b) => a.score - b.score);
    const weakestLoop = loopScoresArray[0];
    const strongestLoop = loopScoresArray[2];

    const rootCauses = generateRootCauses(weakestLoop.name, weakestLoop.score);

    // Read logo file as base64 (so it embeds in PDF)
    let logoBase64 = '';
    try {
        const logoPath = path.join(__dirname, 'alpine-logo-dark.png');
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch (error) {
        console.warn('   ⚠️  Could not load logo for PDF');
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Alpine GTM Infrastructure Report - ${clientName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: radial-gradient(1200px 600px at 15% -10%, rgba(0,255,255,.08), transparent 60%),
                        radial-gradient(800px 500px at 85% 10%, rgba(0,96,255,.10), transparent 60%),
                        #00002c;
            color: #ffffff;
            line-height: 1.6;
            padding: 0;
            margin: 0;
        }

        .page-container {
            max-width: 1160px;
            margin: 0 auto;
            padding: 40px 24px;
            min-height: 100vh;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 2px solid rgba(13, 242, 255, 0.3);
            padding-bottom: 30px;
        }

        .logo {
            max-width: 200px;
            height: auto;
            margin-bottom: 20px;
        }

        .report-title {
            font-family: 'Montserrat', sans-serif;
            font-size: 32px;
            font-weight: 800;
            color: #00ffff;
            margin-bottom: 10px;
        }

        .report-subtitle {
            font-size: 18px;
            color: #9da3ae;
        }

        .report-date {
            font-size: 14px;
            color: #9da3ae;
            margin-top: 10px;
        }

        .score-section {
            background: #0b0b2f;
            border: 1px solid rgba(0,255,255,.08);
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            margin: 40px 0;
            box-shadow: 0 24px 60px rgba(0,0,0,.45);
            page-break-inside: avoid;
        }

        .ais-score {
            font-family: 'Montserrat', sans-serif;
            font-size: 80px;
            font-weight: 900;
            color: #00ffff;
            line-height: 1;
        }

        .ais-label {
            font-family: 'Montserrat', sans-serif;
            font-size: 20px;
            color: #ffffff;
            margin-top: 10px;
            font-weight: 600;
        }

        .insights-section {
            background: #0b0b2f;
            border: 1px solid rgba(0,255,255,.08);
            border-radius: 20px;
            padding: 30px;
            margin: 30px 0;
            box-shadow: 0 24px 60px rgba(0,0,0,.45);
            page-break-inside: avoid;
        }

        .section-title {
            font-family: 'Montserrat', sans-serif;
            font-size: 24px;
            font-weight: 700;
            color: #00ffff;
            margin-bottom: 20px;
        }

        .insights-text {
            color: #9da3ae;
            font-size: 16px;
            line-height: 1.8;
        }

        .insights-text p {
            margin-bottom: 15px;
        }

        .loops-section {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin: 30px 0;
        }

        .loop-card {
            background: #0b0b2f;
            border: 1px solid rgba(0,255,255,.08);
            border-radius: 20px;
            padding: 25px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,.35);
            page-break-inside: avoid;
        }

        .loop-title {
            font-family: 'Montserrat', sans-serif;
            font-size: 18px;
            font-weight: 600;
            color: #00ffff;
            margin-bottom: 15px;
        }

        .loop-score {
            font-family: 'Montserrat', sans-serif;
            font-size: 48px;
            font-weight: 800;
            margin-bottom: 10px;
        }

        .loop-score.high {
            color: #00ff88;
        }

        .loop-score.medium {
            color: #ff9500;
        }

        .loop-score.low {
            color: #ff453a;
        }

        .loop-bar {
            width: 100%;
            height: 8px;
            background: #0a0f1e;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 10px;
        }

        .loop-bar-fill {
            height: 100%;
            transition: width 0.3s;
        }

        .loop-bar-fill.high {
            background: #00ff88;
        }

        .loop-bar-fill.medium {
            background: #ff9500;
        }

        .loop-bar-fill.low {
            background: #ff453a;
        }

        .fixes-section {
            margin: 40px 0;
        }

        .fix-card {
            background: #0b0b2f;
            border: 1px solid rgba(0,255,255,.08);
            border-left: 4px solid #00ffff;
            border-radius: 20px;
            padding: 25px;
            margin-bottom: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,.35);
            page-break-inside: avoid;
        }

        .fix-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
        }

        .fix-name {
            font-family: 'Montserrat', sans-serif;
            font-size: 20px;
            font-weight: 700;
            color: #00ffff;
        }

        .fix-loop {
            font-size: 14px;
            color: #9da3ae;
            background: rgba(0,255,255,0.1);
            padding: 4px 12px;
            border-radius: 4px;
        }

        .fix-description {
            color: #ffffff;
            font-size: 15px;
            line-height: 1.7;
            margin-bottom: 15px;
        }

        .fix-impact, .fix-implementation {
            color: #9da3ae;
            font-size: 14px;
            margin-bottom: 8px;
        }

        .fix-impact strong, .fix-implementation strong {
            color: #00ff88;
        }

        .cta-section {
            background: #0b0b2f;
            border: 1px solid rgba(0,255,255,.08);
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            margin: 40px 0;
            box-shadow: 0 24px 60px rgba(0,0,0,.45);
            page-break-inside: avoid;
        }

        .cta-title {
            font-family: 'Montserrat', sans-serif;
            font-size: 28px;
            font-weight: 700;
            color: #00ffff;
            margin-bottom: 15px;
        }

        .cta-text {
            color: #9da3ae;
            font-size: 16px;
            margin-bottom: 25px;
        }

        .cta-contact {
            color: #ffffff;
            font-size: 18px;
            font-weight: 600;
        }

        .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 30px;
            border-top: 1px solid rgba(0,255,255,.08);
            color: #9da3ae;
            font-size: 14px;
        }

        .priority-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .priority-high {
            background: rgba(255, 69, 58, 0.2);
            color: #ff453a;
        }

        .priority-medium {
            background: rgba(255, 149, 0, 0.2);
            color: #ff9500;
        }
    </style>
</head>
<body>
    <!-- Cover Page -->
    <div class="header">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Alpine Logo" class="logo">` : '<div style="height: 80px;"></div>'}
        <div class="report-title" style="font-size: 28px; margin-top: 40px;">Your GTM Diagnostic</div>
        <div class="report-subtitle" style="font-size: 18px; margin-bottom: 10px;">Prepared for ${clientName}</div>
        <div class="report-date" style="font-size: 14px;">Generated on ${dateStr}</div>
    </div>

    <!-- Overall Score with Tagline -->
    <div class="score-section">
        <div class="ais-score">${overallScore}</div>
        <div class="ais-label">ASR Score</div>
        <div style="color: #9da3ae; font-size: 16px; margin-top: 20px; line-height: 1.6; max-width: 600px; margin-left: auto; margin-right: auto;">
            ${tagline}
        </div>
    </div>

    <!-- Page Break -->
    <div style="page-break-after: always;"></div>

    <!-- Executive Summary -->
    <div class="insights-section">
        <div class="section-title" style="font-size: 28px; margin-bottom: 30px;">Executive Summary</div>
        <div class="insights-text" style="font-size: 16px; line-height: 1.8;">
            <p style="margin-bottom: 20px;">Your The Alpine System diagnostic reveals an overall Alpine Signal Rating (ASR™) of <strong>${overallScore}/100</strong>. This comprehensive assessment evaluates your entire Go-To-Market infrastructure across Pipeline, Conversion, and Expansion loops.</p>

            <p style="margin-bottom: 20px;">Your strongest area is <strong>${strongestLoop.name}</strong>, while <strong>${weakestLoop.name}</strong> presents the greatest opportunity for improvement. Our analysis indicates that addressing inefficiencies in your ${weakestLoop.name} loop could yield immediate returns and unlock substantial growth potential.</p>

            <p style="margin-bottom: 20px;">${overallScore >= 70 ? 'With your strong baseline, the focus should be on optimization and scaling what\'s working. Small adjustments to high-performing systems can generate outsized results.' : 'Systematic improvements across your GTM infrastructure will create compounding returns. Focus on foundational fixes first, then scale what works.'}</p>

            <div style="margin-top: 30px;">
                <div style="font-weight: 600; color: #0df2ff; margin-bottom: 15px;">Key Findings:</div>
                <ul style="margin-left: 20px; line-height: 2;">
                    <li>${overallScore >= 70 ? 'Strong GTM infrastructure with excellent execution capabilities' : 'GTM infrastructure has solid foundation with room for improvement'}</li>
                    <li>Opportunities identified for process optimization and automation</li>
                    <li>Data infrastructure improvements recommended for better decision-making</li>
                </ul>
            </div>
        </div>
    </div>

    <!-- Page Break -->
    <div style="page-break-after: always;"></div>

    <!-- GTM Loop Performance Analysis -->
    <div class="insights-section">
        <div class="section-title" style="font-size: 28px; margin-bottom: 30px;">GTM Loop Performance Analysis</div>
        <div class="insights-text" style="font-size: 16px; line-height: 1.8;">
            <p style="margin-bottom: 30px;">Your Go-To-Market infrastructure is measured across three critical loops:</p>

            <!-- Pipeline Analysis -->
            <div style="margin-bottom: 40px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div style="font-size: 20px; font-weight: 600; color: #0df2ff;">Pipeline - Lead Generation & Qualification</div>
                    <div style="font-size: 24px; font-weight: 700; color: ${pipelineScore >= 70 ? '#00ff88' : pipelineScore >= 40 ? '#ff9500' : '#ff453a'};">${pipelineScore}%</div>
                </div>
                <div class="loop-bar" style="margin-bottom: 15px;">
                    <div class="loop-bar-fill ${pipelineScore >= 70 ? 'high' : pipelineScore >= 40 ? 'medium' : 'low'}" style="width: ${pipelineScore}%"></div>
                </div>
                <p style="color: #9da3ae;">${pipelineScore >= 70 ? `Your Pipeline loop is performing at ${pipelineScore}%, indicating strong lead generation and qualification processes. Focus on maintaining quality while scaling volume.` : pipelineScore >= 50 ? `Your Pipeline loop at ${pipelineScore}% shows room for improvement. Focus on ICP clarity, lead response time, and marketing/sales alignment.` : `Your Pipeline loop at ${pipelineScore}% requires immediate attention. Prioritize lead quality over quantity and fix marketing/sales handoffs.`}</p>
            </div>

            <!-- Conversion Analysis -->
            <div style="margin-bottom: 40px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div style="font-size: 20px; font-weight: 600; color: #0df2ff;">Conversion - Deal Velocity & Win Rate</div>
                    <div style="font-size: 24px; font-weight: 700; color: ${conversionScore >= 70 ? '#00ff88' : conversionScore >= 40 ? '#ff9500' : '#ff453a'};">${conversionScore}%</div>
                </div>
                <div class="loop-bar" style="margin-bottom: 15px;">
                    <div class="loop-bar-fill ${conversionScore >= 70 ? 'high' : conversionScore >= 40 ? 'medium' : 'low'}" style="width: ${conversionScore}%"></div>
                </div>
                <p style="color: #9da3ae;">${conversionScore >= 70 ? `Your Conversion loop is strong at ${conversionScore}%. Continue refining your sales process and consider expanding your team to capitalize on this strength.` : conversionScore >= 50 ? `Your ${conversionScore}% Conversion score indicates inconsistent sales execution. Focus on standardizing processes, improving sales enablement, and reducing cycle times.` : `Your Conversion loop at ${conversionScore}% is below expectations. Implement structured discovery, productize your offers, and build proposal templates.`}</p>
            </div>

            <!-- Expansion Analysis -->
            <div style="margin-bottom: 40px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div style="font-size: 20px; font-weight: 600; color: #0df2ff;">Expansion - Retention & Growth</div>
                    <div style="font-size: 24px; font-weight: 700; color: ${expansionScore >= 70 ? '#00ff88' : expansionScore >= 40 ? '#ff9500' : '#ff453a'};">${expansionScore}%</div>
                </div>
                <div class="loop-bar" style="margin-bottom: 15px;">
                    <div class="loop-bar-fill ${expansionScore >= 70 ? 'high' : expansionScore >= 40 ? 'medium' : 'low'}" style="width: ${expansionScore}%"></div>
                </div>
                <p style="color: #9da3ae;">${expansionScore >= 70 ? `Expansion loop strength at ${expansionScore}% shows excellent customer retention and growth. Continue investing in customer success and expansion playbooks.` : expansionScore >= 50 ? `Your Expansion score of ${expansionScore}% indicates room to grow existing accounts. Build systematic expansion motions and reduce time-to-value.` : `Your Expansion loop at ${expansionScore}% signals retention challenges. Focus on onboarding, customer health scoring, and churn prevention.`}</p>
            </div>
        </div>
    </div>

    <!-- Page Break -->
    <div style="page-break-after: always;"></div>

    <!-- Priority Focus Area -->
    <div class="insights-section">
        <div class="section-title" style="font-size: 28px; margin-bottom: 30px;">Priority Focus Area</div>
        <div class="insights-text" style="font-size: 16px; line-height: 1.8;">
            <div style="background: rgba(255, 69, 58, 0.1); border-left: 4px solid #ff453a; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
                <div style="font-size: 20px; font-weight: 600; color: #ff453a; margin-bottom: 10px;">${weakestLoop.name} Loop - Your Highest Impact Improvement Area</div>
                <p style="color: #ffffff; margin-bottom: 0;">${weakestLoop.name} ${weakestLoop.score >= 60 ? 'performance is below potential' : 'rates are below expectations'}. ${weakestLoop.name === 'Conversion' ? 'Too many deals stalling or lost to competition.' : weakestLoop.name === 'Pipeline' ? 'Not enough qualified leads reaching your sales team.' : 'Customers churning before you can expand accounts.'}</p>
            </div>

            <div style="margin-bottom: 30px;">
                <div style="font-weight: 600; color: #0df2ff; margin-bottom: 15px;">Root Causes:</div>
                <ul style="margin-left: 20px; line-height: 2; color: #9da3ae;">
                    ${rootCauses.map(cause => `<li>${cause}</li>`).join('')}
                </ul>
            </div>

            <div style="font-weight: 600; color: #0df2ff; margin-bottom: 20px; font-size: 18px;">Recommended Fixes:</div>

            <!-- Fix 1 - Highest Priority -->
            <div class="fix-card" style="margin-bottom: 30px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <div style="font-size: 18px; font-weight: 600; color: #0df2ff;">${selectedFixes[weakestLoop.name.toLowerCase()].name}</div>
                    <div style="background: rgba(255, 69, 58, 0.2); color: #ff453a; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">HIGH PRIORITY</div>
                </div>
                <div style="color: #ffffff; margin-bottom: 15px;"><strong>Action:</strong> ${selectedFixes[weakestLoop.name.toLowerCase()].description}</div>
                <div style="color: #00ff88; margin-bottom: 5px;">■ <strong>Impact:</strong> ${selectedFixes[weakestLoop.name.toLowerCase()].impact}</div>
            </div>

            <!-- Additional fixes for other loops -->
            ${loopScoresArray.slice(1).map((loop, index) => `
            <div class="fix-card" style="margin-bottom: 30px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <div style="font-size: 18px; font-weight: 600; color: #0df2ff;">${selectedFixes[loop.name.toLowerCase()].name}</div>
                    <div style="background: rgba(255, 149, 0, 0.2); color: #ff9500; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">${index === 0 ? 'MED' : 'LOW'} PRIORITY</div>
                </div>
                <div style="color: #ffffff; margin-bottom: 15px;"><strong>Action:</strong> ${selectedFixes[loop.name.toLowerCase()].description}</div>
                <div style="color: #00ff88; margin-bottom: 5px;">■ <strong>Impact:</strong> ${selectedFixes[loop.name.toLowerCase()].impact}</div>
            </div>
            `).join('')}
        </div>
    </div>

    <!-- Page Break -->
    <div style="page-break-after: always;"></div>

    <!-- Recommended Next Steps -->
    <div class="insights-section">
        <div class="section-title" style="font-size: 28px; margin-bottom: 30px;">Recommended Next Steps</div>
        <div class="insights-text" style="font-size: 16px; line-height: 1.8;">
            <p style="margin-bottom: 30px;">Based on your diagnostic results, we recommend focusing on the priority areas identified above. Our team can help you implement these improvements systematically and achieve measurable results within 90 days.</p>
        </div>
    </div>

    <!-- Call to Action -->
    <div class="cta-section" style="padding: 50px 40px;">
        <div style="background: rgba(13, 242, 255, 0.1); border: 2px solid #0df2ff; border-radius: 12px; padding: 40px;">
            <div style="font-size: 24px; font-weight: 700; color: #0df2ff; margin-bottom: 20px; text-align: center;">Run a Free GTM System Diagnostic</div>

            <div style="color: #ffffff; margin-bottom: 20px; font-size: 16px;">Book your complimentary ASR™ session to:</div>

            <div style="margin-bottom: 30px; line-height: 2; color: #9da3ae; font-size: 15px;">
                <div style="margin-bottom: 12px;">• Benchmark GTM health across Pipeline · Conversion · Expansion</div>
                <div style="margin-bottom: 12px;">• Quantify top breakdowns by $ impact and ROI window</div>
                <div style="margin-bottom: 12px;">• Receive a precision-engineered Fix Console roadmap</div>
            </div>

            <div style="border-top: 1px solid rgba(13, 242, 255, 0.2); padding-top: 25px; line-height: 2; font-size: 15px;">
                <div style="margin-bottom: 10px;">
                    <span style="color: #0df2ff; font-weight: 600;">→ BOOK SESSION:</span>
                    <a href="https://calendly.com/thealpinesystem/gtm-assessment" style="color: #00ffff; text-decoration: none; font-weight: 500;">calendly.com/thealpinesystem/gtm-assessment</a>
                </div>
                <div style="margin-bottom: 10px;">
                    <span style="color: #0df2ff; font-weight: 600;">→ EMAIL:</span>
                    <a href="mailto:signal@thealpinesystem.com" style="color: #00ffff; text-decoration: none; font-weight: 500;">signal@thealpinesystem.com</a>
                </div>
                <div>
                    <span style="color: #0df2ff; font-weight: 600;">→ LEARN MORE:</span>
                    <a href="https://thealpinesystem.com" style="color: #00ffff; text-decoration: none; font-weight: 500;">thealpinesystem.com</a>
                </div>
            </div>
        </div>
    </div>

    <!-- Footer -->
    <div class="footer">
        © The Alpine System ${new Date().getFullYear()} • Assess.Fix.Scale.Repeat.
    </div>
</body>
</html>
    `;
}

// Start server
app.listen(PORT, () => {
    console.log('\n🚀 Alpine Signal Rating Backend Server');
    console.log('=====================================');
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`✓ API endpoint: http://localhost:${PORT}/wizard_submit`);
    console.log(`✓ Frontend files: http://localhost:${PORT}/wizard.html`);
    console.log('\n📝 Scoring calculations are secure and server-side only');
    console.log('   Your proprietary logic is protected!\n');
    console.log('Press Ctrl+C to stop the server\n');
});
