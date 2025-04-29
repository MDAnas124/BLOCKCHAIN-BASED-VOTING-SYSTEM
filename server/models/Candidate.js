const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    electionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Election',
        required: true
    },
    voter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Voter',
        required: false // Changed from required: true to allow admin-created candidates without voter association
    },
    department: {
        type: String,
        required: true
    },
    manifesto: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        default: 'default-candidate.jpg'
    },
    voteCount: {
        type: Number,
        default: 0
    },
    candidateId: {  // Added numeric candidateId for smart contract
        type: Number,
        required: false,
        unique: true,
        sparse: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
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

// Update timestamp on save
candidateSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Candidate', candidateSchema);
