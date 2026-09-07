let currentLatitude = "";
let currentLongitude = "";


// ============================================================
// BASIC HELPERS
// ============================================================

function scrollToSection(id) {

    const element = document.getElementById(id);

    if (element) {
        element.scrollIntoView({
            behavior: "smooth"
        });
    }
}


function showElement(id) {
    document.getElementById(id)?.classList.remove("hidden");
}


function hideElement(id) {
    document.getElementById(id)?.classList.add("hidden");
}


// ============================================================
// AI
// ============================================================

async function askVerda() {

    const input = document.getElementById("question");
    const responseBox = document.getElementById("aiResponse");
    const answer = document.getElementById("answer");

    const question = input.value.trim();

    if (!question) {

        alert("Please enter a question.");

        return;
    }

    responseBox.classList.remove("hidden");

    answer.innerHTML = "🌱 VERDA is thinking...";

    try {

        const response = await fetch("/api/ask", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                question: question
            })

        });

        const data = await response.json();

        answer.textContent = data.answer;

    } catch (error) {

        answer.textContent =
            "Unable to connect to VERDA server.";

    }
}


function quickAsk(question) {

    document.getElementById("question").value = question;

    scrollToSection("ai");

    setTimeout(() => {
        askVerda();
    }, 400);
}


// ============================================================
// ECO SCORE
// ============================================================

async function calculateScore() {

    const questions = [

        {
            key: "waste",
            question: "How often do you separate recyclable waste?"
        },

        {
            key: "water",
            question: "How often do you save water?"
        },

        {
            key: "energy",
            question: "How often do you avoid unnecessary electricity usage?"
        },

        {
            key: "food",
            question: "How often do you avoid wasting food?"
        }

    ];

    const answers = {};

    for (const item of questions) {

        let value = prompt(
            item.question +
            "\n\n1 = Rarely\n2 = Sometimes\n3 = Often\n4 = Always"
        );

        if (value === null) {
            return;
        }

        value = parseInt(value);

        if (isNaN(value) || value < 1 || value > 4) {

            alert("Please enter a number from 1 to 4.");

            return calculateScore();
        }

        answers[item.key] = value;
    }

    try {

        const response = await fetch("/api/eco-score", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(answers)

        });

        const data = await response.json();

        document.getElementById("scoreValue").textContent =
            data.score;

        alert(
            "Your Eco Score is " +
            data.score +
            "/100\n\n" +
            data.message
        );

    } catch {

        alert("Unable to calculate Eco Score.");

    }
}


// ============================================================
// ROLE SELECTION
// ============================================================

function openRoles() {

    showElement("roles");

}


function closeRoles() {

    hideElement("roles");

}


function selectRole(role) {

    closeRoles();

    hideElement("citizenPanel");
    hideElement("adminPanel");
    hideElement("officerPanel");

    if (role === "citizen") {

        showElement("citizenPanel");

        scrollToSection("citizenPanel");

    }

    if (role === "admin") {

        showElement("adminPanel");

        loadReports("admin");

        setTimeout(() => {
            scrollToSection("adminPanel");
        }, 100);

    }

    if (role === "officer") {

        showElement("officerPanel");

        loadReports("officer");

        setTimeout(() => {
            scrollToSection("officerPanel");
        }, 100);

    }

}


function closeWorkspace() {

    hideElement("citizenPanel");
    hideElement("adminPanel");
    hideElement("officerPanel");

}


// ============================================================
// SHARE POST
// ============================================================

function openShare() {

    showElement("shareModal");

}


function closeShare() {

    hideElement("shareModal");

}


async function createPost() {

    const content =
        document.getElementById("postContent").value.trim();

    const photo =
        document.getElementById("postPhoto").files[0];

    if (!content) {

        alert("Please write something to share.");

        return;
    }

    const formData = new FormData();

    formData.append("content", content);

    if (photo) {
        formData.append("photo", photo);
    }

    try {

        const response = await fetch("/api/posts", {

            method: "POST",

            body: formData

        });

        const data = await response.json();

        if (!response.ok) {

            alert(data.error || "Unable to publish post.");

            return;
        }

        document.getElementById("postContent").value = "";
        document.getElementById("postPhoto").value = "";

        closeShare();

        loadPosts();

        alert("🌱 Your green post has been shared!");

    } catch {

        alert("Unable to connect to VERDA.");

    }
}


// ============================================================
// COMMUNITY
// ============================================================

async function loadPosts() {

    const container =
        document.getElementById("postsContainer");

    try {

        const response = await fetch("/api/posts");

        const posts = await response.json();

        if (!posts.length) {

            container.innerHTML = `
                <div class="post-card">
                    <div class="post-content">
                        <h3>🌱 Start the community</h3>
                        <p>
                            Be the first person to share
                            a sustainable action or idea.
                        </p>
                    </div>
                </div>
            `;

            return;
        }

        container.innerHTML = posts.map(post => `

            <article class="post-card">

                ${
                    post.photo
                    ? `<img src="${post.photo}" alt="Community post">`
                    : ""
                }

                <div class="post-content">

                    <p>${escapeHtml(post.content)}</p>

                    <div class="post-date">
                        ${post.created_at}
                    </div>

                    <div class="post-actions">

                        <button onclick="likePost(${post.id})">
                            ❤️ ${post.likes}
                        </button>

                        <button onclick="commentPost(${post.id})">
                            💬 ${post.comments}
                        </button>

                    </div>

                </div>

            </article>

        `).join("");

    } catch {

        container.innerHTML = `
            <div class="post-card">
                <div class="post-content">
                    Community could not be loaded.
                </div>
            </div>
        `;

    }
}


async function likePost(id) {

    await fetch(
        `/api/posts/${id}/like`,
        {
            method: "POST"
        }
    );

    loadPosts();
}


async function commentPost(id) {

    const comment = prompt("Write your comment:");

    if (!comment || !comment.trim()) {
        return;
    }

    await fetch(
        `/api/posts/${id}/comment`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                comment: comment
            })
        }
    );

    loadPosts();
}


function escapeHtml(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


// ============================================================
// REPORT PROBLEM
// ============================================================

function openReport() {

    showElement("reportModal");

}


function closeReport() {

    hideElement("reportModal");

}


function getLocation() {

    const status =
        document.getElementById("locationStatus");

    if (!navigator.geolocation) {

        status.textContent =
            "Geolocation is not supported by this browser.";

        return;
    }

    status.textContent =
        "Getting your location...";

    navigator.geolocation.getCurrentPosition(

        function(position) {

            currentLatitude =
                position.coords.latitude.toFixed(6);

            currentLongitude =
                position.coords.longitude.toFixed(6);

            status.textContent =
                `📍 Location captured: ${currentLatitude}, ${currentLongitude}`;

        },

        function() {

            status.textContent =
                "Unable to get location. You can still enter the area manually.";

        }

    );
}


async function submitReport() {

    const title =
        document.getElementById("reportTitle").value.trim();

    const description =
        document.getElementById("reportDescription").value.trim();

    const location =
        document.getElementById("reportLocation").value.trim();

    const photo =
        document.getElementById("reportPhoto").files[0];

    if (!title || !description) {

        alert(
            "Please enter a title and description."
        );

        return;
    }

    const formData = new FormData();

    formData.append("title", title);
    formData.append("description", description);
    formData.append("location", location);
    formData.append("latitude", currentLatitude);
    formData.append("longitude", currentLongitude);

    if (photo) {
        formData.append("photo", photo);
    }

    try {

        const response = await fetch(
            "/api/report",
            {
                method: "POST",
                body: formData
            }
        );

        const data = await response.json();

        if (!response.ok) {

            alert(
                data.error ||
                "Unable to submit report."
            );

            return;
        }

        document.getElementById("reportTitle").value = "";
        document.getElementById("reportDescription").value = "";
        document.getElementById("reportLocation").value = "";
        document.getElementById("reportPhoto").value = "";

        currentLatitude = "";
        currentLongitude = "";

        closeReport();

        alert(
            "🔴 Report submitted successfully.\n\n" +
            "The report is now visible to the VERDA admin."
        );

    } catch {

        alert(
            "Unable to connect to VERDA server."
        );

    }
}


// ============================================================
// ADMIN / FIELD OFFICER
// ============================================================

async function loadReports(mode) {

    const container =
        mode === "admin"
        ? document.getElementById("adminReports")
        : document.getElementById("officerReports");

    container.innerHTML =
        "<p>Loading reports...</p>";

    try {

        const response =
            await fetch("/api/reports");

        const reports =
            await response.json();

        let filtered = reports;

        if (mode === "officer") {

            filtered =
                reports.filter(
                    r => r.assigned_officer
                );

        }

        if (!filtered.length) {

            container.innerHTML = `
                <div class="report-item">
                    <h3>No reports yet</h3>
                    <p>
                        New environmental reports
                        will appear here.
                    </p>
                </div>
            `;

            return;
        }

        container.innerHTML =
            filtered.map(report => {

                let statusClass =
                    "red-status";

                if (report.status === "GREEN") {
                    statusClass = "green-status";
                }

                if (report.status === "IN PROGRESS") {
                    statusClass = "progress-status";
                }

                const photo =
                    report.photo
                    ? `<img src="${report.photo}" alt="Report photo">`
                    : "";

                let controls = "";

                if (mode === "admin") {

                    controls = `

                        <div class="report-controls">

                            <select id="officer-${report.id}">

                                <option value="">
                                    Select Field Officer
                                </option>

                                <option value="Field Officer 01">
                                    Field Officer 01
                                </option>

                                <option value="Field Officer 02">
                                    Field Officer 02
                                </option>

                                <option value="Field Officer 03">
                                    Field Officer 03
                                </option>

                            </select>

                            <button
                                onclick="assignOfficer(${report.id})">

                                Assign Officer

                            </button>

                        </div>

                    `;

                } else {

                    controls = `

                        <div class="report-controls">

                            <button
                                onclick="updateStatus(${report.id}, 'IN PROGRESS')">

                                🔧 Mark In Progress

                            </button>

                            <button
                                onclick="updateStatus(${report.id}, 'RESOLVED')">

                                ✅ Mark Resolved

                            </button>

                        </div>

                    `;

                }

                return `

                    <div class="report-item">

                        <div class="report-top">

                            <h3>
                                ${escapeHtml(report.title)}
                            </h3>

                            <span class="status ${statusClass}">
                                ${report.status}
                            </span>

                        </div>

                        <p>
                            ${escapeHtml(report.description)}
                        </p>

                        ${
                            report.location
                            ? `<p>📍 ${escapeHtml(report.location)}</p>`
                            : ""
                        }

                        ${
                            report.latitude
                            ? `<p>
                                GPS:
                                ${report.latitude},
                                ${report.longitude}
                               </p>`
                            : ""
                        }

                        ${
                            report.assigned_officer
                            ? `<p>
                                👷 Assigned to:
                                <strong>
                                ${escapeHtml(report.assigned_officer)}
                                </strong>
                               </p>`
                            : ""
                        }

                        ${photo}

                        <div class="post-date">
                            Reported: ${report.created_at}
                        </div>

                        ${controls}

                    </div>

                `;

            }).join("");

    } catch {

        container.innerHTML =
            "<p>Unable to load reports.</p>";

    }
}


async function assignOfficer(id) {

    const select =
        document.getElementById(
            `officer-${id}`
        );

    const officer =
        select.value;

    if (!officer) {

        alert("Select a field officer first.");

        return;
    }

    const response =
        await fetch(
            `/api/report/${id}/assign`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    officer: officer
                })
            }
        );

    const data =
        await response.json();

    if (!response.ok) {

        alert(data.error || "Unable to assign officer.");

        return;
    }

    alert(
        "🟢 Officer assigned successfully."
    );

    loadReports("admin");
}


async function updateStatus(id, status) {

    const response =
        await fetch(
            `/api/report/${id}/status`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    status: status
                })
            }
        );

    if (!response.ok) {

        alert("Unable to update report.");

        return;
    }

    alert(
        status === "RESOLVED"
        ? "✅ Problem marked as resolved."
        : "🔧 Report marked as in progress."
    );

    loadReports("officer");
}


// ============================================================
// INITIAL LOAD
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        loadPosts();

    }
);
