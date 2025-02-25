var chartSummary, productPieChart, paymentPieChart, branchGrowthChart;
// Simpan data sheet secara global untuk keperluan filter growth table
var globalDsData = [];

// Fungsi untuk mengubah angka dalam format akuntansi (misal "(5,383,209)") ke format angka standar
function parseAccountingNumber(numStr) {
  numStr = numStr.trim();
  if (numStr.startsWith('(') && numStr.endsWith(')')) {
    return -parseFloat(numStr.replace(/[(),]/g, ''));
  } else {
    return parseFloat(numStr.replace(/,/g, ''));
  }
}

// Update Summary Cards & Pie Charts
function updateSummaryCards(aggregated, targets, dsData, filterBulan) {
  var totalActual = 0, totalMargin = 0, totalSisaMargin = 0, totalTarget = 0;
  var branchSales = {}, paymentCounts = {}, productSales = {};
  
  for (var key in aggregated) {
    totalActual += aggregated[key].actual;
    totalMargin += aggregated[key].marginUnit;
    totalSisaMargin += aggregated[key].sisaMargin;
    var branch = filterBulan ? aggregated[key].branch : key.split("-")[0];
    branchSales[branch] = (branchSales[branch] || 0) + aggregated[key].actual;
  }
  
  for (var key in targets) {
    totalTarget += targets[key];
  }
  var targetTercapai = totalTarget > 0 ? ((totalActual / totalTarget) * 100).toFixed(2) + "%" : "-";
  
  document.getElementById('card-total-margin').innerText = totalMargin.toLocaleString();
  document.getElementById('card-sisa-margin').innerText = totalSisaMargin.toLocaleString();
  
  // Hitung distribusi metode pembayaran dan penjualan produk
  var maxPaymentCount = 0, dominantPayment = "-";
  for (var i = 1; i < dsData.length; i++) {
    var row = dsData[i];
    var month = parseInt(row[41]);
    if (isNaN(month)) continue;
    if (filterBulan && month !== parseInt(filterBulan)) continue;
    var payment = row[10] ? row[10].toString().trim() : "";
    if (payment) {
      paymentCounts[payment] = (paymentCounts[payment] || 0) + 1;
    }
    var alias = row[9] ? row[9].toString().trim() : "";
    var saleValue = parseFloat(row[0] ? row[0].toString().replace(/,/g, '') : "0") || 0;
    if (alias) {
      productSales[alias] = (productSales[alias] || 0) + saleValue;
    }
  }
  
  for (var method in paymentCounts) {
    if (paymentCounts[method] > maxPaymentCount) {
      maxPaymentCount = paymentCounts[method];
      dominantPayment = method;
    }
  }
  
  var bestProduct = "-", bestProductSales = 0;
  for (var prod in productSales) {
    if (productSales[prod] > bestProductSales) {
      bestProductSales = productSales[prod];
      bestProduct = prod;
    }
  }
  
  var bestSeller = "-", bestSellerSales = 0;
  for (var branch in branchSales) {
    if (branchSales[branch] > bestSellerSales) {
      bestSellerSales = branchSales[branch];
      bestSeller = branch;
    }
  }
  
  var lowestSeller = "-", lowestSales = Infinity;
  for (var branch in branchSales) {
    if (branchSales[branch] < lowestSales && branchSales[branch] > 0) {
      lowestSales = branchSales[branch];
      lowestSeller = branch;
    }
  }
  if (lowestSales === Infinity) {
    lowestSales = 0;
    lowestSeller = "-";
  }
  
  var totalDiskon = 0, totalSubsidi = 0;
  for (var key in aggregated) {
    totalDiskon += aggregated[key].diskon;
    totalSubsidi += aggregated[key].subsidi;
  }
  
  document.getElementById('card-best-seller').innerText = bestSeller + " (" + bestSellerSales.toLocaleString() + ")";
  document.getElementById('card-dominant-payment').innerText = dominantPayment + " (" + maxPaymentCount + ")";
  document.getElementById('card-product-best-seller').innerText = bestProduct + " (" + bestProductSales.toLocaleString() + ")";
  document.getElementById('card-lowest-sales').innerText = lowestSeller + " (" + lowestSales.toLocaleString() + ")";
  document.getElementById('card-total-diskon').innerText = totalDiskon.toLocaleString();
  document.getElementById('card-total-subsidi').innerText = totalSubsidi.toLocaleString();
  
  updateDailyVisitsCard(dsData, targetTercapai, totalActual);
  updateProductPieChart(productSales);
  updatePaymentPieChart(paymentCounts);
}

// Buat Sparkline untuk penjualan per bulan
function updateDailyVisitsCard(dsData, targetTercapai, totalActual) {
  document.getElementById('daily-visits-percentage').innerText = targetTercapai;
  document.getElementById('daily-visits-main').innerText = totalActual.toLocaleString();
  
  var monthlySales = {};
  for (var i = 1; i < dsData.length; i++){
    var row = dsData[i];
    var month = parseInt(row[41]);
    if (isNaN(month)) continue;
    var saleValue = parseFloat(row[0] ? row[0].toString().replace(/,/g, '') : "0") || 0;
    monthlySales[month] = (monthlySales[month] || 0) + saleValue;
  }
  var salesArray = [];
  for (var m = 1; m <= 12; m++){
    salesArray.push(monthlySales[m] || 0);
  }
  
  var maxSales = Math.max(...salesArray);
  var barWidth = 15, barSpacing = 5;
  var svgWidth = (barWidth + barSpacing) * 12;
  var svgHeight = 40;
  
  var svgContent = `<svg width="100%" height="40" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet">`;
  for (var m = 0; m < 12; m++){
    var value = salesArray[m];
    var barHeight = maxSales > 0 ? (value / maxSales) * svgHeight : 0;
    var x = m * (barWidth + barSpacing);
    var y = svgHeight - barHeight;
    svgContent += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="purple"></rect>`;
  }
  svgContent += '</svg>';
  document.getElementById('daily-visits-sparkline').innerHTML = svgContent;
}

// Update Tabel & Grafik dari Google Sheets
function updateDashboardTable(data) {
  var dsData = data["D_S"],
      tgetData = data["T_get"];
  
  if (!dsData) { console.error("Sheet D_S tidak ditemukan."); return; }
  if (!tgetData) { console.error("Sheet T_get tidak ditemukan."); return; }
  
  // Simpan data sheet secara global untuk keperluan filter growth table
  globalDsData = dsData;
  
  var filterBulan = $('#filter-bulan').val(),
      aggregated = {};
  
  // Proses data penjualan (actual) dari Sheet D_S
  for (var i = 1; i < dsData.length; i++) {
    var row = dsData[i],
        branch = row[3],
        month = parseInt(row[41]);
    if (isNaN(month)) continue;
    
    var key = filterBulan ? branch : branch + "-" + month;
    if (filterBulan && month !== parseInt(filterBulan)) continue;
    
    var actual = parseFloat(row[0] ? row[0].toString().replace(/,/g, '') : "0") || 0,
        potDealer = parseFloat(row[20] ? row[20].toString().replace(/,/g, '') : "0") || 0,
        potTambahan = parseFloat(row[24] ? row[24].toString().replace(/,/g, '') : "0") || 0,
        diskon = potDealer + potTambahan,
        potMD = parseFloat(row[21] ? row[21].toString().replace(/,/g, '') : "0") || 0,
        potATPM = parseFloat(row[22] ? row[22].toString().replace(/,/g, '') : "0") || 0,
        potLeasing = parseFloat(row[23] ? row[23].toString().replace(/,/g, '') : "0") || 0,
        subsidi = potMD + potATPM + potLeasing,
        marginUnit = parseFloat(row[29] ? row[29].toString().replace(/,/g, '') : "0") || 0,
        sisaMargin = parseFloat(row[32] ? row[32].toString().replace(/,/g, '') : "0") || 0;
    
    if (!aggregated[key]) {
      aggregated[key] = {
        branch: branch,
        month: filterBulan ? filterBulan : month,
        actual: 0,
        diskon: 0,
        subsidi: 0,
        marginUnit: 0,
        sisaMargin: 0
      };
    }
    aggregated[key].actual += actual;
    aggregated[key].diskon += diskon;
    aggregated[key].subsidi += subsidi;
    aggregated[key].marginUnit += marginUnit;
    aggregated[key].sisaMargin += sisaMargin;
  }
  
  // Proses target dari Sheet T_get
  var targets = {};
  for (var j = 1; j < tgetData.length; j++) {
    var row = tgetData[j],
        branch = row[0],
        month = parseInt(row[2]);
    if (isNaN(month)) continue;
    var key = filterBulan ? branch : branch + "-" + month;
    if (filterBulan && month !== parseInt(filterBulan)) continue;
    targets[key] = parseFloat(row[3]) || 0;
  }
  
  // Gabungkan kunci dari kedua data
  var allKeys = {};
  for (var key in aggregated) allKeys[key] = true;
  for (var key in targets) allKeys[key] = true;
  
  var sortedKeys = Object.keys(allKeys).sort(function(a, b) {
    if (filterBulan) {
      return a.localeCompare(b);
    } else {
      var partsA = a.split("-"), partsB = b.split("-");
      var monthA = parseInt(partsA[1]), monthB = parseInt(partsB[1]);
      return monthA !== monthB ? monthA - monthB : partsA[0].localeCompare(partsB[0]);
    }
  });
  
  // Tampilkan data pada Tabel Penjualan
  var tbody = $("#dashboard-table tbody");
  tbody.empty();
  sortedKeys.forEach(function(key) {
    var agg = aggregated[key] || { branch: filterBulan ? key : key.split("-")[0], month: filterBulan ? filterBulan : key.split("-")[1], actual: 0, diskon: 0, subsidi: 0, marginUnit: 0, sisaMargin: 0 },
        targetVal = targets[key] || 0,
        achievement = targetVal > 0 ? ((agg.actual / targetVal) * 100).toFixed(2) + "%" : "-";
    
    var tr = $("<tr></tr>");
    tr.append($("<td></td>").text(agg.month));
    tr.append($("<td></td>").text(agg.branch));
    tr.append($("<td></td>").text(agg.actual.toLocaleString()));
    tr.append($("<td></td>").text(targetVal.toLocaleString()));
    tr.append($("<td></td>").text(achievement));
    tr.append($("<td></td>").text(agg.diskon.toLocaleString()));
    tr.append($("<td></td>").text(agg.subsidi.toLocaleString()));
    tr.append($("<td></td>").text(agg.marginUnit.toLocaleString()));
    tr.append($("<td></td>").text(agg.sisaMargin.toLocaleString()));
    tbody.append(tr);
  });
  
  updateSummaryCards(aggregated, targets, dsData, filterBulan);
  updateDashboardChart(aggregated, targets, sortedKeys, filterBulan);
  updateSalesTrendChart(dsData, "");
  updateHeatmap(dsData);
  updateBranchGrowthChart(dsData);
  updateGrowthTable(dsData);
  
  // Perbarui filter khusus untuk growth table berdasarkan cabang
  updateGrowthTableBranchFilter(dsData);
  
  // Inisialisasi DataTable
  if ($.fn.DataTable.isDataTable("#dashboard-table")) {
    $('#dashboard-table').DataTable().destroy();
  }
  $('#dashboard-table').DataTable({
    responsive: true,
    language: {
      search: "Cari:",
      lengthMenu: "Tampilkan _MENU_ data per halaman",
      info: "Menampilkan _START_ sampai _END_ dari _TOTAL_ data",
      infoEmpty: "Tidak ada data yang tersedia",
      paginate: {
        first: "Pertama",
        last: "Terakhir",
        next: "Next",
        previous: "Back"
      }
    }
  });
}

// Fungsi untuk mengisi filter khusus Tabel Pertumbuhan berdasarkan cabang
function updateGrowthTableBranchFilter(dsData) {
  var branchSet = new Set();
  // Ambil nama cabang unik dari data (mulai dari index 1)
  for (var i = 1; i < dsData.length; i++){
    var row = dsData[i],
        branch = row[3] ? row[3].toString().trim() : "";
    if(branch) {
      branchSet.add(branch);
    }
  }
  var filterSelect = document.getElementById("filter-branch-growth");
  // Kosongkan option kecuali "Semua Cabang"
  filterSelect.innerHTML = '<option value="">Semua Cabang</option>';
  branchSet.forEach(function(branch) {
    var option = document.createElement("option");
    option.value = branch;
    option.innerText = branch;
    filterSelect.appendChild(option);
  });
}

// Update Chart Actual vs Target (Bar Chart)
function updateDashboardChart(aggregated, targets, sortedKeys, filterBulan) {
  var labels = sortedKeys,
      actualData = [],
      targetData = [];
  
  sortedKeys.forEach(function(key) {
    actualData.push(aggregated[key] ? aggregated[key].actual : 0);
    targetData.push(targets[key] || 0);
  });
  
  var barColors = [];
  sortedKeys.forEach(function(key) {
    var actualValue = aggregated[key] ? aggregated[key].actual : 0,
        targetValue = targets[key] || 0,
        ratio = targetValue > 0 ? actualValue / targetValue : 0;
    
    if (targetValue === 0) {
      barColors.push('rgba(128,128,128,0.7)');
    } else if (ratio >= 1) {
      barColors.push('rgba(76, 175, 80, 0.7)');
    } else if (ratio < 0.74) {
      barColors.push('rgba(244, 67, 54, 0.7)');
    } else {
      barColors.push('rgba(106, 90, 205, 0.7)');
    }
  });
  
  if (chartSummary) {
    chartSummary.data.labels = labels;
    chartSummary.data.datasets[0].data = actualData;
    chartSummary.data.datasets[0].backgroundColor = barColors;
    chartSummary.data.datasets[1].data = targetData;
    chartSummary.update();
  } else {
    var ctx = document.getElementById("summaryChart").getContext("2d");
    chartSummary = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Actual',
            data: actualData,
            backgroundColor: barColors,
            borderRadius: 4,
            hoverBackgroundColor: barColors.map(function(color) {
              return color.replace('0.7', '0.9');
            })
          },
          {
            label: 'Target',
            data: targetData,
            backgroundColor: 'rgba(255, 152, 0, 0.7)',
            borderRadius: 4,
            hoverBackgroundColor: 'rgba(255, 152, 0, 0.9)'
          }
        ]
      },
      options: {
        responsive: true,
        animation: { duration: 1500 },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return 'Rp ' + context.parsed.y.toLocaleString();
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: filterBulan ? 'Cabang (Bulan ' + filterBulan + ')' : 'Cabang-Bulan' }
          },
          y: {
            title: { display: true, text: 'Penjualan' }
          }
        }
      }
    });
  }
}

// Grafik Tren Penjualan (Line Chart)
function updateSalesTrendChart(dsData, branchFilter) {
  var monthlySales = new Array(12).fill(0);
  for (var i = 1; i < dsData.length; i++){
    var row = dsData[i],
        month = parseInt(row[41]);
    if (isNaN(month) || month < 1 || month > 12) continue;
    var saleValue = parseFloat(row[0] ? row[0].toString().replace(/,/g, '') : "0") || 0;
    monthlySales[month - 1] += saleValue;
  }
  
  var ctx = document.getElementById("salesTrendChart").getContext("2d");
  if (window.salesTrendChartInstance) {
    window.salesTrendChartInstance.data.datasets[0].data = monthlySales;
    window.salesTrendChartInstance.data.datasets[0].label = "Penjualan";
    window.salesTrendChartInstance.update();
  } else {
    window.salesTrendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
        datasets: [{
          label: "Penjualan",
          data: monthlySales,
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return 'Rp ' + context.parsed.y.toLocaleString();
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Bulan' } },
          y: { title: { display: true, text: 'Penjualan' } }
        }
      }
    });
  }
}

// Grafik Pie Chart: Kontribusi Penjualan per Produk
function updateProductPieChart(productSales) {
  var labels = Object.keys(productSales),
      dataValues = labels.map(function(label) { return productSales[label]; });
  var ctx = document.getElementById("productPieChart").getContext("2d");
  if (productPieChart) {
    productPieChart.data.labels = labels;
    productPieChart.data.datasets[0].data = dataValues;
    productPieChart.update();
  } else {
    productPieChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: labels.map(function() {
            return 'hsl(' + Math.floor(Math.random() * 360) + ', 70%, 70%)';
          })
        }]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                var label = context.label || '';
                var value = context.parsed;
                return label + ': Rp ' + value.toLocaleString();
              }
            }
          }
        }
      }
    });
  }
}

// Grafik Pie Chart: Distribusi Pembayaran
function updatePaymentPieChart(paymentCounts) {
  var labels = Object.keys(paymentCounts),
      dataValues = labels.map(function(label) { return paymentCounts[label]; });
  var ctx = document.getElementById("paymentPieChart").getContext("2d");
  if (paymentPieChart) {
    paymentPieChart.data.labels = labels;
    paymentPieChart.data.datasets[0].data = dataValues;
    paymentPieChart.update();
  } else {
    paymentPieChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: labels.map(function() {
            return 'hsl(' + Math.floor(Math.random() * 360) + ', 70%, 70%)';
          })
        }]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                var label = context.label || '';
                var value = context.parsed;
                return label + ': ' + value.toLocaleString() + ' transaksi';
              }
            }
          }
        }
      }
    });
  }
}

// Buat Heatmap berdasarkan Hari Transaksi
function updateHeatmap(dsData) {
  var dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
      dayCounts = { "Senin": 0, "Selasa": 0, "Rabu": 0, "Kamis": 0, "Jumat": 0, "Sabtu": 0, "Minggu": 0 };
  for (var i = 1; i < dsData.length; i++){
    var row = dsData[i],
        dateStr = row[1] ? row[1].toString().trim() : "";
    if (dateStr === "") continue;
    var dateObj = new Date(dateStr),
        dayIndex = dateObj.getDay(),
        dayName = dayNames[dayIndex];
    dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
  }
  var maxCount = Math.max(...Object.values(dayCounts)) || 1,
      orderedDays = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
      heatmapHTML = "";
  orderedDays.forEach(function(day) {
    var count = dayCounts[day] || 0,
        intensity = count / maxCount,
        color = "rgba(76, 175, 80, " + (0.3 + intensity * 0.7) + ")";
    heatmapHTML += '<div class="heatmap-cell" style="background:' + color + ';">' + day + '<br>' + count + '</div>';
  });
  document.getElementById("heatmapContainer").innerHTML = heatmapHTML;
}

// Update Line Chart: Pertumbuhan Cabang Per Bulan
function updateBranchGrowthChart(dsData) {
  var branchMonthlySales = {};
  for (var i = 1; i < dsData.length; i++){
    var row = dsData[i],
        month = parseInt(row[41]);
    if (isNaN(month) || month < 1 || month > 12) continue;
    var branch = row[3] ? row[3].toString().trim() : "Unknown",
        saleValue = parseFloat(row[0] ? row[0].toString().replace(/,/g, '') : "0") || 0;
    if (!branchMonthlySales[branch]) {
      branchMonthlySales[branch] = new Array(12).fill(0);
    }
    branchMonthlySales[branch][month - 1] += saleValue;
  }
  var datasets = [];
  Object.keys(branchMonthlySales).forEach(function(branch) {
    var color = 'hsl(' + Math.floor(Math.random() * 360) + ', 70%, 50%)';
    datasets.push({
      label: branch,
      data: branchMonthlySales[branch],
      borderColor: color,
      backgroundColor: color,
      fill: false,
      tension: 0.3
    });
  });
  var ctx = document.getElementById("branchGrowthChart").getContext("2d");
  if (branchGrowthChart) {
    branchGrowthChart.data.datasets = datasets;
    branchGrowthChart.update();
  } else {
    branchGrowthChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
        datasets: datasets
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return 'Rp ' + context.parsed.y.toLocaleString();
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Bulan' } },
          y: { title: { display: true, text: 'Penjualan' } }
        }
      }
    });
  }
}

// Update Tabel Pertumbuhan Cabang dengan Persentase
function updateGrowthTable(dsData) {
  var branchMonthlySales = {};
  for (var i = 1; i < dsData.length; i++){
    var row = dsData[i],
        month = parseInt(row[41]);
    if (isNaN(month) || month < 1 || month > 12) continue;
    var branch = row[3] ? row[3].toString().trim() : "Unknown",
        saleValue = parseFloat(row[0] ? row[0].toString().replace(/,/g, '') : "0") || 0;
    if (!branchMonthlySales[branch]) {
      branchMonthlySales[branch] = new Array(12).fill(0);
    }
    branchMonthlySales[branch][month - 1] += saleValue;
  }
  
  var branchFilter = document.getElementById("filter-branch-growth").value;
  
  var tbody = document.getElementById("growth-table-body");
  tbody.innerHTML = "";
  Object.keys(branchMonthlySales).forEach(function(branch) {
    if (branchFilter && branch !== branchFilter) {
      return;
    }
    var salesArray = branchMonthlySales[branch];
    for (var m = 1; m < 12; m++){
      var prevSales = salesArray[m - 1],
          currSales = salesArray[m],
          growth = "N/A";
      if (prevSales <= 1 || currSales <= 1) {
        continue;
      }
      growth = ((currSales - prevSales) / prevSales * 100).toFixed(2) + "%";
      var monthName = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][m];
      var tr = document.createElement("tr");
      var tdBranch = document.createElement("td");
      tdBranch.innerText = branch;
      var tdMonth = document.createElement("td");
      tdMonth.innerText = monthName;
      var tdPrev = document.createElement("td");
      tdPrev.innerText = prevSales.toLocaleString();
      var tdCurr = document.createElement("td");
      tdCurr.innerText = currSales.toLocaleString();
      var tdGrowth = document.createElement("td");
      tdGrowth.innerText = growth;
      tr.appendChild(tdBranch);
      tr.appendChild(tdMonth);
      tr.appendChild(tdPrev);
      tr.appendChild(tdCurr);
      tr.appendChild(tdGrowth);
      tbody.appendChild(tr);
    }
  });
}

// Fungsi untuk mengisi Tabel Monitoring dengan data dari sheet P_V
function updateMonitoringTable(pvData) {
  if (!pvData) {
    console.error("Sheet P_V tidak ditemukan.");
    return;
  }
  var tbody = $("#monitoring-table tbody");
  tbody.empty();
  // Asumsikan bahwa sheet P_V memiliki kolom:
  // 0: Cabang, 1: Bulan, 2: Kurang byr Leasing, 3: Kurang byr MD ATPM
  for (var i = 1; i < pvData.length; i++) {
    var row = pvData[i];
    var cabang = row[0] ? row[0].toString().trim() : "";
    var bulan = row[1] ? row[1].toString().trim() : "";
    var kurangLeasing = row[2] ? parseAccountingNumber(row[2].toString()) : 0;
    var kurangMD_ATPM = row[3] ? parseAccountingNumber(row[3].toString()) : 0;
    var tr = $("<tr></tr>");
    tr.append($("<td></td>").text(cabang));
    tr.append($("<td></td>").text(bulan));
    // Tampilkan dengan pemisah ribuan (locale 'en-US')
    tr.append($("<td></td>").text(kurangLeasing.toLocaleString('en-US')));
    tr.append($("<td></td>").text(kurangMD_ATPM.toLocaleString('en-US')));
    tbody.append(tr);
  }
  // Inisialisasi DataTable untuk tabel monitoring
  if ($.fn.DataTable.isDataTable("#monitoring-table")) {
    $('#monitoring-table').DataTable().destroy();
  }
  $('#monitoring-table').DataTable({
    responsive: true,
    language: {
      search: "Cari:",
      lengthMenu: "Tampilkan _MENU_ data per halaman",
      info: "Menampilkan _START_ sampai _END_ dari _TOTAL_ data",
      infoEmpty: "Tidak ada data yang tersedia",
      paginate: {
        first: "Pertama",
        last: "Terakhir",
        next: "Next",
        previous: "Back"
      }
    }
  });
}

// Ambil data dari Google Sheets
function getDataFromSheet() {
  var sheetUrl = 'https://script.google.com/macros/s/AKfycbzYfwDZVjGcBceMWfd_ORI1tQgA-Oj9tS4vOt5WYb3i3ucjjoxu3SnWTtj3GhQCIxBMVw/exec';
  $.getJSON(sheetUrl, function(response) {
    console.log("Response:", response);
    updateDashboardTable(response);
    // Panggil fungsi untuk mengupdate Tabel Monitoring dengan data sheet P_V
    updateMonitoringTable(response["P_V"]);
  }).fail(function() {
    console.error("Gagal mengambil data dari Google Sheets.");
  });
}

$(document).ready(function() {
  getDataFromSheet();
  // Filter Bulan
  $('#filter-bulan').on('change', function() {
    getDataFromSheet();
  });
  // Filter khusus untuk Tabel Pertumbuhan berdasarkan cabang
  $('#filter-branch-growth').on('change', function() {
    updateGrowthTable(globalDsData);
  });
  // Menu Hamburger untuk Mobile
  $('#hamburger').on('click', function() {
    $('#nav-menu').toggleClass('active');
    $(this).toggleClass('open');
  });
  // Optional: Real-Time Updates
  // setInterval(getDataFromSheet, 60000);
});
