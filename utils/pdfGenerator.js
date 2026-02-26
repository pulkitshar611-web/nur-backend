const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

/**
 * Professional PDF Invoice Generator
 */
const generateInvoicePDF = async (data) => {
    const {
        customerName,
        customerGstNumber,
        customerEmail,
        startDate,
        endDate,
        tickets,
        companyProfile
    } = data;

    const pdfDoc = await PDFDocument.create();
    let currentPage = pdfDoc.addPage([612, 792]);
    const { width, height } = currentPage.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Constants
    const PG_W = 612;
    const PG_H = 792;
    const ML = 40;
    const MR = 40;
    const COL_R = PG_W - MR;
    const USABLE_W = PG_W - ML - MR;

    const C_PRIMARY = rgb(0.16, 0.36, 0.32);
    const C_DARK = rgb(0.15, 0.15, 0.15);
    const C_MID = rgb(0.42, 0.42, 0.42);
    const C_LIGHT = rgb(0.95, 0.95, 0.95);
    const C_SEP = rgb(0.78, 0.78, 0.78);
    const C_WHITE = rgb(1, 1, 1);

    // Helpers
    const wrap = (text, maxCh) => {
        const s = String(text || '').trim();
        if (!s) return ['-'];
        if (s.length <= maxCh) return [s];
        const words = s.split(' ');
        const out = []; let cur = '';
        for (const w of words) {
            const attempt = cur ? `${cur} ${w}` : w;
            if (attempt.length <= maxCh) { cur = attempt; }
            else { if (cur) out.push(cur); cur = w.substring(0, maxCh); }
        }
        if (cur) out.push(cur);
        return out;
    };

    const toDate = (d) => {
        if (!d) return null;
        if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
        const s = String(d).replace('T', ' ').split(' ')[0];
        const [y, m, dy] = s.split('-');
        if (!y || !m || !dy) return null;
        return new Date(Number(y), Number(m) - 1, Number(dy));
    };
    const fmtL = (d) => { const dt = toDate(d); return dt ? dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'; };
    const fmtS = (d) => { const dt = toDate(d); return dt ? dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'; };

    const dR = (pg, txt, rx, y, sz, f, c) => {
        const tw = f.widthOfTextAtSize(txt, sz);
        pg.drawText(txt, { x: rx - tw, y, size: sz, font: f, color: c || C_DARK });
    };
    const hRule = (pg, y) => pg.drawRectangle({ x: ML, y, width: USABLE_W, height: 0.5, color: C_SEP });

    // Header Logic
    const HDR_TOP = PG_H - 38;
    const LOGO_MAX_W = 90;
    const LOGO_MAX_H = 70;
    const INFO_X = 140;
    const LOGO_BOT = HDR_TOP - LOGO_MAX_H;

    // Embed logo
    if (companyProfile.company_logo) {
        try {
            let lbytes = null, isPng = false;
            if (companyProfile.company_logo.startsWith('data:image')) {
                const mm = companyProfile.company_logo.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
                if (mm) { lbytes = Buffer.from(mm[2], 'base64'); isPng = mm[1] === 'png' || mm[1] === 'webp'; }
            } else {
                const lp = path.join(__dirname, '..', companyProfile.company_logo);
                if (fs.existsSync(lp)) { lbytes = fs.readFileSync(lp); isPng = lp.toLowerCase().endsWith('.png'); }
            }
            if (lbytes) {
                const li = isPng ? await pdfDoc.embedPng(lbytes) : await pdfDoc.embedJpg(lbytes);
                const nat = li.scale(1);
                const sc = Math.min(LOGO_MAX_H / nat.height, LOGO_MAX_W / nat.width, 1);
                const sc2 = li.scale(sc);
                currentPage.drawImage(li, { x: ML, y: HDR_TOP - sc2.height, width: sc2.width, height: sc2.height });
            }
        } catch (e) { console.error('[PDF Gen] logo:', e.message); }
    }

    // Company Info
    currentPage.drawText((companyProfile.company_name || 'Noor Trucking Inc.').toUpperCase(), {
        x: INFO_X, y: HDR_TOP, size: 16, font: boldFont, color: C_PRIMARY,
    });

    let infoY = HDR_TOP - 18;
    const addrLines = (companyProfile.address || '').split('\n');
    for (const ln of addrLines) {
        if (ln.trim()) {
            currentPage.drawText(ln.trim().substring(0, 45), { x: INFO_X, y: infoY, size: 8.5, font, color: C_MID });
            infoY -= 12;
        }
    }
    currentPage.drawText(`Tel: ${companyProfile.phone || '+1 (780) 555-0100'}`, { x: INFO_X, y: infoY, size: 8.5, font, color: C_MID });
    infoY -= 12;
    currentPage.drawText(companyProfile.email || 'accounting@noortruckinginc.com', { x: INFO_X, y: infoY, size: 8.5, font, color: C_MID });
    infoY -= 12;
    // CRITICAL: GST NUMBER DISPLAY
    currentPage.drawText('GST # 818440612RT0001', { x: INFO_X, y: infoY, size: 9, font: boldFont, color: C_PRIMARY });

    // Invoice Details
    const INV_DATE = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const INV_NUM = `INV-${tickets[0].customer_id}-${String(startDate).replace(/-/g, '').slice(2)}`;

    dR(currentPage, 'INVOICE', COL_R, HDR_TOP, 28, boldFont, C_PRIMARY);
    dR(currentPage, `#: ${INV_NUM}`, COL_R, HDR_TOP - 30, 9, font, C_DARK);
    dR(currentPage, `Date: ${INV_DATE}`, COL_R, HDR_TOP - 43, 9, font, C_DARK);

    // Prominently show GST here too if needed
    dR(currentPage, 'GST # 818440612RT0001', COL_R, HDR_TOP - 56, 10, boldFont, C_PRIMARY);

    hRule(currentPage, LOGO_BOT - 10);

    // Bill To / Period
    const BILL_Y = LOGO_BOT - 26;
    currentPage.drawText('BILL TO:', { x: ML, y: BILL_Y, size: 8, font: boldFont, color: C_PRIMARY });

    let custY = BILL_Y - 15;
    currentPage.drawText(String(customerName || '-').toUpperCase(), { x: ML, y: custY, size: 11, font: boldFont, color: C_DARK });

    custY -= 14;
    if (data.customerPhone) {
        currentPage.drawText(`Ph: ${data.customerPhone}`, { x: ML, y: custY, size: 9, font, color: C_MID });
        custY -= 12;
    }
    if (customerEmail) {
        currentPage.drawText(`Email: ${customerEmail}`, { x: ML, y: custY, size: 9, font, color: C_MID });
        custY -= 12;
    }
    if (customerGstNumber) {
        currentPage.drawText(`GST: ${customerGstNumber}`, { x: ML, y: custY, size: 9, font, color: C_MID });
    }

    currentPage.drawText('PERIOD:', { x: COL_R - 180, y: BILL_Y, size: 8, font: boldFont, color: C_PRIMARY });
    currentPage.drawText(`${fmtL(startDate)} – ${fmtL(endDate)}`, { x: COL_R - 180, y: BILL_Y - 15, size: 9.5, font, color: C_DARK });

    hRule(currentPage, BILL_Y - 55);

    // Table
    // REFACTORED COLUMNS: Remove Driver/Subcontractor
    // Date(80) | Ticket#(80) | Description(250) | Qty(40) | Rate(40) | Total(60)
    const CW = [80, 80, 242, 40, 50, 60];
    const CGP = 2;
    const TW = CW.reduce((a, b) => a + b, 0) + CGP * (CW.length - 1); // 532
    const TBL_X = ML;
    const HDR_H = 22;

    let curY = BILL_Y - 60;

    const drawTblHdr = (pg, y) => {
        pg.drawRectangle({ x: TBL_X, y: y - HDR_H + 6, width: TW, height: HDR_H, color: C_PRIMARY });
        const hdrs = ['Date', 'Ticket #', 'Description', 'Qty', 'Rate', 'Total'];
        let cx = TBL_X;
        hdrs.forEach((h, i) => {
            const isNum = i >= 3;
            const tw2 = boldFont.widthOfTextAtSize(h, 8);
            pg.drawText(h, {
                x: isNum ? cx + CW[i] - tw2 - 3 : cx + 5,
                y: y - 14, size: 8, font: boldFont, color: C_WHITE,
            });
            cx += CW[i] + CGP;
        });
        return y - HDR_H - 2;
    };

    curY = drawTblHdr(currentPage, curY);

    let subtotal = 0;
    tickets.forEach((ticket, idx) => {
        if (curY < 100) {
            currentPage = pdfDoc.addPage([PG_W, PG_H]);
            curY = drawTblHdr(currentPage, PG_H - 50);
        }

        const amt = parseFloat(ticket.total_bill || 0);
        subtotal += amt;

        const tDate = fmtS(ticket.date);
        const tNum = String(ticket.ticket_number || '-').substring(0, 15);
        const desc = String(ticket.equipment_type || ticket.job_type || ticket.description || '-').substring(0, 50);
        const dLines = wrap(desc, 45);

        const ROW_H = Math.max(dLines.length * 12 + 8, 20);

        if (idx % 2 === 0) {
            currentPage.drawRectangle({ x: TBL_X, y: curY - ROW_H + 6, width: TW, height: ROW_H, color: C_LIGHT });
        }

        const TXT_Y = curY - 5;
        let cx = TBL_X;

        currentPage.drawText(tDate, { x: cx + 5, y: TXT_Y, size: 8, font, color: C_DARK }); cx += CW[0] + CGP;
        currentPage.drawText(tNum, { x: cx + 5, y: TXT_Y, size: 8, font, color: C_DARK }); cx += CW[1] + CGP;

        dLines.forEach((l, li) => {
            currentPage.drawText(l, { x: cx + 5, y: TXT_Y - li * 12, size: 8, font, color: C_DARK });
        });
        cx += CW[2] + CGP;

        dR(currentPage, parseFloat(ticket.quantity || 0).toFixed(1), cx + CW[3], TXT_Y, 8, font, C_DARK); cx += CW[3] + CGP;
        dR(currentPage, `$${parseFloat(ticket.bill_rate || 0).toFixed(2)}`, cx + CW[4], TXT_Y, 8, font, C_DARK); cx += CW[4] + CGP;
        dR(currentPage, `$${amt.toFixed(2)}`, cx + CW[5], TXT_Y, 8, boldFont, C_PRIMARY);

        curY -= ROW_H;
    });

    // Totals
    const gst = subtotal * 0.05;
    const total = subtotal + gst;

    curY -= 20;
    if (curY < 120) { currentPage = pdfDoc.addPage([PG_W, PG_H]); curY = PG_H - 80; }

    const TOT_X = COL_R - 150;
    currentPage.drawText('Subtotal:', { x: TOT_X, y: curY, size: 10, font, color: C_MID });
    dR(currentPage, `$${subtotal.toFixed(2)}`, COL_R, curY, 10, font, C_DARK);
    curY -= 16;
    currentPage.drawText('GST (5%):', { x: TOT_X, y: curY, size: 10, font, color: C_MID });
    dR(currentPage, `$${gst.toFixed(2)}`, COL_R, curY, 10, font, C_DARK);
    curY -= 10;
    currentPage.drawRectangle({ x: TOT_X, y: curY, width: COL_R - TOT_X, height: 1, color: C_PRIMARY });
    curY -= 18;
    currentPage.drawText('TOTAL DUE:', { x: TOT_X, y: curY, size: 12, font: boldFont, color: C_PRIMARY });
    dR(currentPage, `$${total.toFixed(2)}`, COL_R, curY, 12, boldFont, C_PRIMARY);

    // Footer
    const footerText = `${companyProfile.company_name} | accounting@noortruckinginc.com | ${INV_NUM}`;
    const ftw = font.widthOfTextAtSize(footerText, 8);
    currentPage.drawText(footerText, { x: (PG_W - ftw) / 2, y: 30, size: 8, font, color: C_MID });

    const pdfBytes = await pdfDoc.save();
    return { pdfBytes, filename: `Invoice-${customerName.replace(/[^a-z0-9]/gi, '_')}-${startDate}.pdf` };
};

/**
 * Professional Settlement PDF Generator
 */
const generateSettlementPDF = async (data) => {
    const {
        driverName,
        userIdCode,
        startDate,
        endDate,
        tickets,
        companyProfile
    } = data;

    const pdfDoc = await PDFDocument.create();
    let currentPage = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const PG_W = 612; const PG_H = 792;
    const ML = 40; const MR = 40; const COL_R = PG_W - MR;
    const C_PRIMARY = rgb(0.16, 0.36, 0.32);
    const C_DARK = rgb(0.15, 0.15, 0.15);
    const C_MID = rgb(0.42, 0.42, 0.42);
    const C_LIGHT = rgb(0.95, 0.95, 0.95);
    const C_SEP = rgb(0.78, 0.78, 0.78);
    const C_WHITE = rgb(1, 1, 1);

    const fmtL = (d) => { if (!d) return '-'; const dt = new Date(d); return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); };
    const dR = (pg, txt, rx, y, sz, f, c) => { const tw = f.widthOfTextAtSize(txt, sz); pg.drawText(txt, { x: rx - tw, y, size: sz, font: f, color: c || C_DARK }); };

    // Header logic
    const HDR_TOP = PG_H - 38;
    const LOGO_MAX_W = 90; const LOGO_MAX_H = 70;
    if (companyProfile.company_logo) {
        try {
            let lbytes = null, isPng = false;
            if (companyProfile.company_logo.startsWith('data:image')) {
                const mm = companyProfile.company_logo.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
                if (mm) { lbytes = Buffer.from(mm[2], 'base64'); isPng = mm[1] === 'png' || mm[1] === 'webp'; }
            } else {
                const lp = path.join(__dirname, '..', companyProfile.company_logo);
                if (fs.existsSync(lp)) { lbytes = fs.readFileSync(lp); isPng = lp.toLowerCase().endsWith('.png'); }
            }
            if (lbytes) {
                const li = isPng ? await pdfDoc.embedPng(lbytes) : await pdfDoc.embedJpg(lbytes);
                const sc = Math.min(LOGO_MAX_H / li.height, LOGO_MAX_W / li.width, 1);
                currentPage.drawImage(li, { x: ML, y: HDR_TOP - li.height * sc, width: li.width * sc, height: li.height * sc });
            }
        } catch (e) { }
    }
    currentPage.drawText((companyProfile.company_name || 'Noor Trucking Inc.').toUpperCase(), { x: 140, y: HDR_TOP, size: 16, font: boldFont, color: C_PRIMARY });
    currentPage.drawText(`GST # 818440612RT0001`, { x: 140, y: HDR_TOP - 18, size: 9, font: boldFont, color: C_PRIMARY });

    dR(currentPage, 'SETTLEMENT', COL_R, HDR_TOP, 24, boldFont, C_PRIMARY);
    dR(currentPage, `Period: ${fmtL(startDate)} - ${fmtL(endDate)}`, COL_R, HDR_TOP - 30, 9, font, C_DARK);

    const INFO_Y = HDR_TOP - 80;
    currentPage.drawText('DRIVER INFO:', { x: ML, y: INFO_Y, size: 8, font: boldFont, color: C_PRIMARY });
    currentPage.drawText(driverName, { x: ML, y: INFO_Y - 15, size: 12, font: boldFont, color: C_DARK });
    currentPage.drawText(`ID Code: ${userIdCode}`, { x: ML, y: INFO_Y - 30, size: 9, font, color: C_MID });

    let curY = INFO_Y - 60;
    const drawTblHdr = (pg, y) => {
        const CW = [70, 60, 160, 45, 55, 65];
        pg.drawRectangle({ x: ML, y: y - 16, width: COL_R - ML, height: 20, color: C_PRIMARY });
        const h = ['Date', 'Ticket #', 'Description', 'Qty', 'Rate', 'Total Pay'];
        let cx = ML;
        h.forEach((txt, i) => { dR(pg, txt, cx + CW[i], y - 10, 8, boldFont, C_WHITE); cx += CW[i] + 5; });
        return y - 25;
    };

    curY = drawTblHdr(currentPage, curY);

    let grandTotal = 0;
    tickets.forEach((ticket, idx) => {
        if (curY < 80) { currentPage = pdfDoc.addPage([PG_W, PG_H]); curY = drawTblHdr(currentPage, PG_H - 50); }
        const CW = [70, 60, 160, 45, 55, 65];
        const amt = parseFloat(ticket.total_pay || 0); grandTotal += amt;
        if (idx % 2 === 0) currentPage.drawRectangle({ x: ML, y: curY - 12, width: COL_R - ML, height: 16, color: C_LIGHT });
        let cx = ML;
        currentPage.drawText(new Date(ticket.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), { x: cx + 5, y: curY, size: 8, font }); cx += CW[0] + 5;
        currentPage.drawText(String(ticket.ticket_number || '').substring(0, 10), { x: cx + 5, y: curY, size: 8, font }); cx += CW[1] + 5;
        currentPage.drawText(String(ticket.equipment_type || '').substring(0, 30), { x: cx + 5, y: curY, size: 8, font }); cx += CW[2] + 5;
        dR(currentPage, parseFloat(ticket.quantity).toFixed(1), cx + CW[3], curY, 8, font); cx += CW[3] + 5;
        dR(currentPage, `$${parseFloat(ticket.pay_rate).toFixed(2)}`, cx + CW[4], curY, 8, font); cx += CW[4] + 5;
        dR(currentPage, `$${amt.toFixed(2)}`, cx + CW[5], curY, 8, boldFont, C_PRIMARY);
        curY -= 18;
    });

    curY -= 20;
    currentPage.drawText('GRAND TOTAL PAY:', { x: COL_R - 180, y: curY, size: 12, font: boldFont, color: C_PRIMARY });
    dR(currentPage, `$${grandTotal.toFixed(2)}`, COL_R, curY, 12, boldFont, C_PRIMARY);

    const pdfBytes = await pdfDoc.save();
    return { pdfBytes, filename: `Settlement-${driverName}-${startDate}.pdf` };
};

module.exports = { generateInvoicePDF, generateSettlementPDF };
