const express = require('express');
const router = express.Router();
const Election = require('../models/Election');
const Voter = require('../models/Voter');
const auth = require('../middleware/auth');

// Create a new election (Admin only)
router.post('/', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
        }

        const { 
            title, 
            description, 
            startDate, 
            endDate, 
            department, 
            status, 
            voterEligibility, 
            allowSelfNomination 
        } = req.body;
        
        // Validate inputs
        if (!title || !description || !startDate || !endDate || !department) {
            return res.status(400).json({ 
                success: false, 
                message: 'Required fields missing' 
            });
        }

        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end <= start) {
            return res.status(400).json({ 
                success: false, 
                message: 'End date must be after start date' 
            });
        }

        const election = new Election({
            title,
            description,
            startDate,
            endDate,
            department,
            createdBy: req.user.id,
            status: status || 'draft',
            voterEligibility: voterEligibility || 'all',
            allowSelfNomination: allowSelfNomination !== undefined ? allowSelfNomination : true
        });

        await election.save();
        res.status(201).json({ 
            success: true, 
            message: 'Election created successfully', 
            election 
        });
    } catch (error) {
        console.error('Create election error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create election', 
            error: error.message 
        });
    }
});

// Get all elections with filters
router.get('/', auth, async (req, res) => {
    try {
        const { status, department } = req.query;
        const filter = {};

        if (status) filter.status = status;
        if (department) filter.department = department;

        // If student, only show elections for their department
        

        const elections = await Election.find(filter)
            .populate('createdBy', 'firstName lastName email')
            .populate('candidates', 'firstName lastName email')
            .sort({ createdAt: -1 });

        res.json(elections);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get election statistics (active, completed, total) - MUST come BEFORE the :id route
router.get('/stats', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
        }

        // Get elections stats
        const now = new Date();
        
        // Count active elections - elections that are currently active for voting
        const activeElections = await Election.countDocuments({
            status: 'active'
        });

        const completedElections = await Election.countDocuments({
            status: 'completed'
        });

        const pendingElections = await Election.countDocuments({
            status: 'pending'
        });

        const draftElections = await Election.countDocuments({
            status: 'draft'
        });

        const totalElections = await Election.countDocuments({});

        // Get voters stats
        const totalVoters = await Voter.countDocuments({ role: 'student' });
        const pendingVoters = await Voter.countDocuments({ isVerified: false, role: 'student' });
        const verifiedVoters = await Voter.countDocuments({ isVerified: true, role: 'student' });

        res.json({
            success: true,
            elections: {
                active: activeElections,
                completed: completedElections,
                pending: pendingElections,
                draft: draftElections,
                total: totalElections
            },
            voters: {
                total: totalVoters,
                pending: pendingVoters,
                verified: verifiedVoters
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get active elections
router.get('/active', auth, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ success: false, message: 'Access denied. Student only.' });
        }

        const now = new Date();

        // Get active elections
        const activeElections = await Election.find({ status: 'active' })
            .populate('candidates', 'name description department')
            .lean();

        // Get upcoming elections
        const upcomingElections = await Election.find({
            status: 'pending',
            startDate: { $gt: now }
        }).lean();

        // Check if the current user has voted in any active elections
        const activeWithVotingStatus = activeElections.map(election => {
            // Default to empty array if voters is undefined
            const votersArray = Array.isArray(election.voters) ? election.voters : [];
            const hasVoted = votersArray.some(voter =>
                voter.voter && voter.voter.toString() === req.user.id && voter.hasVoted
            );
            return {
                ...election,
                hasVoted
            };
        });

        res.json({
            success: true,
            data: {
                active: activeWithVotingStatus,
                upcoming: upcomingElections
            }
        });
    } catch (error) {
        console.error('Get active elections error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error', 
            error: error.message 
        });
    }
});

// Get election by ID (skip 'results' to allow the specific results route)
router.get('/:id', auth, async (req, res, next) => {
    if (req.params.id === 'results') {
        return next();
    }

    try {
const election = await Election.findById(req.params.id)
    .populate('createdBy', 'firstName lastName email')
    .populate('candidates', 'name description department candidateId voteCount')
    .populate('voters.voter', 'firstName lastName email');

if (!election) {
    return res.status(404).json({ message: 'Election not found' });
}

        console.log('Election data sent:', JSON.stringify(election, null, 2));

        res.json(election);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update election (Admin only)
router.put('/:id', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const { title, description, startDate, endDate, status, department } = req.body;
        const election = await Election.findById(req.params.id);

        if (!election) {
            return res.status(404).json({ message: 'Election not found' });
        }

        // Update fields
        if (title) election.title = title;
        if (description) election.description = description;
        if (startDate) election.startDate = startDate;
        if (endDate) election.endDate = endDate;
        if (status) election.status = status;
        if (department) election.department = department;

        await election.save();
        res.json({ message: 'Election updated successfully', election });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete election (Admin only)
router.delete('/:id', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        // Use deleteOne directly on model to avoid issues with document methods
        const result = await Election.deleteOne({ _id: req.params.id });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Election not found' });
        }

        res.json({ message: 'Election deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Cast vote
router.post('/:id/vote', auth, async (req, res) => {
    try {
        const { candidateId } = req.body;
        const election = await Election.findById(req.params.id);

        if (!election) {
            return res.status(404).json({ message: 'Election not found' });
        }

        // Check if election is active
        if (election.status !== 'active') {
            return res.status(400).json({ message: 'Election is not active' });
        }

        // Check if voter is verified
        const voter = await Voter.findById(req.user.id);
        if (!voter.isVerified) {
            return res.status(400).json({ message: 'Voter is not verified' });
        }

        // Check if voter has already voted
        const hasVoted = election.voters.some(v => v.voter.toString() === req.user.id);
        if (hasVoted) {
            return res.status(400).json({ message: 'You have already voted in this election' });
        }

        // Check if candidate exists in election
        if (!election.candidates.includes(candidateId)) {
            return res.status(400).json({ message: 'Invalid candidate' });
        }

        // Record vote
        election.voters.push({
            voter: req.user.id,
            hasVoted: true,
            votedAt: Date.now()
        });

        // Update candidate vote count
        const candidateIndex = election.results.findIndex(r => r.candidate.toString() === candidateId);
        if (candidateIndex === -1) {
            election.results.push({
                candidate: candidateId,
                voteCount: 1
            });
        } else {
            election.results[candidateIndex].voteCount += 1;
        }

        // Also update voteCount in Candidate collection
        const Candidate = require('../models/Candidate');
        await Candidate.findByIdAndUpdate(candidateId, { $inc: { voteCount: 1 } });

        await election.save();

        // Update voter's voting history
        voter.votingHistory.push({
            election: election._id,
            votedAt: Date.now()
        });
        await voter.save();

        res.json({ message: 'Vote cast successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get election results (Only available for completed elections)
router.get('/:id/results', auth, async (req, res) => {
    try {
        const election = await Election.findById(req.params.id)
            .populate('results.candidate', 'firstName lastName email');

        if (!election) {
            return res.status(404).json({ message: 'Election not found' });
        }

        // Only admin can see results of active elections
        if (election.status === 'active' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Results not available until election is completed' });
        }

        const results = election.results.sort((a, b) => b.voteCount - a.voteCount);
        const totalVotes = results.reduce((sum, r) => sum + r.voteCount, 0);

        res.json({
            electionTitle: election.title,
            status: election.status,
            totalVotes,
            results: results.map(r => ({
                candidate: {
                    name: `${r.candidate.firstName} ${r.candidate.lastName}`,
                    email: r.candidate.email
                },
                voteCount: r.voteCount,
                percentage: ((r.voteCount / totalVotes) * 100).toFixed(2)
            }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get election statistics
router.get('/dashboard-stats', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const [totalVoters, totalElections, activeElections, completedElections, totalCandidates] = await Promise.all([
            Voter.countDocuments({ role: 'student' }),
            Election.countDocuments(),
            Election.countDocuments({ status: 'active' }),
            Election.countDocuments({ status: 'completed' }),
            Voter.countDocuments({ 'candidateProfile.isCandidate': true })
        ]);

        const stats = {
            voters: {
                total: totalVoters
            },
            elections: {
                total: totalElections,
                active: activeElections,
                completed: completedElections
            },
            totalCandidates
        };

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all completed election results for student dashboard
router.get('/results', auth, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Find completed elections
        const completedElections = await Election.find({ status: 'completed' })
            .populate('candidates', 'name description department voteCount')
            .sort({ endDate: -1 }) // Most recent first
            .lean();
            
        // Format results for each election
        const formattedResults = completedElections.map(election => {
            const totalVotes = election.voters.filter(v => v.hasVoted).length;
            
            // Calculate results
            const candidates = election.candidates.map(candidate => {
                const voteCount = candidate.voteCount || 0;
                
                return {
                    id: candidate._id,
                    name: candidate.name,
                    description: candidate.description,
                    department: candidate.department,
                    voteCount,
                    percentage: totalVotes > 0 ? ((voteCount / totalVotes) * 100).toFixed(1) : '0'
                };
            }).sort((a, b) => b.voteCount - a.voteCount); // Sort by most votes
            
            return {
                id: election._id,
                title: election.title,
                description: election.description,
                department: election.department,
                endDate: election.endDate,
                totalVotes,
                candidates
            };
        });

        res.json({
            success: true,
            data: formattedResults
        });
    } catch (error) {
        console.error('Get election results error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch election results', 
            error: error.message 
        });
    }
});

module.exports = router;