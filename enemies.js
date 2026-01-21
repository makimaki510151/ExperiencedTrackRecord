// ============================================
// 敵定義データ
// ============================================

// 敵タイプ定義（移動方法や攻撃方法の属性を追加）
const ENEMY_TYPES = {
    slime: { 
        name: 'スライム', 
        hp: 30, 
        attack: 5, 
        defense: 1, 
        exp: 10, 
        radius: 10, 
        color: '#339af0',
        moveType: 'random', // ランダムに動き回る
        attackType: 'contact', // 接触によるダメージ
        moveSpeed: 1.5
    },
    goblin: { 
        name: 'ゴブリン', 
        hp: 50, 
        attack: 8, 
        defense: 2, 
        exp: 20, 
        radius: 12, 
        color: '#51cf66',
        moveType: 'chase', // プレイヤーを追いかける
        attackType: 'melee', // 近接攻撃
        moveSpeed: 2.0
    },
    skeleton: { 
        name: 'スケルトン', 
        hp: 80, 
        attack: 12, 
        defense: 4, 
        exp: 40, 
        radius: 14, 
        color: '#dee2e6',
        moveType: 'dash', // 急接近してくる
        attackType: 'melee',
        moveSpeed: 3.5
    },
    orc: { 
        name: 'オーク', 
        hp: 100, 
        attack: 15, 
        defense: 5, 
        exp: 50, 
        radius: 18, 
        color: '#ff6b6b',
        moveType: 'chase',
        attackType: 'heavy', // 攻撃速度は遅いが一撃が重い
        moveSpeed: 1.2
    }
};

// 敵タイプ定義を取得する関数
function getEnemyType(type) {
    return ENEMY_TYPES[type] || ENEMY_TYPES.slime;
}

// 利用可能な敵タイプ一覧を取得
function getAllEnemyTypes() {
    return Object.keys(ENEMY_TYPES);
}