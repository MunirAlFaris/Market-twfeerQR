// Global variables
let productsData = [];
let filteredResults = [];
let currentSearchTerm = '';

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    loadProductsData();
    setupEventListeners();
});

// Load products data from JSON file
async function loadProductsData() {
    try {
        const response = await fetch('products.json');
        const jsonData = await response.json();
        
        // Extract the actual products array from the JSON structure
        const queryKey = Object.keys(jsonData)[0]; // Get the first (and only) key
        productsData = jsonData[queryKey] || [];
        
        populateCategories();
        console.log('Products data loaded successfully:', productsData.length, 'products');
    } catch (error) {
        console.error('Error loading products data:', error);
        showError('خطأ في تحميل بيانات المنتجات');
    }
}

// Populate categories dropdown
function populateCategories() {
    const categorySelect = document.getElementById('categorySelect');
    const categories = new Set();
    
    // Extract unique categories from products
    productsData.forEach(product => {
        if (product.CATEGORY_AR) {
            categories.add(product.CATEGORY_AR);
        }
    });
    
    // Sort categories alphabetically
    const sortedCategories = Array.from(categories).sort();
    
    // Add categories to dropdown
    sortedCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Search button click
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // Auto-calculate difference when actual quantity changes
    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('actual-quantity')) {
            calculateDifference(e.target);
        }
    });
}

// Perform search based on category and search term
function performSearch() {
    const category = document.getElementById('categorySelect').value;
    const searchTerm = document.getElementById('searchInput').value.trim();
    const sortOption = document.getElementById('sortSelect').value;
    
    // Show loading indicator
    showLoading();
    
    // Store current search term for printing
    currentSearchTerm = searchTerm || 'جميع المنتجات';
    
    // Filter products
    setTimeout(() => {
        filteredResults = filterProducts(category, searchTerm);
        
        // Sort results
        sortResults(filteredResults, sortOption);
        
        // Display results
        displayResults(filteredResults);
        
        // Update stats
        updateStats(filteredResults, currentSearchTerm);
        
        // Enable print button if there are results
        document.getElementById('printBtn').disabled = filteredResults.length === 0;
        
        hideLoading();
    }, 500);
}

// Filter products based on category and search term
function filterProducts(category, searchTerm) {
    const results = [];
    
    productsData.forEach((product, index) => {
        let matches = true;
        
        // Filter by category
        if (category && product.CATEGORY_AR !== category) {
            matches = false;
        }
        
        // Filter by search term (search in product name)
        if (searchTerm && product.ITEM_NAME_AR && !product.ITEM_NAME_AR.toLowerCase().includes(searchTerm.toLowerCase())) {
            matches = false;
        }
        
        if (matches) {
            // Add index to the original product data for reference
            const productWithIndex = { ...product, originalIndex: index };
            results.push(productWithIndex);
        }
    });
    
    return results;
}

// Sort results based on selected option
function sortResults(results, sortOption) {
    switch (sortOption) {
        case 'name_asc':
            results.sort((a, b) => {
                const nameA = a.ITEM_NAME_AR || '';
                const nameB = b.ITEM_NAME_AR || '';
                return nameA.localeCompare(nameB, 'ar');
            });
            break;
        case 'name_desc':
            results.sort((a, b) => {
                const nameA = a.ITEM_NAME_AR || '';
                const nameB = b.ITEM_NAME_AR || '';
                return nameB.localeCompare(nameA, 'ar');
            });
            break;
        case 'quantity_asc':
            results.sort((a, b) => (a.LESS_QTY || 0) - (b.LESS_QTY || 0));
            break;
        case 'quantity_desc':
            results.sort((a, b) => (b.LESS_QTY || 0) - (a.LESS_QTY || 0));
            break;
    }
}

// Display search results in table
function displayResults(results) {
    const tableBody = document.getElementById('resultsTableBody');
    const statsSection = document.getElementById('statsSection');
    const resultsSection = document.getElementById('resultsSection');
    
    if (results.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center">لا توجد نتائج</td></tr>';
        statsSection.style.display = 'none';
        resultsSection.style.display = 'block';
        return;
    }
    
    let html = '';
    results.forEach((product, index) => {
        // Use LESS_QTY as available quantity
        const availableQty = product.LESS_QTY || 0;
        
        // Get actual quantity from product data or default to empty
        const actualQty = product.actualQuantity || '';
        
        html += `
            <tr>
                <td>${product.ITEM_NAME_AR || 'غير محدد'}</td>
                <td>${availableQty}</td>
                <td></td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
    statsSection.style.display = 'block';
    resultsSection.style.display = 'block';
    
    updateStats(results);
}

// Calculate difference between available and actual quantity
function calculateDifference(input) {
    const index = input.dataset.index;
    const actualQuantity = parseFloat(input.value) || 0;
    const availableQuantity = filteredResults[index].availableQuantity;
    const difference = actualQuantity - availableQuantity;
    
    // Update the filtered results
    filteredResults[index].actualQuantity = actualQuantity;
    filteredResults[index].difference = difference;
    
    // Update the display
    const differenceDisplay = document.querySelector(`[data-index="${index}"].difference-display`);
    if (difference === 0) {
        differenceDisplay.innerHTML = '<span class="badge bg-success">متطابق</span>';
    } else if (difference > 0) {
        differenceDisplay.innerHTML = `<span class="badge bg-warning">+${difference}</span>`;
    } else {
        differenceDisplay.innerHTML = `<span class="badge bg-danger">${difference}</span>`;
    }
}

// Update statistics
function updateStats(results) {
    const totalProducts = document.getElementById('totalProducts');
    const totalQuantity = document.getElementById('totalQuantity');
    const searchTermDisplay = document.getElementById('searchTerm');
    
    // Calculate total available quantity
    const totalAvailableQuantity = results.reduce((sum, product) => {
        return sum + (parseFloat(product.LESS_QTY) || 0);
    }, 0);
    
    // Update displays
    if (totalProducts) totalProducts.textContent = results.length;
    if (totalQuantity) totalQuantity.textContent = totalAvailableQuantity.toFixed(1);
    if (searchTermDisplay) searchTermDisplay.textContent = currentSearchTerm || 'جميع المنتجات';
}

// Update actual quantity for a product
function updateActualQuantity(index, value) {
    if (!filteredResults[index]) return;
    
    const actualQuantity = parseFloat(value) || 0;
    filteredResults[index].actualQuantity = actualQuantity;
    
    // Enable print button if there are results
    const printBtn = document.getElementById('printBtn');
    if (printBtn && filteredResults.length > 0) {
        printBtn.disabled = false;
    }
}



// Print inventory report
function printInventory() {
    if (filteredResults.length === 0) {
        alert('لا توجد بيانات للطباعة');
        return;
    }
    
    const searchTerm = currentSearchTerm || 'جميع المنتجات';
    const currentDate = new Date().toLocaleDateString('ar-SA');
    
    let printContent = `
        <html>
        <head>
            <title>تقرير الجرد - ${searchTerm}</title>
            <style>
                body { 
                    font-family: 'Cairo', Arial, sans-serif; 
                    direction: rtl; 
                    margin: 20px;
                    font-size: 14px;
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 30px; 
                    border-bottom: 2px solid #333;
                    padding-bottom: 20px;
                }
                .header h1 { 
                    color: #2c3e50; 
                    margin: 0;
                    font-size: 24px;
                }
                .header p { 
                    margin: 5px 0; 
                    color: #666;
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin: 20px 0;
                    font-size: 12px;
                }
                th, td { 
                    border: 1px solid #ddd; 
                    padding: 12px; 
                    text-align: center;
                }
                th { 
                    background-color: #667eea; 
                    color: white;
                    font-weight: bold;
                }
                tr:nth-child(odd) { 
                    background-color: #ffffff; 
                }
                tr:nth-child(even) { 
                    background-color: #f5f5f5; 
                }
                td:first-child {
                    text-align: right;
                    font-weight: 500;
                }
                .summary { 
                    margin-top: 30px; 
                    padding: 15px; 
                    background-color: #f8f9fa; 
                    border-radius: 5px;
                }
                .summary h3 { 
                    margin-top: 0; 
                    color: #2c3e50;
                }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>تقرير الجرد - ${searchTerm}</h1>
                <p>تاريخ التقرير: ${currentDate}</p>
                <p>عدد المنتجات: ${filteredResults.length}</p>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th style="width: 60%;">اسم المنتج</th>
                        <th style="width: 20%;">الكمية المتاحة</th>
                        <th style="width: 20%;">الكمية الفعلية</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    let totalAvailable = 0;
    let totalActual = 0;
    
    filteredResults.forEach(product => {
         const actualQty = product.actualQuantity || 0;
         const availableQty = product.LESS_QTY || 0;
         
         totalAvailable += availableQty;
         totalActual += parseFloat(actualQty) || 0;
         
         printContent += `
             <tr>
                 <td>${product.ITEM_NAME_AR || 'غير محدد'}</td>
                 <td>${availableQty}</td>
                 <td>${actualQty || ''}</td>
             </tr>
         `;
     });
    
    printContent += `
                </tbody>
            </table>
            
            <div class="summary">
                <h3>ملخص التقرير</h3>
                <p><strong>إجمالي الكمية المتاحة:</strong> ${totalAvailable}</p>
                <p><strong>إجمالي الكمية الفعلية:</strong> ${totalActual}</p>
                <p><strong>تاريخ الطباعة:</strong> ${new Date().toLocaleString('ar-SA')}</p>
            </div>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

// Update notes from input fields
function updateNotesFromInputs() {
    const notesInputs = document.querySelectorAll('.notes-input');
    notesInputs.forEach(input => {
        const index = input.dataset.index;
        filteredResults[index].notes = input.value;
    });
}

// Generate print content
function generatePrintContent() {
    const currentDate = new Date().toLocaleDateString('ar-SA');
    const totalProducts = filteredResults.length;
    const totalAvailableQuantity = filteredResults.reduce((sum, product) => sum + product.availableQuantity, 0);
    const totalActualQuantity = filteredResults.reduce((sum, product) => sum + (product.actualQuantity || 0), 0);
    const totalDifference = totalActualQuantity - totalAvailableQuantity;
    
    let tableRows = '';
    filteredResults.forEach((product, index) => {
        const actualQty = product.actualQuantity || '-';
        const difference = product.difference !== '' ? product.difference : '-';
        const notes = product.notes || '-';
        
        let differenceClass = '';
        let differenceText = difference;
        
        if (typeof difference === 'number') {
            if (difference === 0) {
                differenceClass = 'text-success';
                differenceText = 'متطابق';
            } else if (difference > 0) {
                differenceClass = 'text-warning';
                differenceText = `+${difference}`;
            } else {
                differenceClass = 'text-danger';
                differenceText = difference;
            }
        }
        
        tableRows += `
            <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 8px; text-align: center;">${index + 1}</td>
                <td style="padding: 8px; text-align: right;">${product.name}</td>
                <td style="padding: 8px; text-align: center;">${product.availableQuantity}</td>
                <td style="padding: 8px; text-align: center;">${actualQty}</td>
                <td style="padding: 8px; text-align: center;" class="${differenceClass}">${differenceText}</td>
                <td style="padding: 8px; text-align: center;">${notes}</td>
            </tr>
        `;
    });
    
    return `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>جرد ${currentSearchTerm}</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 20px;
                    direction: rtl;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #333;
                    padding-bottom: 20px;
                }
                .header h1 {
                    color: #333;
                    margin-bottom: 10px;
                }
                .report-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 5px;
                }
                .info-item {
                    text-align: center;
                }
                .info-label {
                    font-weight: bold;
                    color: #666;
                    font-size: 14px;
                }
                .info-value {
                    font-size: 18px;
                    color: #333;
                    margin-top: 5px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                th {
                    background: #333;
                    color: white;
                    padding: 12px 8px;
                    text-align: center;
                    font-weight: bold;
                }
                td {
                    padding: 8px;
                    text-align: center;
                    border-bottom: 1px solid #ddd;
                }
                tr:nth-child(even) {
                    background-color: #f8f9fa;
                }
                .text-success { color: #28a745; }
                .text-warning { color: #ffc107; }
                .text-danger { color: #dc3545; }
                .summary {
                    background: #e9ecef;
                    padding: 15px;
                    border-radius: 5px;
                    margin-top: 20px;
                }
                .summary-title {
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: #333;
                }
                .summary-item {
                    margin: 5px 0;
                }
                @media print {
                    body { margin: 0; }
                    .header { page-break-after: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>جرد ${currentSearchTerm}</h1>
                <p>تاريخ الجرد: ${currentDate}</p>
            </div>
            
            <div class="report-info">
                <div class="info-item">
                    <div class="info-label">عدد المنتجات</div>
                    <div class="info-value">${totalProducts}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">الكمية المتوفرة</div>
                    <div class="info-value">${totalAvailableQuantity.toFixed(1)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">الكمية الفعلية</div>
                    <div class="info-value">${totalActualQuantity.toFixed(1)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">الفرق الإجمالي</div>
                    <div class="info-value ${totalDifference >= 0 ? 'text-success' : 'text-danger'}">${totalDifference.toFixed(1)}</div>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th width="5%">#</th>
                        <th width="40%">اسم المنتج</th>
                        <th width="15%">الكمية المتوفرة</th>
                        <th width="15%">الكمية الفعلية</th>
                        <th width="15%">الفرق</th>
                        <th width="10%">ملاحظات</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            
            <div class="summary">
                <div class="summary-title">ملخص الجرد:</div>
                <div class="summary-item">• إجمالي المنتجات المجردة: ${totalProducts} منتج</div>
                <div class="summary-item">• إجمالي الكمية المتوفرة في النظام: ${totalAvailableQuantity.toFixed(1)}</div>
                <div class="summary-item">• إجمالي الكمية الفعلية: ${totalActualQuantity.toFixed(1)}</div>
                <div class="summary-item">• الفرق الإجمالي: ${totalDifference.toFixed(1)} ${totalDifference >= 0 ? '(زيادة)' : '(نقص)'}</div>
            </div>
        </body>
        </html>
    `;
}

// Show loading indicator
function showLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const resultsSection = document.getElementById('resultsSection');
    const statsSection = document.getElementById('statsSection');
    
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (resultsSection) resultsSection.style.display = 'none';
    if (statsSection) statsSection.style.display = 'none';
}

// Hide loading indicator
function hideLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
}

// Show error message
function showError(message) {
    const errorText = document.getElementById('errorText');
    const errorMessage = document.getElementById('errorMessage');
    
    if (errorText) errorText.textContent = message;
    if (errorMessage) errorMessage.style.display = 'block';
    else alert(message);
}