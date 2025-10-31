// ============== UTILITY FUNCTIONS ==============

// Show message (works for both login page and settings page)
function showMessage(message, type = 'error', elementId = null) {
    // Try to find message banner (for settings page)
    const banner = document.getElementById('message-banner');
    const bannerText = document.getElementById('banner-text');
    
    if (banner && bannerText) {
        bannerText.textContent = message;
        banner.className = `message-banner message-banner-${type}`;
        banner.style.display = 'block';
        setTimeout(() => banner.style.display = 'none', 5000);
        return;
    }
    
    // Fallback to specific error element (for login/register page)
    const errorElement = elementId ? document.getElementById(elementId) : 
                         document.getElementById('login-error') || 
                         document.getElementById('register-error');
    
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.className = type === 'success' ? 'success-message' : 'error-message';
        errorElement.style.display = 'block';
        
        // Only auto-hide error messages, keep success visible
        if (type === 'error') {
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
    }
}

// Hide all error messages
function hideAllErrors() {
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    if (loginError) loginError.style.display = 'none';
    if (registerError) registerError.style.display = 'none';
}

// ============== LOGIN & REGISTER ==============

// Toggle between login and register
document.getElementById("show-register")?.addEventListener("click", (e) => {
    e.preventDefault();
    hideAllErrors();
    document.getElementById("login-section").style.display = "none";
    document.getElementById("register-section").style.display = "block";
});

document.getElementById("show-login")?.addEventListener("click", (e) => {
    e.preventDefault();
    hideAllErrors();
    document.getElementById("register-section").style.display = "none";
    document.getElementById("login-section").style.display = "block";
});

// Login
document.getElementById("login-confirm")?.addEventListener("click", async () => {
    const credentials = document.getElementById("login-credentials").value.trim();
    const password = document.getElementById("login-password").value.trim();
    
    if (!credentials || !password) {
        showMessage("Please enter both username/email and password.", 'error', 'login-error');
        return;
    }

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credentials, password }),
        });
        const data = await response.json();
        
        if (response.ok) {
            showMessage(`Welcome back, ${data.user.username}!`, 'success', 'login-error');
            setTimeout(() => window.location.href = "/index", 1000);
        } else {
            showMessage(data.error, 'error', 'login-error');
        }
    } catch (err) {
        console.error("Login error:", err);
        showMessage("Login failed. Please try again.", 'error', 'login-error');
    }
});

// Register
document.getElementById("register-confirm")?.addEventListener("click", async () => {
    const credentials = document.getElementById("register-credentials").value.trim();
    const password = document.getElementById("register-password").value.trim();
    const confirmPassword = document.getElementById("register-confirm-password").value.trim();
    const name = document.getElementById("register-name").value.trim();
    const question_id = document.getElementById("security-question").value;
    const answer = document.getElementById("security-answer").value.trim();

    if (!credentials || !password || !confirmPassword || !name || !question_id || !answer) {
        showMessage("Please fill in all required fields.", 'error', 'register-error');
        return;
    }

    if (password !== confirmPassword) {
        showMessage("Passwords do not match.", 'error', 'register-error');
        return;
    }

    if (password.length < 6) {
        showMessage("Password must be at least 6 characters long.", 'error', 'register-error');
        return;
    }

    try {
        const isEmail = credentials.includes("@");
        const response = await fetch("/api/user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: credentials,
                email: isEmail ? credentials : null,
                name,
                password,
                security_answer: { question_id, answer }
            }),
        });
        const data = await response.json();
        
        if (response.ok) {
            showMessage(`Account created successfully! Welcome, ${data.name}!`, 'success', 'register-error');
            setTimeout(() => window.location.href = "/index", 1500);
        } else {
            showMessage(data.error, 'error', 'register-error');
        }
    } catch (err) {
        console.error("Registration error:", err);
        showMessage("Registration failed. Please try again.", 'error', 'register-error');
    }
});

// Load security questions for registration
document.addEventListener("DOMContentLoaded", async () => {
    const questionSelect = document.getElementById("security-question");
    const registerBtn = document.getElementById("register-confirm");
    
    if (questionSelect) {
        try {
            const response = await fetch("/api/security-questions");
            const questions = await response.json();
            questionSelect.innerHTML = '<option value="">Select a security question...</option>';
            questions.forEach(q => {
                const option = document.createElement("option");
                option.value = q.q_id;
                option.textContent = q.q_content;
                questionSelect.appendChild(option);
            });
            // Enable register button after questions are loaded
            if (registerBtn) registerBtn.disabled = false;
        } catch (err) {
            console.error("Failed to load security questions:", err);
            questionSelect.innerHTML = '<option value="">Failed to load questions</option>';
        }
    }

    // Load user data for settings page
    if (document.getElementById('display-name')) {
        loadUserData();
    }
});

// ============== ACCOUNT SETTINGS ==============

let originalValues = {};

async function loadUserData() {
    try {
        const response = await fetch('/api/current-user');
        const user = await response.json();
        
        if (response.ok) {
            originalValues = {
                name: user.name || '',
                username: user.username || '',
                email: user.email || ''
            };

            document.getElementById('display-name').textContent = user.name || 'No name';
            document.getElementById('display-username').textContent = user.username || '';
            document.getElementById('display-email').textContent = user.email || 'No email provided';
            document.getElementById('avatar-initial').textContent = (user.name || 'U').charAt(0).toUpperCase();
        }
    } catch (err) {
        console.error('Error loading user data:', err);
    }
}

function editField(fieldName) {
    const displayEl = document.getElementById(`display-${fieldName}`);
    const inputEl = document.getElementById(`input-${fieldName}`);
    const editIcon = document.querySelector(`#${fieldName}-field .edit-icon`);
    const saveIcon = document.querySelector(`#${fieldName}-field .save-icon`);
    const cancelIcon = document.querySelector(`#${fieldName}-field .cancel-icon`);
    
    if (displayEl && inputEl) {
        inputEl.value = displayEl.textContent === 'No email provided' ? '' : displayEl.textContent;
        displayEl.style.display = 'none';
        inputEl.style.display = 'inline-block';
        inputEl.focus();
        inputEl.select();
    }
    
    if (editIcon) editIcon.style.display = 'none';
    if (saveIcon) saveIcon.style.display = 'inline';
    if (cancelIcon) cancelIcon.style.display = 'inline';
}

async function saveField(fieldName) {
    const inputEl = document.getElementById(`input-${fieldName}`);
    const newValue = inputEl?.value.trim();
    
    if (!newValue && fieldName !== 'email') {
        showMessage(`${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} cannot be empty`, 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/user', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: fieldName === 'name' ? newValue : originalValues.name,
                username: fieldName === 'username' ? newValue : originalValues.username,
                email: fieldName === 'email' ? newValue : originalValues.email
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('Profile updated successfully!', 'success');
            originalValues[fieldName] = newValue;
            loadUserData();
            cancelEdit(fieldName);
        } else {
            showMessage(data.error || 'Failed to update', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('An error occurred while updating', 'error');
    }
}

function cancelEdit(fieldName) {
    const displayEl = document.getElementById(`display-${fieldName}`);
    const inputEl = document.getElementById(`input-${fieldName}`);
    const editIcon = document.querySelector(`#${fieldName}-field .edit-icon`);
    const saveIcon = document.querySelector(`#${fieldName}-field .save-icon`);
    const cancelIcon = document.querySelector(`#${fieldName}-field .cancel-icon`);
    
    if (displayEl && inputEl) {
        displayEl.style.display = 'inline';
        inputEl.style.display = 'none';
    }
    
    if (editIcon) editIcon.style.display = 'inline';
    if (saveIcon) saveIcon.style.display = 'none';
    if (cancelIcon) cancelIcon.style.display = 'none';
}

async function changePassword() {
    const oldPassword = document.getElementById('input-old-password')?.value.trim();
    const newPassword = document.getElementById('input-new-password')?.value.trim();
    const confirmPassword = document.getElementById('input-confirm-password')?.value.trim();

    if (!oldPassword || !newPassword || !confirmPassword) {
        showMessage('Please fill in all password fields', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showMessage('New passwords do not match', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showMessage('New password must be at least 6 characters', 'error');
        return;
    }

    try {
        const response = await fetch('/api/user/password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                old_password: oldPassword,
                new_password: newPassword
            })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Password updated successfully!', 'success');
            document.getElementById('input-old-password').value = '';
            document.getElementById('input-new-password').value = '';
            document.getElementById('input-confirm-password').value = '';
        } else {
            showMessage(data.error || 'Failed to update password', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('An error occurred while updating password', 'error');
    }
}

// ============== LOGOUT ==============

function goBackToApp() {
    window.location.href = '/index';
}

let toastTimeout;
function showLogoutToast() {
    const toast = document.getElementById('logout-toast');
    if (toast) {
        toast.classList.add('show');
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(hideLogoutToast, 5000);
    }
}

function hideLogoutToast() {
    document.getElementById('logout-toast')?.classList.remove('show');
}

async function confirmLogout() {
    try {
        const response = await fetch('/api/logout', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/login';
        } else {
            hideLogoutToast();
        }
    } catch (error) {
        console.error('Error logging out:', error);
        hideLogoutToast();
    }
}
// ============== FORGOT PASSWORD ==============

document.getElementById("forgot-password")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "/forgotpassword";
});
