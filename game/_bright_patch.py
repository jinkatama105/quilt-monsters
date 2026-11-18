import re, sys, shutil, os

R = os.path.expanduser('~/makefun/bgrepo/game')

def sub(path, pairs):
    p = os.path.join(R, path)
    s = open(p).read()
    for old, new, *opt in pairs:
        cnt = opt[0] if opt else 1
        n = s.count(old)
        if n != cnt:
            print(f'FAIL {path}: expected {cnt} of {old!r}, found {n}'); sys.exit(1)
        s = s.replace(old, new)
    open(p, 'w').write(s)
    print('ok', path)

# assets: copy all except coin_icon (byte-identical)
pack = '/home/andre/bright-v2/pack'
for f in os.listdir(pack):
    if f.endswith('.png') and f != 'coin_icon.png':
        shutil.copy(os.path.join(pack, f), os.path.join(R, 'assets/ui', f))
        print('asset', f)

sub('src/config.js', [
    ("ink: '#0b0f0d',", "ink: '#241a12',"),
    ("paper: '#e8f2e4',", "paper: '#fff6dc',"),
    ("panel: '#152420',", "panel: '#fff6dc',"),
    ("panelEdge: '#3b5a47',", "panelEdge: '#5b4636',"),
    ("bg: '#18311f'", "bg: '#cfe8b4'"),
    ("bg: '#30160c'", "bg: '#ffd9a8'"),
    ("bg: '#1c1230'", "bg: '#e3d4f5'"),
])

sub('src/hud.js', [
    ("ctx.fillStyle = '#0a0f0a'; roundRect(ctx, x, y, w, h, h / 2)", "ctx.fillStyle = '#e7dcc0'; roundRect(ctx, x, y, w, h, h / 2)"),
    ("ctx.strokeStyle = '#31493a'", "ctx.strokeStyle = '#5b4636'"),
    ("panel(ctx, VIEW_W / 2 - w / 2, 108, w, 56, 0.94);\n    ctx.fillStyle = PALETTE.paper;", "panel(ctx, VIEW_W / 2 - w / 2, 108, w, 56, 0.94);\n    ctx.fillStyle = INK;"),
    ("ctx.fillStyle = hot ? '#2a4f38' : PALETTE.panel;", "ctx.fillStyle = hot ? '#ffc93c' : PALETTE.panel;"),
    ("ctx.fillStyle = PALETTE.paper; ctx.font = 'bold 15px monospace'", "ctx.fillStyle = INK; ctx.font = 'bold 15px monospace'"),
    ("ctx.fillStyle = '#0a0f0a'; roundRect(ctx, VIEW_W - 462, 548, 268, 8, 4)", "ctx.fillStyle = '#e7dcc0'; roundRect(ctx, VIEW_W - 462, 548, 268, 8, 4)"),
    ("ctx.fillStyle = '#6fa8ff'; roundRect(ctx, VIEW_W - 462", "ctx.fillStyle = '#7ec8e3'; roundRect(ctx, VIEW_W - 462"),
    ("ctx.strokeStyle = battle.player === c ? PALETTE.paper : 'rgba(0,0,0,.5)'", "ctx.strokeStyle = battle.player === c ? INK : 'rgba(0,0,0,.5)'"),
    ("ctx.fillStyle = '#9fb8a6'; ctx.font = '11px monospace'", "ctx.fillStyle = INK_SUB; ctx.font = '11px monospace'"),
])

sub('src/showdown.js', [
    ("bg.addColorStop(0, '#131a14'); bg.addColorStop(1, '#0b0f0d');", "bg.addColorStop(0, '#dff3fb'); bg.addColorStop(1, '#fff3c4');"),
    ("ctx.fillStyle = 'rgba(0,0,0,.18)';", "ctx.fillStyle = 'rgba(91,70,54,.12)';"),
    ("ctx.fillStyle = '#9fd8c8';\n", "ctx.fillStyle = '#2e9e8f';\n", 1),
    ("ctx.fillStyle = 'rgba(6,10,6,.85)'", "ctx.fillStyle = 'rgba(59,44,23,.85)'", 2),
])

sub('src/bg.js', [("'rgba(8,10,14,0.30)'", "'rgba(91,70,54,0.15)'")])

sub('src/run.js', [
    ("'rgba(255,255,255,.14)'", "'rgba(91,70,54,.20)'"),
    ("ctx.fillStyle = hot ? 'rgba(255,209,106,.22)' : 'rgba(255,255,255,.06)';", "ctx.fillStyle = hot ? 'rgba(255,201,60,.35)' : 'rgba(255,201,60,.10)';"),
    ("ctx.strokeStyle = hot ? '#ffd26a' : '#6f8f7d';", "ctx.strokeStyle = hot ? '#d99a16' : '#5b4636';"),
    ("ctx.fillStyle = hot ? 'rgba(255,209,106,.10)' : 'rgba(255,255,255,.05)';", "ctx.fillStyle = hot ? 'rgba(255,201,60,.28)' : 'rgba(255,201,60,.10)';"),
    ("ctx.fillStyle = hot ? 'rgba(142,242,160,.14)' : 'rgba(255,255,255,.05)';", "ctx.fillStyle = hot ? 'rgba(127,191,106,.25)' : 'rgba(255,201,60,.10)';"),
    ("ctx.fillStyle = inRect(mouse, b) ? 'rgba(255,157,106,.12)' : 'rgba(255,255,255,.05)';", "ctx.fillStyle = inRect(mouse, b) ? 'rgba(233,106,138,.18)' : 'rgba(255,201,60,.10)';"),
    ("ctx.fillStyle = 'rgba(255,209,106,.12)';", "ctx.fillStyle = 'rgba(255,201,60,.20)';"),
    ("ctx.fillStyle = hot ? 'rgba(255,209,106,.16)' : 'rgba(255,255,255,.05)';", "ctx.fillStyle = hot ? 'rgba(255,201,60,.30)' : 'rgba(255,201,60,.10)';"),
    ("ctx.fillStyle = '#ff9d6a'; ctx.font = 'bold 14px monospace'", "ctx.fillStyle = '#e85d4a'; ctx.font = 'bold 14px monospace'"),
    ("ctx.font = 'bold 34px monospace'; ctx.fillStyle = r.gain > 0 ? '#8ef2a0' : '#ff9d6a';", "ctx.font = 'bold 34px monospace'; ctx.fillStyle = r.gain > 0 ? '#2e9e4f' : '#e85d4a';"),
    ("ctx.textAlign = 'center'; ctx.font = 'bold 40px monospace'; ctx.fillStyle = '#ffe9b1';", "ctx.textAlign = 'center'; ctx.font = 'bold 40px monospace'; ctx.fillStyle = '#d99a16';"),
    ("ctx.font = '18px monospace'; ctx.fillStyle = '#8ef2a0';", "ctx.font = '18px monospace'; ctx.fillStyle = '#2e9e4f';"),
    ("ctx.textAlign = 'center'; ctx.font = 'bold 36px monospace'; ctx.fillStyle = '#ff9d6a';", "ctx.textAlign = 'center'; ctx.font = 'bold 36px monospace'; ctx.fillStyle = '#e85d4a';"),
])

sub('src/screens.js', [
    ("g.addColorStop(0, '#0c1a10'); g.addColorStop(0.6, '#10241a'); g.addColorStop(1, '#1c1230');", "g.addColorStop(0, '#cfeef7'); g.addColorStop(0.6, '#e8f7ee'); g.addColorStop(1, '#fff3c4');"),
    ("wash.addColorStop(0, 'rgba(10,20,12,0.82)'); wash.addColorStop(0.35, 'rgba(12,24,16,0.45)');", "wash.addColorStop(0, 'rgba(255,246,220,0.30)'); wash.addColorStop(0.35, 'rgba(255,246,220,0.10)');"),
    ("wash.addColorStop(0.75, 'rgba(16,14,38,0.55)'); wash.addColorStop(1, 'rgba(16,14,38,0.85)');", "wash.addColorStop(0.75, 'rgba(255,214,110,0.15)'); wash.addColorStop(1, 'rgba(255,214,110,0.30)');"),
    ("ctx.fillStyle = 'rgba(18,28,20,0.55)';", "ctx.fillStyle = 'rgba(255,246,220,0.85)';"),
    ("ctx.strokeStyle = 'rgba(159,213,168,0.85)';", "ctx.strokeStyle = 'rgba(91,70,54,0.90)';"),
    ("'bold 58px monospace', PALETTE.paper);", "'bold 58px monospace', '#3b2c17');"),
    ("'explore · battle · capture the three Tribus', VIEW_W / 2, 212, '18px monospace', '#9fd5a8');", "'explore · battle · capture the three Tribus', VIEW_W / 2, 212, '18px monospace', '#2e7d32');"),
    ("'14px monospace', '#a8c4ae');", "'14px monospace', '#6d5b3c');"),
    ("'13px monospace', '#6d8674');", "'13px monospace', '#6d5b3c');"),
    ("ctx.fillStyle = '#0d1512';", "ctx.fillStyle = '#fdf3d0';"),
    ("'◈ THE VERDANT CODEX ◈', VIEW_W / 2, 54, 'bold 30px monospace', PALETTE.paper);", "'◈ THE VERDANT CODEX ◈', VIEW_W / 2, 54, 'bold 30px monospace', '#3b2c17');"),
    ("'14px monospace', '#9fb8a6');", "'14px monospace', '#6d5b3c');"),
    ("ctx.fillStyle = PALETTE.paper; ctx.font = 'bold 16px monospace';", "ctx.fillStyle = '#3b2c17'; ctx.font = 'bold 16px monospace';"),
    ("ctx.fillStyle = '#9fb8a6';", "ctx.fillStyle = '#6d5b3c';", 4),
    ("ctx.fillStyle = caught ? PALETTE.hpGood : '#6f8577';", "ctx.fillStyle = caught ? PALETTE.hpGood : '#2e7d32';"),
    ("'TYPE CHART', cx + 150, 140, 'bold 17px monospace', PALETTE.paper);", "'TYPE CHART', cx + 150, 140, 'bold 17px monospace', '#3b2c17');"),
    ("bg.addColorStop(0, '#171029'); bg.addColorStop(1, '#0e2216');", "bg.addColorStop(0, '#fdf3c4'); bg.addColorStop(1, '#d8f0c0');"),
    ("'bold 42px monospace', '#e8d5ff');", "'bold 42px monospace', '#6a3e8f');"),
    ("'Nocturne is bound — the showdown is won', VIEW_W / 2, 172, '18px monospace', '#9fd5a8');", "'Nocturne is bound — the showdown is won', VIEW_W / 2, 172, '18px monospace', '#2e7d32');"),
    ("'bold 20px monospace', PALETTE.paper);", "'bold 20px monospace', '#3b2c17');"),
    ("'bold 36px monospace', '#ffe14d');", "'bold 36px monospace', '#d99a16');"),
    ("'12px monospace', '#9fb8a6');", "'12px monospace', '#6d5b3c');", 1),
    ("ctx.fillStyle = '#12080c';", "ctx.fillStyle = '#ffe3e3';"),
    ("'bold 38px monospace', '#ff9d9d');", "'bold 38px monospace', '#e85d4a');"),
    ("'16px monospace', '#c9a8b0');", "'16px monospace', '#8a5a63');"),
    ("'your Codex and captures are kept', VIEW_W / 2, 500, '13px monospace', '#7d6b70');", "'your Codex and captures are kept', VIEW_W / 2, 500, '13px monospace', '#6d5b3c');"),
])

sub('src/road.js', [
    ("{ bg: '#4a7d4e',", "{ bg: '#5da85f',"),
    ("{ bg: '#a03434',", "{ bg: '#c04545',"),
    ("{ bg: '#3e7d84',", "{ bg: '#4a9aa3',"),
    ("{ bg: '#c8861e',", "{ bg: '#e09a24',"),
    ("{ bg: '#b3628c',", "{ bg: '#c975a4',"),
    ("{ bg: '#5d76b8',", "{ bg: '#7a93d6',"),
    ("{ bg: '#6a3e8f',", "{ bg: '#8a55b0',"),
    ("ctx.fillStyle = 'rgba(74,44,94,.95)';", "ctx.fillStyle = 'rgba(255,246,220,.95)';"),
    ("ctx.strokeStyle = '#2a1436';", "ctx.strokeStyle = '#5b4636';"),
    ("ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(desc", "ctx.fillStyle = '#3b2c17'; ctx.textAlign = 'center'; ctx.fillText(desc"),
])

sub('src/main.js', [
    ("ctx.fillStyle = '#0b0f0d'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);", "ctx.fillStyle = '#f7ead0'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);"),
    ("ctx.fillStyle = '#e8d5a9';", "ctx.fillStyle = '#3b2c17';"),
    ("ctx.fillStyle = PALETTE.paper; ctx.font = '17px monospace';", "ctx.fillStyle = '#3b2c17'; ctx.font = '17px monospace';"),
    ("ctx.fillStyle = '#9fb8a6'; ctx.font = '13px monospace';", "ctx.fillStyle = '#6d5b3c'; ctx.font = '13px monospace';"),
])

# cache-buster run2 -> run3 everywhere
for root, dirs, files in os.walk(R):
    if '.git' in root or 'node_modules' in root: continue
    for f in files:
        if f.endswith(('.js', '.html')):
            p = os.path.join(root, f)
            s = open(p).read()
            if 'v=run2' in s:
                open(p, 'w').write(s.replace('v=run2', 'v=run3'))
                print('busted', p)
print('DONE')
