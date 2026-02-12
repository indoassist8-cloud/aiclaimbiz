import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getFirestore, getDoc, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDt3AXqpQld8nklTfKwfEPIXf1VudcNqlM",
    authDomain: "fb-ocr-rc.firebaseapp.com",
    projectId: "fb-ocr-rc",
    appId: "1:403801195570:web:991fac0cc71b3f959e282b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzs1pK8huTL1frdHBYA-xfM8ckaKBI1bY1y1CigSlwJXNjp_1Pw7spvqvbxnBDjFJc6/exec";

// Global variables for pagination
let ROWS_PER_PAGE = 10;
let currentTableData = [];
let currentPage = 1;

// Global user data
let currentUserData = {
    firstName: '',
    lastName: '',
    email: ''
};

// Profile dropdown toggle
window.closeProfileDropdown = function () {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
};

// Main page loading function
window.loadPage = async function (page) {
    const container = document.getElementById('main-container');
    const title = document.getElementById('page-title');

    // Update active navigation
    document.querySelectorAll('.nav-list li a').forEach(link => {
        link.classList.remove('active');
    });
    const activeLink = document.getElementById(`nav-${page}`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    container.innerHTML = `<div class="loader-container"><p>Loading ${page}...</p></div>`;

    try {
        if (page === 'dashboard') {
            title.innerText = "Dashboard Overview";

            const user = auth.currentUser;
            if (!user) {
                container.innerHTML = `<div class="loader-container"><p>Authenticating...</p></div>`;
                return;
            }

            try {
                const idToken = await auth.currentUser.getIdToken();
                const response = await fetch(`${APPS_SCRIPT_URL}?idToken=${idToken}`);

                // Check if response is ok
                if (!response.ok) {
                    throw new Error('Failed to fetch data');
                }

                const result = await response.json();

                // Handle different response formats
                let rawData = null;
                if (result.status === "success" && result.data) {
                    rawData = result.data;
                } else if (Array.isArray(result)) {
                    rawData = result;
                } else if (result.data) {
                    rawData = result.data;
                }

                // Check if we have valid data with more than just headers
                if (rawData && Array.isArray(rawData) && rawData.length > 1) {
                    const dataRows = rawData.slice(1); // Remove header row
                    const userEmail = auth.currentUser.email;
                    const now = new Date();
                    const currentMonth = now.getMonth();
                    const currentYear = now.getFullYear();

                    // Calculate Monthly Stats (for all data, not filtered by user)
                    let monthCount = 0;
                    let monthTotal = 0;
                    const monthlyTotals = {}; // For the chart

                    dataRows.forEach(row => {
                        if (!row || row.length === 0) return;

                        const date = new Date(row[0]);
                        const rawAmount = row[4] || row[2]; // Try column 5 first, then column 3

                        // Clean the amount: Remove commas, currency symbols, and spaces
                        let cleanAmount = String(rawAmount).replace(/[^\d.-]/g, '');
                        const amount = parseFloat(cleanAmount) || 0;

                        if (!isNaN(date.getTime())) {
                            const m = date.getMonth();
                            const y = date.getFullYear();

                            // Stats for current month
                            if (m === currentMonth && y === currentYear) {
                                monthCount++;
                                monthTotal += amount;
                            }

                            // Data for Bar Chart
                            const monthKey = date.toLocaleString('default', { month: 'short' });
                            monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + amount;
                        }
                    });

                    container.innerHTML = `
                        <div class="dashboard-grid">
                            <div class="stat-card">
                                <div class="card-icon blue"><i class='bx bx-receipt'></i></div>
                                <div class="card-info">
                                    <p>Receipts (This Month)</p>
                                    <h3>${monthCount}</h3>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="card-icon green"><i class='bx bx-money'></i></div>
                                <div class="card-info">
                                    <p>Total Amount (This Month)</p>
                                    <h3>${monthTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
                                </div>
                            </div>
                        </div>

                        <div class="chart-container-wrapper">
                            <canvas id="monthlyChart"></canvas>
                        </div>
                    `;

                    // Render Chart
                    renderDashboardChart(monthlyTotals);
                } else {
                    // Show empty state for new users
                    showEmptyDashboard(container);
                }
            } catch (fetchError) {
                console.log("Data fetch error:", fetchError);
                // Show empty state if fetch fails (likely new user with no sheet)
                showEmptyDashboard(container);
            }
        }

        else if (page === 'data') {
            title.innerText = "Data & OCR Submissions";

            const user = auth.currentUser;
            if (!user) {
                container.innerHTML = `<div class="loader-container"><p>Authenticating...</p></div>`;
                return;
            }

            try {
                const idToken = await auth.currentUser.getIdToken();
                const response = await fetch(`${APPS_SCRIPT_URL}?idToken=${idToken}`);

                if (!response.ok) {
                    throw new Error('Failed to fetch data');
                }

                const result = await response.json();
                let rawData = result.data || result;

                // Filter out empty rows
                if (Array.isArray(rawData) && rawData.length > 0) {
                    const headers = rawData[0];
                    const dataRows = rawData.slice(1).filter(row => {
                        return row && row.some(cell => cell !== null && cell !== undefined && cell !== '');
                    });
                    currentTableData = [headers, ...dataRows];
                } else {
                    currentTableData = [];
                }
            } catch (fetchError) {
                console.log("Data fetch error:", fetchError);
                // Set empty table data for new users
                currentTableData = [];
            }

            currentPage = 1;
            renderPaginatedTable();
        }

        else if (page === 'upload') {
            title.innerText = "Upload Receipt";
            container.innerHTML = `
                <div class="upload-section">
                    <div class="upload-box">
                        <i class='bx bx-cloud-upload' style='font-size: 64px; color: var(--brand-orange); margin-bottom: 20px;'></i>
                        <h2 style="margin-bottom: 12px; font-family: 'Syne', sans-serif;">Upload Receipt</h2>
                        <p style="color: var(--text-secondary); margin-bottom: 24px;">Select an image of your receipt to upload to your drive</p>
                        <input type="file" id="fileInput" accept="image/*,.heic,.HEIC" multiple style="display: none;">
                        <button class="btn-upload" onclick="document.getElementById('fileInput').click()">
                            <i class='bx bx-image-add'></i> Select Image
                        </button>
                        <div id="file-preview"></div>
                        <button id="uploadBtn" class="btn-main" style="display:none; margin-top: 20px;">
                            <i class='bx bx-upload'></i> Upload to Drive
                        </button>
                        <p id="uploadStatus" style="margin-top: 20px; font-weight: 500;"></p>
                    </div>
                </div>
            `;

            const fileInput = document.getElementById('fileInput');
            const uploadBtn = document.getElementById('uploadBtn');
            const preview = document.getElementById('file-preview');

            fileInput.addEventListener('change', function () {
                if (this.files.length > 0) {
                    let fileNames = Array.from(this.files).map(f => `
                        <li style="padding: 8px 0; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border-color);">
                            <i class='bx bx-file-image' style='color: var(--brand-red); font-size: 20px;'></i>
                            <span>${f.name}</span>
                            <span style="margin-left: auto; color: var(--text-secondary); font-size: 12px;">${(f.size / 1024).toFixed(2)} KB</span>
                        </li>
                    `).join('');
                    preview.innerHTML = `
                        <div style="margin-top: 20px; padding: 20px; background: white; border-radius: 12px; border: 1px solid var(--border-color);">
                            <h4 style="margin-bottom: 12px; font-family: 'Syne', sans-serif; color: var(--text-primary);">Selected Files:</h4>
                            <ul style="list-style: none; padding: 0; margin: 0;">
                                ${fileNames}
                            </ul>
                        </div>
                    `;
                    uploadBtn.style.display = 'block';
                    uploadBtn.innerHTML = `<i class='bx bx-upload'></i> Upload ${this.files.length} File${this.files.length > 1 ? 's' : ''}`;
                }
            });

            uploadBtn.addEventListener('click', async () => {
                const files = fileInput.files;
                if (files.length > 0) {
                    await handleMultipleUploads(files);
                }
            });
        }

        else if (page === 'profile') {
            title.innerText = "User Profile";
            await loadProfilePage(container);
        }

        else if (page === 'password') {
            title.innerText = "Change Password";
            await loadPasswordPage(container);
        }

    } catch (error) {
        console.error("Error loading page:", error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <i class='bx bx-error-circle' style='font-size: 64px; color: var(--brand-red);'></i>
                <h3 style="margin-top: 20px; color: var(--brand-red);">Error Loading ${page}</h3>
                <p style="color: var(--text-secondary); margin-top: 10px;">${error.message}</p>
            </div>
        `;
    }
};

// Profile Page
async function loadProfilePage(container) {
    const user = auth.currentUser;
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (userDoc.exists()) {
        const data = userDoc.data();
        currentUserData = {
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: user.email
        };
    } else {
        currentUserData = {
            firstName: '',
            lastName: '',
            email: user.email
        };
    }

    const initials = getUserInitials(currentUserData.email);
    const displayName = currentUserData.firstName && currentUserData.lastName
        ? `${currentUserData.firstName} ${currentUserData.lastName}`
        : currentUserData.email;

    container.innerHTML = `
        <div class="profile-section">
            <div class="profile-header">
                <div class="profile-avatar-large">${initials}</div>
                <h2>${displayName}</h2>
                <p>${currentUserData.email}</p>
            </div>
            
            <div class="profile-form">
                <form id="profileForm">
                    <div class="form-group">
                        <label for="firstName">First Name</label>
                        <input type="text" id="firstName" name="firstName" value="${currentUserData.firstName}" placeholder="Enter your first name">
                    </div>
                    
                    <div class="form-group">
                        <label for="lastName">Last Name</label>
                        <input type="text" id="lastName" name="lastName" value="${currentUserData.lastName}" placeholder="Enter your last name">
                    </div>
                    
                    <div class="form-group">
                        <label for="email">Email Address</label>
                        <input type="email" id="email" name="email" value="${currentUserData.email}" disabled>
                    </div>
                    
                    <div id="profileMessage"></div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="loadPage('dashboard')">Cancel</button>
                        <button type="submit" class="btn-primary">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Handle form submission
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveProfile();
    });
}

// Save Profile
async function saveProfile() {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const messageDiv = document.getElementById('profileMessage');
    const submitBtn = document.querySelector('#profileForm button[type="submit"]');

    if (!firstName || !lastName) {
        messageDiv.innerHTML = `
            <div class="alert alert-error">
                <i class='bx bx-error-circle'></i> Please fill in both first and last name.
            </div>
        `;
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Saving...';

    try {
        const user = auth.currentUser;
        const userRef = doc(db, "users", user.uid);

        // Update Firestore
        await setDoc(userRef, {
            firstName: firstName,
            lastName: lastName,
            email: user.email,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        // Update global user data
        currentUserData.firstName = firstName;
        currentUserData.lastName = lastName;

        // Update all user displays
        updateAllUserDisplays();

        messageDiv.innerHTML = `
            <div class="alert alert-success">
                <i class='bx bx-check-circle'></i> Profile updated successfully!
            </div>
        `;

        setTimeout(() => {
            messageDiv.innerHTML = '';
        }, 3000);

    } catch (error) {
        console.error("Error saving profile:", error);
        messageDiv.innerHTML = `
            <div class="alert alert-error">
                <i class='bx bx-error-circle'></i> Error saving profile: ${error.message}
            </div>
        `;
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Changes';
    }
}

// Password Page
async function loadPasswordPage(container) {
    container.innerHTML = `
        <div class="password-section">
            <div class="password-form">
                <div class="password-requirements">
                    <h4>Password Requirements:</h4>
                    <ul>
                        <li>At least 6 characters long</li>
                        <li>Mix of letters and numbers recommended</li>
                        <li>Use a unique password you don't use elsewhere</li>
                    </ul>
                </div>
                
                <form id="passwordForm">
                    <div class="form-group">
                        <label for="currentPassword">Current Password</label>
                        <input type="password" id="currentPassword" name="currentPassword" placeholder="Enter your current password" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="newPassword">New Password</label>
                        <input type="password" id="newPassword" name="newPassword" placeholder="Enter your new password" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="confirmPassword">Confirm New Password</label>
                        <input type="password" id="confirmPassword" name="confirmPassword" placeholder="Confirm your new password" required>
                    </div>
                    
                    <div id="passwordMessage"></div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="loadPage('dashboard')">Cancel</button>
                        <button type="submit" class="btn-primary">Update Password</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Handle form submission
    document.getElementById('passwordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await changePassword();
    });
}

// Change Password
async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const messageDiv = document.getElementById('passwordMessage');
    const submitBtn = document.querySelector('#passwordForm button[type="submit"]');

    // Validation
    if (newPassword.length < 6) {
        messageDiv.innerHTML = `
            <div class="alert alert-error">
                <i class='bx bx-error-circle'></i> New password must be at least 6 characters long.
            </div>
        `;
        return;
    }

    if (newPassword !== confirmPassword) {
        messageDiv.innerHTML = `
            <div class="alert alert-error">
                <i class='bx bx-error-circle'></i> New passwords do not match.
            </div>
        `;
        return;
    }

    if (currentPassword === newPassword) {
        messageDiv.innerHTML = `
            <div class="alert alert-error">
                <i class='bx bx-error-circle'></i> New password must be different from current password.
            </div>
        `;
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Updating...';

    try {
        const user = auth.currentUser;
        const credential = EmailAuthProvider.credential(user.email, currentPassword);

        // Re-authenticate user
        await reauthenticateWithCredential(user, credential);

        // Update password
        await updatePassword(user, newPassword);

        messageDiv.innerHTML = `
            <div class="alert alert-success">
                <i class='bx bx-check-circle'></i> Password updated successfully!
            </div>
        `;

        // Clear form
        document.getElementById('passwordForm').reset();

        setTimeout(() => {
            messageDiv.innerHTML = '';
        }, 3000);

    } catch (error) {
        console.error("Error changing password:", error);
        let errorMessage = "Error updating password. Please try again.";

        if (error.code === 'auth/wrong-password') {
            errorMessage = "Current password is incorrect.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "New password is too weak.";
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = "Please log out and log in again before changing your password.";
        }

        messageDiv.innerHTML = `
            <div class="alert alert-error">
                <i class='bx bx-error-circle'></i> ${errorMessage}
            </div>
        `;
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Update Password';
    }
}

// Update all user displays (sidebar, dropdown, etc.)
function updateAllUserDisplays() {
    const displayName = currentUserData.firstName && currentUserData.lastName
        ? `${currentUserData.firstName} ${currentUserData.lastName}`
        : currentUserData.email;

    // Update dropdown
    document.getElementById('dropdownName').innerText = displayName;
    document.getElementById('dropdownEmail').innerText = currentUserData.email;

    // Update avatars with initials
    const initials = getUserInitials(currentUserData.email);
    document.getElementById('userAvatar').innerText = initials;
    document.getElementById('dropdownAvatar').innerText = initials;
}

// Render paginated table
function renderPaginatedTable() {
    const container = document.getElementById('main-container');

    if (!currentTableData || currentTableData.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <i class='bx bx-data' style='font-size: 64px; color: var(--text-secondary);'></i>
                <h3 style="margin-top: 20px; color: var(--text-primary);">No Data Available</h3>
                <p style="color: var(--text-secondary); margin-top: 10px;">Upload some receipts to get started!</p>
            </div>
        `;
        return;
    }

    const headers = currentTableData[0];
    const dataRows = currentTableData.slice(1);
    const totalPages = Math.ceil(dataRows.length / ROWS_PER_PAGE);
    const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
    const endIdx = startIdx + ROWS_PER_PAGE;
    const pageRows = dataRows.slice(startIdx, endIdx);

    let tableHTML = `
        <div class="table-responsive">
            <table class="ocr-table">
                <thead>
                    <tr>
    `;

    headers.forEach(h => {
        tableHTML += `<th>${h}</th>`;
    });

    tableHTML += `
                    </tr>
                </thead>
                <tbody>
    `;

    pageRows.forEach(row => {
        tableHTML += '<tr>';
        row.forEach((cell, idx) => {
            if (idx === 0 && cell) {
                const d = new Date(cell);
                if (!isNaN(d.getTime())) {
                    tableHTML += `<td>${d.toLocaleDateString()}</td>`;
                } else {
                    tableHTML += `<td>${cell}</td>`;
                }
            } else {
                tableHTML += `<td>${cell || ''}</td>`;
            }
        });
        tableHTML += '</tr>';
    });

    tableHTML += `
                </tbody>
            </table>
        </div>
        <div class="pagination-controls">
            <button id="prevPage" ${currentPage === 1 ? 'disabled' : ''}>
                <i class='bx bx-chevron-left'></i> Previous
            </button>
            <span>Page ${currentPage} of ${totalPages}</span>
            <button id="nextPage" ${currentPage === totalPages ? 'disabled' : ''}>
                Next <i class='bx bx-chevron-right'></i>
            </button>
        </div>
    `;

    container.innerHTML = tableHTML;

    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderPaginatedTable();
        }
    });

    document.getElementById('nextPage')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderPaginatedTable();
        }
    });
}

// Show empty dashboard state
function showEmptyDashboard(container) {
    container.innerHTML = `
        <div class="dashboard-grid">
            <div class="stat-card">
                <div class="card-icon blue"><i class='bx bx-receipt'></i></div>
                <div class="card-info">
                    <p>Receipts (This Month)</p>
                    <h3>0</h3>
                </div>
            </div>
            <div class="stat-card">
                <div class="card-icon green"><i class='bx bx-money'></i></div>
                <div class="card-info">
                    <p>Total Amount (This Month)</p>
                    <h3>0</h3>
                </div>
            </div>
        </div>

        <div class="chart-container-wrapper">
            <canvas id="monthlyChart"></canvas>
        </div>
        
        <div style="text-align: center; padding: 40px; margin-top: 20px; background: white; border-radius: 16px; border: 1px solid var(--border-color);">
            <i class='bx bx-data' style='font-size: 64px; color: var(--text-secondary);'></i>
            <h3 style="margin-top: 20px; color: var(--text-primary);">Welcome! No Data Yet</h3>
            <p style="color: var(--text-secondary); margin-top: 10px;">Upload some receipts to get started and see your analytics here!</p>
            <button class="btn-main" onclick="loadPage('upload')" style="margin-top: 20px;">
                <i class='bx bx-upload'></i> Upload Your First Receipt
            </button>
        </div>
    `;

    // Render empty chart
    renderDashboardChart({});
}

// Render dashboard chart
function renderDashboardChart(monthlyData) {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;

    // If no data, show empty chart with placeholder
    const labels = Object.keys(monthlyData).length > 0
        ? Object.keys(monthlyData)
        : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const data = Object.keys(monthlyData).length > 0
        ? Object.values(monthlyData)
        : new Array(12).fill(0);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Amount',
                data: data,
                backgroundColor: '#140a6d',
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

// Helper function to handle multiple file uploads
async function handleMultipleUploads(files) {
    const status = document.getElementById('uploadStatus');
    const btn = document.getElementById('uploadBtn');
    const preview = document.getElementById('file-preview');
    const user = auth.currentUser;

    btn.disabled = true;
    let successCount = 0;

    status.innerHTML = `
        <div style="padding: 20px; background: #fff9f0; border-radius: 12px; border: 1px solid var(--brand-gold);">
            <i class='bx bx-loader-alt bx-spin' style='font-size: 24px; color: var(--brand-orange);'></i>
            <p style="margin-top: 10px; color: var(--text-primary);">Uploading files... Please wait.</p>
        </div>
    `;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        status.innerHTML = `
            <div style="padding: 20px; background: #fff9f0; border-radius: 12px; border: 1px solid var(--brand-gold);">
                <i class='bx bx-loader-alt bx-spin' style='font-size: 24px; color: var(--brand-orange);'></i>
                <p style="margin-top: 10px; color: var(--text-primary);">Uploading file ${i + 1} of ${files.length}: ${file.name}...</p>
            </div>
        `;

        try {
            const result = await uploadSingleFile(file, user);
            if (result.success) successCount++;
        } catch (err) {
            console.error(`Failed to upload ${file.name}`, err);
        }
    }

    if (successCount === files.length) {
        status.innerHTML = `
            <div style="padding: 20px; background: #ecfdf5; border-radius: 12px; border: 1px solid #10b981;">
                <i class='bx bx-check-circle' style='font-size: 32px; color: #10b981;'></i>
                <h3 style="margin-top: 12px; color: #059669; font-family: 'Syne', sans-serif;">Upload Successful!</h3>
                <p style="margin-top: 8px; color: var(--text-secondary);">Successfully uploaded ${successCount} of ${files.length} file(s).</p>
                <button class="btn-main" onclick="loadPage('data')" style="margin-top: 16px;">
                    <i class='bx bx-table'></i> View Data
                </button>
            </div>
        `;
    } else {
        status.innerHTML = `
            <div style="padding: 20px; background: #fef2f2; border-radius: 12px; border: 1px solid var(--brand-red);">
                <i class='bx bx-error-circle' style='font-size: 32px; color: var(--brand-red);'></i>
                <h3 style="margin-top: 12px; color: var(--brand-red); font-family: 'Syne', sans-serif;">Upload Completed with Errors</h3>
                <p style="margin-top: 8px; color: var(--text-secondary);">Successfully uploaded ${successCount} of ${files.length} file(s).</p>
            </div>
        `;
    }

    btn.style.display = 'none';
    preview.innerHTML = '';
    document.getElementById('fileInput').value = '';
}

// Helper function to upload a single file to Google Drive via Apps Script
async function uploadSingleFile(file, user) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            try {
                const idToken = await user.getIdToken();
                const payload = {
                    idToken: idToken,
                    fileName: file.name,
                    mimeType: file.type || 'image/heic', // Fallback for HEIC
                    fileData: reader.result
                };

                const response = await fetch(APPS_SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                resolve(result);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
    });
}

// Auth state observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            currentUserData = {
                firstName: data.firstName || '',
                lastName: data.lastName || '',
                email: user.email
            };
        } else {
            currentUserData = {
                firstName: '',
                lastName: '',
                email: user.email
            };
        }

        // Update all user displays
        updateAllUserDisplays();

        // Load dashboard by default
        window.loadPage('dashboard');
    } else {
        window.location.href = 'login.html';
    }
});

// Helper function to get user initials from email
function getUserInitials(email) {
    if (!email) return 'U';

    // If we have first and last name, use those
    if (currentUserData.firstName && currentUserData.lastName) {
        return (currentUserData.firstName[0] + currentUserData.lastName[0]).toUpperCase();
    }

    // Extract name part before @
    const namePart = email.split('@')[0];

    // Split by dots, underscores, or hyphens
    const nameParts = namePart.split(/[._-]/);

    if (nameParts.length >= 2) {
        // If we have multiple parts, use first letter of first two parts
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
    } else {
        // If single part, use first two letters
        return namePart.substring(0, 2).toUpperCase();
    }
}

// Sidebar toggle for mobile
document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.querySelector(".sidebar");
    const sidebarBtn = document.querySelector("#sidebarBtn");
    const profileButton = document.getElementById("profileButton");
    const profileDropdown = document.getElementById("profileDropdown");

    if (sidebarBtn) {
        sidebarBtn.addEventListener("click", () => {
            sidebar.classList.toggle("active");
        });
    }

    // Profile dropdown toggle
    if (profileButton) {
        profileButton.addEventListener("click", (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle("show");
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
        if (profileDropdown && !profileDropdown.contains(e.target) && !profileButton.contains(e.target)) {
            profileDropdown.classList.remove("show");
        }
    });

    // Close sidebar automatically when a link is clicked (Mobile only)
    const navLinks = document.querySelectorAll(".nav-list li a");
    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove("active");
            }
        });
    });
});

// Logout functionality
document.getElementById('logout').addEventListener('click', (e) => {
    e.preventDefault();
    closeProfileDropdown();
    signOut(auth);
});



// Add this at the end of your index.js
function updateTooltipPositions() {
    const navLinks = document.querySelectorAll('.nav-list li a[data-tooltip]');

    navLinks.forEach(link => {
        link.addEventListener('mouseenter', function () {
            const rect = this.getBoundingClientRect();
            const tooltipY = rect.top + (rect.height / 2);

            this.style.setProperty('--tooltip-top', `${tooltipY}px`);

            const style = document.createElement('style');
            style.innerHTML = `
                .nav-list li a[data-tooltip="${this.getAttribute('data-tooltip')}"]:hover::after {
                    top: ${tooltipY}px !important;
                    transform: translateY(-50%) translateX(0) !important;
                }
                .nav-list li a[data-tooltip="${this.getAttribute('data-tooltip')}"]:hover::before {
                    top: ${tooltipY}px !important;
                    transform: translateY(-50%) !important;
                }
            `;

            const oldStyle = document.getElementById('tooltip-style-' + this.id);
            if (oldStyle) oldStyle.remove();

            style.id = 'tooltip-style-' + this.id;
            document.head.appendChild(style);
        });
    });
}

document.addEventListener('DOMContentLoaded', updateTooltipPositions);
window.addEventListener('resize', updateTooltipPositions);
