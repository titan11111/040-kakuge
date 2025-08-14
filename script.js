// ゲーム設定
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const bgm = document.getElementById('bgm');

// ゲーム状態
let gameState = {
    round: 1,
    timer: 60,
    player1Wins: 0,
    player2Wins: 0,
    gameOver: false,
    roundOver: false,
    paused: false,
    cpu: false
};

// キー入力状態
const keys = {};

// ダブルタップによる画面のスクロールや拡大を防止
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, { passive: false });

// プレイヤークラス
class Player {
    constructor(x, y, color, controls, name, facing = 1, isCPU = false) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 80;
        this.color = color;
        this.controls = controls;
        this.name = name;
        this.facing = facing; // 1: 右向き, -1: 左向き
        this.isCPU = isCPU;
        
        // 戦闘パラメータ
        this.health = 100;
        this.maxHealth = 100;
        this.speed = 3;
        this.jumpPower = 15;
        this.isGrounded = true;
        this.velocityY = 0;
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.isBlocking = false;
        this.isCrouching = false;
        this.isJumping = false;
        
        // アニメーション
        this.animFrame = 0;
        this.animTimer = 0;
        this.currentAction = 'idle';
        
        // 攻撃判定
        this.attackBox = { x: 0, y: 0, width: 0, height: 0 };
        this.hitboxes = [];
        
        // 必殺技
        this.specialCooldown = 0;
        this.comboInputs = [];
        this.inputTimer = 0;
    }
    
    update() {
        this.handleInput();
        this.updatePhysics();
        this.updateAnimation();
        this.updateCooldowns();
        this.updateFacing();
    }
    
    handleInput() {
        if (this.isCPU) {
            this.cpuBehavior();
            return;
        }
        if (this.isAttacking || this.health <= 0) return;
        
        // リセット状態
        this.isCrouching = false;
        this.isBlocking = false;
        
        // 移動
        if (keys[this.controls.left] && !keys[this.controls.down]) {
            this.x -= this.speed;
            this.currentAction = 'walk';
        }
        if (keys[this.controls.right] && !keys[this.controls.down]) {
            this.x += this.speed;
            this.currentAction = 'walk';
        }
        
        // しゃがみ
        if (keys[this.controls.down]) {
            this.isCrouching = true;
            this.currentAction = 'crouch';
            if (keys[this.controls.left] || keys[this.controls.right]) {
                this.isBlocking = true;
                this.currentAction = 'block';
            }
        }
        
        // ジャンプ
        if (keys[this.controls.up] && this.isGrounded && !this.isCrouching) {
            this.jump();
        }
        
        // 攻撃
        if (keys[this.controls.punch] && this.attackCooldown <= 0) {
            if (keys[this.controls.up] && this.specialCooldown <= 0) {
                this.specialAttack();
            } else {
                this.punch();
            }
        }
        
        if (keys[this.controls.kick] && this.attackCooldown <= 0) {
            this.kick();
        }

        // 画面端制限
        this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));

        // アイドル状態
        if (!keys[this.controls.left] && !keys[this.controls.right] &&
            !keys[this.controls.down] && this.isGrounded && !this.isAttacking) {
            this.currentAction = 'idle';
        }
    }

    cpuBehavior() {
        const opponent = this === player1 ? player2 : player1;
        if (Math.abs(this.x - opponent.x) > 60) {
            if (this.x < opponent.x) {
                this.x += this.speed;
                this.currentAction = 'walk';
            } else {
                this.x -= this.speed;
                this.currentAction = 'walk';
            }
        } else if (this.attackCooldown <= 0) {
            this.punch();
        }
        if (this.isGrounded && Math.random() < 0.01) {
            this.jump();
        }
    }
    
    updatePhysics() {
        // 重力
        if (!this.isGrounded) {
            this.velocityY += 0.8;
            this.y += this.velocityY;
            
            // 着地判定
            if (this.y >= canvas.height - this.height) {
                this.y = canvas.height - this.height;
                this.velocityY = 0;
                this.isGrounded = true;
                this.isJumping = false;
            }
        }
    }
    
    updateFacing() {
        // 相手の方を向く
        const opponent = this === player1 ? player2 : player1;
        if (this.x < opponent.x) {
            this.facing = 1; // 右向き
        } else {
            this.facing = -1; // 左向き
        }
    }
    
    jump() {
        this.velocityY = -this.jumpPower;
        this.isGrounded = false;
        this.isJumping = true;
        this.currentAction = 'jump';
    }
    
    punch() {
        this.isAttacking = true;
        this.attackCooldown = 20;
        this.currentAction = 'punch';
        
        // 攻撃判定
        const attackRange = 60;
        this.attackBox = {
            x: this.facing > 0 ? this.x + this.width : this.x - attackRange,
            y: this.y + 10,
            width: attackRange,
            height: 30
        };
        
        setTimeout(() => {
            this.isAttacking = false;
            this.attackBox = { x: 0, y: 0, width: 0, height: 0 };
        }, 300);
        
        this.checkHit(15);
    }
    
    kick() {
        this.isAttacking = true;
        this.attackCooldown = 25;
        this.currentAction = 'kick';
        
        // キックの攻撃判定
        const attackRange = 70;
        this.attackBox = {
            x: this.facing > 0 ? this.x + this.width : this.x - attackRange,
            y: this.y + 40,
            width: attackRange,
            height: 30
        };
        
        setTimeout(() => {
            this.isAttacking = false;
            this.attackBox = { x: 0, y: 0, width: 0, height: 0 };
        }, 400);
        
        this.checkHit(20);
    }
    
    specialAttack() {
        this.isAttacking = true;
        this.attackCooldown = 40;
        this.specialCooldown = 180; // 3秒クールダウン
        this.currentAction = 'special';
        
        // 必殺技の攻撃判定
        const attackRange = 100;
        this.attackBox = {
            x: this.facing > 0 ? this.x + this.width : this.x - attackRange,
            y: this.y,
            width: attackRange,
            height: this.height
        };
        
        setTimeout(() => {
            this.isAttacking = false;
            this.attackBox = { x: 0, y: 0, width: 0, height: 0 };
        }, 600);
        
        this.checkHit(35);
    }
    
    checkHit(damage) {
        const opponent = this === player1 ? player2 : player1;
        
        // 当たり判定チェック
        if (this.isColliding(this.attackBox, opponent) && !opponent.isBlocking) {
            opponent.takeDamage(damage);
            this.createHitEffect(opponent);
        } else if (this.isColliding(this.attackBox, opponent) && opponent.isBlocking) {
            opponent.takeDamage(Math.floor(damage * 0.2)); // ガード時は20%のダメージ
            this.createBlockEffect(opponent);
        }
    }
    
    isColliding(box1, box2) {
        return box1.x < box2.x + box2.width &&
               box1.x + box1.width > box2.x &&
               box1.y < box2.y + box2.height &&
               box1.y + box1.height > box2.y;
    }
    
    takeDamage(damage) {
        this.health -= damage;
        this.health = Math.max(0, this.health);
        
        if (this.health <= 0) {
            this.currentAction = 'knocked';
        }
    }
    
    createHitEffect(target) {
        // ヒットエフェクト（簡易版）
        effects.push({
            x: target.x + target.width / 2,
            y: target.y + target.height / 2,
            type: 'hit',
            timer: 15,
            maxTimer: 15
        });
    }
    
    createBlockEffect(target) {
        // ガードエフェクト
        effects.push({
            x: target.x + target.width / 2,
            y: target.y + target.height / 2,
            type: 'block',
            timer: 10,
            maxTimer: 10
        });
    }
    
    updateCooldowns() {
        if (this.attackCooldown > 0) this.attackCooldown--;
        if (this.specialCooldown > 0) this.specialCooldown--;
    }
    
    updateAnimation() {
        this.animTimer++;
        if (this.animTimer > 10) {
            this.animFrame = (this.animFrame + 1) % 4;
            this.animTimer = 0;
        }
    }
    
    draw() {
        ctx.save();
        
        // キャラクターの基本形
        if (this.facing < 0) {
            ctx.scale(-1, 1);
            ctx.translate(-this.x - this.width, 0);
        }
        
        // 体力に応じた色変化
        let healthRatio = this.health / this.maxHealth;
        let bodyColor = this.color;
        if (healthRatio < 0.3) {
            bodyColor = '#ff6666'; // 体力が少ない時は赤っぽく
        }
        
        // キャラクター描画
        this.drawCharacter(bodyColor);
        
        // 攻撃エフェクト
        if (this.isAttacking) {
            this.drawAttackEffect();
        }
        
        ctx.restore();
        
        // デバッグ用攻撃判定表示
        if (this.attackBox.width > 0) {
            ctx.strokeStyle = 'red';
            ctx.strokeRect(this.attackBox.x, this.attackBox.y, this.attackBox.width, this.attackBox.height);
        }
    }
    
    drawCharacter(color) {
        let x = this.facing > 0 ? this.x : this.x;
        let y = this.y;
        
        // 体
        ctx.fillStyle = color;
        ctx.fillRect(x + 15, y + 30, 20, 30);
        
        // 頭
        ctx.fillStyle = '#ffdbac';
        ctx.fillRect(x + 20, y, 10, 15);
        
        // 腕
        ctx.fillStyle = '#ffdbac';
        if (this.currentAction === 'punch' || this.currentAction === 'special') {
            // パンチ時の腕
            ctx.fillRect(x + 35, y + 35, 15, 8);
        } else {
            ctx.fillRect(x + 10, y + 35, 8, 15);
            ctx.fillRect(x + 32, y + 35, 8, 15);
        }
        
        // 足
        ctx.fillStyle = '#4169e1';
        if (this.isCrouching) {
            ctx.fillRect(x + 15, y + 70, 8, 10);
            ctx.fillRect(x + 27, y + 70, 8, 10);
        } else if (this.currentAction === 'kick') {
            ctx.fillRect(x + 15, y + 60, 8, 20);
            ctx.fillRect(x + 35, y + 65, 15, 8); // キック足
        } else {
            ctx.fillRect(x + 15, y + 60, 8, 20);
            ctx.fillRect(x + 27, y + 60, 8, 20);
        }
        
        // 表情
        ctx.fillStyle = 'black';
        ctx.fillRect(x + 22, y + 5, 2, 2); // 目
        ctx.fillRect(x + 26, y + 5, 2, 2); // 目
        
        if (this.health <= 0) {
            // KO時の表情
            ctx.fillStyle = 'red';
            ctx.fillRect(x + 22, y + 10, 6, 2);
        }
    }
    
    drawAttackEffect() {
        if (this.currentAction === 'special') {
            // 必殺技エフェクト
            ctx.fillStyle = 'rgba(255, 255, 0, 0.6)';
            ctx.fillRect(
                this.facing > 0 ? this.x + this.width : this.x - 50,
                this.y,
                50,
                this.height
            );
        }
    }
}

// エフェクトシステム
const effects = [];

function updateEffects() {
    for (let i = effects.length - 1; i >= 0; i--) {
        const effect = effects[i];
        effect.timer--;
        
        if (effect.timer <= 0) {
            effects.splice(i, 1);
        }
    }
}

function drawEffects() {
    effects.forEach(effect => {
        const alpha = effect.timer / effect.maxTimer;
        
        if (effect.type === 'hit') {
            ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
            const size = 20 * (1 - alpha);
            ctx.fillRect(effect.x - size/2, effect.y - size/2, size, size);
        } else if (effect.type === 'block') {
            ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
            ctx.lineWidth = 3;
            ctx.strokeRect(effect.x - 15, effect.y - 15, 30, 30);
        }
    });
}

// プレイヤー初期化
const player1 = new Player(100, canvas.height - 80, '#ff4444', {
    left: 'KeyA',
    right: 'KeyD',
    up: 'KeyW',
    down: 'KeyS',
    punch: 'KeyJ',
    kick: 'KeyK'
}, 'Player 1', 1);

const player2 = new Player(canvas.width - 150, canvas.height - 80, '#4444ff', {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    up: 'ArrowUp',
    down: 'ArrowDown',
    punch: 'Digit1',
    kick: 'Digit2'
}, 'Player 2', -1);

// イベントリスナー
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// ゲームループ
let gameTimer = 0;

function gameLoop() {
    if (!gameState.gameOver && !gameState.paused) {
        update();
        draw();
    }
    requestAnimationFrame(gameLoop);
}

function update() {
    // タイマー更新
    gameTimer++;
    if (gameTimer >= 60) { // 1秒
        gameTimer = 0;
        gameState.timer--;
        document.getElementById('timer').textContent = gameState.timer;
        
        if (gameState.timer <= 0) {
            endRound('time');
        }
    }
    
    // プレイヤー更新
    player1.update();
    player2.update();
    
    // エフェクト更新
    updateEffects();
    
    // 体力更新
    updateHealthBars();
    
    // KO判定
    if (player1.health <= 0 || player2.health <= 0) {
        if (!gameState.roundOver) {
            endRound('ko');
        }
    }
}

function draw() {
    // 背景クリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 地面
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);
    
    // プレイヤー描画
    player1.draw();
    player2.draw();
    
    // エフェクト描画
    drawEffects();
}

function updateHealthBars() {
    const player1Health = document.getElementById('player1-health');
    const player2Health = document.getElementById('player2-health');
    
    player1Health.style.width = (player1.health / player1.maxHealth * 100) + '%';
    player2Health.style.width = (player2.health / player2.maxHealth * 100) + '%';
}

function endRound(reason) {
    gameState.roundOver = true;
    
    let winner = '';
    if (reason === 'ko') {
        if (player1.health <= 0) {
            winner = 'Player 2';
            gameState.player2Wins++;
        } else {
            winner = 'Player 1';
            gameState.player1Wins++;
        }
    } else if (reason === 'time') {
        if (player1.health > player2.health) {
            winner = 'Player 1';
            gameState.player1Wins++;
        } else if (player2.health > player1.health) {
            winner = 'Player 2';
            gameState.player2Wins++;
        } else {
            winner = 'Draw';
        }
    }
    
    // ラウンド結果表示
    showRoundResult(winner);
    
    // 勝敗判定
    document.getElementById('player1-wins').textContent = gameState.player1Wins;
    document.getElementById('player2-wins').textContent = gameState.player2Wins;
    
    if (gameState.player1Wins >= 2 || gameState.player2Wins >= 2) {
        setTimeout(() => endGame(), 2000);
    } else {
        setTimeout(() => nextRound(), 2000);
    }
}

function showRoundResult(winner) {
    const resultDiv = document.getElementById('round-result');
    const resultText = document.getElementById('round-result-text');
    
    if (winner === 'Draw') {
        resultText.textContent = 'DRAW!';
    } else {
        resultText.textContent = winner + ' WINS!';
    }
    
    resultDiv.style.display = 'block';
}

function nextRound() {
    gameState.round++;
    gameState.timer = 60;
    gameState.roundOver = false;
    
    // プレイヤーリセット
    player1.health = player1.maxHealth;
    player2.health = player2.maxHealth;
    player1.x = 100;
    player2.x = canvas.width - 150;
    player1.y = canvas.height - 80;
    player2.y = canvas.height - 80;
    player1.velocityY = 0;
    player2.velocityY = 0;
    player1.isGrounded = true;
    player2.isGrounded = true;
    player1.currentAction = 'idle';
    player2.currentAction = 'idle';
    
    document.getElementById('current-round').textContent = gameState.round;
    document.getElementById('round-result').style.display = 'none';
}

function endGame() {
    gameState.gameOver = true;
    
    const resultDiv = document.getElementById('game-result');
    const resultText = document.getElementById('result-text');
    
    if (gameState.player1Wins > gameState.player2Wins) {
        resultText.textContent = 'PLAYER 1 VICTORY!';
    } else {
        resultText.textContent = 'PLAYER 2 VICTORY!';
    }
    
    resultDiv.style.display = 'flex';
    document.getElementById('round-result').style.display = 'none';
}

function restartGame() {
    // ゲーム状態リセット
    gameState = {
        round: 1,
        timer: 60,
        player1Wins: 0,
        player2Wins: 0,
        gameOver: false,
        roundOver: false,
        paused: false,
        cpu: gameState.cpu
    };
    player2.isCPU = gameState.cpu;
    
    // プレイヤーリセット
    player1.health = player1.maxHealth;
    player2.health = player2.maxHealth;
    player1.x = 100;
    player2.x = canvas.width - 150;
    player1.y = canvas.height - 80;
    player2.y = canvas.height - 80;
    player1.velocityY = 0;
    player2.velocityY = 0;
    player1.isGrounded = true;
    player2.isGrounded = true;
    player1.currentAction = 'idle';
    player2.currentAction = 'idle';
    player1.specialCooldown = 0;
    player2.specialCooldown = 0;
    player1.attackCooldown = 0;
    player2.attackCooldown = 0;
    
    // UI更新
    document.getElementById('current-round').textContent = gameState.round;
    document.getElementById('timer').textContent = gameState.timer;
    document.getElementById('player1-wins').textContent = gameState.player1Wins;
    document.getElementById('player2-wins').textContent = gameState.player2Wins;
    
    // 結果画面非表示
    document.getElementById('game-result').style.display = 'none';
    document.getElementById('round-result').style.display = 'none';
    
    // エフェクトクリア
    effects.length = 0;
}

// タッチ操作対応（スマホ用）
function setupTouchControls() {
    const touchControls = document.createElement('div');
    touchControls.className = 'touch-controls';
    let html = `
        <div class="player-controls" id="player1-touch">
            <h4>Player 1</h4>
            <div class="control-pad">
                <button class="btn-up" data-key="KeyW">↑</button>
                <div class="middle-row">
                    <button class="btn-left" data-key="KeyA">←</button>
                    <button class="btn-down" data-key="KeyS">↓</button>
                    <button class="btn-right" data-key="KeyD">→</button>
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn-punch" data-key="KeyJ">パンチ</button>
                <button class="btn-kick" data-key="KeyK">キック</button>
            </div>
        </div>`;
    if (!gameState.cpu) {
        html += `
        <div class="player-controls" id="player2-touch">
            <h4>Player 2</h4>
            <div class="control-pad">
                <button class="btn-up" data-key="ArrowUp">↑</button>
                <div class="middle-row">
                    <button class="btn-left" data-key="ArrowLeft">←</button>
                    <button class="btn-down" data-key="ArrowDown">↓</button>
                    <button class="btn-right" data-key="ArrowRight">→</button>
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn-punch" data-key="Digit1">パンチ</button>
                <button class="btn-kick" data-key="Digit2">キック</button>
            </div>
        </div>`;
    }
    touchControls.innerHTML = html;

    if (window.innerWidth <= 768) {
        document.body.appendChild(touchControls);

        const buttons = touchControls.querySelectorAll('button');
        buttons.forEach(button => {
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const key = button.getAttribute('data-key');
                keys[key] = true;
                button.classList.add('pressed');
            });

            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                const key = button.getAttribute('data-key');
                keys[key] = false;
                button.classList.remove('pressed');
            });

            button.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const key = button.getAttribute('data-key');
                keys[key] = true;
                button.classList.add('pressed');
            });

            button.addEventListener('mouseup', (e) => {
                e.preventDefault();
                const key = button.getAttribute('data-key');
                keys[key] = false;
                button.classList.remove('pressed');
            });
        });
    }
}

// キャンバスサイズ調整
function resizeCanvas() {
    const container = document.querySelector('.game-screen');
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    
    // アスペクト比を維持
    const aspectRatio = 800 / 400;
    let newWidth = containerWidth;
    let newHeight = newWidth / aspectRatio;
    
    if (newHeight > containerHeight) {
        newHeight = containerHeight;
        newWidth = newHeight * aspectRatio;
    }
    
    canvas.style.width = newWidth + 'px';
    canvas.style.height = newHeight + 'px';
}

// コンボシステム追加
class ComboSystem {
    constructor(player) {
        this.player = player;
        this.inputs = [];
        this.inputTimer = 0;
        this.maxInputTime = 30; // 0.5秒
        this.combos = {
            // 簡単なコンボ定義
            'punch-punch': { damage: 25, name: 'Double Punch' },
            'kick-punch': { damage: 30, name: 'Combo Attack' },
            'punch-kick': { damage: 28, name: 'Power Combo' }
        };
    }
    
    addInput(action) {
        this.inputs.push(action);
        this.inputTimer = this.maxInputTime;
        
        // 最大3入力まで保持
        if (this.inputs.length > 3) {
            this.inputs.shift();
        }
        
        this.checkCombos();
    }
    
    update() {
        if (this.inputTimer > 0) {
            this.inputTimer--;
        } else {
            this.inputs = [];
        }
    }
    
    checkCombos() {
        const inputString = this.inputs.join('-');
        
        for (const [combo, data] of Object.entries(this.combos)) {
            if (inputString.includes(combo)) {
                this.executeCombo(data);
                this.inputs = [];
                break;
            }
        }
    }
    
    executeCombo(comboData) {
        // コンボエフェクト
        effects.push({
            x: this.player.x + this.player.width / 2,
            y: this.player.y - 20,
            type: 'combo',
            text: comboData.name,
            timer: 60,
            maxTimer: 60
        });
        
        // 追加ダメージ
        const opponent = this.player === player1 ? player2 : player1;
        if (this.player.isColliding(this.player.attackBox, opponent)) {
            opponent.takeDamage(comboData.damage - 15); // 基本攻撃分を引く
        }
    }
}

// プレイヤーにコンボシステム追加
player1.comboSystem = new ComboSystem(player1);
player2.comboSystem = new ComboSystem(player2);

// 元のpunch/kickメソッドを修正してコンボ入力を追加
const originalPunch1 = player1.punch;
const originalKick1 = player1.kick;
const originalPunch2 = player2.punch;
const originalKick2 = player2.kick;

player1.punch = function() {
    originalPunch1.call(this);
    this.comboSystem.addInput('punch');
};

player1.kick = function() {
    originalKick1.call(this);
    this.comboSystem.addInput('kick');
};

player2.punch = function() {
    originalPunch2.call(this);
    this.comboSystem.addInput('punch');
};

player2.kick = function() {
    originalKick2.call(this);
    this.comboSystem.addInput('kick');
};

// update関数にコンボシステム更新を追加
const originalUpdate = update;
function update() {
    originalUpdate();
    player1.comboSystem.update();
    player2.comboSystem.update();
}

// エフェクト描画にコンボテキスト追加
const originalDrawEffects = drawEffects;
function drawEffects() {
    originalDrawEffects();
    
    effects.forEach(effect => {
        if (effect.type === 'combo') {
            const alpha = effect.timer / effect.maxTimer;
            ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(effect.text, effect.x, effect.y);
            ctx.textAlign = 'left';
        }
    });
}

// ゲーム初期化
function initGame() {
    resizeCanvas();
    setupTouchControls();
    
    // 初期UI設定
    document.getElementById('current-round').textContent = gameState.round;
    document.getElementById('timer').textContent = gameState.timer;
    document.getElementById('player1-wins').textContent = gameState.player1Wins;
    document.getElementById('player2-wins').textContent = gameState.player2Wins;
    
    // ゲームループ開始
    gameLoop();
}

function startGame(useCpu) {
    gameState.cpu = !!useCpu;
    player2.isCPU = gameState.cpu;
    const startScreen = document.getElementById('start-screen');
    startScreen.style.display = 'none';
    if (gameState.cpu) {
        const sections = document.querySelectorAll('#controls .control-section');
        if (sections[1]) sections[1].style.display = 'none';
    }
    if (bgm) {
        bgm.currentTime = 0;
        bgm.play();
    }
    initGame();
}

// ウィンドウリサイズ対応
window.addEventListener('resize', resizeCanvas);

// ページ読み込み完了後に初期表示を準備
document.addEventListener('DOMContentLoaded', () => {
    const volumeSlider = document.getElementById('volume-slider');
    const volumeValue = document.getElementById('volume-value');
    if (volumeSlider && volumeValue) {
        volumeSlider.addEventListener('input', () => {
            volumeValue.textContent = volumeSlider.value;
            if (bgm) bgm.volume = volumeSlider.value;
        });
    }
});

function pauseGame() {
    if (gameState.paused || gameState.gameOver) return;
    gameState.paused = true;
    document.getElementById('pause-screen').style.display = 'flex';
}

function resumeGame() {
    gameState.paused = false;
    document.getElementById('pause-screen').style.display = 'none';
}

function backToMenu() {
    location.reload();
}

function openSettings() {
    document.getElementById('settings-panel').style.display = 'flex';
}

function closeSettings() {
    document.getElementById('settings-panel').style.display = 'none';
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

// デバッグモード（開発用）
let debugMode = false;
document.addEventListener('keydown', (e) => {
    if (e.code === 'F12') {
        debugMode = !debugMode;
    }
});

// デバッグ情報表示
function drawDebugInfo() {
    if (!debugMode) return;
    
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText(`P1: HP=${player1.health} X=${Math.floor(player1.x)} Y=${Math.floor(player1.y)}`, 10, 20);
    ctx.fillText(`P2: HP=${player2.health} X=${Math.floor(player2.x)} Y=${Math.floor(player2.y)}`, 10, 35);
    ctx.fillText(`Round: ${gameState.round} Timer: ${gameState.timer}`, 10, 50);
    ctx.fillText(`Effects: ${effects.length}`, 10, 65);
}

// draw関数にデバッグ情報追加
const originalDraw = draw;
function draw() {
    originalDraw();
    drawDebugInfo();
}