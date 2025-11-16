# Alpine Signal Rating (ASR™) Lead Magnet

A standalone GTM infrastructure assessment tool that generates personalized reports with Alpine Signal Ratings.

**Version:** 3.0
**Last Updated:** October 2025

---

## 🚀 Quick Start

### Local Testing (2 minutes)

```bash
cd Alpine-Signal-Rating-LeadMagnet
npm install
npm start
```

Visit: `http://localhost:3000/wizard.html`

### What You'll See

1. **Wizard Flow** - 9-step assessment (5 diagnostic questions + 3 context qualifiers + optional email)
2. **Report Page** - ASR™ score with loop breakdowns and insights
3. **PDF Generation** - Downloadable diagnostic report with fix recommendations

---

## 📂 Project Structure

```
Alpine-Signal-Rating-LeadMagnet/
├── wizard.html              # Assessment interface
├── wizard.js                # Quiz logic and flow
├── wizard_questions.json    # Question configuration & scoring
├── report.html              # Results page
├── report_simple.js         # Report rendering logic
├── server.js                # Node.js backend (scoring + PDF generation)
├── style.css                # Complete styling system
├── alpine-logo.png          # Brand assets
├── fix_library.json         # Fix recommendations database
├── package.json             # Dependencies
└── docs/                    # Additional documentation
    ├── API_DOCUMENTATION.md
    ├── DEPLOYMENT_GUIDE.md
    └── CHANGELOG.md
```

---

## 🎯 How It Works

### User Flow

**Step 1-2:** Diagnostic questions (Pipeline Health, Conversion Health)
**Step 3:** ARR qualifier (cohort sizing)
**Step 4:** Customer Success diagnostic
**Step 5:** Sector qualifier
**Step 6:** Economics & Efficiency diagnostic
**Step 7:** Team size qualifier
**Step 8:** Top GTM challenge
**Step 9:** Optional email for PDF delivery

### Scoring System

- Questions map to 25 underlying GTM metrics
- Loop scores calculated: Pipeline, Conversion, Expansion
- Overall ASR™ = Weighted average across all loops
- Pattern detection identifies systemic issues

### Data Flow

```
wizard.html → wizard.js → POST /wizard_submit → server.js
                                                      ↓
                                              calculateScores()
                                                      ↓
                                         localStorage → report.html
                                                      ↓
                                              PDF generation
```

---

## 🛠️ Key Features

### ✅ Self-Contained Experience
- All data stored in localStorage
- No database required
- Works offline after initial load

### ✅ Server-Side Scoring
- Proprietary algorithms protected on backend
- Pattern detection for GTM breakdowns
- Cohort-specific benchmarking

### ✅ PDF Report Generation
- Puppeteer-based rendering
- Full diagnostic with fix recommendations
- Downloadable + emailable

### ✅ Anonymous Data Collection
- Optional email capture
- Formspree integration for lead notifications
- JSON log for benchmarking analytics

---

## 📋 Configuration

### Update Questions

Edit `wizard_questions.json`:
```json
{
  "question_1_pipeline_health": {
    "question": "Your question text",
    "category": "Pipeline Health",
    "descriptors": {
      "1": "Level 1 description",
      "5": "Level 5 description"
    }
  }
}
```

### Update CTA Links

Report page CTAs are in `report_simple.js`:
- Calendly: `https://calendly.com/thealpinesystem/gtm-assessment`
- Learn More: `https://www.thealpinesystem.com/working`

### Customize Branding

Update CSS variables in `style.css` and `wizard.html`:
```css
--navy: #00002c;
--cyan: #00ffff;
--blue: #0060ff;
```

---

## 🚢 Deployment

### Option 1: Static Site (Recommended for Frontend)

Upload these files to any web host:
- wizard.html
- wizard.js
- wizard_questions.json
- report.html
- report_simple.js
- style.css
- alpine-logo.png

**Then deploy server.js separately** (see docs/DEPLOYMENT_GUIDE.md)

### Option 2: Full Stack (Node.js Server)

```bash
# Production environment
npm install
export NODE_ENV=production
export PORT=3000
npm start
```

### Option 3: iframe Embedding

```html
<iframe
  src="https://yoursite.com/signal-rating/wizard.html"
  width="100%"
  height="900px"
  frameborder="0">
</iframe>
```

---

## 🔧 Development

### Running Locally

```bash
npm install
npm start
```

Server runs on `http://localhost:3000`

### File Watch / Hot Reload

The server doesn't have hot reload. After changes:
1. Stop server (Ctrl+C)
2. Restart: `npm start`
3. Hard refresh browser (Cmd+Shift+R)

### Testing PDF Generation

Complete wizard → Download PDF button on report page
- PDFs saved to: `/temp_pdfs/`
- Filename format: `alpine-gtm-report-{name}-{timestamp}.pdf`

---

## 📊 Analytics & Tracking

### Submission Data

All submissions logged to `submissions_data.json`:
```json
{
  "timestamp": "2025-10-29T...",
  "email": "user@example.com",
  "company_name": "Acme Inc",
  "arr": "Cohort_2",
  "overall_ssi": 0.67,
  "loop_scores": {...}
}
```

### Add Google Analytics

Add to `<head>` in wizard.html and report.html:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

---

## 🐛 Troubleshooting

### "Cannot read wizard_questions.json"
- Ensure you're running via server (`npm start`), not opening HTML directly
- Check file permissions

### PDFs Not Generating
- Check Puppeteer installation: `npm list puppeteer`
- Ensure Chrome/Chromium available
- Check server logs for errors

### Stale Cached Scores
- localStorage persists between sessions
- Clear with: `localStorage.clear()` in browser console
- Or use incognito mode for testing

### Server Won't Start
- Check port 3000 availability: `lsof -ti:3000`
- Kill existing process: `lsof -ti:3000 | xargs kill -9`

---

## 📚 Additional Documentation

- **API Reference:** `docs/API_DOCUMENTATION.md`
- **Deployment Guide:** `docs/DEPLOYMENT_GUIDE.md`
- **Change Log:** `docs/CHANGELOG.md`

---

## 🔐 Security Notes

- No sensitive data stored in frontend
- Scoring algorithms server-side only
- CORS configured for your domain
- Rate limiting recommended for production

---

## 📞 Support

For questions or custom implementations:
- Email: signal@thealpinesystem.com
- Website: thealpinesystem.com

---

**© The Alpine System 2025**
*Assess.Fix.Scale.Repeat.*
