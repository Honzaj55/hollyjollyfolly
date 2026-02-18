window.addEventListener('DOMContentLoaded', () => {

    /* =========================
       ELEMENTS
       ========================= */
    const colordisplay = document.getElementById('colordisplay');
    const userguess = document.getElementById('userguess');
    const afterguessresult = document.getElementById('afterguessresult');
    const copyBtn = document.getElementById('copyguessgrade');
    const codleNumber = document.getElementById('codleNumber');
    const hexTitle = document.getElementById('hexTitle');
    const character = document.getElementById('character');
    const hoverEye = document.getElementById('hoverEye');
    setupEyeFollow();
    

    /* =========================
       STATE
       ========================= */

    const DAILY_START = new Date(2025, 11, 27); // Dec 27 2025 = #1
    let lastScore = null;
    let miniMode = false;   
    let randomMode = false;
    let currentHex = "";
    let miniHex = "";
    let randomUnlimited = 0;
    let randomGuessCount = 0;
    

    // Check if this is the random mode page
    const isRandomPage = window.location.pathname.includes('randommode.html');
    if (isRandomPage) {
        randomMode = true;
    }
    
    function seededRandom(seed) {
        let x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    // ... rest of your code stays exactly the same ...
    /* =========================
       SPRITES (UNCHANGED)
       ========================= */
    const idleFrames = ["sprites/idle/idle1.png","sprites/idle/idle2.png","sprites/idle/idle3.png","sprites/idle/idle3.png","sprites/idle/idle4.png"];
    const blinkFrames = ["sprites/blink/blink1.png","sprites/blink/blink2.png","sprites/blink/blink3.png","sprites/blink/blink4.png","sprites/blink/blink5.png"];
    const eyeHoverFrames = ["sprites/eyes/eye2.png","sprites/eyes/eye3.png","sprites/eyes/eye4.png","sprites/eyes/eye5.png","sprites/eyes/eye6.png","sprites/eyes/eye7.png","sprites/eyes/eye8.png"];
    const reactions = {
        thumb: {frames:Array.from({length:12},(_,i)=>`sprites/reactions/thumb${i+1}.png`), loopStart:8, loopEnd:11},
        ca2t: {frames:Array.from({length:15},(_,i)=>`sprites/reactions/ca2t${i+1}.png`), loopStart:11, loopEnd:14},
        cry: {frames:Array.from({length:16},(_,i)=>`sprites/reactions/cry${i+1}.png`), loopStart:11, loopEnd:15}
    };

    let frameIndex=0, animationTimer=null, eyeHoverTimer=null, blinkTimer=null;

    /* =========================
       DATE / CODLE NUMBER
       ========================= */
    function getCodleNumber(date = new Date()) {
        return Math.floor((date - DAILY_START) / 86400000);
    }

    /* =========================
       COLOR GENERATION
       ========================= */
    function generateDailyHex(dayNumber) {
        const letters = "0123456789ABCDEF";
        let mini = "";
        let full = "";

        if (miniMode) {
            // MINI MODE: Generate 3 random hex digits
            for (let i = 0; i < 3; i++) {
                const r = seededRandom(dayNumber * 100 + i * 17);
                const digit = letters[Math.floor(r * 16)];
                mini += digit;
            }
            // Expand to 6 digits (the "easy" version)
            full = mini[0] + mini[0] + mini[1] + mini[1] + mini[2] + mini[2];
            currentHex = full;
            miniHex = mini;
            return "#" + mini;
        } else {
            // NORMAL MODE: Generate full 6 random hex digits
            for (let i = 0; i < 6; i++) {
                const r = seededRandom(dayNumber * 1000 + i * 37);
                const digit = letters[Math.floor(r * 16)];
                full += digit;
            }
            currentHex = full;
            miniHex = full.slice(0, 3);  // First 3 digits as reference
            return "#" + full;
        }
    }
    function generateRandomHex() {
        const letters = "0123456789ABCDEF";
        let hex = "";
        for (let i = 0; i < 6; i++) {
            hex += letters[Math.floor(Math.random() * 16)];
        }
        currentHex = hex;
        setColor("#" + hex);
        randomGuessCount = 0;
        document.getElementById("guessStack").innerHTML = "";

    }

     function loadDaily() {
        const day = getCodleNumber();
        codleNumber.textContent = `#${day}`;
        const hex = generateDailyHex(day);
        setColor(hex);
        
        // Add visual indicator
        if (miniMode) {
            hexTitle.textContent = "HollyJollyFollyCodle (Mini)";
            document.getElementById("userguess").placeholder = "RGB";
        } else {
            hexTitle.textContent = "HollyJollyFollyCodle";
            document.getElementById("userguess").placeholder = "RRGGBB";
        }
    }

    function setColor(hex) {
        colordisplay.style.backgroundColor = hex;
    }

    function expandMini(hex) {
        hex = hex.replace("#","");
        return "#" + hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        
    }

    /* =========================
       INPUT SANITIZATION
       ========================= */
    userguess.addEventListener("input", () => {
        userguess.value = userguess.value
            .toUpperCase()
            .replace(/[^0-9A-F]/g, "")
            .slice(0, miniMode ? 3 : 6);
    });

    /* =========================
       CIEDE2000 COLOR SCIENCE
       ========================= */
    function rgbToXyz(r, g, b) {
        r = r / 255;
        g = g / 255;
        b = b / 255;

        r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
        g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
        b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

        const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
        const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
        const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;

        return { x: x * 100, y: y * 100, z: z * 100 };
    }

    function xyzToLab(x, y, z) {
        const refX = 95.047;
        const refY = 100.000;
        const refZ = 108.883;

        x = x / refX;
        y = y / refY;
        z = z / refZ;

        const f = (t) => t > 0.008856 ? Math.pow(t, 1/3) : (7.787 * t + 16/116);

        x = f(x);
        y = f(y);
        z = f(z);

        const l = (116 * y) - 16;
        const a = 500 * (x - y);
        const b = 200 * (y - z);

        return { l, a, b };
    }

    function ciede2000(lab1, lab2) {
        const deg2rad = (deg) => deg * (Math.PI / 180);

        const c1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
        const c2 = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b);
        const cAvg = (c1 + c2) / 2;

        const g = 0.5 * (1 - Math.sqrt(Math.pow(cAvg, 7) / (Math.pow(cAvg, 7) + Math.pow(25, 7))));

        const a1Prime = lab1.a * (1 + g);
        const a2Prime = lab2.a * (1 + g);

        const c1Prime = Math.sqrt(a1Prime * a1Prime + lab1.b * lab1.b);
        const c2Prime = Math.sqrt(a2Prime * a2Prime + lab2.b * lab2.b);

        const h1Prime = (Math.atan2(lab1.b, a1Prime) * 180 / Math.PI + 360) % 360;
        const h2Prime = (Math.atan2(lab2.b, a2Prime) * 180 / Math.PI + 360) % 360;

        const deltaLPrime = lab2.l - lab1.l;
        const deltaCPrime = c2Prime - c1Prime;

        let deltaHPrime;
        if (c1Prime * c2Prime === 0) {
            deltaHPrime = 0;
        } else if (Math.abs(h2Prime - h1Prime) <= 180) {
            deltaHPrime = h2Prime - h1Prime;
        } else if (h2Prime - h1Prime > 180) {
            deltaHPrime = h2Prime - h1Prime - 360;
        } else {
            deltaHPrime = h2Prime - h1Prime + 360;
        }

        const deltaHPrimeValue = 2 * Math.sqrt(c1Prime * c2Prime) * Math.sin(deg2rad(deltaHPrime / 2));

        const lAvgPrime = (lab1.l + lab2.l) / 2;
        const cAvgPrime = (c1Prime + c2Prime) / 2;

        let hAvgPrime;
        if (c1Prime * c2Prime === 0) {
            hAvgPrime = h1Prime + h2Prime;
        } else if (Math.abs(h1Prime - h2Prime) <= 180) {
            hAvgPrime = (h1Prime + h2Prime) / 2;
        } else if (h1Prime + h2Prime < 360) {
            hAvgPrime = (h1Prime + h2Prime + 360) / 2;
        } else {
            hAvgPrime = (h1Prime + h2Prime - 360) / 2;
        }

        const t = 1 - 0.17 * Math.cos(deg2rad(hAvgPrime - 30)) +
                    0.24 * Math.cos(deg2rad(2 * hAvgPrime)) +
                    0.32 * Math.cos(deg2rad(3 * hAvgPrime + 6)) -
                    0.20 * Math.cos(deg2rad(4 * hAvgPrime - 63));

        const deltaTheta = 30 * Math.exp(-Math.pow((hAvgPrime - 275) / 25, 2));

        const rC = 2 * Math.sqrt(Math.pow(cAvgPrime, 7) / (Math.pow(cAvgPrime, 7) + Math.pow(25, 7)));

        const sL = 1 + (0.015 * Math.pow(lAvgPrime - 50, 2)) / Math.sqrt(20 + Math.pow(lAvgPrime - 50, 2));
        const sC = 1 + 0.045 * cAvgPrime;
        const sH = 1 + 0.015 * cAvgPrime * t;

        const rT = -Math.sin(deg2rad(2 * deltaTheta)) * rC;

        const kL = 1, kC = 1, kH = 1;

        const deltaE = Math.sqrt(
            Math.pow(deltaLPrime / (kL * sL), 2) +
            Math.pow(deltaCPrime / (kC * sC), 2) +
            Math.pow(deltaHPrimeValue / (kH * sH), 2) +
            rT * (deltaCPrime / (kC * sC)) * (deltaHPrimeValue / (kH * sH))
        );

        return deltaE;
    }

    function hexToRgb(hex) {
        hex = hex.replace("#", "");
        return {
            r: parseInt(hex.substr(0, 2), 16),
            g: parseInt(hex.substr(2, 2), 16),
            b: parseInt(hex.substr(4, 2), 16)
        };
    }

    function calculateDeltaE(hex1, hex2) {
        const rgb1 = hexToRgb(hex1);
        const rgb2 = hexToRgb(hex2);

        const xyz1 = rgbToXyz(rgb1.r, rgb1.g, rgb1.b);
        const xyz2 = rgbToXyz(rgb2.r, rgb2.g, rgb2.b);

        const lab1 = xyzToLab(xyz1.x, xyz1.y, xyz1.z);
        const lab2 = xyzToLab(xyz2.x, xyz2.y, xyz2.z);

        return ciede2000(lab1, lab2);
    }

    function calculateSimilarity(deltaE, maxDelta, minDelta, curve) {
        if (deltaE <= minDelta) return 100;
        if (deltaE >= maxDelta) return 0;

        const normalized = (deltaE - minDelta) / (maxDelta - minDelta);
        const similarity = 100 * Math.pow(1 - normalized, curve);
        
        return Math.max(0, Math.min(100, similarity));
    }

    function gradeGuess(input) {
        let guess = input.replace("#", "");
        if (miniMode && guess.length === 3) {
            guess = expandMini("#" + guess).slice(1);
        }
        if (guess.length !== 6) return 0;

        // Calculate CIEDE2000 Delta E
        const deltaE = calculateDeltaE("#" + currentHex, "#" + guess);

        // Configure these values based on your testing!
        const maxDelta = 100;  // Colors more different than this = 0%
        const minDelta = 0;    // Colors closer than this = 100%
        const curve = 1.1;     // How fast the score drops (0.5-3.0)

        const score = calculateSimilarity(deltaE, maxDelta, minDelta, curve);
        return Math.round(score);
    }

    /* =========================
       STORAGE
       ========================= */
    function storageKey() {
        return `hjf_${getCodleNumber()}_${miniMode?"mini":"full"}`;
    }

    function saveDailyResult({ score, guess, hex, mode, number, isRandom }) {
        const entry = {
            score,
            guess,
            hex,
            mode,
            number,
            isRandom,
            date: new Date().toISOString()
        };

        const raw = localStorage.getItem("hjf_history_v3");
        const history = raw ? JSON.parse(raw) : [];

        const key = `${number}_${mode}_${isRandom}`;
        if (history.some(e => e.key === key)) return;

        entry.key = key;
        history.push(entry);

        localStorage.setItem("hjf_history_v3", JSON.stringify(history));
    }

    function getDailyResult() {
        const data = localStorage.getItem(storageKey());
        return data ? JSON.parse(data) : null;
    }

    function resetGuessInput() {
        userguess.value = "";
        userguess.style.backgroundColor = "";
        userguess.style.color = "";
        userguess.style.fontWeight = "";
        userguess.disabled = false;
        document.getElementById('submitguess').disabled = false;
    }

    /* =========================
       SUBMIT
       ========================= */
    document.getElementById('submitguess').addEventListener('click', () => {
        if (!randomMode && hasGuessedToday()) {
            afterguessresult.textContent = "You have already guessed today!";
            miniMode = false;
            return;
        }

        const guess = userguess.value.trim();
        if (guess.length < 3) return;

       const score = gradeGuess(guess);
        lastScore = score;
        
    function applyGuessColor(hex) {
        let fullHex;
        
        if (miniMode && hex.length === 3) {
            // Expand RGB to RRGGBB
            fullHex = "#" + hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
            // Update the input to show the expanded hex
            userguess.value = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        } else {
            fullHex = "#" + hex.padEnd(6, "0");
        }

        userguess.style.backgroundColor = fullHex;
        userguess.style.color = "#000";
        userguess.style.fontWeight = "bold";
    }
        
        applyGuessColor(userguess.value);

        reactToScore(score);

        if (!randomMode) {
            afterguessresult.textContent = `You scored: ${score}%`;
            saveDailyResult({ 
                score, 
                guess, 
                hex: currentHex, 
                mode: miniMode ? "mini" : "normal", 
                number: getCodleNumber(), 
                isRandom: false 
            });
            userguess.disabled = true;
            document.getElementById('submitguess').disabled = true;
        }
        if (randomMode) {
            randomGuessCount++;

            const guessStack = document.getElementById("guessStack");

            const padded = userguess.value.padEnd(6, "0").toUpperCase();
            const entry = document.createElement("div");

            entry.className = "guess-entry";
            entry.style.backgroundColor = `#${padded}`;
            entry.style.color = score > 60 ? "#000" : "#fff";

            entry.textContent = `#${padded} — ${score}%`;

            guessStack.prepend(entry);

            afterguessresult.textContent = `Guess ${randomGuessCount}: ${score}%`;
            resetGuessInput();
            
        }

    });

    document.getElementById('toggleUnlimited').addEventListener('click', () => {
        document.getElementById('toggleUnlimited').textContent = "New";

        generateRandomHex();      
    });
    copyBtn.addEventListener("click", () => {
        if (lastScore === null) return;

        const hex = userguess.value.padEnd(6, "0").toUpperCase();
        const label = miniMode ? "Mini" : "Normal";
        
        // Create a visual score bar using emojis
        const scoreBar = createScoreBar(lastScore);

        const text =
            `HollyJollyFollyCodle #${getCodleNumber()}\n` +
            `${label} — ${lastScore}%\n` +
            `${scoreBar}\n` +
            `🎨 #${hex}`;

        navigator.clipboard.writeText(text);
        
        // Add visual feedback
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    });
        function renderStatistics() {
        const raw = localStorage.getItem("hjf_history_v3");
        const history = raw ? JSON.parse(raw) : [];
        
        // Filter only daily (non-random) games
        const dailyGames = history.filter(e => !e.isRandom);
        
        if (dailyGames.length === 0) return;
        
        const avgScore = Math.round(
            dailyGames.reduce((sum, e) => sum + e.score, 0) / dailyGames.length
        );
        const bestScore = Math.max(...dailyGames.map(e => e.score));
        const totalGames = dailyGames.length;
        
        const statsDiv = document.createElement("div");
        statsDiv.style.marginTop = "16px";
        statsDiv.style.padding = "12px";
        statsDiv.style.background = "#222";
        statsDiv.style.borderRadius = "8px";
        statsDiv.style.fontSize = "0.9rem";
        statsDiv.style.textAlign = "center";
        
        statsDiv.innerHTML = `
            <div style="margin: 4px 0;"><strong>Your Stats</strong></div>
            <div style="margin: 4px 0;">Games Played: ${totalGames}</div>
            <div style="margin: 4px 0;">Best Score: ${bestScore}%</div>
            <div style="margin: 4px 0;">Average Score: ${avgScore}%</div>
        `;
        
        return statsDiv;
    }
    // Helper function to create a visual score bar
    function createScoreBar(score) {
        const filled = Math.round(score / 10);
        const empty = 10 - filled;
        return "█".repeat(filled) + "░".repeat(empty);
    }
    /* =========================
       MODE TOGGLES
       ========================= */
    document.getElementById('toggleMode').addEventListener("click", () => {
        miniMode = !miniMode;
        document.getElementById('userguess').placeholder = miniMode ? "RGB" : "RRGGBB";
        resetGuessInput();
        document.getElementById('toggleMode').textContent = miniMode ? "Normal" : "Mini";
        randomMode ? generateRandomHex() : loadDaily();
        afterguessresult.textContent = "";
    });

    const toggleRandomBtn = document.getElementById('toggleRandom');
    if (toggleRandomBtn) {
        toggleRandomBtn.addEventListener("click", () => {
            randomMode = !randomMode;

            resetGuessInput();
            afterguessresult.textContent = "";

            if (randomMode) {
                hexTitle.textContent = "Random Codle";
                codleNumber.textContent = "Random";
                generateRandomHex();
            } else {
                hexTitle.textContent = "HollyJollyFollyCodle";
                loadDaily();
            }
        });
    }

    const pastList = document.getElementById("pastList");

    document.getElementById("pasthexcodles").addEventListener("click", () => {
        pastList.style.display =
            pastList.style.display === "none" ? "block" : "none";

        if (pastList.style.display === "block") {
            renderPastHexcodles(pastList);
        }
    });

    /* =========================
       ANIMATION CONTROL
       ========================= */
    
    function clearTimers(){
        clearInterval(animationTimer);
        clearTimeout(blinkTimer);
        clearInterval(eyeHoverTimer);
    }

    function startIdle(){
        clearTimers();
        frameIndex=0;
        animationTimer=setInterval(()=>{
            character.src=idleFrames[frameIndex];
            frameIndex=(frameIndex+1)%idleFrames.length;
        },1000);
    }

    function playBlink(cb){
        clearTimers();
        frameIndex=0;
        animationTimer=setInterval(()=>{
            if(frameIndex>=blinkFrames.length){
                clearInterval(animationTimer);
                cb?.();
            } else character.src=blinkFrames[frameIndex++];
        },150);
    }
    function renderPastHexcodles(container) {
        const raw = localStorage.getItem("hjf_history_v3");
        const history = raw ? JSON.parse(raw) : [];

        container.innerHTML = "";

        history
            .sort((a,b) => b.number - a.number)
            .forEach(entry => {
                const row = document.createElement("div");
                row.className = "pastItem"; // Add the existing CSS class

                const modeLabel = entry.mode === "mini" ? "Mini" : "Normal";
                const randLabel = entry.isRandom ? " (Random)" : "";
                
                // Create color swatch
                const colorSwatch = document.createElement("div");
                colorSwatch.style.display = "inline-block";
                colorSwatch.style.width = "24px";
                colorSwatch.style.height = "24px";
                colorSwatch.style.backgroundColor = "#" + entry.hex;
                colorSwatch.style.borderRadius = "4px";
                colorSwatch.style.border = "1px solid #555";
                colorSwatch.style.marginRight = "10px";
                colorSwatch.style.verticalAlign = "middle";

                // Create text content
                const textSpan = document.createElement("span");
                textSpan.textContent = 
                    `HJF Codle #${entry.number} — ${modeLabel}${randLabel} — ${entry.score}%`;

                row.appendChild(colorSwatch);
                row.appendChild(textSpan);

                row.style.cursor = "pointer";
                row.onclick = () => {
                    setColor("#" + entry.hex);
                };

                container.appendChild(row);
            });
    }

    function playReaction(type){
        const r=reactions[type];
        clearTimers();
        frameIndex=0;
        animationTimer=setInterval(()=>{
            character.src=r.frames[frameIndex];
            frameIndex++;
            if(frameIndex>=r.frames.length){
                clearInterval(animationTimer);
                playBlink(startIdle);
            }
        },150);
    }

    window.reactToScore = s => {
        if(s>=90) playReaction("ca2t");
        else if(s>=60) playReaction("thumb");
        else playReaction("cry");
    };

    /* =========================
       EYES
       ========================= */
    colordisplay.addEventListener("mouseenter",()=>{
        hoverEye.style.display="block";
        let i=0;
        eyeHoverTimer=setInterval(()=>{
            hoverEye.src=eyeHoverFrames[i++];
            if(i>=eyeHoverFrames.length) i=3;
        },120);
    });

    colordisplay.addEventListener("mouseleave",()=>{
        hoverEye.style.display="none";
        clearInterval(eyeHoverTimer);
    });

    /* =========================
       INIT
       ========================= */
    const previous = getDailyResult();
    if (previous && previous.mode === (miniMode ? "mini" : "normal") && !randomMode) {
        setColor("#" + previous.hex);
        afterguessresult.textContent = `Already played (${previous.mode}): ${previous.score}%`;
        userguess.disabled = true;
        document.getElementById('submitguess').disabled = true;
    }

    function hasGuessedToday() {
        const raw = localStorage.getItem("hjf_history_v3");
        if (!raw) return false;

        const history = JSON.parse(raw);
        const day = getCodleNumber();
        const mode = miniMode ? "mini" : "normal";

        return history.some(e =>
            e.number === day &&
            e.mode === mode &&
            e.isRandom === false
        );  
    }

    startIdle();
    if (randomMode) {
        hexTitle.textContent = "Random Codle";
        codleNumber.textContent = "Random";
        generateRandomHex();
    } else {
    loadDaily();
}
});

function setupEyeFollow() {
    const baseEye = document.getElementById("baseEye");
    const colordisplay = document.getElementById("colordisplay");
    const maxOffset = 1;

    document.addEventListener("mousemove", (e) => {
        const rect = colordisplay.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const offsetX = ((e.clientX - centerX) / (rect.width / 2)) * maxOffset;
        const offsetY = ((e.clientY - centerY) / (rect.height / 2)) * maxOffset;

        baseEye.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    });

    document.addEventListener("mouseleave", () => {
        baseEye.style.transform = `translate(0px, 0px)`;
    });
}
