// ============================================
// 敵定義データ
// ============================================

// 敵タイプ定義（拡張可能）
const ENEMY_TYPES = {
    goblin: { 
        name: 'ゴブリン', 
        hp: 50, 
        attack: 8, 
        defense: 2, 
        exp: 20, 
        radius: 12, 
        color: '#51cf66' 
    },
    orc: { 
        name: 'オーク', 
        hp: 100, 
        attack: 15, 
        defense: 5, 
        exp: 50, 
        radius: 18, 
        color: '#ff6b6b' 
    },
    slime: { 
        name: 'スライム', 
        hp: 30, 
        attack: 5, 
        defense: 1, 
        exp: 10, 
        radius: 10, 
        color: '#339af0' 
    },
    skeleton: { 
        name: 'スケルトン', 
        hp: 80, 
        attack: 12, 
        defense: 4, 
        exp: 40, 
        radius: 14, 
        color: '#dee2e6' 
    }
    // 新しい敵を追加する場合は、ここに定義を追加
    // dragon: {
    //     name: 'ドラゴン',
    //     hp: 500,
    //     attack: 50,
    //     defense: 20,
    //     exp: 500,
    //     radius: 25,
    //     color: '#ff4500'
    // }
};

// 敵タイプ定義を取得する関数
function getEnemyType(type) {
    return ENEMY_TYPES[type] || ENEMY_TYPES.goblin;
}

// 利用可能な敵タイプ一覧を取得
function getAllEnemyTypes() {
    return Object.keys(ENEMY_TYPES);
}