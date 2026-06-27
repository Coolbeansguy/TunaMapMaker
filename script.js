const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const toolbarAssets = document.getElementById('toolbar-assets');
const fileUpload = document.getElementById('fileUpload');

const toolDraw = document.getElementById('toolDraw');
const toolErase = document.getElementById('toolErase');
const zoomIn = document.getElementById('zoomIn');
const zoomOut = document.getElementById('zoomOut');
const zoomReset = document.getElementById('zoomReset');

const selectedAssetName = document.getElementById('selectedAssetName');
const collisionToggle = document.getElementById('collisionToggle');
const customHitboxSettings = document.getElementById('customHitboxSettings');
const assetW = document.getElementById('assetW');
const assetH = document.getElementById('assetH');
const hbX = document.getElementById('hbX');
const hbY = document.getElementById('hbY');
const hbW = document.getElementById('hbW');
const hbH = document.getElementById('hbH');

const GRID_SIZE = 32; 
let currentSelectedAsset = null;
let currentTool = 'draw';
let zoomLevel = 0.4;

let isPanning = false;
let startPanX = 0;
let startPanY = 0;
let cameraX = 200;
let cameraY = 100;

let currentMouseGridX = 0;
let currentMouseGridY = 0;
let isMouseOnCanvas = false;

const placedObjects = []; 
const assetRegistry = {};

function cleanName(fileName) {
    return fileName
        .replace('.png', '')               
        .replace(/[^a-zA-Z0-9]/g, ' ')     
        .trim();                           
}

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousedown', (event) => {
    if (event.button === 2) {
        isPanning = true;
        startPanX = event.clientX;
        startPanY = event.clientY;
    }
});

canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mX = (event.clientX - rect.left) / zoomLevel - cameraX;
    const mY = (event.clientY - rect.top) / zoomLevel - cameraY;
    
    currentMouseGridX = Math.floor(mX / GRID_SIZE) * GRID_SIZE;
    currentMouseGridY = Math.floor(mY / GRID_SIZE) * GRID_SIZE;
    isMouseOnCanvas = true;

    if (isPanning) {
        const dx = (event.clientX - startPanX) / zoomLevel;
        const dy = (event.clientY - startPanY) / zoomLevel;
        cameraX += dx;
        cameraY += dy;
        startPanX = event.clientX;
        startPanY = event.clientY;
    }
    redrawCanvas();
});

canvas.addEventListener('mouseleave', () => {
    isMouseOnCanvas = false;
    redrawCanvas();
});

window.addEventListener('mouseup', (event) => {
    if (event.button === 2) {
        isPanning = false;
    }
});

toolDraw.addEventListener('click', () => {
    currentTool = 'draw';
    toolDraw.classList.add('active');
    toolErase.classList.remove('active');
    redrawCanvas();
});

toolErase.addEventListener('click', () => {
    currentTool = 'erase';
    toolErase.classList.add('active');
    toolDraw.classList.remove('active');
    redrawCanvas();
});

zoomIn.addEventListener('click', () => {
    zoomLevel = Math.min(zoomLevel + 0.1, 2.5);
    redrawCanvas();
});

zoomOut.addEventListener('click', () => {
    zoomLevel = Math.max(zoomLevel - 0.1, 0.1);
    redrawCanvas();
});

zoomReset.addEventListener('click', () => {
    zoomLevel = 1.0;
    redrawCanvas();
});

function injectSystemAssets() {
    assetRegistry['PLAYER_SPAWN'] = {
        src: '',
        isSolid: false,
        isSystem: true,
        label: 'SPAWN',
        letter: 'S',
        renderW: GRID_SIZE,
        renderH: GRID_SIZE,
        hitbox: { x: 0, y: 0, w: GRID_SIZE, h: GRID_SIZE }
    };
    assetRegistry['PLAYER_CHECKPOINT'] = {
        src: '',
        isSolid: false,
        isSystem: true,
        label: 'CHECKPOINT',
        letter: 'C',
        renderW: GRID_SIZE,
        renderH: GRID_SIZE,
        hitbox: { x: 0, y: 0, w: GRID_SIZE, h: GRID_SIZE }
    };
}

async function loadAssets() {
    injectSystemAssets();
    try {
        const response = await fetch('assets.json');
        const assetFiles = await response.json();
        
        assetFiles.forEach(fileName => {
            const tempImg = new Image();
            tempImg.src = `assets/${fileName}`;
            
            assetRegistry[fileName] = {
                src: `assets/${fileName}`,
                isSolid: false,
                isSystem: false,
                renderW: GRID_SIZE,
                renderH: GRID_SIZE,
                hitbox: { x: 0, y: 0, w: GRID_SIZE, h: GRID_SIZE }
            };

            tempImg.onload = () => {
                assetRegistry[fileName].renderW = tempImg.naturalWidth;
                assetRegistry[fileName].renderH = tempImg.naturalHeight;
                assetRegistry[fileName].hitbox.w = tempImg.naturalWidth;
                assetRegistry[fileName].hitbox.h = tempImg.naturalHeight;
                if (currentSelectedAsset === fileName) {
                    openPropertiesPanel(fileName);
                }
                redrawCanvas();
            };
        });
        renderToolbar();
    } catch (error) {
        console.error(error);
        renderToolbar();
    }
}

fileUpload.addEventListener('change', (event) => {
    const files = event.target.files;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const blobUrl = URL.createObjectURL(file); 
        const tempImg = new Image();
        tempImg.src = blobUrl;
        
        assetRegistry[file.name] = {
            src: blobUrl,
            isSolid: false,
            isSystem: false,
            renderW: GRID_SIZE,
            renderH: GRID_SIZE,
            hitbox: { x: 0, y: 0, w: GRID_SIZE, h: GRID_SIZE }
        };

        tempImg.onload = () => {
            assetRegistry[file.name].renderW = tempImg.naturalWidth;
            assetRegistry[file.name].renderH = tempImg.naturalHeight;
            assetRegistry[file.name].hitbox.w = tempImg.naturalWidth;
            assetRegistry[file.name].hitbox.h = tempImg.naturalHeight;
            redrawCanvas();
        };
    }
    renderToolbar(); 
});

function renderToolbar() {
    toolbarAssets.innerHTML = ''; 
    
    Object.keys(assetRegistry).forEach(fileName => {
        const item = document.createElement('div');
        item.className = 'toolbar-item';
        if (currentSelectedAsset === fileName) item.classList.add('selected');
        
        const meta = assetRegistry[fileName];
        
        if (meta.isSystem) {
            const icon = document.createElement('div');
            icon.className = 'system-icon';
            icon.innerText = meta.letter;
            item.appendChild(icon);
            
            const label = document.createElement('div');
            label.innerText = meta.label;
            item.appendChild(label);
        } else {
            const img = document.createElement('img');
            img.src = meta.src;
            img.alt = fileName;
            img.title = cleanName(fileName); 
            item.appendChild(img);
        }
        
        item.addEventListener('click', () => {
            document.querySelectorAll('.toolbar-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            currentSelectedAsset = fileName;
            openPropertiesPanel(fileName);
        });
        
        toolbarAssets.appendChild(item);
    });
}

function openPropertiesPanel(fileName) {
    const data = assetRegistry[fileName];
    selectedAssetName.innerText = data.isSystem ? data.label : cleanName(fileName).toUpperCase();
    collisionToggle.checked = data.isSolid;
    customHitboxSettings.style.display = data.isSolid ? 'block' : 'none';
    
    assetW.value = data.renderW;
    assetH.value = data.renderH;
    hbX.value = data.hitbox.x;
    hbY.value = data.hitbox.y;
    hbW.value = data.hitbox.w;
    hbH.value = data.hitbox.h;
}

collisionToggle.addEventListener('change', () => {
    if (!currentSelectedAsset) return;
    assetRegistry[currentSelectedAsset].isSolid = collisionToggle.checked;
    customHitboxSettings.style.display = collisionToggle.checked ? 'block' : 'none';
    redrawCanvas();
});

[assetW, assetH].forEach(input => {
    input.addEventListener('input', () => {
        if (!currentSelectedAsset) return;
        assetRegistry[currentSelectedAsset].renderW = parseInt(assetW.value) || GRID_SIZE;
        assetRegistry[currentSelectedAsset].renderH = parseInt(assetH.value) || GRID_SIZE;
        redrawCanvas();
    });
});

[hbX, hbY, hbW, hbH].forEach(input => {
    input.addEventListener('input', () => {
        if (!currentSelectedAsset) return;
        assetRegistry[currentSelectedAsset].hitbox = {
            x: parseInt(hbX.value) || 0,
            y: parseInt(hbY.value) || 0,
            w: parseInt(hbW.value) || GRID_SIZE,
            h: parseInt(hbH.value) || GRID_SIZE
        };
        redrawCanvas(); 
    });
});

function drawGrid() {
    ctx.strokeStyle = '#252525';
    ctx.lineWidth = 1;
    for (let x = -4000; x <= 4000; x += GRID_SIZE) {
        ctx.beginPath(); ctx.moveTo(x, -4000); ctx.lineTo(x, 4000); ctx.stroke();
    }
    for (let y = -4000; y <= 4000; y += GRID_SIZE) {
        ctx.beginPath(); ctx.moveTo(-4000, y); ctx.lineTo(4000, y); ctx.stroke();
    }
}

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.scale(zoomLevel, zoomLevel);
    ctx.translate(cameraX, cameraY);
    
    drawGrid();

    placedObjects.forEach(obj => {
        const meta = assetRegistry[obj.asset];
        
        if (meta.isSystem) {
            ctx.fillStyle = '#222222';
            ctx.fillRect(obj.pixelX, obj.pixelY, obj.w, obj.h);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(obj.pixelX, obj.pixelY, obj.w, obj.h);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Courier New';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(meta.letter, obj.pixelX + (obj.w / 2), obj.pixelY + (obj.h / 2));
        } else {
            const img = new Image();
            img.src = meta.src;
            ctx.drawImage(img, obj.pixelX, obj.pixelY, obj.w, obj.h);
        }

        if (meta.isSolid) {
            ctx.strokeStyle = '#ffffff'; 
            ctx.lineWidth = 1.5;
            ctx.strokeRect(
                obj.pixelX + meta.hitbox.x, 
                obj.pixelY + meta.hitbox.y, 
                meta.hitbox.w, 
                meta.hitbox.h
            );
        }
    });

    if (isMouseOnCanvas && !isPanning && currentTool === 'draw' && currentSelectedAsset) {
        const meta = assetRegistry[currentSelectedAsset];
        ctx.save();
        ctx.globalAlpha = 0.4;
        if (meta.isSystem) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(currentMouseGridX, currentMouseGridY, meta.renderW, meta.renderH);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(currentMouseGridX, currentMouseGridY, meta.renderW, meta.renderH);
        } else {
            const img = new Image();
            img.src = meta.src;
            ctx.drawImage(img, currentMouseGridX, currentMouseGridY, meta.renderW, meta.renderH);
        }
        ctx.restore();
    }

    ctx.restore();
}

canvas.addEventListener('click', (event) => {
    if (event.button === 2) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = (event.clientX - rect.left) / zoomLevel - cameraX;
    const mouseY = (event.clientY - rect.top) / zoomLevel - cameraY;
    
    const gridX = Math.floor(mouseX / GRID_SIZE) * GRID_SIZE;
    const gridY = Math.floor(mouseY / GRID_SIZE) * GRID_SIZE;

    if (currentTool === 'erase') {
        const index = placedObjects.findIndex(obj => {
            return mouseX >= obj.pixelX && mouseX <= (obj.pixelX + obj.w) &&
                   mouseY >= obj.pixelY && mouseY <= (obj.pixelY + obj.h);
        });
        if (index !== -1) {
            placedObjects.splice(index, 1);
            redrawCanvas();
        }
        return;
    }

    if (!currentSelectedAsset) return;

    const alreadyPlaced = placedObjects.some(obj => obj.pixelX === gridX && obj.pixelY === gridY);
    if (alreadyPlaced) return; 

    const meta = assetRegistry[currentSelectedAsset];

    placedObjects.push({
        asset: currentSelectedAsset,
        pixelX: gridX,
        pixelY: gridY,
        gridX: gridX / GRID_SIZE,
        gridY: gridY / GRID_SIZE,
        w: meta.renderW,
        h: meta.renderH
    });

    redrawCanvas();
});

loadAssets();