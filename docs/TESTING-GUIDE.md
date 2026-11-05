# Manual system testing guide

Use a staging database and fake company/customer/employee records. Never test destructive flows with live stock or money. Record expected results and verify the audit trail.

1. **Sign-in and permissions:** create employer, manager, cashier, sales, buyer, stock, and basic employee accounts. Confirm each sees only allowed pages; attempt a direct API call without permission and verify it is rejected.
2. **Branches:** create two branches and warehouses; confirm each employee and manager sees only their own branch data. Test employer branch switching.
3. **Inventory:** add items and photos, browse by branch, adjust quantity, and verify stock valuation and audit entry.
4. **Purchasing:** submit a buyer pre-record with receipt and item photo; verify manager/employer review, rejection, and confirmation into inventory.
5. **Transfers/dispatch:** request a branch transfer, verify approval, dispatch with collector identity, receive at destination, and compare source/destination quantities at every stage.
6. **Receipts/payments:** create a multi-item receipt, print it, manually open WhatsApp share, confirm payment as cashier/manager, and verify the customer threshold behavior. Test invalid and unauthorized receipt IDs.
7. **Attendance/payroll:** set work hours and deduction policy, clock in/out as an employee account, submit absence reason, review salary deductions/bonuses, approve bonus, and verify branch privacy. Confirm attendance is not shown as biometric verified for browser clocking.
8. **Accounting:** record income, expense, customer credit/payment, and loans; verify balances and approval rules. Reconcile totals to a controlled spreadsheet and try cross-branch access as a manager.
9. **Messages and audit:** send, receive, reply, and resolve messages; confirm unrelated employees cannot read them. Confirm sensitive changes have audit entries.
10. **Reports and integrations:** download each EOD section and full CSV; confirm scheduled delivery is not assumed. With sandbox credentials, validate AI, email, WhatsApp webhook signatures, failures, rate limits, and opt-in behavior.
11. **Hiring and governance:** upload PDF/DOCX/TXT applicant documents; verify extracted text, AI role suggestion, human status decision, and that non-employers cannot read applicant records. Configure ownership percentages and confirm co-employer APIs deny access before a scope is granted and allow it afterward.
12. **Policies, certificates, and passkeys:** upload a test certificate; verify only authenticated company users can download it. Create a required policy, sign in as a new employee, confirm protected APIs block use until acknowledgment, then enroll a passkey and verify the phone prompts for user verification.
13. **Recovery and mobile:** restore a backup to a separate database. For a future Capacitor build, test Android/iOS camera permission, upload, offline recovery, session expiry, and signed release installation.

For each area test normal input, missing fields, invalid IDs, duplicate submissions, unauthorized role, wrong branch, network interruption, and recovery. Automated tests were not run as part of the preceding implementation session.
