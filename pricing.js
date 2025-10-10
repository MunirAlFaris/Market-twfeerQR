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
// إعداد Appwrite
// ————————————————————————————————————————————————————————————————
const { Client, Databases, ID, Query } = Appwrite;

// إعداد عميل Appwrite باستخدام ملف الإعداد
const config = window.APPWRITE_CONFIG || {
  ENDPOINT: 'https://fra.cloud.appwrite.io/v1',
  PROJECT_ID: '68a6505a000ae3ad9653',
  DATABASE_ID: '68a6506b001e531fdcce',
  COLLECTION_ID: '68a650740005dbb4117a'
};

const client = new Client()
    .setEndpoint(config.ENDPOINT)
    .setProject(config.PROJECT_ID);

const databases = new Databases(client);

// معرفات قاعدة البيانات والمجموعة
const DATABASE_ID = config.DATABASE_ID;
const COLLECTION_ID = config.COLLECTION_ID;
const PRICING_COLLECTION_ID = config.COLLECTION_ID; // استخدام نفس المجموعة للتسعير والملصقات

// ————————————————————————————————————————————————————————————————
// حالة التطبيق
// ————————————————————————————————————————————————————————————————
let PRODUCTS = [];
let INDEX_BC_BASE = new Map();
let INDEX_BC_MORE = new Map();
let INDEX_BC_LESS = new Map();
let pricingItems = [];
let stickerItems = [];
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
  templateSelect: document.getElementById('templateSelect'),
  manualProductSection: document.getElementById('manualProductSection'),
  manualProductName: document.getElementById('manualProductName'),
  manualProductBarcode: document.getElementById('manualProductBarcode'),
  manualProductPrice: document.getElementById('manualProductPrice'),
  manualProductQuantity: document.getElementById('manualProductQuantity'),
  addManualProductBtn: document.getElementById('addManualProductBtn'),
  generatePdfBtn: document.getElementById('generatePdfBtn'),
  downloadPdfBtn: document.getElementById('downloadPdfBtn'),
  printBtn: document.getElementById('printBtn'),
  itemCount: document.getElementById('itemCount'),
  pdfPreview: document.getElementById('pdfPreview'),
  pdfContent: document.getElementById('pdfContent'),
  stickerList: document.getElementById('stickerList'),
  stickerItems: document.getElementById('stickerItems'),
  clearStickersBtn: document.getElementById('clearStickersBtn'),
  generateStickersBtn: document.getElementById('generateStickersBtn'),
  downloadStickersBtn: document.getElementById('downloadStickersBtn'),
  printStickersBtn: document.getElementById('printStickersBtn'),
  stickerCount: document.getElementById('stickerCount'),
  stickerSizeSelect: document.getElementById('stickerSizeSelect')
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
    const cat = (p.CATEGORY_AR ?? p.category ?? "").toString();
    const saleBase = (p.BASE_SALE_PRICE ?? p.SALE_PRICE_BASE ?? p.PRICE_BASE_UNIT ?? null);
    const saleMore = (p.MORE_SALE_PRICE ?? p.SALE_PRICE_MORE ?? null);
    const saleLess = (p.LESS_SALE_PRICE ?? p.SALE_PRICE_LESS ?? null);
    const baseBCs = parseBarcodes(p.BASE_BARCODES ?? p.BASE_UNIT_BARCODES ?? p.BARCODES_BASE);
    const moreBCs = parseBarcodes(p.MORE_BARCODES ?? p.MORE_UNIT_BARCODES ?? null);
    const lessBCs = parseBarcodes(p.LESS_BARCODES ?? p.LESS_UNIT_BARCODES ?? null);
    const baseQty = (p.BASE_QTY ?? p.QTY_BASE ?? null);
    const moreQty = (p.MORE_QTY ?? p.QTY_MORE ?? null);
    const lessQty = (p.LESS_QTY ?? p.QTY_LESS ?? null);
    const moreRelation = (p.MORE_RELATION ?? p.RELATION_MORE ?? null);
    const lessRelation = (p.LESS_RELATION ?? p.RELATION_LESS ?? null);
    
    return {
      _i: i,
      name,
      cat,
      nameNorm: normArabic(name),
      saleBase: saleBase != null ? Number(saleBase) : null,
      saleMore: saleMore != null ? Number(saleMore) : null,
      saleLess: saleLess != null ? Number(saleLess) : null,
      baseBCs,
      moreBCs,
      lessBCs,
      baseQty: baseQty != null ? Number(baseQty) : null,
      moreQty: moreQty != null ? Number(moreQty) : null,
      lessQty: lessQty != null ? Number(lessQty) : null,
      moreRelation: moreRelation != null ? Number(moreRelation) : null,
      lessRelation: lessRelation != null ? Number(lessRelation) : null
    };
  });

  INDEX_BC_BASE = new Map();
  INDEX_BC_MORE = new Map();
  INDEX_BC_LESS = new Map();
  PRODUCTS.forEach((p, i) => {
    p.baseBCs.forEach(bc => INDEX_BC_BASE.set(bc, i));
    p.moreBCs.forEach(bc => INDEX_BC_MORE.set(bc, i));
    p.lessBCs.forEach(bc => INDEX_BC_LESS.set(bc, i));
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
  const detector = new BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128'] });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  scanInterval = setInterval(async () => {
    try {
      if (!currentStream) return;
      const v = els.video;
      if (!v.videoWidth) return;
      canvas.width = v.videoWidth; 
      canvas.height = v.videoHeight;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      
      const barcodes = await detector.detect(canvas);
      if (barcodes.length > 0) {
        const code = (barcodes[0].rawValue || '').replace(/[^0-9]/g, '');
        if (code) {
          handleBarcodeDetected(code);
        }
      }
    } catch (err) {
      console.error('خطأ في قراءة الباركود:', err);
    }
  }, 220);
}

function scanWithQuagga() { scanInterval = setInterval(() => {}, 500); }

function playBeepSound() {
  try {
    // إنشاء صوت تنبيه باستخدام Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // إعداد الصوت
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // تردد 800 هرتز
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime); // مستوى الصوت
    
    // تشغيل الصوت لمدة 200 مللي ثانية
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (error) {
    console.log('تعذر تشغيل صوت التنبيه:', error);
  }
}

function handleBarcodeDetected(code) {
  const c = String(code || '').replace(/[^0-9]/g, '');
  if (!c) return;
  
  // إيقاف القراءة المتكررة
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  
  // تشغيل صوت التنبيه
  playBeepSound();
  
  // تحديث حالة المسح
  els.scanStatus.innerHTML = `<span style="color: #16a34a;">✅ تم قراءة الباركود: ${c}</span>`;
  
  // إضافة المنتج
  addByBarcode(c);
  
  // إعادة تشغيل المسح بعد ثانيتين
  setTimeout(() => {
    if (currentStream && !scanInterval) {
      startScanning();
      els.scanStatus.textContent = 'جاهز للمسح';
    }
  }, 2000);
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
    const iMore = INDEX_BC_MORE.get(cleanCode);
    const iLess = INDEX_BC_LESS.get(cleanCode);
    if (Number.isInteger(iBase)) return [{ product: PRODUCTS[iBase], type: 'base' }];
    if (Number.isInteger(iMore)) return [{ product: PRODUCTS[iMore], type: 'more' }];
    if (Number.isInteger(iLess)) return [{ product: PRODUCTS[iLess], type: 'less' }];
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
  const bcMore = INDEX_BC_MORE.get(code);
  const bcLess = INDEX_BC_LESS.get(code);
  if (Number.isInteger(bcBase) || Number.isInteger(bcMore) || Number.isInteger(bcLess)) {
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
    let price;
    switch (preferType) {
      case 'base': price = r.product.saleBase; break;
      case 'more': price = r.product.saleMore; break;
      case 'less': price = r.product.saleLess; break;
      default: price = r.product.saleBase;
    }
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
    let price;
     switch (preferType) {
       case 'base': price = product.saleBase; break;
       case 'more': price = product.saleMore; break;
       case 'less': price = product.saleLess; break;
       default: price = product.saleBase;
     }
    addToPricingList(product.name, price || 0, preferType);
    els.nameInput.value = ""; els.nameResults.textContent = "";
  }
}

// إضافة عنصر بالباركود
function addByBarcode(code, preferType) {
  const iBase = INDEX_BC_BASE.get(code);
  const iMore = INDEX_BC_MORE.get(code);
  const iLess = INDEX_BC_LESS.get(code);
  
  // إعطاء الأولوية للنوع المفضل
  if (preferType === 'base' && Number.isInteger(iBase)) {
    const p = PRODUCTS[iBase]; if (p.saleBase != null) { addToPricingList(p.name, p.saleBase, 'base'); return true; }
  }
  if (preferType === 'more' && Number.isInteger(iMore)) {
    const p = PRODUCTS[iMore]; if (p.saleMore != null) { addToPricingList(p.name, p.saleMore, 'more'); return true; }
  }
  if (preferType === 'less' && Number.isInteger(iLess)) {
    const p = PRODUCTS[iLess]; if (p.saleLess != null) { addToPricingList(p.name, p.saleLess, 'less'); return true; }
  }
  
  // إذا لم يتم العثور على النوع المفضل، جرب الأنواع المتبقية
  if (Number.isInteger(iBase)) {
    const p = PRODUCTS[iBase]; if (p.saleBase != null) { addToPricingList(p.name, p.saleBase, 'base'); return true; }
  }
  if (Number.isInteger(iMore)) {
    const p = PRODUCTS[iMore]; if (p.saleMore != null) { addToPricingList(p.name, p.saleMore, 'more'); return true; }
  }
  if (Number.isInteger(iLess)) {
    const p = PRODUCTS[iLess]; if (p.saleLess != null) { addToPricingList(p.name, p.saleLess, 'less'); return true; }
  }
  return false;
}

// ————————————————————————————————————————————————————————————————
// وظائف قاعدة البيانات Appwrite
// ————————————————————————————————————————————————————————————————
async function initializeAppwrite() {
  try {
    // تحقق من وجود قاعدة البيانات والمجموعة
    console.log('تهيئة Appwrite...');
    await loadPricingItemsFromDatabase();
  } catch (error) {
    console.error('خطأ في تهيئة Appwrite:', error);
    // في حالة الخطأ، استخدم التخزين المحلي كبديل
    loadPricingListFromStorage();
  }
}

async function savePricingItemToDatabase(item) {
  try {
    const document = await databases.createDocument(
      DATABASE_ID,
      COLLECTION_ID,
      ID.unique(),
      {
        name: item.name,
        price: item.price,
        type: item.type,
        created_at: new Date().toISOString()
      }
    );
    return document;
  } catch (error) {
    console.error('خطأ في حفظ المنتج:', error);
    throw error;
  }
}

async function updatePricingItemInDatabase(documentId, updates) {
  try {
    const document = await databases.updateDocument(
      DATABASE_ID,
      COLLECTION_ID,
      documentId,
      updates
    );
    return document;
  } catch (error) {
    console.error('خطأ في تحديث المنتج:', error);
    throw error;
  }
}

async function deletePricingItemFromDatabase(documentId) {
  try {
    await databases.deleteDocument(
      DATABASE_ID,
      COLLECTION_ID,
      documentId
    );
  } catch (error) {
    console.error('خطأ في حذف المنتج:', error);
    throw error;
  }
}

async function loadPricingItemsFromDatabase() {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      PRICING_COLLECTION_ID,
      [Query.limit(10000)]
    );
    
    pricingItems = response.documents.map(doc => ({
      id: doc.$id,
      name: doc.name,
      price: doc.price,
      type: doc.type,
      barcode: doc.barcode,
      documentId: doc.$id
    }));
    
    renderPricingList();
    console.log(`تم تحميل ${pricingItems.length} منتج من قاعدة البيانات`);
  } catch (error) {
    console.error('خطأ في تحميل المنتجات:', error);
    throw error;
  }
}

// ————————————————————————————————————————————————————————————————
// إدارة قائمة التسعير (محدثة لاستخدام Appwrite)
// ————————————————————————————————————————————————————————————————
// وظائف التخزين المحلي (كبديل احتياطي)
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

// وظائف إدارة قائمة التسعير المحدثة
async function addToPricingList(name, price, type, barcode = null) {
  if (price == null || isNaN(price)) return;
  
  const item = { name, price: Number(price), type, barcode };
  
  try {
    // حفظ في قاعدة البيانات
    const document = await savePricingItemToDatabase(item);
    
    // إضافة إلى القائمة المحلية
    const newItem = {
      id: document.$id,
      name: document.name,
      price: document.price,
      type: document.type,
      barcode: document.barcode,
      documentId: document.$id
    };
    
    pricingItems.push(newItem);
    renderPricingList();
    
    // حفظ احتياطي في التخزين المحلي
    savePricingListToStorage();
  } catch (error) {
    console.error('خطأ في إضافة المنتج:', error);
    // في حالة الخطأ، استخدم التخزين المحلي
    const fallbackItem = { id: Date.now() + Math.random(), name, price: Number(price), type, barcode };
    pricingItems.push(fallbackItem);
    savePricingListToStorage();
    renderPricingList();
  }
}

async function removeFromPricingList(id) {
  const item = pricingItems.find(item => item.id === id);
  if (!item) return;
  
  // تأكيد الحذف
  const confirmDelete = confirm(`هل أنت متأكد من حذف "${item.name}" من القائمة؟`);
  if (!confirmDelete) return;
  
  try {
    // حذف من قاعدة البيانات
    if (item.documentId) {
      await deletePricingItemFromDatabase(item.documentId);
    }
    
    // حذف من القائمة المحلية
    pricingItems = pricingItems.filter(item => item.id !== id);
    renderPricingList();
    
    // تحديث التخزين المحلي
    savePricingListToStorage();
  } catch (error) {
    console.error('خطأ في حذف المنتج:', error);
    // في حالة الخطأ، احذف من القائمة المحلية فقط
    pricingItems = pricingItems.filter(item => item.id !== id);
    savePricingListToStorage();
    renderPricingList();
  }
}

function renderPricingList() {
  if (pricingItems.length === 0) {
    els.pricingList.innerHTML = '<div class="hint" style="padding: 20px; text-align: center;">لا توجد منتجات في القائمة</div>';
  } else {
    // ترتيب العناصر بحسب الأحدث أولاً
    const sortedItems = [...pricingItems].sort((a, b) => {
      // استخدام الـ id للترتيب (الأحدث له id أكبر)
      const aId = typeof a.id === 'string' ? parseInt(a.id) || 0 : a.id || 0;
      const bId = typeof b.id === 'string' ? parseInt(b.id) || 0 : b.id || 0;
      return bId - aId;
    });
    
    els.pricingList.innerHTML = sortedItems.map(item => `
      <div class="pricing-item">
        <div>
          <div class="product-name" id="name-${item.id}" onclick="editItemName('${item.id}')" style="cursor: pointer; border-bottom: 1px dashed #ccc;">${item.name}</div>
          <div class="hint">${item.type === 'base' ? 'سعر أساسي' : 'سعر آخر'}</div>
          ${item.barcode ? `<div class="barcode-display" style="font-size: 12px; color: #666; margin-top: 4px;">
            <span>الباركود: ${item.barcode}</span>
          </div>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="product-price" id="price-${item.id}" onclick="editItemPrice('${item.id}')" style="cursor: pointer; border-bottom: 1px dashed #ccc;">$${money(item.price)}</div>
          <button class="edit-btn" onclick="showEditOptions('${item.id}')" style="background: #4CAF50; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 12px;">تعديل</button>
          <button class="remove-btn" onclick="removeFromPricingList('${item.id}')">حذف</button>
        </div>
      </div>
    `).join('');
  }
  els.itemCount.textContent = `${pricingItems.length} منتج`;
}

async function clearPricingList() {
  // التحقق من وجود عناصر في القائمة
  if (pricingItems.length === 0) {
    alert('القائمة فارغة بالفعل!');
    return;
  }
  
  // تأكيد مسح القائمة
  const confirmClear = confirm(`هل أنت متأكد من مسح جميع المنتجات (${pricingItems.length} منتج) من القائمة؟\n\nهذا الإجراء لا يمكن التراجع عنه.`);
  if (!confirmClear) return;
  
  try {
    // حذف جميع العناصر من قاعدة البيانات
    for (const item of pricingItems) {
      if (item.documentId) {
        await deletePricingItemFromDatabase(item.documentId);
      }
    }
  } catch (error) {
    console.error('خطأ في حذف العناصر من قاعدة البيانات:', error);
  }
  
  pricingItems = [];
  savePricingListToStorage();
  renderPricingList();
  els.pdfPreview.style.display = 'none';
  els.pdfContent.innerHTML = '';
  els.printBtn.style.display = 'none';
}

// وظائف التعديل
function showEditOptions(itemId) {
  const item = pricingItems.find(item => item.id === itemId);
  if (!item) return;
  
  const options = confirm('اختر نوع التعديل:\nموافق = تعديل الاسم\nإلغاء = تعديل السعر');
  
  if (options) {
    editItemName(itemId);
  } else {
    editItemPrice(itemId);
  }
}

function editItemName(itemId) {
  const item = pricingItems.find(item => item.id === itemId);
  if (!item) return;
  
  const newName = prompt('أدخل الاسم الجديد:', item.name);
  if (newName && newName.trim() && newName.trim() !== item.name) {
    updatePricingItem(itemId, { name: newName.trim() });
  }
}

function editItemPrice(itemId) {
  const item = pricingItems.find(item => item.id === itemId);
  if (!item) return;
  
  const newPrice = prompt('أدخل السعر الجديد:', item.price);
  if (newPrice && !isNaN(newPrice) && Number(newPrice) !== item.price) {
    updatePricingItem(itemId, { price: Number(newPrice) });
  }
}

async function updatePricingItem(itemId, updates) {
  const item = pricingItems.find(item => item.id === itemId);
  if (!item) return;
  
  try {
    // تحديث في قاعدة البيانات
    if (item.documentId) {
      await updatePricingItemInDatabase(item.documentId, updates);
    }
    
    // تحديث في القائمة المحلية
    Object.assign(item, updates);
    renderPricingList();
    
    // تحديث التخزين المحلي
    savePricingListToStorage();
    
    console.log('تم تحديث المنتج بنجاح');
  } catch (error) {
    console.error('خطأ في تحديث المنتج:', error);
    // في حالة الخطأ، قم بالتحديث محلياً فقط
    Object.assign(item, updates);
    renderPricingList();
    savePricingListToStorage();
    alert('تم التحديث محلياً فقط بسبب خطأ في الاتصال');
  }
}

// ————————————————————————————————————————————————————————————————
// إضافة منتج يدوي للملصقات
// ————————————————————————————————————————————————————————————————
function addManualProduct() {
  const name = els.manualProductName.value.trim();
  const barcode = els.manualProductPrice.value.trim(); // استخدام حقل السعر كباركود
  const quantity = parseInt(els.manualProductQuantity.value) || 1;
  
  if (!name) {
    alert('يرجى إدخال اسم المنتج');
    return;
  }
  
  if (!barcode) {
    alert('يرجى إدخال الباركود');
    return;
  }
  
  // إضافة المنتج إلى قائمة التسعير مع الباركود (سعر افتراضي 0)
  addToPricingList(name, 0, 'manual', barcode);
  
  // إضافة المنتج بالكمية المطلوبة إلى قائمة الملصقات
  for (let i = 0; i < quantity; i++) {
    addToStickerList(name, barcode);
  }
  
  // مسح الحقول
  els.manualProductName.value = '';
  els.manualProductPrice.value = '';
  els.manualProductQuantity.value = '1';
  
  console.log(`تم إضافة ${quantity} ملصق للمنتج: ${name} مع الباركود: ${barcode}`);
}

// ————————————————————————————————————————————————————————————————
// نظام الملصقات
// ————————————————————————————————————————————————————————————————
function addToStickerList(name, barcode) {
  const sticker = {
    id: Date.now() + Math.random(),
    name: name,
    barcode: barcode,
    timestamp: new Date().toISOString()
  };
  
  stickerItems.push(sticker);
  renderStickerList();
  saveStickerListToStorage();
  
  // إظهار قائمة الملصقات
  els.stickerList.style.display = 'block';
}

function renderStickerList() {
  if (stickerItems.length === 0) {
    els.stickerItems.innerHTML = '<div class="hint" style="padding: 20px; text-align: center;">لا توجد ملصقات في القائمة</div>';
    els.stickerCount.textContent = '0 ملصق';
    return;
  }
  
  const html = stickerItems.map(sticker => `
    <div class="sticker-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border: 1px solid var(--border); border-radius: 4px; margin-bottom: 4px; background: var(--card);">
      <div>
        <strong>${sticker.name}</strong><br>
        <small style="color: #666;">الباركود: ${sticker.barcode}</small>
      </div>
      <button onclick="removeFromStickerList('${sticker.id}')" class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
  
  els.stickerItems.innerHTML = html;
  els.stickerCount.textContent = `${stickerItems.length} ملصق`;
}

function removeFromStickerList(id) {
  stickerItems = stickerItems.filter(sticker => sticker.id != id);
  renderStickerList();
  saveStickerListToStorage();
  
  if (stickerItems.length === 0) {
    els.stickerList.style.display = 'none';
  }
}

function clearStickerList() {
  if (stickerItems.length === 0) return;
  
  if (confirm('هل أنت متأكد من مسح جميع الملصقات؟')) {
    stickerItems = [];
    renderStickerList();
    saveStickerListToStorage();
    els.stickerList.style.display = 'none';
  }
}

function saveStickerListToStorage() {
  localStorage.setItem('stickerItems', JSON.stringify(stickerItems));
}

function loadStickerListFromStorage() {
  const saved = localStorage.getItem('stickerItems');
  if (saved) {
    stickerItems = JSON.parse(saved);
    if (stickerItems.length > 0) {
      renderStickerList();
      els.stickerList.style.display = 'block';
    }
  }
}

// ————————————————————————————————————————————————————————————————
// بناء HTML الصفحات
// ————————————————————————————————————————————————————————————————
function buildTablesHTML(template = 'standard') {
  // للملصقات: إنشاء صفحة منفصلة لكل منتج
  if (template === 'sticker-3x4' || template === 'sticker-3x2') {
    return buildStickerPagesHTML(template);
  }
  
  // للقوالب العادية: استخدام الجدول
  let itemsPerPage, cols, rowsPerPage, cellHeight, cellWidth;
  
  cols = 2;
  rowsPerPage = template === 'barcode' ? 6 : 8;
  itemsPerPage = cols * rowsPerPage;
  cellHeight = template === 'barcode' ? '120px' : '80px';
  cellWidth = '50%';
  
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
    height: ${cellHeight};
    width: ${cellWidth};
    padding: 12px;
    text-align: center;
    vertical-align: middle;
  }

  .pdf-product-name { font-weight: 700; font-size: 26px; color:#000; margin-bottom: 6px; }
  .pdf-product-price { font-weight: 700; font-size: 26px; color:#dc2626; direction:ltr; }
  .pdf-price-barcode-row { display: flex; align-items: center; justify-content: space-arround; }
  .pdf-price-barcode-row .pdf-product-price { margin: 0; flex: 1; }
  .pdf-barcode { flex: 1; text-align: center; }
  .pdf-barcode svg { max-width: 100%; height: 35px; }

  /* نفس الأبعاد في الطباعة */
  @media print {
    html, body { width: 210mm; height: auto; }
    .sheet { width: 210mm; height: 297mm; padding: 15mm 12mm; }
    .pdf-table, .pdf-table td { border-width: 4px; }
  }
</style>
    </head>
    <body>
  `;
  
  pages.forEach((pageItems) => {
    pdfHTML += '<div class="sheet"><table class="pdf-table">';
    
    for (let row = 0; row < rowsPerPage; row++) {
      pdfHTML += '<tr>';
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        const item = pageItems[idx];
        if (item) {
          pdfHTML += buildCellHTML(item, template);
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

// دالة جديدة لإنشاء صفحات الملصقات
function buildStickerPagesHTML(template) {
  // تحديد أبعاد الملصق حسب القالب (بالإنش ثم تحويل للمليمتر)
  // 4x3 inches = 101.6mm x 76.2mm
  // 3x2 inches = 76.2mm x 50.8mm
  const stickerWidth = template === 'sticker-4x3' ? '101.6mm' : '76.2mm';
  const stickerHeight = template === 'sticker-4x3' ? '76.2mm' : '50.8mm';
  
  let pdfHTML = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ملصقات الباركود</title>
    <style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Tahoma, sans-serif; background:#fff; direction: rtl; margin: 0; padding: 0; }

  @media print { @page { size: ${stickerWidth} ${stickerHeight}; margin: 0; } }

  .sticker-page {
    width: ${stickerWidth};
    height: ${stickerHeight};
    margin: 3mm;
    page-break-after: always;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    padding: 4.8mm; /* 3/16 inch safety margin = 4.76mm */
    border: 2px solid #000;
    background: white;
    box-sizing: border-box;
  }

  .sticker-page:last-child {
    page-break-after: avoid;
  }

  .sticker-product-name {
    font-weight: bold;
    font-size: ${template === 'sticker-4x3' ? '16px' : '12px'};
    color: #000;
    text-align: center;
    word-wrap: break-word;
    line-height: 1.1;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
  }

  .sticker-barcode {
    text-align: center;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    max-height: ${template === 'sticker-4x3' ? '25mm' : '18mm'};
  }

  .sticker-barcode svg {
    max-width: 100%;
    height: auto;
    max-height: ${template === 'sticker-4x3' ? '25mm' : '18mm'};
  }

  @media print {
    body {
      margin: 0;
      padding: 0;
    }
    
    .sticker-page {
      width: ${stickerWidth};
      height: ${stickerHeight};
      margin: 0;
      border: 1px solid #000;
      page-break-inside: avoid;
    }
  }
</style>
    </head>
    <body>
  `;
  
  // إنشاء صفحة منفصلة لكل منتج
  stickerItems.forEach((sticker, index) => {
    const barcodeSVG = generateBarcodeSVG(sticker.barcode);
    
    pdfHTML += `
      <div class="sticker-page">
        <div class="sticker-product-name">${sticker.name}</div>
        <div class="sticker-barcode">${barcodeSVG}</div>
      </div>
    `;
  });

  pdfHTML += `</body></html>`;
  return pdfHTML;
}

// ————————————————————————————————————————————————————————————————
// بناء محتوى الخلية حسب القالب
// ————————————————————————————————————————————————————————————————
function buildCellHTML(item, template) {
  const productName = escapeHtml(item.name);
  const productPrice = `$${money(item.price)}`;
  
  switch (template) {
    case 'simple':
      return `
        <td>
          <div class="pdf-product-name">${productName}</div>
          <div class="pdf-product-price">${productPrice}</div>
        </td>`;
    
    case 'barcode':
      const barcode = generateBarcodeSVG(item.id || item.name);
      return `
        <td>
          <div class="pdf-product-name">${productName}</div>
          <div class="pdf-price-barcode-row"
            style="display: flex; align-items: center; justify-content: space-around;"
          >
            <div class="pdf-barcode">${barcode}</div>
            <div class="pdf-product-price">${productPrice}</div>
          </div>
        </td>`;
    

    
    case 'standard':
    default:
      return `
        <td>
          <div class="pdf-product-name">${productName}</div>
          <div class="pdf-product-price">${productPrice}</div>
        </td>`;
  }
}

// ————————————————————————————————————————————————————————————————
// توليد باركود SVG
// ————————————————————————————————————————————————————————————————
function generateBarcodeSVG(data) {
  // تنظيف البيانات وتحويلها لرقم
  const cleanData = String(data).replace(/[^0-9]/g, '') || '123456789';
  const barcodeData = cleanData.padStart(12, '0').substring(0, 12);
  
  // نمط باركود بسيط (Code 128 مبسط) - محسن للطباعة
  const bars = [];
  for (let i = 0; i < barcodeData.length; i++) {
    const digit = parseInt(barcodeData[i]);
    // كل رقم يمثل بنمط من الخطوط
    const pattern = [
      '3211', '2221', '2122', '1411', '1132',
      '1231', '1114', '1312', '1213', '3112'
    ][digit];
    
    for (let j = 0; j < pattern.length; j++) {
      const width = parseInt(pattern[j]) * 2; // زيادة العرض للوضوح
      const isBlack = j % 2 === 0;
      bars.push({ width, isBlack });
    }
  }
  
  // بناء SVG محسن للطباعة عالية الجودة
  let x = 0;
  let barsHTML = '';
  bars.forEach(bar => {
    if (bar.isBlack) {
      barsHTML += `<rect x="${x}" y="0" width="${bar.width}" height="60" fill="#000000"/>`;
    }
    x += bar.width;
  });
  
  return `
    <svg width="${x}" height="75" viewBox="0 0 ${x} 75" xmlns="http://www.w3.org/2000/svg" style="background: white;">
      ${barsHTML}
      <text x="${x/2}" y="72" text-anchor="middle" font-family="Arial, monospace" font-size="10" font-weight="bold" fill="#000000">${barcodeData}</text>
    </svg>`;
}
  
// ————————————————————————————————————————————————————————————————
// معاينة PDF داخل الصفحة
// ————————————————————————————————————————————————————————————————
function generatePDF() {
  if (pricingItems.length === 0) { alert('لا توجد منتجات في القائمة'); return; }
  const template = els.templateSelect.value;
  const fullHTML = buildTablesHTML(template);
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

function generateStickersPDF() {
  if (stickerItems.length === 0) {
    alert('لا توجد ملصقات لإنشاء PDF');
    return;
  }
  
  // استخدام الحجم المحدد من القائمة المنسدلة
  const template = els.stickerSizeSelect.value || 'sticker-4x3';
  const fullHTML = buildStickerPagesHTML(template);
  const parser = new DOMParser();
  const doc = parser.parseFromString(fullHTML, 'text/html');
  const pages = doc.querySelectorAll('.sticker-page');
  let pagesHTML = '';
  
  // إضافة الستايل للمعاينة
  const styleElement = doc.querySelector('style');
  if (styleElement) {
    pagesHTML += `<style>${styleElement.innerHTML}</style>`;
  }
  
  pages.forEach(p => pagesHTML += p.outerHTML);
  els.pdfContent.innerHTML = pagesHTML;
  els.pdfPreview.style.display = 'block';
  els.printStickersBtn.style.display = 'inline-flex';
  els.pdfPreview.scrollIntoView({ behavior: 'smooth' });
}

async function downloadStickersPDF() {
  if (stickerItems.length === 0) {
    alert('لا توجد ملصقات للتحميل');
    return;
  }
  
  try {
    const template = els.stickerSizeSelect ? els.stickerSizeSelect.value : 'sticker-4x3';
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: template === 'sticker-4x3' ? [101.6, 76.2] : [76.2, 50.8]
    });
    
    const fullHTML = buildStickerPagesHTML(template);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    document.body.appendChild(iframe);
    
    iframe.contentDocument.open();
    iframe.contentDocument.write(fullHTML);
    iframe.contentDocument.close();
    
    setTimeout(async () => {
      const pages = iframe.contentDocument.querySelectorAll('.sticker-page');
      
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, 75, template === 'sticker-3x4' ? 100 : 150);
      }
      
      pdf.save(`stickers-${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.removeChild(iframe);
    }, 1000);
    
  } catch (error) {
    console.error('خطأ في تحميل PDF:', error);
    alert('حدث خطأ أثناء تحميل PDF');
  }
}

function printStickersPDF() {
  if (stickerItems.length === 0) {
    alert('لا توجد ملصقات للطباعة');
    return;
  }
  
  const template = els.templateSelect.value;
  const fullHTML = buildStickerPagesHTML(template);
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(fullHTML);
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
  }, 1000);
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

    const template = els.templateSelect.value;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(buildTablesHTML(template)); doc.close();
    await new Promise(r => { iframe.onload = r; setTimeout(r, 800); });

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const pdf = await renderIframePagesToPdf(doc, /*scaleForMobile*/ isMobile);

    let templateName;
    if (template === 'simple') templateName = 'بسيط';
    else if (template === 'barcode') templateName = 'باركود';
    else if (template === 'sticker-3x4') templateName = 'ملصقات-3x4';
    else if (template === 'sticker-3x2') templateName = 'ملصقات-3x2';
    else templateName = 'عادي';
    
    pdf.save(`pricing-table-${templateName}.pdf`);
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

    const template = els.templateSelect.value;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(buildTablesHTML(template)); doc.close();
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
  const template = els.templateSelect.value;
  const html = buildTablesHTML(template);
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

// إظهار/إخفاء قسم الإدخال اليدوي حسب القالب المختار
els.templateSelect.addEventListener('change', () => {
  const template = els.templateSelect.value;
  const isSticker = template.startsWith('sticker');
  els.manualProductSection.style.display = isSticker ? 'block' : 'none';
});

// إضافة منتج يدوي للملصقات
els.addManualProductBtn.addEventListener('click', addManualProduct);

// إضافة مستمعي الأحداث للملصقات
els.clearStickersBtn.addEventListener('click', clearStickerList);
els.generateStickersBtn.addEventListener('click', generateStickersPDF);
els.downloadStickersBtn.addEventListener('click', downloadStickersPDF);
els.printStickersBtn.addEventListener('click', printStickersPDF);

window.addEventListener('load', () => { 
  listCameras(); 
  initializeAppwrite(); // استخدام Appwrite بدلاً من التخزين المحلي
  loadStickerListFromStorage(); // تحميل قائمة الملصقات من التخزين المحلي
});

// إضافة الوظائف إلى النطاق العام
window.removeFromPricingList = removeFromPricingList;
window.showEditOptions = showEditOptions;
window.editItemName = editItemName;
window.editItemPrice = editItemPrice;
window.updatePricingItem = updatePricingItem;