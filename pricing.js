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

// تحميل البيانات تلقائياً من products.json
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

// تحميل البيانات عند بدء التطبيق
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
  // فحص السياق والأذونات قبل الطلب لتجنّب NotAllowedError المتكرر
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
    
    // تحديد قيود الكاميرا بناءً على الاختيار
    if (sel === 'auto-back') {
      constraints.video = { facingMode: { ideal: 'environment' } };
    } else if (sel === 'auto-front') {
      constraints.video = { facingMode: { ideal: 'user' } };
    } else if (sel && sel !== 'auto-back' && sel !== 'auto-front') {
      constraints.video = { deviceId: { exact: sel } };
    } else {
      // افتراضي: الكاميرا الخلفية
      constraints.video = { facingMode: { ideal: 'environment' } };
    }

    // إيقاف أي بث سابق
    stopCamera();

    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    els.video.srcObject = currentStream;
    await els.video.play();
    els.startCam.disabled = true; 
    els.stopCam.disabled = false;
    els.switchCam.disabled = false;
    els.scanStatus.textContent = 'جاهز للمسح';

    // بعد منح الإذن تصبح أسماء الكاميرات ظاهرة
    listCameras();

    startScanning();
  } catch (e) {
    console.error(e);
    let msg = 'تعذّر تشغيل الكاميرا.';
    if (e?.name === 'NotAllowedError') {
      msg = 'تم رفض الإذن — افتح إعدادات الموقع واسمح للكاميرا ثم أعد المحاولة.';
    } else if (e?.name === 'NotFoundError') {
      msg = 'لا توجد كاميرا متاحة.';
    } else if (e?.name === 'NotReadableError') {
      msg = 'الكاميرا مستخدمة من تطبيق آخر.';
    } else if (e?.name === 'SecurityError') {
      msg = 'قيود أمنية — استخدم HTTPS أو localhost.';
    }
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

function scanWithQuagga() {
  // تنفيذ Quagga كبديل
  scanInterval = setInterval(() => {
    // محاولة قراءة الباركود باستخدام Quagga
  }, 500);
}

function handleBarcodeDetected(code) {
  const c = String(code || '').replace(/[^0-9]/g, '');
  if (!c) return;
  
  addByBarcode(c);
}

// ————————————————————————————————————————————————————————————————
// البحث اليدوي وإضافة بالباركود عند Enter
// ————————————————————————————————————————————————————————————————
function searchProducts(query) {
  if (!query.trim()) return [];
  
  const queryNorm = normArabic(query);
  const isBarcode = /^[0-9]{6,18}$/.test(query.replace(/[^0-9]/g, ''));
  
  if (isBarcode) {
    const cleanCode = query.replace(/[^0-9]/g, '');
    const iBase = INDEX_BC_BASE.get(cleanCode);
    const iOther = INDEX_BC_OTHER.get(cleanCode);
    
    if (Number.isInteger(iBase)) {
      return [{ product: PRODUCTS[iBase], type: 'base' }];
    } else if (Number.isInteger(iOther)) {
      return [{ product: PRODUCTS[iOther], type: 'other' }];
    }
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
  if (!code) {
    els.barcodeResults.textContent = "";
    return;
  }

  const bcBase = INDEX_BC_BASE.get(code);
  const bcOther = INDEX_BC_OTHER.get(code);
  
  if (bcBase || bcOther) {
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
  if (!query) {
    els.nameResults.textContent = "";
    return;
  }

  const results = searchProducts(query);
  if (results.length === 0) {
    els.nameResults.textContent = "لا توجد نتائج";
    return;
  }

  // عرض النتائج
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
    els.nameInput.value = "";
    els.nameResults.textContent = "";
  }
}



// إضافة عنصر بالباركود (تستخدمها الكاميرا وEnter)
function addByBarcode(code, preferType) {
  const iBase = INDEX_BC_BASE.get(code);
  const iOther = INDEX_BC_OTHER.get(code);

  // تفضيل النوع المختار إن وُجد
  if (preferType === 'base' && Number.isInteger(iBase)) {
    const p = PRODUCTS[iBase];
    if (p.saleBase != null) { addToPricingList(p.name, p.saleBase, 'base'); return true; }
  }
  if (preferType === 'other' && Number.isInteger(iOther)) {
    const p = PRODUCTS[iOther];
    if (p.saleOther != null) { addToPricingList(p.name, p.saleOther, 'other'); return true; }
  }

  // وإلا اختر الموجود
  if (Number.isInteger(iBase)) {
    const p = PRODUCTS[iBase];
    if (p.saleBase != null) { addToPricingList(p.name, p.saleBase, 'base'); return true; }
  }
  if (Number.isInteger(iOther)) {
    const p = PRODUCTS[iOther];
    if (p.saleOther != null) { addToPricingList(p.name, p.saleOther, 'other'); return true; }
  }
  return false;
}

// ————————————————————————————————————————————————————————————————
// إدارة قائمة التسعير
// ————————————————————————————————————————————————————————————————

// حفظ القائمة في localStorage
function savePricingListToStorage() {
  try {
    localStorage.setItem('pricingItems', JSON.stringify(pricingItems));
  } catch (error) {
    console.error('خطأ في حفظ القائمة:', error);
  }
}

// تحميل القائمة من localStorage
function loadPricingListFromStorage() {
  try {
    const saved = localStorage.getItem('pricingItems');
    if (saved) {
      pricingItems = JSON.parse(saved);
      renderPricingList();
      console.log(`تم تحميل ${pricingItems.length} منتج من التخزين المحلي`);
    }
  } catch (error) {
    console.error('خطأ في تحميل القائمة:', error);
    pricingItems = [];
  }
}

function addToPricingList(name, price, type) {
  if (price == null || isNaN(price)) return;
  
  const item = {
    id: Date.now() + Math.random(),
    name,
    price: Number(price),
    type
  };
  
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

function buildTablesHTML() {
  // إنشاء جداول بـ 8 صفوف و 2 أعمدة
  const itemsPerPage = 16; // 8 صفوف × 2 أعمدة
  const pages = [];
  
  for (let i = 0; i < pricingItems.length; i += itemsPerPage) {
    const pageItems = pricingItems.slice(i, i + itemsPerPage);
    pages.push(pageItems);
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
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          background: white; 
          direction: rtl;
        }
        .pdf-table {
          width: 100%;
          border-collapse: collapse;
          border: 4px solid #000;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin-bottom: 20px;
        }
        .pdf-table td {
          border: 4px solid #000;
          padding: 15px;
          text-align: center;
          vertical-align: middle;
          height: 80px;
          width: 50%;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .pdf-product-name {
          font-weight: bold;
          margin-bottom: 8px;
          font-size: 26px;
          color: #000000;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          direction: rtl;
          text-align: center;
        }
        .pdf-product-price {
          color: #dc2626;
          font-weight: bold;
          font-size: 26px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          direction: ltr;
          text-align: center;
        }
        @media print {
          @page { size: A4; margin: 15mm; }
          * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
          body { 
            background: white !important; 
            color: black !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
            direction: rtl !important;
          }
          .pdf-table { 
            page-break-inside: avoid !important;
            width: calc(100% - 20px) !important;
            border: 4px solid #000 !important;
            border-collapse: collapse !important;
            margin: 10px !important;
            margin-bottom: 20px !important;
          }
          .pdf-table td {
            border: 4px solid #000 !important;
            padding: 15px !important;
            text-align: center !important;
            vertical-align: middle !important;
            height: 80px !important;
            width: 50% !important;
          }
          .pdf-product-name {
            font-weight: bold !important;
            margin-bottom: 8px !important;
            font-size: 26px !important;
            color: #000000 !important;
            direction: rtl !important;
            text-align: center !important;
          }
          .pdf-product-price {
            color: #dc2626 !important;
            font-weight: bold !important;
            font-size: 26px !important;
            direction: ltr !important;
            text-align: center !important;
          }
        }
      </style>
    </head>
    <body>
  `;
  
  pages.forEach((pageItems, pageIndex) => {
    if (pageIndex > 0) {
      pdfHTML += '<div style="page-break-before: always;"></div>';
    }
    
    pdfHTML += '<table class="pdf-table">';
    
    // إنشاء 8 صفوف
    for (let row = 0; row < 8; row++) {
      pdfHTML += '<tr>';
      
      // عمودين في كل صف
      for (let col = 0; col < 2; col++) {
        const itemIndex = row * 2 + col;
        const item = pageItems[itemIndex];
        
        if (item) {
          pdfHTML += `
            <td>
              <div class="pdf-product-name">${escapeHtml(item.name)}</div>
              <div class="pdf-product-price">$${money(item.price)}</div>
            </td>
          `;
        } else {
          pdfHTML += '<td></td>';
        }
      }
      
      pdfHTML += '</tr>';
    }
    
    pdfHTML += '</table>';
  });

  pdfHTML += `
    </body>
    </html>
  `;

  return pdfHTML;
}

function generatePDF() {
  if (pricingItems.length === 0) {
    alert('لا توجد منتجات في القائمة');
    return;
  }
  
  // Extract only the table content from the full HTML
  const fullHTML = buildTablesHTML();
  const parser = new DOMParser();
  const doc = parser.parseFromString(fullHTML, 'text/html');
  const tables = doc.querySelectorAll('.pdf-table');
  
  let tableHTML = '';
  tables.forEach(table => {
    tableHTML += table.outerHTML;
  });
  
  els.pdfContent.innerHTML = tableHTML;
  els.pdfPreview.style.display = 'block';
  els.printBtn.style.display = 'inline-flex';
  // التمرير إلى المعاينة
  els.pdfPreview.scrollIntoView({ behavior: 'smooth' });
}

async function downloadPDF() {
  if (pricingItems.length === 0) {
    alert('لا توجد منتجات في القائمة');
    return;
  }
  
  // Check if mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    await downloadPDFMobile();
  } else {
    await downloadPDFDesktop();
  }
}

async function downloadPDFMobile() {
  try {
    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.innerHTML = 'جاري إنشاء PDF...';
    loadingDiv.style.position = 'fixed';
    loadingDiv.style.top = '50%';
    loadingDiv.style.left = '50%';
    loadingDiv.style.transform = 'translate(-50%, -50%)';
    loadingDiv.style.padding = '20px';
    loadingDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
    loadingDiv.style.color = 'white';
    loadingDiv.style.borderRadius = '10px';
    loadingDiv.style.zIndex = '10000';
    loadingDiv.style.fontSize = '18px';
    document.body.appendChild(loadingDiv);
    
    // Create PDF with mobile-optimized settings
    const canvas = await html2canvas(document.body, {
      scale: 1, // Lower scale for mobile performance
      useCORS: true,
      backgroundColor: '#ffffff',
      allowTaint: true,
      width: window.innerWidth,
      height: window.innerHeight
    });
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const imgData = canvas.toDataURL('image/jpeg', 0.8); // Use JPEG for smaller file size
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    
    // For mobile, try to use Web Share API if available
    if (navigator.share && navigator.canShare) {
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], 'pricing-table.pdf', { type: 'application/pdf' });
      
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'جدول التسعير',
          text: 'جدول التسعير PDF',
          files: [file]
        });
      } else {
        // Fallback to download
        pdf.save('pricing-table.pdf');
      }
    } else {
      // Fallback to download
      pdf.save('pricing-table.pdf');
    }
    
    document.body.removeChild(loadingDiv);
  } catch (error) {
    console.error('خطأ في إنشاء PDF:', error);
    alert('حدث خطأ في إنشاء PDF');
  }
}

async function downloadPDFDesktop() {
  try {
    // Create a temporary iframe for better Arabic rendering
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = 'none';
    
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    const printContent = buildTablesHTML();
    
    iframeDoc.open();
    iframeDoc.write(printContent);
    iframeDoc.close();
    
    // Wait for fonts and content to load
    await new Promise(resolve => {
      iframe.onload = resolve;
      setTimeout(resolve, 1000); // fallback timeout
    });
    
    const canvas = await html2canvas(iframeDoc.body, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      allowTaint: true,
      foreignObjectRendering: true
    });
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    pdf.save('pricing-table.pdf');
    document.body.removeChild(iframe);
  } catch (error) {
    console.error('خطأ في إنشاء PDF:', error);
    alert('حدث خطأ في إنشاء PDF');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function printPDF() {
  if (pricingItems.length === 0) {
    alert('لا توجد منتجات في القائمة');
    return;
  }
  
  // Check if mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Mobile-friendly print approach
    printOnMobile();
  } else {
    // Desktop print approach
    printOnDesktop();
  }
}

function printOnMobile() {
  // Create a temporary div with the content
  const printDiv = document.createElement('div');
  printDiv.innerHTML = buildTablesHTML();
  printDiv.style.position = 'fixed';
  printDiv.style.top = '0';
  printDiv.style.left = '0';
  printDiv.style.width = '100%';
  printDiv.style.height = '100%';
  printDiv.style.backgroundColor = 'white';
  printDiv.style.zIndex = '9999';
  printDiv.style.overflow = 'auto';
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕ إغلاق';
  closeBtn.style.position = 'fixed';
  closeBtn.style.top = '10px';
  closeBtn.style.right = '10px';
  closeBtn.style.padding = '10px 15px';
  closeBtn.style.backgroundColor = '#dc2626';
  closeBtn.style.color = 'white';
  closeBtn.style.border = 'none';
  closeBtn.style.borderRadius = '5px';
  closeBtn.style.fontSize = '16px';
  closeBtn.style.zIndex = '10000';
  closeBtn.style.cursor = 'pointer';
  
  closeBtn.onclick = () => {
    document.body.removeChild(printDiv);
  };
  
  printDiv.appendChild(closeBtn);
  document.body.appendChild(printDiv);
  
  // Trigger print after a short delay
  setTimeout(() => {
    window.print();
  }, 500);
}

function printOnDesktop() {
  // Create a new window for printing with proper Arabic rendering
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('فشل في فتح نافذة الطباعة');
    return;
  }
  
  const printContent = buildTablesHTML();
  
  printWindow.document.write(printContent);
  printWindow.document.close();
  
  // Wait for content to load then print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };
}

// ————————————————————————————————————————————————————————————————
// Event Listeners and Initialization
// ————————————————————————————————————————————————————————————————

// Barcode input event listeners
els.barcodeInput.addEventListener('input', handleBarcodeInput);
els.barcodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); handleBarcodeInput(); }
});
els.addBarcodeBtn.addEventListener('click', handleBarcodeInput);

// Name search event listeners
els.nameInput.addEventListener('input', handleNameSearch);
els.nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addSelectedProduct(); }
});
els.addNameBtn.addEventListener('click', addSelectedProduct);

// Camera controls
els.startCam.addEventListener('click', startCamera);
els.stopCam.addEventListener('click', stopCamera);
els.switchCam.addEventListener('click', () => {
  const currentValue = els.cameraSelect.value;
  els.cameraSelect.value = currentValue === 'auto-back' ? 'auto-front' : 'auto-back';
  if (currentStream) {
    stopCamera();
    startCamera();
  }
});
els.cameraSelect.addEventListener('change', () => {
  if (currentStream) {
    stopCamera();
    startCamera();
  }
});

// PDF controls
els.clearListBtn.addEventListener('click', clearPricingList);
els.generatePdfBtn.addEventListener('click', generatePDF);
els.downloadPdfBtn.addEventListener('click', downloadPDF);
els.printBtn.addEventListener('click', printPDF);

// تهيئة الكاميرات وتحميل القائمة عند التحميل
window.addEventListener('load', () => {
  listCameras();
  loadPricingListFromStorage();
});

// جعل الدوال متاحة عالمياً
window.removeFromPricingList = removeFromPricingList;