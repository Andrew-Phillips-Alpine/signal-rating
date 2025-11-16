/**
 * Alpine GTM Diagnostic Wizard - v3.0
 * New flow: 5 diagnostic questions with 3 staggered cohort questions + optional final step
 */

let currentStep = 0;
let totalSteps = 9; // 5 questions + 3 cohort qualifiers + 1 final optional step
let currentClientId = null; // Store client ID for PDF download
let wizardAnswers = {
    // Optional lead capture (collected at end)
    user_email: null,
    company_name: null,
    // Cohort qualifiers (staggered throughout)
    arr: null,
    employees: null,
    sector: null,
    // Backward compatibility
    email: null,
    cohort: null,
    // Diagnostic questions
    question_1_pipeline_health: null,
    question_2_sales_conversion: null,
    question_3_customer_success: null,
    question_4_economics_and_efficiency: null,
    question_5_top_challenge: null
};

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mldpknqg';

let wizardConfig = null;

// Load wizard configuration on page load
document.addEventListener('DOMContentLoaded', async function() {
    await loadWizardConfig();
    generateQuestions();
    setupEventListeners();
    showStep(0); // Show first question
    updateProgress();
    updateNextButton();
});

async function loadWizardConfig() {
    try {
        const response = await fetch('/wizard_questions.json');
        wizardConfig = await response.json();
    } catch (error) {
        console.error('Error loading wizard config:', error);
    }
}

function generateQuestions() {
    if (!wizardConfig) return;

    const questions = wizardConfig.questions;

    // Generate Questions 1-4 (scale questions)
    const scaleQuestions = [
        'question_1_pipeline_health',
        'question_2_sales_conversion',
        'question_3_customer_success',
        'question_4_economics_and_efficiency'
    ];

    scaleQuestions.forEach((questionId, index) => {
        const questionNum = index + 1;
        const questionData = questions[questionId];
        if (!questionData) return;

        const questionCard = document.createElement('div');
        questionCard.className = 'question-card';
        questionCard.id = `question-${questionNum}`;

        // Map to actual step numbers in the flow (questions are at steps 0,1,3,5)
        const actualStepNumbers = [1, 2, 4, 6]; // (1 of 9), (2 of 9), (4 of 9), (6 of 9)
        const stepDisplay = actualStepNumbers[index];

        questionCard.innerHTML = `
            <div class="question-number">${questionData.category} (${stepDisplay} of 9)</div>
            <div class="question-text">QUESTION ${questionNum}: ${questionData.question}</div>
            <div class="option-group">
                ${generateScaleOptions(questionId, questionData.descriptors)}
            </div>
        `;

        // Insert before question 5
        const question5 = document.getElementById('question-5');
        question5.parentNode.insertBefore(questionCard, question5);
    });

    // Generate Question 5 (top challenge) options
    const challengeQuestion = questions.question_5_top_challenge || questions.question_7_specific_pain;
    if (challengeQuestion && challengeQuestion.options) {
        const challengeContainer = document.getElementById('challenge-options');

        challengeQuestion.options.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'scale-option';
            optionDiv.setAttribute('onclick', `selectChallengeOption('${option.value}', this)`);
            optionDiv.innerHTML = `
                <input type="radio" name="top-challenge" value="${option.value}" id="challenge-${option.value}">
                <div>
                    <div class="option-label">${option.label}</div>
                    <div class="option-description">${option.category}</div>
                </div>
            `;
            challengeContainer.appendChild(optionDiv);
        });
    }
}

function generateScaleOptions(questionId, descriptors) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `
            <div class="scale-option" onclick="selectOption('${questionId}', ${i}, this)">
                <input type="radio" name="${questionId}" value="${i}" id="${questionId}-${i}">
                <div>
                    <div class="option-label">Level ${i}</div>
                    <div class="option-description">${descriptors[i]}</div>
                </div>
            </div>
        `;
    }
    return html;
}

function setupEventListeners() {
    // Final step - optional email and company name
    const emailFinal = document.getElementById('email-final');
    const companyFinal = document.getElementById('company-name-final');

    if (emailFinal) {
        emailFinal.addEventListener('input', function(e) {
            wizardAnswers.user_email = e.target.value.trim();
            wizardAnswers.email = e.target.value.trim(); // Backward compatibility
            updateNextButton();
        });
    }

    if (companyFinal) {
        companyFinal.addEventListener('input', function(e) {
            wizardAnswers.company_name = e.target.value.trim();
            updateNextButton();
        });
    }

    // ARR selection
    document.getElementById('arr-select').addEventListener('change', function(e) {
        wizardAnswers.arr = e.target.value;
        wizardAnswers.cohort = e.target.value; // Backward compatibility
        updateNextButton();
    });

    // Employees selection
    document.getElementById('employees-select').addEventListener('change', function(e) {
        wizardAnswers.employees = e.target.value;
        updateNextButton();
    });

    // Sector selection
    document.getElementById('sector-select').addEventListener('change', function(e) {
        wizardAnswers.sector = e.target.value;
        updateNextButton();
    });

    // Top challenge options
    const challengeInputs = document.querySelectorAll('input[name="top-challenge"]');
    challengeInputs.forEach(input => {
        input.addEventListener('change', function(e) {
            wizardAnswers.question_5_top_challenge = e.target.value;
            // Also set old field name for backward compatibility
            wizardAnswers.question_7_specific_pain = e.target.value;

            // Update UI
            document.querySelectorAll('#challenge-options .scale-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            e.target.closest('.scale-option').classList.add('selected');

            updateNextButton();
        });
    });
}

function selectOption(questionId, value, element) {
    // Update answer
    wizardAnswers[questionId] = value;

    // Update radio button
    const radio = document.getElementById(`${questionId}-${value}`);
    if (radio) radio.checked = true;

    // Update UI
    const parent = element.closest('.option-group');
    parent.querySelectorAll('.scale-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    element.classList.add('selected');

    updateNextButton();
}

function selectChallengeOption(value, element) {
    // Update answer
    wizardAnswers.question_5_top_challenge = value;
    wizardAnswers.question_7_specific_pain = value; // Backward compatibility

    // Update radio button
    const radio = document.getElementById(`challenge-${value}`);
    if (radio) radio.checked = true;

    // Update UI
    document.querySelectorAll('#challenge-options .scale-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    element.classList.add('selected');

    updateNextButton();
}

function updateProgress() {
    const progress = (currentStep / totalSteps) * 100;
    document.getElementById('progressBar').style.width = `${progress}%`;

    // New flow labels
    const stepLabels = {
        0: 'Pipeline Health',
        1: 'Sales Conversion',
        2: 'Company Size',
        3: 'Customer Success',
        4: 'Industry/Sector',
        5: 'Economics & Efficiency',
        6: 'Team Size',
        7: 'Top Challenge',
        8: 'Final Step'
    };

    const stepLabel = stepLabels[currentStep] || `Step ${currentStep}`;
    document.getElementById('progressText').textContent = `${stepLabel} (${currentStep + 1}/${totalSteps})`;
}

function updateNextButton() {
    const nextBtn = document.getElementById('nextBtn');
    const currentAnswer = getCurrentStepAnswer();

    if (currentAnswer !== null && currentAnswer !== '') {
        nextBtn.disabled = false;
    } else {
        nextBtn.disabled = true;
    }

    // Update button text on last step
    if (currentStep === totalSteps - 1) {
        nextBtn.textContent = 'See Your Results';
        nextBtn.disabled = false; // Always enable on final step (fields are optional)
    } else {
        nextBtn.textContent = 'Next';
    }
}

function getCurrentStepAnswer() {
    // New flow mapping
    const stepMap = {
        0: 'question_1_pipeline_health',
        1: 'question_2_sales_conversion',
        2: 'arr',
        3: 'question_3_customer_success',
        4: 'sector',
        5: 'question_4_economics_and_efficiency',
        6: 'employees',
        7: 'question_5_top_challenge',
        8: 'final_step' // Special handling - optional fields
    };

    const answerKey = stepMap[currentStep];

    // Special handling for final step (optional)
    if (currentStep === 8) {
        return true; // Always allow proceeding from final step (fields are optional)
    }

    const answer = wizardAnswers[answerKey];
    return answer;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function nextQuestion() {
    if (currentStep < totalSteps - 1) {
        currentStep++;
        showStep(currentStep);
        updateProgress();
        updateNextButton();
        updatePrevButton();
    } else {
        submitWizard();
    }
}

function previousQuestion() {
    if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
        updateProgress();
        updateNextButton();
        updatePrevButton();
    }
}

function showStep(stepNum) {
    // Hide all steps
    document.querySelectorAll('.question-card').forEach(card => {
        card.classList.remove('active');
        card.style.display = 'none';
    });

    // New flow mapping:
    // 0: question-1, 1: question-2, 2: cohort-arr, 3: question-3,
    // 4: cohort-sector, 5: question-4, 6: cohort-employees, 7: question-5, 8: final-step
    const stepCardMap = {
        0: 'question-1',
        1: 'question-2',
        2: 'cohort-arr',
        3: 'question-3',
        4: 'cohort-sector',
        5: 'question-4',
        6: 'cohort-employees',
        7: 'question-5',
        8: 'final-step'
    };

    const cardId = stepCardMap[stepNum];

    // Show current step
    const currentCard = document.getElementById(cardId);
    if (currentCard) {
        currentCard.classList.add('active');
        currentCard.style.display = 'block';
    }
}

function updatePrevButton() {
    const prevBtn = document.getElementById('prevBtn');
    if (currentStep === 0) {
        prevBtn.style.visibility = 'hidden';
    } else {
        prevBtn.style.visibility = 'visible';
    }
}

async function submitWizard() {
    // Show loading spinner
    document.getElementById('wizardContainer').style.display = 'none';
    document.getElementById('loadingSpinner').style.display = 'block';

    try {
        // Generate client ID once for both API submission and PDF download
        currentClientId = `wizard_${Date.now()}`;

        // Submit to our API (uses relative path for both local and production)
        const API_ENDPOINT = '/wizard_submit';

        const apiResponse = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                answers: wizardAnswers,
                client_name: wizardAnswers.company_name || 'Wizard User',
                client_id: currentClientId,
                email: wizardAnswers.user_email || wizardAnswers.email || ''
            })
        });

        if (!apiResponse.ok) {
            throw new Error('API submission failed');
        }

        const results = await apiResponse.json();

        // Store complete results in localStorage for report page
        const reportData = {
            clientName: wizardAnswers.company_name || 'Your Company',
            email: wizardAnswers.user_email || wizardAnswers.email,
            overall_ssi: results.overall_ssi,
            loop_scores: results.loop_scores,
            priority_recommendations: results.priority_recommendations || [],
            detected_patterns: results.detected_patterns || [],
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('wizardResults', JSON.stringify(reportData));

        // Submit to Formspree in parallel (don't block on this)
        submitToFormspree(results).catch(err => console.warn('Formspree submission failed:', err));

        // Redirect to report page
        window.location.href = '/report.html';

    } catch (error) {
        console.error('Error submitting wizard:', error);

        // Hide loading, show wizard
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('wizardContainer').style.display = 'block';

        // Determine error type and show appropriate message
        let errorMessage = 'Failed to submit wizard. Please try again.';
        let errorDetails = '';

        if (!navigator.onLine) {
            errorMessage = 'No internet connection detected.';
            errorDetails = 'Please check your network connection and try again.';
        } else if (error.message.includes('API submission failed')) {
            errorMessage = 'Server error occurred.';
            errorDetails = 'Our servers may be temporarily unavailable. Please try again in a few moments.';
        } else if (error.message.includes('timeout')) {
            errorMessage = 'Request timed out.';
            errorDetails = 'The submission took too long. Please check your connection and try again.';
        } else {
            errorDetails = error.message || 'An unexpected error occurred.';
        }

        // Show error modal instead of basic alert
        showErrorModal(errorMessage, errorDetails);
    }
}

function showErrorModal(title, message) {
    // Create modal HTML
    const modalHTML = `
        <div id="errorModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;">
            <div style="background: white; border-radius: 12px; padding: 32px; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                <div style="text-align: center; margin-bottom: 20px;">
                    <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #ef4444;"></i>
                </div>
                <h3 style="color: #1a1a2e; margin: 0 0 12px; text-align: center;">${title}</h3>
                <p style="color: #6b7280; margin: 0 0 24px; text-align: center;">${message}</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button onclick="closeErrorModal()" style="padding: 12px 24px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        Try Again
                    </button>
                    <button onclick="location.reload()" style="padding: 12px 24px; background: #e5e7eb; color: #1a1a2e; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        Refresh Page
                    </button>
                </div>
            </div>
        </div>
    `;

    // Inject modal
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHTML;
    document.body.appendChild(tempDiv.firstElementChild);
}

window.closeErrorModal = function() {
    const modal = document.getElementById('errorModal');
    if (modal) {
        modal.remove();
    }
}

async function submitToFormspree(results) {
    const overall_ssi = Math.round((results.overall_ssi || 0) * 100);
    const loop_scores = results.loop_scores || {};

    const formData = {
        email: wizardAnswers.email,
        company_name: wizardAnswers.company_name,
        arr: wizardAnswers.arr,
        employees: wizardAnswers.employees,
        sector: wizardAnswers.sector,
        revenue_rating: overall_ssi,
        pipeline_score: Math.round((loop_scores.Pipeline || 0) * 100),
        conversion_score: Math.round((loop_scores.Conversion || 0) * 100),
        expansion_score: Math.round((loop_scores['Delivery & Expansion'] || loop_scores.Expansion || 0) * 100),
        top_challenge: wizardAnswers.question_5_top_challenge,
        _subject: `Revenue Rating: ${overall_ssi} - ${wizardAnswers.company_name}`
    };

    await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    });
}

// Helper: Identify weakest loop and generate insights
function getWeakestLoopInsights(loop_scores, user_challenge) {
    const pipeline = loop_scores.Pipeline || 0;
    const conversion = loop_scores.Conversion || 0;
    const expansion = loop_scores['Delivery & Expansion'] || loop_scores.Expansion || 0;

    // Find weakest loop
    const loops = {
        'Pipeline': pipeline,
        'Conversion': conversion,
        'Expansion': expansion
    };

    const weakestLoop = Object.entries(loops).reduce((min, [name, score]) =>
        score < min.score ? { name, score } : min,
        { name: 'Pipeline', score: pipeline }
    );

    return generateLoopSpecificInsight(weakestLoop.name, weakestLoop.score, user_challenge);
}

// Generate insights based on weakest loop
function generateLoopSpecificInsight(loopName, score, userChallenge) {
    const insights = {
        'Pipeline': {
            diagnosis: score <= 0.4 ?
                "Your pipeline generation is in crisis mode. With insufficient top-of-funnel activity, you're experiencing feast-or-famine revenue cycles." :
                score <= 0.7 ?
                "Pipeline health is weak. You're not generating enough qualified opportunities to hit targets consistently." :
                "Pipeline is functional but room to optimize quality and predictability.",
            root_causes: [
                "Vague or non-existent ICP → reps waste time on poor-fit prospects",
                "Generic messaging → attracting curiosity-seekers not buyers",
                "No systematic lead gen → feast-or-famine pipeline",
                "Weak qualification → bloated pipeline of low-intent prospects"
            ],
            fixes: [
                { id: '2250.01', title: 'Precision ICP Definition', action: 'Run Client Archaeology: analyze your best 10 and worst 10 clients. Extract 3-5 Must-Have criteria and 2-3 Exclusion criteria.', impact: '30-60 days to see 20-30% improvement in MQL→SQL conversion' },
                { id: '2250.04', title: 'PreCall Slingshot', action: 'Require prospects to answer 1-3 mandatory questions when booking. Filters tire-kickers immediately.', impact: '40%+ improvement in show rates within 2 weeks' },
                { id: '2250.15', title: 'Content Loop', action: 'Transform each client win into 3 insights across 5 formats. Creates systematic proof-based demand.', impact: '90 days to establish sustainable demand engine' }
            ]
        },
        'Conversion': {
            diagnosis: score <= 0.4 ?
                "Sales conversion is broken. Low win rates and long cycles indicate fundamental issues with sales process or ICP fit." :
                score <= 0.7 ?
                "Conversion rates are below expectations. Too many deals stalling or lost to competition." :
                "Conversion is functional but inconsistent. System problem, not talent problem.",
            root_causes: [
                "No PreCall Slingshot → taking meetings with anyone who raises their hand",
                "Vague offers → prospects can't clearly see the value",
                "Weak discovery → failing to validate fit and urgency early",
                "Custom proposals → every deal takes weeks instead of hours"
            ],
            fixes: [
                { id: '2250.06', title: 'Guided Climb Offer Structure', action: 'Engineer 3-tier productized offers: Diagnostic → Refinement → Installed. Use 6-Point Offer Standard.', impact: '45-60 days to see 15-25% improvement in win rates' },
                { id: '2250.09', title: '24-Hour Proposal Workflow', action: 'Pre-built proposal templates for each offer. Same-day turnaround builds trust.', impact: 'Immediate - 20-30% reduction in sales cycle length' },
                { id: '2250.04', title: 'PreCall Slingshot', action: 'Stop meeting unqualified prospects. Require context before calls.', impact: '2-4 weeks to see improved close rates' }
            ]
        },
        'Expansion': {
            diagnosis: score <= 0.4 ?
                "Massive revenue leak from existing customer base. High churn and zero expansion mean you're rebuilding revenue annually." :
                score <= 0.7 ?
                "Retention is weak and expansion is random. You're leaving high-margin revenue on the table." :
                "Retention is stable but expansion is inconsistent. Customers would buy more if you systematically surfaced opportunities.",
            root_causes: [
                "No systematic expansion signal tracking → you don't know who's ready",
                "No QBR rhythm → missing strategic growth conversations",
                "No offer stacking → clients don't see a clear value journey",
                "CS team not incentivized on expansion → treating it as optional"
            ],
            fixes: [
                { id: '2250.21', title: 'Expansion Signal Tracking', action: 'Install systematic tracking of usage metrics, engagement scores, results achieved. Surface expansion before you sell it.', impact: '60 days to identify 20-30% of accounts ready for expansion' },
                { id: '2250.22', title: 'Strategic QBR System', action: 'Run QBRs that spark growth conversations, not status updates. 15-min format: Results → Gaps → Next.', impact: '90 days to see NRR improvement of 5-10 points' },
                { id: '2250.11', title: 'Day 3 Value Milestone', action: 'Deliver measurable value within 3 days of kickoff. Builds trust and reduces early churn.', impact: '30 days to see churn rate reduction' }
            ]
        }
    };

    return insights[loopName] || insights['Pipeline'];
}

function generateLoopScoreCardWithContext(label, score) {
    const scoreValue = Math.round((score || 0) * 100);
    const scoreClass = getSsiClass(score || 0);

    const colorMap = {
        'high': { bg: '#d1fae5', border: '#6ee7b7', text: '#065f46', label: 'Strong' },
        'medium': { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', label: 'Moderate' },
        'low': { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b', label: 'Needs Work' }
    };

    const colors = colorMap[scoreClass];

    return `
        <div style="background: white; border: 2px solid ${colors.border}; border-radius: 12px; padding: 20px; text-align: center;">
            <div style="color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; font-weight: 600; margin-bottom: 8px;">
                ${label}
            </div>
            <div style="font-family: 'Montserrat'; font-weight: 800; font-size: 42px; color: ${colors.text}; margin-bottom: 6px;">
                ${scoreValue}
            </div>
            <div style="background: ${colors.bg}; border: 1px solid ${colors.border}; padding: 6px 12px; border-radius: 999px; display: inline-block;">
                <span style="color: ${colors.text}; font-size: 12px; font-weight: 700;">
                    ${colors.label}
                </span>
            </div>
        </div>
    `;
}

function getScoreInterpretation(ssi) {
    if (ssi >= 0.8) return "Excellent — Top quartile performance";
    if (ssi >= 0.6) return "Strong — Above average, room for optimization";
    if (ssi >= 0.4) return "Moderate — Significant improvement opportunities";
    if (ssi >= 0.2) return "Concerning — Major gaps requiring attention";
    return "Critical — Immediate action required";
}

function getSsiClass(ssi) {
    if (ssi >= 0.7) return 'high';
    if (ssi >= 0.4) return 'medium';
    return 'low';
}

/**
 * Generate industry comparison badge
 */
function generateIndustryComparison(yourScore, sector) {
    // Industry averages (simplified - could load from backend)
    const industryAverages = {
        'SaaS': 62,
        'Enterprise B2B': 58,
        'SMB': 55,
        'PLG/Product': 64,
        'Services': 52,
        'default': 58
    };

    const industryAvg = industryAverages[sector] || industryAverages['default'];
    const delta = yourScore - industryAvg;
    const isAbove = delta >= 0;
    const displaySector = sector || 'Average';

    return `
        <div style="margin-top: 24px; padding: 16px; background: ${isAbove ? '#ecfdf5' : '#fef3c7'}; border: 1px solid ${isAbove ? '#6ee7b7' : '#fcd34d'}; border-radius: 12px;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                <span style="color: #6b7280; font-size: 14px; font-weight: 500;">
                    vs ${displaySector} Industry Average (${industryAvg}):
                </span>
                <span style="font-size: 20px; font-weight: 700; color: ${isAbove ? '#059669' : '#d97706'};">
                    ${isAbove ? '+' : ''}${delta}
                </span>
                <span style="font-size: 24px;">${isAbove ? '📈' : '📉'}</span>
            </div>
            <p style="margin: 8px 0 0; text-align: center; font-size: 13px; color: #6b7280;">
                ${isAbove
                    ? `You're outperforming the average ${displaySector} company by ${Math.abs(delta)} points!`
                    : `There's a ${Math.abs(delta)}-point gap vs the ${displaySector} average — high ROI opportunity.`
                }
            </p>
        </div>
    `;
}

/**
 * Generate smart CTA based on pattern severity and score
 */
function generateSmartCTA(results, answers) {
    const patterns = results.detected_patterns || [];
    const hasHighSeverityPattern = patterns.some(p => p.severity === 'HIGH');
    const score = Math.round((results.overall_ssi || 0) * 100);
    const companyName = answers.company_name || 'your company';
    const email = answers.user_email || answers.email || '';

    // Critical Pattern - Red Alert CTA
    if (hasHighSeverityPattern && score < 50) {
        const criticalPattern = patterns.find(p => p.severity === 'HIGH');
        return `
            <div style="background: linear-gradient(135deg, #fee2e2, #fecaca); border: 3px solid #ef4444; border-radius: 20px; padding: 40px; text-align: center; margin-top: 30px; box-shadow: 0 8px 24px rgba(239, 68, 68, 0.2); cursor: pointer;" onclick="window.location.href='data_input.html?company=${encodeURIComponent(companyName)}&email=${encodeURIComponent(email)}'">
                <div style="font-size: 48px; margin-bottom: 16px;">🚨</div>
                <h3 style="font-family: 'Montserrat'; font-size: 28px; margin-bottom: 16px; color: #991b1b;">
                    Critical Pattern Detected: ${criticalPattern.pattern_name}
                </h3>
                <p style="color: #7f1d1d; font-size: 17px; margin-bottom: 24px; max-width: 650px; margin-left: auto; margin-right: auto; line-height: 1.8; font-weight: 500;">
                    Your diagnostic reveals a <strong>HIGH severity</strong> GTM pattern that typically costs companies like ${companyName}
                    20-40% of potential revenue annually. The full 25-metric diagnostic will:
                </p>
                <ul style="text-align: left; max-width: 600px; margin: 24px auto; color: #7f1d1d; line-height: 2; font-size: 15px;">
                    <li><strong>Quantify the exact revenue leak</strong> from this pattern</li>
                    <li><strong>Map your metric gaps</strong> to Alpine fix modules (2250.01-2250.29)</li>
                    <li><strong>Generate AI-powered 30/60/90-day roadmap</strong> with sequenced fixes</li>
                    <li><strong>Provide before/after ROI projections</strong> for each fix implementation</li>
                </ul>
                <div style="margin-top: 32px;">
                    <button class="btn btn-primary" style="font-size: 18px; padding: 16px 32px; background: linear-gradient(135deg, #dc2626, #991b1b); pointer-events: none;">
                        Get Full Precision Diagnostic →
                    </button>
                </div>
                <p style="margin-top: 20px; font-size: 13px; color: #7f1d1d;">
                    Pre-filled with ${companyName}'s context • Takes 8-12 minutes
                </p>
            </div>
        `;
    }

    // Medium Score - Standard Upgrade CTA
    if (score >= 50 && score < 70) {
        return `
            <div style="background: linear-gradient(135deg, #eff6ff, #dbeafe); border: 2px solid #93c5fd; border-radius: 20px; padding: 32px; text-align: center; margin-top: 30px; cursor: pointer;" onclick="window.location.href='data_input.html?company=${encodeURIComponent(companyName)}&email=${encodeURIComponent(email)}'">
                <h3 style="font-family: 'Montserrat'; font-size: 24px; margin-bottom: 12px; color: #1e3a8a;">
                    Want The Full 25-Metric Precision Diagnostic?
                </h3>
                <p style="color: #4b5563; margin-bottom: 24px; max-width: 600px; margin-left: auto; margin-right: auto; line-height: 1.7;">
                    This directional assessment shows solid fundamentals. Get the full 25-metric diagnostic for:
                </p>
                <ul style="text-align: left; max-width: 550px; margin: 20px auto; color: #374151; line-height: 1.9;">
                    <li>Precise benchmarking vs ${answers.sector || 'industry'} peers</li>
                    <li>Cohort-specific targets for your ARR band</li>
                    <li>AI-powered fix sequencing & implementation roadmap</li>
                    <li>Before/after impact modeling</li>
                </ul>
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 24px;">
                    <button class="btn btn-primary" style="pointer-events: none;">
                        Get Full Precision Diagnostic →
                    </button>
                    <button class="btn btn-secondary" onclick="event.stopPropagation(); window.location.reload()">
                        Start New Assessment
                    </button>
                </div>
            </div>
        `;
    }

    // High Score - Optimization CTA
    return `
        <div style="background: linear-gradient(135deg, #ecfdf5, #d1fae5); border: 2px solid #6ee7b7; border-radius: 20px; padding: 32px; text-align: center; margin-top: 30px; cursor: pointer;" onclick="window.location.href='data_input.html?company=${encodeURIComponent(companyName)}&email=${encodeURIComponent(email)}'">
            <div style="font-size: 36px; margin-bottom: 12px;">🎯</div>
            <h3 style="font-family: 'Montserrat'; font-size: 24px; margin-bottom: 12px; color: #065f46;">
                Strong Fundamentals — Ready to Optimize?
            </h3>
            <p style="color: #047857; font-size: 16px; margin-bottom: 24px; max-width: 600px; margin-left: auto; margin-right: auto; line-height: 1.7;">
                Your score of <strong>${score}</strong> puts you above average. The full diagnostic reveals exactly where to invest
                for maximum leverage — turning "strong" into "exceptional" with surgical precision.
            </p>
            <ul style="text-align: left; max-width: 550px; margin: 20px auto; color: #065f46; line-height: 1.9;">
                <li>Identify your highest-ROI optimization targets</li>
                <li>Benchmark against top-quartile performers in ${answers.sector || 'your industry'}</li>
                <li>Get AI-sequenced playbook for next-level performance</li>
            </ul>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 24px;">
                <button class="btn btn-primary" style="background: linear-gradient(135deg, #059669, #047857); pointer-events: none;">
                    Unlock Optimization Roadmap →
                </button>
                <button class="btn btn-secondary" onclick="event.stopPropagation(); window.location.reload()">
                    Start New Assessment
                </button>
            </div>
        </div>
    `;
}

// PDF Download function
function downloadPDFReport() {
    if (!currentClientId) {
        alert('Unable to generate PDF. Please complete the wizard first.');
        return;
    }

    // Show loading indicator
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating PDF...';
    btn.disabled = true;

    // Trigger PDF download
    window.location.href = `http://localhost:5001/api/reports/pdf/${currentClientId}`;

    // Reset button after short delay
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }, 2000);
}
