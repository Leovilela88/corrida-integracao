/* Corrida Integração — gerador de cards de compartilhamento (conquistas e treinos).
   Card 9:16 (1080x1920) para Stories, com foto opcional reposicionável,
   modo de fundo transparente e métricas por esporte com ícones. */
(function () {
    const ATHLETE = window.MF_ATHLETE || '';
    const W = 1080;
    let H = 1920;            // 1920 = stories 9:16 · 1350 = feed 4:5
    let fmt = 'story';
    const HASHTAG = '#corridaintegracao';
    // Data da prova (abertura 5K, sábado) — base da regressiva no card
    const RACE_TARGET = new Date('2026-09-26T07:00:00-03:00').getTime();
    function daysToRace() {
        return Math.max(0, Math.ceil((RACE_TARGET - Date.now()) / 86400000));
    }

    // ---------------------------------------------------------------- estado
    let payload = null;       // { type, ... }
    let photoImg = null;      // Image da foto escolhida (ou null)
    let photoZoom = 1;        // zoom da foto (1 = cobre o quadro)
    let transparent = false;  // só a base da conquista, fundo transparente
    let offX = 0, offY = 0;   // deslocamento da foto (espaço do canvas)
    let variants = ['default'];
    let variantIdx = 0;

    const VARIANT_LABELS = { metrics: 'Métricas', route: 'Rota', full: 'Completo' };

    function variantsFor(p) {
        // Card único: apenas "Métricas" (sem variantes de rota/completo)
        if (p.type === 'workout') return ['metrics'];
        return ['default'];
    }

    // Cabeçalho da medalha: "VOCÊ É FINISHER" + logo
    function drawMedalTop(cx) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#e8eef7';
        ctx.font = '700 19px Inter, sans-serif';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
        ctx.fillText('EU SOU', cx, 92);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        ctx.fillStyle = '#05e0a3';
        ctx.font = '800 64px Inter, sans-serif';
        ctx.fillText('FINISHER', cx, 156);
        if (logoReady) {
            const lw = 238, lh = logo.height * (lw / logo.width);
            ctx.shadowBlur = 10;
            ctx.drawImage(logo, cx - lw / 2, 184, lw, lh);
        }
        ctx.restore();
    }
    function currentVariant() { return variants[variantIdx] || variants[0]; }

    // ---------------------------------------------------------------- DOM
    let overlay, canvas, ctx, fileInput, photoBtn, photoLabel, transWrap,
        transInput, dragHint, zoomWrap, zoomInput, variantNav, variantDots, variantLabel;

    function buildSheet() {
        overlay = document.createElement('div');
        overlay.className = 'sheet-overlay share-sheet';
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="sheet">
                <div class="sheet-handle"></div>
                <div class="share-preview-wrap">
                    <canvas id="mf-share-canvas" width="${W}" height="${H}"></canvas>
                </div>
                <div class="share-variants" data-role="variants" hidden>
                    <button type="button" class="variant-arrow" data-role="prev" aria-label="Anterior">‹</button>
                    <div class="variant-center">
                        <span class="variant-label" data-role="variant-label"></span>
                        <div class="variant-dots" data-role="dots"></div>
                    </div>
                    <button type="button" class="variant-arrow" data-role="next" aria-label="Próximo">›</button>
                </div>
                <div class="share-format" data-role="format">
                    <button type="button" class="fmt-btn is-active" data-fmt="story">Stories 9:16</button>
                    <button type="button" class="fmt-btn" data-fmt="feed">Feed 4:5</button>
                </div>
                <p class="share-hint" data-role="drag" hidden>Arraste a foto para posicionar · use o zoom abaixo</p>
                <div class="share-zoom" data-role="zoom-wrap" hidden>
                    <span class="zoom-ico">−</span>
                    <input type="range" min="100" max="300" value="100" step="1" data-role="zoom" />
                    <span class="zoom-ico">+</span>
                </div>
                <label class="share-toggle">
                    <input type="checkbox" data-role="trans" />
                    <span>Fundo transparente (sticker para Stories)</span>
                </label>
                <input type="file" accept="image/*" data-role="file" hidden />
                <div class="share-actions">
                    <button type="button" class="btn-ghost" data-role="photo">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.6-3.6a2 2 0 0 0-2.8 0L6 20"/></svg>
                        <span data-role="photo-label">Adicionar foto</span>
                    </button>
                    <button type="button" class="btn-primary" data-role="do">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        Compartilhar
                    </button>
                </div>
                <p class="share-tag-hint">Compartilhe nas redes com <strong>#corridaintegracao</strong></p>
            </div>`;
        document.body.appendChild(overlay);

        canvas = overlay.querySelector('#mf-share-canvas');
        ctx = canvas.getContext('2d');
        fileInput = overlay.querySelector('[data-role="file"]');
        photoBtn = overlay.querySelector('[data-role="photo"]');
        photoLabel = overlay.querySelector('[data-role="photo-label"]');
        transWrap = overlay.querySelector('.share-toggle');
        transInput = overlay.querySelector('[data-role="trans"]');
        dragHint = overlay.querySelector('[data-role="drag"]');
        zoomWrap = overlay.querySelector('[data-role="zoom-wrap"]');
        zoomInput = overlay.querySelector('[data-role="zoom"]');
        variantNav = overlay.querySelector('[data-role="variants"]');
        variantDots = overlay.querySelector('[data-role="dots"]');
        variantLabel = overlay.querySelector('[data-role="variant-label"]');

        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('[data-role="prev"]').addEventListener('click', () => changeVariant(-1));
        overlay.querySelector('[data-role="next"]').addEventListener('click', () => changeVariant(1));
        photoBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', onPickPhoto);
        transInput.addEventListener('change', () => {
            transparent = transInput.checked;
            syncControls();
            render();
        });
        overlay.querySelector('[data-role="do"]').addEventListener('click', doShare);
        overlay.querySelectorAll('.fmt-btn').forEach((b) => {
            b.addEventListener('click', () => setFormat(b.dataset.fmt));
        });
        zoomInput.addEventListener('input', () => {
            photoZoom = Math.max(1, zoomInput.value / 100);
            draw();
        });
        bindDrag();
    }

    function setFormat(f) {
        fmt = f;
        H = (f === 'feed') ? 1350 : 1920;
        if (canvas) canvas.height = H;
        if (overlay) overlay.querySelectorAll('.fmt-btn').forEach((b) =>
            b.classList.toggle('is-active', b.dataset.fmt === f));
        render();
    }

    function syncControls() {
        const showPhoto = !transparent;
        photoBtn.style.display = showPhoto ? '' : 'none';
        dragHint.hidden = !(showPhoto && photoImg);
        zoomWrap.hidden = !(showPhoto && photoImg);
    }

    function changeVariant(dir) {
        if (variants.length < 2) return;
        variantIdx = (variantIdx + dir + variants.length) % variants.length;
        updateVariantNav();
        render();
    }

    function updateVariantNav() {
        if (!variantNav) return;
        variantNav.hidden = variants.length < 2;
        if (variants.length < 2) return;
        variantLabel.textContent = VARIANT_LABELS[currentVariant()] || '';
        variantDots.innerHTML = variants
            .map((_, i) => `<span class="variant-dot${i === variantIdx ? ' is-on' : ''}"></span>`)
            .join('');
    }

    // ---------------------------------------------------------------- logos
    const logo = new Image();
    logo.crossOrigin = 'anonymous';
    let logoReady = false;
    logo.onload = () => { logoReady = true; if (overlay && !overlay.hidden) render(); };
    logo.src = '/static/INTEGRACAO_LOGO.png';

    // logos de realização (Grupo EP) e patrocínio (Covabra) — rodapé do card
    const epLogo = new Image(); epLogo.crossOrigin = 'anonymous'; let epReady = false;
    epLogo.onload = () => { epReady = true; if (overlay && !overlay.hidden) render(); };
    epLogo.src = '/static/logo_grupo_ep.png';
    const spLogo = new Image(); spLogo.crossOrigin = 'anonymous'; let spReady = false;
    spLogo.onload = () => { spReady = true; if (overlay && !overlay.hidden) render(); };
    spLogo.src = '/static/logo_covabra.png';

    document.fonts && document.fonts.ready.then(() => {
        if (overlay && !overlay.hidden) render();
    }).catch(() => {});

    // ---------------------------------------------------------------- util
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function wrap(text, max) {
        const words = (text || '').split(' ');
        const out = [];
        let line = '';
        for (const w of words) {
            const t = line ? line + ' ' + w : w;
            if (ctx.measureText(t).width > max && line) { out.push(line); line = w; }
            else line = t;
        }
        if (line) out.push(line);
        return out;
    }

    function coverDraw(img) {
        // escala base = cobre o quadro; multiplicada pelo zoom do usuário
        const r = Math.max(W / img.naturalWidth, H / img.naturalHeight) * photoZoom;
        const w = img.naturalWidth * r, h = img.naturalHeight * r;
        const x0 = (W - w) / 2, y0 = (H - h) / 2;
        // clampa o deslocamento pra foto sempre cobrir o quadro (nas duas direções)
        offX = Math.min(0 - x0, Math.max(W - w - x0, offX));
        offY = Math.min(0 - y0, Math.max(H - h - y0, offY));
        ctx.drawImage(img, x0 + offX, y0 + offY, w, h);
    }

    // ---------------------------------------------------------------- ícones
    // desenho vetorial simples (centrado em x,y; s = "meio-tamanho")
    function drawIcon(name, x, y, s, color) {
        ctx.save();
        ctx.translate(x, y);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = Math.max(3, s * 0.16);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        switch (name) {
            case 'clock':
                ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.55);
                ctx.moveTo(0, 0); ctx.lineTo(s * 0.42, s * 0.1); ctx.stroke();
                break;
            case 'distance': // seta de navegação
                ctx.moveTo(0, -s); ctx.lineTo(s * 0.72, s);
                ctx.lineTo(0, s * 0.38); ctx.lineTo(-s * 0.72, s);
                ctx.closePath(); ctx.stroke();
                break;
            case 'pace': // pulso/atividade
                ctx.moveTo(-s, 0); ctx.lineTo(-s * 0.45, 0);
                ctx.lineTo(-s * 0.15, -s * 0.75); ctx.lineTo(s * 0.15, s * 0.75);
                ctx.lineTo(s * 0.45, 0); ctx.lineTo(s, 0); ctx.stroke();
                break;
            case 'flame':
                ctx.moveTo(0, -s);
                ctx.bezierCurveTo(s * 0.72, -s * 0.3, s * 0.72, s * 0.65, 0, s);
                ctx.bezierCurveTo(-s * 0.72, s * 0.65, -s * 0.72, -s * 0.3, 0, -s);
                ctx.stroke();
                break;
            case 'speed': // velocímetro
                ctx.arc(0, s * 0.25, s, Math.PI, Math.PI * 2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, s * 0.25);
                ctx.lineTo(s * 0.5, -s * 0.45); ctx.stroke();
                ctx.beginPath(); ctx.arc(0, s * 0.25, s * 0.12, 0, Math.PI * 2); ctx.fill();
                break;
            case 'heart': // frequência cardíaca
                ctx.moveTo(0, s * 0.75);
                ctx.bezierCurveTo(-s * 1.3, -s * 0.2, -s * 0.4, -s * 0.95, 0, -s * 0.3);
                ctx.bezierCurveTo(s * 0.4, -s * 0.95, s * 1.3, -s * 0.2, 0, s * 0.75);
                ctx.stroke();
                break;
            case 'bolt': // potência (watts)
                ctx.moveTo(s * 0.25, -s); ctx.lineTo(-s * 0.45, s * 0.15);
                ctx.lineTo(s * 0.05, s * 0.15); ctx.lineTo(-s * 0.25, s);
                ctx.lineTo(s * 0.5, -s * 0.2); ctx.lineTo(0, -s * 0.2);
                ctx.closePath(); ctx.stroke();
                break;
            case 'dumbbell':
            case 'volume': { // halter
                const pw = s * 0.34, ph = s * 1.4;
                roundRect(-s, -ph / 2, pw, ph, pw * 0.4); ctx.stroke();
                roundRect(s - pw, -ph / 2, pw, ph, pw * 0.4); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(-s + pw, 0); ctx.lineTo(s - pw, 0); ctx.stroke();
                break;
            }
            case 'waves': // natação
                for (const dy of [-s * 0.4, s * 0.4]) {
                    ctx.moveTo(-s, dy);
                    ctx.quadraticCurveTo(-s * 0.5, dy - s * 0.55, 0, dy);
                    ctx.quadraticCurveTo(s * 0.5, dy + s * 0.55, s, dy);
                }
                ctx.stroke();
                break;
            case 'mountain': // trilha
                ctx.moveTo(-s, s * 0.8);
                ctx.lineTo(-s * 0.2, -s * 0.7);
                ctx.lineTo(s * 0.2, s * 0.05);
                ctx.lineTo(s * 0.5, -s * 0.35);
                ctx.lineTo(s, s * 0.8);
                ctx.closePath(); ctx.stroke();
                break;
            case 'bike':
                ctx.arc(-s * 0.55, s * 0.35, s * 0.42, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath(); ctx.arc(s * 0.55, s * 0.35, s * 0.42, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(-s * 0.55, s * 0.35);
                ctx.lineTo(s * 0.05, s * 0.35);
                ctx.lineTo(-s * 0.1, -s * 0.35);
                ctx.lineTo(s * 0.55, s * 0.35);
                ctx.moveTo(-s * 0.1, -s * 0.35); ctx.lineTo(s * 0.3, -s * 0.35);
                ctx.stroke();
                break;
            case 'run': // corrida (figura simples)
                ctx.arc(s * 0.18, -s * 0.62, s * 0.22, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(s * 0.12, -s * 0.32); ctx.lineTo(-s * 0.06, s * 0.12);
                ctx.moveTo(-s * 0.06, s * 0.12); ctx.lineTo(-s * 0.5, s * 0.4);
                ctx.moveTo(-s * 0.06, s * 0.12); ctx.lineTo(s * 0.34, s * 0.55);
                ctx.moveTo(s * 0.02, -s * 0.18); ctx.lineTo(s * 0.46, -s * 0.02);
                ctx.moveTo(s * 0.02, -s * 0.18); ctx.lineTo(-s * 0.36, -s * 0.32);
                ctx.stroke();
                break;
            case 'star': // outro
                for (let i = 0; i < 10; i++) {
                    const rr = i % 2 === 0 ? s : s * 0.45;
                    const ang = -Math.PI / 2 + i * Math.PI / 5;
                    const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath(); ctx.stroke();
                break;
            case 'count': // lista
                for (const yy of [-s * 0.6, 0, s * 0.6]) {
                    ctx.moveTo(-s * 0.3, yy); ctx.lineTo(s, yy);
                }
                ctx.stroke();
                for (const yy of [-s * 0.6, 0, s * 0.6]) {
                    ctx.beginPath(); ctx.arc(-s * 0.7, yy, s * 0.13, 0, Math.PI * 2); ctx.fill();
                }
                break;
            default:
                ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
    }

    // ---------------------------------------------------------------- layout
    function layout(bottomY) {
        const m = { brandY: bottomY };
        m.athleteY = m.brandY - 56;
        m.divY = m.athleteY - 46;

        if (payload.type === 'badge') {
            ctx.font = '400 38px Inter, sans-serif';
            m.lines = wrap(payload.desc, 880);
            m.bodyBottom = m.divY - 64;
            m.bodyTop = m.bodyBottom - (m.lines.length - 1) * 50;
            m.titleY = m.bodyTop - 72;
        } else {
            // treino, medalha e resumo (período): só uma linha de métricas
            m.metricsLabelY = m.divY - 58;
            m.metricsValueY = m.metricsLabelY - 42;
            m.metricsIconCy = m.metricsValueY - 74;
            m.bodyTop = m.metricsIconCy - 30;
            m.titleY = m.bodyTop - 62;
        }
        m.labelY = m.titleY - 78;
        m.dotCy = m.labelY - 52;
        m.topY = m.dotCy - 15;
        return m;
    }

    // Cabeçalho "esquenta": FALTAM XXX DIAS PARA A [logo Corrida Integração]
    function drawCountdownTop(cx) {
        const days = daysToRace();
        ctx.save();
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 2;

        if (days <= 0) {
            ctx.fillStyle = '#05e0a3';
            ctx.font = '800 40px Inter, sans-serif';
            ctx.fillText('É HOJE!', cx, 150);
        } else {
            ctx.fillStyle = '#e8eef7';
            ctx.font = '700 19px Inter, sans-serif';
            if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
            ctx.fillText('FALTAM', cx, 92);
            if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

            ctx.fillStyle = '#05e0a3';
            ctx.font = '800 72px Inter, sans-serif';
            ctx.fillText(String(days), cx, 166);

            ctx.fillStyle = '#ffffff';
            ctx.font = '700 20px Inter, sans-serif';
            if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
            ctx.fillText(days === 1 ? 'DIA PARA A' : 'DIAS PARA A', cx, 200);
            if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        }

        // logo wordmark (branco) centralizado abaixo
        if (logoReady) {
            const lw = 238, lh = logo.height * (lw / logo.width);
            const ly = days <= 0 ? 176 : 224;
            ctx.shadowBlur = 10;
            ctx.drawImage(logo, cx - lw / 2, ly, lw, lh);
        }
        ctx.restore();
    }

    function drawBrand(cx, y) {
        const txt = 'Corrida Integração 2026';
        ctx.font = '700 34px Inter, sans-serif';
        ctx.textAlign = 'left';
        const tw = ctx.measureText(txt).width;
        const lh = 44, lw = logoReady ? logo.width * (lh / logo.height) : 0;
        const gap = lw ? 14 : 0;
        const total = lw + gap + tw;
        const x = cx - total / 2;
        if (logoReady) ctx.drawImage(logo, x, y - lh + 10, lw, lh);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(txt, x + lw + gap, y);
        ctx.textAlign = 'center';
    }

    function decodePolyline(str) {
        let pts = [], i = 0, lat = 0, lng = 0;
        while (i < str.length) {
            let b, shift = 0, result = 0;
            do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
            lat += (result & 1) ? ~(result >> 1) : (result >> 1);
            shift = 0; result = 0;
            do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
            lng += (result & 1) ? ~(result >> 1) : (result >> 1);
            pts.push([lat / 1e5, lng / 1e5]);
        }
        return pts;
    }

    // Desenha o traçado GPS normalizado dentro de uma caixa (cx centrado).
    function drawRouteShape(poly, cx, top, maxW, maxH, color) {
        let pts;
        try { pts = decodePolyline(poly); } catch (_) { return; }
        if (!pts || pts.length < 2) return;
        let minLa = Infinity, maxLa = -Infinity, minLn = Infinity, maxLn = -Infinity;
        for (const [la, ln] of pts) {
            if (la < minLa) minLa = la; if (la > maxLa) maxLa = la;
            if (ln < minLn) minLn = ln; if (ln > maxLn) maxLn = ln;
        }
        const midLat = (minLa + maxLa) / 2 * Math.PI / 180;
        const geoW = Math.max((maxLn - minLn) * Math.cos(midLat), 1e-9);
        const geoH = Math.max(maxLa - minLa, 1e-9);
        const scale = Math.min(maxW / geoW, maxH / geoH);
        const dW = geoW * scale, dH = geoH * scale;
        const ox = cx - dW / 2, oy = top + (maxH - dH) / 2;
        const project = ([la, ln]) => [
            ox + (ln - minLn) * Math.cos(midLat) * scale,
            oy + (maxLa - la) * scale,
        ];
        ctx.save();
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath();
        pts.forEach((p, i) => { const [x, y] = project(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 16; ctx.stroke();  // contorno
        ctx.strokeStyle = color; ctx.lineWidth = 9;
        ctx.shadowColor = color; ctx.shadowBlur = 20; ctx.stroke();
        ctx.shadowBlur = 0;
        const s = project(pts[0]), e = project(pts[pts.length - 1]);
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(s[0], s[1], 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(e[0], e[1], 9, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function drawMetricsRow(mts, m, color) {
        const cx = W / 2;
        const n = mts.length || 1;
        const colW = Math.min(290, 960 / n);
        const startX = cx - (colW * n) / 2 + colW / 2;
        mts.forEach((mt, i) => {
            const x = startX + i * colW;
            drawIcon(mt.icon, x, m.metricsIconCy, 18, '#05e0a3');
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.font = '800 34px Inter, sans-serif';
            ctx.fillText(mt.value, x, m.metricsValueY);
            ctx.fillStyle = '#ffffff';
            ctx.font = '600 18px Inter, sans-serif';
            if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
            ctx.fillText((mt.label || '').toUpperCase(), x, m.metricsLabelY);
            if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        });
    }

    function drawContent(m) {
        const cx = W / 2;
        const color = payload.color;
        const isWorkout = payload.type === 'workout';
        const isPeriod = payload.type === 'period';
        const isClean = isWorkout || payload.type === 'medal' || isPeriod;

        // selo (ponto) + rótulo — só em conquistas (treino/medalha/resumo são limpos)
        if (!isClean) {
            ctx.beginPath();
            ctx.arc(cx, m.dotCy, 15, 0, Math.PI * 2);
            ctx.fillStyle = color; ctx.fill();

            ctx.fillStyle = color;
            ctx.font = '600 32px Inter, sans-serif';
            ctx.textAlign = 'center';
            if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
            if (payload.type === 'badge') ctx.fillText('CONQUISTA DESBLOQUEADA', cx, m.labelY);
            if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        }

        // título
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        if (isWorkout) {
            // slogan da corrida (caixa alta) no lugar do nome do esporte
            ctx.font = '800 42px Inter, sans-serif';
            const sloganLines = wrap('A MINHA MAIOR VITÓRIA É A PRÓXIMA', 860);
            sloganLines.forEach((ln, i) => {
                ctx.fillText(ln, cx, m.titleY - (sloganLines.length - 1 - i) * 50);
            });
        } else if (isPeriod) {
            // "MEU CAMINHO ATÉ AQUI [EM UM MÊS]"
            ctx.font = '800 41px Inter, sans-serif';
            const phrase = ('MEU CAMINHO ATÉ AQUI ' + (payload.phrase || '')).trim();
            const lines = wrap(phrase, 860);
            lines.forEach((ln, i) => {
                ctx.fillText(ln, cx, m.titleY - (lines.length - 1 - i) * 48);
            });
        } else if (payload.type === 'medal') {
            ctx.font = '800 72px Inter, sans-serif';
            ctx.fillText(payload.medalLabel, cx, m.titleY);
        } else {
            ctx.font = '800 62px Inter, sans-serif';
            ctx.fillText(payload.title, cx, m.titleY);
        }

        // corpo (métricas)
        if (payload.type === 'badge') {
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '400 38px Inter, sans-serif';
            m.lines.forEach((ln, i) => {
                ctx.fillText(ln, cx, m.bodyBottom - (m.lines.length - 1 - i) * 50);
            });
        } else if (isPeriod) {
            drawMetricsRow(payload.totals || [], m, color);
        } else {
            drawMetricsRow(payload.metrics || [], m, color);
        }

        // rodapé (divisor + atleta + marca) — só em conquistas/resumo; treino e
        // medalha ficam limpos (a marca já aparece grande no topo)
        if (!isClean) {
            ctx.strokeStyle = 'rgba(148,163,184,0.28)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(cx - 220, m.divY); ctx.lineTo(cx + 220, m.divY); ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.font = '800 44px Inter, sans-serif';
            ctx.fillText(ATHLETE, cx, m.athleteY);
            drawBrand(cx, m.brandY);
        }
    }

    // estilo "Completo": grade com TODAS as métricas (base + extras do Strava)
    function drawFullContent(cx, color) {
        const all = (payload.metrics || []).concat(payload.extras || []);
        const bottomAnchor = H - 44;  // sem rodapé: grade encosta mais embaixo
        const cols = 2, rowH = 150;
        const rows = Math.ceil(all.length / cols);
        const leftCx = cx - 235, rightCx = cx + 235;
        const lastCellTop = bottomAnchor - 92;
        const gridTop = lastCellTop - (rows - 1) * rowH;

        ctx.textAlign = 'center';
        all.forEach((mt, i) => {
            const c = i % cols;
            const lastAlone = (i === all.length - 1) && (all.length % 2 === 1);
            const x = lastAlone ? cx : (c === 0 ? leftCx : rightCx);
            const top = gridTop + Math.floor(i / cols) * rowH;
            drawIcon(mt.icon, x, top, 23, '#05e0a3');
            ctx.fillStyle = '#ffffff'; ctx.font = '800 44px Inter, sans-serif';
            ctx.fillText(mt.value, x, top + 56);
            ctx.fillStyle = '#ffffff'; ctx.font = '600 23px Inter, sans-serif';
            if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
            ctx.fillText((mt.label || '').toUpperCase(), x, top + 90);
            if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        });

        // slogan (caixa alta) no lugar do nome do esporte (sem ponto/data/rodapé)
        const titleY = gridTop - 66;
        ctx.fillStyle = '#ffffff'; ctx.font = '800 54px Inter, sans-serif';
        const sloganLines = wrap('A MINHA MAIOR VITÓRIA É A PRÓXIMA', 900);
        sloganLines.forEach((ln, i) => {
            ctx.fillText(ln, cx, titleY - (sloganLines.length - 1 - i) * 62);
        });
    }

    function draw() {
        if (!payload) return;
        const cx = W / 2, color = payload.color;
        ctx.clearRect(0, 0, W, H);

        if (transparent) {
            // sticker: bloco centralizado sobre painel translúcido
            const m0 = layout(0);
            const height = m0.brandY - m0.topY;
            const bottomY = H / 2 + height / 2;
            const m = layout(bottomY);

            const panelW = 940, panelX = cx - panelW / 2;
            const panelTop = m.topY - 46, panelBot = m.brandY + 40;
            roundRect(panelX, panelTop, panelW, panelBot - panelTop, 40);
            ctx.fillStyle = 'rgba(9,14,26,0.55)';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(148,163,184,0.30)';
            ctx.stroke();

            const glow = ctx.createRadialGradient(cx, (panelTop + panelBot) / 2, 30,
                cx, (panelTop + panelBot) / 2, 520);
            glow.addColorStop(0, color + '24');
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.save(); roundRect(panelX, panelTop, panelW, panelBot - panelTop, 40);
            ctx.clip(); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H); ctx.restore();

            drawContent(m);
            return;
        }

        // fundo: foto (cover) ou gradiente
        if (photoImg && photoImg.naturalWidth) {
            coverDraw(photoImg);
        } else {
            const g = ctx.createLinearGradient(0, 0, W, H);
            g.addColorStop(0, '#0b1530');
            g.addColorStop(1, '#050810');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        }

        // degradê azul: transparente em cima -> escuro embaixo
        const og = ctx.createLinearGradient(0, 0, 0, H);
        og.addColorStop(0.00, 'rgba(8,14,32,0)');
        og.addColorStop(0.42, 'rgba(8,14,32,0.12)');
        og.addColorStop(0.62, 'rgba(9,17,42,0.74)');
        og.addColorStop(1.00, 'rgba(4,7,15,0.99)');
        ctx.fillStyle = og; ctx.fillRect(0, 0, W, H);

        // degradê no topo (escuro descendo) — dá leitura na regressiva
        const tg = ctx.createLinearGradient(0, 0, 0, H * 0.42);
        tg.addColorStop(0.00, 'rgba(4,7,15,0.92)');
        tg.addColorStop(0.32, 'rgba(6,12,28,0.50)');
        tg.addColorStop(1.00, 'rgba(8,14,32,0)');
        ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H * 0.42);

        // brilho da cor de acento atrás do bloco
        const gy = H * 0.79;
        const glow = ctx.createRadialGradient(cx, gy, 40, cx, gy, 660);
        glow.addColorStop(0, color + '22');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow; ctx.fillRect(0, H * 0.52, W, H * 0.48);

        // cabeçalho do topo: regressiva (treino/resumo) ou "FINISHER" (medalha)
        if (payload.type === 'workout' || payload.type === 'period') drawCountdownTop(cx);
        else if (payload.type === 'medal') drawMedalTop(cx);

        // estilo "Rota": desenha o traçado GPS na parte de cima, deslocado um
        // pouco pra esquerda (deixa o lado direito mais livre, ex: pra foto)
        if (payload.type === 'workout' && currentVariant() === 'route' && payload.route) {
            drawRouteShape(payload.route, W * 0.22, H * 0.40, 330, 270, '#05e0a3');
        }

        // treino, medalha e resumo: bloco ancorado acima do rodapé de logos
        const clean = payload.type === 'workout' || payload.type === 'medal' || payload.type === 'period';
        if (clean) {
            drawContent(layout(footerSafeBottom() + 18));
            drawFooter(cx);
        } else {
            drawContent(layout(H - 96));
            drawHashtag(cx);
        }
    }

    // Limite inferior seguro: no Stories o Instagram cobre ~250px de baixo;
    // no Feed 4:5 a imagem aparece quase inteira.
    function footerSafeBottom() {
        return fmt === 'story' ? H - 250 : H - 56;
    }

    // Rodapé: realização (Grupo EP) + patrocínio (Covabra) + hashtag
    function drawFooter(cx) {
        const fb = footerSafeBottom();
        ctx.save();
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 8;

        // hashtag (linha mais baixa)
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.font = '700 20px Inter, sans-serif';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
        ctx.fillText(HASHTAG, cx, fb);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

        // faixa de logos
        const logoH = 32;
        const logosBaseline = fb - 46;             // base dos logos
        const labelY = logosBaseline - logoH - 10; // rótulos acima
        const colL = W * 0.31, colR = W * 0.69;

        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '700 15px Inter, sans-serif';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
        ctx.fillText('REALIZAÇÃO', colL, labelY);
        ctx.fillText('PATROCÍNIO', colR, labelY);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

        ctx.shadowBlur = 6;
        if (epReady) {
            const w = logoH * (epLogo.width / epLogo.height);
            ctx.drawImage(epLogo, colL - w / 2, logosBaseline - logoH, w, logoH);
        }
        if (spReady) {
            const w = logoH * (spLogo.width / spLogo.height);
            ctx.drawImage(spLogo, colR - w / 2, logosBaseline - logoH, w, logoH);
        }
        ctx.restore();
    }

    // hashtag pequena no rodapé do card (aparece na imagem postada)
    function drawHashtag(cx) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.font = '700 24px Inter, sans-serif';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
        ctx.fillText(HASHTAG, cx, H - 34);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        ctx.restore();
    }

    async function render() {
        try { await document.fonts.ready; } catch (_) {}
        draw();
    }

    // ---------------------------------------------------------------- foto
    function onPickPhoto() {
        const f = fileInput.files && fileInput.files[0];
        if (!f) return;
        const img = new Image();
        img.onload = () => {
            photoImg = img; offX = 0; offY = 0; photoZoom = 1;
            if (zoomInput) zoomInput.value = 100;
            photoLabel.textContent = 'Trocar foto';
            syncControls();
            render();
        };
        img.src = URL.createObjectURL(f);
    }

    function bindDrag() {
        let dragging = false, lastX = 0, lastY = 0;
        const scale = () => W / (canvas.getBoundingClientRect().width || W);
        canvas.addEventListener('pointerdown', (e) => {
            if (transparent || !photoImg) return;
            dragging = true; lastX = e.clientX; lastY = e.clientY;
            try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
        });
        canvas.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const s = scale();
            offX += (e.clientX - lastX) * s;
            offY += (e.clientY - lastY) * s;
            lastX = e.clientX; lastY = e.clientY;
            draw();
        });
        const end = () => { dragging = false; };
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);
    }

    // ---------------------------------------------------------------- ações
    function dataUrlToFile(url, name) {
        const [head, b64] = url.split(',');
        const mime = (head.match(/:(.*?);/) || [])[1] || 'image/png';
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new File([arr], name, { type: mime });
    }

    function download(url, name) {
        const a = document.createElement('a');
        a.href = url; a.download = name; a.click();
    }

    // Importante: gera a imagem de forma SÍNCRONA (toDataURL) e chama
    // navigator.share na mesma "tarefa" do clique — o Safari/iOS cancela o
    // compartilhamento se houver um await entre o gesto e o share.
    function doShare() {
        const names = {
            badge: 'conquista-corrida-integracao.png',
            medal: 'medalha-corrida-integracao.png',
            period: 'resumo-corrida-integracao.png',
        };
        const name = names[payload.type] || 'treino-corrida-integracao.png';
        const texts = {
            badge: `Desbloqueei a conquista "${payload.title}" no Corrida Integração! 💪`,
            medal: `Sou FINISHER ${payload.medalLabel} da 41ª Corrida Integração! 🏅`,
            period: `Meu caminho até aqui rumo à 41ª Corrida Integração! 🏃`,
        };
        const text = texts[payload.type] || `Treino de ${payload.sportLabel} registrado no Corrida Integração! 💪`;
        let dataUrl;
        try { dataUrl = canvas.toDataURL('image/png'); }
        catch (_) { return; }
        const file = dataUrlToFile(dataUrl, name);
        const data = { files: [file], title: 'Corrida Integração', text };
        if (navigator.canShare && navigator.canShare(data)) {
            navigator.share(data).catch((err) => {
                // se o usuário não cancelou, oferece o download como alternativa
                if (err && err.name !== 'AbortError') download(dataUrl, name);
            });
            return;
        }
        download(dataUrl, name);
    }

    function open(data) {
        if (!overlay) buildSheet();
        payload = data;
        photoImg = null; offX = 0; offY = 0; transparent = false; photoZoom = 1;
        if (zoomInput) zoomInput.value = 100;
        variants = variantsFor(payload);
        variantIdx = 0;
        fileInput.value = '';
        transInput.checked = false;
        photoLabel.textContent = 'Adicionar foto';
        // modo transparente só faz sentido pra conquistas (sticker)
        transWrap.style.display = payload.type === 'badge' ? '' : 'none';
        setFormat('story');  // sempre abre em 9:16; também reseta canvas.height
        syncControls();
        updateVariantNav();
        overlay.hidden = false;
        render();
    }

    function close() { if (overlay) overlay.hidden = true; }

    // ---------------------------------------------------------------- bind
    function bindButtons(root) {
        (root || document).querySelectorAll('[data-mf-share]').forEach((btn) => {
            if (btn._mfBound) return;
            btn._mfBound = true;
            btn.addEventListener('click', () => {
                try { open(JSON.parse(btn.dataset.mfShare)); } catch (_) {}
            });
        });
    }

    window.IntegracaoShare = { open, bind: bindButtons };
    document.addEventListener('DOMContentLoaded', () => bindButtons());
    bindButtons();
})();
