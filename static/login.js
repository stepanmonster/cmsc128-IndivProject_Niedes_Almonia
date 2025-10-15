// -------- ERROR DISPLAY FUNCTIONS --------
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.className = "error-message";
        errorElement.style.display = "block";
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            hideError(elementId);
        }, 5000);
    }
}

function showSuccess(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.className = "success-message";
        errorElement.style.display = "block";
    }
}

function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.style.display = "none";
        errorElement.textContent = "";
    }
}

// -------- TOGGLE BETWEEN LOGIN AND REGISTER --------

if (document.getElementById("show-register")) {
    document.getElementById("show-register").addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("login-section").style.display = "none";
        document.getElementById("register-section").style.display = "block";
        hideError("login-error");
        hideError("register-error");
    });
}

if (document.getElementById("show-login")) {
    document.getElementById("show-login").addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("register-section").style.display = "none";
        document.getElementById("login-section").style.display = "block";
        hideError("login-error");
        hideError("register-error");
    });
}

// -------- LOGIN PAGE LOGIC --------

if (document.getElementById("login-confirm")) {
    const loginBtn = document.getElementById("login-confirm");
    loginBtn.addEventListener("click", async () => {
        const credentials = document.getElementById("login-credentials").value.trim();
        const password = document.getElementById("login-password").value.trim();
        
        hideError("login-error");
        
        if (!credentials || !password) {
            showError("login-error", "Please enter both username/email and password.");
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
                showError("login-error", data.error);
            } else {
                showSuccess("login-error", `Welcome back, ${data.user.username}!`);
                setTimeout(() => {
                    window.location.href = "/index";
                }, 1000);
            }
        } catch (err) {
            console.error("Login error:", err);
            showError("login-error", "Login failed. Please try again.");
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

        hideError("register-error");

        // Validation
        if (!credentials || !password || !confirmPassword || !name || !question_id || !answer) {
            showError("register-error", "Please fill in all required fields.");
            return;
        }

        if (password !== confirmPassword) {
            showError("register-error", "Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            showError("register-error", "Password must be at least 6 characters long.");
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
                    security_answer: { question_id, answer }
                }),
            });
            const data = await response.json();
            if (data.error) {
                showError("register-error", data.error);
            } else {
                showSuccess("register-error", `Account created successfully! Welcome, ${data.username || data.name}!`);
                setTimeout(() => {
                    window.location.href = "/index";
                }, 1500);
            }
        } catch (err) {
            console.error("Registration error:", err);
            showError("register-error", "Registration failed. Please try again.");
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
        const payload = {
            name: originalValues.name,
            username: originalValues.username,
            email: originalValues.email || null  // Handle null/undefined email
        };
        
        // Update the specific field being changed
        payload[fieldType] = newValue || null;

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
            document.getElementById(displayId).textContent = newValue || 'No email provided';
            originalValues[fieldType] = newValue;
            
            // Dynamic success message
            let fieldName = fieldType === 'name' ? 'Name' : 
                           fieldType === 'username' ? 'Username' : 'Email';
            alert(`${fieldName} updated successfully!`);
            
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

// Edit field function
function editField(fieldType) {
    const displayElement = document.getElementById(`display-${fieldType}`);
    const inputElement = document.getElementById(`input-${fieldType}`);
    const editIcon = document.querySelector(`#${fieldType}-field .edit-icon`);
    const saveIcon = document.querySelector(`#${fieldType}-field .save-icon`);
    const cancelIcon = document.querySelector(`#${fieldType}-field .cancel-icon`);
    
    // Store original value
    inputElement.dataset.original = displayElement.textContent;
    
    // Set input value to current display value
    inputElement.value = displayElement.textContent === 'No email provided' ? '' : displayElement.textContent;
    
    // Toggle visibility
    displayElement.style.display = 'none';
    inputElement.style.display = 'block';
    editIcon.style.display = 'none';
    saveIcon.style.display = 'inline';
    cancelIcon.style.display = 'inline';
    
    // Focus on input
    inputElement.focus();
    inputElement.select();
}

// Save field function
async function saveField(fieldType) {
    const displayElement = document.getElementById(`display-${fieldType}`);
    const inputElement = document.getElementById(`input-${fieldType}`);
    const newValue = inputElement.value.trim();
    
    // Validate email format if editing email
    if (fieldType === 'email' && newValue !== '' && !newValue.includes('@')) {
        alert('Please enter a valid email address.');
        return;
    }
    
    // If value hasn't changed, just cancel
    if (newValue === inputElement.dataset.original || 
        (newValue === '' && inputElement.dataset.original === 'No email provided')) {
        cancelEdit(fieldType);
        return;
    }
    
    // Update the field via API
    try {
        const payload = {
            name: originalValues.name,
            username: originalValues.username,
            email: originalValues.email || null
        };
        
        payload[fieldType] = newValue || null;

        const response = await fetch('/api/user', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert(data.error);
            return;
        } else {
            // Update display
            displayElement.textContent = newValue || 'No email provided';
            originalValues[fieldType] = newValue;
            
            // Update avatar if name changed
            if (fieldType === 'name' && newValue) {
                document.getElementById('avatar-initial').textContent = newValue.charAt(0).toUpperCase();
            }
            
            // Exit edit mode
            cancelEdit(fieldType);
        }
    } catch (err) {
        console.error('Error updating field:', err);
        alert('Failed to update. Please try again.');
    }
}

// Cancel edit function
function cancelEdit(fieldType) {
    const displayElement = document.getElementById(`display-${fieldType}`);
    const inputElement = document.getElementById(`input-${fieldType}`);
    const editIcon = document.querySelector(`#${fieldType}-field .edit-icon`);
    const saveIcon = document.querySelector(`#${fieldType}-field .save-icon`);
    const cancelIcon = document.querySelector(`#${fieldType}-field .cancel-icon`);
    
    // Toggle visibility back
    displayElement.style.display = 'inline';
    inputElement.style.display = 'none';
    editIcon.style.display = 'inline';
    saveIcon.style.display = 'none';
    cancelIcon.style.display = 'none';
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
            questionSelect.innerHTML = "<option>Failed to load questions</option>";
        });
    }
});
