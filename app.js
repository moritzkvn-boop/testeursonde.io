document.getElementById('csvFile').addEventListener('change', handleFileSelect, false);
document.getElementById('exportButton').addEventListener('click', exportToExcel, false);
document.getElementById('startAnalysisButton').addEventListener('click', startAnalysis, false);
document.getElementById('checkVitesse').addEventListener('change', updateAnalysisButton, false);
document.getElementById('checkHauteur').addEventListener('change', updateAnalysisButton, false);
document.getElementById('filterVitesse').addEventListener('change', updateAnalysisButton, false);
document.getElementById('filterHauteur').addEventListener('change', updateAnalysisButton, false);
document.getElementById('showChartButton').addEventListener('click', openChartInNewWindow, false);
document.getElementById('showFilteredChartButton').addEventListener('click', openFilteredChartInNewWindow, false);
document.getElementById('invertVitesse').addEventListener('change', updateAnalysisButton, false);
document.getElementById('resetButton').addEventListener('click', resetApplication, false);

let processedData = [];
let combinedData = [];
let columnHeaders = [];
let chartData = {};
let filteredChartData = {};

let rawChartWindow = null;
let filteredChartWindow = null;

function handleFileSelect(event) {
    const files = document.getElementById('csvFile').files;
    combinedData = [];
    let processedCount = 0;

    if (files.length === 0) return;
    document.getElementById('exportButton').style.display = 'none';
    document.getElementById('showChartButton').style.display = 'none';
    document.getElementById('showFilteredChartButton').style.display = 'none';
    document.getElementById('results').innerHTML = '';
    document.getElementById('resetButton').style.display = 'block';

    const processNextFile = () => {
        if (processedCount < files.length) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const lines = e.target.result.split('\n');
                
                if (processedCount === 0) {
                    columnHeaders = lines[23].split(',').map(header => header.trim());
                }

                const dataLines = lines.slice(26);
                
                dataLines.forEach(line => {
                    const columns = line.split(',');
                    if (columns.length > 1) {
                        combinedData.push(columns);
                    }
                });
                
                processedCount++;
                processNextFile();
            };
            reader.readAsText(files[processedCount]);
        } else {
            document.getElementById('columnSelection').style.display = 'block';
            updateAnalysisButton();
        }
    };
    processNextFile();
}

function updateAnalysisButton() {
    const analyzeButton = document.getElementById('startAnalysisButton');
    const vitesseChecked = document.getElementById('checkVitesse').checked;
    const hauteurChecked = document.getElementById('checkHauteur').checked;
    const vitesseFilteredChecked = document.getElementById('filterVitesse').checked;
    const hauteurFilteredChecked = document.getElementById('filterHauteur').checked;
    const invertVitesseChecked = document.getElementById('invertVitesse').checked;
    
    analyzeButton.disabled = !(vitesseChecked || hauteurChecked || vitesseFilteredChecked || hauteurFilteredChecked);
    
    document.getElementById('invertVitesse').disabled = !vitesseChecked;
}

function startAnalysis() {
    const offsetValue = parseFloat(document.getElementById('offsetValue').value);
    if (isNaN(offsetValue)) {
        alert("Veuillez entrer une valeur valide à soustraire.");
        return;
    }
    
    processData(combinedData, offsetValue);
    
    displayTable();
    prepareChartData();
    prepareFilteredChartData();
    
    document.getElementById('showChartButton').style.display = 'block';
    document.getElementById('showFilteredChartButton').style.display = 'block';
}

function processData(data, offsetValue) {
    const liquidLevelIndex = columnHeaders.indexOf('Niveau Liquide');
    const flowRateIndex = 11;
    const invertVitesseChecked = document.getElementById('invertVitesse').checked;

    processedData = [];

    data.forEach(row => {
        let rowValid = true;

        const hauteurChecked = document.getElementById('checkHauteur').checked;
        const vitesseChecked = document.getElementById('checkVitesse').checked;
        const hauteurFilteredChecked = document.getElementById('filterHauteur').checked;
        const vitesseFilteredChecked = document.getElementById('filterVitesse').checked;

        let height_corrected = null;
        if (hauteurChecked || hauteurFilteredChecked) {
            const height_mm_string = row[liquidLevelIndex].trim().replace(',', '.');
            const height_mm = parseFloat(height_mm_string);
            if (isNaN(height_mm)) {
                rowValid = false;
            } else {
                height_corrected = height_mm - offsetValue;
            }
        }

        let speed_mps = null;
        if (vitesseChecked || vitesseFilteredChecked) {
            let speed_mms_string = row[flowRateIndex].trim().replace(',', '.').replace('(mm/s)', '').trim();
            let speed_mms = parseFloat(speed_mms_string);
            
            if (isNaN(speed_mms)) {
                rowValid = false;
            } else {
                if (invertVitesseChecked) {
                    speed_mms = speed_mms * -1;
                }
                speed_mps = (speed_mms / 1000).toFixed(3);
            }
        }
        
        if (rowValid) {
            let dataObject = {
                date: row[0],
                time: row[1]
            };
            if (hauteurChecked) dataObject.hauteur = height_corrected;
            if (vitesseChecked) dataObject.vitesse = String(speed_mps).replace('.', ',');
            if (hauteurFilteredChecked) dataObject.hauteurFiltree = height_corrected < 0 ? 0 : height_corrected;
            if (vitesseFilteredChecked) dataObject.vitesseFiltree = parseFloat(speed_mps) < 0 ? 0 : speed_mps;

            processedData.push(dataObject);
        }
    });
}

function displayTable() {
    let resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<h3>Résultats de l\'analyse</h3>';

    const vitesseChecked = document.getElementById('checkVitesse').checked;
    const hauteurChecked = document.getElementById('checkHauteur').checked;
    const vitesseFilteredChecked = document.getElementById('filterVitesse').checked;
    const hauteurFilteredChecked = document.getElementById('filterHauteur').checked;

    let table = '<table>';
    table += '<thead><tr><th>Date</th><th>Heure</th>';

    const headers = [];
    if (hauteurChecked) headers.push({ text: 'Niveau Liquide (mm)', key: 'hauteur', isNumeric: true });
    if (vitesseChecked) headers.push({ text: 'Vitesse (m/s)', key: 'vitesse', isNumeric: true });
    if (hauteurFilteredChecked) headers.push({ text: 'Hauteur Filtrée (mm)', key: 'hauteurFiltree', isNumeric: true });
    if (vitesseFilteredChecked) headers.push({ text: 'Vitesse Filtrée (m/s)', key: 'vitesseFiltree', isNumeric: true });

    headers.forEach(header => table += `<th>${header.text}</th>`);
    table += '</tr></thead>';

    const uniqueDates = [...new Set(processedData.map(item => item.date))].sort();
    const uniqueTimes = [...new Set(processedData.map(item => item.time))].sort();

    table += '<thead><tr>';
    table += `<th>
        <select class="filter-select" data-key="date">
            <option value="">Tout afficher</option>
            ${uniqueDates.map(date => `<option value="${date}">${date}</option>`).join('')}
        </select>
    </th>`;
    table += `<th>
        <select class="filter-select" data-key="time">
            <option value="">Tout afficher</option>
            ${uniqueTimes.map(time => `<option value="${time}">${time}</option>`).join('')}
        </select>
    </th>`;
    headers.forEach(header => {
        if (header.isNumeric) {
            table += `<th>
                <select class="filter-numeric-select" data-key="${header.key}">
                    <option value="">Tout</option>
                    <option value=">0">Positif (>0)</option>
                    <option value="<0">Négatif (<0)</option>
                </select>
                <input type="text" class="filter-input" data-key="${header.key}" placeholder="Recherche...">
            </th>`;
        } else {
            table += `<th><input type="text" class="filter-input" data-key="${header.key}" placeholder="Filtrer..."></th>`;
        }
    });
    table += '</tr></thead>';

    table += '<tbody>';
    
    function renderTableRows(dataToRender) {
        let rowsHtml = '';
        dataToRender.forEach((row, rowIndex) => {
            rowsHtml += `<tr data-row-index="${rowIndex}">`;
            rowsHtml += `<td>${row.date}</td><td>${row.time}</td>`;
            if (hauteurChecked) rowsHtml += `<td data-key="hauteur" contenteditable="true">${row.hauteur !== undefined ? String(row.hauteur).replace('.', ',') : ''}</td>`;
            if (vitesseChecked) rowsHtml += `<td data-key="vitesse" contenteditable="true">${row.vitesse !== undefined ? row.vitesse : ''}</td>`;
            if (hauteurFilteredChecked) rowsHtml += `<td data-key="hauteurFiltree" contenteditable="true">${row.hauteurFiltree !== undefined ? String(row.hauteurFiltree).replace('.', ',') : ''}</td>`;
            if (vitesseFilteredChecked) rowsHtml += `<td data-key="vitesseFiltree" contenteditable="true">${row.vitesseFiltree !== undefined ? String(row.vitesseFiltree).replace('.', ',') : ''}</td>`;
            rowsHtml += '</tr>';
        });
        return rowsHtml;
    }

    table += renderTableRows(processedData);
    
    table += '</tbody></table>';
    resultsDiv.innerHTML += table;
    document.getElementById('exportButton').style.display = 'block';

    function applyFilters() {
        const filters = {};
        document.querySelectorAll('.filter-select').forEach(select => {
            if (select.value) {
                filters[select.dataset.key] = select.value;
            }
        });
        document.querySelectorAll('.filter-numeric-select').forEach(select => {
            if (select.value) {
                filters[select.dataset.key] = select.value;
            }
        });
        document.querySelectorAll('.filter-input').forEach(input => {
            if (input.value) {
                filters[input.dataset.key] = input.value.trim();
            }
        });

        const filteredData = processedData.filter(row => {
            let isMatch = true;
            for (const key in filters) {
                const filterValue = filters[key];
                let cellValue = row[key];

                if (typeof cellValue === 'number' || key.includes('hauteur') || key.includes('vitesse')) {
                    const numValue = (typeof cellValue === 'string') ? parseFloat(cellValue.replace(',', '.')) : cellValue;

                    if (filterValue === '>0') {
                        isMatch = numValue > 0;
                    } else if (filterValue === '<0') {
                        isMatch = numValue < 0;
                    } else if (filterValue.startsWith('>=')) {
                        isMatch = numValue >= parseFloat(filterValue.substring(2).replace(',', '.'));
                    } else if (filterValue.startsWith('>')) {
                        isMatch = numValue > parseFloat(filterValue.substring(1).replace(',', '.'));
                    } else if (filterValue.startsWith('<=')) {
                        isMatch = numValue <= parseFloat(filterValue.substring(2).replace(',', '.'));
                    } else if (filterValue.startsWith('<')) {
                        isMatch = numValue < parseFloat(filterValue.substring(1).replace(',', '.'));
                    } else if (filterValue.includes('-')) {
                        const [min, max] = filterValue.split('-').map(val => parseFloat(val.replace(',', '.')));
                        isMatch = numValue >= min && numValue <= max;
                    } else {
                        isMatch = String(numValue).replace('.', ',').toLowerCase().includes(filterValue.toLowerCase());
                    }
                } else {
                    if (typeof cellValue === 'string') {
                         isMatch = cellValue.toLowerCase().includes(filterValue.toLowerCase());
                    } else {
                         isMatch = false;
                    }
                }

                if (!isMatch) {
                    break;
                }
            }
            return isMatch;
        });
        document.querySelector('#results table tbody').innerHTML = renderTableRows(filteredData);
    }
    
    document.querySelectorAll('.filter-select').forEach(select => select.addEventListener('change', applyFilters));
    document.querySelectorAll('.filter-numeric-select').forEach(select => select.addEventListener('change', applyFilters));
    document.querySelectorAll('.filter-input').forEach(input => input.addEventListener('keyup', applyFilters));

    // Ajoutez un écouteur d'événement pour l'édition de cellule
    document.querySelectorAll('#results table tbody td[contenteditable="true"]').forEach(cell => {
        cell.removeEventListener('blur', updateDataFromTable); // Empêche l'accumulation des écouteurs
        cell.addEventListener('blur', updateDataFromTable);
    });
}

function updateDataFromTable(event) {
    const cell = event.target;
    const rowIndex = cell.closest('tr').dataset.rowIndex;
    const key = cell.dataset.key;
    const newValue = cell.textContent.trim().replace(',', '.');
    
    // Convertir la valeur en nombre si la clé correspond à une donnée numérique
    const isNumeric = key.includes('hauteur') || key.includes('vitesse');
    const parsedValue = isNumeric ? parseFloat(newValue) : newValue;

    if (isNaN(parsedValue) && isNumeric) {
        alert("Veuillez entrer une valeur numérique valide.");
        cell.textContent = String(processedData[rowIndex][key]).replace('.', ','); // Revenir à l'ancienne valeur
        return;
    }
    
    // Mise à jour de processedData
    if (processedData[rowIndex]) {
        if (isNumeric) {
            processedData[rowIndex][key] = parsedValue;
        } else {
            processedData[rowIndex][key] = newValue;
        }

        // Recalculer les valeurs filtrées si les cases sont cochées
        const hauteurFilteredChecked = document.getElementById('filterHauteur').checked;
        const vitesseFilteredChecked = document.getElementById('filterVitesse').checked;

        if (hauteurFilteredChecked && key.includes('hauteur')) {
            processedData[rowIndex]['hauteurFiltree'] = parsedValue < 0 ? 0 : parsedValue;
        }
        if (vitesseFilteredChecked && key.includes('vitesse')) {
            processedData[rowIndex]['vitesseFiltree'] = parsedValue < 0 ? 0 : parsedValue;
        }
    }

    // Mise à jour des graphiques et rafraîchissement de la table
    prepareFilteredChartData();
    displayTable();
}

function prepareChartData() {
    const liquidLevelIndex = columnHeaders.indexOf('Niveau Liquide');
    const flowRateIndex = 11;
    const invertVitesseChecked = document.getElementById('invertVitesse').checked;

    const labels = [];
    const rawHauteurData = [];
    const rawVitesseData = [];

    combinedData.forEach(row => {
        const date = row[0];
        const time = row[1];
        const height_mm_string = liquidLevelIndex !== -1 ? row[liquidLevelIndex].trim().replace(',', '.') : '';
        let speed_mms_string = row[flowRateIndex].trim().replace(',', '.').replace('(mm/s)', '').trim();
        
        const height = parseFloat(height_mm_string);
        let speed = parseFloat(speed_mms_string);
        
        if (invertVitesseChecked) {
            speed = speed * -1;
        }

        labels.push(`${date} ${time}`);
        rawHauteurData.push(isNaN(height) ? null : height);
        rawVitesseData.push(isNaN(speed) ? null : speed / 1000);
    });

    chartData = {
        labels: labels,
        datasets: [{
            label: 'Niveau Liquide brut (mm)',
            data: rawHauteurData,
            borderColor: 'rgb(75, 192, 192)',
            borderWidth: 1,
            tension: 0.1,
            yAxisID: 'y1',
            pointRadius: 0,
            pointHoverRadius: 5
        }, {
            label: 'Vitesse brute (m/s)',
            data: rawVitesseData,
            borderColor: 'rgb(255, 99, 132)',
            borderWidth: 1,
            tension: 0.1,
            yAxisID: 'y2',
            pointRadius: 0,
            pointHoverRadius: 5
        }]
    };
}

function prepareFilteredChartData() {
    const labels = processedData.map(row => `${row.date} ${row.time}`);
    const datasets = [];

    const hauteurChecked = document.getElementById('checkHauteur').checked;
    const vitesseChecked = document.getElementById('checkVitesse').checked;
    const hauteurFilteredChecked = document.getElementById('filterHauteur').checked;
    const vitesseFilteredChecked = document.getElementById('filterVitesse').checked;

    if (hauteurFilteredChecked) {
        datasets.push({
            label: 'Hauteur Filtrée (mm)',
            data: processedData.map(row => row.hauteurFiltree),
            borderColor: 'rgb(75, 192, 192)',
            borderWidth: 1,
            tension: 0.1,
            yAxisID: 'y1',
            pointRadius: 0,
            pointHoverRadius: 5
        });
    } else if (hauteurChecked) {
        datasets.push({
            label: 'Niveau Liquide (mm)',
            data: processedData.map(row => row.hauteur),
            borderColor: 'rgb(75, 192, 192)',
            borderWidth: 1,
            tension: 0.1,
            yAxisID: 'y1',
            pointRadius: 0,
            pointHoverRadius: 5
        });
    }

    if (vitesseFilteredChecked) {
        datasets.push({
            label: 'Vitesse Filtrée (m/s)',
            data: processedData.map(row => row.vitesseFiltree),
            borderColor: 'rgb(255, 99, 132)',
            borderWidth: 1,
            tension: 0.1,
            yAxisID: 'y2',
            pointRadius: 0,
            pointHoverRadius: 5
        });
    } else if (vitesseChecked) {
        datasets.push({
            label: 'Vitesse (m/s)',
            data: processedData.map(row => parseFloat(String(row.vitesse).replace(',', '.'))),
            borderColor: 'rgb(255, 99, 132)',
            borderWidth: 1,
            tension: 0.1,
            yAxisID: 'y2',
            pointRadius: 0,
            pointHoverRadius: 5
        });
    }

    filteredChartData = {
        labels: labels,
        datasets: datasets
    };
}

function openChartInNewWindow() {
    rawChartWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!rawChartWindow) {
        alert("Impossible d'ouvrir une nouvelle fenêtre. Veuillez vérifier les paramètres de votre navigateur.");
        return;
    }
    
    const chartHtml = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Graphique des données brutes</title>
            <style>
                body { 
                    margin: 0; 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    justify-content: center; 
                    height: 100vh;
                    font-family: sans-serif;
                }
                #chart-container { 
                    width: 95%; 
                    height: 95%; 
                }
            </style>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom"></script>
        </head>
        <body>
            <h3>Graphique des données brutes</h3>
            <p style="font-size: 0.9em; color: #666; text-align: center;">
                Utilisez la molette pour zoomer, double-cliquez pour réinitialiser. <br>
                Maintenez la touche **Alt** et faites glisser la souris pour zoomer par sélection.
            </p>
            <div id="chart-container">
                <canvas id="myChart"></canvas>
            </div>
            <script>
                const data = ${JSON.stringify(chartData)};
                const ctx = document.getElementById('myChart').getContext('2d');
                let myChart = null;

                window.addEventListener('DOMContentLoaded', () => {
                    myChart = new Chart(ctx, {
                        type: 'line',
                        data: data,
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                y1: {
                                    type: 'linear',
                                    display: true,
                                    position: 'left',
                                    title: { display: true, text: 'Niveau Liquide (mm)' }
                                },
                                y2: {
                                    type: 'linear',
                                    display: true,
                                    position: 'right',
                                    title: { display: true, text: 'Vitesse (m/s)' },
                                    grid: { drawOnChartArea: false }
                                }
                            },
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'top',
                                },
                                tooltip: { mode: 'index', intersect: false },
                                zoom: {
                                    zoom: {
                                        wheel: { enabled: true },
                                        pinch: { enabled: true },
                                        drag: { enabled: true, modifierKey: 'alt' },
                                        mode: 'xy',
                                    },
                                    pan: { enabled: true, mode: 'x' },
                                    limits: {
                                        x: { min: 'original', max: 'original' },
                                        y: { min: 'original', max: 'original' }
                                    }
                                }
                            }
                        },
                    });
                });
                
                window.ondblclick = () => {
                    if (myChart) myChart.resetZoom();
                }
            </script>
        </body>
        </html>
    `;
    
    rawChartWindow.document.write(chartHtml);
    rawChartWindow.document.close();
}

function openFilteredChartInNewWindow() {
    filteredChartWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!filteredChartWindow) {
        alert("Impossible d'ouvrir une nouvelle fenêtre. Veuillez vérifier les paramètres de votre navigateur.");
        return;
    }

    const chartHtml = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Graphique des données filtrées</title>
            <style>
                body { 
                    margin: 0; 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    justify-content: center; 
                    height: 100vh;
                    font-family: sans-serif;
                }
                #chart-container { 
                    width: 95%; 
                    height: 95%; 
                }
            </style>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom"></script>
        </head>
        <body>
            <h3>Graphique des données filtrées</h3>
            <p style="font-size: 0.9em; color: #666; text-align: center;">
                Utilisez la molette pour zoomer, double-cliquez pour réinitialiser. <br>
                Maintenez la touche **Alt** et faites glisser la souris pour zoomer par sélection.
            </p>
            <div id="chart-container">
                <canvas id="myChart"></canvas>
            </div>
            <script>
                const data = ${JSON.stringify(filteredChartData)};
                const ctx = document.getElementById('myChart').getContext('2d');
                let myChart = null;

                window.addEventListener('DOMContentLoaded', () => {
                    myChart = new Chart(ctx, {
                        type: 'line',
                        data: data,
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                y1: {
                                    type: 'linear',
                                    display: true,
                                    position: 'left',
                                    title: { display: true, text: 'Hauteur (mm)' }
                                },
                                y2: {
                                    type: 'linear',
                                    display: true,
                                    position: 'right',
                                    title: { display: true, text: 'Vitesse (m/s)' },
                                    grid: { drawOnChartArea: false }
                                }
                            },
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'top',
                                },
                                tooltip: { mode: 'index', intersect: false },
                                zoom: {
                                    zoom: {
                                        wheel: { enabled: true },
                                        pinch: { enabled: true },
                                        drag: { enabled: true, modifierKey: 'alt' },
                                        mode: 'xy',
                                    },
                                    pan: { enabled: true, mode: 'x' },
                                    limits: {
                                        x: { min: 'original', max: 'original' },
                                        y: { min: 'original', max: 'original' }
                                    }
                                }
                            }
                        },
                    });
                });

                window.ondblclick = () => {
                    if (myChart) myChart.resetZoom();
                }
            </script>
        </body>
        </html>
    `;
    
    filteredChartWindow.document.write(chartHtml);
    filteredChartWindow.document.close();
}


function exportToExcel() {
    const vitesseChecked = document.getElementById('checkVitesse').checked;
    const hauteurChecked = document.getElementById('checkHauteur').checked;
    const vitesseFilteredChecked = document.getElementById('filterVitesse').checked;
    const hauteurFilteredChecked = document.getElementById('filterHauteur').checked;

    let csvHeader = 'Date;Heure';
    if (hauteurChecked) csvHeader += ';Niveau Liquide (mm)';
    if (vitesseChecked) csvHeader += ';Vitesse (m/s)';
    if (hauteurFilteredChecked) csvHeader += ';Hauteur Filtrée (mm)';
    if (vitesseFilteredChecked) csvHeader += ';Vitesse Filtrée (m/s)';
    csvHeader += '\n';

    let csv = csvHeader;
    processedData.forEach(row => {
        csv += `${row.date};${row.time};`;
        if (hauteurChecked) csv += `${row.hauteur !== undefined ? String(row.hauteur).replace('.', ',') : ''};`;
        if (vitesseChecked) csv += `${row.vitesse !== undefined ? row.vitesse : ''};`;
        if (hauteurFilteredChecked) csv += `${row.hauteurFiltree !== undefined ? String(row.hauteurFiltree).replace('.', ',') : ''};`;
        if (vitesseFilteredChecked) csv += `${row.vitesseFiltree !== undefined ? String(row.vitesseFiltree).replace('.', ',') : ''};`;
        csv = csv.slice(0, -1);
        csv += '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "donnees_analysees.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function resetApplication() {
    processedData = [];
    combinedData = [];
    columnHeaders = [];
    chartData = {};
    filteredChartData = {};

    document.getElementById('csvFile').value = '';
    document.getElementById('results').innerHTML = '';
    document.getElementById('columnSelection').style.display = 'none';
    document.getElementById('exportButton').style.display = 'none';
    document.getElementById('showChartButton').style.display = 'none';
    document.getElementById('showFilteredChartButton').style.display = 'none';
    document.getElementById('resetButton').style.display = 'none';
    
    if (rawChartWindow && !rawChartWindow.closed) {
        rawChartWindow.close();
        rawChartWindow = null;
    }
    if (filteredChartWindow && !filteredChartWindow.closed) {
        filteredChartWindow.close();
        filteredChartWindow = null;
    }

    alert("L'application a été réinitialisée. Vous pouvez télécharger de nouveaux fichiers.");
}