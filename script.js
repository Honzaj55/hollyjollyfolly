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
    const toggleModeBtn = document.getElementById('toggleMode');
    const toggleRandomBtn = document.getElementById('toggleRandom');
    setupEyeFollow();

    const character = document.getElementById("character");
    const baseEye = document.getElementById("baseEye");
    const hoverEye = document.getElementById("hoverEye");

    /* =========================
       STATE
       ========================= */
    function loadDaily() {
    const day = getDayNumber();
    codleNumber.textContent = `#${day}`;
    setColor(generateDailyHex(day));
    }

    const DAILY_START = new Date(2025, 11, 27); // Dec 27 2025 = #1
    let miniMode = false;   
    let randomMode = false;
    let currentHex = "";
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

    let state="idle", frameIndex=0, animationTimer=null, eyeHoverTimer=null, blinkTimer=null;
    const HISTORY_KEY = "hjf_history";

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
        let hex = "#";
        for (let i = 0; i < 6; i++) hex += letters[Math.floor(Math.random() * 16)];
        currentHex = hex;
        codleNumber.textContent = "Random";
        hexTitle.textContent = "Random Codle";
        setColor(hex);
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

    function deltaE(l1,l2){
        return Math.sqrt(
            (l1.L-l2.L)**2 +
            (l1.a-l2.a)**2 +
            (l1.b-l2.b)**2
        );
    }

    function gradeGuess(input) {
        let guess = input.replace("#","");
        if (miniMode && guess.length === 3) guess = expandMini("#"+guess).slice(1);
        if (guess.length !== 6) return 0;

        const d = deltaE(rgbToLab(currentHex), rgbToLab("#"+guess));
        return Math.max(0, Math.round(100 - d));
    }

    /* =========================
       STORAGE
       ========================= */
    function storageKey() {
        return `hjf_${getCodleNumber()}_${miniMode?"mini":"full"}`;
    }

    function saveDailyResult(score, guess, hex, date = new Date()) {
        const key = date.toISOString().split('T')[0];
        const mode = miniMode ? "mini" : "normal";
        const data = { score, guess, hex, timestamp: Date.now(), number: getCodleNumber(date), mode };
        
        try { localStorage.setItem(key + "_" + mode, JSON.stringify(data)); } catch(e){}
        
        // Save in history
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            const exists = arr.findIndex(e => e.dateKey === key && e.mode === mode);
            if (exists >= 0) arr[exists] = {...data, dateKey: key};
            else arr.push({...data, dateKey: key});
            localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
        } catch(e){}
    }


    function getDailyResult() {
        const data = localStorage.getItem(storageKey());
        return data ? JSON.parse(data) : null;
    }

    /* =========================
       SUBMIT
       ========================= */
    document.getElementById('submitguess').addEventListener('click', () => {
    if (!randomMode && hasGuessedToday()) {
        afterguessresult.textContent = "You already played today's codle!";
        return;
    }

    const guess = userguess.value.trim();
    if (guess.length < 3) return;

    const score = gradeGuess(guess);

    afterguessresult.textContent = `You scored: ${score}%`;
    reactToScore(score);

    if (!randomMode) {
        saveDailyResult(score, guess, currentHex);
        userguess.disabled = true;
        document.getElementById('submitguess').disabled = true;
    }
});


    copyBtn.addEventListener("click", () => {
        const score = gradeGuess(userguess.value);
        navigator.clipboard.writeText(
            `HollyJollyFollyCodle ${codleNumber.textContent} ${score}%`
        );
    });

    /* =========================
       MODE TOGGLES
       ========================= */
    toggleModeBtn.addEventListener("click", () => {
    miniMode = !miniMode;
    toggleModeBtn.textContent = miniMode ? "Normal" : "Mini";
    randomMode ? generateRandomHex() : loadDaily();
;
    afterguessresult.textContent = "";
    });

    toggleRandomBtn.addEventListener("click", () => {
        randomMode = !randomMode;
        randomMode ? generateRandomHex() : loadDaily();
        afterguessresult.textContent = "";
    });
            // ---------- PAST HEXCODES ----------
    const pastList = document.getElementById("pastList");

    document.getElementById("pasthexcodles").addEventListener("click", () => {
        pastList.innerHTML = "";
        pastList.style.display =
            pastList.style.display === "none" ? "block" : "none";

        Object.keys(localStorage)
            .filter(k => k.startsWith("hjf_"))
            .sort()
            .forEach(key => {
                const data = JSON.parse(localStorage.getItem(key));
                if (!data) return;

                const div = document.createElement("div");
                div.className = "pastItem";
                div.textContent = `#${data.number} — ${data.score}%`;
                div.onclick = () => {
                    currentHex = data.hex;
                    setColor("#" + currentHex);
                    codleNumber.textContent = `#${data.number}`;
                    afterguessresult.textContent = "Replay mode";
                    randomMode = false;
                };
                pastList.appendChild(div);
            });
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

    startIdle();
    loadDaily();
});

function hasGuessedToday() {
    const mode = miniMode ? "mini" : "normal";
    const key = new Date().toISOString().split('T')[0];
    return localStorage.getItem(key + "_" + mode) !== null;
}
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
