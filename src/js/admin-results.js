// Constants
const API_URL = 'http://localhost:3001/api';
const TOKEN_KEY = 'token';

// Utility to get query param
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Show alert
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
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            const bsAlert = new bootstrap.Alert(alertDiv);
            bsAlert.close();
        }
    }, type === 'danger' ? 8000 : 3000);
}

// Check Authentication
function checkAuth() {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRole = localStorage.getItem('userRole');
    
    if (!token || userRole !== 'admin') {
        window.location.href = 'login.html';
        return null;
    }
    return token;
}

// Fetch and display election results
async function loadResults() {
    const token = checkAuth();
    if (!token) return;

    const electionId = getQueryParam('electionId');
    if (!electionId) {
        showAlert('Election ID not specified', 'danger');
        return;
    }

    try {
        if (!electionId) {
            showAlert('Election ID not specified in URL', 'danger');
            return;
        }
        const response = await fetch(`${API_URL}/elections/${electionId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error response:', errorText);
            showAlert(`Failed to load election details: ${response.status} ${response.statusText}`, 'danger');
            return;
        }
        const data = await response.json();

        if (data.message) {
            showAlert(data.message || 'Failed to load election details', 'danger');
            return;
        }

        document.getElementById('electionTitle').textContent = `Results for: ${data.title}`;

        const tbody = document.getElementById('resultsTableBody');
        tbody.innerHTML = '';

        if (data.candidates && data.candidates.length > 0) {
            // Calculate total votes
            const totalVotes = data.candidates.reduce((sum, c) => sum + (c.voteCount || 0), 0) || 1; // avoid division by zero
            data.candidates.forEach(candidate => {
                const voteCount = candidate.voteCount || 0;
                const percentage = ((voteCount / totalVotes) * 100).toFixed(2);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${candidate.name}</td>
                    <td>${voteCount}</td>
                    <td>${percentage}%</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center">No candidates found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading results:', error);
        showAlert('Error loading election results', 'danger');
    }
}

// Back button handler
document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'admin-dashboard.html';
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadResults();
});
