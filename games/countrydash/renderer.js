'use strict';

const Renderer = (() => {
    const canvas  = document.getElementById('gameCanvas');
    const ctx     = canvas.getContext('2d');
    const W = 800, H = 400;

    // ── Flag drawing ──────────────────────────────────────────────────────

    function drawFlag(context, cx, cy, radius, code) {
        const char = CharacterMap.get(code);
        if (!char) return drawFallback(context, cx, cy, radius, code);

        context.save();
        context.beginPath();
        context.arc(cx, cy, radius, 0, Math.PI * 2);
        context.clip();

        const f = char.flag;
        switch (f.type) {
            case 'horizontal_stripes': drawHStripes(context, cx, cy, radius, f); break;
            case 'vertical_stripes':   drawVStripes(context, cx, cy, radius, f); break;
            case 'nordic_cross':       drawNordicCross(context, cx, cy, radius, f); break;
            case 'solid_with_emblem':  drawSolidEmblem(context, cx, cy, radius, f); break;
            case 'diagonal':           drawDiagonal(context, cx, cy, radius, f); break;
            case 'cross':              drawCross(context, cx, cy, radius, f); break;
            case 'quartered':          drawQuartered(context, cx, cy, radius, f); break;
            case 'solid':              drawSolid(context, cx, cy, radius, f); break;
            case 'union_jack':         drawUnionJack(context, cx, cy, radius); break;
            default:                   drawFallback(context, cx, cy, radius, code);
        }

        // Shared emblem on top (for flags that have stripes + emblem)
        if (f.emblem) drawEmblem(context, cx, cy, radius, f.emblem);

        // Circle outline
        context.restore();
        context.save();
        context.beginPath();
        context.arc(cx, cy, radius, 0, Math.PI * 2);
        context.strokeStyle = 'rgba(0,0,0,0.35)';
        context.lineWidth = radius > 15 ? 2 : 1.5;
        context.stroke();
        context.restore();
    }

    function drawHStripes(ctx, cx, cy, r, f) {
        const colors = f.colors;
        const n = colors.length;
        const stripeH = (r * 2) / n;
        for (let i = 0; i < n; i++) {
            ctx.fillStyle = colors[i];
            ctx.fillRect(cx - r, cy - r + i * stripeH, r * 2, stripeH + 1);
        }
    }

    function drawVStripes(ctx, cx, cy, r, f) {
        const colors = f.colors;
        const n = colors.length;
        if (f.splitRatio && n === 2) {
            const w = r * 2 * f.splitRatio;
            ctx.fillStyle = colors[0];
            ctx.fillRect(cx - r, cy - r, w, r * 2);
            ctx.fillStyle = colors[1];
            ctx.fillRect(cx - r + w, cy - r, r * 2 - w, r * 2);
        } else {
            const stripeW = (r * 2) / n;
            for (let i = 0; i < n; i++) {
                ctx.fillStyle = colors[i];
                ctx.fillRect(cx - r + i * stripeW, cy - r, stripeW + 1, r * 2);
            }
        }
    }

    function drawNordicCross(ctx, cx, cy, r, f) {
        const { bg, crossH, crossV, offsetRatio = 0.38 } = f;
        const crossX = cx - r + r * 2 * offsetRatio;
        const thick = r * 0.22;

        ctx.fillStyle = bg;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

        // Outer cross
        ctx.fillStyle = crossH;
        ctx.fillRect(cx - r, cy - thick * 0.75, r * 2, thick * 1.5);
        ctx.fillRect(crossX - thick * 0.75, cy - r, thick * 1.5, r * 2);

        // Inner cross
        const inner = thick * 0.55;
        ctx.fillStyle = crossV;
        ctx.fillRect(cx - r, cy - inner, r * 2, inner * 2);
        ctx.fillRect(crossX - inner, cy - r, inner * 2, r * 2);
    }

    function drawSolidEmblem(ctx, cx, cy, r, f) {
        ctx.fillStyle = f.bg;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        if (f.emblem) drawEmblem(ctx, cx, cy, r, f.emblem, true);
    }

    function drawDiagonal(ctx, cx, cy, r, f) {
        const colors = f.colors;
        if (colors.length >= 2) {
            // Top-left triangle
            ctx.fillStyle = colors[0];
            ctx.beginPath();
            ctx.moveTo(cx - r, cy - r);
            ctx.lineTo(cx + r, cy - r);
            ctx.lineTo(cx - r, cy + r);
            ctx.closePath();
            ctx.fill();
            // Bottom-right triangle
            ctx.fillStyle = colors[1];
            ctx.beginPath();
            ctx.moveTo(cx + r, cy - r);
            ctx.lineTo(cx + r, cy + r);
            ctx.lineTo(cx - r, cy + r);
            ctx.closePath();
            ctx.fill();
        }
        // For Seychelles-style many-color diagonal fan — simplified to 2 dominant colors
    }

    function drawCross(ctx, cx, cy, r, f) {
        ctx.fillStyle = f.bg;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        const thick = r * 0.22;
        ctx.fillStyle = f.crossColor;
        ctx.fillRect(cx - r, cy - thick, r * 2, thick * 2);
        ctx.fillRect(cx - thick, cy - r, thick * 2, r * 2);
    }

    function drawQuartered(ctx, cx, cy, r, f) {
        const [tl, tr, bl, br] = f.colors;
        ctx.fillStyle = tl; ctx.fillRect(cx - r, cy - r, r, r);
        ctx.fillStyle = tr; ctx.fillRect(cx,     cy - r, r, r);
        ctx.fillStyle = bl; ctx.fillRect(cx - r, cy,     r, r);
        ctx.fillStyle = br; ctx.fillRect(cx,     cy,     r, r);
    }

    function drawSolid(ctx, cx, cy, r, f) {
        ctx.fillStyle = f.colors[0];
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    function drawUnionJack(ctx, cx, cy, r) {
        const s = r * 2;
        // Blue background
        ctx.fillStyle = '#012169';
        ctx.fillRect(cx - r, cy - r, s, s);

        // White diagonals
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = r * 0.32;
        ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); ctx.stroke();

        // Red diagonals (offset)
        ctx.strokeStyle = '#c8102e';
        ctx.lineWidth = r * 0.18;
        ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); ctx.stroke();

        // White cross
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = r * 0.34;
        ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();

        // Red cross
        ctx.strokeStyle = '#c8102e';
        ctx.lineWidth = r * 0.20;
        ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
    }

    function drawFallback(ctx, cx, cy, r, code) {
        ctx.fillStyle = '#333366';
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(8, r * 0.55)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(code.slice(0, 2), cx, cy);
    }

    // Emblem dispatcher — called for overlaid emblems
    function drawEmblem(ctx, cx, cy, r, emb, skipRestore = false) {
        if (!emb) return;
        const ex = cx + (emb.offsetX || 0) * r;
        const ey = cy + (emb.offsetY || 0) * r;
        const er = r * (emb.size || 0.4);

        ctx.save();
        ctx.fillStyle = emb.color;
        ctx.strokeStyle = emb.color;

        switch (emb.shape) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(ex, ey, er, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'star':
                drawStar(ctx, ex, ey, er, 5);
                break;
            case 'star_outline':
                drawStar(ctx, ex, ey, er, 5, true);
                break;
            case 'crescent':
                drawCrescent(ctx, ex, ey, er);
                break;
            case 'triangle':
                drawTriangleLeft(ctx, cx, cy, r, emb);
                break;
            case 'cross':
                drawSmallCross(ctx, ex, ey, er);
                break;
            case 'diamond':
                drawDiamond(ctx, ex, ey, er);
                break;
            case 'sun':
            case 'sun_rays':
                drawSun(ctx, ex, ey, er);
                break;
            case 'maple':
                drawMapleLeaf(ctx, ex, ey, er);
                break;
            case 'rect':
                ctx.fillRect(ex - er * 0.4, cy - r, er * 0.8, r * 2);
                break;
            case 'stripe_v':
                ctx.fillRect(cx - er, cy - r, er * 2, r * 2);
                break;
            default:
                // For complex emblems, draw a simplified star/circle
                ctx.beginPath();
                ctx.arc(ex, ey, er * 0.5, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
        ctx.restore();
    }

    function drawStar(ctx, cx, cy, r, points = 5, outline = false) {
        const inner = r * 0.4;
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const angle = (i * Math.PI / points) - Math.PI / 2;
            const dist = i % 2 === 0 ? r : inner;
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        if (outline) {
            ctx.lineWidth = r * 0.12;
            ctx.stroke();
        } else {
            ctx.fill();
        }
    }

    function drawCrescent(ctx, cx, cy, r) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(cx + r * 0.35, cy - r * 0.1, r * 0.82, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    function drawTriangleLeft(ctx, cx, cy, r, emb) {
        const offsetX = (emb.offsetX || -0.35) * r;
        const size = (emb.size || 0.5) * r;
        ctx.beginPath();
        ctx.moveTo(cx - r, cy - size);
        ctx.lineTo(cx - r + size * 1.4, cy);
        ctx.lineTo(cx - r, cy + size);
        ctx.closePath();
        ctx.fill();
    }

    function drawSmallCross(ctx, cx, cy, r) {
        const thick = r * 0.22;
        ctx.fillRect(cx - r, cy - thick, r * 2, thick * 2);
        ctx.fillRect(cx - thick, cy - r, thick * 2, r * 2);
    }

    function drawDiamond(ctx, cx, cy, r) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        ctx.fill();
    }

    function drawSun(ctx, cx, cy, r) {
        const rays = 8;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = r * 0.1;
        ctx.strokeStyle = ctx.fillStyle;
        for (let i = 0; i < rays; i++) {
            const angle = (i / rays) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * r * 0.6, cy + Math.sin(angle) * r * 0.6);
            ctx.lineTo(cx + Math.cos(angle) * r * 0.95, cy + Math.sin(angle) * r * 0.95);
            ctx.stroke();
        }
    }

    function drawMapleLeaf(ctx, cx, cy, r) {
        // Simplified maple leaf as a filled star with more points
        drawStar(ctx, cx, cy, r, 6);
    }

    // ── Game world drawing ────────────────────────────────────────────────

    function drawBackground(level, cameraX) {
        // Base sky colour
        ctx.fillStyle = level.bgColor || '#1a1a2e';
        ctx.fillRect(0, 0, W, H);

        // Depth gradient overlay (darken top, subtle horizon glow)
        const skyOver = ctx.createLinearGradient(0, 0, 0, GROUND_Y + PLAYER_RADIUS);
        skyOver.addColorStop(0,   'rgba(0,0,0,0.28)');
        skyOver.addColorStop(0.7, 'rgba(0,0,0,0)');
        skyOver.addColorStop(1,   'rgba(255,255,255,0.04)');
        ctx.fillStyle = skyOver;
        ctx.fillRect(0, 0, W, H);

        // Parallax star layer 1 — slow, brighter
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        for (let i = 0; i < 38; i++) {
            const px = ((i * 137.5 - cameraX * 0.07 + W * 20) % W);
            const py = 12 + (i * 67) % (GROUND_Y - 20);
            const r  = 0.7 + (i % 4) * 0.45;
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fill();
        }
        // Parallax star layer 2 — faster, dimmer
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        for (let i = 0; i < 22; i++) {
            const px = ((i * 241.3 - cameraX * 0.18 + W * 20) % W);
            const py = 8  + (i * 113) % (GROUND_Y * 0.75);
            ctx.beginPath();
            ctx.arc(px, py, 0.7, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawGround(level, cameraX) {
        const GROUND_TOP = GROUND_Y + PLAYER_RADIUS;
        const tileW  = 60;
        const gapSet = level.groundGaps || [];
        const gc     = level.groundColor || '#2a2a3e';

        // Ground gradient — reused for all tiles this frame
        const gGrad = ctx.createLinearGradient(0, GROUND_TOP, 0, H);
        gGrad.addColorStop(0,   gc);
        gGrad.addColorStop(0.12, gc);
        gGrad.addColorStop(1,   'rgba(0,0,0,0.55)');

        const startTile = Math.floor(cameraX / tileW);
        const endTile   = startTile + Math.ceil(W / tileW) + 2;

        for (let t = startTile; t <= endTile; t++) {
            const worldX = t * tileW;
            const inGap  = gapSet.some(g => worldX + tileW > g.startX && worldX < g.endX);
            if (inGap) continue;

            const sx = worldX - cameraX;
            ctx.fillStyle = gGrad;
            ctx.fillRect(sx, GROUND_TOP, tileW + 1, H - GROUND_TOP);

            // Vertical grid seam
            ctx.strokeStyle = 'rgba(0,0,0,0.18)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(sx, GROUND_TOP); ctx.lineTo(sx, H); ctx.stroke();

            // Horizontal grid rule at 35% depth
            const gy = GROUND_TOP + (H - GROUND_TOP) * 0.35;
            ctx.beginPath(); ctx.moveTo(sx, gy); ctx.lineTo(sx + tileW, gy); ctx.stroke();
        }

        // Neon top-edge glow
        const edgeGlow = ctx.createLinearGradient(0, GROUND_TOP - 7, 0, GROUND_TOP + 4);
        edgeGlow.addColorStop(0,   'rgba(160,210,255,0)');
        edgeGlow.addColorStop(0.55,'rgba(160,210,255,0.16)');
        edgeGlow.addColorStop(1,   'rgba(160,210,255,0)');
        ctx.fillStyle = edgeGlow;
        ctx.fillRect(0, GROUND_TOP - 7, W, 11);

        // Hard bright seam
        ctx.fillStyle = 'rgba(255,255,255,0.20)';
        ctx.fillRect(0, GROUND_TOP, W, 2);

        // Void / abyss inside gaps
        for (const gap of gapSet) {
            const gx = gap.startX - cameraX;
            const gw = gap.endX - gap.startX;
            if (gx > W || gx + gw < 0) continue;
            const voidGrad = ctx.createLinearGradient(0, GROUND_TOP, 0, H);
            voidGrad.addColorStop(0,   'rgba(0,0,0,0.85)');
            voidGrad.addColorStop(1,   'rgba(0,0,20,1)');
            ctx.fillStyle = voidGrad;
            ctx.fillRect(gx, GROUND_TOP, gw, H - GROUND_TOP);
        }
    }

    function drawPlatforms(level, cameraX) {
        for (const p of level.platforms) {
            const sx = p.x - cameraX;
            if (sx > W + 10 || sx + p.w < -10) continue;

            ctx.fillStyle = level.groundColor || '#555';
            ctx.fillRect(sx, p.y, p.w, p.h);
            // Top bevel
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.fillRect(sx, p.y, p.w, 3);
            // Bottom shadow edge
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(sx, p.y + p.h - 2, p.w, 2);
        }
    }

    function drawObstacles(level, cameraX) {
        for (const obs of level.obstacles) {
            const sx = obs.x - cameraX;
            if (sx > W + 10 || sx + (obs.w || 50) < -10) continue;

            const groundTop = GROUND_Y + PLAYER_RADIUS;

            if (obs.type === 'spike') {
                const tipX = sx + obs.w / 2;
                const tipY = groundTop - obs.h;

                ctx.save();
                ctx.shadowColor = '#ff3300';
                ctx.shadowBlur  = 10;

                const sGrad = ctx.createLinearGradient(tipX, groundTop, tipX, tipY);
                sGrad.addColorStop(0,   '#6b0000');
                sGrad.addColorStop(0.45,'#cc1100');
                sGrad.addColorStop(1,   '#ff7700');
                ctx.fillStyle = sGrad;

                ctx.beginPath();
                ctx.moveTo(sx, groundTop);
                ctx.lineTo(sx + obs.w, groundTop);
                ctx.lineTo(tipX, tipY);
                ctx.closePath();
                ctx.fill();

                ctx.shadowBlur = 0;
                ctx.strokeStyle = 'rgba(255,155,30,0.75)';
                ctx.lineWidth = 1.2;
                ctx.stroke();
                ctx.restore();

            } else if (obs.type === 'block' || obs.type === 'tall') {
                const rx = sx, ry = groundTop - obs.h, rw = obs.w, rh = obs.h;

                // Body gradient
                const bGrad = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh);
                bGrad.addColorStop(0,   '#c04040');
                bGrad.addColorStop(0.38,'#9b1c1c');
                bGrad.addColorStop(1,   '#3f0000');
                ctx.fillStyle = bGrad;
                ctx.fillRect(rx, ry, rw, rh);

                // Top bevel highlight
                ctx.fillStyle = 'rgba(255,180,180,0.28)';
                ctx.fillRect(rx, ry, rw, 4);
                // Left bevel highlight
                ctx.fillStyle = 'rgba(255,180,180,0.13)';
                ctx.fillRect(rx, ry, 3, rh);
                // Bottom shadow
                ctx.fillStyle = 'rgba(0,0,0,0.42)';
                ctx.fillRect(rx, ry + rh - 4, rw, 4);
                // Right shadow
                ctx.fillStyle = 'rgba(0,0,0,0.30)';
                ctx.fillRect(rx + rw - 3, ry, 3, rh);
                // Outer border
                ctx.strokeStyle = 'rgba(0,0,0,0.55)';
                ctx.lineWidth = 1;
                ctx.strokeRect(rx, ry, rw, rh);
                // Inner inset detail
                if (rw > 12 && rh > 12) {
                    ctx.strokeStyle = 'rgba(255,100,100,0.14)';
                    ctx.strokeRect(rx + 4, ry + 4, rw - 8, rh - 8);
                }
            }
        }
    }

    function drawCoins(level, cameraX) {
        const t = Date.now() / 1000;
        for (const coin of level.coins) {
            if (coin.collected) continue;
            const sx = coin.x - cameraX;
            if (sx > W + 22 || sx < -22) continue;

            const pulse  = 0.75 + 0.25 * Math.sin(t * 3.5 + coin.x * 0.02);
            const coinR  = 9;

            ctx.save();

            // Outer glow halo
            ctx.globalAlpha = 0.32 * pulse;
            ctx.fillStyle   = '#ffd60a';
            ctx.beginPath();
            ctx.arc(sx, coin.y, coinR + 5, 0, Math.PI * 2);
            ctx.fill();

            // Coin body with radial gradient
            ctx.globalAlpha = pulse;
            const cGrad = ctx.createRadialGradient(sx - 2.5, coin.y - 2.5, 0, sx, coin.y, coinR);
            cGrad.addColorStop(0, '#ffe555');
            cGrad.addColorStop(0.55,'#ffd60a');
            cGrad.addColorStop(1,   '#9a7200');
            ctx.fillStyle = cGrad;
            ctx.beginPath();
            ctx.arc(sx, coin.y, coinR, 0, Math.PI * 2);
            ctx.fill();

            // Inner ring
            ctx.globalAlpha = 0.5 * pulse;
            ctx.strokeStyle = '#ffe555';
            ctx.lineWidth   = 1.5;
            ctx.beginPath();
            ctx.arc(sx, coin.y, coinR - 2.5, 0, Math.PI * 2);
            ctx.stroke();

            // Specular glint
            ctx.globalAlpha = 0.45 * pulse;
            ctx.fillStyle   = '#fffde0';
            ctx.beginPath();
            ctx.arc(sx - 2.5, coin.y - 2.5, coinR * 0.36, 0, Math.PI * 2);
            ctx.fill();

            // 4 orbiting sparkle dots
            ctx.globalAlpha = 0.55 * pulse;
            ctx.fillStyle   = '#ffffff';
            for (let i = 0; i < 4; i++) {
                const a = t * 2.5 + i * Math.PI / 2;
                ctx.beginPath();
                ctx.arc(sx + Math.cos(a) * (coinR + 3), coin.y + Math.sin(a) * (coinR + 3), 1.2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    function drawPlayer(cameraX) {
        const code = Save.getSelected();
        const sx = Player.x - cameraX;
        const sy = Player.y;
        const r  = Player.radius;

        // Squish/stretch based on vertical velocity
        let scaleX = 1, scaleY = 1;
        if (!Player.isGrounded && Math.abs(Player.vy) > 60) {
            const t = Math.min(1, Math.abs(Player.vy) / 760);
            if (Player.vy < 0) { scaleX = 1 - t * 0.12; scaleY = 1 + t * 0.12; }
            else                { scaleX = 1 + t * 0.10; scaleY = 1 - t * 0.10; }
        }

        // Drop shadow projected onto ground
        const distAbove = Math.max(0, GROUND_Y - sy);
        const shAlpha = Math.max(0, 0.28 - distAbove * 0.0018);
        const shW     = r * Math.max(0.3, 1 - distAbove * 0.0022) * 0.85;
        if (shAlpha > 0.02) {
            ctx.save();
            ctx.globalAlpha = shAlpha;
            ctx.fillStyle   = '#000';
            ctx.beginPath();
            ctx.ellipse(sx, GROUND_Y + PLAYER_RADIUS + 1, shW, r * 0.22, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Flag ball with squish/stretch transform
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(scaleX, scaleY);
        ctx.translate(-sx, -sy);
        drawFlag(ctx, sx, sy, r, code);
        ctx.restore();

        // Eye
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(scaleX, scaleY);
        const er = r * 0.22;
        const ex = r * 0.32, ey = -r * 0.18;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(ex + er * 0.2, ey + er * 0.15, er * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(ex - er * 0.1, ey - er * 0.18, er * 0.22, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Specular highlight (top-left glint)
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(scaleX, scaleY);
        const glint = ctx.createRadialGradient(-r * 0.28, -r * 0.28, 0, -r * 0.08, -r * 0.08, r * 0.72);
        glint.addColorStop(0,   'rgba(255,255,255,0.42)');
        glint.addColorStop(0.42,'rgba(255,255,255,0.09)');
        glint.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.fillStyle = glint;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function drawHUD(level, cameraX, coinsThisRun) {
        const levelDef = Levels.list[Game.currentLevel];
        const progress = Math.min(1, cameraX / Math.max(1, levelDef.endX - W));

        const bx = W / 2 - 210, by = 8, bw = 420, bh = 14, br = 7;

        // Track background
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        roundRect(ctx, bx, by, bw, bh, br); ctx.fill();

        // Fill with glow
        if (progress > 0.005) {
            ctx.save();
            ctx.shadowColor = '#ffd60a';
            ctx.shadowBlur  = 7;
            const fGrad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
            fGrad.addColorStop(0,   '#e63946');
            fGrad.addColorStop(0.5, '#ff8c00');
            fGrad.addColorStop(1,   '#ffd60a');
            ctx.fillStyle = fGrad;
            roundRect(ctx, bx, by, bw * progress, bh, br); ctx.fill();
            ctx.restore();
        }

        // Track border
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 1;
        roundRect(ctx, bx, by, bw, bh, br); ctx.stroke();

        // Percentage label inside fill
        const pct = Math.round(progress * 100);
        if (pct > 6) {
            ctx.fillStyle = 'rgba(255,255,255,0.88)';
            ctx.font = 'bold 9px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${pct}%`, bx + bw * progress - 14, by + bh / 2);
        }

        // Level label (below bar, left)
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`${levelDef.id}. ${levelDef.name}`, 12, 28);

        // Coin counter (below bar, right)
        ctx.fillStyle = '#ffd60a';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'right';
        ctx.fillText(`● ${Save.getCoins() + coinsThisRun}`, W - 12, 28);
    }

    // ── Screen drawing ────────────────────────────────────────────────────

    function drawMenu() {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0, 0, W, H);

        const t = Date.now() / 1000;

        // Slow-moving background particles
        ctx.fillStyle = 'rgba(230,57,70,0.10)';
        for (let i = 0; i < 18; i++) {
            const px = ((i * 137 + t * (8 + i * 2.5)) % W + W) % W;
            const py = ((i * 97  + t * (4 + i * 1.8)) % H + H) % H;
            ctx.beginPath();
            ctx.arc(px, py, 2.5 + (i % 3) * 1.2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.032)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
        for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

        // Title drop-shadow
        ctx.font = 'bold 54px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillText('CountryDash', W / 2 + 3, 133);

        // Title with gradient + glow
        const tGrad = ctx.createLinearGradient(W / 2 - 185, 0, W / 2 + 185, 0);
        tGrad.addColorStop(0,   '#ff6b6b');
        tGrad.addColorStop(0.38,'#ffffff');
        tGrad.addColorStop(0.68,'#ffd60a');
        tGrad.addColorStop(1,   '#ff6b6b');
        ctx.save();
        ctx.shadowColor = '#e63946';
        ctx.shadowBlur  = 18;
        ctx.fillStyle   = tGrad;
        ctx.fillText('CountryDash', W / 2, 130);
        ctx.restore();

        // Bouncing ball preview
        const bounce  = Math.abs(Math.sin(t * 2.5)) * 14;
        const sY      = 1 + Math.sin(t * 5) * 0.07;
        const ballCY  = 220 - bounce;

        // Ball shadow
        ctx.save();
        ctx.globalAlpha = 0.12 + (bounce / 14) * 0.08;
        ctx.fillStyle   = '#000';
        ctx.beginPath();
        ctx.ellipse(W / 2, 254, 20 + bounce * 0.5, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Ball
        ctx.save();
        ctx.translate(W / 2, ballCY);
        ctx.scale(1, sY);
        drawFlag(ctx, 0, 0, 32, Save.getSelected());
        // Eye
        const er = 32 * 0.22;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(32*0.32, -32*0.18, er, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(32*0.32 + er*0.2, -32*0.18 + er*0.15, er*0.55, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(32*0.32 - er*0.1, -32*0.18 - er*0.18, er*0.22, 0, Math.PI*2); ctx.fill();
        // Specular
        const glint = ctx.createRadialGradient(-9, -9, 0, -3, -3, 23);
        glint.addColorStop(0, 'rgba(255,255,255,0.4)');
        glint.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glint;
        ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI*2); ctx.fill();
        ctx.restore();

        // Hints
        ctx.fillStyle = 'rgba(255,255,255,0.52)';
        ctx.font = '16px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Click or press SPACE to start', W / 2, 287);

        ctx.fillStyle = 'rgba(255,255,255,0.26)';
        ctx.font = '13px system-ui';
        ctx.fillText('[S] Shop    [L] Levels    [Esc] Menu', W / 2, 313);

        ctx.fillStyle = '#ffd60a';
        ctx.font = 'bold 13px system-ui';
        ctx.fillText(`● ${Save.getCoins()} coins`, W / 2, 340);
    }

    function drawDeathScreen() {
        // Red vignette
        const vig = ctx.createRadialGradient(W/2, H/2, H*0.15, W/2, H/2, H*0.9);
        vig.addColorStop(0, 'rgba(0,0,0,0.48)');
        vig.addColorStop(1, 'rgba(170,0,0,0.58)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Shadow
        ctx.font = 'bold 50px system-ui';
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillText('DEAD', W / 2 + 3, H / 2 - 28);

        // Glow text
        ctx.save();
        ctx.shadowColor = '#e63946';
        ctx.shadowBlur  = 22;
        ctx.fillStyle   = '#ff4444';
        ctx.fillText('DEAD', W / 2, H / 2 - 30);
        ctx.restore();

        ctx.fillStyle = 'rgba(255,255,255,0.52)';
        ctx.font = '16px system-ui';
        ctx.fillText('Click or SPACE to retry', W / 2, H / 2 + 24);
    }

    function drawLevelComplete(coinsEarned) {
        ctx.fillStyle = 'rgba(0,0,0,0.70)';
        ctx.fillRect(0, 0, W, H);

        const t = Date.now() / 1000;

        // Confetti (mathematical, no state)
        const cc = ['#ffd60a','#e63946','#4ec9b0','#7b7cf7','#ff8c00','#ffffff','#55ff99'];
        for (let i = 0; i < 55; i++) {
            const spd = 38 + (i % 5) * 14;
            const cx  = ((i * 137.5 + spd * t * (0.65 + i % 3 * 0.18)) % W + W) % W;
            const cy  = ((spd * t * (0.9 + i % 4 * 0.28) + i * 170) % (H + 40)) - 20;
            ctx.fillStyle = cc[i % cc.length];
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(t * (0.9 + i % 3 * 0.5));
            ctx.fillRect(-3, -3, 6, 6);
            ctx.restore();
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Shadow
        ctx.font = 'bold 46px system-ui';
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillText('LEVEL COMPLETE!', W / 2 + 3, H / 2 - 48);

        // Gradient glow title
        ctx.save();
        ctx.shadowColor = '#ffd60a';
        ctx.shadowBlur  = 28;
        const lGrad = ctx.createLinearGradient(W/2 - 200, 0, W/2 + 200, 0);
        lGrad.addColorStop(0,   '#ff8c00');
        lGrad.addColorStop(0.5, '#ffd60a');
        lGrad.addColorStop(1,   '#ff8c00');
        ctx.fillStyle = lGrad;
        ctx.fillText('LEVEL COMPLETE!', W / 2, H / 2 - 50);
        ctx.restore();

        ctx.fillStyle = '#ffffff';
        ctx.font = '22px system-ui';
        ctx.fillText(`+${coinsEarned} coins`, W / 2, H / 2 + 14);

        ctx.fillStyle = 'rgba(255,255,255,0.44)';
        ctx.font = '15px system-ui';
        ctx.fillText('Click or SPACE to continue', W / 2, H / 2 + 54);
    }

    // ── Utilities ─────────────────────────────────────────────────────────

    function roundRect(ctx, x, y, w, h, r) {
        if (w < r * 2) r = w / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y,     x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x,     y + h, r);
        ctx.arcTo(x,     y + h, x,     y,     r);
        ctx.arcTo(x,     y,     x + w, y,     r);
        ctx.closePath();
    }

    // ── Public draw dispatcher ────────────────────────────────────────────

    function draw(state, activeLevel, cameraX, coinsThisRun, coinsEarned) {
        ctx.clearRect(0, 0, W, H);

        if (state === 'menu') {
            drawMenu();
            return;
        }

        if (state === 'playing' || state === 'dead') {
            drawBackground(activeLevel, cameraX);
            drawGround(activeLevel, cameraX);
            drawPlatforms(activeLevel, cameraX);
            drawObstacles(activeLevel, cameraX);
            drawCoins(activeLevel, cameraX);
            drawPlayer(cameraX);
            drawHUD(activeLevel, cameraX, coinsThisRun);
            if (state === 'dead') drawDeathScreen();
            return;
        }

        if (state === 'levelcomplete') {
            drawBackground(activeLevel, cameraX);
            drawGround(activeLevel, cameraX);
            drawPlatforms(activeLevel, cameraX);
            drawObstacles(activeLevel, cameraX);
            drawCoins(activeLevel, cameraX);
            drawPlayer(cameraX);
            drawHUD(activeLevel, cameraX, coinsThisRun);
            drawLevelComplete(coinsEarned);
            return;
        }
    }

    return { draw, drawFlag, canvas, ctx };
})();
