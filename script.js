// ==========================================
// RLC Circuit Simulator — Core Engine
// Engineering Validation & Simulation Logic
// ==========================================

class CircuitSimulator {
    constructor() {
        this.currentCircuitType = 'RLC';
        this.currentTheme = 'dark';
        this.parameters = {};
        this.results = [];
        this.calculatedState = null;
        this.isAnimating = false;
        this.animationFrame = null;
        this.lastTimestamp = 0;
        this.phaseOffset = 0;
        this.canvas = null;
        this.ctx = null;
        this.canvasWidth = 800;
        this.canvasHeight = 400;

        // Waveform trace selection and current direction state
        this.selectedWaveform = 'voltage';
        this.currentDirection = 'conventional';
        this.arrowOffset = 0;

        this.viewer3D = null;
        this.phasorDiagram = null;
        this.init();
    }

    init() {
        let initialTheme = 'dark';
        try {
            if (typeof localStorage !== 'undefined') {
                const saved = localStorage.getItem('rlc_sim_theme');
                if (saved === 'light' || saved === 'dark') {
                    initialTheme = saved;
                }
            } else if (typeof document !== 'undefined' && document.documentElement) {
                const attr = document.documentElement.getAttribute('data-theme');
                if (attr === 'light' || attr === 'dark') {
                    initialTheme = attr;
                }
            }
        } catch (e) {
            initialTheme = 'dark';
        }

        this.setupEventListeners();
        this.setupThemeToggle();
        this.setupWaveformSelection();
        this.setupCurrentDirectionToggle();
        this.setTheme(initialTheme, false);
        this.updateInputFields();
        this.setupCanvas();
        this.drawCircuitDiagram();
        this.init3DViewer();
        this.initPhasorDiagram();
    }

    setupWaveformSelection() {
        const buttons = document.querySelectorAll('.legend-item[data-trace]');
        buttons.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                const trace = btn.dataset.trace;
                this.selectWaveform(trace);
            });

            // Keyboard navigation for tablist
            btn.addEventListener('keydown', (e) => {
                let targetIndex = -1;
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    targetIndex = (index + 1) % buttons.length;
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    targetIndex = (index - 1 + buttons.length) % buttons.length;
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    targetIndex = 0;
                } else if (e.key === 'End') {
                    e.preventDefault();
                    targetIndex = buttons.length - 1;
                }

                if (targetIndex >= 0 && buttons[targetIndex]) {
                    if (typeof buttons[targetIndex].focus === 'function') {
                        buttons[targetIndex].focus();
                    }
                    const trace = buttons[targetIndex].dataset.trace;
                    this.selectWaveform(trace);
                }
            });
        });
    }

    selectWaveform(trace) {
        if (!trace) return;
        this.selectedWaveform = trace;
        const buttons = document.querySelectorAll('.legend-item[data-trace]');
        buttons.forEach(btn => {
            const isSelected = btn.dataset.trace === trace;
            if (btn.classList) {
                if (typeof btn.classList.toggle === 'function') {
                    btn.classList.toggle('active', isSelected);
                } else if (isSelected) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
            if (typeof btn.setAttribute === 'function') {
                btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
                btn.setAttribute('tabindex', isSelected ? '0' : '-1');
            }
        });

        // Re-render canvas with solo trace, preserving simulation time & state
        this.renderCurrentState();
    }

    setupCurrentDirectionToggle() {
        const btnDiagram = document.getElementById('btnDiagramCurrentMode');
        if (btnDiagram) {
            btnDiagram.addEventListener('click', () => {
                this.toggleCurrentDirection();
            });
        }

        const btn3D = document.getElementById('btnToggleCurrentMode');
        if (btn3D) {
            btn3D.addEventListener('click', () => {
                this.toggleCurrentDirection();
            });
        }

        this.updateCurrentDirectionButtons();
    }

    toggleCurrentDirection() {
        this.currentDirection = this.currentDirection === 'conventional' ? 'electron' : 'conventional';
        if (this.viewer3D && typeof this.viewer3D.syncCurrentDirection === 'function') {
            this.viewer3D.syncCurrentDirection(this.currentDirection);
        }
        this.updateCurrentDirectionButtons();
        this.updateCircuitDiagramArrows();
    }

    updateCurrentDirectionButtons() {
        const isElectron = this.currentDirection === 'electron';
        const label = isElectron ? 'Current: Electron Flow' : 'Current: Conventional';

        const btnDiagram = document.getElementById('btnDiagramCurrentMode');
        if (btnDiagram) {
            btnDiagram.textContent = label;
            if (btnDiagram.classList) {
                if (typeof btnDiagram.classList.toggle === 'function') {
                    btnDiagram.classList.toggle('active', isElectron);
                } else if (isElectron) {
                    btnDiagram.classList.add('active');
                } else {
                    btnDiagram.classList.remove('active');
                }
            }
            if (typeof btnDiagram.setAttribute === 'function') {
                btnDiagram.setAttribute('aria-pressed', isElectron ? 'true' : 'false');
            }
        }

        const btn3D = document.getElementById('btnToggleCurrentMode');
        if (btn3D) {
            btn3D.textContent = label;
            if (btn3D.classList) {
                if (typeof btn3D.classList.toggle === 'function') {
                    btn3D.classList.toggle('active', isElectron);
                } else if (isElectron) {
                    btn3D.classList.add('active');
                } else {
                    btn3D.classList.remove('active');
                }
            }
        }
    }

    setupThemeToggle() {
        const darkBtn = document.getElementById('themeDarkBtn');
        const lightBtn = document.getElementById('themeLightBtn');

        if (darkBtn) {
            darkBtn.addEventListener('click', () => {
                this.setTheme('dark');
            });
            darkBtn.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (lightBtn) lightBtn.focus();
                }
            });
        }

        if (lightBtn) {
            lightBtn.addEventListener('click', () => {
                this.setTheme('light');
            });
            lightBtn.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (darkBtn) darkBtn.focus();
                }
            });
        }
    }

    setTheme(theme, persist = true) {
        const nextTheme = theme === 'light' ? 'light' : 'dark';
        this.currentTheme = nextTheme;

        if (typeof document !== 'undefined' && document.documentElement) {
            document.documentElement.setAttribute('data-theme', nextTheme);
        }

        if (persist) {
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('rlc_sim_theme', nextTheme);
                }
            } catch (e) { }
        }

        const darkBtn = document.getElementById('themeDarkBtn');
        const lightBtn = document.getElementById('themeLightBtn');

        if (darkBtn && darkBtn.classList) {
            if (typeof darkBtn.classList.toggle === 'function') {
                darkBtn.classList.toggle('active', nextTheme === 'dark');
            } else if (nextTheme === 'dark') {
                darkBtn.classList.add('active');
            } else {
                darkBtn.classList.remove('active');
            }
            if (typeof darkBtn.setAttribute === 'function') {
                darkBtn.setAttribute('aria-checked', nextTheme === 'dark' ? 'true' : 'false');
            }
        }
        if (lightBtn && lightBtn.classList) {
            if (typeof lightBtn.classList.toggle === 'function') {
                lightBtn.classList.toggle('active', nextTheme === 'light');
            } else if (nextTheme === 'light') {
                lightBtn.classList.add('active');
            } else {
                lightBtn.classList.remove('active');
            }
            if (typeof lightBtn.setAttribute === 'function') {
                lightBtn.setAttribute('aria-checked', nextTheme === 'light' ? 'true' : 'false');
            }
        }

        // Dynamically update visuals immediately without reloading
        this.renderCurrentState();
        this.drawCircuitDiagram();

        if (this.viewer3D && typeof this.viewer3D.setTheme === 'function') {
            this.viewer3D.setTheme(nextTheme);
        }
        if (this.phasorDiagram && typeof this.phasorDiagram.setTheme === 'function') {
            this.phasorDiagram.setTheme(nextTheme);
        }
    }

    init3DViewer() {
        if (typeof Circuit3DViewer !== 'undefined') {
            this.viewer3D = new Circuit3DViewer(this);
            this.viewer3D.init();
        }
    }

    update3DViewer() {
        if (this.viewer3D) {
            this.viewer3D.updateCircuit();
        }
    }

    initPhasorDiagram() {
        if (typeof PhasorDiagram !== 'undefined') {
            this.phasorDiagram = new PhasorDiagram(this);
            this.phasorDiagram.init();
        }
    }

    updatePhasorDiagram() {
        if (this.phasorDiagram) {
            this.phasorDiagram.draw();
        }
    }

    setupEventListeners() {
        // Circuit mode selection buttons
        const circuitButtons = document.querySelectorAll('.circuit-btn');
        circuitButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                circuitButtons.forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-selected', 'true');
                this.currentCircuitType = btn.dataset.type;

                this.clearValidationErrors();
                this.updateInputFields();
                this.drawCircuitDiagram();
                this.update3DViewer();
                this.updatePhasorDiagram();

                // If we previously had a valid calculation, re-calculate with new mode
                if (this.calculatedState) {
                    this.calculate();
                }
            });
        });

        // Calculate button
        const calculateBtn = document.getElementById('calculateBtn');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', () => {
                this.calculate();
            });
        }

        // Play/Pause button
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                this.toggleAnimation();
            });
        }

        // Reset button
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetAnimation();
                this.update3DViewer();
                this.updatePhasorDiagram();
            });
        }

        // Real-time diagram update when input values change
        const inputGrid = document.getElementById('inputGrid');
        if (inputGrid) {
            inputGrid.addEventListener('input', () => {
                this.drawCircuitDiagram();
                this.update3DViewer();
            });
        }
    }

    // Input Fields Configuration
    updateInputFields() {
        const inputGrid = document.getElementById('inputGrid');
        if (!inputGrid) return;
        inputGrid.innerHTML = '';

        const commonInputs = [
            { id: 'voltage', label: 'Voltage RMS (V_rms)', unit: 'V', default: 230, min: 0.001, step: 'any' },
            { id: 'frequency', label: 'Frequency (f)', unit: 'Hz', default: 50, min: 0.001, step: 'any' }
        ];

        const componentInputs = {
            'R': [
                { id: 'resistance', label: 'Resistance (R)', unit: 'Ω', default: 100, min: 0.001, step: 'any' }
            ],
            'L': [
                { id: 'inductance', label: 'Inductance (L)', unit: 'H', default: 0.1, min: 0.000001, step: 'any' }
            ],
            'C': [
                { id: 'capacitance', label: 'Capacitance (C)', unit: 'F', default: 0.0001, min: 0.000000001, step: 'any' }
            ],
            'RL': [
                { id: 'resistance', label: 'Resistance (R)', unit: 'Ω', default: 100, min: 0, step: 'any' },
                { id: 'inductance', label: 'Inductance (L)', unit: 'H', default: 0.1, min: 0.000001, step: 'any' }
            ],
            'RC': [
                { id: 'resistance', label: 'Resistance (R)', unit: 'Ω', default: 100, min: 0, step: 'any' },
                { id: 'capacitance', label: 'Capacitance (C)', unit: 'F', default: 0.0001, min: 0.000000001, step: 'any' }
            ],
            'RLC': [
                { id: 'resistance', label: 'Resistance (R)', unit: 'Ω', default: 100, min: 0, step: 'any' },
                { id: 'inductance', label: 'Inductance (L)', unit: 'H', default: 0.1, min: 0.000001, step: 'any' },
                { id: 'capacitance', label: 'Capacitance (C)', unit: 'F', default: 0.0001, min: 0.000000001, step: 'any' }
            ]
        };

        const activeInputs = [...commonInputs, ...(componentInputs[this.currentCircuitType] || [])];

        activeInputs.forEach(config => {
            const inputGroup = this.createInputGroup(config);
            inputGrid.appendChild(inputGroup);
        });
    }

    createInputGroup(config) {
        const div = document.createElement('div');
        div.className = 'input-group';
        div.id = `group-${config.id}`;

        div.innerHTML = `
            <label for="${config.id}">${config.label}</label>
            <div class="input-wrapper">
                <input 
                    type="number" 
                    id="${config.id}" 
                    step="${config.step || 'any'}" 
                    value="${config.default}"
                    placeholder="Enter ${config.label.toLowerCase()}"
                    aria-required="true"
                    aria-invalid="false"
                >
                <span class="input-unit" aria-hidden="true">${config.unit}</span>
            </div>
            <div class="input-error-text" id="err-${config.id}" aria-live="polite"></div>
        `;

        return div;
    }

    // Input Validation
    validateInputs() {
        const errors = [];
        const values = {};

        // Helper to retrieve raw value and parse strictly
        const parseField = (id, fieldName) => {
            const el = document.getElementById(id);
            if (!el) {
                return null;
            }
            const raw = el.value.trim();
            if (raw === '') {
                errors.push({ id, message: `${fieldName} is required and cannot be empty.` });
                return null;
            }
            const num = Number(raw);
            if (isNaN(num) || !isFinite(num)) {
                errors.push({ id, message: `${fieldName} must be a valid finite number.` });
                return null;
            }
            return num;
        };

        // Voltage RMS
        const V = parseField('voltage', 'RMS Voltage');
        if (V !== null) {
            if (V <= 0) {
                errors.push({ id: 'voltage', message: 'RMS Voltage must be strictly positive (V > 0).' });
            } else {
                values.V = V;
            }
        }

        // Frequency
        const f = parseField('frequency', 'Frequency');
        if (f !== null) {
            if (f <= 0) {
                errors.push({ id: 'frequency', message: 'Frequency must be strictly positive (f > 0 Hz) for AC steady-state.' });
            } else {
                values.f = f;
            }
        }

        const type = this.currentCircuitType;

        // Resistance
        if (['R', 'RL', 'RC', 'RLC'].includes(type)) {
            const R = parseField('resistance', 'Resistance');
            if (R !== null) {
                if (R < 0) {
                    errors.push({ id: 'resistance', message: 'Resistance cannot be negative (R ≥ 0 Ω).' });
                } else if (type === 'R' && R === 0) {
                    // Division by zero in pure resistive mode is an ideal short circuit
                    errors.push({ id: 'resistance', message: 'Resistance in a pure resistive circuit must be strictly greater than 0 Ω to prevent a short circuit.' });
                } else {
                    values.R = R;
                }
            }
        }

        // Inductance
        if (['L', 'RL', 'RLC'].includes(type)) {
            const L = parseField('inductance', 'Inductance');
            if (L !== null) {
                if (L <= 0) {
                    errors.push({ id: 'inductance', message: 'Inductance must be strictly positive (L > 0 H).' });
                } else {
                    values.L = L;
                }
            }
        }

        // Capacitance
        if (['C', 'RC', 'RLC'].includes(type)) {
            const C = parseField('capacitance', 'Capacitance');
            if (C !== null) {
                if (C <= 0) {
                    errors.push({ id: 'capacitance', message: 'Capacitance must be strictly positive (C > 0 F).' });
                } else {
                    values.C = C;
                }
            }
        }

        // Physical edge-case validation: RLC with R = 0 at or near resonance
        if (type === 'RLC' && values.R === 0 && values.L > 0 && values.C > 0 && values.f > 0) {
            const fr = 1 / (2 * Math.PI * Math.sqrt(values.L * values.C));
            const omega = 2 * Math.PI * values.f;
            const XL = omega * values.L;
            const XC = 1 / (omega * values.C);
            const X = XL - XC;
            const relDiff = Math.abs(values.f - fr) / fr;

            // Reject if frequency is within 0.5% of resonance or net reactance |X| < 0.05 Ω
            if (Math.abs(X) < 0.05 || relDiff < 0.005) {
                errors.push({
                    id: 'resistance',
                    message: 'Series resonance (f ≈ fr) with R = 0 Ω results in Z ≈ 0 Ω (ideal LC short circuit, I → ∞). Resistance must be greater than 0 Ω.'
                });
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            values
        };
    }

    displayValidationErrors(errors) {
        this.clearValidationErrors();

        const feedbackEl = document.getElementById('validationFeedback');
        if (feedbackEl) {
            feedbackEl.classList.add('visible');
            feedbackEl.innerHTML = `
                <strong>Validation Errors:</strong>
                <ul>
                    ${errors.map(err => `<li>${err.message}</li>`).join('')}
                </ul>
            `;
        }

        errors.forEach(err => {
            const group = document.getElementById(`group-${err.id}`);
            const input = document.getElementById(err.id);
            const errText = document.getElementById(`err-${err.id}`);
            if (group) group.classList.add('has-error');
            if (input) input.setAttribute('aria-invalid', 'true');
            if (errText) errText.textContent = err.message;
        });
    }

    clearValidationErrors() {
        const feedbackEl = document.getElementById('validationFeedback');
        if (feedbackEl) {
            feedbackEl.classList.remove('visible');
            feedbackEl.innerHTML = '';
        }

        document.querySelectorAll('.input-group').forEach(group => {
            group.classList.remove('has-error');
        });

        document.querySelectorAll('.input-group input').forEach(input => {
            input.setAttribute('aria-invalid', 'false');
        });

        document.querySelectorAll('.input-error-text').forEach(el => {
            el.textContent = '';
        });
    }

    // Number formatting helper to prevent NaN and Infinity
    formatValue(val, precision = 2) {
        if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
            return 'Undefined';
        }
        const abs = Math.abs(val);
        if (abs === 0) return (0).toFixed(precision);
        if (abs >= 1e6 || abs < 1e-4) {
            return val.toExponential(precision);
        }
        return val.toFixed(precision);
    }

    formatWithUnit(val, baseUnit) {
        if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
            return `Undefined ${baseUnit}`;
        }
        const abs = Math.abs(val);
        if (abs === 0) return `0 ${baseUnit}`;

        if (baseUnit === 'F') {
            if (abs < 1e-9) return `${(val * 1e12).toFixed(2)} pF`;
            if (abs < 1e-6) return `${(val * 1e9).toFixed(2)} nF`;
            if (abs < 1e-2) return `${(val * 1e6).toFixed(2)} µF`;
            if (abs < 1) return `${(val * 1e3).toFixed(2)} mF`;
            return `${val.toFixed(3)} F`;
        }

        if (baseUnit === 'H') {
            if (abs < 1e-6) return `${(val * 1e6).toFixed(2)} µH`;
            if (abs < 1e-1) return `${(val * 1e3).toFixed(2)} mH`;
            return `${val.toFixed(3)} H`;
        }

        if (baseUnit === 'Ω') {
            if (abs >= 1e6) return `${(val / 1e6).toFixed(2)} MΩ`;
            if (abs >= 1e3) return `${(val / 1e3).toFixed(2)} kΩ`;
            return `${val.toFixed(2)} Ω`;
        }

        if (baseUnit === 'Hz') {
            if (abs >= 1e6) return `${(val / 1e6).toFixed(2)} MHz`;
            if (abs >= 1e3) return `${(val / 1e3).toFixed(2)} kHz`;
            return `${val.toFixed(2)} Hz`;
        }

        return `${val.toFixed(precision || 2)} ${baseUnit}`;
    }

    // Calculation Core
    calculate() {
        const validation = this.validateInputs();
        if (!validation.isValid) {
            this.displayValidationErrors(validation.errors);
            this.calculatedState = null;
            this.updatePhasorDiagram();
            return;
        }

        this.clearValidationErrors();

        const btn = document.getElementById('calculateBtn');
        if (btn) btn.classList.add('calculating');

        // Execute computation
        const { V, f, R, L, C } = validation.values;
        this.parameters = { V, f, R, L, C };

        const omega = 2 * Math.PI * f;
        const Vrms = V;
        const Vmax = V * Math.sqrt(2);

        let resR = 0;
        let XL = 0;
        let XC = 0;
        let fr = null;

        switch (this.currentCircuitType) {
            case 'R':
                resR = R;
                break;
            case 'L':
                XL = omega * L;
                break;
            case 'C':
                XC = 1 / (omega * C);
                break;
            case 'RL':
                resR = R;
                XL = omega * L;
                break;
            case 'RC':
                resR = R;
                XC = 1 / (omega * C);
                break;
            case 'RLC':
                resR = R;
                XL = omega * L;
                XC = 1 / (omega * C);
                fr = 1 / (2 * Math.PI * Math.sqrt(L * C));
                break;
        }

        const netX = XL - XC;
        const Z = Math.sqrt(resR * resR + netX * netX);

        // Guard against zero impedance
        if (Z <= 0 || !isFinite(Z)) {
            this.displayValidationErrors([{
                id: 'resistance',
                message: 'Total impedance evaluated to 0 Ω or is invalid. Division by zero prevented.'
            }]);
            if (btn) btn.classList.remove('calculating');
            return;
        }

        const Irms = Vrms / Z;
        const Imax = Irms * Math.sqrt(2);

        // Phase angle phi = atan2(netX, resR)
        // Voltage reference is v(t) = Vmax * sin(omega * t)
        // Current is i(t) = Imax * sin(omega * t - phi)
        // phi > 0: Inductive (current lags voltage)
        // phi < 0: Capacitive (current leads voltage)
        // phi = 0: In-phase (unity)
        let phiRad = 0;
        if (this.currentCircuitType === 'L') {
            phiRad = Math.PI / 2;
        } else if (this.currentCircuitType === 'C') {
            phiRad = -Math.PI / 2;
        } else {
            phiRad = Math.atan2(netX, resR);
        }

        const phiDeg = phiRad * (180 / Math.PI);

        // Power calculations
        const P = Irms * Irms * resR;           // Real power (W)
        const Q = Irms * Irms * netX;           // Reactive power with consistent sign (VAR)
        const S = Vrms * Irms;                  // Apparent power (VA)

        // Power factor PF = P / S = cos(phi)
        let PF = 1;
        if (S > 0) {
            PF = Math.min(1, Math.max(0, P / S));
        }

        let pfLabel = 'Unity';
        if (phiDeg > 0.001) {
            pfLabel = 'Lagging';
        } else if (phiDeg < -0.001) {
            pfLabel = 'Leading';
        }

        this.calculatedState = {
            Vrms,
            Vmax,
            Irms,
            Imax,
            resR,
            XL,
            XC,
            netX,
            Z,
            phiRad,
            phiDeg,
            P,
            Q,
            S,
            PF,
            pfLabel,
            fr,
            f,
            omega,
            periodSec: 1 / f
        };

        this.buildResultsCards();
        this.displayResults();
        this.drawCircuitDiagram();
        this.update3DViewer();
        this.updatePhasorDiagram();
        this.renderCurrentState();

        // Respect prefers-reduced-motion
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!prefersReducedMotion) {
            this.startAnimation();
        } else {
            this.pauseAnimation();
        }

        if (btn) btn.classList.remove('calculating');
    }

    buildResultsCards() {
        const state = this.calculatedState;
        if (!state) return;

        const commonCards = [
            { label: 'Voltage RMS', formula: 'V<sub>rms</sub> = Input', value: `${this.formatValue(state.Vrms, 2)} V` },
            { label: 'Voltage Peak', formula: 'V<sub>max</sub> = V<sub>rms</sub> × √2', value: `${this.formatValue(state.Vmax, 2)} V` },
            { label: 'Current RMS', formula: 'I<sub>rms</sub> = V<sub>rms</sub> / Z', value: `${this.formatValue(state.Irms, 3)} A` },
            { label: 'Current Peak', formula: 'I<sub>max</sub> = I<sub>rms</sub> × √2', value: `${this.formatValue(state.Imax, 3)} A` }
        ];

        let modeCards = [];

        switch (this.currentCircuitType) {
            case 'R':
                modeCards = [
                    { label: 'Impedance', formula: 'Z = R', value: `${this.formatValue(state.Z, 2)} Ω` },
                    { label: 'Real Power', formula: 'P = V<sub>rms</sub> × I<sub>rms</sub>', value: `${this.formatValue(state.P, 2)} W` },
                    { label: 'Reactive Power', formula: 'Q = 0 VAR', value: `0.00 VAR` },
                    { label: 'Apparent Power', formula: 'S = V<sub>rms</sub> × I<sub>rms</sub>', value: `${this.formatValue(state.S, 2)} VA` },
                    { label: 'Power Factor', formula: 'PF = P / S = 1.0', value: `1.000 (${state.pfLabel})` },
                    { label: 'Phase Angle', formula: 'φ = 0° (In Phase)', value: `0.00°` },
                    { label: 'Angular Frequency', formula: 'ω = 2πf', value: `${this.formatValue(state.omega, 2)} rad/s` }
                ];
                break;

            case 'L':
                modeCards = [
                    { label: 'Inductive Reactance', formula: 'X<sub>L</sub> = 2πfL', value: `${this.formatValue(state.XL, 2)} Ω` },
                    { label: 'Impedance', formula: '|Z| = X<sub>L</sub>', value: `${this.formatValue(state.Z, 2)} Ω` },
                    { label: 'Real Power', formula: 'P = I<sub>rms</sub>² × R = 0', value: `0.00 W` },
                    { label: 'Reactive Power', formula: 'Q = I<sub>rms</sub>² × X<sub>L</sub>', value: `+${this.formatValue(state.Q, 2)} VAR (${state.pfLabel})` },
                    { label: 'Apparent Power', formula: 'S = V<sub>rms</sub> × I<sub>rms</sub>', value: `${this.formatValue(state.S, 2)} VA` },
                    { label: 'Power Factor', formula: 'PF = cos(90°) = 0', value: `0.000 (${state.pfLabel})` },
                    { label: 'Phase Angle', formula: 'φ = +90° (Current Lags)', value: `+90.00°` },
                    { label: 'Angular Frequency', formula: 'ω = 2πf', value: `${this.formatValue(state.omega, 2)} rad/s` }
                ];
                break;

            case 'C':
                modeCards = [
                    { label: 'Capacitive Reactance', formula: 'X<sub>C</sub> = 1/(2πfC)', value: `${this.formatValue(state.XC, 2)} Ω` },
                    { label: 'Impedance', formula: '|Z| = X<sub>C</sub>', value: `${this.formatValue(state.Z, 2)} Ω` },
                    { label: 'Real Power', formula: 'P = I<sub>rms</sub>² × R = 0', value: `0.00 W` },
                    { label: 'Reactive Power', formula: 'Q = -I<sub>rms</sub>² × X<sub>C</sub>', value: `${this.formatValue(state.Q, 2)} VAR (${state.pfLabel})` },
                    { label: 'Apparent Power', formula: 'S = V<sub>rms</sub> × I<sub>rms</sub>', value: `${this.formatValue(state.S, 2)} VA` },
                    { label: 'Power Factor', formula: 'PF = cos(-90°) = 0', value: `0.000 (${state.pfLabel})` },
                    { label: 'Phase Angle', formula: 'φ = -90° (Current Leads)', value: `-90.00°` },
                    { label: 'Angular Frequency', formula: 'ω = 2πf', value: `${this.formatValue(state.omega, 2)} rad/s` }
                ];
                break;

            case 'RL':
                modeCards = [
                    { label: 'Impedance', formula: 'Z = √(R² + X<sub>L</sub>²)', value: `${this.formatValue(state.Z, 2)} Ω` },
                    { label: 'Inductive Reactance', formula: 'X<sub>L</sub> = 2πfL', value: `${this.formatValue(state.XL, 2)} Ω` },
                    { label: 'Phase Angle', formula: 'φ = atan2(X<sub>L</sub>, R)', value: `${state.phiDeg >= 0 ? '+' : ''}${this.formatValue(state.phiDeg, 2)}° (${state.pfLabel})` },
                    { label: 'Real Power', formula: 'P = I<sub>rms</sub>² × R', value: `${this.formatValue(state.P, 2)} W` },
                    { label: 'Reactive Power', formula: 'Q = I<sub>rms</sub>² × X<sub>L</sub>', value: `+${this.formatValue(state.Q, 2)} VAR (${state.pfLabel})` },
                    { label: 'Apparent Power', formula: 'S = V<sub>rms</sub> × I<sub>rms</sub>', value: `${this.formatValue(state.S, 2)} VA` },
                    { label: 'Power Factor', formula: 'PF = P / S = cos(φ)', value: `${this.formatValue(state.PF, 3)} (${state.pfLabel})` },
                    { label: 'Angular Frequency', formula: 'ω = 2πf', value: `${this.formatValue(state.omega, 2)} rad/s` }
                ];
                break;

            case 'RC':
                modeCards = [
                    { label: 'Impedance', formula: 'Z = √(R² + X<sub>C</sub>²)', value: `${this.formatValue(state.Z, 2)} Ω` },
                    { label: 'Capacitive Reactance', formula: 'X<sub>C</sub> = 1/(2πfC)', value: `${this.formatValue(state.XC, 2)} Ω` },
                    { label: 'Phase Angle', formula: 'φ = atan2(-X<sub>C</sub>, R)', value: `${this.formatValue(state.phiDeg, 2)}° (${state.pfLabel})` },
                    { label: 'Real Power', formula: 'P = I<sub>rms</sub>² × R', value: `${this.formatValue(state.P, 2)} W` },
                    { label: 'Reactive Power', formula: 'Q = -I<sub>rms</sub>² × X<sub>C</sub>', value: `${this.formatValue(state.Q, 2)} VAR (${state.pfLabel})` },
                    { label: 'Apparent Power', formula: 'S = V<sub>rms</sub> × I<sub>rms</sub>', value: `${this.formatValue(state.S, 2)} VA` },
                    { label: 'Power Factor', formula: 'PF = P / S = cos(φ)', value: `${this.formatValue(state.PF, 3)} (${state.pfLabel})` },
                    { label: 'Angular Frequency', formula: 'ω = 2πf', value: `${this.formatValue(state.omega, 2)} rad/s` }
                ];
                break;

            case 'RLC':
                modeCards = [
                    { label: 'Impedance', formula: 'Z = √(R² + (X<sub>L</sub>-X<sub>C</sub>)²)', value: `${this.formatValue(state.Z, 2)} Ω` },
                    { label: 'Inductive Reactance', formula: 'X<sub>L</sub> = 2πfL', value: `${this.formatValue(state.XL, 2)} Ω` },
                    { label: 'Capacitive Reactance', formula: 'X<sub>C</sub> = 1/(2πfC)', value: `${this.formatValue(state.XC, 2)} Ω` },
                    { label: 'Net Reactance', formula: 'X = X<sub>L</sub> - X<sub>C</sub>', value: `${state.netX >= 0 ? '+' : ''}${this.formatValue(state.netX, 2)} Ω` },
                    { label: 'Phase Angle', formula: 'φ = atan2(X, R)', value: `${state.phiDeg >= 0 ? '+' : ''}${this.formatValue(state.phiDeg, 2)}° (${state.pfLabel})` },
                    { label: 'Real Power', formula: 'P = I<sub>rms</sub>² × R', value: `${this.formatValue(state.P, 2)} W` },
                    { label: 'Reactive Power', formula: 'Q = I<sub>rms</sub>² × X', value: `${state.Q >= 0 ? '+' : ''}${this.formatValue(state.Q, 2)} VAR (${state.pfLabel})` },
                    { label: 'Apparent Power', formula: 'S = V<sub>rms</sub> × I<sub>rms</sub>', value: `${this.formatValue(state.S, 2)} VA` },
                    { label: 'Power Factor', formula: 'PF = P / S = cos(φ)', value: `${this.formatValue(state.PF, 3)} (${state.pfLabel})` },
                    { label: 'Resonant Frequency', formula: 'f<sub>r</sub> = 1/(2π√(LC))', value: `${this.formatValue(state.fr, 2)} Hz` },
                    { label: 'Angular Frequency', formula: 'ω = 2πf', value: `${this.formatValue(state.omega, 2)} rad/s` }
                ];
                break;
        }

        this.results = [...commonCards, ...modeCards];
    }

    displayResults() {
        const resultsGrid = document.getElementById('resultsGrid');
        if (!resultsGrid) return;
        resultsGrid.innerHTML = '';

        this.results.forEach((result, index) => {
            const resultCard = document.createElement('div');
            resultCard.className = 'result-card';
            resultCard.style.animationDelay = `${index * 0.04}s`;
            resultCard.innerHTML = `
                <div class="result-card-header">
                    <span class="result-label">${result.label}</span>
                </div>
                <div class="result-formula">${result.formula}</div>
                <div class="result-value">${result.value}</div>
            `;
            resultsGrid.appendChild(resultCard);
        });
    }

    // Canvas Setup & Safe DPR Handling
    setupCanvas() {
        this.canvas = document.getElementById('waveformCanvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();

        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }

    resizeCanvas() {
        if (!this.canvas || !this.ctx) return;
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        const displayWidth = Math.max(rect.width, 300);
        const displayHeight = Math.max(rect.height || 400, 250);

        this.canvas.width = Math.round(displayWidth * dpr);
        this.canvas.height = Math.round(displayHeight * dpr);

        // Safe transform reset to prevent exponential scaling on consecutive resizes
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.canvasWidth = displayWidth;
        this.canvasHeight = displayHeight;

        this.renderCurrentState();
    }

    // Animation Controls
    startAnimation() {
        if (this.isAnimating) return; // Prevent multiple concurrent loops

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        this.isAnimating = true;
        this.lastTimestamp = performance.now();
        this.updatePlayPauseButton();
        this.animate(this.lastTimestamp);
    }

    pauseAnimation() {
        this.isAnimating = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.updatePlayPauseButton();
    }

    toggleAnimation() {
        if (this.isAnimating) {
            this.pauseAnimation();
        } else {
            this.startAnimation();
        }
    }

    resetAnimation() {
        this.phaseOffset = 0;
        this.arrowOffset = 0;
        if (this.viewer3D) {
            this.viewer3D.arrowPhase = 0;
        }
        this.lastTimestamp = performance.now();
        this.renderCurrentState();
    }

    updatePlayPauseButton() {
        const btn = document.getElementById('playPauseBtn');
        if (!btn) return;

        if (this.isAnimating) {
            btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><rect x="5" y="3" width="3" height="14"/><rect x="12" y="3" width="3" height="14"/></svg>';
            btn.setAttribute('aria-label', 'Pause waveform animation');
            btn.title = 'Pause';
        } else {
            btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5 3l12 7-12 7V3z"/></svg>';
            btn.setAttribute('aria-label', 'Play waveform animation');
            btn.title = 'Play';
        }
    }

    animate(timestamp) {
        if (!this.isAnimating) return;

        // Elapsed time in seconds with sanity clamping
        const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
        this.lastTimestamp = timestamp;

        // Advance phase smoothly using visual angular velocity (0.5 visual cycles per second = pi rad/s)
        const visualSpeed = Math.PI;
        this.phaseOffset += visualSpeed * dt;
        if (this.phaseOffset > 2 * Math.PI) {
            this.phaseOffset -= 2 * Math.PI;
        }

        // Advance 2D current arrows along wire segments proportional to instantaneous current
        if (this.calculatedState) {
            const phi = this.calculatedState.phiRad || 0;
            const currentAmp = Math.sin(this.phaseOffset - phi);
            const dirMult = this.currentDirection === 'electron' ? -1 : 1;
            const flowSpeed = currentAmp * dirMult;
            this.arrowOffset = (this.arrowOffset || 0) + flowSpeed * dt * 60;
        }

        this.renderCurrentState();

        this.animationFrame = requestAnimationFrame((ts) => this.animate(ts));
    }

    renderCurrentState() {
        this.clearCanvas();
        if (this.calculatedState) {
            this.drawWaveforms();
        }
        this.updateCircuitDiagramArrows();
    }

    clearCanvas() {
        if (!this.ctx) return;
        const isLight = this.currentTheme === 'light';
        this.ctx.fillStyle = isLight ? '#FFFFFF' : '#121212';
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.drawGrid();
    }

    drawGrid() {
        const ctx = this.ctx;
        const isLight = this.currentTheme === 'light';
        ctx.strokeStyle = isLight ? 'rgba(38, 55, 80, 0.08)' : 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;

        // Horizontal grid lines
        for (let y = 0; y < this.canvasHeight; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvasWidth, y);
            ctx.stroke();
        }

        // Vertical grid lines
        for (let x = 0; x < this.canvasWidth; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvasHeight);
            ctx.stroke();
        }

        // Draw horizontal center axis (Zero line)
        const centerY = this.canvasHeight / 2;
        ctx.strokeStyle = isLight ? 'rgba(38, 55, 80, 0.35)' : 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(this.canvasWidth, centerY);
        ctx.stroke();

        // Draw vertical axis (t = 0 line)
        const leftAxisX = 40;
        ctx.strokeStyle = isLight ? 'rgba(38, 55, 80, 0.35)' : 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.moveTo(leftAxisX, 20);
        ctx.lineTo(leftAxisX, this.canvasHeight - 20);
        ctx.stroke();
    }

    // Waveform Rendering
    drawWaveforms() {
        const state = this.calculatedState;
        if (!state) return;

        const ctx = this.ctx;
        const centerY = this.canvasHeight / 2;
        const maxAmplitude = Math.max(40, (this.canvasHeight / 2) - 45);

        // Derive current phase directly from the calculation model
        const phi = state.phiRad;

        // Draw horizontal time and phase axis labels
        this.drawAxisLabels(state.f, state.periodSec);

        // Feature 1: Solo Trace or All Traces Display based on selectedWaveform
        if (this.selectedWaveform === 'all') {
            // Draw all four traces simultaneously
            this.drawWave(maxAmplitude * 0.75, centerY, 0, 'voltage');
            this.drawWave(maxAmplitude * 0.65, centerY, -phi, 'current');
            this.drawInstantaneousPower(maxAmplitude, centerY, phi, state);
            this.drawAveragePowerLine(maxAmplitude, centerY, phi, state);
        } else {
            switch (this.selectedWaveform) {
                case 'voltage':
                    this.drawWave(maxAmplitude * 0.75, centerY, 0, 'voltage');
                    break;
                case 'current':
                    this.drawWave(maxAmplitude * 0.75, centerY, -phi, 'current');
                    break;
                case 'power':
                    this.drawInstantaneousPower(maxAmplitude, centerY, phi, state);
                    break;
                case 'avg-power':
                    this.drawAveragePowerLine(maxAmplitude, centerY, phi, state);
                    break;
                default:
                    this.drawWave(maxAmplitude * 0.75, centerY, 0, 'voltage');
                    break;
            }
        }

        // Header status banner & phase badge
        this.drawScopeHeader(state);
    }

    drawAxisLabels(f, T) {
        const ctx = this.ctx;
        const isLight = this.currentTheme === 'light';
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.fillStyle = isLight ? '#61758F' : '#8a8a8a';
        ctx.textAlign = 'center';

        const Tms = T * 1000;
        // Two complete cycles displayed: 0 to 4π radians, 0 to 2T
        const ticks = [
            { pos: 0.05, rad: '0', t: '0 ms' },
            { pos: 0.275, rad: 'π', t: `${(Tms * 0.5).toFixed(1)} ms` },
            { pos: 0.50, rad: '2π', t: `${(Tms).toFixed(1)} ms` },
            { pos: 0.725, rad: '3π', t: `${(Tms * 1.5).toFixed(1)} ms` },
            { pos: 0.95, rad: '4π', t: `${(Tms * 2).toFixed(1)} ms` }
        ];

        ticks.forEach(tick => {
            const x = tick.pos * this.canvasWidth;
            const y = this.canvasHeight - 10;

            // Subtle vertical marker
            ctx.strokeStyle = isLight ? 'rgba(38, 55, 80, 0.15)' : 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, 30);
            ctx.lineTo(x, this.canvasHeight - 24);
            ctx.stroke();

            // Label text showing both phase and physical time
            ctx.fillText(`${tick.rad} (${tick.t})`, x, y);
        });

        // Horizontal axis title
        ctx.textAlign = 'right';
        ctx.fillStyle = isLight ? '#263750' : '#a0a0a0';
        ctx.fillText(`Time t [ms] (ωt) | f = ${f} Hz, T = ${Tms.toFixed(2)} ms`, this.canvasWidth - 15, this.canvasHeight - 25);
    }

    drawWave(pixelAmp, centerY, phaseOffset, type) {
        const ctx = this.ctx;
        const isLight = this.currentTheme === 'light';
        const colors = isLight ? {
            voltage: { stroke: '#205ec9', shadow: 'rgba(32, 94, 201, 0.25)' },
            current: { stroke: '#d92550', shadow: 'rgba(217, 37, 80, 0.25)' }
        } : {
            voltage: { stroke: '#00d4ff', shadow: 'rgba(0, 212, 255, 0.4)' },
            current: { stroke: '#f5576c', shadow: 'rgba(245, 87, 108, 0.4)' }
        };

        const config = colors[type];
        ctx.strokeStyle = config.stroke;
        ctx.lineWidth = 2.5;
        ctx.beginPath();

        // Screen maps 0 to canvasWidth into 4*pi radians
        const spanRad = 4 * Math.PI;

        for (let x = 0; x < this.canvasWidth; x++) {
            const theta = (x / this.canvasWidth) * spanRad - this.phaseOffset;
            const y = centerY - pixelAmp * Math.sin(theta + phaseOffset);

            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.shadowBlur = 6;
        ctx.shadowColor = config.shadow;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    drawInstantaneousPower(maxAmplitude, centerY, phi, state) {
        const ctx = this.ctx;
        const isLight = this.currentTheme === 'light';

        // Instantaneous power p(t) = v(t) * i(t)
        // Normalized visual amplitude
        const powerScale = maxAmplitude * 0.65;
        const cosPhi = Math.cos(phi);

        ctx.strokeStyle = isLight ? '#059669' : '#00ff88';
        ctx.lineWidth = 2.5;
        ctx.beginPath();

        const spanRad = 4 * Math.PI;

        for (let x = 0; x < this.canvasWidth; x++) {
            const theta = (x / this.canvasWidth) * spanRad - this.phaseOffset;
            // Instantaneous normalized power: p_norm = 2 * sin(theta) * sin(theta - phi) = cos(phi) - cos(2*theta - phi)
            const pNorm = cosPhi - Math.cos(2 * theta - phi);
            const y = centerY - (powerScale * pNorm * 0.5);

            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.shadowBlur = 5;
        ctx.shadowColor = isLight ? 'rgba(5, 150, 105, 0.25)' : 'rgba(0, 255, 136, 0.4)';
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Label annotation
        ctx.fillStyle = isLight ? '#059669' : '#00ff88';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`p(t) = v(t) × i(t) | 2ω ripple`, this.canvasWidth - 15, 42);
    }

    drawAveragePowerLine(maxAmplitude, centerY, phi, state) {
        const ctx = this.ctx;
        const isLight = this.currentTheme === 'light';

        const powerScale = maxAmplitude * 0.65;
        const cosPhi = Math.cos(phi);

        // Average real power line P_avg = Vrms * Irms * cos(phi) (constant horizontal reference line)
        const avgNormY = centerY - (powerScale * cosPhi * 0.5);
        ctx.strokeStyle = isLight ? '#d97706' : '#ffaa00';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([8, 5]);

        ctx.beginPath();
        ctx.moveTo(0, avgNormY);
        ctx.lineTo(this.canvasWidth, avgNormY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label on average power line
        ctx.fillStyle = isLight ? '#b45309' : '#ffaa00';
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`P_avg = ${this.formatValue(state.P, 2)} W  (cos φ = ${this.formatValue(state.PF, 3)})`, this.canvasWidth - 15, avgNormY - 8);
    }

    drawPowerWaveform(maxAmplitude, centerY, phi, state) {
        this.drawInstantaneousPower(maxAmplitude, centerY, phi, state);
        this.drawAveragePowerLine(maxAmplitude, centerY, phi, state);
    }

    drawScopeHeader(state) {
        const ctx = this.ctx;
        const isLight = this.currentTheme === 'light';

        // Trace description
        let traceName = 'Voltage v(t)';
        if (this.selectedWaveform === 'current') traceName = 'Current i(t)';
        else if (this.selectedWaveform === 'power') traceName = 'Instantaneous Power p(t)';
        else if (this.selectedWaveform === 'avg-power') traceName = 'Average Real Power P';
        else if (this.selectedWaveform === 'all') traceName = 'All Traces [v(t), i(t), p(t), P]';

        // Top info bar
        ctx.fillStyle = isLight ? '#61758F' : '#a0a0a0';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Active: ${traceName} | Scale: V_max=±${this.formatValue(state.Vmax, 2)}V | I_max=±${this.formatValue(state.Imax, 2)}A | P_avg=${this.formatValue(state.P, 2)}W`, 15, 20);

        // Phase difference badge on top right
        const phiDegStr = `${state.phiDeg >= 0 ? '+' : ''}${this.formatValue(state.phiDeg, 1)}°`;
        let phaseText = `φ = ${phiDegStr} (${state.pfLabel})`;
        if (Math.abs(state.phiDeg) < 0.001) {
            phaseText = `φ = 0.0° (In Phase, PF = 1.0)`;
        }

        const badgeWidth = 240;
        const badgeHeight = 26;
        const badgeX = this.canvasWidth - badgeWidth - 15;
        const badgeY = 8;

        ctx.fillStyle = isLight ? '#EEF2FB' : '#1a1a1a';
        ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
        ctx.strokeStyle = isLight ? '#648FE8' : '#00d4ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(badgeX, badgeY, badgeWidth, badgeHeight);

        ctx.fillStyle = isLight ? '#205ec9' : '#00d4ff';
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(phaseText, badgeX + badgeWidth / 2, badgeY + 17);
    }

    // Circuit Diagram Rendering
    drawCircuitDiagram() {
        const container = document.getElementById('circuitDiagram');
        if (!container) return;
        container.innerHTML = '';

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 760 320');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('aria-label', `Circuit schematic diagram of series ${this.currentCircuitType} circuit`);

        // Read current input values or defaults
        const V = this.getRawOrFallback('voltage', 230);
        const f = this.getRawOrFallback('frequency', 50);
        const R = this.getRawOrFallback('resistance', 100);
        const L = this.getRawOrFallback('inductance', 0.1);
        const C = this.getRawOrFallback('capacitance', 0.0001);

        const components = this.getCircuitComponents();

        // Diagram layout coordinates
        const leftX = 110;
        const rightX = 650;
        const topY = 95;
        const bottomY = 250;
        const centerY = (topY + bottomY) / 2;

        // Topology Title
        const isLight = this.currentTheme === 'light';
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.setAttribute('x', 380);
        title.setAttribute('y', 35);
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('fill', isLight ? '#263750' : '#e0e0e0');
        title.setAttribute('font-size', '13');
        title.setAttribute('font-weight', '600');
        title.setAttribute('font-family', '"Inter", sans-serif');
        title.setAttribute('letter-spacing', '1.5');
        title.textContent = `SERIES ${this.currentCircuitType} AC CIRCUIT TOPOLOGY`;
        svg.appendChild(title);

        // Draw AC voltage source on the left
        this.drawVoltageSource(svg, leftX, centerY, V, f);

        // Top vertical wire from source top (centerY - 30) to top rail
        this.drawWire(svg, leftX, centerY - 30, leftX, topY);

        // Series current indicator arrow on top rail
        this.drawCurrentArrow(svg, leftX + 35, topY);

        // Component layout along the top rail
        const n = components.length;
        const totalSpan = rightX - leftX - 80;
        const gap = totalSpan / (n + 1);

        let prevEndX = leftX;

        components.forEach((comp, idx) => {
            const compCenterX = leftX + 40 + (idx + 1) * gap;
            const compStartX = compCenterX - 35;
            const compEndX = compCenterX + 35;

            // Wire leading into this component
            this.drawWire(svg, prevEndX, topY, compStartX, topY);

            // Draw component with actual formatted parameter value
            let valStr = '';
            if (comp === 'R') valStr = `R = ${this.formatWithUnit(R, 'Ω')}`;
            if (comp === 'L') valStr = `L = ${this.formatWithUnit(L, 'H')}`;
            if (comp === 'C') valStr = `C = ${this.formatWithUnit(C, 'F')}`;

            this.drawComponent(svg, comp, compCenterX, topY, valStr);
            prevEndX = compEndX;
        });

        // Wire from last component to right corner
        this.drawWire(svg, prevEndX, topY, rightX, topY);

        // Right vertical wire
        this.drawWire(svg, rightX, topY, rightX, bottomY);

        // Bottom horizontal return wire
        this.drawWire(svg, rightX, bottomY, leftX, bottomY);

        // Left vertical return wire to source bottom (centerY + 30)
        this.drawWire(svg, leftX, bottomY, leftX, centerY + 30);

        // Dynamic 2D current arrows layer (Feature 2)
        const arrowsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        arrowsGroup.setAttribute('id', 'circuitCurrentArrows');
        svg.appendChild(arrowsGroup);

        container.appendChild(svg);
        this.updateCircuitDiagramArrows();
    }

    getWireSegments() {
        const leftX = 110;
        const rightX = 650;
        const topY = 95;
        const bottomY = 250;
        const centerY = (topY + bottomY) / 2;

        const segments = [];

        // 1. Left top vertical: source top terminal (110, 142.5) up to corner (110, 95)
        segments.push({
            x1: leftX, y1: centerY - 30,
            x2: leftX, y2: topY
        });

        // 2. Top rail wire segments strictly outside components
        const components = this.getCircuitComponents();
        const n = components.length;
        const totalSpan = rightX - leftX - 80;
        const gap = totalSpan / (n + 1);

        let prevEndX = leftX;
        components.forEach((comp, idx) => {
            const compCenterX = leftX + 40 + (idx + 1) * gap;
            const compStartX = compCenterX - 35;
            const compEndX = compCenterX + 35;

            // Wire leading into this component
            segments.push({
                x1: prevEndX, y1: topY,
                x2: compStartX, y2: topY
            });
            prevEndX = compEndX;
        });

        // Wire from last component to right corner
        segments.push({
            x1: prevEndX, y1: topY,
            x2: rightX, y2: topY
        });

        // 3. Right vertical wire: (650, 95) down to (650, 250)
        segments.push({
            x1: rightX, y1: topY,
            x2: rightX, y2: bottomY
        });

        // 4. Bottom horizontal return wire: (650, 250) left to (110, 250)
        segments.push({
            x1: rightX, y1: bottomY,
            x2: leftX, y2: bottomY
        });

        // 5. Left bottom vertical return wire: (110, 250) up to source bottom terminal (110, 202.5)
        segments.push({
            x1: leftX, y1: bottomY,
            x2: leftX, y2: centerY + 30
        });

        return segments;
    }

    updateCircuitDiagramArrows() {
        const container = document.getElementById('circuitCurrentArrows');
        if (!container) return;

        container.innerHTML = '';

        const state = this.calculatedState;
        if (!state || !state.Imax || state.Imax < 1e-6) {
            return;
        }

        const phi = state.phiRad || 0;
        const currentPhase = this.phaseOffset - phi;
        const currentAmp = Math.sin(currentPhase);
        const absCurrent = Math.abs(currentAmp);

        // Near zero crossing: current is virtually zero, arrows smoothly fade out / become inactive
        if (absCurrent < 0.03) {
            return;
        }

        const dirMult = this.currentDirection === 'electron' ? -1 : 1;
        const isClockwise = (currentAmp * dirMult) >= 0;

        const isLight = this.currentTheme === 'light';
        let arrowColor;
        if (this.currentDirection === 'electron') {
            arrowColor = isLight ? '#d97706' : '#ffe66d';
        } else {
            arrowColor = isLight ? '#205ec9' : '#00d4ff';
        }

        const baseOpacity = Math.min(1, Math.max(0.3, absCurrent));
        const segments = this.getWireSegments();

        segments.forEach(seg => {
            const length = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
            if (length < 20) return;

            const count = Math.max(1, Math.round(length / 50));
            const spacing = length / count;

            const dx = (seg.x2 - seg.x1) / length;
            const dy = (seg.y2 - seg.y1) / length;

            // Angle in degrees: if clockwise, points along (dx, dy); if counter-clockwise, reversed
            const angleRad = isClockwise ? Math.atan2(dy, dx) : Math.atan2(-dy, -dx);
            const angleDeg = angleRad * (180 / Math.PI);

            for (let k = 0; k < count; k++) {
                let dist = ((k + 0.5) * spacing + this.arrowOffset) % length;
                if (dist < 0) dist += length;

                // Edge fade out within 8px of segment ends to prevent popping and strictly avoid crossing components
                let edgeFade = 1;
                const endMargin = 8;
                if (dist < endMargin) {
                    edgeFade = dist / endMargin;
                } else if (dist > length - endMargin) {
                    edgeFade = (length - dist) / endMargin;
                }
                if (edgeFade <= 0.05) continue;

                const arrowX = seg.x1 + dx * dist;
                const arrowY = seg.y1 + dy * dist;
                const opacity = (baseOpacity * edgeFade).toFixed(2);

                const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                polygon.setAttribute('points', '-4.5,-3.5 4.5,0 -4.5,3.5 -2,0');
                polygon.setAttribute('transform', `translate(${arrowX.toFixed(1)}, ${arrowY.toFixed(1)}) rotate(${angleDeg.toFixed(1)})`);
                polygon.setAttribute('fill', arrowColor);
                polygon.setAttribute('opacity', opacity);
                container.appendChild(polygon);
            }
        });
    }

    getCircuitComponents() {
        const type = this.currentCircuitType;
        const list = [];
        if (type.includes('R')) list.push('R');
        if (type.includes('L')) list.push('L');
        if (type.includes('C')) list.push('C');
        return list;
    }

    getRawOrFallback(id, fallback) {
        const el = document.getElementById(id);
        if (!el) return fallback;
        const num = parseFloat(el.value);
        return (!isNaN(num) && isFinite(num)) ? num : fallback;
    }

    drawVoltageSource(svg, x, y, V, f) {
        const isLight = this.currentTheme === 'light';
        // Circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', 30);
        circle.setAttribute('fill', isLight ? '#FFFFFF' : '#121212');
        circle.setAttribute('stroke', isLight ? '#648FE8' : '#667eea');
        circle.setAttribute('stroke-width', '2');
        svg.appendChild(circle);

        // AC Sine wave symbol inside
        const sine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        sine.setAttribute('d', `M ${x - 14} ${y} Q ${x - 7} ${y - 12}, ${x} ${y} T ${x + 14} ${y}`);
        sine.setAttribute('fill', 'none');
        sine.setAttribute('stroke', isLight ? '#648FE8' : '#667eea');
        sine.setAttribute('stroke-width', '2.5');
        svg.appendChild(sine);

        // Label above circle
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.setAttribute('x', x - 45);
        title.setAttribute('y', y - 8);
        title.setAttribute('text-anchor', 'end');
        title.setAttribute('fill', isLight ? '#263750' : '#ffffff');
        title.setAttribute('font-size', '14');
        title.setAttribute('font-weight', '700');
        title.setAttribute('font-family', '"JetBrains Mono", monospace');
        title.textContent = 'Vs';
        svg.appendChild(title);

        // Parameter values below circle
        const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        sub.setAttribute('x', x - 45);
        sub.setAttribute('y', y + 12);
        sub.setAttribute('text-anchor', 'end');
        sub.setAttribute('fill', isLight ? '#61758F' : '#a0a0a0');
        sub.setAttribute('font-size', '11');
        sub.setAttribute('font-family', '"JetBrains Mono", monospace');
        sub.textContent = `${V} V, ${f} Hz`;
        svg.appendChild(sub);
    }

    drawCurrentArrow(svg, x, y) {
        const isLight = this.currentTheme === 'light';
        // Current flow arrow along the top rail indicating series loop
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrowPath.setAttribute('d', `M ${x} ${y - 5} L ${x + 15} ${y} L ${x} ${y + 5}`);
        arrowPath.setAttribute('fill', 'none');
        arrowPath.setAttribute('stroke', isLight ? '#205ec9' : '#00d4ff');
        arrowPath.setAttribute('stroke-width', '2');
        group.appendChild(arrowPath);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x + 8);
        text.setAttribute('y', y - 10);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', isLight ? '#205ec9' : '#00d4ff');
        text.setAttribute('font-size', '11');
        text.setAttribute('font-weight', '700');
        text.setAttribute('font-family', '"JetBrains Mono", monospace');
        text.textContent = 'i(t)';
        group.appendChild(text);

        svg.appendChild(group);
    }

    drawComponent(svg, type, x, y, valueLabel) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        switch (type) {
            case 'R':
                this.drawResistor(group, x, y, valueLabel);
                break;
            case 'L':
                this.drawInductor(group, x, y, valueLabel);
                break;
            case 'C':
                this.drawCapacitor(group, x, y, valueLabel);
                break;
        }

        svg.appendChild(group);
    }

    drawResistor(group, x, y, valueLabel) {
        const isLight = this.currentTheme === 'light';
        // Connecting wires to zigzag
        this.drawWire(group, x - 35, y, x - 25, y);
        this.drawWire(group, x + 25, y, x + 35, y);

        // Zigzag pattern
        const zigzag = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const points = [
            [x - 25, y],
            [x - 20, y - 10],
            [x - 12, y + 10],
            [x - 4, y - 10],
            [x + 4, y + 10],
            [x + 12, y - 10],
            [x + 20, y + 10],
            [x + 25, y]
        ];
        let d = `M ${points[0][0]} ${points[0][1]}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i][0]} ${points[i][1]}`;
        }
        zigzag.setAttribute('d', d);
        zigzag.setAttribute('fill', 'none');
        zigzag.setAttribute('stroke', isLight ? '#d92550' : '#ff6b6b');
        zigzag.setAttribute('stroke-width', '2.5');
        zigzag.setAttribute('stroke-linejoin', 'round');
        group.appendChild(zigzag);

        // Component Symbol
        const sym = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        sym.setAttribute('x', x);
        sym.setAttribute('y', y - 22);
        sym.setAttribute('text-anchor', 'middle');
        sym.setAttribute('fill', isLight ? '#d92550' : '#ff6b6b');
        sym.setAttribute('font-size', '16');
        sym.setAttribute('font-weight', 'bold');
        sym.setAttribute('font-family', '"JetBrains Mono", monospace');
        sym.textContent = 'R';
        group.appendChild(sym);

        // Component Value
        const val = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        val.setAttribute('x', x);
        val.setAttribute('y', y + 26);
        val.setAttribute('text-anchor', 'middle');
        val.setAttribute('fill', isLight ? '#263750' : '#e0e0e0');
        val.setAttribute('font-size', '12');
        val.setAttribute('font-weight', '600');
        val.setAttribute('font-family', '"JetBrains Mono", monospace');
        val.textContent = valueLabel;
        group.appendChild(val);
    }

    drawInductor(group, x, y, valueLabel) {
        const isLight = this.currentTheme === 'light';
        this.drawWire(group, x - 35, y, x - 25, y);
        this.drawWire(group, x + 25, y, x + 35, y);

        // 4 loop helix coil
        const numLoops = 4;
        const loopWidth = 12.5;
        let d = `M ${x - 25} ${y}`;
        for (let i = 0; i < numLoops; i++) {
            const startX = x - 25 + (i * loopWidth);
            d += ` A ${loopWidth / 2} 12 0 0 1 ${startX + loopWidth} ${y}`;
        }

        const coil = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        coil.setAttribute('d', d);
        coil.setAttribute('fill', 'none');
        coil.setAttribute('stroke', isLight ? '#0891b2' : '#4ecdc4');
        coil.setAttribute('stroke-width', '2.5');
        group.appendChild(coil);

        // Symbol
        const sym = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        sym.setAttribute('x', x);
        sym.setAttribute('y', y - 22);
        sym.setAttribute('text-anchor', 'middle');
        sym.setAttribute('fill', isLight ? '#0891b2' : '#4ecdc4');
        sym.setAttribute('font-size', '16');
        sym.setAttribute('font-weight', 'bold');
        sym.setAttribute('font-family', '"JetBrains Mono", monospace');
        sym.textContent = 'L';
        group.appendChild(sym);

        // Value
        const val = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        val.setAttribute('x', x);
        val.setAttribute('y', y + 26);
        val.setAttribute('text-anchor', 'middle');
        val.setAttribute('fill', isLight ? '#263750' : '#e0e0e0');
        val.setAttribute('font-size', '12');
        val.setAttribute('font-weight', '600');
        val.setAttribute('font-family', '"JetBrains Mono", monospace');
        val.textContent = valueLabel;
        group.appendChild(val);
    }

    drawCapacitor(group, x, y, valueLabel) {
        const isLight = this.currentTheme === 'light';
        this.drawWire(group, x - 35, y, x - 8, y);
        this.drawWire(group, x + 8, y, x + 35, y);

        // Two parallel plates
        const plate1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        plate1.setAttribute('x1', x - 8);
        plate1.setAttribute('y1', y - 18);
        plate1.setAttribute('x2', x - 8);
        plate1.setAttribute('y2', y + 18);
        plate1.setAttribute('stroke', isLight ? '#d97706' : '#ffe66d');
        plate1.setAttribute('stroke-width', '3');
        group.appendChild(plate1);

        const plate2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        plate2.setAttribute('x1', x + 8);
        plate2.setAttribute('y1', y - 18);
        plate2.setAttribute('x2', x + 8);
        plate2.setAttribute('y2', y + 18);
        plate2.setAttribute('stroke', isLight ? '#d97706' : '#ffe66d');
        plate2.setAttribute('stroke-width', '3');
        group.appendChild(plate2);

        // Symbol
        const sym = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        sym.setAttribute('x', x);
        sym.setAttribute('y', y - 24);
        sym.setAttribute('text-anchor', 'middle');
        sym.setAttribute('fill', isLight ? '#d97706' : '#ffe66d');
        sym.setAttribute('font-size', '16');
        sym.setAttribute('font-weight', 'bold');
        sym.setAttribute('font-family', '"JetBrains Mono", monospace');
        sym.textContent = 'C';
        group.appendChild(sym);

        // Value
        const val = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        val.setAttribute('x', x);
        val.setAttribute('y', y + 30);
        val.setAttribute('text-anchor', 'middle');
        val.setAttribute('fill', isLight ? '#263750' : '#e0e0e0');
        val.setAttribute('font-size', '12');
        val.setAttribute('font-weight', '600');
        val.setAttribute('font-family', '"JetBrains Mono", monospace');
        val.textContent = valueLabel;
        group.appendChild(val);
    }

    drawWire(parent, x1, y1, x2, y2) {
        const isLight = this.currentTheme === 'light';
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', isLight ? '#61758F' : '#a8a8c8');
        line.setAttribute('stroke-width', '2');
        parent.appendChild(line);
    }
}

// ==========================================
// Phase 3: Interactive 3D Circuit Visualization
// Built on Three.js with Series Topology
// ==========================================

class HelixCurve {
    constructor(radius = 0.65, length = 2.8, turns = 7) {
        if (typeof THREE !== 'undefined' && THREE.Curve) {
            Object.setPrototypeOf(HelixCurve.prototype, THREE.Curve.prototype);
        }
        this.radius = radius;
        this.length = length;
        this.turns = turns;
    }

    getPoint(t, optionalTarget) {
        const x = (t - 0.5) * this.length;
        const angle = t * this.turns * Math.PI * 2;
        const y = Math.cos(angle) * this.radius;
        const z = Math.sin(angle) * this.radius;
        const point = optionalTarget || ((typeof THREE !== 'undefined' && THREE.Vector3) ? new THREE.Vector3() : { x: 0, y: 0, z: 0 });
        point.x = x;
        point.y = y;
        point.z = z;
        return point;
    }
}

if (typeof THREE !== 'undefined' && THREE.Curve) {
    Object.setPrototypeOf(HelixCurve.prototype, THREE.Curve.prototype);
}

class Circuit3DViewer {
    constructor(simulator) {
        this.simulator = simulator;
        this.container = document.getElementById('circuit3DContainer');
        this.canvas = document.getElementById('circuit3DCanvas');
        this.overlay = document.getElementById('labels3DOverlay');
        this.badgeMode = document.getElementById('badge3DMode');
        this.fallback = document.getElementById('fallback3D');

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.circuitGroup = null;
        this.currentArrows = [];
        this.particles = this.currentArrows; // backward-compatible alias
        this.arrowPhase = 0;
        this.wireSegments3D = [];
        this.pathCurve = null;
        this.labelItems = [];

        this.showParticles = true;
        this.showArrows = true;
        this.currentDirection = 'conventional';
        this.showLabels = true;

        this.isInitialized = false;
        this.isDestroyed = false;
        this.animId = null;

        // Camera animation tweening
        this.cameraAnimating = false;
        this.camStartPos = null;
        this.camEndPos = null;
        this.camStartTime = 0;
        this.camDuration = 450;
    }

    init() {
        if (!this.container || !this.canvas) return;
        if (typeof THREE === 'undefined') {
            if (this.fallback) this.fallback.style.display = 'flex';
            return;
        }

        const hasWebGL = (() => {
            try {
                const c = document.createElement('canvas');
                return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
            } catch (e) {
                return false;
            }
        })();

        if (!hasWebGL) {
            if (this.fallback) this.fallback.style.display = 'flex';
            return;
        }

        try {
            this.setupScene();
            this.setupCamera();
            this.setupRenderer();
            this.setupControls();
            this.setupLighting();
            this.setupWorkbench();
            this.setupViewButtons();
            this.setupResizeHandler();

            this.isInitialized = true;
            this.updateCircuit();
            this.startLoop();
        } catch (err) {
            console.warn('3D Circuit Viewer initialization note:', err);
            if (this.fallback) this.fallback.style.display = 'flex';
        }
    }

    setupScene() {
        this.scene = new THREE.Scene();
        const isLight = this.simulator && this.simulator.currentTheme === 'light';
        const bgHex = isLight ? 0xEEF2FB : 0x121212;
        this.scene.background = new THREE.Color(bgHex);
        this.scene.fog = new THREE.FogExp2(bgHex, isLight ? 0.012 : 0.015);
    }

    setupCamera() {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 440;
        this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
        this.camera.position.set(13, 13, 16);
    }

    setupRenderer() {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 440;
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(width, height, false);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    setupControls() {
        if (typeof THREE.OrbitControls === 'function') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.08;
            this.controls.minDistance = 6;
            this.controls.maxDistance = 45;
            this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
    }

    setupLighting() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.65);
        this.scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
        keyLight.position.set(14, 22, 16);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        keyLight.shadow.camera.near = 0.5;
        keyLight.shadow.camera.far = 60;
        keyLight.shadow.camera.left = -15;
        keyLight.shadow.camera.right = 15;
        keyLight.shadow.camera.top = 15;
        keyLight.shadow.camera.bottom = -15;
        keyLight.shadow.bias = -0.0005;
        this.scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x00d4ff, 0.25);
        fillLight.position.set(-14, 10, -12);
        this.scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0x764ba2, 0.3);
        rimLight.position.set(0, 8, -14);
        this.scene.add(rimLight);
    }

    setupWorkbench() {
        const isLight = this.simulator && this.simulator.currentTheme === 'light';
        // Main base slab in dark anodized surface / light pale blue slab
        const benchGeo = new THREE.BoxGeometry(24, 0.6, 15);
        const benchMat = new THREE.MeshStandardMaterial({
            color: isLight ? 0xDCE6FC : 0x1a1a1a,
            roughness: 0.45,
            metalness: 0.15
        });
        const bench = new THREE.Mesh(benchGeo, benchMat);
        bench.position.set(0, -0.3, 0);
        bench.receiveShadow = true;
        this.benchMesh = bench;
        this.scene.add(bench);

        // Lower trim border in dark metallic frame / periwinkle trim
        const trimGeo = new THREE.BoxGeometry(24.2, 0.15, 15.2);
        const trimMat = new THREE.MeshStandardMaterial({
            color: isLight ? 0xBFD0FC : 0x242424,
            roughness: 0.3,
            metalness: 0.5
        });
        const trim = new THREE.Mesh(trimGeo, trimMat);
        trim.position.set(0, -0.65, 0);
        this.trimMesh = trim;
        this.scene.add(trim);

        // Rubber corner feet
        const footGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 16);
        const footMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
        const corners = [
            [-11.2, -7], [11.2, -7],
            [-11.2, 7], [11.2, 7]
        ];
        corners.forEach(([fx, fz]) => {
            const foot = new THREE.Mesh(footGeo, footMat);
            foot.position.set(fx, -0.75, fz);
            this.scene.add(foot);
        });

        // Corner mounting studs
        const studGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16);
        const studMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, metalness: 0.8, roughness: 0.2 });
        corners.forEach(([fx, fz]) => {
            const stud = new THREE.Mesh(studGeo, studMat);
            stud.position.set(fx, 0.05, fz);
            this.scene.add(stud);
        });
    }

    setupViewButtons() {
        const viewButtons = document.querySelectorAll('.btn-3d-view[data-view]');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                if (view !== 'reset') {
                    viewButtons.forEach(b => {
                        if (b.dataset.view !== 'reset') b.classList.remove('active');
                    });
                    btn.classList.add('active');
                }
                this.setCameraView(view);
            });
        });

        const btnToggleParticles = document.getElementById('btnToggleParticles');
        if (btnToggleParticles) {
            btnToggleParticles.addEventListener('click', () => {
                this.showParticles = !this.showParticles;
                btnToggleParticles.classList.toggle('active', this.showParticles);
                btnToggleParticles.textContent = this.showParticles ? 'Show Current' : 'Hide Current';
                this.particles.forEach(p => { p.mesh.visible = this.showParticles; });
            });
        }

        const btnToggleCurrentMode = document.getElementById('btnToggleCurrentMode');
        if (btnToggleCurrentMode) {
            btnToggleCurrentMode.addEventListener('click', () => {
                if (this.simulator && typeof this.simulator.toggleCurrentDirection === 'function') {
                    this.simulator.toggleCurrentDirection();
                } else {
                    this.syncCurrentDirection(this.currentDirection === 'conventional' ? 'electron' : 'conventional');
                }
            });
        }

        const btnToggleLabels = document.getElementById('btnToggleLabels');
        if (btnToggleLabels) {
            btnToggleLabels.addEventListener('click', () => {
                this.showLabels = !this.showLabels;
                btnToggleLabels.classList.toggle('active', this.showLabels);
                btnToggleLabels.textContent = this.showLabels ? 'Show Values' : 'Hide Values';
                if (this.overlay) {
                    this.overlay.style.display = this.showLabels ? 'block' : 'none';
                }
            });
        }
    }

    syncCurrentDirection(dir) {
        this.currentDirection = dir;
        const btnToggleCurrentMode = document.getElementById('btnToggleCurrentMode');
        if (btnToggleCurrentMode) {
            btnToggleCurrentMode.classList.toggle('active', dir === 'electron');
            btnToggleCurrentMode.textContent = dir === 'conventional' ? 'Current: Conventional' : 'Current: Electron Flow';
        }
        const isLight = this.simulator && this.simulator.currentTheme === 'light';
        let col;
        if (dir === 'electron') {
            col = isLight ? 0xd97706 : 0xffe66d;
        } else {
            col = isLight ? 0x205ec9 : 0x00d4ff;
        }
        if (this.currentArrows) {
            this.currentArrows.forEach(a => {
                if (a.mat) {
                    if (a.mat.color && typeof a.mat.color.setHex === 'function') a.mat.color.setHex(col);
                    if (a.mat.emissive && typeof a.mat.emissive.setHex === 'function') a.mat.emissive.setHex(col);
                } else if (a.mesh && a.mesh.material && a.mesh.material.color) {
                    a.mesh.material.color.setHex(col);
                }
            });
        }
    }

    setTheme(theme) {
        if (!this.scene) return;
        const isLight = theme === 'light';
        const bgHex = isLight ? 0xEEF2FB : 0x121212;
        if (this.scene.background && typeof this.scene.background.setHex === 'function') {
            this.scene.background.setHex(bgHex);
        } else if (typeof THREE !== 'undefined' && THREE.Color) {
            this.scene.background = new THREE.Color(bgHex);
        }
        if (this.scene.fog) {
            this.scene.fog.color.setHex(bgHex);
            this.scene.fog.density = isLight ? 0.012 : 0.015;
        }
        if (this.benchMesh && this.benchMesh.material) {
            this.benchMesh.material.color.setHex(isLight ? 0xDCE6FC : 0x1a1a1a);
        }
        if (this.trimMesh && this.trimMesh.material) {
            this.trimMesh.material.color.setHex(isLight ? 0xBFD0FC : 0x242424);
        }
        this.syncCurrentDirection(this.currentDirection);
        this.updateCircuit();
    }

    setCameraView(view) {
        if (!this.camera || !this.controls) return;
        const views = {
            iso: { pos: new THREE.Vector3(13, 13, 16), target: new THREE.Vector3(0, 0, 0) },
            front: { pos: new THREE.Vector3(0, 3, 21), target: new THREE.Vector3(0, 0.5, 0) },
            top: { pos: new THREE.Vector3(0, 24, 0.01), target: new THREE.Vector3(0, 0, 0) },
            reset: { pos: new THREE.Vector3(13, 13, 16), target: new THREE.Vector3(0, 0, 0) }
        };
        const cfg = views[view] || views.iso;
        this.camStartPos = this.camera.position.clone();
        this.camEndPos = cfg.pos.clone();
        this.controls.target.copy(cfg.target);
        this.camStartTime = performance.now();
        this.cameraAnimating = true;
    }

    setupResizeHandler() {
        window.addEventListener('resize', () => this.onResize());
        if (typeof ResizeObserver !== 'undefined' && this.container) {
            new ResizeObserver(() => this.onResize()).observe(this.container);
        }
    }

    onResize() {
        if (!this.container || !this.camera || !this.renderer) return;
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 440;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    }

    updateCircuit() {
        if (!this.isInitialized || !this.scene) return;

        // Clean previous circuit group
        if (this.circuitGroup) {
            this.disposeGroup(this.circuitGroup);
            this.scene.remove(this.circuitGroup);
            this.circuitGroup = null;
        }

        // Clean HTML badges
        if (this.overlay) {
            this.overlay.innerHTML = '';
        }
        this.labelItems = [];

        this.circuitGroup = new THREE.Group();
        this.scene.add(this.circuitGroup);

        const type = this.simulator.currentCircuitType || 'RLC';
        if (this.badgeMode) {
            const labels = {
                'R': 'Pure Resistive (R)',
                'L': 'Pure Inductive (L)',
                'C': 'Pure Capacitive (C)',
                'RL': 'Series RL Circuit',
                'RC': 'Series RC Circuit',
                'RLC': 'Series RLC Circuit'
            };
            this.badgeMode.textContent = labels[type] || `Series ${type}`;
        }

        const V = this.simulator.getRawOrFallback('voltage', 230);
        const f = this.simulator.getRawOrFallback('frequency', 50);
        const R = this.simulator.getRawOrFallback('resistance', 100);
        const L = this.simulator.getRawOrFallback('inductance', 0.1);
        const C = this.simulator.getRawOrFallback('capacitance', 0.0001);

        const components = this.simulator.getCircuitComponents();

        // 1. AC Voltage Source at X = -8, Z = 0
        const sourceGroup = this.createACSource(V, f);
        sourceGroup.position.set(-8, 0, 0);
        this.circuitGroup.add(sourceGroup);
        this.addLabelItem(sourceGroup, 'AC Source', `${V} V · ${f} Hz`, 'badge-source');

        // 2. Passive components along top rail Z = -4
        const compPositions = [];
        const n = components.length;
        if (n === 1) {
            compPositions.push({ comp: components[0], x: 0 });
        } else if (n === 2) {
            compPositions.push({ comp: components[0], x: -3.2 });
            compPositions.push({ comp: components[1], x: +3.2 });
        } else if (n === 3) {
            compPositions.push({ comp: components[0], x: -4.5 });
            compPositions.push({ comp: components[1], x: 0 });
            compPositions.push({ comp: components[2], x: +4.5 });
        }

        compPositions.forEach(cp => {
            let mesh = null;
            let title = '';
            let valStr = '';
            let badgeClass = '';

            if (cp.comp === 'R') {
                mesh = this.createResistor();
                title = 'Resistor';
                valStr = `R = ${this.simulator.formatWithUnit(R, 'Ω')}`;
                badgeClass = 'badge-r';
            } else if (cp.comp === 'L') {
                mesh = this.createInductor();
                title = 'Inductor';
                valStr = `L = ${this.simulator.formatWithUnit(L, 'H')}`;
                badgeClass = 'badge-l';
            } else if (cp.comp === 'C') {
                mesh = this.createCapacitor();
                title = 'Capacitor';
                valStr = `C = ${this.simulator.formatWithUnit(C, 'F')}`;
                badgeClass = 'badge-c';
            }

            if (mesh) {
                mesh.position.set(cp.x, 0, -4);
                this.circuitGroup.add(mesh);
                this.addLabelItem(mesh, title, valStr, badgeClass);
            }
        });

        // 3. Complete Series Loop Wiring
        this.createWiring(compPositions);

        // 4. Directional current flow arrows along connected wire paths
        this.createCurrentArrows(compPositions);
    }

    createACSource(V, f) {
        const group = new THREE.Group();
        const isLight = this.simulator && this.simulator.currentTheme === 'light';

        // Cylindrical generator housing
        const bodyGeo = new THREE.CylinderGeometry(1.6, 1.8, 1.1, 32);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: isLight ? 0xFFFFFF : 0x242424,
            roughness: 0.35,
            metalness: isLight ? 0.15 : 0.4
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.55;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // Top blue bezel ring
        const bezelGeo = new THREE.TorusGeometry(1.6, 0.1, 16, 32);
        const bezelMat = new THREE.MeshStandardMaterial({
            color: isLight ? 0x648FE8 : 0x00d4ff,
            roughness: 0.2,
            metalness: 0.7
        });
        const bezel = new THREE.Mesh(bezelGeo, bezelMat);
        bezel.rotation.x = Math.PI / 2;
        bezel.position.y = 1.1;
        group.add(bezel);

        // AC Sine wave symbol on top face
        const sinePoints = [];
        for (let i = 0; i <= 32; i++) {
            const t = (i / 32) * Math.PI * 2;
            const sx = (i / 32 - 0.5) * 1.8;
            const sz = Math.sin(t) * 0.55;
            sinePoints.push(new THREE.Vector3(sx, 1.15, sz));
        }
        const sineCurve = new THREE.CatmullRomCurve3(sinePoints);
        const sineGeo = new THREE.TubeGeometry(sineCurve, 32, 0.06, 8, false);
        const sineMat = new THREE.MeshStandardMaterial({
            color: isLight ? 0x648FE8 : 0x00d4ff,
            roughness: 0.2,
            metalness: 0.6
        });
        const sine = new THREE.Mesh(sineGeo, sineMat);
        group.add(sine);

        // Terminal binding posts:
        // Top terminal (Z = -2.5) with red collar (+)
        const postGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.7, 16);
        const brassMat = new THREE.MeshStandardMaterial({ color: 0xD97706, roughness: 0.2, metalness: 0.85 });
        const redMat = new THREE.MeshStandardMaterial({ color: 0xEF4444, roughness: 0.4 });
        const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });

        const postTop = new THREE.Mesh(postGeo, brassMat);
        postTop.position.set(0, 0.35, -2.5);
        postTop.castShadow = true;
        group.add(postTop);

        const collarTop = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.25, 16), redMat);
        collarTop.position.set(0, 0.35, -2.5);
        group.add(collarTop);

        // Bottom terminal (Z = +2.5) with black collar (-)
        const postBot = new THREE.Mesh(postGeo, brassMat);
        postBot.position.set(0, 0.35, +2.5);
        postBot.castShadow = true;
        group.add(postBot);

        const collarBot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.25, 16), blackMat);
        collarBot.position.set(0, 0.35, +2.5);
        group.add(collarBot);

        // Internal leads connecting generator body to terminal posts
        const leadGeoTop = new THREE.CylinderGeometry(0.06, 0.06, 1.0, 12);
        const leadMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.8, roughness: 0.2 });
        const leadTop = new THREE.Mesh(leadGeoTop, leadMat);
        leadTop.rotation.x = Math.PI / 2;
        leadTop.position.set(0, 0.35, -2.0);
        group.add(leadTop);

        const leadBot = new THREE.Mesh(leadGeoTop, leadMat);
        leadBot.rotation.x = Math.PI / 2;
        leadBot.position.set(0, 0.35, +2.0);
        group.add(leadBot);

        return group;
    }

    createResistor() {
        const group = new THREE.Group();

        // Main cylindrical ceramic body along X
        const bodyGeo = new THREE.CylinderGeometry(0.55, 0.55, 2.6, 24);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xF3E8D2, // ceramic bone/beige
            roughness: 0.6,
            metalness: 0.05
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.z = Math.PI / 2;
        body.position.y = 0.6;
        body.castShadow = true;
        group.add(body);

        // Chrome metallic end caps
        const capGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.3, 24);
        const capMat = new THREE.MeshStandardMaterial({
            color: 0xCBD5E1,
            roughness: 0.2,
            metalness: 0.85
        });
        const cap1 = new THREE.Mesh(capGeo, capMat);
        cap1.rotation.z = Math.PI / 2;
        cap1.position.set(-1.3, 0.6, 0);
        cap1.castShadow = true;
        group.add(cap1);

        const cap2 = new THREE.Mesh(capGeo, capMat);
        cap2.rotation.z = Math.PI / 2;
        cap2.position.set(+1.3, 0.6, 0);
        cap2.castShadow = true;
        group.add(cap2);

        // 4 Resistor color bands
        const bandColors = [0x8B4513, 0x1E293B, 0xDC2626, 0xF59E0B]; // Brown, Black, Red, Gold
        const bandXs = [-0.7, -0.2, 0.3, 0.8];
        const bandGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.15, 24);
        bandXs.forEach((bx, idx) => {
            const bMat = new THREE.MeshStandardMaterial({
                color: bandColors[idx],
                roughness: 0.4
            });
            const band = new THREE.Mesh(bandGeo, bMat);
            band.rotation.z = Math.PI / 2;
            band.position.set(bx, 0.6, 0);
            group.add(band);
        });

        // Axial lead wires extending horizontally
        const leadGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 12);
        const leadMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.8, roughness: 0.2 });

        const leadL = new THREE.Mesh(leadGeo, leadMat);
        leadL.rotation.z = Math.PI / 2;
        leadL.position.set(-1.8, 0.6, 0);
        group.add(leadL);

        const leadR = new THREE.Mesh(leadGeo, leadMat);
        leadR.rotation.z = Math.PI / 2;
        leadR.position.set(+1.8, 0.6, 0);
        group.add(leadR);

        return group;
    }

    createInductor() {
        const group = new THREE.Group();

        // Helical copper coil
        const helix = new HelixCurve(0.65, 2.8, 7);
        const coilGeo = new THREE.TubeGeometry(helix, 90, 0.08, 12, false);
        const coilMat = new THREE.MeshStandardMaterial({
            color: 0xC87533, // shiny copper
            roughness: 0.22,
            metalness: 0.88
        });
        const coil = new THREE.Mesh(coilGeo, coilMat);
        coil.position.y = 0.65;
        coil.castShadow = true;
        group.add(coil);

        // Internal ferrite core cylinder
        const coreGeo = new THREE.CylinderGeometry(0.32, 0.32, 3.4, 20);
        const coreMat = new THREE.MeshStandardMaterial({
            color: 0x334155, // dark ferrite slate
            roughness: 0.7,
            metalness: 0.25
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.rotation.z = Math.PI / 2;
        core.position.y = 0.65;
        core.castShadow = true;
        group.add(core);

        // Mounting pedestals
        const pedGeo = new THREE.BoxGeometry(0.3, 0.65, 0.8);
        const pedMat = new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.5, metalness: 0.2 });
        const ped1 = new THREE.Mesh(pedGeo, pedMat);
        ped1.position.set(-1.5, 0.325, 0);
        group.add(ped1);

        const ped2 = new THREE.Mesh(pedGeo, pedMat);
        ped2.position.set(+1.5, 0.325, 0);
        group.add(ped2);

        // Axial wire leads extending out
        const leadGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 12);
        const leadMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.8, roughness: 0.2 });

        const leadL = new THREE.Mesh(leadGeo, leadMat);
        leadL.rotation.z = Math.PI / 2;
        leadL.position.set(-1.8, 0.65, 0);
        group.add(leadL);

        const leadR = new THREE.Mesh(leadGeo, leadMat);
        leadR.rotation.z = Math.PI / 2;
        leadR.position.set(+1.8, 0.65, 0);
        group.add(leadR);

        return group;
    }

    createCapacitor() {
        const group = new THREE.Group();

        // Two parallel conductive aluminium plates
        const plateGeo = new THREE.BoxGeometry(0.12, 2.2, 2.2);
        const plateMat = new THREE.MeshStandardMaterial({
            color: 0xCBD5E1, // polished aluminium
            roughness: 0.15,
            metalness: 0.92
        });

        // Plate 1 (Left)
        const plate1 = new THREE.Mesh(plateGeo, plateMat);
        plate1.position.set(-0.38, 1.1, 0);
        plate1.castShadow = true;
        group.add(plate1);

        // Plate 2 (Right)
        const plate2 = new THREE.Mesh(plateGeo, plateMat);
        plate2.position.set(+0.38, 1.1, 0);
        plate2.castShadow = true;
        group.add(plate2);

        // Insulating base standoff
        const baseGeo = new THREE.BoxGeometry(1.4, 0.3, 2.4);
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x242424,
            roughness: 0.4,
            metalness: 0.2
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.set(0, 0.15, 0);
        group.add(base);

        // Connecting leads attached to outer faces
        const leadGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 12);
        const leadMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.8, roughness: 0.2 });

        const leadL = new THREE.Mesh(leadGeo, leadMat);
        leadL.rotation.z = Math.PI / 2;
        leadL.position.set(-1.25, 0.65, 0);
        group.add(leadL);

        const leadR = new THREE.Mesh(leadGeo, leadMat);
        leadR.rotation.z = Math.PI / 2;
        leadR.position.set(+1.25, 0.65, 0);
        group.add(leadR);

        return group;
    }

    createWiring(compPositions) {
        const wireGroup = new THREE.Group();
        const wireMat = new THREE.MeshStandardMaterial({
            color: 0x94A3B8, // tinned copper wire
            metalness: 0.8,
            roughness: 0.25
        });
        const studMat = new THREE.MeshStandardMaterial({
            color: 0xD97706, // gold brass terminal post
            metalness: 0.85,
            roughness: 0.2
        });

        const wireY = 0.35;
        const cornerCorners = [
            [-8, -4],
            [+8, -4],
            [+8, +4],
            [-8, +4]
        ];

        // 4 Corner terminal junction studs
        const studGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.45, 16);
        cornerCorners.forEach(([cx, cz]) => {
            const stud = new THREE.Mesh(studGeo, studMat);
            stud.position.set(cx, wireY, cz);
            stud.castShadow = true;
            wireGroup.add(stud);
        });

        // Helper to add cylindrical wire segment between two points
        const addWireSegment = (p1, p2) => {
            const v1 = new THREE.Vector3(p1[0], wireY, p1[1]);
            const v2 = new THREE.Vector3(p2[0], wireY, p2[1]);
            const dist = v1.distanceTo(v2);
            if (dist < 0.01) return;

            const geo = new THREE.CylinderGeometry(0.06, 0.06, dist, 12);
            const mesh = new THREE.Mesh(geo, wireMat);
            mesh.castShadow = true;

            // Position at midpoint
            mesh.position.copy(v1).add(v2).multiplyScalar(0.5);

            // Orient towards v2
            mesh.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                v2.clone().sub(v1).normalize()
            );
            wireGroup.add(mesh);
        };

        // Wire 1: From Source Top terminal (-8, -2.5) to Corner 1 (-8, -4)
        addWireSegment([-8, -2.5], [-8, -4]);

        // Top Rail Wires:
        if (compPositions.length > 0) {
            // From Corner 1 (-8, -4) to first component entrance
            const firstEntranceX = compPositions[0].x - 2.1;
            addWireSegment([-8, -4], [firstEntranceX, -4]);

            // Wires between components
            for (let i = 0; i < compPositions.length - 1; i++) {
                const exitX = compPositions[i].x + 2.1;
                const nextEntranceX = compPositions[i + 1].x - 2.1;
                addWireSegment([exitX, -4], [nextEntranceX, -4]);
            }

            // From last component exit to Corner 2 (+8, -4)
            const lastExitX = compPositions[compPositions.length - 1].x + 2.1;
            addWireSegment([lastExitX, -4], [+8, -4]);
        } else {
            addWireSegment([-8, -4], [+8, -4]);
        }

        // Wire: Corner 2 (+8, -4) down to Corner 3 (+8, +4)
        addWireSegment([+8, -4], [+8, +4]);

        // Wire: Corner 3 (+8, +4) return across to Corner 4 (-8, +4)
        addWireSegment([+8, +4], [-8, +4]);

        // Wire: Corner 4 (-8, +4) up to Source Bottom terminal (-8, +2.5)
        addWireSegment([-8, +4], [-8, +2.5]);

        this.circuitGroup.add(wireGroup);
    }

    getWireSegments3D(compPositions) {
        const wireY = 0.35;
        const rawSegments = [];

        // 1. Source top terminal (-8, wireY, -2.5) to Corner 1 (-8, wireY, -4)
        rawSegments.push({
            start: new THREE.Vector3(-8, wireY, -2.5),
            end: new THREE.Vector3(-8, wireY, -4)
        });

        // 2. Top rail segments strictly excluding component bodies [x - 2.1, x + 2.1]
        if (compPositions && compPositions.length > 0) {
            // Corner 1 to first component entrance
            const firstEntranceX = compPositions[0].x - 2.1;
            rawSegments.push({
                start: new THREE.Vector3(-8, wireY, -4),
                end: new THREE.Vector3(firstEntranceX, wireY, -4)
            });

            // Between components
            for (let i = 0; i < compPositions.length - 1; i++) {
                const exitX = compPositions[i].x + 2.1;
                const nextEntranceX = compPositions[i + 1].x - 2.1;
                if (nextEntranceX > exitX + 0.1) {
                    rawSegments.push({
                        start: new THREE.Vector3(exitX, wireY, -4),
                        end: new THREE.Vector3(nextEntranceX, wireY, -4)
                    });
                }
            }

            // Last component exit to Corner 2 (+8, wireY, -4)
            const lastExitX = compPositions[compPositions.length - 1].x + 2.1;
            rawSegments.push({
                start: new THREE.Vector3(lastExitX, wireY, -4),
                end: new THREE.Vector3(8, wireY, -4)
            });
        } else {
            // No components on top rail
            rawSegments.push({
                start: new THREE.Vector3(-8, wireY, -4),
                end: new THREE.Vector3(8, wireY, -4)
            });
        }

        // 3. Right vertical rail: Corner 2 (+8, wireY, -4) to Corner 3 (+8, wireY, +4)
        rawSegments.push({
            start: new THREE.Vector3(8, wireY, -4),
            end: new THREE.Vector3(8, wireY, 4)
        });

        // 4. Bottom return rail: Corner 3 (+8, wireY, +4) across to Corner 4 (-8, wireY, +4)
        rawSegments.push({
            start: new THREE.Vector3(8, wireY, 4),
            end: new THREE.Vector3(-8, wireY, 4)
        });

        // 5. Left vertical return: Corner 4 (-8, wireY, +4) up to Source bottom terminal (-8, wireY, +2.5)
        rawSegments.push({
            start: new THREE.Vector3(-8, wireY, 4),
            end: new THREE.Vector3(-8, wireY, 2.5)
        });

        return rawSegments.map(seg => {
            const delta = seg.end.clone().sub(seg.start);
            const length = delta.length();
            const dir = length > 0.0001 ? delta.clone().normalize() : new THREE.Vector3(0, 0, 1);
            return {
                start: seg.start,
                end: seg.end,
                length: length,
                dir: dir // unit vector in forward conventional direction
            };
        });
    }

    createArrowMesh(color) {
        const arrowGroup = new THREE.Group();
        const isLight = this.simulator && this.simulator.currentTheme === 'light';
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.25,
            metalness: 0.6,
            emissive: color,
            emissiveIntensity: isLight ? 0.3 : 0.5
        });

        // Arrowhead cone: base radius 0.18, height 0.38 pointing along local +Z
        const coneGeo = new THREE.ConeGeometry(0.18, 0.38, 16);
        coneGeo.rotateX(Math.PI / 2);
        const cone = new THREE.Mesh(coneGeo, mat);
        cone.position.set(0, 0, 0.12);

        // Stem collar cylinder along local +Z
        const stemGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.22, 12);
        stemGeo.rotateX(Math.PI / 2);
        const stem = new THREE.Mesh(stemGeo, mat);
        stem.position.set(0, 0, -0.12);

        arrowGroup.add(cone);
        arrowGroup.add(stem);
        return { group: arrowGroup, mat: mat };
    }

    createCurrentArrows(compPositions) {
        this.currentArrows = [];
        this.wireSegments3D = this.getWireSegments3D(compPositions);

        // Maintain pathCurve for backward compatibility
        const pts = [
            new THREE.Vector3(-8, 0.35, -2.5),
            new THREE.Vector3(-8, 0.35, -4)
        ];
        if (compPositions && compPositions.length > 0) {
            compPositions.forEach((cp) => {
                pts.push(new THREE.Vector3(cp.x - 2.0, 0.35, -4));
                pts.push(new THREE.Vector3(cp.x, 0.35, -4));
                pts.push(new THREE.Vector3(cp.x + 2.0, 0.35, -4));
            });
        }
        pts.push(new THREE.Vector3(8, 0.35, -4));
        pts.push(new THREE.Vector3(8, 0.35, 4));
        pts.push(new THREE.Vector3(-8, 0.35, 4));
        pts.push(new THREE.Vector3(-8, 0.35, 2.5));
        this.pathCurve = new THREE.CatmullRomCurve3(pts, true);

        const isLight = this.simulator && this.simulator.currentTheme === 'light';
        let arrowColor;
        if (this.currentDirection === 'electron') {
            arrowColor = isLight ? 0xd97706 : 0xffe66d;
        } else {
            arrowColor = isLight ? 0x205ec9 : 0x00d4ff;
        }

        const segments = this.wireSegments3D;
        const totalLength = segments.reduce((sum, s) => sum + s.length, 0);
        const targetTotal = 20;

        let counts = segments.map(s => Math.max(1, Math.round(targetTotal * (s.length / totalLength))));
        let currentTotal = counts.reduce((sum, c) => sum + c, 0);

        while (currentTotal > targetTotal) {
            let maxIdx = 0;
            for (let i = 1; i < counts.length; i++) {
                if (counts[i] > counts[maxIdx]) maxIdx = i;
            }
            if (counts[maxIdx] > 1) {
                counts[maxIdx]--;
                currentTotal--;
            } else {
                break;
            }
        }
        while (currentTotal < targetTotal) {
            let maxIdx = 0;
            for (let i = 1; i < counts.length; i++) {
                if (segments[i].length > segments[maxIdx].length) maxIdx = i;
            }
            counts[maxIdx]++;
            currentTotal++;
        }

        segments.forEach((seg, sIdx) => {
            const count = counts[sIdx];
            for (let k = 0; k < count; k++) {
                const fraction = (k + 0.5) / count;
                const { group, mat } = this.createArrowMesh(arrowColor);
                group.visible = this.showParticles;
                this.circuitGroup.add(group);

                this.currentArrows.push({
                    mesh: group,
                    group: group,
                    mat: mat,
                    seg: seg,
                    baseFraction: fraction
                });
            }
        });

        this.particles = this.currentArrows;
    }

    createCurrentParticles(compPositions) {
        return this.createCurrentArrows(compPositions);
    }

    addLabelItem(targetMesh, name, value, className) {
        if (!this.overlay) return;

        const badge = document.createElement('div');
        badge.className = `badge-3d ${className}`;
        badge.innerHTML = `
            <span class="badge-name">${name}</span>
            <span class="badge-val">${value}</span>
        `;
        this.overlay.appendChild(badge);

        this.labelItems.push({
            mesh: targetMesh,
            element: badge
        });
    }

    updateLabels() {
        if (!this.overlay || !this.camera || this.labelItems.length === 0) return;
        if (!this.showLabels) {
            this.overlay.style.display = 'none';
            return;
        }
        this.overlay.style.display = 'block';

        const rect = this.container.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 440;
        const tempVec = new THREE.Vector3();

        this.labelItems.forEach(item => {
            item.mesh.getWorldPosition(tempVec);
            tempVec.y += 1.6;
            tempVec.project(this.camera);

            if (tempVec.z < 1) {
                const screenX = (tempVec.x * 0.5 + 0.5) * width;
                const screenY = (-tempVec.y * 0.5 + 0.5) * height;
                item.element.style.transform = `translate(-50%, -100%) translate(${Math.round(screenX)}px, ${Math.round(screenY)}px)`;
                item.element.style.display = 'flex';
            } else {
                item.element.style.display = 'none';
            }
        });
    }

    startLoop() {
        const loop = (timestamp) => {
            if (this.isDestroyed) return;
            this.animId = requestAnimationFrame(loop);

            // Camera view animation tween
            if (this.cameraAnimating && this.camStartPos && this.camEndPos) {
                const elapsed = performance.now() - this.camStartTime;
                const progress = Math.min(1, elapsed / this.camDuration);
                const ease = 1 - Math.pow(1 - progress, 3);
                this.camera.position.lerpVectors(this.camStartPos, this.camEndPos, ease);
                if (progress >= 1) {
                    this.cameraAnimating = false;
                }
            }

            if (this.controls) {
                this.controls.update();
            }

            // Animate directional current flow arrows along connected wire paths
            if (this.currentArrows && this.currentArrows.length > 0) {
                const state = this.simulator.calculatedState;
                const isPlaying = this.simulator.isAnimating;
                const phi = state ? state.phiRad : 0;
                const currentInstant = Math.sin((this.simulator.phaseOffset || 0) - phi);
                const Imax = state ? state.Imax : 0;

                // Deactivate / hide arrows when current is virtually zero, circuit is open/disconnected, or toggled off
                const isZeroCurrent = !state || Imax < 1e-6 || Math.abs(currentInstant) < 0.03;

                if (isZeroCurrent || !this.showParticles) {
                    this.currentArrows.forEach(a => {
                        a.group.visible = false;
                    });
                } else {
                    const dirMult = (currentInstant >= 0 ? 1 : -1) * (this.currentDirection === 'electron' ? -1 : 1);

                    // Advance arrow phase when animation is playing
                    if (isPlaying) {
                        this.arrowPhase = (this.arrowPhase + 0.003 * dirMult) % 1.0;
                        if (this.arrowPhase < 0) this.arrowPhase += 1.0;
                    }

                    const forwardRef = new THREE.Vector3(0, 0, 1);

                    this.currentArrows.forEach(a => {
                        a.group.visible = true;

                        // Calculate progress along segment
                        let u = (a.baseFraction + this.arrowPhase) % 1.0;
                        if (u < 0) u += 1.0;

                        // Position strictly along the segment
                        a.group.position.copy(a.seg.start).addScaledVector(a.seg.dir, u * a.seg.length);

                        // Orient arrow along direction
                        const targetDir = a.seg.dir.clone().multiplyScalar(dirMult);
                        if (targetDir.z < -0.9999 && Math.abs(targetDir.x) < 0.001) {
                            a.group.rotation.set(0, Math.PI, 0);
                        } else if (targetDir.z > 0.9999 && Math.abs(targetDir.x) < 0.001) {
                            a.group.rotation.set(0, 0, 0);
                        } else {
                            a.group.quaternion.setFromUnitVectors(forwardRef, targetDir);
                        }

                        // Fade/shrink gracefully at segment boundaries to prevent protrusion
                        const edgeDist = Math.min(u, 1 - u);
                        const edgeScale = Math.min(1, edgeDist / 0.12);
                        const currentMagnitudeScale = isPlaying ? (0.7 + Math.abs(currentInstant) * 0.4) : 0.85;
                        const finalScale = edgeScale * currentMagnitudeScale;
                        a.group.scale.set(finalScale, finalScale, finalScale);
                    });
                }
            }

            // Project 2D labels onto 3D scene
            this.updateLabels();

            // Render 3D scene
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        };

        this.animId = requestAnimationFrame(loop);
    }

    disposeGroup(group) {
        if (!group) return;
        group.traverse(obj => {
            if (obj.geometry) {
                obj.geometry.dispose();
            }
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
    }

    dispose() {
        this.isDestroyed = true;
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }
        if (this.circuitGroup) {
            this.disposeGroup(this.circuitGroup);
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}

// ==========================================
// Phase 4: Interactive Phasor Diagram & AC Analysis
// Voltage/Current Phasors, Voltage Vectors, Impedance Triangle
// ==========================================

class PhasorLabelManager {
    constructor(phasorDiagram) {
        this.phasor = phasorDiagram;
        this.labels = [];
    }

    reset() {
        this.labels = [];
    }

    addLabel(item) {
        if (!item || !item.text) return;
        const angleRad = item.angleRad !== undefined ? item.angleRad : 0;
        const angleDeg = angleRad * 180 / Math.PI;

        let defaultAlign = 'center';
        let defaultBaseline = 'middle';
        if (item.angleRad !== undefined) {
            if (Math.abs(angleDeg - 90) < 25) {
                defaultAlign = 'center';
                defaultBaseline = 'bottom';
            } else if (Math.abs(angleDeg + 90) < 25) {
                defaultAlign = 'center';
                defaultBaseline = 'top';
            } else if (Math.cos(angleRad) >= 0) {
                defaultAlign = 'left';
            } else {
                defaultAlign = 'right';
            }
        }

        this.labels.push({
            id: item.id || `lbl_${this.labels.length}`,
            text: item.text,
            color: item.color || '#ffffff',
            font: item.font || '600 11px "JetBrains Mono", monospace',
            anchorX: item.anchorX !== undefined ? item.anchorX : item.nominalX,
            anchorY: item.anchorY !== undefined ? item.anchorY : item.nominalY,
            nominalX: item.nominalX,
            nominalY: item.nominalY,
            angleRad: item.angleRad,
            align: item.align || defaultAlign,
            baseline: item.baseline || defaultBaseline,
            priority: item.priority || 0,
            currentX: item.nominalX,
            currentY: item.nominalY,
            displaced: false
        });
    }

    getBounds(item, ctx) {
        if (ctx) ctx.font = item.font;
        const textWidth = (ctx && typeof ctx.measureText === 'function')
            ? ((ctx.measureText(item.text) && typeof ctx.measureText(item.text).width === 'number') ? ctx.measureText(item.text).width : item.text.length * 7.5)
            : (item.text.length * 7.5);
        const textHeight = 15;
        const padX = 6;
        const padY = 4;
        const w = textWidth + padX * 2;
        const h = textHeight + padY * 2;

        let left = item.currentX;
        if (item.align === 'center') left -= w / 2;
        else if (item.align === 'right') left -= w;

        let top = item.currentY;
        if (item.baseline === 'middle') top -= h / 2;
        else if (item.baseline === 'bottom') top -= h;

        return {
            left,
            right: left + w,
            top,
            bottom: top + h,
            width: w,
            height: h
        };
    }

    checkOverlap(boxA, boxB) {
        const overlapX = Math.min(boxA.right, boxB.right) - Math.max(boxA.left, boxB.left);
        const overlapY = Math.min(boxA.bottom, boxB.bottom) - Math.max(boxA.top, boxB.top);
        return (overlapX > 2 && overlapY > 2) ? { overlapX, overlapY } : null;
    }

    resolve(ctx, width, height) {
        if (!this.labels || this.labels.length === 0) return;

        // Reset positions to nominal
        this.labels.forEach(lbl => {
            lbl.currentX = lbl.nominalX;
            lbl.currentY = lbl.nominalY;
            lbl.displaced = false;
        });

        // Iterative relaxation / collision separation (up to 12 passes)
        for (let pass = 0; pass < 12; pass++) {
            let hadCollision = false;

            // Sort by current Y to prevent cyclic oscillations
            this.labels.sort((a, b) => a.currentY - b.currentY);

            for (let i = 0; i < this.labels.length - 1; i++) {
                for (let j = i + 1; j < this.labels.length; j++) {
                    const a = this.labels[i];
                    const b = this.labels[j];
                    const boxA = this.getBounds(a, ctx);
                    const boxB = this.getBounds(b, ctx);
                    const col = this.checkOverlap(boxA, boxB);

                    if (col) {
                        hadCollision = true;
                        // Separate vertically if along horizontal axis or overlapY <= overlapX
                        const isHorizontalCoincidence = Math.abs(boxA.top - boxB.top) < 24;
                        if (isHorizontalCoincidence || col.overlapY <= col.overlapX) {
                            const neededShift = col.overlapY + 4;
                            a.currentY -= neededShift / 2;
                            b.currentY += neededShift / 2;
                        } else {
                            const neededShift = col.overlapX + 6;
                            if (boxA.left <= boxB.left) {
                                a.currentX -= neededShift / 2;
                                b.currentX += neededShift / 2;
                            } else {
                                a.currentX += neededShift / 2;
                                b.currentX -= neededShift / 2;
                            }
                        }
                    }
                }
            }

            if (!hadCollision) break;
        }

        // Clamp within canvas drawing bounds (preserve margins for title at top and legend at bottom)
        const marginX = 14;
        const marginTop = 42;
        const marginBottom = 50;

        this.labels.forEach(item => {
            const box = this.getBounds(item, ctx);
            if (box.right > width - marginX) {
                item.currentX -= (box.right - (width - marginX));
            }
            if (box.left < marginX) {
                item.currentX += (marginX - box.left);
            }
            if (box.top < marginTop) {
                item.currentY += (marginTop - box.top);
            }
            if (box.bottom > height - marginBottom) {
                item.currentY -= (box.bottom - (height - marginBottom));
            }
        });

        // Final resolution pass: eliminate any residual overlap introduced by clamping
        this.labels.sort((a, b) => a.currentY - b.currentY);
        for (let i = 0; i < this.labels.length - 1; i++) {
            for (let j = i + 1; j < this.labels.length; j++) {
                const a = this.labels[i];
                const b = this.labels[j];
                const boxA = this.getBounds(a, ctx);
                const boxB = this.getBounds(b, ctx);
                const col = this.checkOverlap(boxA, boxB);
                if (col) {
                    if (boxB.bottom + col.overlapY + 4 <= height - marginBottom) {
                        b.currentY += col.overlapY + 4;
                    } else if (boxA.top - col.overlapY - 4 >= marginTop) {
                        a.currentY -= (col.overlapY + 4);
                    } else {
                        // Shift horizontally away
                        b.currentX += (col.overlapX + 6);
                    }
                }
            }
        }

        this.labels.forEach(item => {
            const dist = Math.hypot(item.currentX - item.nominalX, item.currentY - item.nominalY);
            item.displaced = dist > 7;
        });
    }

    render(ctx, width, height) {
        if (!this.labels || this.labels.length === 0 || !ctx) return;
        this.resolve(ctx, width, height);

        this.labels.forEach(item => {
            const box = this.getBounds(item, ctx);

            // If displaced significantly (> 7px), draw an elegant leader line connecting anchor to label
            if (item.displaced) {
                if (typeof ctx.save === 'function') ctx.save();
                ctx.strokeStyle = item.color;
                ctx.lineWidth = 1.0;
                if (typeof ctx.setLineDash === 'function') ctx.setLineDash([2, 2]);
                ctx.beginPath();
                const targetX = Math.max(box.left, Math.min(box.right, item.anchorX));
                const targetY = Math.max(box.top, Math.min(box.bottom, item.anchorY));
                ctx.moveTo(item.anchorX, item.anchorY);
                ctx.lineTo(targetX, targetY);
                ctx.stroke();
                if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);
                if (typeof ctx.restore === 'function') ctx.restore();
            }

            // Draw label text
            if (typeof ctx.save === 'function') ctx.save();
            ctx.fillStyle = item.color;
            ctx.font = item.font;
            ctx.textAlign = item.align;
            ctx.textBaseline = item.baseline;
            ctx.fillText(item.text, item.currentX, item.currentY);
            if (typeof ctx.restore === 'function') ctx.restore();
        });
    }
}

class PhasorDiagram {
    constructor(simulator) {
        this.simulator = simulator;
        this.canvas = document.getElementById('phasorCanvas');
        this.container = document.getElementById('phasorContainer');
        this.infoPanel = document.getElementById('phasorInfo');
        this.explanationPanel = document.getElementById('phasorExplanation');
        this.badgeMode = document.getElementById('badgePhasorMode');
        this.ctx = null;
        this.currentView = 'vi'; // 'vi', 'voltage', 'impedance'
        this.width = 600;
        this.height = 480;
        this.labelManager = new PhasorLabelManager(this);

        const currentTheme = (simulator && simulator.currentTheme) || 'dark';
        this.colors = this.getThemeColors(currentTheme);
    }

    getThemeColors(theme) {
        if (theme === 'light') {
            return {
                axes: 'rgba(38, 55, 80, 0.25)',
                axesLabel: '#61758F',
                grid: 'rgba(38, 55, 80, 0.08)',
                voltage: '#205ec9',       // Deep Royal Blue
                current: '#d92550',       // Crisp Crimson Red
                vr: '#059669',            // Crisp Emerald Green (VR / R)
                vl: '#0891b2',            // Crisp Cyan/Teal (VL / XL)
                vc: '#d97706',            // Amber/Gold (VC / XC)
                vs: '#205ec9',            // Supply voltage — Deep Royal Blue
                impedanceR: '#059669',    // Resistance — Emerald Green
                impedanceX: '#0891b2',    // Reactance — Cyan/Teal
                impedanceZ: '#205ec9',    // Impedance — Royal Blue
                angleArc: '#205ec9',      // Phase angle arc
                triangleFill: 'rgba(100, 143, 232, 0.18)', // Soft periwinkle translucent fill
                background: '#EEF2FB',    // Matches light container background!
                text: '#263750',          // Primary text
                textMuted: '#61758F',     // Secondary text
                legendBg: 'rgba(255, 255, 255, 0.95)',
                legendBorder: '#D2DFF5'
            };
        }
        return {
            axes: 'rgba(255, 255, 255, 0.15)',
            axesLabel: '#8a8a8a',
            grid: 'rgba(255, 255, 255, 0.05)',
            voltage: '#00d4ff',       // Standout Electric Cyan (Waveform voltage)
            current: '#f5576c',       // Pink/Magenta (Waveform current)
            vr: '#00ff88',            // Bright Green (Resistive voltage / Resistance)
            vl: '#4ecdc4',            // Teal (Inductive voltage / Inductive reactance)
            vc: '#ffe66d',            // Yellow/Gold (Capacitive voltage / Capacitive reactance)
            vs: '#00d4ff',            // Supply voltage — Electric Cyan
            impedanceR: '#00ff88',    // Resistance — Bright Green
            impedanceX: '#4ecdc4',    // Reactance — Teal
            impedanceZ: '#00d4ff',    // Impedance — Electric Cyan
            angleArc: '#00d4ff',      // Phase angle arc — Cyan
            triangleFill: 'rgba(0, 212, 255, 0.15)', // Electric cyan translucent glow
            background: '#121212',    // Matches dark container background!
            text: '#e0e0e0',          // Matches --text-primary
            textMuted: '#8a8a8a',     // Matches --text-secondary
            legendBg: 'rgba(18, 18, 18, 0.92)',
            legendBorder: '#242424'
        };
    }

    setTheme(theme) {
        this.colors = this.getThemeColors(theme);
        this.draw();
    }

    init() {
        if (!this.canvas || typeof this.canvas.getContext !== 'function' || !this.container) return;
        this.ctx = this.canvas.getContext('2d');
        this.setupControls();
        this.setupResize();
        this.resizeCanvas();
    }

    setupControls() {
        const buttons = document.querySelectorAll('.btn-phasor-view');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
                this.currentView = btn.dataset.phasorView;
                this.draw();
            });
        });
    }

    setupResize() {
        window.addEventListener('resize', () => this.resizeCanvas());
        if (typeof ResizeObserver !== 'undefined' && this.container) {
            new ResizeObserver(() => this.resizeCanvas()).observe(this.container);
        }
    }

    resizeCanvas() {
        if (!this.canvas || !this.ctx || !this.container) return;
        const rect = this.container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(rect.width || 600, 300);
        const h = Math.max(rect.height || 480, 280);
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.width = w;
        this.height = h;
        this.draw();
    }

    draw() {
        if (!this.ctx) return;
        const state = this.simulator.calculatedState;
        const type = this.simulator.currentCircuitType || 'RLC';

        // Update mode badge
        if (this.badgeMode) {
            const labels = {
                'R': 'Pure Resistive (R)',
                'L': 'Pure Inductive (L)',
                'C': 'Pure Capacitive (C)',
                'RL': 'Series RL Circuit',
                'RC': 'Series RC Circuit',
                'RLC': 'Series RLC Circuit'
            };
            this.badgeMode.textContent = labels[type] || `Series ${type}`;
        }

        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (!state) {
            this.drawEmptyState();
            this.hideInfoPanels();
            return;
        }

        if (this.labelManager) {
            this.labelManager.reset();
        }

        switch (this.currentView) {
            case 'vi':
                this.drawVIPhasors(state, type);
                break;
            case 'voltage':
                this.drawVoltageVectors(state, type);
                break;
            case 'impedance':
                this.drawImpedanceTriangle(state, type);
                break;
            default:
                this.drawVIPhasors(state, type);
                break;
        }

        this.updateInfoPanel(state, type);
        this.updateExplanation(state, type);
    }

    drawEmptyState() {
        this.ctx.fillStyle = this.colors.textMuted;
        this.ctx.font = '500 15px Inter, system-ui, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Enter circuit parameters and click Calculate & Simulate to generate phasor diagrams', this.width / 2, this.height / 2);
    }

    hideInfoPanels() {
        if (this.infoPanel) this.infoPanel.classList.remove('visible');
        if (this.explanationPanel) this.explanationPanel.classList.remove('visible');
    }

    // ==========================================
    // VIEW 1: Voltage / Current Phasors (Voltage Reference)
    // ==========================================
    drawVIPhasors(state, type) {
        const cx = this.width * 0.45;
        const cy = this.height * 0.50;
        const maxRadius = Math.min(this.width, this.height) * 0.36;

        this.drawAxes(cx, cy, maxRadius);
        this.drawTitle('Voltage & Current Phasor Diagram (Voltage Reference)', 'Reference: V ∠0°, Current I ∠(−φ)');

        // Voltage reference vector along positive horizontal axis at 0°
        const vLen = maxRadius * 0.82;
        this.drawPhasor(cx, cy, vLen, 0, this.colors.voltage, `V = ${this.fmt(state.Vrms)} V ∠0°`, true);

        // Current phasor at angle -phi
        const iLen = maxRadius * 0.62;
        const iAngle = -state.phiRad;
        const iAngleDeg = -state.phiDeg;
        const iLabel = `I = ${this.fmt(state.Irms, 3)} A ∠${this.fmtAngle(iAngleDeg)}°`;
        this.drawPhasor(cx, cy, iLen, iAngle, this.colors.current, iLabel, true);

        // Phase angle arc
        if (Math.abs(state.phiDeg) > 0.05) {
            this.drawAngleArc(cx, cy, maxRadius * 0.34, 0, iAngle, state.phiDeg, this.colors.angleArc);
        } else {
            if (this.labelManager) {
                this.labelManager.addLabel({
                    text: '(V & I in phase, φ = 0.00°)',
                    color: this.colors.textMuted,
                    font: '500 11px Inter, sans-serif',
                    anchorX: cx + vLen,
                    anchorY: cy,
                    nominalX: cx + vLen + 14,
                    nominalY: cy + 18,
                    align: 'left',
                    baseline: 'middle'
                });
            } else {
                this.ctx.fillStyle = this.colors.textMuted;
                this.ctx.font = '500 11px Inter, sans-serif';
                this.ctx.textAlign = 'left';
                this.ctx.fillText('(V & I in phase, φ = 0.00°)', cx + vLen + 14, cy + 18);
            }
        }

        // Resolve and render labels without overlap
        if (this.labelManager) {
            this.labelManager.render(this.ctx, this.width, this.height);
        }

        // Legend
        this.drawLegend([
            { color: this.colors.voltage, label: `Voltage V (Reference: ${this.fmt(state.Vrms)} V ∠0°)` },
            { color: this.colors.current, label: `Current I (${this.fmt(state.Irms, 3)} A ∠${this.fmtAngle(iAngleDeg)}°, ${state.pfLabel})` }
        ]);
    }

    // ==========================================
    // VIEW 2: Component Voltage Vectors (Current Reference)
    // ==========================================
    drawVoltageVectors(state, type) {
        const cx = this.width * 0.45;
        const cy = this.height * 0.50;
        const maxRadius = Math.min(this.width, this.height) * 0.36;

        this.drawAxes(cx, cy, maxRadius);
        this.drawTitle('Component Voltage Vectors (Current Reference)', 'Reference: I ∠0°, VR ∠0°, VL ∠+90°, VC ∠−90°, Vs = VR + VL + VC');

        // Current reference direction indicator
        this.ctx.strokeStyle = this.colors.current;
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([4, 4]);
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(cx + maxRadius * 0.92, cy);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = this.colors.current;
        this.ctx.font = '600 10px "JetBrains Mono", monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`I Reference (${this.fmt(state.Irms, 3)} A ∠0°)`, cx + maxRadius * 0.92 + 6, cy + 3);

        const VR = state.Irms * state.resR;
        const VL = state.Irms * state.XL;
        const VC = state.Irms * state.XC;
        const maxV = Math.max(state.Vrms, VR, VL, VC, 1);
        const scale = (maxRadius * 0.78) / maxV;

        const vrLen = VR * scale;
        const vlLen = VL * scale;
        const vcLen = VC * scale;
        const vsLen = state.Vrms * scale;

        const legendItems = [];

        if (type === 'R') {
            this.drawPhasor(cx, cy, vrLen, 0, this.colors.vr, `VR = Vs = ${this.fmt(state.Vrms)} V ∠0°`, true);
            if (this.labelManager) this.labelManager.render(this.ctx, this.width, this.height);
            legendItems.push({ color: this.colors.vr, label: `VR = Vs = IR = ${this.fmt(state.Vrms)} V ∠0°` });
            this.drawLegend(legendItems);
            return;
        }

        if (type === 'L') {
            this.drawPhasor(cx, cy, vlLen, Math.PI / 2, this.colors.vl, `VL = Vs = ${this.fmt(state.Vrms)} V ∠+90°`, true);
            if (this.labelManager) this.labelManager.render(this.ctx, this.width, this.height);
            legendItems.push({ color: this.colors.vl, label: `VL = Vs = IXL = ${this.fmt(state.Vrms)} V ∠+90°` });
            this.drawLegend(legendItems);
            return;
        }

        if (type === 'C') {
            this.drawPhasor(cx, cy, vcLen, -Math.PI / 2, this.colors.vc, `VC = Vs = ${this.fmt(state.Vrms)} V ∠−90°`, true);
            if (this.labelManager) this.labelManager.render(this.ctx, this.width, this.height);
            legendItems.push({ color: this.colors.vc, label: `VC = Vs = IXC = ${this.fmt(state.Vrms)} V ∠−90°` });
            this.drawLegend(legendItems);
            return;
        }

        // Series RL, RC, RLC
        if (vrLen > 0.5) {
            this.drawPhasor(cx, cy, vrLen, 0, this.colors.vr, `VR = ${this.fmt(VR)} V`, true);
            legendItems.push({ color: this.colors.vr, label: `VR = IR = ${this.fmt(VR)} V ∠0°` });
        }

        if (vlLen > 0.5) {
            this.drawPhasor(cx, cy, vlLen, Math.PI / 2, this.colors.vl, `VL = ${this.fmt(VL)} V`, true);
            legendItems.push({ color: this.colors.vl, label: `VL = IXL = ${this.fmt(VL)} V ∠+90°` });
        }

        if (vcLen > 0.5) {
            this.drawPhasor(cx, cy, vcLen, -Math.PI / 2, this.colors.vc, `VC = ${this.fmt(VC)} V`, true);
            legendItems.push({ color: this.colors.vc, label: `VC = IXC = ${this.fmt(VC)} V ∠−90°` });
        }

        // Tip-to-tail polygon
        const netVvert = (VL - VC) * scale;
        const rEndX = cx + vrLen;
        const rEndY = cy;
        const sEndX = cx + vrLen;
        const sEndY = cy - netVvert;

        if (Math.abs(netVvert) > 0.5) {
            const netVval = VL - VC;
            const netVlabel = type === 'RL' ? `VL = ${this.fmt(VL)} V` :
                              type === 'RC' ? `−VC = −${this.fmt(VC)} V` :
                              `VL−VC = ${this.fmt(netVval)} V`;
            const vertColor = netVvert > 0 ? this.colors.vl : this.colors.vc;
            this.drawVector(rEndX, rEndY, sEndX, sEndY, vertColor, netVlabel, true);
        }

        // Right angle marker
        if (vrLen > 15 && Math.abs(netVvert) > 15) {
            this.drawRightAngleMarker(rEndX, rEndY, netVvert > 0 ? 1 : -1);
        }

        // Resultant supply voltage Vs
        if (vsLen > 0.5) {
            const vsAngle = state.phiRad;
            this.drawPhasor(cx, cy, vsLen, vsAngle, this.colors.vs, `Vs = ${this.fmt(state.Vrms)} V ∠${this.fmtAngle(state.phiDeg)}°`, true);
            legendItems.push({ color: this.colors.vs, label: `Vs = √(VR² + (VL−VC)²) = ${this.fmt(state.Vrms)} V ∠${this.fmtAngle(state.phiDeg)}°` });
        }

        // Phase angle arc
        if (Math.abs(state.phiDeg) > 0.05 && vsLen > 20) {
            this.drawAngleArc(cx, cy, Math.min(vsLen, maxRadius * 0.35) * 0.5, 0, state.phiRad, state.phiDeg, this.colors.angleArc);
        }

        // Resolve and render labels without overlap
        if (this.labelManager) {
            this.labelManager.render(this.ctx, this.width, this.height);
        }

        this.drawLegend(legendItems);
    }

    // ==========================================
    // VIEW 3: Impedance Triangle
    // ==========================================
    drawImpedanceTriangle(state, type) {
        const cx = this.width * 0.40;
        const cy = this.height * 0.50;
        const maxRadius = Math.min(this.width, this.height) * 0.36;

        this.drawAxes(cx, cy, maxRadius, '+Re (Ω)', '+Im (Ω)');
        this.drawTitle('Impedance Triangle (Series Topology)', 'Base: R, Height: X = XL − XC, Hypotenuse: Z = √(R² + X²), Angle: φ');

        const legendItems = [];

        if (type === 'R') {
            const scale = (maxRadius * 0.8) / Math.max(state.Z, 1);
            const rLen = state.Z * scale;
            this.drawPhasor(cx, cy, rLen, 0, this.colors.impedanceR, `Z = R = ${this.fmt(state.Z)} Ω ∠0°`, true);
            if (this.labelManager) this.labelManager.render(this.ctx, this.width, this.height);
            legendItems.push({ color: this.colors.impedanceR, label: `R = ${this.fmt(state.resR)} Ω (Pure Resistance, X = 0, φ = 0°)` });
            legendItems.push({ color: this.colors.impedanceZ, label: `Z = ${this.fmt(state.Z)} Ω ∠0°` });
            this.drawLegend(legendItems);
            return;
        }

        if (type === 'L') {
            const scale = (maxRadius * 0.8) / Math.max(state.Z, 1);
            const xlLen = state.Z * scale;
            this.drawPhasor(cx, cy, xlLen, Math.PI / 2, this.colors.vl, `Z = XL = ${this.fmt(state.Z)} Ω ∠+90°`, true);
            if (this.labelManager) this.labelManager.render(this.ctx, this.width, this.height);
            legendItems.push({ color: this.colors.vl, label: `XL = ${this.fmt(state.XL)} Ω (Pure Inductance, R = 0, φ = +90°)` });
            legendItems.push({ color: this.colors.impedanceZ, label: `Z = ${this.fmt(state.Z)} Ω ∠+90°` });
            this.drawLegend(legendItems);
            return;
        }

        if (type === 'C') {
            const scale = (maxRadius * 0.8) / Math.max(state.Z, 1);
            const xcLen = state.Z * scale;
            this.drawPhasor(cx, cy, xcLen, -Math.PI / 2, this.colors.vc, `Z = XC = ${this.fmt(state.Z)} Ω ∠−90°`, true);
            if (this.labelManager) this.labelManager.render(this.ctx, this.width, this.height);
            legendItems.push({ color: this.colors.vc, label: `XC = ${this.fmt(state.XC)} Ω (Pure Capacitance, R = 0, φ = −90°)` });
            legendItems.push({ color: this.colors.impedanceZ, label: `Z = ${this.fmt(state.Z)} Ω ∠−90°` });
            this.drawLegend(legendItems);
            return;
        }

        // Series RL, RC, RLC
        const maxVal = Math.max(state.Z, state.resR, Math.abs(state.netX), 1);
        const scale = (maxRadius * 0.78) / maxVal;

        const rLen = state.resR * scale;
        const xLen = state.netX * scale;
        const zLen = state.Z * scale;

        const rEndX = cx + rLen;
        const rEndY = cy;
        const zEndX = cx + rLen;
        const zEndY = cy - xLen;

        // Shaded triangle interior
        if (rLen > 1 && Math.abs(xLen) > 1) {
            this.ctx.beginPath();
            this.ctx.moveTo(cx, cy);
            this.ctx.lineTo(rEndX, rEndY);
            this.ctx.lineTo(zEndX, zEndY);
            this.ctx.closePath();
            this.ctx.fillStyle = this.colors.triangleFill;
            this.ctx.fill();
        }

        // Base: Resistance R
        if (rLen > 0.5) {
            this.drawVector(cx, cy, rEndX, rEndY, this.colors.impedanceR, `R = ${this.fmt(state.resR)} Ω`, false, 2.5, 1);
        }

        // Vertical leg: Net Reactance X
        if (Math.abs(xLen) > 0.5) {
            const xSign = state.netX >= 0 ? '+' : '';
            const xLabel = type === 'RL' ? `XL = ${this.fmt(state.XL)} Ω` :
                           type === 'RC' ? `−XC = −${this.fmt(state.XC)} Ω` :
                           `X = ${xSign}${this.fmt(state.netX)} Ω`;
            const xColor = state.netX >= 0 ? this.colors.vl : this.colors.vc;
            this.drawVector(rEndX, rEndY, zEndX, zEndY, xColor, xLabel);
        }

        // Hypotenuse: Impedance Z
        if (zLen > 0.5) {
            this.drawVector(cx, cy, zEndX, zEndY, this.colors.impedanceZ, `Z = ${this.fmt(state.Z)} Ω`, false, 2.5, -1);
        }

        // Right-angle marker
        if (rLen > 15 && Math.abs(xLen) > 15) {
            this.drawRightAngleMarker(rEndX, rEndY, xLen > 0 ? 1 : -1);
        }

        // Phase angle arc at origin
        if (Math.abs(state.phiDeg) > 0.05 && rLen > 15 && zLen > 15) {
            const arcRadius = Math.min(rLen, zLen) * 0.35;
            this.drawAngleArc(cx, cy, arcRadius, 0, state.phiRad, state.phiDeg, this.colors.angleArc);
        } else if (Math.abs(state.phiDeg) <= 0.05 && rLen > 0.5) {
            if (this.labelManager) {
                this.labelManager.addLabel({
                    text: '(Resonance: X = 0, Z = R, φ = 0.00°)',
                    color: this.colors.textMuted,
                    font: '500 11px Inter, sans-serif',
                    anchorX: cx + rLen,
                    anchorY: cy,
                    nominalX: cx + rLen + 14,
                    nominalY: cy + 18,
                    align: 'left',
                    baseline: 'middle'
                });
            } else {
                this.ctx.fillStyle = this.colors.textMuted;
                this.ctx.font = '500 11px Inter, sans-serif';
                this.ctx.textAlign = 'left';
                this.ctx.fillText('(Resonance: X = 0, Z = R, φ = 0.00°)', cx + rLen + 14, cy + 18);
            }
        }

        legendItems.push({ color: this.colors.impedanceR, label: `Resistance R = ${this.fmt(state.resR)} Ω` });
        if (state.XL > 0.001) {
            legendItems.push({ color: this.colors.vl, label: `Inductive Reactance XL = ${this.fmt(state.XL)} Ω` });
        }
        if (state.XC > 0.001) {
            legendItems.push({ color: this.colors.vc, label: `Capacitive Reactance XC = ${this.fmt(state.XC)} Ω` });
        }
        if (type === 'RLC') {
            const xSign = state.netX >= 0 ? '+' : '';
            legendItems.push({ color: state.netX >= 0 ? this.colors.vl : this.colors.vc, label: `Net Reactance X = XL − XC = ${xSign}${this.fmt(state.netX)} Ω` });
        }
        legendItems.push({ color: this.colors.impedanceZ, label: `Impedance Z = √(R² + X²) = ${this.fmt(state.Z)} Ω ∠${this.fmtAngle(state.phiDeg)}°` });

        // Resolve and render labels without overlap
        if (this.labelManager) {
            this.labelManager.render(this.ctx, this.width, this.height);
        }

        this.drawLegend(legendItems);
    }

    // ==========================================
    // Drawing Primitives
    // ==========================================
    drawTitle(title, subtitle) {
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = '600 13px Inter, system-ui, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(title, this.width / 2, 10);

        if (subtitle) {
            this.ctx.fillStyle = this.colors.textMuted;
            this.ctx.font = '400 11px Inter, system-ui, sans-serif';
            this.ctx.fillText(subtitle, this.width / 2, 28);
        }
    }

    drawAxes(cx, cy, radius, xLabel = '+Re', yLabel = '+Im') {
        this.ctx.strokeStyle = this.colors.axes;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([4, 4]);

        // Horizontal axis
        this.ctx.beginPath();
        this.ctx.moveTo(cx - radius - 20, cy);
        this.ctx.lineTo(cx + radius + 25, cy);
        this.ctx.stroke();

        // Vertical axis
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy - radius - 20);
        this.ctx.lineTo(cx, cy + radius + 20);
        this.ctx.stroke();

        this.ctx.setLineDash([]);

        // Axis labels
        this.ctx.fillStyle = this.colors.axesLabel;
        this.ctx.font = '500 11px Inter, system-ui, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(xLabel, cx + radius + 8, cy - 4);
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(yLabel, cx + 5, cy - radius - 6);
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('−Im', cx + 5, cy + radius + 6);

        // Origin dot
        this.ctx.fillStyle = this.colors.axesLabel;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawPhasor(cx, cy, length, angleRad, color, label, showArrowhead = true, lineWidth = 2.5) {
        if (length < 0.5) return;
        const ex = cx + length * Math.cos(angleRad);
        const ey = cy - length * Math.sin(angleRad);

        // Shaft
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(ex, ey);
        this.ctx.stroke();

        // Arrowhead
        if (showArrowhead) {
            const headLen = Math.min(12, Math.max(8, length * 0.14));
            const dx = ex - cx;
            const dy = ey - cy;
            const drawAngle = Math.atan2(dy, dx);

            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.moveTo(ex, ey);
            this.ctx.lineTo(
                ex - headLen * Math.cos(drawAngle - 0.35),
                ey - headLen * Math.sin(drawAngle - 0.35)
            );
            this.ctx.lineTo(
                ex - headLen * Math.cos(drawAngle + 0.35),
                ey - headLen * Math.sin(drawAngle + 0.35)
            );
            this.ctx.closePath();
            this.ctx.fill();
        }

        // Label
        if (label) {
            const labelDist = length + 16;
            const lx = cx + labelDist * Math.cos(angleRad);
            const ly = cy - labelDist * Math.sin(angleRad);

            if (this.labelManager) {
                this.labelManager.addLabel({
                    text: label,
                    color: color,
                    anchorX: ex,
                    anchorY: ey,
                    nominalX: lx,
                    nominalY: ly,
                    angleRad: angleRad
                });
            } else {
                this.ctx.fillStyle = color;
                this.ctx.font = '600 11px "JetBrains Mono", monospace';
                this.ctx.textBaseline = 'middle';

                const angleDeg = angleRad * 180 / Math.PI;
                if (Math.abs(angleDeg - 90) < 25) {
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'bottom';
                } else if (Math.abs(angleDeg + 90) < 25) {
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'top';
                } else if (Math.cos(angleRad) >= 0) {
                    this.ctx.textAlign = 'left';
                } else {
                    this.ctx.textAlign = 'right';
                }

                this.ctx.fillText(label, lx, ly);
            }
        }
    }

    drawVector(x1, y1, x2, y2, color, label, dashed = false, lineWidth = 2.5, perpSide = 1) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.5) return;

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        if (dashed) this.ctx.setLineDash([4, 3]);
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        if (dashed) this.ctx.setLineDash([]);

        // Arrowhead
        const headLen = Math.min(12, Math.max(8, len * 0.14));
        const drawAngle = Math.atan2(dy, dx);
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(x2, y2);
        this.ctx.lineTo(
            x2 - headLen * Math.cos(drawAngle - 0.35),
            y2 - headLen * Math.sin(drawAngle - 0.35)
        );
        this.ctx.lineTo(
            x2 - headLen * Math.cos(drawAngle + 0.35),
            y2 - headLen * Math.sin(drawAngle + 0.35)
        );
        this.ctx.closePath();
        this.ctx.fill();

        // Label offset perpendicular at midpoint
        if (label) {
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const perpX = (-dy / len * 15) * perpSide;
            const perpY = (dx / len * 15) * perpSide;

            if (this.labelManager) {
                this.labelManager.addLabel({
                    text: label,
                    color: color,
                    anchorX: mx,
                    anchorY: my,
                    nominalX: mx + perpX,
                    nominalY: my + perpY,
                    align: 'center',
                    baseline: 'middle'
                });
            } else {
                this.ctx.fillStyle = color;
                this.ctx.font = '600 11px "JetBrains Mono", monospace';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(label, mx + perpX, my + perpY);
            }
        }
    }

    drawRightAngleMarker(cornerX, cornerY, yDirection = 1, size = 10) {
        const signY = yDirection > 0 ? -1 : 1;
        this.ctx.strokeStyle = this.colors.axesLabel;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(cornerX - size, cornerY);
        this.ctx.lineTo(cornerX - size, cornerY + signY * size);
        this.ctx.lineTo(cornerX, cornerY + signY * size);
        this.ctx.stroke();
    }

    drawAngleArc(cx, cy, radius, startAngleRad, endAngleRad, degreesLabel, color) {
        if (radius < 4) return;
        const startCanvas = -startAngleRad;
        const endCanvas = -endAngleRad;

        this.ctx.strokeStyle = color || this.colors.angleArc;
        this.ctx.lineWidth = 1.8;
        this.ctx.setLineDash([3, 3]);
        this.ctx.beginPath();
        if (endCanvas < startCanvas) {
            this.ctx.arc(cx, cy, radius, startCanvas, endCanvas, true);
        } else {
            this.ctx.arc(cx, cy, radius, startCanvas, endCanvas, false);
        }
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Position label along bisector
        const midAngle = (startAngleRad + endAngleRad) / 2;
        const labelR = radius + 15;
        const lx = cx + labelR * Math.cos(midAngle);
        const ly = cy - labelR * Math.sin(midAngle);

        this.ctx.fillStyle = color || this.colors.angleArc;
        this.ctx.font = '600 11px "JetBrains Mono", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`φ = ${this.fmtAngle(degreesLabel)}°`, lx, ly);
    }

    drawLegend(items) {
        if (!items || items.length === 0) return;
        const startX = 16;
        const itemHeight = 18;
        const totalHeight = items.length * itemHeight;
        const startY = this.height - 12 - totalHeight;

        this.ctx.fillStyle = this.colors.legendBg || 'rgba(18, 18, 18, 0.92)';
        this.ctx.fillRect(startX - 6, startY - 6, 330, totalHeight + 12);
        this.ctx.strokeStyle = this.colors.legendBorder || '#242424';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(startX - 6, startY - 6, 330, totalHeight + 12);

        items.forEach((item, i) => {
            const y = startY + i * itemHeight;
            this.ctx.fillStyle = item.color;
            this.ctx.fillRect(startX, y + 2, 12, 10);

            this.ctx.fillStyle = this.colors.text;
            this.ctx.font = '500 11px Inter, system-ui, sans-serif';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';
            this.ctx.fillText(item.label, startX + 18, y);
        });
    }

    // ==========================================
    // Numeric Info & Educational Explanation
    // ==========================================
    updateInfoPanel(state, type) {
        if (!this.infoPanel) return;
        if (!state) {
            this.infoPanel.classList.remove('visible');
            return;
        }

        const items = [
            { label: 'RMS Voltage (Vrms)', value: `${this.fmt(state.Vrms)} V` },
            { label: 'RMS Current (Irms)', value: `${this.fmt(state.Irms, 3)} A` },
            { label: 'Impedance (|Z|)', value: `${this.fmt(state.Z)} Ω` },
            { label: 'Phase Angle (φ)', value: `${this.fmtAngle(state.phiDeg)}° (${this.fmt(state.phiRad, 4)} rad)` },
            { label: 'Power Factor (PF)', value: `${this.fmt(state.PF, 3)} (${state.pfLabel})` },
            { label: 'Real Power (P)', value: `${this.fmt(state.P)} W` },
            { label: 'Reactive Power (Q)', value: `${state.Q >= 0 ? '+' : ''}${this.fmt(state.Q)} VAR` },
            { label: 'Apparent Power (S)', value: `${this.fmt(state.S)} VA` }
        ];

        if (state.resR > 0) items.push({ label: 'Resistance (R)', value: `${this.fmt(state.resR)} Ω` });
        if (state.XL > 0.0001) items.push({ label: 'Inductive Reactance (XL)', value: `${this.fmt(state.XL)} Ω` });
        if (state.XC > 0.0001) items.push({ label: 'Capacitive Reactance (XC)', value: `${this.fmt(state.XC)} Ω` });
        if (['RL', 'RC', 'RLC'].includes(type)) {
            const xSign = state.netX >= 0 ? '+' : '';
            items.push({ label: 'Net Reactance (X = XL−XC)', value: `${xSign}${this.fmt(state.netX)} Ω` });
        }
        if (type === 'RLC' && state.fr !== null) {
            items.push({ label: 'Resonant Frequency (fr)', value: `${this.fmt(state.fr)} Hz` });
        }

        this.infoPanel.innerHTML = `
            <div class="info-grid">
                ${items.map(it => `
                    <div class="info-item">
                        <span class="info-label">${it.label}</span>
                        <span class="info-value">${it.value}</span>
                    </div>
                `).join('')}
            </div>
        `;
        this.infoPanel.classList.add('visible');
    }

    updateExplanation(state, type) {
        if (!this.explanationPanel) return;
        if (!state) {
            this.explanationPanel.classList.remove('visible');
            return;
        }

        let text = '';
        const pfText = `${this.fmt(state.PF, 3)} (${state.pfLabel})`;

        if (type === 'R') {
            text = `<strong>Pure Resistive Circuit:</strong> Voltage and current are perfectly in phase (φ = 0.00°). The circuit dissipates real power (P = ${this.fmt(state.P)} W) with unity power factor (PF = 1.000). No reactive power is exchanged (Q = 0 VAR).`;
        } else if (type === 'L') {
            text = `<strong>Pure Inductive Circuit:</strong> Current lags voltage by exactly 90.00° (φ = +90.00°). The ideal inductor stores and releases magnetic energy without dissipating real power (P = 0.00 W, PF = 0.000 Lagging). All supplied power is purely reactive (Q = +${this.fmt(state.Q)} VAR).`;
        } else if (type === 'C') {
            text = `<strong>Pure Capacitive Circuit:</strong> Current leads voltage by exactly 90.00° (φ = −90.00°). The ideal capacitor stores and releases electrostatic energy without dissipating real power (P = 0.00 W, PF = 0.000 Leading). All supplied power is purely reactive (Q = ${this.fmt(state.Q)} VAR).`;
        } else if (type === 'RL') {
            text = `<strong>Series RL Circuit:</strong> Inductive reactance (XL = ${this.fmt(state.XL)} Ω) causes current to lag voltage by φ = +${this.fmt(state.phiDeg)}°. Real power (P = ${this.fmt(state.P)} W) is dissipated by the resistor, while reactive power (Q = +${this.fmt(state.Q)} VAR) is exchanged by the inductor. Power factor is ${pfText}.`;
        } else if (type === 'RC') {
            text = `<strong>Series RC Circuit:</strong> Capacitive reactance (XC = ${this.fmt(state.XC)} Ω) causes current to lead voltage by φ = ${this.fmt(state.phiDeg)}°. Real power (P = ${this.fmt(state.P)} W) is dissipated by the resistor, while capacitive reactive power (Q = ${this.fmt(state.Q)} VAR) is exchanged by the capacitor. Power factor is ${pfText}.`;
        } else if (type === 'RLC') {
            if (Math.abs(state.phiDeg) < 0.01) {
                text = `<strong>Series RLC at Resonance:</strong> Inductive and capacitive reactances cancel exactly (XL = XC = ${this.fmt(state.XL)} Ω, net X = 0.00 Ω). Total impedance is purely resistive (Z = R = ${this.fmt(state.resR)} Ω), maximizing current to Irms = ${this.fmt(state.Irms, 3)} A. Voltage and current are in phase (φ = 0.00°, PF = 1.000 Unity). Resonant frequency fr = ${this.fmt(state.fr)} Hz.`;
            } else if (state.netX > 0) {
                text = `<strong>Series RLC (Net Inductive):</strong> XL (${this.fmt(state.XL)} Ω) > XC (${this.fmt(state.XC)} Ω), resulting in positive net reactance X = +${this.fmt(state.netX)} Ω. Current lags voltage by φ = +${this.fmt(state.phiDeg)}° with lagging power factor ${pfText}. Q = +${this.fmt(state.Q)} VAR. Operating frequency (f = ${this.fmt(state.f)} Hz) is above resonance (fr = ${this.fmt(state.fr)} Hz).`;
            } else {
                text = `<strong>Series RLC (Net Capacitive):</strong> XC (${this.fmt(state.XC)} Ω) > XL (${this.fmt(state.XL)} Ω), resulting in negative net reactance X = ${this.fmt(state.netX)} Ω. Current leads voltage by φ = ${this.fmt(state.phiDeg)}° with leading power factor ${pfText}. Q = ${this.fmt(state.Q)} VAR. Operating frequency (f = ${this.fmt(state.f)} Hz) is below resonance (fr = ${this.fmt(state.fr)} Hz).`;
            }
        }

        this.explanationPanel.innerHTML = text;
        this.explanationPanel.classList.add('visible');
    }

    // ==========================================
    // Formatting Helpers
    // ==========================================
    fmt(val, precision) {
        if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return 'Undefined';
        const p = precision !== undefined ? precision : 2;
        const abs = Math.abs(val);
        if (abs === 0) return (0).toFixed(p);
        if (abs >= 1e6 || (abs > 0 && abs < 1e-3)) return val.toExponential(p);
        return val.toFixed(p);
    }

    fmtAngle(deg) {
        if (typeof deg !== 'number' || isNaN(deg) || !isFinite(deg)) return 'Undefined';
        const sign = deg >= 0 ? '+' : '';
        return `${sign}${deg.toFixed(2)}`;
    }

    dispose() {
        this.ctx = null;
    }
}

// Expose CircuitSimulator, Circuit3DViewer, and PhasorDiagram globally for browsers and test runners
if (typeof window !== 'undefined') {
    window.CircuitSimulator = CircuitSimulator;
    window.Circuit3DViewer = Circuit3DViewer;
    window.HelixCurve = HelixCurve;
    window.PhasorDiagram = PhasorDiagram;
    window.PhasorLabelManager = PhasorLabelManager;
}
if (typeof global !== 'undefined') {
    global.CircuitSimulator = CircuitSimulator;
    global.Circuit3DViewer = Circuit3DViewer;
    global.HelixCurve = HelixCurve;
    global.PhasorDiagram = PhasorDiagram;
    global.PhasorLabelManager = PhasorLabelManager;
}

// Instantiate simulator once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.simulator = new CircuitSimulator();
});
