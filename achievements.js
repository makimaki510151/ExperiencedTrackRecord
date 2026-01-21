// ============================================
// 実績定義データ
// ============================================

// 実績定義配列（拡張可能）
// この関数は、ゲームインスタンスを引数に取り、実績の条件チェックに使用します
function createAchievements(game) {
    return [
        // 公開実績
        new Achievement(
            'first_kill',
            '初めての討伐',
            '敵を1体倒す',
            () => game.stats.enemiesKilled >= 1
        ).setPassiveEffects({ attack: 1 }),
        
        new Achievement(
            'kill_10',
            '討伐者',
            '敵を10体倒す',
            () => game.stats.enemiesKilled >= 10
        ).setPassiveEffects({ attack: 3 }),
        
        new Achievement(
            'kill_100',
            '戦士',
            '敵を100体倒す',
            () => game.stats.enemiesKilled >= 100
        ).setPassiveEffects({ attack: 10, maxHp: 20 }),
        
        new Achievement(
            'level_10',
            '成長者',
            'レベル10に到達',
            () => game.player.level >= 10
        ).setPassiveEffects({ maxHp: 30, maxMp: 15 }),
        
        new Achievement(
            'skill_rank_5',
            'スキルマスター',
            'いずれかのスキルをランク5に到達',
            () => game.skillMaster.getAllSkills().some(s => s.rank >= 5)
        ).setPassiveEffects({ maxMp: 20 }),
        
        // 隠し実績
        new Achievement(
            'hidden_no_death',
            '無傷の勇者',
            '一度もダメージを受けずに100体討伐',
            () => game.stats.enemiesKilled >= 100 && game.stats.totalDamageTaken === 0,
            true
        ).setPassiveEffects({ defense: 10, maxHp: 50 }),
        
        new Achievement(
            'hidden_perfect_dodge',
            '回避の極み',
            '一度もダメージを受けない',
            () => game.stats.totalDamageTaken === 0 && game.stats.enemiesKilled >= 50,
            true
        ).setPassiveEffects({ speed: 2 }),
        
        new Achievement(
            'hidden_skill_spam',
            'スキル使い',
            'スキルを1000回使用',
            () => game.stats.totalSkillUses >= 1000,
            true
        ).setPassiveEffects({ maxMp: 30 }),
        
        new Achievement(
            'hidden_level_50',
            '伝説の冒険者',
            'レベル50に到達',
            () => game.player.level >= 50,
            true
        ).setPassiveEffects({ attack: 20, defense: 15, maxHp: 100, maxMp: 50 }),
        
        new Achievement(
            'hidden_all_skills_max',
            'オールマスター',
            '全スキルをランク6に到達',
            () => game.skillMaster.getAllSkills().every(s => s.rank >= 6),
            true
        ).setPassiveEffects({ attack: 15, maxMp: 50 })
        
        // 新しい実績を追加する場合は、ここに定義を追加
        // new Achievement(
        //     'new_achievement',
        //     '新実績',
        //     '説明文',
        //     () => game.stats.enemiesKilled >= 500,
        //     false  // true にすると隠し実績
        // ).setPassiveEffects({ attack: 5 })
    ];
}