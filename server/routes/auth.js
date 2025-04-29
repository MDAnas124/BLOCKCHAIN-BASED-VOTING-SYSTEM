const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Voter = require('../models/Voter');
const Candidate = require('../models/Candidate');
const Election = require('../models/Election');
const auth = require('../middleware/auth');

// Register voter
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password, studentId, department, role, walletAddress } = req.body;

        // Check if voter exists
        let voter = await Voter.findOne({ $or: [{ email }, { studentId }] });
        if (voter) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create new voter
        voter = new Voter({
            firstName,
            lastName,
            email,
            password,
            studentId,
            department,
            walletAddress,
            role: role || 'student'
        });

        await voter.save();

        // Create token
        const token = jwt.sign(
            { id: voter._id, role: voter.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                id: voter._id,
                firstName: voter.firstName,
                lastName: voter.lastName,
                email: voter.email,
                role: voter.role,
                walletAddress: voter.walletAddress
                
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
});

// Login voter
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt for:', email);

        // Find voter by email
        const voter = await Voter.findOne({ email });
        if (!voter) {
            console.log('User not found:', email);
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Use the model's comparePassword method
        const isMatch = await voter.comparePassword(password);
        if (!isMatch) {
            console.log('Password mismatch for:', email);
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Check role if admin login was requested
        if (req.body.role === 'admin' && voter.role !== 'admin') {
            console.log('Non-admin user trying to log in as admin:', email);
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Create token
        const token = jwt.sign(
            { id: voter._id, role: voter.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: voter._id,
                firstName: voter.firstName,
                lastName: voter.lastName,
                email: voter.email,
                role: voter.role,
                isVerified: voter.isVerified
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Login failed', error: error.message });
    }
});

// Get current user
router.get('/me', auth, async (req, res) => {
    try {
        const voter = await Voter.findById(req.user.id).select('-password');
        res.json(voter);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user data' });
    }
});

// Update voter profile
router.put('/profile', auth, async (req, res) => {
    try {
        const { firstName, lastName, department } = req.body;
        const voter = await Voter.findById(req.user.id);

        if (firstName) voter.firstName = firstName;
        if (lastName) voter.lastName = lastName;
        if (department) voter.department = department;

        await voter.save();
        res.json({ message: 'Profile updated successfully', voter });
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile' });
    }
});

// Apply to become candidate
router.post('/become-candidate', auth, async (req, res) => {
    try {
        const { manifesto, position } = req.body;
        const voter = await Voter.findById(req.user.id);

        if (voter.role !== 'student') {
            return res.status(400).json({ message: 'Only students can become candidates' });
        }

        voter.candidateProfile = {
            isCandidate: true,
            manifesto,
            position,
            approvalStatus: 'pending'
        };

        await voter.save();
        res.json({ message: 'Candidate application submitted successfully', voter });
    } catch (error) {
        res.status(500).json({ message: 'Error submitting candidate application' });
    }
});

// Get all candidates
router.get('/candidates', auth, async (req, res) => {
    try {
        // Check if admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Get all candidates
        const candidates = await Candidate.find({})
            .populate('electionId', 'title department');

        res.json({
            success: true,
            candidates
        });
    } catch (error) {
        console.error('Get candidates error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Get pending candidate verifications (Admin only)
router.get('/candidates/pending', auth, async (req, res) => {
    try {
        // Check if admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Get pending candidates
        const pendingCandidates = await Candidate.find({ isVerified: false })
            .populate('electionId', 'title department')
            .populate('voter', 'firstName lastName email');

        res.json({
            success: true,
            pendingCandidates
        });
    } catch (error) {
        console.error('Get pending candidates error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Verify a candidate (Admin only)
router.put('/candidates/:id/verify', auth, async (req, res) => {
    try {
        // Check if admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { status } = req.body;
        if (!status || !['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        // Update candidate status
        candidate.status = status;
        candidate.isVerified = status === 'approved';
        await candidate.save();

        // If approved, add candidate to election
        if (status === 'approved' && candidate.electionId) {
            const election = await Election.findById(candidate.electionId);
            if (election && !election.candidates.includes(candidate._id)) {
                election.candidates.push(candidate._id);
                await election.save();
            }
        }

        res.json({
            success: true,
            message: `Candidate ${status}`,
            candidate
        });
    } catch (error) {
        console.error('Verify candidate error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error verifying candidate', 
            error: error.message 
        });
    }
});

// Get all voters with better filter options (Admin only)
router.get('/voters', auth, async (req, res) => {
    try {
        // Only admin can see all voters
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        
        const { verified, department, search } = req.query;
        const filter = { role: 'student' };
        
        // Add filters if provided
        if (verified === 'true') filter.isVerified = true;
        else if (verified === 'false') filter.isVerified = false;
        
        if (department) filter.department = department;
        
        // Add search functionality
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filter.$or = [
                { firstName: searchRegex },
                { lastName: searchRegex },
                { email: searchRegex },
                { studentId: searchRegex }
            ];
        }

        const voters = await Voter.find(filter)
            .select('-password')
            .sort({ createdAt: -1 });
            
        res.json({
            success: true,
            count: voters.length,
            voters
        });
    } catch (error) {
        console.error('Error fetching voters:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching voters',
            error: error.message 
        });
    }
});

// Get pending voter verifications (Admin only)
router.get('/voters/pending', auth, async (req, res) => {
    try {
        // Only admin can verify voters
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        
        const pendingVoters = await Voter.find({
            role: 'student',
            isVerified: false
        }).select('-password').sort({ createdAt: -1 });
        
        res.json({
            success: true,
            count: pendingVoters.length,
            pendingVoters
        });
    } catch (error) {
        console.error('Error fetching pending voters:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching pending voters',
            error: error.message 
        });
    }
});

// Verify voter (Admin only)
router.put('/voters/:id/verify', auth, async (req, res) => {
    try {
        // Only admin can verify voters
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        
        const { approve } = req.body;
        if (approve === undefined) {
            return res.status(400).json({ 
                success: false, 
                message: 'Approval status is required' 
            });
        }
        
        const voter = await Voter.findById(req.params.id);
        if (!voter) {
            return res.status(404).json({ 
                success: false, 
                message: 'Voter not found' 
            });
        }
        
        voter.isVerified = approve === true || approve === 'true';
        await voter.save();
        
        res.json({
            success: true,
            message: `Voter ${voter.isVerified ? 'approved' : 'rejected'}`,
            voter: {
                id: voter._id,
                firstName: voter.firstName,
                lastName: voter.lastName,
                email: voter.email,
                studentId: voter.studentId,
                department: voter.department,
                isVerified: voter.isVerified
            }
        });
    } catch (error) {
        console.error('Error verifying voter:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error verifying voter',
            error: error.message 
        });
    }
});

// Admin: Verify voter
router.put('/verify/:id', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const voter = await Voter.findById(req.params.id);
        if (!voter) {
            return res.status(404).json({ message: 'Voter not found' });
        }

        voter.isVerified = true;
        await voter.save();

        res.json({ message: 'Voter verified successfully', voter });
    } catch (error) {
        res.status(500).json({ message: 'Error verifying voter' });
    }
});

// Admin: Approve/Reject candidate
router.put('/candidate/:id/status', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { status } = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const voter = await Voter.findById(req.params.id);
        if (!voter || !voter.candidateProfile.isCandidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        voter.candidateProfile.approvalStatus = status;
        await voter.save();

        res.json({ message: 'Candidate status updated successfully', voter });
    } catch (error) {
        res.status(500).json({ message: 'Error updating candidate status' });
    }
});

// Create a new candidate (Admin only)
router.post('/candidates', auth, async (req, res) => {
    try {
        // Only admin can create candidates
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { 
            name, 
            description, 
            electionId, 
            voterId, // Optional - can link to existing voter
            department, 
            manifesto,
            imageUrl 
        } = req.body;

        // Validate required fields
        if (!name || !description || !electionId || !department || !manifesto) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields' 
            });
        }

        // Validate election exists
        const election = await Election.findById(electionId);
        if (!election) {
            return res.status(404).json({ 
                success: false, 
                message: 'Election not found' 
            });
        }

        // Create candidate data
        const candidateData = {
            name,
            description,
            electionId,
            department,
            manifesto,
            status: 'approved', // Admin-created candidates are auto-approved
            isVerified: true
        };

        // Add optional fields if provided
        if (imageUrl) candidateData.imageUrl = imageUrl;
        
        // If voter ID is provided, validate and link
        if (voterId) {
            const voter = await Voter.findById(voterId);
            if (!voter) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Voter not found' 
                });
            }
            candidateData.voter = voterId;
        }
        // Note: voter field is now optional, so we don't need to set it if not provided

        // Create and save the candidate
        const candidate = new Candidate(candidateData);
        await candidate.save();

        // Add candidate to election's candidates list using findByIdAndUpdate to avoid validation issues
        await Election.findByIdAndUpdate(
            electionId,
            { $addToSet: { candidates: candidate._id } }, // $addToSet only adds if not already exists
            { new: true }
        );

        res.status(201).json({
            success: true,
            message: 'Candidate created successfully',
            candidate
        });
    } catch (error) {
        console.error('Create candidate error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creating candidate: ' + error.message, 
            error: error.message 
        });
    }
});

// Get all candidates (for admin dashboard)
router.get('/candidates', auth, async (req, res) => {
    try {
        // Only admin can see all candidates
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Get all verified candidates with election and voter details
        const candidates = await Candidate.find({ isVerified: true })
            .populate('electionId', 'title status')
            .populate('voter', 'firstName lastName email')
            .sort('-createdAt');

        res.json({
            success: true,
            candidates
        });
    } catch (error) {
        console.error('Error getting candidates:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error retrieving candidates', 
            error: error.message 
        });
    }
});

// Get pending candidates for verification (admin only)
router.get('/candidates/pending', auth, async (req, res) => {
    try {
        // Only admin can see pending candidates
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Get all non-verified candidates with election and voter details
        const pendingCandidates = await Candidate.find({ isVerified: false })
            .populate('electionId', 'title status')
            .populate('voter', 'firstName lastName email')
            .sort('-createdAt');

        res.json({
            success: true,
            pendingCandidates
        });
    } catch (error) {
        console.error('Error getting pending candidates:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error retrieving pending candidates', 
            error: error.message 
        });
    }
});

// Delete a candidate (admin only)
router.delete('/candidates/:id', auth, async (req, res) => {
    try {
        // Only admin can delete candidates
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const candidateId = req.params.id;
        const candidate = await Candidate.findById(candidateId);

        if (!candidate) {
            return res.status(404).json({ 
                success: false, 
                message: 'Candidate not found' 
            });
        }

        // If candidate is part of an election, remove from election's candidates list
        if (candidate.electionId) {
            await Election.findByIdAndUpdate(
                candidate.electionId,
                { $pull: { candidates: candidateId } }
            );
        }

        // Delete the candidate
        await Candidate.findByIdAndDelete(candidateId);

        res.json({
            success: true,
            message: 'Candidate deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting candidate:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting candidate', 
            error: error.message 
        });
    }
});

// Verify a candidate (admin only)
router.patch('/candidates/:id/verify', auth, async (req, res) => {
    try {
        // Only admin can verify candidates
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { status } = req.body;
        if (!status || !['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid status provided' 
            });
        }

        const candidateId = req.params.id;
        const candidate = await Candidate.findById(candidateId);

        if (!candidate) {
            return res.status(404).json({ 
                success: false, 
                message: 'Candidate not found' 
            });
        }

        // Update verification status
        candidate.status = status;
        candidate.isVerified = status === 'approved';
        await candidate.save();

        // If rejected, also remove from election's candidates list
        if (status === 'rejected' && candidate.electionId) {
            await Election.findByIdAndUpdate(
                candidate.electionId,
                { $pull: { candidates: candidateId } }
            );
        }

        res.json({
            success: true,
            message: `Candidate ${status === 'approved' ? 'approved' : 'rejected'} successfully`,
            candidate
        });
    } catch (error) {
        console.error('Error verifying candidate:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error verifying candidate', 
            error: error.message 
        });
    }
});

// Get all voters (admin only)
router.get('/voters', auth, async (req, res) => {
    try {
        // Only admin can access all voters
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Get all voters, sorted by most recently registered
        const voters = await Voter.find({})
            .select('-password') // Exclude passwords
            .sort('-createdAt');

        res.json({
            success: true,
            voters
        });
    } catch (error) {
        console.error('Error getting voters:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error retrieving voters', 
            error: error.message 
        });
    }
});

// Get pending (unverified) voters (admin only)
router.get('/voters/pending', auth, async (req, res) => {
    try {
        // Only admin can access pending voters
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Get all unverified voters
        const pendingVoters = await Voter.find({ isVerified: false })
            .select('-password') // Exclude passwords
            .sort('-createdAt');

        res.json({
            success: true,
            pendingVoters
        });
    } catch (error) {
        console.error('Error getting pending voters:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error retrieving pending voters', 
            error: error.message 
        });
    }
});

// Verify a voter (admin only)
router.patch('/voters/:id/verify', auth, async (req, res) => {
    try {
        // Only admin can verify voters
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { approve } = req.body;
        if (typeof approve !== 'boolean') {
            return res.status(400).json({ 
                success: false, 
                message: 'Approve parameter must be boolean' 
            });
        }

        const voterId = req.params.id;
        const voter = await Voter.findById(voterId);

        if (!voter) {
            return res.status(404).json({ 
                success: false, 
                message: 'Voter not found' 
            });
        }

        if (approve) {
            // Approve the voter
            voter.isVerified = true;
            await voter.save();
            res.json({
                success: true,
                message: 'Voter approved successfully',
                voter: {
                    _id: voter._id,
                    firstName: voter.firstName,
                    lastName: voter.lastName,
                    email: voter.email,
                    studentId: voter.studentId,
                    department: voter.department,
                    isVerified: voter.isVerified
                }
            });
        } else {
            // Reject the voter - delete them
            await Voter.findByIdAndDelete(voterId);
            res.json({
                success: true,
                message: 'Voter rejected and removed successfully'
            });
        }
    } catch (error) {
        console.error('Error verifying voter:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error verifying voter', 
            error: error.message 
        });
    }
});

// Get a specific voter (admin or self only)
router.get('/voters/:id', auth, async (req, res) => {
    try {
        const voterId = req.params.id;
        
        // Only admin or the voter themselves can access voter details
        if (req.user.role !== 'admin' && req.user.id !== voterId) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const voter = await Voter.findById(voterId).select('-password');
        
        if (!voter) {
            return res.status(404).json({ 
                success: false, 
                message: 'Voter not found' 
            });
        }

        res.json({
            success: true,
            voter
        });
    } catch (error) {
        console.error('Error getting voter:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error retrieving voter', 
            error: error.message 
        });
    }
});

// Delete a voter (admin only)
router.delete('/voters/:id', auth, async (req, res) => {
    try {
        // Only admin can delete voters
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const voterId = req.params.id;
        const voter = await Voter.findById(voterId);

        if (!voter) {
            return res.status(404).json({ 
                success: false, 
                message: 'Voter not found' 
            });
        }

        // Delete the voter
        await Voter.findByIdAndDelete(voterId);

        res.json({
            success: true,
            message: 'Voter deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting voter:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting voter', 
            error: error.message 
        });
    }
});

module.exports = router;
