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
    function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
    }

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
    let full = "";
    let mini = "";

    for (let i = 0; i < 6; i++) {
        const r = seededRandom(dayNumber * 100 + i * 17);
        full += letters[Math.floor(r * 16)];

        if (i % 2 === 0) {
            mini += letters[Math.floor(seededRandom(dayNumber * 50 + i) * 16)];
        } else {
            mini += "0";
        }
    }

    currentHex = full;
    miniHex = mini;

    return miniMode ? "#" + mini : "#" + full;
}

    function generateRandomHex() {
    const letters = "0123456789ABCDEF";
    let hex = "";
    for (let i = 0; i < 6; i++) {
        hex += letters[Math.floor(Math.random() * 16)];
    }
    currentHex = hex;
    setColor("#" + hex);
}


    function loadDaily() {
        const day = getCodleNumber();
        codleNumber.textContent = `#${day}`;
        setColor(generateDailyHex(day));
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
       COLOR SCIENCE (LAB / DELTA E)
       ========================= */
    function rgbToLab(hex) {
        let r = parseInt(hex.substr(1,2),16)/255;
        let g = parseInt(hex.substr(3,2),16)/255;
        let b = parseInt(hex.substr(5,2),16)/255;

        [r,g,b] = [r,g,b].map(v =>
            v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92
        );

        let x = (r*0.4124 + g*0.3576 + b*0.1805) / 0.95047;
        let y = (r*0.2126 + g*0.7152 + b*0.0722);
        let z = (r*0.0193 + g*0.1192 + b*0.9505) / 1.08883;

        const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787*t + 16/116);

        return {
            L: 116*f(y)-16,
            a: 500*(f(x)-f(y)),
            b: 200*(f(y)-f(z))
        };
    }

    function perceptualDistance(lab1, lab2) {
        const dL = lab1.L - lab2.L;
        const dA = lab1.a - lab2.a;
        const dB = lab1.b - lab2.b;

        // Humans forgive lightness more than hue
        const lightnessWeight = 0.4;
        const chromaWeight = 1.0;

        return Math.sqrt(
            lightnessWeight * dL * dL +
            chromaWeight * (dA * dA + dB * dB)
        );
    }

    function gradeGuess(input) {
        let guess = input.replace("#", "");
        if (miniMode && guess.length === 3) {
            guess = expandMini("#" + guess).slice(1);
        }
        if (guess.length !== 6) return 0;

        const targetLab = rgbToLab("#" + currentHex);
        const guessLab  = rgbToLab("#" + guess);

        const d = perceptualDistance(targetLab, guessLab);

        /*
        Tuned scale (by testing):
        d < 5    = almost identical
        d < 15   = very close (same color family)
        d < 35   = clearly off
        d > 60   = very wrong
        */

        let score;
        if (d < 3) score = 100;
        else if (d < 8) score = 95 - (d - 3) * 1.5;
        else if (d < 20) score = 85 - (d - 8) * 1.2;
        else if (d < 40) score = 65 - (d - 20) * 1.5;
        else score = Math.max(5, 35 - (d - 40));

        return Math.round(Math.max(0, Math.min(100, score)));
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
        mode,          // "mini" | "normal"
        number,        // codle #
        isRandom,      // true / false
        date: new Date().toISOString()
    };

    const raw = localStorage.getItem("hjf_history_v3");
    const history = raw ? JSON.parse(raw) : [];
    

    // prevent duplicates (same day + same mode)
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
    const lastScore = score;

    afterguessresult.textContent = `You scored: ${score}%`;
    reactToScore(score);
    function applyGuessColor(hex) {
    const fullHex = "#" + hex.padEnd(6, "0");

    userguess.style.backgroundColor = fullHex;
    userguess.style.color = "#000";
    userguess.style.fontWeight = "bold";
    }

    applyGuessColor(userguess.value);


    if (!randomMode) {
        saveDailyResult({ score, guess, hex: currentHex, mode: miniMode ? "mini" : "normal", number: getCodleNumber(), isRandom: false });
        userguess.disabled = true;
        document.getElementById('submitguess').disabled = true;
    }
    
});


    copyBtn.addEventListener("click", () => {
    if (lastScore === null) return;

    const hex = userguess.value.padEnd(6, "0").toUpperCase();
    const label = miniMode ? "Mini" : "Normal";

    const text =
        `HollyJollyFollyCodle #${getCodleNumber()}\n` +
        `${label} — ${lastScore}%\n` +
        `⬛ #${hex}`;

    navigator.clipboard.writeText(text);   
});

    /* =========================
       MODE TOGGLES
       ========================= */
    document.getElementById('toggleMode').addEventListener("click", () => {
        miniMode = !miniMode;
        resetGuessInput();
        document.getElementById('toggleMode').textContent = miniMode ? "Normal" : "Mini";
        randomMode ? generateRandomHex() : loadDaily();
        afterguessresult.textContent = "";
    });

    document.getElementById('toggleRandom').addEventListener("click", () => {
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

            // ---------- PAST HEXCODES ----------
    const pastList = document.getElementById("pastList");

    document.getElementById("pasthexcodles").addEventListener("click", () => {
        pastList.style.display =
            pastList.style.display === "none" ? "block" : "none";

        if (pastList.style.display === "block") {
            renderPastHexcodles(pastList);
        }
    });

    /* =========================
       ANIMATION CONTROL (UNCHANGED)
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

            const modeLabel = entry.mode === "mini" ? "Mini" : "Normal";
            const randLabel = entry.isRandom ? " (Random)" : "";

            row.textContent =
                `HJF Codle #${entry.number} — ${modeLabel}${randLabel} — ${entry.score}%`;

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
    loadDaily();
    });

function setupEyeFollow() {
    const baseEye = document.getElementById("baseEye");
    const colordisplay = document.getElementById("colordisplay");
    const maxOffset = 1; // max movement in pixels

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
