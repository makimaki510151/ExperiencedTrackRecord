// ============================================
// ダンジョン定義データ
// ============================================

// ダンジョン定義配列（拡張可能）
function createDungeons() {
    return [
        { 
            id: 'cave_1', 
            name: '始まりの洞窟', 
            description: '敵が無限に現れる洞窟', 
            spawnList: ['slime', 'goblin'], 
            spawnInterval: 180 // 3秒ごと
        },
        { 
            id: 'forest_1', 
            name: '魔の森', 
            description: '中級者向けの森', 
            spawnList: ['goblin', 'orc', 'skeleton'], 
            spawnInterval: 120 
        }
    ];
}