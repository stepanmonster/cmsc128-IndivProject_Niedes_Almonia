// -------- TOGGLE BETWEEN LOGIN AND REGISTER --------
if (document.getElementById("show-register")) {
    document.getElementById("show-register").addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("login-section").style.display = "none";
        document.getElementById("register-section").style.display = "block";
    });
}

if (document.getElementById("show-login")) {
    document.getElementById("show-login").addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("register-section").style.display = "none";
        document.getElementById("login-section").style.display = "block";
    });
}

// -------- LOGIN PAGE LOGIC --------
if (document.getElementById("login-confirm")) {
    const loginBtn = document.getElementById("login-confirm");
    loginBtn.addEventListener("click", async () => {
        const credentials = document.getElementById("login-credentials").value.trim();
        const password = document.getElementById("login-password").value.trim();
        
        if (!credentials || !password) {
            alert("Please enter both username/email and password.");
            return;
        }
        
        try {
            const response = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credentials, password }),
            });
            
            const data = await response.json();
            
            if (data.error) {
                alert(data.error);
            } else {
                alert(`Welcome back, ${data.user.username}!`);
                window.location.href = "/index";
            }
        } catch (err) {
            console.error("Login error:", err);
            alert("Login failed. Please try again.");
        }
    });
}

// -------- REGISTRATION LOGIC --------
if (document.getElementById("register-confirm")) {
    const registerBtn = document.getElementById("register-confirm");
    registerBtn.addEventListener("click", async () => {
        const credentials = document.getElementById("register-credentials").value.trim();
        const password = document.getElementById("register-password").value.trim();
        const confirmPassword = document.getElementById("register-confirm-password").value.trim();
        const name = document.getElementById("register-name").value.trim();
        const question_id = document.getElementById("security-question").value;
        const answer = document.getElementById("security-answer").value.trim();

        // Validation
        if (!credentials || !password || !confirmPassword || !name || !question_id || !answer) {
            alert("Please fill in all required fields.");
            return;
        }

        if (password !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            alert("Password must be at least 6 characters long.");
            return;
        }

        // Detect email vs username
        const isEmail = credentials.includes("@");

        try {
            const response = await fetch("/api/user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    username: isEmail ? credentials.split("@")[0] : credentials,
                    email: isEmail ? credentials : null,
                    name: name,
                    password: password,
                    security_answer: { question_id, answer }  // send both question and answer
                }),
            });

            const data = await response.json();

            if (data.error) {
                alert(data.error);
            } else {
                alert(`Account created successfully! Welcome, ${data.username || data.name}!`);
                window.location.href = "/index";
            }
        } catch (err) {
            console.error("Registration error:", err);
            alert("Registration failed. Please try again.");
        }
    });
}

// ========== ACCOUNT SETTINGS FUNCTIONALITY ==========

// Store original values
let originalValues = {};

// Load user data when DOM is ready (for settings page)
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('display-name')) {
        loadUserDataForSettings();
    }
});

async function loadUserDataForSettings() {
    try {
        const response = await fetch('/api/current-user');
        const data = await response.json();
        
        if (response.ok) {
            // Store original values
            originalValues.name = data.name || '';
            originalValues.username = data.username || '';
            originalValues.email = data.email || 'No email provided';
            
            // Update display fields
            document.getElementById('display-name').textContent = data.name || 'No name';
            document.getElementById('display-username').textContent = data.username || 'No username';
            document.getElementById('display-email').textContent = data.email || 'No email provided';
            
            // Update avatar
            const initial = (data.name || data.username || 'U').charAt(0).toUpperCase();
            document.getElementById('avatar-initial').textContent = initial;
        } else {
            console.error('Error response:', data);
            document.getElementById('display-name').textContent = 'Error loading';
            document.getElementById('display-username').textContent = 'Error loading';
        }
    } catch (err) {
        console.error('Error loading user data:', err);
        document.getElementById('display-name').textContent = 'Error loading';
        document.getElementById('display-username').textContent = 'Error loading';
    }
}

// Edit field function - opens prompt
function editField(fieldType) {
    const displayId = fieldType === 'name' ? 'display-name' : 'display-username';
    const currentValue = originalValues[fieldType];
    const fieldLabel = fieldType === 'name' ? 'Full Name' : 'Username';
    
    const newValue = prompt(`Edit ${fieldLabel}:`, currentValue);
    
    if (newValue !== null && newValue.trim() !== '' && newValue.trim() !== currentValue) {
        updateProfileField(fieldType, newValue.trim(), displayId);
    }
}

// Update profile field via API
async function updateProfileField(fieldType, newValue, displayId) {
    try {
        const payload = {};
        
        // Always send both fields
        if (fieldType === 'name') {
            payload.name = newValue;
            payload.username = originalValues.username;
        } else {
            payload.username = newValue;
            payload.name = originalValues.name;
        }
        
        const response = await fetch('/api/user', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.error) {
            alert(data.error);
        } else {
            // Update display
            document.getElementById(displayId).textContent = newValue;
            originalValues[fieldType] = newValue;
            alert(`${fieldType === 'name' ? 'Name' : 'Username'} updated successfully!`);
            
            // Update avatar if name changed
            if (fieldType === 'name') {
                document.getElementById('avatar-initial').textContent = newValue.charAt(0).toUpperCase();
            }
        }
    } catch (err) {
        console.error('Error updating field:', err);
        alert('Failed to update. Please try again.');
    }
}

// Change password with old password verification
async function changePassword() {
    const oldPassword = document.getElementById('input-old-password').value.trim();
    const newPassword = document.getElementById('input-new-password').value.trim();
    const confirmPassword = document.getElementById('input-confirm-password').value.trim();

    // Validation
    if (!oldPassword) {
        alert('Please enter your current password.');
        return;
    }

    if (!newPassword || !confirmPassword) {
        alert('Please enter both new password fields.');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match.');
        return;
    }

    if (newPassword.length < 6) {
        alert('Password must be at least 6 characters long.');
        return;
    }

    if (newPassword === oldPassword) {
        alert('New password must be different from old password.');
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

        if (data.error) {
            alert(data.error);
        } else {
            alert('Password updated successfully!');
            // Clear password fields
            document.getElementById('input-old-password').value = '';
            document.getElementById('input-new-password').value = '';
            document.getElementById('input-confirm-password').value = '';
            window.location.href = '/login';
        }
    } catch (err) {
        console.error('Error changing password:', err);
        alert('Failed to change password.');
    }
}
// Logout user
function logoutUser() {
    if (confirm('Are you sure you want to logout?')) {
        fetch('/api/logout', {
            method: 'POST'
        })
        .then((response) => response.json())
        .then((data) => {
            alert('Logged out successfully');
            window.location.href = '/login';
        })
        .catch((err) => {
            console.error('Error logging out:', err);
            alert('Failed to logout.');
        });
    }
}


// Delete account
function confirmDeleteAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        fetch('/api/user', {
            method: 'DELETE'
        }).then((response) => response.json())
        .then((data) => {
            alert('Account deleted successfully');
            window.location.href = '/login';
        })
        .catch((err) => {
            console.error('Error deleting account:', err);
            alert('Failed to delete account.');
        });
    }
}

// ============== FORGOT PASSWORD FUNCTIONALITY ====================

document.addEventListener("DOMContentLoaded", function() {
    const forgotBtn = document.getElementById("forgot-password");
    if (forgotBtn) {
        forgotBtn.addEventListener("click", function() {
            // Redirect to the Flask route
            window.location.href = "/forgotpassword";
        });
    }
});

document.addEventListener("DOMContentLoaded", function() {
    const questionSelect = document.getElementById("security-question");
    const registerBtn = document.getElementById("register-confirm");

    if (questionSelect && registerBtn) {
        fetch("/api/security-questions")
        .then(res => res.json())
        .then(data => {
            // Clear default option
            questionSelect.innerHTML = "";
            
            data.forEach(q => {
                const option = document.createElement("option");
                option.value = q.q_id;
                option.textContent = q.q_content;
                questionSelect.appendChild(option);
            });

            // Enable Sign Up button after questions loaded
            registerBtn.disabled = false;
        })
        .catch(err => {
            console.error("Failed to load security questions:", err);
            questionSelect.innerHTML = "<option value=''>Failed to load questions</option>";
        });
    }
});