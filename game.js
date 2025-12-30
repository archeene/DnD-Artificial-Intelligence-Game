// game.js - FULL UNABRIDGED - COMPLETE FINAL VERSION WITH ALL FIXES //
// Character sheet: Add/Remove buttons under image, ability scores 2 per line, Saves single field
// Styled popups for confirm/alert/prompt

const GRID_SIZE = 32;
let TILE_SIZE = 32;
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let dmSecrets = localStorage.getItem('dndGridDmSecrets') || '';
const DM_SECRETS_KEY = 'dndGridDmSecrets';
let selectedUnit = null;
let units = [];
let customMapImageSrc = null;
let customMapImage = null;
let characterAssets = [];
let sceneAssets = [];

// New: Persistent character sheets by sprite source
let characterSheets = {}; // spriteSrc -> sheet object

let npcPromptAssets = []; // New: stored NPC system prompts
const NPC_PROMPTS_KEY = 'dndGridNpcPrompts';
let currentChatMode = 'dm'; // 'dm' or 'npc'

const DEFAULT_DM_PROMPT = `Do not mention venice or AI. Limit responses to 1 paragraph long. Strictly roleplay as an expert Dungeon Master and rules lawyer for Dungeons & Dragons 4th Edition. Always reference the official 4th Edition System Reference Document (SRD) rules precisely. For any rules question, quote or paraphrase the exact rule from the SRD. Your job is to create compelling narratives and NPC characters while strictly following the game rules. All actions should be advancing the overall narrative which is specified by the user. Key SRD sections to prioritize: - Combat: Initiative, actions, bonus actions, reactions, attack rolls, damage, conditions (PHB Chapter 9) - Spellcasting: Spell slots, casting time, components, concentration, saving throws (PHB Chapter 10) - Ability Checks: Advantage/disadvantage, proficiency, DC setting - Classes/Races/Backgrounds: Use only SRD content (core races/classes only — no subclasses beyond SRD without user input) - Monsters: Use SRD stat blocks exactly - Magic Items: SRD only Never make up rules. If unsure, say "According to the SRD..." and provide the most accurate interpretation. For quick lookups, respond with the rule first, then explain in context.`;

const DEFAULT_NPC_PROMPT = `Your range of actions is limited by the legal 4th edition dungeons and dragons rules. When you perform an action, always clearly state what dice rolls must be made. Each response you must succinctly declare the NPCs actions before speaking. You will not mention venice or AI. You are roleplaying as a specific NPC in a Dungeons & Dragons game. Speak only in character. Only one succinct paragraph. Use flavorful, immersive dialogue appropriate to your personality, background, and current situation. Do not narrate actions unless directly asked. Do not break character or mention being an AI.`;

const CHARACTER_STORAGE_KEY = 'dndGridCharacterAssets';
const SCENE_STORAGE_KEY = 'dndGridSceneAssets';
const SAVES_KEY = 'dndGridSaves';
const CHARACTER_SHEETS_KEY = 'dndGridCharacterSheets';
let chatHistory = [];
let questLog = localStorage.getItem('dndGridQuestLog') || ''; // Persistent quest summary (bullet points)
const QUEST_LOG_KEY = 'dndGridQuestLog';

function resizeCanvas() {

  const size = Math.min(window.innerWidth, window.innerHeight * 0.9);
  canvas.width = size;
  canvas.height = size;
  TILE_SIZE = Math.floor(size / GRID_SIZE);
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.transform = 'none';
  draw();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (customMapImage) {
    ctx.drawImage(customMapImage, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  units.forEach(unit => {
    const sizeTiles = unit.size || 1; // 1, 2, or 3
    const drawSize = TILE_SIZE * sizeTiles * 2;
    const offset = sizeTiles - 1;
    const drawX = unit.x * TILE_SIZE + TILE_SIZE / 2 - drawSize / 2 + offset * TILE_SIZE / 2;
    const drawY = unit.y * TILE_SIZE + TILE_SIZE / 2 - drawSize / 2 + offset * TILE_SIZE / 2;

    const img = new Image();
    img.src = unit.spriteSrc;

    if (img.complete && img.naturalWidth !== 0) {
      ctx.drawImage(img, drawX, drawY, drawSize, drawSize);
    }
    img.onload = () => ctx.drawImage(img, drawX, drawY, drawSize, drawSize);

    // HP bar - scaled
    if (unit.sheet && unit.sheet.hp) {
      const hpText = unit.sheet.hp.trim();
      const match = hpText.match(/^(\d+)\/?(\d*)/);
      if (match) {
        let current = parseInt(match[1]) || 0;
        let max = match[2] ? parseInt(match[2]) : current;
        if (max === 0) max = 1;
        const ratio = current / max;
        const barWidth = drawSize;
        const barHeight = 8;
        const barX = drawX;
        const barY = drawY - 16;

        ctx.fillStyle = '#300';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = ratio > 0.5 ? '#0f0' : ratio > 0.25 ? '#ff0' : '#f00';
        ctx.fillRect(barX, barY, barWidth * ratio, barHeight);
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        ctx.font = `${Math.max(8, Math.floor(TILE_SIZE * 0.35))}px Courier New`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(`${current}/${max}`, barX + barWidth / 2, barY + barHeight - 2);
      }
    }
  });

  if (selectedUnit) {
    const sizeTiles = selectedUnit.size || 1;
    const drawSize = TILE_SIZE * sizeTiles * 2;
    const offset = sizeTiles - 1;
    const drawX = selectedUnit.x * TILE_SIZE + TILE_SIZE / 2 - drawSize / 2 + offset * TILE_SIZE / 2;
    const drawY = selectedUnit.y * TILE_SIZE + TILE_SIZE / 2 - drawSize / 2 + offset * TILE_SIZE / 2;

    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 4;
    ctx.strokeRect(drawX - 4, drawY - 4, drawSize + 8, drawSize + 8);
  }
}

draw();

function loadStateFromData(data) {
  if (data.mapImageSrc !== null && sceneAssets[data.mapImageSrc]) {
    customMapImageSrc = sceneAssets[data.mapImageSrc];
    customMapImage = new Image();
    customMapImage.src = customMapImageSrc;
    customMapImage.onload = draw;
  } else {
    customMapImage = null;
    customMapImageSrc = null;
    draw();
  }

  units = data.units ? data.units.map(u => {
    const spriteSrc = characterAssets[u.spriteIndex];
    return spriteSrc ? {
      x: u.x,
      y: u.y,
      type: u.type || 'character',
      spriteSrc: spriteSrc,
      sheet: characterSheets[spriteSrc] || {},
      size: u.size || 1
    } : null;
  }).filter(u => u !== null) : [];

  selectedUnit = null;
  hideCharacterDetailsPanel();
  populateLeftBox();
  clearSessionUI(); // Clears DM chat, character gen, and scene gen messages/history
  draw();

  // Restore quest log from saved data (previously missing)
  if (data.questLog !== undefined) {
    questLog = data.questLog;
    localStorage.setItem(QUEST_LOG_KEY, questLog);
  } else {
    questLog = '';
    localStorage.removeItem(QUEST_LOG_KEY);
  }
}

function clearSessionUI() {
  // Clear chat history and UI
  chatHistory = [];
  const chatMessages = document.getElementById('chatMessages');
  if (chatMessages) chatMessages.innerHTML = '';

  // Clear character generation history
  const characterMessages = document.getElementById('characterMessages');
  if (characterMessages) characterMessages.innerHTML = '';

  // Clear scene generation history
  const sceneMessages = document.getElementById('sceneMessages');
  if (sceneMessages) sceneMessages.innerHTML = '';
}

function updateSaveList() {
  const list = document.getElementById('saveListItems');
  if (!list) return;

  let saves = JSON.parse(localStorage.getItem(SAVES_KEY) || '[]');
  if (saves.length > 3) {
    saves = saves.slice(-3);
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
  }

  list.innerHTML = '';
  [...saves].reverse().forEach((save, reverseIndex) => {
    const actualIndex = saves.length - 1 - reverseIndex;
    const li = document.createElement('li');
    li.style.padding = '8px';
    li.style.borderBottom = '1px solid #0f0';
    li.style.textAlign = 'center';

    const timestampBtn = document.createElement('button');
    timestampBtn.textContent = save.timestamp;
    timestampBtn.style.width = '100%';
    timestampBtn.style.padding = '8px';
    timestampBtn.style.marginBottom = '8px';
    timestampBtn.style.background = '#333';
    timestampBtn.style.color = '#0f0';
    timestampBtn.style.border = '1px solid #0f0';
    timestampBtn.style.cursor = 'pointer';
    timestampBtn.onclick = () => loadStateFromData(save);
    li.appendChild(timestampBtn);

    const actions = document.createElement('div');
    actions.className = 'save-actions';
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.marginTop = '8px';

    const renameBtn = document.createElement('button');
    renameBtn.textContent = 'Rename';
    renameBtn.onclick = (e) => {
      e.stopPropagation();
      promptStyled('New name:', save.timestamp).then(newName => {
        if (newName !== null && newName.trim() !== '') {
          saves[actualIndex].timestamp = newName.trim();
          localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
          updateSaveList();
        }
      });
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      confirmStyled('Delete this save?').then(confirmed => {
        if (confirmed) {
          saves.splice(actualIndex, 1);
          localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
          updateSaveList();
        }
      });
    };

    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    li.appendChild(actions);
    list.appendChild(li);
  });
}

function createSavePanel() {
  const container = document.getElementById('savePanelContainer');
  if (!container) return;
  container.innerHTML = '';

  const panel = document.createElement('div');
  panel.id = 'savePanel';

  const saveBtn = document.createElement('button');
  saveBtn.id = 'saveButton';
  saveBtn.textContent = 'Save Current Game';
  saveBtn.onclick = function() {
    const timestamp = new Date().toLocaleString();
    const getAssetIndex = (assetArray, assetSrc) => {
      const index = assetArray.indexOf(assetSrc);
      return index !== -1 ? index : null;
    };

    const data = {
      timestamp,
      mapImageSrc: customMapImageSrc ? getAssetIndex(sceneAssets, customMapImageSrc) : null,
      units: units.map(u => ({
        x: u.x,
        y: u.y,
        spriteIndex: getAssetIndex(characterAssets, u.spriteSrc),
        type: u.type || 'character',
        size: u.size || 1
      })).filter(u => u.spriteIndex !== null),
      characterAssetIndexes: characterAssets.map((_, i) => i),
      sceneAssetIndexes: sceneAssets.map((_, i) => i),
      questLog
    };

    let saves = JSON.parse(localStorage.getItem(SAVES_KEY) || '[]');
    saves.push(data);
    if (saves.length > 3) {
      saves = saves.slice(-3);
    }
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
    updateSaveList();
    alertStyled('Game saved with quest progress!');
  };

  panel.appendChild(saveBtn);

  const listDiv = document.createElement('div');
  listDiv.id = 'saveList';

  const heading = document.createElement('h3');
  heading.textContent = 'Saved Games (Newest on Top)';
  listDiv.appendChild(heading);

  const ul = document.createElement('ul');
  ul.id = 'saveListItems';
  listDiv.appendChild(ul);

  panel.appendChild(listDiv);
  container.appendChild(panel);
  updateSaveList();
}

function loadSaves() {
  const saves = JSON.parse(localStorage.getItem(SAVES_KEY) || '[]');
  if (saves.length > 0) {
    loadStateFromData(saves[saves.length - 1]);
  } else {
    loadCharacterAssets();
    loadSceneAssets();
    loadNpcPrompts();
    clearSessionUI();
  }
}

function loadNpcPrompts() {
  const stored = localStorage.getItem(NPC_PROMPTS_KEY);
  if (stored) npcPromptAssets = JSON.parse(stored);
}

function saveNpcPrompts() {
  localStorage.setItem(NPC_PROMPTS_KEY, JSON.stringify(npcPromptAssets));
}

function loadCharacterAssets() {
  const stored = localStorage.getItem(CHARACTER_STORAGE_KEY);
  if (stored) characterAssets = JSON.parse(stored);
}

function saveCharacterAssets() {
  localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(characterAssets));
}

function loadSceneAssets() {
  const stored = localStorage.getItem(SCENE_STORAGE_KEY);
  if (stored) sceneAssets = JSON.parse(stored);
}

function saveSceneAssets() {
  localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(sceneAssets));
}

function loadCharacterSheets() {
  const stored = localStorage.getItem(CHARACTER_SHEETS_KEY);
  if (stored) {
    characterSheets = JSON.parse(stored);
  }
}

function saveCharacterSheets() {
  localStorage.setItem(CHARACTER_SHEETS_KEY, JSON.stringify(characterSheets));
}

function addCharacterWithSize(base64Src, size = 1) {
  if (!characterAssets.includes(base64Src)) {
    characterAssets.push(base64Src);
    saveCharacterAssets();
    populateLeftBox();
  }

  const newUnit = {
    x: Math.floor(GRID_SIZE / 2),
    y: Math.floor(GRID_SIZE / 2),
    type: 'character',
    spriteSrc: base64Src,
    sheet: characterSheets[base64Src] || {},
    size: size
  };
  units.push(newUnit);
  draw();
}

function setupSceneUpload() {
  const input = document.getElementById('sceneFileUpload');
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Src = event.target.result;
      if (!sceneAssets.includes(base64Src)) {
        sceneAssets.push(base64Src);
        saveSceneAssets();
        populateLeftBox();
      }
      customMapImageSrc = base64Src;
      customMapImage = new Image();
      customMapImage.src = base64Src;
      customMapImage.onload = draw;
      alertStyled('Scene image uploaded, saved to assets, and applied as map!');
    };
    reader.readAsDataURL(file);
    input.value = '';
  };
}

document.addEventListener('keydown', (e) => {
  if (!selectedUnit) return;
  let dx = 0;
  let dy = 0;
  switch (e.key) {
    case 'ArrowUp': dy = -1; break;
    case 'ArrowDown': dy = 1; break;
    case 'ArrowLeft': dx = -1; break;
    case 'ArrowRight': dx = 1; break;
  }
  if (dx !== 0 || dy !== 0) {
    const size = selectedUnit.size || 1;
    const newX = selectedUnit.x + dx;
    const newY = selectedUnit.y + dy;
    const max = GRID_SIZE - size;
    if (newX < 0 || newX >= max || newY < 0 || newY >= max) return;

    const overlaps = units.some(u => u !== selectedUnit &&
      newX < u.x + (u.size || 1) && newX + size > u.x &&
      newY < u.y + (u.size || 1) && newY + size > u.y
    );

    if (!overlaps) {
      selectedUnit.x = newX;
      selectedUnit.y = newY;
      draw();
    }
  }
});

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  let clickedUnit = null;
  let bestDistance = Infinity;

  units.forEach((unit) => {
    const sizeTiles = unit.size || 1;
    const drawSize = TILE_SIZE * sizeTiles * 2;
    const offset = sizeTiles - 1;
    const drawX = unit.x * TILE_SIZE + TILE_SIZE / 2 - drawSize / 2 + offset * TILE_SIZE / 2;
    const drawY = unit.y * TILE_SIZE + TILE_SIZE / 2 - drawSize / 2 + offset * TILE_SIZE / 2;

    if (clickX >= drawX && clickX <= drawX + drawSize &&
        clickY >= drawY && clickY <= drawY + drawSize) {
      const centerX = drawX + drawSize / 2;
      const centerY = drawY + drawSize / 2;
      const dist = Math.hypot(clickX - centerX, clickY - centerY);
      if (dist < bestDistance) {
        bestDistance = dist;
        clickedUnit = unit;
      }
    }
  });

  if (clickedUnit) {
    selectedUnit = clickedUnit;
    hideAllPanels();
    showCharacterDetailsPanel(clickedUnit);
  } else {
    selectedUnit = null;
    hideCharacterDetailsPanel();
  }
  draw();
});

function showCharacterDetailsPanel(unit) {
  hideAllPanels();
  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const panel = document.getElementById('characterDetailsPanel');
  panel.innerHTML = '';

  const container = document.createElement('div');
  container.style.padding = '20px';
  container.style.textAlign = 'center';

  const nameWrapper = document.createElement('div');
  nameWrapper.style.marginBottom = '20px';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Character Name';
  nameInput.value = (unit.sheet && unit.sheet.name) || '';
  nameInput.style.width = '80%';
  nameInput.style.padding = '10px';
  nameInput.style.fontSize = '18px';
  nameInput.style.textAlign = 'center';
  nameInput.style.background = '#222';
  nameInput.style.color = '#0f0';
  nameInput.style.border = '2px solid #0f0';
  nameInput.style.borderRadius = '8px';
  nameInput.onchange = () => {
    if (!unit.sheet) unit.sheet = {};
    unit.sheet.name = nameInput.value;
    characterSheets[unit.spriteSrc] = unit.sheet;
    saveCharacterSheets();
  };
  nameWrapper.appendChild(nameInput);
  container.appendChild(nameWrapper);

  // Auto-load matching NPC prompt if character has a saved name and exact match exists
  if (unit.sheet && unit.sheet.name) {
    const characterName = unit.sheet.name.trim();
    const matchingNpc = npcPromptAssets.find(npc => npc.name && npc.name.trim() === characterName );
    if (matchingNpc) {
      const textarea = document.getElementById('systemPrompt');
      if (textarea) {
        textarea.value = matchingNpc.prompt;
        // Don't force display - let the NPC button toggle handle it
      }
      currentChatMode = 'npc'; // Update mode buttons to reflect NPC mode
      const dmBtn = document.getElementById('chatModeDM');
      const npcBtn = document.getElementById('chatModeNPC');
      const saveNpcBtn = document.querySelector('#chatContainer button:nth-of-type(3)'); // Save NPC button
      if (dmBtn && npcBtn) {
        dmBtn.classList.remove('active');
        dmBtn.style.background = '#333';
        dmBtn.style.color = '#0f0';
        npcBtn.classList.add('active');
        npcBtn.style.background = '#0f0';
        npcBtn.style.color = '#000';
      }
      if (saveNpcBtn) {
        saveNpcBtn.style.display = 'block';
      }
    }
  }

  const img = document.createElement('img');
  img.src = unit.spriteSrc;
  img.style.width = '192px';
  img.style.height = '192px';
  img.style.objectFit = 'contain';
  img.style.border = '4px solid #0f0';
  img.style.borderRadius = '12px';
  img.style.background = '#111';
  img.style.marginBottom = '20px';
  container.appendChild(img);

  const buttonRow = document.createElement('div');
  buttonRow.style.display = 'flex';
  buttonRow.style.justifyContent = 'center';
  buttonRow.style.alignItems = 'center';
  buttonRow.style.gap = '30px';
  buttonRow.style.marginBottom = '25px';

  const addBtn = document.createElement('button');
  addBtn.textContent = 'Add';
  addBtn.style.padding = '12px 24px';
  addBtn.style.background = '#080';
  addBtn.style.color = '#0f0';
  addBtn.style.border = '2px solid #0f0';
  addBtn.style.borderRadius = '8px';
  addBtn.style.cursor = 'pointer';
  addBtn.style.fontWeight = 'bold';
  addBtn.onclick = () => {
    const duplicate = {
      x: unit.x,
      y: unit.y - 1,
      type: 'character',
      spriteSrc: unit.spriteSrc,
      sheet: JSON.parse(JSON.stringify(unit.sheet || {})),
      size: unit.size || 1
    };
    units.push(duplicate);
    draw();
  };
  buttonRow.appendChild(addBtn);

  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove';
  removeBtn.style.padding = '12px 24px';
  removeBtn.style.background = '#800';
  removeBtn.style.color = '#0f0';
  removeBtn.style.border = '2px solid #f00';
  removeBtn.style.borderRadius = '8px';
  removeBtn.style.cursor = 'pointer';
  removeBtn.style.fontWeight = 'bold';
  removeBtn.onclick = () => {
    confirmStyled('Remove this character from the map?').then(confirmed => {
      if (confirmed) {
        units = units.filter(u => u !== unit);
        selectedUnit = null;
        hideCharacterDetailsPanel();
        draw();
      }
    });
  };
  buttonRow.appendChild(removeBtn);

  container.appendChild(buttonRow);

  const saveSheetBtn = document.createElement('button');
  saveSheetBtn.textContent = 'Save Character Sheet';
  saveSheetBtn.style.marginBottom = '20px';
  saveSheetBtn.style.padding = '12px 24px';
  saveSheetBtn.style.background = '#008';
  saveSheetBtn.style.color = '#0ff';
  saveSheetBtn.style.border = '2px solid #00f';
  saveSheetBtn.style.borderRadius = '8px';
  saveSheetBtn.style.cursor = 'pointer';
  saveSheetBtn.style.fontWeight = 'bold';
  saveSheetBtn.onclick = () => {
    characterSheets[unit.spriteSrc] = unit.sheet;
    saveCharacterSheets();
    // Append character sheet info to quest log
    const timestamp = new Date().toLocaleString();
    const characterInfo = unit.sheet.name ? unit.sheet.name : 'Unnamed Character';
    let sheetText = `\n\n--- Character Sheet Saved ${timestamp} ---\n${characterInfo}\n`;
    if (unit.sheet.class) sheetText += `Class: ${unit.sheet.class}\n`;
    if (unit.sheet.race) sheetText += `Race: ${unit.sheet.race}\n`;
    if (unit.sheet.hp) sheetText += `HP: ${unit.sheet.hp}\n`;
    if (unit.sheet.ac) sheetText += `AC: ${unit.sheet.ac}\n`;
    if (unit.sheet.saves) sheetText += `Saves: ${unit.sheet.saves}\n`;
    if (unit.sheet.str) sheetText += `STR: ${unit.sheet.str}\n`;
    if (unit.sheet.con) sheetText += `CON: ${unit.sheet.con}\n`;
    if (unit.sheet.dex) sheetText += `DEX: ${unit.sheet.dex}\n`;
    if (unit.sheet.int) sheetText += `INT: ${unit.sheet.int}\n`;
    if (unit.sheet.wis) sheetText += `WIS: ${unit.sheet.wis}\n`;
    if (unit.sheet.cha) sheetText += `CHA: ${unit.sheet.cha}\n`;
    if (unit.sheet.equipment) sheetText += `Equipment: ${unit.sheet.equipment}\n`;
    if (unit.sheet.skills) sheetText += `Skills: ${unit.sheet.skills}\n`;
    if (unit.sheet.feats) sheetText += `Feats: ${unit.sheet.feats}\n`;
    if (unit.sheet.spells) sheetText += `Spells: ${unit.sheet.spells}\n`;
    questLog += sheetText;
    localStorage.setItem(QUEST_LOG_KEY, questLog);
    alertStyled('Saved to asset and quest log!');
  };
  container.appendChild(saveSheetBtn);

  const sizeRow = document.createElement('div');
  sizeRow.style.display = 'flex';
  sizeRow.style.gap = '8px';
  sizeRow.style.marginBottom = '20px';
  sizeRow.style.justifyContent = 'center';

  const normalBtn = document.createElement('button');
  normalBtn.textContent = 'Normal';
  normalBtn.style.padding = '8px 12px';
  normalBtn.style.background = '#444';
  normalBtn.style.color = '#0f0';
  normalBtn.style.border = '1px solid #0f0';
  normalBtn.style.borderRadius = '6px';
  normalBtn.style.cursor = 'pointer';
  normalBtn.style.fontSize = '14px';
  normalBtn.onclick = () => { unit.size = 1; draw(); };

  const bigBtn = document.createElement('button');
  bigBtn.textContent = 'Big';
  bigBtn.style.padding = '8px 12px';
  bigBtn.style.background = '#444';
  bigBtn.style.color = '#0f0';
  bigBtn.style.border = '1px solid #0f0';
  bigBtn.style.borderRadius = '6px';
  bigBtn.style.cursor = 'pointer';
  bigBtn.style.fontSize = '14px';
  bigBtn.onclick = () => { unit.size = 2; draw(); };

  const biggerBtn = document.createElement('button');
  biggerBtn.textContent = 'Bigger';
  biggerBtn.style.padding = '8px 12px';
  biggerBtn.style.background = '#444';
  biggerBtn.style.color = '#0f0';
  biggerBtn.style.border = '1px solid #0f0';
  biggerBtn.style.borderRadius = '6px';
  biggerBtn.style.cursor = 'pointer';
  biggerBtn.style.fontSize = '14px';
  biggerBtn.onclick = () => { unit.size = 3; draw(); };

  sizeRow.appendChild(normalBtn);
  sizeRow.appendChild(bigBtn);
  sizeRow.appendChild(biggerBtn);
  container.appendChild(sizeRow);

  if (!unit.sheet) unit.sheet = {};

  const createHorizontalPair = (label1, key1, label2, key2) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.marginBottom = '12px';
    row.style.gap = '15px';

    const field1 = document.createElement('div');
    field1.style.flex = '1';
    field1.style.minWidth = '0';

    const labelA = document.createElement('label');
    labelA.textContent = label1;
    labelA.style.display = 'block';
    labelA.style.marginBottom = '4px';
    labelA.style.fontWeight = 'bold';
    labelA.style.fontSize = '14px';
    field1.appendChild(labelA);

    const inputA = document.createElement('input');
    inputA.type = 'text';
    inputA.value = unit.sheet[key1] || '';
    inputA.style.width = '100%';
    inputA.style.padding = '8px';
    inputA.style.background = '#222';
    inputA.style.color = '#0f0';
    inputA.style.border = '1px solid #0f0';
    inputA.style.borderRadius = '5px';
    inputA.style.boxSizing = 'border-box';
    inputA.onchange = () => { unit.sheet[key1] = inputA.value; draw(); };
    field1.appendChild(inputA);

    const field2 = document.createElement('div');
    field2.style.flex = '1';
    field2.style.minWidth = '0';

    const labelB = document.createElement('label');
    labelB.textContent = label2;
    labelB.style.display = 'block';
    labelB.style.marginBottom = '4px';
    labelB.style.fontWeight = 'bold';
    labelB.style.fontSize = '14px';
    field2.appendChild(labelB);

    const inputB = document.createElement('input');
    inputB.type = 'text';
    inputB.value = unit.sheet[key2] || '';
    inputB.style.width = '100%';
    inputB.style.padding = '8px';
    inputB.style.background = '#222';
    inputB.style.color = '#0f0';
    inputB.style.border = '1px solid #0f0';
    inputB.style.borderRadius = '5px';
    inputB.style.boxSizing = 'border-box';
    inputB.onchange = () => { unit.sheet[key2] = inputB.value; draw(); };
    field2.appendChild(inputB);

    row.appendChild(field1);
    row.appendChild(field2);
    return row;
  };

  const createSingleField = (labelText, key, isTextarea = false) => {
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '15px';

    const label = document.createElement('label');
    label.textContent = labelText;
    label.style.display = 'block';
    label.style.marginBottom = '4px';
    label.style.fontWeight = 'bold';
    wrapper.appendChild(label);

    const element = isTextarea ? document.createElement('textarea') : document.createElement('input');
    element.type = 'text';
    element.value = unit.sheet[key] || '';
    element.style.width = '100%';
    element.style.padding = '8px';
    element.style.background = '#222';
    element.style.color = '#0f0';
    element.style.border = '1px solid #0f0';
    element.style.borderRadius = '5px';
    element.style.boxSizing = 'border-box';
    if (isTextarea) {
      element.style.height = '80px';
      element.style.resize = 'vertical';
    }
    element.onchange = () => { unit.sheet[key] = element.value; draw(); };
    wrapper.appendChild(element);
    return wrapper;
  };

  container.appendChild(createHorizontalPair('Class', 'class', 'Race', 'race'));
  container.appendChild(createHorizontalPair('HP', 'hp', 'AC', 'ac'));
  container.appendChild(createSingleField('Saves', 'saves', false));
  container.appendChild(createHorizontalPair('Strength', 'str', 'Constitution', 'con'));
  container.appendChild(createHorizontalPair('Dexterity', 'dex', 'Intelligence', 'int'));
  container.appendChild(createHorizontalPair('Wisdom', 'wis', 'Charisma', 'cha'));
  container.appendChild(createSingleField('Equipment', 'equipment', true));
  container.appendChild(createSingleField('Skills', 'skills', true));
  container.appendChild(createSingleField('Feats', 'feats', true));
  container.appendChild(createSingleField('Spells / Special', 'spells', true));

  panel.appendChild(container);
  panel.classList.add('active');
  fadeChatPanel();
}

function hideCharacterDetailsPanel() {
  const panel = document.getElementById('characterDetailsPanel');
  if (panel) {
    panel.classList.remove('active');
    panel.innerHTML = '';
  }
  selectedUnit = null;
  // Restore chat visibility
  const rightPanel = document.getElementById('rightPanel');
  if (rightPanel) {
    rightPanel.style.opacity = '1';
    rightPanel.style.pointerEvents = 'auto';
  }
}

function hideAllPanels() {
  const panels = [
    'characterGenPanel',
    'sceneGenPanel',
    'assetsPanel',
    'dicePanel',
    'savePanelContainer',
    'characterDetailsPanel',
    'uploadPanel'
  ];
  panels.forEach(id => {
    const p = document.getElementById(id);
    if (p) {
      p.classList.remove('active');
      if (id === 'characterDetailsPanel') {
        p.innerHTML = '';
      }
    }
  });
  // Restore chat visibility
  const rightPanel = document.getElementById('rightPanel');
  if (rightPanel) {
    rightPanel.style.opacity = '1';
    rightPanel.style.pointerEvents = 'auto';
  }
}

function fadeChatPanel() {
  const rightPanel = document.getElementById('rightPanel');
  if (rightPanel) {
    rightPanel.style.opacity = '0.3';
    rightPanel.style.pointerEvents = 'none';
  }
}

function populateLeftBox() {
  const charactersRow = document.getElementById('charactersRow');
  const sceneryRow = document.getElementById('sceneryRow');
  const npcRow = document.getElementById('npcRow');

  if (!charactersRow || !sceneryRow || !npcRow) return;

  // Clear only content after header
  charactersRow.innerHTML = '<h4>Characters</h4>';
  sceneryRow.innerHTML = '<h4>Scenes</h4>';
  npcRow.innerHTML = '<h4>NPCs</h4>';

  // Populate Characters
  characterAssets.forEach((src, index) => {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.margin = '5px';

    const icon = document.createElement('img');
    icon.src = src;
    icon.className = 'asset-icon';
    icon.onclick = () => {
      const newUnit = {
        x: Math.floor(GRID_SIZE / 2),
        y: Math.floor(GRID_SIZE / 2),
        type: 'character',
        spriteSrc: src,
        sheet: characterSheets[src] || {},
        size: 1
      };
      units.push(newUnit);
      draw();
    };

    const removeBtn = document.createElement('div');
    removeBtn.style.position = 'absolute';
    removeBtn.style.top = '-6px';
    removeBtn.style.right = '-6px';
    removeBtn.style.width = '16px';
    removeBtn.style.height = '16px';
    removeBtn.style.background = '#f00';
    removeBtn.style.borderRadius = '50%';
    removeBtn.style.cursor = 'pointer';
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      characterAssets.splice(index, 1);
      saveCharacterAssets();
      populateLeftBox();
    };

    wrapper.appendChild(icon);
    wrapper.appendChild(removeBtn);
    charactersRow.appendChild(wrapper);
  });

  // Populate Scenes
  sceneAssets.forEach((src, index) => {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.margin = '5px';

    const icon = document.createElement('img');
    icon.src = src;
    icon.style.width = '96px';
    icon.style.height = '96px';
    icon.style.objectFit = 'cover';
    icon.style.border = '2px solid #0f0';
    icon.style.borderRadius = '5px';
    icon.style.cursor = 'pointer';
    icon.onclick = () => {
      customMapImageSrc = src;
      customMapImage = new Image();
      customMapImage.src = src;
      customMapImage.onload = draw;
    };

    const removeBtn = document.createElement('div');
    removeBtn.style.position = 'absolute';
    removeBtn.style.top = '-6px';
    removeBtn.style.right = '-6px';
    removeBtn.style.width = '16px';
    removeBtn.style.height = '16px';
    removeBtn.style.background = '#f00';
    removeBtn.style.borderRadius = '50%';
    removeBtn.style.cursor = 'pointer';
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      sceneAssets.splice(index, 1);
      saveSceneAssets();
      populateLeftBox();
    };

    wrapper.appendChild(icon);
    wrapper.appendChild(removeBtn);
    sceneryRow.appendChild(wrapper);
  });

  // Populate NPCs - alphabetically sorted by name
  [...npcPromptAssets]
    .sort((a, b) => {
      const nameA = (a.name || 'Unnamed NPC').toLowerCase();
      const nameB = (b.name || 'Unnamed NPC').toLowerCase();
      return nameA.localeCompare(nameB);
    })
    .forEach((promptObj, index) => {
      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'space-between';
      wrapper.style.margin = '8px 5px';
      wrapper.style.padding = '12px';
      wrapper.style.background = '#222';
      wrapper.style.border = '2px solid #0f0';
      wrapper.style.borderRadius = '8px';
      wrapper.style.cursor = 'pointer';
      wrapper.style.gap = '10px';

      const nameEl = document.createElement('strong');
      nameEl.textContent = promptObj.name || 'Unnamed NPC';
      nameEl.style.color = '#0f0';
      nameEl.style.minWidth = '100px';
      wrapper.appendChild(nameEl);

      const previewEl = document.createElement('span');
      previewEl.textContent = promptObj.prompt.substring(0, 50) + (promptObj.prompt.length > 50 ? '...' : '');
      previewEl.style.color = '#aaa';
      previewEl.style.fontSize = '12px';
      previewEl.style.flex = '1';
      previewEl.style.textAlign = 'left';
      wrapper.appendChild(previewEl);

      // Click entire card to load (except remove button)
      wrapper.onclick = (e) => {
        if (e.target === removeBtn) return;
        const textarea = document.getElementById('systemPrompt');
        if (textarea) {
          textarea.value = promptObj.prompt;
          // Don't force display - let the NPC button toggle handle it
        }
        currentChatMode = 'npc'; // Update mode buttons
        const dmBtn = document.getElementById('chatModeDM');
        const npcBtn = document.getElementById('chatModeNPC');
        const saveBtn = document.querySelector('#chatContainer button:nth-of-type(3)'); // Save NPC button
        if (dmBtn && npcBtn) {
          dmBtn.classList.remove('active');
          dmBtn.style.background = '#333';
          dmBtn.style.color = '#0f0';
          npcBtn.classList.add('active');
          npcBtn.style.background = '#0f0';
          npcBtn.style.color = '#000';
        }
        if (saveBtn) saveBtn.style.display = 'block';
        alertStyled(`NPC "${promptObj.name || 'Unnamed'}" loaded!`);
      };

      const removeBtn = document.createElement('div');
      removeBtn.textContent = '×';
      removeBtn.style.color = '#f00';
      removeBtn.style.fontSize = '20px';
      removeBtn.style.fontWeight = 'bold';
      removeBtn.style.cursor = 'pointer';
      removeBtn.style.padding = '0 8px';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        confirmStyled('Delete this NPC prompt?').then(confirmed => {
          if (confirmed) {
            // Find actual index in original array
            const actualIndex = npcPromptAssets.findIndex(p => p === promptObj);
            if (actualIndex !== -1) {
              npcPromptAssets.splice(actualIndex, 1);
              saveNpcPrompts();
              populateLeftBox();
            }
          }
        });
      };

      wrapper.appendChild(removeBtn);
      npcRow.appendChild(wrapper);
    });
}

function createDiceRoller() {
  const dicePanel = document.getElementById('dicePanel');
  dicePanel.innerHTML = '';

  const container = document.createElement('div');
  container.id = 'diceRoller';
  container.style.textAlign = 'center';
  container.style.padding = '20px';

  const title = document.createElement('h4');
  title.textContent = 'Dice Roller';
  container.appendChild(title);

  const result = document.createElement('div');
  result.id = 'diceResult';
  result.style.fontSize = '32px';
  result.style.color = '#ff0';
  result.style.minHeight = '50px';
  result.style.fontWeight = 'bold';
  result.style.marginBottom = '15px';
  container.appendChild(result);

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.justifyContent = 'center';
  row.style.gap = '15px';
  row.style.flexWrap = 'wrap';

  const dice = [
    { sides: 4, file: 'd4.png' },
    { sides: 6, file: 'd6.png' },
    { sides: 8, file: 'd8.png' },
    { sides: 10, file: 'd10.png' },
    { sides: 12, file: 'd12.png' },
    { sides: 20, file: 'd20.png' }
  ];

  dice.forEach(d => {
    const img = document.createElement('img');
    img.src = `assets/Dice/${d.file}`;
    img.style.width = '64px';
    img.style.height = '64px';
    img.style.cursor = 'pointer';
    img.style.border = '2px solid #0f0';
    img.style.borderRadius = '8px';
    img.onclick = () => {
      const roll = Math.floor(Math.random() * d.sides) + 1;
      result.textContent = roll;
      result.style.color = '#fff';
      setTimeout(() => result.style.color = '#ff0', 200);
    };
    row.appendChild(img);
  });

  container.appendChild(row);
  dicePanel.appendChild(container);
}

function createChatBox() {
  const rightPanel = document.getElementById('rightPanel');
  rightPanel.innerHTML = '';

  const container = document.createElement('div');
  container.id = 'chatContainer';

  const title = document.createElement('h4');
  title.textContent = 'Chat';
  container.appendChild(title);

  // Mode buttons
  const modeRow = document.createElement('div');
  modeRow.style.display = 'flex';
  modeRow.style.gap = '10px';
  modeRow.style.marginBottom = '10px';
  modeRow.style.justifyContent = 'center';

  const dmBtn = document.createElement('button');
  dmBtn.id = 'chatModeDM';
  dmBtn.textContent = 'Dungeon Master';
  dmBtn.className = 'active';
  dmBtn.style.padding = '6px 12px';
  dmBtn.style.background = '#0f0';
  dmBtn.style.color = '#000';
  dmBtn.style.border = '2px solid #0f0';
  dmBtn.style.borderRadius = '6px';
  dmBtn.style.cursor = 'pointer';

  const npcBtn = document.createElement('button');
  npcBtn.id = 'chatModeNPC';
  npcBtn.textContent = 'NPC';
  npcBtn.style.padding = '6px 12px';
  npcBtn.style.background = '#333';
  npcBtn.style.color = '#0f0';
  npcBtn.style.border = '2px solid #0f0';
  npcBtn.style.borderRadius = '6px';
  npcBtn.style.cursor = 'pointer';

  modeRow.appendChild(dmBtn);
  modeRow.appendChild(npcBtn);
  container.appendChild(modeRow);

  // System prompt textarea (hidden by default like original DM)
  const textarea = document.createElement('textarea');
  textarea.id = 'systemPrompt';
  textarea.value = DEFAULT_DM_PROMPT;
  textarea.style.width = '100%';
  textarea.style.height = '240px';
  textarea.style.background = '#000';
  textarea.style.color = '#fff';
  textarea.style.border = '1px solid #0f0';
  textarea.style.borderRadius = '5px';
  textarea.style.padding = '8px';
  textarea.style.marginBottom = '10px';
  textarea.style.resize = 'vertical';
  textarea.style.display = 'none';
  container.appendChild(textarea);

  // Save NPC button
  const saveNpcBtn = document.createElement('button');
  saveNpcBtn.textContent = 'Save NPC';
  saveNpcBtn.style.width = '100%';
  saveNpcBtn.style.padding = '8px';
  saveNpcBtn.style.marginBottom = '10px';
  saveNpcBtn.style.background = '#080';
  saveNpcBtn.style.color = '#0f0';
  saveNpcBtn.style.border = '2px solid #0f0';
  saveNpcBtn.style.borderRadius = '6px';
  saveNpcBtn.style.cursor = 'pointer';
  saveNpcBtn.style.display = 'none';
  saveNpcBtn.onclick = () => {
    const promptText = textarea.value.trim();
    if (!promptText) {
      alertStyled('Prompt is empty!');
      return;
    }
    promptStyled('NPC name (optional):', '').then(name => {
      const entry = {
        name: name ? name.trim() : null,
        prompt: promptText
      };
      npcPromptAssets.push(entry);
      saveNpcPrompts();
      populateLeftBox();
      alertStyled('NPC prompt saved!');
    });
  };
  container.appendChild(saveNpcBtn);

  // Quest Log Controls
  const questRow = document.createElement('div');
  questRow.style.display = 'flex';
  questRow.style.gap = '10px';
  questRow.style.margin = '10px 0';

  // New: Start Quest button (dark green, leftmost)
  const startQuestBtn = document.createElement('button');
  startQuestBtn.textContent = 'Start Quest';
  startQuestBtn.style.flex = '1';
  startQuestBtn.style.padding = '8px';
  startQuestBtn.style.background = '#080'; // Dark green
  startQuestBtn.style.color = '#0f0';
  startQuestBtn.style.border = '2px solid #0f0';
  startQuestBtn.style.borderRadius = '6px';
  startQuestBtn.style.cursor = 'pointer';
  startQuestBtn.onclick = startQuestGeneration;
  questRow.appendChild(startQuestBtn);

  const summarizeBtn = document.createElement('button');
  summarizeBtn.textContent = 'Log Chat';
  summarizeBtn.style.flex = '1';
  summarizeBtn.style.padding = '8px';
  summarizeBtn.style.background = '#004'; // Dark blue
  summarizeBtn.style.color = '#0f0';
  summarizeBtn.style.border = '2px solid #0f0';
  summarizeBtn.style.borderRadius = '6px';
  summarizeBtn.style.cursor = 'pointer';
  summarizeBtn.onclick = summarizeQuest;
  questRow.appendChild(summarizeBtn);

  const recapBtn = document.createElement('button');
  recapBtn.textContent = 'Edit Quest Log';
  recapBtn.style.flex = '1';
  recapBtn.style.padding = '8px';
  recapBtn.style.background = 'rgba(91, 27, 88, 1)';
  recapBtn.style.color = '#0f0';
  recapBtn.style.border = '2px solid #0f0';
  recapBtn.style.borderRadius = '6px';
  recapBtn.style.cursor = 'pointer';
  recapBtn.onclick = requestQuestRecap;
  questRow.appendChild(recapBtn);

  container.appendChild(questRow);

  // Original DM-style toggle logic for both modes
  dmBtn.onclick = () => {
    currentChatMode = 'dm';
    textarea.value = DEFAULT_DM_PROMPT;
    dmBtn.classList.add('active');
    dmBtn.style.background = '#0f0';
    dmBtn.style.color = '#000';
    npcBtn.classList.remove('active');
    npcBtn.style.background = '#333';
    npcBtn.style.color = '#0f0';
    saveNpcBtn.style.display = 'none';
    // Toggle prompt area visibility
    if (textarea.style.display === 'none') {
      textarea.style.display = 'block';
    } else {
      textarea.style.display = 'none';
    }
  };

  npcBtn.onclick = () => {
    currentChatMode = 'npc';
    textarea.value = DEFAULT_NPC_PROMPT;
    npcBtn.classList.add('active');
    npcBtn.style.background = '#0f0';
    npcBtn.style.color = '#000';
    dmBtn.classList.remove('active');
    dmBtn.style.background = '#333';
    dmBtn.style.color = '#0f0';
    saveNpcBtn.style.display = 'none';
    // Toggle prompt area visibility
    if (textarea.style.display === 'none') {
      textarea.style.display = 'block';
    } else {
      textarea.style.display = 'none';
    }
  };

  // Initial state: hidden like original
  textarea.style.display = 'none';
  saveNpcBtn.style.display = 'none';

  const messages = document.createElement('div');
  messages.id = 'chatMessages';
  messages.style.background = '#000';
  messages.style.color = '#fff';
  container.appendChild(messages);

  // === "Enter Scene" and "Meet Character" buttons (grey background) ===
  const sceneButtonRow = document.createElement('div');
  sceneButtonRow.style.display = 'flex';
  sceneButtonRow.style.gap = '10px';
  sceneButtonRow.style.margin = '10px 0';
  sceneButtonRow.style.justifyContent = 'center';

  const enterSceneBtn = document.createElement('button');
  enterSceneBtn.textContent = 'Enter Scene';
  enterSceneBtn.style.flex = '1';
  enterSceneBtn.style.padding = '10px';
  enterSceneBtn.style.background = '#444';
  enterSceneBtn.style.color = '#0f0';
  enterSceneBtn.style.border = '2px solid #0f0';
  enterSceneBtn.style.borderRadius = '6px';
  enterSceneBtn.style.cursor = 'pointer';
  enterSceneBtn.style.fontWeight = 'bold';
  enterSceneBtn.onclick = () => {
    // Find the last DM message
    const chatDivs = document.querySelectorAll('#chatMessages > div');
    let lastDmText = '';
    for (let i = chatDivs.length - 1; i >= 0; i--) {
      const div = chatDivs[i];
      if (div.innerHTML.includes('<strong>DM:</strong>')) {
        lastDmText = div.textContent.replace(/^DM:\s*/, '').trim();
        break;
      }
    }

    if (!lastDmText) {
      alertStyled('No recent DM description found.');
      return;
    }
    const words = lastDmText.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const uniqueWords = [...new Set(words)].slice(0, 5);
    const keywords = uniqueWords.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    let summary = `Map of ${keywords}`;
    const sentences = lastDmText.trim().split(/(?<=\.)\s+/);
    const firstTwoSentences = sentences.slice(0, 2).join(' ').trim();
    if (firstTwoSentences) {
      summary = `Map of ${firstTwoSentences}`;
    }
    // Open Scene Generator panel
    const sceneGenBtn = document.getElementById('btnSceneGen');
    if (sceneGenBtn) sceneGenBtn.click();

    // Generate the scene
    setTimeout(() => {
      const sceneInput = document.getElementById('sceneInput');
      if (sceneInput) {
        sceneInput.value = summary;

        const originalGenerate = generateImage;
        generateImage = function(type) {
          if (type === 'scene') {
            originalGenerate(type);

            const checkInterval = setInterval(() => {
              const imgs = document.querySelectorAll('#sceneMessages img');
              if (imgs.length > 0) {
                const latestImg = imgs[imgs.length - 1];
                if (latestImg.src && latestImg.src.startsWith('data:image')) {
                  // Save to assets first (this mimics manual "Save as Scene")
                  saveGeneratedImage(latestImg.src, 'scene');

                  // Then trigger populateLeftBox so the new asset gets its click handler
                  populateLeftBox();

                  // Small delay to ensure the new icon exists, then click it to set as background
                  setTimeout(() => {
                    const newIcon = document.querySelector(`#sceneryRow img[src="${latestImg.src}"]`);
                    if (newIcon) newIcon.click();

                    // Automatically analyze the newly applied scene with vision AI
                    setTimeout(analyzeSceneWithVision, 1000);
                  }, 200);
      clearInterval(checkInterval);
      generateImage = originalGenerate;
                }
              }
            }, 500);

            setTimeout(() => {
              clearInterval(checkInterval);
              generateImage = originalGenerate;
            }, 15000);
          } else {
            originalGenerate(type);
          }
        };

        generateImage('scene');
      }
    }, 400);
  };

  const meetCharacterBtn = document.createElement('button');
  meetCharacterBtn.textContent = 'Meet Character';
  meetCharacterBtn.style.flex = '1';
  meetCharacterBtn.style.padding = '10px';
  meetCharacterBtn.style.background = '#444';
  meetCharacterBtn.style.color = '#0f0';
  meetCharacterBtn.style.border = '2px solid #0f0';
  meetCharacterBtn.style.borderRadius = '6px';
  meetCharacterBtn.style.cursor = 'pointer';
  meetCharacterBtn.style.fontWeight = 'bold';
  meetCharacterBtn.onclick = () => {
    // Find the last DM message
    const chatDivs = document.querySelectorAll('#chatMessages > div');
    let lastDmText = '';
    for (let i = chatDivs.length - 1; i >= 0; i--) {
      const div = chatDivs[i];
      if (div.innerHTML.includes('<strong>DM:</strong>')) {
        lastDmText = div.textContent.replace(/^DM:\s*/, '').trim();
        break;
      }
    }

    if (!lastDmText) {
      alertStyled('No recent DM message found.');
      return;
    }

    // Extract character description
    let charPrompt = lastDmText;
    const npcMatch = lastDmText.match(/(?:A|An|The)\s+([A-Z][\w\s\-]+?)(?:,|\.|:|;|\s+named|\s+called|\s+who|\s+is\s+a|\s+a|\s+an|\s+wearing|\s+with|\s+stands|\s+approaches)/i);
    if (npcMatch) {
      const after = lastDmText.split(npcMatch[0])[1] || '';
      charPrompt = npcMatch[1].trim() + ' ' + after.split('.')[0].trim();
    } else {
      charPrompt = lastDmText.split('.').slice(0, 2).join('.').trim();
    }
    if (!charPrompt.endsWith('.')) charPrompt += '.';

    // Open Character Generator panel
    const charGenBtn = document.getElementById('btnCharacterGen');
    if (charGenBtn) charGenBtn.click();

    // Generate and auto-save
    setTimeout(() => {
      const charInput = document.getElementById('characterInput');
      if (charInput) {
        charInput.value = charPrompt;

        const originalGenerate = generateImage;
        generateImage = function(type) {
          if (type === 'character') {
            originalGenerate(type);
            const checkInterval = setInterval(() => {
              const imgs = document.querySelectorAll('#characterMessages img');
              if (imgs.length > 0) {
                const latestImg = imgs[imgs.length - 1];
                if (latestImg.src && latestImg.src.startsWith('data:image')) {
                  saveGeneratedImage(latestImg.src, 'character');
                  clearInterval(checkInterval);
                  generateImage = originalGenerate;
                }
              }
            }, 500);
            setTimeout(() => {
              clearInterval(checkInterval);
              generateImage = originalGenerate;
            }, 15000);
          } else {
            originalGenerate(type);
          }
        };

        generateImage('character');
      }
    }, 400);
  };

  sceneButtonRow.appendChild(enterSceneBtn);
  sceneButtonRow.appendChild(meetCharacterBtn);
  container.appendChild(sceneButtonRow);

  const inputArea = document.createElement('div');
  inputArea.id = 'chatInputArea';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'chatInput';
  input.placeholder = 'Ask Venice AI...';

  const send = document.createElement('button');
  send.id = 'chatSend';
  send.textContent = 'Send';

  inputArea.appendChild(input);
  inputArea.appendChild(send);
  container.appendChild(inputArea);

  rightPanel.appendChild(container);

  send.onclick = sendChatMessage;
  input.onkeypress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendChatMessage();
    }
  };
  input.focus();
}

async function summarizeQuest() {
  if (chatHistory.length === 0) {
    alertStyled('No chat history to summarize yet.');
    return;
  }

  const transcript = chatHistory
    .map(m => `${m.role === 'user' ? 'Player' : 'DM'}: ${m.content}`)
    .join('\n\n');

  const summaryPrompt = `You are a concise chronicler. Summarize the following D&D session transcript into 5–8 bullet points listing only major plot developments that have actually occurred. Do not speculate. Use past tense.\n\nTranscript:\n${transcript}`;

  const messages = [{ role: 'system', content: summaryPrompt }];

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    const data = await res.json();
    const summary = data.choices[0].message.content.trim();

    const timestamp = new Date().toLocaleString();
    questLog += `\n\n--- Session Summary ${timestamp} ---\n${summary}`;

    localStorage.setItem(QUEST_LOG_KEY, questLog);
    alertStyled('Quest log updated!');
  } catch (err) {
    alertStyled('Summarization failed.');
    console.error(err);
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;

  addChatMessage('user', message);
  input.value = '';

  let messages = [];

  // Primary roleplay prompt (DM or NPC mode)
  const mainPrompt = document.getElementById('systemPrompt').value.trim() || 
    (currentChatMode === 'npc' ? DEFAULT_NPC_PROMPT : DEFAULT_DM_PROMPT);
  messages.push({ role: 'system', content: mainPrompt });

  // Always inject Quest Log if non-empty
  if (questLog.trim()) {
    messages.push({
      role: 'system',
      content: `=== QUEST HISTORY SO FAR ===\n${questLog.trim()}\n=== END QUEST HISTORY ===\nUse this information to maintain perfect narrative continuity and reference past events naturally when relevant. Never reveal future plot points.`
    });
  }

  // Always inject DM Secrets if non-empty
  if (dmSecrets.trim()) {
    messages.push({
      role: 'system',
      content: `=== DM SECRETS (DO NOT REVEAL TO PLAYERS UNDER ANY CIRCUMSTANCES) ===\n${dmSecrets.trim()}\n=== END DM SECRETS ===\nAdvance the plot according to these hidden truths without ever spoiling them to the players.`
    });
  }

  messages.push(...chatHistory, { role: 'user', content: message });

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });

    if (!res.ok) {
      throw new Error(`Server error: ${res.status}`);
    }

    const data = await res.json();
    const reply = data.choices[0].message.content.trim();

    addChatMessage('assistant', reply);
    chatHistory.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
  } catch (err) {
    console.error('Chat error:', err);
    addChatMessage('assistant', 'Error: No response from AI. Check console (F12).');
  }
}
function analyzeSceneWithVision() {
  const base64DataUrl = canvas.toDataURL('image/png');
  const base64 = base64DataUrl.split(',')[1];

  const visionMessages = [
    {
      role: "system",
      content: "This is a Dungeons & Dragons map. Summarize the image focusing on paths, doors, buildings, and objects that characters can interact with. Provide a concise but detailed description of the visible environment suitable for a Dungeon Master to reference during play. Include atmosphere, terrain, notable landmarks, and interactive elements. Limit to 2-3 paragraphs."
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Describe this pixel-art RPG scene in detail, emphasizing interactive elements for use as a Dungeon Master reference of the current location."
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${base64}`
          }
        }
      ]
    }
  ];

  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'mistral-31-24b',
      messages: visionMessages,
      temperature: 0.7,
      max_tokens: 1024
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const description = data.choices[0].message.content.trim();

      const now = new Date();
      const timestamp = now.toLocaleString();

      questLog += `\n\n--- Scene Description Generated ${timestamp} ---\n${description}`;

      localStorage.setItem(QUEST_LOG_KEY, questLog);

      alertStyled('Scene analyzed and description added to Quest Log!');
    }
  })
  .catch(err => {
    console.error('Vision analysis failed:', err);
    alertStyled('Failed to analyze scene. Check console.');
  });
}
function requestQuestRecap() {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(0,0,0,0.85)';
  overlay.style.zIndex = '100';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';

  const modal = document.createElement('div');
  modal.style.background = 'rgba(0,0,0,0.9)';
  modal.style.border = '2px solid #0f0';
  modal.style.borderRadius = '12px';
  modal.style.padding = '20px';
  modal.style.width = '90%';
  modal.style.maxWidth = '600px';
  modal.style.maxHeight = '80vh';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.boxShadow = '0 0 20px rgba(0,255,0,0.5)';
  modal.style.fontFamily = "'Courier New', monospace";
  modal.style.color = '#0f0';

  const title = document.createElement('h3');
  title.textContent = 'Quest Log';
  title.style.margin = '0 0 15px 0';
  title.style.textAlign = 'center';
  modal.appendChild(title);

  const textarea = document.createElement('textarea');
  textarea.value = questLog;
  textarea.placeholder = 'Start typing your quest log here...';
  textarea.style.width = '100%';
  textarea.style.height = '50vh';
  textarea.style.minHeight = '200px';
  textarea.style.background = '#111';
  textarea.style.color = '#0f0';
  textarea.style.border = '1px solid #0f0';
  textarea.style.borderRadius = '6px';
  textarea.style.padding = '10px';
  textarea.style.resize = 'vertical';
  textarea.style.fontSize = '14px';
  textarea.style.boxSizing = 'border-box';
  modal.appendChild(textarea);

  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '15px';
  btnRow.style.justifyContent = 'center';
  btnRow.style.marginTop = '20px';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save & Close';
  saveBtn.style.padding = '10px 24px';
  saveBtn.style.background = '#080';
  saveBtn.style.color = '#0f0';
  saveBtn.style.border = '2px solid #0f0';
  saveBtn.style.borderRadius = '8px';
  saveBtn.style.cursor = 'pointer';
  saveBtn.style.fontWeight = 'bold';
  saveBtn.onclick = () => {
    questLog = textarea.value;
    localStorage.setItem(QUEST_LOG_KEY, questLog);
    document.body.removeChild(overlay);
    alertStyled('Quest log saved.');
  };

  const secretsBtn = document.createElement('button');
  secretsBtn.textContent = 'DM Secrets';
  secretsBtn.style.padding = '10px 24px';
  secretsBtn.style.background = '#004';
  secretsBtn.style.color = '#0f0';
  secretsBtn.style.border = '2px solid #0f0';
  secretsBtn.style.borderRadius = '8px';
  secretsBtn.style.cursor = 'pointer';
  secretsBtn.style.fontWeight = 'bold';
  secretsBtn.onclick = () => {
    const secretsOverlay = document.createElement('div');
    secretsOverlay.style.position = 'fixed';
    secretsOverlay.style.top = '0';
    secretsOverlay.style.left = '0';
    secretsOverlay.style.width = '100vw';
    secretsOverlay.style.height = '100vh';
    secretsOverlay.style.background = 'rgba(0,0,0,0.85)';
    secretsOverlay.style.zIndex = '101';
    secretsOverlay.style.display = 'flex';
    secretsOverlay.style.alignItems = 'center';
    secretsOverlay.style.justifyContent = 'center';

    const secretsModal = document.createElement('div');
    secretsModal.style.background = 'rgba(0,0,0,0.9)';
    secretsModal.style.border = '2px solid #0f0';
    secretsModal.style.borderRadius = '12px';
    secretsModal.style.padding = '20px';
    secretsModal.style.width = '90%';
    secretsModal.style.maxWidth = '600px';
    secretsModal.style.maxHeight = '80vh';
    secretsModal.style.display = 'flex';
    secretsModal.style.flexDirection = 'column';
    secretsModal.style.boxShadow = '0 0 20px rgba(0,255,0,0.5)';
    secretsModal.style.fontFamily = "'Courier New', monospace";
    secretsModal.style.color = '#0f0';

    const secretsTitle = document.createElement('h3');
    secretsTitle.textContent = 'DM Secrets';
    secretsTitle.style.margin = '0 0 15px 0';
    secretsTitle.style.textAlign = 'center';
    secretsModal.appendChild(secretsTitle);

    const secretsTextarea = document.createElement('textarea');
    secretsTextarea.value = dmSecrets;
    secretsTextarea.placeholder = 'Enter hidden plot lines the DM knows but players do not...';
    secretsTextarea.style.width = '100%';
    secretsTextarea.style.height = '50vh';
    secretsTextarea.style.minHeight = '200px';
    secretsTextarea.style.background = '#111';
    secretsTextarea.style.color = '#0f0';
    secretsTextarea.style.border = '1px solid #0f0';
    secretsTextarea.style.borderRadius = '6px';
    secretsTextarea.style.padding = '10px';
    secretsTextarea.style.resize = 'vertical';
    secretsTextarea.style.fontSize = '14px';
    secretsTextarea.style.boxSizing = 'border-box';
    secretsModal.appendChild(secretsTextarea);

    const secretsBtnRow = document.createElement('div');
    secretsBtnRow.style.display = 'flex';
    secretsBtnRow.style.gap = '15px';
    secretsBtnRow.style.justifyContent = 'center';
    secretsBtnRow.style.marginTop = '20px';

    const secretsSaveBtn = document.createElement('button');
    secretsSaveBtn.textContent = 'Save & Close';
    secretsSaveBtn.style.padding = '10px 24px';
    secretsSaveBtn.style.background = '#080';
    secretsSaveBtn.style.color = '#0f0';
    secretsSaveBtn.style.border = '2px solid #0f0';
    secretsSaveBtn.style.borderRadius = '8px';
    secretsSaveBtn.style.cursor = 'pointer';
    secretsSaveBtn.style.fontWeight = 'bold';
    secretsSaveBtn.onclick = () => {
      dmSecrets = secretsTextarea.value;
      localStorage.setItem('dndGridDmSecrets', dmSecrets);
      document.body.removeChild(secretsOverlay);
      alertStyled('DM Secrets saved.');
    };

    const secretsCancelBtn = document.createElement('button');
    secretsCancelBtn.textContent = 'Cancel';
    secretsCancelBtn.style.padding = '10px 24px';
    secretsCancelBtn.style.background = '#800';
    secretsCancelBtn.style.color = '#0f0';
    secretsCancelBtn.style.border = '2px solid #f00';
    secretsCancelBtn.style.borderRadius = '8px';
    secretsCancelBtn.style.cursor = 'pointer';
    secretsCancelBtn.style.fontWeight = 'bold';
    secretsCancelBtn.onclick = () => {
      document.body.removeChild(secretsOverlay);
    };

    secretsBtnRow.appendChild(secretsSaveBtn);
    secretsBtnRow.appendChild(secretsCancelBtn);
    secretsModal.appendChild(secretsBtnRow);

    secretsOverlay.appendChild(secretsModal);
    document.body.appendChild(secretsOverlay);
    secretsTextarea.focus();
  };

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.padding = '10px 24px';
  cancelBtn.style.background = '#800';
  cancelBtn.style.color = '#0f0';
  cancelBtn.style.border = '2px solid #f00';
  cancelBtn.style.borderRadius = '8px';
  cancelBtn.style.cursor = 'pointer';
  cancelBtn.style.fontWeight = 'bold';
  cancelBtn.onclick = () => {
    document.body.removeChild(overlay);
  };

  btnRow.appendChild(saveBtn);
  btnRow.appendChild(secretsBtn);
  btnRow.appendChild(cancelBtn);
  modal.appendChild(btnRow);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  textarea.focus();
}

function addChatMessage(role, content) {
  const div = document.getElementById('chatMessages');
  const msg = document.createElement('div');
  msg.className = role;
  msg.innerHTML = `<strong>${role === 'user' ? 'You' : 'DM'}:</strong> ${content.replace(/\n/g, '<br>')}`;
  div.appendChild(msg);
}

function createCharacterGenPanel() {
  const panel = document.getElementById('characterGenPanel');
  panel.innerHTML = '';

  const container = document.createElement('div');
  container.id = 'characterGenContainer';

  const title = document.createElement('h4');
  title.textContent = 'Generate Character';
  container.appendChild(title);

  const uploadBtn = document.createElement('button');
  uploadBtn.textContent = 'Upload Character';
  uploadBtn.style.width = '100%';
  uploadBtn.style.margin = '10px 0';
  uploadBtn.onclick = () => document.getElementById('characterFileUpload').click();
  container.appendChild(uploadBtn);

  const promptToggle = document.createElement('button');
  promptToggle.textContent = 'Character Prompt ▼';
  promptToggle.onclick = () => {
    const area = document.getElementById('characterPromptArea');
    area.style.display = area.style.display === 'none' ? 'block' : 'none';
    promptToggle.textContent = area.style.display === 'none' ? 'Character Prompt ▼' : 'Character Prompt ▲';
  };
  container.appendChild(promptToggle);

  const promptArea = document.createElement('div');
  promptArea.id = 'characterPromptArea';
  promptArea.style.display = 'none';

  const textarea = document.createElement('textarea');
  textarea.id = 'characterSystemPrompt';
  textarea.placeholder = 'Style instructions for characters...';
  textarea.value = `You are a pixel art master specializing in 16-bit retro RPG full body character shots. All character requests must be rendered as full body views. Do not provide headshots, do not provide facial closeups, only full body portraits. Highly detailed and unique, with a full frontal perspective. Focus on creating expressive, intricate designs with sharp pixel-perfect lines, vibrant colors, and dithering for shading, using a limited color palette true to the 16-bit style.`;
  promptArea.appendChild(textarea);
  container.appendChild(promptArea);

  const messages = document.createElement('div');
  messages.id = 'characterMessages';
  container.appendChild(messages);

  const inputArea = document.createElement('div');
  inputArea.id = 'characterInputArea';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'characterInput';
  input.placeholder = 'Describe a character (e.g., elf ranger, dwarf cleric)...';

  const send = document.createElement('button');
  send.id = 'characterSend';
  send.textContent = 'Generate';

  inputArea.appendChild(input);
  inputArea.appendChild(send);
  container.appendChild(inputArea);

  panel.appendChild(container);

  send.onclick = () => generateImage('character');
  input.onkeypress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      generateImage('character');
    }
  };
}

function createSceneGenPanel() {
  const panel = document.getElementById('sceneGenPanel');
  panel.innerHTML = '';

  const container = document.createElement('div');
  container.id = 'sceneGenContainer';

  const title = document.createElement('h4');
  title.textContent = 'Generate Scene / Map';
  container.appendChild(title);

  const uploadBtn = document.createElement('button');
  uploadBtn.textContent = 'Upload Scene / Map Image';
  uploadBtn.style.width = '100%';
  uploadBtn.style.margin = '10px 0';
  uploadBtn.onclick = () => document.getElementById('sceneFileUpload').click();
  container.appendChild(uploadBtn);

  const promptToggle = document.createElement('button');
  promptToggle.textContent = 'Scene Prompt ▼';
  promptToggle.onclick = () => {
    const area = document.getElementById('scenePromptArea');
    area.style.display = area.style.display === 'none' ? 'block' : 'none';
    promptToggle.textContent = area.style.display === 'none' ? 'Scene Prompt ▼' : 'Scene Prompt ▲';
  };
  container.appendChild(promptToggle);

  const promptArea = document.createElement('div');
  promptArea.id = 'scenePromptArea';
  promptArea.style.display = 'none';

  const textarea = document.createElement('textarea');
  textarea.id = 'sceneSystemPrompt';
  textarea.placeholder = 'Style instructions for scenes...';
  textarea.value = `You are a pixel art master specializing in classic RPG Maker VX Ace-style 16-bit retro top-down RPG maps and interiors. All scenes must use a strict 45-degree isometric (diamond-tile) perspective, exactly like RPG Maker VX Ace default tilesets or classic 16-bit SNES RPGs (e.g., Chrono Trigger outdoor views). The viewer looks down from above at a 45-degree angle—no pure flat top-down, no side views, no 3/4 views, no modern 3D tilt. Key style rules: - Tile-based: Everything aligns to an invisible diamond grid. - Palette: Limited 16-bit colors—vibrant greens for grass/trees, earthy browns for dirt paths/wooden buildings, grays for stone, warm oranges for torchlight. - Shading: Heavy use of dithering and pillow shading for depth and texture. - Outdoor villages: Wooden log houses with steep roofs, vegetable gardens, wooden fences, wells, clotheslines, scattered flowers/rocks, dense pine forests surrounding, winding dirt paths. - Buildings: Always remove roofs/tops to reveal fully detailed interiors (furniture, walls, floors visible from above). - Interiors (castles/dungeons): Stone brick walls/floors, red carpets, wall torches with glowing flames, statues/armor stands, banners, potted plants, ornate doors/stairs, magical runes on floors. - Scale: Larger expansive maps with room for character movement and exploration. - Details: Add small props like barrels, signs, smoke from chimneys, hanging laundry. Generate highly detailed, tile-perfect pixel art that could be directly used as an RPG Maker map.`;
  promptArea.appendChild(textarea);
  container.appendChild(promptArea);

  const messages = document.createElement('div');
  messages.id = 'sceneMessages';
  container.appendChild(messages);

  const inputArea = document.createElement('div');
  inputArea.id = 'sceneInputArea';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'sceneInput';
  input.placeholder = 'Describe a scene (e.g., forest tavern, dungeon room, city square)...';

  const send = document.createElement('button');
  send.id = 'sceneSend';
  send.textContent = 'Generate';

  inputArea.appendChild(input);
  inputArea.appendChild(send);
  container.appendChild(inputArea);

  panel.appendChild(container);

  send.onclick = () => generateImage('scene');
  input.onkeypress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      generateImage('scene');
    }
  };
}

async function generateImage(type) {
  const inputId = type === 'character' ? 'characterInput' : 'sceneInput';
  const messagesId = type === 'character' ? 'characterMessages' : 'sceneMessages';
  const promptId = type === 'character' ? 'characterSystemPrompt' : 'sceneSystemPrompt';
  const input = document.getElementById(inputId);
  const userPrompt = input.value.trim();
  if (!userPrompt) return;
  const messagesDiv = document.getElementById(messagesId);
  const userMsg = document.createElement('div');
  userMsg.textContent = 'Prompt: ' + userPrompt;
  userMsg.style.alignSelf = 'flex-end';
  userMsg.style.background = '#333';
  userMsg.style.padding = '8px';
  userMsg.style.borderRadius = '8px';
  userMsg.style.marginBottom = '10px';
  messagesDiv.appendChild(userMsg);
  const loading = document.createElement('div');
  loading.textContent = 'Generating pixel art...';
  loading.style.color = '#ff0';
  loading.style.fontStyle = 'italic';
  messagesDiv.appendChild(loading);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  input.value = '';
  const systemPrompt = document.getElementById(promptId).value.trim();

  let fullPrompt;
  if (type === 'character') {
    // Characters: full system prompt is safe (shorter)
    fullPrompt = userPrompt + (systemPrompt ? ", " + systemPrompt : "");
  } else {
    // Scenes: use concise, high-impact style instructions to stay under API prompt limit (proven working)
    const conciseSceneStyle = "pixel art, classic RPG Maker VX Ace style, strict 45-degree isometric diamond-tile top-down view, 16-bit SNES RPG aesthetic like Chrono Trigger, limited palette, heavy dithering and pillow shading, tile-based alignment, buildings with roofs removed to show detailed interiors, expansive maps suitable for character exploration";
    fullPrompt = userPrompt + ", " + conciseSceneStyle;
  }
  try {
    // Generate appropriately sized images using your existing model (venice-sd35 via proxy)
    // Characters: moderate square size for detailed sprites
    // Scenes: significantly larger landscape for expansive maps
    const generationParams = {
      prompt: fullPrompt,
      return_binary: true
    };

    if (type === 'character') {
      generationParams.width = 768;
      generationParams.height = 768;
    } else { // scene — much larger as requested
      generationParams.width = 2048;
      generationParams.height = 1344;
    }

    const res = await fetch('/api/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generationParams)
    });
    const data = await res.json();
    messagesDiv.removeChild(loading);
    const imgContainer = document.createElement('div');
    imgContainer.style.textAlign = 'center';
    imgContainer.style.margin = '15px 0';
    const img = document.createElement('img');
    img.src = 'data:image/png;base64,' + data.images[0];
    img.alt = 'Generated: ' + userPrompt;
    img.style.maxWidth = '100%';
    img.style.borderRadius = '8px';
    img.style.border = '2px solid #0f0';
    imgContainer.appendChild(img);
    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-single-btn';
    saveBtn.textContent = type === 'character' ? 'Save as Character' : 'Save as Scene';
    saveBtn.onclick = () => saveGeneratedImage(img.src, type);
    imgContainer.appendChild(saveBtn);
    messagesDiv.appendChild(imgContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  } catch (err) {
    console.error(err);
    messagesDiv.removeChild(loading);
    const error = document.createElement('div');
    error.textContent = 'Generation failed. Check console.';
    error.style.color = '#f00';
    messagesDiv.appendChild(error);
  }
}
function saveGeneratedImage(imageUrl, type) {
  // Extract pure base64 (remove data:image/png;base64, prefix if present)
  const base64 = imageUrl.replace(/^data:image\/[a-z]+;base64,/, '');
  const fullDataUrl = 'data:image/png;base64,' + base64;

  const targetArray = type === 'character' ? characterAssets : sceneAssets;
  const saveFunc = type === 'character' ? saveCharacterAssets : saveSceneAssets;

  // Check if this exact base64 already exists
  const alreadyExists = targetArray.some(url => url.replace(/^data:image\/[a-z]+;base64,/, '') === base64);

  if (alreadyExists) {
    alertStyled('Already saved.');
    return;
  }

  try {
    targetArray.push(fullDataUrl);
    saveFunc();
    populateLeftBox();
    alertStyled(`Saved as ${type === 'character' ? 'Character' : 'Scene'} asset!`);
  } catch (err) {
    console.error('Failed to save asset:', err);
    // Remove the pushed item if save failed
    targetArray.pop();
    alertStyled('Save failed: Storage full or error. Clear some assets and try again.');
  }
}
function setupSidebar() {
  const map = {
    btnCharacterGen: 'characterGenPanel',
    btnSceneGen: 'sceneGenPanel',
    btnAssets: 'assetsPanel',
    btnDice: 'dicePanel',
    btnSave: 'savePanelContainer'
  };

  Object.keys(map).forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.onclick = () => {
        selectedUnit = null;
        hideCharacterDetailsPanel();
        draw();
        btn.classList.add('flash');
        setTimeout(() => btn.classList.remove('flash'), 300);

        const targetId = map[id];
        const target = document.getElementById(targetId);
        if (target && target.classList.contains('active')) {
          target.classList.remove('active');
          btn.classList.remove('active');
          // Restore chat visibility when closing panel
          const rightPanel = document.getElementById('rightPanel');
          if (rightPanel) {
            rightPanel.style.opacity = '1';
            rightPanel.style.pointerEvents = 'auto';
          }
        } else {
          hideAllPanels();
          Object.keys(map).forEach(otherId => {
            const otherBtn = document.getElementById(otherId);
            if (otherBtn) otherBtn.classList.remove('active');
          });
          if (target) {
            target.classList.add('active');
            btn.classList.add('active');
            if (targetId === 'dicePanel') {
              createDiceRoller();
            } else if (targetId === 'savePanelContainer') {
              createSavePanel();
            }
            // Fade chat when opening panel
            fadeChatPanel();
          }
        }
      };
    }
  });
}

document.getElementById('characterFileUpload').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    addCharacterWithSize(event.target.result, 1);
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

window.onload = () => {
  createDiceRoller();
  createChatBox();
  createCharacterGenPanel();
  createSceneGenPanel();
  createSavePanel();
  setupSidebar();
  setupSceneUpload();
  loadSaves();
  loadCharacterAssets();
  loadSceneAssets();
  loadNpcPrompts();
  loadCharacterSheets();
  populateLeftBox();
  resizeCanvas();
};

function confirmStyled(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.85)';
    overlay.style.zIndex = '100';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const modal = document.createElement('div');
    modal.style.background = 'rgba(0,0,0,0.9)';
    modal.style.border = '2px solid #0f0';
    modal.style.borderRadius = '12px';
    modal.style.padding = '20px';
    modal.style.width = '80%';
    modal.style.maxWidth = '400px';
    modal.style.textAlign = 'center';
    modal.style.boxShadow = '0 0 20px rgba(0,255,0,0.5)';
    modal.style.fontFamily = "'Courier New', monospace";
    modal.style.color = '#0f0';

    const text = document.createElement('p');
    text.textContent = message;
    text.style.margin = '0 0 20px 0';
    text.style.fontSize = '16px';
    modal.appendChild(text);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '20px';
    btnRow.style.justifyContent = 'center';

    const yesBtn = document.createElement('button');
    yesBtn.textContent = 'Yes';
    yesBtn.style.padding = '10px 24px';
    yesBtn.style.background = '#080';
    yesBtn.style.color = '#0f0';
    yesBtn.style.border = '2px solid #0f0';
    yesBtn.style.borderRadius = '8px';
    yesBtn.style.cursor = 'pointer';
    yesBtn.style.fontWeight = 'bold';
    yesBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve(true);
    };

    const noBtn = document.createElement('button');
    noBtn.textContent = 'No';
    noBtn.style.padding = '10px 24px';
    noBtn.style.background = '#800';
    noBtn.style.color = '#0f0';
    noBtn.style.border = '2px solid #f00';
    noBtn.style.borderRadius = '8px';
    noBtn.style.cursor = 'pointer';
    noBtn.style.fontWeight = 'bold';
    noBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve(false);
    };

    btnRow.appendChild(yesBtn);
    btnRow.appendChild(noBtn);
    modal.appendChild(btnRow);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

function alertStyled(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.85)';
    overlay.style.zIndex = '100';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const modal = document.createElement('div');
    modal.style.background = 'rgba(0,0,0,0.9)';
    modal.style.border = '2px solid #0f0';
    modal.style.borderRadius = '12px';
    modal.style.padding = '20px';
    modal.style.width = '80%';
    modal.style.maxWidth = '400px';
    modal.style.textAlign = 'center';
    modal.style.boxShadow = '0 0 20px rgba(0,255,0,0.5)';
    modal.style.fontFamily = "'Courier New', monospace";
    modal.style.color = '#0f0';

    const text = document.createElement('p');
    text.textContent = message;
    text.style.margin = '0 0 20px 0';
    text.style.fontSize = '16px';
    modal.appendChild(text);

    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.padding = '10px 30px';
    okBtn.style.background = '#080';
    okBtn.style.color = '#0f0';
    okBtn.style.border = '2px solid #0f0';
    okBtn.style.borderRadius = '8px';
    okBtn.style.cursor = 'pointer';
    okBtn.style.fontWeight = 'bold';
    okBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve();
    };

    modal.appendChild(okBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

function promptStyled(message, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.85)';
    overlay.style.zIndex = '100';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const modal = document.createElement('div');
    modal.style.background = 'rgba(0,0,0,0.9)';
    modal.style.border = '2px solid #0f0';
    modal.style.borderRadius = '12px';
    modal.style.padding = '20px';
    modal.style.width = '80%';
    modal.style.maxWidth = '400px';
    modal.style.textAlign = 'center';
    modal.style.boxShadow = '0 0 20px rgba(0,255,0,0.5)';
    modal.style.fontFamily = "'Courier New', monospace";
    modal.style.color = '#0f0';

    const text = document.createElement('p');
    text.textContent = message;
    text.style.margin = '0 0 15px 0';
    text.style.fontSize = '16px';
    modal.appendChild(text);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultValue;
    input.style.width = '90%';
    input.style.padding = '10px';
    input.style.marginBottom = '20px';
    input.style.background = '#222';
    input.style.color = '#0f0';
    input.style.border = '2px solid #0f0';
    input.style.borderRadius = '8px';
    input.style.fontSize = '16px';
    modal.appendChild(input);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '20px';
    btnRow.style.justifyContent = 'center';

    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.padding = '10px 24px';
    okBtn.style.background = '#080';
    okBtn.style.color = '#0f0';
    okBtn.style.border = '2px solid #0f0';
    okBtn.style.borderRadius = '8px';
    okBtn.style.cursor = 'pointer';
    okBtn.style.fontWeight = 'bold';
    okBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve(input.value);
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.padding = '10px 24px';
    cancelBtn.style.background = '#800';
    cancelBtn.style.color = '#0f0';
    cancelBtn.style.border = '2px solid #f00';
    cancelBtn.style.borderRadius = '8px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.fontWeight = 'bold';
    cancelBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve(null);
    };

    btnRow.appendChild(okBtn);
    btnRow.appendChild(cancelBtn);
    modal.appendChild(btnRow);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    input.focus();
    input.select();
  });
}
function startQuestGeneration() {
  // Save original prompt
  const textarea = document.getElementById('systemPrompt');
  const originalPrompt = textarea.value;

  // Prompt that asks all 3 questions in one message and generates the full campaign in chat
  const questGenerationPrompt = `IDENTITY & PURPOSE
You are an expert Dungeon Master and campaign architect specializing in Dungeons & Dragons 4th Edition. Hard line breaks for clean formatting, 2 paragraphs max per visible response. Visible responses all must be succinct. You serve as both a creative storyteller and a tactical encounter designer. Your function is to guide the user through the complete creation of playable, three-act adventure campaigns that are narratively compelling, mechanically balanced, and immediately usable at the table.
You will generate all content a Dungeon Master needs to run the campaign: boxed read-aloud text, DM-only notes, stat blocks, skill challenge frameworks, tactical maps descriptions, NPC motivations, treasure parcels, and dramatic story beats.
EXTERNAL DOCUMENT REFERENCES
Before generating any campaign content, you must check for and integrate information from the following supplementary system prompts if they exist in your context:
QUEST LOG (If Available)
Contains ongoing plot threads, unresolved hooks, and previously established world details
Identify opportunities to resolve dangling plot threads or advance existing storylines
Note any recurring NPCs, factions, or locations that could appear
PHASE 1: INFORMATION GATHERING
The user will answer all three questions in one reply.
Ask al
l three questions in a single message:
1. How many player characters are in the party, and what is their average level?
2. Briefly describe the party members (class, race, key backstory elements).
3. What tone do you prefer? Options: Heroic, Gritty, Comedic, Horror, Intrigue.
After receiving the user's single reply with all three answers, immediately generate the full detailed campaign using this exact format:
═══════════════════════════════════════════
[CAMPAIGN TITLE]
A Three-Act Adventure for [X] Characters of Level [Y]
Tone: [Selected Tone]
═══════════════════════════════════════════
CAMPAIGN OVERVIEW
[One-paragraph summary]
CAMPAIGN INTEGRATION NOTES
[Connections to Quest Log and DM Secrets if applicable]
───────────────────────────────────────────
ACT I: THE CALL TO ADVENTURE
───────────────────────────────────────────
HOOK: [Title] Type: [Threat/Reward]
[READ-ALOUD TEXT — 2-3 paragraphs]
DM NOTES:
- Quest-giver NPC: [Name, description, secret motivation]
- True nature: [What's really going on]
- Immediate stakes: [What happens if party refuses]
OBSTACLE: [Name/Description] Type: [From table]
Why It Matters: [How this blocks the quest]
ENCOUNTER/CHALLENGE: [Combat or skill challenge details with 4E references]
POSSIBLE SOLUTIONS: [2-3 approaches]
CLUE 1: [Title]
Location/Source: [Where/who]
Discovery Method: [Skill check DC or trigger]
Information Gained: [What learned]
Advantage Provided: [Mechanical/narrative benefit]
[Repeat for CLUE 2 and CLUE 3]
───────────────────────────────────────────
ACT II: RISING ACTION
───────────────────────────────────────────
THE TURN: [Help/Betrayal]
[READ-ALOUD TEXT — revelation moment]
DM NOTES: [Full framework]
HENCHMEN ENCOUNTER: [Location Name]
[READ-ALOUD TEXT]
TACTICAL MAP DESCRIPTION: [Dimensions, terrain, features]
ENEMY FORCES: [Monster list with 4E source references]
XP BUDGET: [Total]
DIFFICULTY: [Easy/Standard/Hard]
TACTICS: [Enemy strategy]
TREASURE: [Parcels]
REVELATION: [What learned about final boss]
───────────────────────────────────────────
ACT III: CLIMAX AND RESOLUTION
───────────────────────────────────────────
FINAL ENCOUNTER: [Location Name]
ENEMY FORCES:
- [Boss Name] — [Level] Solo [Role] — [Source reference]
- [Supporting monsters if any]
TOTAL XP: [Budget]
TACTICAL SETUP: [Positions, surprise]
BOSS TACTICS:
Round 1: [Opening]
Ongoing: [Priorities]
When Bloodied: [Shift]
When Cornered: [Desperation]
TERRAIN POWERS: [Lair actions]
VICTORY CONDITIONS:
- Primary: [Defeat boss]
- Alternative: [Other win conditions]
IMMEDIATE AFTERMATH:
[READ-ALOUD TEXT — victory moment]
THREAT NEUTRALIZATION/REWARD DELIVERY:
[Full closure]
TREASURE PARCELS:
- Gold: [Amount]
- Magic Items: [Name, level, properties, source]
- Art/Gems: [Description]
- Story Items: [Narrative items]
LOOSE THREADS:
- [Thread 1]
- [Thread 2]
- [Thread 3]
EPILOGUE PROMPTS:
[Questions for players]
═══════════════════════════════════════════
APPENDICES
═══════════════════════════════════════════
APPENDIX A: NPC ROSTER [Quick stats]
APPENDIX B: MONSTER STATISTICS [References]
APPENDIX C: TREASURE SUMMARY
APPENDIX D: MAPS AND LOCATIONS
APPENDIX E: HANDOUTS
Generate the complete campaign immediately after receiving the three answers. Do not add any extra text before or after the formatted campaign.`;

  textarea.value = questGenerationPrompt;

  // Force DM mode
  currentChatMode = 'dm';
  const dmBtn = document.getElementById('chatModeDM');
  const npcBtn = document.getElementById('chatModeNPC');
  if (dmBtn) {
    dmBtn.classList.add('active');
    dmBtn.style.background = '#0f0';
    dmBtn.style.color = '#000';
  }
  if (npcBtn) {
    npcBtn.classList.remove('active');
    npcBtn.style.background = '#333';
    npcBtn.style.color = '#0f0';
  }

  // Clear chat
  const chatMessages = document.getElementById('chatMessages');
  if (chatMessages) chatMessages.innerHTML = '';

  // Ask all 3 questions in one message
  addChatMessage('assistant', `Excellent. Let us craft your campaign.
Please answer these three questions in your next message:
1. How many player characters are in the party, and what is their average level?
2. Briefly describe the party members (class, race, key backstory elements).
3. What tone do you prefer? Options: Heroic, Gritty, Comedic, Horror, Intrigue.
I will generate the complete campaign. It takes a few minutes, so create your characters while you wait.`);

  // Proven capture hook
  const originalAddChatMessage = addChatMessage;
  addChatMessage = function(role, content) {
    originalAddChatMessage(role, content);
    if (role === 'assistant' && content.includes('═══════════════════════════════════════════') && content.includes('A Three-Act Adventure for')) {
      dmSecrets = content.trim();
      localStorage.setItem(DM_SECRETS_KEY, dmSecrets);

      // Clear the chat window after saving
      const chatMessages = document.getElementById('chatMessages');
      if (chatMessages) {
        chatMessages.innerHTML = '';
      }

      // Restore original function
      addChatMessage = originalAddChatMessage;

      // === ENFORCED RULE: Absolute 1-paragraph maximum for all future DM/NPC responses ===
      textarea.value = `Do not mention venice or AI. Your responses must be succinct and never exceed one single paragraph under any circumstances. Strictly roleplay as an expert Dungeon Master and rules lawyer for Dungeons & Dragons 4th Edition. Always reference the official 4th Edition System Reference Document (SRD) rules precisely. For any rules question, quote or paraphrase the exact rule from the SRD. Your job is to create compelling narratives and NPC characters while strictly following the game rules. All actions should be advancing the overall narrative which is specified by the user. Key SRD sections to prioritize: - Combat: Initiative, actions, bonus actions, reactions, attack rolls, damage, conditions (PHB Chapter 9) - Spellcasting: Spell slots, casting time, components, concentration, saving throws (PHB Chapter 10) - Ability Checks: Advantage/disadvantage, proficiency, DC setting - Classes/Races/Backgrounds: Use only SRD content (core races/classes only — no subclasses beyond SRD without user input) - Monsters: Use SRD stat blocks exactly - Magic Items: SRD only Never make up rules. If unsure, say "According to the SRD..." and provide the most accurate interpretation. For quick lookups, respond with the rule first, then explain in context.`;

      alertStyled('Full detailed campaign generated and saved to DM Secrets!');

      // === Automatically start the campaign with opening scene ===
      setTimeout(() => {
        const input = document.getElementById('chatInput');
        input.value = '[START ADVENTURE] Begin the game now with an immersive description of the opening scene from Act I using only currently visible information. Use present tense and vivid sensory details. Do not reveal any future plot.';
        sendChatMessage();
      }, 800);
    }
  };

      }