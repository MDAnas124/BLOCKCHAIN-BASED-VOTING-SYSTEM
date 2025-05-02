const API_URL = window.API_CONFIG.API_URL;
const TOKEN_KEY = window.API_CONFIG.TOKEN_KEY;

let web3;
let currentElection;
let selectedCandidate;
let currentOtp = null;

// Centralized API call function with error handling and logging
async function apiCall(endpoint, method = 'GET', data = null) {
    try {
        console.log(`Calling API: ${API_URL}${endpoint}`);

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        if (method !== 'GET' && data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${API_URL}${endpoint}`, options);
        const responseText = await response.text();

        if (!responseText) {
            console.error('Empty response received');
            throw new Error('Server returned an empty response');
        }

        try {
            const result = JSON.parse(responseText);
            if (!response.ok) {
                throw new Error(result.message || `API request failed with status ${response.status}`);
            }
            return result;
        } catch (jsonError) {
            console.error('JSON parsing error:', jsonError);
            console.error('Raw response:', responseText);
            if (responseText.includes('<')) {
                throw new Error('Server returned HTML instead of JSON. Check server logs.');
            } else {
                throw new Error(`Failed to parse response: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`);
            }
        }
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        showError(error.message);
        return null;
    }
}

// Check authentication
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const user = await apiCall('/auth/me');
        if (!user || user.role !== 'student') {
            window.location.href = 'login.html';
            return;
        }

        const studentNameEl = document.getElementById('studentName');
        if (studentNameEl) {
            studentNameEl.textContent = `${user.firstName} ${user.lastName}`;
        }
        populateProfileData(user);

        initializeDashboard();
        await loadDashboardData();
        setupEventListeners();
        initializeWeb3();

    } catch (error) {
        console.error('Auth error:', error);
        //window.location.href = 'login.html';
    }
});

// Initialize Web3
async function initializeWeb3() {
    if (typeof window.ethereum !== 'undefined') {
        web3 = new Web3(window.ethereum);
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            updateWalletStatus(accounts[0]);
        } catch (error) {
            console.error('User denied account access');
            updateWalletStatus(null);
        }
    } else {
        console.log('Please install MetaMask!');
        updateWalletStatus(null);
    }
}

function initializeDashboard() {
    const sidebarCollapseEl = document.getElementById('sidebarCollapse');
    const sidebarEl = document.getElementById('sidebar');
    if (sidebarCollapseEl && sidebarEl) {
        sidebarCollapseEl.addEventListener('click', () => {
            sidebarEl.classList.toggle('active');
        });
    }

    const navLinks = document.querySelectorAll('#sidebar a[data-section]');
    if (navLinks) {
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = e.target.closest('a').dataset.section;
                showSection(sectionId);
            });
        });
    }

    // Add event listeners to buttons with data-section attribute (e.g., View Elections, View Results, View History)
    const buttons = document.querySelectorAll('a.btn[data-section]');
    if (buttons) {
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = button.dataset.section;
                showSection(sectionId);
            });
        });
    }

    ['logoutBtn', 'logoutDropdown'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                handleLogout();
            });
        }
    });
}

// Load Dashboard Data
async function loadDashboardData() {
    try {
        const electionsResponse = await apiCall('/elections?status=active');
        if (!electionsResponse) {
            throw new Error('Failed to load active elections');
        }

        // electionsResponse is expected to be an array of elections
        const elections = electionsResponse;

        console.log('Active Elections:', elections);

        updateDashboardStats(elections);
        updateActiveElections(elections);

        // Load voting history
        const votesResponse = await apiCall('/votes/history');
        if (votesResponse && votesResponse.success) {
            updateVotingHistory(votesResponse.votingHistory);
            // Update votes cast count
            const votesCastCountEl = document.getElementById('votesCastCount');
            if (votesCastCountEl) {
                votesCastCountEl.textContent = votesResponse.votingHistory.length;
            }
        } else {
            updateVotingHistory([]);
            const votesCastCountEl = document.getElementById('votesCastCount');
            if (votesCastCountEl) {
                votesCastCountEl.textContent = '0';
            }
        }

        // Load completed election results
        const resultsResponse = await apiCall('/elections/results');
        if (resultsResponse && resultsResponse.success) {
            updateResults(resultsResponse.data);
            // Update available results count
            const availableResultsCountEl = document.getElementById('availableResultsCount');
            if (availableResultsCountEl) {
                availableResultsCountEl.textContent = resultsResponse.data.length;
            }
        } else {
            updateResults([]);
            const availableResultsCountEl = document.getElementById('availableResultsCount');
            if (availableResultsCountEl) {
                availableResultsCountEl.textContent = '0';
            }
        }

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to load dashboard data');
    }
}

// Update Dashboard Stats
function updateDashboardStats(elections) {
    const activeElectionsCountEl = document.getElementById('activeElectionsCount');
    if (activeElectionsCountEl) {
        activeElectionsCountEl.textContent = Array.isArray(elections) ? elections.length : 0;
    }
}


// Update Active Elections
function updateActiveElections(elections) {
    const container = document.getElementById('activeElectionsList');
    container.innerHTML = '';

    if (elections.length === 0) {
        container.innerHTML = '<div class="col-12"><p class="text-muted">No active elections</p></div>';
        return;
    }

    elections.forEach(election => {
        const col = document.createElement('div');
        col.className = 'col-md-6 mb-4';
        col.innerHTML = `
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title">${election.title}</h5>
                    <p class="card-text">${election.description}</p>
                    <div class="progress mb-3">
                        <div class="progress-bar" role="progressbar" style="width: ${calculateProgress(election)}%"></div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">Ends: ${formatDate(election.endDate)}</small>
                        <a 
                            href="vote.html?electionId=${election._id}" 
                            class="btn btn-primary vote-now-btn"
                            ${election.hasVoted ? 'tabindex="-1" aria-disabled="true" disabled' : ''}
                        >
                            ${election.hasVoted ? 'Already Voted' : 'Vote Now'}
                        </a>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(col);
    });
}

    // Attach event listeners for vote now buttons
    setTimeout(() => {
        document.querySelectorAll('.vote-now-btn').forEach(btn => {
            if (!btn.disabled) {
                btn.addEventListener('click', function() {
                    const electionId = this.getAttribute('data-election-id');
                    if (electionId) {
                        openVotingModal(electionId);
                    } else {
                        showError('Invalid election.');
                    }
                });
            }
        });
    }, 0);


// Update Voting History
function updateVotingHistory(votes) {
    const tbody = document.getElementById('votingHistoryTable');
    tbody.innerHTML = '';

    if (!Array.isArray(votes) || votes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center">No voting history</td>
            </tr>
        `;
        return;
    }

    votes.forEach(vote => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${vote.electionTitle || 'Unknown election'}</td>
            <td>${formatDate(vote.timestamp || vote.votedAt)}</td>
            <td><span class="badge bg-${vote.verified ? 'success' : 'warning'}">
                ${vote.verified ? 'Verified' : 'Pending'}
            </span></td>
            <td>
                <a href="https://etherscan.io/tx/${vote.transactionHash}" target="_blank" class="btn btn-sm btn-outline-info">
                    <i class="fas fa-external-link-alt"></i> View Transaction
                </a>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Update Results
function updateResults(results) {
    const container = document.getElementById('electionResultsList');
    container.innerHTML = '';

    if (!Array.isArray(results) || results.length === 0) {
        container.innerHTML = '<p class="text-muted">No election results available</p>';
        return;
    }

    results.forEach(election => {
        const card = document.createElement('div');
        card.className = 'card mb-4';
        
        // Create the header
        let cardHtml = `
            <div class="card-header bg-light">
                <h5 class="mb-0">${election.title || 'Election Results'}</h5>
                <div class="text-muted small">Ended: ${formatDate(election.endDate)}</div>
            </div>
            <div class="card-body">
                <p class="text-muted">Total Votes: ${election.totalVotes || 0}</p>
                <div class="results-list">
        `;
        
        // Add candidates
        if (Array.isArray(election.candidates) && election.candidates.length > 0) {
            election.candidates.forEach((candidate, index) => {
                cardHtml += `
                    <div class="result-item ${index === 0 ? 'winner' : ''}">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h6>${candidate.name}</h6>
                                <small class="text-muted">${candidate.department || ''}</small>
                            </div>
                            <div class="vote-count">
                                <span class="badge bg-${index === 0 ? 'success' : 'secondary'}">
                                    ${candidate.voteCount} votes (${candidate.percentage}%)
                                </span>
                            </div>
                        </div>
                        <div class="progress mt-1">
                            <div class="progress-bar ${index === 0 ? 'bg-success' : ''}" 
                                role="progressbar" style="width: ${candidate.percentage}%"></div>
                        </div>
                    </div>
                `;
            });
        } else {
            cardHtml += '<p class="text-muted">No candidate information available</p>';
        }
        
        cardHtml += `
                </div>
            </div>
        `;
        
        card.innerHTML = cardHtml;
        container.appendChild(card);
    });
}

// Open voting modal with candidates list
async function openVotingModal(electionId) {
    try {
        document.getElementById('candidateList').innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div><p>Loading candidates...</p></div>';

        currentElection = electionId;
        selectedCandidate = null;
        currentOtp = null;

        // Get candidates for this election
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:3001/api/elections/${electionId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch election details');
        }

        const election = await response.json();
        if (!election || !election.candidates || election.candidates.length === 0) {
            document.getElementById('candidateList').innerHTML = '<div class="alert alert-warning">No candidates available for this election</div>';
            return;
        }

        // Display candidates as radio buttons
        let candidatesHtml = '<div class="list-group">';
        election.candidates.forEach(candidate => {
            candidatesHtml += `
                <label class="list-group-item list-group-item-action">
                    <input class="form-check-input me-2" type="radio" name="candidate" value="${candidate._id}">
                    <div>
                        <h6>${candidate.name}</h6>
                        <p class="mb-1">${candidate.description || ''}</p>
                        <small class="text-muted">Department: ${candidate.department || 'N/A'}</small>
                    </div>
                </label>
            `;
        });
        candidatesHtml += '</div>';
        document.getElementById('candidateList').innerHTML = candidatesHtml;

        // Show modal
        const voteModal = new bootstrap.Modal(document.getElementById('votingModal'));
        voteModal.show();
    } catch (error) {
        console.error('Error opening voting modal:', error);
        showError('Failed to load candidates');
    }
}

// Handle selection of candidate and proceed to OTP step
function handleSelectCandidate() {
    const selectedRadio = document.querySelector('input[name="candidate"]:checked');
    if (!selectedRadio) {
        showError('Please select a candidate');
        return;
    }
    
    selectedCandidate = selectedRadio.value;
    const candidateName = selectedRadio.closest('label').querySelector('h6').textContent;
    document.getElementById('selectedCandidateName').textContent = candidateName;
    
    // Request OTP
    requestOtp();
}

// Request OTP for verification
async function requestOtp() {
    try {
        document.getElementById('selectCandidateBtn').innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Sending OTP...';
        document.getElementById('selectCandidateBtn').disabled = true;
        
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3001/api/votes/request-otp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                electionId: currentElection,
                candidateId: selectedCandidate
            })
        });
        
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to send OTP');
        }
        
        // In development mode, show the OTP
        if (data.otp) {
            currentOtp = data.otp;
            document.getElementById('otpMessage').innerHTML = `An OTP has been sent to your registered email. <strong>(Development mode: ${data.otp})</strong>`;
        }
        
        // Move to step 2 (OTP verification)
        showVotingStep(2);
        
    } catch (error) {
        console.error('Error requesting OTP:', error);
        showError(error.message);
        document.getElementById('selectCandidateBtn').innerHTML = 'Continue';
        document.getElementById('selectCandidateBtn').disabled = false;
    }
}

// Verify OTP and proceed to confirmation step
async function verifyOtp() {
    const otpInput = document.getElementById('otpInput').value.trim();
    if (!otpInput) {
        showError('Please enter the OTP');
        return;
    }
    
    try {
        document.getElementById('verifyOtpBtn').innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Verifying...';
        document.getElementById('verifyOtpBtn').disabled = true;
        
        // In development mode, just verify against the stored OTP
        if (currentOtp && otpInput === currentOtp) {
            // Move to step 3 (Transaction confirmation)
            showVotingStep(3);
            return;
        }
        
        // If we don't have a local OTP to compare (production), we'll verify on the server side during cast vote
        showVotingStep(3);
        
    } catch (error) {
        console.error('Error verifying OTP:', error);
        showError(error.message);
        document.getElementById('verifyOtpBtn').innerHTML = 'Verify OTP';
        document.getElementById('verifyOtpBtn').disabled = false;
    }
}

// Cast the vote
async function castVote() {
    const otpInput = document.getElementById('otpInput').value.trim();
    if (!otpInput) {
        showError('Please enter the OTP');
        return;
    }
    
    try {
        // Step 1: Check if wallet is connected
        const accounts = await web3.eth.getAccounts();
        if (accounts.length === 0) {
            throw new Error('Please connect your wallet');
        }
        
        // Show loading state
        document.getElementById('confirmVoteBtn').innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Processing...';
        document.getElementById('confirmVoteBtn').disabled = true;
        document.getElementById('transactionStatus').innerHTML = '<div class="alert alert-info">Initiating blockchain transaction...</div>';
        
        // Step 2: Initiate MetaMask transaction
        document.getElementById('transactionStatus').innerHTML = '<div class="alert alert-warning">Please confirm the transaction in MetaMask...</div>';
        
        // Calculate gas estimate (example)
        const gasPrice = await web3.eth.getGasPrice();
        const gasEstimate = 21000; // Basic transaction
        
        // This would be your actual voting contract interaction
        // For now, we'll simulate a transaction with a small ETH transfer
        const txHash = await web3.eth.sendTransaction({
            from: accounts[0],
            to: accounts[0], // Sending to self as a placeholder
            value: web3.utils.toWei('0', 'ether'), // 0 ETH
            gas: gasEstimate,
            gasPrice: gasPrice
        });
        
        console.log('Transaction hash:', txHash);
        document.getElementById('transactionStatus').innerHTML = '<div class="alert alert-success">Transaction confirmed! Recording your vote...</div>';
        
        // Step 3: Record vote on server
        const response = await fetch('http://localhost:3001/api/votes/cast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                electionId: currentElection,
                candidateId: selectedCandidate,
                otp: otpInput,
                transactionHash: txHash.transactionHash || txHash,
                walletAddress: accounts[0]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to cast vote');
        }

        const voteData = await response.json();
        if (!voteData.success) {
            throw new Error(voteData.message || 'Vote was not recorded');
        }

        // Close the modal and show success message
        const modal = bootstrap.Modal.getInstance(document.getElementById('votingModal'));
        modal.hide();
        showSuccess('Vote cast successfully! Your vote has been recorded on the blockchain.');
        
        // Refresh dashboard data
        loadDashboardData();

    } catch (error) {
        console.error('Error casting vote:', error);
        showError(error.message);
        document.getElementById('transactionStatus').innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
        document.getElementById('confirmVoteBtn').innerHTML = 'Try Again';
        document.getElementById('confirmVoteBtn').disabled = false;
    }
}

// Helper function to show specific voting step
function showVotingStep(step) {
    // Disable all steps first
    document.querySelectorAll('#votingSteps .nav-link').forEach(el => {
        el.classList.remove('active');
        el.classList.add('disabled');
    });
    
    document.querySelectorAll('.tab-pane').forEach(el => {
        el.classList.remove('show', 'active');
    });
    
    // Enable and activate the current step
    const currentTab = document.getElementById(`step${step}-tab`);
    currentTab.classList.remove('disabled');
    currentTab.classList.add('active');
    
    const currentPane = document.getElementById(`step${step}`);
    currentPane.classList.add('show', 'active');
}

// Utility Functions
function updateWalletStatus(address) {
    const statusEl = document.getElementById('walletStatus');
    if (address) {
        statusEl.innerHTML = `<i class="fas fa-wallet"></i> ${address.substring(0, 6)}...${address.substring(38)}`;
        statusEl.className = 'text-success';
    } else {
        statusEl.innerHTML = `<i class="fas fa-wallet"></i> Not Connected`;
        statusEl.className = 'text-danger';
    }
}

function showSection(sectionId) {
    document.querySelectorAll('#sidebar li').forEach(item => {
        item.classList.remove('active');
    });
    const activeLink = document.querySelector(`#sidebar a[data-section="${sectionId}"]`);
    if (activeLink) {
        activeLink.closest('li').classList.add('active');
    }

    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

function calculateProgress(election) {
    const total = new Date(election.endDate) - new Date(election.startDate);
    const elapsed = Date.now() - new Date(election.startDate);
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

function formatDate(date) {
    return new Date(date).toLocaleString();
}

function showSuccess(message) {
    // Implement toast or alert for success message
    alert(message);
}

function showError(message) {
    // Implement toast or alert for error message
    alert(message);
}

function populateProfileData(user) {
    document.getElementById('studentId').value = user.studentId;
    document.getElementById('fullName').value = `${user.firstName} ${user.lastName}`;
    document.getElementById('email').value = user.email;
    document.getElementById('department').value = user.department;
    document.getElementById('walletAddress').value = user.walletAddress;
}

async function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = 'login.html';
}

// Setup Event Listeners
function setupEventListeners() {
    // Connect wallet button
    document.getElementById('connectWallet').addEventListener('click', initializeWeb3);

    // Password change form
    document.getElementById('passwordForm').addEventListener('submit', handlePasswordChange);

    // Voting modal
    document.getElementById('candidateList').addEventListener('change', (e) => {
        if (e.target.type === 'radio') {
            selectedCandidate = e.target.value;
        }
    });

    document.getElementById('selectCandidateBtn').addEventListener('click', handleSelectCandidate);
    document.getElementById('verifyOtpBtn').addEventListener('click', verifyOtp);
    document.getElementById('confirmVoteBtn').addEventListener('click', castVote);
    
    // Back buttons
    document.getElementById('backToStep1Btn').addEventListener('click', () => showVotingStep(1));
    document.getElementById('backToStep2Btn').addEventListener('click', () => showVotingStep(2));
}

// Handle password change
async function handlePasswordChange(event) {
    event.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        showError('New passwords do not match');
        return;
    }

    try {
        const response = await fetch('http://localhost:3001/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });

        if (!response.ok) {
            throw new Error('Failed to change password');
        }

        showSuccess('Password changed successfully');
        event.target.reset();

    } catch (error) {
        console.error('Error changing password:', error);
        showError(error.message);
    }
}

// Create result chart
function createResultChart(result) {
    // Implement chart creation using a charting library of your choice
    // For example, you can use Chart.js or Google Charts
    console.log('Create chart for:', result);
}
