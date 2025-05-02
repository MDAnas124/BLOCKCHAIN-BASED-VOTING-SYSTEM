let web3;
let currentElection;
let selectedCandidate;
let candidateIdMap = {}; // Map from string _id to numeric contract candidateId (index)

// Parse electionId from URL
function getElectionId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('electionId');
}

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Authenticate user
    try {
        const response = await fetch(`${window.API_CONFIG.API_URL}/auth/me`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!response.ok) throw new Error('Authentication failed');
        const user = await response.json();
        if (user.role !== 'student') {
            window.location.href = 'login.html';
            return;
        }
    } catch (error) {
        window.location.href = 'login.html';
        return;
    }

    // Initialize Web3
    if (typeof window.ethereum !== 'undefined') {
        web3 = new Web3(window.ethereum);
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
        } catch (error) {
            showError('MetaMask connection required');
            return;
        }
    } else {
        showError('Please install MetaMask!');
        return;
    }

    // Load election and candidates
    const electionId = getElectionId();
    if (!electionId) {
        showError('No election selected');
        return;
    }
    loadCandidates(electionId);

    // Event listeners
    document.getElementById('candidateList').addEventListener('change', (e) => {
        if (e.target.type === 'radio') {
            selectedCandidate = e.target.value;
        }
    });
    document.getElementById('requestOtpBtn').addEventListener('click', requestOtp);
    document.getElementById('submitVoteBtn').addEventListener('click', castVote);
});

async function loadCandidates(electionId) {
    document.getElementById('candidateList').innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div><p>Loading candidates...</p></div>';
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${window.API_CONFIG.API_URL}/elections/${electionId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!response.ok) {
            showError('Failed to fetch election details');
            return;
        }

        let data;
        try {
            data = await response.json();
        } catch (e) {
            showError('Server returned invalid data');
            return;
        }

        document.getElementById('electionInfo').innerHTML = 
            '<h4>' + (data.title || 'Election') + '</h4>' +
            '<p class="text-muted">' + (data.description || '') + '</p>' +
            '<p><small>Ends: ' + new Date(data.endDate).toLocaleString() + '</small></p>';

        const candidates = Array.isArray(data.candidates) ? data.candidates : (Array.isArray(data) ? data : []);
        
        if (!candidates.length) {
            document.getElementById('candidateList').innerHTML = '<div class="alert alert-warning">No candidates available for this election</div>';
            return;
        }

        candidateIdMap = {}; // reset map
        let candidatesHtml = '<div class="list-group">';
        candidates.forEach((candidate, index) => {
            let candidateData = candidate;
            if (candidate.candidate && typeof candidate.candidate === 'object') {
                candidateData = candidate.candidate;
            }
            candidateIdMap[candidateData._id] = index + 1;
            
            candidatesHtml += 
                '<label class="list-group-item list-group-item-action">' +
                    '<input class="form-check-input me-2" type="radio" name="candidate" value="' + (candidateData._id || candidate._id) + '">' +
                    '<div>' +
                        '<h6>' + (candidateData.name || 'Unknown Candidate') + '</h6>' +
                        '<p class="mb-1">' + (candidateData.description || 'No description') + '</p>' +
                        '<small class="text-muted">Department: ' + (candidateData.department || 'N/A') + '</small>' +
                    '</div>' +
                '</label>';
        });
        candidatesHtml += '</div>';
        document.getElementById('candidateList').innerHTML = candidatesHtml;
    } catch (error) {
        console.error('Error loading candidates:', error);
        showError('Failed to load candidates');
    }
}

function showError(message) {
    document.getElementById('voteStatus').innerHTML = '<div class="alert alert-danger">' + message + '</div>';
}

function showSuccess(message) {
    document.getElementById('voteStatus').innerHTML = '<div class="alert alert-success">' + message + '</div>';
}

function requestOtp() {
    const token = localStorage.getItem('token');
    const electionId = getElectionId();
    if (!electionId || !token) {
        showError('Election or user token missing');
        return;
    }

    fetch(`${window.API_CONFIG.API_URL}/votes/request-otp`, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ electionId: electionId, candidateId: selectedCandidate })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showSuccess('OTP sent to your registered email/mobile.');
            document.getElementById('otpSection').style.display = 'block';
        } else {
            showError('Failed to send OTP');
        }
    })
    .catch(error => {
        showError('Error requesting OTP');
    });
}

async function castVote() {
    if (!selectedCandidate) {
        showError('Please select a candidate');
        return;
    }

    const otp = document.getElementById('otpInput').value.trim();
    if (!otp) {
        showError('Please enter the OTP');
        return;
    }

    const accounts = await web3.eth.getAccounts();
    if (accounts.length === 0) {
        showError('Please connect MetaMask');
        return;
    }

    const account = accounts[0];
    const electionId = getElectionId();

    const numericCandidateId = candidateIdMap[selectedCandidate];
    if (numericCandidateId === undefined) {
        showError('Invalid candidate selected');
        return;
    }

    if (!window.CONTRACT_ABI || !window.CONTRACT_ADDRESS) {
        showError('Smart contract details missing');
        return;
    }

    try {
        const contract = new web3.eth.Contract(window.CONTRACT_ABI, window.CONTRACT_ADDRESS);

        const receipt = await contract.methods.vote(numericCandidateId)
            .send({ from: account, gas: 300000 }) // Added explicit gas limit to avoid out of gas errors
            .on('transactionHash', (hash) => {
                console.log('Transaction sent, hash:', hash);
            })
            .on('receipt', (receipt) => {
                console.log('Transaction confirmed:', receipt);
            })
            .on('error', (error) => {
                console.error('Transaction error:', error);
                if (error.message && error.message.includes('gas')) {
                    showError('Transaction failed due to gas issues. Please ensure you have enough ETH for gas.');
                } else {
                    showError('Blockchain transaction failed: ' + (error.message || 'Unknown error'));
                }
                throw error;
            });

        const transactionHash = receipt.transactionHash;

        // Send vote details to backend
        const token = localStorage.getItem('token');
        const response = await fetch(`${window.API_CONFIG.API_URL}/votes/cast`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                electionId: electionId,
                candidateId: selectedCandidate,
                otp: otp,
                transactionHash: transactionHash,
                walletAddress: account
            })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('Your vote has been cast successfully!');
            document.getElementById('otpSection').style.display = 'none';
            document.getElementById('otpInput').value = '';
        } else {
            showError(data.message || 'Failed to cast vote');
        }
    } catch (error) {
        console.error('Blockchain transaction failed:', error);
        if (error && error.message) {
            showError('Blockchain transaction failed: ' + error.message);
        } else {
            showError('Failed to cast vote on the blockchain');
        }
    }
}
