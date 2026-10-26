/**
 * Socket.IO Setup
 * JWT auth on handshake, company + branch rooms.
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

let io = null;

// ============================================================
// Initialize Socket.IO
// ============================================================
function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:3000',
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // Auth middleware — verify JWT on handshake
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.replace('Bearer ', '');

            if (!token) return next(new Error('No token provided'));

            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET);
            } catch (err) {
                return next(new Error('Invalid or expired token'));
            }

            const user = await User.findById(decoded.id).select('-password -fingerprintTemplate -faceTemplate');
            if (!user) return next(new Error('User not found'));
            if (!user.isActive) return next(new Error('Account deactivated'));
            if (user.accountClosed) return next(new Error('Account closed'));

            // Attach user to socket
            socket.userId = user._id.toString();
            socket.userRole = user.role;
            socket.userCompany = user.company.toString();
            socket.userBranch = user.branch ? user.branch.toString() : null;
            socket.userName = `${user.firstName} ${user.lastName}`;

            next();
        } catch (err) {
            logger.error('[Socket] Auth error:', err.message);
            next(new Error('Authentication failed'));
        }
    });

    // Connection
    io.on('connection', (socket) => {
        const { userId, userRole, userCompany, userBranch, userName } = socket;

        logger.info(`[Socket] Connected: ${userName} (${userRole})`, {
            userId, company: userCompany, branch: userBranch
        });

        // Auto-join company room
        socket.join(`company:${userCompany}`);

        // Join branch room (if employee with branch)
        if (userBranch) {
            socket.join(`branch:${userBranch}`);
        }

        // ============================================================
        // Client can manually join additional rooms
        // ============================================================
        socket.on('join-company', (companyId) => {
            // Only allow joining own company
            if (companyId === userCompany) {
                socket.join(`company:${companyId}`);
            }
        });

        socket.on('join-branch', (branchId) => {
            // Employer can join any branch in own company
            // Employee can only join own branch
            if (userRole === 'employer') {
                socket.join(`branch:${branchId}`);
            } else if (branchId === userBranch) {
                socket.join(`branch:${branchId}`);
            }
        });

        socket.on('disconnect', (reason) => {
            logger.info(`[Socket] Disconnected: ${userName} (${reason})`);
        });
    });

    return io;
}

// ============================================================
// Event emitters (called from services)
// ============================================================

/**
 * Emit to a company (all users in that company)
 */
function emitToCompany(companyId, event, data) {
    if (!io) return;
    io.to(`company:${companyId}`).emit(event, data);
}

/**
 * Emit to a specific branch
 */
function emitToBranch(companyId, branchId, event, data) {
    if (!io) return;
    io.to(`branch:${branchId}`).emit(event, data);
}

/**
 * Emit to a specific user (via their personal room — join on connection)
 */
function emitToUser(userId, event, data) {
    if (!io) return;
    io.to(`user:${userId}`).emit(event, data);
}

// ============================================================
// Typed event helpers
// ============================================================

// Withdrawal events
function emitWithdrawalCreated(companyId, branchId, data) {
    emitToBranch(companyId, branchId, 'withdrawal:created', data);
}

function emitWithdrawalApproved(companyId, branchId, data) {
    emitToBranch(companyId, branchId, 'withdrawal:approved', data);
}

function emitWithdrawalDispatched(companyId, sourceBranch, destinationBranch, data) {
    emitToBranch(companyId, sourceBranch, 'withdrawal:dispatched', data);
    if (destinationBranch && destinationBranch !== sourceBranch) {
        emitToBranch(companyId, destinationBranch, 'withdrawal:dispatched', data);
    }
}

function emitWithdrawalReceived(companyId, branchId, data) {
    emitToBranch(companyId, branchId, 'withdrawal:received', data);
}

// Receipt / payment events
function emitReceiptCreated(companyId, branchId, data) {
    emitToBranch(companyId, branchId, 'receipt:created', data);
}

function emitPaymentConfirmed(companyId, branchId, data) {
    emitToBranch(companyId, branchId, 'payment:confirmed', data);
}

function emitPaymentDisputed(companyId, branchId, data) {
    emitToBranch(companyId, branchId, 'payment:disputed', data);
}

// Salary events
function emitSalaryPaid(companyId, userId, data) {
    emitToUser(userId, 'salary:paid', data);
}

function emitAdvanceRequested(companyId, branchId, data) {
    emitToBranch(companyId, branchId, 'advance:requested', data);
}

// Message events
function emitMessageSent(companyId, recipientUserId, data) {
    emitToUser(recipientUserId, 'message:new', data);
}

function emitMessageResponse(companyId, recipientUserId, data) {
    emitToUser(recipientUserId, 'message:response', data);
}

// Inventory events
function emitLowStockAlert(companyId, branchId, data) {
    emitToBranch(companyId, branchId, 'inventory:low-stock', data);
}

function emitInventoryModeChanged(companyId, branchId, data) {
    emitToBranch(companyId, branchId, 'inventory:mode-changed', data);
}

// Pre-record events
function emitPreRecordCreated(companyId, branchId, data) {
    emitToBranch(companyId, branchId, 'prerecord:created', data);
}

function emitPreRecordConfirmed(companyId, branchId, data) {
    emitToBranch(companyId, branchId, 'prerecord:confirmed', data);
}

// Generic notification
function emitNotification(companyId, userId, data) {
    if (userId) {
        emitToUser(userId, 'notification', data);
    } else {
        emitToCompany(companyId, 'notification', data);
    }
}

module.exports = {
    initSocket,
    emitToCompany,
    emitToBranch,
    emitToUser,
    // Typed helpers
    emitWithdrawalCreated,
    emitWithdrawalApproved,
    emitWithdrawalDispatched,
    emitWithdrawalReceived,
    emitReceiptCreated,
    emitPaymentConfirmed,
    emitPaymentDisputed,
    emitSalaryPaid,
    emitAdvanceRequested,
    emitMessageSent,
    emitMessageResponse,
    emitLowStockAlert,
    emitInventoryModeChanged,
    emitPreRecordCreated,
    emitPreRecordConfirmed,
    emitNotification,
    getIO: () => io
};