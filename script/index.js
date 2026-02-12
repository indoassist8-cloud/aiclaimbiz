import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getFirestore, getDoc, doc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

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

// Main page loading function
window.loadPage = async function (page) {
    const container = document.getElementById('main-container');
    const title = document.getElementById('page-title');

    container.innerHTML = `<div class="loader-container"><p>Loading ${page}...</p></div>`;

    try {
        if (page === 'dashboard') {
            title.innerText = "Dashboard Overview";

            const idToken = await auth.currentUser.getIdToken();
            const response = await fetch(`${APPS_SCRIPT_URL}?idToken=${idToken}`);
            const result = await response.json();

            // Handle different response formats
            let rawData;
            if (result.status === "success" && result.data) {
                rawData = result.data;
            } else if (Array.isArray(result)) {
                rawData = result;
            } else if (result.data) {
                rawData = result.data;
            } else {
                throw new Error("Invalid data format received");
            }

            if (rawData && rawData.length > 0) {
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
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <i class='bx bx-data' style='font-size: 64px; color: var(--text-secondary);'></i>
                        <h3 style="margin-top: 20px; color: var(--text-primary);">No Data Available</h3>
                        <p style="color: var(--text-secondary); margin-top: 10px;">Upload some receipts to get started!</p>
                        <button class="btn-main" onclick="loadPage('upload')" style="margin-top: 20px;">
                            <i class='bx bx-upload'></i> Upload Receipt
                        </button>
                    </div>
                `;
            }
        }

        else if (page === 'data') {
            title.innerText = "Data & OCR Submissions";
            
            const idToken = await auth.currentUser.getIdToken();
            const response = await fetch(`${APPS_SCRIPT_URL}?idToken=${idToken}`);
            const result = await response.json();

            // Use result.data if available, otherwise result
            const rawData = result.data || result;
            currentTableData = rawData;
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

            uploadBtn.onclick = () => handleMultipleUploads(fileInput.files);
        }

    } catch (err) {
        console.error('Error in loadPage:', err);
        console.error('Page:', page);
        container.innerHTML = `
            <div style="padding: 30px; text-align: center;">
                <i class='bx bx-error-circle' style='font-size: 64px; color: var(--brand-red);'></i>
                <h3 style="margin-top: 20px; color: var(--brand-red);">Error Loading Page</h3>
                <p style="color: var(--text-secondary); margin-top: 10px;">${err.message}</p>
                <button class="btn-main" onclick="loadPage('dashboard')" style="margin-top: 20px;">
                    <i class='bx bx-refresh'></i> Try Again
                </button>
            </div>
        `;
    }
};

// Render paginated table
function renderPaginatedTable() {
    const container = document.getElementById('main-container');
    const headers = currentTableData[0];
    const rows = currentTableData.slice(1).filter(r => r.join('').trim() !== "");

    const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const paginatedRows = rows.slice(start, start + ROWS_PER_PAGE);

    let html = `
        <div class="table-container">
            <table class="styled-table">
                <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                <tbody>
                    ${paginatedRows.map(row => `<tr>${row.map(cell => `<td>${cell || ''}</td>`).join('')}</tr>`).join('')}
                </tbody>
            </table>
        </div>
        <div class="pagination-controls">
            <button onclick="changePage(-1)" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>
            <span>Page ${currentPage} of ${totalPages}</span>
            <button onclick="changePage(1)" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
        </div>`;

    container.innerHTML = html;
}

// Change page for pagination
window.changePage = (direction) => {
    currentPage += direction;
    renderPaginatedTable();
};

// Render dashboard chart
function renderDashboardChart(monthlyData) {
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(monthlyData),
            datasets: [{
                label: 'Monthly Amount',
                data: Object.values(monthlyData),
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
onAuthStateChanged(auth, (user) => {
    if (user) {
        const docRef = doc(db, "users", user.uid);
        getDoc(docRef).then((docSnap) => {
            let userEmail = user.email;
            if (docSnap.exists()) {
                userEmail = docSnap.data().email || user.email;
            }
            
            // Update email display
            document.getElementById('loggedUserEmail').innerText = userEmail;
            
            // Generate and set user initials
            const initials = getUserInitials(userEmail);
            document.getElementById('userAvatar').innerText = initials;
            
            // Load dashboard by default
            window.loadPage('dashboard');
        });
    } else {
        window.location.href = 'login.html';
    }
});

// Helper function to get user initials from email
function getUserInitials(email) {
    if (!email) return 'U';
    
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

    if (sidebarBtn) {
        sidebarBtn.addEventListener("click", () => {
            sidebar.classList.toggle("active");
        });
    }

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
    signOut(auth);
});
