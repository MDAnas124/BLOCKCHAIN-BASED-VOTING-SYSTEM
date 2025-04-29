const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Voter = require('../models/Voter');
const Election = require('../models/Election');
const Candidate = require('../models/Candidate');
const crypto = require('crypto');
const Web3 = require('web3');
const contractJson = require('../../build/contracts/VotingSystem.json');

const otpStore = new Map();

const web3 = new Web3('http://127.0.0.1:8545'); // Ganache local blockchain
const contractABI = contractJson.abi;
const manualContractAddress = process.env.VOTING_CONTRACT_ADDRESS || null;

const contractAddress = manualContractAddress || (contractJson.networks && Object.values(contractJson.networks)[0] && Object.values(contractJson.networks)[0].address);

if (!contractAddress) {
    console.error('Contract address not found. Please set VOTING_CONTRACT_ADDRESS environment variable or ensure the contract JSON networks contain the address.');
}

const votingContract = contractAddress ? new web3.eth.Contract(contractABI, contractAddress) : null;

function isContractInitialized() {
    if (!contractAddress) {
        console.error('Voting contract address is missing.');
        return false;
    }
    if (!votingContract) {
        console.error('Voting contract instance is not initialized.');
        return false;
    }
    return true;
}

// Request OTP for voting
router.post('/request-otp', auth, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ success: false, message: 'Only students can vote' });
        }

        const { electionId, candidateId } = req.body;

        const election = await Election.findById(electionId);
        if (!election) {
            return res.status(404).json({ success: false, message: 'Election not found' });
        }

        if (election.status !== 'active') {
            return res.status(400).json({ success: false, message: 'This election is not active' });
        }

        const candidate = await Candidate.findById(candidateId);
        if (!candidate || candidate.electionId.toString() !== electionId) {
            return res.status(404).json({ success: false, message: 'Candidate not found in this election' });
        }

        const voter = await Voter.findById(req.user.id);
        if (!voter) {
            return res.status(404).json({ success: false, message: 'Voter not found' });
        }

        const hasVoted = election.voters.some(v => 
            v.voter.toString() === voter._id.toString() && v.hasVoted
        );

        if (hasVoted) {
            return res.status(400).json({ success: false, message: 'You have already voted in this election' });
        }

        const otp = crypto.randomInt(100000, 999999).toString();
        const expiry = Date.now() + 10 * 60 * 1000;

        const otpKey = `${voter._id}-${electionId}`;
        console.log(`Storing OTP with key: ${otpKey}, OTP: ${otp}`);
        otpStore.set(otpKey, {
            otp,
            expiry,
            voterId: voter._id,
            electionId,
            candidateId
        });

        const sendEmail = require('../utils/email');

        console.log(`OTP for ${voter.email}: ${otp}`);

        try {
            await sendEmail(
                voter.email,
                'Your Voting OTP',
                `Your OTP for voting in election "${election.title}" is: ${otp}. It expires in 10 minutes.`
            );
        } catch (emailError) {
            console.error('Failed to send OTP email:', emailError);
            return res.status(500).json({ success: false, message: 'Failed to send OTP email' });
        }

        res.json({ 
            success: true, 
            message: 'OTP generated and sent successfully', 
            otpSent: true
        });

    } catch (error) {
        console.error('Request OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Cast a vote
router.post('/cast', auth, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ success: false, message: 'Only students can vote' });
        }

        const { electionId, candidateId, otp, transactionHash, walletAddress } = req.body;

        if (!electionId || !candidateId || !otp) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        if (!votingContract) {
            console.error('Voting contract is not initialized due to missing contract address');
            return res.status(500).json({ success: false, message: 'Voting contract not initialized' });
        }

        if (!isContractInitialized()) {
            return res.status(500).json({ success: false, message: 'Voting contract is not properly initialized' });
        }

        // Check if voting is open on the blockchain
        
        
        const otpKey = `${req.user.id}-${electionId}`;
        const storedOtpData = otpStore.get(otpKey);
        console.log(`Retrieving OTP with key: ${otpKey}`);
        if (!storedOtpData) {
            console.log('No OTP found for key:', otpKey);
            return res.status(400).json({ success: false, message: 'OTP not found or expired, please request a new one' });
        }

        console.log('Stored OTP:', storedOtpData.otp, 'Received OTP:', otp);
        if (storedOtpData.otp.trim() !== otp.trim()) {
            console.log('OTP mismatch');
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        if (Date.now() > storedOtpData.expiry) {
            otpStore.delete(otpKey);
            return res.status(400).json({ success: false, message: 'OTP expired, please request a new one' });
        }

        if (storedOtpData.candidateId !== candidateId || storedOtpData.electionId !== electionId) {
            return res.status(400).json({ success: false, message: 'OTP was issued for a different election or candidate' });
        }

        const [election, candidate, voter] = await Promise.all([
            Election.findById(electionId),
            Candidate.findById(candidateId),
            Voter.findById(req.user.id)
        ]);

        if (!election) {
            return res.status(404).json({ success: false, message: 'Election not found' });
        }

        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        if (!voter) {
            return res.status(404).json({ success: false, message: 'Voter not found' });
        }

        if (election.status !== 'active') {
            return res.status(400).json({ success: false, message: 'This election is not active' });
        }

        const voterIndex = election.voters.findIndex(v => v.voter.toString() === voter._id.toString());

        if (voterIndex >= 0 && election.voters[voterIndex].hasVoted) {
            return res.status(400).json({ success: false, message: 'You have already voted in this election' });
        }

        if (voterIndex >= 0) {
            election.voters[voterIndex].hasVoted = true;
            election.voters[voterIndex].votedAt = new Date();
            election.voters[voterIndex].transactionHash = transactionHash || 'simulated-tx-hash';
        } else {
            election.voters.push({
                voter: voter._id,
                hasVoted: true,
                votedAt: new Date(),
                transactionHash: transactionHash || 'simulated-tx-hash'
            });
        }

        candidate.voteCount += 1;

        await Promise.all([
            election.save(),
            candidate.save()
        ]);

        otpStore.delete(otpKey);

        res.json({
            success: true,
            message: 'Vote cast successfully',
            voteRecorded: true,
            transactionHash: transactionHash || 'simulated-tx-hash'
        });

    } catch (error) {
        console.error('Cast vote error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

router.get('/history', auth, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const voter = await Voter.findById(req.user.id);
        if (!voter) {
            return res.status(404).json({ success: false, message: 'Voter not found' });
        }

        // Find elections where the voter has voted
        const elections = await Election.find({ 'voters.voter': voter._id, 'voters.hasVoted': true })
            .select('title voters')
            .lean();

        // Build voting history
        const votingHistory = [];

        elections.forEach(election => {
            const voterRecord = election.voters.find(v => v.voter.toString() === voter._id.toString() && v.hasVoted);
            if (voterRecord) {
                votingHistory.push({
                    electionId: election._id,
                    electionTitle: election.title,
                    timestamp: voterRecord.votedAt,
                    verified: true, // Assuming verified if voted
                    transactionHash: voterRecord.transactionHash || null
                });
            }
        });

        res.json({ success: true, votingHistory });
    } catch (error) {
        console.error('Get voting history error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

module.exports = router;
