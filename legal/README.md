# Letably Legal Documents

This folder contains the legal documents required for the Letably SaaS platform.

---

## Document Overview

| Document | Filename | Purpose | Required |
|----------|----------|---------|----------|
| Terms of Service | `terms-of-service.md` | Main contract with agency customers | Yes |
| Privacy Policy | `privacy-policy.md` | How we collect/use personal data | Yes |
| Data Processing Agreement | `data-processing-agreement.md` | GDPR Article 28 processor agreement | Yes |
| Cookie Policy | `cookie-policy.md` | Explains cookie usage | Yes |
| Acceptable Use Policy | `acceptable-use-policy.md` | Rules for using the platform | Recommended |
| Legal Disclaimer | `disclaimer.md` | Limitations and disclaimers | Recommended |

---

## Placeholders to Replace

Before publishing, replace the following placeholders throughout all documents:

| Placeholder | Replace With |
|-------------|--------------|
| `[COMPANY NAME]` | Your registered company name (e.g., "Letably Ltd") |
| `[NUMBER]` | Companies House registration number |
| `[ADDRESS]` | Registered office address |
| `[EMAIL]` | Contact email address (e.g., legal@letably.com, privacy@letably.com, support@letably.com) |
| `[DATE]` | Publication date |
| `[URL]` | Relevant URLs (e.g., privacy policy URL, sub-processor list URL) |
| `[Cloud Provider]` | Your hosting provider (e.g., AWS, Azure, Google Cloud) |
| `[Location]` | Data centre locations |
| `[Payment Processor]` | Payment provider (e.g., Stripe) |
| `[Email Provider]` | Email service provider (e.g., SendGrid, AWS SES) |
| `[Safeguards]` | International transfer safeguards (e.g., "UK SCCs", "Adequacy decision") |

---

## Implementation Checklist

### Before Launch

- [ ] Replace all placeholders with actual values
- [ ] Review each document for accuracy and completeness
- [ ] Ensure all documents are consistent with each other
- [ ] Have documents reviewed by a qualified solicitor
- [ ] Set up required email addresses (legal@, privacy@, support@)
- [ ] Register with the ICO (ico.org.uk/fee)
- [ ] Prepare sub-processor list page on website

### Website Integration

- [ ] Create `/legal/terms` page with Terms of Service
- [ ] Create `/legal/privacy` page with Privacy Policy
- [ ] Create `/legal/dpa` page with Data Processing Agreement
- [ ] Create `/legal/cookies` page with Cookie Policy
- [ ] Create `/legal/acceptable-use` page with AUP
- [ ] Create `/legal/disclaimer` page with Disclaimer
- [ ] Add links to footer of all pages
- [ ] Implement cookie consent banner
- [ ] Add T&Cs acceptance checkbox to signup flow
- [ ] Add DPA acceptance mechanism for customers

### Ongoing Maintenance

- [ ] Review documents annually or when laws change
- [ ] Update sub-processor list when providers change
- [ ] Notify customers of material changes (30 days notice)
- [ ] Maintain version history of documents
- [ ] Monitor ICO guidance for regulatory updates

---

## Document Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                     TERMS OF SERVICE                        │
│            (Main customer contract)                         │
│                                                             │
│  Incorporates by reference:                                 │
│  ├── Privacy Policy                                         │
│  ├── Data Processing Agreement (Schedule 1)                 │
│  ├── Acceptable Use Policy                                  │
│  └── Cookie Policy                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PRIVACY POLICY                           │
│         (For customer account data - we are controller)     │
│                                                             │
│  References:                                                │
│  └── Cookie Policy                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│               DATA PROCESSING AGREEMENT                     │
│        (For tenant data - customer is controller,           │
│         we are processor)                                   │
│                                                             │
│  Schedules:                                                 │
│  ├── Schedule 1: Details of Processing                      │
│  ├── Schedule 2: Security Measures                          │
│  └── Schedule 3: Approved Sub-processors                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  LEGAL DISCLAIMER                           │
│         (Additional protections and clarifications)         │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Legal Protections Included

### Liability Limitations
- Liability capped at 12 months' fees
- Exclusion of indirect/consequential damages
- No liability for customer's legal compliance failures
- No liability for Right to Rent penalties
- No liability for digital signature enforceability
- Force majeure clause

### Customer Obligations
- Must obtain proper consents for tenant data
- Must comply with all applicable laws
- Must maintain account security
- Responsible for accuracy of their data
- Must seek independent legal advice where needed

### Data Protection
- Clear controller/processor roles
- Article 28 compliant DPA
- Sub-processor management
- Breach notification (48 hours)
- Data export and deletion procedures
- International transfer safeguards

### Service Disclaimers
- "As is" service provision
- No legal/tax/immigration advice
- Template documents are guidance only
- No guarantee of digital signature validity
- No document authenticity verification
- Target (not guaranteed) SLA

### Intellectual Property
- Letably retains all IP in the Service
- Customer retains ownership of their data
- Licence grant for using customer data to provide service
- Feedback licence

### Termination
- Cancellation rights
- Suspension for non-payment (after 14 days)
- 30-day data export window
- 90-day data deletion

---

## Notes for Solicitor Review

Please pay particular attention to:

1. **Limitation of Liability (ToS Section 13)** - Ensure caps are appropriate and enforceable under English law

2. **Indemnification (ToS Section 14)** - Review scope of customer indemnity

3. **Digital Signatures Disclaimer** - Ensure adequate protection given legal complexity of e-signatures for deeds and certain documents

4. **Right to Rent Disclaimer** - Confirm sufficient to protect against claims from agencies who fail checks

5. **Data Processing Agreement** - Ensure full UK GDPR Article 28 compliance

6. **International Transfers** - Review adequacy of transfer mechanism descriptions

7. **Consumer Rights** - Confirm B2B focus means Consumer Rights Act 2015 does not apply

8. **Unfair Contract Terms** - Review against CMA guidance on unfair terms

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | [DATE] | Initial version |

---

**IMPORTANT: These documents are provided as a starting point. They should be reviewed and approved by a qualified solicitor before use.**
