let selectedRole = '';

function selectRole(role) {
    selectedRole = role;
    // Update UI
    document.querySelectorAll('.role-selector').forEach(el => {
        el.classList.remove('active');
    });
    document.getElementById(`${role}-role`).classList.add('active');
}

function showMessage(message, isError = false) {
    const modalEl = document.getElementById('messageModal');
    const messageEl = document.getElementById('modalMessage');
    messageEl.textContent = message;
    messageEl.className = isError ? 'text-danger' : 'text-success';
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const roleSelect = document.getElementById('role');
    const messageDiv = document.getElementById('message');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Connect to MetaMask
        if (typeof window.ethereum === 'undefined') {
            showMessage('MetaMask is not installed. Please install MetaMask to continue.', 'error');
            return;
        }

        let accounts;
        try {
            accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        } catch (error) {
            showMessage('MetaMask connection denied. Please connect your wallet.', 'error');
            return;
        }

        if (!accounts || accounts.length === 0) {
            showMessage('No MetaMask account found. Please connect your wallet.', 'error');
            return;
        }

        // 2. Proceed with normal login
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const role = roleSelect.value;
        const walletAddress = accounts[0];

        try {
            const response = await fetch(`${window.API_CONFIG.API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password,
                    role,
                    walletAddress
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Store user data
                localStorage.setItem('token', data.token);
                localStorage.setItem('userRole', data.user.role);
                localStorage.setItem('userData', JSON.stringify(data.user));
                
                showMessage('Login successful! Redirecting...', false);
                
                // Redirect based on role
                setTimeout(() => {
                    if (data.user.role === 'admin') {
                        window.location.href = './admin-dashboard.html';
                    } else {
                        window.location.href = './student-dashboard.html';
                    }
                }, 1500);
            } else {
                showMessage(data.message || 'Login failed', true);
            }
        } catch (error) {
            showMessage('Login failed. Please try again.', true);
        }
    });

    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = `alert alert-${type === 'success' ? 'success' : 'danger'}`;
        messageDiv.style.display = 'block';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }

    // Clear message when switching roles
    roleSelect.addEventListener('change', () => {
        messageDiv.style.display = 'none';
    });

    // Optionally, check if user is already logged in
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
});
