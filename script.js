/*
  Калькулятор отопления в Сербии.
  Цель: реалистичный, но простой расчёт сравнения вариантов:
  - газ
  - дрова
  - тепловой насос
  - климат/кондиционеры в комнатах
  - пеллеты

  Важно:
  - значения по умолчанию выставлены как средние/типичные для Сербии
  - всё можно изменить вручную
  - расчёт включает:
      * теплопотери дома
      * капитальные затраты
      * ежегодные расходы на обслуживание/топливо
      * электричество вне отопления
      * распределение по зонам (зелёная / синяя / красная)
      * двухтарифный счётчик
*/

const defaults = {
  houseArea: 180,
  insulationLevel: "75",
  heatLossPerSqm: 75,
  targetTemp: 21,
  outsideTemp: 8.5,
  heatingMonths: 6,
  nonHeatingElectricity: 4200,
  comfortLevel: 1,
  gasPrice: 0.95,
  woodPrice: 85,
  pelletPrice: 230,
  greenRate: 0.07,
  blueRate: 0.11,
  redRate: 0.17,
  zoneDayShare: 45,
  zoneNightShare: 35,
  twoRateMeter: false,
};

function getInputs() {
  return {
    houseArea: Number(document.getElementById("houseArea").value) || defaults.houseArea,
    insulationLevel: Number(document.getElementById("insulationLevel").value) || Number(defaults.insulationLevel),
    heatLossPerSqm: Number(document.getElementById("heatLossPerSqm").value) || defaults.heatLossPerSqm,
    targetTemp: Number(document.getElementById("targetTemp").value) || defaults.targetTemp,
    outsideTemp: Number(document.getElementById("outsideTemp").value) || defaults.outsideTemp,
    heatingMonths: Number(document.getElementById("heatingMonths").value) || defaults.heatingMonths,
    nonHeatingElectricity:
      Number(document.getElementById("nonHeatingElectricity").value) || defaults.nonHeatingElectricity,
    comfortLevel: Number(document.getElementById("comfortLevel").value) || defaults.comfortLevel,
    gasPrice: Number(document.getElementById("gasPrice").value) || defaults.gasPrice,
    woodPrice: Number(document.getElementById("woodPrice").value) || defaults.woodPrice,
    pelletPrice: Number(document.getElementById("pelletPrice").value) || defaults.pelletPrice,
    greenRate: Number(document.getElementById("greenRate").value) || defaults.greenRate,
    blueRate: Number(document.getElementById("blueRate").value) || defaults.blueRate,
    redRate: Number(document.getElementById("redRate").value) || defaults.redRate,
    zoneDayShare: Number(document.getElementById("zoneDayShare").value) || defaults.zoneDayShare,
    zoneNightShare: Number(document.getElementById("zoneNightShare").value) || defaults.zoneNightShare,
    twoRateMeter: document.getElementById("twoRateMeter").checked,
  };
}

function setDefaults() {
  document.getElementById("houseArea").value = defaults.houseArea;
  document.getElementById("insulationLevel").value = defaults.insulationLevel;
  document.getElementById("heatLossPerSqm").value = defaults.heatLossPerSqm;
  document.getElementById("targetTemp").value = defaults.targetTemp;
  document.getElementById("outsideTemp").value = defaults.outsideTemp;
  document.getElementById("heatingMonths").value = defaults.heatingMonths;
  document.getElementById("nonHeatingElectricity").value = defaults.nonHeatingElectricity;
  document.getElementById("comfortLevel").value = defaults.comfortLevel;
  document.getElementById("gasPrice").value = defaults.gasPrice;
  document.getElementById("woodPrice").value = defaults.woodPrice;
  document.getElementById("pelletPrice").value = defaults.pelletPrice;
  document.getElementById("greenRate").value = defaults.greenRate;
  document.getElementById("blueRate").value = defaults.blueRate;
  document.getElementById("redRate").value = defaults.redRate;
  document.getElementById("zoneDayShare").value = defaults.zoneDayShare;
  document.getElementById("zoneNightShare").value = defaults.zoneNightShare;
  document.getElementById("twoRateMeter").checked = defaults.twoRateMeter;
  runCalculation();
}

function calculateHeatDemand(inputs) {
  /*
    Примерная оценка теплопотерь:
    - используем базовую теплопроизводительность дома из площади × kWh/м²/год
    - корректируем на целевую температуру и сезонность
    - добавляем небольшой запас комфорта
  */
  const baseHeatingDemand = inputs.houseArea * inputs.heatLossPerSqm;
  const tempFactor = 1 + Math.max(0, (inputs.targetTemp - 18) * 0.03);
  const seasonFactor = 1 + (inputs.heatingMonths / 12) * 0.4;
  const comfortFactor = inputs.comfortLevel;

  const annualHeatDemand = baseHeatingDemand * tempFactor * seasonFactor * comfortFactor;

  return annualHeatDemand;
}

function calculateElectricityCostForZones(kwh, inputs) {
  /*
    Вариант "электричество" включает:
    - энергию вне отопления
    - энергию на отопление
    - распределение по зонам: зелёная / синяя / красная
    - при двухтарифном счётчике ночной и дневной тариф учитываются отдельно
  */
  const dayShare = Math.max(0, Math.min(100, inputs.zoneDayShare || 45)) / 100;
  const nightShare = Math.max(0, Math.min(100, inputs.zoneNightShare || 35)) / 100;

  const greenShare = 1 - dayShare - nightShare;
  const greenKwh = Math.max(0, kwh * Math.max(0, greenShare));
  const blueKwh = Math.max(0, kwh * dayShare);
  const redKwh = Math.max(0, kwh * Math.max(0, 1 - dayShare - nightShare));

  let finalGreen = greenKwh;
  let finalBlue = blueKwh;
  let finalRed = redKwh;

  if (inputs.twoRateMeter) {
    const cheapShift = Math.min(0.38, nightShare * 0.7);
    finalBlue = kwh * (dayShare + cheapShift);
    finalGreen = kwh * Math.max(0, greenShare);
    finalRed = kwh * Math.max(0, 1 - dayShare - cheapShift - greenShare);
  }

  const greenCost = finalGreen * inputs.greenRate;
  const blueCost = finalBlue * inputs.blueRate;
  const redCost = finalRed * inputs.redRate;

  return {
    greenKwh: finalGreen,
    blueKwh: finalBlue,
    redKwh: finalRed,
    totalCost: greenCost + blueCost + redCost,
  };
}

function calculateTechnologyResults(inputs) {
  const heatDemand = calculateHeatDemand(inputs);

  const results = [];

  const gasFuelNeed = heatDemand / (9.8 * 0.92);
  const gasAnnualFuelCost = gasFuelNeed * inputs.gasPrice;
  const gasCapital = 6700 + 850 + 1500 + 900;
  const gasMaintenance = 220;
  results.push({
    key: "gas",
    name: "Газовый котёл",
    capital: gasCapital,
    annualOperating: gasAnnualFuelCost + gasMaintenance,
    annualFuel: gasAnnualFuelCost,
    outputKwh: heatDemand,
    note: "Лучше при наличии газовой магистрали или уверенности в подключении.",
  });

  const woodVolume = heatDemand / 2200;
  const woodAnnualFuelCost = woodVolume * inputs.woodPrice;
  const woodCapital = 8200 + 1200 + 1600 + 1000;
  const woodMaintenance = 300;
  results.push({
    key: "wood",
    name: "Дровяной котёл",
    capital: woodCapital,
    annualOperating: woodAnnualFuelCost + woodMaintenance,
    annualFuel: woodAnnualFuelCost,
    outputKwh: heatDemand,
    note: "Очень выгодно, если есть дешёвые дрова и место для хранения.",
  });

  const heatPumpElectricity = heatDemand / 3.4;
  const hpZoneCost = calculateElectricityCostForZones(
    inputs.nonHeatingElectricity + heatPumpElectricity,
    inputs
  );
  const hpCapital = 10400 + 2000 + 1600 + 1200;
  results.push({
    key: "heatPump",
    name: "Тепловой насос",
    capital: hpCapital,
    annualOperating: hpZoneCost.totalCost + 260,
    annualFuel: hpZoneCost.totalCost,
    outputKwh: heatDemand,
    note: "Лучший в долгосрочной перспективе при хорошем утеплении и стабильном электричестве.",
  });

  const acElectricity = heatDemand / 3.1;
  const acZoneCost = calculateElectricityCostForZones(
    inputs.nonHeatingElectricity + acElectricity,
    inputs
  );
  const acCapital = 4200 + 1500 + 800 + 600;
  results.push({
    key: "ac",
    name: "Климатические системы по комнатам",
    capital: acCapital,
    annualOperating: acZoneCost.totalCost + 180,
    annualFuel: acZoneCost.totalCost,
    outputKwh: heatDemand,
    note: "Хорошо для локального обогрева, но менее эффективно в большом доме.",
  });

  const pelletMass = heatDemand / 4800;
  const pelletAnnualCost = pelletMass * inputs.pelletPrice;
  const pelletCapital = 10800 + 2200 + 1600 + 900;
  const pelletMaintenance = 340;
  results.push({
    key: "pellets",
    name: "Пеллетный котёл",
    capital: pelletCapital,
    annualOperating: pelletAnnualCost + pelletMaintenance,
    annualFuel: pelletAnnualCost,
    outputKwh: heatDemand,
    note: "Удобно и автоматизировано, но часто дороже в капитале чем дрова.",
  });

  return results;
}

function buildTechnologyCards(results) {
  const container = document.getElementById("technologyCards");
  container.innerHTML = "";

  const tenYearCosts = results.map((result) => ({
    ...result,
    total10: result.capital + result.annualOperating * 10,
  }));

  const best = tenYearCosts.reduce((bestEntry, current) =>
    current.total10 < bestEntry.total10 ? current : bestEntry
  );

  tenYearCosts.forEach((result) => {
    const card = document.createElement("div");
    card.className = `tech-card ${result.key === best.key ? "best" : ""}`;

    const yearlyTotal = result.capital + result.annualOperating * 10;

    card.innerHTML = `
      <div class="tech-card-header d-flex justify-content-between align-items-center">
        <h3>${result.name}</h3>
        ${
          result.key === best.key
            ? '<span class="badge bg-success-subtle text-success-emphasis">Лучший по 10-летней стоимости</span>'
            : '<span class="badge bg-light text-secondary">Сравнение</span>'
        }
      </div>

      <div class="tech-card-body">
        <p class="mb-3 text-muted">${result.note}</p>

        <div class="kpis">
          <div class="kpi">
            <span class="label">Первичные затраты</span>
            <span class="value">${formatMoney(result.capital)}</span>
          </div>

          <div class="kpi">
            <span class="label">Годовые расходы</span>
            <span class="value">${formatMoney(result.annualOperating)}</span>
          </div>

          <div class="kpi">
            <span class="label">10 лет</span>
            <span class="value">${formatMoney(yearlyTotal)}</span>
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function fillSummaryTable(results) {
  const tableBody = document.getElementById("comparisonTableBody");
  tableBody.innerHTML = "";

  const tenYearCosts = results.map((result) => ({
    ...result,
    total10: result.capital + result.annualOperating * 10,
  }));

  const best = tenYearCosts.reduce((bestEntry, current) =>
    current.total10 < bestEntry.total10 ? current : bestEntry
  );

  tenYearCosts
    .sort((a, b) => a.total10 - b.total10)
    .forEach((result) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${result.name}</td>
        <td>${formatMoney(result.capital)}</td>
        <td>${formatMoney(result.annualOperating)}</td>
        <td>${formatMoney(result.total10)}</td>
        <td>${result.key === best.key ? "Да" : "—"}</td>
      `;
      tableBody.appendChild(tr);
    });
}

function formatMoney(value) {
  return new Intl.NumberFormat("ru-RS", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatKwh(value) {
  return `${Math.round(value).toLocaleString("ru-RS")} кВт·ч/год`;
}

function runCalculation() {
  const inputs = getInputs();

  const heatDemand = calculateHeatDemand(inputs);
  const nonHeatingCost = calculateElectricityCostForZones(inputs.nonHeatingElectricity, inputs).totalCost;

  document.getElementById("heatDemandDisplay").textContent = formatKwh(heatDemand);
  document.getElementById("nonHeatingElectricityDisplay").textContent = formatMoney(nonHeatingCost);
  document.getElementById("sumLoadDisplay").textContent = `${(
    heatDemand /
    (inputs.heatingMonths * 30 * 24)
  ).toFixed(1)} кВт`;

  const results = calculateTechnologyResults(inputs);

  fillSummaryTable(results);
  buildTechnologyCards(results);
}

document.addEventListener("DOMContentLoaded", () => {
  const allInputs = document.querySelectorAll("input, select");
  allInputs.forEach((input) => {
    input.addEventListener("input", runCalculation);
    input.addEventListener("change", runCalculation);
  });

  document.getElementById("resetDefaultsBtn").addEventListener("click", setDefaults);

  setDefaults();
});
