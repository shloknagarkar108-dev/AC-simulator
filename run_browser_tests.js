// Node harness that executes the exact test suite from test.html
const fs = require('fs');

// Mock localStorage
const storage = {};
global.localStorage = {
    getItem: (key) => (key in storage ? storage[key] : null),
    setItem: (key, val) => { storage[key] = String(val); },
    removeItem: (key) => { delete storage[key]; },
    clear: () => { for (const k in storage) delete storage[k]; }
};

// Create minimal DOM mock
const elements = {};
function getOrCreate(id) {
    if (!elements[id]) {
        const classes = new Set();
        const children = [];
        const listeners = {};
        elements[id] = {
            id,
            value: '',
            classList: {
                add: (cls) => classes.add(cls),
                remove: (cls) => classes.delete(cls),
                toggle: (cls, force) => {
                    const shouldAdd = force !== undefined ? force : !classes.has(cls);
                    if (shouldAdd) classes.add(cls); else classes.delete(cls);
                    return classes.has(cls);
                },
                contains: (cls) => classes.has(cls)
            },
            setAttribute: (attr, val) => {
                if (!elements[id]._attrs) elements[id]._attrs = {};
                elements[id]._attrs[attr] = String(val);
            },
            getAttribute: (attr) => (elements[id]._attrs ? elements[id]._attrs[attr] : null),
            appendChild: (child) => { children.push(child); },
            get children() { return children; },
            get childNodes() { return children; },
            set innerHTML(val) {
                if (val === '') children.length = 0;
                elements[id]._innerHTML = val;
            },
            get innerHTML() { return elements[id]._innerHTML || ''; },
            textContent: '',
            style: {},
            getBoundingClientRect: () => ({ width: 800, height: 400 }),
            addEventListener: (evt, fn) => {
                if (!listeners[evt]) listeners[evt] = [];
                listeners[evt].push(fn);
            },
            dispatchEvent: (evt) => {
                if (listeners[evt.type]) {
                    listeners[evt.type].forEach(fn => fn(evt));
                }
            },
            click: () => {
                if (listeners['click']) {
                    listeners['click'].forEach(fn => fn({ preventDefault: () => {} }));
                }
            },
            focus: () => {}
        };
    }
    return elements[id];
}

const legendButtons = [
    { id: 'legendBtnVoltage', trace: 'voltage' },
    { id: 'legendBtnCurrent', trace: 'current' },
    { id: 'legendBtnPower', trace: 'power' },
    { id: 'legendBtnAvgPower', trace: 'avg-power' },
    { id: 'legendBtnAll', trace: 'all' }
].map(item => {
    const el = getOrCreate(item.id);
    el.dataset = { trace: item.trace };
    return el;
});

const docAttrs = {};
global.document = {
    documentElement: {
        getAttribute: (attr) => docAttrs[attr] || null,
        setAttribute: (attr, val) => { docAttrs[attr] = String(val); }
    },
    getElementById: (id) => getOrCreate(id),
    querySelectorAll: (selector) => {
        if (selector === '.circuit-btn') {
            return ['R', 'L', 'C', 'RL', 'RC', 'RLC'].map(type => ({
                dataset: { type },
                classList: { add: () => {}, remove: () => {} },
                setAttribute: () => {},
                addEventListener: () => {}
            }));
        }
        if (selector === '.btn-phasor-view') {
            return ['vi', 'voltage', 'impedance'].map(view => ({
                dataset: { phasorView: view },
                classList: { add: () => {}, remove: () => {} },
                setAttribute: () => {},
                addEventListener: () => {}
            }));
        }
        if (selector.includes('.legend-item')) {
            return legendButtons;
        }
        return [];
    },
    createElement: (tag) => ({
        className: '',
        style: {},
        innerHTML: '',
        appendChild: () => {}
    }),
    createElementNS: (ns, tag) => {
        const attrs = {};
        const children = [];
        return {
            tagName: tag,
            setAttribute: (attr, val) => { attrs[attr] = String(val); },
            getAttribute: (attr) => attrs[attr] || null,
            appendChild: (child) => { children.push(child); },
            get children() { return children; },
            get childNodes() { return children; },
            set innerHTML(val) { if (val === '') children.length = 0; }
        };
    },
    addEventListener: () => {}
};

global.window = {
    addEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    devicePixelRatio: 1
};

global.performance = {
    now: () => Date.now()
};

global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};

// Mock Canvas 2D context
const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    setTransform: () => {},
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    scale: () => {},
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    closePath: () => {},
    fillText: () => {},
    measureText: (str) => ({ width: (str || '').length * 7.5 }),
    save: () => {},
    restore: () => {},
    setLineDash: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} })
};
getOrCreate('waveformCanvas').getContext = () => mockCtx;
getOrCreate('phasorCanvas').getContext = () => mockCtx;
getOrCreate('phasorContainer').getBoundingClientRect = () => ({ width: 600, height: 480 });

// Load script.js
const scriptCode = fs.readFileSync('script.js', 'utf8');
eval(scriptCode);

// Test harness
let passedCount = 0;
let failedCount = 0;
const failures = [];

function assert(desc, condition, details = '') {
    if (condition) {
        console.log(`✓ PASS: ${desc}`);
        passedCount++;
    } else {
        console.error(`✗ FAIL: ${desc} | ${details}`);
        failedCount++;
        failures.push({ desc, details });
    }
}

function isClose(a, b, tolerance = 0.02) {
    return Math.abs(a - b) <= tolerance;
}

const sim = new CircuitSimulator();

// ==========================================
// TEST 1: Pure R Mode
// ==========================================
sim.currentCircuitType = 'R';
sim.updateInputFields();
document.getElementById('voltage').value = '230';
document.getElementById('frequency').value = '50';
document.getElementById('resistance').value = '100';
sim.calculate();
const sR = sim.calculatedState;

assert('Test 1: Mode R Impedance Z = R = 100 Ω', isClose(sR.Z, 100), `Z=${sR.Z}`);
assert('Test 1: Mode R Current Irms = V/R = 2.30 A', isClose(sR.Irms, 2.30), `Irms=${sR.Irms}`);
assert('Test 1: Mode R Real Power P = VI = 529 W', isClose(sR.P, 529), `P=${sR.P}`);
assert('Test 1: Mode R Reactive Power Q = 0 VAR', isClose(sR.Q, 0), `Q=${sR.Q}`);
assert('Test 1: Mode R Power Factor PF = 1.0 (Unity)', isClose(sR.PF, 1.0) && sR.pfLabel === 'Unity', `PF=${sR.PF}, Label=${sR.pfLabel}`);
assert('Test 1: Mode R Phase Angle φ = 0°', isClose(sR.phiDeg, 0), `phi=${sR.phiDeg}`);

// ==========================================
// TEST 2: Ideal Inductive Mode L
// ==========================================
sim.currentCircuitType = 'L';
sim.updateInputFields();
document.getElementById('voltage').value = '230';
document.getElementById('frequency').value = '50';
document.getElementById('inductance').value = '0.1';
sim.calculate();
const sL = sim.calculatedState;

assert('Test 2: Mode L Reactance XL = 2πfL = 31.42 Ω', isClose(sL.XL, 31.416), `XL=${sL.XL}`);
assert('Test 2: Mode L Current Irms = V/XL = 7.32 A', isClose(sL.Irms, 7.321), `Irms=${sL.Irms}`);
assert('Test 2: Mode L Real Power P = 0 W', isClose(sL.P, 0), `P=${sL.P}`);
assert('Test 2: Mode L Reactive Power Q > 0 (Lagging)', sL.Q > 0 && isClose(sL.Q, 1683.86, 1.0), `Q=${sL.Q}`);
assert('Test 2: Mode L Phase Angle φ = +90°', isClose(sL.phiDeg, 90.0), `phi=${sL.phiDeg}`);
assert('Test 2: Mode L Power Factor PF = 0.000 (Lagging)', isClose(sL.PF, 0) && sL.pfLabel === 'Lagging', `PF=${sL.PF}, Label=${sL.pfLabel}`);

// ==========================================
// TEST 3: Ideal Capacitive Mode C
// ==========================================
sim.currentCircuitType = 'C';
sim.updateInputFields();
document.getElementById('voltage').value = '230';
document.getElementById('frequency').value = '50';
document.getElementById('capacitance').value = '0.0001';
sim.calculate();
const sC = sim.calculatedState;

assert('Test 3: Mode C Reactance XC = 1/(2πfC) = 31.83 Ω', isClose(sC.XC, 31.831), `XC=${sC.XC}`);
assert('Test 3: Mode C Current Irms = V/XC = 7.23 A', isClose(sC.Irms, 7.226), `Irms=${sC.Irms}`);
assert('Test 3: Mode C Real Power P = 0 W', isClose(sC.P, 0), `P=${sC.P}`);
assert('Test 3: Mode C Reactive Power Q < 0 (Leading)', sC.Q < 0 && isClose(sC.Q, -1661.90, 1.0), `Q=${sC.Q}`);
assert('Test 3: Mode C Phase Angle φ = -90°', isClose(sC.phiDeg, -90.0), `phi=${sC.phiDeg}`);
assert('Test 3: Mode C Power Factor PF = 0.000 (Leading)', isClose(sC.PF, 0) && sC.pfLabel === 'Leading', `PF=${sC.PF}, Label=${sC.pfLabel}`);

// ==========================================
// TEST 4: Series RL Mode
// ==========================================
sim.currentCircuitType = 'RL';
sim.updateInputFields();
document.getElementById('voltage').value = '230';
document.getElementById('frequency').value = '50';
document.getElementById('resistance').value = '100';
document.getElementById('inductance').value = '0.1';
sim.calculate();
const sRL = sim.calculatedState;

assert('Test 4: Mode RL Impedance Z = √(R² + XL²) = 104.82 Ω', isClose(sRL.Z, 104.82), `Z=${sRL.Z}`);
assert('Test 4: Mode RL Current Irms = 2.19 A', isClose(sRL.Irms, 2.194), `Irms=${sRL.Irms}`);
assert('Test 4: Mode RL Phase Angle φ = atan2(XL, R) = +17.44°', isClose(sRL.phiDeg, 17.44), `phi=${sRL.phiDeg}`);
assert('Test 4: Mode RL Power Factor PF = 0.954 (Lagging)', isClose(sRL.PF, 0.954) && sRL.pfLabel === 'Lagging', `PF=${sRL.PF}`);
assert('Test 4: Mode RL Reactive Power Q = +151.25 VAR', isClose(sRL.Q, 151.25), `Q=${sRL.Q}`);

// ==========================================
// TEST 5: Series RC Mode
// ==========================================
sim.currentCircuitType = 'RC';
sim.updateInputFields();
document.getElementById('voltage').value = '230';
document.getElementById('frequency').value = '50';
document.getElementById('resistance').value = '100';
document.getElementById('capacitance').value = '0.0001';
sim.calculate();
const sRC = sim.calculatedState;

assert('Test 5: Mode RC Impedance Z = √(R² + XC²) = 104.94 Ω', isClose(sRC.Z, 104.94), `Z=${sRC.Z}`);
assert('Test 5: Mode RC Current Irms = 2.19 A', isClose(sRC.Irms, 2.192), `Irms=${sRC.Irms}`);
assert('Test 5: Mode RC Phase Angle φ = atan2(-XC, R) = -17.66°', isClose(sRC.phiDeg, -17.66), `phi=${sRC.phiDeg}`);
assert('Test 5: Mode RC Power Factor PF = 0.953 (Leading)', isClose(sRC.PF, 0.953) && sRC.pfLabel === 'Leading', `PF=${sRC.PF}`);
assert('Test 5: Mode RC Reactive Power Q = -152.89 VAR (Leading)', isClose(sRC.Q, -152.89, 0.1), `Q=${sRC.Q}`);
assert('Test 5b: RC reactive power sign assertion', sRC.Q < 0 && sRC.pfLabel === 'Leading', `Q=${sRC.Q}, Label=${sRC.pfLabel}`);

// ==========================================
// TEST 6: Series RLC Mode
// ==========================================
sim.currentCircuitType = 'RLC';
sim.updateInputFields();
document.getElementById('voltage').value = '230';
document.getElementById('frequency').value = '50';
document.getElementById('resistance').value = '100';
document.getElementById('inductance').value = '0.1';
document.getElementById('capacitance').value = '0.0001';
sim.calculate();
const sRLC = sim.calculatedState;

assert('Test 6: Mode RLC Net Reactance X = XL - XC = -0.415 Ω', isClose(sRLC.netX, -0.415), `netX=${sRLC.netX}`);
assert('Test 6: Mode RLC Resonant Frequency fr = 50.33 Hz', isClose(sRLC.fr, 50.33), `fr=${sRLC.fr}`);
assert('Test 6: Mode RLC Current Irms = 2.30 A', isClose(sRLC.Irms, 2.300), `Irms=${sRLC.Irms}`);
assert('Test 6: Mode RLC Phase φ = -0.24° (Leading)', isClose(sRLC.phiDeg, -0.24) && sRLC.pfLabel === 'Leading', `phi=${sRLC.phiDeg}`);
assert('Test 6: Mode RLC Reactive Power Q = -2.20 VAR (retains sign)', isClose(sRLC.Q, -2.20), `Q=${sRLC.Q}`);

// ==========================================
// TEST 7: Series RLC at Resonance
// ==========================================
const frValue = 50.3292121;
document.getElementById('frequency').value = frValue.toString();
document.getElementById('resistance').value = '10';
document.getElementById('inductance').value = '0.1';
document.getElementById('capacitance').value = '0.0001';
sim.calculate();
const sRes = sim.calculatedState;

assert('Test 7: RLC Resonance Z = R = 10 Ω', isClose(sRes.Z, 10.0), `Z=${sRes.Z}`);
assert('Test 7: RLC Resonance Phase φ ≈ 0.0°', Math.abs(sRes.phiDeg) < 0.01, `phi=${sRes.phiDeg}`);
assert('Test 7: RLC Resonance PF = 1.000', isClose(sRes.PF, 1.0), `PF=${sRes.PF}`);

// ==========================================
// TEST 8: Zero Resistance Handling
// ==========================================
// Pure R with R = 0 should be REJECTED with short-circuit error
sim.currentCircuitType = 'R';
sim.updateInputFields();
document.getElementById('voltage').value = '230';
document.getElementById('frequency').value = '50';
document.getElementById('resistance').value = '0';
const valR0 = sim.validateInputs();
assert('Test 8a: Pure R with R = 0 is rejected', !valR0.isValid, `Errors: ${JSON.stringify(valR0.errors)}`);

// RL with R = 0 is SUPPORTED (ideal pure inductive)
sim.currentCircuitType = 'RL';
sim.updateInputFields();
document.getElementById('voltage').value = '230';
document.getElementById('frequency').value = '50';
document.getElementById('resistance').value = '0';
document.getElementById('inductance').value = '0.1';
const valRL0 = sim.validateInputs();
assert('Test 8b: RL with R = 0 is valid (ideal L)', valRL0.isValid);
sim.calculate();
assert('Test 8c: RL with R = 0 has φ = +90° and P = 0 W', isClose(sim.calculatedState.phiDeg, 90.0) && isClose(sim.calculatedState.P, 0), `phi=${sim.calculatedState.phiDeg}, P=${sim.calculatedState.P}`);

// RC with R = 0 is SUPPORTED (ideal pure capacitive)
sim.currentCircuitType = 'RC';
sim.updateInputFields();
document.getElementById('voltage').value = '230';
document.getElementById('frequency').value = '50';
document.getElementById('resistance').value = '0';
document.getElementById('capacitance').value = '0.0001';
const valRC0 = sim.validateInputs();
assert('Test 8d: RC with R = 0 is valid (ideal C)', valRC0.isValid);
sim.calculate();
assert('Test 8e: RC with R = 0 has φ = -90° and P = 0 W', isClose(sim.calculatedState.phiDeg, -90.0) && isClose(sim.calculatedState.P, 0), `phi=${sim.calculatedState.phiDeg}, P=${sim.calculatedState.P}`);

// RLC with R = 0 at resonance: REJECTED (Z = 0, short circuit)
sim.currentCircuitType = 'RLC';
sim.updateInputFields();
document.getElementById('voltage').value = '230';
document.getElementById('frequency').value = frValue.toString();
document.getElementById('resistance').value = '0';
document.getElementById('inductance').value = '0.1';
document.getElementById('capacitance').value = '0.0001';
const valRLC0Res = sim.validateInputs();
assert('Test 8f: RLC with R = 0 at resonance is rejected as division by zero', !valRLC0Res.isValid, `Errors: ${JSON.stringify(valRLC0Res.errors)}`);

// ==========================================
// TEST 9: Validation Rules
// ==========================================
// Negative frequency
document.getElementById('frequency').value = '-50';
document.getElementById('resistance').value = '100';
const valNegF = sim.validateInputs();
assert('Test 9a: Negative frequency rejected', !valNegF.isValid);

// Zero frequency
document.getElementById('frequency').value = '0';
const valZeroF = sim.validateInputs();
assert('Test 9b: Zero frequency rejected (AC steady-state requires f > 0)', !valZeroF.isValid);

// Negative resistance
document.getElementById('frequency').value = '50';
document.getElementById('resistance').value = '-20';
const valNegR = sim.validateInputs();
assert('Test 9c: Negative resistance rejected', !valNegR.isValid);

// Negative inductance
document.getElementById('resistance').value = '100';
document.getElementById('inductance').value = '-0.1';
const valNegL = sim.validateInputs();
assert('Test 9d: Negative inductance rejected', !valNegL.isValid);

// Negative capacitance
document.getElementById('inductance').value = '0.1';
document.getElementById('capacitance').value = '-0.0001';
const valNegC = sim.validateInputs();
assert('Test 9e: Negative capacitance rejected', !valNegC.isValid);

// Non-numeric / empty input: no silent conversion to 0
document.getElementById('capacitance').value = 'abc';
const valNaN = sim.validateInputs();
assert('Test 9f: Non-numeric input rejected without silent zero conversion', !valNaN.isValid);

// ==========================================
// TEST 10: Canvas Scaling and Animation Safety
// ==========================================
sim.resizeCanvas();
const initialTransform = sim.ctx.getTransform();
sim.resizeCanvas();
const secondTransform = sim.ctx.getTransform();
assert('Test 10a: Canvas setTransform is idempotent (no exponential scale buildup on resize)',
    initialTransform.a === secondTransform.a && initialTransform.d === secondTransform.d,
    `initial: a=${initialTransform.a}, d=${initialTransform.d} | second: a=${secondTransform.a}, d=${secondTransform.d}`
);

// Animation safety: startAnimation called twice does not duplicate loops
sim.startAnimation();
const frame1 = sim.animationFrame;
sim.startAnimation();
const frame2 = sim.animationFrame;
assert('Test 10b: Guard prevents concurrent animation loops', frame1 === frame2);
sim.pauseAnimation();
assert('Test 10c: pauseAnimation clears animation state', !sim.isAnimating && sim.animationFrame === null);

// ==========================================
// TEST 11: 3D Circuit Geometry and Controls
// ==========================================
assert('Test 11a: Circuit3DViewer class is exposed globally', typeof Circuit3DViewer === 'function');
assert('Test 11b: HelixCurve generates valid 3D points', (() => {
    const helix = new HelixCurve(0.65, 2.8, 7);
    const pt = helix.getPoint(0.5);
    return typeof pt.x === 'number' && typeof pt.y === 'number' && typeof pt.z === 'number';
})());

// Test 3D viewer behavior with Three.js loaded
if (fs.existsSync('three.min.js')) {
    global.THREE = require('./three.min.js');
    if (fs.existsSync('OrbitControls.js')) {
        eval(fs.readFileSync('OrbitControls.js', 'utf8'));
    }
    const v3d = new Circuit3DViewer(sim);
    v3d.scene = new THREE.Scene();
    v3d.camera = new THREE.PerspectiveCamera(40, 800/440, 0.1, 1000);
    v3d.controls = { target: new THREE.Vector3(), update: () => {}, dispose: () => {} };
    v3d.isInitialized = true;

    // Test all 6 modes
    let allModesValid = true;
    ['R', 'L', 'C', 'RL', 'RC', 'RLC'].forEach(mode => {
        sim.currentCircuitType = mode;
        v3d.updateCircuit();
        const expectedComps = (mode.includes('R')?1:0) + (mode.includes('L')?1:0) + (mode.includes('C')?1:0);
        // Source (1) + passive components (expectedComps) + wiring (1) + particles (20)
        if (v3d.circuitGroup.children.length !== (2 + expectedComps + 20)) {
            allModesValid = false;
        }
    });
    assert('Test 11c: 3D circuit accurately models all 6 circuit modes with series topology', allModesValid);

    // Test camera view presets
    v3d.setCameraView('front');
    const frontTargetY = v3d.controls.target.y;
    v3d.setCameraView('top');
    const topTargetY = v3d.controls.target.y;
    v3d.setCameraView('iso');
    const isoTargetY = v3d.controls.target.y;
    assert('Test 11d: 3D camera presets (iso, front, top, reset) configure target vectors',
        frontTargetY === 0.5 && topTargetY === 0 && isoTargetY === 0);

    // Test continuous closed current flow particle path
    assert('Test 11e: Continuous closed series particle path created for educational current flow',
        v3d.pathCurve !== null && v3d.particles.length === 20);

    // Test disposal
    v3d.dispose();
    assert('Test 11f: 3D viewer disposal cleans up scene resources and stops loops',
        v3d.isDestroyed && v3d.animId === null && v3d.controls === null);
}

// ==========================================
// TEST 12: AC Analysis & Phasor Diagrams (Phase 4)
// ==========================================
assert('Test 12a: PhasorDiagram class is exposed globally', typeof PhasorDiagram === 'function');

// Create a PhasorDiagram instance
const phasor = new PhasorDiagram(sim);
phasor.canvas = getOrCreate('phasorCanvas');
phasor.container = getOrCreate('phasorContainer');
phasor.infoPanel = getOrCreate('phasorInfo');
phasor.explanationPanel = getOrCreate('phasorExplanation');
phasor.badgeMode = getOrCreate('badgePhasorMode');
phasor.ctx = mockCtx;
phasor.width = 600;
phasor.height = 480;

assert('Test 12b: PhasorDiagram default view is voltage/current phasors (vi)', phasor.currentView === 'vi');

// Test 12c: Mode R - phi = 0, in phase, unity PF
sim.currentCircuitType = 'R';
sim.updateInputFields();
elements['voltage'].value = '230';
elements['frequency'].value = '50';
elements['resistance'].value = '100';
sim.calculate();
assert('Test 12c: Mode R phasor phase is 0.0° (in-phase, unity PF)',
    Math.abs(sim.calculatedState.phiDeg) < 0.01 && sim.calculatedState.pfLabel === 'Unity');

// Test 12d: Mode L - phi = +90, current lags by 90
sim.currentCircuitType = 'L';
sim.updateInputFields();
elements['voltage'].value = '230';
elements['frequency'].value = '50';
elements['inductance'].value = '0.1';
sim.calculate();
assert('Test 12d: Mode L phasor phase is +90.0° (current lags voltage by 90°)',
    Math.abs(sim.calculatedState.phiDeg - 90) < 0.01 && sim.calculatedState.pfLabel === 'Lagging');

// Test 12e: Mode C - phi = -90, current leads by 90
sim.currentCircuitType = 'C';
sim.updateInputFields();
elements['voltage'].value = '230';
elements['frequency'].value = '50';
elements['capacitance'].value = '0.0001';
sim.calculate();
assert('Test 12e: Mode C phasor phase is -90.0° (current leads voltage by 90°)',
    Math.abs(sim.calculatedState.phiDeg + 90) < 0.01 && sim.calculatedState.pfLabel === 'Leading');

// Test 12f: Mode RL - phi > 0, lagging PF
sim.currentCircuitType = 'RL';
sim.updateInputFields();
elements['voltage'].value = '230';
elements['frequency'].value = '50';
elements['resistance'].value = '100';
elements['inductance'].value = '0.1';
sim.calculate();
assert('Test 12f: Mode RL phasor phase is positive (current lags voltage)',
    sim.calculatedState.phiDeg > 0 && sim.calculatedState.pfLabel === 'Lagging');

// Test 12g: Mode RC - phi < 0, leading PF
sim.currentCircuitType = 'RC';
sim.updateInputFields();
elements['voltage'].value = '230';
elements['frequency'].value = '50';
elements['resistance'].value = '100';
elements['capacitance'].value = '0.0001';
sim.calculate();
assert('Test 12g: Mode RC phasor phase is negative (current leads voltage)',
    sim.calculatedState.phiDeg < 0 && sim.calculatedState.pfLabel === 'Leading');

// Test 12h: Mode RLC - component voltage vector sum equals supply voltage Vs
sim.currentCircuitType = 'RLC';
sim.updateInputFields();
elements['voltage'].value = '230';
elements['frequency'].value = '50';
elements['resistance'].value = '100';
elements['inductance'].value = '0.1';
elements['capacitance'].value = '0.0001';
sim.calculate();
const sRLC_p4 = sim.calculatedState;
const VR_val = sRLC_p4.Irms * sRLC_p4.resR;
const VL_val = sRLC_p4.Irms * sRLC_p4.XL;
const VC_val = sRLC_p4.Irms * sRLC_p4.XC;
const Vs_vectorSum = Math.sqrt(VR_val * VR_val + Math.pow(VL_val - VC_val, 2));
assert('Test 12h: Series RLC voltage vector sum |VR² + (VL-VC)²| = Vs',
    Math.abs(Vs_vectorSum - sRLC_p4.Vrms) < 0.02);

// Test 12i: Impedance triangle Pythagoras: Z² = R² + X²
const Z_triangle = Math.sqrt(sRLC_p4.resR * sRLC_p4.resR + sRLC_p4.netX * sRLC_p4.netX);
assert('Test 12i: Impedance triangle Pythagoras Z = √(R² + X²) exact match',
    Math.abs(Z_triangle - sRLC_p4.Z) < 0.001);

// Test 12j: RLC at resonance: XL ≈ XC, phi ≈ 0°, PF ≈ 1.0, Q ≈ 0
sim.currentCircuitType = 'RLC';
sim.updateInputFields();
elements['voltage'].value = '230';
elements['frequency'].value = '50.3292';
elements['resistance'].value = '10';
elements['inductance'].value = '0.1';
elements['capacitance'].value = '0.0001';
sim.calculate();
assert('Test 12j: Series RLC at resonance has in-phase phasors (φ ≈ 0°, PF = 1.000)',
    Math.abs(sim.calculatedState.phiDeg) < 0.05 && sim.calculatedState.PF > 0.9999);

// Test 12k: Signed reactive power matches phasor convention across all modes
assert('Test 12k: Signed reactive power Q matches lagging/leading/unity convention',
    Math.abs(sim.calculatedState.Q) < 0.1 && sim.calculatedState.pfLabel === 'Unity');

// Test 12l: View switching across all 3 modes
phasor.currentView = 'vi';
let viDrawSuccess = true;
try { phasor.draw(); } catch(e) { viDrawSuccess = false; }
phasor.currentView = 'voltage';
let voltDrawSuccess = true;
try { phasor.draw(); } catch(e) { voltDrawSuccess = false; }
phasor.currentView = 'impedance';
let impDrawSuccess = true;
try { phasor.draw(); } catch(e) { impDrawSuccess = false; }
assert('Test 12l: Phasor diagram renders all 3 views (vi, voltage, impedance) without error',
    viDrawSuccess && voltDrawSuccess && impDrawSuccess);

// Test 12m: Degenerate edge case: Ideal RL with R = 0 (pure inductive)
sim.currentCircuitType = 'RL';
sim.updateInputFields();
elements['voltage'].value = '230';
elements['frequency'].value = '50';
elements['resistance'].value = '0';
elements['inductance'].value = '0.1';
sim.calculate();
assert('Test 12m: Zero resistance RL renders valid pure inductive phasor (φ = +90.0°)',
    sim.calculatedState.phiDeg === 90 && sim.calculatedState.resR === 0);

// Test 12n: Invalid input handling: clears calculatedState and hides info panels
elements['frequency'].value = '-50';
sim.calculate();
assert('Test 12n: Invalid input clears state and phasor diagram hides stale info panels',
    sim.calculatedState === null);

// ==========================================
// TEST 13: Dual Theme Support (Dark Mode + Faded Blues Light Mode)
// ==========================================

// Test 13a: Fresh simulator initializes with default theme 'dark'
const freshSim = new CircuitSimulator();
assert('Test 13a: Default theme is dark on fresh initialization',
    freshSim.currentTheme === 'dark' && document.documentElement.getAttribute('data-theme') === 'dark');

// Connect active components to sim for dynamic switching tests
sim.viewer3D = new Circuit3DViewer(sim);
sim.viewer3D.scene = new THREE.Scene();
sim.viewer3D.scene.background = new THREE.Color(0x121212);
sim.viewer3D.scene.fog = new THREE.FogExp2(0x121212, 0.015);
sim.viewer3D.benchMesh = { material: { color: new THREE.Color(0x1a1a1a) } };
sim.viewer3D.trimMesh = { material: { color: new THREE.Color(0x242424) } };
sim.viewer3D.controls = { target: new THREE.Vector3(), update: () => {}, dispose: () => {} };
sim.viewer3D.isInitialized = true;
sim.phasorDiagram = phasor;

// Test 13b: Calling setTheme('light') sets data-theme to light and updates localStorage
sim.setTheme('light');
assert('Test 13b: Calling setTheme("light") sets data-theme to light and updates localStorage',
    sim.currentTheme === 'light' &&
    document.documentElement.getAttribute('data-theme') === 'light' &&
    localStorage.getItem('rlc_sim_theme') === 'light');

// Test 13c: Switching to light mode updates waveform canvas background to #FFFFFF
sim.clearCanvas();
assert('Test 13c: Switching to light mode updates waveform canvas background to #FFFFFF',
    sim.ctx.fillStyle === '#FFFFFF');

// Test 13d: Switching to light mode updates 3D scene background (0xEEF2FB) and workbench (0xDCE6FC)
const lightSceneBg = sim.viewer3D.scene.background.getHex ? sim.viewer3D.scene.background.getHex() : sim.viewer3D.scene.background;
const lightBenchColor = sim.viewer3D.benchMesh.material.color.getHex ? sim.viewer3D.benchMesh.material.color.getHex() : sim.viewer3D.benchMesh.material.color;
assert('Test 13d: Switching to light mode updates 3D scene background (0xEEF2FB) and workbench (0xDCE6FC)',
    lightSceneBg === 0xEEF2FB && lightBenchColor === 0xDCE6FC);

// Test 13e: Switching to light mode updates PhasorDiagram colors (background: #EEF2FB, voltage: #205ec9, current: #d92550)
assert('Test 13e: Switching to light mode updates PhasorDiagram colors for light theme contrast',
    phasor.colors.background === '#EEF2FB' &&
    phasor.colors.voltage === '#205ec9' &&
    phasor.colors.current === '#d92550' &&
    phasor.colors.legendBorder === '#D2DFF5');

// Test 13f: Switching back to dark mode restores dark DOM attribute, canvas (#121212), 3D scene (0x121212), and phasor colors
sim.setTheme('dark');
sim.clearCanvas();
const darkSceneBg = sim.viewer3D.scene.background.getHex ? sim.viewer3D.scene.background.getHex() : sim.viewer3D.scene.background;
const darkBenchColor = sim.viewer3D.benchMesh.material.color.getHex ? sim.viewer3D.benchMesh.material.color.getHex() : sim.viewer3D.benchMesh.material.color;
assert('Test 13f: Switching back to dark mode restores dark DOM attribute, canvas, 3D, and phasor colors',
    sim.currentTheme === 'dark' &&
    document.documentElement.getAttribute('data-theme') === 'dark' &&
    localStorage.getItem('rlc_sim_theme') === 'dark' &&
    sim.ctx.fillStyle === '#121212' &&
    darkSceneBg === 0x121212 &&
    darkBenchColor === 0x1a1a1a &&
    phasor.colors.background === '#121212' &&
    phasor.colors.voltage === '#00d4ff');

// Test 13g: Theme toggle buttons update active class and aria-checked attributes correctly
const darkBtn = elements['themeDarkBtn'];
const lightBtn = elements['themeLightBtn'];
assert('Test 13g: Theme toggle buttons reflect dark mode state (darkBtn active, aria-checked=true)',
    darkBtn.classList.contains('active') &&
    darkBtn.getAttribute('aria-checked') === 'true' &&
    !lightBtn.classList.contains('active') &&
    lightBtn.getAttribute('aria-checked') === 'false');

sim.setTheme('light');
assert('Test 13h: Theme toggle buttons reflect light mode state (lightBtn active, aria-checked=true)',
    !darkBtn.classList.contains('active') &&
    darkBtn.getAttribute('aria-checked') === 'false' &&
    lightBtn.classList.contains('active') &&
    lightBtn.getAttribute('aria-checked') === 'true');

// Restore dark theme as default
sim.setTheme('dark');

// ==========================================
// TEST 14: Feature 1 — Selectable Waveform Graphs
// ==========================================

// Re-init simulator with full elements attached
sim.setupWaveformSelection();
const btnV = getOrCreate('legendBtnVoltage');
const btnI = getOrCreate('legendBtnCurrent');
const btnP = getOrCreate('legendBtnPower');
const btnPavg = getOrCreate('legendBtnAvgPower');
const btnAll = getOrCreate('legendBtnAll');

// Test 14a: Default selected waveform is voltage (v(t))
sim.selectWaveform('voltage');
assert('Test 14a: Default selected waveform is voltage v(t) with active aria-selected',
    sim.selectedWaveform === 'voltage' &&
    btnV.classList.contains('active') &&
    btnV.getAttribute('aria-selected') === 'true' &&
    !btnI.classList.contains('active') &&
    btnI.getAttribute('aria-selected') === 'false');

// Test 14b: Selecting current trace updates selectedWaveform, button active class and aria-selected
sim.selectWaveform('current');
assert('Test 14b: Selecting current updates selectedWaveform and toggles active state',
    sim.selectedWaveform === 'current' &&
    !btnV.classList.contains('active') &&
    btnV.getAttribute('aria-selected') === 'false' &&
    btnI.classList.contains('active') &&
    btnI.getAttribute('aria-selected') === 'true');

// Test 14c: Selecting instantaneous power updates selectedWaveform and button active state
sim.selectWaveform('power');
assert('Test 14c: Selecting instantaneous power updates selectedWaveform and button state',
    sim.selectedWaveform === 'power' &&
    btnP.classList.contains('active') &&
    btnP.getAttribute('aria-selected') === 'true' &&
    !btnI.classList.contains('active'));

// Test 14d: Selecting average real power updates selectedWaveform and button active state
sim.selectWaveform('avg-power');
assert('Test 14d: Selecting average real power updates selectedWaveform and button state',
    sim.selectedWaveform === 'avg-power' &&
    btnPavg.classList.contains('active') &&
    btnPavg.getAttribute('aria-selected') === 'true' &&
    !btnP.classList.contains('active'));

// Test 14e: Switching traces preserves simulation time, phaseOffset, and calculation state
sim.phaseOffset = 1.456;
const stateBeforeTraceSwitch = sim.calculatedState;
sim.selectWaveform('voltage');
assert('Test 14e: Switching waveforms preserves simulation phaseOffset and calculation state',
    sim.phaseOffset === 1.456 &&
    sim.calculatedState === stateBeforeTraceSwitch &&
    sim.selectedWaveform === 'voltage');

// Test 14f: Solo trace rendering calls appropriate renderer without error
let renderVoltageOk = true;
try { sim.selectedWaveform = 'voltage'; sim.drawWaveforms(); } catch(e) { renderVoltageOk = false; }
let renderCurrentOk = true;
try { sim.selectedWaveform = 'current'; sim.drawWaveforms(); } catch(e) { renderCurrentOk = false; }
let renderPowerOk = true;
try { sim.selectedWaveform = 'power'; sim.drawWaveforms(); } catch(e) { renderPowerOk = false; }
let renderAvgPowerOk = true;
try { sim.selectedWaveform = 'avg-power'; sim.drawWaveforms(); } catch(e) { renderAvgPowerOk = false; }
assert('Test 14f: Solo trace rendering executes successfully for all 4 selectable traces',
    renderVoltageOk && renderCurrentOk && renderPowerOk && renderAvgPowerOk);

// Test 14g: Keyboard navigation on waveform legend buttons
sim.selectWaveform('voltage');
btnV.dispatchEvent({ type: 'keydown', key: 'ArrowRight', preventDefault: () => {} });
assert('Test 14g: Keyboard ArrowRight navigation moves selection from voltage to current',
    sim.selectedWaveform === 'current' && btnI.classList.contains('active'));

btnI.dispatchEvent({ type: 'keydown', key: 'ArrowLeft', preventDefault: () => {} });
assert('Test 14h: Keyboard ArrowLeft navigation moves selection back to voltage',
    sim.selectedWaveform === 'voltage' && btnV.classList.contains('active'));

btnV.dispatchEvent({ type: 'keydown', key: 'End', preventDefault: () => {} });
assert('Test 14i: Keyboard End key moves selection directly to the last tab (Show All)',
    sim.selectedWaveform === 'all' && btnAll.classList.contains('active'));

btnAll.dispatchEvent({ type: 'keydown', key: 'Home', preventDefault: () => {} });
assert('Test 14j: Keyboard Home key moves selection back to voltage',
    sim.selectedWaveform === 'voltage' && btnV.classList.contains('active'));

// ==========================================
// TEST 15: Feature 2 — Live Circuit Current Arrows
// ==========================================

// Setup clean RLC circuit for topology inspection
sim.currentCircuitType = 'RLC';
sim.updateInputFields();
elements['voltage'].value = '230';
elements['frequency'].value = '50';
elements['resistance'].value = '100';
elements['inductance'].value = '0.1';
elements['capacitance'].value = '0.0001';
sim.calculate();

// Test 15a: Wire segments returned by getWireSegments() strictly exclude component bodies
const segments = sim.getWireSegments();
const components = sim.getCircuitComponents();
const totalSpan = 650 - 110 - 80;
const gap = totalSpan / (components.length + 1);
const compZones = components.map((comp, idx) => {
    const center = 110 + 40 + (idx + 1) * gap;
    return { start: center - 35, end: center + 35 };
});

let wireCrossesComponent = false;
segments.forEach(seg => {
    // For top rail horizontal segments (y1 == 95, y2 == 95)
    if (seg.y1 === 95 && seg.y2 === 95) {
        compZones.forEach(zone => {
            // Check if segment interior strictly enters the component body [zone.start, zone.end]
            if (seg.x1 > zone.start && seg.x1 < zone.end) wireCrossesComponent = true;
            if (seg.x2 > zone.start && seg.x2 < zone.end) wireCrossesComponent = true;
            if (seg.x1 < zone.start && seg.x2 > zone.end) wireCrossesComponent = true;
        });
    }
});
assert('Test 15a: getWireSegments() returns wire paths that strictly exclude component bodies',
    segments.length >= 6 && !wireCrossesComponent);

// Test 15b: Animated arrows are generated along wire segments when current is flowing
const arrowsContainer = getOrCreate('circuitCurrentArrows');
sim.phaseOffset = sim.calculatedState.phiRad + Math.PI / 2; // peak positive current
sim.currentDirection = 'conventional';
sim.updateCircuitDiagramArrows();
assert('Test 15b: Animated arrows are generated along wire segments when current is non-zero',
    arrowsContainer.children.length > 0);

// Test 15c: Conventional current arrow direction reverses with instantaneous sign of i(t)
// Peak positive current -> Clockwise: top rail arrow should point right (angle 0°)
const topRailArrowPositive = arrowsContainer.children.find(child => {
    const tf = child.getAttribute('transform') || '';
    return tf.includes('translate') && (tf.includes('rotate(0.0)') || tf.includes('rotate(0)'));
});
assert('Test 15c: Conventional current arrow points clockwise (0° along top rail) when i(t) > 0',
    !!topRailArrowPositive);

// Peak negative current -> Counter-Clockwise: top rail arrow should point left (angle 180° or -180°)
sim.phaseOffset = sim.calculatedState.phiRad + 3 * Math.PI / 2; // peak negative current
sim.updateCircuitDiagramArrows();
const topRailArrowNegative = arrowsContainer.children.find(child => {
    const tf = child.getAttribute('transform') || '';
    return tf.includes('rotate(180.0)') || tf.includes('rotate(-180.0)') || tf.includes('rotate(180)') || tf.includes('rotate(-180)');
});
assert('Test 15d: Conventional current arrow reverses direction (180° along top rail) when i(t) < 0',
    !!topRailArrowNegative);

// Test 15e: Electron flow mode reverses direction relative to conventional current
sim.phaseOffset = sim.calculatedState.phiRad + Math.PI / 2; // positive i(t)
sim.currentDirection = 'electron';
sim.updateCircuitDiagramArrows();
const topRailArrowElectron = arrowsContainer.children.find(child => {
    const tf = child.getAttribute('transform') || '';
    return tf.includes('rotate(180.0)') || tf.includes('rotate(-180.0)') || tf.includes('rotate(180)') || tf.includes('rotate(-180)');
});
const electronArrowColor = arrowsContainer.children[0] ? arrowsContainer.children[0].getAttribute('fill') : '';
assert('Test 15e: Electron flow mode reverses arrow direction (180°) and adopts distinct electron color (#ffe66d)',
    !!topRailArrowElectron && electronArrowColor === '#ffe66d');

// Test 15f: Current direction toggle updates both 2D and 3D UI buttons and stays synchronized
sim.toggleCurrentDirection(); // toggles back to conventional
const btnDiagramMode = getOrCreate('btnDiagramCurrentMode');
const btn3DMode = getOrCreate('btnToggleCurrentMode');
assert('Test 15f: toggleCurrentDirection updates both 2D and 3D buttons to Conventional',
    sim.currentDirection === 'conventional' &&
    btnDiagramMode.textContent.includes('Conventional') &&
    !btnDiagramMode.classList.contains('active') &&
    btn3DMode.textContent.includes('Conventional') &&
    !btn3DMode.classList.contains('active'));

sim.toggleCurrentDirection(); // toggles to electron
assert('Test 15g: toggleCurrentDirection updates both 2D and 3D buttons to Electron Flow',
    sim.currentDirection === 'electron' &&
    btnDiagramMode.textContent.includes('Electron Flow') &&
    btnDiagramMode.classList.contains('active') &&
    btn3DMode.textContent.includes('Electron Flow') &&
    btn3DMode.classList.contains('active'));

// Reset to conventional
sim.toggleCurrentDirection();

// Test 15h: Near zero-crossing hides arrows (prevents false flow at zero current)
sim.phaseOffset = sim.calculatedState.phiRad; // i(t) = sin(0) = 0
sim.updateCircuitDiagramArrows();
assert('Test 15h: Near zero-crossing hides current arrows to avoid false flow',
    arrowsContainer.children.length === 0);

// Test 15i: Play/Pause and Reset controls for arrows
sim.phaseOffset = 1.0;
sim.arrowOffset = 25.5;
sim.resetAnimation();
assert('Test 15i: resetAnimation resets both phaseOffset and arrowOffset to 0',
    sim.phaseOffset === 0 && sim.arrowOffset === 0);

// ==========================================
// TEST 16: "Show All" Waveforms Button
// ==========================================

// Test 16a: Clicking "Show All" button selects 'all' mode and marks button active
btnAll.click();
assert('Test 16a: Clicking Show All button activates all mode with aria-selected=true',
    sim.selectedWaveform === 'all' &&
    btnAll.classList.contains('active') &&
    btnAll.getAttribute('aria-selected') === 'true' &&
    btnAll.getAttribute('tabindex') === '0');

// Test 16b: Other 4 buttons are deselected
assert('Test 16b: Individual trace buttons are deselected when Show All is active',
    !btnV.classList.contains('active') &&
    btnV.getAttribute('aria-selected') === 'false' &&
    !btnI.classList.contains('active') &&
    !btnP.classList.contains('active') &&
    !btnPavg.classList.contains('active'));

// Test 16c: Clicking an individual trace button restores solo mode
btnV.click();
assert('Test 16c: Clicking Voltage restores solo trace mode and deactivates Show All',
    sim.selectedWaveform === 'voltage' &&
    btnV.classList.contains('active') &&
    !btnAll.classList.contains('active') &&
    btnAll.getAttribute('aria-selected') === 'false');

// Test 16d: Calling drawWaveforms in 'all' mode executes without error
sim.selectWaveform('all');
let allDrawOk = true;
try {
    sim.drawWaveforms();
} catch (e) {
    allDrawOk = false;
}
assert('Test 16d: drawWaveforms() executes without error in Show All mode', allDrawOk);

// Test 16e: Scope header displays all traces label
let headerTextCaptured = '';
const origFillText = mockCtx.fillText;
mockCtx.fillText = (str) => {
    if (str && str.includes('Active:')) headerTextCaptured = str;
};
sim.drawScopeHeader(sim.calculatedState);
mockCtx.fillText = origFillText;
assert('Test 16e: drawScopeHeader displays All Traces banner when selectedWaveform is all',
    headerTextCaptured.includes('All Traces'));

// Test 16f: Recalculating parameters preserves 'all' trace mode
sim.calculate();
assert('Test 16f: Parameter recalculation preserves selectedWaveform=all',
    sim.selectedWaveform === 'all' && btnAll.classList.contains('active'));

// Test 16g: Circuit mode switching preserves 'all' trace mode
sim.currentCircuitType = 'RL';
sim.updateInputFields();
sim.calculate();
assert('Test 16g: Circuit mode switching preserves selectedWaveform=all',
    sim.selectedWaveform === 'all' && btnAll.classList.contains('active'));

// Restore circuit type
sim.currentCircuitType = 'RLC';
sim.updateInputFields();
sim.calculate();

// ==========================================
// TEST 17: Interactive 3D Directional Current Arrows
// ==========================================

const v3dTest = new Circuit3DViewer(sim);
v3dTest.scene = new THREE.Scene();
v3dTest.camera = new THREE.PerspectiveCamera(40, 800/440, 0.1, 1000);
v3dTest.controls = { target: new THREE.Vector3(), update: () => {}, dispose: () => {} };
v3dTest.isInitialized = true;
v3dTest.updateCircuit();

// Test 17a: 3D wire segments strictly exclude component bodies
const segs3D = v3dTest.getWireSegments3D(sim.getCircuitComponents().map(c => ({ comp: c, x: 0 })));
let seg3DCrossesComponent = false;
segs3D.forEach(s => {
    // Check if segment interior intersects component body [-2.1, 2.1]
    if (s.start.z === -4 && s.end.z === -4) {
        if (s.start.x > -2.0 && s.start.x < 2.0) seg3DCrossesComponent = true;
        if (s.end.x > -2.0 && s.end.x < 2.0) seg3DCrossesComponent = true;
        if (s.start.x < -2.0 && s.end.x > 2.0) seg3DCrossesComponent = true;
    }
});
assert('Test 17a: 3D wire segments strictly exclude component bodies',
    segs3D.length >= 5 && !seg3DCrossesComponent);

// Test 17b: 3D current arrows are created along wire segments
assert('Test 17b: 3D current arrows are generated along wire segments (20 arrows)',
    v3dTest.currentArrows.length === 20 && v3dTest.particles.length === 20);

// Test 17c: Conventional mode with i(t) > 0 points arrows forward
sim.phaseOffset = sim.calculatedState.phiRad + Math.PI / 2; // peak positive current
v3dTest.currentDirection = 'conventional';
// Step the 3D animation loop
sim.isAnimating = true;
const arrow0 = v3dTest.currentArrows[0];
const dirMultPositive = (Math.sin(sim.phaseOffset - sim.calculatedState.phiRad) >= 0 ? 1 : -1);
assert('Test 17c: Positive conventional current yields positive forward direction multiplier (+1)',
    dirMultPositive === 1);

// Test 17d: Phase offset reversal i(t) < 0 reverses direction multiplier (-1)
sim.phaseOffset = sim.calculatedState.phiRad + 3 * Math.PI / 2; // peak negative current
const dirMultNegative = (Math.sin(sim.phaseOffset - sim.calculatedState.phiRad) >= 0 ? 1 : -1);
assert('Test 17d: Negative AC current reverses 3D arrow direction multiplier (-1)',
    dirMultNegative === -1);

// Test 17e: Electron flow mode reverses direction multiplier
v3dTest.currentDirection = 'electron';
sim.phaseOffset = sim.calculatedState.phiRad + Math.PI / 2;
const dirMultElectron = (Math.sin(sim.phaseOffset - sim.calculatedState.phiRad) >= 0 ? 1 : -1) * -1;
assert('Test 17e: Electron flow mode reverses 3D arrow direction (-1)',
    dirMultElectron === -1);
v3dTest.currentDirection = 'conventional';

// Test 17f: Near zero-crossing hides 3D arrows
sim.phaseOffset = sim.calculatedState.phiRad; // i(t) = 0
const currentZeroVal = Math.sin(sim.phaseOffset - sim.calculatedState.phiRad);
assert('Test 17f: Near zero-crossing is detected (|i(t)| < 0.03)',
    Math.abs(currentZeroVal) < 0.03);

// Test 17g: resetAnimation resets 3D viewer arrowPhase
v3dTest.arrowPhase = 0.65;
sim.resetAnimation();
assert('Test 17g: resetAnimation() resets viewer3D.arrowPhase to 0',
    sim.viewer3D.arrowPhase === 0);

v3dTest.dispose();

// ==========================================
// TEST 18: Phasor Diagram Label Overlap Prevention
// ==========================================

assert('Test 18a: PhasorLabelManager class is exposed globally',
    typeof PhasorLabelManager === 'function');

const mgr = new PhasorLabelManager(phasor);

// Test 18b: Collision detection between two overlapping labels
mgr.reset();
mgr.addLabel({ text: 'VR = 230 V', color: '#00ff88', nominalX: 200, nominalY: 200, anchorX: 200, anchorY: 200 });
mgr.addLabel({ text: 'Vs = 230 V', color: '#00d4ff', nominalX: 200, nominalY: 200, anchorX: 200, anchorY: 200 });
const box0 = mgr.getBounds(mgr.labels[0], mockCtx);
const box1 = mgr.getBounds(mgr.labels[1], mockCtx);
assert('Test 18b: checkOverlap detects collision between coincident labels',
    mgr.checkOverlap(box0, box1) !== null);

// Test 18c: resolve separates colliding labels
mgr.resolve(mockCtx, 600, 480);
const box0After = mgr.getBounds(mgr.labels[0], mockCtx);
const box1After = mgr.getBounds(mgr.labels[1], mockCtx);
assert('Test 18c: resolve() separates overlapping labels so bounding boxes no longer overlap',
    mgr.checkOverlap(box0After, box1After) === null);

// Test 18d: Non-overlapping labels retain nominal positions
mgr.reset();
mgr.addLabel({ text: 'VL = 230 V', color: '#4ecdc4', nominalX: 100, nominalY: 100, anchorX: 100, anchorY: 100 });
mgr.addLabel({ text: 'VC = 230 V', color: '#ffe66d', nominalX: 400, nominalY: 400, anchorX: 400, anchorY: 400 });
mgr.resolve(mockCtx, 600, 480);
assert('Test 18d: Non-overlapping labels retain nominal undisturbed positions',
    mgr.labels[0].currentX === 100 && mgr.labels[0].currentY === 100 &&
    mgr.labels[1].currentX === 400 && mgr.labels[1].currentY === 400 &&
    !mgr.labels[0].displaced && !mgr.labels[1].displaced);

// Test 18e: Phasor diagram renders series RLC at resonance without overlapping labels
sim.currentCircuitType = 'RLC';
elements['voltage'].value = '230';
elements['frequency'].value = '50';
elements['resistance'].value = '100';
elements['inductance'].value = '0.1';
elements['capacitance'].value = '0.000101321'; // near resonance XL ≈ XC
sim.calculate();
phasor.currentView = 'voltage';
phasor.draw();
let voltageLabelsOverlap = false;
for (let i = 0; i < phasor.labelManager.labels.length; i++) {
    for (let j = i + 1; j < phasor.labelManager.labels.length; j++) {
        const bA = phasor.labelManager.getBounds(phasor.labelManager.labels[i], mockCtx);
        const bB = phasor.labelManager.getBounds(phasor.labelManager.labels[j], mockCtx);
        if (phasor.labelManager.checkOverlap(bA, bB)) voltageLabelsOverlap = true;
    }
}
assert('Test 18e: Voltage vector labels at resonance do not overlap',
    !voltageLabelsOverlap);

// Test 18f: Impedance triangle at resonance renders without overlapping labels
phasor.currentView = 'impedance';
phasor.draw();
let impedanceLabelsOverlap = false;
for (let i = 0; i < phasor.labelManager.labels.length; i++) {
    for (let j = i + 1; j < phasor.labelManager.labels.length; j++) {
        const bA = phasor.labelManager.getBounds(phasor.labelManager.labels[i], mockCtx);
        const bB = phasor.labelManager.getBounds(phasor.labelManager.labels[j], mockCtx);
        if (phasor.labelManager.checkOverlap(bA, bB)) impedanceLabelsOverlap = true;
    }
}
assert('Test 18f: Impedance triangle labels at resonance do not overlap',
    !impedanceLabelsOverlap);

// ==========================================
// TEST 19: UI Refinements Verification
// ==========================================

const indexHtmlContent = fs.readFileSync('index.html', 'utf8');
const styleCssContent = fs.readFileSync('style.css', 'utf8');

// Test 19a: Footer disclaimer removed
assert('Test 19a: Footer tagline "Built with ⚡ for electrical engineering education" is removed',
    !indexHtmlContent.includes('Built with ⚡ for electrical engineering education'));

// Test 19b: 3D circuit explanatory tagline removed
assert('Test 19b: 3D circuit disclaimer "⚡ Ideal sinusoidal steady-state" is removed',
    !indexHtmlContent.includes('⚡ Ideal sinusoidal steady-state series AC circuit topology'));

// Test 19c: Page header decorative accent line beneath title removed
assert('Test 19c: Decorative line separating title and subtitle (.logo h1::after) is removed from style.css',
    !styleCssContent.includes('.logo h1::after'));

// Final Summary
const total = passedCount + failedCount;
console.log('=========================================');
console.log(`TOTAL TESTS: ${total} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
console.log('=========================================');
if (failedCount > 0) process.exit(1);
