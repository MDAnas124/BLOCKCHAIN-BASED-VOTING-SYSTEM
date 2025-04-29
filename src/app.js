let web3;
let contract;
let userAccount;
let isAdmin = false;

const API_URL = 'http://localhost:3001/api';

async function showSuccess(message) {
    document.getElementById('success-message').textContent = message;
    const modal = new bootstrap.Modal(document.getElementById('successModal'));
    modal.show();
}

async function checkNetwork() {
    try {
        const networkId = await web3.eth.net.getId();
        console.log('Current network ID:', networkId);
        if (networkId !== 1337) {
            throw new Error('Please connect to Ganache network (Network ID: 1337)');
        }
    } catch (error) {
        console.error('Network check error:', error);
        throw error;
    }
}

async function initContract() {
    try {
        if (!window.CONTRACT_ABI || !window.CONTRACT_ADDRESS) {
            throw new Error('Contract configuration not found');
        }
        console.log('Initializing contract with address:', window.CONTRACT_ADDRESS);
        
        contract = new web3.eth.Contract(
            window.CONTRACT_ABI,
            window.CONTRACT_ADDRESS
        );
        return true;
    } catch (error) {
        console.error('Contract initialization error:', error);
        throw error;
    }
}

async function updateVotingStatus() {
    try {
        const isOpen = await contract.methods.getVotingStatus().call();
        const statusBadge = document.getElementById('voting-status');
        const toggleBtn = document.getElementById('toggle-voting');
        
        statusBadge.className = `badge ${isOpen ? 'bg-success' : 'bg-warning'}`;
        statusBadge.textContent = isOpen ? 'Voting Open' : 'Voting Closed';
        
        if (isAdmin) {
            toggleBtn.disabled = false;
            toggleBtn.textContent = isOpen ? 'Stop Voting' : 'Start Voting';
        }
    } catch (error) {
        console.error('Error updating voting status:', error);
    }
}

async function loadCandidates() {
    try {
        const container = document.getElementById('candidates-container');
        container.innerHTML = '';
        
        const count = await contract.methods.candidatesCount().call();
        for (let i = 1; i <= count; i++) {
            const candidate = await contract.methods.getCandidate(i).call();
            const hasVoted = await contract.methods.hasVoted(userAccount).call();
            
            const col = document.createElement('div');
            col.className = 'col-md-4 mb-4';
            col.innerHTML = `
                <div class="card candidate-card h-100">
                    <div class="card-body">
                        <h5 class="card-title">${candidate.name}</h5>
                        <p class="card-text">Votes: ${candidate.voteCount}</p>
                        <button onclick="castVote(${candidate.id})" 
                                class="btn btn-primary vote-btn" 
                                ${hasVoted ? 'disabled' : ''}>
                            Vote
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(col);
        }
    } catch (error) {
        console.error('Error loading candidates:', error);
    }
}

async function registerVoter(event) {
    event.preventDefault();
    
    const name = document.getElementById('voter-name').value;
    const nationalId = document.getElementById('national-id').value;
    
    try {
        const response = await fetch(`${API_URL}/voters/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: userAccount,
                name,
                nationalId
            })
        });
        
        if (!response.ok) {
            throw new Error('Registration failed');
        }
        
        const data = await response.json();
        showSuccess('Registration successful! Please wait for verification.');
        document.getElementById('registration-form').reset();
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed: ' + error.message);
    }
}

async function castVote(candidateId) {
    try {
        const response = await fetch(`${API_URL}/voters/verify/${userAccount}`);
        const data = await response.json();
        
        if (!data.isVerified) {
            alert('You must be verified to vote');
            return;
        }
        
        await contract.methods.vote(candidateId).send({ from: userAccount });
        showSuccess('Vote cast successfully!');
        await loadCandidates();
    } catch (error) {
        console.error('Voting error:', error);
        alert('Error casting vote: ' + error.message);
    }
}

async function toggleVoting() {
    try {
        const isOpen = await contract.methods.getVotingStatus().call();
        if (isOpen) {
            await contract.methods.stopVoting().send({ from: userAccount });
        } else {
            await contract.methods.startVoting().send({ from: userAccount });
        }
        await updateVotingStatus();
    } catch (error) {
        console.error('Error toggling voting status:', error);
        alert('Error: ' + error.message);
    }
}

async function initWeb3() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            web3 = new Web3(window.ethereum);
            userAccount = accounts[0];
            
            document.getElementById('wallet-address').textContent = 
                userAccount.slice(0, 6) + '...' + userAccount.slice(-4);
            
            await checkNetwork();
            await initContract();
            
            // Check if user is admin
            const admin = await contract.methods.admin().call();
            isAdmin = admin.toLowerCase() === userAccount.toLowerCase();
            
            if (isAdmin) {
                document.getElementById('toggle-voting').style.display = 'block';
            }
            
            await updateVotingStatus();
            await loadCandidates();
            
            return true;
        } catch (error) {
            console.error('Web3 initialization error:', error);
            alert('Failed to connect: ' + error.message);
            return false;
        }
    } else {
        alert('Please install MetaMask');
        return false;
    }
}

// Event Listeners
document.getElementById('connect-wallet').addEventListener('click', initWeb3);
document.getElementById('registration-form').addEventListener('submit', registerVoter);
document.getElementById('toggle-voting').addEventListener('click', toggleVoting);

// Listen for network changes
if (window.ethereum) {
    window.ethereum.on('chainChanged', () => {
        window.location.reload();
    });
    
    window.ethereum.on('accountsChanged', async (accounts) => {
        userAccount = accounts[0];
        await initWeb3();
    });
}
