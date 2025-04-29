const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const voterSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    studentId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    department: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'student'],
        default: 'student'
    },
    walletAddress: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    votingHistory: [{
        election: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Election'
        },
        votedAt: {
            type: Date,
            default: Date.now
        }
    }],
    candidateProfile: {
        isCandidate: {
            type: Boolean,
            default: false
        },
        manifesto: String,
        position: String,
        approvalStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
voterSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Compare password method
voterSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const Voter = mongoose.model('Voter', voterSchema);
module.exports = Voter;
