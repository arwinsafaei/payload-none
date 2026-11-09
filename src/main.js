import * as THREE from "three";

const game = document.getElementById("game");

const COMPONENT_SCALE = 1.35;
const COMPONENT_MARGIN = 2.5;
const RAMP_MARGIN = 4.0;
const MAX_PLACEMENT_ATTEMPTS = 30;

// 1 Scene Setup

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101810);
scene.fog = new THREE.Fog(0x101810, 15, 65);

const camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    200
);


const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

game.appendChild(renderer.domElement);

// 2 Lighting

const ambient = new THREE.HemisphereLight(0xceac01, 0x172817, 2);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.position.set(-8, 15, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

// 3 Environment

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({
        color: 0x286b3b,
        roughness: 0.85,
        metalness: 0.12
    })
);

ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.05;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(
    200,
    100,
    0x65bd72,
    0x397c49
);

grid.position.y = 0.015;
grid.material.transparent = true;
grid.material.opacity = 0.2;
scene.add(grid);

const traceMaterial = new THREE.MeshStandardMaterial({
    color: 0x164b2b,
    emissive: 0x092b16,
    roughness: 0.4,
    metalness: 0.4
});

const padMaterial = new THREE.MeshStandardMaterial({
    color: 0xb58a45,
    metalness: 0.85,
    roughness: 0.25
});

const traceWidth = 0.13;
const traceHeight = 0.035;
const gridSpacing = 3;

const traceEdges = new Set();
const traceNodes = new Map();

function nodeKey(x, z) {
    return `${x},${z}`;
}

function addTraceNode(x, z) {
    const key = nodeKey(x, z);

    if (!traceNodes.has(key)) {
        traceNodes.set(key, {
            x,
            z,
            connections: 0
        });
    }

    return traceNodes.get(key);
}

function addTraceEdge(a, b) {
    const keyA = nodeKey(a.x, a.z);
    const keyB = nodeKey(b.x, b.z);

    const edgeKey = [keyA, keyB].sort().join("|");

    if (traceEdges.has(edgeKey)) return;

    traceEdges.add(edgeKey);

    a.connections++;
    b.connections++;

    const dx = b.x - a.x;
    const dz = b.z - a.z;

    const length = Math.hypot(dx, dz);

    const trace = new THREE.Mesh(
        new THREE.BoxGeometry(traceWidth, traceHeight, length + 0.02),
        traceMaterial
    );

    trace.position.set(
        (a.x + b.x) / 2,
        0.025,
        (a.z + b.z) / 2
    );

    trace.rotation.y = Math.atan2(dx, dz);

    scene.add(trace);
}

const startingNode = addTraceNode(0, 0);
const networkNodes = [startingNode];

const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1]
];

for (let route = 0; route < 65; route++) {
    let current = networkNodes[Math.floor(Math.random() * networkNodes.length)];

    const steps = 3 + Math.floor(Math.random() * 9);

    let previousDirection = null;

    for (let step = 0; step < steps; step++) {
        let direction;

        do {
            direction = directions[Math.floor(Math.random() * directions.length)];
        } while (
            previousDirection &&
            direction[0] === -previousDirection[0] &&
            direction[1] === -previousDirection[1]
        );
        
        previousDirection = direction;

        const next = addTraceNode(
            THREE.MathUtils.clamp(
                current.x + direction[0] * gridSpacing,
                -45,
                45
            ),
            THREE.MathUtils.clamp(
                current.z + direction[1] * gridSpacing,
                -45,
                45
            )
        );

        if (next === current) break;

        addTraceEdge(current, next);

        current = next;
        networkNodes.push(current);
    }
}

const padGeometry = new THREE.CylinderGeometry(
    traceWidth * 0.7,
    traceWidth * 0.7,
    0.045,
    12
);

for (const node of traceNodes.values()) {
    if (node.connections < 2) continue;

    const pad = new THREE.Mesh(padGeometry, padMaterial);

    pad.position.set(node.x, 0.035, node.z);
    scene.add(pad);
}

const componentMaterials = {
    chip: new THREE.MeshStandardMaterial({
        color: 0x171d1c,
        roughness: 0.35,
        metalness: 0.35
    }),

    resistor: new THREE.MeshStandardMaterial({
        color: 0xc5a36c,
        roughness: 0.7
    }),

    capacitor: new THREE.MeshStandardMaterial({
        color: 0x263d35,
        metalness: 0.45,
        roughness: 0.3
    }),

    silver: new THREE.MeshStandardMaterial({
        color: 0xb9c5c0,
        metalness: 0.9,
        roughness: 0.25
    })
};

function createComponent(x, z, type) {
    const component = new THREE.Group();

    const groundY = -0.05;
    const scale = COMPONENT_SCALE;

    const baseHeight = {
        chip: -0.085,
        resistor: -0.06,
        capacitor: -0.065
    }[type];

    component.position.set(
        x,
        groundY * (1 - scale) + baseHeight * scale,
        z
    );

    component.scale.setScalar(scale);
    component.rotation.y = Math.random() * Math.PI;

    if (type === "chip") {
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(1.25, 0.25, 0.95),
            componentMaterials.chip
        );

        body.position.y = 0.16;
        component.add(body);

        for (const side of [-1, 1]) {
            for (let i = 0; i < 5; i++) {
                const pin = new THREE.Mesh(
                    new THREE.BoxGeometry(0.12, 0.045, 0.12),
                    componentMaterials.silver
                );

                pin.position.set(
                    side * 0.68,
                    0.08,
                    -0.32 + 1 * 0.16
                );

                component.add(pin);
            }
        }
    }

    if (type === "resistor") {
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(0.65, 0.22, 0.28),
            componentMaterials.resistor
        );

        body.position.y = 0.12;
        component.add(body);

        for (const side of [-1, 1]) {
            const lead = new THREE.Mesh(
                new THREE.BoxGeometry(0.3, 0.045, 0.07),
                componentMaterials.silver
            );

            lead.position.set(side * 0.46, 0.04, 0);
            component.add(lead);
        }
    }

    if (type === "capacitor") {
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.28, 0.28, 0.65, 16),
            componentMaterials.capacitor
        );

        body.position.y = 0.34;
        component.add(body);

        const top = new THREE.Mesh(
            new THREE.CylinderGeometry(0.23, 0.23, 0.025, 16),
            componentMaterials.silver
        );

        top.position.y = 0.665;
        component.add(top);
    }

    component.traverse(object => {
        if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });

    scene.add(component);
    return component;
}

const occupiedAreas = [];

function findPlacement(radius, margin, min = -42, max = 42) {
    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
        const x = min + Math.random() * (max - min);
        const z = min + Math.random() * (max - min);

        const overlaps = occupiedAreas.some(area => {
            const dx = x - area.x;
            const dz = z - area.z;

            const distance = Math.hypot(dx, dz);
            const requiredDistance = radius + area.radius + Math.max(margin, area.margin);

            return distance < requiredDistance;
        });

        if (!overlaps) {
            return {x, z, radius, margin};
        }
    }

    return null;
}

const componentTypes = [
    {type: "chip", radius: 1.1},
    {type: "resistor", radius: 0.5},
    {type: "capacitor", radius: 0.4}
];

for (let i = 0; i < 100; i++) {
    const selected = componentTypes[
        Math.floor(Math.random() * componentTypes.length)
    ];

    const placement = findPlacement(
        selected.radius * COMPONENT_SCALE,
        COMPONENT_MARGIN
    );

    if (!placement) {
        continue;
    }

    createComponent(
        placement.x,
        placement.z,
        selected.type
    );

    occupiedAreas.push(placement);
}

const ramps = [];
const rampCount = 12;

const rampMaterial = new THREE.MeshStandardMaterial({
    color: 0x899b98,
    metalness: 0.95,
    roughness: 0.2,
    emissive: 0x102020
});

for (let i = 0; i < rampCount; i++) {
    const placement = findPlacement(
        2.1,
        RAMP_MARGIN,
        -38,
        38
    );

    if (!placement) {
        continue;
    }

    const {x, z} = placement;

    const ramp = new THREE.Group();

    ramp.position.set(x, 0.06, z);
    scene.add(ramp);

    const rampContacts = [];

    for (const side of [-1, 1]) {
        const contact = new THREE.Group();

        const plate = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.12, 3.4),
            rampMaterial
        );

        contact.add(plate);

        const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.02, 3.1),
            padMaterial
        );

        stripe.position.y = 0.07;
        contact.add(stripe);
        contact.position.x = side * 0.6;
        ramp.add(contact);

        rampContacts.push({
            group: contact,
            side
        });
    }

    ramps.push({
        group: ramp,
        contacts: rampContacts,
        x,
        z,
        deployment: 0,
        armed: false
    });

    occupiedAreas.push({
        x,
        z,
        radius: placement.radius,
        margin: placement.margin
    });
}

let verticalVelocity = 0;
let airborne = false;

// 4 Player

const player = new THREE.Group();
scene.add(player);

const cardboard = new THREE.MeshStandardMaterial({
    color: 0xb77b43,
    roughness: 0.95
});

const labelMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8d9b8,
    roughness: 1
});

const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.9, 1.05),
    cardboard
);

box.position.y = 0.55;
box.castShadow = true;
box.receiveShadow = true;
player.add(box);

function createFlap(side) {
    const flap = new THREE.Group();

    flap.position.set(side * 0.625, 1.0, 0);

    const flapMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.055, 1.05),
        cardboard
    );

    flapMesh.position.x = -side * 0.31;
    flapMesh.castShadow = true;
    flapMesh.receiveShadow = true;

    flap.add(flapMesh);
    player.add(flap);

    flap.rotation.z = side * -0.08;
}

createFlap(-1);
createFlap(1);

const label = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.32, 0.025),
    labelMaterial
);

label.position.set(0, 0.57, -0.54);
player.add(label);

const labelLineMaterial = new THREE.MeshBasicMaterial({
    color: 0x393126
});

for (let i = 0; i < 4; i++) {
    const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.012, 0.006),
        labelLineMaterial
    );

    line.position.set(
        -0.03,
        0.67 - i * 0.065,
        -0.557
    );

    player.add(line);
}

// 5 Jet engine

const engine = new THREE.Group();
engine.position.set(0, 0.65, 0.78);
player.add(engine);

const metal = new THREE.MeshStandardMaterial({
    color: 0x626d69,
    metalness: 0.8,
    roughness: 0.35
});

const engineBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.29, 0.8, 24),
    metal
);

engineBody.rotation.x = Math.PI / 2;
engine.add(engineBody);

const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.29, 0.045, 10, 24),
    new THREE.MeshStandardMaterial({
        color: 0xa7b4aa,
        metalness: 0.9,
        roughness: 0.2
    })
);

ring.position.z = 0.405;
engine.add(ring);

const exhaustMaterial = new THREE.MeshBasicMaterial({
    color: 0xff9b43
});

const exhaust = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.65, 16),
    exhaustMaterial
);

exhaust.rotation.x = Math.PI / 2;
exhaust.position.z = 0.85;
engine.add(exhaust);

const engineLight = new THREE.PointLight(0xff8436, 3, 4);
engineLight.position.z = 0.9;
engine.add(engineLight);

// 6 Camera

camera.position.set(0, 4, 8);
camera.lookAt(0, 0.5, 0);

// 7 Input

const keys = {};

window.addEventListener("keydown", (event) => {
    keys[event.code] = true;

    if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]
        .includes(event.code)
    ) {
        event.preventDefault();
    }
});

window.addEventListener("keyup", (event) => {
    keys[event.code] = false;
});

window.addEventListener("blur", () => {
    for (const key in keys) {
        keys[key] = false;
    }
});

// 8 Movement

const clock = new THREE.Clock();

const velocity = new THREE.Vector3();
const targetCamera = new THREE.Vector3();

const normalSpeed = 7;
const boostSpeed = 13;

function updatePlayer(delta, time) {
    const forward = keys["KeyW"] || keys ["ArrowUp"];
    const backward = keys["KeyS"] || keys["ArrowDown"];
    const left = keys["KeyA"] || keys["ArrowLeft"];
    const right = keys["KeyD"] || keys["ArrowRight"];

    const boostHeld = keys["ShiftLeft"] || keys["ShiftRight"];
    const boosting = boostHeld && forward && !backward;

    const speed = boosting ? boostSpeed : normalSpeed;

    let directionX = 0;
    let directionZ = 0;

    if (forward) directionZ -= 1;
    if (backward) directionZ += 1;
    if (left) directionX -= 1;
    if (right) directionX += 1;

    const length = Math.hypot(directionX, directionZ);

    if (length > 0) {
        directionX /= length;
        directionZ /= length;
    }

    velocity.x = THREE.MathUtils.damp(
        velocity.x,
        directionX * speed,
        7,
        delta
    );

    velocity.z = THREE.MathUtils.damp(
        velocity.z,
        directionZ * speed,
        7,
        delta
    );

    player.position.x += velocity.x * delta;
    player.position.z += velocity.z * delta;

    for (const ramp of ramps) {
        const distanceX = Math.abs(player.position.x - ramp.x);

        const approaching =
            boosting &&
            distanceX < 1.8 &&
            player.position.z < ramp.z + 2 &&
            player.position.z > ramp.z - 1.7;

        if (approaching) {
            ramp.armed = true;
        }

        if (
            ramp.armed &&
            (!boosting || distanceX >= 1.8) &&
            player.position.z > ramp.z - 1.7
        ) {
            ramp.armed = false;
        }

        ramp.deployment = THREE.MathUtils.damp(
            ramp.deployment,
            ramp.armed ? 1 : 0,
            8,
            delta
        );

        for (const contact of ramp.contacts) {
            const { group, side } = contact;

            group.position.x = side * (
                0.6 + ramp.deployment * 0.55
            );

            group.position.y = ramp.deployment * 0.18;
            group.rotation.x = ramp.deployment * 0.24;
        }

        if (
            ramp.armed &&
            boosting &&
            ramp.deployment > 0.65 &&
            player.position.z < ramp.z - 1.7 &&
            !airborne
        ) {
            verticalVelocity = 8.5;
            airborne = true;
            ramp.armed = false;
            break;
        }
    }

    const hover = Math.sin(time * 4) * 0.045;

    if (airborne) {
        verticalVelocity -= 18 * delta;
        player.position.y += verticalVelocity * delta;

        if (player.position.y <= hover) {
            player.position.y = hover;
            verticalVelocity = 0;
            airborne = false;
        }
    } else {
        player.position.y = hover;
    }

    player.rotation.x = THREE.MathUtils.damp(
        player.rotation.x,
        directionZ * 0.08,
        5,
        delta
    );

    player.rotation.z = THREE.MathUtils.damp(
        player.rotation.z,
        -directionX * 0.22,
        5,
        delta
    );

    const enginePower = boosting ? 1.7 : 1;

    exhaust.scale.y = enginePower * (
        1 + Math.sin(time * 18) * 0.08
    );

    exhaustMaterial.color.setHex(
        boosting ? 0xb45cff : 0xff9b43
    );

    engineLight.color.setHex(
        boosting ? 0xb45cff : 0xff8436
    );

    engineLight.intensity = boosting ? 7 : 3;
}

// 9 Camera follow

function updateCamera(delta) {
    targetCamera.set(
        player.position.x,
        player.position.y + 4,
        player.position.z + 8
    );

    camera.position.lerp(
        targetCamera,
        1 - Math.exp(-4 * delta)
    );

    camera.lookAt(
        player.position.x,
        player.position.y + 0.4,
        player.position.z - 2
    );
}

// 10 Resize

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// 11 Game loop

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    updatePlayer(delta, time);
    updateCamera(delta);

    renderer.render(scene, camera);
}

animate();
