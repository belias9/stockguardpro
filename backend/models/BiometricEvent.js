const mongoose = require('mongoose');

const biometricEventSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    device: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
    eventId: { type: String, required: true, maxlength: 100 },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    eventType: { type: String, enum: ['clock_in', 'clock_out'], required: true },
    recordedAt: { type: Date, required: true }
}, { timestamps: true });
biometricEventSchema.index({ device: 1, eventId: 1 }, { unique: true });
module.exports = mongoose.model('BiometricEvent', biometricEventSchema);
