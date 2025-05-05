// Constants
const apiUrlMeta = document.querySelector('meta[name="api-url"]');
const API_URL = apiUrlMeta ? apiUrlMeta.getAttribute('content') : '';
const FALLBACK_API_URL = ''; // No fallback URL defined currently
const TOKEN_KEY = 'token';

// DOM Elements
const statsElements = {
    activeElections: document.getElementById('activeElectionsCount'),
    registeredVoters: document.getElementById('registeredVotersCount'),
    totalCandidates: document.getElementById('totalCandidatesCount'),
    completedElections: document.getElementById('completedElectionsCount')
};

// Check Authentication
function checkAuth() {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRole = localStorage.getItem('userRole');
    
    if (!token || userRole !== 'admin') {
       //console.error('Authentication failed: Not logged in as admin');
        //window.location.href = '/login.html?error=unauthorized&redirect=' + encodeURIComponent(window.location.pathname);
        return null;
    }
    return token;
}

// Simplified API Calls with Authentication
async function apiCall(endpoint, method = 'GET', data = null) {
    try {
        console.log(`Calling API: ${API_URL}${endpoint}`);
        
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        // Only add token for authenticated endpoints
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Add body for non-GET requests
        if (method !== 'GET' && data) {
            options.body = JSON.stringify(data);
        }
        
        // Make request and log details
        console.log('API request details:', {
            url: `${API_URL}${endpoint}`,
            method,
            headers: options.headers,
            data: data ? JSON.stringify(data) : null
        });
        
        const response = await fetch(`${API_URL}${endpoint}`, options);
        console.log(`Response status: ${response.status}`);
        
        // Check if response is empty
        const responseText = await response.text();
        if (!responseText) {
            console.error('Empty response received');
            throw new Error('Server returned an empty response');
        }
        
        console.log('Response text:', responseText);
        
        // Try to parse JSON
        try {
            const result = JSON.parse(responseText);
            console.log('API response parsed:', result);
            
            if (!response.ok) {
                throw new Error(result.message || `API request failed with status ${response.status}`);
            }
            
            return result;
        } catch (jsonError) {
            console.error('JSON parsing error:', jsonError);
            console.error('Raw response:', responseText);
            
            // Provide more detailed error for debugging
            if (responseText.includes('<')) {
                throw new Error('Server returned HTML instead of JSON. Check server logs.');
            } else {
                throw new Error(`Failed to parse response: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`);
            }
        }
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        showAlert(error.message, 'danger');
        return null;
    }
}

// Initialize Dashboard
function initializeDashboard() {
    // Toggle sidebar
    document.getElementById('sidebarCollapse').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('active');
    });

    // Navigation
    document.querySelectorAll('#sidebar a[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = e.target.closest('a').dataset.section;
            showSection(sectionId);
        });
    });

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

    // Logout handlers
    ['logoutBtn', 'logoutDropdown'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                handleLogout();
            });
        }
    });
}

// Show section
function showSection(sectionId) {
    // Update active sidebar item
    document.querySelectorAll('#sidebar li').forEach(item => {
        item.classList.remove('active');
    });
    const activeLink = document.querySelector(`#sidebar a[data-section="${sectionId}"]`);
    if (activeLink) {
        activeLink.closest('li').classList.add('active');
    }

    // Show active section
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

// Load Dashboard Stats
async function loadStats() {
    try {
        const token = checkAuth();
        if (!token) return;

        console.log('Fetching dashboard stats...');
        const stats = await apiCall('/elections/stats');
        console.log('Dashboard stats response:', stats);
        
        if (stats && stats.success) {
            // Update election stats
            statsElements.activeElections.textContent = stats.elections.active || 0;
            statsElements.completedElections.textContent = stats.elections.completed || 0;
            statsElements.registeredVoters.textContent = stats.voters.total || 0;
            
            // For candidates, fetch separately
            console.log('Fetching candidates stats...');
            const candidatesResult = await apiCall('/auth/candidates');
            console.log('Candidates response:', candidatesResult);
            
            if (candidatesResult && candidatesResult.success) {
                statsElements.totalCandidates.textContent = candidatesResult.candidates ? candidatesResult.candidates.length : 0;
            } else {
                statsElements.totalCandidates.textContent = 0;
                console.error('Failed to load candidates:', candidatesResult?.message || 'Unknown error');
            }
        } else {
            // Handle errors
            console.error('Failed to load stats:', stats?.message || 'Unknown error');
            Object.values(statsElements).forEach(el => {
                if (el) el.textContent = '?';
            });
        }
        
        // Always try to load upcoming elections
        await loadUpcomingElections();
    } catch (error) {
        console.error('Error loading stats:', error);
        showAlert('Error loading dashboard statistics', 'danger');
        
        // Set placeholders on error
        Object.values(statsElements).forEach(el => {
            if (el) el.textContent = '?';
        });
    }
}

// Load Upcoming Elections
async function loadUpcomingElections() {
    try {
        const token = checkAuth();
        if (!token) return;
        
        const now = new Date();
        const elections = await apiCall('/elections?status=active');
        console.log('Upcoming elections response:', elections);
        
        const upcomingContainer = document.getElementById('upcomingElections');
        upcomingContainer.innerHTML = '';
        
        if (elections && elections.length > 0) {
            // Filter for elections that haven't started yet or are currently active
            const upcomingElections = elections.filter(election => 
                new Date(election.endDate) > now
            ).sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
            .slice(0, 5); // Show only the next 5 upcoming elections
            
            if (upcomingElections.length > 0) {
                upcomingElections.forEach(election => {
                    const startDate = new Date(election.startDate);
                    const endDate = new Date(election.endDate);
                    const isActive = startDate <= now && endDate >= now;
                    
                    const item = document.createElement('div');
                    item.className = 'activity-item';
                    item.innerHTML = `
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <strong>${election.title}</strong>
                            <span class="badge bg-${isActive ? 'success' : 'primary'}">${isActive ? 'Active' : 'Upcoming'}</span>
                        </div>
                        <div>Department: ${election.department || 'All'}</div>
                        <div>${isActive ? 'Ends' : 'Starts'}: ${(isActive ? endDate : startDate).toLocaleString()}</div>
                    `;
                    upcomingContainer.appendChild(item);
                });
            } else {
                upcomingContainer.innerHTML = '<div class="activity-item">No upcoming elections</div>';
            }
        } else {
            upcomingContainer.innerHTML = '<div class="activity-item">No upcoming elections</div>';
        }
    } catch (error) {
        console.error('Error loading upcoming elections:', error);
        document.getElementById('upcomingElections').innerHTML = 
            '<div class="activity-item text-danger">Error loading upcoming elections</div>';
    }
}

// Load Elections
async function loadElections() {
    try {
        const elections = await apiCall('/elections');
        const tableBody = document.getElementById('electionsTableBody');
        tableBody.innerHTML = '';

        if (elections && elections.length > 0) {
            elections.forEach(election => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${election.title}</td>
                    <td>${election.department || 'All'}</td>
                    <td>${new Date(election.startDate).toLocaleString()}</td>
                    <td>${new Date(election.endDate).toLocaleString()}</td>
                    <td><span class="badge badge-${getStatusBadgeClass(election.status)}">${election.status}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="editElection('${election._id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteElection('${election._id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn btn-sm btn-info" onclick="viewResults('${election._id}')">
                            <i class="fas fa-chart-bar"></i>
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No elections found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading elections:', error);
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading elections</td></tr>';
    }
}

// Load All Voters
async function loadAllVoters() {
    try {
        const token = checkAuth();
        if (!token) return;
        
        const response = await apiCall('/auth/voters');
        console.log('All voters response:', response);
        
        const tableBody = document.getElementById('allVotersTableBody');
        tableBody.innerHTML = '';
        
        if (response && response.success && response.voters && response.voters.length > 0) {
            response.voters.forEach(voter => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${voter.firstName} ${voter.lastName}</td>
                    <td>${voter.studentId}</td>
                    <td>${voter.department}</td>
                    <td>
                        <span class="badge ${voter.isVerified ? 'bg-success' : 'bg-warning'}">
                            ${voter.isVerified ? 'Verified' : 'Pending'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="viewVoterDetails('${voter._id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${!voter.isVerified ? `
                        <button class="btn btn-sm btn-success" onclick="verifyVoter('${voter._id}', true)">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="verifyVoter('${voter._id}', false)">
                            <i class="fas fa-times"></i>
                        </button>
                        ` : ''}
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No voters found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading voters:', error);
        document.getElementById('allVotersTableBody').innerHTML = 
            '<tr><td colspan="5" class="text-center text-danger">Error loading voters</td></tr>';
    }
}

// Load Pending Verifications
async function loadPendingVerifications() {
    try {
        const token = checkAuth();
        if (!token) return;
        
        const response = await apiCall('/auth/voters/pending');
        console.log('Pending verifications response:', response);
        
        const tableBody = document.getElementById('pendingVotersTableBody');
        tableBody.innerHTML = '';
        
        if (response && response.success && response.pendingVoters && response.pendingVoters.length > 0) {
            response.pendingVoters.forEach(voter => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${voter.firstName} ${voter.lastName}</td>
                    <td>${voter.email}</td>
                    <td>${voter.studentId}</td>
                    <td>${voter.department}</td>
                    <td>
                        <button class="btn btn-sm btn-success" onclick="verifyVoter('${voter._id}', true)">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="verifyVoter('${voter._id}', false)">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No pending verifications</td></tr>';
        }
    } catch (error) {
        console.error('Error loading pending verifications:', error);
        document.getElementById('pendingVotersTableBody').innerHTML = 
            '<tr><td colspan="5" class="text-center text-danger">Error loading pending verifications</td></tr>';
    }
}

// Load Candidates
async function loadCandidates(pendingCandidates = null) {
    try {
        console.log('Loading candidates...');
        const token = checkAuth();
        if (!token) {
            console.error('Auth check failed in loadCandidates');
            return;
        }

        // Get candidates data
        if (!pendingCandidates) {
            // If not provided, fetch all candidates
            console.log('Fetching all candidates...');
            const result = await apiCall('/auth/candidates');
            console.log('Loaded candidates response:', result);
            
            if (!result || !result.success) {
                console.error('Failed to load candidates:', result);
                throw new Error('Failed to load candidates');
            }
            
            console.log('Candidates data to display:', result.candidates);
            // Process and display all candidates
            displayAllCandidates(result.candidates);
            
            // Also load pending candidates in a separate call
            console.log('Fetching pending candidates...');
            const pendingResult = await apiCall('/auth/candidates/pending');
            console.log('Loaded pending candidates:', pendingResult);
            
            if (pendingResult && pendingResult.success) {
                displayPendingCandidates(pendingResult.pendingCandidates || []);
            }
        } else {
            // If pending candidates provided directly, just display them
            displayPendingCandidates(pendingCandidates);
        }
    } catch (error) {
        console.error('Error loading candidates:', error);
        showAlert('Error loading candidates', 'danger');
    }
}

// Display all candidates
function displayAllCandidates(candidates) {
    console.log('Displaying candidates:', candidates);
    const tableBody = document.getElementById('approvedCandidatesTableBody');
    console.log('Target table body element:', tableBody);
    if (!tableBody) {
        console.error('Table body element not found: approvedCandidatesTableBody');
        return;
    }
    
    tableBody.innerHTML = '';
    
    if (candidates && candidates.length > 0) {
        console.log(`Adding ${candidates.length} candidates to table`);
        candidates.forEach(candidate => {
            console.log('Processing candidate:', candidate);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${candidate.name}</td>
                <td>${candidate.description || 'N/A'}</td>
                <td>${candidate.department}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="viewCandidateDetails('${candidate._id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCandidate('${candidate._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } else {
        console.log('No candidates to display');
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center">No candidates found</td></tr>';
    }
}

// Display pending candidates
function displayPendingCandidates(pendingCandidates) {
    const tableBody = document.getElementById('pendingCandidatesTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (pendingCandidates && pendingCandidates.length > 0) {
        pendingCandidates.forEach(candidate => {
            const row = document.createElement('tr');
                
            row.innerHTML = `
                <td>${candidate.name}</td>
                <td>${candidate.description || 'N/A'}</td>
                <td>${candidate.department}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="verifyCandidate('${candidate._id}', 'approved')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="verifyCandidate('${candidate._id}', 'rejected')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } else {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center">No pending candidates</td></tr>';
    }
}

// Load candidate creation form data
async function loadCandidateFormData() {
    try {
        const token = checkAuth();
        if (!token) return;

        // Load elections for the dropdown
        const elections = await apiCall('/elections');
        const electionSelect = document.getElementById('candidateElection');
        
        // Clear options except the first one
        while (electionSelect.options.length > 1) {
            electionSelect.remove(1);
        }
        
        if (elections && elections.length > 0) {
            // Sort elections by status and then by date
            const sortedElections = elections.sort((a, b) => {
                if (a.status === 'active' && b.status !== 'active') return -1;
                if (a.status !== 'active' && b.status === 'active') return 1;
                return new Date(a.startDate) - new Date(b.startDate);
            });
            
            sortedElections.forEach(election => {
                const option = document.createElement('option');
                option.value = election._id;
                option.textContent = `${election.title} (${election.status})`;  
                electionSelect.appendChild(option);
            });
        }
        
        // Load voters for the dropdown
        const response = await apiCall('/auth/voters');
        const voterSelect = document.getElementById('candidateVoter');
        
        // Clear options except the first one
        while (voterSelect.options.length > 1) {
            voterSelect.remove(1);
        }
        
        if (response && response.success && response.voters && response.voters.length > 0) {
            // Only include verified voters
            const verifiedVoters = response.voters.filter(voter => voter.isVerified);
            
            verifiedVoters.forEach(voter => {
                const option = document.createElement('option');
                option.value = voter._id;
                option.textContent = `${voter.firstName} ${voter.lastName} (${voter.studentId})`;
                voterSelect.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Error loading candidate form data:', error);
        showAlert('Error loading form data', 'danger');
    }
}

// Handle candidate creation
document.getElementById('createCandidateForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    try {
        const token = checkAuth();
        if (!token) return;
        
        const formData = new FormData(this);
        const candidateData = {
            name: formData.get('name'),
            description: formData.get('description'),
            electionId: formData.get('electionId'),
            department: formData.get('department'),
            manifesto: formData.get('manifesto')
        };
        
        // Add optional fields if provided
        const imageUrl = formData.get('imageUrl');
        if (imageUrl) candidateData.imageUrl = imageUrl;
        
        const voterId = formData.get('voterId');
        if (voterId) candidateData.voter = voterId;
        
        console.log('Creating candidate with data:', candidateData);
        
        const result = await apiCall('/auth/candidates', 'POST', candidateData);
        console.log('Create candidate response:', result);
        
        if (result && result.success) {
            showAlert('Candidate created successfully', 'success');
            
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createCandidateModal'));
            if (modal) modal.hide();
            
            // Reset the form
            this.reset();
            
            // Refresh the candidates list
            loadCandidates();
            
            // Refresh stats
            loadStats();
        } else {
            showAlert(result?.message || 'Failed to create candidate', 'danger');
        }
    } catch (error) {
        console.error('Error creating candidate:', error);
        showAlert('Error creating candidate: ' + (error.message || 'Unknown error'), 'danger');
    }
});

// Initialize modals with loading data
document.addEventListener('shown.bs.modal', function(event) {
    const modalId = event.target.id;
    
    if (modalId === 'createCandidateModal') {
        loadCandidateFormData();
    }
});

// Create Election
document.getElementById('createElectionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const electionData = {
        title: formData.get('title'),
        description: formData.get('description'),
        department: formData.get('department'),
        startDate: formData.get('startDate'),
        endDate: formData.get('endDate'),
        status: formData.get('status'),
        voterEligibility: formData.get('eligibility'),
        allowSelfNomination: formData.get('allowSelfNomination') === 'on'
    };

    try {
        console.log('Creating election with data:', electionData);
        const result = await apiCall('/elections', 'POST', electionData);
        if (result && result.success !== false) {
            showAlert('Election created successfully', 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('createElectionModal'));
            if (modal) modal.hide();
            e.target.reset();
            // Refresh data
            loadElections();
            loadStats();
            loadUpcomingElections();
        } else {
            showAlert(result.message || 'Failed to create election', 'danger');
        }
    } catch (error) {
        console.error('Error creating election:', error);
        showAlert('Failed to create election: ' + (error.message || 'Unknown error'), 'danger');
    }
});

// Edit Election
async function editElection(id) {
    try {
        const election = await apiCall(`/elections/${id}`);
        if (election) {
            document.getElementById('editElectionId').value = election._id;
            // Only allow editing status
            // Remove or hide other fields in the modal HTML accordingly
            document.getElementById('editStatus').value = election.status;

            const modal = new bootstrap.Modal(document.getElementById('editElectionModal'));
            modal.show();
        }
    } catch (error) {
        console.error('Error loading election for edit:', error);
        showAlert('Could not load election details', 'danger');
    }
}

document.getElementById('editElectionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const id = formData.get('id');
    const electionData = {
        status: formData.get('status')
    };

    try {
        const result = await apiCall(`/elections/${id}`, 'PUT', electionData);
        if (result) {
            showAlert('Election status updated successfully', 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('editElectionModal'));
            if (modal) modal.hide();
            loadElections();
            loadStats();
        }
    } catch (error) {
        console.error('Error updating election:', error);
    }
});

// Delete Election
async function deleteElection(id) {
    if (confirm('Are you sure you want to delete this election?')) {
        try {
            const result = await apiCall(`/elections/${id}`, 'DELETE');
            if (result) {
                showAlert('Election deleted successfully', 'success');
                loadElections();
                loadStats();
            }
        } catch (error) {
            console.error('Error deleting election:', error);
        }
    }
}

// View Election Results
function viewResults(id) {
    // Redirect to results page with election id as query param
    window.location.href = `admin-results.html?electionId=${id}`;
}

// Verify Voter
async function verifyVoter(id, approve) {
    try {
        const token = checkAuth();
        if (!token) return;
        
        console.log(`Verifying voter ${id}, approve: ${approve}`);
        const result = await apiCall(`/auth/voters/${id}/verify`, 'PUT', { approve });
        
        if (result && result.success) {
            showAlert(`Voter ${approve ? 'approved' : 'rejected'} successfully`, 'success');
            // Reload both voter lists
            loadAllVoters();
            loadPendingVerifications();
            // Also update stats
            loadStats();
        } else {
            showAlert(result?.message || 'Failed to verify voter', 'danger');
        }
    } catch (error) {
        console.error('Error verifying voter:', error);
        showAlert('Error verifying voter', 'danger');
    }
}

// Verify Candidate
async function verifyCandidate(id, status) {
    try {
        const token = checkAuth();
        if (!token) return;
        
        console.log(`Verifying candidate ${id}, status: ${status}`);
        const result = await apiCall(`/auth/candidates/${id}/verify`, 'PUT', { status });
        
        if (result && result.success) {
            showAlert(`Candidate ${status === 'approved' ? 'approved' : 'rejected'} successfully`, 'success');
            // Reload candidate lists
            loadCandidates();
            // Also update stats
            loadStats();
        } else {
            showAlert(result?.message || 'Failed to verify candidate', 'danger');
        }
    } catch (error) {
        console.error('Error verifying candidate:', error);
        showAlert('Error verifying candidate', 'danger');
    }
}

// View candidate details
function viewCandidateDetails(candidateId) {
    // Implement in the future for viewing detailed candidate information
    showAlert('Viewing candidate details: ' + candidateId, 'info');
    // You could open a modal with candidate details here
}

// Delete candidate
async function deleteCandidate(candidateId) {
    if (!confirm('Are you sure you want to delete this candidate?')) {
        return;
    }
    
    try {
        const token = checkAuth();
        if (!token) return;
        
        const result = await apiCall(`/auth/candidates/${candidateId}`, 'DELETE');
        if (result && result.success) {
            showAlert('Candidate deleted successfully', 'success');
            // Refresh candidates list
            loadCandidates();
            // Refresh stats
            loadStats();
        } else {
            showAlert(result?.message || 'Failed to delete candidate', 'danger');
        }
    } catch (error) {
        console.error('Error deleting candidate:', error);
        showAlert('Error deleting candidate', 'danger');
    }
}

// View voter details
function viewVoterDetails(voterId) {
    try {
        const token = checkAuth();
        if (!token) return;
        
        // Show basic info immediately
        showAlert('Viewing details for voter ID: ' + voterId, 'info');
        
        // In a real implementation, this would open a modal with detailed voter information
        // For now, we'll just show an alert with basic info
        // You could enhance this to fetch voter details and display them in a modal
        
        console.log('Viewing voter details:', voterId);
    } catch (error) {
        console.error('Error viewing voter details:', error);
        showAlert('Error viewing voter details', 'danger');
    }
}

// Utility Functions
function getStatusBadgeClass(status) {
    const classes = {
        pending: 'pending',
        active: 'active',
        completed: 'completed',
        cancelled: 'danger'
    };
    return classes[status] || 'secondary';
}

function formatDateForInput(dateString) {
    return new Date(dateString).toISOString().slice(0, 16);
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-4`;
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '50%';
    alertDiv.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    alertDiv.innerHTML = `
        <strong>${type === 'danger' ? 'Error:' : type === 'success' ? 'Success:' : 'Info:'}</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    
    // Auto dismiss after 8 seconds for errors, 3 seconds for others
    setTimeout(() => {
        if (alertDiv.parentNode) {
            const bsAlert = new bootstrap.Alert(alertDiv);
            bsAlert.close();
        }
    }, type === 'danger' ? 8000 : 3000);
}

// Logout Handler
function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('userRole');
    localStorage.removeItem('userData');
    window.location.href = '../login.html';
}

// Initialize with health check first
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Test server connectivity first
        console.log('Checking server connectivity...');
        const testResult = await fetch(`${API_URL}/test`)
            .then(res => res.json())
            .catch(err => {
                console.error('Connectivity test failed:', err);
                throw new Error('Cannot connect to server');
            });
        
        console.log('Server test response:', testResult);
        
        if (testResult && testResult.success) {
            console.log('Server connectivity confirmed');
            
            // Check if we have authentication
            const token = localStorage.getItem(TOKEN_KEY);
            if (!token) {
                console.log('No authentication token, redirecting to login');
                window.location.href = '../login.html';
                return;
            }
            
            // Initialize dashboard UI
            console.log('Starting dashboard initialization');
            initializeDashboard();
            
            // Load initial data with delays
            setTimeout(() => loadStats(), 500);
            setTimeout(() => loadElections(), 1000);
            setTimeout(() => loadCandidates(), 1200); 
            setTimeout(() => loadAllVoters(), 1300); 
            setTimeout(() => loadPendingVerifications(), 1500);
        } else {
            showAlert('Cannot connect to server', 'danger');
        }
    } catch (error) {
        console.error('Initialization error:', error);
        showAlert(`Server connection error: ${error.message}`, 'danger');
    }
});

// Auto-refresh data every 30 seconds
const refreshInterval = setInterval(() => {
    if (checkAuth()) {
        loadStats();
        loadElections();
        loadCandidates(); 
        loadAllVoters(); 
        
        try {
            loadPendingVerifications();
        } catch (error) {
            console.error('Error loading pending verifications:', error);
        }
    } else {
        clearInterval(refreshInterval);
    }
}, 30000);