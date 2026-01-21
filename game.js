// ============================================
// WebRPG メインゲームロジック
// ============================================

// ゲーム状態管理
class GameState {
    constructor() {
        this.currentScreen = 'baseMenu';
        this.currentDungeon = null;
        this.battleActive = false;
    }

    showScreen(screenId) {
        // すべての画面からactiveクラスを削除
        const allScreens = document.querySelectorAll('.screen');
        allScreens.forEach(screen => {
            screen.classList.remove('active');
            // 確実に非表示にする
            screen.style.display = 'none';
        });

        // 指定された画面を取得
        const targetScreen = document.getElementById(screenId);

        if (!targetScreen) {
            console.error(`画面が見つかりません: ${screenId}`);
            return false;
        }

        // 指定された画面にactiveクラスを追加
        targetScreen.classList.add('active');
        this.currentScreen = screenId;

        // 強制的に表示（CSSクラスで制御されるが、念のため）
        // CSSの!importantが優先されるので、style属性は削除
        targetScreen.style.display = '';

        // デバッグ用ログ
        console.log(`画面を切り替えました: ${screenId}`);
        console.log(`Target screen classes:`, targetScreen.className);
        console.log(`Target screen computed display:`, window.getComputedStyle(targetScreen).display);

        return true;
    }
}

// プレイヤー管理
class Player {
    constructor() {
        this.x = 400;
        this.y = 300;
        this.radius = 15;
        this.speed = 3;
        this.maxHp = 100;
        this.hp = 100;
        this.maxMp = 50;
        this.mp = 50;
        this.attack = 10;
        this.defense = 5;
        this.level = 1;
        this.exp = 0;
        this.expToNext = 100;
        this.mpRegen = 0.05;

        // プレイヤー画像
        this.image = null;
        this.imageLoaded = false;

        // ステータス修正値（称号効果など）
        this.statusModifiers = {
            attack: 0,
            defense: 0,
            maxHp: 0,
            maxMp: 0,
            speed: 0
        };
    }

    // 称号効果を反映したステータスを取得
    getAttack() {
        return this.attack + this.statusModifiers.attack;
    }

    getDefense() {
        return this.defense + this.statusModifiers.defense;
    }

    getMaxHp() {
        return this.maxHp + this.statusModifiers.maxHp;
    }

    getMaxMp() {
        return this.maxMp + this.statusModifiers.maxMp;
    }

    getSpeed() {
        return this.speed + this.statusModifiers.speed;
    }

    takeDamage(amount) {
        const actualDamage = Math.max(1, amount - this.getDefense());
        this.hp = Math.max(0, this.hp - actualDamage);
        return actualDamage;
    }

    heal(amount) {
        this.hp = Math.min(this.getMaxHp(), this.hp + amount);
    }

    restoreMp(amount) {
        this.mp = Math.min(this.getMaxMp(), this.mp + amount);
    }

    consumeMp(amount) {
        if (this.mp >= amount) {
            this.mp -= amount;
            return true;
        }
        return false;
    }

    gainExp(amount) {
        this.exp += amount;
        while (this.exp >= this.expToNext) {
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.exp -= this.expToNext;
        this.expToNext = Math.floor(this.expToNext * 1.5);

        this.maxHp += 10;
        this.maxMp += 5;
        this.attack += 2;
        this.defense += 1;

        this.hp = this.getMaxHp();
        this.mp = this.getMaxMp();

        game.battleLog.addEntry(`レベルアップ！ Lv.${this.level}`, 'levelup');
    }

    update() {
        // MP自動回復（小数点以下の計算を確実に行う）
        if (this.mp < this.getMaxMp()) {
            this.mp = Math.min(this.getMaxMp(), this.mp + this.mpRegen);
        }
    }

    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.image = img;
                this.imageLoaded = true;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // セーブデータ用オブジェクトに変換
    toSaveData() {
        return {
            x: this.x,
            y: this.y,
            maxHp: this.maxHp,
            hp: this.hp,
            maxMp: this.maxMp,
            mp: this.mp,
            attack: this.attack,
            defense: this.defense,
            level: this.level,
            exp: this.exp,
            expToNext: this.expToNext
        };
    }

    // セーブデータから復元
    fromSaveData(data) {
        Object.assign(this, data);
    }
}

// スキルシステム
class Skill {
    constructor(id, name, description, baseCost, baseDamage, element = 'normal', cooldown = 180) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.baseCost = baseCost;
        this.baseDamage = baseDamage;
        this.element = element;
        this.baseCooldown = cooldown; // デフォルト3秒(60fps*3)
        this.currentCooldown = 0;

        // 熟練度システム
        this.usageCount = 0;
        this.rank = 1;

        // ランクアップ閾値（100回、500回、2000回...）
        this.rankThresholds = [0, 100, 500, 2000, 10000, 50000];

        // ランクアップ時の名称変更
        this.rankNames = [
            name, // Rank 1
            `${name}Ⅱ`, // Rank 2
            `${name}Ⅲ`, // Rank 3
            `${name}Ⅳ`, // Rank 4
            `${name}Ⅴ`, // Rank 5
            `${name}∞`  // Rank 6+
        ];
    }

    // 現在の消費MP（熟練度に応じて減少）
    getCurrentCost() {
        // 使用回数に応じて最大50%までコスト減少
        const reduction = Math.min(0.5, this.usageCount * 0.001);
        return Math.max(1, Math.floor(this.baseCost * (1 - reduction)));
    }

    // 現在の威力（熟練度に応じて増加）
    getCurrentDamage() {
        // 使用回数に応じて無制限に威力増加
        const multiplier = 1 + (this.usageCount * 0.01);
        return Math.floor(this.baseDamage * multiplier);
    }

    update() {
        if (this.currentCooldown > 0) {
            this.currentCooldown--;
        }
    }

    isReady() {
        return this.currentCooldown <= 0;
    }

    use() {
        this.usageCount++;
        this.currentCooldown = this.baseCooldown;
        this.checkRankUp();
    }

    // ランクアップチェック
    checkRankUp() {
        let newRank = this.rank;
        for (let i = this.rankThresholds.length - 1; i >= 0; i--) {
            if (this.usageCount >= this.rankThresholds[i]) {
                newRank = Math.max(newRank, i + 1);
                break;
            }
        }

        if (newRank > this.rank) {
            this.rank = newRank;
            game.battleLog.addEntry(`${this.getDisplayName()}のランクが上がった！`, 'levelup');
            game.checkAchievements();
        }
    }

    getDisplayName() {
        if (this.rank <= this.rankNames.length) {
            return this.rankNames[this.rank - 1];
        }
        return this.rankNames[this.rankNames.length - 1];
    }

    // セーブデータ用
    toSaveData() {
        return {
            id: this.id,
            usageCount: this.usageCount,
            rank: this.rank
        };
    }

    fromSaveData(data) {
        this.usageCount = data.usageCount || 0;
        this.rank = data.rank || 1;
    }
}

// スキルマスター（全スキルの定義と管理）
class SkillMaster {
    constructor() {
        // スキル定義配列（拡張可能）
        this.skills = [
            new Skill('fire_ball', 'ファイアボール', '火属性の攻撃魔法', 10, 20, 'fire'),
            new Skill('ice_arrow', 'アイスアロー', '氷属性の攻撃魔法', 12, 25, 'ice'),
            new Skill('thunder', 'サンダー', '雷属性の攻撃魔法', 15, 30, 'thunder'),
            new Skill('heal', 'ヒール', 'HP回復魔法', 8, 30, 'heal'),
            new Skill('power_strike', 'パワーストライク', '物理攻撃スキル', 5, 35, 'physical')
        ];
    }

    getSkill(id) {
        return this.skills.find(s => s.id === id);
    }

    getAllSkills() {
        return this.skills;
    }
}

// 敵管理
class Enemy {
    constructor(x, y, type = 'goblin') {
        this.type = type;

        // 敵タイプ定義は外部ファイル(enemies.js)から取得
        const stats = getEnemyType(type);

        this.name = stats.name;
        this.x = x;
        this.y = y;
        this.radius = stats.radius;
        this.maxHp = stats.hp;
        this.hp = stats.hp;
        this.attack = stats.attack;
        this.defense = stats.defense;
        this.exp = stats.exp;
        this.color = stats.color;

        this.speed = 1.5;
        this.attackCooldown = 0;
        this.attackInterval = 60; // フレーム
    }

    update() {
        // プレイヤーへの追尾
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0 && distance > this.radius + game.player.radius) {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }

        // 攻撃判定
        if (this.attackCooldown > 0) {
            this.attackCooldown--;
        } else if (distance <= this.radius + game.player.radius + 10) {
            this.attackPlayer();
            this.attackCooldown = this.attackInterval;
        }
    }

    attackPlayer() {
        const damage = game.player.takeDamage(this.attack);
        game.stats.totalDamageTaken += damage;
        game.battleLog.addEntry(`${this.name}の攻撃！ ${damage}ダメージ`, 'damage');
        game.createDamagePopup(game.player.x, game.player.y - 30, `-${damage}`);
    }

    takeDamage(amount) {
        const actualDamage = Math.max(1, amount - this.defense);
        this.hp = Math.max(0, this.hp - actualDamage);
        return actualDamage;
    }

    isDead() {
        return this.hp <= 0;
    }
}

// 実績・称号システム
class Achievement {
    constructor(id, name, description, condition, isHidden = false) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.condition = condition; // 条件をチェックする関数
        this.isHidden = isHidden;
        this.unlocked = false;
        this.unlockedAt = null;

        // 称号のパッシブ効果（拡張可能）
        this.passiveEffects = {};
    }

    // パッシブ効果を設定
    setPassiveEffects(effects) {
        this.passiveEffects = effects;
        return this;
    }

    // 実績解除
    unlock() {
        if (!this.unlocked) {
            this.unlocked = true;
            this.unlockedAt = Date.now();

            // パッシブ効果を適用
            if (Object.keys(this.passiveEffects).length > 0) {
                this.applyPassiveEffects();
            }

            game.battleLog.addEntry(`実績解除: ${this.name}`, 'levelup');
            game.checkAchievements(); // 他の実績もチェック
        }
    }

    // パッシブ効果を適用
    applyPassiveEffects() {
        const player = game.player;
        if (this.passiveEffects.attack) {
            player.statusModifiers.attack += this.passiveEffects.attack;
        }
        if (this.passiveEffects.defense) {
            player.statusModifiers.defense += this.passiveEffects.defense;
        }
        if (this.passiveEffects.maxHp) {
            player.statusModifiers.maxHp += this.passiveEffects.maxHp;
            player.hp += this.passiveEffects.maxHp; // HPも増やす
        }
        if (this.passiveEffects.maxMp) {
            player.statusModifiers.maxMp += this.passiveEffects.maxMp;
            player.mp += this.passiveEffects.maxMp; // MPも増やす
        }
        if (this.passiveEffects.speed) {
            player.statusModifiers.speed += this.passiveEffects.speed;
        }
    }

    checkCondition() {
        if (this.unlocked) return true;
        return this.condition();
    }

    // 表示用の名称と説明を取得
    getDisplayName() {
        if (this.isHidden && !this.unlocked) {
            return '？？？';
        }
        return this.name;
    }

    getDisplayDescription() {
        if (this.isHidden && !this.unlocked) {
            return '？？？';
        }
        return this.description;
    }
}

// 実績マスター（全実績の定義）
class AchievementMaster {
    constructor(game) {
        // 実績定義配列は外部ファイル(achievements.js)から取得
        this.achievements = createAchievements(game);
    }

    getAllAchievements() {
        return this.achievements;
    }

    getAchievement(id) {
        return this.achievements.find(a => a.id === id);
    }
}

// ダンジョン定義
class Dungeon {
    constructor(id, name, description, floors) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.floors = floors; // 階層数
        this.currentFloor = 1;
    }
}

// ダンジョンマスター
class DungeonMaster {
    constructor() {
        // ダンジョン定義配列は外部ファイル(dungeons.js)から取得
        this.dungeons = createDungeons();
    }

    getDungeon(id) {
        return this.dungeons.find(d => d.id === id);
    }

    getAllDungeons() {
        return this.dungeons;
    }
}

// 戦闘ログ管理
class BattleLog {
    constructor() {
        this.entries = [];
        this.maxEntries = 50;
    }

    addEntry(text, type = 'normal') {
        this.entries.push({ text, type, timestamp: Date.now() });
        if (this.entries.length > this.maxEntries) {
            this.entries.shift();
        }
        this.updateUI();
    }

    updateUI() {
        const logContent = document.getElementById('logContent');
        if (!logContent) return;

        logContent.innerHTML = this.entries.map(entry => {
            return `<div class="log-entry ${entry.type}">${entry.text}</div>`;
        }).join('');

        // 自動スクロール
        logContent.scrollTop = logContent.scrollHeight;
    }
}

// 入力ハンドラー（キーボード + ゲームパッド）
class InputHandler {
    constructor() {
        this.keys = {};
        this.gamepad = null;
        this.gamepadIndex = null;

        // キーボードイベント
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        // ゲームパッド接続検出
        window.addEventListener('gamepadconnected', (e) => {
            console.log('ゲームパッド接続:', e.gamepad.id);
            this.gamepadIndex = e.gamepad.index;
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            if (e.gamepad.index === this.gamepadIndex) {
                this.gamepadIndex = null;
            }
        });
    }

    isKeyPressed(key) {
        return this.keys[key.toLowerCase()] || false;
    }

    getGamepad() {
        if (this.gamepadIndex !== null) {
            const gamepads = navigator.getGamepads();
            return gamepads[this.gamepadIndex];
        }
        return null;
    }

    // ゲームパッドの方向入力（左スティック）
    getGamepadDirection() {
        const gamepad = this.getGamepad();
        if (!gamepad) return { x: 0, y: 0 };

        const deadzone = 0.2;
        const x = Math.abs(gamepad.axes[0]) > deadzone ? gamepad.axes[0] : 0;
        const y = Math.abs(gamepad.axes[1]) > deadzone ? gamepad.axes[1] : 0;

        return { x, y };
    }

    // ゲームパッドボタン判定（A, B, Xボタン）
    isGamepadButtonPressed(buttonIndex) {
        const gamepad = this.getGamepad();
        if (!gamepad || !gamepad.buttons[buttonIndex]) return false;
        return gamepad.buttons[buttonIndex].pressed;
    }
}

// レンダラー（Canvas描画）
class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // キャンバスサイズ設定
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas) return;
        const container = this.canvas.parentElement;
        if (!container) {
            // 親要素がない場合はウィンドウサイズをフォールバックにする
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            return;
        }
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    clear() {
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // プレイヤー描画
    drawPlayer(x, y, radius) {
        const player = game.player;

        if (player.imageLoaded && player.image) {
            // 画像を描画
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, Math.PI * 2);
            this.ctx.clip();
            this.ctx.drawImage(
                player.image,
                x - radius,
                y - radius,
                radius * 2,
                radius * 2
            );
            this.ctx.restore();
        } else {
            // デフォルト：円形で描画
            this.ctx.fillStyle = '#ffd700';
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, Math.PI * 2);
            this.ctx.fill();

            // 目を描画
            this.ctx.fillStyle = '#000';
            this.ctx.beginPath();
            this.ctx.arc(x - 5, y - 3, 3, 0, Math.PI * 2);
            this.ctx.arc(x + 5, y - 3, 3, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // HPバー
        const barWidth = radius * 2;
        const barHeight = 4;
        const barX = x - radius;
        const barY = y - radius - 10;

        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        const hpRatio = player.hp / player.getMaxHp();
        this.ctx.fillStyle = hpRatio > 0.5 ? '#51cf66' : hpRatio > 0.25 ? '#ffd43b' : '#ff6b6b';
        this.ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
    }

    // 敵描画
    drawEnemy(enemy) {
        // 本体
        this.ctx.fillStyle = enemy.color;
        this.ctx.beginPath();
        this.ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        this.ctx.fill();

        // HPバー
        const barWidth = enemy.radius * 2;
        const barHeight = 3;
        const barX = enemy.x - enemy.radius;
        const barY = enemy.y - enemy.radius - 8;

        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        const hpRatio = enemy.hp / enemy.maxHp;
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

        // 名前
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '10px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(enemy.name, enemy.x, enemy.y - enemy.radius - 15);
    }

    // ダメージポップアップ描画
    drawDamagePopup(x, y, text) {
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.font = 'bold 16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(text, x, y);
    }

    drawAttackLine(startX, startY, endX, endY, color) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
    }
}

// UI管理
class UIManager {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.selectedSkillIds = []; // 選択されたスキルIDを保持
    }

    initEventListeners() {
        // this.gameをローカル変数に保存して、thisのコンテキスト問題を回避
        const gameInstance = this.game;

        if (!gameInstance) {
            console.error('UIManager: gameInstance is undefined! Cannot initialize event listeners.');
            return;
        }

        console.log('initEventListeners called, gameInstance:', gameInstance);

        // 拠点メニュー
        const btnDungeon = document.getElementById('btnDungeon');
        if (btnDungeon) {
            btnDungeon.addEventListener('click', () => {
                console.log('btnDungeon clicked');
                try {
                    gameInstance.showDungeonSelect();
                } catch (e) {
                    console.error('Error in showDungeonSelect:', e);
                }
            });
        } else {
            console.error('btnDungeon element not found!');
        }

        const btnSkills = document.getElementById('btnSkills');
        if (btnSkills) {
            btnSkills.addEventListener('click', () => {
                console.log('btnSkills clicked');
                try {
                    gameInstance.showSkillList();
                } catch (e) {
                    console.error('Error in showSkillList:', e);
                }
            });
        } else {
            console.error('btnSkills element not found!');
        }

        const btnAchievements = document.getElementById('btnAchievements');
        if (btnAchievements) {
            btnAchievements.addEventListener('click', () => {
                console.log('btnAchievements clicked');
                try {
                    gameInstance.showAchievementList();
                } catch (e) {
                    console.error('Error in showAchievementList:', e);
                }
            });
        } else {
            console.error('btnAchievements element not found!');
        }

        const btnSettings = document.getElementById('btnSettings');
        if (btnSettings) {
            btnSettings.addEventListener('click', () => {
                // 設定画面は未実装
                console.log('設定画面は未実装です');
            });
        }

        // ダンジョン選択
        const btnBackToBase = document.getElementById('btnBackToBase');
        if (btnBackToBase) {
            btnBackToBase.addEventListener('click', () => {
                console.log('btnBackToBase clicked');
                gameInstance.showBaseMenu();
            });
        } else {
            console.error('btnBackToBase element not found!');
        }

        // リザルト画面
        const btnReturnToBase = document.getElementById('btnReturnToBase');
        if (btnReturnToBase) {
            btnReturnToBase.addEventListener('click', () => {
                console.log('btnReturnToBase clicked');
                gameInstance.showBaseMenu();
            });
        } else {
            console.error('btnReturnToBase element not found!');
        }

        // スキル・実績画面
        const btnBackToBase2 = document.getElementById('btnBackToBase2');
        if (btnBackToBase2) {
            btnBackToBase2.addEventListener('click', () => {
                console.log('btnBackToBase2 clicked');
                gameInstance.showBaseMenu();
            });
        } else {
            console.error('btnBackToBase2 element not found!');
        }

        const btnBackToBase3 = document.getElementById('btnBackToBase3');
        if (btnBackToBase3) {
            btnBackToBase3.addEventListener('click', () => {
                console.log('btnBackToBase3 clicked');
                gameInstance.showBaseMenu();
            });
        } else {
            console.error('btnBackToBase3 element not found!');
        }

        // プレイヤー画像アップロード
        const imageInput = document.getElementById('playerImageInput');
        if (imageInput) {
            imageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    gameInstance.player.loadImage(file);
                }
            });
        }

        const btnResetPlayerImage = document.getElementById('btnResetPlayerImage');
        if (btnResetPlayerImage) {
            btnResetPlayerImage.addEventListener('click', () => {
                gameInstance.player.image = null;
                gameInstance.player.imageLoaded = false;
                if (imageInput) imageInput.value = '';
            });
        }
    }

    updateStatus() {
        const player = this.game.player;
        const statusContent = document.getElementById('statusContent');
        if (!statusContent) return;

        statusContent.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">レベル</span>
            <span class="stat-value">${player.level}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">HP</span>
            <span class="stat-value">${Math.floor(player.hp)} / ${player.getMaxHp()}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">MP</span>
            <span class="stat-value">${Math.floor(player.mp)} / ${player.getMaxMp()}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">攻撃力</span>
            <span class="stat-value">${player.getAttack()}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">防御力</span>
            <span class="stat-value">${player.getDefense()}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">経験値</span>
            <span class="stat-value">${player.exp} / ${player.expToNext}</span>
        </div>
    `;
    }

    updateSkills() {
        const skillContent = document.getElementById('skillContent');
        if (!skillContent) return;

        const skills = this.game.skillMaster.getAllSkills();
        skillContent.innerHTML = skills.map(skill => {
            const cost = skill.getCurrentCost();
            const damage = skill.getCurrentDamage();
            const rankClass = skill.rank > 1 ? 'rank-up' : '';

            return `
                <div class="skill-item ${rankClass}">
                    <div class="skill-name">${skill.getDisplayName()}</div>
                    <div class="skill-rank">ランク ${skill.rank}</div>
                    <div class="skill-proficiency">使用回数: ${skill.usageCount}</div>
                    <div style="font-size: 0.85em; color: #aaa;">
                        消費MP: ${cost} | 威力: ${damage}
                    </div>
                </div>
            `;
        }).join('');
    }

    updateAchievements() {
        const achievementContent = document.getElementById('achievementContent');
        if (!achievementContent) return;

        const achievements = this.game.achievementMaster.getAllAchievements();
        achievementContent.innerHTML = achievements.slice(0, 5).map(achievement => {
            const unlockedClass = achievement.unlocked ? 'unlocked' : 'locked';
            return `
                <div class="achievement-item ${unlockedClass}">
                    <div class="achievement-name">${achievement.getDisplayName()}</div>
                    <div class="achievement-desc ${achievement.isHidden && !achievement.unlocked ? 'achievement-hidden' : ''}">
                        ${achievement.getDisplayDescription()}
                    </div>
                </div>
            `;
        }).join('');
    }

    updateDungeonList() {
        const dungeonList = document.getElementById('dungeonList');
        if (!dungeonList) {
            console.error('dungeonList element not found!');
            return;
        }

        const gameInstance = this.game;
        const dungeons = gameInstance.dungeonMaster.getAllDungeons();
        dungeonList.innerHTML = dungeons.map(dungeon => {
            return `
                <div class="dungeon-item" data-dungeon-id="${dungeon.id}">
                    <h3>${dungeon.name}</h3>
                    <p>${dungeon.description}</p>
                    <p>階層数: ${dungeon.floors}</p>
                </div>
            `;
        }).join('');

        // ダンジョン選択イベント（既存のイベントリスナーを削除してから追加）
        dungeonList.querySelectorAll('.dungeon-item').forEach(item => {
            // 既存のイベントリスナーを削除（クローンで回避）
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);

            newItem.addEventListener('click', (e) => {
                e.stopPropagation(); // イベントの伝播を停止
                const dungeonId = newItem.dataset.dungeonId;
                console.log('Dungeon clicked:', dungeonId);
                if (dungeonId && !gameInstance.battleActive) {
                    gameInstance.startDungeon(dungeonId);
                } else if (gameInstance.battleActive) {
                    console.log('Battle already active, ignoring dungeon click');
                }
            });
        });
    }

    updateSkillDetailList() {
        const container = document.getElementById('skillDetailContent');
        const skills = this.game.skillMaster.getAllSkills();

        container.innerHTML = skills.map(skill => {
            const isSelected = this.selectedSkillIds.includes(skill.id);
            return `
                <div class="achievement-item skill-select-item ${isSelected ? 'selected' : ''}" 
                     onclick="game.uiManager.toggleSkillSelection('${skill.id}')">
                    <div class="achievement-name">${skill.getDisplayName()}</div>
                    <div class="achievement-desc">${skill.description}</div>
                    <div style="font-size: 0.8em; margin-top: 5px; color: #aaa;">
                        MP: ${skill.getCurrentCost()} | CD: ${Math.round(skill.baseCooldown / 60)}s
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('selectedSkillCount').innerText = this.selectedSkillIds.length;
    }

    toggleSkillSelection(skillId) {
        const index = this.selectedSkillIds.indexOf(skillId);
        if (index > -1) {
            // 選択解除
            this.selectedSkillIds.splice(index, 1);
        } else {
            // 3つ未満なら追加可能
            if (this.selectedSkillIds.length < 3) {
                this.selectedSkillIds.push(skillId);
            } else {
                // すでに3つ選択されている場合は、古いものを1つ消して新しいものを入れる
                // または、何もしない（今回は後者を採用し、メッセージを表示）
                console.log('スキルは最大3つまでです');
                return;
            }
        }

        // プレイヤーの装備スキルに同期
        this.game.player.equippedSkills = [...this.selectedSkillIds];
        // UIを更新
        this.updateSkillDetailList();
    }
}

// セーブ/ロードシステム
class SaveSystem {
    static save() {
        if (!game.achievementMaster) {
            console.warn('achievementMasterが初期化されていません。セーブをスキップします。');
            return;
        }

        const saveData = {
            player: game.player.toSaveData(),
            skills: game.skillMaster.getAllSkills().map(s => s.toSaveData()),
            achievements: game.achievementMaster.getAllAchievements().map(a => ({
                id: a.id,
                unlocked: a.unlocked,
                unlockedAt: a.unlockedAt
            })),
            stats: game.stats,
            version: '1.0'
        };

        localStorage.setItem('webrpg_save', JSON.stringify(saveData));
        console.log('ゲームをセーブしました');
    }

    static load() {
        const saveDataStr = localStorage.getItem('webrpg_save');
        if (!saveDataStr) {
            console.log('セーブデータが見つかりません');
            return false;
        }

        try {
            const saveData = JSON.parse(saveDataStr);

            // プレイヤーデータ復元
            game.player.fromSaveData(saveData.player);

            // スキルデータ復元
            saveData.skills.forEach(skillData => {
                const skill = game.skillMaster.getSkill(skillData.id);
                if (skill) {
                    skill.fromSaveData(skillData);
                }
            });

            // 実績データ復元
            if (game.achievementMaster) {
                saveData.achievements.forEach(achievementData => {
                    const achievement = game.achievementMaster.getAchievement(achievementData.id);
                    if (achievement) {
                        achievement.unlocked = achievementData.unlocked;
                        achievement.unlockedAt = achievementData.unlockedAt;
                        if (achievement.unlocked) {
                            achievement.applyPassiveEffects();
                        }
                    }
                });
            }

            // 統計データ復元
            if (saveData.stats) {
                game.stats = { ...game.stats, ...saveData.stats };
            }

            console.log('ゲームをロードしました');
            return true;
        } catch (e) {
            console.error('セーブデータの読み込みに失敗:', e);
            return false;
        }
    }
}

// メインゲームクラス
class Game {
    constructor() {
        this.canvas = null;
        this.ctx = null;

        // ゲーム状態
        this.state = new GameState();
        this.player = new Player();
        this.skillMaster = new SkillMaster();
        // AchievementMasterはgameインスタンスが必要なため、後で初期化
        this.achievementMaster = null;
        this.dungeonMaster = new DungeonMaster();
        this.inputHandler = new InputHandler();
        this.battleLog = new BattleLog();
        this.uiManager = new UIManager(this);
        this.renderer = null;

        // 戦闘関連
        this.enemies = [];
        this.currentDungeon = null;
        this.currentFloor = 1;
        this.battleActive = false;

        // 統計
        this.stats = {
            enemiesKilled: 0,
            totalDamageTaken: 0,
            totalSkillUses: 0
        };

        // ダメージポップアップ
        this.damagePopups = [];

        // フレームカウンター
        this.frameCount = 0;
    }

    init() {
        // DOM要素の存在確認
        const baseMenu = document.getElementById('baseMenu');
        if (!baseMenu) {
            console.error('baseMenu要素が見つかりません。DOMの読み込みを確認してください。');
            return;
        }

        // キャンバス初期化
        this.renderer = new Renderer('gameCanvas');

        // AchievementMasterを初期化（gameインスタンスが必要）
        this.achievementMaster = new AchievementMaster(this);

        // UIイベントリスナー初期化（DOM要素が読み込まれた後）
        this.uiManager.initEventListeners();

        // セーブデータ読み込み
        SaveSystem.load();

        // 初期画面の確認と設定
        // HTMLで既にactiveクラスが設定されているが、念のため確認
        const currentActiveScreen = document.querySelector('.screen.active');
        if (!currentActiveScreen || currentActiveScreen.id !== 'baseMenu') {
            // 初期画面がbaseMenuでない場合、baseMenuに切り替える
            this.showBaseMenu();
        } else {
            // ステータスプレビュー更新のみ実行
            this.updateStatusPreview();
        }

        // ゲームループ開始
        this.gameLoop();

        // 定期的にセーブ（30秒ごと）
        setInterval(() => {
            SaveSystem.save();
        }, 30000);

        // ページ離脱時にセーブ
        window.addEventListener('beforeunload', () => {
            SaveSystem.save();
        });
    }

    // 画面切り替えメソッド
    // 拠点メニュー画面を表示
    showBaseMenu() {
        if (!this.state) {
            console.error('GameState is not initialized');
            return;
        }
        this.state.showScreen('baseMenu');
        this.updateStatusPreview();
    }

    // ダンジョン選択画面を表示
    showDungeonSelect() {
        if (!this.state) {
            console.error('GameState is not initialized');
            return;
        }
        this.state.showScreen('dungeonSelect');
        // ダンジョンリストを更新
        this.uiManager.updateDungeonList();
    }

    // スキル一覧画面を表示
    showSkillList() {
        if (!this.state) {
            console.error('GameState is not initialized');
            return;
        }
        this.state.showScreen('skillScreen');
        // スキル詳細を更新
        this.updateSkillDetail();
    }

    // 実績一覧画面を表示
    showAchievementList() {
        if (!this.state) {
            console.error('GameState is not initialized');
            return;
        }
        this.state.showScreen('achievementScreen');
        // 実績詳細を更新
        this.updateAchievementDetail();
    }

    // ダンジョン開始処理
    startDungeon(dungeonId) {
        this.currentDungeon = this.dungeonMaster.getDungeon(dungeonId);
        this.currentFloor = 1;
        this.player.hp = this.player.getMaxHp();
        this.player.mp = this.player.getMaxMp();

        // 修正: startBattleを呼んで敵生成と画面切り替えを行う
        this.startBattle();
    }

    // スキル装備ロジックの追加
    toggleSkillEquip(skillId) {
        if (!this.player.equippedSkills) this.player.equippedSkills = [];

        const index = this.player.equippedSkills.indexOf(skillId);
        if (index > -1) {
            // すでに装備済みなら外す
            this.player.equippedSkills.splice(index, 1);
        } else {
            // 3つまでしか装備できない制限
            if (this.player.equippedSkills.length < 3) {
                this.player.equippedSkills.push(skillId);
            } else {
                alert("セットできるスキルは3つまでです。");
                return;
            }
        }
        this.uiManager.updateSkillScreen();
    }

    startBattle() {
        console.log('startBattle called');

        // 戦闘中の場合は何もしない
        if (this.battleActive) {
            console.log('Battle already active, ignoring startBattle');
            return;
        }

        // 画面切り替え
        this.state.showScreen('battleScreen');

        // キャンバスサイズを確実に取得
        this.renderer.resize();
        const canvasWidth = this.renderer.canvas.width || 800;
        const canvasHeight = this.renderer.canvas.height || 600;
        console.log('canvas size:', canvasWidth, canvasHeight);

        // プレイヤー位置リセット
        this.player.x = canvasWidth / 2;
        this.player.y = canvasHeight / 2;

        // 戦闘状態を設定
        this.battleActive = true;
        this.enemies = [];

        // 敵生成
        this.generateEnemies();
        console.log('Enemies generated:', this.enemies.length);

        // 敵が生成されていない場合はエラー
        if (this.enemies.length === 0) {
            console.error('No enemies generated!');
            this.battleActive = false;
            this.showBaseMenu();
            return;
        }

        this.battleLog.addEntry(`階層 ${this.currentFloor} に突入！`);
    }

    generateEnemies() {
        this.enemies = [];
        const enemyCount = 3 + this.currentFloor;
        console.log('generateEnemies called, enemyCount:', enemyCount, 'floor:', this.currentFloor);

        for (let i = 0; i < enemyCount; i++) {
            const angle = (Math.PI * 2 / enemyCount) * i;
            const distance = 200;
            const x = this.player.x + Math.cos(angle) * distance;
            const y = this.player.y + Math.sin(angle) * distance;

            // 階層に応じて敵タイプを決定
            let enemyType = 'goblin';
            if (this.currentFloor >= 3) enemyType = 'orc';
            if (this.currentFloor >= 5) enemyType = 'skeleton';

            const enemy = new Enemy(x, y, enemyType);
            this.enemies.push(enemy);
            console.log(`Enemy ${i + 1} created: ${enemy.name} at (${x.toFixed(1)}, ${y.toFixed(1)})`);
        }
        console.log('Total enemies generated:', this.enemies.length);
    }

    // プレイヤー移動処理
    handlePlayerMovement() {
        let dx = 0;
        let dy = 0;

        // キーボード入力
        if (this.inputHandler.isKeyPressed('w') || this.inputHandler.isKeyPressed('arrowup')) {
            dy -= 1;
        }
        if (this.inputHandler.isKeyPressed('s') || this.inputHandler.isKeyPressed('arrowdown')) {
            dy += 1;
        }
        if (this.inputHandler.isKeyPressed('a') || this.inputHandler.isKeyPressed('arrowleft')) {
            dx -= 1;
        }
        if (this.inputHandler.isKeyPressed('d') || this.inputHandler.isKeyPressed('arrowright')) {
            dx += 1;
        }

        // ゲームパッド入力
        const gamepadDir = this.inputHandler.getGamepadDirection();
        dx += gamepadDir.x;
        dy += gamepadDir.y;

        // 正規化
        if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;

            const speed = this.player.getSpeed();
            const newX = this.player.x + dx * speed;
            const newY = this.player.y + dy * speed;

            // 画面内に制限
            const margin = this.player.radius;
            this.player.x = Math.max(margin, Math.min(this.renderer.canvas.width - margin, newX));
            this.player.y = Math.max(margin, Math.min(this.renderer.canvas.height - margin, newY));
        }
    }

    // スキル発動処理
    handleSkillInput() {
        const skills = this.skillMaster.getAllSkills();
        const skillKeys = ['z', 'x', 'c', 'v', 'b'];

        for (let i = 0; i < Math.min(skills.length, skillKeys.length); i++) {
            if (this.inputHandler.isKeyPressed(skillKeys[i]) ||
                this.inputHandler.isGamepadButtonPressed(i)) {

                // 連続入力防止（キーボード用）
                const key = `skill_${i}`;
                if (!this.lastSkillFrame || this.frameCount - this.lastSkillFrame > 10) {
                    this.useSkill(skills[i]);
                    this.lastSkillFrame = this.frameCount;
                }
            }
        }
    }

    useSkill(skill) {
        const cost = skill.getCurrentCost();
        if (!this.player.consumeMp(cost)) {
            this.battleLog.addEntry('MPが足りません！');
            return;
        }

        skill.use();
        this.stats.totalSkillUses++;

        if (skill.element === 'heal') {
            const healAmount = skill.getCurrentDamage();
            this.player.heal(healAmount);
            this.battleLog.addEntry(`${skill.getDisplayName()}！ ${healAmount}回復`, 'heal');
            this.createDamagePopup(this.player.x, this.player.y - 30, `+${healAmount}`, '#51cf66');
        } else {
            if (this.enemies.length > 0) {
                let nearestEnemy = null;
                let nearestDistance = Infinity;

                this.enemies.forEach(enemy => {
                    const dx = enemy.x - this.player.x;
                    const dy = enemy.y - this.player.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestEnemy = enemy;
                    }
                });

                if (nearestEnemy) {
                    const damage = skill.getCurrentDamage();
                    const actualDamage = nearestEnemy.takeDamage(damage);

                    // 攻撃の描画：エフェクトをポップアップとして登録（一瞬だけ線を表示するためのフラグ等）
                    // 簡易的にRendererで直接描画命令を送るか、エフェクトリストに追加する
                    this.lastAttackEffect = {
                        startX: this.player.x,
                        startY: this.player.y,
                        endX: nearestEnemy.x,
                        endY: nearestEnemy.y,
                        color: skill.element === 'fire' ? '#ff4500' :
                            skill.element === 'ice' ? '#00ffff' : '#ffff00',
                        life: 10
                    };

                    this.battleLog.addEntry(`${skill.getDisplayName()}！ ${nearestEnemy.name}に${actualDamage}ダメージ`, 'damage');
                    this.createDamagePopup(nearestEnemy.x, nearestEnemy.y - 30, `-${actualDamage}`);

                    if (nearestEnemy.isDead()) {
                        this.killEnemy(nearestEnemy);
                    }
                }
            }
        }
    }

    killEnemy(enemy) {
        console.log('killEnemy called, enemy:', enemy.name);
        this.enemies = this.enemies.filter(e => e !== enemy);
        this.player.gainExp(enemy.exp);
        this.stats.enemiesKilled++;
        this.battleLog.addEntry(`${enemy.name}を倒した！ +${enemy.exp}EXP`);

        // 全敵撃破時
        console.log('Remaining enemies:', this.enemies.length);
        if (this.enemies.length === 0) {
            console.log('All enemies defeated, calling completeFloor');
            this.completeFloor();
        }
    }

    completeFloor() {
        console.log('completeFloor called, currentFloor:', this.currentFloor, 'maxFloors:', this.currentDungeon.floors);

        if (!this.currentDungeon) {
            this.battleActive = false;
            this.showBaseMenu();
            return;
        }

        if (this.currentFloor < this.currentDungeon.floors) {
            this.battleLog.addEntry(`階層 ${this.currentFloor} クリア！ 次の階層へ進む準備をしてください。`);
            // 自動で進む setTimeout 処理を削除しました
        } else {
            this.completeDungeon();
        }
    }

    completeDungeon() {
        console.log('completeDungeon called');
        if (!this.battleActive) {
            console.log('Battle not active, ignoring completeDungeon');
            return;
        }
        this.battleActive = false;
        this.showResult(true);
    }

    checkGameOver() {
        if (this.player.hp <= 0) {
            this.battleActive = false;
            this.showResult(false);
        }
    }

    showResult(victory) {
        console.log('showResult called, victory:', victory);
        this.battleActive = false;
        this.state.showScreen('resultScreen');
        const resultTitle = document.getElementById('resultTitle');
        const resultContent = document.getElementById('resultContent');

        if (!resultTitle || !resultContent) {
            console.error('Result screen elements not found!');
            this.showBaseMenu();
            return;
        }

        if (victory && this.currentDungeon) {
            resultTitle.textContent = 'ダンジョンクリア！';
            resultContent.innerHTML = `
                <p>おめでとうございます！</p>
                <p>${this.currentDungeon.name}を完全制覇しました！</p>
            `;
        } else {
            resultTitle.textContent = 'ゲームオーバー';
            resultContent.innerHTML = `
                <p>体力が尽きました...</p>
                <p>経験値は保持されています。</p>
            `;
        }

        SaveSystem.save();
    }

    createDamagePopup(x, y, text, color = '#ff6b6b') {
        this.damagePopups.push({
            x, y, text, color,
            life: 60,
            offsetY: 0
        });
    }

    updateDamagePopups() {
        this.damagePopups = this.damagePopups.filter(popup => {
            popup.life--;
            popup.offsetY -= 2;
            return popup.life > 0;
        });
    }

    checkAchievements() {
        this.achievementMaster.getAllAchievements().forEach(achievement => {
            if (!achievement.unlocked && achievement.checkCondition()) {
                achievement.unlock();
            }
        });
    }

    updateStatusPreview() {
        const preview = document.getElementById('statusPreviewContent');
        if (!preview) return;

        const player = this.player;
        preview.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">レベル</span>
            <span class="stat-value">${player.level}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">HP</span>
            <span class="stat-value">${Math.floor(player.hp)} / ${player.getMaxHp()}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">MP</span>
            <span class="stat-value">${Math.floor(player.mp)} / ${player.getMaxMp()}</span>
        </div>
    `;
    }

    updateSkillDetail() {
        const content = document.getElementById('skillDetailContent');
        if (!content) return;

        const skills = this.skillMaster.getAllSkills();
        content.innerHTML = skills.map(skill => {
            const cost = skill.getCurrentCost();
            const damage = skill.getCurrentDamage();
            const isSelected = this.uiManager.selectedSkillIds.includes(skill.id);

            return `
            <div class="skill-item ${skill.rank > 1 ? 'rank-up' : ''} ${isSelected ? 'selected' : ''}" 
                 onclick="game.uiManager.toggleSkillSelection('${skill.id}')"
                 style="cursor: pointer; border: ${isSelected ? '2px solid #ffd700' : '1px solid #444'};">
                <div class="skill-name">${skill.getDisplayName()} ${isSelected ? ' (装備中)' : ''}</div>
                <div class="skill-rank">ランク ${skill.rank} | 使用回数: ${skill.usageCount}</div>
                <div style="margin-top: 5px;">${skill.description}</div>
                <div style="margin-top: 5px; color: #aaa;">
                    消費MP: ${cost} | 威力: ${damage}
                </div>
            </div>
        `;
        }).join('');

        // スキル選択数の表示更新（HTMLに要素がある場合）
        const countDisplay = document.getElementById('selectedSkillCount');
        if (countDisplay) {
            countDisplay.innerText = this.uiManager.selectedSkillIds.length;
        }
    }

    updateAchievementDetail() {
        const content = document.getElementById('achievementDetailContent');
        if (!content) {
            console.error('achievementDetailContent element not found!');
            return;
        }
        console.log('updateAchievementDetail called, content found:', !!content);

        const achievements = this.achievementMaster.getAllAchievements();
        console.log('Achievements found:', achievements.length);
        const unlockedCount = achievements.filter(a => a.unlocked).length;

        content.innerHTML = `
            <div style="margin-bottom: 20px; padding: 10px; background: rgba(102, 126, 234, 0.2); border-radius: 5px;">
                解除済み: ${unlockedCount} / ${achievements.length}
            </div>
            ${achievements.map(achievement => {
            const unlockedClass = achievement.unlocked ? 'unlocked' : 'locked';
            return `
                    <div class="achievement-item ${unlockedClass}">
                        <div class="achievement-name">${achievement.getDisplayName()}</div>
                        <div class="achievement-desc ${achievement.isHidden && !achievement.unlocked ? 'achievement-hidden' : ''}">
                            ${achievement.getDisplayDescription()}
                        </div>
                        ${achievement.unlocked ? `<div style="color: #51cf66; font-size: 0.9em; margin-top: 5px;">解除済み</div>` : ''}
                    </div>
                `;
        }).join('')}
        `;
    }

    spawnEnemy() {
        if (!this.currentDungeon || !this.battleActive) return;

        const dungeonData = this.currentDungeon; // dungeons.jsで定義したデータ
        const spawnList = dungeonData.spawnList || ['slime'];
        const randomType = spawnList[Math.floor(Math.random() * spawnList.length)];
        const enemyData = getEnemyType(randomType);

        // キャンバスの端の方にランダムで出現させる
        const x = Math.random() > 0.5 ? 0 : this.canvas.width;
        const y = Math.random() * this.canvas.height;

        const enemy = new Enemy(x, y, enemyData);
        this.enemies.push(enemy);
        console.log(`Enemy spawned: ${enemyData.name}`);
    }

    // ゲームループ
    gameLoop() {
        this.frameCount++;

        if (this.inputHandler.isKeyPressed('escape')) {
            this.battleActive = false;
            this.showBaseMenu();
            return;
        }

        if (this.battleActive && this.state.currentScreen === 'battleScreen') {
            // 1. MP自動回復などの更新を呼び出す
            this.player.update();

            this.handlePlayerMovement();
            this.handleSkillInput();
            this.enemies.forEach(enemy => enemy.update());
            this.updateDamagePopups();
            this.checkGameOver();

            if (this.frameCount % 60 === 0) {
                this.checkAchievements();
            }

            if (this.frameCount % this.currentDungeon.spawnInterval === 0) {
                this.spawnEnemy();
            }

            if (this.inputHandler.isKeyPressed('1')) this.useEquippedSkill(0);
            if (this.inputHandler.isKeyPressed('2')) this.useEquippedSkill(1);
            if (this.inputHandler.isKeyPressed('3')) this.useEquippedSkill(2);

            this.uiManager.updateStatus();
            this.uiManager.updateSkills();
            this.uiManager.updateAchievements();
            this.render();
        }
        requestAnimationFrame(() => this.gameLoop());
    }

    returnToBase() {
        this.battleActive = false;
        this.enemies = [];
        this.state.showScreen('baseMenu');
    }

    render() {
        this.renderer.clear();

        // 攻撃エフェクトの描画
        if (this.lastAttackEffect && this.lastAttackEffect.life > 0) {
            this.renderer.drawAttackLine(
                this.lastAttackEffect.startX,
                this.lastAttackEffect.startY,
                this.lastAttackEffect.endX,
                this.lastAttackEffect.endY,
                this.lastAttackEffect.color
            );
            this.lastAttackEffect.life--;
        }

        this.renderer.drawPlayer(this.player.x, this.player.y, this.player.radius);
        this.enemies.forEach(enemy => this.renderer.drawEnemy(enemy));

        // ダメージポップアップ描画
        this.damagePopups.forEach(popup => {
            const alpha = popup.life / 60;
            this.renderer.ctx.save();
            this.renderer.ctx.globalAlpha = alpha;
            this.renderer.ctx.fillStyle = popup.color;
            this.renderer.ctx.font = 'bold 16px sans-serif';
            this.renderer.ctx.textAlign = 'center';
            this.renderer.ctx.fillText(popup.text, popup.x, popup.y + popup.offsetY);
            this.renderer.ctx.restore();
        });
    }
}

// ゲームインスタンス作成と初期化
const game = new Game();
window.addEventListener('DOMContentLoaded', () => {
    game.init();
});