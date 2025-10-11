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
let currentTableData = [];
let averageProfit = 0;

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
            // تصفية حسب نسبة الربح - تطبيق على كل وحدة
            finalResults = analysisResults.map(result => {
                const updatedUnits = {};
                for (const [unitType, unitData] of Object.entries(result.units || {})) {
                    updatedUnits[unitType] = {
                        ...unitData,
                        comparisonStatus: unitData.profitMargin > analysisValue ? 'higher' : 
                                        unitData.profitMargin < analysisValue ? 'lower' : 'equal'
                    };
                }
                return {
                    ...result,
                    units: updatedUnits,
                    comparisonStatus: result.averageProfitMargin > analysisValue ? 'higher' : 
                                    result.averageProfitMargin < analysisValue ? 'lower' : 'equal'
                };
            });
        } else if (analysisType === 'fixed' && analysisValue > 0) {
            // تصفية حسب مبلغ الربح الثابت - تطبيق على كل وحدة
            finalResults = analysisResults.map(result => {
                const updatedUnits = {};
                for (const [unitType, unitData] of Object.entries(result.units || {})) {
                    updatedUnits[unitType] = {
                        ...unitData,
                        comparisonStatus: unitData.profit > analysisValue ? 'higher' : 
                                        unitData.profit < analysisValue ? 'lower' : 'equal'
                    };
                }
                return {
                    ...result,
                    units: updatedUnits,
                    comparisonStatus: result.totalProfit > analysisValue ? 'higher' : 
                                    result.totalProfit < analysisValue ? 'lower' : 'equal'
                };
            });
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
        console.log('نتائج التحليل:', finalResults.length, 'منتج');
        console.log('عينة من البيانات:', finalResults.slice(0, 2));
        
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
    
    // حفظ نوع التحليل والقيمة الحالية
    currentAnalysisType = analysisType;
    currentAnalysisValue = analysisValue;
    
    if (!results || results.length === 0) {
        if (totalProductsElement) totalProductsElement.textContent = '0';
        if (totalProfitElement) totalProfitElement.textContent = '$0.00';
        if (totalRevenueElement) totalRevenueElement.textContent = '$0.00';
        if (averageMarginElement) averageMarginElement.textContent = '0%';
        updatePrintButtonState(false);
        showNoResults();
        return;
    }
    
    // حساب الإجماليات الصحيحة
    const totalProducts = results.length;
    const totalProfit = results.reduce((sum, result) => sum + (result.totalProfit || 0), 0);
    const totalRevenue = results.reduce((sum, result) => sum + (result.totalRevenue || 0), 0);
    const totalCost = results.reduce((sum, result) => sum + (result.totalCost || 0), 0);
    const averageMargin = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;
    
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
    
    // تفعيل زر الطباعة
    updatePrintButtonState(true);
}

// دالة لإدارة حالة زر الطباعة
function updatePrintButtonState(hasData) {
    const printTableBtn = document.getElementById('printTableBtn');
    if (printTableBtn) {
        if (hasData && currentTableData && currentTableData.length > 0) {
            printTableBtn.disabled = false;
            printTableBtn.style.opacity = '1';
            printTableBtn.title = 'طباعة النتائج';
        } else {
            printTableBtn.disabled = true;
            printTableBtn.style.opacity = '0.5';
            printTableBtn.title = 'لا توجد بيانات للطباعة - يرجى تشغيل التحليل أولاً';
        }
    }
}

function displayTable(results, analysisType, analysisValue) {
    const tableContent = document.getElementById('tableContent');
    if (!tableContent) {
        console.error('عنصر tableContent غير موجود');
        return;
    }
    
    if (!results || results.length === 0) {
        console.log('لا توجد نتائج لعرضها');
        showNoResults();
        return;
    }
    
    console.log('عرض الجدول:', results.length, 'منتج');
    
    const getUnitComparisonStatus = (unitData) => {
        // استخدام الحالة المحفوظة في البيانات إذا كانت متوفرة
        if (unitData.comparisonStatus) {
            return unitData.comparisonStatus;
        }
        
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
                
                // إضافة تمييز خاص للوحدات الصغرى
                const isSmallUnit = unitType === 'less';
                const smallUnitClass = isSmallUnit ? 'small-unit-highlight' : '';
                const smallUnitIcon = isSmallUnit ? '<i class="fas fa-star text-warning" title="وحدة صغرى"></i> ' : '';
                
                tableRows += `
                    <tr class="${rowClass} ${smallUnitClass}">
                        ${isFirstRow ? `<td rowspan="${unitsCount}" class="align-middle product-name-cell"><strong>${result.name}</strong></td>` : ''}
                        <td class="text-center">
                            ${smallUnitIcon}<span class="unit-badge unit-${unitType}">${getUnitName(unitType)}</span>
                        </td>
                        ${isFirstRow ? `<td rowspan="${unitsCount}" class="align-middle product-type-cell">${result.productType || 'غير محدد'}</td>` : ''}
                        <td class="price-cell text-center">$${unitData.averageCost.toFixed(2)}</td>
                        <td class="price-cell text-center">$${unitData.averagePrice.toFixed(2)}</td>
                        <td class="profit-cell text-center ${unitData.profit >= 0 ? 'text-success' : 'text-danger'}">
                            $${unitData.profit.toFixed(2)}
                        </td>
                        <td class="percentage-cell text-center ${unitData.profitMargin >= 0 ? 'text-success' : 'text-danger'} ${isSmallUnit ? 'small-unit-profit' : ''}">
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
            <table class="data-table" id="printableTable">
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
    
    // حفظ البيانات الحالية للفلترة والترتيب
    currentTableData = results;
    
    // تطبيق التلوين على الوحدات الصغرى
    applySmallUnitColoring();
    
    // حساب متوسط الربح
    calculateAverageProfit(results);
    
    // إعداد مستمعي الأحداث للفلاتر
    setupTableFilters();
}

// ========================================
// وظائف الفلترة والترتيب
// ========================================

function calculateAverageProfit(results) {
    // حساب المتوسط بناءً على نوع التحليل الحالي
    if (currentAnalysisType === 'percentage') {
        let totalProfitMargin = 0;
        let totalUnits = 0;
        
        results.forEach(result => {
            Object.values(result.units || {}).forEach(unitData => {
                totalProfitMargin += unitData.profitMargin || 0;
                totalUnits++;
            });
        });
        
        averageProfit = totalUnits > 0 ? totalProfitMargin / totalUnits : 0;
    } else if (currentAnalysisType === 'fixed') {
        let totalProfit = 0;
        let totalUnits = 0;
        
        results.forEach(result => {
            Object.values(result.units || {}).forEach(unitData => {
                totalProfit += unitData.profit || 0;
                totalUnits++;
            });
        });
        
        averageProfit = totalUnits > 0 ? totalProfit / totalUnits : 0;
    } else {
        // للعرض الكامل، استخدم القيمة المدخلة أو المتوسط
        averageProfit = currentAnalysisValue || 0;
    }
}

function setupTableFilters() {
    const tableSearch = document.getElementById('tableSearch');
    const profitComparisonFilter = document.getElementById('profitComparisonFilter');
    const tableSortBy = document.getElementById('tableSortBy');
    const sortDirectionBtn = document.getElementById('sortDirectionBtn');
    const printTableBtn = document.getElementById('printTableBtn');
    
    // إزالة المستمعين السابقين لتجنب التكرار
    if (tableSearch) {
        tableSearch.removeEventListener('input', handleTableSearch);
        tableSearch.addEventListener('input', handleTableSearch);
    }
    
    if (profitComparisonFilter) {
        profitComparisonFilter.removeEventListener('change', handleProfitFilter);
        profitComparisonFilter.addEventListener('change', handleProfitFilter);
    }
    
    if (tableSortBy) {
        tableSortBy.removeEventListener('change', handleSortChange);
        tableSortBy.addEventListener('change', handleSortChange);
    }
    
    if (sortDirectionBtn) {
        sortDirectionBtn.removeEventListener('click', toggleSortDirection);
        sortDirectionBtn.addEventListener('click', toggleSortDirection);
    }
    
    if (printTableBtn) {
        printTableBtn.removeEventListener('click', printTable);
        printTableBtn.addEventListener('click', printTable);
    }
}

function handleTableSearch() {
    applyTableFilters();
}

function handleProfitFilter() {
    applyTableFilters();
}

function handleSortChange() {
    const tableSortBy = document.getElementById('tableSortBy');
    if (tableSortBy) {
        sortColumn = tableSortBy.value;
        applyTableFilters();
    }
}

function toggleSortDirection() {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    const sortDirectionBtn = document.getElementById('sortDirectionBtn');
    if (sortDirectionBtn) {
        const icon = sortDirectionBtn.querySelector('i');
        if (icon) {
            icon.className = sortDirection === 'asc' ? 'fas fa-sort-amount-down' : 'fas fa-sort-amount-up';
        }
        sortDirectionBtn.classList.toggle('desc', sortDirection === 'desc');
    }
    applyTableFilters();
}

function applyTableFilters() {
    if (!currentTableData || currentTableData.length === 0) return;
    
    const searchTerm = document.getElementById('tableSearch')?.value.toLowerCase() || '';
    const profitFilter = document.getElementById('profitComparisonFilter')?.value || 'all';
    
    let filteredData = [...currentTableData];
    
    // تطبيق فلتر البحث
    if (searchTerm) {
        filteredData = filteredData.filter(result => 
            result.name.toLowerCase().includes(searchTerm) ||
            (result.productType && result.productType.toLowerCase().includes(searchTerm))
        );
    }
    
    // تطبيق فلتر مقارنة الربح بناءً على نوع التحليل والقيمة المدخلة
    if (profitFilter !== 'all') {
        const referenceValue = currentAnalysisValue;
        const tolerance = currentAnalysisType === 'percentage' ? 0.5 : 0.01; // هامش تسامح أصغر للقيم الثابتة
        
        filteredData = filteredData.filter(result => {
            // البحث عن الوحدة الصغرى (less) فقط
            const lessUnit = result.units && result.units.less;
            
            if (!lessUnit) {
                // إذا لم توجد وحدة فرعية، لا تظهر هذا المنتج في النتائج المفلترة
                console.log(`المنتج ${result.name}: لا توجد وحدة صغرى`);
                return false;
            }
            
            let comparisonValue;
            
            if (currentAnalysisType === 'percentage') {
                comparisonValue = lessUnit.profitMargin || 0;
            } else if (currentAnalysisType === 'fixed') {
                comparisonValue = lessUnit.profit || 0;
            } else {
                comparisonValue = lessUnit.profitMargin || 0;
            }
            
            console.log(`فلترة المنتج: ${result.name}, نوع التحليل: ${currentAnalysisType}, قيمة المقارنة: ${comparisonValue}, القيمة المرجعية: ${referenceValue}, نوع الفلتر: ${profitFilter}, هامش التسامح: ${tolerance}`);
            
            switch (profitFilter) {
                case 'equal':
                    const isEqual = Math.abs(comparisonValue - referenceValue) <= tolerance;
                    console.log(`مطابق: ${isEqual} (الفرق: ${Math.abs(comparisonValue - referenceValue)})`);
                    return isEqual;
                case 'below':
                    const isBelow = comparisonValue < referenceValue;
                    console.log(`أقل: ${isBelow} (${comparisonValue} < ${referenceValue})`);
                    return isBelow;
                case 'above':
                    const isAbove = comparisonValue > referenceValue;
                    console.log(`أعلى: ${isAbove} (${comparisonValue} > ${referenceValue})`);
                    return isAbove;
                default:
                    return true;
            }
        });
    }
    
    // تطبيق الترتيب
    filteredData.sort((a, b) => {
        let valueA, valueB;
        
        switch (sortColumn) {
            case 'name':
                valueA = a.name.toLowerCase();
                valueB = b.name.toLowerCase();
                break;
            case 'profit':
                // ترتيب حسب نوع التحليل
                if (currentAnalysisType === 'percentage') {
                    valueA = getMaxUnitValue(a, 'profitMargin');
                    valueB = getMaxUnitValue(b, 'profitMargin');
                } else if (currentAnalysisType === 'fixed') {
                    valueA = getMaxUnitValue(a, 'profit');
                    valueB = getMaxUnitValue(b, 'profit');
                } else {
                    valueA = getMaxUnitValue(a, 'profitMargin');
                    valueB = getMaxUnitValue(b, 'profitMargin');
                }
                break;
            case 'cost':
                valueA = getMaxUnitValue(a, 'averageCost');
                valueB = getMaxUnitValue(b, 'averageCost');
                break;
            case 'price':
                valueA = getMaxUnitValue(a, 'averagePrice');
                valueB = getMaxUnitValue(b, 'averagePrice');
                break;
            default:
                valueA = a.name.toLowerCase();
                valueB = b.name.toLowerCase();
        }
        
        if (typeof valueA === 'string') {
            return sortDirection === 'asc' ? 
                valueA.localeCompare(valueB, 'ar') : 
                valueB.localeCompare(valueA, 'ar');
        } else {
            return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
        }
    });
    
    // إعادة عرض الجدول
    displayFilteredTable(filteredData);
}

function getMaxUnitValue(result, property) {
    const units = Object.values(result.units || {});
    if (units.length === 0) return 0;
    
    return Math.max(...units.map(unit => unit[property] || 0));
}

function displayFilteredTable(results) {
    const tableContent = document.getElementById('tableContent');
    if (!tableContent || !results || results.length === 0) {
        showNoResults();
        return;
    }
    
    // تحديث البيانات الحالية للطباعة
    currentTableData = results;
    
    const getUnitComparisonStatus = (unitData) => {
        if (currentAnalysisType === 'show-all') return 'none';
        
        if (currentAnalysisType === 'percentage' && currentAnalysisValue > 0) {
            return unitData.profitMargin > currentAnalysisValue ? 'higher' : 
                   unitData.profitMargin < currentAnalysisValue ? 'lower' : 'equal';
        } else if (currentAnalysisType === 'fixed' && currentAnalysisValue > 0) {
            return unitData.profit > currentAnalysisValue ? 'higher' : 
                   unitData.profit < currentAnalysisValue ? 'lower' : 'equal';
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

    const tableHeaders = currentAnalysisType !== 'show-all' 
        ? `<th class="product-name-cell">اسم المنتج</th><th>نوع الوحدة</th><th class="product-type-cell">نوع المنتج</th><th>التكلفة</th><th>السعر</th><th>الربح</th><th>هامش الربح</th><th>المقارنة</th>`
        : `<th class="product-name-cell">اسم المنتج</th><th>نوع الوحدة</th><th class="product-type-cell">نوع المنتج</th><th>التكلفة</th><th>السعر</th><th>الربح</th><th>هامش الربح</th>`;

    let tableRows = '';
    
    results.forEach(result => {
        const units = Object.entries(result.units || {});
        const unitsCount = units.length;
        
        if (unitsCount === 0) {
            tableRows += `
                <tr>
                    <td class="product-name-cell"><strong>${result.name}</strong></td>
                    <td colspan="${currentAnalysisType !== 'show-all' ? '7' : '6'}" class="text-center">لا توجد وحدات</td>
                </tr>
            `;
        } else {
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
                        ${currentAnalysisType !== 'show-all' ? `<td class="text-center">${getUnitComparisonIcon(unitData)}</td>` : ''}
                    </tr>
                `;
            });
        }
    });

    const tableHTML = `
        <div class="table-responsive">
            <table class="data-table" id="printableTable">
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
    
    // تطبيق التلوين على الوحدات الصغرى
    applySmallUnitColoring();
    
    // تحديث حالة زر الطباعة
    updatePrintButtonState(true);
}

// دالة لتطبيق التلوين على الوحدات الصغرى في الجدول الأساسي
function applySmallUnitColoring() {
    if (currentAnalysisType === 'show-all' || !currentAnalysisValue) return;
    
    const table = document.getElementById('printableTable');
    if (!table) return;
    
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach((row, index) => {
        const profitCell = row.querySelector('td:nth-child(7)'); // عمود هامش الربح
        const profitValueCell = row.querySelector('td:nth-child(6)'); // عمود قيمة الربح
        
        if (profitCell && currentAnalysisValue !== null && currentAnalysisValue !== undefined) {
            // التحقق من نوع الوحدة
            const unitCell = row.querySelector('td:nth-child(2)'); // عمود نوع الوحدة
            const unitBadge = unitCell ? unitCell.querySelector('.unit-badge') : null;
            let unitType = 'base'; // افتراضي
            
            if (unitBadge) {
                if (unitBadge.classList.contains('unit-less')) {
                    unitType = 'less';
                } else if (unitBadge.classList.contains('unit-more')) {
                    unitType = 'more';
                } else if (unitBadge.classList.contains('unit-base')) {
                    unitType = 'base';
                }
            }
            
            // تطبيق التلوين فقط على الوحدات الصغرى
            if (unitType === 'less') {
                let comparisonValue;
                
                // تحديد القيمة للمقارنة حسب نوع التحليل
                if (currentAnalysisType === 'percentage') {
                    // للنسب المئوية، استخدم هامش الربح
                    const profitText = profitCell.textContent.trim();
                    comparisonValue = parseFloat(profitText.replace(/[%\s]/g, ''));
                } else if (currentAnalysisType === 'fixed') {
                    // للقيم الثابتة، استخدم قيمة الربح
                    const profitValueText = profitValueCell ? profitValueCell.textContent.trim() : '0';
                    comparisonValue = parseFloat(profitValueText.replace(/[$\s]/g, ''));
                }
                
                if (!isNaN(comparisonValue)) {
                    const tolerance = currentAnalysisType === 'percentage' ? 0.5 : 0.01;
                    const difference = Math.abs(comparisonValue - currentAnalysisValue);
                    
                    let colorStyle, bgStyle, cssClass;
                    
                    if (difference <= tolerance) {
                        // مساوي للمعدل - أصفر
                        colorStyle = '#856404';
                        bgStyle = '#fff3cd';
                        cssClass = 'small-unit-equal';
                        console.log(`صف ${index + 1}: وحدة صغرى مساوية للمعدل (الفرق: ${difference.toFixed(3)})`);
                    } else if (comparisonValue < currentAnalysisValue) {
                        // أقل من المعدل - أحمر
                        colorStyle = '#721c24';
                        bgStyle = '#f8d7da';
                        cssClass = 'small-unit-below';
                        console.log(`صف ${index + 1}: وحدة صغرى أقل من المعدل (الفرق: ${difference.toFixed(3)})`);
                    } else {
                        // أعلى من المعدل - أخضر
                        colorStyle = '#155724';
                        bgStyle = '#d4edda';
                        cssClass = 'small-unit-above';
                        console.log(`صف ${index + 1}: وحدة صغرى أعلى من المعدل (الفرق: ${difference.toFixed(3)})`);
                    }
                    
                    // تطبيق التلوين على عمود هامش الربح
                    profitCell.style.color = colorStyle + ' !important';
                    profitCell.style.fontWeight = 'bold';
                    profitCell.style.backgroundColor = bgStyle;
                    profitCell.style.border = '1px solid #ddd';
                    
                    // تطبيق التلوين على عمود قيمة الربح أيضاً
                    if (profitValueCell) {
                        profitValueCell.style.color = colorStyle + ' !important';
                        profitValueCell.style.fontWeight = 'bold';
                        profitValueCell.style.backgroundColor = bgStyle;
                        profitValueCell.style.border = '1px solid #ddd';
                    }
                    
                    // تطبيق التلوين على شارة الوحدة
                    if (unitBadge) {
                        unitBadge.style.borderLeft = `4px solid ${colorStyle}`;
                        unitBadge.style.boxShadow = `0 0 5px ${colorStyle}40`;
                        unitBadge.style.fontWeight = 'bold';
                    }
                    
                    // إضافة فئة CSS للوحدة الصغرى
                    row.classList.add('small-unit-highlight', cssClass);
                    
                    // تطبيق تلوين خفيف على الصف كاملاً
                    row.style.borderLeft = `3px solid ${colorStyle}`;
                    row.style.backgroundColor = bgStyle + '20'; // خلفية شفافة
                }
            } else if (unitType !== 'less') {
                console.log(`صف ${index + 1}: تم تجاهل الوحدة ${unitType} - التلوين مخصص للوحدات الصغرى فقط`);
            }
        }
    });
}

function printTable() {
    // التحقق من وجود بيانات للطباعة
    if (!currentTableData || currentTableData.length === 0) {
        alert('لا توجد بيانات للطباعة. يرجى تشغيل التحليل أولاً.');
        return;
    }
    
    const printableTable = document.getElementById('printableTable');
    if (!printableTable) {
        alert('لا توجد بيانات للطباعة. يرجى تشغيل التحليل أولاً.');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    const currentDate = new Date().toLocaleDateString('en-GB'); // التاريخ الميلادي
    
    // إنشاء نسخة من الجدول مع تلوين النسب
    const tableClone = printableTable.cloneNode(true);
    const rows = tableClone.querySelectorAll('tbody tr');
    
    rows.forEach((row, index) => {
        // إضافة خلفية متناوبة للصفوف
        if (index % 2 === 0) {
            row.style.backgroundColor = '#f8f9fa';
        } else {
            row.style.backgroundColor = '#ffffff';
        }
        
        // تلوين النسب حسب المقارنة مع قيمة التحليل - للوحدات الصغرى فقط
        const profitCell = row.querySelector('td:nth-child(7)'); // عمود هامش الربح
        const profitValueCell = row.querySelector('td:nth-child(6)'); // عمود قيمة الربح
        
        if (profitCell && currentAnalysisValue !== null && currentAnalysisValue !== undefined) {
            // التحقق من نوع الوحدة
            const unitCell = row.querySelector('td:nth-child(2)'); // عمود نوع الوحدة
            const unitBadge = unitCell ? unitCell.querySelector('.unit-badge') : null;
            let unitType = 'base'; // افتراضي
            
            if (unitBadge) {
                if (unitBadge.classList.contains('unit-less')) {
                    unitType = 'less';
                } else if (unitBadge.classList.contains('unit-more')) {
                    unitType = 'more';
                } else if (unitBadge.classList.contains('unit-base')) {
                    unitType = 'base';
                }
            }
            
            // تطبيق التلوين فقط على الوحدات الصغرى
            if (unitType === 'less') {
                let comparisonValue;
                
                // تحديد القيمة للمقارنة حسب نوع التحليل
                if (currentAnalysisType === 'percentage') {
                    // للنسب المئوية، استخدم هامش الربح
                    const profitText = profitCell.textContent.trim();
                    comparisonValue = parseFloat(profitText.replace(/[%\s]/g, ''));
                } else if (currentAnalysisType === 'fixed') {
                    // للقيم الثابتة، استخدم قيمة الربح
                    const profitText = profitValueCell ? profitValueCell.textContent.trim() : '';
                    comparisonValue = parseFloat(profitText.replace(/[$\s]/g, ''));
                }
                
                console.log(`صف ${index + 1}: نوع الوحدة = ${unitType}, نوع التحليل = ${currentAnalysisType}, قيمة المقارنة = ${comparisonValue}, قيمة التحليل = ${currentAnalysisValue}`);
                
                if (!isNaN(comparisonValue)) {
                    // تحديد نطاق التسامح حسب نوع التحليل
                    const tolerance = currentAnalysisType === 'percentage' ? 0.5 : 0.01;
                    const difference = Math.abs(comparisonValue - currentAnalysisValue);
                    
                    let colorStyle = '';
                    let bgStyle = '';
                    let cssClass = '';
                    
                    if (difference <= tolerance) {
                        // مطابق للمعدل - أزرق
                        colorStyle = '#007bff';
                        bgStyle = '#e3f2fd';
                        cssClass = 'small-unit-equal';
                        console.log(`صف ${index + 1}: وحدة صغرى مطابقة للمعدل (الفرق: ${difference.toFixed(3)})`);
                    } else if (comparisonValue < currentAnalysisValue) {
                        // أقل من المعدل - أحمر
                        colorStyle = '#dc3545';
                        bgStyle = '#ffebee';
                        cssClass = 'small-unit-below';
                        console.log(`صف ${index + 1}: وحدة صغرى أقل من المعدل (الفرق: ${difference.toFixed(3)})`);
                    } else {
                        // أعلى من المعدل - أخضر
                        colorStyle = '#28a745';
                        bgStyle = '#e8f5e8';
                        cssClass = 'small-unit-above';
                        console.log(`صف ${index + 1}: وحدة صغرى أعلى من المعدل (الفرق: ${difference.toFixed(3)})`);
                    }
                    
                    // تطبيق التلوين على عمود هامش الربح
                    profitCell.style.color = colorStyle + ' !important';
                    profitCell.style.fontWeight = 'bold';
                    profitCell.style.backgroundColor = bgStyle;
                    profitCell.style.border = '1px solid #ddd';
                    
                    // تطبيق التلوين على عمود قيمة الربح أيضاً
                    if (profitValueCell) {
                        profitValueCell.style.color = colorStyle + ' !important';
                        profitValueCell.style.fontWeight = 'bold';
                        profitValueCell.style.backgroundColor = bgStyle;
                        profitValueCell.style.border = '1px solid #ddd';
                    }
                    
                    // تطبيق التلوين على شارة الوحدة
                    if (unitBadge) {
                        unitBadge.style.borderLeft = `4px solid ${colorStyle}`;
                        unitBadge.style.boxShadow = `0 0 5px ${colorStyle}40`;
                        unitBadge.style.fontWeight = 'bold';
                    }
                    
                    // إضافة فئة CSS للوحدة الصغرى
                    row.classList.add('small-unit-highlight', cssClass);
                    
                    // تطبيق تلوين خفيف على الصف كاملاً
                    row.style.borderLeft = `3px solid ${colorStyle}`;
                    row.style.backgroundColor = bgStyle + '20'; // خلفية شفافة
                }
            } else if (unitType !== 'less') {
                console.log(`صف ${index + 1}: تم تجاهل الوحدة ${unitType} - التلوين مخصص للوحدات الصغرى فقط`);
            }
        }
    });
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>تدقيق أسعار المواد - ${currentDate}</title>
            <style>
                body {
                    font-family: 'Cairo', Arial, sans-serif;
                    direction: rtl;
                    margin: 20px;
                    color: #333;
                }
                .print-header {
                    text-align: center;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #333;
                    padding-bottom: 15px;
                }
                .print-header h1 {
                    color: #2c3e50;
                    margin-bottom: 10px;
                    font-size: 24px;
                }
                .header-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 10px;
                }
                .header-left, .header-right {
                    flex: 1;
                    text-align: center;
                }
                .header-info p {
                    color: #666;
                    margin: 3px 0;
                    font-size: 14px;
                    font-weight: bold;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    font-size: 11px;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 6px;
                    text-align: center;
                }
                th {
                    background-color: #2c3e50;
                    color: white;
                    font-weight: bold;
                    font-size: 12px;
                }
                .unit-badge {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 0.8em;
                    font-weight: bold;
                    margin: 1px;
                }
                .unit-base { background-color: #007bff; color: white; }
                .unit-more { background-color: #28a745; color: white; }
                .unit-less { 
                    background-color: #ffc107 !important; 
                    color: black !important;
                    box-shadow: 0 2px 4px rgba(255, 193, 7, 0.3) !important;
                    border: 1px solid #e0a800 !important;
                }
                
                /* تمييز خاص للوحدات الصغرى */
                .small-unit-highlight {
                    background-color: #fff8e1 !important;
                    border-left: 3px solid #ffc107 !important;
                }
                
                .small-unit-profit {
                    font-weight: bold !important;
                    font-size: 1.1em !important;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.1) !important;
                }
                
                /* ألوان التحليل للوحدات الصغرى */
                .small-unit-above {
                    background-color: #e8f5e8 !important;
                    color: #28a745 !important;
                    border-left: 4px solid #28a745 !important;
                }
                
                .small-unit-equal {
                    background-color: #e3f2fd !important;
                    color: #007bff !important;
                    border-left: 4px solid #007bff !important;
                }
                
                .small-unit-below {
                    background-color: #ffebee !important;
                    color: #dc3545 !important;
                    border-left: 4px solid #dc3545 !important;
                }
                .print-footer {
                    margin-top: 20px;
                    text-align: center;
                    font-size: 10px;
                    color: #666;
                    border-top: 1px solid #ddd;
                    padding-top: 10px;
                }
                .legend {
                    margin-top: 15px;
                    font-size: 10px;
                    text-align: center;
                    color: #666;
                }
                .legend span {
                    margin: 0 10px;
                    font-weight: bold;
                }
                .legend .above { color: #28a745; }
                .legend .equal { color: #007bff; }
                .legend .below { color: #dc3545; }
                @media print {
                    body { margin: 0; }
                    .print-header { page-break-after: avoid; }
                    /* ضمان ظهور الألوان في الطباعة */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>📊 تدقيق أسعار المواد</h1>
                <div class="header-info">
                    <div class="header-right">
                        <p>تاريخ التقرير: ${currentDate}</p>
                        <p>متوسط الربح: ${averageProfit.toFixed(1)}%</p>
                    </div>
                    <div class="header-left">
                        <p>نوع التحليل: ${currentAnalysisType === 'percentage' ? 'نسبة مئوية' : currentAnalysisType === 'fixed' ? 'مبلغ ثابت' : 'عرض الكل'}</p>
                        ${currentAnalysisType !== 'show-all' ? `<p>قيمة التحليل: ${currentAnalysisValue}${currentAnalysisType === 'percentage' ? '%' : '$'}</p>` : ''}
                    </div>
                </div>
            </div>
            ${tableClone.outerHTML}
            <div class="legend">
                <span class="above">■ أعلى من المعدل</span>
                <span class="equal">■ مطابق للمعدل</span>
                <span class="below">■ أقل من المعدل</span>
            </div>
            <div class="print-footer">
                <p>تم إنشاء هذا التقرير بواسطة نظام إدارة الأسعار</p>
            </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
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
    // إعداد حالة زر الطباعة الأولية
    updatePrintButtonState(false);
    
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
        
        /* تمييز خاص للوحدات الصغرى */
        .small-unit-highlight {
            background-color: #fff8e1 !important;
            border-left: 3px solid #ffc107 !important;
        }
        
        .small-unit-profit {
            font-weight: bold !important;
            font-size: 1.1em !important;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.1) !important;
        }
        
        .unit-less {
            background-color: #ffc107 !important;
            color: black !important;
            box-shadow: 0 2px 4px rgba(255, 193, 7, 0.3) !important;
            border: 1px solid #e0a800 !important;
        }
        
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