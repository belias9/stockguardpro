/**
 * User Model (Employers & Employees)
 * Multi-role, branch-scoped, biometric-enabled.
 * The single most security-critical model in the system.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ============================================================
// Constants
// ============================================================
const ROLES = ['employer', 'employee'];

const EMPLOYEE_FUNCTIONS = [
    'manager',
    'cashier',
    'shop_buyer',
    'stock',
    'sales',
    'none'
];

const MAX_EMPLOYERS_PER_COMPANY = 3;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// ============================================================
// Schema
// ============================================================
const userSchema = new mongoose.Schema({
    // ============ Tenant ============
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: [true, 'Company is required'],
        index: true
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        default: null,
        index: true
        // null only for employers (company-wide)
        // required for employees (validated in pre-validate)
    },

    // ============ Identity ============
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        lowercase: true,
        trim: true
        // Unique per company (compound index)
    },
    phone: {
        type: String,
        required: [true, 'Phone is required'],
        trim: true
    },

    // ============ Auth ============
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters'],
        select: false
    },

    // ============ Role ============
    role: {
        type: String,
        enum: {
            values: ROLES,
            message: 'Role must be either employer or employee'
        },
        required: [true, 'Role is required']
    },

    // ============ Multi-role (employees only) ============
    roles: {
        type: [String],
        enum: {
            values: EMPLOYEE_FUNCTIONS,
            message: 'Invalid function in roles array'
        },
        default: []
        // For employees: list of functions assigned by employer
        // For employers: ignored (empty)
    },
    activeRoles: {
        type: [String],
        enum: {
            values: EMPLOYEE_FUNCTIONS,
            message: 'Invalid function in activeRoles array'
        },
        default: []
        // Currently active roles — subset of roles
        // Role can be assigned (in roles) but paused (not in activeRoles)
    },

    // ============ Employee ID ============
    employeeId: {
        type: String,
        trim: true
        // Unique per company (compound index)
        // Format: EMP-0001, EMP-0002, etc.
    },

    // ============ Salary (base) ============
        baseSalary: {
        type: Number,
        default: 0,
        min: [0, 'Base salary cannot be negative']
    },

    // ✅ ADD THIS:
    isMainStock: {
        type: Boolean,
        default: false
        // Employer marks one stock employee per warehouse as "main"
        // Main stock sees cost prices and can dispatch; assistants don't
    },

    // ============ Biometrics ============
    fingerprintTemplate: {
        type: String,
        select: false  // never returned by default
        // bcrypt hash of template (never raw)
    },
    faceTemplate: {
        type: String,
        select: false
    },
    biometricsEnrolledAt: {
        type: Date,
        default: null
    },
    biometricsDevice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        default: null
    },

    // ============ Account status ============
    isActive: {
        type: Boolean,
        default: true
    },
    accountClosed: {
        type: Boolean,
        default: false
    },
    closedAt: {
        type: Date,
        default: null
    },
    closedReason: {
        type: String,
        default: null
    },

    // ============ Login tracking ============
    lastLogin: {
        type: Date,
        default: null
    },
    lastLoginIp: {
        type: String,
        default: null
    },
        lastLoginIp: {
        type: String,
        default: null
    },

    // ✅ ADD THESE:
    emailVerified: {
        type: Boolean,
        default: true
        // Default true for backward compat — new users get false
    },
    verificationToken: { type: String, select: false },
    verificationTokenExpires: { type: Date, select: false },
    
    resetToken: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
    
    passwordChangedAt: { type: Date, default: null },
    loginAttempts: {
        type: Number,
        default: 0,
        select: false
    },
    lockUntil: {
        type: Date,
        default: null,
        select: false
    },

    // ============ Profile ============
    avatar: {
        type: String,
        default: null
    },

    // ============ Metadata ============
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// ============================================================
// Indexes
// ============================================================
// Unique: email per company
userSchema.index({ company: 1, email: 1 }, { unique: true });

// Unique: employee ID per company — only when employeeId is actually set
userSchema.index(
    { company: 1, employeeId: 1 },
    {
        unique: true,
        partialFilterExpression: { employeeId: { $type: 'string' } }
    }
);

// Query: active users in company
userSchema.index({ company: 1, isActive: 1, accountClosed: 1 });

// Query: users in branch
userSchema.index({ branch: 1, isActive: 1 });

// Query: users by role
userSchema.index({ company: 1, role: 1, isActive: 1 });

// Query: users by function (for finding all cashiers, etc.)
userSchema.index({ company: 1, activeRoles: 1 });

// ============================================================
// Pre-validate: enforce branch requirement for employees
// ============================================================
userSchema.pre('validate', function (next) {
    if (this.role === 'employee' && !this.branch) {
        return next(new Error('Employees must be assigned to a branch'));
    }

    // Employer's activeRoles must be empty
    if (this.role === 'employer') {
        this.roles = [];
        this.activeRoles = [];
    }

    // activeRoles must be a subset of roles
    if (this.activeRoles && this.roles) {
        const invalid = this.activeRoles.filter(r => !this.roles.includes(r));
        if (invalid.length > 0) {
            return next(new Error(`activeRoles contains functions not in roles: ${invalid.join(', ')}`));
        }
    }

    next();
});

// ============================================================
// Pre-save: hash password
// ============================================================
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// ============================================================
// Pre-save: enforce max 3 employers per company
// ============================================================
userSchema.pre('save', async function (next) {
    if (!this.isNew || this.role !== 'employer') return next();

    try {
        const count = await this.constructor.countDocuments({
            company: this.company,
            role: 'employer',
            isActive: true
        });

        if (count >= MAX_EMPLOYERS_PER_COMPANY) {
            return next(new Error(
                `Maximum of ${MAX_EMPLOYERS_PER_COMPANY} employers per company reached`
            ));
        }

        next();
    } catch (err) {
        next(err);
    }
});

// ============================================================
// Pre-save: auto-generate employeeId for employees
// ============================================================
userSchema.pre('save', async function (next) {
    if (!this.isNew || this.role !== 'employee' || this.employeeId) {
        return next();
    }

    try {
        const count = await this.constructor.countDocuments({
            company: this.company,
            role: 'employee'
        });

        this.employeeId = `EMP-${String(count + 1).padStart(4, '0')}`;
        next();
    } catch (err) {
        next(err);
    }
});

// ============================================================
// Pre-save: update timestamp
// ============================================================
userSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// ============================================================
// Method: compare password
// ============================================================
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// ============================================================
// Method: check if account is locked
// ============================================================
userSchema.methods.isLocked = function () {
    return this.lockUntil && this.lockUntil > Date.now();
};

// ============================================================
// Method: increment login attempts (with lockout)
// ============================================================
userSchema.methods.incLoginAttempts = async function () {
    // If lock has expired, reset
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }

    const updates = { $inc: { loginAttempts: 1 } };

    // Lock account if max attempts reached
    if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS) {
        updates.$set = { lockUntil: Date.now() + LOCKOUT_DURATION_MS };
    }

    return this.updateOne(updates);
};

// ============================================================
// Method: reset login attempts
// ============================================================
userSchema.methods.resetLoginAttempts = function () {
    return this.updateOne({
        $set: { loginAttempts: 0, lastLogin: Date.now() },
        $unset: { lockUntil: 1 }
    });
};

// ============================================================
// Method: hash a biometric template
// ============================================================
userSchema.statics.hashBiometric = async function (rawTemplate) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(rawTemplate, salt);
};

// ============================================================
// Method: verify a biometric template
// ============================================================
userSchema.methods.verifyBiometric = async function (rawTemplate, type = 'fingerprint') {
    const stored = type === 'fingerprint' ? this.fingerprintTemplate : this.faceTemplate;
    if (!stored) return false;
    return bcrypt.compare(rawTemplate, stored);
};

// ============================================================
// Method: check if user has a specific function active
// ============================================================
userSchema.methods.hasFunction = function (fn) {
    if (this.role === 'employer') return true; // Employer bypasses
    return this.activeRoles.includes(fn);
};

// ============================================================
// Method: safe public profile (no sensitive fields)
// ============================================================
userSchema.methods.toPublicJSON = function () {
    return {
        id: this._id,
        firstName: this.firstName,
        lastName: this.lastName,
        fullName: `${this.firstName} ${this.lastName}`,
        email: this.email,
        phone: this.phone,
        role: this.role,
        roles: this.roles,
        activeRoles: this.activeRoles,
        employeeId: this.employeeId,
        branch: this.branch,
        company: this.company,
        isActive: this.isActive,
        accountClosed: this.accountClosed,
        lastLogin: this.lastLogin,
        avatar: this.avatar,
        baseSalary: this.baseSalary,
        isMainStock: this.isMainStock,
        createdAt: this.createdAt
    };
};

// ============================================================
// Virtual: full name
// ============================================================
userSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`.trim();
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// ============================================================
// Expose constants
// ============================================================
userSchema.statics.ROLES = ROLES;
userSchema.statics.EMPLOYEE_FUNCTIONS = EMPLOYEE_FUNCTIONS;
userSchema.statics.MAX_EMPLOYERS_PER_COMPANY = MAX_EMPLOYERS_PER_COMPANY;
userSchema.statics.MAX_LOGIN_ATTEMPTS = MAX_LOGIN_ATTEMPTS;
userSchema.statics.LOCKOUT_DURATION_MS = LOCKOUT_DURATION_MS;

module.exports = mongoose.model('User', userSchema);