// ========================================
// نظام تدقيق أسعار المواد
// ========================================

// المتغيرات العامة
let allProducts = [];
let filteredResults = [];
let currentAnalysisType = 'percentage';
let currentAnalysisValue = 25;
let sortColumn = 'name';
let sortDirection = 'asc';

// إضافة متغيرات جديدة للعداد وشريط التقدم
let productsCounter = 0;

// وظيفة تحديث عداد المنتجات
function updateProductsCounter(count) {
    productsCounter = count;
    const counterElement = document.getElementById('products-count');
    const statusElement = document.getElementById('loading-status');
    
    if (counterElement) {
        counterElement.textContent = count;
    }
    
    if (statusElement) {
        statusElement.textContent = count > 0 ? 'تم التحميل' : 'لا توجد بيانات';
        statusElement.className = count > 0 ? 'loading-status success' : 'loading-status error';
    }
}

// وظيفة إظهار شريط التقدم
function showProgress() {
    const progressContainer = document.getElementById('progress-container');
    if (progressContainer) {
        progressContainer.style.display = 'block';
    }
}

// وظيفة إخفاء شريط التقدم
function hideProgress() {
    const progressContainer = document.getElementById('progress-container');
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
}

// وظيفة تحديث شريط التقدم
function updateProgress(percentage, text = '') {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (progressFill) {
        progressFill.style.width = percentage + '%';
    }
    
    if (progressText) {
        progressText.textContent = text || `${percentage}%`;
    }
}

// ========================================
// تحميل البيانات
// ========================================

async function loadProductsData() {
    try {
        showLoading();
        showProgress();
        updateProgress(10, 'بدء التحميل...');
        
        const response = await fetch('products.json');
        updateProgress(30, 'جاري تحميل البيانات...');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        updateProgress(60, 'معالجة البيانات...');
        
        // التعامل مع التنسيق الجديد للبيانات
        let documents = [];
        
        // البحث عن البيانات في الكائن
        for (const key in data) {
            if (Array.isArray(data[key])) {
                documents = data[key];
                break;
            }
        }
        
        if (documents && Array.isArray(documents) && documents.length > 0) {
            allProducts = extractProducts(documents);
            updateProgress(80, 'تنظيم البيانات...');
            
            populateCategories();
            updateProductsCounter(allProducts.length);
            updateProgress(100, 'تم التحميل بنجاح');
            
            setTimeout(() => {
                hideProgress();
                hideLoading();
            }, 500);
            
            console.log(`تم تحميل ${allProducts.length} منتج بنجاح`);
        } else {
            throw new Error('تنسيق البيانات غير صحيح أو لا توجد بيانات');
        }
    } catch (error) {
        console.error('خطأ في تحميل البيانات:', error);
        updateProgress(0, 'فشل في التحميل');
        updateProductsCounter(0);
        
        setTimeout(() => {
            hideProgress();
            hideLoading();
        }, 1000);
        
        // عرض رسالة خطأ في الواجهة بدلاً من alert
        showError('فشل في تحميل البيانات: ' + error.message);
    }
}

function extractProducts(documents) {
    const products = [];
    documents.forEach(doc => {
        const productName = doc.ITEM_NAME_AR || doc.name;
        const category = doc.CATEGORY_AR || doc.category;
        const productType = category || 'غير محدد';
        
        if (!productName) return;
        
        // استخراج بيانات الوحدة الأساسية
        const baseCost = parseFloat(doc.BASE_COST_PRICE || doc.cost) || 0;
        const basePrice = parseFloat(doc.BASE_SALE_PRICE || doc.saleBase) || 0;
        const baseQty = parseFloat(doc.BASE_QTY) || 0;
        
        if (basePrice > 0 && baseCost > 0) {
            products.push({
                id: Math.random().toString(36).substr(2, 9),
                name: productName.trim(),
                unit: 'base',
                productType: productType,
                category: category || '',
                cost: baseCost,
                price: basePrice,
                quantity: Math.max(baseQty, 1), // استخدام الكمية الفعلية أو 1 كحد أدنى
                barcodes: doc.BASE_BARCODES ? [doc.BASE_BARCODES] : []
            });
        }
        
        // استخراج بيانات الوحدة الكبرى
        const moreCost = parseFloat(doc.MORE_COST_PRICE) || 0;
        const morePrice = parseFloat(doc.MORE_SALE_PRICE || doc.saleMore) || 0;
        const moreQty = parseFloat(doc.MORE_QTY) || 0;
        
        if (morePrice > 0 && moreCost > 0) {
            products.push({
                id: Math.random().toString(36).substr(2, 9),
                name: productName.trim(),
                unit: 'more',
                productType: productType,
                category: category || '',
                cost: moreCost,
                price: morePrice,
                quantity: Math.max(moreQty, 1), // استخدام الكمية الفعلية أو 1 كحد أدنى
                barcodes: doc.MORE_BARCODES ? [doc.MORE_BARCODES] : []
            });
        }
        
        // استخراج بيانات الوحدة الصغرى
        const lessCost = parseFloat(doc.LESS_COST_PRICE) || 0;
        const lessPrice = parseFloat(doc.LESS_SALE_PRICE || doc.saleLess) || 0;
        const lessQty = parseFloat(doc.LESS_QTY) || 0;
        
        if (lessPrice > 0 && lessCost > 0) {
            products.push({
                id: Math.random().toString(36).substr(2, 9),
                name: productName.trim(),
                unit: 'less',
                productType: productType,
                category: category || '',
                cost: lessCost,
                price: lessPrice,
                quantity: Math.max(Math.abs(lessQty), 1), // استخدام القيمة المطلقة للكمية أو 1 كحد أدنى
                barcodes: doc.LESS_BARCODES ? [doc.LESS_BARCODES] : []
            });
        }
    });
    return products;
}

function populateCategories() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;
    
    // استخراج الأصناف الحقيقية من البيانات (CATEGORY_AR)
    const realCategories = [...new Set(allProducts.map(p => p.productType).filter(type => type && type !== 'غير محدد'))].sort();
    
    // مسح الخيارات الحالية
    categoryFilter.innerHTML = '<option value="">جميع الأصناف</option>';
    
    // إضافة الأصناف الحقيقية من البيانات
    realCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
}

// ========================================
// تحليل الأرباح
// ========================================

async function runAnalysis() {
    if (allProducts.length === 0) {
        showError('لا توجد بيانات للتحليل. يرجى التأكد من تحميل البيانات أولاً.');
        return;
    }

    showProgress();
    updateProgress(0, 'بدء التحليل...');

    try {
        // الحصول على الخيارات المحددة
        const activeAnalysisOption = document.querySelector('.analysis-option.active');
        const analysisType = activeAnalysisOption ? activeAnalysisOption.getAttribute('data-type') : 'show-all';
        const categoryFilter = document.getElementById('categoryFilter').value;
        const searchTerm = document.getElementById('searchFilter').value.toLowerCase();
        const analysisValue = parseFloat(document.getElementById('analysisValue').value) || 0;

        updateProgress(20, 'تطبيق المرشحات...');

        // تطبيق المرشحات
        let filteredProducts = allProducts.filter(product => {
            const matchesCategory = !categoryFilter || product.productType === categoryFilter;
            const matchesSearch = !searchTerm || 
                (product.name && product.name.toLowerCase().includes(searchTerm));
            
            return matchesCategory && matchesSearch;
        });

        updateProgress(40, 'تجميع البيانات...');

        // تجميع المنتجات حسب الاسم
        const groupedProducts = {};
        filteredProducts.forEach(product => {
            if (!groupedProducts[product.name]) {
                groupedProducts[product.name] = [];
            }
            groupedProducts[product.name].push(product);
        });

        updateProgress(60, 'حساب الإحصائيات...');

        // تحليل كل مجموعة منتجات
        const analysisResults = [];
        for (const [productName, products] of Object.entries(groupedProducts)) {
            // تجميع حسب الوحدة
            const unitGroups = {};
            products.forEach(product => {
                if (!unitGroups[product.unit]) {
                    unitGroups[product.unit] = [];
                }
                unitGroups[product.unit].push(product);
            });

            // تحليل جميع الوحدات للمنتج الواحد
            const units = {};
            let totalProductQuantity = 0;
            let totalProductCost = 0;
            let totalProductRevenue = 0;
            
            for (const [unit, unitProducts] of Object.entries(unitGroups)) {
                const totalQuantity = unitProducts.reduce((sum, p) => sum + p.quantity, 0);
                const totalCost = unitProducts.reduce((sum, p) => sum + (p.cost * p.quantity), 0);
                const totalRevenue = unitProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
                
                // حساب المتوسطات للوحدة الواحدة
                const averageCost = Math.round((totalCost / totalQuantity) * 100) / 100;
                const averagePrice = Math.round((totalRevenue / totalQuantity) * 100) / 100;
                
                // حساب الربح للوحدة الواحدة (السعر - التكلفة)
                const profit = Math.round((averagePrice - averageCost) * 100) / 100;
                
                // إصلاح حساب النسبة المئوية: النسبة = ((السعر - التكلفة) / التكلفة) × 100
                // للتحقق: إذا كانت التكلفة 1 والنسبة 55.6%، فالسعر = 1 + (1 × 55.6/100) = 1.556
                const profitMargin = averageCost > 0 ? 
                    Math.round(((averagePrice - averageCost) / averageCost) * 100 * 100) / 100 : 0;

                units[unit] = {
                    quantity: totalQuantity,
                    totalCost: totalCost,
                    totalRevenue: totalRevenue,
                    profit: profit, // الآن يعرض الربح للوحدة الواحدة
                    profitMargin: profitMargin,
                    averageCost: averageCost,
                    averagePrice: averagePrice
                };

                totalProductQuantity += totalQuantity;
                totalProductCost += totalCost;
                totalProductRevenue += totalRevenue;
            }

            const totalProductProfit = Math.round((totalProductRevenue - totalProductCost) * 100) / 100;
            const averageProductCost = Math.round((totalProductCost / totalProductQuantity) * 100) / 100;
            const averageProductPrice = Math.round((totalProductRevenue / totalProductQuantity) * 100) / 100;
            const totalProductProfitMargin = averageProductCost > 0 ? Math.round((((averageProductPrice - averageProductCost) / averageProductCost) * 100) * 100) / 100 : 0;

            analysisResults.push({
                name: productName,
                units: units,
                productType: products[0].productType,
                totalQuantity: totalProductQuantity,
                totalCost: totalProductCost,
                totalRevenue: totalProductRevenue,
                totalProfit: totalProductProfit,
                averageProfitMargin: totalProductProfitMargin,
                averageCost: averageProductCost,
                averagePrice: averageProductPrice
            });
        }

        updateProgress(80, 'تطبيق معايير التحليل...');

        // تطبيق معايير التحليل والتصفية
        let finalResults = analysisResults;
        
        if (analysisType === 'percentage' && analysisValue > 0) {
            // تصفية حسب نسبة الربح
            finalResults = analysisResults.map(result => ({
                ...result,
                comparisonStatus: result.profitMargin > analysisValue ? 'higher' : 
                                result.profitMargin < analysisValue ? 'lower' : 'equal'
            }));
        } else if (analysisType === 'fixed' && analysisValue > 0) {
            // تصفية حسب مبلغ الربح الثابت
            finalResults = analysisResults.map(result => ({
                ...result,
                comparisonStatus: result.profit > analysisValue ? 'higher' : 
                                result.profit < analysisValue ? 'lower' : 'equal'
            }));
        } else {
            // عرض الكل - إضافة حالة افتراضية
            finalResults = analysisResults.map(result => ({
                ...result,
                comparisonStatus: 'none'
            }));
        }

        // ترتيب النتائج حسب هامش الربح (الأعلى أولاً)
        finalResults.sort((a, b) => b.profitMargin - a.profitMargin);

        updateProgress(90, 'عرض النتائج...');

        // عرض النتائج
        displayResults(finalResults, analysisType, analysisValue);
        displayTable(finalResults, analysisType, analysisValue);
        
        updateProgress(100, 'تم التحليل بنجاح');
        
        setTimeout(() => {
            hideProgress();
        }, 500);

    } catch (error) {
        console.error('خطأ في التحليل:', error);
        updateProgress(0, 'فشل في التحليل');
        showError('حدث خطأ أثناء التحليل: ' + error.message);
        
        setTimeout(() => {
            hideProgress();
        }, 1000);
    }
}

// ========================================
// عرض النتائج
// ========================================

function displayResults(results, analysisType, analysisValue) {
    const totalProductsElement = document.getElementById('totalProducts');
    const totalProfitElement = document.getElementById('totalProfit');
    const totalRevenueElement = document.getElementById('totalRevenue');
    const averageMarginElement = document.getElementById('averageMargin');
    
    if (!results || results.length === 0) {
        if (totalProductsElement) totalProductsElement.textContent = '0';
        if (totalProfitElement) totalProfitElement.textContent = '$0.00';
        if (totalRevenueElement) totalRevenueElement.textContent = '$0.00';
        if (averageMarginElement) averageMarginElement.textContent = '0%';
        showNoResults();
        return;
    }
    
    // حساب الإجماليات الصحيحة
    const totalProducts = results.length;
    const totalProfit = results.reduce((sum, result) => sum + (result.profit || 0), 0);
    const totalRevenue = results.reduce((sum, result) => sum + (result.totalRevenue || 0), 0);
    const totalCost = results.reduce((sum, result) => sum + (result.totalCost || 0), 0);
    const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    // عرض الإحصائيات
    if (totalProductsElement) totalProductsElement.textContent = totalProducts.toLocaleString();
    if (totalProfitElement) totalProfitElement.textContent = `$${totalProfit.toFixed(2)}`;
    if (totalRevenueElement) totalRevenueElement.textContent = `$${totalRevenue.toFixed(2)}`;
    if (averageMarginElement) averageMarginElement.textContent = `${averageMargin.toFixed(1)}%`;
    
    // إضافة معلومات إضافية للتحليل
    if (analysisType !== 'show-all' && analysisValue) {
        const higherCount = results.filter(r => r.comparisonStatus === 'higher').length;
        const lowerCount = results.filter(r => r.comparisonStatus === 'lower').length;
        const equalCount = results.filter(r => r.comparisonStatus === 'equal').length;
        
        console.log(`تحليل النتائج: ${higherCount} أعلى، ${lowerCount} أقل، ${equalCount} مساوي من ${analysisValue}${analysisType === 'percentage' ? '%' : '$'}`);
    }
    
    // إظهار لوحة النتائج
    const resultsPanel = document.getElementById('resultsPanel');
    if (resultsPanel) {
        resultsPanel.style.display = 'block';
    }
}

function displayTable(results, analysisType, analysisValue) {
    const tableContent = document.getElementById('tableContent');
    if (!tableContent || !results || results.length === 0) {
        showNoResults();
        return;
    }
    
    const getUnitComparisonStatus = (unitData) => {
        if (analysisType === 'show-all') return 'none';
        
        if (analysisType === 'percentage' && analysisValue > 0) {
            return unitData.profitMargin > analysisValue ? 'higher' : 
                   unitData.profitMargin < analysisValue ? 'lower' : 'equal';
        } else if (analysisType === 'fixed' && analysisValue > 0) {
            return unitData.profit > analysisValue ? 'higher' : 
                   unitData.profit < analysisValue ? 'lower' : 'equal';
        }
        return 'none';
    };

    const getUnitComparisonIcon = (unitData) => {
        const status = getUnitComparisonStatus(unitData);
        if (status === 'none') return '';
        return status === 'higher' ? '<i class="fas fa-arrow-up text-success comparison-icon"></i>' : 
               status === 'lower' ? '<i class="fas fa-arrow-down text-danger comparison-icon"></i>' : 
               '<i class="fas fa-equals text-warning comparison-icon"></i>';
    };

    const getRowClass = (unitData) => {
        const status = getUnitComparisonStatus(unitData);
        return status === 'higher' ? 'table-success' : 
               status === 'lower' ? 'table-danger' : 
               status === 'equal' ? 'table-warning' : '';
    };

    const tableHeaders = analysisType !== 'show-all' 
        ? `<th class="product-name-cell">اسم المنتج</th><th>نوع الوحدة</th><th class="product-type-cell">نوع المنتج</th><th>التكلفة</th><th>السعر</th><th>الربح</th><th>هامش الربح</th><th>المقارنة</th>`
        : `<th class="product-name-cell">اسم المنتج</th><th>نوع الوحدة</th><th class="product-type-cell">نوع المنتج</th><th>التكلفة</th><th>السعر</th><th>الربح</th><th>هامش الربح</th>`;

    let tableRows = '';
    
    results.forEach(result => {
        const units = Object.entries(result.units || {});
        const unitsCount = units.length;
        
        if (unitsCount === 0) {
            // إذا لم توجد وحدات، اعرض سطر واحد للمنتج
            tableRows += `
                <tr>
                    <td class="product-name-cell"><strong>${result.name}</strong></td>
                    <td colspan="${analysisType !== 'show-all' ? '7' : '6'}" class="text-center">لا توجد وحدات</td>
                </tr>
            `;
        } else {
            // اعرض كل وحدة في سطر منفصل
            units.forEach(([unitType, unitData], index) => {
                const isFirstRow = index === 0;
                const rowClass = getRowClass(unitData);
                
                tableRows += `
                    <tr class="${rowClass}">
                        ${isFirstRow ? `<td rowspan="${unitsCount}" class="align-middle product-name-cell"><strong>${result.name}</strong></td>` : ''}
                        <td class="text-center">
                            <span class="unit-badge unit-${unitType}">${getUnitName(unitType)}</span>
                        </td>
                        ${isFirstRow ? `<td rowspan="${unitsCount}" class="align-middle product-type-cell">${result.productType || 'غير محدد'}</td>` : ''}
                        <td class="price-cell text-center">$${unitData.averageCost.toFixed(2)}</td>
                        <td class="price-cell text-center">$${unitData.averagePrice.toFixed(2)}</td>
                        <td class="profit-cell text-center ${unitData.profit >= 0 ? 'text-success' : 'text-danger'}">
                            $${unitData.profit.toFixed(2)}
                        </td>
                        <td class="percentage-cell text-center ${unitData.profitMargin >= 0 ? 'text-success' : 'text-danger'}">
                            ${unitData.profitMargin.toFixed(1)}%
                        </td>
                        ${analysisType !== 'show-all' ? `<td class="text-center">${getUnitComparisonIcon(unitData)}</td>` : ''}
                    </tr>
                `;
            });
        }
    });

    const tableHTML = `
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        ${tableHeaders}
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
    
    tableContent.innerHTML = tableHTML;
}

function getUnitName(unit) {
    switch (unit) {
        case 'base': return 'وحدة أساسية';
        case 'more': return 'وحدة كبرى';
        case 'less': return 'وحدة صغرى';
        default: return unit;
    }
}

// ========================================
// وظائف المساعدة
// ========================================

function showLoading() {
    const tableContent = document.getElementById('tableContent');
    if (tableContent) {
        tableContent.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>جاري معالجة البيانات...</p>
            </div>
        `;
    }
}

function hideLoading() {
    // سيتم استبدال المحتوى بالنتائج
}

function showNoResults() {
    const tableContent = document.getElementById('tableContent');
    if (tableContent) {
        tableContent.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <h3>لا توجد نتائج</h3>
                <p>لم يتم العثور على منتجات تطابق معايير البحث المحددة</p>
            </div>
        `;
    }
}

function showError(message) {
    const tableContent = document.getElementById('tableContent');
    const statusElement = document.getElementById('loading-status');
    
    if (tableContent) {
        tableContent.innerHTML = `
            <div class="no-results">
                <i class="fas fa-exclamation-triangle" style="color: #e74c3c;"></i>
                <h3>خطأ</h3>
                <p>${message}</p>
            </div>
        `;
    }
    
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = 'loading-status error';
    }
}

function showSuccess(message) {
    const statusElement = document.getElementById('loading-status');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = 'loading-status success';
    }
}

// ========================================
// مستمعي الأحداث
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    // تحميل البيانات عند بدء التطبيق
    loadProductsData();

    // إعداد مستمعي الأحداث للأزرار
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', runAnalysis);
    }

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadProductsData);
    }

    // إعداد مستمعي الأحداث للفلاتر (بدون تحليل تلقائي)
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function() {
            // لا يتم تشغيل التحليل تلقائياً
        });
    }

    const searchInput = document.getElementById('searchFilter');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            // لا يتم تشغيل التحليل تلقائياً
        });
    }

    // إعداد مستمعي الأحداث لخيارات التحليل (بدون تحليل تلقائي)
    // إدارة خيارات التحليل
    const analysisOptions = document.querySelectorAll('.analysis-option');
    analysisOptions.forEach(option => {
        option.addEventListener('click', function() {
            // إزالة الفئة النشطة من جميع الخيارات
            analysisOptions.forEach(opt => opt.classList.remove('active'));
            // إضافة الفئة النشطة للخيار المحدد
            this.classList.add('active');
            
            // لا يتم تشغيل التحليل تلقائياً
        });
    });
});

// إضافة أنماط CSS للوحدات
const additionalStyles = `
    <style>
        .unit-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.8em;
            font-weight: bold;
            margin-right: 5px;
        }
        .unit-base { background-color: #007bff; color: white; }
        .unit-more { background-color: #28a745; color: white; }
        .unit-less { background-color: #ffc107; color: black; }
        
        .units-cell {
            max-width: 300px;
            line-height: 1.6;
            font-size: 0.9em;
        }
        
        .text-success { color: #28a745 !important; }
        .text-danger { color: #dc3545 !important; }
        .text-warning { color: #ffc107 !important; }

        .loading {
            text-align: center;
            padding: 40px;
            color: #6c757d;
        }

        .loading i {
            font-size: 2rem;
            margin-bottom: 10px;
        }

        .no-results {
            text-align: center;
            padding: 40px;
            color: #6c757d;
        }

        .no-results i {
            font-size: 3rem;
            margin-bottom: 15px;
        }
    </style>
`;

document.head.insertAdjacentHTML('beforeend', additionalStyles);