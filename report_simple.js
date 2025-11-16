// Simplified Report Page Logic - Reads from localStorage only
// No client selection, no API calls, self-contained one-time experience

document.addEventListener('DOMContentLoaded', function() {
    // Set report generation date
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('report-date').textContent = dateStr;

    // Load report from localStorage
    loadReport();
});

function loadReport() {
    // Get results from localStorage
    const resultsJSON = localStorage.getItem('wizardResults');

    if (!resultsJSON) {
        // No data - show the no-data state
        showNoDataState();
        return;
    }

    try {
        const results = JSON.parse(resultsJSON);

        // Render the report
        renderReport(results);
    } catch (error) {
        console.error('Error parsing results:', error);
        showNoDataState();
    }
}

function showNoDataState() {
    const reportContent = document.getElementById('report-content');
    reportContent.innerHTML = `
        <div class="no-data-state">
            <i class="fas fa-chart-line"></i>
            <h3>No Report Data Available</h3>
            <p>Complete the assessment to view your results</p>
            <button class="cta-button primary" onclick="window.location.href='/wizard.html'" style="margin-top: 24px;">
                <i class="fas fa-arrow-left"></i> Take Assessment
            </button>
        </div>
    `;
}

function renderReport(results) {
    const reportContent = document.getElementById('report-content');

    // Convert scores to percentages (0-1 to 0-100)
    const overallScore = Math.round(results.overall_ssi * 100);
    const pipelineScore = Math.round(results.loop_scores.Pipeline * 100);
    const conversionScore = Math.round(results.loop_scores.Conversion * 100);
    const expansionScore = Math.round(results.loop_scores.Expansion * 100);

    // Get priority recommendations
    const recommendations = results.priority_recommendations || [];
    const patterns = results.detected_patterns || [];

    // Identify strongest and weakest loops
    const loopScoresArray = [
        { name: 'Pipeline', score: pipelineScore },
        { name: 'Conversion', score: conversionScore },
        { name: 'Expansion', score: expansionScore }
    ];
    loopScoresArray.sort((a, b) => b.score - a.score);
    const strongestLoop = loopScoresArray[0];
    const weakestLoop = loopScoresArray[2];

    // Generate contextual insights
    const insights = generateInsights(results.clientName, overallScore, strongestLoop, weakestLoop);

    reportContent.innerHTML = `
        <!-- Overall ASR Score -->
        <div class="ais-score-section">
            <div class="ais-score-large">${overallScore}</div>
            <div class="ais-label-large">Alpine Signal Rating (ASR™)</div>
            <div class="ais-description">Overall GTM Infrastructure Health for ${results.clientName}</div>
        </div>

        <!-- Key Insights & Commentary -->
        <div class="insights-commentary-section" style="background: var(--card-bg); padding: 32px; border-radius: var(--radius-lg); margin: 32px 0; border: 1px solid var(--border);">
            <h2 class="section-title" style="margin-top: 0;">
                <i class="fas fa-lightbulb"></i>
                Key Insights & Commentary
            </h2>
            <div style="color: var(--light-gray); line-height: 1.8; font-size: 16px;">
                ${insights.mainInsight}
                <br><br>
                ${insights.loopAnalysis}
                <br><br>
                ${insights.actionableOutcome}
            </div>
        </div>

        <!-- PCE Loop Scores -->
        <div class="pce-loops-section">
            <!-- Pipeline -->
            <div class="pce-loop-card">
                <div class="pce-loop-header">
                    <div class="pce-loop-title">
                        <i class="fas fa-funnel-dollar"></i>
                        Pipeline
                    </div>
                    <div class="pce-loop-score ${getScoreClass(pipelineScore)}">${pipelineScore}</div>
                </div>
                <div class="pce-loop-bar">
                    <div class="pce-loop-fill ${getScoreClass(pipelineScore)}" style="width: ${pipelineScore}%"></div>
                </div>
                <div class="pce-loop-description">
                    Lead generation, qualification, and pipeline health
                </div>
            </div>

            <!-- Conversion -->
            <div class="pce-loop-card">
                <div class="pce-loop-header">
                    <div class="pce-loop-title">
                        <i class="fas fa-chart-line"></i>
                        Conversion
                    </div>
                    <div class="pce-loop-score ${getScoreClass(conversionScore)}">${conversionScore}</div>
                </div>
                <div class="pce-loop-bar">
                    <div class="pce-loop-fill ${getScoreClass(conversionScore)}" style="width: ${conversionScore}%"></div>
                </div>
                <div class="pce-loop-description">
                    Sales effectiveness and deal closure
                </div>
            </div>

            <!-- Expansion -->
            <div class="pce-loop-card">
                <div class="pce-loop-header">
                    <div class="pce-loop-title">
                        <i class="fas fa-rocket"></i>
                        Expansion
                    </div>
                    <div class="pce-loop-score ${getScoreClass(expansionScore)}">${expansionScore}</div>
                </div>
                <div class="pce-loop-bar">
                    <div class="pce-loop-fill ${getScoreClass(expansionScore)}" style="width: ${expansionScore}%"></div>
                </div>
                <div class="pce-loop-description">
                    Customer retention and revenue expansion
                </div>
            </div>
        </div>

        <!-- Priority Recommendations -->
        <div class="recommendations-section" style="margin: 48px 0;">
            <h2 class="section-title">
                <i class="fas fa-star"></i>
                Priority Recommendations
            </h2>
            <div class="recommendations-grid">
                ${generatePriorityRecommendations(loopScoresArray).map((rec, index) => `
                <div class="recommendation-card" style="background: var(--card-bg); padding: 28px; border-radius: var(--radius-lg); border: 1px solid var(--border); margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                        <div>
                            <div style="font-size: 20px; font-weight: 600; color: var(--text-color); margin-bottom: 8px;">
                                ${index + 1}. ${rec.loop} Loop Optimization
                            </div>
                            <div style="display: inline-block; padding: 4px 12px; background: ${rec.priority === 'High' ? 'rgba(255, 69, 58, 0.2)' : 'rgba(255, 149, 0, 0.2)'}; color: ${rec.priority === 'High' ? 'var(--red)' : 'var(--orange)'}; border-radius: 4px; font-size: 13px; font-weight: 600; text-transform: uppercase;">
                                ${rec.priority} Priority
                            </div>
                        </div>
                    </div>
                    <div style="color: var(--light-gray); line-height: 1.6; font-size: 15px;">
                        ${rec.description}
                    </div>
                </div>
                `).join('')}
            </div>
        </div>


        <!-- PDF Download Incentive -->
        <div style="background: var(--card-bg); padding: 32px 40px; border-radius: var(--radius-lg); margin: 48px 0; border: 1px solid var(--border); text-align: center;">
            <h2 class="section-title" style="font-size: 24px; margin-bottom: 16px;">
                <i class="fas fa-file-pdf" style="color: var(--cyan); margin-right: 8px;"></i>
                Get Your Complete PDF Report
            </h2>
            <p style="color: var(--light-gray); font-size: 16px; line-height: 1.6; max-width: 650px; margin: 0 auto 24px;">
                Download the full PDF for detailed fix recommendations, implementation roadmap, and priority sequencing across all three GTM loops. Take this report to your team and start addressing your highest-impact opportunities immediately.
            </p>
            <button class="cta-button primary" onclick="downloadResults()" style="padding: 16px 32px; background: var(--cyan); color: var(--bg); border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 10px;">
                <i class="fas fa-download"></i>
                Download Full PDF Report
            </button>
        </div>

        <!-- Call to Action -->
        <div class="cta-section" style="background: linear-gradient(135deg, var(--card-bg) 0%, #1a2540 100%); padding: 48px 40px; border-radius: var(--radius-lg); margin: 48px 0; text-align: center; border: 1px solid var(--border);">
            <div style="display: inline-block; padding: 6px 16px; background: rgba(255, 149, 0, 0.15); color: var(--warning); border-radius: 4px; font-size: 13px; font-weight: 600; text-transform: uppercase; margin-bottom: 20px;">
                Note: This assessment is ~80% accurate
            </div>
            <h2 class="section-title" style="font-size: 28px; margin-bottom: 16px;">
                Want the Full Picture?
            </h2>
            <p style="color: var(--light-gray); font-size: 17px; line-height: 1.7; max-width: 750px; margin: 0 auto 24px;">
                This Signal Rating provides a directional view based on limited inputs. Our full GTM System Diagnostic is far more comprehensive:
            </p>
            <div style="max-width: 700px; margin: 0 auto 32px; text-align: left;">
                <div style="display: grid; gap: 16px;">
                    <div style="display: flex; gap: 12px; align-items: start;">
                        <i class="fas fa-check-circle" style="color: var(--green); margin-top: 4px;"></i>
                        <div style="color: var(--light-gray); line-height: 1.6;"><strong style="color: var(--white);">25 comprehensive inputs</strong> (manual assessment or automated via API integration)</div>
                    </div>
                    <div style="display: flex; gap: 12px; align-items: start;">
                        <i class="fas fa-check-circle" style="color: var(--green); margin-top: 4px;"></i>
                        <div style="color: var(--light-gray); line-height: 1.6;"><strong style="color: var(--white);">Financial Intelligence Engine</strong> - quantifies dollar risk based on your current AIS score</div>
                    </div>
                    <div style="display: flex; gap: 12px; align-items: start;">
                        <i class="fas fa-check-circle" style="color: var(--green); margin-top: 4px;"></i>
                        <div style="color: var(--light-gray); line-height: 1.6;"><strong style="color: var(--white);">Sequenced fix roadmap</strong> prioritized by total ROI, not just what's broken</div>
                    </div>
                    <div style="display: flex; gap: 12px; align-items: start;">
                        <i class="fas fa-check-circle" style="color: var(--green); margin-top: 4px;"></i>
                        <div style="color: var(--light-gray); line-height: 1.6;"><strong style="color: var(--white);">Implementation tracking</strong> with direct GTM and revenue impact monitoring</div>
                    </div>
                </div>
            </div>
            <div class="cta-buttons" style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
                <button class="cta-button primary" onclick="window.open('https://calendly.com/thealpinesystem/gtm-assessment', '_blank')" style="padding: 16px 32px; background: var(--cyan); color: var(--bg); border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 10px;">
                    <i class="fas fa-calendar-check"></i>
                    Schedule Full Diagnostic Call
                </button>
                <button class="cta-button secondary" onclick="window.open('https://www.thealpinesystem.com/working', '_blank')" style="padding: 16px 32px; background: transparent; color: var(--cyan); border: 2px solid var(--cyan); border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 10px;">
                    <i class="fas fa-tools"></i>
                    Learn More About Full Diagnostic
                </button>
            </div>
        </div>
    `;
}

function getScoreClass(score) {
    if (score >= 70) return 'score-high';
    if (score >= 40) return 'score-medium';
    return 'score-low';
}

function generateInsights(clientName, overallScore, strongestLoop, weakestLoop) {
    // Determine overall health description
    let healthDescription;
    if (overallScore >= 80) {
        healthDescription = 'indicating exceptional GTM infrastructure health with minimal optimization needs';
    } else if (overallScore >= 70) {
        healthDescription = 'indicating strong GTM infrastructure health with minor optimization opportunities';
    } else if (overallScore >= 60) {
        healthDescription = 'indicating solid GTM infrastructure with notable areas for improvement';
    } else if (overallScore >= 50) {
        healthDescription = 'indicating moderate GTM infrastructure health with significant improvement opportunities';
    } else if (overallScore >= 40) {
        healthDescription = 'indicating concerning GTM infrastructure health requiring immediate attention';
    } else {
        healthDescription = 'indicating critical GTM infrastructure challenges requiring urgent intervention';
    }

    // Main insight
    const mainInsight = `<strong>${clientName}</strong> currently has an overall AIS score of <strong>${overallScore}</strong>, ${healthDescription}.`;

    // Loop analysis
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

    const loopAnalysis = `The <strong>${weakestLoop.name}</strong> loop (${weakestLoop.score}) represents the ${concernLevel} and should be the focus of immediate improvement efforts. In contrast, the <strong>${strongestLoop.name}</strong> loop (${strongestLoop.score}) shows relative strength and can serve as a foundation for broader GTM improvements.`;

    // Actionable outcome
    const actionableOutcome = `By addressing the priority metrics identified below, <strong>${clientName}</strong> can expect to see measurable improvements in pipeline velocity, conversion rates, and customer expansion within 90 days.`;

    return {
        mainInsight,
        loopAnalysis,
        actionableOutcome
    };
}

function generatePriorityRecommendations(loopScoresArray) {
    // Sort loops by score (lowest first = highest priority)
    const sorted = [...loopScoresArray].sort((a, b) => a.score - b.score);

    const recommendations = [];

    sorted.forEach((loop, index) => {
        let priority;
        if (index === 0) {
            priority = loop.score < 60 ? 'High' : 'Medium';
        } else {
            priority = 'Medium';
        }

        let description;
        switch (loop.name) {
            case 'Pipeline':
                description = 'Focus on lead generation, qualification, and pipeline coverage to build a healthy sales funnel. Schedule a diagnostic call to see your detailed Pipeline metrics and custom fix roadmap.';
                break;
            case 'Conversion':
                description = 'Improve win rates, shorten sales cycles, and optimize your deal conversion process. Schedule a diagnostic call to see your detailed Conversion metrics and custom fix roadmap.';
                break;
            case 'Expansion':
                description = 'Strengthen customer retention, reduce churn, and build expansion revenue streams. Schedule a diagnostic call to see your detailed Expansion metrics and custom fix roadmap.';
                break;
        }

        recommendations.push({
            loop: loop.name,
            priority,
            description
        });
    });

    return recommendations;
}

async function downloadResults() {
    const resultsJSON = localStorage.getItem('wizardResults');
    if (!resultsJSON) {
        alert('No results to download');
        return;
    }

    const results = JSON.parse(resultsJSON);

    try {
        // Show loading state
        const btn = event.target.closest('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating PDF...';
        btn.disabled = true;

        // Use relative path for both local and production
        const API_ENDPOINT = '/api/generate-pdf';

        // Call backend to generate PDF
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(results)
        });

        if (!response.ok) {
            throw new Error('PDF generation failed');
        }

        // Get response with download URL
        const data = await response.json();
        console.log('PDF generated, downloading from:', data.downloadUrl);

        // Download the PDF using the provided URL
        const a = document.createElement('a');
        a.href = data.downloadUrl;
        a.download = data.filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
        }, 100);

        // Reset button
        btn.innerHTML = originalText;
        btn.disabled = false;

    } catch (error) {
        console.error('Error downloading PDF:', error);
        alert('Failed to generate PDF. Please try again or contact support.');

        // Reset button
        const btn = event.target.closest('button');
        btn.innerHTML = '<i class="fas fa-download"></i> Download Full Roadmap';
        btn.disabled = false;
    }
}

// PDF Save function (placeholder - requires backend PDF generation)
function saveAsPDF() {
    alert('PDF generation requires backend service. Contact support for implementation.');
    // In production, this would call your backend PDF generation endpoint
}
