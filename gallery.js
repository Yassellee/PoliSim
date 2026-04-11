import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { papers } from './gallery-data.js';

// ============================================================
// Constants
// ============================================================
const WING_ANGLES = [0, Math.PI * 2 / 3, Math.PI * 4 / 3];
const WING_NAMES = ['Simulation Frameworks', 'Policy Applications', 'Ethics & Methodology'];
const ATRIUM_RADIUS = 8;
const CORRIDOR_START = 6.5;
const CORRIDOR_END = 32;
const CORRIDOR_WIDTH = 5.5;
const CORRIDOR_HEIGHT = 4.2;
const ATRIUM_HEIGHT = 6.5;
const CAMERA_HEIGHT = 1.6;
const MOVE_SPEED = 50;
const SPRINT_SPEED = 80;
const FRICTION = 8;
const PLAYER_RADIUS = 0.4;
const WALL_THICKNESS = 0.3;

const FRAME_WIDTH = 2.0;
const FRAME_HEIGHT = 1.5;
const FRAME_CENTER_Y = 1.75;
const FRAME_BORDER = 0.06;
const COLUMN_RADIUS = 0.22;

// Exit door position — on the atrium wall between wing 0 and wing 2
const EXIT_ANGLE = (WING_ANGLES[0] + WING_ANGLES[2]) / 2 + Math.PI; // midpoint, on the far side

// ============================================================
// Gallery Class
// ============================================================
class Gallery {
    constructor() {
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.composer = null;
        this.clock = new THREE.Clock();

        this.stands = [];
        this.frameTargets = [];
        this.meshToStand = new Map();
        this.clickTargets = []; // all clickable meshes (frames + door)
        this.meshToAction = new Map(); // Mesh -> { type, data }
        this.columnCenters = [];

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.sprint = false;
        this.controlsActive = false;

        this.isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                        ('ontouchstart' in window && window.innerWidth < 1024);
        this.currentPreview = null;
        this.modalOpen = false;
        this.hoveredStand = null;

        // Mouse drag
        this.isDragging = false;
        this.dragMoved = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.mouseNDC = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 40;

        // Mobile
        this.joystickInput = { x: 0, y: 0 };
        this.lookTouchId = null;
        this.lookPrev = { x: 0, y: 0 };

        this.dom = {};
    }

    async init() {
        this.cacheDom();
        this.setupRenderer();
        this.setupScene();
        this.setupCamera();
        this.setupLighting();
        this.buildArchitecture();
        this.buildStands();
        this.buildBenches();
        this.buildWingSigns();
        this.buildAtriumDecor();
        this.buildExitDoor();
        this.createParticles();
        this.createCenterSign();
        this.setupPostProcessing();
        this.setupControls();
        this.setupInteraction();
        this.setupMinimap();

        window.addEventListener('resize', () => this.onResize());

        await new Promise(r => setTimeout(r, 400));
        this.dom.loading.classList.add('fade-out');
        setTimeout(() => {
            this.dom.loading.classList.add('hidden');
            this.dom.entry.classList.remove('hidden');
        }, 800);

        this.animate();
        this.loadPdfTextures();
    }

    cacheDom() {
        this.dom.canvas = document.getElementById('gallery-canvas');
        this.dom.loading = document.getElementById('loading-screen');
        this.dom.entry = document.getElementById('entry-overlay');
        this.dom.hud = document.getElementById('hud');
        this.dom.preview = document.getElementById('paper-preview');
        this.dom.modal = document.getElementById('paper-modal');
        this.dom.mobileControls = document.getElementById('mobile-controls');
        this.dom.enterBtn = document.getElementById('enter-btn');
        this.dom.minimap = document.getElementById('minimap');

        if (this.isMobile) {
            document.getElementById('desktop-instructions').style.display = 'none';
            document.getElementById('mobile-instructions').style.display = 'flex';
        }
    }

    // --------------------------------------------------------
    // Renderer
    // --------------------------------------------------------
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.dom.canvas,
            antialias: !this.isMobile,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
        this.renderer.shadowMap.enabled = !this.isMobile;
        if (this.renderer.shadowMap.enabled) {
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.3;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    }

    // --------------------------------------------------------
    // Scene
    // --------------------------------------------------------
    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0ebe3);
        this.scene.fog = new THREE.FogExp2(0xf0ebe3, 0.008);
    }

    // --------------------------------------------------------
    // Camera
    // --------------------------------------------------------
    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, CAMERA_HEIGHT, 2);
        this.euler.set(0, 0, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(this.euler);
    }

    // --------------------------------------------------------
    // Lighting
    // --------------------------------------------------------
    setupLighting() {
        this.scene.add(new THREE.AmbientLight(0xfff8f0, 0.85));
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0xe8e0d4, 0.5));

        // Atrium ceiling light
        const spot = new THREE.SpotLight(0xfff8f0, 1.2, 25, Math.PI / 3, 0.7, 1.5);
        spot.position.set(0, ATRIUM_HEIGHT - 0.3, 0);
        spot.target.position.set(0, 0, 0);
        if (!this.isMobile) {
            spot.castShadow = true;
            spot.shadow.mapSize.set(1024, 1024);
        }
        this.scene.add(spot);
        this.scene.add(spot.target);

        // Corridor fill lights
        for (const angle of WING_ANGLES) {
            for (const t of [0.25, 0.55, 0.85]) {
                const d = CORRIDOR_START + (CORRIDOR_END - CORRIDOR_START) * t;
                const light = new THREE.PointLight(0xfff5e6, 0.4, 16, 1.5);
                light.position.set(Math.sin(angle) * d, CORRIDOR_HEIGHT - 0.3, Math.cos(angle) * d);
                this.scene.add(light);
            }
        }
    }

    // --------------------------------------------------------
    // Post Processing
    // --------------------------------------------------------
    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        if (!this.isMobile) {
            const bloom = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.08, 0.3, 0.95
            );
            this.composer.addPass(bloom);
            this.bloomPass = bloom;
        }
    }

    // --------------------------------------------------------
    // Architecture — enclosed gallery
    // --------------------------------------------------------
    buildArchitecture() {
        this.wallMat = new THREE.MeshStandardMaterial({ color: 0xf5f2ed, roughness: 0.88, metalness: 0.0 });
        this.ceilingMat = new THREE.MeshStandardMaterial({ color: 0xfaf9f6, roughness: 0.92, metalness: 0.0 });
        this.trimMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.55, metalness: 0.05 });
        this.accentMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4, metalness: 0.1 });
        this.lightPanelMat = new THREE.MeshStandardMaterial({
            color: 0xffffff, emissive: 0xfff8f0, emissiveIntensity: 0.35, roughness: 0.4
        });

        const floorMat = new THREE.MeshStandardMaterial({
            color: 0xd4c4a8, roughness: 0.4, metalness: 0.05, map: this.createFloorTexture()
        });

        // Floor
        const floor = new THREE.Mesh(new THREE.CircleGeometry(50, 64), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Atrium ceiling
        const aCeiling = new THREE.Mesh(new THREE.CircleGeometry(ATRIUM_RADIUS + 0.5, 64), this.ceilingMat);
        aCeiling.rotation.x = Math.PI / 2;
        aCeiling.position.y = ATRIUM_HEIGHT;
        this.scene.add(aCeiling);

        // Atrium walls (curved, with corridor openings)
        this.buildAtriumWalls();

        // Columns at corridor entrances
        this.buildAtriumColumns();

        // Wing corridors
        for (let i = 0; i < 3; i++) {
            this.buildWing(WING_ANGLES[i]);
        }
    }

    buildAtriumWalls() {
        const R = ATRIUM_RADIUS;
        const segments = 72;
        const segAngle = (Math.PI * 2) / segments;
        const halfGap = Math.asin((CORRIDOR_WIDTH / 2 + 0.4) / R);
        // Exit door gap — between wing 1 and wing 2
        const exitDoorAngle = WING_ANGLES[1] + ((WING_ANGLES[2] - WING_ANGLES[1] + Math.PI * 2) % (Math.PI * 2)) / 2;
        const halfDoorGap = Math.asin(1.0 / R); // ~1m half-width for door

        for (let i = 0; i < segments; i++) {
            const angle = i * segAngle;

            // Skip segments at corridor openings
            let skip = false;
            for (const wingAngle of WING_ANGLES) {
                let diff = angle - wingAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                if (Math.abs(diff) < halfGap) { skip = true; break; }
            }
            // Skip segments at exit door
            if (!skip) {
                let diff = angle - exitDoorAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                if (Math.abs(diff) < halfDoorGap) skip = true;
            }
            if (skip) continue;

            const x = Math.sin(angle) * R;
            const z = Math.cos(angle) * R;
            const segLen = segAngle * R * 1.05; // slight overlap

            const wall = new THREE.Mesh(
                new THREE.BoxGeometry(segLen, ATRIUM_HEIGHT, WALL_THICKNESS),
                this.wallMat
            );
            wall.position.set(x, ATRIUM_HEIGHT / 2, z);
            wall.rotation.y = angle;
            this.scene.add(wall);

            // Baseboard
            const trim = new THREE.Mesh(
                new THREE.BoxGeometry(segLen, 0.14, WALL_THICKNESS + 0.04),
                this.trimMat
            );
            trim.position.set(x, 0.07, z);
            trim.rotation.y = angle;
            this.scene.add(trim);

            // Crown
            const crown = new THREE.Mesh(
                new THREE.BoxGeometry(segLen, 0.1, WALL_THICKNESS + 0.05),
                this.trimMat
            );
            crown.position.set(x, ATRIUM_HEIGHT - 0.05, z);
            crown.rotation.y = angle;
            this.scene.add(crown);
        }
    }

    buildAtriumColumns() {
        const columnGeo = new THREE.CylinderGeometry(COLUMN_RADIUS, COLUMN_RADIUS + 0.03, ATRIUM_HEIGHT - 0.3, 20);
        const capitalGeo = new THREE.CylinderGeometry(COLUMN_RADIUS + 0.08, COLUMN_RADIUS + 0.02, 0.2, 20);
        const baseGeo = new THREE.CylinderGeometry(COLUMN_RADIUS + 0.02, COLUMN_RADIUS + 0.1, 0.15, 20);
        const colMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d4, roughness: 0.5, metalness: 0.02 });

        for (const angle of WING_ANGLES) {
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);
            const rx = cos, rz = -sin;
            const halfW = CORRIDOR_WIDTH / 2 + 0.15;
            const dist = CORRIDOR_START + 0.3;

            for (const side of [-1, 1]) {
                const x = sin * dist + rx * halfW * side;
                const z = cos * dist + rz * halfW * side;

                const col = new THREE.Mesh(columnGeo, colMat);
                col.position.set(x, ATRIUM_HEIGHT / 2, z);
                col.castShadow = true;
                this.scene.add(col);

                const cap = new THREE.Mesh(capitalGeo, colMat);
                cap.position.set(x, ATRIUM_HEIGHT - 0.1, z);
                this.scene.add(cap);

                const base = new THREE.Mesh(baseGeo, colMat);
                base.position.set(x, 0.075, z);
                this.scene.add(base);

                this.columnCenters.push({ x, z });
            }
        }
    }

    buildWing(angle) {
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        const rx = cos, rz = -sin;
        const halfW = CORRIDOR_WIDTH / 2;
        const len = CORRIDOR_END - CORRIDOR_START;
        const midDist = CORRIDOR_START + len / 2;
        const cx = sin * midDist;
        const cz = cos * midDist;

        this.createCorridorWall(cx - rx * halfW, cz - rz * halfW, angle, len, CORRIDOR_HEIGHT);
        this.createCorridorWall(cx + rx * halfW, cz + rz * halfW, angle, len, CORRIDOR_HEIGHT);

        // End wall
        const endX = sin * CORRIDOR_END;
        const endZ = cos * CORRIDOR_END;
        const endWall = new THREE.Mesh(
            new THREE.BoxGeometry(CORRIDOR_WIDTH, CORRIDOR_HEIGHT, WALL_THICKNESS),
            this.wallMat
        );
        endWall.position.set(endX, CORRIDOR_HEIGHT / 2, endZ);
        endWall.rotation.y = angle;
        this.scene.add(endWall);

        const endTrim = new THREE.Mesh(
            new THREE.BoxGeometry(CORRIDOR_WIDTH, 0.14, WALL_THICKNESS + 0.05),
            this.trimMat
        );
        endTrim.position.set(endX, 0.07, endZ);
        endTrim.rotation.y = angle;
        this.scene.add(endTrim);

        // Ceiling
        const ceil = new THREE.Mesh(
            new THREE.BoxGeometry(CORRIDOR_WIDTH + WALL_THICKNESS, 0.12, len),
            this.ceilingMat
        );
        ceil.position.set(cx, CORRIDOR_HEIGHT, cz);
        ceil.rotation.y = angle;
        this.scene.add(ceil);

        // Ceiling light panels
        for (const t of [0.2, 0.5, 0.8]) {
            const d = CORRIDOR_START + len * t;
            const panel = new THREE.Mesh(
                new THREE.BoxGeometry(1.2, 0.03, 2.5),
                this.lightPanelMat
            );
            panel.position.set(sin * d, CORRIDOR_HEIGHT - 0.06, cos * d);
            panel.rotation.y = angle;
            this.scene.add(panel);
        }

        // Blue accent strip along floor center
        const accentStrip = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.005, len - 2),
            this.accentMat
        );
        accentStrip.position.set(cx, 0.003, cz);
        accentStrip.rotation.y = angle;
        this.scene.add(accentStrip);
    }

    createCorridorWall(x, z, angle, length, height) {
        const wall = new THREE.Mesh(
            new THREE.BoxGeometry(WALL_THICKNESS, height, length),
            this.wallMat
        );
        wall.position.set(x, height / 2, z);
        wall.rotation.y = angle;
        this.scene.add(wall);

        const baseboard = new THREE.Mesh(
            new THREE.BoxGeometry(WALL_THICKNESS + 0.04, 0.14, length),
            this.trimMat
        );
        baseboard.position.set(x, 0.07, z);
        baseboard.rotation.y = angle;
        this.scene.add(baseboard);

        const crown = new THREE.Mesh(
            new THREE.BoxGeometry(WALL_THICKNESS + 0.06, 0.1, length),
            this.trimMat
        );
        crown.position.set(x, height - 0.05, z);
        crown.rotation.y = angle;
        this.scene.add(crown);

        // Picture rail
        const rail = new THREE.Mesh(
            new THREE.BoxGeometry(WALL_THICKNESS + 0.02, 0.03, length),
            new THREE.MeshStandardMaterial({ color: 0x9a8568, roughness: 0.5 })
        );
        rail.position.set(x, FRAME_CENTER_Y + FRAME_HEIGHT / 2 + 0.25, z);
        rail.rotation.y = angle;
        this.scene.add(rail);
    }

    createFloorTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#d4c4a8';
        ctx.fillRect(0, 0, 1024, 1024);

        const pw = 28, ph = 40;
        const colors = ['#d4c4a8', '#ccbb9a', '#d9cbb0', '#c8b898', '#ddd0bc'];
        for (let row = 0; row < 1024 / ph + 1; row++) {
            for (let col = 0; col < 1024 / pw + 1; col++) {
                const x = col * pw, y = row * ph;
                ctx.fillStyle = colors[(row * 7 + col * 3) % colors.length];
                ctx.fillRect(x, y, pw - 1, ph - 1);
                ctx.strokeStyle = 'rgba(139, 115, 85, 0.1)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, y, pw - 1, ph - 1);
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(20, 20);
        tex.anisotropy = this.maxAnisotropy;
        return tex;
    }

    // --------------------------------------------------------
    // Wing Entrance Signs
    // --------------------------------------------------------
    buildWingSigns() {
        for (let i = 0; i < 3; i++) {
            const angle = WING_ANGLES[i];
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);
            const d = CORRIDOR_START + 1.5;

            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');

            // Light background
            ctx.fillStyle = '#f5f0e8';
            ctx.fillRect(0, 0, 512, 128);

            // Blue accent bottom line
            const grad = ctx.createLinearGradient(0, 0, 512, 0);
            grad.addColorStop(0, '#2563eb');
            grad.addColorStop(1, '#06b6d4');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 124, 512, 4);

            // Wing label
            ctx.fillStyle = '#64748b';
            ctx.font = '500 20px "Space Grotesk", system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Wing ${String.fromCharCode(65 + i)}`, 256, 48);

            // Wing name
            ctx.fillStyle = '#1e293b';
            ctx.font = '600 28px "Space Grotesk", system-ui, sans-serif';
            ctx.fillText(WING_NAMES[i], 256, 90);

            const tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = this.maxAnisotropy;

            const signMat = new THREE.MeshBasicMaterial({ map: tex });
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), signMat);
            sign.position.set(sin * d, CORRIDOR_HEIGHT - 0.5, cos * d);
            sign.rotation.y = angle + Math.PI;
            this.scene.add(sign);

            // Sign backing
            const backing = new THREE.Mesh(
                new THREE.BoxGeometry(1.84, 0.49, 0.03),
                new THREE.MeshStandardMaterial({ color: 0xe8e0d4, roughness: 0.5, metalness: 0.1 })
            );
            backing.position.set(sin * d, CORRIDOR_HEIGHT - 0.5, cos * d);
            backing.rotation.y = angle + Math.PI;
            this.scene.add(backing);
        }
    }

    // --------------------------------------------------------
    // Atrium Decorative Panels — PoliSim themed
    // --------------------------------------------------------
    buildAtriumDecor() {
        const R = ATRIUM_RADIUS - 0.35;
        const panelData = {
            title: 'PoliSim@CHI 2026',
            lines: [
                'LLM Agent Simulation for Policy',
                '',
                'April 16, 2026 · Barcelona, Spain',
                '',
                'Bridging HCI, NLP, and',
                'policymaking to explore how',
                'LLM agent simulations can',
                'become genuinely useful',
                'tools for policy.'
            ],
            accent: '#2563eb'
        };

        // Place on both non-door wall sections
        const wallIndices = [0, 2];
        for (let idx = 0; idx < wallIndices.length; idx++) {
            const i = wallIndices[idx];
            const a1 = WING_ANGLES[i];
            const a2 = WING_ANGLES[(i + 1) % 3];
            const actualMid = a1 + ((a2 - a1 + Math.PI * 2) % (Math.PI * 2)) / 2;

            const x = Math.sin(actualMid) * R;
            const z = Math.cos(actualMid) * R;
            const panel = panelData;

            // Create large panel texture
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 1024;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#faf8f4';
            ctx.fillRect(0, 0, 1024, 1024);

            // Accent strip left
            ctx.fillStyle = panel.accent;
            ctx.fillRect(0, 0, 10, 1024);

            // Title
            ctx.fillStyle = panel.accent;
            ctx.font = 'bold 80px "Space Grotesk", system-ui, sans-serif';
            ctx.fillText(panel.title, 50, 120);

            // Divider
            ctx.fillStyle = panel.accent + '40';
            ctx.fillRect(50, 150, 500, 4);

            // Content lines
            ctx.fillStyle = '#1e293b';
            ctx.font = '48px "Inter", system-ui, sans-serif';
            panel.lines.forEach((line, j) => {
                ctx.fillText(line, 50, 250 + j * 70);
            });

            // PoliSim URL at bottom
            ctx.fillStyle = '#94a3b8';
            ctx.font = '34px "Inter", system-ui, sans-serif';
            ctx.fillText('polisim.net', 50, 960);

            const tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = this.maxAnisotropy;

            const pw = 3.2, ph = 3.2;
            const panelMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(pw, ph),
                new THREE.MeshBasicMaterial({ map: tex })
            );
            const inX = x - Math.sin(actualMid) * 0.04;
            const inZ = z - Math.cos(actualMid) * 0.04;
            panelMesh.position.set(inX, 2.2, inZ);
            panelMesh.rotation.y = actualMid + Math.PI;
            this.scene.add(panelMesh);

            // Panel frame
            const frameMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.5 });
            const frameBack = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.06, ph + 0.06, 0.03), frameMat);
            frameBack.position.set(x, 2.2, z);
            frameBack.rotation.y = actualMid + Math.PI;
            this.scene.add(frameBack);
        }
    }

    // --------------------------------------------------------
    // Exit Door
    // --------------------------------------------------------
    buildExitDoor() {
        const R = ATRIUM_RADIUS;
        // Place on atrium wall between wing 1 and wing 2
        const a1 = WING_ANGLES[1];
        const a2 = WING_ANGLES[2];
        const doorAngle = a1 + ((a2 - a1 + Math.PI * 2) % (Math.PI * 2)) / 2;

        const x = Math.sin(doorAngle) * R;
        const z = Math.cos(doorAngle) * R;

        // Door frame
        const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x2a1f14, roughness: 0.5, metalness: 0.05 });
        const doorW = 1.2, doorH = 2.6;

        // Frame sides
        const sideGeo = new THREE.BoxGeometry(0.1, doorH, 0.15);
        const leftFrame = new THREE.Mesh(sideGeo, doorFrameMat);
        const rightFrame = new THREE.Mesh(sideGeo, doorFrameMat);

        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.rotation.y = doorAngle + Math.PI;

        leftFrame.position.set(-doorW / 2 - 0.05, doorH / 2, 0);
        rightFrame.position.set(doorW / 2 + 0.05, doorH / 2, 0);
        group.add(leftFrame);
        group.add(rightFrame);

        // Top frame
        const topFrame = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.2, 0.1, 0.15), doorFrameMat);
        topFrame.position.set(0, doorH + 0.05, 0);
        group.add(topFrame);

        // Door surface (clickable)
        const doorCanvas = document.createElement('canvas');
        doorCanvas.width = 256;
        doorCanvas.height = 512;
        const dctx = doorCanvas.getContext('2d');

        // Dark door
        dctx.fillStyle = '#2a1f14';
        dctx.fillRect(0, 0, 256, 512);

        // Panels
        dctx.fillStyle = '#3d2b1f';
        dctx.fillRect(20, 20, 216, 200);
        dctx.fillRect(20, 250, 216, 200);

        // Handle
        dctx.fillStyle = '#c8a96e';
        dctx.beginPath();
        dctx.arc(210, 280, 10, 0, Math.PI * 2);
        dctx.fill();

        const doorTex = new THREE.CanvasTexture(doorCanvas);
        doorTex.colorSpace = THREE.SRGBColorSpace;
        const doorMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(doorW, doorH),
            new THREE.MeshBasicMaterial({ map: doorTex })
        );
        doorMesh.position.set(0, doorH / 2, 0.01);
        group.add(doorMesh);

        // EXIT sign above door
        const exitCanvas = document.createElement('canvas');
        exitCanvas.width = 256;
        exitCanvas.height = 64;
        const ectx = exitCanvas.getContext('2d');

        ectx.fillStyle = '#16a34a';
        ectx.fillRect(0, 0, 256, 64);
        ectx.fillStyle = '#ffffff';
        ectx.font = 'bold 36px "Space Grotesk", system-ui, sans-serif';
        ectx.textAlign = 'center';
        ectx.fillText('EXIT →', 128, 44);

        const exitTex = new THREE.CanvasTexture(exitCanvas);
        exitTex.colorSpace = THREE.SRGBColorSpace;
        const exitSign = new THREE.Mesh(
            new THREE.PlaneGeometry(0.8, 0.2),
            new THREE.MeshBasicMaterial({ map: exitTex })
        );
        exitSign.position.set(0, doorH + 0.25, 0.01);
        group.add(exitSign);

        this.scene.add(group);

        // Register door as clickable
        this.clickTargets.push(doorMesh);
        this.meshToAction.set(doorMesh, { type: 'exit' });

        // Also register for frame raycasting
        this.frameTargets.push(doorMesh);
        this.meshToStand.set(doorMesh, null); // null = not a paper stand

        this.exitDoorPos = { x, z, angle: doorAngle };
    }

    // --------------------------------------------------------
    // Gallery Benches
    // --------------------------------------------------------
    buildBenches() {
        const seatMat = new THREE.MeshStandardMaterial({ color: 0x5a3e2b, roughness: 0.65, metalness: 0.02 });
        const legMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.6, metalness: 0.04 });

        for (const angle of WING_ANGLES) {
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);
            const d = CORRIDOR_START + (CORRIDOR_END - CORRIDOR_START) * 0.5;

            const bench = new THREE.Group();
            const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.45), seatMat);
            seat.position.y = 0.46;
            seat.castShadow = true;
            bench.add(seat);

            const legGeo = new THREE.BoxGeometry(0.06, 0.43, 0.06);
            for (const lx of [-0.6, 0.6]) {
                for (const lz of [-0.16, 0.16]) {
                    const leg = new THREE.Mesh(legGeo, legMat);
                    leg.position.set(lx, 0.215, lz);
                    bench.add(leg);
                }
            }
            const brace = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.04), legMat);
            brace.position.y = 0.15;
            bench.add(brace);

            bench.position.set(sin * d, 0, cos * d);
            bench.rotation.y = angle;
            this.scene.add(bench);
        }
    }

    // --------------------------------------------------------
    // Paper Frames
    // --------------------------------------------------------
    buildStands() {
        const distribution = [9, 8, 8];
        let paperIdx = 0;

        for (let w = 0; w < 3; w++) {
            const angle = WING_ANGLES[w];
            const count = distribution[w];
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);
            const rx = cos, rz = -sin;

            const perSide = Math.ceil(count / 2);
            const leftCount = perSide;
            const rightCount = count - leftCount;
            const spacing = (CORRIDOR_END - CORRIDOR_START - 6) / perSide;
            const startOffset = CORRIDOR_START + 3.5;

            for (let i = 0; i < leftCount; i++) {
                const fwd = startOffset + i * spacing;
                const rgt = -(CORRIDOR_WIDTH / 2 - 0.18);
                this.createStand(papers[paperIdx++], sin * fwd + rx * rgt, cos * fwd + rz * rgt, angle + Math.PI / 2);
            }
            for (let i = 0; i < rightCount; i++) {
                const fwd = startOffset + spacing * 0.5 + i * spacing;
                const rgt = CORRIDOR_WIDTH / 2 - 0.18;
                this.createStand(papers[paperIdx++], sin * fwd + rx * rgt, cos * fwd + rz * rgt, angle - Math.PI / 2);
            }
        }
    }

    createStand(paper, x, z, rotationY) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.rotation.y = rotationY;

        const frameMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.45, metalness: 0.05 });
        const matBoardMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.9 });

        // Back panel
        const backPanel = new THREE.Mesh(
            new THREE.BoxGeometry(FRAME_WIDTH + 0.14, FRAME_HEIGHT + 0.14, 0.025),
            new THREE.MeshStandardMaterial({ color: 0x2a1f14, roughness: 0.9 })
        );
        backPanel.position.set(0, FRAME_CENTER_Y, -0.015);
        group.add(backPanel);

        // Mat board
        const matBoard = new THREE.Mesh(
            new THREE.PlaneGeometry(FRAME_WIDTH + 0.08, FRAME_HEIGHT + 0.08),
            matBoardMat
        );
        matBoard.position.set(0, FRAME_CENTER_Y, 0.0);
        group.add(matBoard);

        // Display surface
        const texture = this.createStandTexture(paper);
        texture.anisotropy = this.maxAnisotropy;
        const displayMat = new THREE.MeshBasicMaterial({ map: texture });
        const display = new THREE.Mesh(new THREE.PlaneGeometry(FRAME_WIDTH, FRAME_HEIGHT), displayMat);
        display.position.set(0, FRAME_CENTER_Y, 0.002);
        group.add(display);

        // Frame border pieces
        const outerW = FRAME_WIDTH + 0.18;
        const outerH = FRAME_HEIGHT + 0.18;
        const bd = 0.09;
        const frameDepth = 0.05;

        const topFrame = new THREE.Mesh(new THREE.BoxGeometry(outerW, bd, frameDepth), frameMat);
        topFrame.position.set(0, FRAME_CENTER_Y + outerH / 2 - bd / 2, 0.01);
        group.add(topFrame);

        const botFrame = topFrame.clone();
        botFrame.position.y = FRAME_CENTER_Y - outerH / 2 + bd / 2;
        group.add(botFrame);

        const sideFrame = new THREE.Mesh(new THREE.BoxGeometry(bd, outerH, frameDepth), frameMat);
        sideFrame.position.set(-outerW / 2 + bd / 2, FRAME_CENTER_Y, 0.01);
        group.add(sideFrame);

        const rightFrame = sideFrame.clone();
        rightFrame.position.x = outerW / 2 - bd / 2;
        group.add(rightFrame);

        // Track light fixture
        const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.3, metalness: 0.5 });
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.04), fixtureMat);
        arm.position.set(0, FRAME_CENTER_Y + FRAME_HEIGHT / 2 + 0.4, 0.1);
        group.add(arm);

        const lamp = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.04, 0.08, 8),
            new THREE.MeshStandardMaterial({
                color: 0x333333, emissive: 0xfff5e6, emissiveIntensity: 0.25, roughness: 0.3, metalness: 0.5
            })
        );
        lamp.rotation.x = Math.PI / 5;
        lamp.position.set(0, FRAME_CENTER_Y + FRAME_HEIGHT / 2 + 0.3, 0.16);
        group.add(lamp);

        // Label
        const labelTex = this.createLabelTexture(paper);
        labelTex.anisotropy = this.maxAnisotropy;
        const label = new THREE.Mesh(
            new THREE.PlaneGeometry(0.8, 0.12),
            new THREE.MeshBasicMaterial({ map: labelTex })
        );
        label.position.set(0, FRAME_CENTER_Y - FRAME_HEIGHT / 2 - 0.16, 0.002);
        group.add(label);

        this.scene.add(group);

        const stand = {
            group, paper, displayMat, displayMesh: display, frameMat,
            position: new THREE.Vector3(x, CAMERA_HEIGHT, z),
            baseFrameColor: new THREE.Color(0x3d2b1f),
            highlightFrameColor: new THREE.Color(0x7a5c3f)
        };
        this.stands.push(stand);
        this.frameTargets.push(display);
        this.meshToStand.set(display, stand);
        this.clickTargets.push(display);
        this.meshToAction.set(display, { type: 'paper', stand });
    }

    createLabelTexture(paper) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 80;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f5f2ed';
        ctx.fillRect(0, 0, 512, 80);
        ctx.fillStyle = '#3d2b1f';
        ctx.font = '600 22px "Space Grotesk", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Paper #${paper.id}`, 256, 48);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }

    createStandTexture(paper) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 768;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#faf8f4';
        ctx.fillRect(0, 0, 1024, 768);

        ctx.strokeStyle = '#e0d8cc';
        ctx.lineWidth = 2;
        ctx.strokeRect(16, 16, 992, 736);

        const grad = ctx.createLinearGradient(0, 0, 1024, 0);
        grad.addColorStop(0, '#2563eb');
        grad.addColorStop(1, '#06b6d4');
        ctx.fillStyle = grad;
        ctx.fillRect(16, 16, 992, 6);

        ctx.fillStyle = '#2563eb';
        ctx.font = 'bold 26px "Space Grotesk", system-ui, sans-serif';
        ctx.fillText(`Paper #${paper.id}`, 44, 68);

        ctx.fillStyle = '#1e293b';
        ctx.font = '600 34px "Space Grotesk", system-ui, sans-serif';
        this.wrapText(ctx, paper.title, 44, 118, 936, 42, 5);

        ctx.fillStyle = '#4b5563';
        ctx.font = '24px "Inter", system-ui, sans-serif';
        this.wrapText(ctx, paper.authors.map(a => a.name).join(', '), 44, 420, 936, 32, 3);

        ctx.fillStyle = 'rgba(37, 99, 235, 0.15)';
        ctx.fillRect(44, 560, 300, 2);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '20px "Inter", system-ui, sans-serif';
        const affils = [...new Set(paper.authors.map(a => a.affiliation))].join(' · ');
        this.wrapText(ctx, affils, 44, 590, 936, 28, 2);

        ctx.fillStyle = '#c4b8a8';
        ctx.font = '18px "Inter", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Click to view details', 512, 720);
        ctx.textAlign = 'left';

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }

    wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
        const words = text.split(' ');
        let line = '';
        let lineNum = 0;
        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            if (ctx.measureText(testLine).width > maxWidth && i > 0) {
                lineNum++;
                if (lineNum >= maxLines) { ctx.fillText(line.trim() + '...', x, y); return; }
                ctx.fillText(line.trim(), x, y);
                line = words[i] + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line.trim(), x, y);
    }

    // --------------------------------------------------------
    // PDF Texture Loading
    // --------------------------------------------------------
    async loadPdfTextures() {
        let pdfjsLib;
        try {
            pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs');
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
        } catch (e) { return; }

        for (const stand of this.stands) {
            const url = stand.paper.pdfUrl;
            if (!url) continue;
            try {
                const pdf = await pdfjsLib.getDocument(url).promise;
                const page = await pdf.getPage(1);
                const origVP = page.getViewport({ scale: 1 });
                const scale = 1024 / origVP.width;
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                const texture = new THREE.CanvasTexture(canvas);
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.anisotropy = this.maxAnisotropy;
                stand.displayMat.map = texture;
                stand.displayMat.needsUpdate = true;
            } catch (e) { /* keep default */ }
        }
    }

    // --------------------------------------------------------
    // Particles
    // --------------------------------------------------------
    createParticles() {
        const count = this.isMobile ? 60 : 150;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const wing = Math.floor(Math.random() * 3);
            const angle = WING_ANGLES[wing];
            const fwd = Math.random() * (CORRIDOR_END - 2) + 2;
            const rgt = (Math.random() - 0.5) * CORRIDOR_WIDTH * 0.7;
            positions[i * 3] = Math.sin(angle) * fwd + Math.cos(angle) * rgt;
            positions[i * 3 + 1] = Math.random() * CORRIDOR_HEIGHT * 0.8 + 0.3;
            positions[i * 3 + 2] = Math.cos(angle) * fwd - Math.sin(angle) * rgt;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.particles = new THREE.Points(geo, new THREE.PointsMaterial({
            color: 0xd4a76a, size: 0.02, transparent: true, opacity: 0.15, depthWrite: false, sizeAttenuation: true
        }));
        this.scene.add(this.particles);
    }

    // --------------------------------------------------------
    // Center Sign
    // --------------------------------------------------------
    createCenterSign() {
        const group = new THREE.Group();
        const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.3, metalness: 0.6 });

        // Post (stops just below the sign bottom at y=1.6)
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.56, 12), postMat);
        post.position.set(0, 0.78, 0);
        group.add(post);

        // Base
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.04, 24), postMat);
        base.position.set(0, 0.02, 0);
        group.add(base);

        // Sign panel
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 800, 400);
        ctx.fillStyle = '#c8a96e';
        ctx.fillRect(40, 30, 720, 3);
        ctx.fillRect(40, 367, 720, 3);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 44px "Space Grotesk", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PoliSim@CHI 2026', 400, 120);

        ctx.font = '26px "Inter", system-ui, sans-serif';
        ctx.fillStyle = '#c8a96e';
        ctx.fillText('LLM Agent Simulation for Policy', 400, 175);

        ctx.font = '20px "Inter", system-ui, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Virtual Paper Gallery · 25 Papers', 400, 230);
        ctx.fillText('Click any frame to read a paper', 400, 270);

        // Blue accent
        const grad = ctx.createLinearGradient(200, 0, 600, 0);
        grad.addColorStop(0, '#2563eb');
        grad.addColorStop(1, '#06b6d4');
        ctx.fillStyle = grad;
        ctx.fillRect(250, 310, 300, 3);

        ctx.font = '18px "Inter", system-ui, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('April 16, 2026 · Barcelona, Spain', 400, 345);

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = this.maxAnisotropy;

        const signMat = new THREE.MeshBasicMaterial({ map: tex });
        const signBack = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.3 });

        const sign1 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), signMat);
        sign1.position.set(0, 2.0, 0.016);
        group.add(sign1);

        const sign2 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), signMat);
        sign2.position.set(0, 2.0, -0.016);
        sign2.rotation.y = Math.PI;
        group.add(sign2);

        const backing = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.84, 0.03), signBack);
        backing.position.y = 2.0;
        group.add(backing);

        this.scene.add(group);
    }

    // --------------------------------------------------------
    // Minimap
    // --------------------------------------------------------
    setupMinimap() {
        if (!this.dom.minimap) return;
        this.dom.minimap.width = 180;
        this.dom.minimap.height = 180;
        this.minimapCtx = this.dom.minimap.getContext('2d');
    }

    drawMinimap() {
        if (!this.minimapCtx) return;
        const ctx = this.minimapCtx;
        const w = 180, h = 180;
        const cx = w / 2, cy = h / 2;
        const s = 2.2;

        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.beginPath();
        ctx.arc(cx, cy, 86, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(139, 115, 85, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Walkable areas
        ctx.fillStyle = 'rgba(212, 196, 168, 0.5)';
        ctx.beginPath();
        ctx.arc(cx, cy, ATRIUM_RADIUS * s, 0, Math.PI * 2);
        ctx.fill();

        for (const angle of WING_ANGLES) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-angle);
            const corrLen = (CORRIDOR_END - CORRIDOR_START) * s;
            const corrW = CORRIDOR_WIDTH * s;
            ctx.fillRect(-corrW / 2, -CORRIDOR_START * s - corrLen, corrW, corrLen);
            ctx.restore();
        }

        // Walls
        ctx.strokeStyle = 'rgba(139, 115, 85, 0.4)';
        ctx.lineWidth = 1.5;

        // Atrium wall circle (with gaps)
        const halfGap = Math.asin((CORRIDOR_WIDTH / 2 + 0.4) / ATRIUM_RADIUS);
        for (let i = 0; i < 3; i++) {
            const a1 = WING_ANGLES[i] + halfGap;
            const a2 = WING_ANGLES[(i + 1) % 3] - halfGap;
            const adjustedA2 = a2 < a1 ? a2 + Math.PI * 2 : a2;
            ctx.beginPath();
            // Canvas arc: angle 0 = right (+x), rotates clockwise
            // Need to convert from our coordinate system
            ctx.arc(cx, cy, ATRIUM_RADIUS * s, -a1 + Math.PI / 2, -(adjustedA2) + Math.PI / 2, true);
            ctx.stroke();
        }

        // Corridor walls
        for (const angle of WING_ANGLES) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-angle);
            const startY = -CORRIDOR_START * s;
            const endY = -CORRIDOR_END * s;
            const halfW = (CORRIDOR_WIDTH / 2) * s;
            ctx.beginPath();
            ctx.moveTo(-halfW, startY); ctx.lineTo(-halfW, endY);
            ctx.moveTo(halfW, startY); ctx.lineTo(halfW, endY);
            ctx.moveTo(-halfW, endY); ctx.lineTo(halfW, endY);
            ctx.stroke();
            ctx.restore();
        }

        // Columns
        ctx.fillStyle = 'rgba(139, 115, 85, 0.5)';
        for (const col of this.columnCenters) {
            ctx.beginPath();
            ctx.arc(cx + col.x * s, cy - col.z * s, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Exit door marker
        if (this.exitDoorPos) {
            const ex = cx + this.exitDoorPos.x * s;
            const ey = cy - this.exitDoorPos.z * s;
            ctx.fillStyle = '#16a34a';
            ctx.beginPath();
            ctx.arc(ex, ey, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Frame positions
        for (const stand of this.stands) {
            const sx = cx + stand.position.x * s;
            const sy = cy - stand.position.z * s;
            ctx.fillStyle = stand === this.hoveredStand ? '#ef4444' : '#2563eb';
            ctx.beginPath();
            ctx.arc(sx, sy, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Player — FIXED direction calculation
        const px = cx + this.camera.position.x * s;
        const py = cy - this.camera.position.z * s;

        const dir = new THREE.Vector3(0, 0, -1);
        dir.applyQuaternion(this.camera.quaternion);
        // Map to minimap coords: (dir.x, -dir.z) is the direction on minimap
        const dirAngle = Math.atan2(dir.x, dir.z);

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-dirAngle);

        // FOV cone
        ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-12, -25);
        ctx.lineTo(12, -25);
        ctx.closePath();
        ctx.fill();

        // Player arrow
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(-5, 5);
        ctx.lineTo(0, 2);
        ctx.lineTo(5, 5);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    // --------------------------------------------------------
    // Controls — always-visible mouse, WASD always works
    // --------------------------------------------------------
    setupControls() {
        // Enter button
        this.dom.enterBtn.addEventListener('click', () => {
            this.dom.entry.classList.add('hidden');
            this.dom.hud.classList.remove('hidden');
            this.controlsActive = true;
            if (this.isMobile) {
                this.dom.mobileControls.classList.remove('hidden');
            }
        });

        // Keyboard — always register regardless of mobile/desktop
        document.addEventListener('keydown', (e) => {
            if (this.modalOpen) {
                if (e.code === 'Escape') this.closeModal();
                return;
            }
            switch (e.code) {
                case 'KeyW': case 'ArrowUp': this.moveForward = true; break;
                case 'KeyS': case 'ArrowDown': this.moveBackward = true; break;
                case 'KeyA': case 'ArrowLeft': this.moveLeft = true; break;
                case 'KeyD': case 'ArrowRight': this.moveRight = true; break;
                case 'ShiftLeft': case 'ShiftRight': this.sprint = true; break;
            }
        });

        document.addEventListener('keyup', (e) => {
            switch (e.code) {
                case 'KeyW': case 'ArrowUp': this.moveForward = false; break;
                case 'KeyS': case 'ArrowDown': this.moveBackward = false; break;
                case 'KeyA': case 'ArrowLeft': this.moveLeft = false; break;
                case 'KeyD': case 'ArrowRight': this.moveRight = false; break;
                case 'ShiftLeft': case 'ShiftRight': this.sprint = false; break;
            }
        });

        // Mouse drag to rotate
        if (!this.isMobile) {
            this.setupMouseControls();
        } else {
            this.setupMobileControls();
        }
    }

    setupMouseControls() {
        const canvas = this.dom.canvas;

        canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || this.modalOpen) return;
            this.isDragging = true;
            this.dragMoved = false;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            canvas.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isDragging && this.controlsActive && !this.modalOpen) {
                const dx = e.clientX - this.lastMouseX;
                const dy = e.clientY - this.lastMouseY;
                this.euler.y -= dx * 0.003;
                this.euler.x -= dy * 0.003;
                this.euler.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.euler.x));
                this.camera.quaternion.setFromEuler(this.euler);

                if (Math.abs(e.clientX - this.dragStartX) > 5 || Math.abs(e.clientY - this.dragStartY) > 5) {
                    this.dragMoved = true;
                }
            }
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;

            if (!this.isDragging && this.controlsActive && !this.modalOpen) {
                this.updateHover(e);
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button !== 0) return;
            const wasDrag = this.dragMoved;
            this.isDragging = false;

            if (!wasDrag && this.controlsActive && !this.modalOpen) {
                this.handleClick(e);
            }
            if (!this.hoveredStand) {
                canvas.style.cursor = 'default';
            } else {
                canvas.style.cursor = 'pointer';
            }
        });
    }

    setupMobileControls() {
        // Joystick
        const joystickZone = document.getElementById('joystick-zone');
        const joystickThumb = document.getElementById('joystick-thumb');
        const joystickBase = document.getElementById('joystick-base');
        let joystickTouchId = null;
        let joystickCenter = { x: 0, y: 0 };

        joystickZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            joystickTouchId = touch.identifier;
            const rect = joystickBase.getBoundingClientRect();
            joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }, { passive: false });

        const updateJoystick = (e) => {
            for (const touch of e.changedTouches) {
                if (touch.identifier === joystickTouchId) {
                    const dx = touch.clientX - joystickCenter.x;
                    const dy = touch.clientY - joystickCenter.y;
                    const maxR = 40;
                    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxR);
                    const ang = Math.atan2(dy, dx);
                    const cx = Math.cos(ang) * dist;
                    const cy = Math.sin(ang) * dist;
                    joystickThumb.style.transform = `translate(${cx}px, ${cy}px)`;
                    this.joystickInput.x = cx / maxR;
                    this.joystickInput.y = cy / maxR;
                }
            }
        };

        joystickZone.addEventListener('touchmove', (e) => { e.preventDefault(); updateJoystick(e); }, { passive: false });
        joystickZone.addEventListener('touchend', (e) => {
            for (const touch of e.changedTouches) {
                if (touch.identifier === joystickTouchId) {
                    joystickTouchId = null;
                    joystickThumb.style.transform = 'translate(0, 0)';
                    this.joystickInput.x = 0;
                    this.joystickInput.y = 0;
                }
            }
        });

        // Touch look + tap
        const canvas = this.dom.canvas;
        let touchStartPos = null;
        let touchMoved = false;

        canvas.addEventListener('touchstart', (e) => {
            for (const touch of e.changedTouches) {
                if (touch.clientX > window.innerWidth * 0.35 && this.lookTouchId === null) {
                    this.lookTouchId = touch.identifier;
                    this.lookPrev = { x: touch.clientX, y: touch.clientY };
                    touchStartPos = { x: touch.clientX, y: touch.clientY };
                    touchMoved = false;
                }
            }
        }, { passive: true });

        canvas.addEventListener('touchmove', (e) => {
            for (const touch of e.changedTouches) {
                if (touch.identifier === this.lookTouchId) {
                    const dx = touch.clientX - this.lookPrev.x;
                    const dy = touch.clientY - this.lookPrev.y;
                    this.lookPrev = { x: touch.clientX, y: touch.clientY };
                    this.euler.y -= dx * 0.003;
                    this.euler.x -= dy * 0.003;
                    this.euler.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.euler.x));
                    this.camera.quaternion.setFromEuler(this.euler);
                    if (touchStartPos && (Math.abs(touch.clientX - touchStartPos.x) > 15 || Math.abs(touch.clientY - touchStartPos.y) > 15)) {
                        touchMoved = true;
                    }
                }
            }
        }, { passive: true });

        canvas.addEventListener('touchend', (e) => {
            for (const touch of e.changedTouches) {
                if (touch.identifier === this.lookTouchId) {
                    if (!touchMoved && !this.modalOpen) {
                        this.handleTouchTap(touch);
                    }
                    this.lookTouchId = null;
                    touchStartPos = null;
                }
            }
        });
    }

    // --------------------------------------------------------
    // Interaction
    // --------------------------------------------------------
    setupInteraction() {
        this.dom.modal.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
        this.dom.modal.querySelector('.modal-backdrop').addEventListener('click', () => this.closeModal());
    }

    updateHover(e) {
        const rect = this.dom.canvas.getBoundingClientRect();
        this.mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouseNDC, this.camera);
        const intersects = this.raycaster.intersectObjects(this.clickTargets);

        const prevHovered = this.hoveredStand;

        if (intersects.length > 0) {
            const action = this.meshToAction.get(intersects[0].object);
            if (action && action.type === 'paper') {
                this.hoveredStand = action.stand;
                this.dom.canvas.style.cursor = 'pointer';
                if (action.stand.paper !== this.currentPreview) {
                    this.showPreview(action.stand.paper);
                }
            } else if (action && action.type === 'exit') {
                this.hoveredStand = null;
                this.dom.canvas.style.cursor = 'pointer';
                if (this.currentPreview) this.hidePreview();
            } else {
                this.hoveredStand = null;
                this.dom.canvas.style.cursor = 'default';
                if (this.currentPreview) this.hidePreview();
            }
        } else {
            this.hoveredStand = null;
            this.dom.canvas.style.cursor = 'default';
            if (this.currentPreview) this.hidePreview();
        }

        if (prevHovered !== this.hoveredStand) {
            if (prevHovered) prevHovered.frameMat.color.copy(prevHovered.baseFrameColor);
            if (this.hoveredStand) this.hoveredStand.frameMat.color.copy(this.hoveredStand.highlightFrameColor);
        }
    }

    handleClick(e) {
        const rect = this.dom.canvas.getBoundingClientRect();
        this.mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouseNDC, this.camera);
        const intersects = this.raycaster.intersectObjects(this.clickTargets);

        if (intersects.length > 0) {
            const action = this.meshToAction.get(intersects[0].object);
            if (action) {
                if (action.type === 'paper') {
                    this.openModal(action.stand.paper);
                } else if (action.type === 'exit') {
                    window.location.href = 'index.html';
                }
            }
        }
    }

    handleTouchTap(touch) {
        const rect = this.dom.canvas.getBoundingClientRect();
        this.mouseNDC.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouseNDC.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouseNDC, this.camera);
        const intersects = this.raycaster.intersectObjects(this.clickTargets);

        if (intersects.length > 0) {
            const action = this.meshToAction.get(intersects[0].object);
            if (action) {
                if (action.type === 'paper') this.openModal(action.stand.paper);
                else if (action.type === 'exit') window.location.href = 'index.html';
            }
        }
    }

    showPreview(paper) {
        this.currentPreview = paper;
        const p = this.dom.preview;
        p.querySelector('.preview-number').textContent = `Paper #${paper.id}`;
        p.querySelector('.preview-title').textContent = paper.title;
        p.querySelector('.preview-authors').textContent = paper.authors.map(a => a.name).join(', ');
        p.querySelector('.preview-abstract').textContent = paper.abstract;
        p.classList.remove('hidden', 'slide-out');
    }

    hidePreview() {
        this.currentPreview = null;
        this.dom.preview.classList.add('slide-out');
        setTimeout(() => { if (!this.currentPreview) this.dom.preview.classList.add('hidden'); }, 300);
    }

    openModal(paper) {
        this.modalOpen = true;
        const m = this.dom.modal;
        m.querySelector('.modal-number').textContent = `Paper #${paper.id}`;
        m.querySelector('.modal-title').textContent = paper.title;
        m.querySelector('.modal-abstract').textContent = paper.abstract;

        m.querySelector('.modal-authors').innerHTML = paper.authors.map(a => {
            const url = a.website && !/^https?:\/\//i.test(a.website) ? 'https://' + a.website : a.website;
            return `<div class="author-card">
                <div class="author-name">${url ? `<a href="${url}" target="_blank">${a.name}</a>` : a.name}</div>
                <div class="author-affiliation">${a.affiliation}</div>
            </div>`;
        }).join('');

        let actionsHtml = `<a href="${paper.pdfUrl}" target="_blank" class="btn-pdf">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            View Paper PDF</a>`;
        if (paper.videoUrl) {
            actionsHtml += `<a href="${paper.videoUrl}" target="_blank" class="btn-video">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Watch Video</a>`;
        }
        m.querySelector('.modal-actions').innerHTML = actionsHtml;

        // Build separate bios section
        const biosContainer = m.querySelector('.modal-bios');
        const authorsWithBios = paper.authors.filter(a => a.bio);
        if (authorsWithBios.length > 0) {
            biosContainer.innerHTML = `
                <div class="modal-bios-label">About the Authors</div>
                ${authorsWithBios.map(a => `<div class="modal-bio-entry">
                    <div class="modal-bio-name">${a.name}</div>
                    <div class="modal-bio-text">${a.bio}</div>
                </div>`).join('')}`;
            biosContainer.style.display = '';
        } else {
            biosContainer.innerHTML = '';
            biosContainer.style.display = 'none';
        }

        m.classList.remove('hidden');
        this.hidePreview();
        this.controlsActive = false;
    }

    closeModal() {
        this.modalOpen = false;
        this.dom.modal.classList.add('hidden');
        this.controlsActive = true;
    }

    // --------------------------------------------------------
    // Collision
    // --------------------------------------------------------
    isInsideWalkableArea(pos) {
        const x = pos.x, z = pos.z, r = PLAYER_RADIUS;

        // Column collision
        for (const col of this.columnCenters) {
            const dx = x - col.x, dz = z - col.z;
            if (dx * dx + dz * dz < (COLUMN_RADIUS + r) * (COLUMN_RADIUS + r)) return false;
        }

        // Center sign (base radius 0.35)
        if (x * x + z * z < (0.35 + r) * (0.35 + r)) return false;

        // Atrium circle
        if (x * x + z * z < (ATRIUM_RADIUS - r) * (ATRIUM_RADIUS - r)) return true;

        // Corridors
        for (const angle of WING_ANGLES) {
            const s = Math.sin(angle), c = Math.cos(angle);
            const fwd = x * s + z * c;
            const rgt = x * c - z * s;
            if (fwd > (CORRIDOR_START - 1) && fwd < (CORRIDOR_END - r) && Math.abs(rgt) < CORRIDOR_WIDTH / 2 - r) {
                return true;
            }
        }
        return false;
    }

    // --------------------------------------------------------
    // Animation Loop
    // --------------------------------------------------------
    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = Math.min(this.clock.getDelta(), 0.05);
        const time = this.clock.getElapsedTime();

        this.updateMovement(delta);
        this.updateParticles(time);
        this.drawMinimap();
        this.composer.render();
    }

    updateMovement(delta) {
        if (!this.controlsActive) return;

        const speed = this.sprint ? SPRINT_SPEED : MOVE_SPEED;

        this.velocity.x -= this.velocity.x * FRICTION * delta;
        this.velocity.z -= this.velocity.z * FRICTION * delta;

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        right.y = 0;
        right.normalize();

        // WASD input (works for both mobile keyboard and desktop)
        const inputZ = Number(this.moveForward) - Number(this.moveBackward);
        const inputX = Number(this.moveRight) - Number(this.moveLeft);
        if (inputZ !== 0) this.velocity.addScaledVector(forward, inputZ * speed * delta);
        if (inputX !== 0) this.velocity.addScaledVector(right, inputX * speed * delta);

        // Mobile joystick
        if (this.isMobile && (Math.abs(this.joystickInput.x) > 0.05 || Math.abs(this.joystickInput.y) > 0.05)) {
            this.velocity.addScaledVector(right, this.joystickInput.x * speed * delta);
            this.velocity.addScaledVector(forward, -this.joystickInput.y * speed * delta);
        }

        const prevX = this.camera.position.x;
        const prevZ = this.camera.position.z;

        this.camera.position.x += this.velocity.x * delta;
        this.camera.position.z += this.velocity.z * delta;
        this.camera.position.y = CAMERA_HEIGHT;

        // Collision — slide
        if (!this.isInsideWalkableArea(this.camera.position)) {
            this.camera.position.z = prevZ;
            if (!this.isInsideWalkableArea(this.camera.position)) {
                this.camera.position.x = prevX;
                this.camera.position.z = prevZ + this.velocity.z * delta;
                if (!this.isInsideWalkableArea(this.camera.position)) {
                    this.camera.position.x = prevX;
                    this.camera.position.z = prevZ;
                    this.velocity.set(0, 0, 0);
                }
            }
        }
    }

    updateParticles(time) {
        if (!this.particles) return;
        const positions = this.particles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length / 3; i++) {
            positions[i * 3 + 1] += Math.sin(time * 0.25 + i * 0.7) * 0.0008;
            if (positions[i * 3 + 1] > CORRIDOR_HEIGHT) positions[i * 3 + 1] = 0.3;
            if (positions[i * 3 + 1] < 0.2) positions[i * 3 + 1] = CORRIDOR_HEIGHT - 0.2;
        }
        this.particles.geometry.attributes.position.needsUpdate = true;
    }

    onResize() {
        const w = window.innerWidth, h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.composer.setSize(w, h);
        if (this.bloomPass) this.bloomPass.resolution.set(w, h);
    }
}

// ============================================================
// Bootstrap
// ============================================================
async function bootstrap() {
    await document.fonts.ready;
    const gallery = new Gallery();
    window._gallery = gallery;
    await gallery.init();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
