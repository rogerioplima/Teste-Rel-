// Constantes para as curvas IEC e ANSI
const CURVE_CONSTANTS = {
    'iec-standard-inverse': { a: 0.14, b: 0.02 },
    'iec-very-inverse': { a: 13.5, b: 1 },
    'iec-extremely-inverse': { a: 80, b: 2 },
    'iec-ultra-inverse': { a: 315.2, b: 2.5 },
    'iec-long-time-inverse': { a: 120, b: 1 },
    'ansi-moderate-inverse': { a: 0.0515, b: 0.02, c: 0.114 },
    'ansi-inverse': { a: 5.95, b: 2, c: 0.18 },
    'ansi-very-inverse': { a: 3.88, b: 2, c: 0.0963 },
    'ansi-extremely-inverse': { a: 5.67, b: 2, c: 0.0352 },
    'ansi-short-time-inverse': { a: 0.00262, b: 0.02, c: 0.0342 },
    'ansi-long-time-inverse': { a: 5.6, b: 1, c: 2.18 },
    'set-time': { a: 1, b: 1 }
};

let curveChart = null;
let currentTestData = null;

// Função para calcular o tempo de operação
function calculateOperationTime(multiple, curveType, timeDialSetting) {
    if (multiple <= 1) return null;
    
    const constants = CURVE_CONSTANTS[curveType];
    let time;
    
    try {
        if (curveType.startsWith('iec-')) {
            time = (timeDialSetting * constants.a) / Math.pow(multiple - 1, constants.b);
        } else if (curveType === 'set-time') {
            time = timeDialSetting;
        } else {
            time = timeDialSetting * ((constants.a / Math.pow(multiple, constants.b)) + constants.c);
        }
        
        return isFinite(time) && time > 0 ? time : null;
    } catch (error) {
        console.error('Erro no cálculo:', error);
        return null;
    }
}

// Função para gerar pontos da curva
function generatePoints(pickupCurrent, maxCurrent) {
    const points = [];
    const numPoints = 100;
    const minCurrent = pickupCurrent * 1.01;
    
    for (let i = 0; i <= numPoints; i++) {
        const factor = Math.pow(maxCurrent/minCurrent, i/numPoints);
        const current = minCurrent * factor;
        points.push(current);
    }
    
    return points;
}

// Função para atualizar a comparação de tempo
function updateTimeComparison(theoreticalTime, measuredTime, phase) {
    if (isNaN(measuredTime)) return;
    
    const difference = measuredTime - theoreticalTime;
    const percentDiff = (difference / theoreticalTime) * 100;
    
    const comparisonDiv = document.getElementById(`time-comparison-${phase.toLowerCase()}`);
    if (Math.abs(percentDiff) <= 10) {
        comparisonDiv.innerHTML = `<div class="comparison-ok">Tempo dentro da tolerância (±10%)</div>`;
    } else {
        comparisonDiv.innerHTML = `<div class="comparison-error">Tempo fora da tolerância (${percentDiff.toFixed(1)}%)</div>`;
    }
}

// Função para atualizar a tabela de resultados
function updateResultsTable(points, pickupCurrent) {
    const tbody = document.getElementById('results-body');
    tbody.innerHTML = '';
    
    const step = Math.max(1, Math.floor(points.length / 10));
    
    for (let i = 0; i < points.length; i += step) {
        const point = points[i];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${(point.x / pickupCurrent).toFixed(2)}</td>
            <td>${point.x.toFixed(2)}</td>
            <td>${point.y.toFixed(3)}</td>
        `;
        tbody.appendChild(row);
    }
}

// Função para gerar a curva
function generateCurve() {
    try {
        const curveType = document.getElementById('curve-type').value;
        const pickupCurrent = parseFloat(document.getElementById('pickup-current').value);
        const timeDialSetting = parseFloat(document.getElementById('time-dial').value);
        
        // Obter correntes de falta para todas as fases
        const faultCurrentA = parseFloat(document.getElementById('fault-current-a').value);
        const faultCurrentB = parseFloat(document.getElementById('fault-current-b').value);
        const faultCurrentC = parseFloat(document.getElementById('fault-current-c').value);
        
        // Obter tempos medidos para todas as fases
        const measuredTimeA = parseFloat(document.getElementById('measured-time-a').value);
        const measuredTimeB = parseFloat(document.getElementById('measured-time-b').value);
        const measuredTimeC = parseFloat(document.getElementById('measured-time-c').value);

        if (!curveType || !pickupCurrent || !timeDialSetting || !faultCurrentA || !faultCurrentB || !faultCurrentC) {
            alert('Por favor, preencha todos os campos obrigatórios!');
            return;
        }

        const maxFaultCurrent = Math.max(faultCurrentA, faultCurrentB, faultCurrentC);
        if (maxFaultCurrent <= pickupCurrent) {
            alert('A corrente de falta deve ser maior que a corrente de pickup!');
            return;
        }

        // Salvar dados do teste atual
        currentTestData = {
            curveType,
            pickupCurrent,
            timeDialSetting,
            faultCurrentA,
            faultCurrentB,
            faultCurrentC,
            measuredTimeA,
            measuredTimeB,
            measuredTimeC
        };

        // Gerar pontos de corrente
        const currents = generatePoints(pickupCurrent, maxFaultCurrent * 2);
        
        // Calcular tempos para cada corrente
        const points = currents.map(current => {
            const multiple = current / pickupCurrent;
            const time = calculateOperationTime(multiple, curveType, timeDialSetting);
            return time ? { x: current, y: time } : null;
        }).filter(point => point !== null);

        // Calcular tempos teóricos para cada fase
        const theoreticalTimeA = calculateOperationTime(faultCurrentA / pickupCurrent, curveType, timeDialSetting);
        const theoreticalTimeB = calculateOperationTime(faultCurrentB / pickupCurrent, curveType, timeDialSetting);
        const theoreticalTimeC = calculateOperationTime(faultCurrentC / pickupCurrent, curveType, timeDialSetting);

        if (!theoreticalTimeA || !theoreticalTimeB || !theoreticalTimeC) {
            alert('Erro no cálculo dos tempos teóricos!');
            return;
        }

        // Criar ou atualizar o gráfico
        const ctx = document.getElementById('curveChart').getContext('2d');
        
        if (curveChart) {
            curveChart.destroy();
        }

        const datasets = [{
            label: 'Curva Característica',
            data: points,
            borderColor: '#003366',
            backgroundColor: 'rgba(0, 51, 102, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            fill: true
        }];

        // Adicionar pontos teóricos e medidos para cada fase
        const phases = [
            { label: 'A', current: faultCurrentA, theoretical: theoreticalTimeA, measured: measuredTimeA, color: '#ffd700' },
            { label: 'B', current: faultCurrentB, theoretical: theoreticalTimeB, measured: measuredTimeB, color: '#ff4444' },
            { label: 'C', current: faultCurrentC, theoretical: theoreticalTimeC, measured: measuredTimeC, color: '#44ff44' }
            
        ];

        phases.forEach(phase => {
            // Ponto teórico
            datasets.push({
                label: `Tempo Teórico ${phase.label}`,
                data: [{
                    x: phase.current,
                    y: phase.theoretical
                }],
                borderColor: phase.color,
                backgroundColor: phase.color,
                borderWidth: 2,
                pointRadius: 8,
                pointStyle: 'triangle'
            });

            // Ponto medido (se disponível)
            if (!isNaN(phase.measured)) {
                datasets.push({
                    label: `Tempo Medido ${phase.label}`,
                    data: [{
                        x: phase.current,
                        y: phase.measured
                    }],
                    borderColor: phase.color,
                    backgroundColor: phase.color,
                    borderWidth: 2,
                    pointRadius: 8,
                    pointStyle: 'circle'                    
                });

                // Atualizar comparação
                updateTimeComparison(phase.theoretical, phase.measured, phase.label);
            }
        });

        curveChart = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'logarithmic',
                        position: 'bottom',
                        min: pickupCurrent,
                        max: maxFaultCurrent * 2,
                        title: {
                            display: true,
                            text: 'Corrente (A)',
                            font: { weight: 'bold', size: 14 }
                        },
                        ticks: {
                            callback: value => value.toFixed(1) + ' A'
                        }
                    },
                    y: {
                        type: 'logarithmic',
                        min: 0.01,
                        max: Math.max(...points.map(p => p.y)) * 1.2,
                        title: {
                            display: true,
                            text: 'Tempo (s)',
                            font: { weight: 'bold', size: 14 }
                        },
                        ticks: {
                            callback: value => value.toFixed(2) + ' s'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(3)} s @ ${context.parsed.x.toFixed(2)} A`;
                            }
                        }
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: { size: 12, weight: 'bold' }
                        }
                    }
                }
            }
        });

        // Atualizar tabela de resultados
        updateResultsTable(points, pickupCurrent);

    } catch (error) {
        console.error('Erro ao gerar curva:', error);
        alert('Erro ao gerar a curva. Verifique os valores inseridos.');
    }
}

// Função para gerar relatório
function generateReport() {
    if (!currentTestData) {
        alert('Por favor, gere uma curva antes de criar o relatório.');
        return;
    }

    const reportData = {
        client: document.getElementById('client').value,
        relayModel: document.getElementById('relay-model').value,
        serialNumber: document.getElementById('serial-number').value,
        testDate: document.getElementById('test-date').value,
        testType: document.getElementById('test-type').value,
        testData: currentTestData,
        timestamp: new Date().toISOString()
        };

    if (!reportData.client || !reportData.relayModel || !reportData.serialNumber || !reportData.testDate || !reportData.testType) {
        alert('Por favor, preencha todos os campos do relatório.');
        return;
    }

    let reports = JSON.parse(localStorage.getItem('reports') || '[]');
    reports.push(reportData);
    localStorage.setItem('reports', JSON.stringify(reports));

    alert('Relatório gerado com sucesso!');
    loadReports();
}

// Função para carregar relatórios
function loadReports() {
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    const tbody = document.getElementById('reports-body');
    tbody.innerHTML = '';

    reports.forEach(report => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(report.testDate).toLocaleDateString()}</td>
            <td>${report.relayModel}</td>
            <td>${report.serialNumber}</td>
            <td>${report.testType}</td>
            <td>
                <button onclick="viewReport('${report.serialNumber}')" class="view-btn">
                    <span class="btn-icon">👁️</span> Ver
                </button>
                <button onclick="printReport('${report.serialNumber}')" class="print-btn">
                    <span class="btn-icon">🖨️</span> Imprimir
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Função para buscar relatórios
function searchReports() {
    const searchTerm = document.getElementById('search-serial').value.toLowerCase();
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    const filteredReports = reports.filter(report => 
        report.serialNumber.toLowerCase().includes(searchTerm)
    );

    const tbody = document.getElementById('reports-body');
    tbody.innerHTML = '';

    filteredReports.forEach(report => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(report.testDate).toLocaleDateString()}</td>
            <td>${report.relayModel}</td>
            <td>${report.serialNumber}</td>
            <td>${report.testType}</td>
            <td>
                <button onclick="viewReport('${report.serialNumber}')" class="view-btn">
                    <span class="btn-icon">👁️</span> Ver
                </button>
                <button onclick="printReport('${report.serialNumber}')" class="print-btn">
                    <span class="btn-icon">🖨️</span> Imprimir
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Função para visualizar relatório
function viewReport(serialNumber) {
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    const report = reports.find(r => r.serialNumber === serialNumber);
    if (report) {
        alert(`
            Cliente: ${report.client}
            Modelo: ${report.relayModel}
            Número de Série: ${report.serialNumber}
            Data do Ensaio: ${new Date(report.testDate).toLocaleDateString()}
            Tipo de Ensaio: ${report.testType}
            
            Dados do Teste:
            Tipo de Curva: ${report.testData.curveType}
            Corrente de Pickup: ${report.testData.pickupCurrent} A
            Dial de Tempo: ${report.testData.timeDialSetting}
            
            Fase A:
            Corrente de Falta: ${report.testData.faultCurrentA} A
            Tempo Medido: ${report.testData.measuredTimeA || 'N/A'} s
            
            Fase B:
            Corrente de Falta: ${report.testData.faultCurrentB} A
            Tempo Medido: ${report.testData.measuredTimeB || 'N/A'} s
            
            Fase C:
            Corrente de Falta: ${report.testData.faultCurrentC} A
            Tempo Medido: ${report.testData.measuredTimeC || 'N/A'} s         

        `);
    }
}

// Função para imprimir relatório
function printReport(serialNumber) {
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    const report = reports.find(r => r.serialNumber === serialNumber);
    if (report) {
        const printWindow = window.open('', '', 'width=800,height=600');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Relatório de Ensaio - ${report.serialNumber}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { color: #003366; }
                        .report-item { margin: 10px 0; }
                        .label { font-weight: bold; }
                        .phase-data { margin: 20px 0; padding: 10px; border: 1px solid #ccc; }
                    </style>
                </head>
                <body>
                    <h1>Relatório de Ensaio</h1>
                    <div class="report-item">
                        <span class="label">Cliente:</span> ${report.client}
                    </div>
                    <div class="report-item">
                        <span class="label">Fabricante/ Modelo do Relé:</span> ${report.relayModel}
                    </div>
                    <div class="report-item">
                        <span class="label">Número de Série:</span> ${report.serialNumber}
                    </div>
                    <div class="report-item">
                        <span class="label">Data do Ensaio:</span> ${new Date(report.testDate).toLocaleDateString()}
                    </div>
                    <div class="report-item">
                        <span class="label">Tipo de Ensaio:</span> ${report.testType}
                    </div>
                    
                    <h2>Dados do Teste</h2>
                    <div class="report-item">
                        <span class="label">Tipo de Curva:</span> ${report.testData.curveType}
                    </div>
                    <div class="report-item">
                        <span class="label">Corrente de Pickup:</span> ${report.testData.pickupCurrent} A
                    </div>
                    <div class="report-item">
                        <span class="label">Dial de Tempo:</span> ${report.testData.timeDialSetting}
                    </div>
                    
                    <div class="phase-data">
                        <h3>Fase A</h3>
                        <div class="report-item">
                            <span class="label">Corrente de Falta:</span> ${report.testData.faultCurrentA} A
                        </div>
                        <div class="report-item">
                            <span class="label">Tempo Medido:</span> ${report.testData.measuredTimeA || 'N/A'} s
                        </div>
                    </div>
                    
                    <div class="phase-data">
                        <h3>Fase B</h3>
                        <div class="report-item">
                            <span class="label">Corrente de Falta:</span> ${report.testData.faultCurrentB} A
                        </div>
                        <div class="report-item">
                            <span class="label">Tempo Medido:</span> ${report.testData.measuredTimeB || 'N/A'} s
                        </div>
                    </div>
                    
                    <div class="phase-data">
                        <h3>Fase C</h3>
                        <div class="report-item">
                            <span class="label">Corrente de Falta:</span> ${report.testData.faultCurrentC} A
                        </div>
                        <div class="report-item">
                            <span class="label">Tempo Medido:</span> ${report.testData.measuredTimeC || 'N/A'} s
                        </div>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Tab navigation
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Auto-update on measured time change
    ['a', 'b', 'c'].forEach(phase => {
        const measuredTimeInput = document.getElementById(`measured-time-${phase}`);
        if (measuredTimeInput) {
            measuredTimeInput.addEventListener('change', generateCurve);
        }
    });

    // Load existing reports
    loadReports();
});
    