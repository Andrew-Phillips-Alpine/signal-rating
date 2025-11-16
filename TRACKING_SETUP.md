# Lead Magnet Tracking Setup Guide

Your lead magnet now has complete tracking capabilities! Here's what was added and how to configure it.

## What's New

### 1. Email/Company Name Capture
- User contact information (when provided) is now saved to the server
- All data is stored in `submissions_data.json`

### 2. Email Notifications
- Receive instant email alerts when someone completes the lead magnet
- Includes all submission details: company name, scores, answers, and contact info

### 3. Admin Dashboard
- View all submissions in a beautiful dashboard at `/admin`
- Filter by sector, ARR, and date range
- Export data to CSV
- Auto-refreshes every 30 seconds
- Real-time statistics

## Setup Instructions

### Step 1: Configure Email Notifications

1. Create a `.env` file in your project root (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your SendGrid credentials:
   ```bash
   EMAIL_NOTIFICATIONS_ENABLED=true
   EMAIL_TO=your-email@example.com
   EMAIL_FROM=noreply@alpine-signal.com
   SENDGRID_API_KEY=your-actual-sendgrid-api-key
   ```

3. **Get your SendGrid API Key:**
   - Go to https://app.sendgrid.com/settings/api_keys
   - Create a new API key with "Mail Send" permissions
   - Copy and paste it into your `.env` file

4. **Verify your sender email:**
   - In SendGrid, go to Settings > Sender Authentication
   - Verify the email address you're using in `EMAIL_FROM`

### Step 2: Load Environment Variables

Install dotenv package:
```bash
npm install dotenv
```

Add this line at the very top of `server.js` (before any other requires):
```javascript
require('dotenv').config();
```

### Step 3: Start the Server

```bash
node server.js
```

You should see:
```
✓ Loaded wizard_questions.json
✓ Loaded fix_library.json
🚀 Server running on http://localhost:3000
```

### Step 4: Access the Admin Dashboard

Open your browser and go to:
```
http://localhost:3000/admin
```

You'll see:
- Total submissions count
- How many included email addresses
- Average AIS score across all submissions
- Recent submissions (last 7 days)
- Full table of all submissions with filtering and export

## Testing the Setup

### Test Email Notifications

1. Make sure your `.env` is configured correctly
2. Complete the wizard form at `http://localhost:3000/wizard.html`
3. Check your terminal - you should see:
   ```
   📊 Processing submission for: [Company Name]
   📧 Notification email sent to your-email@example.com
   ```
4. Check your email inbox for the notification

### Test the Dashboard

1. Go to `http://localhost:3000/admin`
2. You should see all submissions including:
   - Company names
   - Email addresses (when provided)
   - All scores and metrics
   - Timestamps

## What Data is Now Tracked

Each submission includes:

- **Contact Info**: Company name, email (optional)
- **Cohort Data**: ARR, sector, employee count
- **Diagnostic Answers**: All 5 question responses
- **Calculated Scores**: Overall AIS score, Pipeline, Conversion, Expansion
- **Detected Patterns**: Business issues identified by the algorithm
- **Timestamp**: When the submission was received
- **Client ID**: Unique identifier for each submission

## Email Notification Format

When someone completes the lead magnet, you'll receive an email like:

```
Subject: 🎯 New Lead: Acme Corp (87% AIS Score)

New Lead Magnet Submission Received!

Company: Acme Corp
Email: contact@acme.com
Timestamp: Nov 10, 2025, 2:30 PM

COHORT INFO:
- ARR: $10M - $50M
- Sector: B2B SaaS
- Employees: 51-200

SCORES:
- Overall AIS Score: 87.0%
- Pipeline Health: 92.0%
- Sales Conversion: 84.0%
- Customer Expansion: 85.0%

TOP CHALLENGE: Improving sales conversion rates

DETECTED PATTERNS:
- high_conversion_low_expansion
- retention_gap

---
Client ID: wizard_1699564234567
View all submissions at: http://localhost:3000/admin
```

## Troubleshooting

### Email notifications not working?

1. Check your `.env` file exists and has correct values
2. Make sure `EMAIL_NOTIFICATIONS_ENABLED=true`
3. Verify your SendGrid API key has "Mail Send" permissions
4. Check server logs for error messages
5. Confirm your sender email is verified in SendGrid

### Dashboard not loading submissions?

1. Make sure the server is running (`node server.js`)
2. Check that `submissions_data.json` exists and has valid JSON
3. Open browser console (F12) and check for errors
4. Try accessing `/api/submissions` directly to see the raw data

### Old submissions missing email/company name?

- This is expected! Only new submissions (after this update) will include contact info
- Old submissions will show "Unknown" for company name and "Not provided" for email

## CSV Export

The admin dashboard includes a CSV export button that downloads all submission data including:
- Date and time
- Company name and email
- Cohort information (ARR, sector, employees)
- All scores (AIS, Pipeline, Conversion, Expansion)
- Top challenge selected
- Detected patterns

Perfect for importing into your CRM or analyzing in Excel/Google Sheets!

## Security Notes

- The `.env` file contains sensitive credentials - never commit it to git
- `.env.example` is safe to commit (no actual secrets)
- Consider adding `.env` to your `.gitignore` if not already there
- The admin dashboard has no authentication - consider adding password protection for production use

## Need Help?

If you run into issues:
1. Check the server console for error messages
2. Verify all environment variables are set correctly
3. Test with a simple submission first
4. Make sure SendGrid credentials are valid

Happy tracking! 🚀
