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

// Helper function to make API requests with fallback
async function makeApiRequest(url, options) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        // Try fallback URL if main URL failed
        if (url.includes(window.API_CONFIG.API_URL)) {
            const fallbackUrl = url.replace(window.API_CONFIG.API_URL, window.API_CONFIG.FALLBACK_API_URL);
            console.log('Trying fallback URL:', fallbackUrl);
            const fallbackResponse = await fetch(fallbackUrl, options);
            if (!fallbackResponse.ok) {
                throw new Error(`Fallback request failed! status: ${fallbackResponse.status}`);
            }
            return await fallbackResponse.json();
        }
        throw error;
    }
}

async function handleRegistration(event) {
    event.preventDefault();

    // Check if API_CONFIG is available
    if (!window.API_CONFIG || !window.API_CONFIG.API_URL) {
        showMessage('Configuration error: API settings not found. Please refresh the page.', true);
        return;
    }

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

        const data = await makeApiRequest(`${window.API_CONFIG.API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

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
