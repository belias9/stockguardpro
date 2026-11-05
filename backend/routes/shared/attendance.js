const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize, authorizeFunction } = require('../../middleware/auth');
const attendanceService = require('../../services/attendanceService');
const Device = require('../../models/Device');
const User = require('../../models/User');
const Attendance = require('../../models/Attendance');
const Company = require('../../models/company');
const BiometricEvent = require('../../models/BiometricEvent');
const webauthn = require('@simplewebauthn/server');

const webauthnConfig = req => {
    const origin = process.env.WEBAUTHN_ORIGIN || (process.env.NODE_ENV === 'production' ? process.env.CLIENT_URL : (req.get('origin') || process.env.CLIENT_URL));
    if (!origin) throw { status: 503, message: 'Configure WEBAUTHN_ORIGIN before passkey enrollment' };
    const parsed = new URL(origin);
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') throw { status: 503, message: 'Passkeys require HTTPS in production' };
    return { origin: parsed.origin, rpID: process.env.WEBAUTHN_RP_ID || parsed.hostname };
};

router.get('/passkeys/status', protect, async (req, res, next) => {
    try { const User = require('../../models/User'); const user = await User.findById(req.user._id).select('passkeys'); res.json({ success: true, enrolled: !!user?.passkeys?.length, count: user?.passkeys?.length || 0 }); }
    catch (err) { next(err); }
});

router.post('/passkeys/register/options', protect, async (req, res, next) => {
    try {
        const User = require('../../models/User'); const user = await User.findById(req.user._id).select('+passkeyChallenge +passkeyChallengePurpose +passkeyChallengeExpiresAt passkeys');
        if (!user || user.passkeys.length >= 8) return res.status(400).json({ success: false, error: 'Passkey limit reached' });
        const { origin, rpID } = webauthnConfig(req);
        const options = await webauthn.generateRegistrationOptions({ rpName: 'StockGuardPro', rpID, userID: Buffer.from(String(user._id)), userName: user.email, userDisplayName: `${user.firstName} ${user.lastName}`, attestationType: 'none', authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' }, excludeCredentials: user.passkeys.map(k => ({ id: k.credentialId, transports: k.transports })) });
        user.passkeyChallenge = options.challenge; user.passkeyChallengePurpose = 'register'; user.passkeyChallengeExpiresAt = new Date(Date.now() + 5 * 60 * 1000); await user.save();
        res.json({ success: true, options, origin });
    } catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/passkeys/register/verify', protect, async (req, res, next) => {
    try {
        const User = require('../../models/User'); const user = await User.findById(req.user._id).select('+passkeyChallenge +passkeyChallengePurpose +passkeyChallengeExpiresAt passkeys');
        if (!user?.passkeyChallenge || user.passkeyChallengePurpose !== 'register' || user.passkeyChallengeExpiresAt < new Date()) return res.status(400).json({ success: false, error: 'Passkey registration expired; start again' });
        const { origin, rpID } = webauthnConfig(req);
        const verification = await webauthn.verifyRegistrationResponse({ response: req.body, expectedChallenge: user.passkeyChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
        if (!verification.verified || !verification.registrationInfo?.userVerified) return res.status(400).json({ success: false, error: 'Passkey verification failed' });
        const credential = verification.registrationInfo.credential;
        user.passkeys.push({ credentialId: credential.id, publicKey: Buffer.from(credential.publicKey).toString('base64url'), counter: credential.counter, transports: credential.transports || [], deviceType: verification.registrationInfo.credentialDeviceType, backedUp: verification.registrationInfo.credentialBackedUp });
        user.passkeyChallenge = undefined; user.passkeyChallengePurpose = null; user.passkeyChallengeExpiresAt = null; await user.save();
        await require('../../utils/auditHelper').log(req, { action: 'PASSKEY_ENROLLED', entityType: 'User', entityId: user._id, entityName: user.fullName });
        res.json({ success: true, message: 'Passkey enrolled. Your device may use fingerprint, face unlock, or its screen lock.' });
    } catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/passkeys/clock/options', protect, async (req, res, next) => {
    try {
        if (!['clock_in', 'clock_out'].includes(req.body.action)) return res.status(400).json({ success: false, error: 'Choose clock_in or clock_out' });
        const User = require('../../models/User'); const user = await User.findById(req.user._id).select('+passkeyChallenge +passkeyChallengePurpose +passkeyChallengeExpiresAt passkeys');
        if (!user?.passkeys?.length) return res.status(400).json({ success: false, error: 'Enroll a passkey first' });
        const { rpID } = webauthnConfig(req);
        const options = await webauthn.generateAuthenticationOptions({ rpID, userVerification: 'required', allowCredentials: user.passkeys.map(k => ({ id: k.credentialId, transports: k.transports })) });
        user.passkeyChallenge = options.challenge; user.passkeyChallengePurpose = req.body.action; user.passkeyChallengeExpiresAt = new Date(Date.now() + 5 * 60 * 1000); await user.save();
        res.json({ success: true, options });
    } catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/passkeys/clock/verify', protect, async (req, res, next) => {
    try {
        const User = require('../../models/User'); const user = await User.findById(req.user._id).select('+passkeyChallenge +passkeyChallengePurpose +passkeyChallengeExpiresAt +passkeys.publicKey');
        const action = user?.passkeyChallengePurpose;
        if (!user?.passkeyChallenge || !['clock_in', 'clock_out'].includes(action) || user.passkeyChallengeExpiresAt < new Date()) return res.status(400).json({ success: false, error: 'Passkey verification expired; start again' });
        const { origin, rpID } = webauthnConfig(req);
        const id = req.body.id || req.body.rawId;
        const passkey = user.passkeys.find(k => k.credentialId === id);
        if (!passkey) return res.status(401).json({ success: false, error: 'Passkey is not registered to this account' });
        const verification = await webauthn.verifyAuthenticationResponse({ response: req.body, expectedChallenge: user.passkeyChallenge, expectedOrigin: origin, expectedRPID: rpID, credential: { id: passkey.credentialId, publicKey: Buffer.from(passkey.publicKey, 'base64url'), counter: passkey.counter, transports: passkey.transports }, requireUserVerification: true });
        if (!verification.verified || !verification.authenticationInfo.userVerified) return res.status(401).json({ success: false, error: 'Passkey verification failed' });
        passkey.counter = verification.authenticationInfo.newCounter; passkey.lastUsedAt = new Date(); user.passkeyChallenge = undefined; user.passkeyChallengePurpose = null; user.passkeyChallengeExpiresAt = null; await user.save();
        req.user = user; req.passkeyVerified = true;
        const result = action === 'clock_in' ? await attendanceService.clockIn(req, {}) : await attendanceService.clockOut(req, {});
        res.json({ success: true, ...result, method: 'passkey' });
    } catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });
    next();
};

// Clock-in/out require an authenticated employee session. Browsers cannot prove
// fingerprint/Face ID with the boolean flags previously accepted here.
router.post('/clock-in', protect, async (req, res, next) => {
    try { res.json({ success: true, ...(await attendanceService.clockIn(req, req.body)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/clock-out', protect, async (req, res, next) => {
    try { res.json({ success: true, ...(await attendanceService.clockOut(req, req.body)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/set-device', protect, authorize('employer'), async (req, res, next) => {
    try {
        const result = await attendanceService.setAttendanceDevice(req, req.body.employeeId);
        res.json({ success: true, ...result });
    } catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// Trusted terminal integration. The terminal/vendor must verify the biometric
// match locally and send events over HTTPS with its registered device key.
router.post('/device-event', async (req, res, next) => {
    try {
        const { deviceId, employeeId, eventId, eventType, capturedAt } = req.body;
        if (!deviceId || !employeeId || !eventId || !['clock_in', 'clock_out'].includes(eventType) || !capturedAt) return res.status(400).json({ success: false, error: 'Device event fields are incomplete' });
        const timestamp = new Date(capturedAt);
        if (Number.isNaN(timestamp.getTime()) || Math.abs(Date.now() - timestamp.getTime()) > 120000) return res.status(400).json({ success: false, error: 'Event timestamp is invalid or expired' });
        const deviceKey = req.get('x-device-key');
        if (!deviceKey) return res.status(401).json({ success: false, error: 'Device key required' });
        const device = await Device.findOne({ deviceId, isActive: true }).select('+apiKey');
        if (!device || device.type !== 'biometric_reader' || !(await device.verifyApiKey(deviceKey))) return res.status(401).json({ success: false, error: 'Untrusted or inactive biometric terminal' });
        const employee = await User.findOne({ _id: employeeId, company: device.company, branch: device.branch, role: 'employee', isActive: true, accountClosed: false });
        if (!employee || (device.assignedTo && String(device.assignedTo) !== String(employee._id))) return res.status(403).json({ success: false, error: 'Employee is not assigned to this terminal' });
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const company = await Company.findById(device.company);
        let attendance = await Attendance.findOne({ company: device.company, employee: employee._id, date: now });
        if (!attendance && eventType === 'clock_out') return res.status(409).json({ success: false, error: 'No clock-in found today' });
        if (!attendance) attendance = new Attendance({ company: device.company, branch: employee.branch, employee: employee._id, date: now });
        if (eventType === 'clock_in') {
            attendance.recordClockIn({ deviceId, deviceRef: device._id, fingerprintVerified: true, faceVerified: false, ipAddress: req.ip, method: 'fingerprint', expectedStart: company?.settings?.workingHours?.start || '08:00' });
        } else {
            attendance.recordClockOut({ deviceId, deviceRef: device._id, fingerprintVerified: true, faceVerified: false, ipAddress: req.ip, method: 'fingerprint', expectedEnd: company?.settings?.workingHours?.end || '17:00' });
        }
        await attendance.save();
        try { await BiometricEvent.create({ company: device.company, branch: device.branch, device: device._id, eventId, employee: employee._id, eventType, recordedAt: timestamp }); }
        catch (err) { if (err.code === 11000) return res.status(409).json({ success: false, error: 'Duplicate device event' }); throw err; }
        await device.markSeen(req.ip);
        res.json({ success: true, attendance: attendance.toPublicJSON() });
    } catch (err) { next(err); }
});

// Protected — everything else
router.get('/today', protect, authorizeFunction('manager'), async (req, res, next) => {
    try { res.json({ success: true, ...(await attendanceService.getToday(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.get('/employee/:employeeId', protect, async (req, res, next) => {
    try { res.json({ success: true, ...(await attendanceService.getEmployeeAttendance(req, req.params.employeeId, req.query)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/absence-reason', protect, [
    body('date').notEmpty(),
    body('reason').notEmpty()
], validate, async (req, res, next) => {
    try { res.json({ success: true, attendance: await attendanceService.submitAbsenceReason(req, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

module.exports = router;
