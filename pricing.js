// ————————————————————————————————————————————————————————————————
// أدوات مساعدة
// ————————————————————————————————————————————————————————————————
const normArabic = (s = "") => s
  .toString()
  .replace(/\u0640/g, "")
  .replace(/[\u0622\u0623\u0625]/g, "ا")
  .replace(/\u0629/g, "ه")
  .replace(/\u0649/g, "ي")
  .replace(/[\u0610-\u061A\u064B-\u065F\u0670-\u0673]/g, "")
  .trim();

const parseBarcodes = (val) => {
  if (!val) return [];
  return String(val)
    .split(/[,|\n]/)
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => x.replace(/\s+/g, ""))
    .map(x => x.replace(/[^0-9]/g, ""))
    .filter(x => x.length >= 6 && x.length <= 18);
};

const money = (n) => (n == null || isNaN(n)) ? "—" : Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ————————————————————————————————————————————————————————————————
// حالة التطبيق
// ————————————————————————————————————————————————————————————————
let PRODUCTS = [];
let INDEX_BC_BASE = new Map();
let INDEX_BC_OTHER = new Map();
let pricingItems = [];
let currentStream = null;
let scanInterval = null;

const els = {
  startCam: document.getElementById('startCam'),
  stopCam: document.getElementById('stopCam'),
  switchCam: document.getElementById('switchCam'),
  video: document.getElementById('video'),
  cameraSelect: document.getElementById('cameraSelect'),
  scanStatus: document.getElementById('scanStatus'),
  barcodeInput: document.getElementById('barcodeInput'),
  barcodeType: document.getElementById('barcodeType'),
  addBarcodeBtn: document.getElementById('addBarcodeBtn'),
  barcodeResults: document.getElementById('barcodeResults'),
  nameInput: document.getElementById('nameInput'),
  nameType: document.getElementById('nameType'),
  addNameBtn: document.getElementById('addNameBtn'),
  nameResults: document.getElementById('nameResults'),
  pricingList: document.getElementById('pricingList'),
  clearListBtn: document.getElementById('clearListBtn'),
  generatePdfBtn: document.getElementById('generatePdfBtn'),
  downloadPdfBtn: document.getElementById('downloadPdfBtn'),
  printBtn: document.getElementById('printBtn'),
  itemCount: document.getElementById('itemCount'),
  pdfPreview: document.getElementById('pdfPreview'),
  pdfContent: document.getElementById('pdfContent')
};

// ————————————————————————————————————————————————————————————————
// تحميل البيانات
// ————————————————————————————————————————————————————————————————
function extractProducts(json) {
  if (Array.isArray(json)) return json;
  for (const k of Object.keys(json)) {
    const v = json[k];
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
      if ('ITEM_NAME_AR' in v[0]) return v;
    }
  }
  return [];
}

function cleanAndIndex(products) {
  PRODUCTS = products.map((p, i) => {
    const name = (p.ITEM_NAME_AR ?? p.name ?? "").toString();
    const saleBase = (p.SALE_PRICE_BASE ?? p.PRICE_BASE_UNIT ?? null);
    const saleOther = (p.SALE_PRICE_OTHER ?? p.PRICE_BIG_UNIT ?? null);
    const baseBCs = parseBarcodes(p.BASE_UNIT_BARCODES ?? p.BASE_BARCODES ?? p.BARCODES_BASE);
    const otherBCs = parseBarcodes(p.OTHER_UNIT_BARCODES ?? p.LESS_UNIT_BARCODES ?? p.BARCODES_OTHER);
    return {
      _i: i,
      name,
      nameNorm: normArabic(name),
      saleBase: saleBase != null ? Number(saleBase) : null,
      saleOther: saleOther != null ? Number(saleOther) : null,
      baseBCs,
      otherBCs
    };
  });

  INDEX_BC_BASE = new Map();
  INDEX_BC_OTHER = new Map();
  PRODUCTS.forEach((p, i) => {
    p.baseBCs.forEach(bc => INDEX_BC_BASE.set(bc, i));
    p.otherBCs.forEach(bc => INDEX_BC_OTHER.set(bc, i));
  });

  console.log(`تم تحميل ${PRODUCTS.length} منتج بنجاح`);
}

async function loadProductsFromJSON() {
  try {
    const response = await fetch('products.json');
    if (!response.ok) throw new Error('فشل في تحميل ملف المنتجات');
    const json = await response.json();
    const products = extractProducts(json);
    if (!products.length) throw new Error('تعذر العثور على مصفوفة منتجات صالحة داخل الملف.');
    cleanAndIndex(products);
  } catch (err) {
    console.error(err);
    alert('فشل في تحميل بيانات المنتجات. تأكد من وجود ملف products.json');
  }
}
loadProductsFromJSON();

// ————————————————————————————————————————————————————————————————
// إدارة الكاميرا
// ————————————————————————————————————————————————————————————————
async function listCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    
    els.cameraSelect.innerHTML = '';
    
    if (videoDevices.length > 1) {
      const autoBackOption = document.createElement('option');
      autoBackOption.value = 'auto-back';
      autoBackOption.textContent = 'تلقائي - كاميرا خلفية';
      els.cameraSelect.appendChild(autoBackOption);
      
      const autoFrontOption = document.createElement('option');
      autoFrontOption.value = 'auto-front';
      autoFrontOption.textContent = 'تلقائي - كاميرا أمامية';
      els.cameraSelect.appendChild(autoFrontOption);
    }
    
    videoDevices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      const label = device.label || `كاميرا ${index + 1}`;
      const isBack = /back|rear|environment/i.test(label);
      const isFront = /front|user|face/i.test(label);
      option.textContent = label + (isBack ? ' (خلفية)' : isFront ? ' (أمامية)' : '');
      els.cameraSelect.appendChild(option);
    });
    
    if (videoDevices.length > 1) {
      els.cameraSelect.value = 'auto-back';
    }
  } catch (err) {
    console.error('خطأ في تعداد الكاميرات:', err);
  }
}

async function startCamera() {
  const isSecure = window.isSecureContext || location.hostname === 'localhost';
  if (!isSecure) {
    els.scanStatus.innerHTML = '<span style="color: #dc2626;">الرجاء فتح الصفحة عبر HTTPS أو localhost للسماح بالوصول للكاميرا.</span>';
    return;
  }
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
    els.scanStatus.innerHTML = '<span style="color: #dc2626;">المتصفح لا يدعم كاميرا الويب.</span>';
    return;
  }

  try {
    els.scanStatus.textContent = 'جارِ تشغيل الكاميرا…';
    const sel = els.cameraSelect.value;
    let constraints = { audio: false, video: {} };
    
    if (sel === 'auto-back') {
      constraints.video = { facingMode: { ideal: 'environment' } };
    } else if (sel === 'auto-front') {
      constraints.video = { facingMode: { ideal: 'user' } };
    } else if (sel && sel !== 'auto-back' && sel !== 'auto-front') {
      constraints.video = { deviceId: { exact: sel } };
    } else {
      constraints.video = { facingMode: { ideal: 'environment' } };
    }

    stopCamera();

    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    els.video.srcObject = currentStream;
    await els.video.play();
    els.startCam.disabled = true; 
    els.stopCam.disabled = false;
    els.switchCam.disabled = false;
    els.scanStatus.textContent = 'جاهز للمسح';

    listCameras();
    startScanning();
  } catch (e) {
    console.error(e);
    let msg = 'تعذّر تشغيل الكاميرا.';
    if (e?.name === 'NotAllowedError') msg = 'تم رفض الإذن — افتح إعدادات الموقع واسمح للكاميرا ثم أعد المحاولة.';
    else if (e?.name === 'NotFoundError') msg = 'لا توجد كاميرا متاحة.';
    else if (e?.name === 'NotReadableError') msg = 'الكاميرا مستخدمة من تطبيق آخر.';
    else if (e?.name === 'SecurityError') msg = 'قيود أمنية — استخدم HTTPS أو localhost.';
    els.scanStatus.innerHTML = `<span style="color: #dc2626;">${msg}</span>`;
    stopCamera();
  }
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  
  els.startCam.disabled = false;
  els.stopCam.disabled = true;
  els.switchCam.disabled = true;
  els.scanStatus.textContent = '';
}

function startScanning() {
  if ('BarcodeDetector' in window) {
    scanWithBarcodeDetector();
  } else if (typeof Quagga !== 'undefined') {
    scanWithQuagga();
  } else {
    els.scanStatus.textContent = 'قارئ الباركود غير متاح';
  }
}

function scanWithBarcodeDetector() {
  const detector = new BarcodeDetector();
  scanInterval = setInterval(async () => {
    try {
      const barcodes = await detector.detect(els.video);
      if (barcodes.length > 0) {
        const code = barcodes[0].rawValue;
        handleBarcodeDetected(code);
      }
    } catch (err) {
      console.error('خطأ في قراءة الباركود:', err);
    }
  }, 500);
}

function scanWithQuagga() { scanInterval = setInterval(() => {}, 500); }

function handleBarcodeDetected(code) {
  const c = String(code || '').replace(/[^0-9]/g, '');
  if (!c) return;
  addByBarcode(c);
}

// ————————————————————————————————————————————————————————————————
// البحث اليدوي
// ————————————————————————————————————————————————————————————————
function searchProducts(query) {
  if (!query.trim()) return [];
  const queryNorm = normArabic(query);
  const isBarcode = /^[0-9]{6,18}$/.test(query.replace(/[^0-9]/g, ''));
  if (isBarcode) {
    const cleanCode = query.replace(/[^0-9]/g, '');
    const iBase = INDEX_BC_BASE.get(cleanCode);
    const iOther = INDEX_BC_OTHER.get(cleanCode);
    if (Number.isInteger(iBase)) return [{ product: PRODUCTS[iBase], type: 'base' }];
    if (Number.isInteger(iOther)) return [{ product: PRODUCTS[iOther], type: 'other' }];
    return [];
  }
  return PRODUCTS
    .filter(p => p.nameNorm.includes(queryNorm))
    .slice(0, 5)
    .map(p => ({ product: p, type: 'name' }));
}

// ————————————————————————————————————————————————————————————————
// البحث بالباركود
// ————————————————————————————————————————————————————————————————
function handleBarcodeInput() {
  const code = els.barcodeInput.value.trim();
  if (!code) { els.barcodeResults.textContent = ""; return; }
  const bcBase = INDEX_BC_BASE.get(code);
  const bcOther = INDEX_BC_OTHER.get(code);
  if (Number.isInteger(bcBase) || Number.isInteger(bcOther)) {
    const preferType = els.barcodeType.value;
    addByBarcode(code, preferType);
    els.barcodeInput.value = "";
    els.barcodeResults.textContent = "تم إضافة المنتج بنجاح";
    setTimeout(() => els.barcodeResults.textContent = "", 2000);
  } else {
    els.barcodeResults.textContent = "الباركود غير موجود";
  }
}

// ————————————————————————————————————————————————————————————————
// البحث بالاسم
// ————————————————————————————————————————————————————————————————
function handleNameSearch() {
  const query = els.nameInput.value.trim();
  if (!query) { els.nameResults.textContent = ""; return; }
  const results = searchProducts(query);
  if (results.length === 0) { els.nameResults.textContent = "لا توجد نتائج"; return; }
  const preferType = els.nameType.value;
  const html = results.slice(0, 10).map(r => {
    const price = preferType === 'base' ? r.product.saleBase : r.product.saleOther;
    const priceText = price ? money(price) : "غير متوفر";
    return `<div class="search-result" onclick="addToPricingList('${escapeHtml(r.product.name)}', ${price || 0}, '${preferType}'); els.nameInput.value=''; els.nameResults.textContent='';">
      ${escapeHtml(r.product.name)} - ${priceText}
    </div>`;
  }).join('');
  els.nameResults.innerHTML = html;
}

function addSelectedProduct() {
  const query = els.nameInput.value.trim();
  if (!query) return;
  const results = searchProducts(query);
  if (results.length > 0) {
    const preferType = els.nameType.value;
    const product = results[0].product;
    const price = preferType === 'base' ? product.saleBase : product.saleOther;
    addToPricingList(product.name, price || 0, preferType);
    els.nameInput.value = ""; els.nameResults.textContent = "";
  }
}

// إضافة عنصر بالباركود
function addByBarcode(code, preferType) {
  const iBase = INDEX_BC_BASE.get(code);
  const iOther = INDEX_BC_OTHER.get(code);
  if (preferType === 'base' && Number.isInteger(iBase)) {
    const p = PRODUCTS[iBase]; if (p.saleBase != null) { addToPricingList(p.name, p.saleBase, 'base'); return true; }
  }
  if (preferType === 'other' && Number.isInteger(iOther)) {
    const p = PRODUCTS[iOther]; if (p.saleOther != null) { addToPricingList(p.name, p.saleOther, 'other'); return true; }
  }
  if (Number.isInteger(iBase)) {
    const p = PRODUCTS[iBase]; if (p.saleBase != null) { addToPricingList(p.name, p.saleBase, 'base'); return true; }
  }
  if (Number.isInteger(iOther)) {
    const p = PRODUCTS[iOther]; if (p.saleOther != null) { addToPricingList(p.name, p.saleOther, 'other'); return true; }
  }
  return false;
}

// ————————————————————————————————————————————————————————————————
// إدارة قائمة التسعير
// ————————————————————————————————————————————————————————————————
function savePricingListToStorage() {
  try { localStorage.setItem('pricingItems', JSON.stringify(pricingItems)); }
  catch (error) { console.error('خطأ في حفظ القائمة:', error); }
}

function loadPricingListFromStorage() {
  try {
    const saved = localStorage.getItem('pricingItems');
    if (saved) { pricingItems = JSON.parse(saved); renderPricingList(); console.log(`تم تحميل ${pricingItems.length} منتج من التخزين المحلي`); }
  } catch (error) { console.error('خطأ في تحميل القائمة:', error); pricingItems = []; }
}

function addToPricingList(name, price, type) {
  if (price == null || isNaN(price)) return;
  const item = { id: Date.now() + Math.random(), name, price: Number(price), type };
  pricingItems.push(item);
  savePricingListToStorage();
  renderPricingList();
}

function removeFromPricingList(id) {
  pricingItems = pricingItems.filter(item => item.id !== id);
  savePricingListToStorage();
  renderPricingList();
}

function renderPricingList() {
  if (pricingItems.length === 0) {
    els.pricingList.innerHTML = '<div class="hint" style="padding: 20px; text-align: center;">لا توجد منتجات في القائمة</div>';
  } else {
    els.pricingList.innerHTML = pricingItems.map(item => `
      <div class="pricing-item">
        <div>
          <div class="product-name">${item.name}</div>
          <div class="hint">${item.type === 'base' ? 'سعر أساسي' : 'سعر آخر'}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="product-price">$${money(item.price)}</div>
          <button class="remove-btn" onclick="removeFromPricingList(${item.id})">حذف</button>
        </div>
      </div>
    `).join('');
  }
  els.itemCount.textContent = `${pricingItems.length} منتج`;
}

function clearPricingList() {
  pricingItems = [];
  savePricingListToStorage();
  renderPricingList();
  els.pdfPreview.style.display = 'none';
  els.pdfContent.innerHTML = '';
  els.printBtn.style.display = 'none';
}

// ————————————————————————————————————————————————————————————————
// بناء HTML الصفحات (8×2 لكل صفحة)
// ————————————————————————————————————————————————————————————————
function buildTablesHTML() {
  const itemsPerPage = 16; // 8 صفوف × 2 أعمدة
  const pages = [];
  for (let i = 0; i < pricingItems.length; i += itemsPerPage) {
    pages.push(pricingItems.slice(i, i + itemsPerPage));
  }
  
  let pdfHTML = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>جدول التسعير</title>
    <style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Tahoma, sans-serif; background:#fff; direction: rtl; }

  /* نلغي هوامش الطابعة الافتراضية ونضبط الحجم على A4 */
  @media print { @page { size: A4; margin: 0; } }

  /* ورقة A4 بمليمترات + حواف/هوامش مثل الوورد عبر padding */
  .sheet {
    width: 210mm;
    height: 297mm;
    padding: 15mm 12mm 15mm 12mm; /* أعلى يمين أسفل يسار (هذه هي الهوامش الفعلية) */
    margin: 0 auto;
    page-break-after: always;
    display: flex;
    align-items: stretch;
  }

  /* الجدول داخل الورقة يملأ المساحة المتاحة بعد الهوامش */
  .pdf-table {
    width: 100%;
    border-collapse: collapse;
    border: 4px solid #000;
    table-layout: fixed;
  }
  .pdf-table td {
    border: 4px solid #000;
    height: 80px;        /* 8 صفوف واضحة */
    width: 50%;          /* عمودان */
    padding: 12px;
    text-align: center;
    vertical-align: middle;
  }

  .pdf-product-name { font-weight: 700; font-size: 26px; color:#000; margin-bottom: 6px; }
  .pdf-product-price { font-weight: 700; font-size: 26px; color:#dc2626; direction:ltr; }

  /* نفس الأبعاد في الطباعة */
  @media print {
    html, body { width: 210mm; height: auto; }
    .sheet { width: 210mm; height: 297mm; padding: 15mm 12mm; }
    .pdf-table, .pdf-table td { border-width: 4px; }
  }
</style>pdf-tablead>
    <body>
  `;
  
  pages.forEach((pageItems) => {
pdfHTML += '<div class="sheet"><table class="pdf-table">';    for (let row = 0; row < 8; row++) {
      pdfHTML += '<tr>';
      for (let col = 0; col < 2; col++) {
        const idx = row * 2 + col;
        const item = pageItems[idx];
        if (item) {
          pdfHTML += `
            <td>
              <div class="pdf-product-name">${escapeHtml(item.name)}</div>
              <div class="pdf-product-price">$${money(item.price)}</div>
            </td>`;
        } else {
          pdfHTML += '<td></td>';
        }
      }
      pdfHTML += '</tr>';
    }
    pdfHTML += '</table></div>';
  });

  pdfHTML += `</body></html>`;
  return pdfHTML;
}
  
// ————————————————————————————————————————————————————————————————
// معاينة PDF داخل الصفحة
// ————————————————————————————————————————————————————————————————
function generatePDF() {
  if (pricingItems.length === 0) { alert('لا توجد منتجات في القائمة'); return; }
  const fullHTML = buildTablesHTML();
  const parser = new DOMParser();
  const doc = parser.parseFromString(fullHTML, 'text/html');
  const tables = doc.querySelectorAll('.pdf-table');
  let tableHTML = '';
  tables.forEach(t => tableHTML += t.outerHTML);
  els.pdfContent.innerHTML = tableHTML;
  els.pdfPreview.style.display = 'block';
  els.printBtn.style.display = 'inline-flex';
  els.pdfPreview.scrollIntoView({ behavior: 'smooth' });
}

// ————————————————————————————————————————————————————————————————
// توليد PDF متعدد الصفحات (مُجزأ صفحة-صفحة)
// ————————————————————————————————————————————————————————————————
// يصوّر كل صفحة (ورقة) مع الهوامش الحقيقية
async function renderIframePagesToPdf(iframeDoc, scaleForMobile = false) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p', 'mm', 'a4');

  // ✱ المهم: نصوّر .sheet وليس .pdf-table
  const sheets = Array.from(iframeDoc.querySelectorAll('.sheet'));
  const scale = scaleForMobile ? 1.2 : 2;

  for (let i = 0; i < sheets.length; i++) {
    const canvas = await html2canvas(sheets[i], {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      allowTaint: true
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    // نرسم الصورة على كامل A4 (الهامش ضمن الـsheet نفسه)
    if (i > 0) pdf.addPage('a4', 'p');
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297); // عرض 210mm × ارتفاع 297mm
  }
  return pdf;
}

// ————————————————————————————————————————————————————————————————
// تحميل PDF (موبايل/ديسكتوب) — كلاهما يعتمد التوليد صفحة-صفحة
// ————————————————————————————————————————————————————————————————
async function downloadPDF() {
  if (pricingItems.length === 0) { alert('لا توجد منتجات في القائمة'); return; }

  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(buildTablesHTML()); doc.close();
    await new Promise(r => { iframe.onload = r; setTimeout(r, 800); });

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const pdf = await renderIframePagesToPdf(doc, /*scaleForMobile*/ isMobile);

    pdf.save('pricing-table.pdf');
    document.body.removeChild(iframe);
  } catch (error) {
    console.error('خطأ في إنشاء PDF:', error);
    alert('حدث خطأ في إنشاء PDF');
  }
}

// ————————————————————————————————————————————————————————————————
// الطباعة
// ————————————————————————————————————————————————————————————————
function printPDF() {
  if (pricingItems.length === 0) { alert('لا توجد منتجات في القائمة'); return; }

  // على الجوال: أنشئ PDF متعدد الصفحات وافتحه في تبويب (أكثر ثباتًا من window.print)
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    printOnMobile();
  } else {
    printOnDesktop();
  }
}

// الجوال: نولّد PDF صفحة-صفحة ثم نفتحه عبر blob: ليتكفل عارض النظام بالطباعة
async function printOnMobile() {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(buildTablesHTML()); doc.close();
    await new Promise(r => { iframe.onload = r; setTimeout(r, 800); });

    const pdf = await renderIframePagesToPdf(doc, /*scaleForMobile*/ true);
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);

    // افتح عارض PDF الافتراضي (منه يمكن "الطباعة" بدون أخطاء WebView)
    window.open(url, '_blank');

    // تنظيف
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(iframe); }, 3000);
  } catch (e) {
    console.error('فشل طباعة الجوال:', e);
    alert('تعذر إرسال المستند للطباعة. يُمكنك استخدام "تحميل PDF" ثم طباعته.');
  }
}

// الديسكتوب: نافذة طباعة تقليدية تعمل جيدًا
function printOnDesktop() {
  const w = window.open('', '_blank');
  if (!w) { alert('فشل في فتح نافذة الطباعة'); return; }
  const html = buildTablesHTML();
  w.document.write(html);
  w.document.close();
  w.onload = () => setTimeout(() => { w.focus(); w.print(); w.close(); }, 400);
}

// ————————————————————————————————————————————————————————————————
// أدوات عامة
// ————————————————————————————————————————————————————————————————
function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

// ————————————————————————————————————————————————————————————————
// Event Listeners and Initialization
// ————————————————————————————————————————————————————————————————
els.barcodeInput.addEventListener('input', handleBarcodeInput);
els.barcodeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleBarcodeInput(); } });
els.addBarcodeBtn.addEventListener('click', handleBarcodeInput);

els.nameInput.addEventListener('input', handleNameSearch);
els.nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSelectedProduct(); } });
els.addNameBtn.addEventListener('click', addSelectedProduct);

els.startCam.addEventListener('click', startCamera);
els.stopCam.addEventListener('click', stopCamera);
els.switchCam.addEventListener('click', () => {
  const currentValue = els.cameraSelect.value;
  els.cameraSelect.value = currentValue === 'auto-back' ? 'auto-front' : 'auto-back';
  if (currentStream) { stopCamera(); startCamera(); }
});
els.cameraSelect.addEventListener('change', () => { if (currentStream) { stopCamera(); startCamera(); } });

els.clearListBtn.addEventListener('click', clearPricingList);
els.generatePdfBtn.addEventListener('click', generatePDF);
els.downloadPdfBtn.addEventListener('click', downloadPDF);
els.printBtn.addEventListener('click', printPDF);

window.addEventListener('load', () => { listCameras(); loadPricingListFromStorage(); });
window.removeFromPricingList = removeFromPricingList;
