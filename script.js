// ========================================
// Network Canvas Animation
// Represents interconnected agents in simulation
// ========================================

class NetworkAnimation {
    constructor() {
        this.canvas = document.getElementById('network-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.connections = [];
        this.mouse = { x: null, y: null, radius: 150 };
        
        this.settings = {
            particleCount: 80,
            particleSize: { min: 2, max: 4 },
            particleSpeed: 0.3,
            connectionDistance: 150,
            particleColor: 'rgba(37, 99, 235, 0.6)',
            connectionColor: 'rgba(37, 99, 235, 0.15)',
            mouseConnectionColor: 'rgba(6, 182, 212, 0.3)'
        };
        
        this.init();
        this.animate();
        this.setupEventListeners();
    }
    
    init() {
        this.resize();
        this.createParticles();
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    createParticles() {
        this.particles = [];
        const { particleCount, particleSize, particleSpeed } = this.settings;
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * (particleSize.max - particleSize.min) + particleSize.min,
                speedX: (Math.random() - 0.5) * particleSpeed,
                speedY: (Math.random() - 0.5) * particleSpeed,
                opacity: Math.random() * 0.5 + 0.3
            });
        }
    }
    
    drawParticle(particle) {
        this.ctx.beginPath();
        this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        this.ctx.fillStyle = this.settings.particleColor.replace('0.6', particle.opacity);
        this.ctx.fill();
    }
    
    drawConnection(p1, p2, distance) {
        const opacity = 1 - (distance / this.settings.connectionDistance);
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.strokeStyle = this.settings.connectionColor.replace('0.15', (0.15 * opacity).toFixed(2));
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }
    
    drawMouseConnection(particle, distance) {
        const opacity = 1 - (distance / this.mouse.radius);
        this.ctx.beginPath();
        this.ctx.moveTo(particle.x, particle.y);
        this.ctx.lineTo(this.mouse.x, this.mouse.y);
        this.ctx.strokeStyle = this.settings.mouseConnectionColor.replace('0.3', (0.3 * opacity).toFixed(2));
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
    }
    
    updateParticle(particle) {
        // Bounce off edges
        if (particle.x < 0 || particle.x > this.canvas.width) {
            particle.speedX *= -1;
        }
        if (particle.y < 0 || particle.y > this.canvas.height) {
            particle.speedY *= -1;
        }
        
        // Update position
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        
        // Mouse interaction - gentle repulsion
        if (this.mouse.x !== null && this.mouse.y !== null) {
            const dx = particle.x - this.mouse.x;
            const dy = particle.y - this.mouse.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.mouse.radius) {
                const force = (this.mouse.radius - distance) / this.mouse.radius;
                const angle = Math.atan2(dy, dx);
                particle.x += Math.cos(angle) * force * 0.5;
                particle.y += Math.sin(angle) * force * 0.5;
            }
        }
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update and draw particles
        this.particles.forEach(particle => {
            this.updateParticle(particle);
            this.drawParticle(particle);
        });
        
        // Draw connections between particles
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < this.settings.connectionDistance) {
                    this.drawConnection(this.particles[i], this.particles[j], distance);
                }
            }
            
            // Draw mouse connections
            if (this.mouse.x !== null && this.mouse.y !== null) {
                const dx = this.particles[i].x - this.mouse.x;
                const dy = this.particles[i].y - this.mouse.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < this.mouse.radius) {
                    this.drawMouseConnection(this.particles[i], distance);
                }
            }
        }
        
        requestAnimationFrame(() => this.animate());
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.resize();
            this.createParticles();
        });
        
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        
        window.addEventListener('mouseout', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }
}

// ========================================
// Navigation
// ========================================

class Navigation {
    constructor() {
        this.navbar = document.querySelector('.navbar');
        this.navToggle = document.querySelector('.nav-toggle');
        this.navLinks = document.querySelector('.nav-links');
        
        this.init();
    }
    
    init() {
        // Scroll effect
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                this.navbar.classList.add('scrolled');
            } else {
                this.navbar.classList.remove('scrolled');
            }
        });
        
        // Mobile toggle
        this.navToggle.addEventListener('click', () => {
            this.navToggle.classList.toggle('active');
            this.navLinks.classList.toggle('active');
        });
        
        // Close mobile nav on link click
        this.navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                this.navToggle.classList.remove('active');
                this.navLinks.classList.remove('active');
            });
        });
        
        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    const offset = 80;
                    const targetPosition = target.getBoundingClientRect().top + window.scrollY - offset;
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }
}

// ========================================
// Scroll Animations
// ========================================

class ScrollAnimations {
    constructor() {
        this.animatedElements = document.querySelectorAll(
            '.section-header, .question-card, .detail-card, .organizer-card, .info-card, .papers-list'
        );
        
        this.init();
    }
    
    init() {
        // Create Intersection Observer
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry, index) => {
                    if (entry.isIntersecting) {
                        // Add staggered delay for grid items
                        setTimeout(() => {
                            entry.target.classList.add('visible');
                        }, index * 50);
                    }
                });
            },
            {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            }
        );
        
        // Observe all animated elements
        this.animatedElements.forEach(el => observer.observe(el));
    }
}

// ========================================
// Toggle Buttons
// ========================================

class ToggleButton {
    constructor(buttonId, listId) {
        this.toggleButton = document.getElementById(buttonId);
        this.toggleList = document.getElementById(listId);
        
        if (this.toggleButton && this.toggleList) {
            this.init();
        }
    }
    
    init() {
        this.toggleButton.addEventListener('click', () => {
            const isExpanded = this.toggleButton.classList.contains('expanded');
            
            if (isExpanded) {
                this.toggleButton.classList.remove('expanded');
                this.toggleList.classList.remove('expanded');
            } else {
                this.toggleButton.classList.add('expanded');
                this.toggleList.classList.add('expanded');
            }
        });
    }
}

// ========================================
// Accepted Papers
// ========================================

class AcceptedPapers {
    constructor() {
        this.papers = [];
        this.listEl = document.getElementById('papers-list');
        this.overlay = document.getElementById('paper-modal-overlay');
        this.modalContent = document.getElementById('paper-modal-content');
        this.closeBtn = document.getElementById('paper-modal-close');

        if (this.listEl) {
            this.init();
        }
    }

    async init() {
        try {
            const res = await fetch('assets/papers/accepted_papers/papers.json');
            this.papers = await res.json();
            this.renderList();
            this.bindModal();
        } catch (e) {
            console.error('Failed to load papers:', e);
        }
    }

    renderList() {
        const bestPaperNominees = [
            'From Plausible to Causal: Counterfactual Semantics for Policy Evaluation in Simulated Online Communities',
            'Mechanism Plausibility in Generative Agent-Based Modeling',
            'SLALOM: Simulation Lifecycle Analysis via Longitudinal Observation Metrics for Social Simulation',
            'The Privacy Equilibrium Toolkit: Simulating Multi-User Negotiations of Augmented Reality Sensing Policies',
            'Verification-in-Use for LLM-Agent Simulations: Toward Robust Inference under Model Uncertainty'
        ];

        this.listEl.innerHTML = this.papers.map((paper, i) => {
            const authors = paper.authors.map(a => a.name).join(', ');
            const pdfPath = `assets/papers/accepted_papers/${paper.pdf_file}`;
            const posterPath = paper.poster_url || null;
            const videoPath = paper.video_file ? `assets/videos/${paper.video_file}` : null;
            const isNominated = bestPaperNominees.includes(paper.title);

            return `<div class="paper-item${isNominated ? ' best-paper-nominee' : ''}" data-index="${i}">
                <div class="paper-info">
                    <div class="paper-title">${paper.title}${isNominated ? '<span class="best-paper-tag">Best Paper Nominee</span>' : ''}</div>
                    <div class="paper-authors">${authors}</div>
                </div>
                <div class="paper-actions">
                    <a href="${pdfPath}" target="_blank" rel="noopener noreferrer" class="paper-pdf-link" onclick="event.stopPropagation()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        PDF
                    </a>${posterPath ? `
                    <a href="${posterPath}" target="_blank" rel="noopener noreferrer" class="paper-video-link" onclick="event.stopPropagation()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        Poster
                    </a>` : ''}${videoPath ? `
                    <a href="${videoPath}" target="_blank" rel="noopener noreferrer" class="paper-video-link" onclick="event.stopPropagation()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        Video
                    </a>` : ''}
                    <svg class="paper-arrow" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
            </div>`;
        }).join('');
    }

    bindModal() {
        // Open modal on paper click
        this.listEl.addEventListener('click', (e) => {
            const item = e.target.closest('.paper-item');
            if (!item) return;
            const index = parseInt(item.dataset.index);
            this.openModal(this.papers[index]);
        });

        // Close modal
        this.closeBtn.addEventListener('click', () => this.closeModal());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.closeModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    }

    normalizeUrl(url) {
        if (!url) return url;
        if (!/^https?:\/\//i.test(url)) return 'https://' + url;
        return url;
    }

    openModal(paper) {
        const pdfPath = `assets/papers/accepted_papers/${paper.pdf_file}`;
        const posterPath = paper.poster_url || null;
        const videoPath = paper.video_file ? `assets/videos/${paper.video_file}` : null;

        // Build authors chips
        const authorsHtml = paper.authors.map(a => {
            const website = this.normalizeUrl(a.website);
            const hasLink = website;
            const linkIcon = hasLink ? `<svg class="link-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>` : '';
            const wrapper = hasLink
                ? `<a href="${website}" target="_blank" rel="noopener noreferrer" class="modal-author-chip has-link" style="text-decoration:none;color:inherit;">`
                : `<div class="modal-author-chip">`;
            const closingTag = hasLink ? `</a>` : `</div>`;
            return `${wrapper}
                <span class="modal-author-name">${a.name}${linkIcon}</span>
                <span class="modal-author-affiliation">${a.affiliation}</span>
            ${closingTag}`;
        }).join('');

        // Build links
        let linksHtml = `<a href="${pdfPath}" target="_blank" rel="noopener noreferrer" class="modal-link-button pdf">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            Read Paper
        </a>`;
        if (posterPath) {
            linksHtml += `<a href="${posterPath}" target="_blank" rel="noopener noreferrer" class="modal-link-button pdf">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                View Poster
            </a>`;
        }
        if (videoPath) {
            linksHtml += `<a href="${videoPath}" target="_blank" rel="noopener noreferrer" class="modal-link-button video">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Watch Video
            </a>`;
        }

        // Build bios section (only authors with bios)
        const authorsWithBios = paper.authors.filter(a => a.bio);
        let biosHtml = '';
        if (authorsWithBios.length > 0) {
            biosHtml = `<div class="modal-section modal-bios">
                <div class="modal-section-label">About the Authors</div>
                ${authorsWithBios.map(a => `<div class="modal-bio-item">
                    <div class="modal-bio-name">${a.name}</div>
                    <div class="modal-bio-text">${a.bio}</div>
                </div>`).join('')}
            </div>`;
        }

        this.modalContent.innerHTML = `
            <h3 class="modal-paper-title">${paper.title}</h3>
            <div class="modal-authors-list">${authorsHtml}</div>
            <div class="modal-links">${linksHtml}</div>
            <div class="modal-section">
                <div class="modal-section-label">Abstract</div>
                <p class="modal-abstract">${paper.abstract}</p>
            </div>
            ${biosHtml}
        `;

        this.overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ========================================
// Initialize Everything
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize network animation
    new NetworkAnimation();

    // Initialize navigation
    new Navigation();

    // Initialize scroll animations
    new ScrollAnimations();

    // Initialize toggle buttons
    new ToggleButton('templates-toggle', 'templates-list');
    new ToggleButton('example-papers-toggle', 'example-papers-list');

    // Initialize accepted papers
    new AcceptedPapers();

    // Add loading complete class
    document.body.classList.add('loaded');
});

// ========================================
// Utility: Debounce function
// ========================================

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
