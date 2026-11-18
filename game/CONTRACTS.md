# Batomon Loop — Data Contracts (engine: Verdant Struggle)

Engine owns: run state (Day/coins/board), shop mode, merge-3, auto-battle (existing
showdown engine), trainer-passive hook, seeded async-opponent snapshots.
All JSON below lands in `game/data/` and is fetched at boot; engine validates
required fields only and ignores extras. IDs must match MONSPEC1 species ids.

## 1. trainers.json  (Manus — min 3)
```json
[{
  "id": "redhead",              // kebab, stable
  "name": "Redhead",
  "portrait": "redhead.png",    // under assets/portraits/, 128x128
  "hp": 300,                    // Day-1 trainer HP
  "passive": {
    "on": "victory",            // victory | battleStart | defeat
    "effect": { "type": "burn", // burn | shield | income | atk | spd | cooldown
                "amount": 3,
                "target": "fire", // fire|grass|electric|water|ghost|all|leftmost|rightmost
                "permanent": true }
  },
  "text": "On Victory: give your Fire monsters +3 Burn permanently."
}]
```

## 2. monsters.json  (Manus — all 20 MONSPEC1 species)
```json
[{
  "id": "embercub",             // MUST equal existing species id in data.js
  "cost": 10,                    // shop price, coins; $10 early / $15 late tier
  "hp": 42, "atk": 9, "spd": 7,  // base stats at Lv1 (merge Lv2 x1.5, Lv3 x2.25 hp/atk)
  "element": "Ember",            // Ember=Fire Verdant=Grass Volt=Electric Tide=Water Gloom=Ghost
  "ability": { "type": "kindle", // kindle=Burn overload=multicast dread=fear/debuff
                                            // bulwark=shield riposte=counter
               "value": 2 },
  "mergeable": true
}]
```

## 3. trinkets.json  (Manus — 8..12)
```json
[{
  "id": "fools_gold",
  "name": "Fool's Gold",
  "icon": "fools_gold.png",      // 64x64, sprite sheet OK (row of 4)
  "effect": { "type": "income",  // income | reroll_free | column_spd | add_type | multicast | cooldown | burn_on_cast
              "value": 15, "extra": null },
  "text": "+$15 income; shop stops stocking items."
}]
```

## 4. items.json  (Manus — shop consumables, 4..6)
Same shape as trinkets but `consumable: true` (bought onto a monster, not carried).

## UI asset manifest (Muse — quilt style, extends REQMWLM8MU7 pack)
9-slice safe (uniform border band, flat center), sizes final, delivered as one zip +
sha256 via /f/ link like last time. Engine loads them through existing `uiImg(name)`:

| file (assets/ui/)       | size    | used by                       |
|-------------------------|---------|-------------------------------|
| trainer_frame.png       | 768x256 | trainer-select card           |
| shop_card.png           | 320x96  | shop monster slot (empty art, engine draws contents) |
| shop_item.png           | 320x96  | shop item slot                |
| coin_icon.png           | 64x64   | currency                      |
| day_banner.png          | 768x128 | Day N header                  |
| vs_frame.png            | 1024x256| VS screen band                |
| trinket_bar.png         | 512x128 | owned-trinkets strip          |
| shop_button.png         | 384x64  | reroll/lock/battle pill       |

## Battle rules the engine enforces (so data can assume them)
- Board max 6, position = column 0..5 left→right; "rightmost" targets highest column held.
- 3 copies of same species id auto-merge to next level (+1 trinket choice at Lv2, +1 at Lv3).
- Fight = 100% automatic, no input; fast-forward always available.
- Opponent = seeded snapshot from another player's team template (deterministic from run seed + Day).
- Day 10 win → champion screen → endless mode continues Day counter.
- Lose a battle → trainer HP -= enemy team leftover damage-ish; 0 HP → run ends.
