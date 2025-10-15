// ---------- GLOBAL VARIABLES ----------
let currentUsername = "";
let currentQuestionId = "";

// ---------- STEP 1: Fetch user's security question ----------
document.getElementById("fetchQuestionsBtn").addEventListener("click", async () => {
    const credentials = document.getElementById("credentials").value.trim();
    const message = document.getElementById("message");

    if (!credentials) {
        message.textContent = "Please enter your username or email.";
        message.className = "text-danger fw-bold";
        return;
    }

    message.textContent = "Loading...";
    message.className = "text-secondary";

    try {
        const response = await fetch("/api/forgotpassword", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: credentials })
        });

        const data = await response.json();

        if (!data.success) {
            message.textContent = data.message || "User not found.";
            message.className = "text-danger fw-bold";
            return;
        }

        currentUsername = credentials;
        currentQuestionId = data.question_id;

        // Insert the security question input and verify button dynamically
        document.getElementById("questionsContainer").innerHTML = `
            <div class="mb-3">
                <label class="form-label">Security Question</label>
                <input class="form-control" value="${data.security_question}" disabled />
            </div>
            <div class="mb-3">
                <label class="form-label">Your Answer</label>
                <input id="securityAnswer" class="form-control" placeholder="Type your answer" />
            </div>
            <button id="verifyAnswerBtn" class="btn btn-primary w-100">Verify</button>
        `;

        // Attach event listener to the dynamically created button
        document.getElementById("verifyAnswerBtn").addEventListener("click", verifyAnswer);

        // Show step 2
        document.getElementById("step1").classList.add("d-none");
        document.getElementById("step2").classList.remove("d-none");

        message.textContent = "";
    } catch (e) {
        message.textContent = "Network error.";
        message.className = "text-danger fw-bold";
        console.error(e);
    }
});

// ---------- STEP 2: Verify user's security answer ----------
async function verifyAnswer() {
    const answer = document.getElementById("securityAnswer").value.trim();
    const message = document.getElementById("message");

    if (!answer) {
        message.textContent = "Please enter your answer.";
        message.className = "text-danger fw-bold";
        return;
    }

    message.textContent = "Verifying...";
    message.className = "text-secondary";

    try {
        const response = await fetch("/api/user/verify-security-answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: currentUsername,
                question_id: currentQuestionId,
                answer: answer
            })
        });

        const data = await response.json();

        if (response.status !== 200) {
            message.textContent = data.error || "Incorrect answer.";
            message.className = "text-danger fw-bold";
            return;
        }

        // Show step 3: reset password
        const resetContainer = document.getElementById("resetContainer");
        resetContainer.innerHTML = `
            <div class="mb-3">
                <label class="form-label">New Password</label>
                <input type="password" id="newPassword" class="form-control" placeholder="Enter new password" />
            </div>
            <button id="resetPasswordBtn" class="btn btn-warning w-100">Reset Password</button>
        `;

        // Attach event listener to reset button
        document.getElementById("resetPasswordBtn").addEventListener("click", resetPassword);

        // Switch steps
        document.getElementById("step2").classList.add("d-none");
        document.getElementById("step3").classList.remove("d-none");

        message.textContent = "";
    } catch (e) {
        message.textContent = "Network error.";
        message.className = "text-danger fw-bold";
        console.error(e);
    }
}

// ---------- STEP 3: Reset password ----------
async function resetPassword() {
    const newPassword = document.getElementById("newPassword").value.trim();
    const message = document.getElementById("message");

    if (!newPassword) {
        message.textContent = "Please enter your new password.";
        message.className = "text-danger fw-bold";
        return;
    }

    if (newPassword.length < 6) {
        message.textContent = "Password must be at least 6 characters long.";
        message.className = "text-danger fw-bold";
        return;
    }

    message.textContent = "Resetting...";
    message.className = "text-secondary";

    try {
        const response = await fetch("/api/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: currentUsername,
                new_password: newPassword
            })
        });

        const data = await response.json();

        if (response.status !== 200) {
            message.textContent = data.message || "Reset failed.";
            message.className = "text-danger fw-bold";
            return;
        }

        message.textContent = "Password reset successful. You can now log in.";
        message.className = "text-success fw-bold";

        // Optionally, redirect to login after 2 seconds
        setTimeout(() => {
            window.location.href = "/login";
        }, 2000);
    } catch (e) {
        message.textContent = "Network error.";
        message.className = "text-danger fw-bold";
        console.error(e);
    }
}
