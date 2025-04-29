const mongoose = require('mongoose');

const electionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'pending', 'active', 'completed', 'cancelled'],
        default: 'draft'
    },
    candidates: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate'
    }],
    voters: [{
        voter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Voter'
        },
        hasVoted: {
            type: Boolean,
            default: false
        },
        votedAt: Date,
        transactionHash: String
    }],
    department: {
        type: String,
        required: true
    },
    voterEligibility: {
        type: String,
        enum: ['all', 'department', 'year'],
        default: 'all'
    },
    allowSelfNomination: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Voter',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    results: [{
        candidate: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Candidate'
        },
        voteCount: {
            type: Number,
            default: 0
        }
    }]
});

// Add a method to check if the election is currently active
electionSchema.methods.isActive = function() {
    const now = new Date();
    return (
        this.status === 'active' &&
        now >= this.startDate &&
        now <= this.endDate
    );
};

// Update timestamp on save
electionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Election = mongoose.model('Election', electionSchema);
module.exports = Election;
