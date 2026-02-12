async function loadPage(pageName) {
    const container = document.getElementById('main-container');
    const title = document.getElementById('page-title');

    try {
        // Fetch HTML file from the 'pages' folder
        if (pageName === 'data') {
            title.innerText = "Data & OCR Submissions";
            container.innerHTML = `
            <div class="table-controls">
                <p>Loading spreadsheet data...</p>
            </div>
            <div id="table-wrapper"></div>`;
            const auth = getAuth();
            const user = auth.currentUser;
            if (user) {
                const idToken = await user.getIdToken();
                fetchSheetData(idToken); // This will now target #table-wrapper
            }
        } else {
            const response = await fetch(`pages/${pageName}.html`);
            if (!response.ok) throw new Error('Page not found');

            const content = await response.text();
            container.innerHTML = content;

            // Update active class in sidebar
            document.querySelectorAll('.nav-list a').forEach(el => el.classList.remove('active'));
            document.getElementById(`nav-${pageName}`).classList.add('active');

            // Update Header
            title.innerText = pageName.charAt(0).toUpperCase() + pageName.slice(1);
        }


    } catch (err) {
        container.innerHTML = `<div class="card"><h2>Error</h2><p>Page "${pageName}" could not be loaded.</p></div>`;
    }
}

async function fetchSheetData(token) {
    const container = document.getElementById('main-container');
    container.innerHTML = "<p>Retrieving your OCR data...</p>";

    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?idToken=${token}`);
        const data = await response.json();

        if (data.error) {
            container.innerHTML = `<p style="color:red;">${data.error}</p>`;
        } else {
            renderTable(data);
        }
    } catch (err) {
        container.innerHTML = "<p>Error connecting to database.</p>";
    }
}

function renderTable(data) {
    const wrapper = document.getElementById('table-wrapper');
    if (!wrapper) return; // Guard clause if user navigated away

    if (!data || data.length === 0) {
        wrapper.innerHTML = "<p>No data found.</p>";
        return;
    }

    let html = '<table class="data-table">';

    // ROW 2 AS HEADER
    html += '<thead><tr>';
    data[0].forEach(h => html += `<th>${h || ''}</th>`);
    html += '</tr></thead>';

    // BODY
    html += '<tbody>';
    for (let i = 1; i < data.length; i++) {
        if (data[i].join('').trim() !== "") {
            html += '<tr>' + data[i].map(c => `<td>${c}</td>`).join('') + '</tr>';
        }
    }
    html += '</tbody></table>';

    wrapper.innerHTML = html;
}

// Initial Load
window.onload = () => loadPage('dashboard');