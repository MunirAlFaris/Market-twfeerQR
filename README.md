# نظام إدارة الأسعار مع Appwrite

نظام إدارة أسعار المنتجات مع إمكانية مسح الباركود وحفظ البيانات في قاعدة بيانات Appwrite.

## المميزات

- ✅ مسح الباركود باستخدام الكاميرا
- ✅ البحث عن المنتجات بالاسم أو الباركود
- ✅ إضافة المنتجات إلى قائمة الأسعار
- ✅ تعديل أسماء وأسعار المنتجات
- ✅ حفظ البيانات في قاعدة بيانات Appwrite
- ✅ طباعة وحفظ PDF محسّن للهواتف المحمولة
- ✅ واجهة مستخدم متجاوبة

## إعداد Appwrite

### 1. إنشاء حساب Appwrite

1. اذهب إلى [Appwrite Cloud](https://cloud.appwrite.io)
2. أنشئ حساباً جديداً أو سجل الدخول
3. أنشئ مشروعاً جديداً

### 2. إعداد قاعدة البيانات

1. في لوحة تحكم Appwrite، اذهب إلى "Databases"
2. أنشئ قاعدة بيانات جديدة باسم `68a6506b001e531fdcce`
3. أنشئ مجموعة جديدة باسم `68a650740005dbb4117a`

### 3. إعداد مخطط المجموعة

أضف الحقول التالية إلى مجموعة `68a650740005dbb4117a`:

| اسم الحقل | النوع | الحجم | مطلوب | الوصف |
|-----------|-------|-------|--------|-------|
| `name` | String | 255 | نعم | اسم المنتج |
| `price` | Float | - | نعم | سعر المنتج |
| `type` | String | 50 | نعم | نوع السعر (base/other) |
| `created_at` | DateTime | - | لا | تاريخ الإنشاء |

### 4. إعداد الصلاحيات

في إعدادات المجموعة، اضبط الصلاحيات كالتالي:
- **Read**: Any
- **Create**: Any
- **Update**: Any
- **Delete**: Any

> ⚠️ **تنبيه أمني**: هذه الصلاحيات مفتوحة للجميع. في بيئة الإنتاج، يُنصح بتقييد الصلاحيات حسب المستخدمين المصرح لهم.

### 5. تحديث ملف الإعداد

1. افتح ملف `appwrite-config.js`
2. استبدل `68a6505a000ae3ad9653` بمعرف مشروعك الفعلي من لوحة تحكم Appwrite
3. تأكد من أن أسماء قاعدة البيانات والمجموعة تطابق ما أنشأته

```javascript
const APPWRITE_CONFIG = {
  ENDPOINT: 'https://fra.cloud.appwrite.io/v1',
  PROJECT_ID: 'your-actual-project-id', // ضع معرف مشروعك هنا
  DATABASE_ID: '68a6506b001e531fdcce',
  COLLECTION_ID: '68a650740005dbb4117a'
};
```

## تشغيل التطبيق

### الطريقة الأولى: خادم Node.js

```bash
node -e "const http = require('http'); const fs = require('fs'); const path = require('path'); const server = http.createServer((req, res) => { let filePath = '.' + req.url; if (filePath === './') filePath = './pricing.html'; const extname = String(path.extname(filePath)).toLowerCase(); const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }; const contentType = mimeTypes[extname] || 'application/octet-stream'; fs.readFile(filePath, (error, content) => { if (error) { if(error.code == 'ENOENT') { res.writeHead(404); res.end('File not found'); } else { res.writeHead(500); res.end('Server error'); } } else { res.writeHead(200, { 'Content-Type': contentType }); res.end(content, 'utf-8'); } }); }); server.listen(8000, () => { console.log('Server running at http://localhost:8000/'); });"
```

### الطريقة الثانية: Live Server (VS Code)

1. ثبت إضافة Live Server في VS Code
2. انقر بزر الماوس الأيمن على `pricing.html`
3. اختر "Open with Live Server"

## استخدام التطبيق

### إضافة منتج جديد

1. **بالباركود**: انقر على "فتح الكاميرا" ووجه الكاميرا نحو الباركود
2. **بالاسم**: اكتب اسم المنتج في حقل "البحث بالاسم"
3. أدخل السعر واختر نوع السعر
4. انقر "إضافة إلى القائمة"

### تعديل منتج موجود

1. انقر على اسم المنتج أو سعره في القائمة
2. أدخل القيمة الجديدة
3. اضغط Enter أو انقر خارج الحقل للحفظ

### طباعة وحفظ PDF

- **طباعة**: انقر على زر "طباعة" (محسّن للهواتف المحمولة)
- **حفظ PDF**: انقر على زر "حفظ PDF" (يستخدم Web Share API على الهواتف)

## الملفات الرئيسية

- `pricing.html` - الواجهة الرئيسية
- `pricing.js` - منطق التطبيق والتكامل مع Appwrite
- `appwrite-config.js` - إعدادات Appwrite

## استكشاف الأخطاء

### خطأ في الاتصال بـ Appwrite

1. تأكد من صحة معرف المشروع في `appwrite-config.js`
2. تحقق من إعدادات الصلاحيات في لوحة تحكم Appwrite
3. تأكد من أن أسماء قاعدة البيانات والمجموعة صحيحة

### مشاكل الكاميرا

1. تأكد من منح الإذن للموقع لاستخدام الكاميرا
2. استخدم HTTPS أو localhost للوصول للكاميرا
3. تحقق من أن الكاميرا غير مستخدمة من تطبيق آخر

### مشاكل الطباعة على الهواتف

1. تأكد من أن المتصفح يدعم `window.print()`
2. للحصول على أفضل النتائج، استخدم Chrome أو Safari

## الدعم الفني

إذا واجهت أي مشاكل، تحقق من:
1. وحدة تحكم المطور في المتصفح (F12)
2. إعدادات Appwrite في لوحة التحكم
3. صحة ملف الإعداد

---

**ملاحظة**: هذا التطبيق مصمم للاستخدام المحلي أو في بيئة آمنة. تأكد من تطبيق إجراءات الأمان المناسبة قبل النشر في بيئة الإنتاج.