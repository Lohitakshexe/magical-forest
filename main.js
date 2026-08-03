import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// --- Setup ---
const canvas = document.querySelector('#bg');
const scene = new THREE.Scene();

// Absolute void background
const skyColor = new THREE.Color('#000000');
scene.background = skyColor;

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.set(0, 0, 15);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// --- Background Particles (from React Bits) ---
const particleCount = 200;
const particlePositions = new Float32Array(particleCount * 3);
const particleRandoms = new Float32Array(particleCount * 4);
const particleColors = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount; i++) {
    let x, y, z, len;
    do {
      x = Math.random() * 2 - 1;
      y = Math.random() * 2 - 1;
      z = Math.random() * 2 - 1;
      len = x * x + y * y + z * z;
    } while (len > 1 || len === 0);
    const r = Math.cbrt(Math.random());
    particlePositions.set([x * r, y * r, z * r], i * 3);
    particleRandoms.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    particleColors.set([1, 1, 1], i * 3); // White colors
}

const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
particleGeo.setAttribute('random', new THREE.BufferAttribute(particleRandoms, 4));
particleGeo.setAttribute('customColor', new THREE.BufferAttribute(particleColors, 3));

const particleMat = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uSpread: { value: 20 },
        uBaseSize: { value: 15 * window.devicePixelRatio },
        uSizeRandomness: { value: 1 },
        uAlphaParticles: { value: 0 }
    },
    vertexShader: `
        attribute vec4 random;
        attribute vec3 customColor;
        
        uniform float uTime;
        uniform float uSpread;
        uniform float uBaseSize;
        uniform float uSizeRandomness;
        
        varying vec4 vRandom;
        varying vec3 vColor;
        
        void main() {
            vRandom = random;
            vColor = customColor;
            
            vec3 pos = position * uSpread;
            pos.z *= 10.0;
            
            vec4 mPos = modelMatrix * vec4(pos, 1.0);
            float t = uTime;
            mPos.x += sin(t * random.z + 6.28 * random.w) * mix(0.1, 1.5, random.x);
            mPos.y += sin(t * random.y + 6.28 * random.x) * mix(0.1, 1.5, random.w);
            mPos.z += sin(t * random.w + 6.28 * random.y) * mix(0.1, 1.5, random.z);
            
            vec4 mvPos = viewMatrix * mPos;
            
            if (uSizeRandomness == 0.0) {
                gl_PointSize = uBaseSize;
            } else {
                gl_PointSize = (uBaseSize * (1.0 + uSizeRandomness * (random.x - 0.5))) / length(mvPos.xyz);
            }
            
            gl_Position = projectionMatrix * mvPos;
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform float uAlphaParticles;
        varying vec4 vRandom;
        varying vec3 vColor;
        
        void main() {
            vec2 uv = gl_PointCoord.xy;
            float d = length(uv - vec2(0.5));
            
            if(uAlphaParticles < 0.5) {
                if(d > 0.5) {
                    discard;
                }
                gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), 1.0);
            } else {
                float circle = smoothstep(0.5, 0.4, d) * 0.8;
                gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), circle);
            }
        }
    `,
    transparent: true,
    depthTest: true // Ensure they don't render through the door
});

const backgroundParticles = new THREE.Points(particleGeo, particleMat);
backgroundParticles.position.set(0, 0, 8); // Placed safely before the door
scene.add(backgroundParticles);

// --- Loaders ---
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();

// --- Lights ---
const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffee, 3);
sunLight.position.set(50, 100, 50);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -50;
sunLight.shadow.camera.right = 50;
sunLight.shadow.camera.top = 50;
sunLight.shadow.camera.bottom = -150;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

// --- 1. The Gate & Frame ---
const doorWidth = 4;
const doorHeight = 12;
const doorDepth = 0.6;
const doorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x444444, 
    roughness: 0.6, 
    metalness: 0.2 
});

function createOrnateDoor() {
    const group = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, doorDepth), doorMaterial);
    panel.castShadow = true;
    panel.receiveShadow = true;
    group.add(panel);
    return group;
}

const leftDoorGroup = new THREE.Group();
leftDoorGroup.position.set(-doorWidth, 0, 0);
const leftDoor = createOrnateDoor();
leftDoor.position.set(doorWidth / 2, 0, 0);
leftDoorGroup.add(leftDoor);
scene.add(leftDoorGroup);

const rightDoorGroup = new THREE.Group();
rightDoorGroup.position.set(doorWidth, 0, 0);
const rightDoor = createOrnateDoor();
rightDoor.position.set(-doorWidth / 2, 0, 0);
rightDoorGroup.add(rightDoor);
scene.add(rightDoorGroup);

// Door Frame (Solid Edges)
const frameMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.8, doorHeight + 0.8, 1.2), frameMat);
frameLeft.position.set(-doorWidth - 0.4, 0, 0);
scene.add(frameLeft);

const frameRight = new THREE.Mesh(new THREE.BoxGeometry(0.8, doorHeight + 0.8, 1.2), frameMat);
frameRight.position.set(doorWidth + 0.4, 0, 0);
scene.add(frameRight);

const frameTop = new THREE.Mesh(new THREE.BoxGeometry((doorWidth * 2) + 1.6, 0.8, 1.2), frameMat);
frameTop.position.set(0, doorHeight/2 + 0.4, 0);
scene.add(frameTop);

// Add Text to Doors
function createDoorText(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.font = 'italic 50px serif';
    ctx.fillStyle = '#ffffff'; // White text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.fillText(text, canvas.width/2, canvas.height/2);
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

const leftTextMat = new THREE.MeshBasicMaterial({ map: createDoorText('where my life'), transparent: true });
const leftTextPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 1), leftTextMat);
leftTextPlane.position.set(doorWidth / 2, 1, doorDepth/2 + 0.06);
leftDoorGroup.add(leftTextPlane);

const rightTextMat = new THREE.MeshBasicMaterial({ map: createDoorText('shines....'), transparent: true });
const rightTextPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 1), rightTextMat);
rightTextPlane.position.set(-doorWidth / 2, 1, doorDepth/2 + 0.06);
rightDoorGroup.add(rightTextPlane);


// --- 2. The 3D Procedural Forest Environment & Skybox ---
const forestLength = 300;
const forestWidth = 100;

// The Black Facade Wall (Hides the forest from the void, creating a perfect seal around the door frame)
const facadeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const leftFacade = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), facadeMat);
leftFacade.position.set(-254.8, 0, -0.1); 
const rightFacade = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), facadeMat);
rightFacade.position.set(254.8, 0, -0.1);
const topFacade = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), facadeMat);
topFacade.position.set(0, 262.8, -0.1);
const bottomFacade = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), facadeMat);
bottomFacade.position.set(0, -256, -0.1);
scene.add(leftFacade, rightFacade, topFacade, bottomFacade);

// The Sky Box (only visible after passing the gate)
const skyGeo = new THREE.BoxGeometry(forestWidth + 50, 100, forestLength + 50);
const skyMat = new THREE.MeshBasicMaterial({ color: '#87CEEB', side: THREE.BackSide });
const skyBox = new THREE.Mesh(skyGeo, skyMat);
skyBox.position.set(0, 40, -forestLength/2 - 2); // Start just after the door
scene.add(skyBox);

const groundTex = textureLoader.load(import.meta.env.BASE_URL + 'magical_forest_ground.png');
groundTex.wrapS = THREE.RepeatWrapping;
groundTex.wrapT = THREE.RepeatWrapping;
groundTex.repeat.set(20, 40);

const groundGeo = new THREE.PlaneGeometry(forestWidth, forestLength);
const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.9, color: 0x88cc88 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, -doorHeight/2, -forestLength/2 - 2); // Start just after the door
ground.receiveShadow = true;
scene.add(ground);

// --- Sun and Clouds ---
const sunGeo = new THREE.IcosahedronGeometry(8, 0);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
sunMesh.position.set(30, 60, -forestLength + 50);
scene.add(sunMesh);

const cloudGeo = new THREE.DodecahedronGeometry(3, 0);
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });
const cloudsGroup = new THREE.Group();
for (let i = 0; i < 20; i++) {
    const cloud = new THREE.Group();
    const parts = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < parts; j++) {
        const part = new THREE.Mesh(cloudGeo, cloudMat);
        part.position.set((Math.random()-0.5)*4, (Math.random()-0.5)*2, (Math.random()-0.5)*4);
        part.scale.setScalar(0.5 + Math.random());
        cloud.add(part);
    }
    cloud.position.set((Math.random() - 0.5) * forestWidth, 30 + Math.random() * 15, -(Math.random() * forestLength) - 15);
    cloudsGroup.add(cloud);
}
scene.add(cloudsGroup);

const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
const leavesMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 });
const treeGroup = new THREE.Group();
scene.add(treeGroup);

function createTree() {
    const group = new THREE.Group();
    const trunkHeight = 4 + Math.random() * 6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, trunkHeight, 5), trunkMat);
    trunk.position.y = trunkHeight / 2 - doorHeight / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);
    
    const leavesGeo = new THREE.ConeGeometry(3 + Math.random(), 5 + Math.random() * 3, 5);
    const yOffset = trunkHeight - doorHeight / 2;
    
    for(let i=0; i<3; i++) {
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.position.y = yOffset + (i * 2.5);
        const scale = 1 - (i * 0.25);
        leaves.scale.set(scale, scale, scale);
        leaves.castShadow = true;
        leaves.receiveShadow = true;
        group.add(leaves);
    }
    return group;
}

// Scatter 60 trees strictly inside the forest bounds
for (let i = 0; i < 60; i++) {
    const tree = createTree();
    let x = (Math.random() - 0.5) * forestWidth;
    if (Math.abs(x) < 25) {
        x += Math.sign(x) * 25; 
    }
    const z = - (Math.random() * (forestLength - 10)) - 5; // Trees start closer to door
    
    tree.position.set(x, 0, z);
    tree.rotation.y = Math.random() * Math.PI;
    const s = 1 + Math.random() * 1.5;
    tree.scale.set(s, s, s);
    treeGroup.add(tree);
}

// Fireflies inside forest
const fireflyGeo = new THREE.BufferGeometry();
const fireflyCount = 300;
const fireflyPos = new Float32Array(fireflyCount * 3);
for (let i = 0; i < fireflyCount * 3; i += 3) {
    fireflyPos[i] = (Math.random() - 0.5) * forestWidth; 
    fireflyPos[i+1] = Math.random() * 8 - (doorHeight/2 - 1); 
    fireflyPos[i+2] = - (Math.random() * (forestLength - 5)) - 5; // Closer to door
}
fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPos, 3));
const fireflyMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.2,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending
});
const fireflies = new THREE.Points(fireflyGeo, fireflyMat);
scene.add(fireflies);

// --- GLTF Models & 2D Pop-ups ---
gltfLoader.load(import.meta.env.BASE_URL + 'patch_of_grass.glb', (gltf) => {
    let meshToInstance = null;
    gltf.scene.traverse((child) => {
        if (child.isMesh && !meshToInstance) meshToInstance = child;
    });
    
    if (meshToInstance) {
        const count = 60000;
        const instancedPatch = new THREE.InstancedMesh(meshToInstance.geometry, meshToInstance.material, count);
        const dummy = new THREE.Object3D();
        for(let i = 0; i < count; i++) {
            dummy.position.set((Math.random() - 0.5) * forestWidth, -doorHeight/2, -(Math.random() * forestLength) - 2);
            dummy.rotation.y = Math.random() * Math.PI;
            // Making it extremely dense by overlapping wide patches
            const s = 0.05 + Math.random() * 0.05;
            dummy.scale.set(s * 15, s * 0.6, s * 15); 
            dummy.updateMatrix();
            instancedPatch.setMatrixAt(i, dummy.matrix);
        }
        scene.add(instancedPatch);
    }
});

// 2D Pop-up Animals (Evenly spaced and facing the trail)
const allAnimals = [];
let loadedAnimalTypes = 0;

function placeAllAnimals() {
    if (loadedAnimalTypes < 4) return; // Wait until all 4 textures load
    
    // Shuffle the array so animals are mixed
    for (let i = allAnimals.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allAnimals[i], allAnimals[j]] = [allAnimals[j], allAnimals[i]];
    }
    
    allAnimals.forEach((animal, index) => {
        let x = (Math.random() - 0.5) * 16;
        if (Math.abs(x) < 4) x += Math.sign(x) * 4; // Keep off the immediate path
        
        // Place strictly in the gaps between cards
        // Cards are at -30, -45, -60... Space is 15.
        // We place animals at -22.5, -37.5, -52.5...
        const gapIndex = index % 14; 
        const z = -30 - (gapIndex * 15) + 7.5; 
        
        animal.position.set(x, animal.position.y, z);
        
        // Face the trail: if on the right (x > 0), face left. If on left, face right.
        if (x > 0) {
            animal.rotation.y = -Math.PI / 6 - (Math.random() * 0.2);
        } else {
            animal.rotation.y = Math.PI / 6 + (Math.random() * 0.2);
        }
        
        scene.add(animal);
    });
}

const popUpMatPanda = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.MultiplyBlending, side: THREE.DoubleSide });
textureLoader.load(import.meta.env.BASE_URL + 'images/panda.png', (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    popUpMatPanda.map = tex;
    const geo = new THREE.PlaneGeometry(3, 3);
    for (let i = 0; i < 6; i++) {
        const panda = new THREE.Mesh(geo, popUpMatPanda);
        panda.position.y = -doorHeight/2 + 1.5;
        allAnimals.push(panda);
    }
    loadedAnimalTypes++; placeAllAnimals();
});

const popUpMatRabbit = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.MultiplyBlending, side: THREE.DoubleSide });
textureLoader.load(import.meta.env.BASE_URL + 'images/rabbit.png', (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    popUpMatRabbit.map = tex;
    const geo = new THREE.PlaneGeometry(2, 2);
    for (let i = 0; i < 8; i++) {
        const rabbit = new THREE.Mesh(geo, popUpMatRabbit);
        rabbit.position.y = -doorHeight/2 + 1;
        allAnimals.push(rabbit);
    }
    loadedAnimalTypes++; placeAllAnimals();
});

const popUpMatFox = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.MultiplyBlending, side: THREE.DoubleSide });
textureLoader.load(import.meta.env.BASE_URL + 'images/fox.png', (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    popUpMatFox.map = tex;
    const geo = new THREE.PlaneGeometry(2.5, 2.5);
    for (let i = 0; i < 5; i++) {
        const fox = new THREE.Mesh(geo, popUpMatFox);
        fox.position.y = -doorHeight/2 + 1.25;
        allAnimals.push(fox);
    }
    loadedAnimalTypes++; placeAllAnimals();
});

const popUpMatDeer = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.MultiplyBlending, side: THREE.DoubleSide });
textureLoader.load(import.meta.env.BASE_URL + 'images/deer.png', (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    popUpMatDeer.map = tex;
    const geo = new THREE.PlaneGeometry(4, 4);
    for (let i = 0; i < 4; i++) {
        const deer = new THREE.Mesh(geo, popUpMatDeer);
        deer.position.y = -doorHeight/2 + 2;
        allAnimals.push(deer);
    }
    loadedAnimalTypes++; placeAllAnimals();
});

// 3D Instanced Flowers (Low-poly buds)
const flowerGeo = new THREE.TetrahedronGeometry(0.2, 0);
const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true });
const flowerCount = 10000;
const instancedFlowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
const dummyF = new THREE.Object3D();
const colorPink = new THREE.Color(0xff66a3);
const colorWhite = new THREE.Color(0xffffff);
const colorYellow = new THREE.Color(0xffdd44);

for (let i = 0; i < flowerCount; i++) {
    dummyF.position.set((Math.random() - 0.5) * forestWidth, -doorHeight/2 + 0.1, -(Math.random() * forestLength) - 2);
    dummyF.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    const s = 0.4 + Math.random() * 0.6;
    dummyF.scale.set(s, s, s);
    dummyF.updateMatrix();
    instancedFlowers.setMatrixAt(i, dummyF.matrix);
    
    const randColor = Math.random();
    if (randColor < 0.4) {
        instancedFlowers.setColorAt(i, colorPink);
    } else if (randColor < 0.8) {
        instancedFlowers.setColorAt(i, colorWhite);
    } else {
        instancedFlowers.setColorAt(i, colorYellow);
    }
}
scene.add(instancedFlowers);

// --- 3. Image Cards (Native Three.js TiltedCard with perfectly integrated text) ---
const imageFiles = [
    "your first ever foto i ever got, and it was absolute treasure!!, i spent soo much time with this one.jpg",
    "the first photo you took from my phone.jpg",
    "first time we went out to hangout together.jpg",
    "2nd proper hangouttt :).jpg",
    "in classss 2.jpg",
    "admiringg in classss.jpg",
    "oh how much i love these moments of me admiring you.jpg",
    "one of my favourite outfits.jpg",
    "soo much better photography, uff.jpg",
    "what a cutie:).jpg",
    "moments of my life.jpg",
    "how i see you pop out from the background.jpg",
    "your prettty goooofyy loook, i lvoe you soooo muchh.jpg"
];

const cardsGroup = new THREE.Group();
scene.add(cardsGroup);

const cardSpacing = 15;
const startZ = -30; // Push cards back as well

function createRoundedCardCanvas(img, text) {
    const width = 1024;
    const imgAspect = img.width / img.height;
    const padding = 40;
    
    // PRE-CALCULATE TEXT LINES
    const cleanText = text.replace('.jpg', '');
    const words = cleanText.split(' ');
    
    // Use a temporary canvas context to measure text
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.font = 'bold 48px sans-serif';
    
    const lines = [];
    let currentLine = words[0];
    const maxWidth = width - (padding * 4);

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const measure = tempCtx.measureText(currentLine + ' ' + word);
        if (measure.width < maxWidth) {
            currentLine += ' ' + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);

    const lineHeight = 60;
    const textHeight = (lines.length * lineHeight) + 80; // dynamic height based on lines
    
    const imgDrawWidth = width - (padding * 2);
    const imgDrawHeight = imgDrawWidth / imgAspect;
    const height = padding + imgDrawHeight + textHeight;
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Draw white rounded card
    ctx.fillStyle = '#ffffff';
    const radius = 50;
    ctx.beginPath();
    if(ctx.roundRect) {
        ctx.roundRect(0, 0, width, height, radius);
    } else {
        // Fallback for older browsers
        ctx.moveTo(radius, 0); ctx.lineTo(width - radius, 0); ctx.quadraticCurveTo(width, 0, width, radius);
        ctx.lineTo(width, height - radius); ctx.quadraticCurveTo(width, height, width - radius, height);
        ctx.lineTo(radius, height); ctx.quadraticCurveTo(0, height, 0, height - radius);
        ctx.lineTo(0, radius); ctx.quadraticCurveTo(0, 0, radius, 0);
    }
    ctx.fill();
    
    // Draw image with rounded corners
    ctx.save();
    const imgRadius = 30;
    ctx.beginPath();
    if(ctx.roundRect) {
        ctx.roundRect(padding, padding, imgDrawWidth, imgDrawHeight, imgRadius);
    } else {
        ctx.rect(padding, padding, imgDrawWidth, imgDrawHeight);
    }
    ctx.clip();
    ctx.drawImage(img, padding, padding, imgDrawWidth, imgDrawHeight);
    ctx.restore();
    
    // Draw text
    ctx.font = 'bold 48px sans-serif';
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const startY = padding + imgDrawHeight + (textHeight / 2) - ((lines.length - 1) * lineHeight / 2);
    
    lines.forEach((line, index) => {
        ctx.fillText(line, width / 2, startY + (index * lineHeight));
    });
    
    return new THREE.CanvasTexture(canvas);
}

imageFiles.forEach((filename, index) => {
    const actualFilename = filename.endsWith('.jpg') ? filename : filename + '.jpg';
    const group = new THREE.Group();
    
    let cleanText = filename.replace('.jpg', '');
    cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
    
    const isLeft = index % 2 === 0;
    const baseRotY = isLeft ? Math.PI / 6 : -Math.PI / 6;

    group.userData = {
        targetScale: 1, targetRotX: 0, targetRotY: 0,
        currentScale: 1, currentRotX: 0, currentRotY: 0,
        baseRotY: baseRotY
    };

    // Load image natively to draw it into the rounded Canvas card
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}images/${actualFilename}`;
    img.onload = () => {
        const tex = createRoundedCardCanvas(img, cleanText);
        
        let cardWidth = 8;
        const canvasAspect = tex.image.width / tex.image.height;
        let cardHeight = cardWidth / canvasAspect;
        
        // Prevent overly tall cards
        if (cardHeight > 9) {
            cardHeight = 9;
            cardWidth = cardHeight * canvasAspect;
        }
        
        const geo = new THREE.PlaneGeometry(cardWidth, cardHeight);
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);
    };
    
    const xOffset = isLeft ? -7 : 7;
    const zOffset = startZ - (index * cardSpacing);
    group.position.set(xOffset, 0, zOffset);
    group.rotation.y = baseRotY;
    
    cardsGroup.add(group);
});

// --- 4. The Final Note & Apology ---
const finalNoteZ = startZ - (imageFiles.length * cardSpacing) - 20;

function createPoemNote() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    if(ctx.roundRect) {
        ctx.beginPath(); ctx.roundRect(0, 0, canvas.width, canvas.height, 40); ctx.fill();
    } else {
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    ctx.font = '36px serif';
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const lines = [
        "What luck of heaven I hold,",
        "to have found you.",
        "What destiny of gold,",
        "to be beside you.",
        "Just moments ago,",
        "I saw my world anew—",
        "as I do, time and time again,",
        "simply looking at you.",
        "In your subtle smiles,",
        "do you recall that poem?",
        "I shall careth for thee,",
        "I shall careth for thy soul.",
        "Can it be true, after all,",
        "that in loving you, I started to love myself?",
        "For tell me, my love—",
        "what am I without thee?",
        "",
        "i love you, i really do, with everything of me,",
        "i really want to just make you happy,",
        "today, tomorrow, and forever.",
        "",
        "-always yours",
        "Lohitaksh"
    ];
    
    const lineHeight = 44;
    const startY = (canvas.height - (lines.length * lineHeight)) / 2;
    lines.forEach((line, i) => {
        ctx.fillText(line, canvas.width/2, startY + (i * lineHeight));
    });
    
    return new THREE.CanvasTexture(canvas);
}

const poemTex = createPoemNote();
const poemGeo = new THREE.PlaneGeometry(12, 14);
const poemMat = new THREE.MeshBasicMaterial({ map: poemTex, transparent: true });
const poemNote = new THREE.Mesh(poemGeo, poemMat);
poemNote.position.set(0, 1, finalNoteZ);
scene.add(poemNote);

// The Apology Note behind the poem
const sorryCanvas = document.createElement('canvas');
sorryCanvas.width = 512; sorryCanvas.height = 256;
const sCtx = sorryCanvas.getContext('2d');
sCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
if (sCtx.roundRect) { sCtx.beginPath(); sCtx.roundRect(0, 0, 512, 256, 20); sCtx.fill(); } else { sCtx.fillRect(0,0,512,256); }
sCtx.font = '48px sans-serif'; sCtx.fillStyle = '#111'; sCtx.textAlign = 'center'; sCtx.textBaseline = 'middle';
sCtx.fillText("Sorry......😔", 256, 128);

const sorryTex = new THREE.CanvasTexture(sorryCanvas);
sorryTex.colorSpace = THREE.SRGBColorSpace;
const sorryMat = new THREE.MeshBasicMaterial({ map: sorryTex, transparent: true });
const sorryGeo = new THREE.PlaneGeometry(8, 4);
const sorryMesh = new THREE.Mesh(sorryGeo, sorryMat);
sorryMesh.rotation.y = 0; // face forward so it can be seen from the front
sorryMesh.position.set(0, 1, finalNoteZ - 40); // Far behind the poem
scene.add(sorryMesh);

// --- Scroll, Physics & Interaction Logic ---
let targetCameraZ = 15;
let currentCameraZ = 15;
let targetDoorRotation = 0;
let currentDoorRotation = 0;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-100, -100);

const damp = (lambda, dt) => 1 - Math.exp(-lambda * dt);

function updateScroll() {
    let maxScroll = document.body.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) maxScroll = 1;
    const scrollY = window.scrollY || 0;
    let progress = Math.max(0, Math.min(1, scrollY / maxScroll));
    
    const totalDistance = 15 - (finalNoteZ - 10);
    targetCameraZ = 15 - (progress * totalDistance); 
    
    let doorProgress = 0;
    if (progress > 0.01) {
        doorProgress = Math.min(1, (progress - 0.01) / 0.04);
    }
    targetDoorRotation = doorProgress * (Math.PI * 0.85); // Swings completely out of the way!
}

window.addEventListener('scroll', updateScroll);
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    updateScroll();
});

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

updateScroll();
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    
    currentCameraZ += (targetCameraZ - currentCameraZ) * damp(4.8, dt);
    camera.position.z = currentCameraZ;
    
    currentDoorRotation += (targetDoorRotation - currentDoorRotation) * damp(5.2, dt);
    leftDoorGroup.rotation.y = currentDoorRotation;
    rightDoorGroup.rotation.y = -currentDoorRotation;
    
    // TiltedCard interaction logic
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cardsGroup.children, true);
    
    cardsGroup.children.forEach(group => {
        group.userData.targetScale = 1;
        group.userData.targetRotX = 0;
        group.userData.targetRotY = 0;
    });
    
    if (intersects.length > 0) {
        const hit = intersects[0];
        let group = hit.object.parent;
        if (group && group.userData) {
            group.userData.targetScale = 1.1; 
            if (hit.uv) {
                const rotateAmplitude = 0.25;
                group.userData.targetRotY = (hit.uv.x - 0.5) * rotateAmplitude;
                group.userData.targetRotX = -(hit.uv.y - 0.5) * rotateAmplitude;
            }
        }
    }
    
    // Animate Card Springs
    const springDamp = damp(10, dt);
    cardsGroup.children.forEach(group => {
        const ud = group.userData;
        if (ud) {
            ud.currentScale += (ud.targetScale - ud.currentScale) * springDamp;
            ud.currentRotX += (ud.targetRotX - ud.currentRotX) * springDamp;
            ud.currentRotY += (ud.targetRotY - ud.currentRotY) * springDamp;
            
            group.scale.set(ud.currentScale, ud.currentScale, ud.currentScale);
            group.rotation.x = ud.currentRotX;
            group.rotation.y = ud.baseRotY + ud.currentRotY;
        }
    });

    // Update background particles time and rotation (vastly slowed down)
    const elapsed = clock.getElapsedTime() * 1000;
    const speed = 0.005; // much slower
    particleMat.uniforms.uTime.value = elapsed * 0.001 * speed;
    backgroundParticles.rotation.x = Math.sin(elapsed * 0.0002) * 0.02;
    backgroundParticles.rotation.y = Math.cos(elapsed * 0.0005) * 0.03;
    backgroundParticles.rotation.z += 0.002;

    renderer.render(scene, camera);
}
animate();
