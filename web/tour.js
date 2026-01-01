/**
 * Interactive Tour Utility
 * Handles highlighting elements and showing tooltips for walkthroughs.
 */

class Tour {
    constructor(steps) {
        this.steps = steps;
        this.currentStep = 0;
        this.overlay = null;
        this.spotlight = null;
        this.tooltip = null;
    }

    start() {
        console.log("Starting tour...");
        this.createElements();
        this.showStep();

        // Add window resize listener to update position
        window.addEventListener('resize', () => this.updatePosition());
    }

    createElements() {
        // Overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'tour-overlay';
        document.body.appendChild(this.overlay);

        // Spotlight
        this.spotlight = document.createElement('div');
        this.spotlight.className = 'tour-spotlight';
        document.body.appendChild(this.spotlight);

        // Tooltip
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tour-tooltip';
        document.body.appendChild(this.tooltip);

        // Transition after append
        setTimeout(() => this.overlay.classList.add('visible'), 10);
    }

    showStep() {
        const step = this.steps[this.currentStep];

        // Find element
        const element = document.querySelector(step.element);

        // If element not found or hidden, skip to next
        if (!element || (element.offsetParent === null && step.element !== 'body')) {
            console.warn(`Tour step ${this.currentStep} element not found/visible: ${step.element}`);
            if (this.currentStep < this.steps.length - 1) {
                this.currentStep++;
                this.showStep();
            } else {
                this.finish();
            }
            return;
        }

        // Update Tooltip Content
        this.tooltip.innerHTML = `
            <h3>${step.title}</h3>
            <p>${step.content}</p>
            <div class="tour-footer">
                <span class="tour-steps">${this.currentStep + 1} / ${this.steps.length}</span>
                <div class="tour-btn-group">
                    <button class="btn secondary small" onclick="window.currentTour.skip()">Skip</button>
                    <button class="btn primary small" onclick="window.currentTour.next()">
                        ${this.currentStep === this.steps.length - 1 ? 'Finish' : 'Next'}
                    </button>
                </div>
            </div>
        `;

        this.updatePosition();
    }

    updatePosition() {
        if (!this.spotlight || !this.tooltip) return;

        const step = this.steps[this.currentStep];
        const element = document.querySelector(step.element);
        if (!element) return;

        let rect;
        if (step.element === 'body') {
            // Center spotlight for general introductions
            rect = {
                top: window.innerHeight / 2 - 50,
                left: window.innerWidth / 2 - 50,
                width: 100,
                height: 100
            };
            this.spotlight.style.opacity = '0';
        } else {
            rect = element.getBoundingClientRect();
            this.spotlight.style.opacity = '1';
        }

        // Update Spotlight
        const padding = 5;
        this.spotlight.style.top = `${rect.top - padding}px`;
        this.spotlight.style.left = `${rect.left - padding}px`;
        this.spotlight.style.width = `${rect.width + (padding * 2)}px`;
        this.spotlight.style.height = `${rect.height + (padding * 2)}px`;

        // Update Tooltip Position
        const tooltipRect = this.tooltip.getBoundingClientRect();
        let tooltipTop, tooltipLeft;

        // Default position: below spotlight
        tooltipTop = rect.bottom + 15;
        tooltipLeft = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

        // Adjust if out of bounds
        if (tooltipLeft < 10) tooltipLeft = 10;
        if (tooltipLeft + tooltipRect.width > window.innerWidth - 10) {
            tooltipLeft = window.innerWidth - tooltipRect.width - 10;
        }

        // If not enough space below, show above
        if (tooltipTop + tooltipRect.height > window.innerHeight - 10) {
            tooltipTop = rect.top - tooltipRect.height - 15;
        }

        // Special case for introduction (center screen)
        if (step.element === 'body') {
            tooltipTop = (window.innerHeight / 2) - (tooltipRect.height / 2);
            tooltipLeft = (window.innerWidth / 2) - (tooltipRect.width / 2);
        }

        this.tooltip.style.top = `${tooltipTop}px`;
        this.tooltip.style.left = `${tooltipLeft}px`;
    }

    next() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            const step = this.steps[this.currentStep];
            
            // Check if this step has a navigation instruction
            if (step.navigateTo) {
                // Navigate to the next page with tour parameter
                window.location.href = step.navigateTo;
                return;
            }
            
            this.showStep();
        } else {
            this.finish();
        }
    }

    skip() {
        this.finish();
    }

    finish() {
        this.overlay.classList.remove('visible');
        this.spotlight.style.opacity = '0';
        this.tooltip.style.opacity = '0';

        setTimeout(() => {
            this.overlay.remove();
            this.spotlight.remove();
            this.tooltip.remove();

            // Clean up URL parameter to avoid restarting on reload
            const url = new URL(window.location);
            url.searchParams.delete('startTour');
            window.history.replaceState({}, '', url);
        }, 300);
    }
}

// Initialize on index.html
if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
    document.addEventListener('DOMContentLoaded', () => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('startTour') === 'true') {
            const indexSteps = [
                {
                    element: 'body',
                    title: "Welcome to Anki Task Bar!",
                    content: "Let's take a quick tour to see how everything works. This widget helps you stay focused on your goals."
                },
                {
                    element: '.page-header h1',
                    title: "Today's Tasks",
                    content: "This is your main dashboard. It shows all of decks that have cards due today."
                },
                {
                    element: '#btn-stats',
                    title: "Progress Statistics",
                    content: "Detailed stats about your daily progress. Track how many cards you've completed today."
                },
                {
                    element: '#btn-manage',
                    title: "Select Decks",
                    content: "Click here to choose which decks you want to see on your primary list."
                },
                {
                    element: '#btn-sessions',
                    title: "Study Sessions",
                    content: "Group related decks into sessions and switch between them easily for maximum focus."
                },
                {
                    element: '.header-actions a[href="setting.html"]',
                    title: "Settings",
                    content: "Customize your experience! Change themes, adjust zoom levels, and configure effects."
                },
                {
                    element: '#selected-decks-stats',
                    title: "Quick Overview",
                    content: "See at a glance how many cards are left and roughly how much time it will take."
                },
                {
                    element: '.search-container',
                    title: "Quick Search",
                    content: "Type anywhere or press '/' to quickly find a specific deck in your list."
                },
                {
                    element: '#main-content-container',
                    title: "Your Study List",
                    content: "Decks are listed here. Click one to start studying in Anki immediately!"
                },
                {
                    element: '.page-header',
                    title: "Move Anywhere",
                    content: "Did you know? You can drag the widget from the header to place it anywhere on your screen."
                },
                {
                    element: '#btn-sessions',
                    title: "Next: Sessions Tour",
                    content: "Now let's explore the Sessions feature! Click Next to continue the tour on the Sessions page.",
                    navigateTo: 'sessions.html?startTour=true'
                }
            ];

            const tour = new Tour(indexSteps);
            window.currentTour = tour;
            tour.start();
        }
    });
}

// Initialize on sessions.html
if (window.location.pathname.endsWith('sessions.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('startTour') === 'true') {
            const sessionSteps = [
                {
                    element: 'body',
                    title: "Welcome to Sessions!",
                    content: "Let's explore how to organize and manage your study sessions effectively."
                },
                {
                    element: '.sidebar-header h2',
                    title: "Session Library",
                    content: "This is your session management area where you can organize and access all your study sessions."
                },
                {
                    element: '#new-session-btn',
                    title: "Create New Session",
                    content: "Click here to create a new study session. You can group related decks together for focused study."
                },
                {
                    element: '#add-folder-btn',
                    title: "Add Folders",
                    content: "Organize your sessions by creating folders. Click the + button to add a new folder."
                },
                {
                    element: '#folders-list',
                    title: "Folder Navigation",
                    content: "Your folders appear here. Click on any folder to view sessions within it, or 'All Sessions' to see everything."
                },
                {
                    element: '#current-view-title',
                    title: "Current View",
                    content: "Shows which folder or view you're currently browsing. The number indicates total sessions in this view."
                },
                {
                    element: '#shuffle-sessions-btn',
                    title: "Shuffle Sessions",
                    content: "Randomize the order of your sessions! Great for variety in your study routine. Enable in settings first."
                },
                {
                    element: '.content-header',
                    title: "Session Cards Area",
                    content: "Your sessions are displayed as cards in this main area. Each shows the session name, deck count, and current progress."
                },
                {
                    element: 'body',
                    title: "Session Cards",
                    content: "Session cards appear here showing each session's details. Right-click on any session card to access options like activate, edit, move to folder, or delete."
                },
                {
                    element: 'body',
                    title: "Progress Indicator",
                    content: "Each session card has a visual progress bar showing how much you've completed. Green means you're making great progress!"
                },
                {
                    element: 'body',
                    title: "Session Statistics",
                    content: "Each session card shows quick stats including total cards, new cards, learning cards, and review cards for that session."
                },
                {
                    element: '.back-link',
                    title: "Return Home",
                    content: "Click the Back button to return to the main dashboard when you're done managing sessions."
                }
            ];

            const tour = new Tour(sessionSteps);
            window.currentTour = tour;
            tour.start();
        }
    });
}
