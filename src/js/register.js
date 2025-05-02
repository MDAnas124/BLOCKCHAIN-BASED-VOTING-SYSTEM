let web3;

function showMessage(message, isError = false) {
    const modalEl = document.getElementById('messageModal');
    const messageEl = document.getElementById('modalMessage');
    messageEl.textContent = message;
    messageEl.className = isError ? 'text-danger' : 'text-success';
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            web3 = new Web3(window.ethereum);
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            document.getElementById('walletAddress').value = accounts[0];
            return accounts[0];
        } catch (error) {
            console.error('Error connecting wallet:', error);
            showMessage('Failed to connect wallet. Please try again.', true);
            return null;
        }
    } else {
        showMessage('MetaMask is not installed. Please install it to continue.', true);
        return null;
    }
}

document.getElementById('connectWallet').addEventListener('click', connectWallet);

async function handleRegistration(event) {
    event.preventDefault();

    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        showMessage('Passwords do not match!', true);
        return;
    }

    const walletAddress = document.getElementById('walletAddress').value;
    if (!walletAddress) {
        showMessage('Please connect your wallet first!', true);
        return;
    }

    const formData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        studentId: document.getElementById('studentId').value,
        department: document.getElementById('department').value,
        password: password,
        walletAddress: walletAddress,
        role: document.getElementById('role').value || 'student'
    };

    try {
        // Sign message to verify wallet ownership
        const message = `Register for Blockchain Voting System\nRole: ${formData.role}\nEmail: ${formData.email}`;
        const signature = await web3.eth.personal.sign(message, walletAddress);
        formData.signature = signature;

        const apiUrl = window.API_CONFIG && window.API_CONFIG.API_URL ? window.API_CONFIG.API_URL : '';
        const response = await fetch(`${apiUrl}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            throw new Error(`Unexpected response from server: ${text.substring(0, 100)}`);
        }

        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        showMessage('Registration successful!', false);
        setTimeout(() => {
            window.location.href = formData.role === 'admin' ? 'admin-dashboard.html' : 'login.html';
        }, 2000);

    } catch (error) {
        console.error('Registration error:', error);
        showMessage(error.message || 'Registration failed. Please try again.', true);
    }
}

// Password strength validation
document.getElementById('password').addEventListener('input', function(e) {
    const password = e.target.value;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= 8;

    if (!(hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar && isLongEnough)) {
        e.target.setCustomValidity('Password must contain at least 8 characters, including uppercase, lowercase, numbers, and special characters.');
    } else {
        e.target.setCustomValidity('');
    }
});
