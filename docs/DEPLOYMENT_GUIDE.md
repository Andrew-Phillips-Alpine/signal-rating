# Alpine Signal Rating - Website Deployment Guide
## Replace Your Typeform with the Alpine GTM Signal Rating Tool

---

## 📋 Overview

This guide will help you deploy the Alpine Signal Rating tool to your website, allowing you to replace your Typeform and capture leads directly through your own branded assessment.

### What You're Deploying
- **wizard.html** - The interactive 9-question signal rating quiz
- **report.html** - Results page showing AIS score, loop scores, and recommendations
- **wizard.js** - Quiz logic and API communication
- **style.css** - Complete styling
- **wizard_questions.json** - Question configuration
- **alpine-logo-dark.png** & **alpine-logo.png** - Branding assets

---

## 🚀 Quick Start (3 Deployment Options)

### Option 1: Embed in Existing Page (RECOMMENDED)
Best for: Adding to your existing website landing page

```html
<!-- Add this to your landing page HTML -->
<div id="signal-rating-container">
  <iframe
    src="https://yoursite.com/signal-rating/wizard.html"
    width="100%"
    height="900px"
    frameborder="0"
    style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);"
    title="Alpine GTM Signal Rating Assessment"
  ></iframe>
</div>
```

### Option 2: Standalone Landing Page
Best for: Dedicated assessment page (e.g., `yoursite.com/assessment`)

Upload all files and link directly:
```
https://yoursite.com/signal-rating/wizard.html
```

### Option 3: Modal/Popup
Best for: CTA buttons that open assessment in overlay

```html
<button onclick="openSignalRating()">Take the Assessment</button>

<script>
function openSignalRating() {
  // Show modal with iFrame
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.background = 'rgba(0,0,0,0.8)';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div style="position: relative; width: 90%; max-width: 800px; height: 90%; margin: 2% auto;">
      <button onclick="this.parentElement.parentElement.remove()"
              style="position: absolute; top: 10px; right: 10px; z-index: 10000;
                     background: white; border: none; border-radius: 50%;
                     width: 40px; height: 40px; cursor: pointer; font-size: 24px;">
        ×
      </button>
      <iframe src="https://yoursite.com/signal-rating/wizard.html"
              width="100%" height="100%" frameborder="0"
              style="border-radius: 12px; background: white;">
      </iframe>
    </div>
  `;
  document.body.appendChild(modal);
}
</script>
```

---

## 📁 Step-by-Step Deployment

### Step 1: Upload Files to Your Web Server

Upload the entire `/LeadMagnet-SignalRating/` folder to your website:

```
yoursite.com/
  └── signal-rating/          <-- Create this folder
      ├── wizard.html
      ├── report.html
      ├── wizard.js
      ├── style.css
      ├── wizard_questions.json
      ├── alpine-logo-dark.png
      └── alpine-logo.png
```

**Via FTP/SFTP:**
1. Connect to your web server
2. Navigate to your public_html or www folder
3. Create a new folder: `signal-rating`
4. Upload all 7 files from LeadMagnet-SignalRating folder

**Via cPanel File Manager:**
1. Log into cPanel → File Manager
2. Navigate to public_html
3. Create folder: `signal-rating`
4. Upload all files

**Via Command Line (SSH):**
```bash
cd /var/www/yoursite.com/public_html
mkdir signal-rating
cd signal-rating
# Upload files via scp, rsync, or git
```

### Step 2: Test the Assessment

Visit your assessment URL:
```
https://yoursite.com/signal-rating/wizard.html
```

**Expected Behavior:**
1. ✅ See lead capture form (Name, Email, Company, Role)
2. ✅ See 3 qualifier questions (ARR, Employees, Sector)
3. ✅ See 5 assessment questions with sliders
4. ✅ Submit shows loading spinner
5. ✅ Redirects to report.html with results

**If you see errors:**
- **404 on wizard_questions.json** → Make sure the file is uploaded
- **CORS errors** → Files must be on same domain/subdomain
- **No styling** → Check that style.css is in same folder
- **Logo not showing** → Verify image files uploaded

### Step 3: Configure Backend (Choose One)

#### Option A: Use Existing Alpine Backend (RECOMMENDED)

If you're already running the Alpine System backend:

**Edit `wizard.js` line 44:**
```javascript
// BEFORE (looks for local file)
const response = await fetch('/wizard_questions.json');

// AFTER (specify full path)
const response = await fetch('/signal-rating/wizard_questions.json');
```

**Edit wizard.js API endpoint (search for "API_BASE" or "localhost:5001"):**
```javascript
// Find these lines (around line 300-400) and update:
const API_BASE = 'https://api.yoursite.com:5001';  // Your backend URL
// OR if backend is on same server:
const API_BASE = 'http://localhost:5001';
```

#### Option B: Use Formspree Only (NO BACKEND REQUIRED)

Keep it simple - just capture leads to email:

**Already configured!** The wizard uses Formspree (line 30 in wizard.js):
```javascript
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mldpknqg';
```

**To use YOUR Formspree:**
1. Go to https://formspree.io/
2. Create free account
3. Create a new form
4. Get your endpoint: `https://formspree.io/f/YOUR_FORM_ID`
5. Update line 30 in wizard.js

**Note:** With Formspree-only mode:
- ✅ Lead capture works
- ✅ Submissions sent to your email
- ❌ No custom AIS score calculation
- ❌ Results page shows placeholder data

#### Option C: Create Simple Backend API

Minimal backend to calculate scores:

**Required endpoint:**
```
POST https://yoursite.com/api/wizard/submit
```

**Expected JSON response:**
```json
{
  "client_id": "wizard_123456",
  "ais_score": 0.67,
  "loop_scores": {
    "Pipeline": 0.72,
    "Conversion": 0.58,
    "Expansion": 0.71
  },
  "priority_recommendations": [
    {
      "name": "Lead Response Time",
      "score": 42,
      "loop": "Pipeline",
      "description": "Your leads wait 8+ hours for first response"
    }
  ]
}
```

**Update wizard.js to use this endpoint** (search for "submitWizard" function).

---

## 🎨 Customization

### Change Branding Colors

Edit `/signal-rating/style.css` (lines 18-32):

```css
:root {
    --cyan: #0df2ff;      /* Your primary brand color */
    --green: #00ff88;     /* Your secondary color */
    --orange: #ff9500;    /* Warning/medium scores */
    --red: #ff453a;       /* Alert/low scores */
    --dark-bg: #1a1a1a;   /* Background */
    --white: #ffffff;     /* Text */
}
```

### Replace Logo

Replace these files with your logo:
- `alpine-logo-dark.png` (for light backgrounds, ~200x50px)
- `alpine-logo.png` (for dark backgrounds, ~200x50px)

### Customize Call-to-Action Buttons

Edit `/signal-rating/report.html` (lines 875-887):

**Current CTAs:**
```html
<button class="cta-button primary">Schedule Diagnostic Call</button>
<button class="cta-button secondary">Access Fix Library</button>
<button class="cta-button secondary">Download Full Roadmap</button>
```

**Add your links:**
```html
<button class="cta-button primary" onclick="window.open('https://calendly.com/yourlink', '_blank')">
  Schedule Diagnostic Call
</button>

<button class="cta-button secondary" onclick="window.location.href='/fix-library'">
  Access Fix Library
</button>

<button class="cta-button secondary" onclick="downloadPDF()">
  Download Full Roadmap
</button>
```

### Modify Questions

Edit `/signal-rating/wizard_questions.json`:

```json
{
  "questions": {
    "question_1_pipeline_health": {
      "category": "Pipeline Growth",
      "question": "Your custom question here?",
      "descriptors": {
        "high": "Strong performance",
        "medium": "Average",
        "low": "Needs improvement"
      }
    }
  }
}
```

---

## 📊 Tracking & Analytics

### Add Google Analytics

Add to BOTH `wizard.html` AND `report.html` before `</head>`:

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

### Track Custom Events

Add to `wizard.js` after line 390 (submission):

```javascript
// Track assessment completion
if (typeof gtag !== 'undefined') {
    gtag('event', 'assessment_complete', {
        'event_category': 'Signal Rating',
        'event_label': wizardAnswers.company_name,
        'value': Math.round(response.ais_score * 100)
    });
}
```

### Facebook Pixel

Add to BOTH HTML files before `</head>`:

```html
<!-- Facebook Pixel -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', 'YOUR_PIXEL_ID');
  fbq('track', 'PageView');
</script>
```

---

## ✅ Pre-Launch Checklist

### Technical Setup
- [ ] All 7 files uploaded to server
- [ ] wizard_questions.json accessible at correct path
- [ ] Logos displaying correctly
- [ ] CSS loaded (page has styling)
- [ ] No 404 errors in browser console
- [ ] HTTPS enabled (SSL certificate active)

### Functionality Testing
- [ ] Lead capture form accepts input
- [ ] All 9 questions display correctly
- [ ] Slider interactions work smoothly
- [ ] "Next" button advances through questions
- [ ] Progress bar updates
- [ ] Submit button triggers loading state
- [ ] Results page loads with data
- [ ] Loop scores display (Pipeline, Conversion, Expansion)
- [ ] Priority recommendations show
- [ ] CTA buttons work and link correctly

### Mobile Responsiveness
- [ ] Test on iPhone (Safari)
- [ ] Test on Android (Chrome)
- [ ] Test on tablet
- [ ] Questions readable on small screens
- [ ] Buttons easy to tap
- [ ] Form inputs accessible

### Integration
- [ ] Form submissions captured (check Formspree or your backend)
- [ ] Email notifications working
- [ ] Analytics tracking pageviews
- [ ] Custom events firing
- [ ] CTA buttons link to correct pages

### SEO & Performance
- [ ] Page title set: "Alpine GTM Signal Rating Assessment"
- [ ] Meta description added
- [ ] Page loads in < 3 seconds
- [ ] Images optimized
- [ ] No mixed content warnings (HTTPS)

---

## 🔗 Embed Examples

### WordPress

**Shortcode method:**
1. Install "iFrame" plugin
2. Create shortcode: `[iframe src="https://yoursite.com/signal-rating/wizard.html" width="100%" height="900"]`
3. Add shortcode to page/post

**Gutenberg editor:**
1. Add "Custom HTML" block
2. Paste iFrame code (see Option 1 above)

### Webflow

1. Add "Embed" element to page
2. Paste iFrame code
3. Set width: 100%, height: 900px

### Squarespace

1. Add "Code" block
2. Paste iFrame code
3. Adjust height in style settings

### Wix

1. Add "HTML iFrame" element
2. Enter URL: `https://yoursite.com/signal-rating/wizard.html`
3. Set dimensions

---

## 🐛 Troubleshooting

### Issue: "wizard_questions.json not found"
**Solution:** Update wizard.js line 44 to use full path:
```javascript
const response = await fetch('/signal-rating/wizard_questions.json');
```

### Issue: Results page shows no data
**Solution:** Check browser console for API errors. Verify backend is running and accessible.

### Issue: Styling looks broken
**Solution:**
1. Verify style.css uploaded
2. Check browser console for 404 on style.css
3. Clear browser cache (Ctrl+Shift+R)

### Issue: Cross-Origin (CORS) errors
**Solution:** Files must be served from same domain. Can't load from file:// URLs locally.

### Issue: Mobile layout broken
**Solution:** Ensure viewport meta tag in HTML:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

### Issue: Form not submitting
**Solution:**
1. Check Formspree endpoint is correct
2. Verify network tab in browser devtools
3. Check for JavaScript errors in console

---

## 📈 Post-Launch

### Monitor Performance
- Check analytics daily for first week
- Review completion rates
- Track drop-off points
- Monitor lead quality

### A/B Testing Ideas
- Test different headlines
- Vary question order
- Experiment with button colors
- Try different CTAs on results page

### Optimize
- Add social proof on wizard page
- Include testimonials on results
- Offer immediate value (PDF download)
- Follow up with email sequence

---

## 🎯 Replace Typeform Checklist

- [ ] Deploy signal rating to your website
- [ ] Test thoroughly (use checklist above)
- [ ] Update all links pointing to Typeform
- [ ] Update social media bios
- [ ] Update email signatures
- [ ] Update ad campaigns
- [ ] Redirect old Typeform URL (if you own domain)
- [ ] Archive Typeform (keep for records)
- [ ] Celebrate! 🎉 You now own your lead gen funnel

---

## 📞 Support

If you need help deploying or customizing:
1. Check troubleshooting section above
2. Review browser console for errors
3. Verify all files uploaded correctly
4. Test in incognito/private mode (rules out cache issues)

---

**Last Updated:** October 24, 2025
**Version:** 1.0

---

## Quick Reference: File Paths

After deployment, your URLs should be:
```
https://yoursite.com/signal-rating/wizard.html           ← Assessment
https://yoursite.com/signal-rating/report.html           ← Results
https://yoursite.com/signal-rating/wizard_questions.json ← Config
https://yoursite.com/signal-rating/style.css             ← Styles
```

**Test these URLs directly before embedding!**
