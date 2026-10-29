/**
 * Auth Service — FIXED version
 */
const Company = require('../models/Company');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const auditHelper = require('../utils/auditHelper');

function generateTokens(user) {
    const accessToken = jwt.sign(
        { id: user._id, role: user.role, companyId: user.company, branchId: user.branch || null },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
    const refreshToken = jwt.sign(
        { id: user._id, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
    );
    return { accessToken, refreshToken };
}

async function companyLogin(req, { name, password }) {
    const company = await Company.findOne({ name }).select('+password');

    if (!company) {
        throw { status: 401, message: 'Invalid company credentials' };
    }

    if (!company.isActive) {
        throw { status: 403, message: 'Company account is deactivated' };
    }

    const isMatch = await company.comparePassword(password);
    if (!isMatch) {
        await auditHelper.log(req, {
            action: 'LOGIN_FAILED',
            entityType: 'Company',
            entityId: company._id,
            entityName: company.name,
            company: company._id,
            result: { success: false, errorMessage: 'Wrong password' },
            severity: 'warning'
        });
        throw { status: 401, message: 'Invalid company credentials' };
    }

    await auditHelper.log(req, {
        action: 'LOGIN',
        entityType: 'Company',
        entityId: company._id,
        entityName: company.name,
        company: company._id,
        result: { success: true, statusCode: 200 }
    });

    return {
        company: {
            id: company._id,
            name: company.name,
            email: company.email,
            settings: company.settings,
            features: company.features
        }
    };
}

async function userLogin(req, { email, password, companyId }) {
    const user = await User.findOne({ email, company: companyId }).select('+password +loginAttempts +lockUntil');

    if (!user) {
        await auditHelper.log(req, {
            action: 'LOGIN_FAILED',
            entityType: 'User',
            entityName: email,
            company: companyId,
            result: { success: false, errorMessage: 'User not found' },
            severity: 'warning'
        });
        throw { status: 401, message: 'Invalid credentials' };
    }

    if (!user.isActive) {
        throw { status: 403, message: 'Account is deactivated' };
    }

    if (user.accountClosed) {
        throw { status: 403, message: 'Account is closed. Contact your employer.' };
    }

    if (user.isLocked()) {
        const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
        throw { status: 429, message: `Account locked. Try again in ${minutesLeft} minutes.` };
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
        await user.incLoginAttempts();
        await auditHelper.log(req, {
            action: 'LOGIN_FAILED',
            entityType: 'User',
            entityId: user._id,
            entityName: `${user.firstName} ${user.lastName}`,
            company: user.company,
            result: { success: false, errorMessage: 'Wrong password' },
            severity: 'warning'
        });

        const remaining = User.MAX_LOGIN_ATTEMPTS - (user.loginAttempts + 1);
        const msg = remaining > 0
            ? `Invalid credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
            : 'Account locked for 15 minutes due to repeated failures.';
        throw { status: 401, message: msg };
    }

    await user.resetLoginAttempts();
    user.lastLoginIp = req.ip;
    await user.save();

    const tokens = generateTokens(user);

    await auditHelper.log(req, {
        action: 'LOGIN',
        entityType: 'User',
        entityId: user._id,
        entityName: `${user.firstName} ${user.lastName}`,
        company: user.company,
        result: { success: true, statusCode: 200 }
    });

    return {
        ...tokens,
        user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: `${user.firstName} ${user.lastName}`,
            email: user.email,
            role: user.role,
            roles: user.roles,
            activeRoles: user.activeRoles,
            employeeId: user.employeeId,
            branch: user.branch,
            company: user.company,
            baseSalary: user.baseSalary
        }
    };
}

async function refreshToken(req, token) {
    if (!token) throw { status: 401, message: 'No refresh token' };
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
        throw { status: 401, message: 'Invalid or expired refresh token' };
    }
    if (decoded.type !== 'refresh') throw { status: 401, message: 'Invalid token type' };

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive || user.accountClosed) {
        throw { status: 401, message: 'Account not accessible' };
    }
    return generateTokens(user);
}

async function registerCompany(req, { name, email, phone, password, address }) {
    const existing = await Company.findOne({ $or: [{ name }, { email }] });
    if (existing) throw { status: 400, message: 'Company with this name or email already exists' };

    const company = await Company.create({ name, email, phone, password, address: address || {} });

    const employer = await User.create({
        company: company._id, role: 'employer',
        firstName: 'Admin', lastName: 'User',
        email, phone, password
    });

    const tokens = generateTokens(employer);

    await auditHelper.log(req, {
        action: 'LOGIN',
        entityType: 'Company',
        entityId: company._id,
        entityName: company.name,
        company: company._id,
        result: { success: true, statusCode: 201 }
    });

    return {
        ...tokens,
        company: { id: company._id, name: company.name, email: company.email },
        user: { id: employer._id, firstName: employer.firstName, lastName: employer.lastName, role: employer.role }
    };
}

async function fingerprintVerify(req, { fingerprintTemplate, deviceId, companyId, employeeId }) {
    const user = await User.findOne({ company: companyId, employeeId, isActive: true }).select('+fingerprintTemplate');
    if (!user || !user.fingerprintTemplate) throw { status: 401, message: 'Fingerprint not recognized' };

    const match = await user.verifyBiometric(fingerprintTemplate, 'fingerprint');
    if (!match) throw { status: 401, message: 'Fingerprint does not match' };

    return {
        verified: true,
        user: { id: user._id, name: `${user.firstName} ${user.lastName}`, employeeId: user.employeeId, role: user.role }
    };
}
// ============================================================
// Forgot password — send reset link
// ============================================================
async function forgotPassword(req, email) {
    const emailService = require('../utils/emailService');
    const crypto = require('crypto');
    
    const user = await User.findOne({
        email: email.toLowerCase(),
        isActive: true,
        accountClosed: false
    });
    
    // Security: always return success even if email doesn't exist
    if (!user) {
        return { success: true, message: 'If that email exists, a reset link was sent' };
    }
    
    // Generate token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    
    user.resetToken = hashedToken;
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();
    
    // Send email (dev: console)
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/#reset-password/${rawToken}`;
    
    await emailService.send({
        to: user.email,
        subject: 'StockGuardPro — Password Reset',
        html: `
            <h2>Password Reset Request</h2>
            <p>Hi ${user.firstName},</p>
            <p>Click the link below to reset your password. This link expires in 1 hour.</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>If you didn't request this, ignore this email.</p>
        `,
        text: `Reset your password: ${resetUrl}\n\nExpires in 1 hour.`
    });
    
    return { success: true, message: 'If that email exists, a reset link was sent' };
}

// ============================================================
// Reset password — verify token, set new password
// ============================================================
async function resetPassword(req, token, newPassword) {
    const crypto = require('crypto');
    
    if (!newPassword || newPassword.length < 8) {
        throw { status: 400, message: 'Password must be at least 8 characters' };
    }
    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
        resetToken: hashedToken,
        resetTokenExpires: { $gt: Date.now() }
    }).select('+resetToken +resetTokenExpires');
    
    if (!user) {
        throw { status: 400, message: 'Invalid or expired reset token' };
    }
    
    user.password = newPassword;
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    user.passwordChangedAt = new Date();
    await user.save();
    
    await auditHelper.log(req, {
        action: 'PASSWORD_CHANGE',
        entityType: 'User',
        entityId: user._id,
        entityName: `${user.firstName} ${user.lastName}`,
        company: user.company,
        severity: 'warning'
    });
    
    return { success: true, message: 'Password reset successfully. You can now log in.' };
}

// ============================================================
// Change password — while logged in
// ============================================================
async function changePassword(req, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
        throw { status: 400, message: 'Current and new password required' };
    }
    if (newPassword.length < 8) {
        throw { status: 400, message: 'Password must be at least 8 characters' };
    }
    if (currentPassword === newPassword) {
        throw { status: 400, message: 'New password must be different' };
    }
    
    const user = await User.findById(req.user._id).select('+password');
    const matches = await user.comparePassword(currentPassword);
    if (!matches) {
        throw { status: 401, message: 'Current password is incorrect' };
    }
    
    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();
    
    await auditHelper.log(req, {
        action: 'PASSWORD_CHANGE',
        entityType: 'User',
        entityId: user._id,
        entityName: `${user.firstName} ${user.lastName}`,
        company: user.company,
        severity: 'warning'
    });
    
    return { success: true, message: 'Password changed successfully' };
}

// ============================================================
// Send email verification
// ============================================================
async function sendVerificationEmail(req, userId) {
    const emailService = require('../utils/emailService');
    const crypto = require('crypto');
    
    const user = await User.findById(userId);
    if (!user) throw { status: 404, message: 'User not found' };
    if (user.emailVerified) {
        return { success: true, message: 'Email already verified' };
    }
    
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    
    user.verificationToken = hashedToken;
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save();
    
    const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/#verify-email/${rawToken}`;
    
    await emailService.send({
        to: user.email,
        subject: 'StockGuardPro — Verify Your Email',
        html: `
            <h2>Welcome to StockGuardPro</h2>
            <p>Hi ${user.firstName},</p>
            <p>Please verify your email by clicking the link below:</p>
            <p><a href="${verifyUrl}">${verifyUrl}</a></p>
            <p>This link expires in 24 hours.</p>
        `,
        text: `Verify your email: ${verifyUrl}`
    });
    
    return { success: true, message: 'Verification email sent' };
}

// ============================================================
// Verify email
// ============================================================
async function verifyEmail(req, token) {
    const crypto = require('crypto');
    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
        verificationToken: hashedToken,
        verificationTokenExpires: { $gt: Date.now() }
    }).select('+verificationToken +verificationTokenExpires');
    
    if (!user) {
        throw { status: 400, message: 'Invalid or expired verification token' };
    }
    
    user.emailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();
    
    return { success: true, message: 'Email verified successfully' };
}

module.exports = {
    companyLogin,
    userLogin,
    refreshToken,
    registerCompany,
    fingerprintVerify,
    generateTokens,
    // New:
    forgotPassword,
    resetPassword,
    changePassword,
    sendVerificationEmail,
    verifyEmail
};